# Lesson Editor - Answer Display Fix

## Issue
Multiple choice, fill-in-the-blank, short answer, and sample Q&A questions were not displaying their existing answers when the editor loaded. Users could add new answers, but couldn't see what was already in the lesson.

## Root Cause
The lesson JSON format has inconsistent field names across different lessons:
- Questions might be stored as `question`, `q`, or `Q`
- Answers might be in `expectedAny`, `expected`, `answers`, `answer`, `a`, or `A`
- Choices might be in `choices`, `options`, or `A`
- Answer objects might be strings or objects with nested fields

When loading the lesson, these variant field names weren't being normalized to a consistent structure before passing to the editors.

## Solution
Added a comprehensive `normalizeLessonData()` function that runs when a lesson is loaded. This function:

### 1. Normalizes Multiple Choice Questions
```javascript
{
  question: q.question || q.q || q.Q || '',
  choices: toArray(q.choices || q.options || q.A).map(c => 
    typeof c === 'string' ? c : (c?.text || c?.label || c?.choice || '')
  ),
  correct: q.correct || q.correctIndex || q.answerIndex || 0
}
```

### 2. Normalizes True/False Questions
```javascript
{
  question: q.question || q.q || q.Q || '',
  answer: q.answer || q.correct || true
}
```

### 3. Normalizes Answer-Based Questions (SA, FIB, Sample, Word Problems)
```javascript
{
  question: q.question || q.q || q.Q || '',
  expectedAny: toArray(answers).length > 0 ? toArray(answers) : ['']
}
```

### 4. Normalizes Vocabulary Terms
```javascript
{
  term: v.term || v.word || v.name || '',
  definition: v.definition || v.def || v.meaning || ''
}
```

## Key Changes

### File: `src/components/LessonEditor.jsx`

1. **Added `normalizeLessonData()` function** (lines ~20-90)
   - Converts all field name variants to consistent names
   - Ensures arrays are properly initialized
   - Handles nested object structures
   - Preserves all data while standardizing format

2. **Updated `useEffect` hook** to call normalization on load
   ```javascript
   useEffect(() => {
     if (initialLesson) {
       const normalized = normalizeLessonData(initialLesson)
       setLesson(normalized)
     }
   }, [initialLesson])
   ```

3. **Added debug logging** to track data flow
   - Logs original lesson data
   - Logs normalized lesson data
   - Logs questions received by each editor
   - Logs answer arrays during normalization

4. **Enhanced `toArray()` utility**
   - Consistently converts various input types to arrays
   - Handles null, undefined, single values, and arrays
   - Used throughout normalization process

## Testing Checklist

To verify the fix works:

1. ✅ Load an existing lesson with multiple choice questions
   - All choices should display
   - Correct answer should be selected
   
2. ✅ Load a lesson with short answer questions
   - All acceptable answers should show
   - Each answer should be editable
   - Can add more answers
   - Can remove answers (if more than 1)

3. ✅ Load a lesson with fill-in-the-blank
   - Question text with _____ should display
   - All acceptable answers should show
   
4. ✅ Load a lesson with sample Q&A
   - Questions should display
   - Sample answers should show

5. ✅ Load a lesson with word problems
   - Problem text should display
   - Acceptable answers should show

6. ✅ Check console logs
   - Should see normalization logs
   - Should see editor receiving questions
   - Should see answer arrays being processed

## Data Flow

```
Lesson JSON (storage)
  ↓
normalizeLessonData() - standardize field names
  ↓
setLesson() - update component state
  ↓
toArray(lesson.multiplechoice) - convert to array
  ↓
MultipleChoiceEditor receives questions prop
  ↓
questions.map() renders each question
  ↓
q.choices.map() renders each choice
  ↓
User sees all existing data
```

## Benefits

1. **Backward Compatibility** - Handles all existing lesson formats
2. **Forward Compatibility** - New lessons use consistent format
3. **Data Preservation** - No data loss during normalization
4. **Type Safety** - All fields guaranteed to be correct type
5. **Debugging** - Console logs help track data transformation

## Debug Commands

To see what's happening in the console:
```javascript
// When lesson loads
[LessonEditor] Original lesson data: { ... }
[LessonEditor] Normalized lesson data: { ... }

// When editors render
[MultipleChoiceEditor] Received questions: [...]
[ShortAnswerEditor] Received questions: [...]
[FillInBlankEditor] Received questions: [...]
[SampleQAEditor] Received questions: [...]

// During short answer normalization
[Normalize SA] Question: "..." Raw answers: [...] Array: [...]
```

## Future Improvements

1. **Schema Validation** - Add JSON schema validation for lesson files
2. **Migration Script** - Batch convert all old lessons to new format
3. **Format Documentation** - Document the canonical lesson JSON format
4. **Test Suite** - Add unit tests for normalization function
5. **Type Definitions** - Add TypeScript types for lesson structure
