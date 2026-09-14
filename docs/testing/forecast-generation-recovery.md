# Forecast generation recovery

The installed Storage SDK wraps missing-object download responses in
StorageUnknownError.originalError. The observed response was HTTP 400 with a JSON
body reporting statusCode 404 and code NoSuchKey. The generator previously stopped
before the model call. It now inspects cloned response bodies and permits generation
only for confirmed missing objects. Bucket, permission, network, unknown errors,
and ambiguous recovery remain fail-closed.

Forecast and selected-but-ungenerated lessons share a dated row and generation
controls. Receipt status is read by lineage from the verified owned Syllabus.
Raw error details and hashes are not exposed. A failed attempt refreshes active
state before retry; active membership, not origin, chooses whether adoption is needed.
Already-stuck generation_failed entries can retry in place. Same-lineage proposals
cannot create a second visible entry. In-flight/recovery-required generation cannot
be rewritten through lesson editing. Generation still requires educator approval.

## Checks

- storageObjectErrors.test.mjs covers wrapped/legacy missing objects and negative cases.
- materializationStorage.test.mjs calls the real generator route and installed
  StorageClient with isolated transport/model fixtures: missing object reaches
  generation, recovery reuses the artifact without another model call or upload.
- lessonGenerationState.test.mjs checks status readback, lineage, and recovery states.
- learningForecast.test.mjs checks failed generation, reload, and successful retry
  using one receipt and one dated lineage.
- planning.test.mjs checks active generation changes and recovery editing restrictions.
- smoke-facilitator-forecast.mjs runs the built Home page through initial failure,
  immediate retry, refresh with persisted failure, and success in the same slot.
  Sibling suggestions and educator approval remain intact.

Tests use fixture transport/model output, not live AI or learner-record writes.
No migration. Logs: artifacts/forecast-generation-repair-20260914.
The pre-existing calendarProjection.test.mjs Mentor string contract still expects
"Loading the Syllabus plan", absent from baseline e1e836e. It is not suppressed.

Reference: https://supabase.com/docs/guides/storage/debugging/error-codes
