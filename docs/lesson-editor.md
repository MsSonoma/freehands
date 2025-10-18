# Lesson Editor Feature

## Overview
Facilitators can now edit generated lessons directly through a structured, form-based interface. This provides full editing capabilities while maintaining JSON integrity and preventing syntax errors.

## Features

### 1. Structured Editing Interface
- **Form-based editing** instead of raw JSON manipulation
- Each lesson component has its own editor section
- Visual validation and error feedback

### 2. Dynamic Field Management
- **Add unlimited items** to any section (vocab terms, questions, answer options)
- **Remove items** individually with dedicated buttons
- **Leave fields blank** - they're automatically cleaned before saving
- **Write custom questions/answers** with complete control

### 3. Supported Lesson Components

#### Basic Information
- Title, Grade, Difficulty, Subject
- Description/Blurb
- Teaching Notes

#### Vocabulary Terms
- Add/remove terms dynamically
- Term + Definition pairs
- Empty terms are filtered out on save

#### Question Types
All question types support:
- Add/remove questions
- Custom question text
- Multiple acceptable answers (where applicable)

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

### 4. Validation & Safety

**Pre-save Validation:**
- Required fields (title, grade, difficulty)
- Question text presence
- Answer completeness
- Minimum choice counts for multiple choice
- Blank presence for fill-in-blank

**Auto-cleanup:**
- Empty questions removed
- Empty answer fields filtered
- Empty vocabulary terms removed
- Empty choice options filtered
- Maintains JSON structure integrity

**Error Display:**
- Clear error messages before save
- Specific field identification
- Red error banner with checklist

### 5. Workflow

1. **Navigate** to Facilitator Tools → Generated Lessons
2. **Click "Edit Lesson"** on any lesson card
3. **Edit any fields** in the structured form
4. **Add items** with green "+ Add" buttons
5. **Remove items** with red "Remove" buttons
6. **Save Changes** to update the JSON file
7. **Cancel** to discard changes

### 6. Integration with Existing Features

**Compatible with:**
- Text Preview (still available)
- Request AI Changes (for AI-assisted editing)
- Approve/Unapprove workflow
- Delete functionality

**Workflow Options:**
- **Manual Edit**: Direct form editing (new)
- **AI Edit**: Natural language change requests (existing)
- **Hybrid**: Combine both approaches

## Technical Details

### Files Modified
- `src/components/LessonEditor.jsx` - New editor component
- `src/app/facilitator/tools/generated/page.js` - Integration
- `src/app/api/facilitator/lessons/update/route.js` - Update endpoint

### API Endpoint
- **PUT** `/api/facilitator/lessons/update`
- Validates lesson structure
- Updates storage file
- Requires premium tier

### State Management
- Local React state for editing
- Validates before save
- Automatic cleanup of empty fields
- Deep copy for mutation safety

### Validation Rules
- Title, grade, difficulty are required
- Questions must have text
- Multiple choice needs ≥2 choices and valid correct index
- True/false needs boolean answer
- Short answer/fill-in-blank/word problems need ≥1 answer
- Fill-in-blank must contain `_____`

## Benefits

1. **No JSON Syntax Errors** - Form-based editing prevents syntax mistakes
2. **Flexible Field Management** - Add/remove as many items as needed
3. **Visual Feedback** - See structure while editing
4. **Data Integrity** - Validation prevents broken lessons
5. **User-Friendly** - No JSON knowledge required
6. **Comprehensive** - Edit all lesson components in one place

## Future Enhancements

Potential additions:
- Drag-and-drop question reordering
- Duplicate question/vocab term
- Bulk import from CSV
- Template library
- Undo/redo functionality
- Keyboard shortcuts
- Rich text editor for questions
- Image upload support
