# Mr. Mentor Conversation Flows

**Last Updated:** 2025-12-18  
**Status:** Canonical  
**Systems:** Conversation decision logic, lesson generation vs recommendations, escape hatches, function calling triggers

---

## How It Works

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
User mentions topic
  |
  v
Is this a generation request? (imperative verbs?)
  |
  +--NO--> SEARCH existing lessons
  |          |
  |          v
  |        Recommend top results
  |          |
  |          v
  |        Offer to generate IF nothing suitable
  |
  +--YES--> Start generation parameter collection
             |
             v
           Collect: grade, subject, difficulty, title, description
             |
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

---

## What NOT To Do

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

## Related Brain Files

- **[mr-mentor-session-persistence.md](mr-mentor-session-persistence.md)** - Session ownership, device takeover, conversation persistence
- **[MentorInterceptor_Architecture.md](MentorInterceptor_Architecture.md)** - Mr. Mentor counselor system architecture

---

## Changelog

- **2025-12-18:** Created brain file documenting recommendations vs generation decision logic and escape hatches (fix for locked-in generation flow)
