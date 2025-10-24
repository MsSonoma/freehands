/**
 * openingSignals.js
 * Brand signal anchors for Opening phase: encouragement and joke prompts
 * Front-end lexicon pools with zero token cost
 */

/**
 * Get a random encouragement phrase for session opening
 * OPENING anchor: Brief, warm, grounded
 * Tone: Calm, supportive
 * Lexicon: ready, step by step, together, begin, prepared
 * Avoid: hype, achievement language
 * @returns {string} Encouragement phrase (without punctuation)
 */
export function getEncouragement() {
  const options = [
    'You\'re ready',
    'Let\'s take it step by step',
    'We\'ll work through this together',
    'You\'ve got this',
    'Let\'s begin',
    'You\'re all set',
    'Let\'s get started',
    'You\'re prepared for this',
    'Ready to learn',
    'Let\'s focus together',
    'Time to practice',
    'You\'re here to learn',
    'Let\'s work together',
    'Ready when you are',
    'Let\'s dive in'
  ];
  
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Get a random joke prompt (VERBATIM from Section 6)
 * These are exact required phrases per copilot-instructions
 * @returns {string} Joke prompt with punctuation
 */
export function getJokePrompt() {
  const prompts = [
    'Wanna hear a joke?',
    'Let\'s start with a joke.'
  ];
  
  return prompts[Math.floor(Math.random() * prompts.length)];
}

/**
 * Legacy export for backward compatibility with ENCOURAGEMENT_SNIPPETS
 * Used in exercise/progress contexts
 */
export const ENCOURAGEMENT_SNIPPETS = [
  'Great focus',
  'Nice thinking',
  'You are doing great',
  'Keep it up',
  'Strong effort',
  'Brain power engaged',
  'Love that persistence',
  'Flex that brain',
  'Terrific progress',
  'Staying sharp'
];
