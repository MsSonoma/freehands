# Portfolio Generation System

**Last Updated**: 2026-01-30T14:21:42Z
**Status**: Canonical

## How It Works

The Lesson Calendar page provides a **Generate portfolio** button that builds a shareable, no-login portfolio for a learner across a date range.

### UI Flow

1. Facilitator opens Lesson Calendar.
2. Clicks **Generate portfolio** (header button).
3. Modal collects:
   - Start date (YYYY-MM-DD)
   - End date (YYYY-MM-DD)
   - Include checkboxes: Visual aids, Notes, Images
4. Clicking **Generate Portfolio** calls `POST /api/portfolio/generate`.
5. UI shows a public link to open the portfolio plus a manifest download link.

### What Gets Included

The generator produces one portfolio index with per-lesson recap sections.

Per lesson (completed scheduled lessons only):
- **Title**: derived from `lesson_schedule.lesson_key`.
- **Date**: the scheduled date.
- **Notes** (optional): from `learners.lesson_notes[lesson_key]`.
- **Visual aids** (optional): `visual_aids.selected_images` for the facilitator and that lesson.
- **Images / scans** (optional): worksheet/test/other scans uploaded via the Calendar "Add Images" feature.

### Completion Rule (Calendar parity)

Portfolio generation follows the Calendar history rule:
- A scheduled lesson counts as completed if there is a `lesson_session_events` row with `event_type = 'completed'` for the same canonical lesson id either:
  - on the scheduled date, or
  - within 7 days after (make-up window).

Canonical lesson id is the normalized basename without `.json`.

### Storage + Public Access (No Login)

Portfolios are stored as static files in Supabase Storage so reviewers do not need to log in.

- Bucket: `portfolios` (public read)
- Path format:
  - `portfolios/<facilitatorUserId>/<learnerId>/<portfolioId>/index.html`
  - `portfolios/<facilitatorUserId>/<learnerId>/<portfolioId>/manifest.json`
  - Assets (copied scans): `portfolios/<facilitatorUserId>/<learnerId>/<portfolioId>/assets/...`

Portfolio scans originally live in the `transcripts` bucket and are private/signed-url only. For no-login review, the generator copies scan files into the public `portfolios` bucket and links them from the portfolio HTML.

## What NOT To Do

- Do not embed images as base64 in the HTML. Always link out to stored objects.
- Do not rely on short-lived signed URLs for reviewer access. Use stored public objects for portfolio artifacts.
- Do not include future (not-yet-completed) scheduled lessons in the portfolio.
- Do not add compatibility fallbacks for missing required inputs (dates, learnerId, include flags). Fail loudly.

## Key Files

- UI
  - `src/app/facilitator/calendar/page.js` (header button + modal wiring)
  - `src/app/facilitator/calendar/GeneratePortfolioModal.jsx` (overlay)
  - `src/components/FacilitatorHelp/PageHeader.jsx` (adds optional `actions` slot)

- API
  - `src/app/api/portfolio/generate/route.js` (portfolio builder)
  - `src/app/api/portfolio/lib.js` (HTML builder + helpers)

- Related systems
  - `src/app/api/portfolio-scans/*` (uploads scans to `transcripts` bucket)
  - `docs/brain/calendar-lesson-planning.md` (calendar completion + scans conventions)
  - `docs/brain/visual-aids.md` (visual aids persistence + selected_images)
  - `docs/brain/lesson-notes.md` (notes storage)
