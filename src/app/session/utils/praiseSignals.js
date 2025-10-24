/**
 * praiseSignals.js
 * Brand signal anchors for Praise/Celebration (correct answers)
 * Front-end lexicon pools with zero token cost
 */

/**
 * Generate praise for a correct answer
 * PRAISE anchor: Acknowledge effort and method, not just result
 * Tone: Calm, specific, non-hype
 * Lexicon: calm, clear, thinking, steps, focus, effort, work, patience, attention, care
 * Avoid: amazing, awesome, crushed it, nailed it
 * Shape: "Great [effort]; you [verb] [concept] correctly."
 * 
 * @param {Object} config - Configuration object
 * @param {string} config.concept - The concept being practiced (e.g., "the zero property")
 * @returns {string} Praise message
 */
export function generatePraise(config = {}) {
  const { concept = 'it' } = config;
  
  // Effort words: calm, focused process acknowledgment
  const effortWords = [
    'thinking',
    'focus',
    'work',
    'effort',
    'steps',
    'patience',
    'attention',
    'care',
    'reasoning',
    'approach',
    'method'
  ];
  
  // Verbs: show process, not just outcome
  const verbs = [
    'used',
    'applied',
    'showed',
    'practiced',
    'demonstrated',
    'followed',
    'worked through'
  ];
  
  const effort = effortWords[Math.floor(Math.random() * effortWords.length)];
  const verb = verbs[Math.floor(Math.random() * verbs.length)];
  
  return `Great ${effort}; you ${verb} ${concept} correctly.`;
}

/**
 * Get a simple celebration phrase (short variant without concept)
 * Used when concept context is not available
 * @returns {string} Short celebration
 */
export function getSimpleCelebration() {
  const celebrations = [
    'That is right',
    'Correct',
    'Yes',
    'You got it',
    'That works',
    'Right',
    'Good',
    'Well done',
    'Nice',
    'Exactly'
  ];
  
  return celebrations[Math.floor(Math.random() * celebrations.length)];
}

/**
 * Legacy export for backward compatibility with CELEBRATE_CORRECT
 * Provides simple celebrations without concept attachment
 */
export const CELEBRATE_CORRECT = [
  'Yes, great thinking',
  'That is right',
  'Nice work',
  'You got it',
  'Correct and confident',
  'Solid answer',
  'Exactly right',
  'Well done',
  'Spot on',
  'Right on',
  'Good work',
  'That works',
  'Nice thinking',
  'Great focus there'
];
