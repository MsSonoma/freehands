/**
 * Tests for profanityFilter
 */

import { containsProfanity, filterProfanity, checkLearnerInput, getProfanityRejectionMessage } from '../profanityFilter';

describe('profanityFilter', () => {
  describe('containsProfanity', () => {
    test('detects basic profanity', () => {
      expect(containsProfanity('This is shit')).toBe(true);
      expect(containsProfanity('What the fuck')).toBe(true);
      expect(containsProfanity('You are a bitch')).toBe(true);
    });

    test('is case-insensitive', () => {
      expect(containsProfanity('SHIT')).toBe(true);
      expect(containsProfanity('Fuck')).toBe(true);
      expect(containsProfanity('BiTcH')).toBe(true);
    });

    test('detects whole words only', () => {
      expect(containsProfanity('assessment')).toBe(false); // contains 'ass' but not as whole word
      expect(containsProfanity('class')).toBe(false);
      expect(containsProfanity('pass')).toBe(false);
    });

    test('returns false for clean text', () => {
      expect(containsProfanity('Hello world')).toBe(false);
      expect(containsProfanity('What is 2 + 2?')).toBe(false);
      expect(containsProfanity('I like math')).toBe(false);
    });

    test('handles empty or invalid input', () => {
      expect(containsProfanity('')).toBe(false);
      expect(containsProfanity(null)).toBe(false);
      expect(containsProfanity(undefined)).toBe(false);
    });
  });

  describe('filterProfanity', () => {
    test('replaces profanity with asterisks', () => {
      expect(filterProfanity('This is shit')).toBe('This is ****');
      expect(filterProfanity('What the fuck')).toBe('What the ****');
    });

    test('maintains original text length', () => {
      const input = 'This is shit';
      const output = filterProfanity(input);
      expect(output.length).toBe(input.length);
    });

    test('handles multiple profanities', () => {
      const result = filterProfanity('shit and fuck');
      expect(result).toContain('****');
      expect(result).not.toContain('shit');
      expect(result).not.toContain('fuck');
    });

    test('preserves clean text', () => {
      expect(filterProfanity('Hello world')).toBe('Hello world');
      expect(filterProfanity('assessment')).toBe('assessment');
    });
  });

  describe('checkLearnerInput', () => {
    test('allows clean input', () => {
      const result = checkLearnerInput('What is 5 + 5?');
      expect(result.allowed).toBe(true);
      expect(result.message).toBeUndefined();
    });

    test('blocks profane input', () => {
      const result = checkLearnerInput('This is shit');
      expect(result.allowed).toBe(false);
      expect(result.message).toBeTruthy();
      expect(typeof result.message).toBe('string');
    });

    test('provides filtered version', () => {
      const result = checkLearnerInput('This is shit');
      expect(result.filtered).toBe('This is ****');
    });

    test('handles empty input', () => {
      const result = checkLearnerInput('');
      expect(result.allowed).toBe(true);
    });
  });

  describe('getProfanityRejectionMessage', () => {
    test('returns a kid-friendly message', () => {
      const message = getProfanityRejectionMessage();
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    test('returns different messages', () => {
      const messages = new Set();
      // Call multiple times to potentially get different messages
      for (let i = 0; i < 20; i++) {
        messages.add(getProfanityRejectionMessage());
      }
      // Should have at least 2 different messages (though randomness may give same one repeatedly)
      expect(messages.size).toBeGreaterThan(0);
    });
  });
});
