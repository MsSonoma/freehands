# Lesson Calendar - Quick Setup Guide

## Installation Steps

### 1. Database Setup
Run the migration in Supabase SQL Editor:
```bash
# Open Supabase dashboard > SQL Editor
# Run: scripts/add-lesson-schedule-table.sql
```

Verify installation:
```sql
SELECT * FROM lesson_schedule LIMIT 1;
```

### 2. Dependencies
No additional npm packages required. Uses existing dependencies:
- Next.js 14+
- Supabase client
- React hooks

### 3. File Structure
All files are ready to use:
```
src/app/
  api/lesson-schedule/route.js       ✓ API endpoints
  facilitator/calendar/
    page.js                           ✓ Main page
    LessonCalendar.js                 ✓ Calendar UI
    LessonPicker.js                   ✓ Lesson picker
  learn/lessons/page.js               ✓ Updated (integrated)
  facilitator/page.js                 ✓ Updated (nav link)
src/lib/scheduleUtils.js              ✓ Utilities
scripts/add-lesson-schedule-table.sql ✓ Migration
docs/lesson-calendar-feature.md      ✓ Full docs
```

## Usage

### For Facilitators
1. Navigate to `/facilitator`
2. Click **Calendar** (requires premium)
3. Select learner
4. Click date, schedule lessons

### For Learners
No setup needed. Scheduled lessons appear automatically on their date.

## Testing Locally

```bash
# 1. Ensure dev server is running
npm run dev

# 2. Navigate to http://localhost:3001/facilitator/calendar

# 3. Test scheduling:
#    - Select a learner
#    - Click today's date
#    - Schedule a lesson
#    - Verify it appears in badge count

# 4. Test learner view:
#    - Navigate to /learn
#    - Select the same learner
#    - Go to /learn/lessons
#    - Verify scheduled lesson appears
```

## Deployment Checklist

- [ ] Run database migration in production Supabase
- [ ] Verify RLS policies are enabled
- [ ] Test API endpoints return 200
- [ ] Deploy code to production
- [ ] Test facilitator calendar page loads
- [ ] Test scheduling and removal
- [ ] Verify learner sees scheduled lessons
- [ ] Test with multiple learners
- [ ] Verify premium gating works

## Common Issues

**"Cannot schedule lessons"**
→ Approve lessons first at `/facilitator/lessons`

**"Premium feature" message**
→ Add `facilitatorTools` to profile entitlements

**Lessons not appearing for learner**
→ Check scheduled_date matches today's date (UTC)

**Calendar not loading**
→ Verify `lesson_schedule` table exists in database

## Support

Check full documentation: `docs/lesson-calendar-feature.md`
