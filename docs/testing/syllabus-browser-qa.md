# Deterministic Syllabus browser QA

The Syllabus QA harness renders the real `SyllabusDocument`, `SyllabusPlanningWorkspace`, and `LessonHistoryOverlay` against disposable in-memory fixtures. It exists for interaction, responsive-layout, focus, loading, error, and race verification; server/domain tests remain authoritative for production persistence and authorization.

## Start

```powershell
npm run dev:syllabus-qa
```

Open `http://localhost:3001/qa/syllabus`.

Both `SYLLABUS_QA_ENABLED=true` and `NEXT_PUBLIC_SYLLABUS_QA_ENABLED=true` are set only by this explicit script. The route also requires `NODE_ENV !== production`. Missing either flag, or any production build/runtime, returns the normal Next.js 404 boundary.

## Isolation

The harness imports no Supabase client, auth helper, production Syllabus API, OpenAI client, or Storage client. Its adapter consists only of in-memory React state, deterministic fixture promises, and abortable timers. Production action links are disabled through the `SyllabusDocument` action-resolver seam. Review History and transcript reads use explicitly injected fixture loaders; their production fetch defaults are not called.

Fixture reset replaces all state with a fresh deterministic clone. Nothing is written to local storage, cookies, Supabase, Storage, AI providers, or normal planning APIs.

## Scenarios

- Full access
- Planning without generation
- Read-only planning
- Forecast failure/retry
- Generation failure
- Materialization repair/binding retry
- Stale revision conflict
- Review History failure

Latency can be set to none, modest, or slow. `Race A→B` deterministically delays occurrence A longer than occurrence B to verify stale Review History responses cannot cross-populate.

The facilitator/learner selector renders the same Syllabus document with its real role matrix. The learner view must not expose facilitator editing, forecast administration, Plan Ahead, or Review History controls.

## Safety tests

Run:

```powershell
node --test src/app/lib/syllabus/__tests__/qaHarness.test.mjs
```

These tests prove the double opt-in and production denial, absence of production adapters in the harness, preservation of real authentication on the normal facilitator page, fixture identity isolation, and use of the actual Syllabus components.
