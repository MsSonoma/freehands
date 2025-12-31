# Lesson Notes

## How It Works

Facilitators can add notes to any lesson in the `facilitator/lessons` page. These notes are stored per learner and automatically included in Mr. Mentor's learner transcript, providing context about specific challenges, progress, or needs.

**Flow:**
1. Navigate to `facilitator/lessons`, select learner, expand subject
2. Click "📝 Add note for Mr. Mentor" button on lesson card
3. Type note in textarea, save with button or `Ctrl+Enter` (press `Escape` to cancel)
4. Existing notes show with "📝 Note for Mr. Mentor:" header, click "Edit Note" to modify
5. When facilitator discusses learner with Mr. Mentor, notes appear in transcript:
   ```
   FACILITATOR NOTES ON LESSONS:

   math - Multiplication Basics:
     "Struggles with times tables above 5x. Needs more practice with visual aids."

   science - Solar System:
     "Very interested in planets, completed ahead of schedule."
   ```
6. Mr. Mentor references notes in responses for data-informed, personalized counseling

**Purpose**: Enables facilitators to document learner-specific observations that persist across lessons, providing Mr. Mentor with longitudinal context for better guidance.

## Database Schema

**Learners table:**
```sql
-- Column added to learners table
lesson_notes jsonb default '{}'::jsonb

-- Structure: { 'subject/lesson_file': 'note text', ... }
-- Example:
{
  "math/Multiplication_Basics.json": "Struggles with times tables above 5x",
  "science/Solar_System.json": "Very interested in planets, completed ahead of schedule"
}
```

## Mr. Mentor Integration

**Transcript builder** (`src/app/lib/learnerTranscript.js`):
```javascript
const lessonNotes = learner.lesson_notes || {};
const notesKeys = Object.keys(lessonNotes).filter(key => lessonNotes[key]);

if (notesKeys.length > 0) {
  lines.push(`FACILITATOR NOTES ON LESSONS:`);
  notesKeys.sort().forEach(key => {
    const [subject, lessonName] = key.split('/');
    lines.push(`${subject} - ${lessonName}:`);
    lines.push(`  "${lessonNotes[key]}"`);
  });
}
```

**Use cases:**
- **Progress tracking**: "Completed with 95%. Ready for next level." → Mr. Mentor suggests advanced materials
- **Challenge documentation**: "Struggles with word problems. Anxious during tests." → Suggests scaffolding/anxiety strategies
- **Interest tracking**: "Loves hands-on experiments. Wants to learn chemistry." → Suggests enrichment resources
- **Behavioral context**: "Easily distracted. Works better in morning sessions." → Suggests schedule optimization

## Key Files

- `src/app/facilitator/lessons/page.js` - Note UI (add/edit/save), state management, Supabase updates
- `src/app/lib/learnerTranscript.js` - Transcript builder, includes notes section
- `src/app/api/counselor/route.js` - Receives transcript with notes

## What NOT To Do

**DON'T make notes too long** - No character limit enforced, but excessively long notes bloat Mr. Mentor's context window. Keep notes concise (1-3 sentences per lesson).

**DON'T duplicate medal data** - Medals already appear in transcript. Notes should add *new* context (challenges, interests, behavior) not already captured elsewhere.

**DON'T fail to update notes** - Stale notes mislead Mr. Mentor. Encourage facilitators to update notes as learner progresses.

**DON'T forget empty note deletion** - Save function correctly deletes empty notes from JSONB object (avoids storing null/empty values).
