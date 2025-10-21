# Manual Testing Guide: Profanity Filter

## Test Setup

1. Start the development server
2. Navigate to a session page
3. Open browser console to monitor logs
4. Progress to any phase where text input is enabled (Discussion, Ask Questions, etc.)

## Test Cases

### Test 1: Basic Profanity Detection
**Input:** Type "this is shit" and press send
**Expected:**
- Input is cleared
- Ms. Sonoma says a rejection message (e.g., "Let's use kind words")
- Console shows: `[Session] Profanity detected and blocked: { filtered: 'this is ****' }`
- Message is NOT sent to AI

### Test 2: Case-Insensitive Detection
**Input:** Type "FUCK" (all caps)
**Expected:**
- Same blocking behavior as Test 1
- Rejection message displayed

### Test 3: Multiple Curse Words
**Input:** Type "shit and fuck"
**Expected:**
- Blocked with rejection message
- Console shows filtered version with multiple asterisks

### Test 4: Clean Text Passes Through
**Input:** Type "What is 5 + 5?"
**Expected:**
- Input is processed normally
- AI responds appropriately
- NO profanity blocking message

### Test 5: Whole-Word Matching (False Positive Check)
**Input:** Type "I passed my assessment"
**Expected:**
- Input is processed normally (contains "ass" but not as whole word)
- AI responds appropriately
- NO blocking

### Test 6: Multiple Attempts
**Input:** Type various curse words in succession
**Expected:**
- Each attempt is blocked
- Each shows rejection message
- None reach the AI

### Test 7: Mixed Content
**Input:** Type "What is 2 + 2 shit"
**Expected:**
- Blocked due to profanity
- Entire message rejected (not partially filtered)

### Test 8: Different Session Phases

Test in each phase where input is allowed:

#### Phase: Discussion (Opening)
- Enter curse word at "What do you like?" prompt
- Should be blocked

#### Phase: Ask Questions
- Click "Ask a Question"
- Enter question with curse word
- Should be blocked

#### Phase: Story
- During story collaboration
- Enter story continuation with curse word
- Should be blocked

#### Phase: Comprehension/Exercise/Worksheet/Test
- When answering questions
- Enter answer with curse word
- Should be blocked

### Test 9: Edge Cases

**Empty Input:**
- Type spaces only → No error, just ignored

**Special Characters:**
- Type "sh!t" or "f**k" → Currently passes (phonetic variants not blocked)

**Non-English:**
- Type curse words in other languages → Depends on word list

### Test 10: User Experience

**Verify:**
- ✅ Input field clears immediately
- ✅ Rejection message is kid-friendly and polite
- ✅ User can try again immediately after rejection
- ✅ No error dialogs or harsh messages
- ✅ Session continues normally after rejection

## Console Log Verification

After each blocked attempt, check console for:
```
[Session] Profanity detected and blocked: { filtered: '...' }
```

Verify:
- Only asterisks appear in log (no actual curse words logged)
- Log appears for every blocked attempt
- No logs for clean input

## Network Verification

Use browser DevTools Network tab:

**When profanity is blocked:**
- ✅ NO POST to `/api/sonoma`
- ✅ Only GET to `/api/tts` for rejection message

**When clean input is sent:**
- ✅ POST to `/api/sonoma` appears
- ✅ GET to `/api/tts` for AI response

## Regression Testing

Verify existing functionality still works:

- ✅ Normal questions answered correctly
- ✅ All session phases work
- ✅ Audio playback works
- ✅ Captions display correctly
- ✅ Progress tracking continues
- ✅ Button interactions work

## Performance Check

- Input remains responsive
- No noticeable delay when typing
- Blocking is instantaneous
- No memory leaks after multiple attempts

## Pass Criteria

All test cases must pass with:
- ✅ Profanity reliably blocked
- ✅ Clean input processed normally
- ✅ Kid-friendly rejection messages
- ✅ Proper logging
- ✅ No AI calls for blocked input
- ✅ No session disruption
- ✅ No regressions in existing features
