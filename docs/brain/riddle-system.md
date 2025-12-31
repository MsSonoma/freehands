# Riddle System Architecture

**Status**: Implemented but **NOT integrated** into teaching flow  
**Last Updated**: 2025-12-03  
**Key Files**: `src/app/lib/riddles.js`

---

## How It Works

### Storage Model
Riddles are **hardcoded** in `src/app/lib/riddles.js` as a static export. Not generated via AI, not pulled from database, not loaded from JSON. This is intentional for:
- **Performance**: No API calls or database queries
- **Consistency**: Same riddles always available offline
- **Control**: Curated content, not AI-generated randomness

### Riddle Structure
```javascript
{
  id: string,              // 'math-01', 'sci-15', etc.
  subject: string,         // 'math' | 'science' | 'language arts' | 'social studies' | 'general'
  lines: string[],         // 1-4 riddle lines (delivered with pauses)
  pausesMs: number[],      // Pause after each line (0 = no pause)
  answer: string           // Expected answer (lowercase, spaces allowed)
}
```

### Selection Algorithm
`pickNextRiddle(subject)` uses **localStorage rotation**:
1. Check localStorage for last riddle index for this subject
2. Increment index (wrap to 0 at end)
3. Return riddle at new index
4. Store index for next call

This ensures kids get **different riddles each time** without server-side state.

### Design Philosophy (December 2025 Transformation)

**Before**: 60% of riddles were quiz questions  
**After**: All riddles use wordplay, metaphor, or lateral thinking

#### True Riddle Characteristics
- **Misdirection**: Leads thinking one way, answer is another
- **Wordplay**: Puns, double meanings, homonyms, visual tricks
- **Surprise**: "Aha!" moment when solved
- **Fair Clues**: Solvable with lateral thinking (not pure recall)

#### Transformation Patterns Applied

**Math**: Number homophones (eight/ate), visual tricks (8 cut in half = 0), counting stories  
**Science**: Personification (fire grows, shadow follows), physical metaphors (heart = four rooms)  
**Language Arts**: Spelling tricks (short/shorter), grammar wordplay (verb = DO word)  
**Social Studies**: Geography puns (river has mouth/bed), historical wordplay (Washington = president + city)  
**General**: Classic lateral riddles (What gets wetter as it dries? = towel)

---

## What NOT To Do

### ❌ Don't Generate Riddles via AI
The system is **intentionally static**. Adding AI generation would:
- Create quality inconsistencies
- Risk inappropriate content slipping through
- Add latency and API costs
- Break offline functionality

### ❌ Don't Use Riddles as Comprehension Tests
Riddles are **warm-up fun**, not assessment. They:
- Have single answers (not open-ended)
- Reward lateral thinking (not lesson content mastery)
- Are optional enrichment (not required learning)

### ❌ Don't Add Riddles Without Validation
Every riddle must pass the checklist:
- [ ] Wordplay or misdirection present
- [ ] Single clear answer (no ambiguity)
- [ ] Age-appropriate (6-12 year olds)
- [ ] Subject-relevant (if not in 'general')
- [ ] Fair clues (solvable without guessing)
- [ ] Surprise factor (smile, groan, or "aha!")

### ❌ Don't Mix Quiz Questions into Riddles
**Bad**: "How many cents are in a quarter?" (factual recall)  
**Good**: "I am a coin that is one fourth of a dollar, but I hold much more inside - count them all! How many pennies hide in me?" (wordplay + math)

---

## Current Integration Status

### ⚠️ Riddles Are NOT Used
Despite full implementation, riddles are **orphaned code**:
- `riddles.js` exists and exports 200 riddles (40 per subject)
- `pickNextRiddle()` is imported in teaching files but **never called**
- Opening phase uses greeting + encouragement + menu (no joke, no riddle)
- No API endpoints for riddle delivery
- No UI components for riddle display/answer validation

### Historical Context
The old teaching system brain file mentioned **jokes** in the opening flow, not riddles. Riddles were prepared as a feature but never integrated into the live session flow.

### Future Integration Options
If riddles are to be activated:
1. **Replace jokes in opening** - Use riddles as warm-up instead of jokes
2. **Add to menu** - "Wanna hear a riddle?" as optional pre-lesson activity
3. **Comprehension rewards** - Unlock riddle after completing comprehension question
4. **Subject alignment** - Only show riddles matching current lesson subject

---

## Riddle Transformation Guidelines

### Quality Classification

**✓ True Riddles (20% - Keep & Polish)**
- Use wordplay, misdirection, puns, lateral thinking
- Examples: gen-08 (joke), lang-01 (short), lang-03 (incorrectly), math-01 (seven)

**⚠ Educational Questions (60% - Transform)**
- Direct subject queries lacking riddle qualities
- Examples: math-19 (How many cents...), sci-29 (organ that pumps blood), lang-19 (What type of word...)

**❌ Broken/Duplicates (20% - Delete or Fix)**
- Multiple valid answers, subject mismatches, duplicates
- Examples: gen-13 & gen-30 (piano duplicate), sci-02 & gen-26 (umbrella mismatch)

### Transformation Patterns

**Pattern 1: Personification**  
*Before*: "What is the organ that pumps blood?" (quiz question)  
*After*: "I have four rooms but no doors. I beat all day but I'm not a drum. What am I?" (heart - riddle)

**Pattern 2: Homonym/Wordplay**  
*Before*: "What do you call a six sided shape?" (definition)  
*After*: "I have six sides but I'm not a cube. Bees make my shape when they work. What am I?" (hexagon - connects to honeycomb)

**Pattern 3: Visual Metaphor**  
*Before*: "How many degrees in a right angle?" (fact recall)  
*After*: "I'm the corner of a square, standing up straight and tall. If you measure me, I'm perfect for making walls. What am I?" (right angle/90 degrees)

**Pattern 4: Action Pun**  
*Before*: "What type of word describes an action?" (grammar term)  
*After*: "I'm a word that likes to DO things. Run, jump, and think are my friends. What part of speech am I?" (verb - emphasis on action)

**Pattern 5: Double Meaning**  
*Before*: "What is the smallest two digit number?" (arithmetic)  
*After*: "I'm twice as much as five, but also where your fingers begin to count. What number am I?" (ten - wordplay on digits)

### Subject-Specific Guidelines

**Math Riddles**: Use number homophones (one/won, eight/ate), shape metaphors (circle = wheel), counting puns (dozen), visual tricks (six upside down = nine)

**Science Riddles**: Physical properties as personality (fire grows, water runs), natural phenomena metaphors (cloud cries), scientific processes as stories (photosynthesis = cooking)

**Language Arts Riddles**: Spelling tricks (incorrectly, short), grammar puns (verb = DO word), literary double meanings (book spine), sound-alike confusion

**Social Studies Riddles**: Geography puns (river mouth/bed), historical wordplay (liberty = freedom), place name tricks (Mississippi has four i's), civic metaphors (trade = exchange)

### Validation Checklist

Before accepting a transformed riddle:

- [ ] **Wordplay present** - Uses pun, double meaning, metaphor, or lateral thinking
- [ ] **Misdirection works** - Initial interpretation differs from answer
- [ ] **Single clear answer** - No ambiguity or multiple solutions
- [ ] **Age appropriate** - 6-12 year olds can understand clues
- [ ] **Subject relevant** - Connects to subject concept
- [ ] **Fair clues** - Enough information to solve without guessing
- [ ] **Surprise factor** - Makes you smile, groan, or say "aha!"
- [ ] **Not a quiz question** - Requires lateral thinking, not just recall

---

## Key Files

### `src/app/lib/riddles.js`
- Exports `riddlesBySubject` (200 riddles total, 40 per category)
- Exports `pickNextRiddle(subject)` - localStorage-based rotation
- Exports `renderRiddle(riddle)` - joins lines with `\n\n` for speech
- Exports `getRiddlesForSubject(subject)` - returns array for category

### Dead Imports (Not Currently Used)
- `src/app/session/[sessionId]/page.js` - imports but never calls
- Teaching system components - no riddle UI elements

---

## Design Decisions

### Why Hardcoded?
- **Performance**: Zero latency, works offline
- **Quality Control**: Curated by humans, tested for age-appropriateness
- **Simplicity**: No database schema, no API, no cache invalidation

### Why localStorage Rotation?
- **Stateless**: No server-side session tracking needed
- **Fair**: Kids see all riddles eventually, not just favorites
- **Simple**: One line of code, no edge cases

### Why Subject Categories?
- **Alignment**: Can match riddles to lesson subject
- **Variety**: Prevents repetition within subject area
- **Flexibility**: 'general' category for cross-subject riddles

---

**Remember**: Riddles are playful mysteries, not educational quizzes. Every riddle should make you smile, groan, or go "aha!" - not just "oh, I knew that fact."
