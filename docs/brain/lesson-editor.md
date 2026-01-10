# Lesson Editor

## How It Works

Facilitators edit owned lessons (Storage-backed) through a structured, form-based interface that maintains JSON integrity and prevents syntax errors.

The editor also supports creating a brand-new lesson from scratch:
- The Lesson Library page has a **📝 New Lesson** button.
- This opens the Lesson Editor with a blank lesson.
- No lesson file is created in Storage until the user presses Save.

### Structured Editing Interface
- Form-based editing instead of raw JSON manipulation
- Each lesson component has its own editor section
- Visual validation and error feedback
- Accessed from the Lesson Library (Edit or New Lesson)

### Dynamic Field Management
- Add unlimited items to any section (vocab terms, questions, answer options)
- Remove items individually with dedicated buttons
- Leave fields blank - automatically cleaned before saving
- Write custom questions/answers with complete control

### Supported Lesson Components

#### Basic Information
- Title, Grade, Difficulty, Subject
- Description/Blurb
- Teaching Notes

#### Vocabulary Terms
- Add/remove terms dynamically
- Term + Definition pairs
- Empty terms filtered out on save

#### Question Types

**Multiple Choice**
- Add/remove answer choices dynamically
- Radio button to select correct answer
- Minimum 2 choices required
- Visual letter labels (A, B, C, D...)

**True/False**
- Simple true/false selection
- Question text editor

**Short Answer**
- Multiple acceptable answers
- Add/remove answer variants
- Students only need to match one

**Fill in the Blank**
- Use `_____` to indicate blank position
- Multiple acceptable answers
- Validation ensures blank exists

**Sample Q&A** (Teaching Examples)
- Questions for teaching phase
- Sample answers (not strictly validated)

**Word Problems**
- Full problem text editor
- Multiple acceptable answers

### Validation & Safety

**Pre-save Validation**
- Required fields (title, grade, difficulty)
- Question text presence
- Answer completeness
- Minimum choice counts for multiple choice
- Blank presence for fill-in-blank

**Auto-cleanup**
- Empty questions removed
- Empty answer fields filtered
- Empty vocabulary terms removed
- Empty choice options filtered
- Maintains JSON structure integrity

**Error Display**
- Clear error messages before save
- Specific field identification
- Red error banner with checklist

### Workflow

**Edit existing owned lesson**
1. Go to Lesson Library
2. Click "Edit" on an owned lesson
3. Edit any fields in the structured form
4. Save Changes to update the Storage-backed JSON file
5. Cancel to discard changes

**Create a new lesson from scratch**
1. Go to Lesson Library
2. Click **📝 New Lesson**
3. Fill in lesson fields (title, grade, difficulty, subject, etc.)
4. Press Save to create the lesson in Storage
5. Cancel to discard (no Storage file is created)

## Integration with Existing Features

**Compatible with:**
- Text Preview (still available)
- Request AI Changes (for AI-assisted editing)

## Related Brain Files

- **[lesson-validation.md](lesson-validation.md)** - Editor triggers automatic validation on save
- **[ai-rewrite-system.md](ai-rewrite-system.md)** - AIRewriteButton improves lesson content quality

## Key Files

- Structured form UI: `src/components/LessonEditor.jsx`
- Lesson editor page: `src/app/facilitator/lessons/edit/page.js`
- Save existing lesson: `src/app/api/lesson-edit/route.js`
- Create new lesson on first save: `src/app/api/facilitator/lessons/create/route.js`

## What NOT To Do

- Never edit lesson JSON files directly (use structured editor)
- Never save without validation (pre-save checks prevent corruption)
- Never remove auto-cleanup logic (filters empty fields)
- Never skip minimum choice validation for multiple choice
