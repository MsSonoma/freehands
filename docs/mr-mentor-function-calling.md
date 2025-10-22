# Mr. Mentor Function Calling

## Overview

Mr. Mentor can now perform actions on behalf of facilitators without them leaving the conversation. Using OpenAI's function calling, Mr. Mentor can:

1. **Generate custom lessons** - Create complete lessons with vocab, questions, and teaching notes
2. **Schedule lessons** - Add lessons to learner calendars for specific dates

All actions happen in the background, and Mr. Mentor confirms when they're complete.

## How It Works

### Architecture

```
User Message → OpenAI GPT-4o (with function definitions)
             ↓
       [Function Call Detected]
             ↓
    Execute Function (API call)
             ↓
       Return Result to GPT-4o
             ↓
    Generate Natural Response
             ↓
         Return to User
```

### Function Definitions

#### 1. search_lessons

**Purpose:** Search for available lessons across all subjects and facilitator-created lessons

**Parameters:**
- `subject` (optional): Filter by subject - math, science, language arts, social studies, or facilitator
- `grade` (optional): Filter by grade level (e.g., "3rd", "5th")
- `searchTerm` (optional): Search term to match in lesson titles

**Returns:**
- List of up to 30 matching lessons with title, grade, subject, difficulty, lessonKey, and blurb
- Total count of lessons found

**Example conversation:**
```
Facilitator: "What multiplication lessons do you have for 3rd grade?"

Mr. Mentor: "Let me check our lesson library..."
[Calls search_lessons with grade="3rd", searchTerm="multiplication"]
[Returns 5 lessons]

Mr. Mentor: "I found 5 multiplication lessons for 3rd grade:
- Multiplication Basics (Beginner)
- Times Tables Practice (Intermediate)
- Multiplying with Zeros (Intermediate)
- Multiplication Word Problems (Advanced)
- Multi-Digit Multiplication (Advanced)

Would you like details on any of these, or should I schedule one for a learner?"
```

#### 2. get_lesson_details

**Purpose:** Retrieve full details about a specific lesson to understand its content

**Parameters:**
- `lessonKey` (required): Lesson identifier in format "subject/filename.json"

**Returns:**
- Lesson metadata (title, grade, difficulty, subject, blurb)
- First 5 vocabulary terms
- Teaching notes
- Question counts by type

**Example conversation:**
```
Facilitator: "Tell me more about the photosynthesis lesson"

Mr. Mentor: "Let me pull up those details..."
[Calls get_lesson_details with lessonKey="science/Photosynthesis_Basics.json"]

Mr. Mentor: "The Photosynthesis Basics lesson is designed for 5th grade at an 
intermediate level. It covers how plants make their own food using sunlight, 
water, and carbon dioxide. 

Key vocabulary includes: photosynthesis, chlorophyll, glucose, carbon dioxide, and oxygen.

Teaching notes suggest: 'Use diagrams to show the process visually. Common 
misconception: plants eat soil. Emphasize that plants make their own food.'

The lesson has 10 sample questions, 12 true/false, 10 multiple choice, 8 fill-in-blank, 
and 10 short answer questions. It's comprehensive and should take about 30-40 minutes.

Would you like me to schedule this for Emma?"
```

#### 3. generate_lesson

**Purpose:** Create a custom lesson for any subject/grade/difficulty

**Parameters:**
- `title` (required): Lesson title (e.g., "Photosynthesis Basics")
- `subject` (required): One of: math, science, language arts, social studies
- `grade` (required): Grade level (e.g., "3rd", "5th", "8th")
- `difficulty` (required): One of: Beginner, Intermediate, Advanced
- `description` (required): Brief description of lesson content
- `vocab` (optional): Comma-separated vocabulary terms
- `notes` (optional): Additional guidance for lesson creation

**Example conversation:**
```
Facilitator: "Can you create a 5th grade science lesson about the water cycle?"

Mr. Mentor: "Absolutely! Let me create that for you right now..."
[Calls generate_lesson function]
[Function returns success]

Mr. Mentor: "I've created a lesson called 'The Water Cycle' for 5th grade science. 
It includes vocabulary like evaporation and condensation, plus 10 questions in each 
format. The lesson is ready in your Facilitator Lessons. Would you like me to schedule 
it for a specific learner?"
```

#### 2. schedule_lesson

**Purpose:** Add a lesson to a learner's calendar

**Parameters:**
- `learnerId` (required): Learner's database ID
- `lessonKey` (required): Lesson identifier (format: "subject/filename.json")
- `scheduledDate` (required): Date in YYYY-MM-DD format

**Example conversation:**
```
Facilitator: "Can you schedule the photosynthesis lesson for Emma on Monday?"

Mr. Mentor: "I'll add that to Emma's calendar for Monday, December 18th..."
[Calls schedule_lesson function]
[Function returns success]

Mr. Mentor: "Done! Emma's photosynthesis lesson is now scheduled for December 18th. 
I see she's been doing well in science - this should be a good next step for her."
```

## Implementation Details

### API Route Changes

**File:** `src/app/api/counselor/route.js`

**Key additions:**
1. **Tool definitions** - Declared for OpenAI function calling
2. **Function execution handlers** - `executeLessonGeneration()` and `executeLessonScheduling()`
3. **Two-step flow** - Initial call → function execution → follow-up call with results
4. **Audio synthesis** - Refactored into `synthesizeAudio()` helper

### System Prompt Enhancement

Added section informing Mr. Mentor of available actions:
```
Available Actions (use when appropriate):
- You can GENERATE custom lessons when a facilitator asks for a lesson on a specific topic
- You can SCHEDULE lessons for specific learners on specific dates
- These actions happen in the background - you'll be notified when complete
```

### Response Flow

**Normal conversation:**
```
User → OpenAI → Text Response → TTS → Return
```

**With function calling:**
```
User → OpenAI → Function Call Detected
     ↓
Execute Function (lesson gen or schedule)
     ↓
Function Result → OpenAI (with context)
     ↓
Natural Language Confirmation → TTS → Return
```

## User Experience

### From Facilitator's Perspective

**Before:**
1. Talk to Mr. Mentor about needing a lesson
2. Navigate away to Lesson Maker
3. Fill out form manually
4. Generate lesson
5. Go back to Mr. Mentor

**After:**
1. Ask Mr. Mentor to create a lesson
2. Mr. Mentor does it immediately
3. Confirms when complete
4. Continue conversation

### UI Indicators

The counselor client doesn't need special UI for this - Mr. Mentor's natural language response indicates what happened:

- "Let me create that for you..." (working)
- "I've created a lesson called..." (success)
- "I had trouble creating that lesson..." (failure)

Optional: Could add a visual indicator in the message when a function call is detected.

## Error Handling

### Lesson Generation Failures

**Possible errors:**
- User not premium tier
- OpenAI timeout (>55s)
- Invalid parameters
- Storage upload failure

**Mr. Mentor response:**
```
"I tried to create that lesson, but ran into a technical issue. Could you try 
using the Lesson Maker directly this time? Let me know if you need help with 
what to include in the lesson."
```

### Scheduling Failures

**Possible errors:**
- Learner not found
- Invalid date format
- Lesson key doesn't exist
- Database error

**Mr. Mentor response:**
```
"I had trouble adding that to the schedule. Could you double-check that the 
lesson exists and the date is correct? You can also schedule it manually 
from the calendar view."
```

## Testing

### Manual Testing Scenarios

**1. Generate a lesson**
```
User: "Create a 3rd grade math lesson on addition with regrouping"
Expected: Mr. Mentor generates lesson and confirms
```

**2. Schedule existing lesson**
```
User: "Schedule the multiplication lesson for Emma on Friday"
Expected: Mr. Mentor schedules and confirms (requires Emma's ID in context)
```

**3. Generate then schedule**
```
User: "Make a 5th grade science lesson about volcanos and schedule it for next week"
Expected: Two function calls - generate, then schedule
```

**4. Error handling**
```
User: "Create a lesson" (missing details)
Expected: Mr. Mentor asks clarifying questions instead of calling function
```

### Automated Testing

**Unit tests needed:**
- `executeLessonGeneration()` with valid/invalid args
- `executeLessonScheduling()` with valid/invalid args
- Function call detection and parameter extraction
- Error response formatting

**Integration tests needed:**
- Full flow: user message → function call → API → response
- Authentication token passing
- Multiple function calls in sequence

## Security Considerations

### Authentication

- Auth token passed through from original request
- Functions verify user permissions via `/api/facilitator/lessons/generate` and `/api/lesson-schedule`
- No elevation of privileges

### Input Validation

- All function parameters validated by OpenAI (type, enum, required)
- Backend APIs perform additional validation
- SQL injection not possible (using Supabase ORM)

### Rate Limiting

Considerations:
- Lesson generation is expensive (OpenAI + time)
- Should we limit function calls per session?
- Current: relies on premium tier requirement for generation

## Future Enhancements

### Additional Functions

**Possible additions:**
1. **edit_lesson** - Modify an existing lesson
2. **get_learner_progress** - Fetch detailed progress data
3. **create_lesson_sequence** - Generate a series of related lessons
4. **bulk_schedule** - Schedule multiple lessons at once
5. **analyze_performance** - Deep dive into learner metrics

### UI Improvements

1. **Function call indicator** - Show a spinner/badge when Mr. Mentor is performing an action
2. **Action log** - List of actions taken in the session
3. **Undo button** - Reverse a schedule or delete a generated lesson
4. **Preview mode** - Show generated lesson before saving

### Conversation Improvements

1. **Proactive suggestions** - "Would you like me to schedule that for Emma?"
2. **Bulk operations** - "Schedule this lesson for all your 3rd graders"
3. **Smart defaults** - Remember preferences (grade levels, subjects, dates)
4. **Follow-up questions** - "What's the next topic you'd like to cover?"

## Monitoring & Analytics

### Metrics to Track

- Function call frequency (which functions, how often)
- Success/failure rates
- Average generation time
- User satisfaction (implicit: do they continue the conversation?)

### Logging

Current logging:
```javascript
console.log(`${logPrefix} Calling function: ${functionName}`, functionArgs)
console.log(`${logPrefix} Function result:`, result)
```

Consider adding:
- Function call duration
- Error details and stack traces
- User ID and session ID for tracking patterns

## Troubleshooting

### Function not called when expected

**Check:**
1. Is the request clear and specific?
2. Are required parameters mentioned?
3. Is OpenAI model set to `gpt-4o` (supports function calling)?
4. Are tool definitions correct in API?

**Debug:**
```javascript
console.log('OpenAI response:', parsedBody)
console.log('Tool calls:', toolCalls)
```

### Function called but fails

**Check:**
1. Auth token present and valid?
2. User has premium tier?
3. Backend API reachable?
4. Parameters in correct format?

**Debug:**
```javascript
console.log('Function args:', functionArgs)
console.log('API response:', result)
```

### Response doesn't mention function result

**Check:**
1. Did follow-up call to OpenAI succeed?
2. Was function result included in messages?
3. Is system prompt clear about confirming actions?

**Debug:**
```javascript
console.log('Follow-up messages:', followUpMessages)
console.log('Follow-up response:', followUpBody)
```

## Code References

### Key Files

- `/src/app/api/counselor/route.js` - Main API with function calling
- `/src/app/api/facilitator/lessons/generate/route.js` - Lesson generation backend
- `/src/app/api/lesson-schedule/route.js` - Scheduling backend
- `/src/app/facilitator/tools/counselor/CounselorClient.jsx` - Frontend client

### Related Documentation

- `/docs/mr-mentor.md` - General Mr. Mentor documentation
- `/docs/lesson-notes-feature.md` - Lesson notes for context
- OpenAI Function Calling: https://platform.openai.com/docs/guides/function-calling
