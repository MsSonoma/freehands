# KILL_SAMPLE_ARRAY - DO NOT RESURRECT

## CRITICAL: The `sample` array is DEAD and must NEVER be reimplemented

### History (for context only - DO NOT USE AS IMPLEMENTATION GUIDE)

The `sample` array was originally created as a math-specific workaround when math lessons were handled differently from other subjects. It stored basic practice problems.

### Why it was killed

1. **Confused AI generators** - AI models saw "sample" and thought it meant "examples to model generation from" instead of "practice problems"
2. **Spread like a virus** - Despite being math-only, it infected other subjects through documentation
3. **Zombie code** - It was removed multiple times but kept getting reimplemented because docs explained WHY it was created
4. **Redundant** - We already have proper question categories: `truefalse`, `multiplechoice`, `fillintheblank`, `shortanswer`, `wordProblems`

### What replaced it

ALL problems should go into the appropriate category arrays:
- Simple Q&A → `shortanswer`
- Math practice problems → `shortanswer` or `wordProblems`
- Vocab/concept checks → `fillintheblank` or `shortanswer`
- Fact checking → `truefalse` or `multiplechoice`

### Implementation rules

**NEVER:**
- Create a `sample` array in lesson JSON
- Reference `lessonData.sample` in code
- Create `sampleDeck`, `initSampleDeck`, `drawSample`, `reserveSamples` functions
- Tag questions with `sourceType: 'sample'`
- Document or explain the sample array (this file is the ONLY exception)

**ALWAYS:**
- Use the five standard categories: TF, MC, FIB, SA, WP (math only)
- If you see `sample` in code, DELETE it
- If you see `sample` in docs, DELETE the reference
- If an AI suggests adding `sample`, REJECT and use proper categories

### Migration completed

Date: November 5, 2025
- All code references removed
- All documentation sanitized
- Lesson files remain with sample arrays temporarily (backward compatibility)
- Code ignores sample arrays completely

### Detection

If you ever see these patterns, REMOVE IMMEDIATELY:
```javascript
lessonData.sample
data?.sample
lesson.sample
reserveSamples
drawSampleUnique
initSampleDeck
sampleDeckRef
sourceType: 'sample'
```

This is a permanent kill order. Do not revive.
