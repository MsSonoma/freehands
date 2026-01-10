# Lesson Validation

## How It Works

Automatically validates generated lessons and improves quality using a two-call approach that stays within Vercel's 60-second timeout limit. User sees progress via toast notifications, and quality issues are fixed transparently before lesson is finalized.

**Flow:**
```
User: "Generate Lesson"
  ↓
Toast: "Generating lesson..." 
  ↓
API Call 1: /api/facilitator/lessons/generate (30-60s)
  ↓
Toast: "Validating lesson quality..."
  ↓
Frontend Validation: lessonValidation.js checks quality (<1s)
  ↓
IF issues found:
  Toast: "Improving lesson quality..."
  ↓
  API Call 2: /api/facilitator/lessons/request-changes (30-60s)
  ↓
Toast: "Lesson ready!" ✓
```

**Purpose**: Ensures high-quality lessons without timeout errors. More acceptable answers = more lenient grading = better student experience. Each call stays under 60s, user sees transparent progress.

## Validation Rules

**Critical Issues (blocks until fixed):**
1. **Short Answer questions**: Must have 3+ acceptable answers each
2. **Fill-in-the-Blank questions**: Must have 3+ acceptable answers each
3. **True/False questions**: Must have complete question text
4. **Multiple Choice questions**: Must have exactly 4 choices
5. **Question counts**: Each type needs 10+ questions

**Warnings (logged but doesn't retry):**
- Missing or insufficient vocabulary (< 5 terms)
- Brief teaching notes (< 50 characters)
- No sample questions

**Change request format** (sent to API if issues found):
```
"Please improve this lesson by fixing the following quality issues:
- Question 3 has only 1 acceptable answer. Add 2 more plausible variations.
- Question 7 is missing question text for true/false.
...
Return the full, improved lesson JSON."
```

## Integration Points

**Lesson Maker** (`/facilitator/generator`, implemented in `src/app/facilitator/generator/page.js`):
1. User fills form and clicks "Generate Lesson"
2. Toast: "Generating lesson..."
3. Call `/api/facilitator/lessons/generate`
4. Validate with `lessonValidation.validateLesson()`
5. If issues: Toast "Improving quality...", call `/api/facilitator/lessons/request-changes`
6. Toast: "Lesson ready!"

**Legacy route:** `/facilitator/generator/lesson-maker` redirects to `/facilitator/generator`.

**Mr. Mentor** (`src/app/api/counselor/route.js`):
1. User: "Create a 5th grade science lesson on photosynthesis"
2. Mr. Mentor calls `generate_lesson` function
3. Backend validates lesson automatically
4. If issues: Make second call to fix quality
5. Mr. Mentor confirms completion with improved lesson

## Related Brain Files

- **[lesson-editor.md](lesson-editor.md)** - Validation runs automatically on lesson editor save
- **[mr-mentor-conversation-flows.md](mr-mentor-conversation-flows.md)** - Mr. Mentor auto-validates generated lessons

## Key Files

- `src/app/lib/lessonValidation.js` - Validation logic, critical issue checks, change request builder
- `src/components/Toast.jsx` - Toast notification component
- `src/app/facilitator/generator/page.js` - Manual generation UI with validation flow
- `src/app/api/counselor/route.js` - Mr. Mentor's automatic validation + retry logic
- `src/app/api/facilitator/lessons/generate/route.js` - Generation endpoint
- `src/app/api/facilitator/lessons/request-changes/route.js` - Improvement endpoint

## What NOT To Do

**DON'T block on warnings** - Only critical issues trigger retry. Warnings are logged but don't block lesson creation.

**DON'T exceed 60s per call** - Each API call must stay under Vercel timeout. Split into two calls rather than one long call.

**DON'T skip validation in Mr. Mentor flow** - Both manual (Lesson Maker) and conversational (Mr. Mentor) generation must validate.

**DON'T regenerate from scratch on retry** - Second call uses "request-changes" approach: "Fix these specific issues" not "regenerate entire lesson".

**DON'T show technical errors to user** - Use toasts for user-friendly progress updates. Log validation details to console for debugging.
