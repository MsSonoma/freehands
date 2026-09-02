# Ms. Sonoma App - Technical Explanation

**Status**: Current technical reference
**Last Updated**: 2026-08-07
**Authority**: Current source files outrank this document. Do not change product mechanics to match this document.

---

## Purpose

This document summarizes verified current Freehands behavior for Ms. Sonoma. It is technical documentation, not marketing copy.

Ms. Sonoma is implemented as a mastery-first AI learning facilitator. The product thesis is a hypothesis: can AI facilitate learning better than humans while empowering educators? Current source supports active AI-guided sessions, educator-controlled lesson surfaces, persistence, transcripts, entitlements, and billing. It does not prove comparative learning outcomes.

---

## Primary Routes and Files

| Area | Current source |
|---|---|
| Ms. Sonoma AI route | `src/app/api/sonoma/route.js` |
| TTS route | `src/app/api/tts/route.js` |
| Session page | `src/app/session/v2/SessionPageV2.jsx` |
| Phase orchestration | `src/app/session/v2/PhaseOrchestrator.jsx` |
| Snapshot persistence | `src/app/session/v2/SnapshotService.jsx`, `src/app/api/snapshots/route.js` |
| Entitlements | `src/app/lib/entitlements.js` |
| Lesson generation | `src/app/api/facilitator/lessons/generate/route.js` |
| Lesson approval | `src/app/api/facilitator/lessons/approve/route.js` |
| Transcripts list | `src/app/api/facilitator/learners/[id]/transcripts/route.js` |
| Medals | `src/app/api/medals/route.js` |
| Mr. Mentor | `src/app/api/counselor/route.js`, `src/app/api/conversation-memory/route.js`, `src/app/facilitator/generator/counselor/*` |
| Global OpenAI model selector | `src/app/lib/aiModel.js` |

---

## AI Provider Behavior

`/api/sonoma` is a Node.js dynamic route. It uses no system prompt for Ms. Sonoma turns. The client supplies current per-step instructions as `instruction`; optional learner text is supplied as `innertext`. The route hardens instructions with content-safety guidance, combines instructions and learner text into a single user message, and sends that to the selected provider.

Provider selection is controlled by environment:

- `SONOMA_PROVIDER` can select the provider.
- If no provider is set and `ANTHROPIC_API_KEY` exists, Anthropic is preferred.
- Otherwise OpenAI is used.
- OpenAI model defaults through `AI_MODEL`, which is `process.env.OPENAI_MODEL || 'gpt-5.4-mini'`.
- Anthropic defaults use `SONOMA_MODEL || ANTHROPIC_MODEL || 'claude-4.1-opus'` with fallback `ANTHROPIC_MODEL_FALLBACK || 'claude-3.5-sonnet'`.
- OpenAI calls use `max_completion_tokens`.
- Anthropic calls use `max_tokens`.
- In development, when provider keys are unavailable, the route can return a local dev stub.

Do not claim the route has hidden memory or a durable system prompt. Do not claim statelessness guarantees safety or learning outcomes.

---

## Request and Response Shape

For JSON requests, `/api/sonoma` reads:

- `instruction`: required instruction text.
- `innertext`: optional learner text.
- `skipAudio`: optional boolean.
- `lessonTopic`: optional topic for safety fallback language.

The response is JSON:

- success: `{ reply, audio }`
- missing instructions: `{ error: 'Instructions are required.' }` with status 400
- provider failure: error JSON with provider-specific failure status where applicable

`audio` may be `null`, `undefined`, or a base64 MP3 payload depending on `skipAudio`, credentials, cache, and synthesis success.

---

## Text-to-Speech

Ms. Sonoma TTS uses `@google-cloud/text-to-speech` with Google credentials loaded from `GOOGLE_TTS_CREDENTIALS`, `GOOGLE_APPLICATION_CREDENTIALS`, or `google-tts-key.json`.

Current default Ms. Sonoma voice in `/api/sonoma` and `/api/tts` is:

- language: `en-GB`
- voice: `en-GB-Neural2-F`
- gender: female
- audio encoding: MP3
- speaking rate: `0.92`

The standalone `/api/tts` route returns `{ reply, audio }` and uses a data URL prefix for generated audio. It also strips emoji/markdown and normalizes some speech cases before synthesis.

---

## Session Flow

`PhaseOrchestrator` controls the phase state machine. Valid phases are:

- `discussion`
- `teaching`
- `comprehension`
- `exercise`
- `worksheet`
- `test`
- `closing`

Current `startSession` behavior:

- If `startPhase` is supplied, the session starts at that valid phase.
- If `useDiscussion` is true, the default start is `discussion`.
- Otherwise the default start is `exercise`.
- In current source, `onDiscussionComplete()` transitions directly to `exercise`.
- `onTeachingComplete()` transitions to `comprehension`.
- `onComprehensionComplete()` transitions to `exercise`.
- Then `exercise -> worksheet -> test -> closing -> complete`.

The conceptual learning progression may still be described as Discussion -> Teaching -> Comprehension -> Exercise -> Worksheet -> Test -> Congrats, but technical docs must note that current source can skip or merge phases depending on start options and discussion flow.

---

## Persistence and Snapshots

`SnapshotService` saves session state locally first under `atomic_snapshot:${learnerId}:${lessonKey}`. It then best-effort persists to `/api/snapshots` when a Supabase client and account persistence are available.

The server snapshot route tries the `learner_snapshots` table first and can fall back to Supabase Storage under the `learner-snapshots` bucket when configured. Snapshots include learner, lesson, current phase, completed phases, phase data, transcript, timer state, and timestamps.

Session persistence is implementation detail, not proof of learning or safety.

---

## Lessons and Lesson Generation

Built-in lesson content lives under `public/lessons`.

Facilitator lesson generation is implemented at `src/app/api/facilitator/lessons/generate/route.js`. It requires authentication and a tier with `lessonGenerator` entitlement. Free/trial-like finite tiers may enforce lifetime generation limits. Generated lessons are JSON objects with fields such as `id`, `title`, `grade`, `difficulty`, `subject`, `blurb`, `vocab`, `teachingNotes`, and assessment arrays.

Generated lessons are stored in Supabase Storage under `facilitator-lessons/{user.id}/{file}` when storage is configured. The approval route marks a generated lesson as approved and returns canonical identity values such as `lessonKey`, `storagePath`, and `ownerId`.

Do not claim all lessons are generated. The app supports both built-in lessons and generated facilitator lessons where source supports them.

---

## Transcripts

The session page imports and uses transcript client helpers such as `appendTranscriptSegment` and `updateTranscriptLiveSegment`. The snapshot API can write transcript artifacts from caption sentences.

Learner transcript listing is implemented at `src/app/api/facilitator/learners/[id]/transcripts/route.js`. It reads from the Supabase `transcripts` bucket under `v1/{userId}/{learnerId}` and handles teacher subfolders for `sonoma`, `webb`, and `slate`, plus legacy flat entries.

Transcript writes and reads are best-effort and source-dependent. Do not describe transcripts as guaranteed unless the specific path and storage configuration are verified.

---

## Medals and Golden Keys

Medals are handled by `src/app/api/medals/route.js` and session client logic. Medal tiers are derived from percent thresholds:

- gold: 90+
- silver: 80+
- bronze: 70+

The medals route tries the `learner_medals` table first and can fall back to Supabase Storage. Golden-key eligibility and timers are session features controlled by learner settings, entitlements, and timer state in `SessionPageV2.jsx` and related timer services.

---

## Entitlements, Stripe, and Supabase

Entitlements are defined in `src/app/lib/entitlements.js` for `free`, `trial`, `standard`, `pro`, and legacy `lifetime` tiers. Beta users resolve to Pro-level features. Feature gates include lessons per day, learner count, devices, lesson generation, scheduling, lesson planner, ask feature, golden keys, visual aids, games, generation quotas, and Mr. Mentor sessions.

Stripe checkout currently supports `standard` and `pro` tiers through price IDs in environment variables. Webhooks map Stripe subscription price IDs back to `plan_tier` and upsert subscription data where configured.

Supabase is used for authentication, profile/tier reads, learner data, snapshots, transcripts, medals, lesson storage, and other account-backed surfaces where source implements them.

---

## Mr. Mentor

Mr. Mentor is implemented through counselor and mentor routes plus the facilitator generator/counselor UI. Current source gives Mr. Mentor lesson search, lesson detail, lesson generation, scheduling, assignment, editing, conversation memory, and conversation history tool behavior through the counselor route and supporting APIs.

Conversation memory is implemented with Supabase-backed APIs such as `conversation-memory` and uses OpenAI summarization through the global `AI_MODEL`. Mr. Mentor access is entitlement-gated in client and usage routes.

Do not describe Mr. Mentor as learner-facing instruction unless current source for that surface is specifically being discussed.

---

## Age and Grade Claims

Current entitlements and content references support K-8-style learner framing in guidance, but exact age ranges should not be treated as source-verified product limits unless a current route, UI, or policy file enforces them. Use grade/learner language when source evidence is not specific.

---

## Documentation Rules

- Current source outranks this document.
- Do not retain older "online tutor," "teacher at home," "Calm Revolution," or "co-teacher" framing as current product truth.
- Do not claim statelessness guarantees safety, control, or learning outcomes.
- Do not invent testimonials, academic results, pricing, certifications, adoption, or comparative superiority.
- Do not weaken AI into a passive assistant: Ms. Sonoma actively facilitates the learner session while educators retain educational authority.
