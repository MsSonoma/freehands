const TRUE_FALSE_TYPES = new Set(['tf', 'truefalse', 'true/false'])

function isTrueFalse(question) {
  const type = String(question?.type || '').trim().toLowerCase()
  const sourceType = String(question?.sourceType || '').trim().toLowerCase()
  const questionType = String(question?.questionType || '').trim().toLowerCase()
  if (TRUE_FALSE_TYPES.has(type) || TRUE_FALSE_TYPES.has(sourceType) || TRUE_FALSE_TYPES.has(questionType)) return true
  if (typeof question?.answer === 'boolean' || typeof question?.correct === 'boolean') return true
  const expected = String(question?.expected ?? question?.answer ?? '').trim().toLowerCase()
  const expectedAny = Array.isArray(question?.expectedAny)
    ? question.expectedAny.map((value) => String(value).trim().toLowerCase())
    : []
  return expected === 'true' || expected === 'false' || expectedAny.includes('true') || expectedAny.includes('false')
}

function sourceChoices(question) {
  if (Array.isArray(question?.options)) return { field: 'options', values: question.options }
  if (Array.isArray(question?.choices)) return { field: 'choices', values: question.choices }
  return null
}

function numericCorrectIndex(question) {
  if (Number.isInteger(question?.correct)) return question.correct
  if (Number.isInteger(question?.answer)) return question.answer
  return null
}

/**
 * Deal stable answer order for an assessment deck. Only ordinary MC questions
 * with an authoritative numeric correct index are shuffled. The returned deck
 * is immutable with respect to the source and can be persisted verbatim for resume.
 */
export function randomizeMultipleChoiceAnswerOrder(questions = [], rng = Math.random) {
  return (Array.isArray(questions) ? questions : []).map((question) => {
    const choices = sourceChoices(question)
    const correctIndex = numericCorrectIndex(question)
    if (
      !choices
      || choices.values.length < 2
      || isTrueFalse(question)
      || correctIndex == null
      || correctIndex < 0
      || correctIndex >= choices.values.length
    ) {
      return { ...question }
    }

    const dealt = choices.values.map((value, sourceIndex) => ({ value, sourceIndex }))
    for (let index = dealt.length - 1; index > 0; index -= 1) {
      const sample = Number(rng())
      const bounded = Number.isFinite(sample) ? Math.min(Math.max(sample, 0), 0.9999999999999999) : 0
      const swapIndex = Math.floor(bounded * (index + 1))
      ;[dealt[index], dealt[swapIndex]] = [dealt[swapIndex], dealt[index]]
    }

    const remappedCorrect = dealt.findIndex((entry) => entry.sourceIndex === correctIndex)
    const randomized = {
      ...question,
      [choices.field]: dealt.map((entry) => entry.value),
    }
    if (Number.isInteger(question.correct)) randomized.correct = remappedCorrect
    if (Number.isInteger(question.answer)) randomized.answer = remappedCorrect
    return randomized
  })
}
