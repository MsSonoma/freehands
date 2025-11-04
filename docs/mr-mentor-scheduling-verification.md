# Mr. Mentor Function Calling - Lesson Scheduling Verification

## Question
Does Mr. Mentor's conversation-based lesson scheduling (via function calling) correctly align with the filesystem?

## Answer
**YES** ✅ - Mr. Mentor's `schedule_lesson` function correctly uses full lesson filenames with `.json` extension and applies normalization.

---

## How Mr. Mentor Schedules Lessons

### Flow Overview

1. **Facilitator asks** → "Schedule the division lesson for Emma on Monday"
2. **Mr. Mentor searches** → Calls `search_lessons` function
3. **Gets lesson key** → `lessonKey: "generated/4th_Division_Practice_Intermediate.json"`
4. **Schedules** → Calls `schedule_lesson` with the lesson key
5. **Normalization applied** → Key is normalized before saving to database
6. **Database stores** → `generated/4th_Division_Practice_Intermediate.json`

---

## Code Verification

### Step 1: Search Lessons (`search_lessons`)

**File:** `src/app/api/counselor/route.js` (lines 571-680)

```javascript
async function executeSearchLessons(args, request, toolLog) {
  // Fetches lessons from /api/lessons/${subject}
  const lessonResponse = await fetch(lessonUrl)
  const lessons = await lessonResponse.json()
  
  // For each lesson returned by API:
  filtered.forEach(lesson => {
    const combinedKey = `${subj}/${lesson.file}`  // ← lesson.file includes .json
    const normalizedKey = normalizeLessonKey(combinedKey)
    
    allLessons.push({
      title: lesson.title,
      lessonKey: normalizedKey,  // ← This is what gets returned to GPT
      ...
    })
  })
}
```

**Result:** GPT receives `lessonKey` like:
- `math/4th_Multi_Digit_Multiplication_Beginner.json`
- `science/5th_Earth_Science_Water_Cycle_Systems_Beginner.json`
- `generated/4th_Division_Practice_Intermediate.json`

---

### Step 2: Generate Lesson (`generate_lesson`)

**File:** `src/app/api/counselor/route.js` (lines 851-911)

```javascript
async function executeLessonGeneration(args, request, toolLog) {
  // Calls /api/facilitator/lessons/generate
  const genResponse = await generatePOST(mockRequest)
  const responseData = await genResponse.json()
  
  // responseData.file contains full filename: "4th_Math_Practice_Intermediate.json"
  const lessonKey = `facilitator/${responseData.file}`
  
  return {
    success: true,
    lessonFile: responseData.file,
    lessonKey: lessonKey,  // ← e.g., "facilitator/4th_Math_Practice_Intermediate.json"
    ...
  }
}
```

**Note:** Uses `facilitator/` prefix which gets normalized to `generated/` in the next step.

---

### Step 3: Schedule Lesson (`schedule_lesson`)

**File:** `src/app/api/counselor/route.js` (lines 939-1039)

```javascript
async function executeLessonScheduling(args, request, toolLog) {
  // Receives args.lessonKey from GPT (from search or generate results)
  
  // CRITICAL: Normalization applied here
  const normalizedLessonKey = normalizeLessonKey(args.lessonKey)
  
  // Look up learner by name
  const matchingLearner = learners.find(l => 
    l.name?.toLowerCase() === args.learnerName.toLowerCase()
  )
  
  // Call the schedule API
  const schedResponse = await fetch('/api/lesson-schedule', {
    method: 'POST',
    body: JSON.stringify({
      learnerId: matchingLearner.id,
      lessonKey: normalizedLessonKey,  // ← Normalized key saved to DB
      scheduledDate: args.scheduledDate
    })
  })
  
  return {
    success: true,
    lessonKey: normalizedLessonKey,
    ...
  }
}
```

**Normalization examples:**
- `facilitator/4th_Math.json` → `generated/4th_Math.json`
- `math/4th_Multiplication.json` → `math/4th_Multiplication.json` (unchanged)
- `generated/4th_Division.json` → `generated/4th_Division.json` (unchanged)

---

## Normalization Function

**File:** `src/app/lib/lessonKeyNormalization.js`

```javascript
export function normalizeLessonKey(rawKey) {
  let key = rawKey.trim().replace(/\\/g, '/')
  
  // Map old prefixes to new ones
  if (lowerKey.startsWith('facilitator/')) {
    key = `generated/${key.slice('facilitator/'.length)}`
  }
  
  // ... other normalization rules
  
  return key
}
```

This ensures:
- `facilitator/` → `generated/`
- `facilitator-lessons/` → `generated/`
- Handles legacy key formats
- All paths end up using the correct filesystem location

---

## Function Definition (What GPT Sees)

**File:** `src/app/api/counselor/route.js` (lines 464-476)

```javascript
schedule_lesson: {
  name: 'schedule_lesson',
  purpose: 'Add a lesson to a learner\'s calendar for a specific date',
  parameters: {
    learnerId: 'Required. The learner\'s ID',
    lessonKey: 'Required. Format: "subject/filename.json" (from search or generate)',
    scheduledDate: 'Required. YYYY-MM-DD format'
  },
  returns: 'Success confirmation with scheduled date and lesson key',
  example: '{learnerId: "abc123", lessonKey: "math/Multiplication_Basics.json", scheduledDate: "2025-12-18"}'
}
```

GPT is explicitly told:
- `lessonKey` must be in format `subject/filename.json`
- Get it from `search_lessons` results or after `generate_lesson`

---

## Complete Example Flow

### Scenario: "Generate a 4th grade math lesson on division and schedule it for Emma on Friday"

1. **GPT calls `generate_lesson`:**
   ```json
   {
     "title": "Division Practice",
     "subject": "math",
     "grade": "4th",
     "difficulty": "Intermediate"
   }
   ```

2. **Generation returns:**
   ```json
   {
     "success": true,
     "file": "4th_Division_Practice_Intermediate.json",
     "lessonKey": "facilitator/4th_Division_Practice_Intermediate.json"
   }
   ```

3. **GPT calls `schedule_lesson`:**
   ```json
   {
     "learnerName": "Emma",
     "lessonKey": "facilitator/4th_Division_Practice_Intermediate.json",
     "scheduledDate": "2025-11-08"
   }
   ```

4. **Scheduling normalizes:**
   ```javascript
   normalizeLessonKey("facilitator/4th_Division_Practice_Intermediate.json")
   // Returns: "generated/4th_Division_Practice_Intermediate.json"
   ```

5. **Database stores:**
   ```
   lesson_key: "generated/4th_Division_Practice_Intermediate.json"
   scheduled_date: "2025-11-08"
   learner_id: "dc8adab1-495d-4f0d-9bfa-da82bd5e746a"
   ```

6. **Learner page loads:**
   - Fetches scheduled lessons for today
   - Gets `generated/4th_Division_Practice_Intermediate.json`
   - Loads lesson from `/api/lessons/generated`
   - Matches key → Lesson appears with 📅 badge

✅ **Everything matches!**

---

## Why It Works

1. **Consistent API responses** - All lesson APIs return `file` property with full filename
2. **Function calling uses exact keys** - GPT passes the `lessonKey` from search/generate directly to schedule
3. **Normalization layer** - Handles legacy formats and maps prefixes correctly
4. **Database stores normalized keys** - Always uses the canonical format

---

## Potential Issues (None Found)

I checked for these potential problems:
- ❌ Truncated filenames → Not an issue, full filename used
- ❌ Missing .json extension → Not an issue, always included
- ❌ Wrong prefix (facilitator vs generated) → Not an issue, normalization handles it
- ❌ Manual key construction → Not an issue, uses API responses

---

## Conclusion

**Mr. Mentor's function-based scheduling is CORRECT** ✅

All lesson keys flow through the same pipeline:
1. API returns full filename with `.json`
2. Function calling receives/passes exact key
3. Normalization applied before database save
4. Database contains correct, filesystem-aligned key

The only issues found were **legacy data** from before this system was built, which have been fixed by the repair script.

---

**Verified:** November 4, 2025  
**Files Checked:**
- `src/app/api/counselor/route.js` (Mr. Mentor functions)
- `src/app/api/facilitator/lessons/generate/route.js` (Lesson generation)
- `src/app/api/lesson-schedule/route.js` (Scheduling API)
- `src/app/lib/lessonKeyNormalization.js` (Normalization)
- `src/app/api/lessons/[subject]/route.js` (Lesson listing)

**Status:** ✅ All verified correct
