# Lesson Quality Auto-Validation & Improvement

## Overview
Automatically validates generated lessons and improves quality using a two-call approach that stays within Vercel's 60-second timeout limit.

## How It Works

### Flow
```
User: "Generate Lesson"
  ↓
Toast: "Generating lesson..." 
  ↓
API Call 1: /api/facilitator/lessons/generate (30-60s)
  ↓
Toast: "Validating lesson quality..."
  ↓
Frontend Validation: Check quality (<1s)
  ↓
IF issues found:
  Toast: "Improving lesson quality..."
  ↓
  API Call 2: /api/facilitator/lessons/request-changes (30-60s)
  ↓
Toast: "Lesson ready!" ✓
```

### Each API call stays under 60s timeout
### User sees progress with toast notifications
### Automatic quality improvement happens transparently

## Validation Checks

### Critical Issues (blocks until fixed):
1. **Short Answer questions**: Must have 3+ acceptable answers each
2. **Fill-in-the-Blank questions**: Must have 3+ acceptable answers each
3. **True/False questions**: Must have complete question text
4. **Multiple Choice questions**: Must have exactly 4 choices
5. **Question counts**: Each type needs 10+ questions

### Warnings (logged but doesn't retry):
- Missing or insufficient vocabulary (< 5 terms)
- Brief teaching notes (< 50 characters)
- No sample questions

## Files Changed

### New Files
- `src/app/lib/lessonValidation.js` - Validation logic and change request builder
- `src/components/Toast.jsx` - Toast notification component

### Modified Files
- `src/app/facilitator/tools/lesson-maker/page.js` - Added validation + auto-retry flow with toasts
- `src/app/api/counselor/route.js` - Added validation + auto-retry to Mr. Mentor's lesson generation

## Usage

### Lesson Maker (Manual)
1. Fill out the form
2. Click "Generate Lesson"
3. Watch toast notifications for progress
4. If issues found, automatic second call improves quality
5. Lesson ready with optimized quality

### Mr. Mentor (Conversational)
1. "Create a 5th grade science lesson on photosynthesis"
2. Mr. Mentor generates lesson
3. Backend automatically validates and fixes quality issues
4. Mr. Mentor confirms completion

## Benefits
- ✅ Better lesson quality (more acceptable answers = more lenient grading)
- ✅ No timeout issues (each call < 60s)
- ✅ Transparent to user (toasts show progress)
- ✅ Works for both manual and Mr. Mentor generation
- ✅ Minimal cost (4o-mini is cheap, auto-fix is worth it)

## Testing
Generate lessons and verify:
1. Toast notifications appear in correct order
2. Lessons with issues get auto-fixed (check SA/FITB have 3+ answers)
3. Lessons that pass validation first time show "Lesson ready!" immediately
4. No timeout errors
5. Works in both Lesson Maker and Mr. Mentor

## Future Enhancements
- Add validation results to lesson metadata
- Show validation score in generated lessons list
- Allow manual re-validation and fixes
- Track improvement metrics (% lessons that needed fixes)
