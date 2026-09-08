const TRUE_FALSE_TYPES = new Set(['tf', 'truefalse', 'true/false'])

export const AI_GENERATED_CHOICE_POOL_FIELDS = Object.freeze([
  'multiplechoice',
  'test',
  'retention',
  'retentionPool',
  'retention_pool',
  'retentionItems',
  'retention_items',
  'dailyFollowup',
  'dailyFollowups',
  'daily_followup',
  'daily_followups',
  'dailyFollowupPool',
  'daily_followup_pool',
  'weeklyReview',
  'weeklyReviews',
  'weekly_review',
  'weekly_reviews',
  'weeklyReviewPool',
  'weekly_review_pool',
])

function normalizedChoice(value) {
  return String(value ?? '').trim().toLowerCase()
}

function choiceSchema(item) {
  const fields = []
  if (Array.isArray(item?.options)) fields.push('options')
  if (Array.isArray(item?.choices)) fields.push('choices')
  if (!fields.length) return null

  const values = item[fields[0]]
  if (fields.length > 1) {
    const other = item[fields[1]]
    if (other.length !== values.length) return null
    for (let index = 0; index < values.length; index += 1) {
      if (String(other[index] ?? '') !== String(values[index] ?? '')) return null
    }
  }

  return { fields, values }
}

function isTrueFalseItem(item, values = []) {
  const type = String(item?.type || '').trim().toLowerCase()
  const sourceType = String(item?.sourceType || '').trim().toLowerCase()
  const questionType = String(item?.questionType || '').trim().toLowerCase()
  if (TRUE_FALSE_TYPES.has(type) || TRUE_FALSE_TYPES.has(sourceType) || TRUE_FALSE_TYPES.has(questionType)) return true
  if (typeof item?.answer === 'boolean' || typeof item?.correct === 'boolean') return true

  if (values.length === 2) {
    const normalized = values.map(normalizedChoice)
    if (normalized.includes('true') && normalized.includes('false')) return true
  }
  return false
}

function authoritativeCorrectIndex(item) {
  const correctIndex = Number.isInteger(item?.correct) ? item.correct : null
  const answerIndex = Number.isInteger(item?.answer) ? item.answer : null
  if (correctIndex != null && answerIndex != null && correctIndex !== answerIndex) return null
  return correctIndex ?? answerIndex
}

function shuffledPositions(size, rng) {
  const positions = Array.from({ length: size }, (_, index) => index)
  for (let index = positions.length - 1; index > 0; index -= 1) {
    const sample = Number(rng())
    const bounded = Number.isFinite(sample)
      ? Math.min(Math.max(sample, 0), 0.9999999999999999)
      : 0
    const swapIndex = Math.floor(bounded * (index + 1))
    ;[positions[index], positions[swapIndex]] = [positions[swapIndex], positions[index]]
  }
  return positions
}

/**
 * Canonicalize AI-generated multiple-choice answer positions once, before the
 * content becomes application truth. The numeric correct pointer is authoritative;
 * expectedAny is preserved verbatim and is never used to infer correctness.
 */
export function canonicalizeAiGeneratedChoiceItems(items = [], { rng = Math.random } = {}) {
  const source = Array.isArray(items) ? items : []
  const random = typeof rng === 'function' ? rng : Math.random
  const positionBags = new Map()

  const nextTargetPosition = (choiceCount) => {
    let bag = positionBags.get(choiceCount)
    if (!Array.isArray(bag) || bag.length === 0) {
      bag = shuffledPositions(choiceCount, random)
      positionBags.set(choiceCount, bag)
    }
    return bag.shift()
  }

  return source.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item

    const schema = choiceSchema(item)
    if (!schema || schema.values.length < 2 || isTrueFalseItem(item, schema.values)) {
      return { ...item }
    }

    const sourceCorrectIndex = authoritativeCorrectIndex(item)
    if (
      sourceCorrectIndex == null
      || sourceCorrectIndex < 0
      || sourceCorrectIndex >= schema.values.length
    ) {
      return { ...item }
    }

    const targetIndex = nextTargetPosition(schema.values.length)
    const correctChoice = schema.values[sourceCorrectIndex]
    const distractors = schema.values.filter((_, index) => index !== sourceCorrectIndex)
    const reordered = [...distractors]
    reordered.splice(targetIndex, 0, correctChoice)

    const canonical = { ...item }
    for (const field of schema.fields) canonical[field] = [...reordered]
    if (Number.isInteger(item.correct)) canonical.correct = targetIndex
    if (Number.isInteger(item.answer)) canonical.answer = targetIndex
    return canonical
  })
}

/**
 * Canonicalize only known AI-authored multiple-choice lesson pools. Manual save
 * routes do not call this function, preserving educator-authored answer order.
 */
export function canonicalizeAiGeneratedLessonChoices(lesson = null, options = {}) {
  if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) return lesson
  const canonical = { ...lesson }
  for (const field of AI_GENERATED_CHOICE_POOL_FIELDS) {
    if (Array.isArray(lesson[field])) {
      canonical[field] = canonicalizeAiGeneratedChoiceItems(lesson[field], options)
    }
  }
  return canonical
}
