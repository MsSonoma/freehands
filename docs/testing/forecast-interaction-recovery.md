# Forecast interaction and approval recovery

## Behavior

Forecast and saved-but-ungenerated Syllabus rows remain clickable and keyboard
accessible while refresh, planning, or generation is in progress. Only conflicting
writes are blocked in the detail overlay, with a readable explanation and live
unlocking. Recovery and educator approval requirements are not bypassed.

Forecast refresh has a 65-second client deadline covering both fetch and response
body consumption. Controllers are cancelled on replacement/unmount/learner switch;
request identity prevents old responses from overwriting new learner/revision state.
The timeout keeps saved suggestions and exposes retry. It is not proof that server
work stopped and is not used to replay lesson materialization.

Successful materialization applies its server-returned full Syllabus directly, only
for the matching learner, invalidating older reads. A shell refresh no longer clears
an already visible document. Open selections resolve from current data rather than
frozen click-time copies. Conflicting generation remains serialized by a request ref.

Approval optionally accepts learnerId, verifies ownership before storage writes,
then updates the learner association from the storage-confirmed approved artifact.
The client no longer makes a redundant follow-up association request. Association
failure is explicitly retryable; file-only legacy approval callers remain supported.
Successful review returns the original learner/date/lesson/occurrence with a
navigation-only review=complete flag. This closes review, not a grant of approval.
Changing learner consumes old return parameters so refresh cannot restore the prior
learner or re-open its review overlay.

## Verification

- forecastInteractions.test.mjs: bounded fetch/body timeout, cancellation, stale or
  foreign snapshots, selection transitions, action guards, exact review return.
- approvalAssociation.test.mjs: real approval route with isolated storage/database
  fixtures, ownership rejection before writes, retry after association failure,
  no false approval after storage failure, legacy callers.
- smoke-facilitator-forecast.mjs: built app in isolated Edge with fixture transport;
  cached suggestions during slow refresh, click/keyboard access, action unlocking,
  details during generation, immediate draft state with redundant reads forbidden,
  full draft-review/approval/return without a document reload, timeout and retry.

No live learner mutations or live AI calls were used. No migrations or deployment.
The previously identified calendarProjection.test.mjs expectation for the old
Mr. Mentor label "Loading the Syllabus plan" remains unchanged and failing.
Logs: artifacts/forecast-interactions-20260914/.

Reference for fetch/body cancellation: https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort
