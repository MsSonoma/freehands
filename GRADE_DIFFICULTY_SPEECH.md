# Grade-Level and Difficulty-Aware Speech Implementation

## Summary
Ms. Sonoma now dynamically adjusts her speaking style based on the learner's grade level and the lesson's difficulty setting. This ensures appropriate vocabulary, sentence complexity, technical depth, tone, and pacing for each learner.

## Changes Made

### 1. New Utility Function: `getGradeAndDifficultyStyle()`
**File**: `src/app/session/utils/constants.js`

Created a new function that generates grade-appropriate and difficulty-aware speaking instructions:

- **Grade Awareness**: Adjusts vocabulary and complexity for Kindergarten through 12th grade
  - K: Ages 5-6, simplest language (4-8 words/sentence)
  - 1st-2nd: Ages 6-8, simple everyday words (6-10 words/sentence)
  - 3rd-5th: Ages 8-11, clear elementary language (8-12 words/sentence)
  - 6th+: Ages 11+, age-appropriate middle school vocabulary (10-15 words/sentence)

- **Difficulty Awareness**: Adjusts tone and pacing
  - **Beginner**: Warm, gentle, encouraging; patient pacing
  - **Intermediate**: Warm, supportive; steady pacing without over-simplification
  - **Advanced**: Warm, confident; brisk pacing with deeper concepts

### 2. Updated System Message Builder
**File**: `src/app/session/utils/systemMessage.js`

- Added `grade` and `difficulty` parameters to `buildSystemMessage()`
- Now calls `getGradeAndDifficultyStyle()` to generate appropriate instructions
- Replaced static `KID_FRIENDLY_STYLE` with dynamic grade-aware styling

### 3. Updated Teaching Steps Configuration
**File**: `src/app/session/utils/constants.js`

- Updated `getTeachingSteps()` to accept `grade` and `difficulty` parameters
- Teaching instructions now include grade-appropriate and difficulty-aware style guidance
- Legacy `KID_FRIENDLY_STYLE` constant maintained for backward compatibility (defaults to 1st grade, beginner)

### 4. Learner Grade State Management
**File**: `src/app/session/page.js`

- Added `learnerGrade` state to track the current learner's grade level
- Loads grade from learner profile on session start
- Listens for storage changes to update when learner switches
- Passes grade and difficulty to all instruction builders

### 5. Updated Discussion Handlers
**File**: `src/app/session/hooks/useDiscussionHandlers.js`

- Added `learnerGrade` parameter to the hook
- Replaced all hardcoded "talking to a 5 year old" instructions with dynamic `getGradeAndDifficultyStyle()` calls
- Affects: story summaries, story continuations, story suggestions, story endings

### 6. Grade Derivation
**File**: `src/app/session/page.js`

- Uses learner's grade from profile when available
- Falls back to deriving grade from lesson title (e.g., "4th Grade Math")
- Ensures grade context is always available for appropriate speech

## Technical Details

### Parameters Used Throughout
- **grade**: String or number (e.g., 'K', '1', '4th', 4)
  - Normalized internally to a consistent format
  - Extracted from learner profile or lesson metadata
  
- **difficulty**: String ('beginner', 'intermediate', 'advanced')
  - Comes from URL parameters
  - Default: 'beginner' if not specified

### Where Grade/Difficulty Context Is Applied
1. Opening phase (greeting, encouragement, joke, silly question)
2. Teaching phase (intro, examples, wrap)
3. Repeat explanations during teaching
4. Story interactions (summaries, suggestions, continuations)
5. Poem and riddle interactions
6. Ad-hoc question handling

## Benefits

### For Learners
- **Age-appropriate language**: No more talking down to older students or overwhelming younger ones
- **Appropriate challenge**: Beginner lessons are gentler; advanced lessons assume more background knowledge
- **Better engagement**: Content matches developmental stage and skill level

### For Educators
- **Consistent pedagogical approach**: Grade-level standards applied automatically
- **Differentiation support**: Same lesson adapts to different learner profiles
- **Flexibility**: Single lesson can serve multiple grades with appropriate adjustments

## Backward Compatibility
- Legacy `KID_FRIENDLY_STYLE` constant still available (defaults to 1st grade, beginner)
- Functions default to safe fallback values when grade/difficulty not provided
- Existing code without grade/difficulty parameters continues to work

## Future Enhancements
Consider adding:
- Subject-specific vocabulary adjustments
- Learning style preferences (visual, auditory, kinesthetic)
- Cultural/language background considerations
- Special education accommodations

## Testing Recommendations
1. Test with learners at different grade levels (K, 3rd, 6th, 9th)
2. Test each difficulty level (beginner, intermediate, advanced)
3. Verify appropriate language in:
   - Teaching explanations
   - Story interactions
   - Question feedback
   - Comprehension guidance

## Date
October 20, 2025
