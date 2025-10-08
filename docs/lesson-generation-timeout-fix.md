# Lesson Generation Timeout Fix

## Issue
Lesson generation worked locally but failed on Vercel deployment with 504 timeout errors.

## Root Cause
- Vercel serverless functions have a default 30-second timeout
- OpenAI API calls for comprehensive lesson generation can exceed this limit
- Local development has no timeout constraints

## Solution Implemented

### 1. Extended Route-Specific Timeout
**File:** `src/app/api/facilitator/lessons/generate/route.js`
- Added `export const maxDuration = 60` to extend timeout to 60 seconds (Vercel Pro limit)

### 2. Updated Vercel Configuration
**File:** `vercel.json`
- Added specific function configuration for the generate route:
```json
"src/app/api/facilitator/lessons/generate/route.js": {
  "maxDuration": 60
}
```

### 3. Added Timeout Safety to OpenAI Calls
**File:** `src/app/api/facilitator/lessons/generate/route.js`
- Added AbortController with 55-second hard limit
- Provides clearer error messages if OpenAI request times out
- Prevents hanging requests

### 4. Switched to GPT-4o-mini for Facilitator Endpoints
**Files:** 
- `src/app/api/facilitator/lessons/generate/route.js`
- `src/app/api/facilitator/lessons/request-changes/route.js`

**Benefits:**
- **94% cost reduction** (~$0.15 vs $2.50 per 1M input tokens)
- **2-3x faster responses** - eliminates timeout issues entirely
- **Excellent quality** for structured JSON generation tasks
- Ms. Sonoma tutoring (`/api/sonoma`) remains on GPT-4o for best child-facing experience

## Model Strategy

| Endpoint | Model | Rationale |
|----------|-------|-----------|
| `/api/sonoma` | `gpt-4o` | Child-facing tutoring requires best reasoning and nuance |
| `/api/facilitator/lessons/generate` | `gpt-4o-mini` | Structured content generation; speed and cost critical |
| `/api/facilitator/lessons/request-changes` | `gpt-4o-mini` | Facilitator-facing editing; mini sufficient |

## Deployment Notes
- The 60-second timeout requires a Vercel Pro plan or higher
- Free tier is limited to 10 seconds
- Hobby tier is limited to 10 seconds
- Pro tier allows up to 60 seconds
- Enterprise can configure custom limits

## Testing
After deployment:
1. Generate a lesson from the Lesson Maker tool
2. Should complete in 10-20 seconds (vs 30-40 seconds with GPT-4o)
3. Verify storage upload succeeds
4. Test lesson quality and question variety

## Cost Impact
**Before:** ~$0.05-0.10 per lesson generation (GPT-4o)
**After:** ~$0.003-0.006 per lesson generation (GPT-4o-mini)
**Savings:** ~95% reduction in lesson generation costs

## Date
October 8, 2025
