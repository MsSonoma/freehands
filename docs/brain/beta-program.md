# Beta Program: Tutorial Gating, Survey, and Tracking

**Status**: Canonical  
**Last Updated**: 2025-11-25

## How It Works

The Beta program provides tutorial-style toggles for all users while enforcing mandatory first-time completion for Beta-tier users. It requires facilitator post-lesson survey (with password re-auth) to unlock the golden key, records timestamps for transcripts and notes, counts repeat usage by sentence, and measures lesson time.

### Goal

- Provide tutorial-style toggles for all users
- Enforce mandatory first-time completion for Beta-tier users
- Require facilitator post-lesson survey with password re-auth to unlock golden key
- Record timestamps for transcripts and notes
- Count repeat usage by sentence
- Measure lesson time

### Scope

- Back-end gating
- Supabase fields/tables
- Route guards
- Event logging
- Survey + re-auth flow
- Feature toggles
- Uninstall plan

### Invariants

- Ms. Sonoma remains stateless and instruction-only
- Placeholders never reach Ms. Sonoma
- ASCII-only punctuation
- No UI/tool mentions in Ms. Sonoma payloads
- Developer-only rules live in Copilot instructions

## Targeting and Flags

### Subscription Tier

- Add `subscription_tier` to `profiles` table (nullable text or enum)
- Valid values include `Beta`
- Only admins set this in Supabase

### Feature Flags

**FORCE_TUTORIALS_FOR_BETA** (default: true)
- If user profile has `subscription_tier == 'Beta'`, tutorial completion gates access

**SURVEY_GOLDEN_KEY_ENABLED** (default: true)
- Golden key remains locked until required survey is submitted

**TUTORIALS_AVAILABLE_FOR_ALL** (default: true)
- Non-Beta users may optionally use tutorials but are not blocked

**Uninstall Toggle**: Turning both flags off fully disables gates without data loss

## Gating Rules by Role

### Facilitator (Beta Mandatory)

1. **On first sign-in**: Must watch facilitator signup video to proceed
2. **Before first use of facilitator tools**: Must complete facilitator tutorial

### Learner (Beta Mandatory)

- **On first entry to any lesson** under each learner profile: Must complete learner tutorial once per `learner_id`

### Non-Beta Users

- Tutorials are available as optional guidance
- Do not block access

### End-of-Lesson Gate (All Users When Enabled)

- Golden key is locked until facilitator completes post-lesson survey and successfully re-authenticates with full password

## Data Model (Supabase)

### profiles (existing)

- `id` (uuid, PK)
- `subscription_tier` (text or enum: 'Beta', 'Standard', null)
- `fac_signup_video_completed_at` (timestamptz, null until done)
- `fac_tutorial_completed_at` (timestamptz, null until done)

### learner_tutorial_progress (new)

- `id` (uuid, PK)
- `learner_id` (uuid, indexed)
- `completed_at` (timestamptz)
- **Uniqueness**: One row per `learner_id` (first-time only tutorial)

### lesson_sessions (new)

- `id` (uuid, PK)
- `learner_id` (uuid)
- `lesson_id` (uuid or text key)
- `started_at` (timestamptz)
- `ended_at` (timestamptz, nullable until end)
- **Derived duration**: `ended_at - started_at` for reporting

### transcripts (existing or new)

- Ensure each transcript line has event row with `ts` (timestamptz) and `text`
- If transcripts stored as arrays, also persist per-line event feed for timestamped cross-reference

### facilitator_notes (new)

- `id` (uuid, PK)
- `session_id` (uuid, FK to `lesson_sessions.id`)
- `ts` (timestamptz, note timestamp)
- `text` (text)

### repeat_events (new)

- `id` (uuid, PK)
- `session_id` (uuid)
- `sentence_id` (text or uuid)
- `ts` (timestamptz)
- **Aggregation**: Counts per `session_id, sentence_id`

### post_lesson_surveys (new)

- `id` (uuid, PK)
- `session_id` (uuid)
- `submitted_at` (timestamptz)
- `environment` (jsonb)
- `learning_style` (jsonb)
- `fatigue_moments` (jsonb)
- `struggles` (jsonb)
- `notes_freeform` (text)

## Route Guards and Flows (Server-Side)

### Guard Utility

Add reusable guard utility `requireTutorialsAndSurvey(user, context)` that returns actionable state:

**For Beta facilitators**:
- Block if `fac_signup_video_completed_at` is null → require video
- Else block if `fac_tutorial_completed_at` is null → require tutorial
- Else allow

**For Beta learners**:
- On first lesson entry per `learner_id`, block if no row in `learner_tutorial_progress`

**For golden key routes**:
- Require matching `post_lesson_surveys.submitted_at` for active `session_id`
- Require recent successful re-auth

### Integration

- Apply guards in server actions and page loaders for facilitator and learner routes
- Redirect to appropriate tutorial/video screen when blocked

## Security (Password Re-Auth for Survey Unlock)

- Require full password re-entry immediately before showing post-lesson survey
- Implement via Supabase server-side re-auth (`signInWithPassword` against current email)
- Discard password; never store plaintext
- Gate survey access and golden key unlock on short-lived, server-tracked re-auth token (e.g., expiry ~10 minutes)
- Log only success/failure events; never log password

## Event Instrumentation

### Lesson Session Tracking

- Start `lesson_sessions` row on lesson entry
- Set `ended_at` on lesson exit

### Transcript Events

- For each transcript line emitted, persist `{ session_id, ts, text }`

### Facilitator Notes

- For each facilitator note, persist `{ session_id, ts, text }`

### Repeat Events

- On Repeat button click, persist `{ session_id, sentence_id, ts }` to `repeat_events`

### Derived Metrics

Expose per session:
- Total duration
- Repeats per sentence
- Counts by minute
- Notes per minute
- Transcript-note cross-reference by timestamp proximity

## Survey Content (Unlock Condition)

Require facilitator to complete fields covering:
- Environment
- Learning style
- Fatigue moments
- Struggles
- Freeform notes

**Unlock Condition**: Successful re-auth within window AND `post_lesson_surveys.submitted_at` present for session

## Admin and Lifecycle

- Only admins assign `subscription_tier = 'Beta'` in Supabase manually
- When Beta ends and tier is removed from profile, account remains
- `subscription_tier` becomes null and no gates apply
- Keep all collected data for analysis
- Gates can be disabled via flags without schema removal

## Removal Plan (Post-Beta)

1. Set `FORCE_TUTORIALS_FOR_BETA = false`
2. Set `SURVEY_GOLDEN_KEY_ENABLED = false`
3. Do not drop tables; keep data for audits
4. Optionally archive old sessions
5. Remove Beta tier values from `profiles.subscription_tier` while leaving accounts intact

## Acceptance Criteria

- Beta facilitators cannot proceed without signup video and facilitator tutorial completion
- Beta learners must complete learner tutorial once per learner profile on first lesson entry
- Golden key remains locked until password re-auth success and survey submission for session
- Transcripts and facilitator notes are timestamped
- Repeat clicks are evented and countable per sentence
- Lesson time is measurable from session start to end
- Non-Beta users are not blocked but can access tutorials optionally

## What NOT To Do

### Never Hard-Code Beta Logic in UI Components
- Use feature flags and database-driven gates
- Don't assume subscription tier in client-side code

### Never Store Passwords
- Server-side re-auth only
- Discard password immediately after validation
- Never log password values

### Never Block Non-Beta Users
- Tutorials are optional for non-Beta users
- Gates apply only when `subscription_tier == 'Beta'`

### Never Mix Tutorial State with Ms. Sonoma Payload
- Tutorial completion tracking is server-side only
- Ms. Sonoma remains unaware of Beta program
- No mentions of tutorials, surveys, or Beta in child-facing content

## Related Brain Files

- **[facilitator-help-system.md](facilitator-help-system.md)** - Beta tier gates facilitator tutorial
- **[lesson-quota.md](lesson-quota.md)** - Beta tier affects daily lesson quotas
- **[device-leases.md](device-leases.md)** - Beta tier sets concurrent device limits

## Key Files

### Route Guards
- Server actions for tutorial and survey gating (to be implemented)
- Page loaders for facilitator and learner routes (to be implemented)

### Database Schema
- Migration files for new tables: `learner_tutorial_progress`, `lesson_sessions`, `facilitator_notes`, `repeat_events`, `post_lesson_surveys`
- Existing tables: `profiles`, `transcripts` (extended)

### Feature Flags
- Environment variables: `FORCE_TUTORIALS_FOR_BETA`, `SURVEY_GOLDEN_KEY_ENABLED`, `TUTORIALS_AVAILABLE_FOR_ALL`

### Authentication
- Supabase auth utilities for password re-auth flow

## Notes

- Beta program is completely separate from Ms. Sonoma teaching system
- Tutorial completion and survey gates are server-enforced
- Event instrumentation provides analytics for Beta evaluation
- Feature flags allow graceful uninstall without data loss
- Cross-references with snapshot-persistence.md for session state continuity
