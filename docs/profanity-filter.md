# Profanity Filter

## Overview

The profanity filter protects the Ms. Sonoma AI system from inappropriate language by blocking curse words and offensive terms from learner input before they are sent to the AI.

## Location

- **Filter Module**: `src/app/session/utils/profanityFilter.js`
- **Integration**: `src/app/session/page.js` (handleSend function)
- **Tests**: `src/app/session/utils/__tests__/profanityFilter.test.js`

## How It Works

1. **Input Interception**: When a learner submits text input, the `handleSend` function calls `checkLearnerInput()` before processing.

2. **Profanity Detection**: The filter checks the input against a list of inappropriate words using case-insensitive, whole-word matching.

3. **Blocking**: If profanity is detected:
   - The input is cleared
   - The AI is NOT called
   - A kid-friendly rejection message is spoken (e.g., "Let's use kind words")
   - The event is logged to the console

4. **Allowed Input**: Clean input passes through normally and is processed by the AI.

## Features

### Whole-Word Matching
The filter only matches complete words, not substrings. For example:
- ✅ "assessment" → allowed (contains "ass" but not as a whole word)
- ❌ "this is ass" → blocked (whole word match)

### Case-Insensitive
Works regardless of capitalization:
- "SHIT", "shit", "ShIt" → all blocked

### Kid-Friendly Rejection Messages
Random selection from gentle, age-appropriate messages:
- "Let's use kind words."
- "Can you say that differently?"
- "Let's keep our words friendly."
- "Please use nice words."
- "Let's use respectful language."

### Filtered Output
For logging purposes, the filter provides a censored version with asterisks:
- Input: "this is shit"
- Filtered: "this is ****"

## API

### `checkLearnerInput(text)`
Main function for validating learner input.

**Parameters:**
- `text` (string): The learner input to check

**Returns:**
```javascript
{
  allowed: boolean,        // true if input is clean
  message?: string,        // rejection message if profanity detected
  filtered?: string        // censored version for logging
}
```

### `containsProfanity(text)`
Check if text contains any profanity.

**Returns:** `boolean`

### `filterProfanity(text)`
Replace profanity with asterisks.

**Returns:** `string` (filtered text)

### `getProfanityRejectionMessage()`
Get a random kid-friendly rejection message.

**Returns:** `string`

## Profanity List

The filter includes common profanity, offensive slurs, and inappropriate terms. The list is maintained in `PROFANITY_LIST` within the filter module.

### Expanding the List

To add new words to the filter:

1. Open `src/app/session/utils/profanityFilter.js`
2. Add words to the `PROFANITY_LIST` array
3. Words are automatically compiled into regex patterns for matching

**Example:**
```javascript
const PROFANITY_LIST = [
  // Strong profanity
  'fuck', 'shit', 'bitch',
  
  // Add new words here
  'newbadword',
  
  // Variants
  'newbadword123',
];
```

## Testing

Run the test suite to verify the filter is working:

```bash
npm test profanityFilter.test.js
```

### Test Coverage
- Basic profanity detection
- Case-insensitivity
- Whole-word matching
- Clean text preservation
- Empty/invalid input handling
- Message generation
- Filtering output

## Logging

When profanity is detected, the event is logged:

```
[Session] Profanity detected and blocked: { filtered: 'this is ****' }
```

This helps facilitators and administrators monitor for potential issues while maintaining child privacy.

## Integration Points

The profanity filter is integrated at the single entry point where all learner text input flows through:

- `handleSend()` in `src/app/session/page.js`

This ensures comprehensive coverage across all session phases:
- Discussion phase
- Ask questions
- Story telling
- Poems
- Fill-in-Fun
- Comprehension answers
- Exercise answers
- Worksheet answers
- Test answers

## Privacy & Safety

- **No Data Sent**: Blocked text is never transmitted to the AI or backend servers
- **Local Filtering**: All filtering happens in the browser
- **Censored Logging**: Logs use asterisk-censored versions to maintain appropriate records

## Maintenance

### Periodic Review
- Review console logs for patterns that may need to be added
- Update the word list as new problematic terms emerge
- Consider feedback from facilitators

### Balance
- Be comprehensive enough to block inappropriate content
- Avoid over-blocking legitimate educational terms
- Use whole-word matching to reduce false positives

## Future Enhancements

Potential improvements to consider:

1. **Configurable Lists**: Allow facilitators to customize the profanity list
2. **Context-Aware Filtering**: Different strictness levels based on age/grade
3. **Phonetic Matching**: Detect intentional misspellings (e.g., "fuk" for "fuck")
4. **Reporting Dashboard**: Admin view of blocked attempts
5. **Pattern Detection**: Identify repeated attempts to bypass the filter
