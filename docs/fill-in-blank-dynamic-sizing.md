# Fill-in-the-Blank Dynamic Sizing Fix

## Problem
Fill-in-the-blank questions in downloadable worksheets and tests used a fixed ratio (66%) to shrink the blank spaces, resulting in tiny spaces for long answers (e.g., 22-character words) and potentially oversized spaces for short answers.

## Solution
Modified the blank sizing algorithm to dynamically scale based on the actual answer length:

### Changes Made
**File:** `src/app/session/page.js`

#### 1. Updated `shrinkFIBBlanks` function
- **Before:** Fixed 66% ratio regardless of answer length
- **After:** Dynamic sizing based on answer character count
  - Formula: `answerLength * 2` underscores (roughly 2 underscores per character)
  - Minimum: 12 underscores (for short answers)
  - Maximum: 60 underscores (prevents overflow for very long answers)
  - Fallback: 66% of original blank if answer length is unknown

#### 2. Updated `renderLineText` function
- Now extracts the answer length from question data before sizing the blank
- Checks multiple possible answer fields: `answer`, `expected`, `correct`, `key`
- Supports answer arrays (uses longest answer for sizing)
- Passes answer length to `shrinkFIBBlanks` for proper sizing

### Example Sizing
- 5-character answer ("apple"): 12 underscores (minimum)
- 10-character answer ("strawberry"): 20 underscores
- 22-character answer ("counterclockwise rotation"): 44 underscores
- 30+ character answer: 60 underscores (maximum cap)

### Benefits
1. **Proportional spacing:** Blank size matches answer length
2. **No tiny spaces:** Long words get adequate writing space
3. **No giant spaces:** Short words don't get oversized blanks
4. **Backward compatible:** Falls back to 66% ratio if answer length unavailable
5. **Overflow protection:** Maximum cap prevents page layout issues

### Affected Documents
- Worksheet PDFs (student-facing)
- Test PDFs (student-facing)

### Not Affected
- Answer key PDFs (show actual answers, not blanks)
- On-screen question display
- Comprehension/exercise phases (different rendering)
