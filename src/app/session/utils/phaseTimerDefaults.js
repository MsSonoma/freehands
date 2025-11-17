/**
 * Default timer durations for each phase (in minutes)
 * 
 * Each phase has two timer types:
 * - PLAY: Time from "Begin [Phase]" to "Go" button (for games/exploration)
 * - WORK: Time from "Go" to next phase's "Begin" (for actual lesson work)
 * 
 * Play timers are always green (expected to use full time)
 * Work timers use green/yellow/red based on lesson progress pace
 */

export const PHASE_TIMER_DEFAULTS = {
  discussion: {
    play: 5,  // Time for jokes, stories, poems before teaching
    work: 15  // Time for actual teaching/definitions/examples
  },
  comprehension: {
    play: 5,  // Pre-comprehension games
    work: 10  // Comprehension Q&A work
  },
  exercise: {
    play: 5,  // Pre-exercise games
    work: 15  // Exercise Q&A work
  },
  worksheet: {
    play: 5,  // Pre-worksheet games
    work: 20  // Worksheet completion
  },
  test: {
    play: 5,  // Pre-test games
    work: 15  // Test completion
  }
};

// Golden key bonus time (adds to all play timers when earned/applied)
export const GOLDEN_KEY_BONUS_DEFAULT = 5;

// Phase display names
export const PHASE_DISPLAY_NAMES = {
  discussion: 'Discussion',
  comprehension: 'Comprehension',
  exercise: 'Exercise',
  worksheet: 'Worksheet',
  test: 'Test'
};

// Timer type emoji
export const TIMER_TYPE_EMOJI = {
  play: '🎉',
  work: '✏️'
};

// Timer type display names
export const TIMER_TYPE_NAMES = {
  play: 'Play',
  work: 'Work'
};

/**
 * Get default timer durations for a learner profile
 * Returns an object with all 11 timer values
 */
export function getDefaultPhaseTimers() {
  return {
    discussion_play_min: PHASE_TIMER_DEFAULTS.discussion.play,
    discussion_work_min: PHASE_TIMER_DEFAULTS.discussion.work,
    comprehension_play_min: PHASE_TIMER_DEFAULTS.comprehension.play,
    comprehension_work_min: PHASE_TIMER_DEFAULTS.comprehension.work,
    exercise_play_min: PHASE_TIMER_DEFAULTS.exercise.play,
    exercise_work_min: PHASE_TIMER_DEFAULTS.exercise.work,
    worksheet_play_min: PHASE_TIMER_DEFAULTS.worksheet.play,
    worksheet_work_min: PHASE_TIMER_DEFAULTS.worksheet.work,
    test_play_min: PHASE_TIMER_DEFAULTS.test.play,
    test_work_min: PHASE_TIMER_DEFAULTS.test.work,
    golden_key_bonus_min: GOLDEN_KEY_BONUS_DEFAULT
  };
}

/**
 * Load phase timers from learner profile or use defaults
 */
export function loadPhaseTimersForLearner(learner) {
  const defaults = getDefaultPhaseTimers();
  
  if (!learner) return defaults;
  
  // Try to load each timer value, falling back to default
  return {
    discussion_play_min: learner.discussion_play_min ?? defaults.discussion_play_min,
    discussion_work_min: learner.discussion_work_min ?? defaults.discussion_work_min,
    comprehension_play_min: learner.comprehension_play_min ?? defaults.comprehension_play_min,
    comprehension_work_min: learner.comprehension_work_min ?? defaults.comprehension_work_min,
    exercise_play_min: learner.exercise_play_min ?? defaults.exercise_play_min,
    exercise_work_min: learner.exercise_work_min ?? defaults.exercise_work_min,
    worksheet_play_min: learner.worksheet_play_min ?? defaults.worksheet_play_min,
    worksheet_work_min: learner.worksheet_work_min ?? defaults.worksheet_work_min,
    test_play_min: learner.test_play_min ?? defaults.test_play_min,
    test_work_min: learner.test_work_min ?? defaults.test_work_min,
    golden_key_bonus_min: learner.golden_key_bonus_min ?? defaults.golden_key_bonus_min
  };
}

/**
 * Get timer duration for specific phase and type
 */
export function getPhaseTimerDuration(phaseTimers, phase, timerType) {
  const key = `${phase}_${timerType}_min`;
  return phaseTimers[key] ?? PHASE_TIMER_DEFAULTS[phase]?.[timerType] ?? 5;
}
