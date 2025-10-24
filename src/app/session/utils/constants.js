/**
 * Constants and configuration for the session page.
 * Includes instruction templates, phase configurations, and legacy mappings.
 */

/**
 * Instruction for Ms. Sonoma to always use natural spoken text.
 */
export const CLEAN_SPEECH_INSTRUCTION =
  "Always respond with natural spoken text only. Do not use emojis, decorative characters, repeated punctuation, ASCII art, bullet lines, or other symbols that would be awkward to read aloud.";

/**
 * Global guardrails for Ms. Sonoma (system-side, not spoken).
 */
export const GUARD_INSTRUCTION = [
  "You are Ms. Sonoma. Teach the defined lesson. If vocab is provided, use it during teaching only.",
  "Do not mention or reference the words 'exercise', 'worksheet', 'test', 'exam', 'quiz', or 'answer key' in your spoken responses during discussion, teaching, or comprehension phases.",
  "Do not switch or expand to any other topic; politely steer back to the defined lesson when needed.",
  "Integrate any teaching notes naturally; do not read them verbatim or announce them."
].join(" ");

/**
 * Generate teaching style guide appropriate for the learner's grade and difficulty level.
 * @param {string|number} grade - The learner's grade (e.g., 'K', '1', '4th', 4)
 * @param {string} difficulty - The lesson difficulty ('beginner', 'intermediate', 'advanced')
 * @returns {string} Style instruction for Ms. Sonoma
 */
export function getGradeAndDifficultyStyle(grade = '', difficulty = 'beginner') {
  // Normalize grade to a number (K=0, 1st=1, etc.)
  let gradeNum = 0;
  if (typeof grade === 'number') {
    gradeNum = grade;
  } else if (typeof grade === 'string') {
    const gradeStr = grade.toLowerCase().trim();
    if (gradeStr === 'k') {
      gradeNum = 0;
    } else {
      const match = gradeStr.match(/(\d+)/);
      if (match) {
        gradeNum = parseInt(match[1], 10);
      }
    }
  }

  // Normalize difficulty
  const diff = (difficulty || 'beginner').toLowerCase().trim();
  
  // Define age ranges and vocabulary complexity based on grade
  let ageRange, vocabularyLevel, sentenceComplexity, technicalDepth;
  
  if (gradeNum === 0) {
    // Kindergarten
    ageRange = '5–6 year old';
    vocabularyLevel = 'Use only simple everyday words that a kindergartener knows.';
    sentenceComplexity = 'Keep sentences very short (about 4–8 words).';
    technicalDepth = 'Avoid any technical terms. Use concrete everyday examples only.';
  } else if (gradeNum <= 2) {
    // 1st-2nd grade
    ageRange = `${gradeNum + 5}–${gradeNum + 6} year old`;
    vocabularyLevel = 'Use simple everyday words.';
    sentenceComplexity = 'Keep sentences short (about 6–10 words).';
    technicalDepth = 'Avoid technical jargon. If you must use a special word, explain it in very simple terms.';
  } else if (gradeNum <= 5) {
    // 3rd-5th grade
    ageRange = `${gradeNum + 5}–${gradeNum + 6} year old`;
    vocabularyLevel = 'Use clear language appropriate for elementary students.';
    sentenceComplexity = 'Keep sentences reasonably short (about 8–12 words).';
    technicalDepth = 'You may use some subject-specific terms, but explain new vocabulary clearly when introduced.';
  } else {
    // 6th grade and up
    ageRange = `${gradeNum + 5}–${gradeNum + 6} year old`;
    vocabularyLevel = 'Use age-appropriate vocabulary for middle school students.';
    sentenceComplexity = 'Use clear, well-structured sentences (about 10–15 words).';
    technicalDepth = 'You may use subject-specific terminology, defining terms when first introduced.';
  }

  // Adjust tone and pacing based on difficulty
  let toneAdjustment, pacingAdjustment;
  
  if (diff === 'beginner') {
    toneAdjustment = 'Use a warm, gentle, encouraging tone.';
    pacingAdjustment = 'Take your time; explain each step clearly and patiently.';
  } else if (diff === 'intermediate') {
    toneAdjustment = 'Use a warm, supportive tone.';
    pacingAdjustment = 'Maintain a steady pace; provide clear explanations without over-simplifying.';
  } else {
    // advanced
    toneAdjustment = 'Use a warm, confident tone.';
    pacingAdjustment = 'Move at a brisk pace; assume foundational understanding and focus on deeper concepts.';
  }

  return [
    `Speaking style for this lesson: You are speaking to a ${ageRange} learner at ${diff} difficulty level.`,
    vocabularyLevel,
    sentenceComplexity,
    technicalDepth,
    toneAdjustment,
    pacingAdjustment,
    'Speak directly to the learner using "you" and "we".',
    'One clear idea per sentence; do not pack multiple steps into one sentence.'
  ].join(' ');
}

/**
 * Legacy constant kept for backward compatibility.
 * @deprecated Use getGradeAndDifficultyStyle() instead for grade-aware styling.
 */
export const KID_FRIENDLY_STYLE = getGradeAndDifficultyStyle('1', 'beginner');

/**
 * Exact phrase Ms. Sonoma must say when learner declines a repeat to advance to comprehension.
 */
export const COMPREHENSION_CUE_PHRASE = "Great. Let's move on to comprehension.";

/**
 * Order of major phases shown above the video timeline.
 */
export const timelinePhases = ["discussion", "comprehension", "exercise", "worksheet", "test"];

/**
 * Display labels for each phase.
 */
export const phaseLabels = {
  discussion: "Discussion",
  comprehension: "Comp",
  exercise: "Exercise",
  worksheet: "Worksheet",
  test: "Test",
};

/**
 * Steps configuration for the discussion phase (Opening sequence).
 * NOTE: Opening is now generated entirely front-end via generateOpening().
 * These steps are kept for legacy reference only; instructions are not sent to API.
 */
export const discussionSteps = [
  {
    key: 'greeting',
    instruction: "Front-end: Greeting generated by generateOpening() with learner name and lesson title.",
    next: 'encouragement',
    label: 'Next: Encouragement',
  },
  {
    key: 'encouragement',
    instruction: 'Front-end: Encouragement generated by generateOpening().',
    next: 'joke',
    label: 'Next: Joke',
  },
  {
    key: 'joke',
    instruction: "Front-end: Joke generated by generateOpening() using getJokePrompt() from openingSignals.js.",
    next: 'silly-question',
    label: 'Next: Silly Question',
  },
  {
    key: 'silly-question',
    instruction: 'Front-end: Silly question generated by generateOpening().',
    next: 'awaiting-learner',
    label: 'Wait for learner reply',
  },
];

/**
 * Generate teaching steps configuration for the teaching phase.
 * @param {string} lessonTitle - The title of the lesson
 * @param {string|number} grade - Learner's grade level
 * @param {string} difficulty - Lesson difficulty ('beginner', 'intermediate', 'advanced')
 * @returns {Array} Array of teaching step configurations
 */
export function getTeachingSteps(lessonTitle = "the lesson", grade = '', difficulty = 'beginner') {
  const styleGuide = getGradeAndDifficultyStyle(grade, difficulty);
  
  return [
    {
      key: "teaching-intro",
      instruction:
        `Teaching Part 1/3: This lesson is strictly "${lessonTitle}". Introduce today's lesson topic using the Session JSON's lessonTitle and preview what the learner will accomplish. Explain only that specific topic; do not give general study advice or other operations. Include 1–2 short numeric examples as part of the explanation that you fully compute yourself. Keep it to about three sentences; do not ask if they want it repeated yet. Do not mention the worksheet or test. ${styleGuide}`,
      next: "teaching-example",
      label: "Next: Examples",
    },
    {
      key: "teaching-example",
      instruction:
        `Teaching Part 2/3: This lesson is strictly "${lessonTitle}". Walk through one or two worked examples step by step strictly within the lessonTitle scope (from Session JSON). You complete the examples yourself—do not ask the learner to solve. Keep the explanation under four sentences and stay focused on the concrete steps for this lesson only. Do not mention the worksheet or test. ${styleGuide}`,
      next: "teaching-wrap",
      label: "Next: Wrap Up",
    },
    {
      key: "teaching-wrap",
      instruction:
        `Teaching Part 3/3: This lesson is strictly "${lessonTitle}". Summarize the exact steps for the specific lessonTitle (from Session JSON), remind them about any simple tools or notes, and close with a concise wrap (no questions). Do not ask them to solve anything. Do not mention the worksheet or test. ${styleGuide}`,
      next: "awaiting-gate",
      label: "Wait for learner answer",
    },
  ];
}
