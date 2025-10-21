/**
 * profanityFilter.js
 * Filters inappropriate words from learner input before sending to AI
 */

// Common profanity list (expandable as needed)
const PROFANITY_LIST = [
  // Strong profanity
  'fuck', 'shit', 'bitch', 'ass', 'damn', 'hell', 'crap',
  'bastard', 'dick', 'pussy', 'cock', 'piss', 'slut', 'whore',
  
  // Variants and common misspellings
  'fuk', 'fck', 'sht', 'btch', 'arse', 'dang', 'crapola',
  'azz', 'dik', 'pussie', 'cok', 'pis', 
  
  // Offensive slurs (partial list, expandable)
  'nigger', 'nigga', 'fag', 'faggot', 'retard', 'retarded',
  
  // Sexual/inappropriate terms
  'sex', 'porn', 'naked', 'nude', 'boob', 'tit', 'breast',
  'penis', 'vagina', 'anal', 'oral', 
];

// Create regex patterns for whole-word matching (case-insensitive)
const profanityPatterns = PROFANITY_LIST.map(word => 
  new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
);

/**
 * Check if text contains profanity
 * @param {string} text - The text to check
 * @returns {boolean} - True if profanity detected
 */
export function containsProfanity(text) {
  if (!text || typeof text !== 'string') return false;
  
  const normalized = text.toLowerCase();
  
  // Check against each pattern
  for (const pattern of profanityPatterns) {
    if (pattern.test(normalized)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Filter profanity from text by replacing with asterisks
 * @param {string} text - The text to filter
 * @returns {string} - Filtered text with profanity replaced
 */
export function filterProfanity(text) {
  if (!text || typeof text !== 'string') return text;
  
  let filtered = text;
  
  // Replace each profane word with asterisks of same length
  for (const pattern of profanityPatterns) {
    filtered = filtered.replace(pattern, (match) => '*'.repeat(match.length));
  }
  
  return filtered;
}

/**
 * Get a friendly rejection message when profanity is detected
 * @returns {string} - A kid-friendly message
 */
export function getProfanityRejectionMessage() {
  const messages = [
    "Let's use kind words.",
    "Can you say that differently?",
    "Let's keep our words friendly.",
    "Please use nice words.",
    "Let's use respectful language.",
  ];
  
  // Return a random message
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Main function to check and block profanity in learner input
 * @param {string} text - The learner input text
 * @returns {Object} - { allowed: boolean, message?: string, filtered?: string }
 */
export function checkLearnerInput(text) {
  if (!text || typeof text !== 'string') {
    return { allowed: true };
  }
  
  if (containsProfanity(text)) {
    return {
      allowed: false,
      message: getProfanityRejectionMessage(),
      filtered: filterProfanity(text)
    };
  }
  
  return { allowed: true };
}
