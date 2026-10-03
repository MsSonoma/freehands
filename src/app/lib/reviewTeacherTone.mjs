const TEACHER_IDS = new Set(['sonoma', 'webb', 'slate'])

function teacherId(value) {
  const candidate = String(value || '').trim().toLowerCase()
  return TEACHER_IDS.has(candidate) ? candidate : 'slate'
}

const DIALOGUE = Object.freeze({
  sonoma: Object.freeze({
    greeting: Object.freeze([
      "Let's see what you remember.",
      "Ready for a quick review? Let's begin.",
      "Let's warm up with a few review questions.",
      "We'll take these one at a time.",
      "Let's bring back what you learned.",
    ]),
    correct: Object.freeze([
      "Yes, that's right.",
      'Exactly.',
      'You got it.',
      "That's it.",
      'Nice work.',
      'Right.',
      'Good thinking.',
    ]),
    wrong: Object.freeze([
      "Not quite. Let's fix that one.",
      "That's not it this time. We'll correct it and keep going.",
      "Almost. Let's look at the answer.",
      "Let's correct that one together.",
      'That one needs another look.',
    ]),
    timeout: Object.freeze([
      "Time's up on that one. That's okay. Let's keep going.",
      "That one got away from us. We'll review it and move on.",
      "No answer in time. Let's take the next one.",
      "Time ran out. We'll make sure you see the answer.",
    ]),
  }),
  webb: Object.freeze({
    greeting: Object.freeze([
      "Let's review what you've learned.",
      "We'll take this review one question at a time.",
      "Ready? Let's begin.",
      "Let's see what you remember and sharpen anything that needs it.",
      "We'll work carefully through a few review questions.",
    ]),
    correct: Object.freeze([
      "Yes. That's correct.",
      'Exactly right.',
      'Well done.',
      "That's the answer.",
      "Correct. Let's continue.",
      'Good work.',
    ]),
    wrong: Object.freeze([
      "Not quite. Let's correct that one.",
      'That answer needs a correction.',
      "Let's revise that answer before we continue.",
      "That's not the answer we're looking for. Let's fix it.",
      "Let's look carefully at that one.",
    ]),
    timeout: Object.freeze([
      "Time is up on that one. We'll review it and move on.",
      "No answer in time. Let's correct it before we continue.",
      "The timer ended. We'll make sure the answer is clear.",
      "That one ran out of time. Let's keep going.",
    ]),
  }),
  slate: Object.freeze({
    greeting: Object.freeze([
      'Time to run some drills.',
      'Let the drill begin.',
      'Drill sequence initiated.',
      'Ready for your first query.',
      'Systems online. First question loading.',
      'Activating drill protocol.',
      'Stand by. Loading first query.',
      'Drill mode engaged. Let us begin.',
      'Prepare for query processing.',
      'Commencing drill sequence now.',
      'Drill protocol active. Here we go.',
    ]),
    correct: Object.freeze([
      'Affirmative. Correct response.',
      'Confirmed correct.',
      'Accurate. Score updated.',
      'Correct. Processing next query.',
      'Response accepted.',
      'Input validated. Correct.',
      'Excellent. Moving on.',
      'That is correct.',
      'Right answer confirmed.',
      'Positive match detected.',
      'Score increment registered.',
    ]),
    wrong: Object.freeze([
      'Negative. Incorrect response.',
      'Error. Wrong answer detected.',
      'Incorrect.',
      'Does not match expected output.',
      'Incorrect response recorded.',
      'Mismatch detected.',
      'Negative. Try harder next time.',
      'That is not the correct answer.',
      'Error code: wrong answer.',
      'Recalibrate. The answer was wrong.',
      'Wrong. Score deducted.',
    ]),
    timeout: Object.freeze([
      'Time limit exceeded. No response.',
      'Query timeout. Moving on.',
      'Response not received in time.',
      'Time expired. Next query.',
      'Timeout recorded. Stay faster.',
      'Response window closed.',
      'No input detected. Advancing.',
      'Time is up. Focus.',
      'Clock ran out. Next query loading.',
      'Too slow. Speed up your recall.',
      'Timeout. We do not wait.',
      'Response overdue. Proceeding.',
      'Timer zeroed. No credit awarded.',
      'You ran out of time on that one.',
      'Processing halted. Time limit reached.',
      'That one slipped by. Stay sharp.',
      'No answer in time. Noted.',
      'Timeout flagged. Keep your pace.',
      'The clock does not lie. Moving on.',
      'Speed and accuracy. Work on both.',
      'Time penalty applied. Next.',
      'Zero seconds remaining. Advancing.',
    ]),
  }),
})

export function reviewTeacherDialogue(value) {
  return DIALOGUE[teacherId(value)]
}

export function reviewTeacherCorrectAnswerLine(value, answer) {
  const id = teacherId(value)
  if (id === 'sonoma') return 'The answer is ' + answer + '.'
  if (id === 'webb') return 'The correct answer is ' + answer + '.'
  return 'The correct answer was ' + answer + '.'
}

export function reviewTeacherRecoveryLine(value, { question, correctAnswer } = {}) {
  const id = teacherId(value)
  const prompt = question || 'this item'
  const answer = correctAnswer || 'the answer shown'
  if (id === 'sonoma') {
    return "Let's make sure this one makes sense. The question was: " + prompt + '. The answer is ' + answer + ". Keep that connection in mind for the next one."
  }
  if (id === 'webb') {
    return "Let's review that one carefully. The question was: " + prompt + '. The correct answer is ' + answer + ". Notice how the question points to that answer before we continue."
  }
  return 'Let us review the idea. The question was: ' + prompt + '. The correct response is ' + answer + '. Connect the question to that answer before the next query.'
}

export function reviewTeacherCompletionMessage(value, { evidenceStatus, masteryOutcome } = {}) {
  const id = teacherId(value)
  if (id === 'slate') return 'Daily Review complete.'
  if (evidenceStatus !== 'complete') return 'Daily Review complete. Your learning record may be incomplete.'

  if (id === 'sonoma') {
    if (masteryOutcome === 'independent_success') return 'Daily Review complete. You got that one on your own.'
    if (masteryOutcome === 'independent_success_after_recovery') return 'Daily Review complete. You got it this time.'
    return 'Daily Review complete. Nice work.'
  }

  if (masteryOutcome === 'independent_success') return 'Daily Review complete. You answered that independently.'
  if (masteryOutcome === 'independent_success_after_recovery') return 'Daily Review complete. You corrected that successfully.'
  return 'Daily Review complete. Well done.'
}

export function reviewTeacherCompletionAudioOptions(value, context = {}) {
  const id = teacherId(value)
  if (id === 'sonoma') {
    if (context.masteryOutcome === 'independent_success') {
      return ['You got that one on your own. Nice work.', 'That answer was all yours. Nice work.']
    }
    if (context.masteryOutcome === 'independent_success_after_recovery') {
      return ['You got it this time. Nice work sticking with it.', 'There you go. You corrected it and got it this time.']
    }
    return ['Nice work. You finished your Daily Review.', 'You made it through the review. Good job.']
  }

  if (id === 'webb') {
    if (context.masteryOutcome === 'independent_success') {
      return ['You answered that independently. Well done.', 'That was an independent answer. Nicely done.']
    }
    if (context.masteryOutcome === 'independent_success_after_recovery') {
      return ['You corrected that successfully. Well done.', 'You worked through the correction. Nicely done.']
    }
    return ['Daily Review complete. Well done.', 'You have finished the review. Nicely done.']
  }

  return ['Daily Review complete.']
}
