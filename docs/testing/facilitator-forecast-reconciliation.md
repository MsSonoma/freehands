# Facilitator Syllabus and automatic forecast reconciliation

## Acceptance contract

The facilitator page at `/facilitator` IS the complete Syllabus. It is not a preview
of another Syllabus page. `/facilitator/syllabus` is a compatibility redirect only;
learner, date, lesson, and occurrence query parameters must survive it.

Forecast means automatically proposed, grey lesson rows on available dated Syllabus
slots. It does not mean a manual planning workspace or a separate recommendations
panel. The window is seven local calendar dates: today through today + 6. It must
include this week's unfinished dates and may cross a week/month/year boundary.
The existing weekly pattern supplies instructional slots. Existing commitments and
no-school dates take precedence. Supplemental Mr. Slate assignments do not consume
an instructional lesson slot.

Plan Ahead has no remaining UI, component, or dedicated projection. Manual lesson
creation remains available through the existing day + action. The Calendar remains
an alternate date view, using the same forecast window and canonical data.

Opening a grey suggestion offers Generate lesson, Generate with changes, and Create
your own lesson. Generation must not equal educator approval. Existing revision,
lineage, materialization recovery, and explicit approval boundaries remain in force.

## Verification in this pass

- Production build: compiled successfully; 94/94 static pages generated.
- Full Syllabus tests: 536/537 passed.
- Generator, approval-return, and facilitator navigation regressions: 18/18 passed.
- Real built `/facilitator` page in an isolated Edge browser: 9 scenario groups passed.
- Browser requests were intercepted using fixture data. No live learner records,
  lesson generation, approval, schedules, or database rows were changed by the smoke test.
- No database migration.

The one full-suite failure predates this change. In
`calendarProjection.test.mjs`, the Mr. Mentor contract requires the literal
`Loading the Syllabus plan`, which is absent from the actual
`facilitator/generator/counselor/CounselorClient.jsx` at baseline commit
`239d588583f6eea22073e9ad0063af6182a694e2`. It was not suppressed or claimed passing.

## Reproduce the browser checks locally

The script requires a production build, the public Supabase URL in `.env.local`,
Microsoft Edge, and playwright-core. It does not use a real signed-in browser.
Install playwright-core in a repo-local test directory or set PLAYWRIGHT_MODULE
pointing at another installed module. Then run:

```
npm run build
node scripts/smoke-facilitator-forecast.mjs
```

The script starts a temporary local server, creates a disposable browser context,
fulfills app/data requests with fixtures, and closes both on completion. Reports,
screenshots, logs, and the repo-local test dependency are under
`artifacts/forecast-reconcile-20260914/`; these artifacts are not production source.

Passing browser checks cover: one complete Home Syllabus; automatic grey dated
suggestions; collision/holiday/window filtering; the two editing forms; scrolling
after overlay close; reload; one-suggestion generation preserving siblings and
requiring approval; learner switching; inline retry; old-link redirect; and mobile
and tablet horizontal-overflow checks.

Deployment remains a separate authorized step. Local browser tests are not evidence
that the new build has reached production or that live model output has been checked.
