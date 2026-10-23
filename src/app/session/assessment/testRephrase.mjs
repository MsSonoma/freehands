// Rewording is a session/assessment operation, not lesson generation.
// All answer data is owned by the original authored question, never by the model.

const FIELDS = Object.freeze([
  ['mc', 'multiplechoice'],
  ['tf', 'truefalse'],
  ['fib', 'fillintheblank'],
  ['short', 'shortanswer'],
])

const text = (value) => String(value ?? '').trim()
const key = (value) => text(value).toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '').trim()
const prompt = (item) => text(item?.question || item?.prompt || item?.Q || item?.q || item?.text)

export function assessmentQuestionType(item) {
  const explicit = text(item?.sourceType || item?.type || item?.questionType).toLowerCase()
  if (explicit === 'tf' || explicit === 'truefalse' || typeof item?.answer === 'boolean') return 'tf'
  if (explicit === 'mc' || Array.isArray(item?.choices) && item.choices.length >= 2 ||
    Array.isArray(item?.options) && item.options.length >= 2) return 'mc'
  if (explicit === 'fib' || explicit === 'fillintheblank' || /_{3,}/.test(prompt(item))) return 'fib'
  return 'short'
}

export function selectTestRephraseSources(lesson, targetCount = 10, random = Math.random) {
  if (!lesson) return []
  const target = Math.max(0, Number.isInteger(targetCount) ? targetCount : 10)
  const chosen = []
  const used = new Set()
  const add = (item, kind, sourceRole, position) => {
    if (chosen.length >= target || !prompt(item) || used.has(key(prompt(item)))) return false
    used.add(key(prompt(item)))
    const origId = text(item.id)
    chosen.push({
      ...item,
      id: sourceRole === 'test' && origId ? origId : `test-reword-${kind}-${position + 1}`,
      type: kind,
      sourceType: kind,
      question: prompt(item),
      number: chosen.length + 1,
      assessmentRole: 'assessment_reserved',
      assessment_role: 'assessment_reserved',
      evidence_purpose: 'test',
      sourceRole: sourceRole === 'test' ? 'test' : 'test_reword',
      rewordedFrom: { sourceRole, id: origId || null, question: prompt(item) },
    })
    return true
  }

  // Preserve objective coverage from the original held-out Test.
  const reserved = Array.isArray(lesson.test) ? lesson.test : []
  const objectives = Array.isArray(lesson.learningObjectives) ? lesson.learningObjectives : []
  for (const objective of objectives) {
    const item = reserved.find((candidate) =>
      text(candidate.objectiveId || candidate.objective_id) === text(objective.id) &&
      !used.has(key(prompt(candidate))))
    if (item) add(item, assessmentQuestionType(item), 'test', reserved.indexOf(item))
  }

  const pools = FIELDS.map(([kind, field]) => {
    const source = Array.isArray(lesson[field]) ? [...lesson[field]] : []
    for (let i = source.length - 1; i > 0; i--) {
      const j = Math.max(0, Math.min(i, Math.floor(random() * (i + 1))))
      ;[source[i], source[j]] = [source[j], source[i]]
    }
    return { kind, field, source, position: 0 }
  })

  // Use all original generated formats. Questions are copied, not removed from practice.
  while (chosen.length < target && pools.some(({ source, position }) => position < source.length)) {
    for (const pool of pools) {
      while (pool.position < pool.source.length) {
        const position = pool.position++
        if (add(pool.source[position], pool.kind, pool.field, position)) break
      }
      if (chosen.length >= target) break
    }
  }
  for (let i = 0; i < reserved.length && chosen.length < target; i++) {
    add(reserved[i], assessmentQuestionType(reserved[i]), 'test', i)
  }
  return chosen
}

export function createTestRephraseInstruction(items, { previousQuestions = [], title = '', grade = '' } = {}) {
  const fixed = items.map((item) => ({
    id: item.id, format: assessmentQuestionType(item), question: prompt(item),
    choices: item.choices || item.options || null,
    correct: item.correct ?? null,
    answer: item.answer ?? null,
    expectedAny: item.expectedAny || [],
  }))
  return `Rephrase each question below for a learner's Test, in clear age-appropriate wording.
Your task is REPHRASING, not lesson generation. Return only the wording, not answer keys or new items.
CRITICAL: Retain each question's format (mc, tf, fib, short). Do NOT turn choice/true-false/blank questions into written answers.
Keep the exact answer meaning and truth value, the numbers and units, and the same options and correct answer.
For fill-in-the-blank keep the same number of _____ blanks asking for the same missing term.
Make the wording materially different, not an unchanged copy, while assessing the identical skill.
Do not duplicate ANY question within this Test or repeat wording shown below.
No added difficulty, examples, negations that invert the truth value, or new facts.
Return ONLY JSON: {"items":[{"id":"original question id","question":"rewritten question text"}]}.
One item per supplied id. Do not return explanations, choices, or answers.
Lesson: ${JSON.stringify({ title, grade })}.
Previous questions to avoid: ${JSON.stringify(previousQuestions.slice(0, 80))}.
Questions: ${JSON.stringify(fixed)}.`
}

function parseReply(reply) {
  if (reply && typeof reply === 'object') return reply
  const raw = text(reply).replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
  try { return JSON.parse(raw) } catch { return null }
}

function numbers(item) {
  return (prompt(item).match(/\d+(?:[.,]\d+)*/g) || []).join('|')
}

function blanks(item) {
  return (prompt(item).match(/_{3,}/g) || []).length
}

export function applyRephrasedTestQuestions(sources, answer, { previousQuestions = [] } = {}) {
  const body = parseReply(answer)
  const received = Array.isArray(body?.items) ? body.items : []
  const responses = new Map(received.filter((q) => q && text(q.id) && typeof q.question === 'string')
    .map((item) => [text(item.id), text(item.question)]))
  const occupied = new Set(previousQuestions.map(key).filter(Boolean))
  const rewritten = []
  for (const item of sources) {
    const newText = responses.get(text(item.id))
    if (!newText || newText.length > 1200 || key(newText) === key(prompt(item)) ||
        occupied.has(key(newText)) || numbers({ question: newText }) !== numbers(item) ||
        blanks({ question: newText }) !== blanks(item)) return null
    occupied.add(key(newText))
    // The model is never trusted to supply an answer key or change the type.
    rewritten.push({ ...item, question: newText, prompt: newText, number: rewritten.length + 1 })
  }
  return rewritten.length === sources.length && rewritten.length ? rewritten : null
}

export async function requestRephrasedAssessmentTest({
  lessonData, targetCount, previousQuestions = [], random = Math.random,
  fetchImpl = fetch,
} = {}) {
  return rephraseAssessmentTest({
    lessonData, targetCount, previousQuestions, random,
    callModel: async (instruction) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 18000)
      try {
        const response = await fetchImpl('/api/sonoma', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instruction, responseMode: 'text', skipAudio: true, lessonTopic: lessonData?.title || 'Test questions' }),
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Test rephrasing request failed')
        const data = await response.json()
        return data?.reply
      } finally {
        clearTimeout(timeout)
      }
    },
  })
}

export async function rephraseAssessmentTest({
  lessonData, targetCount = 10, previousQuestions = [],
  callModel, random = Math.random,
} = {}) {
  const sources = selectTestRephraseSources(lessonData, targetCount, random)
  if (!sources.length || typeof callModel !== 'function') return null
  const instruction = createTestRephraseInstruction(sources, {
    previousQuestions, title: lessonData?.title, grade: lessonData?.grade,
  })
  const reply = await callModel(instruction)
  const complete = applyRephrasedTestQuestions(sources, reply, { previousQuestions })
  if (complete) return complete

  // Sonoma's normal response budget may truncate a large JSON deck. Retry
  // small batches only when the original rephrasing response was unusable.
  const groups = []
  for (let offset = 0; offset < sources.length; offset += 4) {
    groups.push(sources.slice(offset, offset + 4))
  }
  const repaired = await Promise.all(groups.map(async (group) => {
    const request = createTestRephraseInstruction(group, {
      previousQuestions, title: lessonData?.title, grade: lessonData?.grade,
    })
    const partialReply = await callModel(request)
    return applyRephrasedTestQuestions(group, partialReply, { previousQuestions })
  }))
  if (repaired.some((part) => !part)) return null
  const assembled = repaired.flat()
  const distinct = new Set(assembled.map((item) => key(prompt(item))))
  return assembled.length === sources.length && distinct.size === sources.length ? assembled : null
}
