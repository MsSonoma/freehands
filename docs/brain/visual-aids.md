# Visual Aids Generation System

## How It Works

### Generation Flow

Visual aids are AI-generated educational images created using OpenAI's DALL-E 3. The system generates 3 images per request based on lesson teaching notes.

**Request → Prompt Creation → Image Generation → Description → Storage**

1. **Request**: User clicks "Generate Visual Aids" from lesson editor or counselor
2. **Prompt Creation** (`/api/visual-aids/generate`):
   - GPT-4o-mini converts teaching notes into 3 distinct image prompts
   - Each prompt describes ONLY visual elements (scenes, objects, people, nature)
   - System prompt explicitly forbids text/labels/words in descriptions
   - User prompt reinforces: "absolutely no text or labels in the image"
3. **Image Generation** (DALL-E 3):
   - Enhanced prompt sent to DALL-E with suffix: "IMPORTANT: This image must contain absolutely NO text, words, letters, numbers, labels, captions, signs, or any written language of any kind. Show only visual elements."
   - Standard quality, 1024x1024, vivid style
4. **Kid-Friendly Description**:
   - GPT-4o-mini converts technical prompt into warm, 2-3 sentence explanation
   - Ms. Sonoma reads this aloud when learner clicks "Explain" during session
   - Markdown formatting stripped (asterisks, underscores, headers)
5. **Storage**:
   - DALL-E returns temporary URL (expires in 1 hour)
   - `/api/visual-aids/save` downloads image and uploads to Supabase `visual-aids` bucket
   - **Retry logic**: Failed downloads retry 3 times with exponential backoff (1s, 2s, 4s delays)
   - Permanent URL stored in `visual_aids` table with `lesson_key`, `facilitator_id`
   - Images that fail all retry attempts are excluded from saved set

### Download Retry Logic

DALL-E temporary URLs expire after 1 hour. The save endpoint includes retry logic with exponential backoff to handle transient failures:

- **3 total attempts**: Initial download + 2 retries
- **Delays**: 1s, 2s, 4s between attempts
- **Retryable errors**: Network timeouts (ETIMEDOUT, ECONNRESET), HTTP 403/404 (expired URLs), HTTP 429 (rate limits), HTTP 5xx (server errors)
- **Non-retryable errors**: HTTP 400/401 (bad request/auth), invalid URL format
- **Timeout protection**: 25s max execution time on Vercel (5s buffer under 30s limit)
- **Failure handling**: Images that fail all retry attempts are filtered out and NOT saved to database

**Why retry logic matters:**
- Network glitches are common and usually resolve within seconds
- DALL-E URLs occasionally return 403 temporarily even when not expired
- Supabase Storage can have transient upload failures
- Without retries, facilitators would lose generated images due to temporary network issues

**What happens on failure:**
- Failed images are excluded from the saved set
- Successful images are still saved (partial save is better than total failure)
- Clear error message if ALL images fail: "DALL-E URLs may have expired. Please regenerate."
- Detailed logs for debugging (attempt number, error type, retry delays)

### Critical Constraint: NO TEXT IN IMAGES

**Problem**: DALL-E cannot reliably render legible text. Any attempt to include words, labels, diagrams with text, or written language results in gibberish that looks like text but is completely illegible.

**Solution**: Prompt engineering enforces visual-only content at 3 layers:

1. **System prompt** (GPT-4o-mini prompt creation):
   - "NEVER include text, words, letters, labels, captions, signs, writing, numbers, or any written language"
   - "Describe only visual elements like colors, shapes, objects, people, animals, and scenery"
   - "Use phrases like 'a colorful scene showing' or 'an illustration of' rather than 'diagram' or 'chart'"

2. **User prompt** (GPT-4o-mini prompt creation):
   - "Describe a visual scene with objects and actions only - absolutely no text or labels in the image"
   - "Use only visual elements - no text, labels, or words anywhere in the image"

3. **DALL-E prompt enhancement**:
   - Every prompt sent to DALL-E gets suffix appended: "IMPORTANT: This image must contain absolutely NO text, words, letters, numbers, labels, captions, signs, or any written language of any kind. Show only visual elements."

### Rewrite System Integration

`/api/ai/rewrite-text` has two visual-aid-specific purposes:

**`visual-aid-prompt-from-notes`**:
- Converts teaching notes into guidance for generating 3 varied images
- System prompt: "You understand that AI-generated images with text are illegible and must be avoided"
- Suggests "visual scenes, objects, and actions (not text or labels)"

**`generation-prompt`**:
- Improves existing image prompts for DALL-E 3
- System prompt: "You know that AI-generated text in images is gibberish and must be completely avoided"
- User prompt: "Suggest visual metaphors or real-world examples instead of diagrams with text"

Both purposes reinforce the no-text constraint at the prompt improvement layer.

### Session Display

During lesson sessions, visual aids appear in `SessionVisualAidsCarousel`:
- Learner clicks Visual Aids button (picture icon)
- Full-screen carousel shows images with left/right navigation
- "Explain" button triggers Ms. Sonoma to read the kid-friendly description via TTS
- Visual aids are lesson-specific, loaded by `lesson_key` (normalized to strip folder prefixes)

## What NOT To Do

**Never use these terms in prompts or prompt instructions:**
- ❌ "diagram"
- ❌ "chart" 
- ❌ "visual aid" (ironically, this phrase implies labeled diagrams)
- ❌ "infographic"
- ❌ "labeled illustration"
- ❌ "with text explaining"
- ❌ "include words for"

**Instead use:**
- ✅ "a colorful scene showing"
- ✅ "an illustration of"
- ✅ "a photograph of"
- ✅ "objects and people demonstrating"
- ✅ "a real-world example with"

**Never request text/labels:**
- ❌ Don't ask DALL-E to include labels, captions, signs, writing, letters, numbers
- ❌ Don't describe "a poster with the word X"
- ❌ Don't ask for "step-by-step instructions with text"
- ❌ Don't include teaching notes verbatim in prompts (often contain text-heavy concepts)

**Never trust DALL-E URLs long-term:**
- ❌ DALL-E temporary URLs expire after 1 hour
- ❌ Never save expired DALL-E URLs to database
- ❌ Never fall back to original URL if download fails
- ✅ Always download and re-upload to Supabase permanent storage immediately
- ✅ Display from permanent Supabase bucket URLs, not DALL-E URLs
- ✅ Filter out images that fail all retry attempts (don't save broken URLs)

**Never skip the no-text enforcement suffix:**
- Every DALL-E prompt must include the explicit no-text suffix
- This is the final guardrail against text appearing in images
- Without it, even carefully worded prompts can accidentally trigger text rendering

## Key Files

### API Routes
- **`src/app/api/visual-aids/generate/route.js`** - Main generation endpoint
  - Prompt creation (GPT-4o-mini)
  - DALL-E 3 image generation with no-text suffix
  - Kid-friendly description generation
  - Returns array of `{ url, prompt, description, id }`

- **`src/app/api/visual-aids/save/route.js`** - Permanent storage
  - Downloads DALL-E image from temporary URL
  - Uploads to Supabase `visual-aids` bucket
  - Saves metadata to `lesson_visual_aids` table
  - Returns permanent URL

- **`src/app/api/visual-aids/load/route.js`** - Fetch by lesson
  - Query: `?lessonKey=<key>`
  - Returns all visual aids for a lesson with permanent URLs

- **`src/app/api/visual-aids/rewrite-description/route.js`** - Description improvement
  - Converts user descriptions into kid-friendly Ms. Sonoma language

- **`src/app/api/ai/rewrite-text/route.js`** - Prompt improvement
  - Purpose: `visual-aid-prompt-from-notes` - converts teaching notes to image guidance
  - Purpose: `generation-prompt` - improves existing prompts for DALL-E

### UI Components
- **`src/components/VisualAidsCarousel.jsx`** - Facilitator lesson editor
  - Generate, upload, reorder, delete visual aids
  - Preview with left/right navigation
  - Custom prompt input
  - Rewrite description button

- **`src/app/session/components/SessionVisualAidsCarousel.js`** - Learner session display
  - Full-screen carousel during lesson
  - "Explain" button triggers Ms. Sonoma TTS of description
  - Read-only view (no editing)

### Integration Points
- **`src/app/facilitator/lessons/edit/page.js`** - Lesson editor
  - `handleGenerateVisualAids()` - initiates generation
  - Manages visual aids state and save flow

- **`src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx`** - Mr. Mentor counselor
  - `handleGenerateVisualAids()` - generation from counselor lesson creation

- **`src/app/session/page.js`** - Learner session
  - Loads visual aids by normalized `lessonKey`
  - `onShowVisualAids()` - opens carousel
  - `onExplainVisualAid()` - triggers Ms. Sonoma explanation

### Database
- **Table**: `lesson_visual_aids`
  - `lesson_key` (text) - normalized lesson identifier
  - `facilitator_id` (uuid) - owner
  - `image_url` (text) - permanent Supabase bucket URL
  - `prompt` (text) - DALL-E prompt used
  - `description` (text) - kid-friendly explanation
  - `display_order` (integer) - carousel ordering

- **Storage Bucket**: `visual-aids`
  - Supabase storage for permanent image files
  - Public read access
  - Facilitator write access via RLS

### Documentation
- **`docs/VISUAL_AIDS_IMPLEMENTATION.md`** - Original implementation notes (may contain outdated details)

## Why This Matters

Visual aids significantly improve engagement and comprehension for visual learners, especially in subjects like science and social studies. The no-text constraint is critical because:

1. **Usability**: Images with gibberish text are worse than no images at all
2. **Trust**: Facilitators must trust that generated images will be classroom-appropriate
3. **Efficiency**: Re-generating images due to text gibberish wastes API quota and time

By enforcing visual-only content through layered prompt engineering, the system produces reliably useful educational illustrations that enhance lessons without the cognitive load of trying to decipher illegible text.
