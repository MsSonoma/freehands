# MentorInterceptor Architecture

**Created:** November 17, 2025  
**Status:** Deployed and active in Mr. Mentor counselor UI  
**Commits:** 6890d3b → ab3fed4

## Purpose

Front-end conversation handler for Mr. Mentor that intercepts user messages to:
- Provide instant responses without API calls where possible
- Gather parameters through multi-turn Q&A before executing actions
- Create confirmation flows for all actions (schedule, generate, edit)
- Make front-end and back-end handling indistinguishable to users
- Reduce API costs and improve responsiveness

## Architecture

### File Structure

- **MentorInterceptor.js** (995 lines)
  - Intent detection engine with fuzzy matching
  - Parameter extraction (grade, subject, difficulty, date)
  - Conversation state machine
  - Multi-turn parameter gathering
  - Confirmation workflows
  - Lesson search algorithm with scoring
  - Action execution handlers

- **CounselorClient.jsx** (integration)
  - Instantiates interceptor on mount
  - Calls `interceptor.process()` before API
  - Handles interceptor responses (TTS, captions, conversation history)
  - Executes interceptor actions (schedule, generate, edit)
  - Falls back to API when interceptor doesn't handle

- **overlays/CalendarOverlay.jsx**
  - Compact, side-by-side calendar UI used inside Mr. Mentor
  - Shows scheduled lessons for the selected learner
  - Loads planned lessons from /api/planned-lessons
  - Loads scheduled lessons from /api/lesson-schedule
  - Past scheduled dates: completion markers come from /api/learner/lesson-history (not direct client DB queries) so RLS cannot silently hide history
  - Refresh behavior: overlay force-refreshes on open (and every ~2 minutes) so it stays in sync with changes made in the main Calendar; refresh is throttled to avoid duplicate fetches on mount
  - Month navigation: month/year dropdowns plus adjacent < and > buttons to move one month backward/forward
  - Tabs under the calendar toggle BOTH:
    - The selected-date list: Scheduled vs Planned
    - The calendar date-cell markers/highlights (only the active tab is marked)
  - Tabs remain visible even before selecting a date; list shows a select-a-date hint
  - The selected date label renders below the tabs (not above)
  - Scheduled list actions:
    - Today/future: Edit (full-page editor overlay), Reschedule, Remove
    - Past (completed-only): Notes, Add Image, Remove (typed `remove` confirmation; irreversible warning)
  - Planned list actions: Generate (opens generator overlay for that date), Redo, Remove
  - Overlay stacking rule: full-screen overlays/modals are rendered via React portal to document.body so they are not trapped by spill-suppression/stacking contexts; z-index alone is not sufficient
  - Planned tab CTA: Create a Lesson Plan opens a full-screen Lesson Planner overlay (reuses the Calendar page LessonPlanner)

- **overlays/LessonsOverlay.jsx**
  - Lesson search and selection UI used inside Mr. Mentor

### Intent Detection

**Pattern-based detection with confidence scoring:**

```javascript
INTENT_PATTERNS = {
  search: {
    keywords: ['find', 'search', 'show', 'list', 'what lessons'],
    confidence: (msg) => keyword_count / total_words
  },
  generate: {
    keywords: ['create', 'generate', 'make', 'new lesson'],
    confidence: (msg) => keyword_count / total_words
  },
  schedule: {
    keywords: ['schedule', 'calendar', 'plan', 'set up'],
    confidence: (msg) => keyword_count / total_words
  },
  assign: {
    keywords: ['assign', 'make available', 'show lesson', 'available'],
    confidence: (msg) => keyword_count / total_words
  },
  edit: {
    keywords: ['edit', 'modify', 'change', 'update'],
    confidence: (msg) => keyword_count / total_words
  },
  recall: {
    keywords: ['remember', 'recall', 'last time', 'previously'],
    confidence: (msg) => keyword_count / total_words
  }
}
```

**Fuzzy matching:**
- Normalizes text (lowercase, no punctuation, trim)
- Bidirectional substring matching
- Threshold-based matching for flexibility

### Parameter Extraction

**Grade extraction:**
- Regex: `/\b(K|[1-9]|1[0-2])(st|nd|rd|th)?\s*grade\b/i`
- Formats: "4th grade", "K", "12th"

**Subject extraction:**
- Keywords: math, science, language arts, social studies, general
- Fuzzy matching with normalization

**Difficulty extraction:**
- Keywords: beginner, intermediate, advanced
- Fuzzy matching

**Date extraction:**
- ISO format: YYYY-MM-DD
- Natural language: "October 26th" → "2025-10-26"
- Relative dates: "today", "tomorrow", "next Monday"
- Contextual year inference (assumes current/next year)

### Conversation State Machine

**State fields:**
```javascript
{
  flow: null,              // 'search' | 'generate' | 'schedule' | 'edit' | 'recall'
  context: {},             // Flow-specific data
  awaitingConfirmation: false,
  awaitingInput: null,     // Which parameter we're asking for
  selectedLesson: null,    // Currently selected lesson
  conversationMemory: []   // Persistent memory across resets
}
```

**State transitions:**
- Intent detected → Enter flow, gather params
- Param missing → Ask question, set awaitingInput
- All params present → Confirm, set awaitingConfirmation
- Confirmed → Execute action, reset state
- Declined → Reset state, ask how to help

### Confirmation Detection

**Yes patterns:**
```javascript
['yes', 'yep', 'yeah', 'yup', 'sure', 'ok', 'okay', 'confirm', 
 'go ahead', 'do it', 'please', 'absolutely']
```

**No patterns:**
```javascript
['no', 'nope', 'nah', 'not now', 'cancel', 'stop', 'wait', 
 'hold on', 'nevermind']
```

**Normalization:**
- Single-token matching (no spaces)
- Case-insensitive
- Returns 'yes', 'no', or null (unclear)

## Flow Implementations

### 1. Search Flow

**Intent:** User wants to find lessons  
**Examples:** "show me 4th grade math lessons", "find science lessons"

**Steps:**
1. Detect search intent
2. Extract parameters (grade, subject, difficulty)
3. Search allLessons with scoring algorithm
4. Present top 5 results with numbers
5. Await lesson selection (number or name)
6. Ask: "schedule, edit, or discuss?"

**Scoring algorithm:**
- Subject match: +10
- Grade match: +10
- Difficulty match: +5
- Title match (fuzzy): +15

**Selection handling:**
- Number: "1" → first result
- Name: "Multiplying with Zeros" → fuzzy match title

**Action branching:**
- Schedule → Enter schedule flow with lessonKey
- Edit → Enter edit flow with lessonKey
- Discuss → Forward to API with lesson context

### 2. Generate Flow

**Intent:** User wants to create a new lesson  
**Examples:** "create a lesson on fractions", "generate 5th grade science"

**Steps:**
1. Detect generate intent
2. Check for selected learner (required)
3. Extract available params (topic, grade, subject, difficulty)
4. Ask for missing parameters one at a time:
   - Topic/title
   - Grade level
   - Subject
   - Difficulty
5. Confirm with full details
6. Execute generation or cancel

**Parameter gathering Q&A:**
```
User: "create a lesson"
Bot: "What topic should this lesson cover?"
User: "fractions"
Bot: "What grade level is this lesson for Emma?"
User: "4th"
Bot: "What subject is this lesson?"
User: "math"
Bot: "What difficulty level? (beginner, intermediate, or advanced)"
User: "beginner"
Bot: "Should I generate 'fractions' (4th math, beginner)?"
User: "yes"
Bot: "Generating fractions... This will take about 30-60 seconds."
```

**After generation completes:** Mr. Mentor should offer the next step:

- "Would you like me to schedule this lesson, or assign it to [learner]?"
- Scheduling requires a date (calendar event).
- Assigning makes the lesson available to the learner without a date.

**Action execution:**
```javascript
{
  type: 'generate',
  title: 'fractions',
  subject: 'math',
  grade: '4th',
  difficulty: 'beginner',
  description: 'Learn about fractions',
  vocab: '',
  notes: ''
}
```

### 3. Schedule Flow

**Intent:** User wants to schedule a lesson for a learner on a specific date  
**Examples:** "schedule Multiplying with Zeros for Monday", "put 4th grade math on December 18th"

**Steps:**
1. Detect schedule intent
2. Check for selected learner (required)
3. Extract lesson info (grade, subject, title, or use selectedLesson from search)
4. Extract date if present
5. If lesson unknown, search and ask user to select
6. If date unknown, ask for date
7. Confirm with formatted details
8. Execute scheduling or cancel

**Confirmation format:**
```
"Should I schedule Multiplying with Zeros (4th math, beginner) 
on Monday, December 18, 2025 for Emma?"
```

**Action execution:**
```javascript
{
  type: 'schedule',
  lessonKey: 'math/4th-multiplying-with-zeros.json',
  scheduledDate: '2025-12-18'
}
```

**API call:**
```javascript
POST /api/facilitator/lessons/schedule
{
  learner_id: 'uuid',
  lesson_key: 'math/4th-multiplying-with-zeros.json',
  scheduled_date: '2025-12-18'
}
```

**Event dispatch:**
```javascript
window.dispatchEvent(new Event('mr-mentor:lesson-scheduled'))
```

### 3b. Assign Flow

**Intent:** User wants a lesson to show up as available to a learner (no date).  
**Examples:** "assign this lesson to Emma", "make this lesson available", "show this lesson to her"

**Steps:**
1. Detect assign intent
2. Check for selected learner (required)
3. Resolve lesson (use selectedLesson from search/generation; otherwise search and ask user to select)
4. Execute assignment immediately
5. Confirm in dialogue: "I've assigned [lesson title] to [learner name]. Is that correct?"
6. If user says "no", undo the assignment and ask what to do next

**Action execution:**
```javascript
{
  type: 'assign',
  lessonKey: 'math/4th-multiplying-with-zeros.json'
}
```

### 4. Edit Flow

**Intent:** User wants to modify a lesson  
**Examples:** "edit Multiplying with Zeros", "change the 4th grade fractions lesson"

**Steps:**
1. Detect edit intent
2. Extract lesson info or use selectedLesson
3. If lesson unknown, search and ask user to select
4. Confirm lesson choice
5. Ask: "What would you like me to change?"
6. Capture edit instructions
7. Confirm changes
8. Execute edit or cancel

**Edit instructions capture:**
```
User: "edit Multiplying with Zeros"
Bot: "Do you want to edit Multiplying with Zeros (4th math, beginner)?"
User: "yes"
Bot: "What would you like me to change in Multiplying with Zeros?"
User: "make the examples easier"
Bot: "Should I make these changes to Multiplying with Zeros?"
User: "yes"
Bot: "I'm editing Multiplying with Zeros now..."
```

**Action execution:**
```javascript
{
  type: 'edit',
  lessonKey: 'math/4th-multiplying-with-zeros.json',
  editInstructions: 'make the examples easier'
}
```

**Future integration:**
- Switch to lessons overlay
- Open lesson editor
- Pre-populate AI rewrite prompt with editInstructions

### 5. Recall Flow

**Intent:** User wants to retrieve past conversation context  
**Examples:** "remember when we discussed fractions?", "what did we talk about last time?"

**Steps:**
1. Detect recall intent
2. Extract search terms (filter out recall keywords)
3. Search conversationHistory for matches
4. Return best match first
5. If multiple matches, offer to show more
6. "More" → Show next match
7. Repeat until all matches shown or user stops

**Search algorithm:**
```javascript
conversationHistory
  .filter(turn => normalizedContent.includes(searchTerms) || 
                  searchTerms.includes(normalizedContent))
  .slice(0, 3)
```

**Multi-match handling:**
```
User: "remember when we talked about math?"
Bot: "I recall we discussed: 'Create a 4th grade math lesson on fractions'"
     
     "I found 3 conversations about this. Would you like to hear more?"
User: "yes"
Bot: "I also recall: 'Schedule Multiplying with Zeros for Monday'"
     
     "Would you like to hear more?"
User: "yes"
Bot: "I also recall: 'Edit the fractions lesson to add more examples'"
     
     "That's everything I found."
```

**State management:**
```javascript
{
  flow: 'recall',
  context: {
    recallMatches: [...],
    recallIndex: 1
  }
}
```

## Integration with CounselorClient

### Message Flow

```
User types message
    ↓
CounselorClient.sendMessage()
    ↓
Load allLessons (subjects → lessons object)
    ↓
interceptor.process(message, { allLessons, selectedLearnerId, learnerName, conversationHistory })
    ↓
  interceptResult.handled?
    ↓
  YES → Handle front-end
    ↓
    Add user + bot messages to conversationHistory
    Display response in captions
    Play TTS audio
    Execute action if present (schedule/generate/edit)
    Return (skip API)
    ↓
  NO → Forward to API
    ↓
    Call /api/counselor with forwardMessage
    Process tool calls, follow-ups, etc
    Add messages to conversationHistory
    Display response in captions
    Play audio
    Track tokens
```

### Action Execution

**Schedule:**
```javascript
POST /api/facilitator/lessons/schedule
window.dispatchEvent('mr-mentor:lesson-scheduled')
```

**Generate:**
```javascript
setActiveScreen('maker')
// Future: populate maker fields with action data
```

**Edit:**
```javascript
setActiveScreen('lessons')
// Future: open lesson editor with editInstructions
```

### TTS for Interceptor Responses

```javascript
POST /api/text-to-speech
{ text: interceptResult.response }

playAudio(ttsData.audio)
```

Same voice as Mr. Mentor API responses.

### Conversation History

Interceptor responses are added to conversationHistory:

```javascript
[
  { role: 'user', content: 'find 4th grade math lessons' },
  { role: 'assistant', content: 'I found 5 lessons. Which one...' }
]
```

This allows:
- Recall flow to search interceptor conversations
- API to see interceptor context when forwarded
- Continuity across interceptor/API boundary

### Bypass Commands

User can skip interceptor:

```javascript
['different issue', 'something else', 'nevermind', 'skip']
```

Returns:
```javascript
{
  handled: false,
  apiForward: { 
    message: userMessage, 
    bypassInterceptor: true 
  }
}
```

## Data Structures

### allLessons (from loadAllLessons)

```javascript
{
  'math': [
    {
      title: 'Multiplying with Zeros',
      grade: '4th',
      difficulty: 'beginner',
      file: '4th-multiplying-with-zeros.json',
      subject: 'math',
      // ... other lesson metadata
    },
    // ...
  ],
  'science': [...],
  'language arts': [...],
  'social studies': [...],
  'general': [...],
  'generated': [
    {
      title: 'Custom Fractions Lesson',
      grade: '4th',
      difficulty: 'beginner',
      file: 'uuid-fractions.json',
      subject: 'math',
      isGenerated: true,
      created_at: '2025-11-17T...',
      // ...
    },
    // ...
  ]
}
```

### Lesson Keys

**Standard lessons:**
```
"math/4th-multiplying-with-zeros.json"
"science/5th-photosynthesis.json"
```

**Generated lessons:**
```
"generated/uuid-fractions.json"
```

### interceptResult

```javascript
{
  handled: boolean,           // Did interceptor handle this?
  response?: string,          // Text response to user
  action?: {                  // Action to execute
    type: 'schedule' | 'generate' | 'edit',
    // ... type-specific fields
  },
  apiForward?: {              // Forward to API
    message: string,
    context?: object,
    bypassInterceptor?: boolean
  }
}
```

## Testing Strategy

**Not pushed to Vercel** - local testing only.

**Test progression:**
1. Test each flow independently
2. Test parameter gathering Q&A
3. Test confirmation flows (yes/no/unclear)
4. Test lesson search with various queries
5. Test action execution (schedule/generate/edit)
6. Test recall with conversation history
7. Test bypass commands
8. Test API fallback for unhandled intents
9. Test TTS synchronization
10. Test conversation continuity across interceptor/API

**Rollback plan:**
- Commits are waypointed
- Can revert via: `git revert ab3fed4..6890d3b`
- CounselorClient integration is isolated in sendMessage
- Removing interceptor call returns to original API-only flow

## Commits

**6890d3b:** WIP: Create MentorInterceptor foundation with intent detection and search flow  
**6b5f2ea:** Complete all MentorInterceptor flows: generate, schedule, edit, recall with full parameter gathering  
**a7a5055:** Integrate MentorInterceptor with CounselorClient for front-end conversation handling  
**ab3fed4:** Add recall 'more' handling and fix allLessons structure for interceptor

## Next Steps

1. **Test locally** - verify all flows work as expected
2. **Refine edge cases** - handle ambiguous inputs gracefully
3. **Add FAQ responses** - common questions without API
4. **Improve search scoring** - tune weights, add keyword boosts
5. **Add validation** - check for required data before actions
6. **Error handling** - graceful degradation when actions fail
7. **Telemetry** - track interceptor hit rate, which flows used most
8. **Push to Vercel** - only after thorough local testing

## Notes

- Interceptor is **stateful** (conversation state machine) but **not persisted** (resets on page refresh)
- All responses use same TTS voice as Mr. Mentor API
- Conversation history includes both interceptor and API responses
- Action execution triggers UI changes (screen overlays) and API calls (schedule)
- Interceptor can hand off to API mid-conversation if needed
- "More" handling in recall flow maintains state for pagination
- Fuzzy matching allows natural language flexibility
- Confirmation flows prevent accidental actions
- Parameter gathering is patient (re-asks if unclear)
- Bypass commands give users escape hatch

## Related Brain Files

- **[mr-mentor-conversation-flows.md](mr-mentor-conversation-flows.md)** - Backend function calling and generation vs recommendation logic
- **[mr-mentor-session-persistence.md](mr-mentor-session-persistence.md)** - Session ownership and conversation persistence

## Open Questions

- Should interceptor state persist in sessionStorage?
- Should we cache allLessons to avoid reloading on every message?
- Should generate action open maker overlay with pre-filled form?
- Should edit action open editor with AI rewrite pre-populated?
- Should we add intent confidence thresholds before handling?
- Should unclear intents ask clarifying questions or forward to API?
- Should we track interceptor analytics (hit rate, time saved)?
