# Beta Program Implementation Guide

## Overview

The Beta program provides tutorial gating, session tracking, and post-lesson surveys for Beta-tier subscribers. Implementation follows brand signals with calm, clear copy throughout.

## Implementation Summary

### ✅ Completed Components

#### 1. Database Schema (`docs/beta-tutorial-schema.sql`)
- Added `subscription_tier`, `fac_signup_video_completed_at`, `fac_tutorial_completed_at` to `profiles`
- Created tables: `learner_tutorial_progress`, `lesson_sessions`, `facilitator_notes`, `repeat_events`, `post_lesson_surveys`
- All tables have proper RLS policies restricting access to facilitator-owned data
- Created `session_metrics` view for aggregated analytics

#### 2. Feature Flags (`src/app/lib/betaConfig.js`)
- `FORCE_TUTORIALS_FOR_BETA`: Gates Beta users until tutorials completed (default: true)
- `SURVEY_GOLDEN_KEY_ENABLED`: Requires survey before unlocking golden key (default: true)
- `TUTORIALS_AVAILABLE_FOR_ALL`: Shows tutorials in Help menu for all users (default: true)
- Utility functions for checking Beta status and requirements

#### 3. Guard Utilities (`src/app/lib/tutorialGuards.js`)
- `checkFacilitatorTutorialGate()`: Validates signup video and tutorial completion
- `checkLearnerTutorialGate()`: Validates learner first-time tutorial
- `checkSurveyGate()`: Validates post-lesson survey completion
- Mark-complete functions for each gate type
- Returns actionable redirect paths for each gate state

#### 4. Tutorial Components

**Facilitator Signup Video** (`src/components/SignupVideoGate.jsx`)
- Video player with progress tracking (must watch 90%)
- Calm on-brand copy: "Welcome to Ms. Sonoma"
- Marks `fac_signup_video_completed_at` on completion
- Route: `/facilitator/onboarding/video`

**Facilitator Tutorial** (`src/components/FacilitatorTutorial.jsx`)
- Step-by-step walkthrough of facilitator tools
- Progress indicator and back/next navigation
- Clear, concise instructions aligned with brand signals
- Marks `fac_tutorial_completed_at` on completion
- Route: `/facilitator/onboarding/tutorial`

**Learner Tutorial** (`src/components/LearnerTutorial.jsx`)
- Kid-friendly first-time tutorial
- Shows how to interact with Ms. Sonoma
- Friendly tone: "Hi! I am Ms. Sonoma..."
- Tracks completion in `learner_tutorial_progress`
- Route: `/session/tutorial?learner={learnerId}`

#### 5. Post-Lesson Survey (`src/components/PostLessonSurvey.jsx`)
- Three-step flow: password re-auth → survey → completion
- Collects: environment, learning style, fatigue, struggles, notes
- Unlocks golden key on submission
- Professional, calm tone throughout
- Route: `/facilitator/survey?session={sessionId}`

#### 6. Session Tracking (`src/app/lib/sessionTracking.js`, `src/app/hooks/useSessionTracking.js`)
- `startLessonSession()`: Creates session record with start time
- `endLessonSession()`: Sets end time for duration calculation
- `logRepeatEvent()`: Tracks "Repeat" button clicks per sentence
- `addFacilitatorNote()`: Timestamped notes during lessons
- React hook with auto-start/end lifecycle management

#### 7. Guard Wrapper (`src/components/TutorialGuard.jsx`)
- HOC that wraps facilitator pages
- Automatically checks gates and redirects
- Shows loading spinner during check
- Fails open on errors to avoid blocking

## Deployment Steps

### 1. Database Setup
```sql
-- Run in Supabase SQL Editor
\i docs/beta-tutorial-schema.sql
```

### 2. Assign Beta Users
```sql
-- Manual admin action in Supabase
UPDATE public.profiles 
SET subscription_tier = 'Beta' 
WHERE email = 'beta-user@example.com';
```

### 3. Add Facilitator Video
Place facilitator signup video at:
```
/public/videos/facilitator-signup.mp4
```

### 4. Integrate Guards
Wrap facilitator pages with `<TutorialGuard>`:
```jsx
import TutorialGuard from '@/components/TutorialGuard';

export default function FacilitatorPage() {
  return (
    <TutorialGuard>
      {/* page content */}
    </TutorialGuard>
  );
}
```

Example: Already integrated in `/facilitator/learners/page.js`

### 5. Add Session Tracking to Lesson Pages
```jsx
import { useSessionTracking } from '@/app/hooks/useSessionTracking';

function SessionPage({ learnerId, lessonId }) {
  const { sessionId, logRepeat, addNote } = useSessionTracking(learnerId, lessonId);
  
  // Use logRepeat() on repeat button click
  // Use addNote(text) for facilitator notes
}
```

### 6. Add Survey Link to Golden Key
When golden key is clicked and survey not completed:
```jsx
if (surveyRequired && !surveyCompleted) {
  router.push(`/facilitator/survey?session=${sessionId}`);
}
```

## User Flows

### Beta Facilitator First Sign-In
1. Signs up / logs in
2. **Gate 1**: Redirected to `/facilitator/onboarding/video`
   - Must watch signup video (90%)
   - Click "Continue" → marks video completed
3. **Gate 2**: Redirected to `/facilitator/onboarding/tutorial`
   - Interactive walkthrough of facilitator tools
   - Click "Get Started" → marks tutorial completed
4. Redirected to `/facilitator/learners`
5. Can now use all facilitator features

### Beta Learner First Lesson
1. Facilitator selects learner and clicks "Begin"
2. **Gate**: System checks `learner_tutorial_progress`
3. If first time: Redirected to `/session/tutorial?learner={id}`
   - Kid-friendly tutorial
   - Click "Start Lesson" → marks tutorial completed
4. Proceeds to actual lesson

### Post-Lesson Survey (Golden Key)
1. Lesson ends, facilitator clicks golden key
2. **Gate**: System checks if survey completed for this session
3. If not: Redirected to `/facilitator/survey?session={id}`
   - **Step 1**: Password re-authentication (security)
   - **Step 2**: Survey form (environment, learning, fatigue, struggles)
   - **Step 3**: Confirmation and unlock
4. Golden key unlocks, data available

### Non-Beta Users
- Can access tutorials via Help menu (when implemented)
- Not blocked by any gates
- Session tracking still works for analytics
- No survey requirement

## Feature Flags (Disable Gates Post-Beta)

In `src/app/lib/betaConfig.js`:
```javascript
export const BETA_CONFIG = {
  FORCE_TUTORIALS_FOR_BETA: false,  // Disable tutorial gates
  SURVEY_GOLDEN_KEY_ENABLED: false,  // Disable survey requirement
  TUTORIALS_AVAILABLE_FOR_ALL: true, // Keep tutorials accessible
};
```

## Database Queries for Admins

**Check Beta users:**
```sql
SELECT email, subscription_tier, 
       fac_signup_video_completed_at, 
       fac_tutorial_completed_at
FROM public.profiles 
WHERE subscription_tier = 'Beta';
```

**Session analytics:**
```sql
SELECT * FROM public.session_metrics 
WHERE learner_id = 'learner-uuid'
ORDER BY started_at DESC;
```

**Repeat counts by sentence:**
```sql
SELECT sentence_id, COUNT(*) as repeat_count
FROM public.repeat_events
WHERE session_id = 'session-uuid'
GROUP BY sentence_id
ORDER BY repeat_count DESC;
```

**Survey completion rate:**
```sql
SELECT 
  COUNT(DISTINCT s.id) as total_sessions,
  COUNT(DISTINCT ps.session_id) as surveyed_sessions,
  ROUND(COUNT(DISTINCT ps.session_id)::numeric / COUNT(DISTINCT s.id) * 100, 2) as completion_rate
FROM public.lesson_sessions s
LEFT JOIN public.post_lesson_surveys ps ON ps.session_id = s.id
WHERE s.started_at >= NOW() - INTERVAL '30 days';
```

## Brand Signals Compliance

All user-facing copy follows brand signals:
- **Calm tone**: No hype, no intensity escalation
- **Clear**: Simple sentences, 6-12 words
- **Focused**: One idea per sentence
- **Preferred lexicon**: calm, clear, focus, steps, notice, practice, steady
- **Avoided**: amazing, awesome, epic, crushed, nailed, genius
- **ASCII-only**: Straight quotes, no fancy punctuation

## Next Steps

### TODO: Help Menu Integration
Create a Help/Tutorial menu component:
```jsx
<HelpMenu>
  <TutorialOption title="Facilitator Tools" onClick={() => router.push('/help/facilitator-tutorial')} />
  <TutorialOption title="Getting Started" onClick={() => router.push('/help/video')} />
  <TutorialOption title="Learner Guide" onClick={() => router.push('/help/learner-tutorial')} />
</HelpMenu>
```

Routes should show tutorials without gating for all users.

### Optional Enhancements
- Add session duration warnings at 45min, 60min marks
- Export session metrics as CSV for facilitator download
- Add note-taking hotkey during lessons
- Show fatigue trends across multiple sessions
- Email weekly analytics summary to facilitators

## Files Created

### Database
- `docs/beta-tutorial-schema.sql`

### Configuration
- `src/app/lib/betaConfig.js`
- `src/app/lib/tutorialGuards.js`
- `src/app/lib/sessionTracking.js`

### Components
- `src/components/SignupVideoGate.jsx`
- `src/components/FacilitatorTutorial.jsx`
- `src/components/LearnerTutorial.jsx`
- `src/components/PostLessonSurvey.jsx`
- `src/components/TutorialGuard.jsx`

### Hooks
- `src/app/hooks/useSessionTracking.js`

### Pages
- `src/app/facilitator/onboarding/video/page.js`
- `src/app/facilitator/onboarding/tutorial/page.js`
- `src/app/session/tutorial/page.js`
- `src/app/facilitator/survey/page.js`

### Modified
- `src/app/facilitator/learners/page.js` (added TutorialGuard wrapper)

## Support

For questions or issues:
1. Check gate logs in browser console (`[tutorialGuards]`, `[sessionTracking]`)
2. Verify feature flags in `betaConfig.js`
3. Confirm database schema applied in Supabase
4. Check RLS policies allow facilitator access to own data
5. Verify Beta tier assigned correctly in profiles table
