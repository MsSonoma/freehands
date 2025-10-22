# Lesson Notes Quick Start

## What It Does
Facilitators can add notes about each learner's progress on specific lessons. Mr. Mentor automatically receives these notes when counseling that learner.

## Setup Required
Run the database migration first:
```bash
# Execute in Supabase SQL editor
# File: scripts/add-lesson-notes-column.sql
```

## How to Use

### 1. Add a Note
1. Go to **Facilitator Tools** → **Lessons**
2. Select a learner from dropdown
3. Expand a subject (e.g., "Math")
4. Find a lesson card
5. Click **"📝 Add note for Mr. Mentor"**
6. Type your note (e.g., "Needs more practice with place value")
7. Save with:
   - Click **Save** button
   - Or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

### 2. View in Mr. Mentor
1. Go to **Facilitator Tools** → **Mr. Mentor**
2. Select the same learner from dropdown
3. Mr. Mentor now has context like:
   ```
   FACILITATOR NOTES ON LESSONS:
   
   math - Place Value Basics:
     "Needs more practice with place value. Using visual aids helps."
   
   science - States of Matter:
     "Loves hands-on experiments. Completed ahead of schedule."
   ```

### 3. Discuss with Mr. Mentor
Type questions like:
- "What strategies can help with place value?"
- "How can I build on Emma's science interest?"
- "Any suggestions for the math challenges I noted?"

Mr. Mentor will reference your notes in responses.

## Example Workflow

**Scenario:** Emma struggles with multiplication tables

1. **Document it:**
   - Find "Multiplication Basics" lesson
   - Add note: "Struggles with times tables above 5x. Gets frustrated."
   - Save

2. **Consult Mr. Mentor:**
   - Select Emma in Mr. Mentor
   - Ask: "I noted Emma struggles with times tables above 5. Any strategies?"
   - Mr. Mentor sees your note and suggests specific interventions

3. **Try suggestions, update note:**
   - Edit note: "Was struggling with 5x+. Visual aids helping. Confidence improving."
   - Mr. Mentor tracks progress over time

## Tips

### Good Notes
✅ **Specific:** "Needs step-by-step guidance for word problems"  
✅ **Actionable:** "Works better in morning sessions"  
✅ **Balanced:** "Excellent progress this week, confidence improving"

### Avoid
❌ Too vague: "Having trouble"  
❌ Too long: (Keep under 100 words)  
❌ Duplicates: (Don't repeat what's in medals/scores)

## Data Storage

```javascript
// Stored in learners.lesson_notes as JSONB:
{
  "math/Multiplication_Basics.json": "Struggles with times tables above 5x",
  "science/Solar_System.json": "Very interested in planets",
  "language arts/Reading_Comprehension.json": "Improving with inference"
}
```

## Files Changed

- `/src/app/facilitator/lessons/page.js` - Notes UI
- `/src/app/lib/learnerTranscript.js` - Transcript builder
- `/src/app/api/counselor/route.js` - Mr. Mentor integration
- `/scripts/add-lesson-notes-column.sql` - Database migration
- `/docs/lesson-notes-feature.md` - Full documentation

## Testing Checklist

After running migration:

- [ ] Add a note to a lesson
- [ ] Verify note saves (refresh page, note persists)
- [ ] Edit an existing note
- [ ] Delete a note (clear text and save)
- [ ] Select learner in Mr. Mentor dropdown
- [ ] Ask Mr. Mentor about the noted lesson
- [ ] Verify Mr. Mentor references the note in response

---

**Next Steps:**
1. Run `add-lesson-notes-column.sql` in Supabase
2. Test adding/editing notes in `/facilitator/lessons`
3. Verify notes appear in Mr. Mentor transcript
4. Discuss a learner with Mr. Mentor and confirm context-aware responses
