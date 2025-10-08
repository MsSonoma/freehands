# Short Answer Testing Configuration

## Issue Found
Your SA backend judging implementation is correct, but SA questions are being **actively filtered out** in multiple places:

### 1. Comprehension/Exercise Pool Building
- **File**: `src/app/session/utils/assessmentGenerationUtils.js` line 58-61
- **Original**: Excluded SA from non-math comprehension/exercise
- **Changed**: Now includes SA for all subjects (testing mode)

### 2. Worksheet/Test Generation
- **File**: `src/app/session/hooks/useAssessmentGeneration.js` line 88-109
- **Original**: Capped SA at 10% (1-2 questions per worksheet/test)
- **Changed**: Increased cap to 30% (~4-5 SA per worksheet, ~3 per test)

### 3. Runtime Question Drawing
- **Files**: Multiple locations in `src/app/session/page.js`
- **Issue**: `while` loops skip SA questions when drawing from pools
- **Lines affected**:
  - Line 3632, 4118, 4567, 4609, 4761, 4798 (comprehension/exercise)
  - Also in `src/app/session/hooks/usePhaseHandlers.js`
- **Status**: NOT YET CHANGED (would require many edits)

## Temporary Testing Mode Enabled

I've enabled "SA Testing Mode" by:
1. ✅ Allowing SA in comprehension/exercise pools (all subjects)
2. ✅ Increased SA cap from 10% to 30% in worksheet/test

However, **runtime filters still skip SA** in some question-drawing loops.

## Recommended Testing Approach

### Option A: Quick Test with Worksheet/Test Only
1. Skip comprehension/exercise (press Next through them)
2. Go directly to **Worksheet** - should now have ~4-5 SA questions (30% of 15)
3. Test your answers - SA questions will use backend judging
4. Then do **Test** - should have ~3 SA questions (30% of 10)

### Option B: Complete Runtime Filter Removal
If you want SA in comprehension/exercise too, I need to:
1. Remove all `!isShortAnswerItem()` filters from drawing loops
2. Remove `while` loops that skip SA questions
3. Update `usePhaseHandlers.js` similarly

This would require ~12 edits across multiple files.

## How to Identify SA Questions

When you see a question, you can tell it's SA if:
- No True/False prefix
- No multiple choice letters (A, B, C, D)
- No blank line (_____)
- Open-ended "What is..." or "Explain..." format
- Backend API call will show in browser console: `[judgeAnswer] Backend API...`

## Console Logging

To verify backend judging is working, open browser DevTools console and look for:
```
[judgeAnswer] Backend API...
```

When a SA question is judged, you'll see either:
- Success path: Returns `{correct: true/false}`
- Fallback path: "Backend API failed, falling back to local judging"

## Reverting Changes

When testing is complete, you can:
1. Change `0.30` back to `0.10` in `useAssessmentGeneration.js` line 96
2. Restore SA filtering in `assessmentGenerationUtils.js` line 58-61

Or I can do this for you.

## Current State

✅ Backend API endpoint working  
✅ Unified judgeAnswer() function working  
✅ All 4 phases updated to use judgeAnswer()  
✅ SA included in pools (testing mode)  
✅ SA cap increased to 30%  
⚠️  Runtime drawing loops still have SA filters (partial)  

**Next Step**: Try a worksheet or test phase - they should now have several SA questions!
