import { AI_MODEL } from '../aiModel.js'

const PLANNING_MOVES = new Set(['branch', 'continue', 'return', 'facilitator_goal'])

function clean(value, max = Infinity) { return String(value || '').trim().slice(0, max) }
function subjectKey(value) { return clean(value).toLocaleLowerCase() }
function strandKey(value) { return clean(value).toLocaleLowerCase() }

export function validateInstructionalForecastItems(items, slots = []) {
  if (!Array.isArray(items) || items.length !== slots.length) throw new Error('Instructional forecast model returned an unexpected item count')
  const seenStrands = new Map()
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

    const subject = subjectKey(slots[index]?.subject)
    const strandIdentity = strandKey(strand)
    const prior = seenStrands.get(subject) || new Set()
    if (planningMove === 'branch' && prior.has(strandIdentity)) {
      throw new Error('Instructional forecast repeated a strand while claiming to branch')
    }
    prior.add(strandIdentity)
    seenStrands.set(subject, prior)
    return { title, description, planning_move: planningMove, strand, planning_reason: planningReason || null }
  })
}

export async function generateInstructionalForecastItems({ slots, context, fetchImpl = fetch } = {}) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('Instructional forecasting is not configured')
  const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: [
          'Return only valid JSON. You are planning broad instructional coverage, not extending the most recent lesson by default.',
          'Educator goals, supplied curriculum, explicit focus, and facilitator change requests have first authority. The server owns subject, slot, schedule, permissions, and review/retention/recovery work.',
          'For every slot, first choose one planning_move: branch, continue, return, or facilitator_goal. Then choose a broad instructional strand and only then propose the lesson title and description.',
          'Learning history is evidence, not a command to continue the newest topic. branch is the default when no concrete instructional dependency or educator direction requires concentration.',
          'continue is allowed only for a real prerequisite chain, unfinished instructional sequence, or necessary scaffold. Its planning_reason must name that dependency; saying only that it is the next step is not enough.',
          'return is for instruction that genuinely needs revisiting. Do not turn pending mastery, retention, practice, review, or recovery into another forecast lesson; those belong to Mr. Slate and the mastery system.',
          'Use learner grade to select age-appropriate territory. broad_strands are broad planning domains, not a fixed curriculum. For a custom subject with no supplied map, infer several broad domains before selecting one.',
          'Actively maintain subject breadth across weeks. Prefer a different major strand when recent learning is concentrated and no continuation reason exists. Do not tunnel indefinitely into one topic.',
          'Coordinate multiple slots in the same subject. They may form a short intentional sequence, but repeated same-strand slots must be represented as continue with a concrete dependency rather than falsely labeled branch.',
          'When syllabus.replacement_mode is fresh_alternative, prefer a meaningfully different strand or topic from syllabus.current_forecast unless a concrete prerequisite requires the same strand.',
          'When syllabus.facilitator_change_request is present, make the smallest coherent change that satisfies it while keeping the server-owned subject and slot.',
          'Do not create review, Daily Follow-Up, Weekly Review, retention, recovery, mastery-check, assessment, date, schedule, ownership, or permission decisions.',
        ].join(' ') },
        { role: 'user', content: JSON.stringify({
          task: 'Return {"items":[{"planning_move":"branch|continue|return|facilitator_goal","strand":"broad instructional strand","planning_reason":"brief reason or empty for branch","title":"lesson title","description":"concise lesson description"}]} with exactly one item per server-owned slot, in the same order.',
          slots: slots.map((slot) => ({ subject: slot.subject })),
          learner: context.learner || null,
          syllabus: context.syllabus,
          subject_breadth: context.subject_breadth || null,
          evidence_summaries: context.evidence_summaries,
        }) },
      ],
    }),
  })
  if (!response.ok) throw new Error(`Instructional forecast model failed (${response.status})`)
  const payload = await response.json()
  const text = payload?.choices?.[0]?.message?.content
  let parsed
  try { parsed = JSON.parse(text || '{}') } catch { throw new Error('Instructional forecast model returned invalid JSON') }
  return validateInstructionalForecastItems(parsed.items, slots)
}
