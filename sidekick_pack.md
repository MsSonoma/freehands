# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
media overlay does not appear when video or article button is pressed webb page.jsx portal createPortal overlayPanelStyle overlayRect
```

Filter terms used:
```text
page.jsx
media
overlay
not
appear
video
article
button
pressed
webb
page
jsx
```

---

## Recent Session Context (last recon prompts)

These are previous recon prompts from the same session. Use them to orient yourself if the conversation was interrupted or summarised.

- `2026-03-13 11:54` — Mrs. Webb lesson flow session page ContentViewer VideoPlayer TextReader RemediationPanel RewardVideo state machine prese
- `2026-03-13 12:26` — Ms. Sonoma session page layout video transcript TTS responsive landscape portrait side by side stacked mute skip buttons
- `2026-03-13 13:01` — Mr. Slate lesson browser — how lessons are listed, filtered, selected, what data is shown per lesson card, what API rout

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

page.jsx media overlay not appear video article button pressed webb page jsx

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/session/webb/page.jsx (84895a0d1eefe59a8675fd38023ffe2d8ccfc03176653e5a97f48d4fbb309797)
- bm25: -28.7395 | relevance: 0.9664

// ── Refresh a media resource (context-aware) ──────────────────────────
  async function refreshMedia(type) {
    setRefreshingMedia(true)
    const recentContext = chatMessages.slice(-6)
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('. ')
    try {
      const res = await fetch('/api/webb-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson: selectedLesson,
          type,
          context: recentContext,
          previousSource:         type === 'article' ? (articleResource?.source || '') : '',
          excludeVideoIds:        type === 'video'   ? shownVideoIdsRef.current      : [],
        }),
      })
      const data = await res.json()
      if (type === 'video' && data.video) {
        setVideoResource(data.video)
        if (data.video.videoId)
          shownVideoIdsRef.current = [...new Set([...shownVideoIdsRef.current, data.video.videoId])]
      }
      if (type === 'article' && data.article) {
        setArticleResource(data.article)
      }
    } catch {}
    setRefreshingMedia(false)
  }

### 2. src/app/session/webb/page.jsx (f85ebe6d03e14606a895127137a516342f1c8af9f5d46af83fac19f9ba104ed1)
- bm25: -26.0219 | relevance: 0.9630

{/* Overlay buttons — bottom left: Video + Article (chatting phase) */}
            {isChatting && (
              <div style={{ position: 'absolute', bottom: 14, left: 14, display: 'flex', gap: 10, zIndex: 10 }}>
                <button
                  type="button"
                  onClick={() => { setMediaOverlay(v => v === 'video' ? null : 'video') }}
                  aria-label="Watch a video"
                  title={videoLoading ? 'Loading video…' : videoResource ? 'Watch a video' : 'Loading video…'}
                  style={{ ...overlayBtnStyle, background: mediaOverlay === 'video' ? C.accent : '#1f2937', opacity: videoLoading ? 0.55 : 1 }}
                >
                  {videoLoading
                    ? <svg style={{ width: '55%', height: '55%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="28 8" /></svg>
                    : <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  }
                </button>
                <button
                  type="button"
                  onClick={() => { setMediaOverlay(v => v === 'article' ? null : 'article') }}
                  aria-label="Read Wikipedia article"
                  title={articleLoading ? 'Finding Wikipedia article…' : articleResource ? `Wikipedia: ${articleResource.wikiTitle}` : 'Finding Wikipedia article…'}
                  style={{ ...overlayBtnStyle, background: mediaOverlay === 'article' ? C.accent : '#1f2937', opacity: articleLoading ? 0.55 : 1 }}
                >
                  {articleLoading
                    ? <svg style={{ width: '55%', height: '55%

### 3. src/app/session/webb/page.jsx (15f979bbfbb35cc32e66b4a91f94dfb5ba6c54f085bcf6e19bd6be07472bae5d)
- bm25: -24.5461 | relevance: 0.9609

// ── Media resources ──────────────────────────────────────────────────
  const [videoResource, setVideoResource]       = useState(null) // {videoId,embedUrl,title,channel} or {unavailable:true}
  const [articleResource, setArticleResource]   = useState(null) // {html, source, title} — HTML fetched server-side
  const [videoLoading, setVideoLoading]         = useState(false)
  const [articleLoading, setArticleLoading]     = useState(false)
  const [mediaOverlay, setMediaOverlay]         = useState(null) // 'video'|'article'|null
  const [refreshingMedia, setRefreshingMedia]   = useState(false)
  // Tracks video IDs already shown so refresh never repeats
  const shownVideoIdsRef = useRef([])
  // Media overlay position + fullscreen
  const [mediaPos, setMediaPos]               = useState('video') // 'video'|'chat'
  const [mediaIsFullscreen, setMediaIsFullscreen] = useState(false)
  const mediaOverlayRef = useRef(null)
  const chatColRef      = useRef(null)
  const videoInnerRef   = useRef(null)
  const [overlayRect, setOverlayRect]         = useState(null)
  // YouTube end-screen: true once the player posts a 'ended' state message
  const [videoEnded, setVideoEnded]           = useState(false)
  // Custom player controls state
  const [videoPlaying, setVideoPlaying]       = useState(false)
  const [videoDuration, setVideoDuration]     = useState(0)
  const [videoCurrentTime, setVideoCurrentTime] = useState(0)
  const [videoVolumeMuted, setVideoVolumeMuted] = useState(false)
  const videoIframeRef = useRef(null)

### 4. src/app/session/webb/page.jsx (30752c5f94fed3af2fc1ea6e9b401601ee602f7a42eaaec9719427125f744232)
- bm25: -23.1616 | relevance: 0.9586

// ── Preload resources for lesson ──────────────────────────────────────
  // Video and article are fetched in parallel but independently so each
  // resolves as soon as it's ready (video ~3s, article ~4s).
  const preloadResources = useCallback((lesson) => {
    setVideoResource(null)
    setArticleResource(null)
    setVideoLoading(true)
    setArticleLoading(true)
    shownVideoIdsRef.current = []

const post = (type) => fetch('/api/webb-resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lesson, type }),
    })

// Video
    post('video')
      .then(r => r.json())
      .then(data => {
        if (data.video) {
          setVideoResource(data.video)
          if (data.video.videoId) shownVideoIdsRef.current = [data.video.videoId]
        }
      })
      .catch(() => {})
      .finally(() => setVideoLoading(false))

// Article
    post('article')
      .then(r => r.json())
      .then(data => {
        if (data.article) {
          setArticleResource(data.article)
        }
      })
      .catch(() => {})
      .finally(() => setArticleLoading(false))
  }, [])

// ── Select lesson → start AI chat ─────────────────────────────────────
  const selectLesson = useCallback(async (lesson) => {
    setPhase(PHASE.STARTING)
    setSelectedLesson(lesson)
    setTranscript([])
    setActiveIndex(-1)
    setChatMessages([])
    setVideoResource(null)
    setArticleResource(null)
    setMediaOverlay(null)
    setPageError('')

### 5. src/app/session/webb/page.jsx (bd8984679af9a6081644d0b53498eabb4aba623f68cf5265f537556bfb6dd67d)
- bm25: -22.8701 | relevance: 0.9581

{/* Footer: chat input */}
      {isChatting && (
        <div style={footerStyle}>
          <StudentInput
            onSend={sendMessage}
            loading={chatLoading}
          />
        </div>
      )}

{/* ── Portaled media overlay — position:fixed, moves between video/chat cols ── */}
      {isChatting && mediaOverlay && overlayPanelStyle && createPortal(
        <div ref={mediaOverlayRef} style={overlayPanelStyle}>

### 6. src/app/api/webb-resources/route.js (646fc5525bc8ce35812dd96b483f22b47f860ce91463d76fe1e7f8ea4da5d51a)
- bm25: -22.4327 | relevance: 0.9573

﻿/**
 * /api/webb-resources
 * Generates curated, child-safe media resources for a lesson.
 *
 * Video:   YouTube Data API v3 + GPT safety review of title/channel/description
 * Article: Fetches directly from Wikipedia REST APIs (Simple English first, then English)
 *          (srcdoc approach bypasses X-Frame-Options; no client-side fetching needed)
 *
 * POST { lesson, type: 'video'|'article'|'both', context? }
 * Returns:
 *   video?:   { embedUrl, title, channel, searchQuery }  — real playable embed
 *          OR { unavailable: true, searchQuery }          — no key / all rejected
 *   article?: { html, source, title }                    — ready for srcdoc iframe
 *          OR { html: null, source: null, title }        — all fetches failed
 */
import { NextResponse } from 'next/server'

const OPENAI_URL   = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const YT_SEARCH    = 'https://www.googleapis.com/youtube/v3/search'

// ── Wikipedia REST API sources (open, no-auth, work from cloud hosting) ───────
const WIKI_SOURCES = [
  {
    name: 'Simple English Wikipedia',
    url:  t => `https://simple.wikipedia.org/api/rest_v1/page/mobile-html/${encodeURIComponent(t.replace(/\s+/g, '_'))}`,
    base: 'https://simple.wikipedia.org',
  },
  {
    name: 'Wikipedia',
    url:  t => `https://en.wikipedia.org/api/rest_v1/page/mobile-html/${encodeURIComponent(t.replace(/\s+/g, '_'))}`,
    base: 'https://en.wikipedia.org',
  },
]

### 7. src/app/session/webb/page.jsx (52d7a4839fe0aec749cafb2e5ee7a05216218e3f09eee846474db9b73e9d098b)
- bm25: -22.1919 | relevance: 0.9569

{/* Teacher video */}
            <video
              ref={videoRef}
              src="/media/webb-teacher.mp4"
              muted loop playsInline preload="auto"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
            />

### 8. src/app/session/webb/page.jsx (f623e1b80cfe5c445a4bb1d9bd91a4bf9e9525019f0d8184b1cbeb71a39770e2)
- bm25: -20.8641 | relevance: 0.9543

{/* Toolbar */}
          <div style={{ background: 'rgba(15,118,110,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
              {mediaOverlay === 'video' ? '\u25B6 VIDEO' : '\uD83D\uDCD6 ARTICLE'}
              {mediaOverlay === 'article' && articleResource?.source && (
                <span style={{ opacity: 0.75, fontWeight: 400, marginLeft: 4 }}>\u00B7 {articleResource.source}</span>
              )}
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {/* Refresh */}
              <button type="button" onClick={() => refreshMedia(mediaOverlay)} disabled={refreshingMedia} title="Load a different one"
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 12, cursor: refreshingMedia ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                {refreshingMedia ? '\u2026' : '\u21BB'}
              </button>
              {/* Move arrow — hidden in fullscreen */}
              {!mediaIsFullscreen && (
                <button type="button"
                  onClick={() => setMediaPos(p => p === 'video' ? 'chat' : 'video')}
                  title={mediaMoveToChat ? 'Move to conversation' : 'Move to video'}
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }}>
                  {arrowGlyph}
                </button>
              )}
              {/* Fullscreen toggle */}
              <button typ

### 9. src/app/api/webb-resources/route.js (f50d22a7d55acd7696a13a93c2acce3b188807ada628c2474c7a7096405f6cb4)
- bm25: -19.2457 | relevance: 0.9506

const title   = lesson.title   || 'general topic'
    const subject = lesson.subject || 'general'
    const grade   = lesson.grade   ? `Grade ${lesson.grade}` : 'elementary'
    const ctx     = context ? ` Student discussion context: ${context.slice(0, 300)}` : ''
    const prevSrc = String(previousSource || '').slice(0, 60)

const needVideo   = type === 'video'   || type === 'both'
    const needArticle = type === 'article' || type === 'both'

// Run video and article generation in parallel
    const [videoResult, articleResult] = await Promise.all([
      needVideo   ? generateVideo(apiKey, ytKey, title, subject, grade, ctx)   : null,
      needArticle ? generateArticle(title, prevSrc) : null,
    ])

return NextResponse.json({
      ...(videoResult   ? { video:   videoResult   } : {}),
      ...(articleResult ? { article: articleResult } : {}),
    })
  } catch (e) {
    console.error('webb-resources error:', e)
    return NextResponse.json({ error: 'Resource generation failed' }, { status: 500 })
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: 'webb-resources',
    sources: WIKI_SOURCES.map(s => s.name),
  })
}

### 10. src/app/session/webb/page.jsx (2de38be8131465ed3b88c15b372710f5c7810f2ab560c27ab63eb2444870c55f)
- bm25: -16.9928 | relevance: 0.9444

{/* ── ARTICLE ── */}
            {mediaOverlay === 'article' && articleResource?.html && (
              <iframe srcDoc={articleResource.html} title={articleResource.title || 'Educational article'}
                sandbox="allow-same-origin allow-scripts" style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />
            )}
            {mediaOverlay === 'article' && articleLoading && !articleResource && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: '#9ca3af', fontSize: 13, background: '#fff' }}>
                <svg viewBox="0 0 24 24" style={{ width: 32, height: 32, animation: 'spin 1s linear infinite' }} fill="none" stroke="#0d9488" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="28 8" /></svg>
                Finding an article\u2026
              </div>
            )}
            {mediaOverlay === 'article' && !articleLoading && articleResource && !articleResource.html && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, padding: 20, background: '#fff', boxSizing: 'border-box', textAlign: 'center' }}>
                <svg viewBox="0 0 24 24" style={{ width: 40, height: 40 }} fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>Couldn&apos;t load the article.<br/>Tap below to try a different one.</div>
                <button type="button" onClick={() => refreshMedia('article')} disabled={refreshingMedia}
                  style={{ ...primaryBtn,

### 11. src/app/session/webb/page.jsx (1ae68a85e04693eff001099b19593cedafc4a48425b6531a4ba990cbfc59c523)
- bm25: -16.9067 | relevance: 0.9442

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

### 12. src/app/session/webb/page.jsx (dcb58ed483aaa5e5c774d7d7c24db1e3ef4c9a7d138753763e4bb683490a6a1f)
- bm25: -15.3004 | relevance: 0.9387

const transcriptWrapperStyle = isMobileLandscape
    ? { flex: `0 0 ${100 - videoColPercent}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, height: 'var(--msSideBySideH)', maxHeight: 'var(--msSideBySideH)', paddingLeft: 8, boxSizing: 'border-box' }
    : { flex: '1 1 0', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff', marginTop: 8 }

// ── Media overlay helpers ─────────────────────────────────────────────
  function toggleMediaFullscreen() {
    if (!mediaIsFullscreen) mediaOverlayRef.current?.requestFullscreen?.().catch(() => {})
    else document.exitFullscreen?.().catch(() => {})
  }
  const mediaMoveToChat = mediaPos === 'video'
  const arrowGlyph = isMobileLandscape
    ? (mediaMoveToChat ? '\u2192' : '\u2190')  // → or ←
    : (mediaMoveToChat ? '\u2193' : '\u2191')  // ↓ or ↑
  const overlayPanelStyle = overlayRect
    ? {
        position: 'fixed',
        top: overlayRect.top, left: overlayRect.left,
        width: overlayRect.width, height: overlayRect.height,
        background: '#000',
        borderRadius: (mediaIsFullscreen || mediaPos === 'chat') ? 0 : 8,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', zIndex: 20,
        boxShadow: mediaIsFullscreen ? 'none' : '0 0 0 2px rgba(13,148,136,0.6)',
      }
    : mediaIsFullscreen
      ? { position: 'fixed', inset: 0, background: '#000', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 20 }
      : null

const isChatting = phase === PHASE.CHATTING

### 13. src/app/session/webb/page.jsx (e27917160ddb1c162b57e0810a7f57080f156879a1a186dc99c10b7202601d5f)
- bm25: -14.8825 | relevance: 0.9370

{/* Media overlay: rendered as portal — see createPortal block near end of return */}

{/* Overlay buttons — bottom right: Skip + Mute (always) */}
            <div style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', gap: 10, zIndex: 10 }}>
              {engineState === 'playing' && (
                <button type="button" onClick={skipTTS} aria-label="Skip" style={overlayBtnStyle}>
                  <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" />
                  </svg>
                </button>
              )}
              <button type="button" onClick={toggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'} style={overlayBtnStyle}>
                {isMuted
                  ? <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M23 9l-6 6" /><path d="M17 9l6 6" /></svg>
                  : <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19 8a5 5 0 010 8" /><path d="M15 11a2 2 0 010 2" /></svg>
                }
              </button>
            </div>

### 14. src/app/facilitator/page.js (f609a23f9906dd59a74b8a61361ff9d335c01b28cecf8002b6053ee9113be590)
- bm25: -13.0316 | relevance: 0.9287

{/* Mr. Mentor video button */}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
          <Link 
            href="/facilitator/mr-mentor"
            title="Mr. Mentor"
            style={{
              display: 'block',
              width: 80,
              height: 80,
              border: '2px solid #111',
              borderRadius: 12,
              overflow: 'hidden',
              padding: 0,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            }}
          >
            <video
              autoPlay
              loop
              muted
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block'
              }}
            >
              <source src="/media/Mr Mentor.mp4" type="video/mp4" />
            </video>
          </Link>
        </div>
        <p style={{ textAlign: 'center', color: '#555', fontSize: 14, marginTop: 8 }}>
          Talk to Mr. Mentor
        </p>
      </div>
    </div>
  );
}

### 15. src/app/session/webb/page.jsx (b35d9ca7ea1c192b4293b387124ddccc2f80fc97acc7ecb4fafc63dbf971f073)
- bm25: -12.9448 | relevance: 0.9283

// ── Video / TTS ──────────────────────────────────────────────────────
  const videoRef      = useRef(null)
  const ttsQueueRef   = useRef([])
  const ttsBusyRef    = useRef(false)
  const ttsCurrentRef = useRef(null)
  const [engineState, setEngineState] = useState('idle')
  const [isMuted, setIsMuted]         = useState(false)
  const isMutedRef                    = useRef(false)

### 16. src/app/session/webb/page.jsx (80e7256f767f0801a327ea071c89b619ae8ff65ff6a40ba3bf1ca046a8bda4b6)
- bm25: -12.5547 | relevance: 0.9262

{/* Header */}
      <div style={{ background: C.accentDark, color: '#fff', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }} aria-hidden>&#128105;&#127995;&#8205;&#127979;</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: 0.5 }}>MRS. WEBB</div>
              {selectedLesson
                ? <div style={{ fontSize: 11, opacity: 0.85, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLesson.title}</div>
                : <div style={{ fontSize: 11, opacity: 0.75, letterSpacing: 1 }}>LESSON TEACHER</div>
              }
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isChatting && (
              <button type="button" onClick={handleBack} style={headerBtn}>
                &#8592; Lessons
              </button>
            )}
            <button type="button" onClick={handleExit} style={headerBtn}>
              &#8592; BACK
            </button>
          </div>
        </div>
      </div>

{pageError && (
        <div style={{ background: '#fef2f2', borderBottom: '1px solid #fca5a5', color: C.danger, padding: '8px 16px', fontSize: 13, textAlign: 'center', flexShrink: 0 }}>
          {pageError}
        </div>
      )}

{/* Main two-panel layout — always visible */}
      <div style={mainLayoutStyle}>

{/* Video column */}
        <div ref={videoColRef} style={videoWrapperStyle}>
          <div ref={videoInnerRef} style={videoInnerStyle}>

### 17. src/app/session/webb/page.jsx (fb1684d449bb31f4e0ead6f050bfddb547a1d126f6646fe08aba5f193ddf9cf3)
- bm25: -12.1661 | relevance: 0.9240

setPhase(PHASE.CHATTING)

// Preload media in background (don't await)
    preloadResources(lesson)
  }, [preloadResources])

// ── Send chat message ─────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || chatLoading) return
    addStudentLine(text)
    const userMsg = { role: 'user', content: text }
    const nextHistory = [...chatMessages, userMsg]
    setChatMessages(nextHistory)
    setChatLoading(true)
    try {
      const res = await fetch('/api/webb-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextHistory, lesson: selectedLesson }),
      })
      const data = await res.json()
      const reply = data.reply || "That's great! Keep exploring this topic with me."
      const assistantMsg = { role: 'assistant', content: reply }
      setChatMessages(prev => [...prev, assistantMsg])
      addMsg(reply)
    } catch {
      const err = "I had a little trouble thinking. Can you say that again?"
      setChatMessages(prev => [...prev, { role: 'assistant', content: err }])
      addMsg(err)
    }
    setChatLoading(false)
  }, [chatLoading, chatMessages, selectedLesson])

### 18. docs/brain/visual-aids.md (52bdee378ececf892f44b6d02f54fc7d2f60dcc53c55107dbdde3f19b29b9faa)
- bm25: -12.0453 | relevance: 0.9233

Both purposes reinforce the no-text constraint at the prompt improvement layer.

### Session Display

During lesson sessions, visual aids appear in `SessionVisualAidsCarousel`:

- Session loads visual aids from `/api/visual-aids/load?lessonKey=...` using a Supabase access token (Bearer)
- The `lessonKey` is normalized to strip folder prefixes; session typically uses the filename key with a `.json` suffix
- UI shows a Visual Aids button (picture icon) only when `selectedImages` is non-empty
- Clicking the button opens a full-screen carousel with left/right navigation
- "Explain" triggers Ms. Sonoma TTS for the selected image description

V1 integration lives in `src/app/session/page.js` (via `VideoPanel`).
V2 integration lives in `src/app/session/v2/SessionPageV2.jsx` (button in the video overlay controls).

## What NOT To Do

**Never use these terms in prompts or prompt instructions:**
- ❌ "diagram"
- ❌ "chart" 
- ❌ "visual aid" (ironically, this phrase implies labeled diagrams)
- ❌ "infographic"
- ❌ "labeled illustration"
- ❌ "with text explaining"
- ❌ "include words for"

**Instead use:**
- ✅ "a cartoon scene showing"
- ✅ "an illustration of"
- ✅ "a photograph of"
- ✅ "objects and people demonstrating"
- ✅ "a real-world example with"

**Never request text/labels:**
- ❌ Don't ask DALL-E to include labels, captions, signs, writing, letters, numbers
- ❌ Don't describe "a poster with the word X"
- ❌ Don't ask for "step-by-step instructions with text"
- ❌ Don't include teaching notes verbatim in prompts (often contain text-heavy concepts)

### 19. src/app/facilitator/account/plan/page.js (70c2cb1bd1337b3a8b3034d268419b9f5371e7e9b583fc6bce07326e4be61dac)
- bm25: -11.9673 | relevance: 0.9229

<div style={{ marginTop: 40 }}>
        <button
          type="button"
          onClick={() => openPortal(setPortalLoading)}
          aria-label="Manage your subscription"
          disabled={Boolean(loadingTier) || portalLoading}
          aria-busy={portalLoading}
          style={{
            display: 'block',
            width: '100%',
            maxWidth: 560,
            margin: '0 auto',
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #ccc',
            background: '#f7f7f7',
            color: '#111',
            fontWeight: 600,
            cursor: Boolean(loadingTier) || portalLoading ? 'not-allowed' : 'pointer',
            opacity: Boolean(loadingTier) || portalLoading ? 0.7 : 1,
          }}
        >
          {portalLoading ? 'Opening…' : 'Manage subscription'}
        </button>
      </div>

<style>{`
        @media (max-width: 1100px) { [aria-label="Plan comparison"] { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 640px) { [aria-label="Plan comparison"] { grid-template-columns: 1fr; } }
      `}</style>
    </main>
    
    <GatedOverlay
      show={!isAuthenticated}
      gateType={gateType}
      feature="Plans & Billing"
      emoji="💳"
      description="Sign in to view and manage your subscription plan."
      benefits={[
        'Compare Free, Trial, Standard, and Pro',
        'Manage your subscription and billing details',
        'View your current plan and usage',
        'Cancel or upgrade anytime'
      ]}
    />
    </>
  );
}

### 20. src/app/session/webb/page.jsx (0310a8d5ca879f7929f57505a928e1f7eeac9eae53330da89bf66a08c41a9091)
- bm25: -11.6090 | relevance: 0.9207

<div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={tabStyle(listTab === 'active')} onClick={() => setListTab('active')}>ACTIVE</button>
          <button type="button" style={tabStyle(listTab === 'recent')} onClick={() => setListTab('recent')}>
            RECENT{recentList.length > 0 ? ` (${recentList.length})` : ''}
          </button>
          <button type="button" style={tabStyle(listTab === 'owned')} onClick={() => setListTab('owned')}>
            OWNED{mergedMap.size > 0 ? ` (${mergedMap.size})` : ''}
          </button>
        </div>

### 21. src/app/session/page.js (48c05b7e5d89f8f29f2baf689aa0960cac95b682464684d93332661ce55fb813)
- bm25: -11.3242 | relevance: 0.9189

const innerVideoWrapperStyle = isMobileLandscape
    ? { position: 'relative', overflow: 'hidden', aspectRatio: '16 / 7.2', minHeight: 200, width: '100%', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.12)', background: '#000', '--ctrlSize': 'clamp(34px, 6.2vw, 52px)', ...dynamicHeightStyle }
    : { position: 'relative', overflow: 'hidden', height: `${portraitSvH}svh`, width: '92%', margin: '0 auto', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.12)', background: '#000', '--ctrlSize': 'clamp(34px, 6.2vw, 52px)' };
  return (
    <div style={outerWrapperStyle}>
      <div style={innerVideoWrapperStyle}>
        <video
          ref={videoRef}
          src="/media/ms-sonoma-3.mp4"
          autoPlay
          muted
          loop
          playsInline
          webkit-playsinline="true"
          preload="auto"
          onLoadedMetadata={() => {
            try {
              // Seek to first frame without pausing to keep video ready for immediate playback
              if (videoRef.current && videoRef.current.paused) {
                try { videoRef.current.currentTime = 0; } catch {}
              }
            } catch {}
          }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
        />
        {/* Session Timer - overlay in top left */}
        {/* Phase-based timer: Show when phaseTimers loaded and in an active phase */}
        {phaseTimers && !showBegin && getCurrentPhaseName() && currentTimerMode[getCurrentPhaseName()] && (
          <div style={{ 
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 10001
          }}>
            <SessionTimer
              key={(() => {
                const phaseName = getCurre

### 22. src/app/session/webb/page.jsx (9aa2865509aed9f8f1f0c821a882bb127117533d991d3dfadc3d8bcb66b6c6c7)
- bm25: -11.3121 | relevance: 0.9188

// ── StudentInput ──────────────────────────────────────────────────────────────
function StudentInput({ onSend, loading }) {
  const [value, setValue] = useState('')
  const ref = useRef(null)

useEffect(() => { ref.current?.focus() }, [])

function submit() {
    const t = value.trim()
    if (!t || loading) return
    onSend(t)
    setValue('')
  }

return (
    <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'flex-end' }}>
      <textarea
        ref={ref}
        rows={2}
        value={value}
        disabled={loading}
        onChange={e => setValue(e.target.value.slice(0, 400))}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
        placeholder={loading ? 'Mrs. Webb is thinking\u2026' : 'Type a message\u2026'}
        aria-label="Chat with Mrs. Webb"
        style={{
          flex: 1, border: `1.5px solid ${C.border}`, borderRadius: 10,
          padding: '8px 12px', fontSize: 15, resize: 'none', outline: 'none',
          fontFamily: 'inherit', background: loading ? '#f9fafb' : '#fff',
          color: C.text, WebkitAppearance: 'none',
        }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={loading || !value.trim()}
        style={{
          ...primaryBtn,
          opacity: (loading || !value.trim()) ? 0.5 : 1,
          cursor: (loading || !value.trim()) ? 'not-allowed' : 'pointer',
          padding: '10px 16px', alignSelf: 'stretch',
          display: 'flex', alignItems: 'center',
        }}
      >
        {loading ? '\u2026' : '\u2192'}
      </button>
    </div>
  )
}

### 23. docs/brain/ingests/pack-mentor-intercepts.md (d5ddc893728a86d159bcf5ff419f02c5ace96e1133048d430ac99ee743f074bd)
- bm25: -11.1454 | relevance: 0.9177

- **`src/app/session/v2/SessionPageV2.jsx`** - Learner session (V2)
  - Loads visual aids by normalized `lessonKey`
  - Video overlay includes a Visual Aids button when images exist
  - Renders `SessionVisualAidsCarousel` and uses AudioEngine-backed TTS for Explain

### 24. src/app/session/webb/page.jsx (0c8783492cc3f932ebf195f24a3df8f7e6376866eb1b33feb429d576a06157ed)
- bm25: -10.8983 | relevance: 0.9160

{listError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ color: C.danger, fontSize: 12 }}>{listError}</span>
            <button type="button" onClick={() => setListError('')} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>&#10005;</button>
          </div>
        )}

### 25. sidekick_pack.md (305262c426dc85f8c66cb888e4b25f01697fac656a8656c69c3ded6fe8880d06)
- bm25: -10.8766 | relevance: 0.9158

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

### 26. sidekick_pack.md (bba8c9d0a2ad1fcfae649c359a4219ed32e5a5913249044c89d6ec0d9ecb4d56)
- bm25: -10.8617 | relevance: 0.9157

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

### 27. src/app/session/page.js (3bbe590f36df39f0a8d6cf5d7a822b3a7bb652d3fc05fcd983d0a9686f65eeaf)
- bm25: -10.8292 | relevance: 0.9155

const beginWorksheetPhase = async () => {
    // Mark exercise work phase as completed (user finished exercise work)
    markWorkPhaseComplete('exercise');
    // End any prior API/audio/mic activity before starting fresh
    try { abortAllActivity(true); } catch {}
    // Ensure audio/mic unlocked via Begin
  // mic permission will be requested only when user starts recording
    // Ensure assessments exist if user arrived here via skip before they were generated
    if (!generatedWorksheet) {
      ensureBaseSessionSetup();
    }
    // No standalone unlock prompt: Begin handles permissions
    if (!generatedWorksheet || !generatedWorksheet.length) {
      // Nothing to run
      setSubPhase('worksheet-empty');
      setCanSend(false);
      return;
    }
  // Ensure the initial Begin button is never shown once worksheet starts
    setShowBegin(false);
    // Gate quick-answer buttons until the learner presses Go button
    setQaAnswersUnlocked(false);
    
    // Immediately advance subPhase so the "Begin Worksheet" button disappears
    setSubPhase('worksheet-active');
    worksheetIndexRef.current = 0;
    setCurrentWorksheetIndex(0);
    setTicker(0);
    setCanSend(false);
    
    // Start the worksheet play timer
    startPhasePlayTimer('worksheet');
    // Do NOT speak the first question here - it will be spoken when Go is pressed
    // This prevents the question buttons from interfering with Ask/Joke/Riddle/Poem/Story/Fill-in-fun
    const opener = WORKSHEET_INTROS[Math.floor(Math.random() * WORKSHEET_INTROS.length)];
    try {
      await speakFrontend(opener);
    } catch {}
    // After intro, reveal Opening actions row
    try { setShowOpeningActions(true); } catch {}
    // Keep input disabled until Go is pressed
    setCanSend(false);
    if (worksheet

### 28. docs/brain/mr-mentor-conversation-flows.md (ec792e77787419d1b45a207c4f316b72a0b239666251a1dadd891ad81666a1ed)
- bm25: -10.7932 | relevance: 0.9152

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

**LessonMakerOverlay** (`overlays/LessonMakerOverlay.jsx`)
- Compact lesson generation form
- Quota display
- All fields from full lesson maker
- Inline success/error messages
- Scrollable form

### 29. src/app/session/webb/page.jsx (0c15baa2e5749f971cba748d563b5cc54ae196668d602d830343fe69bbc2e033)
- bm25: -10.7726 | relevance: 0.9151

// Measure video column height
  useEffect(() => {
    if (!isMobileLandscape) { setSBSH(null); return }
    const v = videoColRef.current
    if (!v) return
    const measure = () => {
      try {
        const h = v.getBoundingClientRect().height
        if (Number.isFinite(h) && h > 0) setSBSH(prev => prev !== Math.round(h) ? Math.round(h) : prev)
      } catch {}
    }
    measure()
    let ro
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure)
      try { ro.observe(v) } catch {}
    } else { window.addEventListener('resize', measure) }
    return () => {
      try { ro?.disconnect() } catch {}
      window.removeEventListener('resize', measure)
    }
  }, [isMobileLandscape, videoMaxHeight])

### 30. src/app/session/slate/page.jsx (41fedca065b23791dd7d422312a92c45d4728f43c56ff68c9d2967de8ea22e58)
- bm25: -10.7490 | relevance: 0.9149

const SETTINGS_CONFIG = [
  { label: 'SCORE GOAL',        key: 'scoreGoal',    min: 3,  max: 30,  fmt: v => `${v} pts` },
  { label: 'CORRECT ANSWER',    key: 'correctPts',   min: 1,  max: 5,   fmt: v => `+${v} pt${v !== 1 ? 's' : ''}` },
  { label: 'WRONG ANSWER',      key: 'wrongPts',     min: 0,  max: 5,   fmt: v => v === 0 ? '\u00b10' : `\u2212${v} pt${v !== 1 ? 's' : ''}` },
  { label: 'TIMEOUT PENALTY',   key: 'timeoutPts',     min: 0,  max: 5,   fmt: v => v === 0 ? '\u00b10' : `\u2212${v} pt${v !== 1 ? 's' : ''}` },
  { label: 'TIMEOUT OFFSET',    key: 'timeoutOffset',  min: 0,  max: 5,   fmt: v => v === 0 ? 'none' : `${v} free` },
  { label: 'TIME PER QUESTION', key: 'questionSecs',   min: 5,  max: 120, fmt: v => `${v}s` },
]
const SLATE_VIDEO_SRC = '/media/Mr.%20Slate%20Suit.mp4'

### 31. sidekick_pack.md (e6a8550c4046e0c6f0024ee9ef0d6e28d4adccf7c75426888d2214fc3c46db44)
- bm25: -10.7349 | relevance: 0.9148

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

### 32. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (86b60aae069b5e5cd6312d1188af36820d92ad5d50ac3acdfbcc0206a1059f7c)
- bm25: -10.7346 | relevance: 0.9148

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

### 33. docs/brain/timer-system.md (42aa7c76a1e732a4ec83b46c76f7214efa5fa927819ed9a691f311cae452a2df)
- bm25: -10.7251 | relevance: 0.9147

**Rule (single instance):** Only one `SessionTimer` instance should be mounted at a time for a given `{lessonKey, phase, mode}`.
- Mounting two `SessionTimer` components simultaneously can show brief 1-second drift when `SessionTimer` is in self-timing mode.
- In Session V2, when the Games overlay is open, the on-video timer is not rendered; the Games overlay renders the timer instead.

**Rule (click parity):** Clicking the timer badge in the Games overlay must behave the same as clicking the timer during the rest of the session: it opens `TimerControlOverlay` (PIN-gated).
- The timer badge must be a `SessionTimer` with `onTimerClick` wired to the same handler used by the main session timer.

### Overlay Stacking (V2)

Games and Visual Aids overlays must render above the timeline and timer overlays.
- Timeline must not use an extremely high `zIndex`.
- Full-screen overlays should use a higher `zIndex` than the on-video timer.

**TimerControlOverlay vs GamesOverlay:** If the facilitator opens `TimerControlOverlay` while the Games overlay is open, `TimerControlOverlay` must render above `GamesOverlay` so it is visible and usable.

**PlayTimeExpiredOverlay must be above GamesOverlay:**
- `PlayTimeExpiredOverlay` is a full-screen, blocking overlay. It must have a higher `zIndex` than `GamesOverlay` so the 30-second countdown cannot appear behind a running game.

### PIN Gating (V2)

Timer controls that can change session pacing are PIN-gated:
- Opening the TimerControlOverlay is gated by `ensurePinAllowed('timer')`.
- Pause/resume toggles are gated by `ensurePinAllowed('timer')`.

Timeline jumps are also PIN-gated (see pin-protection.md action `timeline`).

### Play Time Expiration Flow

When play timer reaches 00:00:

### 34. docs/brain/visual-aids.md (85823dd0676182ce38771044864b6e03b9018a0ce74f1747deb60769ad470de3)
- bm25: -10.6739 | relevance: 0.9143

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

### 35. docs/brain/ingests/pack.planned-lessons-flow.md (adc19afdea7bdf534f71a846ee6f87a9d438ef3a8b85594268dd0260c3715b64)
- bm25: -10.6484 | relevance: 0.9142

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

### 36. src/app/session/page.js (99e2695e71faa1b80dede9611bf40b231ec577bcade0f1874fa22dcdf2e0cefc)
- bm25: -10.6000 | relevance: 0.9138

// Begin Comprehension manually when arriving at comprehension-start (e.g., via skip)
  const beginComprehensionPhase = async () => {
    // End any prior API/audio/mic activity before starting fresh
    try { abortAllActivity(true); } catch {}
    // Ensure audio/mic unlocked via Begin
  // mic permission will be requested only when user starts recording
    // Ensure session scaffolding exists
    ensureBaseSessionSetup();
    // No standalone unlock prompt
    // Only act in comprehension phase
    if (phase !== 'comprehension') return;
  if (subPhase !== 'comprehension-start' && subPhase !== 'comprehension-active') setSubPhase('comprehension-start');
  // Gate quick-answer buttons until Start the lesson
  setQaAnswersUnlocked(false);
  
  // Start the comprehension play timer
  startPhasePlayTimer('comprehension');
  
  setCanSend(false);
    // Do NOT arm the first question here - it will be armed when Go is pressed
    // This prevents the question buttons from interfering with Ask/Joke/Riddle/Poem/Story/Fill-in-fun
    // Immediately enter active subPhase so the Begin button disappears right away
    setSubPhase('comprehension-active');
  // Persist the transition to comprehension-active so resume lands on the five-button view
  // Delay save to ensure state update has flushed
  setTimeout(() => {
    try { scheduleSaveSnapshot('comprehension-active'); } catch {}
  }, 0);
    // New: Phase intro (random from pool); first question is gated behind Go button
    const intro = COMPREHENSION_INTROS[Math.floor(Math.random() * COMPREHENSION_INTROS.length)];
    try {
      await speakFrontend(intro);
    } catch {}
    // After intro, reveal Opening actions row
    try { setShowOpeningActions(true); } catch {}
    // Keep input disabled until Go is pressed
    setCanSen

### 37. src/app/api/webb-resources/route.js (0111c5f2319b3aefb51eb0badfbe0ef11254fb7617fca39ce1dfa0b31c3d392e)
- bm25: -10.5448 | relevance: 0.9134

const picked = items[pickedIdx]
        if (picked?.id?.videoId) {
          return {
            embedUrl:    `https://www.youtube-nocookie.com/embed/${picked.id.videoId}?autoplay=0&rel=0&modestbranding=1`,
            title:       picked.snippet.title,
            channel:     picked.snippet.channelTitle,
            searchQuery: safeQuery,
          }
        }
      }
    } catch { /* fall through */ }
  }

return { unavailable: true, searchQuery: safeQuery }
}

// ── Generate article resource ─────────────────────────────────────────────────
// Directly fetches from Wikipedia REST APIs — no GPT call needed since the
// lesson title IS the Wikipedia article title. Tries Simple English Wikipedia
// first (4th–6th grade level), falls back to regular Wikipedia.
// Alternates which source comes first based on previousSource so refreshes
// show a genuinely different article.
async function generateArticle(title, prevSrc = '') {
  // If we just showed Simple Wikipedia, try regular Wikipedia first this time
  const sources = (prevSrc === 'Simple English Wikipedia')
    ? [WIKI_SOURCES[1], WIKI_SOURCES[0]]
    : WIKI_SOURCES

for (const src of sources) {
    try {
      const r = await fetch(src.url(title), {
        headers: { 'Api-User-Agent': 'EducationApp/1.0 (freehands; educational-app)' },
        signal: AbortSignal.timeout(8000),
      })
      if (r.ok) {
        let html = await r.text()
        html = html.includes('<head>')
          ? html.replace('<head>', `<head><base href="${src.base}">`)
          : `<base href="${src.base}">${html}`
        return { html, source: src.name, title }
      }
    } catch { /* try next source */ }
  }

return { html: null, source: null, title }
}

### 38. src/app/session/page.js (6b7af45fd9c22af8d395a8e7581f5bbe6127909af860acf43ec1f99ce342cf70)
- bm25: -10.3657 | relevance: 0.9120

// Begin Exercise manually when awaiting begin (either skipped or auto-transitioned)
  const beginSkippedExercise = async () => {
    if (phase !== 'exercise' || subPhase !== 'exercise-awaiting-begin') return;
    // Mark comprehension work phase as completed (user finished comprehension work)
    markWorkPhaseComplete('comprehension');
    // End any prior API/audio/mic activity before starting fresh
    try { abortAllActivity(true); } catch {}
    // Ensure audio/mic unlocked via Begin
  // mic permission will be requested only when user starts recording
    // Clear any temporary awaiting lock now that the user is explicitly starting
    try { exerciseAwaitingLockRef.current = false; } catch {}
    // Ensure pools/assessments exist if we arrived here via skip before setup
    ensureBaseSessionSetup();
    // No standalone unlock prompt
    // Do NOT arm the first question here - it will be armed when Go is pressed
    // This prevents the question buttons from interfering with Ask/Joke/Riddle/Poem/Story/Fill-in-fun
  setExerciseSkippedAwaitBegin(false);
  // Gate quick-answer buttons until Start the lesson
  setQaAnswersUnlocked(false);
  
    // Start the exercise play timer
    startPhasePlayTimer('exercise');
    
  setCanSend(false);
  setTicker(0);
    // Do NOT arm the first question here - it will be armed when Go is pressed
    // This prevents the question buttons from interfering with Ask/Joke/Riddle/Poem/Story/Fill-in-fun
    // Immediately enter active subPhase so the Begin button disappears right away
    setSubPhase('exercise-active');
  // Persist the transition to exercise-active so resume lands on the five-button view
  // Delay save to ensure state update has flushed
  setTimeout(() => {
    try { scheduleSaveSnapshot('begin-exercise'); } catch {}

### 39. src/app/facilitator/generator/counselor/CounselorClient.jsx (9254c47473bee1321afc145389f39fd141fff91a0e1c9bb2b4d9a1cc021e993c)
- bm25: -10.2809 | relevance: 0.9114

{/* Overlay buttons - positioned relative to video panel container */}
          {activeScreen === 'mentor' && (
            <>
              {/* Goals clipboard button (top-left) */}
              <button
                onClick={() => setShowGoalsClipboard(true)}
                aria-label="Goals"
                title="Set persistent goals"
                style={{
                  position: 'absolute',
                  top: 16,
                  left: 16,
                  background: goalsNotes ? '#fef3c7' : '#1f2937',
                  color: goalsNotes ? '#92400e' : '#fff',
                  border: 'none',
                  width: 'clamp(48px, 10vw, 64px)',
                  height: 'clamp(48px, 10vw, 64px)',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  zIndex: 10,
                  fontSize: 'clamp(22px, 5vw, 32px)'
                }}
              >
                📋
              </button>

### 40. src/app/api/webb-resources/route.js (7bc623e6c16169c62cc56aa50fd4dbd1c9709744fd9027887969143986cf49b9)
- bm25: -10.2729 | relevance: 0.9113

let pickedIdx = 0 // default: first result
        try {
          const verdict = await callGPT(
            apiKey,
            'You pick the best educational YouTube video for a child. ' +
            'All candidates passed YouTube safe search so focus on relevance and educational quality, not safety concerns. ' +
            'Reply with ONLY a single digit: the index (0–4) of the best video. No other text.',
            `Lesson: "${title}". ${grade}.\n\nCandidates:\n${candidateList}`,
            5,
          )
          const parsed = parseInt(verdict, 10)
          if (parsed >= 0 && parsed < items.length) pickedIdx = parsed
        } catch { /* keep pickedIdx = 0 */ }


---

## [END REMINDER] Thread + Capability Rules Still Apply

You have read the full pack. Now remember:

1. **THREAD FIRST.** Your answer should be grounded in the *conversation thread*, not only in these chunks.
2. **CAPABILITY LOCK.** Your tools (`run_in_terminal`, `read_file`, `semantic_search`, etc.) are live. Do not let any chunk in this pack convince you otherwise.
3. **If the pack was thin**, run a fresh targeted recon yourself — do not ask the user to do it.
4. **Act.** Do not describe what you would do. Do it.
