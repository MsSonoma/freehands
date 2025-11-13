# Visual Aids Database Migration

## Problem
Previously, visual aids were stored in the lesson JSON files themselves. This meant:
- Facilitators couldn't customize visual aids for **public lessons** (math, science, etc.) without copying the entire lesson
- Each facilitator couldn't have their own personalized visual aids
- Visual aids were tied to the lesson file, not the facilitator

## Solution
Visual aids are now stored in a **separate Supabase table** (`visual_aids`) with facilitator-level isolation.

## Architecture

### Database Schema
```sql
CREATE TABLE visual_aids (
  id UUID PRIMARY KEY,
  facilitator_id UUID REFERENCES auth.users(id),
  lesson_key TEXT NOT NULL,  -- e.g., "math/4th-fractions.json"
  generated_images JSONB,     -- All 12 generated images
  selected_images JSONB,      -- Up to 3 selected for sessions
  generation_count INTEGER,   -- Tracks 0-4 generations used
  max_generations INTEGER DEFAULT 4,
  UNIQUE(facilitator_id, lesson_key)
);
```

### Data Flow

#### Editing Lessons (Facilitator View)
1. **Load**: GET `/api/visual-aids/load?lessonKey=...`
   - Returns facilitator's visual aids for this specific lesson
   - Returns empty state if none exist yet
   
2. **Generate**: POST `/api/visual-aids/generate`
   - Generates 3 images using lesson teaching notes
   - Auto-saves immediately to database
   
3. **Generate More**: (up to 4 generations = 12 images total)
   - Auto-saves after each generation
   
4. **Select Images**: User picks up to 3 from the pool of 12
   - Auto-saves selection to database
   - `generated_images`: All 12 images available
   - `selected_images`: The 3 chosen for sessions

#### Session View (Learner Experience)
1. **Load**: GET `/api/visual-aids/load?lessonKey=...`
   - Loads facilitator's `selected_images` (max 3)
   - Shows in video panel with 🖼️ button
   - Ms. Sonoma can explain each image

### Key Benefits

✅ **Works with public lessons**: Facilitators can add visual aids to any lesson without copying
✅ **Facilitator-specific**: Each facilitator has their own visual aids per lesson
✅ **Persistent**: Survives page refresh, stored in database
✅ **Generation limits enforced**: 4 generations max, tracked in database
✅ **Separate storage**: Visual aids don't bloat lesson files
✅ **Privacy**: RLS policies ensure facilitators only see their own data

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/visual-aids/load` | GET | Load facilitator's visual aids for a lesson |
| `/api/visual-aids/save` | POST | Save/update visual aids for a lesson |
| `/api/visual-aids/generate` | POST | Generate AI images (existing endpoint) |

### Migration Notes

**No migration required** for existing data because:
- Old system stored visual aids in lesson JSON files (only for facilitator-created lessons)
- New system uses database for all lessons (public + facilitator)
- Public lessons never had visual aids before
- Facilitator lessons will start fresh with new system

**To deploy**:
1. Run `docs/visual-aids-schema.sql` in Supabase SQL editor
2. Deploy updated code
3. Facilitators will start with clean slate (can generate visual aids for any lesson)

### File Changes

**New Files:**
- `docs/visual-aids-schema.sql` - Database schema
- `src/app/api/visual-aids/save/route.js` - Save endpoint
- `src/app/api/visual-aids/load/route.js` - Load endpoint

**Modified Files:**
- `src/app/facilitator/lessons/edit/page.js` - Load/save from database instead of lesson file
- `src/app/session/page.js` - Load visual aids from database separately

**Removed Logic:**
- Removed visual aids fields from lesson JSON save/load
- Removed `visualAidsGenerated`, `visualAids`, `visualAidsGenerationCount` from lesson files
