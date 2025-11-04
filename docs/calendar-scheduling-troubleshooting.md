# Calendar Lesson Scheduling Troubleshooting

## Issue: Scheduled Lessons Not Appearing on Learner Page

### Problem Description
Lessons scheduled via the Facilitator Calendar weren't appearing on the learner's lessons page on their scheduled date.

### Root Cause
The database contained **incorrect lesson keys** that didn't match the actual lesson filenames.

**Example:**
- Database had: `science/Water_Cycle`
- Actual file: `science/5th_Earth_Science_Water_Cycle_Systems_Beginner.json`

Because the keys didn't match, the scheduled lessons weren't recognized as valid lessons to display.

### Why This Happened
This likely occurred due to one of these reasons:

1. **Manual database edits** - Someone manually entered a lesson key without the full filename
2. **Old code bug** - Earlier versions of the calendar might have saved shortened keys
3. **Lesson file renamed** - A lesson was scheduled, then the file was renamed/moved later

### How the System Works

#### Lesson Key Format
All lesson keys MUST use the format: `subject/filename.json`

Examples:
- ✅ `math/4th_Multi_Digit_Multiplication_Beginner.json`
- ✅ `science/5th_Earth_Science_Water_Cycle_Systems_Beginner.json`
- ✅ `language arts/4th_Paragraph_Structure_Writing_Beginner.json`
- ❌ `science/Water_Cycle` (incorrect - missing full filename and .json)

#### How Scheduled Lessons Appear
1. Facilitator schedules lesson in `/facilitator/calendar`
2. Lesson key is saved to `lesson_schedule` table with `scheduled_date`
3. On the learner's page (`/learn/lessons`), the app:
   - Loads all approved lessons from filesystem
   - Fetches today's scheduled lessons from database
   - Merges them together by matching lesson keys
   - Displays any lesson that is EITHER approved OR scheduled for today

If the scheduled lesson key doesn't match any actual file, the lesson won't appear.

### Diagnostic Tools

#### 1. Debug Scheduled Lessons Script
Check what's in the database and identify mismatches:

```bash
node scripts/debug-scheduled-lessons.mjs
```

This shows:
- All scheduled lessons with their dates
- Today's scheduled lessons
- Timezone information
- Learner approved lessons

#### 2. Fix Scheduled Lesson Keys Script
Automatically detect and fix incorrect lesson keys:

```bash
node scripts/fix-scheduled-lesson-keys.mjs
```

This script:
- Scans all lesson files from `public/lessons/`
- Compares against scheduled lesson keys in database
- Uses fuzzy matching to find the correct filename
- Automatically updates incorrect keys
- Reports orphaned entries (keys with no matching file)

### Verification Steps

After fixing, verify the lesson appears:

1. **Check database:**
   ```bash
   node scripts/debug-scheduled-lessons.mjs
   ```
   Confirm today's lessons show correct keys with `.json` extension

2. **Check learner page:**
   - Navigate to `/learn/lessons` as the learner
   - The scheduled lesson should appear in the available lessons list
   - It should have a 📅 calendar badge

3. **Check browser console:**
   - Open DevTools Console
   - Look for `[Learn Lessons] Scheduled lessons for today:` log
   - Verify the lesson key matches the filename

### Prevention

To prevent this issue in the future:

1. **Always use the Calendar UI** to schedule lessons - don't manually edit the database
2. **Don't rename lesson files** after they've been scheduled
3. **Validate lesson keys** - they must always end in `.json`
4. **Run the fix script** periodically to catch any inconsistencies

### Quick Fixes

**Lesson not appearing today?**

1. Check the database entry:
   ```bash
   node scripts/debug-scheduled-lessons.mjs
   ```

2. Run the fix script:
   ```bash
   node scripts/fix-scheduled-lesson-keys.mjs
   ```

3. Refresh the learner's page

**Still not working?**

- Check if the lesson file actually exists in `public/lessons/[subject]/`
- Verify the learner ID matches
- Check browser console for errors
- Verify the date matches (timezone issues)

### Related Files

- **Frontend:** `src/app/learn/lessons/page.js` - Loads and displays scheduled lessons
- **API:** `src/app/api/lesson-schedule/route.js` - Handles schedule CRUD operations
- **Calendar UI:** `src/app/facilitator/calendar/` - Scheduling interface
- **Utilities:** `src/lib/scheduleUtils.js` - Helper functions
- **Scripts:**
  - `scripts/debug-scheduled-lessons.mjs` - Diagnostic tool
  - `scripts/fix-scheduled-lesson-keys.mjs` - Repair tool

### Technical Details

#### Date Handling
The system uses **local timezone dates** (not UTC) for scheduling:

```javascript
const now = new Date()
const year = now.getFullYear()
const month = String(now.getMonth() + 1).padStart(2, '0')
const day = String(now.getDate()).padStart(2, '0')
const today = `${year}-${month}-${day}` // Format: "2025-11-04"
```

#### Lesson Matching Logic
```javascript
// In /learn/lessons page.js
scheduledLessons.forEach(item => {
  if (item.lesson_key) {
    scheduled[item.lesson_key] = true // Mark as available
  }
})

// Later, when filtering lessons
const isAvailable = 
  availableLessons[lessonKey] === true ||  // Approved by facilitator
  scheduledLessons[lessonKey] === true      // Scheduled for today
```

The lesson key from the schedule MUST exactly match the key used to load the lesson file.

### Status

✅ **Fixed** - November 4, 2025
- Issue: `science/Water_Cycle` didn't match any file
- Solution: Updated to `science/5th_Earth_Science_Water_Cycle_Systems_Beginner.json`
- Result: Lesson now appears correctly on learner page

### Future Improvements

Potential enhancements to prevent this issue:

1. **Validation on save** - Verify lesson file exists before allowing schedule
2. **Foreign key constraint** - Create a lessons table and reference it
3. **Automatic cleanup** - Remove orphaned schedule entries
4. **Better error messages** - Show which scheduled lessons couldn't be found
5. **Admin dashboard** - UI to view and fix scheduling issues
