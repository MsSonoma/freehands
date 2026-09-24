import { AI_MODEL } from '../aiModel.js'

const PLANNING_MOVES = new Set(['branch', 'continue', 'return', 'facilitator_goal'])
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'the', 'to', 'of', 'for', 'in', 'on', 'with', 'using', 'use',
  'understand', 'understanding', 'explore', 'exploring', 'learn', 'learning', 'intro',
  'introduction', 'practice', 'practicing', 'review', 'reviewing', 'apply', 'applying',
  'through', 'from', 'by', 'about',
])

function clean(value, max = Infinity) { return String(value || '').trim().slice(0, max) }
function subjectKey(value) { return clean(value).toLocaleLowerCase() }
function strandKey(value) { return clean(value).toLocaleLowerCase() }

function normalizeTopicToken(value) {
  let token = String(value || '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, '')
  if (token.length > 4 && token.endsWith('ies')) token = `${token.slice(0, -3)}y`
  else if (token.length > 4 && token.endsWith('ing')) token = token.slice(0, -3)
  else if (token.length > 3 && token.endsWith('s')) token = token.slice(0, -1)
  return token
}

function topicTokens(value) {
  return [...new Set(String(value || '')
    .split(/\s+/)
    .map(normalizeTopicToken)
    .filter((token) => token && token.length > 2 && !STOP_WORDS.has(token)))]
}

function substantiallySameTopic(left, right) {
  const a = topicTokens(left)
  const b = topicTokens(right)
  if (!a.length || !b.length) return false
  const bSet = new Set(b)
  const overlap = a.filter((token) => bSet.has(token)).length
  const union = new Set([...a, ...b]).size
  if (Math.min(a.length, b.length) <= 2) return overlap === Math.min(a.length, b.length)
  return overlap >= 2 && overlap / union >= 0.6
}

function breadthForSubject(context, subject) {
  const subjects = context?.subject_breadth?.subjects || {}
  return subjects[subjectKey(subject)] || Object.values(subjects).find((entry) => subjectKey(entry?.subject) === subjectKey(subject)) || null
}

function curriculumForSubject(context, subject) {
  const subjects = context?.curriculum_guidance?.subjects || {}
  return subjects[subjectKey(subject)] || Object.values(subjects).find((entry) => subjectKey(entry?.subject) === subjectKey(subject)) || null
}

function historicalTopicLabels(subjectBreadth) {
  if (!subjectBreadth) return []
  const labels = []
  for (const entry of subjectBreadth.recent_topic_history || []) {
    const label = clean(typeof entry === 'string' ? entry : entry?.title)
    if (label) labels.push(label)
  }
  for (const entry of subjectBreadth.future_intent || []) {
    const label = clean(typeof entry === 'string' ? entry : entry?.title)
    if (label) labels.push(label)
  }
  return [...new Set(labels)]
}

function validateCurriculumSelection({ item, slot, context, planningMove }) {
  const subject = curriculumForSubject(context, slot?.subject)
  if (!subject) {
    return {
      requirementKey: null,
      planningGroupKey: null,
      candidate: null,
      instructionalChange: null,
    }
  }

  const eligibleKeys = Array.isArray(subject.eligible_requirement_keys)
    ? subject.eligible_requirement_keys
    : []
  const requirementKey = clean(item?.requirement_key, 240)

  // Once the facilitator-authored contract has no remaining required or
  // eligible work for this subject, allow a breadth/enrichment branch without
  // pretending it satisfies a curriculum requirement.
  if (!eligibleKeys.length && Number(subject.required_remaining || 0) === 0) {
    if (requirementKey) {
      throw new Error('Instructional forecast selected a curriculum requirement after the active contract had no eligible requirement for this subject')
    }
    if (!['branch', 'facilitator_goal'].includes(planningMove)) {
      throw new Error('Instructional forecast must branch when the active curriculum contract has no eligible requirement for this subject')
    }
    return {
      requirementKey: null,
      planningGroupKey: null,
      candidate: null,
      instructionalChange: null,
    }
  }

  if (!requirementKey) throw new Error('Instructional forecast omitted the server-authorized curriculum requirement')
  const candidate = (subject.candidates || []).find((entry) => entry.requirement_key === requirementKey)
  if (!candidate || candidate.eligible !== true || !eligibleKeys.includes(requirementKey)) {
    throw new Error('Instructional forecast selected a curriculum requirement outside the server-authorized candidate set')
  }
  if (candidate?.state?.mastery === 'demonstrated') {
    throw new Error('Instructional forecast repeated curriculum territory after demonstrated mastery')
  }
  if (Number(candidate?.state?.consecutive_exposures || 0) >= 3) {
    throw new Error('Instructional forecast exceeded the consecutive curriculum exposure cap')
  }

  const instructionalChange = clean(item?.instructional_change, 1000)
  if (candidate.decision_kind === 'recovery' || candidate.decision_kind === 'return') {
    if (!instructionalChange) {
      throw new Error('Curriculum continuation must state how the instructional approach progresses or changes')
    }
    const repeatedLesson = (candidate?.state?.recent_lessons || []).find((prior) => (
      substantiallySameTopic(item?.title, prior?.title)
      && clean(prior?.description)
      && substantiallySameTopic(item?.description, prior?.description)
    ))
    if (repeatedLesson) {
      throw new Error('Curriculum continuation repeated the prior lesson instead of progressing or changing the instructional approach')
    }
  }

  if (candidate.decision_kind === 'recovery' || candidate.decision_kind === 'return') {
    if (!['continue', 'return'].includes(planningMove)) {
      throw new Error('Curriculum recovery or return must be represented as an intentional continuation or return')
    }
  } else if (candidate.decision_kind === 'new_required' && planningMove !== 'branch') {
    throw new Error('A new required curriculum territory must branch rather than masquerade as continuation')
  } else if (['goal', 'enrichment'].includes(candidate.decision_kind) && !['branch', 'facilitator_goal'].includes(planningMove)) {
    throw new Error('A facilitator goal or enrichment choice must not masquerade as recovery')
  }

  return {
    requirementKey,
    planningGroupKey: clean(candidate.planning_group_key, 240),
    candidate,
    instructionalChange: instructionalChange || null,
  }
}
export function validateInstructionalForecastItems(items, slots = [], context = {}) {
  if (!Array.isArray(items) || items.length !== slots.length) throw new Error('Instructional forecast model returned an unexpected item count')
  const seenStrands = new Map()
  const curriculumSequence = new Map()
  const curriculumLessons = new Map()

  return items.map((item, index) => {
    const title = clean(item?.title, 300)
    const description = clean(item?.description, 2000)
    const planningMove = clean(item?.planning_move).toLocaleLowerCase()
    const strand = clean(item?.strand, 200)
    const planningReason = clean(item?.planning_reason, 1000)
    if (!title || !description) throw new Error('Instructional forecast model returned an incomplete lesson concept')
    if (!PLANNING_MOVES.has(planningMove)) throw new Error('Instructional forecast model returned an invalid planning move')
    if (!strand) throw new Error('Instructional forecast model returned no instructional strand')
    if (planningMove !== 'branch' && !planningReason) throw new Error('Instructional forecast continuation or return requires an explicit instructional reason')

    const slot = slots[index] || {}
    const subject = subjectKey(slot.subject)
    const curriculumSelection = validateCurriculumSelection({ item, slot, context, planningMove })
    const subjectBreadth = breadthForSubject(context, slot.subject)

    if (!curriculumSelection.candidate) {
      curriculumSequence.delete(subject)
      if (
        subjectBreadth?.default_planning_move === 'branch'
        && !['branch', 'facilitator_goal'].includes(planningMove)
        && !clean(context?.syllabus?.facilitator_change_request)
      ) {
        throw new Error('Instructional forecast attempted to continue recent territory without unresolved evidence or educator direction')
      }
      if (planningMove === 'branch') {
        const repeated = historicalTopicLabels(subjectBreadth).find((prior) => substantiallySameTopic(title, prior))
        if (repeated) {
          throw new Error('Instructional forecast reworded recent topic territory while claiming to branch')
        }
      }
    }

    let exposureNumber = null
    if (curriculumSelection.candidate) {
      const group = curriculumSelection.planningGroupKey
      const priorSequence = curriculumSequence.get(subject)
      const startingCount = priorSequence
        ? (priorSequence.group === group ? priorSequence.count : 0)
        : Number(curriculumSelection.candidate?.state?.consecutive_exposures || 0)
      exposureNumber = startingCount + 1

      if (exposureNumber > 3) {
        throw new Error('Instructional forecast exceeded the three-lesson consecutive curriculum exposure cap')
      }
      if (priorSequence?.group === group) {
        throw new Error('Instructional forecast scheduled another same-territory lesson before new learner evidence could justify continuation')
      }

      const lessonSequenceKey = subject + ':' + group
      const priorLesson = curriculumLessons.get(lessonSequenceKey)
      if (priorLesson) {
        if (
          substantiallySameTopic(title, priorLesson.title)
          && substantiallySameTopic(description, priorLesson.description)
        ) {
          throw new Error('Curriculum continuation repeated a same-week lesson instead of progressing the instruction')
        }
        if (
          curriculumSelection.instructionalChange
          && priorLesson.instructional_change
          && substantiallySameTopic(curriculumSelection.instructionalChange, priorLesson.instructional_change)
        ) {
          throw new Error('Curriculum continuation reused the same instructional change instead of progressing again')
        }
      }

      curriculumSequence.set(subject, { group, count: exposureNumber })
      curriculumLessons.set(lessonSequenceKey, {
        title,
        description,
        instructional_change: curriculumSelection.instructionalChange,
      })
    }

    const strandIdentity = strandKey(strand)
    const prior = seenStrands.get(subject) || new Set()
    if (planningMove === 'branch' && prior.has(strandIdentity)) {
      throw new Error('Instructional forecast repeated a strand while claiming to branch')
    }
    prior.add(strandIdentity)
    seenStrands.set(subject, prior)

    return {
      title,
      description,
      planning_move: planningMove,
      strand,
      planning_reason: planningReason || null,
      requirement_key: curriculumSelection.requirementKey,
      planning_group_key: curriculumSelection.planningGroupKey,
      instructional_change: curriculumSelection.instructionalChange,
      exposure_number: exposureNumber,
    }
  })
}
export async function generateInstructionalForecastItems({ slots, context, fetchImpl = fetch } = {}) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('Instructional forecasting is not configured')
  const hasCurriculumGuidance = Boolean(context?.curriculum_guidance?.subjects && Object.keys(context.curriculum_guidance.subjects).length)

  const systemContent = [
    'Return only valid JSON. You are selecting and describing instruction inside server-owned curriculum and scheduling authority.',
    'Educator goals, supplied curriculum, explicit requirements, and facilitator changes have first authority. The server owns subject, slot, schedule, permissions, mastery evidence interpretation, repetition caps, and eligible curriculum candidates.',
    hasCurriculumGuidance
      ? 'When curriculum_guidance supplies candidates for a subject, choose exactly one eligible requirement_key from that subject. Never invent, rename, merge, or substitute requirement identifiers. If a subject has no eligible requirements and required_remaining is zero, requirement_key may be null and you should branch into age-appropriate breadth or facilitator-goal work.'
      : 'When no curriculum contract exists for a subject, plan broad instructional coverage using subject_breadth.',
    'For every slot choose planning_move: branch, continue, return, or facilitator_goal. Then choose a broad strand, title, and concise description.',
    'Learning history is evidence, not a command to continue the newest topic. Recent successful instruction is a reason to move on, not a reason to repeat it.',
    'Actively maintain subject breadth across weeks. Unresolved mastery may justify a short continuation, but the next lesson must change representation, application, scaffold, or unresolved facet rather than merely rewording the previous lesson.',
    'For every curriculum recovery or return, instructional_change is required and must briefly state the concrete pedagogical change from the prior lesson.',
    'No instructional territory may continue indefinitely. The server caps consecutive curriculum exposures at three.',
    'Current unresolved evidence may authorize only the next continuation. Do not schedule another same-territory slot in the same forecast before new learner evidence exists. A third exposure becomes eligible only after the second lesson still leaves mastery unresolved.',
    'Do not pre-schedule repeated new territory before learner evidence exists. Repetition is authorized by unresolved evidence, not by recency alone.',
    'branch is the default when there is no concrete unresolved need, prerequisite dependency, facilitator goal, or required-curriculum reason to stay.',
    'continue is allowed only for a real unresolved learning need, prerequisite chain, unfinished sequence, or necessary scaffold. Its planning_reason must name that reason.',
    'return is for a deliberate later return to prior territory. Do not turn retention-only work, Daily Follow-Up, Weekly Review, or mastery checks into another full forecast lesson.',
    'Use learner grade to make the instruction age-appropriate. Coordinate multiple slots in the same subject without tunneling into one topic.',
    'When syllabus.replacement_mode is fresh_alternative, prefer a meaningfully different eligible requirement or planning group unless the curriculum state requires continuation.',
    'When syllabus.facilitator_change_request is present, make the smallest coherent change that satisfies it while remaining inside server-authorized candidates.',
    'Do not create review schedules, retention checks, recovery notifications, mastery outcomes, dates, ownership, permissions, or curriculum requirements.',
  ].join(' ')

  const userPayload = {
    task: 'Return {"items":[{"requirement_key":"exact eligible key or null when no eligible contract requirement exists","planning_move":"branch|continue|return|facilitator_goal","strand":"broad instructional strand","planning_reason":"brief reason or empty for branch","instructional_change":"required concrete change for recovery/return, otherwise empty","title":"lesson title","description":"concise lesson description"}]} with exactly one item per server-owned slot, in the same order.',
    slots: slots.map((slot) => ({ subject: slot.subject })),
    learner: context.learner || null,
    syllabus: context.syllabus,
    curriculum_guidance: context.curriculum_guidance || null,
    subject_breadth: context.subject_breadth || null,
    evidence_summaries: context.evidence_summaries,
  }

  let validationFeedback = ''
  let lastValidationError = null

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: JSON.stringify({
            ...userPayload,
            ...(validationFeedback ? {
              server_validation_feedback: validationFeedback,
              correction_instruction: 'Correct the prior output while staying inside the same server-authorized slots and candidates.',
            } : {}),
          }) },
        ],
      }),
    })
    if (!response.ok) throw new Error('Instructional forecast model failed (' + response.status + ')')
    const payload = await response.json()
    const responseText = payload?.choices?.[0]?.message?.content

    try {
      const parsed = JSON.parse(responseText || '{}')
      return validateInstructionalForecastItems(parsed.items, slots, context)
    } catch (error) {
      lastValidationError = error
      validationFeedback = clean(error?.message || 'The prior output failed validation.', 700)
      if (attempt === 1) throw error
    }
  }

  throw lastValidationError || new Error('Instructional forecast model returned invalid output')
}