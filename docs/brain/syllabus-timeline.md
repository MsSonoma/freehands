# Active Syllabus Lesson Timeline

## How It Works

`composeSyllabusLessonTimeline()` builds the lesson occurrences shown for an active learner Syllabus. It is a pure composition layer: it reads already-loaded revision, association, schedule, session, event, supplemental artifact metadata, and legacy availability data without writing storage or changing educational intent.

`loadSyllabusTimelineInputs()` is the shared server-side input boundary used by both `getActiveSyllabus()` and `resolveSyllabusExecution()`. It loads the same composition inputs for the read and execution paths, then may enrich already-legitimate generated lesson keys from facilitator-owned lesson storage before invoking the pure composer.

### Membership authority

A lesson enters the active Syllabus timeline only through a learner-specific learning relationship:

- `syllabus_lesson_associations` admits an unscheduled lesson for provisional weekly placement.
- A forecast item with `lesson_key` admits immutable Syllabus intent.
- An explicit `lesson_schedule` row admits scheduled intent.
- A tracked lesson session or terminal session event admits actual learner history.

Forecast items without a lesson artifact remain standalone Syllabus intentions. They are composed separately and do not depend on legacy availability.

### Availability is not membership

`learners.approved_lessons` is a legacy readiness/availability map. It does not admit a lesson to the active Syllabus timeline, create metadata, create inferred placement, or create an occurrence.

Approved lesson keys remain among canonical key-resolution candidates so defensible legacy shortened IDs and `facilitator/...` aliases can resolve to the same artifact identity. Resolution is not membership.

Only an entry whose value is exactly `true` is available. False, null, missing, string, and other non-true values do not upgrade readiness.

When a legitimate membership source has already created timeline metadata, a matching exact-true approved entry may monotonically upgrade that member to `available`. It cannot regress `in_progress` or `completed`, and it cannot manufacture placement.

### Metadata authority

Subject and title supplied by an association, forecast item, or schedule remain authoritative for that occurrence. Supplemental artifact metadata fills only missing metadata and cannot create membership, key authority, placement, intent, or inference.

The server enrichment layer resolves only generated keys already supported by an association, forecast, schedule, session, or session event. It deduplicates reads, skips keys with complete explicit metadata, uses bounded concurrency, and verifies facilitator ownership with `verifyFacilitatorLessonAccess({ requireApproved: false })`. Missing, unauthorized, or invalid artifacts fail soft to the composer's existing fallback. A uniquely supported historical shortened key may resolve; an ambiguous key is never guessed.

The pure composer does not load generated lesson JSON or infer generated subjects from filenames. `general` remains a valid educational subject when genuinely stored or when a legitimate member has no stronger metadata. The `generated` storage namespace is never displayed as an educational subject.

### Placement and history

- Explicit schedules and dated forecast items reserve capacity before provisional inference.
- Association-only members may receive deterministic weekly-pattern inference.
- Actual session evidence remains on its local-calendar activity date.
- Completed history does not create a new future obligation unless later explicit intent proves a deliberate repeat.
- Starting or completing a lesson upgrades readiness without erasing earlier occurrence history.

### No active Syllabus

The active composer is not a replacement for the no-active-Syllabus compatibility path. `resolveSyllabusReadModel()` still returns the legacy compatibility fallback with no fabricated canonical timeline when no active revision exists.

## What Not To Do

- Do not use `approved_lessons` as Syllabus membership or planning authority.
- Do not eagerly create metadata for every approved lesson key.
- Do not treat truthy non-boolean availability values as `available`.
- Do not hide incorrect membership by suppressing the General label in the UI.
- Do not guess a generated lesson's subject from its filename or weekly pattern.
- Do not live-read facilitator lesson storage from the pure composer; keep enrichment in the shared server input boundary.
- Do not let supplemental artifact metadata create membership or become canonical key-resolution authority.
- Do not display the `generated` storage namespace as an educational subject.
- Do not bulk-backfill historical approved lessons into Syllabus associations.
- Do not change weekly capacity, PIN gates, or execution authorization to repair composition.
- Do not remove approved lesson keys from canonical resolution without proving legacy alias safety.
- Do not change the no-active-Syllabus legacy compatibility behavior here.

## Key Files

- `src/app/lib/syllabus/lessonTimeline.mjs` - Active timeline membership, metadata, readiness, history, and placement composition.
- `src/app/lib/syllabus/lessonTimelineInputs.server.mjs` - Shared read/execution input loading and fail-soft facilitator-artifact metadata enrichment.
- `src/app/lib/syllabus/revisions.server.mjs` - Loads legitimate membership/readiness inputs for the active read model.
- `src/app/lib/syllabus/executionAuthorization.server.mjs` - Reuses the same composed membership for protected lesson execution decisions.
- `src/app/lib/syllabus/timeline.mjs` - Active versus no-active-Syllabus read-model boundary.
- `src/app/lib/syllabus/__tests__/lessonTimeline.test.mjs` - Membership, readiness, placement, history, metadata, and capacity regressions.
