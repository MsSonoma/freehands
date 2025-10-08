# Short Answer Configuration - 15% Cap Across All Subjects

## Final Configuration

### Short Answer Distribution
- **All Phases**: SA questions now included across all subjects (math and non-math)
- **Comprehension**: ~15% SA (backend judging)
- **Exercise**: ~15% SA (backend judging)
- **Worksheet**: ~15% SA, ~15% FIB (backend judging for SA, local for FIB)
- **Test**: ~15% SA, ~15% FIB (backend judging for SA, local for FIB)

## Changes Made

### 1. Assessment Generation (useAssessmentGeneration.js)
- **Line 56**: Changed SA/FIB cap from 10% to 15% for takeMixed function
- **Line 96**: Changed SA/FIB cap from 30% (testing) to 15% for buildFromCategories

### 2. Pool Building (assessmentGenerationUtils.js)
- **Line 28**: Removed SA filtering for non-math subjects in buildQAPool
- **Line 58**: All subjects now include SA in comprehension/exercise pools

### 3. Runtime Drawing Filters Removed

#### page.js Updates
- **Line 4565**: Removed SA filter when picking first comprehension question
- **Line 4609**: Removed SA filter from next comprehension question loop
- **Line 4757**: Removed SA filter when picking first exercise question
- **Line 4798**: Removed SA filter from next exercise question loop

#### usePhaseHandlers.js Updates
- **Line 67**: Removed SA filter in beginComprehensionPhase
- **Line 113**: Removed SA filter in beginSkippedExercise

## Expected Question Distribution

### For a typical lesson with all question types:

**Comprehension (3 questions)**
- ~0-1 SA questions (backend judged)
- ~2-3 TF/MC/FIB questions (local judged)

**Exercise (5 questions)**
- ~1 SA question (backend judged)
- ~4 TF/MC/FIB questions (local judged)

**Worksheet (15 questions)**
- ~2 SA questions (backend judged)
- ~2 FIB questions (local judged)
- ~11 TF/MC questions (local judged)

**Test (10 questions)**
- ~1-2 SA questions (backend judged)
- ~1-2 FIB questions (local judged)
- ~6-8 TF/MC questions (local judged)

## Total SA Questions Per Session
Approximately **4-6 SA questions** across all four phases that will use backend judging.

## Backend API Usage
- Only SA questions call `/api/judge-short-answer`
- TF/MC/FIB remain instant with local judging
- Automatic fallback to local if backend fails
- Estimated ~4-6 API calls per complete lesson session

## Identifying SA Questions

During a session, SA questions are:
- **No True/False prefix**
- **No multiple choice options (A, B, C, D)**
- **No blank line (_____)**
- **Open-ended format**: "What is...", "Explain...", "Why does..."
- **Console log**: Look for `[judgeAnswer] Backend API...` in DevTools

## Testing Verification

To confirm backend judging is working:

1. **Open Browser Console** (F12 → Console tab)
2. **Start any lesson** (any subject now includes SA)
3. **Watch for SA questions** (open-ended format)
4. **Check console logs**:
   - `[judgeAnswer] Backend API...` = SA detected, calling backend
   - No log = TF/MC/FIB using local judging

## Performance Impact

- **SA questions**: ~1-2 second delay for backend judgment
- **Other questions**: Instant local judgment (unchanged)
- **Overall**: Minimal impact (~6 API calls spread across ~40 total questions)

## Reverting (if needed)

To restore original behavior:
1. Change caps back to 10% in useAssessmentGeneration.js
2. Re-add SA filters in assessmentGenerationUtils.js line 58-61
3. Re-add runtime filters in page.js and usePhaseHandlers.js

## Current State

✅ Backend API endpoint working  
✅ Unified judgeAnswer() routing SA to backend  
✅ All 4 phases use judgeAnswer()  
✅ SA enabled across all subjects  
✅ 15% cap for SA and FIB  
✅ All runtime filters removed  
✅ No compilation errors  

**Status**: Ready for testing! SA questions should now appear naturally in all phases.
