# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
skip button skips questions instead of only skipping TTS speech audio
```

Filter terms used:
```text
TTS
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

TTS

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/session/page.js (24d0ad1fca5c4d9e137faf448d67edbdd18d815a89dd1d4902030a56f456fcba)
- bm25: -5.4949 | entity_overlap_w: 3.90 | adjusted: -6.4699 | relevance: 1.0000

// isSpeaking/phase/subPhase defined earlier; do not redeclare here
  const [transcript, setTranscript] = useState("");
  // Start with loading=true so the existing overlay spinner shows during initial restore
  const [loading, setLoading] = useState(true);
  // TTS overlay: track TTS fetch activity separately; overlay shows when either API or TTS is loading
  const [ttsLoadingCount, setTtsLoadingCount] = useState(0);
  const overlayLoading = loading || (ttsLoadingCount > 0);

### 2. src/app/session/page.js (df9788fcf3d8a451ee6730b44593b0670d7e3844110c56f24d473caa04751eb2)
- bm25: -4.8643 | entity_overlap_w: 5.20 | adjusted: -6.1643 | relevance: 1.0000

// Helper: speak arbitrary frontend text via unified captions + TTS
  // (defined here after playAudioFromBase64 is available, and updates the ref for early callbacks)
  const speakFrontendImpl = useCallback(async (text, opts = {}) => {
    try {
      const mcLayout = opts && typeof opts === 'object' ? (opts.mcLayout || 'inline') : 'inline';
      const noCaptions = !!(opts && typeof opts === 'object' && opts.noCaptions);
      let sentences = splitIntoSentences(text);
      sentences = mergeMcChoiceFragments(sentences, mcLayout).map((s) => enforceNbspAfterMcLabels(s));
      const assistantSentences = mapToAssistantCaptionEntries(sentences);
      // When noCaptions is set (e.g., resume after refresh), do not mutate caption state
      // so the transcript on screen does not duplicate. Still play TTS.
      let startIndexForBatch = 0;
      if (!noCaptions) {
        const prevLen = captionSentencesRef.current?.length || 0;
        const nextAll = [...(captionSentencesRef.current || []), ...assistantSentences];
        captionSentencesRef.current = nextAll;
        setCaptionSentences(nextAll);
        setCaptionIndex(prevLen);
        startIndexForBatch = prevLen;
      } else {
        // Keep current caption index; batch will be empty so no scheduling occurs
        try { startIndexForBatch = Number(captionIndexRef.current || 0); } catch { startIndexForBatch = 0; }
      }
      let dec = false;
      try {
        // Check cache first
        let b64 = ttsCache.get(text);
        
        if (b64) {
          console.log('[TTS CACHE HIT]', text.substring(0, 50));
        } else {
          console.log('[TTS CACHE MISS]', text.substring(0, 50));
        }
        
        if (!b64) {
          // Cache miss - fetch from API
          setTtsLoadingCount((c) => c + 1

### 3. docs/brain/ms-sonoma-teaching-system.md (a4cd628a3ea6f93deb0a26acad8137200825707078575f9b6d681391de3d7af7)
- bm25: -5.0590 | entity_overlap_w: 2.60 | adjusted: -5.7090 | relevance: 1.0000

### Hotkey Behavior

- Default bindings: Skip = PageDown; Next Sentence = End; Repeat = PageUp.
- Teaching gate Next Sentence hotkey (PageDown) only fires after TTS finishes or has been skipped; while speech is active the key is ignored.
- Skip still routes through the central speech abort to halt TTS before advancing.

### Teaching Gate Flow

### 4. docs/brain/v2-architecture.md (bc99e4b71f540c7bf37fdef5f564161060387111ec7a1c9304f9cd3ccfe6fd49)
- bm25: -4.6226 | entity_overlap_w: 3.90 | adjusted: -5.5976 | relevance: 1.0000

**Retry + Rate Limit Handling:**
- If GPT returns 429, TeachingController enters a cooldown and produces a deterministic "wait then press Next" sentence
- If GPT returns 500+ (or the fetch throws), TeachingController shows a generic server error message (not rate limit)
- When a non-429 error message is shown, the next Next/Repeat/Restart action triggers an actual retry fetch (instead of advancing past the error sentence and effectively skipping the stage)
- Next/Repeat/Restart must not spam GPT requests during cooldown
- Public methods called without `await` (Repeat/Skip/Restart) must not generate unhandled promise rejections

**Environment Variable Requirements:**
- At least one LLM provider key must be configured: `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
- Google TTS requires: `GOOGLE_APPLICATION_CREDENTIALS` (path to JSON file) or `GOOGLE_TTS_CREDENTIALS` (inline JSON or base64)
- Dev server must be restarted after adding/changing `.env.local` to load new environment variables
- Missing keys cause 500 errors (not 429s); TeachingController now distinguishes these in user-facing messages

**Gate Prompt Flow (uses prefetched content):**
1. Speak "Do you have any questions?" (TTS prefetched)
2. Await prefetched GPT result (usually instant)
3. Speak GPT-generated sample questions (TTS prefetched)
4. Fallback if GPT failed: deterministic questions using lesson title

**Exposes:**
- `prefetchAll()` - start all background prefetches (call on Begin)
- `startTeaching(lessonData)`
- `advanceSentence()`
- `repeatSentence()`
- `skipToExamples()`
- Events: `onStageChange`, `onSentenceAdvance`, `onTeachingComplete`

### 5. src/app/api/counselor/route.js (86a4ead5f24d3e066223ffc9afb48afe1a5b76912ee87576c502487a9e7cd4eb)
- bm25: -4.9418 | entity_overlap_w: 2.60 | adjusted: -5.5918 | relevance: 1.0000

function loadTtsCredentials() {
  const inline = process.env.GOOGLE_TTS_CREDENTIALS
  const inlineCreds = decodeCredentials(inline)
  if (inlineCreds) return inlineCreds

const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'google-tts-key.json')
  try {
    if (credentialPath && fs.existsSync(credentialPath)) {
      const raw = fs.readFileSync(credentialPath, 'utf8').trim()
      if (raw) return decodeCredentials(raw) || JSON.parse(raw)
    }
  } catch (fileError) {
    // Credentials load failed - TTS will be unavailable
  }
  return null
}

async function getTtsClient() {
  if (ttsClientPromise) return ttsClientPromise

const credentials = loadTtsCredentials()
  if (!credentials) {
    // No credentials - voice playback disabled
    return null
  }

ttsClientPromise = (async () => {
    try {
      return new TextToSpeechClient({ credentials })
    } catch (error) {
      // TTS client init failed
      ttsClientPromise = undefined
      return null
    }
  })()

ttsClientPromise.catch(() => { ttsClientPromise = undefined })
  return ttsClientPromise
}

function createCallId() {
  const timePart = Date.now().toString(36)
  const randomPart = Math.random().toString(36).slice(2, 8)
  return `${timePart}-${randomPart}`
}

function pushToolLog(toolLog, entry) {
  if (!Array.isArray(toolLog)) return
  const message = buildToolLogMessage(entry?.name, entry?.phase, entry?.context)
  if (!message) return
  toolLog.push({
    id: entry?.id || createCallId(),
    timestamp: Date.now(),
    name: entry?.name,
    phase: entry?.phase,
    message,
    context: entry?.context || {}
  })
}

### 6. src/app/session/v2/TeachingController.jsx (cd903932d69c019531594d7f3ad425c158d1999a6659b77363e9aaa89296d3fa)
- bm25: -4.4521 | entity_overlap_w: 3.90 | adjusted: -5.4271 | relevance: 1.0000

if (this.#prefetchStarted) {
      console.log('[TeachingController] Prefetch already started - skipping');
      return;
    }
    this.#prefetchStarted = true;
    
    // Start definitions GPT (don't await) - then prefetch TTS for first few sentences.
    // IMPORTANT: Stagger downstream GPT calls to reduce 429 risk.
    // Prefetch promises should never produce unhandled rejections.
    this.#definitionsGptPromise = this.#fetchDefinitionsFromGPT()
      .then(sentences => {
        // Prefetch TTS for first 3 definition sentences
        sentences.slice(0, 3).forEach(s => ttsCache.prefetch(s));
        return sentences;
      })
      .catch(err => {
        console.error('[TeachingController] Definitions prefetch error:', err);
        return [];
      });
    
    // Start examples GPT after definitions completes + 4 second delay (rate limit safety).
    this.#examplesGptPromise = this.#definitionsGptPromise
      .catch(() => [])
      .then(() => new Promise(resolve => setTimeout(resolve, 4000)))
      .then(() => this.#fetchExamplesFromGPT())
      .then(sentences => {
        // Prefetch TTS for first 3 example sentences
        sentences.slice(0, 3).forEach(s => ttsCache.prefetch(s));
        return sentences;
      })
      .catch(err => {
        console.error('[TeachingController] Examples prefetch error:', err);
        return [];
      });
    
    // Gate prompts are nice-to-have; fetch them after their parent content + 2s delay each.
    this.#definitionsGatePromptPromise = this.#definitionsGptPromise
      .catch(() => [])
      .then(() => new Promise(resolve => setTimeout(resolve, 2000)))
      .then(() => this.#fetchGatePromptFromGPT('definitions'))
      .then(text => {
      if (text) ttsCache.prefetch(text);
      return text;
    });
    
    t

### 7. src/app/facilitator/generator/counselor/CounselorClient.jsx (eeee8bf62119b0a3950c8ae02dfea3b24db32aa02bec35def65e5acb416bfe08)
- bm25: -4.6369 | entity_overlap_w: 2.60 | adjusted: -5.2869 | relevance: 1.0000

interceptResult.response = `Ok. I\'m opening the Lesson Planner and generating a ${action.durationMonths}-month plan starting ${action.startDate}.`
          }
        }
        
        // Add interceptor response to conversation
        const finalHistory = [
          ...updatedHistory,
          { role: 'assistant', content: interceptResult.response }
        ]
        setConversationHistory(finalHistory)
        
        // Display interceptor response in captions
        setCaptionText(interceptResult.response)
        const sentences = splitIntoSentences(interceptResult.response)
        setCaptionSentences(sentences)
        setCaptionIndex(0)
        
        // Play TTS for interceptor response (Mr. Mentor's voice)
        setLoadingThought("Preparing response...")
        try {
          const ttsResponse = await fetch('/api/mentor-tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: interceptResult.response })
          })
          
          if (ttsResponse.ok) {
            const ttsData = await ttsResponse.json()
            if (ttsData.audio) {
              // Never block the UI on audio playback.
              void playAudio(ttsData.audio)
            }
          }
        } catch (err) {
          // Silent TTS error - don't block UX
        }
        
        setLoading(false)
        setLoadingThought(null)
        return
      }
      
      // Interceptor didn't handle - forward to API
      setLoadingThought("Consulting my knowledge base...")
      const forwardMessage = interceptResult.apiForward?.message || message
      const finalForwardMessage = declineNote ? `${forwardMessage}\n\n${declineNote}` : forwardMessage
      const forwardContext = interceptResult

### 8. src/app/api/counselor/route.js (3295cbeb2bdc54ba0515b75298f3139c4aff4e07d4f05ab9793eee9770a865e3)
- bm25: -4.5761 | entity_overlap_w: 2.60 | adjusted: -5.2261 | relevance: 1.0000

// Helper function to synthesize audio with caching
async function synthesizeAudio(text, logPrefix) {
  let audioContent = undefined
  
  // Strip markdown formatting for TTS (keep text readable but remove syntax)
  // Remove **bold**, *italic*, and other markdown markers
  const cleanTextForTTS = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove **bold**
    .replace(/\*([^*]+)\*/g, '$1')      // Remove *italic*
    .replace(/_([^_]+)_/g, '$1')        // Remove _underline_
    .replace(/`([^`]+)`/g, '$1')        // Remove `code`
    .replace(/^#+\s+/gm, '')            // Remove # headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Remove [links](url)
  
  // Check cache first (use cleaned text as key)
  if (ttsCache.has(cleanTextForTTS)) {
    audioContent = ttsCache.get(cleanTextForTTS)
  } else {
    const ttsClient = await getTtsClient()
    if (ttsClient) {
      try {
        const ssml = toSsml(cleanTextForTTS)
        const [ttsResponse] = await ttsClient.synthesizeSpeech({
          input: { ssml },
          voice: MENTOR_VOICE,
          audioConfig: MENTOR_AUDIO_CONFIG
        })
        
        if (ttsResponse?.audioContent) {
          audioContent = typeof ttsResponse.audioContent === 'string'
            ? ttsResponse.audioContent
            : Buffer.from(ttsResponse.audioContent).toString('base64')
          
          // Cache with naive LRU
          ttsCache.set(cleanTextForTTS, audioContent)
          if (ttsCache.size > TTS_CACHE_MAX) {
            const firstKey = ttsCache.keys().next().value
            ttsCache.delete(firstKey)
          }
        }
      } catch (ttsError) {
        // TTS synthesis failed - will return undefined
      }
    }
  }
  
  return audioContent
}

### 9. docs/brain/tts-prefetching.md (edcb8c1a972c4e179c52dea1736883e05713d12c1179a797d2128f88803a9626)
- bm25: -4.5492 | entity_overlap_w: 2.60 | adjusted: -5.1992 | relevance: 1.0000

**API**:
- `src/app/api/tts/route.js`: TTS endpoint that returns `{ audio: base64 }`

## Performance Impact

**Before**: 2-3 second wait between questions (TTS generation time)
**After**: Questions 2+ load instantly (cache hit), only Q1 shows loading

**Cache stats during 5-question comprehension**:
- Q1: Cache miss (no prefetch yet) - 2-3s wait
- Q2: Cache hit (prefetched during Q1) - instant
- Q3: Cache hit (prefetched during Q2) - instant
- Q4: Cache hit (prefetched during Q3) - instant
- Q5: Cache hit (prefetched during Q4) - instant

**Total time saved**: 8-12 seconds per 5-question phase.

## Edge Cases

**Skip During Prefetch**:
- Prefetch continues in background (silent)
- Cache stores result even if not used
- Worst case: slight network waste, no user impact

**Failed Prefetch**:
- Silent catch, no cache entry
- Next question falls back to normal fetch (shows loading)
- User sees 2-3s wait but flow works normally

**Concurrent Prefetches**:
- Each prefetch gets unique AbortController
- Multiple pending fetches tracked in Map
- Phase transition aborts ALL pending

**Resume from Refresh**:
- Cache doesn't persist (memory only)
- First question after refresh shows loading
- Subsequent questions prefetch normally

**Celebration Text Variations**:
```javascript
// WRONG - prefetch won't match actual spoken text
ttsCache.prefetch(nextQ); // Just the question
await speakFrontend(`${celebration}. ${nextQ}`); // Celebration + question

// RIGHT - prefetch exact text that will be spoken
const prefetchText = `${CELEBRATE_CORRECT[0]}. ${nextQ}`;
ttsCache.prefetch(prefetchText);
```

Uses first celebration variant for prefetch since we can't predict random selection.

## Debug Helpers

### 10. docs/brain/v2-architecture.md (afffb9d44c9d9d5e9aee21cef0911b2f58779289d8122262e1045a2a4c0d3206)
- bm25: -4.8045 | entity_overlap_w: 1.30 | adjusted: -5.1295 | relevance: 1.0000

### 🚧 In Progress
- None (all critical issues fixed, ready for testing)

### 📋 Next Steps
1. Browser test: Full session flow with EventBus event coordination
2. Browser test: Verify Supabase snapshot persistence
3. Browser test: Verify audio initialization on iOS
4. Browser test: Verify timer events update UI correctly
5. Browser test: Verify golden key award persistence (3 on-time completions increments `learners.golden_keys`)
6. Browser test: Verify generated lesson loading
7. Production deployment with feature flag

---

## Related Brain Files

- **[snapshot-persistence.md](snapshot-persistence.md)** - V2 reimplements snapshot system with SnapshotService
- **[timer-system.md](timer-system.md)** - V2 reimplements timers with TimerService
- **[tts-prefetching.md](tts-prefetching.md)** - V2 reimplements TTS with AudioEngine
- **[ms-sonoma-teaching-system.md](ms-sonoma-teaching-system.md)** - V2 reimplements teaching flow with TeachingController

## Key Files

### 11. docs/brain/api-routes.md (dd3378227a6324ce4a86f9e043ed13060e4abcc4a4fabc05a7854dad2c6ce68c)
- bm25: -4.1539 | entity_overlap_w: 3.90 | adjusted: -5.1289 | relevance: 1.0000

# API Routes

## `/api/sonoma` - Core Ms. Sonoma Endpoint

### Request Format

**Method**: POST  
**Content-Type**: application/json

```json
{
  "instruction": "<string>",
  "innertext": "<string>",
  "skipAudio": true
}
```

**Fields**:
- `instruction`: The per-turn instruction string (server hardens it for safety).
- `innertext`: Optional learner input for this turn.
- `skipAudio`: Optional boolean; when `true`, the API will skip Google TTS and return `audio: null`.

**Why `skipAudio` exists**:
- Some callers (especially teaching definitions/examples generation) need text only.
- Returning base64 audio for large responses can be slow on mobile devices.

### Response Format

```json
{
  "reply": "<string>",
  "audio": "<base64 mp3>" 
}
```

**Fields**:
- `reply`: Ms. Sonoma response text from the configured LLM provider.
- `audio`: Base64-encoded MP3 when TTS is enabled and available; `null` when `skipAudio=true` (or when TTS is not configured).

### Implementation

- **Location**: `src/app/api/sonoma/route.js`
- **Providers**: OpenAI or Anthropic depending on env configuration
- **Runtime**: Node.js (Google SDKs require Node, not Edge)
- **Stateless**: Each call is independent; no DB writes from this endpoint

### Health Check

**Method**: GET

Returns `200` with `{ ok: true, route: 'sonoma', runtime }`.

### Logging Controls

Log truncation is controlled via environment variable `SONOMA_LOG_PREVIEW_MAX`:

- `full`, `off`, `none`, or `0` — No truncation
- Positive integer (e.g., `2000`) — Truncate after N characters
- Default: Unlimited in development; 600 chars in production

---

## Other Core Routes

### `/api/counselor`
**Purpose**: Mr. Mentor counselor chat endpoint (facilitator-facing)  
**Status**: Operational

### 12. docs/brain/ingests/pack-mentor-intercepts.md (35e76a89c7f5240f0e94cbd2877e930ae62cde56e079f99fd9382929f9faf2a0)
- bm25: -4.1355 | entity_overlap_w: 3.90 | adjusted: -5.1105 | relevance: 1.0000

### 15. docs/brain/api-routes.md (dd3378227a6324ce4a86f9e043ed13060e4abcc4a4fabc05a7854dad2c6ce68c)
- bm25: -16.5866 | relevance: 1.0000

# API Routes

## `/api/sonoma` - Core Ms. Sonoma Endpoint

### Request Format

**Method**: POST  
**Content-Type**: application/json

```json
{
  "instruction": "<string>",
  "innertext": "<string>",
  "skipAudio": true
}
```

**Fields**:
- `instruction`: The per-turn instruction string (server hardens it for safety).
- `innertext`: Optional learner input for this turn.
- `skipAudio`: Optional boolean; when `true`, the API will skip Google TTS and return `audio: null`.

**Why `skipAudio` exists**:
- Some callers (especially teaching definitions/examples generation) need text only.
- Returning base64 audio for large responses can be slow on mobile devices.

### Response Format

```json
{
  "reply": "<string>",
  "audio": "<base64 mp3>" 
}
```

**Fields**:
- `reply`: Ms. Sonoma response text from the configured LLM provider.
- `audio`: Base64-encoded MP3 when TTS is enabled and available; `null` when `skipAudio=true` (or when TTS is not configured).

### Implementation

- **Location**: `src/app/api/sonoma/route.js`
- **Providers**: OpenAI or Anthropic depending on env configuration
- **Runtime**: Node.js (Google SDKs require Node, not Edge)
- **Stateless**: Each call is independent; no DB writes from this endpoint

### Health Check

**Method**: GET

Returns `200` with `{ ok: true, route: 'sonoma', runtime }`.

### Logging Controls

Log truncation is controlled via environment variable `SONOMA_LOG_PREVIEW_MAX`:

- `full`, `off`, `none`, or `0` — No truncation
- Positive integer (e.g., `2000`) — Truncate after N characters
- Default: Unlimited in development; 600 chars in production

---

## Other Core Routes

### 13. docs/brain/v2-architecture.md (aa7153d876592c21696ed81eef5a176acfcefd0ddf6ceff0300b5c58d431458c)
- bm25: -4.4010 | entity_overlap_w: 2.60 | adjusted: -5.0510 | relevance: 1.0000

**Zero-Latency Prefetch Strategy:**
- `prefetchAll()` triggered on Begin click (deferred to next tick so it does not block the UI)
- Prefetch is **single-flight** (subsequent calls are ignored)
- GPT calls are **staggered** to reduce 429 risk:
  - Start definitions first
  - Start examples only after definitions resolves (or fails)
  - Gate prompts start after their parent stage begins
- GPT calls run in background during discussion greeting (~3-5 seconds)
- When teaching starts, prefetched data is awaited (often already complete)
- TTS prefetched for first 3 sentences of each stage + gate prompt text
- **No loading states** - UI never shows "loading" for teaching content
- Prefetch chain: GPT completes → automatically prefetches TTS for sentences

### 14. src/app/session/page.js (5081bab5884e02689acef54dcbfce6800c4856f78c451b0a67136e3e40d1fded)
- bm25: -4.6985 | entity_overlap_w: 1.30 | adjusted: -5.0235 | relevance: 1.0000

// Request TTS for the local opening and play it using the same pipeline as API replies.
      setLoading(true);
      setTtsLoadingCount((c) => c + 1);
  const replyStartIndex = prevLen; // we appended opening sentences at the end
      let res;
      try {
        res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: replyText }) });
        var data = await res.json().catch(() => ({}));
        var audioB64 = (data && (data.audio || data.audioBase64 || data.audioContent || data.content || data.b64)) || '';
        // Dev warm-up: if route wasn't ready (404) or no audio returned, pre-warm and retry once
        if ((!res.ok && res.status === 404) || !audioB64) {
          try { await fetch('/api/tts', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(() => {}); } catch {}
          try { await waitForBeat(400); } catch {}
          res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: replyText }) });
          data = await res.json().catch(() => ({}));
          audioB64 = (data && (data.audio || data.audioBase64 || data.audioContent || data.content || data.b64)) || '';
        }
      } finally {
        setTtsLoadingCount((c) => Math.max(0, c - 1));
      }
      if (audioB64) audioB64 = normalizeBase64Audio(audioB64);
      // Match API flow: stop showing loading before kicking off audio
      setLoading(false);
      if (audioB64) {
        // Stash payload so gesture-based unlock can retry immediately if needed
        try { lastAudioBase64Ref.current = audioB64; } catch {}
        setIsSpeaking(true);
        // CRITICAL: Also update the ref immediately to prevent double-playback in recovery timeout

### 15. docs/brain/tts-prefetching.md (5d2c47ccfb9a2ebf8730cf484617315b098470bc24f095612364f494190624e7)
- bm25: -4.9573 | relevance: 1.0000

Useful for verifying cache behavior during development.

### 16. docs/brain/tts-prefetching.md (6d1b96b8f6272894a5c5f0a5c3a22454adfc86b0f45bf0f04266b9459a647c37)
- bm25: -4.9573 | relevance: 1.0000

**AbortController Pattern**:
```javascript
pendingFetches: Map<string, AbortController>

### 17. docs/brain/v2-architecture.md (f0f7d5791f87c43312f84768585c3f5e0ddbb77f03f5af6f3a469f7e7634e7c5)
- bm25: -3.8987 | entity_overlap_w: 3.90 | adjusted: -4.8737 | relevance: 1.0000

**Test judging rule (V1 parity):** Test is single-attempt.
- Judge the learner answer (MC/TF locally; SA/FIB via `/api/judge-short-answer` through `judging.js` with local fallback).
- If correct: speak praise, then advance.
- If incorrect: speak the correct answer immediately, then advance.

**Test ticker rule (single-attempt):** The Test question counter must advance on every answered/skipped question.
- Do not derive the question counter from `score` (score only increments on correct answers).
- Use the current question index (questionNumber = questionIndex + 1) so incorrect answers still advance the ticker.

**Test Skip/Next robustness rule (no premature actions):** In Test, user actions must never break the phase even when pressed repeatedly during async work.
- The learner may mash Skip/Submit while question TTS is still loading or while judging is in-flight.
- The phase must not double-advance, throw, or play stale audio for a previously-skipped question.
- When an action advances to a new question while a prior question's TTS fetch is in-flight, the stale fetch result must be discarded (do not play it).
- While a Submit/Skip transition is in-flight, additional Submit/Skip presses must be safely ignored (no double grading, no double skipping).
- The Test intro line ("Time for the test") must also be skippable: the phase must advance to `awaiting-go` on AudioEngine `end` (completed OR skipped) and must not depend on awaiting `playAudio()`.

### Exercise: Inline Q&A (Comprehension Parity) (2026-01-02)

**Decision:** Exercise uses the same inline (V1-style) Q&A flow as Comprehension: questions are spoken via TTS, and the learner answers using the footer input.

### 18. docs/brain/tts-prefetching.md (05e6eff1863500855ddc6c183a5ac48103c48804c8f4dbabf875f31ef1a1e1db)
- bm25: -4.1294 | entity_overlap_w: 2.60 | adjusted: -4.7794 | relevance: 1.0000

# TTS Prefetching System

## Overview

TTS (text-to-speech) prefetching eliminates 2-3 second waits between questions by loading question N+1 in the background while student answers question N. This was the main performance bottleneck identified by user after zombie code cleanup.

## How It Works

### Cache Architecture

**Module**: `src/app/session/utils/ttsCache.js` (212 lines)

**Core Components**:
- `TTSCache` class: Singleton instance exported as `ttsCache`
- LRU cache: Map-based storage with timestamp tracking
- MAX_CACHE_SIZE: 10 items (prevents memory issues during long sessions)
- Eviction: Oldest by timestamp when cache full

**Cache API**:
```javascript
ttsCache.get(text)           // Returns cached base64 audio or null
ttsCache.set(text, audio)    // Stores audio, evicts oldest if full
ttsCache.prefetch(text)      // Background fetch, fire-and-forget
ttsCache.clear()             // Cancels pending fetches, clears cache
ttsCache.cancelPrefetch(text) // Aborts specific pending request
```

### Integration Points

**1. speakFrontendImpl (page.js line ~2927)**
```javascript
// Check cache first
let b64 = ttsCache.get(text);

if (!b64) {
  // Cache miss - fetch from API
  setTtsLoadingCount((c) => c + 1);
  // ... fetch logic ...
  if (b64) {
    b64 = normalizeBase64Audio(b64);
    // Store successful fetch in cache
    ttsCache.set(text, b64);
  }
  setTtsLoadingCount((c) => Math.max(0, c - 1));
}
// else: cache hit - b64 already set, no loading indicator
```

Cache hits skip loading indicator entirely since audio is instant.

**2. Prefetch Triggers**

**After Comprehension Answer (page.js line ~5895)**:
```javascript
try { await speakFrontend(`${celebration}. ${progressPhrase} ${nextQ}`, { mcLayout: 'multiline' }); } catch {}

### 19. docs/brain/tts-prefetching.md (cba8101ac4406e3a169ec45922876fe9bc7e7be991dc9b30d6274e1acfb795ee)
- bm25: -4.7065 | relevance: 1.0000

```javascript
// Get cache statistics
const stats = ttsCache.getStats();
console.log(stats); // { size: 3, pending: 1, maxSize: 10 }
```

### 20. docs/brain/ingests/pack-mentor-intercepts.md (d5ddc893728a86d159bcf5ff419f02c5ace96e1133048d430ac99ee743f074bd)
- bm25: -4.2939 | entity_overlap_w: 1.30 | adjusted: -4.6189 | relevance: 1.0000

- **`src/app/session/v2/SessionPageV2.jsx`** - Learner session (V2)
  - Loads visual aids by normalized `lessonKey`
  - Video overlay includes a Visual Aids button when images exist
  - Renders `SessionVisualAidsCarousel` and uses AudioEngine-backed TTS for Explain

### 21. src/app/session/v2/AudioEngine.jsx (bed4b96439e1d30f0a5b1d216834205045a7703c4a54276fea998b7e9dd361ed)
- bm25: -3.9440 | entity_overlap_w: 2.60 | adjusted: -4.5940 | relevance: 1.0000

// Pause as soon as playback actually starts (playing event), so we end in a paused state
    // while still getting the autoplay "unlock" side effect from play().
    // IMPORTANT: If unlock playback never starts during the gesture, do not leave a stale
    // 'playing' handler around — it can pause the first real TTS video playback later.
    this.#videoUnlockPlayingHandler = () => {
      // Never pause the real TTS video playback.
      if (this.#isPlaying) {
        clearUnlockHandler();
        return;
      }
      try { video.pause(); } catch {}
      try { video.currentTime = 0; } catch {}
      clearUnlockHandler();
    };

try {
      video.addEventListener('playing', this.#videoUnlockPlayingHandler);
    } catch {}

// Cleanup even if 'playing' never fires (e.g., autoplay blocked).
    try {
      this.#videoUnlockCleanupTimer = setTimeout(() => {
        clearUnlockHandler();
      }, 1500);
    } catch {}

try {
      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          clearUnlockHandler();
        });
      }
    } catch {
      clearUnlockHandler();
    }
  }
  
  // Public API: Playback control
  async playAudio(base64Audio, sentences = [], startIndex = 0, options = {}) {
    this.#lastAudioBase64 = base64Audio;
    this.#lastSentences = sentences;
    
    // Stop any existing playback
    this.stop();
    
    // Validate
    if (!Array.isArray(sentences) || sentences.length === 0) {
      console.warn('[AudioEngine] No sentences provided');
      return;
    }

### 22. docs/brain/ms-sonoma-teaching-system.md (cede03814a8e282c9f02f9885e01f2a1ed833b57c04cd2aef304bf98f2d7f4ba)
- bm25: -4.2683 | entity_overlap_w: 1.30 | adjusted: -4.5933 | relevance: 1.0000

## Related Brain Files

- **[tts-prefetching.md](tts-prefetching.md)** - TTS powers audio playback for Ms. Sonoma speech
- **[visual-aids.md](visual-aids.md)** - Visual aids displayed during teaching phase

## Key Files

### Core API
- `src/app/api/sonoma/route.js` - Main Ms. Sonoma API endpoint, integrates content safety validation

### Content Safety
- `src/lib/contentSafety.js` - Lenient validation system: prompt injection detection (always), banned keywords (reduced list, skipped for creative features), instruction hardening (primary defense), output validation with skipModeration=true (OpenAI Moderation API bypassed to prevent false positives like "pajamas" flagged as sexual)

### Teaching Flow Hooks
- `src/app/session/hooks/useTeachingFlow.js` - Orchestrates teaching definitions and examples stages

### Phase Handlers
- `src/app/session/hooks/usePhaseHandlers.js` - Manages phase transitions (comprehension, exercise, worksheet, test)

### Session Page
- `src/app/session/page.js` - Main session orchestration, phase state management

### Brand Signal Sources (Read-Only)
- `.github/Signals/MsSonoma_Voice_and_Vocabulary_Guide.pdf`
- `.github/Signals/MsSonoma_Messaging_Matrix_Text.pdf`
- `.github/Signals/MsSonoma_OnePage_Brand_Story.pdf`
- `.github/Signals/MsSonoma_Homepage_Copy_Framework.pdf`
- `.github/Signals/MsSonoma_Launch_Deck_The_Calm_Revolution.pdf`
- `.github/Signals/MsSonoma_SignalFlow_Full_Report.pdf`

### Data Schema
- Supabase tables for lesson content, vocab terms, comprehension items
- Content safety incidents logging table

## Notes

### 23. docs/brain/tts-prefetching.md (6948e68ea1a8bc628314d0baad0fc061f964291c736f4224062885a7cba94bde)
- bm25: -4.5679 | relevance: 1.0000

// RIGHT - only show loading on cache miss
let b64 = ttsCache.get(text);
if (!b64) {
  setTtsLoadingCount((c) => c + 1);
  /* fetch */
  setTtsLoadingCount((c) => c - 1);
}
```

### 24. docs/brain/tts-prefetching.md (072d1470417a91efeda996cf6ff4ab16a94be413be6e572d439f2f0f73e61aeb)
- bm25: -4.2423 | entity_overlap_w: 1.30 | adjusted: -4.5673 | relevance: 1.0000

prefetch(text) {
  const controller = new AbortController();
  this.pendingFetches.set(text, controller);
  
  fetch('/api/tts', { signal: controller.signal, ... })
    .then(...)
    .catch(err => {
      if (err.name === 'AbortError') return; // Silent - expected
      // Other errors also silent - prefetch is non-critical
    })
    .finally(() => this.pendingFetches.delete(text));
}

clear() {
  this.pendingFetches.forEach(controller => controller.abort());
  this.pendingFetches.clear();
  this.cache.clear();
}
```

Ensures no memory leaks from abandoned prefetch requests.

### Text Normalization

```javascript
normalizeText(text) {
  return text.toLowerCase().trim();
}
```

Cache keys are normalized so "What is 2+2?" and "what is 2+2? " hit same entry.

### Audio Extraction

```javascript
extractAudio(data) {
  if (!data) return null;
  
  // API can return audio in multiple formats:
  // { audio, audioBase64, audioContent, content, b64 }
  return data.audio || data.audioBase64 || data.audioContent || 
         data.content || data.b64 || null;
}
```

Handles various TTS API response formats.

## What NOT To Do

**DON'T prefetch without abort capability**
- Memory leaks from abandoned requests
- Network congestion from redundant fetches
- Phase transitions leave orphaned requests

**DON'T fail loudly on prefetch errors**
- Prefetch is optimization only
- User should never see prefetch failures
- Core flow must work without cache

**DON'NOT show loading indicator on cache hits**
```javascript
// WRONG - shows loading even for instant cache hits
setTtsLoadingCount((c) => c + 1);
let b64 = ttsCache.get(text);
if (!b64) { /* fetch */ }
setTtsLoadingCount((c) => c - 1);

### 25. docs/brain/visual-aids.md (85823dd0676182ce38771044864b6e03b9018a0ce74f1747deb60769ad470de3)
- bm25: -3.8945 | entity_overlap_w: 2.60 | adjusted: -4.5445 | relevance: 1.0000

- **`src/app/session/components/SessionVisualAidsCarousel.js`** - Learner session display
  - Full-screen carousel during lesson
  - "Explain" button triggers Ms. Sonoma TTS of description
  - Read-only view (no editing)

### Integration Points
- **`src/app/facilitator/lessons/edit/page.js`** - Lesson editor
  - `handleGenerateVisualAids()` - initiates generation
  - Manages visual aids state and save flow

- **`src/app/facilitator/calendar/DayViewOverlay.jsx`** - Calendar scheduled-lesson inline editor
  - Provides the same "Generate Visual Aids" button as the regular editor via `LessonEditor` props
  - Loads/saves/generates via `/api/visual-aids/*` with bearer auth
  - Renders `VisualAidsCarousel` above the inline editor modal

- **`src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx`** - Mr. Mentor counselor
  - `handleGenerateVisualAids()` - generation from counselor lesson creation

- **`src/app/session/page.js`** - Learner session
  - Loads visual aids by normalized `lessonKey`
  - `onShowVisualAids()` - opens carousel
  - `onExplainVisualAid()` - triggers Ms. Sonoma explanation

- **`src/app/session/v2/SessionPageV2.jsx`** - Learner session (V2)
  - Loads visual aids by normalized `lessonKey`
  - Video overlay includes a Visual Aids button when images exist
  - Renders `SessionVisualAidsCarousel` and uses AudioEngine-backed TTS for Explain

### 26. src/app/session/v2/SessionPageV2.jsx (8f890c777eaff0b74ffd81a9546f3929a2272e71e68305715c040955574e768c)
- bm25: -3.8863 | entity_overlap_w: 2.60 | adjusted: -4.5363 | relevance: 1.0000

const playEnabledForPhase = (p) => {
      if (!p) return true;
      if (p === 'comprehension') return playPortionsEnabledRef.current?.comprehension !== false;
      if (p === 'exercise') return playPortionsEnabledRef.current?.exercise !== false;
      if (p === 'worksheet') return playPortionsEnabledRef.current?.worksheet !== false;
      if (p === 'test') return playPortionsEnabledRef.current?.test !== false;
      return true;
    };
    const skipPlayPortion = ['comprehension', 'exercise', 'worksheet', 'test'].includes(phaseName)
      ? !playEnabledForPhase(phaseName)
      : false;
    
    // Special handling for discussion: prefetch greeting TTS before starting
    if (phaseName === 'discussion') {
      setDiscussionState('loading');
      const learnerName = (typeof window !== 'undefined' ? localStorage.getItem('learner_name') : null) || 'friend';
      const lessonTitle = lessonData?.title || lessonId || 'this topic';
      const greetingText = `Hi ${learnerName}, ready to learn about ${lessonTitle}?`;
      
      try {
        // Prefetch greeting TTS
        await fetchTTS(greetingText);
      } catch (err) {
        console.error('[SessionPageV2] Failed to prefetch greeting:', err);
      }
      
      // Discussion work timer starts when Begin is clicked, not here
    }
    
    const ref = getPhaseRef(phaseName);
    if (ref?.current?.start) {
      if (skipPlayPortion) {
        transitionToWorkTimer(phaseName);
        // Start work timer immediately when skipping play portion (unless timeline jump already started it)
        if (timerServiceRef.current && timelineJumpTimerStartedRef.current !== phaseName) {
          timerServiceRef.current.startWorkPhaseTimer(phaseName);
        }
        await ref.current.start({ skipPlayPortion: true });
      }

### 27. docs/brain/ingests/pack-mentor-intercepts.md (88ae68a3e8cf1cfeacc9415f2912f09d93188deb2e3a1c2278a1d6bac0d438b4)
- bm25: -4.1851 | entity_overlap_w: 1.30 | adjusted: -4.5101 | relevance: 1.0000

CREATE TRIGGER auto_deactivate_old_lesson_sessions
  BEFORE INSERT ON lesson_sessions
  FOR EACH ROW
  EXECUTE FUNCTION deactivate_old_lesson_sessions();
```

**Purpose**: Database enforces single-session constraint even if application logic fails. Ensures no orphaned active sessions.

### Checkpoint Gates (Where Conflicts Detected)

### 35. docs/brain/ai-rewrite-system.md (316854d4d2bc71c0ac5f86896adc58c38b29b41d22194aff261c0a1ca02bde82)
- bm25: -11.8770 | relevance: 1.0000

## Related Brain Files

- **[visual-aids.md](visual-aids.md)** - AI rewrite optimizes DALL-E 3 prompts for visual aid generation
- **[lesson-editor.md](lesson-editor.md)** - AIRewriteButton integrated in lesson editor for content improvement

## Key Files

- `src/components/AIRewriteButton.jsx` - Reusable button component
- `src/app/api/ai/rewrite-text/route.js` - Rewrite API endpoint
- `src/components/VisualAidsCarousel.jsx` - Current usage example

## What NOT To Do

- Never expose rewrite API publicly (requires auth)
- Never skip purpose parameter (determines prompt style)
- Never rewrite without user trigger (button click required)
- Never cache rewritten text globally (user-specific content)

### 36. docs/brain/ms-sonoma-teaching-system.md (cede03814a8e282c9f02f9885e01f2a1ed833b57c04cd2aef304bf98f2d7f4ba)
- bm25: -11.6708 | relevance: 1.0000

## Related Brain Files

- **[tts-prefetching.md](tts-prefetching.md)** - TTS powers audio playback for Ms. Sonoma speech
- **[visual-aids.md](visual-aids.md)** - Visual aids displayed during teaching phase

## Key Files

### Core API
- `src/app/api/sonoma/route.js` - Main Ms. Sonoma API endpoint, integrates content safety validation

### 28. docs/brain/tts-prefetching.md (d4d48f07f7f9a11e80b3ef68e048d4c9b4038755fe3b6610d8d8f62094649b0b)
- bm25: -4.4162 | relevance: 1.0000

// Prefetch second question while student answers first
try {
  if (Array.isArray(generatedComprehension) && currentCompIndex < generatedComprehension.length) {
    const prefetchProblem = generatedComprehension[currentCompIndex];
    const prefetchQ = ensureQuestionMark(formatQuestionForSpeech(prefetchProblem, { layout: 'multiline' }));
    ttsCache.prefetch(prefetchQ);
  }
} catch {}
```

### 29. docs/brain/v2-architecture.md (dcea5ecf862257a5f80f2259d150c9f5b9ae6ce42bb7e280b9ad10ee41710f36)
- bm25: -3.7380 | entity_overlap_w: 2.60 | adjusted: -4.3880 | relevance: 1.0000

**V2 Implementation:**
- `src/app/session/v2/SessionPageV2.jsx` - Complete session flow UI (3500+ lines, includes comprehension logic)
- `src/app/session/v2/AudioEngine.jsx` - Audio playback system (600 lines)
- `src/app/session/v2/TeachingController.jsx` - Teaching stage machine with TTS (400 lines)
- `src/app/session/v2/ComprehensionPhase.jsx` - DEPRECATED, not used (comprehension handled inline in SessionPageV2)
- `src/app/session/v2/DiscussionPhase.jsx` - Discussion activities (200 lines)
- `src/app/session/v2/ExercisePhase.jsx` - Exercise questions with scoring (300 lines)
- `src/app/session/v2/WorksheetPhase.jsx` - Fill-in-blank questions (300 lines)
- `src/app/session/v2/TestPhase.jsx` - Graded test with review (400 lines)
- `src/app/session/v2/ClosingPhase.jsx` - Closing message with encouragement (150 lines)
- `src/app/session/v2/PhaseOrchestrator.jsx` - Session phase management (150 lines)
- `src/app/session/v2/SnapshotService.jsx` - Session persistence (300 lines)
- `src/app/session/v2/TimerService.jsx` - Session and work phase timers (350 lines)
- `src/app/session/v2/KeyboardService.jsx` - Keyboard hotkey management (150 lines)
- `src/app/session/v2/services.js` - API integration layer (TTS + lesson loading, includes question pools)
- `src/app/session/v2test/page.jsx` - Direct test route

### 30. docs/brain/ingests/pack.md (562ccdceec920fc88c19e3612ebf7902f23d8078e37896c0623a90e70a093280)
- bm25: -4.0557 | entity_overlap_w: 1.30 | adjusted: -4.3807 | relevance: 1.0000

**Response**:
- Returns `{ outline: { kind, title, description, subject, grade, difficulty } }`
- `kind` is `new` or `review`
- When `kind=review`, the title is prefixed with `Review:` for clarity

### `/api/generate-lesson`
**Purpose**: Generate new lesson content via LLM  
**Status**: Legacy route, may be superseded by facilitator lesson editor

### `/api/tts`
**Purpose**: Text-to-speech conversion (Google TTS)  
**Status**: Operational, used for all Ms. Sonoma audio

### `/api/visual-aids/generate`
**Purpose**: Generate visual aid images via DALL-E 3  
**Status**: Operational, see `docs/brain/visual-aids.md`

### 33. src/app/facilitator/calendar/LessonPlanner.jsx (2cdb279d41617abc41fcf9088b8da7c5c209b33cd6b03cc5f9bccb95193eb4d0)
- bm25: -17.9938 | relevance: 1.0000

// Add scheduled lessons
      if (scheduledRes.ok) {
        const scheduledData = await scheduledRes.json()
        const scheduledLessons = (scheduledData.schedule || []).map(s => ({
          name: s.lesson_key,
          date: s.scheduled_date,
          status: 'scheduled'
        }))
        lessonContext = [...lessonContext, ...scheduledLessons]
      }

### 34. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (5d41b9bf517eebb4d3804a2d02aef902c5ef59c377353f9f57c89608469dd536)
- bm25: -17.9535 | relevance: 1.0000

### 31. docs/brain/ingests/pack-mentor-intercepts.md (3300157944d072852387421f46174f6339d6a53250501dd8a14f2dc88db84519)
- bm25: -3.7231 | entity_overlap_w: 2.60 | adjusted: -4.3731 | relevance: 1.0000

**V2 Implementation:**
- `src/app/session/v2/SessionPageV2.jsx` - Complete session flow UI (3500+ lines, includes comprehension logic)
- `src/app/session/v2/AudioEngine.jsx` - Audio playback system (600 lines)
- `src/app/session/v2/TeachingController.jsx` - Teaching stage machine with TTS (400 lines)
- `src/app/session/v2/ComprehensionPhase.jsx` - DEPRECATED, not used (comprehension handled inline in SessionPageV2)
- `src/app/session/v2/DiscussionPhase.jsx` - Discussion activities (200 lines)
- `src/app/session/v2/ExercisePhase.jsx` - Exercise questions with scoring (300 lines)
- `src/app/session/v2/WorksheetPhase.jsx` - Fill-in-blank questions (300 lines)
- `src/app/session/v2/TestPhase.jsx` - Graded test with review (400 lines)
- `src/app/session/v2/ClosingPhase.jsx` - Closing message with encouragement (150 lines)
- `src/app/session/v2/PhaseOrchestrator.jsx` - Session phase management (150 lines)
- `src/app/session/v2/SnapshotService.jsx` - Session persistence (300 lines)
- `src/app/session/v2/TimerService.jsx` - Session and work phase timers (350 lines)
- `src/app/session/v2/KeyboardService.jsx` - Keyboard hotkey management (150 lines)
- `src/app/session/v2/services.js` - API integration layer (TTS + lesson loading, includes question pools)
- `src/app/session/v2test/page.jsx` - Direct test route

### 32. src/app/session/v2/AudioEngine.jsx (b00f8222e6f278ea9df16d8ae24a4c45803094c441a9567d00c67743b3de523d)
- bm25: -3.6789 | entity_overlap_w: 2.60 | adjusted: -4.3289 | relevance: 1.0000

// If a video-unlock handler is still attached (e.g., autoplay was blocked during
    // initialize()), clear it so it cannot pause the first real TTS playback.
    try {
      if (this.#videoUnlockCleanupTimer) {
        clearTimeout(this.#videoUnlockCleanupTimer);
        this.#videoUnlockCleanupTimer = null;
      }
    } catch {}
    try {
      if (this.#videoUnlockPlayingHandler) {
        this.#videoElement.removeEventListener('playing', this.#videoUnlockPlayingHandler);
        this.#videoUnlockPlayingHandler = null;
      }
    } catch {}
    
    // Use robust retry mechanism from audioUtils (handles iOS edge cases)
    playVideoWithRetry(this.#videoElement, 3, 100).catch(() => {
      // Log silently if all retries fail to avoid breaking session
    });
  }
  
  // Private: Cleanup
  #cleanup() {
    this.#isPlaying = false;
    
    // Pause video when audio ends (video syncs with TTS)
    if (this.#videoElement) {
      try {
        this.#videoElement.pause();
      } catch {}
    }
    
    this.#clearCaptionTimers();
    this.#clearSpeechGuard();
  }
  
  // Private: Utilities
  #parseAudioInput(rawInput) {
    if (!rawInput) return null;

const raw = String(rawInput).trim();
    if (!raw) return null;

// Accept either a data URL or a raw base64 string.
    const match = raw.match(/^data:(audio\/[^;]+);base64,(.*)$/i);
    const contentType = match?.[1] || 'audio/mpeg';
    let b64 = (match?.[2] || raw).trim();

// Normalize: strip whitespace, base64url -> base64, add padding.
    b64 = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad === 2) b64 += '==';
    else if (pad === 3) b64 += '=';
    else if (pad === 1) b64 += '===';

return { contentType, b64 };
  }

### 33. src/app/session/page.js (69753b375f4d2cb4fc49cc16d8e27b4821c2bc10af77bfe4da4993eada08aab9)
- bm25: -3.6717 | entity_overlap_w: 2.60 | adjusted: -4.3217 | relevance: 1.0000

const startDiscussionStep = async () => {
    // CRITICAL: Unlock audio during user gesture (Begin click) - required for Chrome
    try {
      await unlockAudioPlaybackWrapped();
    } catch (e) {
      // Silent error handling
    }
    
    // Ensure we are not starting in a muted state
    try { setMuted(false); } catch {}
    try { mutedRef.current = false; } catch {}
    try { forceNextPlaybackRef.current = true; } catch {}
    
    // CRITICAL for Chrome: Preload video during user gesture but don't play yet
    // The video will start when TTS actually begins playing
    try {
      if (videoRef.current) {
        if (videoRef.current.readyState < 2) {
          videoRef.current.load();
          // Wait a moment for load to register
          await new Promise(r => setTimeout(r, 100));
        }
        // Just seek to first frame to unlock autoplay, but don't start playing yet
        try {
          videoRef.current.currentTime = 0;
        } catch (e) {
          // Fallback: briefly play then pause to unlock autoplay
          const playPromise = videoRef.current.play();
          if (playPromise && playPromise.then) {
            await playPromise.then(() => {
              try { videoRef.current.pause(); } catch {}
            });
          }
        }
      }
    } catch (e) {
      // Silent error handling
    }
    
  // Unified discussion is now generated locally: Greeting + Encouragement + next-step prompt (no joke/silly question)
    setCanSend(false);
    // Compose the opening text using local pools (no API/TTS for this step)
    const learnerName = (typeof window !== 'undefined' ? (localStorage.getItem('learner_name') || '') : '').trim();
    const lessonTitleExact = (effectiveLessonTitle && typeof effectiveLessonTitle === 'string' && effectiveLes

### 34. sidekick_pack.md (bba8c9d0a2ad1fcfae649c359a4219ed32e5a5913249044c89d6ec0d9ecb4d56)
- bm25: -3.6429 | entity_overlap_w: 2.60 | adjusted: -4.2929 | relevance: 1.0000

### Storage + Public Access (No Login)

Portfolios are stored as static files in Supabase Storage so reviewers do not need to log in.

### 35. docs/brain/visual-aids.md (85823dd0676182ce38771044864b6e03b9018a0ce74f1747deb60769ad470de3)
- bm25: -22.0390 | relevance: 1.0000

- **`src/app/session/components/SessionVisualAidsCarousel.js`** - Learner session display
  - Full-screen carousel during lesson
  - "Explain" button triggers Ms. Sonoma TTS of description
  - Read-only view (no editing)

### Integration Points
- **`src/app/facilitator/lessons/edit/page.js`** - Lesson editor
  - `handleGenerateVisualAids()` - initiates generation
  - Manages visual aids state and save flow

- **`src/app/facilitator/calendar/DayViewOverlay.jsx`** - Calendar scheduled-lesson inline editor
  - Provides the same "Generate Visual Aids" button as the regular editor via `LessonEditor` props
  - Loads/saves/generates via `/api/visual-aids/*` with bearer auth
  - Renders `VisualAidsCarousel` above the inline editor modal

- **`src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx`** - Mr. Mentor counselor
  - `handleGenerateVisualAids()` - generation from counselor lesson creation

- **`src/app/session/page.js`** - Learner session
  - Loads visual aids by normalized `lessonKey`
  - `onShowVisualAids()` - opens carousel
  - `onExplainVisualAid()` - triggers Ms. Sonoma explanation

- **`src/app/session/v2/SessionPageV2.jsx`** - Learner session (V2)
  - Loads visual aids by normalized `lessonKey`
  - Video overlay includes a Visual Aids button when images exist
  - Renders `SessionVisualAidsCarousel` and uses AudioEngine-backed TTS for Explain

### 35. sidekick_pack.md (df3b0d06c6e97315f9ac315d8fe85c1be37b146340873af631c44fae1bc3250f)
- bm25: -3.6358 | entity_overlap_w: 2.60 | adjusted: -4.2858 | relevance: 1.0000

### 2. docs/brain/visual-aids.md (85823dd0676182ce38771044864b6e03b9018a0ce74f1747deb60769ad470de3)
- bm25: -22.4515 | relevance: 1.0000

- **`src/app/session/components/SessionVisualAidsCarousel.js`** - Learner session display
  - Full-screen carousel during lesson
  - "Explain" button triggers Ms. Sonoma TTS of description
  - Read-only view (no editing)

### Integration Points
- **`src/app/facilitator/lessons/edit/page.js`** - Lesson editor
  - `handleGenerateVisualAids()` - initiates generation
  - Manages visual aids state and save flow

- **`src/app/facilitator/calendar/DayViewOverlay.jsx`** - Calendar scheduled-lesson inline editor
  - Provides the same "Generate Visual Aids" button as the regular editor via `LessonEditor` props
  - Loads/saves/generates via `/api/visual-aids/*` with bearer auth
  - Renders `VisualAidsCarousel` above the inline editor modal

- **`src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx`** - Mr. Mentor counselor
  - `handleGenerateVisualAids()` - generation from counselor lesson creation

- **`src/app/session/page.js`** - Learner session
  - Loads visual aids by normalized `lessonKey`
  - `onShowVisualAids()` - opens carousel
  - `onExplainVisualAid()` - triggers Ms. Sonoma explanation

- **`src/app/session/v2/SessionPageV2.jsx`** - Learner session (V2)
  - Loads visual aids by normalized `lessonKey`
  - Video overlay includes a Visual Aids button when images exist
  - Renders `SessionVisualAidsCarousel` and uses AudioEngine-backed TTS for Explain

### 3. src/app/facilitator/generator/counselor/CounselorClient.jsx (29fd22a6b836f2b375b277653c9ce728dd6250112309eb2eb1dd4cae49f9327a)
- bm25: -22.0646 | entity_overlap_w: 1.00 | adjusted: -22.3146 | relevance: 1.0000

### 36. docs/brain/tts-prefetching.md (82573e35d3de76ccd7683dbceabb9c66fd6c3d9cbf8e7438464c4c6ee0808e45)
- bm25: -4.2546 | relevance: 1.0000

// Prefetch the question after this one while student answers
try {
  if (Array.isArray(generatedComprehension) && currentCompIndex < generatedComprehension.length) {
    const prefetchProblem = generatedComprehension[currentCompIndex];
    const prefetchQ = ensureQuestionMark(formatQuestionForSpeech(prefetchProblem, { layout: 'multiline' }));
    const prefetchText = `${CELEBRATE_CORRECT[0]}. ${prefetchQ}`;
    ttsCache.prefetch(prefetchText);
  }
} catch {}
```

### 37. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (86b60aae069b5e5cd6312d1188af36820d92ad5d50ac3acdfbcc0206a1059f7c)
- bm25: -3.6006 | entity_overlap_w: 2.60 | adjusted: -4.2506 | relevance: 1.0000

### 2. docs/brain/visual-aids.md (85823dd0676182ce38771044864b6e03b9018a0ce74f1747deb60769ad470de3)
- bm25: -22.4515 | relevance: 1.0000

- **`src/app/session/components/SessionVisualAidsCarousel.js`** - Learner session display
  - Full-screen carousel during lesson
  - "Explain" button triggers Ms. Sonoma TTS of description
  - Read-only view (no editing)

### Integration Points
- **`src/app/facilitator/lessons/edit/page.js`** - Lesson editor
  - `handleGenerateVisualAids()` - initiates generation
  - Manages visual aids state and save flow

- **`src/app/facilitator/calendar/DayViewOverlay.jsx`** - Calendar scheduled-lesson inline editor
  - Provides the same "Generate Visual Aids" button as the regular editor via `LessonEditor` props
  - Loads/saves/generates via `/api/visual-aids/*` with bearer auth
  - Renders `VisualAidsCarousel` above the inline editor modal

- **`src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx`** - Mr. Mentor counselor
  - `handleGenerateVisualAids()` - generation from counselor lesson creation

- **`src/app/session/page.js`** - Learner session
  - Loads visual aids by normalized `lessonKey`
  - `onShowVisualAids()` - opens carousel
  - `onExplainVisualAid()` - triggers Ms. Sonoma explanation

- **`src/app/session/v2/SessionPageV2.jsx`** - Learner session (V2)
  - Loads visual aids by normalized `lessonKey`
  - Video overlay includes a Visual Aids button when images exist
  - Renders `SessionVisualAidsCarousel` and uses AudioEngine-backed TTS for Explain

### 3. src/app/facilitator/generator/counselor/CounselorClient.jsx (29fd22a6b836f2b375b277653c9ce728dd6250112309eb2eb1dd4cae49f9327a)
- bm25: -22.0646 | entity_overlap_w: 1.00 | adjusted: -22.3146 | relevance: 1.0000

### 38. docs/brain/tts-prefetching.md (20cc073772503cfe6baaa7bda436dd53dc02fbe589fd39e4fcad508f79f39b46)
- bm25: -3.9026 | entity_overlap_w: 1.30 | adjusted: -4.2276 | relevance: 1.0000

**DON'T cache indefinitely**
- LRU eviction at 10 items prevents memory growth
- Phase transitions clear cache (old phase audio irrelevant)

**DON'T prefetch more than one question ahead**
- Student might skip, fail, or use hint - next question unpredictable
- Better to prefetch N+1 after each answer than N+2..N+10 upfront

**DON'T trust question order without increment tracking**
```javascript
// WRONG - currentCompIndex already incremented, so array[currentCompIndex] is N+2 not N+1
const nextProblem = generatedComprehension[currentCompIndex];
setCurrentCompIndex(currentCompIndex + 1);
await speakFrontend(nextProblem);
ttsCache.prefetch(generatedComprehension[currentCompIndex]); // N+2!

// RIGHT - prefetch from same index that will be used next
const nextProblem = generatedComprehension[currentCompIndex];
setCurrentCompIndex(currentCompIndex + 1);
await speakFrontend(nextProblem);
// currentCompIndex now points to N+1 (just incremented)
ttsCache.prefetch(generatedComprehension[currentCompIndex]);
```

## Related Brain Files

- **[ms-sonoma-teaching-system.md](ms-sonoma-teaching-system.md)** - TTS integrates with Ms. Sonoma teaching flow and phase transitions

## Key Files

**Core Module**:
- `src/app/session/utils/ttsCache.js`: TTSCache class, LRU cache, prefetch logic

### 39. docs/brain/ingests/pack.lesson-schedule-debug.md (97751540286f2a57603f636cb881fe3d9cd46c0662c02fd8f3dc23c69ea8bd7d)
- bm25: -3.7871 | entity_overlap_w: 1.30 | adjusted: -4.1121 | relevance: 1.0000

**Test progression:**
1. Test each flow independently
2. Test parameter gathering Q&A
3. Test confirmation flows (yes/no/unclear)
4. Test lesson search with various queries
5. Test action execution (schedule/generate/edit)
6. Test recall with conversation history
7. Test bypass commands
8. Test API fallback for unhandled intents
9. Test TTS synchronization
10. Test conversation continuity across interceptor/API

### 40. docs/brain/snapshot-persistence.md (83771570e459d80f3130a04413886133c035ef9a1167a6692812acf99b672017)
- bm25: -3.4600 | entity_overlap_w: 2.60 | adjusted: -4.1100 | relevance: 1.0000

## Checkpoint Gates (Where Snapshots Save)

- **Discussion entry**: `begin-discussion` (no opening actions in V2).
- **Teaching**: `begin-teaching-definitions`, `vocab-sentence-1/N` (before each TTS), `begin-teaching-examples`, `example-sentence-1/N` (before each TTS).
- **Q&A seeding** (deterministic resume): `comprehension-init`, `exercise-init`, `worksheet-init`, `test-init` fire on phase start and persist question arrays + `nextQuestionIndex` + `score` + `answers` + `timerMode` (with `phaseOverride`).
- **Q&A post-Go (work-mode checkpoint)**: `comprehension-go`, `exercise-go`, `worksheet-go`, `test-go` fire immediately when the learner presses **Go**. These writes set `timerMode:'work'` with `nextQuestionIndex:0` so a refresh before answering Q1 resumes on the first question (not back to Opening Actions).
- **Q&A granular**: `comprehension-answer`, `comprehension-skip`, `exercise-answer`, `exercise-skip`, `worksheet-answer`, `worksheet-skip`, `test-answer`, `test-skip` after each submission/skip (payload includes questions, answers, next index, timerMode; Test also includes reviewIndex).
- **Navigation**: `skip-forward`, `skip-back` (timeline jumps).

## Related Brain Files

- **[timer-system.md](timer-system.md)** - Timer state (currentTimerMode, workPhaseCompletions, golden key) persisted in snapshots
- **[session-takeover.md](session-takeover.md)** - Takeover flow triggers snapshot restore with timer state

## Key Files

- `src/app/session/sessionSnapshotStore.js` - Save/restore with localStorage+database
- `src/app/session/hooks/useSnapshotPersistence.js` - scheduleSaveSnapshot wrapper
- `src/app/session/hooks/useTeachingFlow.js` - Teaching checkpoint saves
- `src/app/session/page.js` - Comprehension/phase checkpoint saves

## What Was Removed
