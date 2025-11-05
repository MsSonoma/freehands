/**
 * Lesson Quality Validation Utility
 * Checks generated lessons against quality standards
 */

/**
 * Validate a generated lesson and return quality issues
 * @param {Object} lesson - The lesson object to validate
 * @returns {Object} { passed: boolean, issues: string[], warnings: string[] }
 */
export function validateLessonQuality(lesson) {
  const issues = []
  const warnings = []
  
  if (!lesson) {
    return { passed: false, issues: ['Lesson is null or undefined'], warnings: [] }
  }

  // Check required fields
  if (!lesson.title || !lesson.grade || !lesson.difficulty || !lesson.subject) {
    issues.push('Missing required fields (title, grade, difficulty, or subject)')
  }

  // Check vocabulary
  if (!lesson.vocab || !Array.isArray(lesson.vocab) || lesson.vocab.length === 0) {
    warnings.push('No vocabulary terms defined')
  } else if (lesson.vocab.length < 5) {
    warnings.push(`Only ${lesson.vocab.length} vocabulary terms (recommended: 5+)`)
  }

  // Check teaching notes
  if (!lesson.teachingNotes || lesson.teachingNotes.trim().length < 50) {
    warnings.push('Teaching notes are missing or too brief (should be 2-4 sentences)')
  }

  // Validate Short Answer questions
  if (lesson.shortanswer && Array.isArray(lesson.shortanswer)) {
    if (lesson.shortanswer.length < 10) {
      issues.push(`Short answer has ${lesson.shortanswer.length} questions (need 10+)`)
    }
    
    lesson.shortanswer.forEach((q, idx) => {
      if (!q.question || q.question.trim().length === 0) {
        issues.push(`Short answer Q${idx + 1} has no question text`)
      }
      if (!q.expectedAny || !Array.isArray(q.expectedAny) || q.expectedAny.length === 0) {
        issues.push(`Short answer Q${idx + 1} has no acceptable answers`)
      } else if (q.expectedAny.length < 3) {
        issues.push(`Short answer Q${idx + 1} only has ${q.expectedAny.length} acceptable answer(s) (need 3+ for leniency)`)
      }
    })
  }

  // Validate Fill in the Blank questions
  if (lesson.fillintheblank && Array.isArray(lesson.fillintheblank)) {
    if (lesson.fillintheblank.length < 10) {
      issues.push(`Fill in the blank has ${lesson.fillintheblank.length} questions (need 10+)`)
    }
    
    lesson.fillintheblank.forEach((q, idx) => {
      if (!q.question || q.question.trim().length === 0) {
        issues.push(`Fill in the blank Q${idx + 1} has no question text`)
      } else if (!q.question.includes('_____')) {
        issues.push(`Fill in the blank Q${idx + 1} doesn't contain _____ placeholder`)
      }
      if (!q.expectedAny || !Array.isArray(q.expectedAny) || q.expectedAny.length === 0) {
        issues.push(`Fill in the blank Q${idx + 1} has no acceptable answers`)
      } else if (q.expectedAny.length < 3) {
        issues.push(`Fill in the blank Q${idx + 1} only has ${q.expectedAny.length} acceptable answer(s) (need 3+ for leniency)`)
      }
    })
  }

  // Validate True/False questions
  if (lesson.truefalse && Array.isArray(lesson.truefalse)) {
    if (lesson.truefalse.length < 10) {
      issues.push(`True/false has ${lesson.truefalse.length} questions (need 10+)`)
    }
    
    lesson.truefalse.forEach((q, idx) => {
      if (!q.question || q.question.trim().length === 0) {
        issues.push(`True/false Q${idx + 1} has no question text`)
      }
      if (q.answer === undefined || q.answer === null) {
        issues.push(`True/false Q${idx + 1} has no answer defined`)
      }
    })
  }

  // Validate Multiple Choice questions
  if (lesson.multiplechoice && Array.isArray(lesson.multiplechoice)) {
    if (lesson.multiplechoice.length < 10) {
      issues.push(`Multiple choice has ${lesson.multiplechoice.length} questions (need 10+)`)
    }
    
    lesson.multiplechoice.forEach((q, idx) => {
      if (!q.question || q.question.trim().length === 0) {
        issues.push(`Multiple choice Q${idx + 1} has no question text`)
      }
      if (!q.choices || !Array.isArray(q.choices)) {
        issues.push(`Multiple choice Q${idx + 1} has no choices array`)
      } else if (q.choices.length !== 4) {
        issues.push(`Multiple choice Q${idx + 1} has ${q.choices.length} choices (need exactly 4)`)
      }
      if (q.correct === undefined || q.correct < 0 || q.correct > 3) {
        issues.push(`Multiple choice Q${idx + 1} has invalid correct index (should be 0-3)`)
      }
    })
  }

  // REMOVED: sample array validation - deprecated zombie code
  // See docs/KILL_SAMPLE_ARRAY.md - sample array must never be used or validated

  const passed = issues.length === 0
  return { passed, issues, warnings }
}

/**
 * Build a change request string from validation issues
 * @param {string[]} issues - Array of issue strings
 * @returns {string} Formatted change request for the AI
 */
export function buildValidationChangeRequest(issues) {
  const parts = [
    'CRITICAL QUALITY ISSUES - Please fix the following problems:',
    '',
    ...issues.map((issue, idx) => `${idx + 1}. ${issue}`),
    '',
    'REQUIREMENTS:',
    '- Short answer and fill-in-the-blank questions MUST have at least 3 acceptable answers each',
    '- Include synonyms, alternative phrasings, and common variations',
    '- All question types need at least 10 complete questions',
    '- True/false questions must have complete question text',
    '- Multiple choice must have exactly 4 distinct choices',
    '',
    'Return the complete corrected lesson as valid JSON.'
  ]
  
  return parts.join('\n')
}
