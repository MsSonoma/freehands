# Learner Home and Instructional Teacher Assignment

## Canonical learner destination

`/learn` is the single learner home. It renders the active learner Syllabus, current-week navigation, Start/Continue actions, lesson details, canonical history, mastery status, Daily/Weekly Slate review cards, awards navigation, Golden Key behavior, demo behavior, and the no-active-Syllabus compatibility library. `/learn/lessons` is only a server redirect to `/learn`; it must not grow a second learner experience.

## Teacher authority

The learner does not choose an instructional teacher. Prepare stores the facilitator's learner-plus-lesson assignment in `syllabus_lesson_associations.instructional_teacher`. Allowed values are Ms. Sonoma (`sonoma`) and Mrs. Webb (`webb`), with Sonoma as the database default. Mr. Slate is mastery/recovery/review/retention authority and is never an instructional-teacher option.

The learner home may display the assignment read-only. Its Start/Continue route is built from the server-backed Syllabus item or associated fallback lesson. Old browsers may retain `localStorage.selected_teacher`; learner initialization removes that key and no route reads it as authority. Manually choosing a different session URL still fails at server authorization because the signed proof and transactional start bind the authoritative teacher.

Each drillable Syllabus lesson also exposes `Practice with Mr. Slate` on demand, whether the instructional lesson is unfinished or already completed. This starts the exact lesson directly in Slate practice and does not require the instructional repeat/non-today PIN exception. A facilitator-assigned Slate practice appears as its own `Mr. Slate: <lesson>` Syllabus event with `Start Mr. Slate`; it does not replace the displayed Sonoma/Webb teacher or claim that practice has been completed.

The curated anonymous demo is fixed to Ms. Sonoma and never broadens anonymous access to Webb or Slate.

## Historical identity

The current assignment describes future intent. Canonical `lesson_sessions.instructional_teacher` records the actual protected instructional teacher and is immutable. History displays the recorded teacher rather than rewriting old attempts after a facilitator changes a future assignment.

## Key files

- `src/app/learn/page.js` - Canonical route entry.
- `src/app/learn/LearnerHome.js` - Shared learner-home implementation.
- `src/app/learn/lessons/page.js` - Compatibility redirect only.
- `src/app/facilitator/prepare/page.js` - Facilitator assignment editor.
- `src/app/lib/syllabus/instructionalTeacher.mjs` - Allowed values, labels, and route construction.
- `src/app/lib/syllabus/executionAuthorization.server.mjs` - Server assignment resolution and proof scope.
- `src/app/session/slate/page.jsx` - Exact lesson/occurrence Syllabus launch into supplemental Slate practice.
- `supabase/migrations/20260829010000_add_instructional_teacher_authority.sql` - Durable assignment and actual-session identity.

## What not to do

- Do not restore a learner teacher selector or read `selected_teacher` as authority.
- Do not route a normal lesson to Slate.
- Do not make on-demand Slate practice create or complete a Sonoma/Webb instructional session.
- Do not let a PIN substitute Sonoma for Webb or Webb for Sonoma.
- Do not duplicate the learner home under `/learn/lessons`.
- Do not rewrite historical instructor identity from the current association.
