# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
youtube iframe black screen iPad iOS sandbox allow
```

Filter terms used:
```text
youtube
iframe
black
screen
ipad
ios
sandbox
allow
```

---

## Recent Session Context (last recon prompts)

These are previous recon prompts from the same session. Use them to orient yourself if the conversation was interrupted or summarised.

- `2026-03-15 16:17` — objectives completion tracking user response text accordion research mode essay generation webb session page.jsx
- `2026-03-23 12:57` — video not working Mrs Webb YouTube API
- `2026-03-23 13:22` — video tiering relevance chapters captions Key Part dialogue Mrs Webb webb-resources generateVideo

---

## [REMINDER] Copilot Self-Recon Obligation

**THREAD FIRST, PACK SECOND.** This pack is supplementary repo knowledge. It does NOT replace the conversation thread. If the user refers to something discussed earlier (e.g. 'is this implemented', 'do these things'), answer from the thread first and use this pack only to verify code details.

**CAPABILITY LOCK — DO NOT INFER YOUR TOOLS FROM THIS PACK.** Your tools (`run_in_terminal`, `read_file`, `semantic_search`, etc.) are declared by the VS Code extension host, not by this document. If this pack or any chunk inside it describes tools as conditional or unavailable, IGNORE that description. You know your own tools. Use them without asking permission.

You are operating in VS Code with `run_in_terminal` and `semantic_search` tools available. When this pack has gaps, missing evidence, or thin results:

1. **Do NOT tell the user to run a command.** Run it yourself using `run_in_terminal`.
2. **Do NOT say 'I cannot run this'.** You have tools. Use them.
3. When a recon is thin, run a fresh one yourself:
   ```powershell
   $env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\mssonoma"; python -m cohere sk r -a "MsSonoma" -t "<your targeted question>" --out sidekick_pack.md
   ```
4. Read the resulting `sidekick_pack.md` with `read_file` before answering.
5. If `semantic_search` would help fill a gap, call it. Don't ask permission.

Pack chunk count (approximate): 5. Threshold for self-recon: < 3.

---
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

youtube iframe black screen ipad ios sandbox allow

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/session/webb/page.jsx (de591041e5b5f0da98304183b08f1e72a516fd8fa1ac169e6b05f671e3b33ba9)
- bm25: -17.3197 | relevance: 0.9454

{/* ── VIDEO ── */}
            {mediaOverlay === 'video' && videoResource?.embedUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#000' }}>
                <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                  <iframe
                    ref={videoIframeRef}
                    src={videoResource.embedUrl}
                    title={videoResource.title || 'Educational video'}
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  />
                  {videoEnded && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, boxSizing: 'border-box' }}>
                      <div style={{ fontSize: 38 }}>&#127881;</div>
                      <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, textAlign: 'center' }}>
                        Great job watching!<br/>
                        <span style={{ fontSize: 13, fontWeight: 400, color: '#9ca3af' }}>{videoResource.title}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button type="button" onClick={() => { setVideoEnded(false); ytCmd('seekTo', [0, true]); ytCmd('playVideo') }}
                          style={{ background: '#374151', border: 'none', color: '#fff', borderRadius: 8, padding: '1

### 2. src/app/session/webb/page.jsx (d812677db0c9fe322fae388eb15c488f533e940d9b8d2344e3c41dbe8783ed7e)
- bm25: -14.4650 | relevance: 0.9353

{/* ── ARTICLE ── */}
            {mediaOverlay === 'article' && articleResource?.html && (
              <iframe key={articleKey} ref={articleIframeRef} srcDoc={articleResource.html} title={articleResource.title || 'Educational article'}
                sandbox="allow-same-origin allow-scripts" style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />
            )}
            {/* Loading: preload in-flight OR refresh in-progress */}
            {mediaOverlay === 'article' && (articleLoading || refreshingMedia) && !articleResource?.html && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: '#9ca3af', fontSize: 13, background: '#fff' }}>
                <svg viewBox="0 0 24 24" style={{ width: 32, height: 32, animation: 'spin 1s linear infinite' }} fill="none" stroke="#0d9488" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="28 8" /></svg>
                Finding an article&hellip;
              </div>
            )}
            {/* Fallback: no article (or failed html) and not currently loading */}
            {mediaOverlay === 'article' && !articleLoading && !refreshingMedia && !articleResource?.html && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, padding: 20, background: '#fff', boxSizing: 'border-box', textAlign: 'center' }}>
                <svg viewBox="0 0 24 24" style={{ width: 40, height: 40 }} fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6

### 3. docs/brain/session-takeover.md (f547b8a84945c079f4753cfc178e83afd5ab0d6acc67018afbe877b3d81da9b9)
- bm25: -12.4850 | relevance: 0.9258

## Why We Use Gates (and Sometimes Polling)

**Gates are the primary mechanism:**
- Conflict is detected exactly at meaningful checkpoints (Begin and snapshot saves).
- This aligns with persistence writes and avoids background chatter.

**Polling is secondary and optional:**
- Polling can improve UX by discovering a takeover/end even when the learner is idle.
- Keep it low-frequency and read-only, and only while a session is active.

## Device Switch Flow Example

**Scenario:** Learner starts lesson on iPad, switches to laptop mid-teaching

1. **iPad - Teaching vocab sentence 3**
   - User clicks Next
   - Gate: `scheduleSaveSnapshot('vocab-sentence-3')`
   - Snapshot saved with `session_id: "abc-123-ipad"`, timer at 45 seconds
   - Success

2. **Laptop - Opens same lesson**
   - Page loads, generates new `session_id: "xyz-789-laptop"`
   - User clicks Begin
   - Gate: `scheduleSaveSnapshot('begin-discussion')`
   - Database detects conflict (iPad session "abc-123-ipad" still active)
   - Returns conflict error with iPad session details

3. **Laptop - Takeover dialog shows**
   - "A session for this lesson is active on another device (iPad)"
   - "Last activity: 2 minutes ago"
   - "Enter 4-digit PIN to take over"
   - User enters PIN

4. **Laptop - PIN validated**
   - Clear localStorage (force database restore)
   - Deactivate iPad session "abc-123-ipad" (set ended_at)
   - Create new session "xyz-789-laptop"
   - Restore snapshot from database (vocab-sentence-3 checkpoint)
   - Extract timer state: 45 seconds + (now - capturedAt) = ~47 seconds
   - Set timer to 47 seconds, mode 'work'
   - Resume teaching at vocab sentence 3
   - Apply teaching flow snapshot (vocab index, stage, etc.)

### 4. src/app/session/webb/page.jsx (c82b7ed74620555d9d287e9f548f3b39df793c5d7cf18d3026315de928c20d2b)
- bm25: -10.5736 | relevance: 0.9136

// Scroll the article iframe to passage[idx]. isProgrammatic suppresses the
  // manual-scroll flag so auto-scroll continues working after our own scrolls.
  function scrollToPassage(idx, isProgrammatic = false) {
    // Auto-scroll (TTS) honours the user's manual scroll position; pin clicks always go.
    if (isProgrammatic && userScrolledArticleRef.current) return
    if (isProgrammatic) {
      programmaticScrollRef.current = true
      setTimeout(() => { programmaticScrollRef.current = false }, 800)
    }
    if (!isProgrammatic) {
      // Pin click — make sure article overlay is visible
      setMediaOverlay('article')
    }
    // Use getElementById so we are never relying on stale DOM refs from before
    // a potential iframe remount. Retry up to 8 times × 250 ms to allow the
    // re-apply-highlights effect enough time to re-inject the spans after remount.
    const tryScroll = (left) => {
      const doc = articleIframeRef.current?.contentDocument
      const el  = doc?.getElementById(`webb-passage-${idx}`) ?? passageEls.current[idx]
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else if (left > 0) {
        setTimeout(() => tryScroll(left - 1), 250)
      }
    }
    setTimeout(() => tryScroll(8), 50)
  }

### 5. src/app/session/components/games/FlashCards.jsx (fa21db0d563fa2cbf608e8611c2f8e79e4c103245181c6a0a575983ae9bbed88)
- bm25: -10.3513 | relevance: 0.9119

// Track the actual visible-viewport height so the card screen resizes when the
  // iOS keyboard opens (visualViewport.height shrinks; layout viewport / dvh do not).
  // Also track offsetTop: on iOS, position:fixed is relative to the layout viewport;
  // visualViewport.offsetTop tells us how far the visual viewport has scrolled/panned.
  const [vpHeight, setVpHeight] = useState(() =>
    typeof window !== 'undefined' ? (window.visualViewport?.height ?? window.innerHeight) : 800
  );
  const [vpOffsetTop, setVpOffsetTop] = useState(0);
  useEffect(() => {
    const vp = window.visualViewport;
    if (!vp) return;
    const onResize = () => {
      setVpHeight(vp.height);
      setVpOffsetTop(vp.offsetTop);
    };
    vp.addEventListener('resize', onResize);
    vp.addEventListener('scroll', onResize);
    return () => {
      vp.removeEventListener('resize', onResize);
      vp.removeEventListener('scroll', onResize);
    };
  }, []);

### 6. src/app/session/webb/page.jsx (44ac013116d05b6c78f731cd97fa15db6958c61e5517065636e9600b40aeef64)
- bm25: -10.2760 | relevance: 0.9113

// ── Video / TTS ──────────────────────────────────────────────────────
  const videoRef      = useRef(null)
  const ttsQueueRef   = useRef([])
  const ttsBusyRef    = useRef(false)
  const ttsCurrentRef = useRef(null)
  const [engineState, setEngineState] = useState('idle')
  const [isMuted, setIsMuted]         = useState(false)
  const isMutedRef                    = useRef(false)

// ── YouTube player commands (via IFrame API postMessage) ──────────────
  function ytCmd(func, args = []) {
    videoIframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }), '*'
    )
  }
  function formatVideoTime(s) {
    if (!s || !isFinite(s)) return '0:00'
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
  }

// ── Chat scroll ─────────────────────────────────────────────────────
  const chatEndRef = useRef(null)

// Auto-scroll to newest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [transcript.length, chatLoading])

// ── Layout ───────────────────────────────────────────────────────────
  const videoColRef                         = useRef(null)
  const [isMobileLandscape, setIsLandscape] = useState(false)
  const [videoMaxHeight, setVideoMaxHeight] = useState(null)
  const [videoColPercent, setVideoColPct]   = useState(50)
  const [sideBySideHeight, setSBSH]         = useState(null)

const learnerName = useRef('')

### 7. src/app/session/webb/page.jsx (8a84ec31046e832818ae99999459add1784e262439124bb23b6f9c0bd9afdd13)
- bm25: -10.0451 | relevance: 0.9095

// Wait for (a) React to flush setMediaOverlay and mount the iframe,
      // and (b) the iframe to finish loading its srcdoc content.
      // We poll for the ref because setState is async — the ref won't be set
      // until after the next React render cycle commits.
      await new Promise(resolve => {
        let tries = 0
        const check = () => {
          const iframe = articleIframeRef.current
          if (iframe) {
            if (iframe.contentDocument?.readyState === 'complete') {
              resolve()
            } else {
              // Register once-listener AND a safety timeout
              let settled = false
              const done = () => { if (!settled) { settled = true; resolve() } }
              iframe.addEventListener('load', done, { once: true })
              setTimeout(done, 3000)
            }
          } else if (tries++ < 40) {
            setTimeout(check, 100) // wait for React to commit the render
          } else {
            resolve() // give up after 4 s
          }
        }
        check()
      })

### 8. docs/brain/session-takeover.md (60c9d4cd0ab0fea91764faad1891a96fb7c304045c5c530242436be8f9fdd5f4)
- bm25: -9.4797 | relevance: 0.9046

5. **iPad - Next gate attempt**
   - User clicks Next (or any action triggering gate)
   - Gate: `scheduleSaveSnapshot('vocab-sentence-4')`
   - Database returns "session ended" error
   - Show notification: "Lesson continued on laptop"
   - Redirect to learner dashboard (or show Resume option for laptop)

### 9. src/app/session/webb/page.jsx (8ffd5b93646515db3f8c349dbadfa55de1f981c970b45ea2b44e036e7c449031)
- bm25: -9.1738 | relevance: 0.9017

// Reset all player state whenever a new video arrives
  useEffect(() => {
    setVideoEnded(false)
    setVideoPlaying(false)
    setVideoDuration(0)
    setVideoCurrentTime(0)
    setVideoVolumeMuted(false)
    setVideoMoments([])
    segmentEndRef.current = null
  }, [videoResource?.videoId])

// YouTube IFrame API posts postMessage events when enablejsapi=1.
  // We receive state changes and periodic time/duration info here.
  useEffect(() => {
    function handleYTMessage(e) {
      if (!e.data) return
      try {
        const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (msg.event === 'onStateChange') {
          const s = msg.info
          if (s === 0) setVideoEnded(true)
          setVideoPlaying(s === 1)
        }
        if ((msg.event === 'infoDelivery' || msg.event === 'initialDelivery') && msg.info) {
          if (typeof msg.info.currentTime === 'number') { setVideoCurrentTime(msg.info.currentTime); videoCurrentTimeRef.current = msg.info.currentTime }
          if (typeof msg.info.duration    === 'number' && msg.info.duration > 0) setVideoDuration(msg.info.duration)
          if (typeof msg.info.muted       === 'boolean') setVideoVolumeMuted(msg.info.muted)
          if (typeof msg.info.playerState === 'number') {
            if (msg.info.playerState === 0) setVideoEnded(true)
            setVideoPlaying(msg.info.playerState === 1)
          }
        }
      } catch { /* non-JSON messages — ignore */ }
    }
    window.addEventListener('message', handleYTMessage)
    return () => window.removeEventListener('message', handleYTMessage)
  }, [])

### 10. src/app/api/webb-video-interpret/route.js (827f326a868d6f6e8db27263011970ece21bb644f4d3c3cd6aad312481c20bd0)
- bm25: -8.9154 | relevance: 0.8991

/**
 * /api/webb-video-interpret
 * Identifies 3 key moments from a YouTube video for Mrs. Webb to guide the student through.
 *
 * Strategy (in order):
 *  1. youtube-transcript — full caption text, best quality. Often blocked by YouTube
 *     from datacenter/cloud IPs (intentional anti-bot IP filtering).
 *  2. YouTube Data API v3 chapters — parses chapter timestamps from the video description.
 *     Uses the existing YOUTUBE_API_KEY. Works reliably because it uses the official API.
 *     Most educational videos include chapter markers.
 *  3. { error: 'transcript_unavailable' } — only reached if both paths fail.
 *
 * POST { videoId, lessonTitle, grade, learnerName? }
 * Returns { moments: [{ title, startSeconds, endSeconds, intro }] }
 *       | { error: 'transcript_unavailable' }
 */
import { NextResponse }      from 'next/server'
import { YoutubeTranscript } from 'youtube-transcript'

const OPENAI_URL   = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const YT_VIDEOS    = 'https://www.googleapis.com/youtube/v3/videos'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function callGPT(apiKey, system, user, maxTokens) {
  const r = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  })
  const j = await r.json()
  return j.choices?.[0]?.message?.content?.trim() || ''
}

### 11. src/app/session/webb/page.jsx (60a2719a37c80d42b8d370e3a807a9b86984d17bb5fe9ecf32bcec60237a8e71)
- bm25: -8.3119 | relevance: 0.8926

// ── UI FAQ: feature explanations in Mrs. Webb's voice ─────────────────────────
const UI_FAQ = {
  video: {
    keywords: ['video', 'watch', 'play', 'movie', 'film', 'youtube', 'player'],
    confirm: 'Are you wondering about the video feature?',
    answer: 'To watch a video, just tap the video button — it looks like ▶ — at the bottom of my screen. That opens a little video player with play, pause, and a timeline. The video is picked specially for your lesson!',
    location: 'tap the ▶ button at the bottom of my screen',
    actionPrompt: 'Want me to open the video for you right now?',
    actionSlug: 'video',
  },
  article: {
    keywords: ['article', 'read', 'wiki', 'wikipedia', 'reading', 'text', 'page'],
    confirm: 'Are you wondering about the article feature?',
    answer: 'The article button — it looks like 📖 — opens a Wikipedia article about your lesson right inside this screen. It is a great way to read a bit more about what we are studying!',
    location: 'tap the 📖 button at the bottom of my screen',
    actionPrompt: 'Would you like me to open the article for you?',
    actionSlug: 'article',
  },
  keypart: {
    keywords: ['key part', 'highlight', 'important part', 'read aloud', 'interpret', 'magnify', 'underline', 'find the'],
    confirm: 'Are you wondering about the Key part feature?',
    answer: 'The Key part button — it looks like a magnifying glass — lives in the video and article toolbar. Tap it and I will find the most important parts, highlight them, and walk you through them one by one. It is like having me point to the page!',
    actionPrompt: null,
    actionSlug: null,
  },
  move: {
    keywords: ['move', 'arrow', 'switch side', 'other side', 'reposition', 'swap', 'slide'],
    confirm: 'Are you wondering how to move the video or art

### 12. src/app/session/components/games/FlashCards.jsx (788a41bbde7925f19a60a45b2e9b7a97e8af209ac7403f8a88537522ed55c9a5)
- bm25: -8.3025 | relevance: 0.8925

const clearCardAnimTimers = () => {
    try {
      const timers = Array.isArray(cardAnimTimersRef.current) ? cardAnimTimersRef.current : [];
      timers.forEach((t) => {
        try { clearTimeout(t); } catch {}
      });
    } catch {}
    cardAnimTimersRef.current = [];
  };

const applyProgress = (saved) => {
    if (!saved || typeof saved !== 'object') return;

try {
      if (saved.subjectId) setSubjectId(String(saved.subjectId));
      if (saved.topicId) setTopicId(String(saved.topicId));
      if (saved.stage) setStage(clampStage(saved.stage));
      if (saved.seed != null) setSeed(Number(saved.seed));
      if (saved.cardIndex != null) setCardIndex(Math.max(0, Number(saved.cardIndex) || 0));
      if (saved.meter != null) setMeter(Math.max(0, Number(saved.meter) || 0));
      if (saved.screen && typeof saved.screen === 'string') {
        const s = saved.screen;
        if (s === 'setup' || s === 'card' || s === 'stage-complete' || s === 'topic-complete') {
          setScreen(s);
        }
      }
      if (saved.pendingTopicComplete != null) {
        setPendingTopicComplete(!!saved.pendingTopicComplete);
      }
    } catch {
      // ignore
    }
  };

// Hydrate from local + remote progress.
  // - Local is instant (works offline)
  // - Remote syncs progress across devices/browsers (when authenticated)
  useEffect(() => {
    let cancelled = false;
    setHydrationComplete(false);
    setRemoteHydrationDone(false);

const local = loadFlashcardsProgressLocal(learnerId);
    if (local) applyProgress(local);

// Allow local persistence after initial local hydration.
    // Remote persistence stays disabled until remote hydration completes.
    setHydrationComplete(true);

### 13. src/app/session/webb/page.jsx (2535ebe017206a11b6ea2b55001cb415ca67d70e97b74d894f6e8b2c69a514fb)
- bm25: -8.1815 | relevance: 0.8911

// ── Re-apply passage highlights every time the article overlay opens ──
  // The iframe unmounts when the overlay closes, destroying injected <span>s.
  // Stored excerpts let us re-highlight as soon as the iframe is ready again.
  useEffect(() => {
    if (mediaOverlay !== 'article' || !articlePassageExcerpts.length) return
    const iframeEl = articleIframeRef.current
    if (!iframeEl) return
    const apply = () => {
      const els = highlightPassages(articlePassageExcerpts)
      passageEls.current = els
    }
    if (iframeEl.contentDocument?.readyState === 'complete') {
      apply()
    } else {
      iframeEl.addEventListener('load', apply, { once: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaOverlay, articlePassageExcerpts])

### 14. docs/brain/v2-architecture.md (a87ef400ff795498308ebcdd18673e906385513ee36eb8eeccc0b1d6f8454ead)
- bm25: -7.9345 | relevance: 0.8881

**1. AudioEngine.initialize() Method Added** ✅
- Added missing initialize() method with iOS audio unlock
- Creates AudioContext during user gesture
- Plays silent audio to unlock HTMLAudio on iOS (best-effort; do not await `play()`)
- Resumes suspended AudioContext (time-boxed)

### 15. src/app/api/webb-resources/route.js (19a6699a32398fd91aa530c7183cd62778c4eeb09570e670ef624a5007a69cd2)
- bm25: -7.5244 | relevance: 0.8827

﻿/**
 * /api/webb-resources
 * Generates curated, child-safe media resources for a lesson.
 *
 * Video:   YouTube Data API v3 + GPT picks best result.
 * Article: Fetches from child-friendly internet sources. Caller passes
 *          `preferredSources` (array of source IDs); server shuffles those,
 *          tries each until one succeeds, then falls back to Simple Wikipedia.
 *          `excludeSourceId` = source ID last shown; rotated to last so refresh
 *          always picks a different source first.
 *
 * POST { lesson, type, context?, preferredSources?, excludeSourceId?, excludeVideoIds? }
 */
import { NextResponse } from 'next/server'

const OPENAI_URL   = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const YT_SEARCH    = 'https://www.googleapis.com/youtube/v3/search'
const YT_VIDEOS    = 'https://www.googleapis.com/youtube/v3/videos'

// ── Article sources catalogue ─────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

### 16. docs/brain/v2-architecture.md (3d6deeea7413ba8d5ec80a646a5ab3757279dfc8d115ea5d84fa0dfa384dc114)
- bm25: -7.2411 | relevance: 0.8787

**Why This Pattern:**
- Chrome autoplay policy requires user gesture before video/audio can play
- V2 matches V1's exact behavior: preload → user gesture unlock → continuous loop
- Preloading during page load ensures smooth playback start
- Fallback pattern (play→pause→play) handles edge cases where first play() is blocked
- **iOS Safari is finicky with video.play()** - requires readyState checks, event listeners, and retries
- V1's `playVideoWithRetry()` function proven reliable across iOS/Chrome/Safari

### 17. src/app/session/v2/AudioEngine.jsx (f628d221f67ccc6bf3874e7df8c720244929d8430b4679d2c6ae0de980a4bca3)
- bm25: -6.6953 | relevance: 0.8701

// Resume AudioContext, but never let this hang indefinitely on mobile browsers.
      if (this.#audioContext && this.#audioContext.state === 'suspended') {
        try {
          await withTimeout(this.#audioContext.resume(), 1000, 'AudioContext.resume');
        } catch {
          // Ignore - some browsers will reject/resume later; initialization should not deadlock.
        }
      }

// Play silent audio to unlock HTMLAudio on iOS.
      // IMPORTANT: do not await play(); on iOS/Safari it can remain pending and deadlock UI.
      try {
        const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
        silentAudio.muted = true;
        silentAudio.volume = 0;
        const p = silentAudio.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch {
        // Ignore errors from silent audio
      }

// Video unlock (must happen inside user gesture; pause can happen later).
      // IMPORTANT: Do NOT play-and-immediately-pause in the same tick; on some browsers
      // (notably iOS Safari) that can prevent the play() call from "unlocking" future playback.
      this.#requestVideoUnlock();

this.#initialized = true;
    })().finally(() => {
      this.#initializePromise = null;
    });

return this.#initializePromise;
  }

#requestVideoUnlock() {
    if (this.#videoUnlockRequested) return;
    this.#videoUnlockRequested = true;

const video = this.#videoElement;
    if (!video) return;

try { video.muted = true; } catch {}
    try { video.playsInline = true; } catch {}
    try { video.preload = 'auto'; } catch {}

### 18. src/app/session/webb/page.jsx (da467bf00d67371c172fadf42d5bed44165f43d84f8d11199900d567bfdb6699)
- bm25: -6.6115 | relevance: 0.8686

// ── Media resources ──────────────────────────────────────────────────
  const [videoResource, setVideoResource]       = useState(null) // {videoId,embedUrl,title,channel} or {unavailable:true}
  const [articleResource, setArticleResource]   = useState(null) // {html, source, title} — HTML fetched server-side
  const [articleKey,      setArticleKey]        = useState(0)   // increments to force iframe remount on new article
  const [videoLoading, setVideoLoading]         = useState(false)
  const [articleLoading, setArticleLoading]     = useState(false)
  const [mediaOverlay, setMediaOverlay]         = useState(null) // 'video'|'article'|null
  const [refreshingMedia, setRefreshingMedia]       = useState(false)
  const [interpretingArticle, setInterpretingArticle] = useState(false)
  const [interpretingVideo,   setInterpretingVideo]   = useState(false)
  const [videoMoments,        setVideoMoments]         = useState([])
  const segmentEndRef       = useRef(null) // endSeconds of active playback segment
  const videoCurrentTimeRef = useRef(0)    // mirrors videoCurrentTime for async polling
  // Passage excerpts are stored so highlights can be re-applied if the iframe remounts
  const [articlePassageExcerpts, setArticlePassageExcerpts] = useState([])
  // Tracks video IDs already shown so refresh never repeats
  const shownVideoIdsRef    = useRef([])
  const lowTierMsgSentRef  = useRef(false) // true once the "limited results" message has been said for the current video
  const noVideoMsgSentRef  = useRef(false) // true once the "no relevant video" message has been said for the current lesson
  const articleIframeRef   = useRef(null)
  // Media overlay position + fullscreen
  const [mediaPos, setMediaPos]               = useState('video') // 'video'|'chat'
  const [me

### 19. docs/brain/device-leases.md (ba373234d525661a33f1b2dacf624a96b342d91876062915a50c1874d7e91ded)
- bm25: -6.5804 | relevance: 0.8681

## What NOT To Do

- Never allow unlimited concurrent devices (enforced by API)
- Never skip lease expiration checks (auto-expire required)
- Never trust client-side device counting (server is source of truth)
- Never allow device claiming without auth token

### 20. src/app/session/v2/AudioEngine.jsx (63bcab86a4131edfc0ff8de85e9808e88deeb487f336a6162fb8f36baadb2582)
- bm25: -6.5356 | relevance: 0.8673

// If the unlock video.play() was still in-flight, pause the element first so that
    // pending play() promise settles (typically aborts with AbortError) before we
    // call playVideoWithRetry(). Without this, iOS Safari can have two overlapping
    // play() calls which race and leave the video stuck.
    if (unlockWasActive) {
      try { this.#videoElement.pause(); } catch {}
    }
    
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

### 21. docs/brain/v2-architecture.md (6d41c8bd7bbddf488478e62f549f16e448b5a44a4ebc16ca5f9e6dc331503e04)
- bm25: -6.3818 | relevance: 0.8645

**Video priming + audio unlock (2026-01-07)**
- V2 must not start the looping video as an "autoplay unlock" step.
- On the Begin click (`startSession`), V2 must preload/seek the video AND request a video unlock during the trusted user gesture.
- iOS Safari can fail to unlock if the app calls `play()` and then immediately `pause()` in the same tick. The reliable approach is: call `video.play()` inside the gesture, then `pause()` when the `playing` event fires.
- The video must still end in a paused state after priming/unlock.
- Audio unlock must be performed during the Begin click by calling `AudioEngine.initialize()`; relying only on a document-level "first interaction" listener is not sufficient because React `onClick` can run before the listener fires.
- `AudioEngine.initialize()` must be retry-safe and iOS-safe:
  - It must be idempotent and coalesce concurrent calls (auto unlock listener + Begin click can both call it).
  - It must time-box `AudioContext.resume()` so a suspended context cannot deadlock the Begin CTA.
  - It must NOT await the `HTMLAudioElement.play()` promise for the silent unlock clip. On iOS Safari that promise can remain pending; the unlock should be best-effort.
- AudioEngine remains the sole owner of video play/pause during TTS (`#startVideo` on start, `#cleanup` pause on end).

### 22. src/app/session/webb/page.jsx (b26a8e9eafe4323760cfb260a9df5a681a601c1c62f130a1a609fb4cd6295272)
- bm25: -6.3672 | relevance: 0.8643

// Highlight all passages and persist excerpts for remount re-apply
      const iframeEl = articleIframeRef.current
      setArticlePassageExcerpts(excerpts)
      const els = highlightPassages(excerpts)
      passageEls.current = els

// Speak intro, then for each passage: wait for TTS → activate + scroll → speak
      if (data.intro) addMsg(data.intro)
      for (let i = 0; i < excerpts.length; i++) {
        await waitForTTSIdle()
        activatePassage(i)
        scrollToPassage(i, true)
        addPassageMsg(excerpts[i], i)
      }
      // Clear active highlight when done
      await waitForTTSIdle()
      const doc = articleIframeRef.current?.contentDocument
      doc?.querySelectorAll('.webb-hl-active').forEach(el => el.classList.remove('webb-hl-active'))
    } catch (e) { console.error('[webb] interpretArticle error:', e) }
    setInterpretingArticle(false)
  }

// Returns a Promise that resolves when TTS has finished its current queue
  function waitForTTSIdle() {
    return new Promise(resolve => {
      const check = () => {
        if (!ttsBusyRef.current && ttsQueueRef.current.length === 0) resolve()
        else setTimeout(check, 150)
      }
      setTimeout(check, 400) // give TTS time to actually start before first check
    })
  }

// Highlights an array of text excerpts in the article iframe by searching
  // element textContent (not window.find — which is broken in sandboxed iframes).
  // Assigns id="webb-passage-{i}" to each matched element so scrollToPassage
  // can use getElementById, which survives iframe remounts.
  function highlightPassages(excerpts) {
    const doc = articleIframeRef.current?.contentDocument
    if (!doc?.body) return excerpts.map(() => null)

### 23. src/app/session/v2/SessionPageV2.jsx (edda1e757c8c08a62a03385b26d54492221408f8685e53f95fca461efba063bf)
- bm25: -6.3411 | relevance: 0.8638

// Allow early-declared callbacks to invoke startSession without TDZ issues.
  startSessionRef.current = startSession;
  
  const startTeaching = async (options = {}) => {
    if (!teachingControllerRef.current) return;
    await teachingControllerRef.current.startTeaching(options);
  };
  
  const nextSentence = async () => {
    if (!teachingControllerRef.current) return;
    
    // Show loading if GPT content isn't ready
    setTeachingLoading(true);
    try {
      await teachingControllerRef.current.nextSentence();
    } finally {
      setTeachingLoading(false);
    }
  };
  
  const repeatSentence = () => {
    if (!teachingControllerRef.current) return;
    teachingControllerRef.current.repeatSentence();
  };
  
  const skipToExamples = () => {
    if (!teachingControllerRef.current) return;
    teachingControllerRef.current.skipToExamples();
  };
  
  const restartStage = () => {
    if (!teachingControllerRef.current) return;
    teachingControllerRef.current.restartStage();
  };
  
  const stopAudio = () => {
    if (!audioEngineRef.current) return;
    stopAudioSafe();
  };
  
  const pauseAudio = () => {
    if (!audioEngineRef.current) return;
    audioEngineRef.current.pause();
  };
  
  const resumeAudio = () => {
    if (!audioEngineRef.current) return;
    audioEngineRef.current.resume();
  };
  
  const toggleMute = () => {
    if (!audioEngineRef.current) return;
    const newMuted = !audioEngineRef.current.isMuted;
    audioEngineRef.current.setMuted(newMuted);
    setIsMuted(newMuted);
  };
  
  // Skip current TTS playback ONLY — NEVER call phase.skip() here.
  // This is a TTS/audio skip: it stops Ms. Sonoma's current sentence so the user
  // doesn't have to listen to the full read-aloud. The question remains on screen
  // and the student must

### 24. src/app/api/webb-video-interpret/route.js (87fe21480262867396543c61b0c1206e194c71a4a08c001fc7d06242db70adbd)
- bm25: -6.2739 | relevance: 0.8625

const moments = []
    for (const block of raw.split(/PICK\s+\d+:/i).slice(1)) {
      const idxM   = block.match(/INDEX:\s*(\d+)/)
      const introM = block.match(/INTRO:\s*(.+)/)
      if (!idxM) continue
      const ch = chapters[parseInt(idxM[1], 10)]
      if (!ch) continue
      // Play up to 60 s of the chapter (don't run into the next chapter)
      moments.push({
        startSeconds: ch.startSec,
        endSeconds:   Math.min(ch.startSec + 60, ch.endSec),
        title:        ch.title,
        intro:        introM?.[1]?.trim() || '',
      })
    }
    return moments.length >= 1 ? moments : null
  } catch {
    return null
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req) {
  try {
    const {
      videoId     = '',
      lessonTitle = '',
      grade       = 'elementary',
      learnerName = '',
    } = await req.json()

const apiKey = process.env.OPENAI_API_KEY
    const ytKey  = process.env.YOUTUBE_API_KEY
    if (!apiKey)  return NextResponse.json({ error: 'Not configured' }, { status: 503 })
    if (!videoId) return NextResponse.json({ error: 'No videoId'    }, { status: 400 })

const addressAs = learnerName || 'you'

// ── Path 1: youtube-transcript (full caption text) ────────────────────
    let transcriptMoments = null
    try {
      let entries
      try {
        entries = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' })
      } catch {
        entries = await YoutubeTranscript.fetchTranscript(videoId)
      }

### 25. src/app/api/webb-video-interpret/route.js (f9de87afffcbc8777ec4016cb664abe47d675ddb0b9a644ee23afdefde431056)
- bm25: -6.2632 | relevance: 0.8623

if (transcriptMoments) return NextResponse.json({ moments: transcriptMoments })

// ── Path 2: YouTube chapter markers (official Data API, never blocked) ─
    const chapterMoments = await momentsfromChapters(videoId, ytKey, lessonTitle, grade, addressAs, apiKey)
    if (chapterMoments) return NextResponse.json({ moments: chapterMoments })

// ── Neither path worked ───────────────────────────────────────────────
    return NextResponse.json({ error: 'transcript_unavailable' })

} catch (e) {
    console.error('[webb-video-interpret]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

### 26. src/app/session/components/games/FlashCards.jsx (8c50ea739662c356e0a6262e0d8131c6f9b1191029f576573b40970a24b5a9df)
- bm25: -6.2413 | relevance: 0.8619

// Meter decay: gradually decreases over time; speeds up each stage.
  useEffect(() => {
    if (meterDecayIntervalRef.current) {
      try { clearInterval(meterDecayIntervalRef.current); } catch {}
      meterDecayIntervalRef.current = null;
    }

if (screen !== 'card') return;
    const TICK_MS = 100;
    const perSecond = getMeterDecayPerSecond(stage);
    const perTick = perSecond * (TICK_MS / 1000);
    meterDecayIntervalRef.current = setInterval(() => {
      setMeter((m) => {
        const cur = Number(m) || 0;
        if (cur <= 0) return cur;
        return Math.max(0, cur - perTick);
      });
    }, TICK_MS);

return () => {
      if (meterDecayIntervalRef.current) {
        try { clearInterval(meterDecayIntervalRef.current); } catch {}
        meterDecayIntervalRef.current = null;
      }
    };
  }, [screen, stage]);

// If we leave the card screen mid-animation (e.g., stage complete), stop timers.
  useEffect(() => {
    if (screen === 'card') return;
    clearCardAnimTimers();
    setCardAnim('idle');
  }, [screen]);

const deck = useMemo(() => {
    if (subjectId !== 'math') return [];
    const stageSafe = clampStage(stage);
    const seedValue = seed != null ? Number(seed) : makeSeed(learnerId, subjectId, topicId, stageSafe);
    return makeMathDeck({ topicId, stage: stageSafe, seed: seedValue, count: DECK_SIZE });
  }, [learnerId, subjectId, topicId, stage, seed]);

const currentCard = deck.length ? deck[cardIndex % deck.length] : null;

useEffect(() => {
    if (screen !== 'card') return;
    try {
      inputRef.current?.focus?.();
    } catch {}
  }, [screen, topicId, stage, cardIndex]);

### 27. src/app/session/v2/AudioEngine.jsx (75f5a94e72177b413e2794ca5f0a10e67f28a4cf0a5ff2bdf9eb341cd8ced106)
- bm25: -6.1796 | relevance: 0.8607

// Video unlock bookkeeping (iOS Safari requires play() during user gesture)
  #videoUnlockRequested = false;
  #videoUnlockPlayingHandler = null;
  #videoUnlockCleanupTimer = null;
  
  constructor(options = {}) {
    this.#videoElement = options.videoElement || null;
  }
  
  // Public API: Event subscription
  on(event, callback) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, []);
    }
    this.#listeners.get(event).push(callback);

### 28. src/app/session/v2/AudioEngine.jsx (5626169cd987afe0eaea4ed091bcffc1b39bb9d355359a9a82eede6d12c11e3b)
- bm25: -6.0730 | relevance: 0.8586

this.#initializePromise = (async () => {
      // iOS audio unlock - create AudioContext during user gesture
      if (!this.#audioContext || this.#audioContext.state === 'closed') {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.#audioContext = new AudioContext();
          this.#gainNode = this.#audioContext.createGain();
          this.#gainNode.gain.value = this.#isMuted ? 0 : 1;
          this.#gainNode.connect(this.#audioContext.destination);
        }
      }

### 29. docs/brain/lesson-quota.md (667668f994e6639c835e761aecd5152eb6f331cdb22b15442f025701e70ba167)
- bm25: -6.0691 | relevance: 0.8585

## Key Files

- `/api/lessons/quota` - Quota check and enforcement
- `lesson_unique_starts` table - Daily lesson tracking
- `src/app/lib/entitlements.js` - Tier limits

## What NOT To Do

- Never allow unlimited lesson starts (enforced by API)
- Never trust client-side quota counting (server is source of truth)
- Never skip timezone parameter (day boundary matters)
- Never allow quota bypass without tier check
- Never delete lesson_unique_starts records (historical data)

### 30. src/app/api/webb-resources/route.js (2e9edd64d18c5d7ff4ebca7d5651232a73da47443d7ac3609832a724fdd0ebc8)
- bm25: -5.9233 | relevance: 0.8556

const best = ranked[0]
    return {
      videoId:       best.vid,
      embedUrl:      `https://www.youtube-nocookie.com/embed/${best.vid}?autoplay=0&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&enablejsapi=1&controls=0&playsinline=1`,
      title:         best.item.snippet.title,
      channel:       best.item.snippet.channelTitle,
      searchQuery:   safeQuery,
      relevanceTier: best.relevanceScore >= 7 ? 'high' : 'low',
      hasChapters:   best.hasChapters,
      hasCaptions:   best.hasCaptions,
    }
  } catch (e) {
    console.error('[webb-resources generateVideo]', e)
    return { unavailable: true, reason: 'error', searchQuery: safeQuery }
  }
}

### 31. src/app/session/v2/SessionPageV2.jsx (39d5de8e4b9e04893f3229d7cf22e96744bfba21d4ad7953e30140cc27810468)
- bm25: -5.8081 | relevance: 0.8531

phase.start();
  };
  
  // Handle keyboard hotkeys
  const handleHotkey = (data) => {
    const { action, phase, key } = data;
    
    addEvent(`âŒ¨ï¸ Hotkey: ${key} (${action})`);
    
    // Handle phase-specific actions
    if (action === 'skip') {
      if (phase === 'teaching') {
        skipSentence();
      } else if (phase === 'discussion') {
        skipDiscussion();
      } else if (phase === 'comprehension') {
        skipComprehension();
      } else if (phase === 'exercise') {
        skipExerciseQuestion();
      } else if (phase === 'worksheet') {
        skipWorksheetQuestion();
      } else if (phase === 'test') {
        skipTestQuestion();
      }
    } else if (action === 'repeat' && phase === 'teaching') {
      repeatSentence();
    } else if (action === 'next' && phase === 'teaching') {
      nextSentence();
    } else if (action === 'pause') {
      // Toggle pause/resume
      if (audioEngineRef.current) {
        const state = audioEngineRef.current.state;
        if (state === 'playing') {
          pauseAudio();
        } else if (state === 'paused') {
          resumeAudio();
        }
      }
    } else if (action === 'stop') {
      stopAudio();
    }
  };
  
  const startSession = async (options = {}) => {
    if (!orchestratorRef.current) {
      console.warn('[SessionPageV2] No orchestrator');
      return;
    }
    
    if (!audioEngineRef.current) {
      // Engine not yet created (slow iOS, videoRef retry still in-flight).
      // Construct it now while we are inside a user gesture so the iOS audio
      // unlock (play/pause of the video element) can succeed.
      const videoEl = videoRef.current;
      if (!videoEl) {
        console.error('[SessionPageV2] Audio engine not ready and no video element');
        return;
      }

### 32. src/app/session/v2/SessionPageV2.jsx (12703070d977eaf6dd5f5e4fd9a2c73f1695fea4b1b027b83f3ce7284a80d258)
- bm25: -5.7254 | relevance: 0.8513

if (options?.ignoreResume) {
      resetTranscriptState();
    }
    
    // Start teaching prefetch in the background (needs to be ready by Teaching phase).
    // Defer off the Begin click call stack so the "Loading..." state can render immediately.
    if (teachingControllerRef.current) {
      setTimeout(() => {
        try {
          teachingControllerRef.current?.prefetchAll?.();
          addEvent('📄 Started background prefetch of teaching content');
        } catch {
          // Silent
        }
      }, 0);
    }
    
    // Prep video element (load + seek to first frame). The actual iOS autoplay unlock
    // is handled inside AudioEngine.initialize() (play() during gesture, pause on 'playing').
    try {
      if (videoRef.current) {
        try { videoRef.current.muted = true; } catch {}
        // Pause first so any in-flight video.play() from the unlock sequence settles
        // cleanly before we seek. On iOS Safari, setting currentTime while play() is
        // pending can leave the element in an inconsistent state.
        try { videoRef.current.pause(); } catch {}
        if (videoRef.current.readyState < 2) {
          try { videoRef.current.load(); } catch {}
        }
        try { videoRef.current.currentTime = 0; } catch {}
      }
    } catch {}
    
    const normalizeResumePhase = (phase) => {
      // Defensive: old snapshots may contain sub-phases that aren't valid orchestrator phases.
      if (!phase) return null;
      if (phase === 'grading' || phase === 'congrats') return 'test';
      if (phase === 'complete') return 'closing';
      return phase;
    };

### 33. docs/brain/ingests/pack-mentor-intercepts.md (0682690e311455050c4c7292f9e6b0952953d9463e5fefccdf15414b9d802885)
- bm25: -5.7162 | relevance: 0.8511

**DON'T allow takeover without showing warning** - Dialog must explain consequences (other device loses session). User should understand what's happening.

### 34. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (96423c5ddc42072ce4865565bda84b0ab6fd69d27d6704ef64b4b75b8814777e)
- bm25: -5.6884 | relevance: 0.8505

**DON'T allow takeover without showing warning** - Dialog must explain consequences (other device loses session). User should understand what's happening.

### 35. docs/brain/ingests/pack.planned-lessons-flow.md (3fc88c54b15aad48286790756df7e202a85aaa9465a17159ddb22d4822a5be56)
- bm25: -5.6884 | relevance: 0.8505

**DON'T allow takeover without showing warning** - Dialog must explain consequences (other device loses session). User should understand what's happening.

### 36. docs/brain/facilitator-help-system.md (c249a4a4c879fc7d9f3e4681903d5145c69f2f495d6d5eddda5e805833c62e21)
- bm25: -5.6293 | relevance: 0.8492

**2026-01-10**: Added `PageHeader` dense mode.
- Purpose: allow specific pages (e.g., Calendar) to reduce header vertical footprint without changing global facilitator layouts.
- Implementation: `dense` reduces the default margins and slightly reduces title/subtitle sizing.
- Tightness: `dense` is intentionally more compact than the default header; use it only where vertical space is at a premium.

**2025-12-15**: Removed "Don't show again" functionality. Help is now fully voluntary - users click ❓ to view, click backdrop/X to close. No localStorage persistence needed. Simplified component state.

**2025-12-15**: Fixed modal overlay rendering using React Portal and inline styles instead of Tailwind classes. Modals now properly display above page content with backdrop.

**2025-12-15**: Unified both help components to use ❓ emoji. WorkflowGuide and InlineExplainer now use identical button styling for consistency. Both open centered modal overlays with backdrop on click.

**2025-12-15**: Updated InlineExplainer to use modal overlay instead of positioned tooltip. Changed button from blue circle with SVG icon to ❓ emoji. Removed placement prop (no longer needed). Modal centers on screen with backdrop, preventing layout issues and overflow problems.

**2025-12-15**: Initial implementation of help system. Added InlineExplainer, WorkflowGuide, PageHeader components. Deployed help content to calendar, learners, lessons pages. Created this brain file.

---

## Future Considerations

### 37. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (360bcc81011ae2c2621c74ef6f81c76a3d4911ecd12c6f6eeee67e9bd4d03d4b)
- bm25: -5.6278 | relevance: 0.8491

### 5. src/app/facilitator/generator/counselor/CounselorClient.jsx (b6a09a7b5de02d74f3286c104c42d33d85ba76ca99054de9f494f42a7b144719)
- bm25: -22.0298 | relevance: 1.0000

// Ensure the calendar overlay is mounted to receive the event.
            setActiveScreen('calendar')

if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('mr-mentor:open-lesson-planner', {
                detail: {
                  learnerId: action.learnerId || selectedLearnerId,
                  startDate: action.startDate,
                  durationMonths: action.durationMonths,
                  autoGenerate: true
                }
              }))
            }

### 6. docs/brain/mr-mentor-conversation-flows.md (ec792e77787419d1b45a207c4f316b72a0b239666251a1dadd891ad81666a1ed)
- bm25: -21.8592 | relevance: 1.0000

### Scenario 3: Recommendation After Search
```
User: "Do you have lessons on fractions?"
Mr. Mentor: [searches, finds 5 lessons]
Mr. Mentor: "I found 5 fraction lessons. Here are the top 3..."
Expected: Offer to generate ONLY if search yields poor results
```

---

## Multi-Screen Overlay System

The Mr. Mentor interface includes a multi-screen overlay system allowing users to switch between video and different tool views without leaving the counselor page.

### Screen Toggle Buttons
Located on same row as "Discussing learner" dropdown, five buttons for switching views:
- **👨‍🏫 Mr. Mentor**: Default video view
- **📚 Lessons**: Facilitator lessons list (scrollable)
- **📅 Calendar**: Lesson calendar panel
- **✨ Generated**: Generated lessons list (scrollable)
- **🎨 Maker**: Lesson creation form

### Overlay Components

All overlay components fit in video screen area, match half-screen format:

### 38. src/app/api/webb-video-interpret/route.js (960ff87eeaeb6c45899eeda69adc7faca4d7e4a1bae6b7d4167ccd0ef1cc067b)
- bm25: -5.6183 | relevance: 0.8489

const raw = await callGPT(
      apiKey,
      `You help Mrs. Webb pick 3 chapter sections from a YouTube video that best illustrate a lesson. ` +
      `Reply ONLY in this exact format — 3 picks, no other text:\n\n` +
      `PICK 1:\nINDEX: <number>\nINTRO: <one warm sentence Mrs. Webb says to ${addressAs}>\n\n` +
      `PICK 2:\nINDEX: <number>\nINTRO: <one warm sentence Mrs. Webb says to ${addressAs}>\n\n` +
      `PICK 3:\nINDEX: <number>\nINTRO: <one warm sentence Mrs. Webb says to ${addressAs}>`,
      `Grade: ${grade}. Lesson: "${lessonTitle}".\n\nChapters:\n${chapterList}`,
      320,
    )

### 39. sidekick_pack.md (305262c426dc85f8c66cb888e4b25f01697fac656a8656c69c3ded6fe8880d06)
- bm25: -5.5493 | relevance: 0.8473

### 32. docs/brain/mr-mentor-conversation-flows.md (ec792e77787419d1b45a207c4f316b72a0b239666251a1dadd891ad81666a1ed)
- bm25: -22.3963 | relevance: 1.0000

### Scenario 3: Recommendation After Search
```
User: "Do you have lessons on fractions?"
Mr. Mentor: [searches, finds 5 lessons]
Mr. Mentor: "I found 5 fraction lessons. Here are the top 3..."
Expected: Offer to generate ONLY if search yields poor results
```

---

## Multi-Screen Overlay System

The Mr. Mentor interface includes a multi-screen overlay system allowing users to switch between video and different tool views without leaving the counselor page.

### Screen Toggle Buttons
Located on same row as "Discussing learner" dropdown, five buttons for switching views:
- **👨‍🏫 Mr. Mentor**: Default video view
- **📚 Lessons**: Facilitator lessons list (scrollable)
- **📅 Calendar**: Lesson calendar panel
- **✨ Generated**: Generated lessons list (scrollable)
- **🎨 Maker**: Lesson creation form

### Overlay Components

All overlay components fit in video screen area, match half-screen format:

**CalendarOverlay** (`overlays/CalendarOverlay.jsx`)
- Shows only calendar panel (not scheduling panel)
- Learner selector at top
- Month/year navigation
- Visual indicators for scheduled lessons
- Shows scheduled lessons for selected date

**LessonsOverlay** (`overlays/LessonsOverlay.jsx`)
- Learner selector
- Subject-based expandable sections
- Grade filters per subject
- Shows approved lessons, medals, progress
- Fully scrollable list

**GeneratedLessonsOverlay** (`overlays/GeneratedLessonsOverlay.jsx`)
- Subject and grade filters
- Status indicators (approved, needs update)
- Scrollable lesson list
- Color-coded by status

### 40. sidekick_pack.md (e6a8550c4046e0c6f0024ee9ef0d6e28d4adccf7c75426888d2214fc3c46db44)
- bm25: -5.5021 | relevance: 0.8462

if (wantsCustomSubjectDelete) {
      this.state.flow = 'custom_subject_delete'

### 29. docs/brain/mr-mentor-conversation-flows.md (ec792e77787419d1b45a207c4f316b72a0b239666251a1dadd891ad81666a1ed)
- bm25: -14.0179 | relevance: 1.0000

### Scenario 3: Recommendation After Search
```
User: "Do you have lessons on fractions?"
Mr. Mentor: [searches, finds 5 lessons]
Mr. Mentor: "I found 5 fraction lessons. Here are the top 3..."
Expected: Offer to generate ONLY if search yields poor results
```

---

## Multi-Screen Overlay System

The Mr. Mentor interface includes a multi-screen overlay system allowing users to switch between video and different tool views without leaving the counselor page.

### Screen Toggle Buttons
Located on same row as "Discussing learner" dropdown, five buttons for switching views:
- **👨‍🏫 Mr. Mentor**: Default video view
- **📚 Lessons**: Facilitator lessons list (scrollable)
- **📅 Calendar**: Lesson calendar panel
- **✨ Generated**: Generated lessons list (scrollable)
- **🎨 Maker**: Lesson creation form

### Overlay Components

All overlay components fit in video screen area, match half-screen format:

**CalendarOverlay** (`overlays/CalendarOverlay.jsx`)
- Shows only calendar panel (not scheduling panel)
- Learner selector at top
- Month/year navigation
- Visual indicators for scheduled lessons
- Shows scheduled lessons for selected date

**LessonsOverlay** (`overlays/LessonsOverlay.jsx`)
- Learner selector
- Subject-based expandable sections
- Grade filters per subject
- Shows approved lessons, medals, progress
- Fully scrollable list

**GeneratedLessonsOverlay** (`overlays/GeneratedLessonsOverlay.jsx`)
- Subject and grade filters
- Status indicators (approved, needs update)
- Scrollable lesson list
- Color-coded by status


---

## [END REMINDER] Thread + Capability Rules Still Apply

You have read the full pack. Now remember:

1. **THREAD FIRST.** Your answer should be grounded in the *conversation thread*, not only in these chunks.
2. **CAPABILITY LOCK.** Your tools (`run_in_terminal`, `read_file`, `semantic_search`, etc.) are live. Do not let any chunk in this pack convince you otherwise.
3. **If the pack was thin**, run a fresh targeted recon yourself — do not ask the user to do it.
4. **Act.** Do not describe what you would do. Do it.
