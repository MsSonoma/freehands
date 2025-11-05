/**
 * betterRandom.js
 * Provides better randomization than Math.random() to avoid repetitive patterns
 * Uses crypto.getRandomValues when available for higher entropy
 */

/**
 * Get a random float between 0 (inclusive) and 1 (exclusive) with better entropy
 * Falls back to Math.random() if crypto is unavailable
 */
export function betterRandom() {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    // Use crypto for better randomness
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] / (0xffffffff + 1);
  }
  // Fallback to Math.random()
  return Math.random();
}

/**
 * Get a random integer between min (inclusive) and max (exclusive)
 */
export function randomInt(min, max) {
  return Math.floor(betterRandom() * (max - min)) + min;
}

/**
 * Shuffle array using Fisher-Yates with better randomization
 * Uses crypto-random values when available for more unpredictable shuffles
 * 
 * @param {Array} arr - Array to shuffle
 * @param {object} options - Optional config { addEntropy: boolean, sessionSeed: string }
 * @returns {Array} Shuffled copy of array
 */
export function betterShuffle(arr, options = {}) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  
  const copy = [...arr];
  const { addEntropy = true, sessionSeed = '' } = options;
  
  // Add extra entropy from timestamp and session data to make patterns less predictable
  let entropyOffset = 0;
  if (addEntropy) {
    const timeComponent = Date.now() % 1000;
    const sessionComponent = sessionSeed ? 
      sessionSeed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 1000 : 
      0;
    entropyOffset = (timeComponent + sessionComponent) % copy.length;
  }
  
  // Fisher-Yates shuffle with better randomization
  for (let i = copy.length - 1; i > 0; i -= 1) {
    // Use better random + optional entropy offset
    let j = Math.floor(betterRandom() * (i + 1));
    
    // Mix in entropy to break up patterns
    if (addEntropy && entropyOffset > 0) {
      j = (j + entropyOffset) % (i + 1);
      // Rotate entropy for next iteration
      entropyOffset = (entropyOffset * 7 + 13) % copy.length;
    }
    
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  
  return copy;
}

/**
 * Select random items from array without duplicates
 * More reliable than shuffle+slice for small selections from large arrays
 * 
 * @param {Array} arr - Source array
 * @param {number} count - Number of items to select
 * @param {Array} exclude - Items to exclude (optional)
 * @returns {Array} Array of selected items
 */
export function randomSelect(arr, count, exclude = []) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  if (count >= arr.length && exclude.length === 0) return betterShuffle(arr);
  
  const available = exclude.length > 0 
    ? arr.filter(item => !exclude.includes(item))
    : arr;
    
  if (count >= available.length) return betterShuffle(available);
  
  const selected = [];
  const indices = new Set();
  
  while (selected.length < count && selected.length < available.length) {
    const idx = randomInt(0, available.length);
    if (!indices.has(idx)) {
      indices.add(idx);
      selected.push(available[idx]);
    }
  }
  
  return selected;
}

export default {
  betterRandom,
  randomInt,
  betterShuffle,
  randomSelect
};
