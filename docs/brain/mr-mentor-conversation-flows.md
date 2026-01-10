# Mr. Mentor Conversation Flows

**Last Updated:** 2025-12-18  
**Status:** Canonical  
**Systems:** Conversation decision logic, lesson generation vs recommendations, escape hatches, function calling triggers

---

## How It Works

### Frontend Confirmation Gate

- Every counselor request sets `require_generation_confirmation: true`.
- If GPT tries to call `generate_lesson`, the API now returns a confirmation prompt instead of executing.
- The frontend marks `pendingConfirmationTool = 'generate_lesson'` and asks the user.
- If the user declines, the next request disables `generate_lesson` (`disableTools: ['generate_lesson']`) and appends a decline note to the user message: "(User declined generation. Respond by providing assistance with the user's problem.)" so GPT assists instead of forcing generation.
- If the user confirms, the next request sets `generation_confirmed: true` and allows the tool call.

### Recommendations vs Generation Decision Logic

Mr. Mentor must distinguish between two fundamentally different user intents:

1. **Seeking Recommendations/Advice** - User wants suggestions from existing lessons
2. **Requesting Generation** - User wants to create a new custom lesson

#### Recognition Patterns

**Recommendation Intent (DO NOT trigger generation):**
- "Do you have suggestions?"
- "What do you recommend?"
- "Any ideas for lessons?"
- "Give me advice"
- "What lessons are good for X?"
- "Do you have lessons on X?"
- Mentioning a topic without imperative verbs

**Generation Intent (ONLY time to trigger generation):**
- "Create a lesson about X"
- "Generate a lesson for X"
- "Make me a lesson on X"
- Explicit imperative verbs requesting creation

#### Response Flow

```
User mentions topic or ambiguous intent
  |
  v
Is this CLEARLY a generation request? (explicit imperative verbs?)
  |
  +--NO--> Is intent unclear?
  |          |
  |          +--YES--> ASK: "Would you like me to generate a custom 
  |          |               lesson or search existing lessons?"
  |          |          |
  |          |          +--"generate"/"create"/"yes"--> Start parameter collection
  |          |          |
  |          |          +--"no"/"search"/"recommend"--> SEARCH existing lessons
  |          |
  |          +--NO (clearly wants recommendations)--> SEARCH existing lessons
  |                    |
  |                    v
  |                  Recommend top results
  |                    |
  |                    v
  |                  Offer to generate IF nothing suitable
  |
  +--YES--> Start generation parameter collection
             |
             v
           Collect: grade, subject, difficulty, title, description
  Two-Layer Protection:**

#### Layer 1: Confirmation Before Parameter Collection (Primary Defense)
When intent is ambiguous, Mr. Mentor should ASK before starting parameter collection:

**Question:** "Would you like me to generate a custom lesson?"

**Only proceed with generation if user confirms:**
- "yes, generate"
- "create one"
- "make a lesson"
- Clear affirmative for generation

**Switch to search/recommend if user says:**
- "no"
- "search"
- "recommend"
- "I'm not sure"
- "show me what you have"
- Anything other than clear generation confirmation

**Why This Works:** Prevents awkward parameter collection when user just wanted recommendations. Gives user explicit choice before committing to generation flow.

#### Layer 2: Escape During Parameter Collection (Backup Defense)

**           |
             v
           Call generate_lesson function
```

---

### Escape Hatch Mechanism

**Problem:** Once parameter collection begins, GPT-4o function calling wants to complete required parameters before executing function. This creates a "locked in" experience where user can't back out.

**Solution:** Explicit escape instructions in system prompt:

```
If user says during parameter collection:
- "stop"
- "no"
- "I don't want to generate"
- "give me advice instead"
- "I don't want you to generate the lesson"
Skip Confirmation When Intent Is Ambiguous
```
User: "I need a language arts lesson but I don't want one of the ones we have in 
       the library. It should have a Christmas theme, please make some recommendations."

WRONG: "Is this lesson for Emma's grade (4)?"
RIGHT: "Would you like me to generate a custom lesson?"
       (If they say no: "Let me search for Christmas-themed language arts lessons...")
```

### ❌ DON'T 
Then: ABANDON generation flow immediately
- Stop asking for parameters
- Switch to recommendation mode
- Search existing lessons and suggest them
```

**Implementation:** OpenAI model reads these signals and produces conversational response instead of continuing function call.

---

### Function Calling Triggers

#### `search_lessons` - Always Available
- When user asks about lessons on a topic
- When user mentions a subject area
- Before considering generation
- Default action for lesson-related queries

#### `generate_lesson` - Highly Restricted
- ONLY when explicit imperative generation language detected
- ONLY after searching doesn't find suitable match
- NEVER for "suggestions", "recommendations", "ideas", "advice"
- Must honor escape signals if user backs out

#### `schedule_lesson` - Immediate Action
- When user says "schedule this", "add to calendar", "put it on Monday"
- Must ALWAYS call function (never confirm without actually calling)
- Requires lessonKey from prior search/generation

#### `assign_lesson` - Immediate Action
- When user says "assign this lesson", "make it available", "show this lesson to [learner]"
- This is NOT scheduling. It updates learner availability (approved lessons) without picking a date.
- Must ALWAYS call function (never confirm assignment without actually calling)
- Requires lessonKey from prior search/generation

### Post-Lesson Next Step (Schedule vs Assign)

When Mr. Mentor has identified a specific lesson (from search or generation) and the facilitator has a learner selected, he should offer both options:

- Ask: "Would you like me to schedule this lesson, or assign it to [learner]?"
- Judge the response:
       - If they clearly want scheduling, proceed with `schedule_lesson` (and collect a date if needed)
       - If they clearly want assignment/availability, proceed with `assign_lesson`

After completing `assign_lesson`, Mr. Mentor must confirm in dialogue:

- "I've assigned [lesson title] to [learner name]. Is that correct?"

---

## What NOT To Do

### ❌ DON'T Skip Confirmation When Intent Is Ambiguous
```
User: "I need a language arts lesson but I don't want one of the ones we have in 
       the library. It should have a Christmas theme, please make some recommendations."

WRONG: "Is this lesson for Emma's grade (4)?"
RIGHT: "Would you like me to generate a custom lesson?"
       (If they say no: "Let me search for Christmas-themed language arts lessons...")
```

### ❌ DON'T Trigger Generation on Advice-Seeking Language
```
User: "Emma has one more Language Arts lesson and then it's Christmas vacation. 
       Do you have any suggestions?"

WRONG: Start asking for grade, subject, difficulty
RIGHT: Search language arts lessons, recommend Christmas-themed options
```

### ❌ DON'T Lock Users Into Parameter Collection
```
User: "4th grade Language Arts"
Mr. Mentor: "What difficulty level?"
User: "I don't know that yet. Stop trying to generate the lesson and give me advice."
Mr. Mentor: "Please choose: beginner, intermediate, or advanced."

WRONG: Continue asking for required parameters
RIGHT: "Of course! Let me search for 4th grade Language Arts lessons instead..."
```

### ❌ DON'T Confuse Topic Mention with Generation Request
```
User: "I need something Christmas-themed"

WRONG: Interpret as "generate a Christmas lesson"
RIGHT: Interpret as "search for Christmas-themed lessons"
```

### ❌ DON'T Assume Grade from Context Unless Explicit
```
User: "I want you to recommend them to be generated."
Mr. Mentor: "Is this lesson for Emma's grade (4)?"

WRONG: Assume user wants generation just because they said "generated"
RIGHT: Clarify intent first - "Would you like me to search for existing lessons 
       or help you create a new one?"
```

---

## Key Files

### System Prompt
- **File:** `src/app/api/counselor/route.js`
- **Constant:** `MENTOR_SYSTEM_PROMPT`
- **Key Sections:**
  - `CRITICAL DISTINCTION - Recommendations vs Generation`
  - Tool descriptions for `GENERATE_LESSON`, `SEARCH_LESSONS`
  - Escape hatch instructions

### Function Schemas
- **File:** `src/app/api/counselor/route.js`
- **Location:** OpenAI tools array in POST handler
- **Functions:**
  - `search_lessons` - Broad, always available
  - `generate_lesson` - Restricted, escape-aware
  - `schedule_lesson` - Action-immediate
       - `assign_lesson` - Make lesson available to learner (action-immediate)

### Capabilities Info
- **File:** `src/app/api/counselor/route.js`
- **Function:** `getCapabilitiesInfo()`
- **Provides:** Detailed guidance on when to use each function

---

## Edge Cases

### User Says "Recommend Them to Be Generated"
This is confusing language mixing "recommend" (advice) with "generated" (creation).

**Interpretation Priority:**
1. Dominant verb: "recommend" → advice mode
2. Context: "Do you have suggestions?" preceded this → advice mode
3. Action: Search and recommend, don't generate

### User Says "Stop" During Parameter Collection
Even if function calling started, model can produce conversational response abandoning the call.

**Expected Behavior:**
- Model reads escape signal in system prompt
- Produces text response instead of function call
- Response acknowledges user's preference: "Of course! Let me search instead..."

### User Asks for "Christmas Themed" Without Learner Selected
**Correct Flow:**
1. Search for Christmas-themed lessons across grades
2. Present options
3. Offer to narrow by grade OR generate if nothing suitable
4. DO NOT assume generation is wanted

---

## Testing Scenarios

### Scenario 1: Ambiguous Generation Language
```
User: "Emma needs one more lesson and then Christmas vacation. Suggestions?"
Expected: Search, recommend Christmas-themed language arts, ask questions
Actual (before fix): Started asking for grade, subject, difficulty
```

### Scenario 2: Escape During Collection
```
User: "Generate a 4th grade math lesson"
Mr. Mentor: "What difficulty?"
User: "Stop. I don't want to generate. Give me advice."
Expected: "Let me search for 4th grade math lessons instead..."
Actual (before fix): Continued asking "Please choose: beginner, intermediate..."
```

### Scenario 3: Recommendation After Search
```
User: "Do you have lessons on fractions?"
Mr. Mentor: [searches, finds 5 lessons]
Mr. Mentor: "I found 5 fraction lessons. Here are the top 3..."
Expected: Offer to generate ONLY if search yields poor results
```

---

## Multi-Screen Overlay System

The Mr. Mentor interface includes a multi-screen overlay system allowing users to switch between video and different tool views without leaving the counselor page.

### Screen Toggle Buttons
Located on same row as "Discussing learner" dropdown, five buttons for switching views:
- **👨‍🏫 Mr. Mentor**: Default video view
- **📚 Lessons**: Facilitator lessons list (scrollable)
- **📅 Calendar**: Lesson calendar panel
- **✨ Generated**: Generated lessons list (scrollable)
- **🎨 Maker**: Lesson creation form

### Overlay Components

All overlay components fit in video screen area, match half-screen format:

**CalendarOverlay** (`overlays/CalendarOverlay.jsx`)
- Shows only calendar panel (not scheduling panel)
- Learner selector at top
- Month/year navigation
- Visual indicators for scheduled lessons
- Shows scheduled lessons for selected date

**LessonsOverlay** (`overlays/LessonsOverlay.jsx`)
- Learner selector
- Subject-based expandable sections
- Grade filters per subject
- Shows approved lessons, medals, progress
- Fully scrollable list

**GeneratedLessonsOverlay** (`overlays/GeneratedLessonsOverlay.jsx`)
- Subject and grade filters
- Status indicators (approved, needs update)
- Scrollable lesson list
- Color-coded by status

**LessonMakerOverlay** (`overlays/LessonMakerOverlay.jsx`)
- Compact lesson generation form
- Quota display
- All fields from full lesson maker
- Inline success/error messages
- Scrollable form

### State Management
- `activeScreen` state tracks currently displayed view
- Default is 'mentor' (video view)
- Screen state independent of conversation state
- All overlays receive necessary props (learnerId, learners, tier, etc.)

### Visual Design
- Buttons use emoji icons for quick recognition
- Active button has blue border and light blue background
- Inactive buttons have gray border and white background
- All overlays use consistent styling with gradient headers
- Fully responsive and scrollable

### File Structure
```
src/app/facilitator/tools/counselor/
├── CounselorClient.jsx (main component - updated)
├── ClipboardOverlay.jsx (existing)
└── overlays/
    ├── CalendarOverlay.jsx
    ├── LessonsOverlay.jsx
    ├── GeneratedLessonsOverlay.jsx
    └── LessonMakerOverlay.jsx
```

### Usage
1. **Viewing Different Screens**: Click emoji buttons to switch views
2. **Learner Selection**: Available in most overlays; syncs with main dropdown
3. **Returning to Video**: Click 👨‍🏫 button to return to Mr. Mentor video

### Props Flow
- `learners` array passed from parent to overlays
- `selectedLearnerId` synced across all components
- `tier` passed to LessonMaker for quota checks
- All overlays handle their own data fetching

### Responsive Behavior
- Overlays fill entire video panel area
- Scrollable content areas for long lists
- Compact headers to maximize content space
- Works in both portrait and landscape modes

---

## Related Brain Files

- **[mr-mentor-session-persistence.md](mr-mentor-session-persistence.md)** - Session ownership, device takeover, conversation persistence
- **[MentorInterceptor_Architecture.md](MentorInterceptor_Architecture.md)** - Mr. Mentor counselor system architecture

---

## Changelog

- **2025-12-31:** Appended multi-screen overlay system documentation (CalendarOverlay, LessonsOverlay, GeneratedLessonsOverlay, LessonMakerOverlay)
- **2025-12-18:** Created brain file documenting recommendations vs generation decision logic and escape hatches (fix for locked-in generation flow)
