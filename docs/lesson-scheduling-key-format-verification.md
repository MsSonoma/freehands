# Lesson Scheduling Key Format Verification

## Question
Will future lessons be saved with the correct keys when scheduled from all locations?

## Answer
**YES** ✅ All 4 scheduling locations correctly use the full lesson filename including `.json` extension.

## Code Verification

### Location 1: Facilitator Lessons Page (`/facilitator/lessons`)

**File:** `src/app/facilitator/lessons/page.js`

```javascript
const lessonKey = lesson.isGenerated 
  ? `generated/${lesson.file}` 
  : `${subject}/${lesson.file}`

// Then passes to:
scheduleLesson(lessonKey, dateInput.value)
```

✅ **Uses `lesson.file`** which contains the full filename from the API

---

### Location 2: Lessons Overlay (Mr. Mentor)

**File:** `src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx`

```javascript
const lessonKey = lesson.isGenerated 
  ? `generated/${lesson.file}` 
  : `${subject}/${lesson.file}`

// Then passes to:
scheduleLesson(lessonKey, dateInput.value)
```

✅ **Uses `lesson.file`** which contains the full filename from the API

---

### Location 3: Facilitator Calendar (`/facilitator/calendar`)

**File:** `src/app/facilitator/calendar/LessonPicker.js`

```javascript
lessons.forEach(item => {
  const filename = typeof item === 'string' ? item : item.filename || item.file || item.key
  const key = `${subject}/${filename}`
  
  // Then passes to:
  handleSchedule(lesson.key)
})
```

✅ **Uses `item.file`** with fallback chain, all resolve to full filename

---

### Location 4: Calendar Overlay (Mr. Mentor)

**File:** `src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx`

```javascript
const handleRescheduleLesson = async (lessonKey, oldDate, newDate) => {
  // Uses existing lesson_key from the schedule entry
  // Finds existing schedule with matching lessonKey
  // Deletes old, creates new with same lessonKey
}
```

✅ **Reuses existing `lesson_key`** from database (doesn't construct new one)

---

## API Confirmation

**File:** `src/app/api/lessons/[subject]/route.js`

The API returns the `file` property with the full filename:

```javascript
// For filesystem lessons
results.push({
  file,  // ← Full filename: "5th_Earth_Science_Water_Cycle_Systems_Beginner.json"
  id: data.id || file,
  title: data.title || file.replace(/\.json$/, '').split('_').join(' '),
  blurb: data.blurb || '',
  difficulty: (data.difficulty || '').toLowerCase(),
  grade: data.grade != null ? String(data.grade) : null
})

// For generated lessons (Supabase Storage)
results.push({
  file: file.name,  // ← Full filename from storage
  id: lessonData.id || file.name,
  title: lessonData.title || file.name.replace(/\.json$/, '').split('_').join(' '),
  ...
})
```

---

## What Caused the Original Issue?

The database had **legacy entries** with incorrect keys like:
- ❌ `science/Water_Cycle` (missing full filename and `.json`)
- ❌ `language arts/Magic Treehouse #13: Vacation Under the Volcano` (manually entered?)
- ❌ `science/Understanding_Biodiversity` (missing `.json`)

These were likely from:
1. **Manual database entries** before the scheduling UI existed
2. **Old code** that might have truncated filenames
3. **Lesson files renamed** after being scheduled

---

## Current State

✅ **All code paths correct** - Use full filename with `.json`  
✅ **Fix script available** - `scripts/fix-scheduled-lesson-keys.mjs`  
✅ **Legacy data fixed** - Ran fix script on November 4, 2025  
✅ **Documentation created** - `docs/calendar-scheduling-troubleshooting.md`

---

## Future Scheduling

Going forward, all lessons scheduled from any of the 4 locations will use the correct format:

```
subject/Full_Lesson_Filename_With_Grade_Difficulty.json
```

Examples:
- `science/5th_Earth_Science_Water_Cycle_Systems_Beginner.json`
- `math/4th_Multi_Digit_Multiplication_Beginner.json`
- `generated/4th_Division_Practice_Intermediate.json`

---

## Maintenance

**Run this periodically to catch any future issues:**

```bash
node scripts/fix-scheduled-lesson-keys.mjs
```

This will:
- Detect any incorrect keys in the database
- Auto-fix keys that can be matched to actual files
- Report orphaned entries (scheduled lessons with no matching file)

---

## Verification Steps

To verify a scheduled lesson will work:

1. **Check the database entry:**
   ```bash
   node scripts/debug-scheduled-lessons.mjs
   ```

2. **Verify it matches a real file:**
   - Key should end with `.json`
   - File should exist in `public/lessons/[subject]/` or Supabase Storage

3. **Test on learner page:**
   - Navigate to `/learn/lessons` as the learner
   - Lesson should appear with 📅 calendar badge on the scheduled date

---

**Last Updated:** November 4, 2025  
**Status:** ✅ All locations verified correct
