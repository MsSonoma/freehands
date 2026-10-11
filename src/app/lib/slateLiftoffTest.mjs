function questionText(item = {}) {
  return String(item.question || item.prompt || item.text || '').trim()
}

function uniqueQuestions(items = []) {
  const seen = new Set()
  return (Array.isArray(items) ? items : []).filter((item) => {
    const key = questionText(item)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Keep the existing reserved-test separation from lesson practice material.
// The worksheet JSON field is source material, not a Liftoff instructional phase.
export function buildSlateLiftoffTestItems(lesson = {}) {
  const explicitPractice = Array.isArray(lesson.worksheet)
    ? lesson.worksheet
    : (Array.isArray(lesson.worksheet?.questions) ? lesson.worksheet.questions : [])
  const instructionalItems = uniqueQuestions(explicitPractice.length
    ? explicitPractice
    : [
        ...(Array.isArray(lesson.fillintheblank) ? lesson.fillintheblank : []),
        ...(Array.isArray(lesson.multiplechoice) ? lesson.multiplechoice : []),
      ])
  const explicitTest = Array.isArray(lesson.test)
    ? lesson.test
    : (Array.isArray(lesson.test?.questions) ? lesson.test.questions : [])
  const testItems = uniqueQuestions(explicitTest.length
    ? explicitTest
    : [
        ...(Array.isArray(lesson.wordProblems) ? lesson.wordProblems : []),
        ...(Array.isArray(lesson.shortanswer) ? lesson.shortanswer : []),
      ])
  const instructionalPrompts = new Set(instructionalItems.map(questionText))
  return testItems.filter((item) => !instructionalPrompts.has(questionText(item)))
}

// The printable test must mirror the same question text and response choices
// as the Slate test on screen. Answer keys are intentionally not passed to the PDF.
export function slateLiftoffPrintableTestItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item, index) => {
    const type = typeof item.answer === 'boolean' || typeof item.correct === 'boolean' ? 'tf' : (item.type || '')
    const choices = Array.isArray(item.choices)
      ? item.choices.map((option) => (
          typeof option === 'object' && option !== null
            ? String(option.text || option.label || option.letter || '')
            : String(option || '')
        ))
      : []
    return {
      number: index + 1,
      prompt: questionText(item),
      type,
      ...(type === 'tf' ? { sourceType: 'tf' } : {}),
      ...(choices.length ? { choices } : {}),
    }
  })
}
