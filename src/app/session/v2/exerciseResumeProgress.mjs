// Recover the next unanswered Exercise item from current and legacy snapshots.
function questionText(question) {
  return String(typeof question === 'string' ? question : (question?.question ?? question?.text ?? '')).trim()
}

function attemptsForQuestion(questions, answers, index) {
  const question = questions[index]
  const id = typeof question === 'object' && question !== null ? question.id : null
  const uniqueId = id != null && questions.filter(item => item != null && typeof item === 'object' && String(item.id) === String(id)).length === 1
  const text = questionText(question)
  // A duplicated explicit identifier is ambiguous even if its text differs.
  const uniqueText = id == null && text && questions.filter(item => questionText(item) === text).length === 1
  if (!uniqueId && !uniqueText) return []
  return answers.filter(answer => uniqueId
    ? answer?.questionId != null && String(answer.questionId) === String(id)
    : String(answer?.question ?? '').trim() === text)
}

export function resolveExerciseResumeProgress(saved = {}, questions = []) {
  const items = Array.isArray(questions) ? questions : []
  const answers = Array.isArray(saved?.answers) ? saved.answers : []
  const requested = Number(saved?.nextQuestionIndex ?? saved?.questionIndex ?? 0)
  let questionIndex = Number.isFinite(requested)
    ? Math.min(Math.max(Math.floor(requested), 0), items.length)
    : 0

  // The old writer persisted the answered index just before incrementing it.
  // Advance only if a uniquely identified question has terminal evidence.
  while (questionIndex < items.length) {
    const attempts = attemptsForQuestion(items, answers, questionIndex)
    const completed = attempts.some(answer => answer?.isCorrect === true
      || (saved?.lastAction === 'exercise-answer'
        && answer?.isCorrect === false
        && Number(answer?.attemptNumber) >= 3))
    if (!completed) break
    questionIndex++
  }

  const currentAttempts = questionIndex < items.length
    ? attemptsForQuestion(items, answers, questionIndex)
    : []
  const priorWrongAttempts = currentAttempts.reduce((max, answer) => answer?.isCorrect === false
    ? Math.max(max, Number(answer?.attemptNumber) || 0)
    : max, 0)
  const storedWrongAttempts = Number(saved?.wrongAttempts)
  const wrongAttempts = saved?.wrongAttempts != null && Number.isFinite(storedWrongAttempts)
    ? Math.max(0, Math.min(3, Math.floor(storedWrongAttempts)))
    : Math.max(0, Math.min(3, priorWrongAttempts))
  const hasWorkProgress = answers.length > 0 || questionIndex > 0 || Number(saved?.score || 0) > 0
  const timerMode = hasWorkProgress ? 'work' : saved?.timerMode === 'work' ? 'work' : 'play'

  return { questionIndex, wrongAttempts, timerMode }
}
