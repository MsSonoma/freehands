# Lesson Assessment Architecture

## How It Works

### Core Design: Arrays as Source of Truth

When a student loads a lesson, the system generates 4 shuffled question arrays that represent their progress through that lesson:

1. **generatedComprehension** - Questions for Comprehension phase (Ask/Feedback)
2. **generatedExercise** - Questions for Exercise phase (interactive practice)
3. **generatedWorksheet** - Questions for Worksheet phase (PDF printable)
4. **generatedTest** - Questions for Test phase (final assessment)

These arrays are **the canonical source of progress**. They persist across browser sessions via localStorage, ensuring:
- Same shuffled order when student returns to lesson
- Student picks up right where they left off
- Consistent question sequence across all 4 phases unless refresh button clicked

### Data Flow

```
Supabase lesson file (questions array)
  ↓
buildQAPool (shuffle with crypto-random)
  ↓
4 generated arrays (ONE TIME on lesson load)
  ↓
localStorage (persist after generation/restore on load)
  ↓
Phase rendering (use arrays[phaseIndex])
```

### Lesson Data State

`lessonData` state holds the full lesson record from Supabase:
- `title` - Display in header
- `filename` - Lesson identifier
- `grade` - Grade level
- `subject` - Subject area
- `vocab` - Vocabulary terms for display
- `teachingNotes` - Content for Teaching phase
- `questions` - Source array for generating shuffled question arrays

**lessonData is READ-ONLY after load** - it provides reference content but does NOT drive phase rendering. The 4 generated arrays are what determine which questions appear in each phase.

### Pools Are Eliminated

Previous architecture had `compPool` and `exercisePool` states that acted as "refill buckets" when arrays ran out. This created sync problems:
- Stale pool data from previous lesson contaminating current lesson
- Complex fallback logic (try array → fallback to pool → slice pool → refill pool)
- Redundant caching of same data in multiple places

**New design**: No pools. Arrays are fixed-length and cannot be refilled. If student completes all questions in a phase, array is exhausted and phase ends.

### Refresh Button Reshuffles

Only user action that generates new arrays is clicking the **Refresh** button:
1. Calls `buildQAPool` with current `lessonData.questions`
2. Generates 4 brand new shuffled arrays
3. Resets all phase indexes to 0
4. Saves new arrays to localStorage
5. Student starts lesson fresh with new random order

### Atomic localStorage Restore

On lesson load, system checks localStorage for previously generated arrays. Validation is all-or-nothing:

**Validation checks**:
1. Do all 4 array keys exist in localStorage?
2. Does the stored lesson filename match current `lessonParam`?
3. Is first question from each array found in `lessonData.questions`?

**If all checks pass**: Restore all 4 arrays + phase indexes from localStorage (student continues where left off)

**If any check fails**: Generate 4 fresh arrays from `lessonData.questions` (student starts new shuffled sequence)

No partial restore - either restore all 4 arrays or regenerate all 4.

### Question Selection

Each phase uses simple direct indexing:

```javascript
const currentQuestion = generatedComprehension[comprehensionIndex]
```

No fallbacks. No pool slicing. No refill logic. If index exceeds array length, phase is complete.

### Storage Keys

localStorage uses lesson-specific keys:
- `session_comprehension_${lessonParam}` - Comprehension questions
- `session_exercise_${lessonParam}` - Exercise questions  
- `session_worksheet_${lessonParam}` - Worksheet questions
- `session_test_${lessonParam}` - Test questions
- `session_comprehension_index_${lessonParam}` - Progress in Comprehension
- `session_exercise_index_${lessonParam}` - Progress in Exercise

When lesson changes, new keys are used automatically (old lesson arrays stay in storage but are not loaded).

## What NOT To Do

### ❌ Don't add pool states
Arrays are the only source. No backup buckets.

### ❌ Don't add fallback logic to question selection
If array[index] is undefined, phase is complete. Don't try to refill from anywhere.

### ❌ Don't regenerate arrays on every render
Arrays are generated ONCE per lesson load (either fresh or restored from localStorage). Only refresh button triggers regeneration.

### ❌ Don't do partial localStorage restore
Either restore all 4 arrays (full match) or regenerate all 4 (any mismatch). Never restore some arrays and regenerate others.

### ❌ Don't store arrays in multiple places
localStorage is persistence layer. React state is runtime layer. No database storage of shuffled arrays (too much data, no value).

### ❌ Don't use lessonData.questions for phase rendering
lessonData is reference data for title/vocab/teachingNotes and source for array generation. Once arrays are generated, lessonData.questions is not touched.

## Key Files

### src/app/session/page.js
- Lines ~1040-1043: `generatedComprehension`, `generatedExercise`, `generatedWorksheet`, `generatedTest` state
- Lines ~1735-1756: `buildQAPool` callback with validation (checks lessonData matches lessonParam)
- Lines ~1815-1866: localStorage restore logic with content mismatch detection
- Lines ~4419-4433: Array generation on lesson load
- Lines ~5722-5733: Question selection for Comprehension phase (direct array indexing)

### src/app/session/utils/assessmentGenerationUtils.js
- Lines 79-114: `buildQAPool` utility - Fisher-Yates shuffle with crypto-random, deduplication, validation

### src/app/session/hooks/usePhaseHandlers.js
- Phase transition handlers that increment indexes and trigger saves

### localStorage API
- `getItem`/`setItem` for persistence
- Keys scoped to `lessonParam` (lesson filename)
- JSON serialization for arrays

## Common Patterns

### Generate arrays on lesson load
```javascript
useEffect(() => {
  if (!lessonData?.questions?.length) return;
  
  // Try restore from localStorage
  const restoredComp = tryRestoreArray('comprehension', lessonParam);
  const restoredExer = tryRestoreArray('exercise', lessonParam);
  const restoredWork = tryRestoreArray('worksheet', lessonParam);
  const restoredTest = tryRestoreArray('test', lessonParam);
  
  // Validate all 4 arrays match current lesson
  if (allArraysValid(restoredComp, restoredExer, restoredWork, restoredTest, lessonData)) {
    // Restore all 4
    setGeneratedComprehension(restoredComp);
    setGeneratedExercise(restoredExer);
    setGeneratedWorksheet(restoredWork);
    setGeneratedTest(restoredTest);
  } else {
    // Regenerate all 4
    const freshComp = buildQAPool(lessonData, 'comprehension');
    const freshExer = buildQAPool(lessonData, 'exercise');
    const freshWork = buildQAPool(lessonData, 'worksheet');
    const freshTest = buildQAPool(lessonData, 'test');
    
    setGeneratedComprehension(freshComp);
    setGeneratedExercise(freshExer);
    setGeneratedWorksheet(freshWork);
    setGeneratedTest(freshTest);
  }
}, [lessonData, lessonParam]);
```

### Select question for phase
```javascript
const currentQuestion = generatedComprehension[comprehensionIndex];
if (!currentQuestion) {
  // Phase complete
  return null;
}
```

### Save progress after each answer
```javascript
const handleNextQuestion = () => {
  const newIndex = comprehensionIndex + 1;
  setComprehensionIndex(newIndex);
  localStorage.setItem(`session_comprehension_index_${lessonParam}`, newIndex.toString());
};
```

### Refresh button reshuffles
```javascript
const handleRefresh = () => {
  const freshComp = buildQAPool(lessonData, 'comprehension');
  const freshExer = buildQAPool(lessonData, 'exercise');
  const freshWork = buildQAPool(lessonData, 'worksheet');
  const freshTest = buildQAPool(lessonData, 'test');
  
  setGeneratedComprehension(freshComp);
  setGeneratedExercise(freshExer);
  setGeneratedWorksheet(freshWork);
  setGeneratedTest(freshTest);
  
  // Reset all indexes
  setComprehensionIndex(0);
  setExerciseIndex(0);
  
  // Persist new arrays
  localStorage.setItem(`session_comprehension_${lessonParam}`, JSON.stringify(freshComp));
  localStorage.setItem(`session_exercise_${lessonParam}`, JSON.stringify(freshExer));
  localStorage.setItem(`session_worksheet_${lessonParam}`, JSON.stringify(freshWork));
  localStorage.setItem(`session_test_${lessonParam}`, JSON.stringify(freshTest));
  
  // Reset indexes in storage
  localStorage.setItem(`session_comprehension_index_${lessonParam}`, '0');
  localStorage.setItem(`session_exercise_index_${lessonParam}`, '0');
};
```
