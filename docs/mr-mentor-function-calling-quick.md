# Mr. Mentor Function Calling - Quick Reference

## What Changed

Mr. Mentor can now perform actions for you without leaving the conversation:

✅ **Search the lesson library** - "What lessons do you have on fractions?"
✅ **Get lesson details** - "Tell me more about the photosynthesis lesson"
✅ **Generate custom lessons** - "Create a 5th grade math lesson on fractions"
✅ **Schedule lessons** - "Add the photosynthesis lesson to Emma's calendar for Monday"

## How to Use

### Search for Lessons

**Just ask naturally:**
- "What math lessons do you have for 3rd grade?"
- "Do you have any lessons about photosynthesis?"
- "Show me all the fractions lessons"
- "What beginner science lessons are available?"

**Mr. Mentor will:**
1. Search the entire lesson library (standard + facilitator-created)
2. Show matching lessons with titles and grades
3. Offer to provide more details or schedule them

### Get Lesson Details

**Just ask naturally:**
- "Tell me more about the multiplication basics lesson"
- "What does the water cycle lesson cover?"
- "Can you review that photosynthesis lesson for me?"

**Mr. Mentor will:**
1. Retrieve the full lesson content
2. Summarize key vocabulary and teaching notes
3. Show question counts and difficulty level
4. Help you decide if it's right for your learner

### Generate a Lesson

**Just ask naturally:**
- "Can you make a lesson about the water cycle for 3rd grade?"
- "I need an intermediate science lesson on photosynthesis"
- "Create a beginner math lesson on addition for 2nd graders"

**Mr. Mentor will:**
1. Ask for any missing details (grade, subject, difficulty, description)
2. Generate the lesson (takes 30-60 seconds)
3. Confirm when it's ready
4. Offer to schedule it for a learner

### Schedule a Lesson

**Prerequisites:**
- Select a learner in the dropdown at the bottom
- Know the lesson name or have just generated one

**Just ask naturally:**
- "Schedule the multiplication lesson for next Tuesday"
- "Add that to Emma's calendar for December 15th"
- "Put the water cycle lesson on Friday"

**Mr. Mentor will:**
1. Confirm the learner, lesson, and date
2. Add it to the schedule
3. Confirm it's been scheduled

## Technical Details

### What Happens Behind the Scenes

```
You: "Create a 4th grade science lesson on the solar system"
     ↓
Mr. Mentor: "Let me create that for you..." [working...]
     ↓
[Calls /api/facilitator/lessons/generate in background]
     ↓
Mr. Mentor: "I've created a lesson called 'The Solar System' for 4th grade. 
             It's ready in your Facilitator Lessons."
```

### Requirements

- **Premium tier** - Lesson generation requires premium plan
- **Authentication** - You must be logged in
- **Learner context** - For scheduling, select a learner in the dropdown

### Limitations

- Lesson generation takes 30-60 seconds (OpenAI processing)
- Can only schedule lessons that exist
- Dates must be valid (no past dates, correct format)
- One lesson per schedule entry per learner per date

## Examples

### Example 1: Search, Review, and Schedule

```
You: "I need a multiplication lesson for Emma. She's in 3rd grade and just 
      mastered addition."

Mr. Mentor: "Let me see what we have for 3rd grade multiplication..."
[Searches lessons...]
Mr. Mentor: "I found 5 multiplication lessons for 3rd grade:
             - Multiplication Basics (Beginner)
             - Times Tables Practice (Intermediate)
             - Multiplying with Zeros (Intermediate)
             - Multiplication Word Problems (Advanced)
             - Multi-Digit Multiplication (Advanced)
             
             Since Emma just mastered addition, I'd suggest starting with 
             'Multiplication Basics' at the beginner level. Would you like 
             me to tell you more about it?"

You: "Yes, what does it cover?"

Mr. Mentor: "Let me pull up the details..."
[Gets lesson details...]
Mr. Mentor: "This lesson introduces multiplication as repeated addition with 
             vocabulary like 'product', 'factor', and 'array'. The teaching 
             notes suggest using visual aids and connecting to real-world 
             examples like groups of objects.
             
             It has comprehensive practice with all question types - perfect 
             for building a strong foundation. Should I schedule this for Emma?"

You: "Yes, schedule it for tomorrow"

Mr. Mentor: "I'll add it to Emma's calendar for tomorrow..."
[Schedules lesson...]
Mr. Mentor: "Done! Emma has Multiplication Basics scheduled for tomorrow. 
             Based on her progress with addition, she should do well with this. 
             After she completes it, we can move to the times tables practice."
```

### Example 2: Generate and Schedule

```
You: "I need a 3rd grade math lesson on multiplication basics. Can you 
      create it and schedule it for Emma on Monday?"

Mr. Mentor: "I'll create that lesson for you now..."
[Generates lesson...]
Mr. Mentor: "Done! I've created 'Multiplication Basics' for 3rd grade. 
             Now I'll add it to Emma's calendar for Monday, December 18th..."
[Schedules lesson...]
Mr. Mentor: "All set! Emma has 'Multiplication Basics' scheduled for 
             Monday. She's been doing well with addition, so this should 
             be a natural next step. What else would you like to work on?"
```

### Example 2: Quick Generation

```
You: "Create a beginner language arts lesson about nouns for 2nd grade"

Mr. Mentor: "Great topic for 2nd grade! Let me create that for you..."
[Generates lesson...]
Mr. Mentor: "I've created 'Understanding Nouns' with 10 examples and practice 
             questions. The lesson includes vocabulary like 'person, place, thing' 
             and exercises for identifying nouns in sentences. Would you like me 
             to schedule this for any of your learners?"
```

### Example 3: Schedule Existing Lesson

```
You: [With Emma selected in dropdown]
     "Add the photosynthesis lesson to Emma's calendar for next Friday"

Mr. Mentor: "I'll schedule the photosynthesis lesson for Emma on Friday, 
             December 22nd..."
[Schedules lesson...]
Mr. Mentor: "Done! Emma's photosynthesis lesson is scheduled for Friday. 
             I noticed she completed the plant parts lesson last week - 
             this will build nicely on that knowledge."
```

## Troubleshooting

### "I tried to create that lesson, but ran into a technical issue..."

**Possible causes:**
- You're not on a premium plan
- Missing required information (grade, subject, difficulty)
- OpenAI timeout (very long/complex request)

**Solution:**
- Ensure you have premium tier
- Provide all details clearly
- Try the Lesson Maker manually for complex custom lessons

### "I had trouble adding that to the schedule..."

**Possible causes:**
- No learner selected in dropdown
- Lesson doesn't exist
- Invalid date format

**Solution:**
- Select a learner from the dropdown
- Verify the lesson name
- Use dates like "Monday", "next Friday", or "December 18th"

## Tips

### Get Better Results

**Be specific:**
- ✅ "Create a 5th grade intermediate science lesson about the water cycle with vocabulary"
- ❌ "Make a science lesson"

**Provide context:**
- "Emma is struggling with fractions - can you create a beginner lesson?"
- "I need a review lesson before the test on Monday"

**Use natural language:**
- You don't need special commands
- Talk to Mr. Mentor like a colleague
- He'll ask if he needs clarification

### Workflow Suggestions

**Weekly planning:**
```
1. Discuss learner's progress with Mr. Mentor
2. Ask him to generate lessons for gaps
3. Schedule them throughout the week
4. Continue conversation for next steps
```

**Lesson series:**
```
"Can you create a series of 3 lessons on fractions? Start with basics, 
 then equivalents, then operations. Schedule them for Emma on Monday, 
 Wednesday, and Friday."
```

## Next Steps

After Mr. Mentor generates or schedules a lesson:
- He'll offer to help with related tasks
- You can ask about teaching strategies
- You can schedule it for other learners
- You can ask him to create follow-up lessons

The conversation continues naturally - Mr. Mentor remembers what he's created and scheduled.
