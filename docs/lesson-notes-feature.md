# Lesson Notes Feature

## Overview

Facilitators can add notes to any lesson in the `facilitator/lessons` page. These notes are:
- Stored per learner in the `lesson_notes` JSONB column
- Automatically included in Mr. Mentor's learner transcript
- Designed to provide context about a learner's specific challenges, progress, or needs

## Database Schema

```sql
-- Column added to learners table
lesson_notes jsonb default '{}'::jsonb

-- Structure: { 'subject/lesson_file': 'note text', ... }
-- Example:
{
  "math/Multiplication_Basics.json": "Struggles with times tables above 5x",
  "science/Solar_System.json": "Very interested in planets, completed ahead of schedule",
  "facilitator/Custom_Lesson.json": "Needs more practice with this concept"
}
```

## UI Features

### Adding Notes
1. Navigate to `facilitator/lessons`
2. Select the learner from the dropdown
3. Expand a subject accordion
4. Find the lesson card
5. Click "📝 Add note for Mr. Mentor" button
6. Type notes in the textarea
7. Save with:
   - Click "Save" button
   - Press `Ctrl+Enter` / `Cmd+Enter`
   - Press `Escape` to cancel

### Editing Notes
- Existing notes show with "📝 Note for Mr. Mentor:" header
- Click "Edit Note" button to modify
- Same save/cancel options as adding

### Note Display
- Notes appear below lesson details in a bordered section
- Gray text styling to distinguish from lesson info
- Pre-wrap formatting preserves line breaks

## Mr. Mentor Integration

### How Notes Appear in Transcript

When a facilitator discusses a learner with Mr. Mentor, notes are included in the transcript:

```
FACILITATOR NOTES ON LESSONS:

math - Multiplication Basics:
  "Struggles with times tables above 5x. Needs more practice with visual aids."

science - Solar System:
  "Very interested in planets, completed ahead of schedule. Asked lots of questions."

language arts - Reading Comprehension:
  "Improving but still needs help with inference questions."
```

### Mr. Mentor's Use
- Notes provide specific context about learner challenges
- Mr. Mentor can reference these in responses
- Enables data-informed, personalized counseling suggestions
- Example response: "I see you noted Emma struggles with times tables above 5x. Have you tried..."

## Technical Implementation

### State Management
```javascript
const [lessonNotes, setLessonNotes] = useState({}) // { 'subject/lesson': 'text' }
const [editingNote, setEditingNote] = useState(null) // currently editing key
```

### Save Function
```javascript
async function saveNote(lessonKey, noteText) {
  const newNotes = { ...lessonNotes }
  if (noteText && noteText.trim()) {
    newNotes[lessonKey] = noteText.trim()
  } else {
    delete newNotes[lessonKey] // Remove empty notes
  }
  
  await supabase
    .from('learners')
    .update({ lesson_notes: newNotes })
    .eq('id', selectedLearnerId)
}
```

### Transcript Builder
```javascript
// In buildLearnerTranscript()
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

## Use Cases

### 1. Progress Tracking
**Note:** "Completed with 95%. Ready for next level concepts."

Mr. Mentor can suggest:
- Advanced materials
- Acceleration opportunities
- Extension activities

### 2. Challenge Documentation
**Note:** "Struggles with word problems. Gets anxious during timed tests."

Mr. Mentor can suggest:
- Scaffolding strategies
- Anxiety management techniques
- Alternative assessment methods

### 3. Interest Tracking
**Note:** "Loves hands-on experiments. Wants to learn more about chemistry."

Mr. Mentor can suggest:
- Enrichment resources
- Project-based learning ideas
- Real-world applications

### 4. Behavioral Context
**Note:** "Easily distracted. Works better in morning sessions."

Mr. Mentor can suggest:
- Schedule optimization
- Environment modifications
- Attention strategies

## Best Practices

### Writing Effective Notes
✅ **DO:**
- Be specific and actionable
- Note patterns over time
- Include both challenges AND successes
- Mention learning preferences
- Track emotional/behavioral factors

❌ **DON'T:**
- Write overly long essays (keep concise)
- Include sensitive medical information
- Use vague descriptions
- Duplicate information already in medals/scores

### Example Good Notes
```
"Needs step-by-step guidance for multi-step problems"
"Visual learner - diagrams help significantly"
"Excellent progress this week, confidence improving"
"Takes longer but produces quality work"
"Asks insightful questions about applications"
```

## Database Migration

To add the column to an existing database:

```sql
-- Run scripts/add-lesson-notes-column.sql
alter table public.learners add column if not exists lesson_notes jsonb default '{}'::jsonb;
create index if not exists idx_learners_lesson_notes on public.learners using gin(lesson_notes);
update public.learners set lesson_notes = '{}'::jsonb where lesson_notes is null;
```

## Future Enhancements

Potential improvements:
- [ ] Rich text formatting for notes
- [ ] Note history/versioning
- [ ] Bulk note operations
- [ ] Note templates/suggestions
- [ ] Search/filter by notes
- [ ] Export notes to PDF
- [ ] Note sharing between facilitators
- [ ] AI-suggested notes based on performance patterns
