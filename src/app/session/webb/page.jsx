'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { updateTranscriptLiveSegment } from '@/app/lib/transcriptsClient'
import { getWebbCompletionForLearner, saveWebbCompletion } from '@/app/lib/webbCompletionClient'

// CSS animations
if (typeof document !== 'undefined' && !document.getElementById('webb-spin-style')) {
  const s = document.createElement('style')
  s.id = 'webb-spin-style'
  s.textContent = [
    '@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }',
    '@keyframes webb-bounce { 0%,80%,100% { transform:translateY(0) } 40% { transform:translateY(-5px) } }',
    '@keyframes webb-tablet-in { 0% { opacity:0; transform:translateX(-50%) scale(0.88) } 100% { opacity:1; transform:translateX(-50%) scale(1) } }',
    '@keyframes webb-tablet-out { 0% { opacity:1; transform:translateX(-50%) scale(1) } 100% { opacity:0; transform:translateX(-50%) scale(0.92) } }',
  ].join(' ')
  document.head.appendChild(s)
}

// ── Color tokens ──────────────────────────────────────────────────────────────
const C = {
  accent:      '#0d9488',
  accentDark:  '#0f766e',
  accentLight: '#ccfbf1',
  border:      '#99f6e4',
  muted:       '#6b7280',
  text:        '#111827',
  danger:      '#ef4444',
  success:     '#10b981',
}

const PHASE = { LIST: 'list', STARTING: 'starting', CHATTING: 'chatting' }

// ── UI FAQ: feature explanations in Mrs. Webb's voice ─────────────────────────
const UI_FAQ = {
  video: {
    keywords: ['the video', 'a video', 'watch video', 'play video', 'open video', 'video button', 'movie', 'film', 'youtube', 'player'],
    confirm: 'Are you wondering about the video feature?',
    answer: 'To watch a video, just tap the video button — it looks like ▶ — at the bottom of my screen. That opens a little video player with play, pause, and a timeline. The video is picked specially for your lesson!',
    location: 'tap the ▶ button at the bottom of my screen',
    actionPrompt: 'Want me to open the video for you right now?',
    actionSlug: 'video',
  },
  article: {
    keywords: ['the article', 'an article', 'read article', 'open article', 'article button', 'wiki', 'wikipedia'],
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
    confirm: 'Are you wondering how to move the video or article window?',
    answer: 'The arrow button in the toolbar slides the video or article window between two spots — over my camera or over our chat. Just tap the arrow and it jumps to the other side!',
    actionPrompt: null,
    actionSlug: null,
  },
  fullscreen: {
    keywords: ['fullscreen', 'full screen', 'bigger', 'expand', 'large', 'maximize', 'enlarge'],
    confirm: 'Are you wondering how to make the video or article bigger?',
    answer: 'The expand icon in the toolbar — four little arrows pointing outward — makes the video or article fill the whole screen. Tap it again to go back to normal.',
    actionPrompt: null,
    actionSlug: null,
  },
  refresh: {
    keywords: ['refresh', 'different video', 'different article', 'try another', 'new video', 'new article', 'change video', 'change article'],
    confirm: 'Are you wondering how to get a different video or article?',
    answer: 'The little ↻ button in the top-left of the toolbar loads a brand-new video or article for your lesson. Just tap it and I will find something different!',
    actionPrompt: null,
    actionSlug: null,
  },
  mute: {
    keywords: ['mute', 'volume', 'sound', 'quiet', 'loud', 'speaker', 'audio', 'hear me', 'voice'],
    confirm: 'Are you wondering about the sound or mute feature?',
    answer: 'There is a speaker icon at the bottom right of the screen that mutes or unmutes my voice. Inside the video player there is a separate mute button just for the video. So you can control each one independently!',
    actionPrompt: null,
    actionSlug: null,
  },
  close: {
    keywords: ['close', 'hide', 'get rid of', 'remove', 'dismiss', 'go away', 'shut'],
    confirm: 'Are you wondering how to close the video or article?',
    answer: 'The ✕ button in the top-right corner of the toolbar closes the video or article window. You can reopen it any time by tapping the ▶ or 📖 button again!',
    actionPrompt: null,
    actionSlug: null,
  },
  skip: {
    keywords: ['skip', 'skip question', 'next question', 'pass', 'skip button'],
    confirm: 'Are you wondering about the Skip button?',
    answer: 'The Skip button at the bottom right of the screen lets you move past a question if you are stuck or want to come back to it later. It is totally okay to skip — curiosity goes at your own pace!',
    actionPrompt: null,
    actionSlug: null,
  },
  exit: {
    keywords: ['exit', 'go back', 'leave', 'quit', 'finish', 'end session', 'stop session', 'how do i leave'],
    confirm: 'Are you wondering how to exit or go back?',
    answer: 'The back arrow at the very top-left takes you back to the lesson list. There is also an Exit button that will check for a PIN before closing — that is just so a lesson does not end by accident!',
    actionPrompt: null,
    actionSlug: null,
  },
  help: {
    keywords: ['help me', 'i need help', 'what can you do', 'what can i do', 'what buttons', 'features', 'how does this work', 'what is this', 'how do i use'],
    confirm: 'Are you asking for a quick tour of what I can do?',
    answer: 'Sure! At the bottom of my screen you will find a ▶ video button and a 📖 article button — those pull up extra learning materials just for your lesson. Once open, the toolbar has a ↻ refresh for new content, an arrow to move the window around, a fullscreen button, and a ✕ to close it. The article even has a Key part button that highlights the most important sentences and reads them to you. And the speaker icon in the corner mutes my voice. What would you like to try first?',
    actionPrompt: null,
    actionSlug: null,
  },
}

function detectUiQuestion(text) {
  const lower = text.toLowerCase()
  const isQuestion =
    lower.includes('?') ||
    /\b(how|what|where|why|which|explain|describe|tell me|show me|can i|can we|can you|do i|does|what is|what's|button|feature|work|use|want to|would like|wanna|i'd like|let me|let's|i need)\b/.test(lower)
  if (!isQuestion) return null
  for (const [slug, cfg] of Object.entries(UI_FAQ)) {
    if (cfg.keywords.some(kw => lower.includes(kw))) return slug
  }
  return null
}

function detectSeekIntent(text) {
  return /\b(show me|play|jump to|skip to|go to|take me to|find|rewind to|fast forward to|seek to)\b.{0,60}\b(part|section|moment|clip|bit|where|when|about|with|that shows|that explains|on|of)\b/i.test(text)
    || /\b(show me|play)\s+the\s+(part|section|bit|moment|clip)\b/i.test(text)
    || /\bwhere (it|they|he|she|the video)\s+(talks?|explains?|shows?|says?|mentions?|covers?|discusses?)/i.test(text)
}

function detectVideoTrouble(text) {
  const t = text.toLowerCase()
  // Explicit black / blank / dark screen
  if (/black\s*screen|blank\s*screen|screen\s*(is\s*)?(black|blank|dark|empty|nothing)|all\s*black/.test(t)) return true
  // Video not loading / not working / not playing
  if (/video.{0,35}(not|won'?t|can'?t|doesn'?t|isn'?t|never).{0,20}(work|load|play|show|appear|open|start|run)/i.test(t)) return true
  if (/(not|won'?t|can'?t).{0,20}(see|view|watch|play|load).{0,25}video/i.test(t)) return true
  if (/video.{0,25}(broken|stuck|freeze|froze|missing|gone|disappeared|nothing|empty|not (there|showing))/i.test(t)) return true
  if (/video\s*(is\s*)?(just\s*)?(black|blank|dark|empty|gone|broken|not showing)/i.test(t)) return true
  return false
}

const VIDEO_TROUBLE_MSG = "Oh, I think I might know what's happening! 📺 A black or empty space where the video should be usually means YouTube is blocked on your device. This can happen when Screen Time or parental controls are turned on \u2014 those settings block YouTube everywhere, including here. To fix it, a parent or guardian can go to Screen Time (on iPhone or iPad), find the content restrictions, and add \u2018youtube.com\u2019 and \u2018youtube-nocookie.com\u2019 to the allowed websites list. Once that's updated, close this page, come back, and the video should work! In the meantime we can keep going with our lesson. 😊"

function isYes(text) {
  return /^\s*(yes|yeah|yep|yup|sure|ok|okay|please|do it|go ahead|open it|show me|definitely|of course|affirmative|sounds good|great|cool|alright|why not|let'?s go|uh huh|mhm|yea|ya|k|👍)\b/i.test(text)
}

function isNo(text) {
  return /^\s*(no|nope|nah|never ?mind|not now|don'?t|that'?s ok|i'?m good|no thanks|no thank you|skip it|forget it|it'?s fine|cancel|nvm|👎)\b/i.test(text)
}

// ── Root page ─────────────────────────────────────────────────────────────────
export default function WebbPage() {
  const router = useRouter()

  // ── Lesson browser state ─────────────────────────────────────────────
  const [phase, setPhase]                       = useState(PHASE.LIST)
  const [availableLessons, setAvailableLessons] = useState([])
  const [listLoading,       setListLoading]       = useState(true)  // true until first loadLessons resolves
  const [allOwnedLessons, setAllOwnedLessons]   = useState([])
  const [recentSessions, setRecentSessions]     = useState([])
  const [historyLessons, setHistoryLessons]     = useState({})
  const [listTab, setListTab]                   = useState('active')
  const [ownedFilters, setOwnedFilters]         = useState({ subject: '', grade: '' })
  const [listError, setListError]               = useState('')
  const [learnerId, setLearnerId]               = useState(null)
  const [pageError, setPageError]               = useState('')

  // ── Active lesson ────────────────────────────────────────────────────
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [chatMessages, setChatMessages]     = useState([]) // [{role,content}] for API
  const [transcript, setTranscript]         = useState([]) // [{text,role}] for CaptionPanel
  const [activeIndex, setActiveIndex]       = useState(-1)
  const [chatLoading, setChatLoading]       = useState(false)
  const transcriptRef                       = useRef(null)

  // ── Research objectives ──────────────────────────────────────────────
  const [objectives,         setObjectives]        = useState([])  // string[]
  const [completedObj,       setCompletedObj]      = useState([])  // number[] of completed indices
  const [objResponses,       setObjResponses]      = useState({})  // Record<idx, studentText> — what they said
  const [newlyCompletedObj,  setNewlyCompletedObj] = useState(null) // {idx, text} — drives tablet toast
  const [expandedObj,        setExpandedObj]       = useState(null) // number|null — accordion open index
  const [showObjectives,     setShowObjectives]    = useState(false) // objectives panel overlay
  const [showSourceSettings, setShowSourceSettings] = useState(false) // settings overlay
  const [settingsTab,        setSettingsTab]        = useState('settings') // 'settings' | 'article'
  const [offerResume,        setOfferResume]        = useState(false) // shown after lesson is selected, if a per-lesson snapshot exists
  const [essayMode,          setEssayMode]         = useState(false) // essay copy-down screen
  const [essay,              setEssay]             = useState(null)  // generated essay string
  const [generatingEssay,    setGeneratingEssay]   = useState(false)
  const [webbCompletionMap,  setWebbCompletionMap] = useState({}) // {[lessonKey]: {completed, completedAt}}
  const [justCompletedLesson, setJustCompletedLesson] = useState(null) // lesson title shown as completion toast
  const [articleSources,     setArticleSources]    = useState(() => {
    const ALL = ['simple-wikipedia','wikipedia','kiddle','ducksters','wikijunior']
    if (typeof window === 'undefined') return ALL
    try {
      const stored = JSON.parse(localStorage.getItem('webb_article_sources') || 'null')
      if (Array.isArray(stored) && stored.length) return stored
    } catch {}
    return ALL
  })
  const checkingObjRef    = useRef(false) // true while a check is in-flight
  const pendingCheckRef   = useRef(null)  // args parked when a check was blocked

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
  const videosWatchedRef   = useRef(0)    // count of times the video overlay was opened this lesson (for per-objectives rate limit)
  const essayAbortRef      = useRef(null)  // AbortController for in-flight essay generation
  const awaitingSentenceRef = useRef(null) // {objIdx} — objective earned but awaiting sentence restatement
  const articleIframeRef   = useRef(null)
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
  const videoIframeRef     = useRef(null)
  const videoPlayingRef    = useRef(false) // mirrors videoPlaying; used for optimistic toggle on mobile
  // Passage citation — highlight els + scroll-override tracking
  const passageEls             = useRef([])     // highlight <span>s created by interpretArticle
  const userScrolledArticleRef = useRef(false)  // true after a manual scroll in the article
  const programmaticScrollRef  = useRef(false)  // true during our own scrollIntoView calls
  // UI FAQ intercept state
  const uiFaqPendingRef       = useRef(null)  // slug of feature being confirmed
  const uiFaqActionPendingRef = useRef(false) // waiting for action yes/no

  // Reset all player state whenever a new video arrives
  useEffect(() => {
    setVideoEnded(false)
    setVideoPlaying(false)
    setVideoDuration(0)
    setVideoCurrentTime(0)
    setVideoVolumeMuted(false)
    setVideoMoments([])
    segmentEndRef.current = null
    videoPlayingRef.current = false
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
          videoPlayingRef.current = s === 1
          setVideoPlaying(s === 1)
        }
        if ((msg.event === 'infoDelivery' || msg.event === 'initialDelivery') && msg.info) {
          if (typeof msg.info.currentTime === 'number') { setVideoCurrentTime(msg.info.currentTime); videoCurrentTimeRef.current = msg.info.currentTime }
          if (typeof msg.info.duration    === 'number' && msg.info.duration > 0) setVideoDuration(msg.info.duration)
          if (typeof msg.info.muted       === 'boolean') setVideoVolumeMuted(msg.info.muted)
          if (typeof msg.info.playerState === 'number') {
            if (msg.info.playerState === 0) setVideoEnded(true)
            videoPlayingRef.current = msg.info.playerState === 1
            setVideoPlaying(msg.info.playerState === 1)
          }
        }
      } catch { /* non-JSON messages — ignore */ }
    }
    window.addEventListener('message', handleYTMessage)
    return () => window.removeEventListener('message', handleYTMessage)
  }, [])

  // Auto-pause when videoCurrentTime reaches the end of the active segment
  useEffect(() => {
    if (segmentEndRef.current !== null && videoCurrentTime >= segmentEndRef.current) {
      ytCmd('pauseVideo')
      segmentEndRef.current = null
    }
  }, [videoCurrentTime]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const webbSessionStartRef = useRef(null)
  useEffect(() => {
    try { learnerName.current = localStorage.getItem('learner_name') || '' } catch {}
    const id = (() => { try { return localStorage.getItem('learner_id') || null } catch { return null } })()
    setLearnerId(id)
    setWebbCompletionMap(getWebbCompletionForLearner(id))
    loadLessons(id)
    // Migrate: remove old single-key snapshot from before per-lesson keys
    try { localStorage.removeItem('webb_session') } catch {}
  }, [])

  // ── Per-lesson snapshot helpers ────────────────────────────────────────
  function snapKey(lesson) {
    const k = lesson?.lessonKey || lesson?.lesson_id || lesson?.id
    return k ? `webb_session_${k}` : null
  }

  function handleResume() {
    try {
      const key = snapKey(selectedLesson)
      const saved = key ? JSON.parse(localStorage.getItem(key) || 'null') : null
      if (!saved) { setOfferResume(false); return }
      setChatMessages(saved.chatMessages || [])
      setTranscript(saved.transcript || [])
      setObjectives(saved.objectives || [])
      setCompletedObj(saved.completedObj || [])
      setObjResponses(saved.objResponses || {})
      if (saved.essay) setEssay(saved.essay)
      if (saved.essayMode) setEssayMode(saved.essayMode)
      setPhase(PHASE.CHATTING)
      setOfferResume(false)
      preloadResources(selectedLesson)
    } catch { setOfferResume(false) }
  }

  function handleRestartFromPrompt() {
    const key = snapKey(selectedLesson)
    try { if (key) localStorage.removeItem(key) } catch {}
    setOfferResume(false)
    // Start a fresh session for the already-selected lesson
    selectLesson(selectedLesson, true)
  }

  // ── Session persistence: save on state change ─────────────────────────
  useEffect(() => {
    if (offerResume) return // never wipe storage while the resume prompt is visible
    if (phase !== PHASE.CHATTING || !selectedLesson) return // nothing to save
    const key = snapKey(selectedLesson)
    if (!key) return
    try {
      localStorage.setItem(key, JSON.stringify({
        selectedLesson, chatMessages, transcript, objectives, completedObj, objResponses, essay, essayMode,
      }))
    } catch { /* ignore quota errors */ }
  }, [phase, selectedLesson, offerResume, chatMessages, transcript, objectives, completedObj, objResponses, essay, essayMode])

  // Redirect to /learn/lessons when lesson list is shown (list selection is now handled there)
  useEffect(() => {
    if (phase === PHASE.LIST && !listLoading && !offerResume) {
      router.replace('/learn/lessons')
    }
  }, [phase, listLoading, offerResume, router])

  // ── Supabase transcript auto-save (Mrs. Webb) ─────────────────────────
  // Debounced: fires 3 s after the last transcript change while chatting.
  useEffect(() => {
    if (phase !== PHASE.CHATTING || !selectedLesson || !transcript.length) return
    const tid = setTimeout(async () => {
      try {
        const lid = learnerId
        if (!lid || lid === 'demo') return
        const lessonId = selectedLesson.lessonKey || selectedLesson.lesson_id || selectedLesson.id || 'unknown'
        const lines = transcript.map(ln => ({
          role: (ln.role === 'user') ? 'user' : 'assistant',
          text: String(ln.text || '').trim(),
        })).filter(ln => ln.text)
        const txResult = await updateTranscriptLiveSegment({
          learnerId: lid,
          learnerName: learnerName.current || '',
          lessonId,
          lessonTitle: selectedLesson.title || lessonId,
          startedAt: webbSessionStartRef.current || new Date().toISOString(),
          lines,
          teacher: 'webb',
        })
        if (!txResult?.ok) {
          console.error('[Webb] Transcript save failed:', txResult?.reason, txResult?.error)
        }
      } catch (e) { console.error('[Webb] Transcript save error:', e) }
    }, 3000)
    return () => clearTimeout(tid)
  }, [transcript, phase, selectedLesson, learnerId])

  useEffect(() => { isMutedRef.current = isMuted }, [isMuted])

  // ── Orientation detection ─────────────────────────────────────────────
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      const land = w > h
      setIsLandscape(land)
      if (!land) { setVideoMaxHeight(null); setVideoColPct(45); return }
      let frac
      if (h <= 375)       frac = 0.40
      else if (h <= 600)  frac = 0.40 + ((h - 375) / 225) * 0.25
      else if (h <= 700)  frac = 0.65 + ((h - 600) / 100) * 0.05
      else if (h <= 1000) frac = 0.70 + ((h - 700) / 300) * 0.05
      else                frac = 0.75
      setVideoMaxHeight(Math.round(h * frac))
      setVideoColPct(50)
    }
    calc()
    window.addEventListener('resize', calc)
    window.addEventListener('orientationchange', calc)
    let vv = null
    try { vv = window.visualViewport || null } catch {}
    if (vv) { try { vv.addEventListener('resize', calc) } catch {} }
    return () => {
      window.removeEventListener('resize', calc)
      window.removeEventListener('orientationchange', calc)
      if (vv) { try { vv.removeEventListener('resize', calc) } catch {} }
    }
  }, [])

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

  // ── TTS queue ─────────────────────────────────────────────────────────
  async function drainTTSQueue() {
    if (ttsBusyRef.current) return
    const text = ttsQueueRef.current.shift()
    if (!text) return
    ttsBusyRef.current = true
    if (!isMutedRef.current) {
      try {
        const res = await fetch('/api/webb-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
        const data = await res.json()
        const audioUrl = data.audio
        if (audioUrl && !isMutedRef.current) {
          await new Promise((resolve) => {
            const audio = new Audio(audioUrl)
            ttsCurrentRef.current = audio
            setEngineState('playing')
            try { videoRef.current?.play() } catch {}
            const done = () => {
              if (ttsCurrentRef.current === audio) ttsCurrentRef.current = null
              if (!ttsQueueRef.current.length) {
                setEngineState('idle')
                try { if (videoRef.current) videoRef.current.pause() } catch {}
              }
              resolve()
            }
            audio.onended = done
            audio.onerror = done
            audio.play().catch(done)
          })
        }
      } catch {
        setEngineState('idle')
        try { if (videoRef.current) videoRef.current.pause() } catch {}
      }
    }
    ttsBusyRef.current = false
    if (ttsQueueRef.current.length > 0) { drainTTSQueue() }
    else {
      setEngineState('idle')
      try { if (videoRef.current) videoRef.current.pause() } catch {}
    }
  }

  function speakText(text) {
    const t = String(text || '').trim()
    if (!t) return
    ttsQueueRef.current.push(t)
    drainTTSQueue()
  }

  function skipTTS() {
    ttsQueueRef.current = []
    if (ttsCurrentRef.current) {
      ttsCurrentRef.current.pause()
      ttsCurrentRef.current.onended = null
      ttsCurrentRef.current = null
    }
    ttsBusyRef.current = false
    setEngineState('idle')
    try { if (videoRef.current) videoRef.current.pause() } catch {}
  }

  function toggleMute() {
    setIsMuted(prev => {
      const next = !prev
      isMutedRef.current = next
      if (next) skipTTS()
      return next
    })
  }

  // ── Transcript helpers ────────────────────────────────────────────────
  function addMsg(text) {
    const t = String(text || '').trim()
    if (!t) return
    setTranscript(prev => {
      const next = [...prev, { text: t, role: 'assistant' }]
      setActiveIndex(next.length - 1)
      return next
    })
    speakText(t)
  }

  function addStudentLine(text) {
    const t = String(text || '').trim()
    if (!t) return
    setTranscript(prev => [...prev, { text: t, role: 'user' }])
  }

  // Like addMsg but tags the transcript entry with a passage index so the
  // bubble renderer can show a citation link back to the article highlight.
  function addPassageMsg(text, passageIdx) {
    const t = String(text || '').trim()
    if (!t) return
    setTranscript(prev => {
      const next = [...prev, { text: t, role: 'assistant', passageIdx }]
      setActiveIndex(next.length - 1)
      return next
    })
    speakText(t)
  }

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

  // Seek to a segment and auto-play; useEffect above auto-pauses at endSec.
  function playSegment(startSec, endSec) {
    setMediaOverlay('video')
    segmentEndRef.current = typeof endSec === 'number' ? endSec : null
    // Poll for iframe mount in case the overlay was just opened
    const doCmd = (left) => {
      if (videoIframeRef.current?.contentWindow) {
        ytCmd('seekTo', [startSec, true])
        ytCmd('playVideo')
      } else if (left > 0) {
        setTimeout(() => doCmd(left - 1), 120)
      }
    }
    setTimeout(() => doCmd(10), 60)
  }

  // Add a transcript bubble tagged with momentIdx so it shows a ▶ replay button
  function addMomentMsg(text, momentIdx) {
    const t = String(text || '').trim()
    if (!t) return
    setTranscript(prev => {
      const next = [...prev, { text: t, role: 'assistant', momentIdx }]
      setActiveIndex(next.length - 1)
      return next
    })
  }

  // Resolves once the segment auto-pause fires or the deadline is reached
  function waitForSegmentEnd(endSec, maxWaitMs) {
    return new Promise(resolve => {
      const startedAt = Date.now()
      const deadline  = startedAt + (maxWaitMs ?? 90000)
      const check = () => {
        if (Date.now() - startedAt < 1500) { setTimeout(check, 400); return }
        if (segmentEndRef.current === null ||
            videoCurrentTimeRef.current >= endSec ||
            Date.now() > deadline) resolve()
        else setTimeout(check, 400)
      }
      setTimeout(check, 200)
    })
  }

  // Open/close the video overlay with tier-aware Mrs. Webb messages.
  function handleVideoButtonClick() {
    if (mediaOverlay === 'video') { setMediaOverlay(null); return }
    // Still loading or resource not yet resolved — open overlay to show spinner
    if (videoLoading || !videoResource) { setMediaOverlay('video'); return }
    // No relevant video was found — say something once, then don't open
    if (videoResource.unavailable) {
      if (!noVideoMsgSentRef.current) {
        noVideoMsgSentRef.current = true
        addMsg("I searched for a video to go with this lesson but the results just weren't helpful — nothing came up that would actually teach the material. Let's keep talking — there's plenty we can dig into together!")
      }
      return
    }
    // Video rate limit: first watch is free; each additional watch requires 2 more completed objectives.
    // maxAllowed = 1 + floor(completedObj.length / 2)
    const maxVideos  = 1 + Math.floor(completedObj.length / 2)
    if (videosWatchedRef.current >= maxVideos) {
      const objsNeeded = videosWatchedRef.current * 2 - completedObj.length
      addMsg(
        objsNeeded === 1
          ? `I love that you want to keep watching! Here's our deal — I open the video once for every two objectives we work through together. You're almost there: show me you understand just one more objective and I'll open it right back up!`
          : `I love that you want to keep watching! Here's our deal — I open the video once for every two objectives we work through together. Show me you understand ${objsNeeded} more objectives and I'll open it right back up!`
      )
      return
    }
    // Low-relevance video — say something once, then open
    if (videoResource.relevanceTier === 'low' && !lowTierMsgSentRef.current) {
      lowTierMsgSentRef.current = true
      addMsg("I searched hard but couldn't find a perfect video for this lesson. I found one that covers some related ideas — it might still be worth watching!")
    }
    videosWatchedRef.current += 1
    setMediaOverlay('video')
  }

  async function interpretVideo() {
    const vid = videoResource?.videoId
    if (!vid || interpretingVideo) return

    // Fast path: we already know this video has neither captions nor chapters.
    // Skip the API round-trip and tell the student up front.
    if (videoResource.hasCaptions === false && videoResource.hasChapters === false) {
      const isHigh = videoResource.relevanceTier !== 'low'
      addMsg(isHigh
        ? "This video is a great match, but it doesn't have chapters so I can't jump to specific moments. Go ahead and watch it — ask me about anything that pops up!"
        : "I found this video because it covers some related ideas, but without chapters I can't take you to specific parts. Give it a watch and bring any questions my way!"
      )
      return
    }

    setInterpretingVideo(true)
    setMediaOverlay('video')
    setVideoMoments([])
    try {
      const res = await fetch('/api/webb-video-interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId:          vid,
          lessonTitle:      selectedLesson?.title || '',
          grade:            selectedLesson?.grade ? `Grade ${selectedLesson.grade}` : 'elementary',
          learnerName:      learnerName.current || '',
          objectives,
          completedIndices: completedObj,
        }),
      })
      const data = await res.json()
      if (data.error === 'transcript_unavailable') {
        const isHigh = videoResource?.relevanceTier !== 'low'
        addMsg(isHigh
          ? "This video looks like a great match, but it doesn't have chapters so I can't take you to specific moments. Go ahead and watch — ask me anything that comes up!"
          : "I found this video because it relates to some of our ideas, but it doesn't have chapters so I can't jump to key parts. Feel free to watch what's here — bring any questions my way!"
        )
        setInterpretingVideo(false)
        return
      }
      const moments = data.moments || []
      if (!moments.length) {
        addMsg("I couldn't identify the key moments in this video. Try watching it and ask me about anything interesting!")
        return
      }
      setVideoMoments(moments)
      // videoResearchHistory tracks moment intros so the assessment push has full context
      const videoResearchHistory = [...chatMessages]
      for (let i = 0; i < moments.length; i++) {
        const m = moments[i]
        if (m.intro) {
          const introMsg = { role: 'assistant', content: m.intro }
          videoResearchHistory.push(introMsg)
          setChatMessages(prev => [...prev, introMsg])
          addMsg(m.intro)
        }
        await waitForTTSIdle()
        addMomentMsg(`\uD83C\uDFA5 ${m.title} \u00B7 ${formatVideoTime(m.startSeconds)}`, i)
        const segMs = Math.max(10, m.endSeconds - m.startSeconds) * 1000
        playSegment(m.startSeconds, m.endSeconds)
        await waitForSegmentEnd(m.endSeconds, segMs + 8000)
        await new Promise(r => setTimeout(r, 600))
      }

      // ── Assessment push: ask the student to demonstrate objective comprehension ──
      // Build snapshot of remaining objectives at the moment the tour ends
      const remaining = objectives.filter((_, i) => !completedObj.includes(i))
      try {
        const assessRes = await fetch('/api/webb-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages:            videoResearchHistory,
            lesson:              selectedLesson,
            media:               { video: videoResource || null, article: articleResource ? { title: articleResource.title, source: articleResource.source } : null },
            remainingObjectives: remaining,
            assessmentPush:      true,
          }),
        })
        const assessData = await assessRes.json()
        const assessReply = assessData.reply
        if (assessReply) {
          const aMsg = { role: 'assistant', content: assessReply }
          setChatMessages(prev => [...prev, aMsg])
          addMsg(assessReply)
          await waitForTTSIdle()
          // Check if the student's previous responses already covered anything
          setObjectives(obj => {
            setCompletedObj(comp => {
              checkObjectivesAfterTurn([...videoResearchHistory, aMsg], obj, comp)
              return comp
            })
            return obj
          })
        } else {
          addMsg('Great job watching those key moments! Tell me: what\'s the most interesting thing you just learned?')
          await waitForTTSIdle()
        }
      } catch {
        addMsg('Those were the key moments! What was the most interesting part for you?')
        await waitForTTSIdle()
      }
    } catch (e) { console.error('[webb] interpretVideo error:', e) }
    setInterpretingVideo(false)
  }

  // ── Lesson list ───────────────────────────────────────────────────────
  async function loadLessons(id) {
    const lid = id ?? learnerId
    setPageError('')
    if (!lid) return
    setListLoading(true)
    try {
      const [availRes, historyRes] = await Promise.all([
        fetch(`/api/learner/available-lessons?learner_id=${encodeURIComponent(lid)}`)
          .then(r => r.ok ? r.json() : Promise.reject(new Error('Could not load lessons.'))),
        fetch(`/api/learner/lesson-history?learner_id=${encodeURIComponent(lid)}&limit=200`)
          .then(r => r.ok ? r.json() : null).catch(() => null),
      ])
      const { lessons = [] } = availRes || {}
      setAvailableLessons(lessons)
      setAllOwnedLessons(lessons)
      const seen = new Map()
      if (historyRes?.sessions) {
        const completed = historyRes.sessions.filter(s => s.status === 'completed' && s.lesson_id && s.ended_at)
        for (const s of completed) {
          const existing = seen.get(s.lesson_id)
          if (!existing || new Date(s.ended_at) > new Date(existing.ended_at)) seen.set(s.lesson_id, s)
        }
        setRecentSessions([...seen.values()].sort((a, b) => new Date(b.ended_at) - new Date(a.ended_at)))
      }
      const approvedKeySet = new Set(lessons.map(l => l.lessonKey || l.lesson_id || ''))
      const historyMissing = [...seen.keys()].filter(k => !approvedKeySet.has(k))
      if (historyMissing.length) {
        fetch('/api/lessons/meta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys: historyMissing, learner_id: lid }),
        }).then(r => r.ok ? r.json() : null).then(res => {
          if (res?.lessons?.length) {
            const map = {}
            for (const l of res.lessons) map[l.lessonKey] = l
            setHistoryLessons(map)
          }
        }).catch(() => {})
      }

      // Check for a pending lesson key from /learn/lessons teacher selection
      const pendingKey = (() => { try { return sessionStorage.getItem('webb_pending_lesson_key') } catch { return null } })()
      if (pendingKey) {
        const match = lessons.find(l => (l.lessonKey || `${l.subject || 'general'}/${l.file || ''}`) === pendingKey)
        if (match) {
          try { sessionStorage.removeItem('webb_pending_lesson_key') } catch {}
          selectLesson(match)
          return
        }
        try { sessionStorage.removeItem('webb_pending_lesson_key') } catch {}
      }
    } catch (e) {
      setPageError(e?.message || 'Could not load lessons.')
    } finally {
      setListLoading(false)
    }
  }

  // ── Preload resources for lesson ──────────────────────────────────────
  // Video and article are fetched in parallel but independently so each
  // resolves as soon as it's ready (video ~3s, article ~4s).
  // `objContext` is a hint string of remaining objectives used to shape the search.
  const preloadResources = useCallback((lesson, objContext = '', objectives = []) => {
    setVideoResource(null)
    setArticleResource(null)
    setVideoLoading(true)
    setArticleLoading(true)
    shownVideoIdsRef.current   = []
    lowTierMsgSentRef.current  = false
    noVideoMsgSentRef.current  = false
    videosWatchedRef.current   = 0

    const post = (type) => fetch('/api/webb-resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lesson, type, context: objContext, preferredSources: articleSources, objectives }),
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
        if (data.article?.html) {
          setArticleResource(data.article)
        } else {
          // Retry once after a short pause (handles transient Wikipedia timeouts)
          return new Promise(res => setTimeout(res, 2000))
            .then(() => post('article'))
            .then(r => r.json())
            .then(data2 => { if (data2.article?.html) setArticleResource(data2.article) })
        }
      })
      .catch(() => {})
      .finally(() => setArticleLoading(false))
  }, [])

  // ── Objectives: generate when lesson starts ──────────────────────────
  // Generate objectives from the lesson question bank (fired once per lesson).
  // Fall back silently if the API is unavailable.
  const generateObjectives = useCallback(async (lesson) => {
    setObjectives([])
    setCompletedObj([])
    setNewlyCompletedObj(null)
    setObjResponses({})
    setExpandedObj(null)
    setEssayMode(false)
    setEssay(null)
    try {
      const res  = await fetch('/api/webb-objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', lesson }),
      })
      const data = await res.json()
      if (Array.isArray(data.objectives) && data.objectives.length) {
        setObjectives(data.objectives)
      }
    } catch { /* objectives are optional — fail silently */ }
  }, [])

  // ── Objectives: check after each student turn ─────────────────────────
  // Runs in the background after a normal chat turn; never blocks the UI.
  const checkObjectivesAfterTurn = useCallback(async (updatedMessages, currentObjectives, currentCompleted) => {
    if (!currentObjectives.length) return
    if (currentCompleted.length >= currentObjectives.length) return
    if (checkingObjRef.current) {
      // A check is already in-flight — park the latest args so we retry once it finishes.
      // Using the latest args (most recent conversation) means we never lose a qualifying turn.
      pendingCheckRef.current = { updatedMessages, currentObjectives, currentCompleted }
      return
    }
    checkingObjRef.current = true
    pendingCheckRef.current = null
    try {
      const res  = await fetch('/api/webb-objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:           'check',
          objectives:       currentObjectives,
          completedIndices: currentCompleted,
          conversation:     updatedMessages,
        }),
      })
      const data = await res.json()
      const newly = data.newlyCompleted || []
      const qualifyingText = data.qualifyingText || {}
      if (newly.length) {
        setObjResponses(prev => ({ ...prev, ...qualifyingText }))
        setCompletedObj(prev => {
          const next = [...new Set([...prev, ...newly])]
          const firstIdx = newly.find(i => !prev.includes(i))
          if (firstIdx !== undefined) {
            setNewlyCompletedObj({ idx: firstIdx, text: currentObjectives[firstIdx] })
          }
          return next
        })
      }
    } catch { /* fail silently */ }
    checkingObjRef.current = false
    // If a check was parked while we were running, execute it now.
    if (pendingCheckRef.current) {
      const pending = pendingCheckRef.current
      pendingCheckRef.current = null
      checkObjectivesAfterTurn(pending.updatedMessages, pending.currentObjectives, pending.currentCompleted)
    }
  }, [])

  // Auto-dismiss the tablet toast after 3.5 s
  useEffect(() => {
    if (!newlyCompletedObj) return
    const t = setTimeout(() => setNewlyCompletedObj(null), 3500)
    return () => clearTimeout(t)
  }, [newlyCompletedObj])

  // ── Select lesson → start AI chat ─────────────────────────────────────
  // forceNew: skip snapshot check (used by handleRestartFromPrompt)
  const selectLesson = useCallback(async (lesson, forceNew = false) => {
    if (!forceNew) {
      // Check for a per-lesson snapshot BEFORE starting the session.
      // If one exists, show the resume/restart prompt instead.
      const key = snapKey(lesson)
      const snap = key ? (() => { try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null } })() : null
      if (snap?.chatMessages?.length) {
        setSelectedLesson(lesson)
        setOfferResume(true)
        return
      }
    }
    setPhase(PHASE.STARTING)
    setSelectedLesson(lesson)
    setTranscript([])
    setActiveIndex(-1)
    setChatMessages([])
    setVideoResource(null)
    setArticleResource(null)
    setMediaOverlay(null)
    setPageError('')
    setObjectives([])
    setCompletedObj([])
    setNewlyCompletedObj(null)
    setObjResponses({})
    setExpandedObj(null)
    setEssayMode(false)
    setEssay(null)
    awaitingSentenceRef.current = null
    webbSessionStartRef.current = new Date().toISOString()

    // Get Mrs. Webb's opening greeting
    try {
      const res = await fetch('/api/webb-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [], lesson }),
      })
      const data = await res.json()
      const reply = data.reply || `Hi! I'm Mrs. Webb. Today we're exploring "${lesson.title}". What do you already know about this topic?`
      const firstMsg = { role: 'assistant', content: reply }
      setChatMessages([firstMsg])
      addMsg(reply)
    } catch {
      const fallback = `Hi! I'm Mrs. Webb. Let's explore "${lesson.title}" together! What do you already know?`
      setChatMessages([{ role: 'assistant', content: fallback }])
      addMsg(fallback)
    }

    setPhase(PHASE.CHATTING)

    // Preload media + generate objectives in background
    preloadResources(lesson)
    generateObjectives(lesson)
  }, [preloadResources, generateObjectives])

  // ── Send chat message ─────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || chatLoading) return
    addStudentLine(text)

    // ── Video trouble intercept ───────────────────────────────────────────
    // Catches "black screen", "video not working", etc. and gives a canned
    // explanation about YouTube being blocked by Screen Time / parental controls.
    if (detectVideoTrouble(text)) {
      addMsg(VIDEO_TROUBLE_MSG)
      return
    }

    // ── Sentence restatement gate ─────────────────────────────────────────
    // An objective was earned but the answer wasn't a complete sentence.
    // Hold the objective for up to 2 more tries, then release so the
    // conversation can continue (the objective stays uncompleted and can
    // be earned again naturally in normal chat).
    if (awaitingSentenceRef.current !== null) {
      const { objIdx, attempts = 0 } = awaitingSentenceRef.current
      setChatLoading(true)
      try {
        const res = await fetch('/api/webb-objectives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check-sentence', text }),
        })
        const data = await res.json()
        if (data.isSentence) {
          awaitingSentenceRef.current = null
          setObjResponses(prev => ({ ...prev, [objIdx]: text }))
          setCompletedObj(prev => {
            if (prev.includes(objIdx)) return prev
            const next = [...prev, objIdx]
            setNewlyCompletedObj({ idx: objIdx, text: objectives[objIdx] })
            return next
          })
          addMsg("Perfect — that's a great sentence! I'm counting that objective.")
        } else if (attempts >= 1) {
          // Two strikes — release the gate, let normal conversation resume.
          awaitingSentenceRef.current = null
          addMsg("No worries — let's keep going! You can always come back to that one. Just tell me more about it in a sentence whenever you're ready and I'll count it.")
        } else {
          awaitingSentenceRef.current = { objIdx, attempts: attempts + 1 }
          addMsg("Almost! I need a full sentence — something like \"The [topic] [does something].\" Try again!")
        }
      } catch {
        // API error — release the gate so the conversation isn't permanently stuck.
        awaitingSentenceRef.current = null
        addMsg("Almost! Try saying that in a full sentence. You've got this!")
      }
      setChatLoading(false)
      return
    }

    // ── UI FAQ intercept ──────────────────────────────────────────────────
    // Phase 2: action yes/no ("Want me to open it?")
    if (uiFaqActionPendingRef.current && uiFaqPendingRef.current) {
      if (!isYes(text) && !isNo(text)) {
        // Unrecognized — clear FAQ state and fall through to AI chat
        uiFaqPendingRef.current = null
        uiFaqActionPendingRef.current = false
      } else {
        const slug = uiFaqPendingRef.current
        uiFaqPendingRef.current = null
        uiFaqActionPendingRef.current = false
        if (isYes(text)) {
          addMsg('Sure thing! Opening it for you now.')
          if (slug === 'video')   setMediaOverlay('video')
          if (slug === 'article') setMediaOverlay('article')
        } else {
          addMsg("No problem! Just let me know if you need anything else.")
        }
        return
      }
    }
    // Phase 1: feature confirmation yes/no ("Are you wondering about X?")
    if (uiFaqPendingRef.current) {
      if (!isYes(text) && !isNo(text)) {
        // Unrecognized — clear FAQ state and fall through to AI chat
        uiFaqPendingRef.current = null
      } else {
        const slug = uiFaqPendingRef.current
        const cfg  = UI_FAQ[slug]
        if (isNo(text)) {
          uiFaqPendingRef.current = null
          addMsg("No problem! Ask me anything else about our lesson.")
        } else {
          addMsg(cfg.answer)
          if (cfg.actionSlug && cfg.actionPrompt) {
            uiFaqActionPendingRef.current = true
            setTimeout(() => addMsg(cfg.actionPrompt), 150)
          } else {
            uiFaqPendingRef.current = null
          }
        }
        return
      }
    }
    // ── Seek intent: "show me the part where..." ─────────────────────────
    if (detectSeekIntent(text) && mediaOverlay === 'video') {
      if (!videoMoments.length) {
        // Moments not loaded yet — suggest Key Part
        addMsg("I'd love to show you a specific part! First, tap the \"Key part\" button above the video so I can learn the chapters — then just tell me which part you want!")
        return
      }
      // Match the request against loaded moment titles using GPT
      setChatLoading(true)
      try {
        const momentList = videoMoments.map((m, i) => `${i}: [${formatVideoTime(m.startSeconds)}] ${m.title}`).join('\n')
        const res = await fetch('/api/webb-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...chatMessages, { role: 'user', content: text }],
            lesson:   selectedLesson,
            seekRequest: { momentList },
          }),
        })
        const data = await res.json()
        // Expected: { reply: "Sure! Let me show you...", seekMomentIdx: 1 }
        const reply = data.reply || ''
        const idx   = typeof data.seekMomentIdx === 'number' ? data.seekMomentIdx : -1
        if (reply) {
          setChatMessages(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: reply }])
          addMsg(reply)
          await waitForTTSIdle()
        }
        if (idx >= 0 && idx < videoMoments.length) {
          const m = videoMoments[idx]
          setMediaOverlay('video')
          addMomentMsg(`\uD83C\uDFA5 ${m.title} \u00B7 ${formatVideoTime(m.startSeconds)}`, idx)
          playSegment(m.startSeconds, m.endSeconds)
        } else if (!reply) {
          // GPT couldn't find a match — fall through to normal chat
          setChatLoading(false)
          // eslint-disable-next-line no-use-before-define
          const userMsg = { role: 'user', content: text }
          const nextHistory = [...chatMessages, userMsg]
          setChatMessages(nextHistory)
        }
      } catch { /* fall through */ }
      setChatLoading(false)
      return
    }

    // Phase 0: detect a UI question / feature intent
    const uiSlug = detectUiQuestion(text)
    if (uiSlug) {
      const cfg = UI_FAQ[uiSlug]
      uiFaqPendingRef.current = uiSlug
      if (cfg.actionSlug) {
        // Action-capable feature: name the resource, give button location, ask to open
        // Jump straight to action-pending phase (skip the generic confirm → answer steps)
        uiFaqActionPendingRef.current = true
        let intro
        if (uiSlug === 'video') {
          const title = videoResource?.title && !videoResource?.unavailable
            ? `"${videoResource.title}"`
            : 'one picked just for your lesson'
          intro = `There's a video for you — ${title}! To watch it, ${cfg.location}. Want me to open it for you right now?`
        } else if (uiSlug === 'article') {
          const title = articleResource?.title
            ? `"${articleResource.title}"`
            : 'one about your lesson topic'
          intro = `There's a Wikipedia article ready for you — ${title}! To read it, ${cfg.location}. Would you like me to open it for you?`
        } else {
          // Generic fallback for any future actionSlug entries
          intro = `${cfg.answer} ${cfg.actionPrompt}`
        }
        addMsg(intro)
      } else {
        // Non-action feature: standard confirm → answer flow
        addMsg(cfg.confirm)
      }
      return
    }
    // ── Normal API call ───────────────────────────────────────────────────
    const userMsg = { role: 'user', content: text }
    const nextHistory = [...chatMessages, userMsg]
    setChatMessages(nextHistory)
    setChatLoading(true)
    try {
      // ── Step 1: check objectives NOW (before calling webb-chat) ──────────
      // This ensures webb-chat receives the correct remaining-objectives list
      // (i.e. already-completed objectives are excluded) so Mrs. Webb's very
      // next question targets the NEXT incomplete goal, not the one just shown.
      let freshCompleted = [...completedObj]
      if (objectives.length && completedObj.length < objectives.length) {
        try {
          const checkRes = await fetch('/api/webb-objectives', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action:           'check',
              objectives,
              completedIndices: completedObj,
              conversation:     nextHistory,
              quick:            true,   // only scan last 2 user turns — keeps this fast
            }),
          })
          const checkData = await checkRes.json()
          const newly = checkData.newlyCompleted || []
          if (newly.length) {
            const qt = checkData.qualifyingText || {}
            const sq = checkData.sentenceQuality || {}
            const firstNew = newly.find(i => !completedObj.includes(i))
            // If AI flagged the qualifying answer as not a complete sentence, hold the
            // objective and ask the student to restate before crediting it.
            if (firstNew !== undefined && sq[firstNew] === false) {
              awaitingSentenceRef.current = { objIdx: firstNew }
              setChatLoading(false)
              addMsg("You've got the right idea! I need you to say that in a complete sentence though — that's what goes in your essay. Give it a try!")
              return
            }
            freshCompleted = [...new Set([...completedObj, ...newly])]
            setObjResponses(prev => ({ ...prev, ...qt }))
            setCompletedObj(freshCompleted)
            if (firstNew !== undefined) {
              setNewlyCompletedObj({ idx: firstNew, text: objectives[firstNew] })
            }
          }
        } catch { /* fail silently — chat still proceeds */ }
      }

      // ── Step 2: call webb-chat with the freshly-updated remaining list ───
      const res = await fetch('/api/webb-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextHistory,
          lesson: selectedLesson,
          media: {
            video:   videoResource   || null,
            article: articleResource ? { title: articleResource.title, source: articleResource.source } : null,
          },
          remainingObjectives: objectives.filter((_, i) => !freshCompleted.includes(i)),
          allObjectivesMet: objectives.length > 0 && freshCompleted.length >= objectives.length,
        }),
      })
      const data = await res.json()
      const reply = data.reply || "That's great! Keep exploring this topic with me."
      const assistantMsg = { role: 'assistant', content: reply }
      const finalHistory = [...nextHistory, assistantMsg]
      setChatMessages(finalHistory)
      addMsg(reply)
    } catch {
      const err = "I had a little trouble thinking. Can you say that again?"
      setChatMessages(prev => [...prev, { role: 'assistant', content: err }])
      addMsg(err)
    }
    setChatLoading(false)
  }, [chatLoading, chatMessages, selectedLesson, videoResource, articleResource, objectives, completedObj, objResponses])

  // ── Refresh a media resource (context-aware) ──────────────────────────
  async function refreshMedia(type) {
    // Video refreshes count the same as opens — one per two objectives completed.
    if (type === 'video') {
      const maxVideos = 1 + Math.floor(completedObj.length / 2)
      if (videosWatchedRef.current >= maxVideos) {
        const objsNeeded = videosWatchedRef.current * 2 - completedObj.length
        addMsg(
          objsNeeded === 1
            ? `I love that you want to explore more! Here's our deal — I show a new video once for every two objectives we work through together. You're almost there: show me you understand just one more objective and I'll find a fresh one!`
            : `I love that you want to explore more! Here's our deal — I show a new video once for every two objectives we work through together. Show me you understand ${objsNeeded} more objectives and I'll find a fresh one!`
        )
        return
      }
      videosWatchedRef.current += 1
    }
    setRefreshingMedia(true)
    // Reset tier-message flags so a newly fetched video can say its own message
    if (type === 'video') { lowTierMsgSentRef.current = false; noVideoMsgSentRef.current = false }
    // Save current article so we can restore it if the refresh fails/returns nothing
    const savedArticle = articleResource
    // Clear immediately so the "Finding an article…" spinner appears while loading
    if (type === 'article') setArticleResource(null)
    const recentContext = chatMessages.slice(-6)
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('. ')
    // Narrow search to remaining (incomplete) objectives
    const remaining = objectives
      .filter((_, i) => !completedObj.includes(i))
      .join('; ')
    const contextWithObj = [remaining, recentContext].filter(Boolean).join('. ')
    try {
      const res = await fetch('/api/webb-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson: selectedLesson,
          type,
          context: contextWithObj,
          objectives:             objectives.filter((_, i) => !completedObj.includes(i)),
          excludeSourceId:        type === 'article' ? (articleResource?.sourceId || '') : undefined,
          preferredSources:       type === 'article' ? articleSources : undefined,
          excludeVideoIds:        type === 'video'   ? shownVideoIdsRef.current      : [],
        }),
      })
      const data = await res.json()
      if (type === 'video' && data.video) {
        setVideoResource(data.video)
        if (data.video.videoId)
          shownVideoIdsRef.current = [...new Set([...shownVideoIdsRef.current, data.video.videoId])]
      }
      if (type === 'article') {
        if (data.article?.html) {
          setArticleKey(k => k + 1)
          setArticleResource(data.article)
        } else {
          // Nothing usable came back — restore the old article so it doesn't disappear
          setArticleResource(savedArticle)
        }
      }
    } catch {
      if (type === 'article') setArticleResource(savedArticle)
    }
    setRefreshingMedia(false)
  }

  // ── Close objectives panel (aborts essay generation if in progress) ───
  function closeObjectivesPanel() {
    if (generatingEssay && essayAbortRef.current) {
      essayAbortRef.current.abort()
      essayAbortRef.current = null
      setGeneratingEssay(false)
    }
    setShowObjectives(false)
  }

  // ── Research mode: close overlay, Webb navigates to the best media or teaches directly ──
  // Priority: (A) video with chapters → seek to best chapter → play → Socratic
  //           (B) article available   → targeted highlight+scroll → Socratic
  //           (C) no navigable media  → conversational teach → Socratic
  async function startResearch(objIdx) {
    closeObjectivesPanel()
    setMediaOverlay(null)
    const obj = objectives[objIdx]
    setChatLoading(true)
    try {
      // ── Try to get navigable video chapters ──────────────────────────
      let researchMoments = null
      if (videoResource && !videoResource.unavailable && videoResource.hasChapters) {
        if (videoMoments.length) {
          researchMoments = videoMoments
        } else {
          // Load chapter moments silently (no tour, just fetch)
          try {
            const r = await fetch('/api/webb-video-interpret', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                videoId:          videoResource.videoId,
                lessonTitle:      selectedLesson?.title || '',
                grade:            selectedLesson?.grade,
                learnerName:      learnerName.current || '',
                objectives,
                completedIndices: completedObj,
              }),
            })
            const d = await r.json()
            if (d.moments?.length) {
              researchMoments = d.moments
              setVideoMoments(d.moments)
            }
          } catch { /* fall through */ }
        }
      }

      // ═══ Path A: Video + chapters ═══════════════════════════════════
      if (researchMoments?.length) {
        // Ask GPT to pick the chapter that best covers this objective
        const momentList = researchMoments.map((m, i) => `${i}: [${formatVideoTime(m.startSeconds)}] ${m.title}`).join('\n')
        let pickIdx  = 0
        let introMsg = ''
        try {
          const seekRes = await fetch('/api/webb-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              seekRequest: { momentList },
              messages:    [{ role: 'user', content: obj }],
              lesson:      selectedLesson,
            }),
          })
          const seekData = await seekRes.json()
          if (typeof seekData.seekMomentIdx === 'number' && seekData.seekMomentIdx >= 0 && seekData.seekMomentIdx < researchMoments.length) {
            pickIdx = seekData.seekMomentIdx
          }
          introMsg = seekData.reply || ''
        } catch { /* use defaults */ }

        const m          = researchMoments[pickIdx]
        const webbIntro  = introMsg || `Let me take you to the right part of the video! Watch this section and then I'll ask you about it.`
        const introEntry = { role: 'assistant', content: webbIntro }
        setChatMessages(prev => [...prev, introEntry])
        addMsg(webbIntro)

        // Open video and play that chapter segment
        const segMs = Math.max(10, m.endSeconds - m.startSeconds) * 1000
        playSegment(m.startSeconds, m.endSeconds)
        await waitForSegmentEnd(m.endSeconds, segMs + 8000)
        await waitForTTSIdle()

        // Socratic follow-up after the segment
        try {
          const fRes = await fetch('/api/webb-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages:            [...chatMessages, introEntry],
              lesson:              selectedLesson,
              remainingObjectives: [obj],
              assessmentPush:      true,
            }),
          })
          const fData  = await fRes.json()
          const fReply = fData.reply || `Now that you've seen that, can you explain in your own words: ${obj}?`
          const fEntry = { role: 'assistant', content: fReply }
          setChatMessages(prev => [...prev, fEntry])
          addMsg(fReply)
        } catch {
          addMsg(`Great! Now, can you explain in your own words: ${obj}?`)
        }

      // ═══ Path B: Article highlight + scroll ═════════════════════════
      } else if (articleResource?.html) {
        setMediaOverlay('article')
        setInterpretingArticle(true)
        passageEls.current          = []
        userScrolledArticleRef.current = false
        // researchHistory tracks everything Mrs. Webb says during the article walk-through
        // so the Socratic follow-up receives full context (chatMessages is a stale closure).
        let researchHistory = [...chatMessages]
        try {
          const r = await fetch('/api/webb-interpret', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              html:             articleResource.html,
              lessonTitle:      selectedLesson?.title || '',
              grade:            selectedLesson?.grade ? `Grade ${selectedLesson.grade}` : 'elementary',
              learnerName:      learnerName.current || '',
              objectives:       [obj],   // single focused objective
              completedIndices: [],
            }),
          })
          const data    = await r.json()
          const passages = data.passages || (data.excerpt ? [{ excerpt: data.excerpt }] : [])
          const excerpts     = passages.map(p => p.excerpt).filter(Boolean)
          const spokenTexts  = passages.map(p => p.spoken || p.excerpt)

          if (excerpts.length) {
            // Wait for article iframe to be ready
            await new Promise(resolve => {
              let tries = 0
              const check = () => {
                const iframe = articleIframeRef.current
                if (iframe) {
                  if (iframe.contentDocument?.readyState === 'complete') { resolve() }
                  else {
                    let settled = false
                    const done = () => { if (!settled) { settled = true; resolve() } }
                    iframe.addEventListener('load', done, { once: true })
                    setTimeout(done, 3000)
                  }
                } else if (tries++ < 40) { setTimeout(check, 100) }
                else { resolve() }
              }
              check()
            })

            setArticlePassageExcerpts(excerpts)
            const els = highlightPassages(excerpts)
            passageEls.current = els

            if (data.intro) {
              const introMsg = { role: 'assistant', content: data.intro }
              researchHistory.push(introMsg)
              setChatMessages(prev => [...prev, introMsg])
              addMsg(data.intro)
            }
            for (let i = 0; i < excerpts.length; i++) {
              await waitForTTSIdle()
              activatePassage(i)
              scrollToPassage(i, true)
              const passMsg = { role: 'assistant', content: spokenTexts[i] }
              researchHistory.push(passMsg)
              setChatMessages(prev => [...prev, passMsg])
              addPassageMsg(spokenTexts[i], i)
            }
            await waitForTTSIdle()
            const doc = articleIframeRef.current?.contentDocument
            doc?.querySelectorAll('.webb-hl-active').forEach(el => el.classList.remove('webb-hl-active'))
          }
        } catch (e) { console.error('[webb] research-article error:', e) }
        setInterpretingArticle(false)

        // Socratic follow-up — researchHistory carries the full research context
        try {
          const fRes = await fetch('/api/webb-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages:            researchHistory,
              lesson:              selectedLesson,
              remainingObjectives: [obj],
              assessmentPush:      true,
            }),
          })
          const fData  = await fRes.json()
          const fReply = fData.reply || `Now, can you explain in your own words: ${obj}?`
          const fEntry = { role: 'assistant', content: fReply }
          setChatMessages(prev => [...prev, fEntry])
          addMsg(fReply)
        } catch {
          addMsg(`Now, can you explain in your own words: ${obj}?`)
        }

      // ═══ Path C: No navigable media — teach directly in conversation ═
      } else {
        try {
          const res = await fetch('/api/webb-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages:        chatMessages,
              lesson:          selectedLesson,
              researchDirect:  true,
              targetObjective: obj,
            }),
          })
          const data  = await res.json()
          const reply = data.reply || `Let me explain: "${obj}". Can you tell me what that means in your own words?`
          const entry = { role: 'assistant', content: reply }
          setChatMessages(prev => [...prev, entry])
          addMsg(reply)
        } catch {
          addMsg(`Let's explore this together: "${obj}". What do you already know about it?`)
        }
      }
    } catch (e) {
      console.error('[webb] startResearch error:', e)
      addMsg(`Let's explore this learning goal together: "${obj}". What do you already know?`)
    }
    setChatLoading(false)
  }

  // ── Generate essay from all objective responses ───────────────────────
  async function handleGenerateEssay() {
    if (generatingEssay) return
    const ctrl = new AbortController()
    essayAbortRef.current = ctrl
    setGeneratingEssay(true)
    try {
      const res = await fetch('/api/webb-objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:    'generate-essay',
          objectives,
          responses: objResponses,
          lesson:    selectedLesson,
        }),
        signal: ctrl.signal,
      })
      const data = await res.json()
      if (data.essay) {
        setEssay(data.essay)
        setEssayMode(true)
      }
    } catch (e) {
      if (e?.name !== 'AbortError') { /* fail silently */ }
    }
    essayAbortRef.current = null
    setGeneratingEssay(false)
  }

  // ── Complete lesson via Mrs. Webb ─────────────────────────────────────
  async function handleCompleteLesson() {
    if (!learnerId || !selectedLesson) return
    const lk = selectedLesson.lessonKey || selectedLesson.lesson_id || selectedLesson.id || 'unknown'
    saveWebbCompletion(learnerId, lk)
    setWebbCompletionMap(getWebbCompletionForLearner(learnerId))
    // Close the essay overlay immediately
    setEssayMode(false)
    // Speak the farewell and then return to lesson selection
    const lessonTitle = selectedLesson.title || 'this lesson'
    const farewell = `Fantastic work! You've completed ${lessonTitle} — your essay is something to be really proud of. I'll see you next time!`
    addMsg(farewell)
    await waitForTTSIdle()
    setJustCompletedLesson(lessonTitle)
    handleBack()
  }

  // ── Article passage scroll detector ─────────────────────────────────
  // Attaches a scroll listener so we know when the user has scrolled manually.
  useEffect(() => {
    if (mediaOverlay !== 'article') return
    const iframeEl = articleIframeRef.current
    if (!iframeEl) return
    userScrolledArticleRef.current = false
    let removeListener = () => {}
    const attach = () => {
      const win = iframeEl.contentWindow
      if (!win) return
      const onScroll = () => {
        if (!programmaticScrollRef.current) userScrolledArticleRef.current = true
      }
      win.addEventListener('scroll', onScroll, { passive: true })
      removeListener = () => win.removeEventListener('scroll', onScroll)
    }
    if (iframeEl.contentDocument?.readyState === 'complete') {
      attach()
    } else {
      const onLoad = () => attach()
      iframeEl.addEventListener('load', onLoad)
      return () => { iframeEl.removeEventListener('load', onLoad); removeListener() }
    }
    return () => removeListener()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaOverlay, articleResource])

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

  // Clear stored passage excerpts whenever the article content changes
  useEffect(() => {
    setArticlePassageExcerpts([])
    passageEls.current = []
  }, [articleResource])

  // ── Article interpret: highlight all passages and read each one in order ──
  async function interpretArticle() {
    if (!articleResource?.html || interpretingArticle) return
    setInterpretingArticle(true)
    // Ensure article overlay is open so the iframe exists in the DOM
    setMediaOverlay('article')
    // Reset so auto-scroll works cleanly on each new interpret run
    passageEls.current = []
    userScrolledArticleRef.current = false
    try {
      const res = await fetch('/api/webb-interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html:             articleResource.html,
          lessonTitle:      selectedLesson?.title || '',
          grade:            selectedLesson?.grade ? `Grade ${selectedLesson.grade}` : 'elementary',
          learnerName:      learnerName.current || '',
          objectives,
          completedIndices: completedObj,
        }),
      })
      const data = await res.json()
      const passages = data.passages || (data.excerpt ? [{ excerpt: data.excerpt }] : [])
      if (!passages.length) return

      const excerpts = passages.map(p => p.excerpt).filter(Boolean)
      const spokenTexts = passages.map(p => p.spoken || p.excerpt)

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
        addPassageMsg(spokenTexts[i], i)
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

    // Inject a <style> block for highlight rules (once per document load)
    if (!doc.getElementById('webb-hl-style')) {
      const s = doc.createElement('style')
      s.id = 'webb-hl-style'
      s.textContent =
        '.webb-hl{background:#fef08a!important;outline:2px solid #ca8a04!important;' +
        'border-radius:3px;scroll-margin-top:80px}' +
        '.webb-hl-active{background:#fbbf24!important;outline:2px solid #b45309!important}'
      try { doc.head?.appendChild(s) } catch { /* ignore */ }
    }

    // Clear previous highlights (class + id only — never alter inline styles)
    doc.querySelectorAll('.webb-hl,.webb-hl-active').forEach(el => {
      el.classList.remove('webb-hl', 'webb-hl-active')
      el.removeAttribute('id')
    })

    // Wikipedia textContent includes inline citation markers like [1], [2].
    // GPT excerpts don't include them, so we strip them before matching.
    const normText = s => (s || '')
      .replace(/\[\d+\]/g, '')           // [1], [23] …
      .replace(/\[[a-zA-Z]\]/g, '')      // [a], [B] …
      .replace(/\[note\s*\d*\]/gi, '')   // [note 1] …
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/^["'\u201c\u201d\u2018\u2019]+/, '') // strip GPT leading quotes
      .replace(/["'\u201c\u201d\u2018\u2019]+$/, '') // strip GPT trailing quotes
      .replace(/\s+/g, ' ')
      .trim()

    // All block-level candidates in document order
    const candidates = Array.from(
      doc.querySelectorAll('p,li,dt,dd,h2,h3,h4,h5,blockquote,td,th')
    )

    const results = []
    for (let i = 0; i < excerpts.length; i++) {
      const needle = normText(excerpts[i])
      let found = null
      // Try progressively shorter anchors to tolerate minor text diffs
      for (const len of [40, 25, 15]) {
        const anchor = needle.slice(0, len)
        if (!anchor) continue
        for (const el of candidates) {
          if (normText(el.textContent).includes(anchor)) {
            found = el
            break
          }
        }
        if (found) break
      }
      if (found) {
        found.id = `webb-passage-${i}`
        found.classList.add('webb-hl')
      }
      results.push(found || null)
    }
    return results
  }

  // Briefly adds the .webb-hl-active class to the passage being spoken
  function activatePassage(idx) {
    const doc = articleIframeRef.current?.contentDocument
    if (!doc) return
    doc.querySelectorAll('.webb-hl-active').forEach(el => el.classList.remove('webb-hl-active'))
    const el = doc.getElementById(`webb-passage-${idx}`)
    if (el) el.classList.add('webb-hl-active')
  }

  // ── Exit ──────────────────────────────────────────────────────────────
  async function handleExit() {
    const { ensurePinAllowed } = await import('@/app/lib/pinGate')
    if (!await ensurePinAllowed('session-exit')) return
    skipTTS()
    router.push('/learn/lessons')
  }

  function handleBack() {
    skipTTS()
    setPhase(PHASE.LIST)
    setSelectedLesson(null)
    setMediaOverlay(null)
  }

  // ── Layout styles ─────────────────────────────────────────────────────
  const videoEffH = videoMaxHeight && Number.isFinite(videoMaxHeight) ? videoMaxHeight : null
  const msSBSH    = videoEffH ? `${videoEffH}px` : (sideBySideHeight ? `${sideBySideHeight}px` : 'auto')

  const mainLayoutStyle = isMobileLandscape
    ? { display: 'flex', alignItems: 'stretch', flex: '1 1 0', overflow: 'hidden', background: '#fff', paddingLeft: 8, paddingRight: 8, boxSizing: 'border-box', '--msSideBySideH': msSBSH }
    : { display: 'flex', flexDirection: 'column', flex: '1 1 0', overflow: 'hidden', background: '#fff' }

  const videoWrapperStyle = isMobileLandscape
    ? { flex: `0 0 ${videoColPercent}%`, position: 'relative', overflow: 'hidden', minWidth: 0, height: 'var(--msSideBySideH)', display: 'flex', flexDirection: 'column' }
    : { flex: '0 0 50%', position: 'relative', width: '100%', overflow: 'hidden', minHeight: 0, boxSizing: 'border-box' }

  const dynH = (isMobileLandscape && videoEffH) ? { height: videoEffH, maxHeight: videoEffH, minHeight: 0 } : {}

  const videoInnerStyle = isMobileLandscape
    ? { position: 'relative', overflow: 'hidden', aspectRatio: '16 / 7.2', minHeight: 200, width: '100%', background: '#000', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.12)', ...dynH }
    : { position: 'relative', overflow: 'hidden', height: 'calc(100% - 4px)', width: '92%', margin: '4px auto 0', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.12)', background: '#000' }

  const transcriptWrapperStyle = isMobileLandscape
    ? { flex: `0 0 ${100 - videoColPercent}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, height: 'var(--msSideBySideH)', maxHeight: 'var(--msSideBySideH)', paddingLeft: 8, boxSizing: 'border-box' }
    : { flex: '0 0 50%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff', minHeight: 0 }

  // ── Media overlay effects ─────────────────────────────────────────────

  // 1. Reset position + fullscreen state when overlay is closed
  useEffect(() => {
    if (!mediaOverlay) {
      setMediaPos('video')
      setMediaIsFullscreen(false)
      if (typeof document !== 'undefined' && document.fullscreenElement)
        document.exitFullscreen?.().catch(() => {})
    }
  }, [mediaOverlay])

  // 2. Sync mediaIsFullscreen when native fullscreen exits (e.g. Escape key on desktop).
  //    We do NOT set true from here — toggleMediaFullscreen does that directly via setMediaIsFullscreen.
  useEffect(() => {
    const onFSChange = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        setMediaIsFullscreen(false)
      }
    }
    document.addEventListener('fullscreenchange', onFSChange)
    document.addEventListener('webkitfullscreenchange', onFSChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFSChange)
      document.removeEventListener('webkitfullscreenchange', onFSChange)
    }
  }, [])

  // 3. Measure the target element rect and keep it updated via ResizeObserver.
  //    Runs whenever mediaPos or mediaOverlay changes so the rect is current
  //    immediately after the user opens or moves the overlay.
  useEffect(() => {
    if (!mediaOverlay) { setOverlayRect(null); return }
    const target = (mediaPos === 'video' ? videoInnerRef : chatColRef).current
    if (!target) return
    const measure = () => {
      const r = target.getBoundingClientRect()
      if (r.width > 0 && r.height > 0)
        setOverlayRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    measure()
    let ro
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure)
      ro.observe(target)
    }
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, { passive: true })
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)
    }
  }, [mediaPos, mediaOverlay])

  // ── Media overlay helpers ─────────────────────────────────────────────
  function toggleMediaFullscreen() {
    const goingFullscreen = !mediaIsFullscreen
    // Primary: directly toggle CSS fullscreen — works on all devices including iOS Safari.
    // requestFullscreen is attempted as a bonus on desktop Chrome/Firefox but is not relied upon.
    setMediaIsFullscreen(goingFullscreen)
    if (goingFullscreen) {
      mediaOverlayRef.current?.requestFullscreen?.()?.catch?.(() => {})
    } else {
      if (document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {})
      else if (document.webkitFullscreenElement) document.webkitExitFullscreen?.()
    }
  }
  const mediaMoveToChat = mediaPos === 'video'
  const arrowGlyph = isMobileLandscape
    ? (mediaMoveToChat ? '\u2192' : '\u2190')  // → or ←
    : (mediaMoveToChat ? '\u2193' : '\u2191')  // ↓ or ↑
  const overlayPanelStyle = mediaIsFullscreen
    // CSS fullscreen: cover the entire viewport — works on all devices including iOS Safari.
    ? { position: 'fixed', inset: 0, background: '#000', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 20 }
    : overlayRect
      ? {
          position: 'fixed',
          top:    overlayRect.top    + overlayRect.height * 0.04,
          left:   overlayRect.left   + overlayRect.width  * 0.03,
          width:  overlayRect.width  * 0.94,
          height: overlayRect.height * 0.80,
          background: '#000',
          borderRadius: 10,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', zIndex: 20,
          boxShadow: '0 0 0 2px rgba(13,148,136,0.6)',
        }
      : null

  const isChatting = phase === PHASE.CHATTING

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden' }}>

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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isChatting && objectives.length > 0 && (
              <button
                type="button"
                onClick={() => setShowObjectives(true)}
                title="View learning objectives"
                style={{
                  ...headerBtn,
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: completedObj.length === objectives.length
                    ? 'rgba(13,148,136,0.45)'
                    : 'rgba(255,255,255,0.15)',
                }}
              >
                <span style={{ fontSize: 14 }}>&#9989;</span>
                <span style={{ fontSize: 12 }}>{completedObj.length}/{objectives.length}</span>
              </button>
            )}
            {isChatting && (
              <button type="button" onClick={handleBack} style={headerBtn}>
                &#8592; Lessons
              </button>
            )}
            {!isChatting && (
              <button type="button" onClick={handleExit} style={headerBtn}>
                &#8592; BACK
              </button>
            )}
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

            {/* Teacher video */}
            <video
              ref={videoRef}
              src="/media/webb-teacher.mp4"
              muted loop playsInline preload="auto"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
            />

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

            {/* Overlay buttons — bottom left: Video + Article (chatting phase) */}
            {isChatting && (
              <div style={{ position: 'absolute', bottom: 14, left: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, zIndex: 10 }}>
                {(videoLoading || articleLoading) && (
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', background: 'rgba(0,0,0,0.45)', borderRadius: 6, padding: '2px 7px', letterSpacing: '0.02em' }}>
                    Searching the web…
                  </span>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={handleVideoButtonClick}
                  aria-label="Watch a video"
                  title={videoLoading ? 'Loading video…' : videoResource ? 'Watch a video' : 'Loading video…'}
                  style={{ ...overlayBtnStyle, background: mediaOverlay === 'video' ? C.accent : '#1f2937', opacity: videoLoading ? 0.55 : 1 }}
                >
                  {videoLoading
                    ? <svg style={{ width: '55%', height: '55%', animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="28 8" /></svg>
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
                    ? <svg style={{ width: '55%', height: '55%', animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="28 8" /></svg>
                    : <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                  }
                </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Transcript / browser column */}
        <div ref={chatColRef} style={transcriptWrapperStyle}>

          {/* Completion toast — shown briefly after returning from a completed lesson */}
          {phase === PHASE.LIST && justCompletedLesson && (() => {
            // auto-dismiss after 4 s
            if (typeof window !== 'undefined') {
              setTimeout(() => setJustCompletedLesson(null), 4000)
            }
            return (
              <div style={{
                margin: '10px 12px 0',
                padding: '12px 16px',
                borderRadius: 14,
                background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                boxShadow: '0 4px 18px rgba(13,148,136,0.35)',
                display: 'flex', alignItems: 'center', gap: 12,
                animation: 'fadeInDown 0.3s ease',
              }}>
                <span style={{ fontSize: 24, lineHeight: 1 }}>🎉</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff', fontWeight: 800, fontSize: 13, marginBottom: 2 }}>
                    Lesson completed!
                  </div>
                  <div style={{ color: '#ccfbf1', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {justCompletedLesson}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setJustCompletedLesson(null)}
                  style={{ background: 'none', border: 'none', color: '#99f6e4', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}
                  aria-label="Dismiss"
                >×</button>
              </div>
            )
          })()}

          {/* Lesson browser (LIST and STARTING phases) */}
          {(phase === PHASE.LIST || phase === PHASE.STARTING) && !offerResume && !listLoading && (
            <WebbLessonBrowser
              availableLessons={availableLessons}
              allOwnedLessons={allOwnedLessons}
              recentSessions={recentSessions}
              historyLessons={historyLessons}
              listTab={listTab}
              setListTab={setListTab}
              ownedFilters={ownedFilters}
              setOwnedFilters={setOwnedFilters}
              listError={listError}
              setListError={setListError}
              onStart={selectLesson}
              learnerName={learnerName.current}
              starting={phase === PHASE.STARTING}
              webbCompletionMap={webbCompletionMap}
              listLoading={listLoading}
            />
          )}

          {/* Chat thread — iMessage-style bubbles */}
          {isChatting && (
            <div
              ref={transcriptRef}
              style={{
                flex: '1 1 0', minHeight: 0,
                overflowY: 'auto', overflowX: 'hidden',
                padding: '16px 12px 8px',
                display: 'flex', flexDirection: 'column', gap: 8,
                background: '#f9fafb',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {transcript.map((msg, i) => {
                const isUser = msg.role === 'user'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-end', gap: 7, flexDirection: isUser ? 'row-reverse' : 'row', padding: '0 2px' }}>
                    {!isUser && (
                      <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginBottom: 1 }} aria-hidden>&#128105;&#127995;&#8205;&#127979;</span>
                    )}
                    <div style={{
                      maxWidth: 'min(78%, 360px)',
                      background: isUser ? C.accent : '#ffffff',
                      color: isUser ? '#ffffff' : C.text,
                      borderRadius: isUser ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
                      padding: '9px 13px',
                      fontSize: 14, lineHeight: 1.55,
                      wordBreak: 'break-word',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.09)',
                      border: isUser ? 'none' : '1px solid #e5e7eb',
                    }}>
                      {msg.momentIdx != null ? (
                        <>
                          {msg.text}
                          {' '}
                          <button
                            type="button"
                            onClick={() => { const m = videoMoments[msg.momentIdx]; if (m) playSegment(m.startSeconds, m.endSeconds) }}
                            title="Replay this moment in the video"
                            style={{
                              display: 'inline',
                              background: 'none', border: 'none',
                              padding: '0 1px', margin: 0,
                              cursor: 'pointer', fontSize: 12, fontWeight: 700,
                              color: '#0d9488',
                              fontFamily: 'inherit', verticalAlign: 'baseline',
                              lineHeight: 'inherit',
                            }}
                          >&#9654;</button>
                        </>
                      ) : msg.passageIdx != null ? (
                        <>
                          {msg.text}
                          {' '}
                          <button
                            type="button"
                            onClick={() => scrollToPassage(msg.passageIdx)}
                            title="Jump to this passage in the article"
                            style={{
                              display: 'inline',
                              background: 'none', border: 'none',
                              padding: '0 1px', margin: 0,
                              cursor: 'pointer', fontSize: 13,
                              color: '#0d9488', textDecoration: 'underline',
                              fontFamily: 'inherit', verticalAlign: 'baseline',
                              lineHeight: 'inherit',
                            }}
                          >&#128205;</button>
                        </>
                      ) : msg.text}
                    </div>
                  </div>
                )
              })}
              {/* Typing indicator */}
              {chatLoading && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, padding: '0 2px' }}>
                  <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginBottom: 1 }} aria-hidden>&#128105;&#127995;&#8205;&#127979;</span>
                  <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '4px 18px 18px 18px', padding: '10px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.09)' }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {[0, 160, 320].map(d => (
                        <span key={d} style={{ display: 'block', width: 7, height: 7, borderRadius: '50%', background: '#9ca3af', animation: `webb-bounce 1s ease-in-out ${d}ms infinite` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} style={{ height: 1 }} />
            </div>
          )}
        </div>
      </div>

      {/* Footer: chat input */}
      {isChatting && (
        <div style={footerStyle}>
          {/* Write-essay strip — shown when all objectives are met */}
          {objectives.length > 0 && completedObj.length === objectives.length && (
            <div style={{ marginBottom: 10 }}>
              <button
                type="button"
                onClick={handleGenerateEssay}
                disabled={generatingEssay}
                style={{
                  width: '100%',
                  background: generatingEssay ? '#e5e7eb' : '#0d9488',
                  color: generatingEssay ? '#9ca3af' : '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 16px',
                  cursor: generatingEssay ? 'default' : 'pointer',
                  fontWeight: 800,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {generatingEssay ? '✍️ Writing your essay…' : '✨ Make my essay'}
              </button>
            </div>
          )}
          <StudentInput
            onSend={sendMessage}
            loading={chatLoading}
          />
        </div>
      )}

      {/* ── Portaled media overlay — position:fixed, moves between video/chat cols ── */}
      {isChatting && mediaOverlay && overlayPanelStyle && createPortal(
        <div ref={mediaOverlayRef} style={overlayPanelStyle}>

          {/* Toolbar */}
          <div style={{ background: 'rgba(15,118,110,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
              {mediaOverlay === 'video' ? '\u25B6 VIDEO' : '\uD83D\uDCD6 ARTICLE'}
              {mediaOverlay === 'article' && articleResource?.source && (
                <span style={{ opacity: 0.75, fontWeight: 400, marginLeft: 4 }}>\u00B7 {articleResource.source}</span>
              )}
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {/* Refresh */}
              <button type="button" onClick={() => refreshMedia(mediaOverlay)} disabled={refreshingMedia} title="Load a different one"
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, minWidth: 36, minHeight: 36, padding: '6px 10px', fontSize: 16, cursor: refreshingMedia ? 'wait' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {refreshingMedia ? '\u2026' : '\u21BB'}
              </button>
              {/* Interpret: play key moments (video only) — magnifying glass icon only */}
              {mediaOverlay === 'video' && videoResource?.videoId && !videoResource?.unavailable && (
                <button type="button" onClick={interpretVideo} disabled={interpretingVideo} title="Key part — play key moments"
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, minWidth: 36, minHeight: 36, padding: '6px 8px', cursor: interpretingVideo ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {interpretingVideo
                    ? <svg style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="28 8" /></svg>
                    : <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>
                  }
                </button>
              )}
              {/* Interpret: find + highlight + read key passage (article only) — magnifying glass + plus icon only */}
              {mediaOverlay === 'article' && articleResource?.html && (
                <button type="button" onClick={interpretArticle} disabled={interpretingArticle} title="Key part — highlights key sentences"
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, minWidth: 36, minHeight: 36, padding: '6px 8px', cursor: interpretingArticle ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {interpretingArticle
                    ? <svg style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="9" strokeDasharray="28 8" /></svg>
                    : <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                  }
                </button>
              )}
              {/* Move arrow — hidden in fullscreen */}
              {!mediaIsFullscreen && (
                <button type="button"
                  onClick={() => setMediaPos(p => p === 'video' ? 'chat' : 'video')}
                  title={mediaMoveToChat ? 'Move to conversation' : 'Move to video'}
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, minWidth: 36, minHeight: 36, padding: '6px 10px', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {arrowGlyph}
                </button>
              )}
              {/* Fullscreen toggle */}
              <button type="button" onClick={toggleMediaFullscreen} title={mediaIsFullscreen ? 'Exit fullscreen' : 'Full screen'}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, minWidth: 36, minHeight: 36, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {mediaIsFullscreen
                  ? <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>
                  : <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                }
              </button>
              {/* Close */}
              <button type="button" onClick={() => setMediaOverlay(null)} title="Close"
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, minWidth: 36, minHeight: 36, padding: '6px 10px', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {'\u2715'}
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>

            {/* ── VIDEO ── */}
            {mediaOverlay === 'video' && videoResource?.embedUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#000' }}>
                <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                  <iframe
                    ref={videoIframeRef}
                    src={videoResource.embedUrl + '&origin=' + encodeURIComponent(window.location.origin)}
                    title={videoResource.title || 'Educational video'}
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowFullScreen
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  />
                  {/* Intercept overlay — always blocks YouTube's native UI (links, recommendations).
                      Tapping anywhere on the video toggles play/pause. Uses a ref so the toggle
                      works even when iOS doesn't deliver IFrame API state-change messages. */}
                  {!videoEnded && (
                    <div
                      onClick={() => {
                        const wasPlaying = videoPlayingRef.current
                        videoPlayingRef.current = !wasPlaying
                        setVideoPlaying(!wasPlaying)
                        ytCmd(wasPlaying ? 'pauseVideo' : 'playVideo')
                      }}
                      style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'transparent', cursor: 'pointer' }}
                      aria-label={videoPlaying ? 'Pause' : 'Play'}
                    />
                  )}
                  {videoEnded && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, boxSizing: 'border-box' }}>
                      <div style={{ fontSize: 38 }}>&#127881;</div>
                      <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, textAlign: 'center' }}>
                        Great job watching!<br/>
                        <span style={{ fontSize: 13, fontWeight: 400, color: '#9ca3af' }}>{videoResource.title}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button type="button" onClick={() => { setVideoEnded(false); ytCmd('seekTo', [0, true]); ytCmd('playVideo') }}
                          style={{ background: '#374151', border: 'none', color: '#fff', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                        >&#8635; Replay</button>
                        <button type="button" onClick={() => { setVideoEnded(false); refreshMedia('video') }} disabled={refreshingMedia}
                          style={{ background: C.accent, border: 'none', color: '#fff', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: refreshingMedia ? 'wait' : 'pointer', fontFamily: 'inherit' }}
                        >{refreshingMedia ? '\u2026' : '\u25B6 Watch another'}</button>
                        <button type="button" onClick={() => setMediaOverlay(null)}
                          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#9ca3af', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                        >&#10005; Close</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Custom controls — replaces YouTube's native bar so children only see our UI */}
                {!videoEnded && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', background: '#111', flexShrink: 0, userSelect: 'none' }}>
                    <button type="button" onClick={() => {
                        const wasPlaying = videoPlayingRef.current
                        videoPlayingRef.current = !wasPlaying
                        setVideoPlaying(!wasPlaying)
                        ytCmd(wasPlaying ? 'pauseVideo' : 'playVideo')
                      }}
                      style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}
                      title={videoPlaying ? 'Pause' : 'Play'}>{videoPlaying ? '\u23F8' : '\u25B6'}</button>
                    <span style={{ color: '#9ca3af', fontSize: 11, minWidth: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatVideoTime(videoCurrentTime)}</span>
                    <input type="range" min={0} max={videoDuration || 100} value={videoCurrentTime} step={1}
                      onChange={e => { const t = Number(e.target.value); setVideoCurrentTime(t); ytCmd('seekTo', [t, true]) }}
                      style={{ flex: 1, accentColor: C.accent, cursor: 'pointer', height: 4 }} />
                    <span style={{ color: '#9ca3af', fontSize: 11, minWidth: 36, fontVariantNumeric: 'tabular-nums' }}>{formatVideoTime(videoDuration)}</span>
                    <button type="button" onClick={() => { videoVolumeMuted ? ytCmd('unMute') : ytCmd('mute'); setVideoVolumeMuted(m => !m) }}
                      style={{ background: 'none', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}
                      title={videoVolumeMuted ? 'Unmute' : 'Mute'}>{videoVolumeMuted ? '\uD83D\uDD07' : '\uD83D\uDD0A'}</button>
                  </div>
                )}
              </div>
            )}
            {/* Fallback: no YT key */}
            {mediaOverlay === 'video' && videoResource?.unavailable && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, padding: 20, background: '#0f0f0f', boxSizing: 'border-box', textAlign: 'center' }}>
                <svg viewBox="0 0 24 24" style={{ width: 44, height: 44 }} fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8l4 4-4 4"/></svg>
                <div style={{ color: '#9ca3af', fontSize: 13, lineHeight: 1.6, maxWidth: 220 }}>Video not available right now.<br/>Tap <strong style={{ color: '#fff' }}>\u21BB</strong> above to try a different one.</div>
                <button type="button" onClick={() => refreshMedia('video')} disabled={refreshingMedia}
                  style={{ background: C.accent, border: 'none', color: '#fff', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: refreshingMedia ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                  {refreshingMedia ? '\u2026' : '\u21BB Try another'}
                </button>
              </div>
            )}

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
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>Couldn&apos;t load the article.<br/>Tap below to try a different one.</div>
                <button type="button" onClick={() => refreshMedia('article')}
                  style={{ ...primaryBtn }}>
                  {'\u21BB'} Try another article
                </button>
              </div>
            )}
            {mediaOverlay === 'video' && !videoResource && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 13 }}>{'Generating\u2026'}</div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ── Settings overlay (tabbed: Settings | Article) ───────────── */}
      {showSourceSettings && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1001,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowSourceSettings(false)}
        >
          <div
            style={{
              background: '#0f172a',
              borderRadius: 18,
              width: 'min(92vw, 380px)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 0 0 2px #0d9488',
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              maxHeight: '80dvh',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 10px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
              <div style={{ color: '#0d9488', fontWeight: 800, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' }}>Settings</div>
              <button type="button" onClick={() => setShowSourceSettings(false)}
                style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#94a3b8', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 18, fontFamily: 'inherit' }}
                aria-label="Close">&#215;</button>
            </div>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
              {['settings', 'article'].map(tab => (
                <button key={tab} type="button"
                  onClick={() => setSettingsTab(tab)}
                  style={{
                    flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                    padding: '10px 0',
                    fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                    color: settingsTab === tab ? '#0d9488' : '#475569',
                    borderBottom: `2px solid ${settingsTab === tab ? '#0d9488' : 'transparent'}`,
                    textTransform: 'capitalize',
                    transition: 'color 0.15s',
                  }}
                >{tab === 'settings' ? 'Settings' : 'Article'}</button>
              ))}
            </div>
            {/* Tab body */}
            <div style={{ overflowY: 'auto' }}>
              {settingsTab === 'settings' && (
                <div>
                  {/* Restart Lesson */}
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b' }}>
                    <div style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Restart Lesson</div>
                    <div style={{ color: '#64748b', fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>Go back to the lesson list and start fresh. Your current conversation will be cleared.</div>
                    <button type="button"
                      onClick={() => {
                        setShowSourceSettings(false)
                        const k = snapKey(selectedLesson)
                        try { if (k) localStorage.removeItem(k) } catch {}
                        handleBack()
                      }}
                      style={{
                        background: '#be123c', color: '#fff', border: 'none',
                        borderRadius: 8, padding: '8px 18px', cursor: 'pointer',
                        fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
                      }}
                    >↺ Restart Lesson</button>
                  </div>
                </div>
              )}
              {settingsTab === 'article' && (
                <div>
                  {/* Source list */}
                  {[
                    { id: 'simple-wikipedia', label: 'Simple Wikipedia', note: 'Simple English — always works' },
                    { id: 'wikipedia',        label: 'Wikipedia',        note: 'Full English encyclopedia' },
                    { id: 'kiddle',          label: 'Kiddle',           note: 'Kid-safe encyclopedia' },
                    { id: 'ducksters',       label: 'Ducksters',        note: 'Kid-focused history & science' },
                    { id: 'wikijunior',      label: 'Wikijunior',       note: 'Wikibooks for young readers' },
                  ].map(src => {
                    const checked = articleSources.includes(src.id)
                    const toggle = () => {
                      setArticleSources(prev => {
                        const next = checked
                          ? prev.filter(id => id !== src.id)
                          : [...prev, src.id]
                        const safe = next.length ? next : [src.id]
                        try { localStorage.setItem('webb_article_sources', JSON.stringify(safe)) } catch {}
                        return safe
                      })
                    }
                    return (
                      <div key={src.id} style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '13px 20px',
                        borderBottom: '1px solid #1e293b',
                        cursor: 'pointer',
                      }} onClick={toggle}>
                        <div style={{
                          width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                          background: checked ? '#0d9488' : 'transparent',
                          border: `2px solid ${checked ? '#0d9488' : '#475569'}`,
                          display: 'grid', placeItems: 'center', transition: 'all 0.15s',
                        }}>
                          {checked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                        <div>
                          <div style={{ color: checked ? '#e2e8f0' : '#64748b', fontSize: 14, fontWeight: 600, transition: 'color 0.15s' }}>{src.label}</div>
                          <div style={{ color: '#475569', fontSize: 11, marginTop: 1 }}>{src.note}</div>
                        </div>
                      </div>
                    )
                  })}
                  <div style={{ padding: '12px 20px', color: '#475569', fontSize: 11, lineHeight: 1.5 }}>
                    Selected sources are tried in random order when you tap ↻ refresh on the article.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Resume / Restart overlay ─────────────────────────────────── */}
      {offerResume && createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            background: '#0f172a',
            borderRadius: 18,
            width: 'min(92vw, 360px)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 0 0 2px #0d9488',
            padding: '28px 24px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>👋</div>
            <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Welcome back!</div>
            <div style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              You were in the middle of{selectedLesson?.title ? <> <span style={{ color: '#e2e8f0', fontWeight: 600 }}>&ldquo;{selectedLesson.title}&rdquo;</span></> : ' a lesson'} with Mrs. Webb.<br/>
              Would you like to pick up where you left off?
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button type="button" onClick={handleResume}
                style={{
                  flex: 1, background: '#0d9488', color: '#fff', border: 'none',
                  borderRadius: 10, padding: '11px 0', cursor: 'pointer',
                  fontWeight: 800, fontSize: 15, fontFamily: 'inherit',
                }}
              >▶ Resume</button>
              <button type="button" onClick={handleRestartFromPrompt}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.07)', color: '#94a3b8',
                  border: '1px solid #334155',
                  borderRadius: 10, padding: '11px 0', cursor: 'pointer',
                  fontWeight: 700, fontSize: 15, fontFamily: 'inherit',
                }}
              >↺ Restart</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Objective tablet toast ──────────────────────────────────── */}
      {showObjectives && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => closeObjectivesPanel()}
        >
          <div
            style={{
              background: '#0f172a',
              borderRadius: 18,
              width: 'min(92vw, 400px)',
              maxHeight: '80dvh',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 0 0 2px #0d9488',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Panel header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px 12px',
              borderBottom: '1px solid #1e293b',
            }}>
              <div>
                <div style={{ color: '#0d9488', fontWeight: 800, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 }}>Learning Goals</div>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>{completedObj.length} of {objectives.length} completed</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {/* Gear button — settings */}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setSettingsTab('settings'); setShowSourceSettings(true) }}
                  title="Settings"
                  style={{
                    background: 'rgba(255,255,255,0.08)', border: 'none', color: '#94a3b8',
                    borderRadius: 8, width: 32, height: 32, cursor: 'pointer',
                    display: 'grid', placeItems: 'center',
                  }}
                  aria-label="Settings"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => closeObjectivesPanel()}
                  style={{
                    background: 'rgba(255,255,255,0.08)', border: 'none', color: '#94a3b8',
                    borderRadius: 8, width: 32, height: 32, cursor: 'pointer',
                    display: 'grid', placeItems: 'center', fontSize: 18, fontFamily: 'inherit',
                  }}
                  aria-label="Close"
                >&#215;</button>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ height: 4, background: '#1e293b', flexShrink: 0 }}>
              <div style={{
                height: '100%',
                width: `${objectives.length ? (completedObj.length / objectives.length) * 100 : 0}%`,
                background: '#0d9488',
                transition: 'width 0.4s ease',
                borderRadius: '0 2px 2px 0',
              }} />
            </div>
            {/* Objectives list — accordion */}
            <div style={{ overflowY: 'auto', padding: '8px 0 16px' }}>
              {objectives.map((obj, i) => {
                const done = completedObj.includes(i)
                const open = expandedObj === i
                return (
                  <div key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                    {/* Header row */}
                    <button
                      type="button"
                      onClick={() => setExpandedObj(open ? null : i)}
                      style={{
                        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '11px 20px',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{done ? '✅' : '⬜'}</span>
                      <span style={{
                        color: done ? '#e2e8f0' : '#64748b',
                        fontSize: 13, lineHeight: 1.5, flex: 1,
                        transition: 'color 0.3s',
                      }}>{obj}</span>
                      <span style={{ color: '#475569', fontSize: 11, flexShrink: 0, marginTop: 2 }}>{open ? '▲' : '▼'}</span>
                    </button>
                    {/* Expanded content */}
                    {open && (
                      <div style={{ padding: '0 20px 14px', paddingLeft: 46 }}>
                        {done ? (
                          <blockquote style={{
                            margin: 0,
                            borderLeft: '3px solid #0d9488',
                            paddingLeft: 12,
                            color: '#94a3b8',
                            fontStyle: 'italic',
                            fontSize: 13,
                            lineHeight: 1.6,
                          }}>
                            &ldquo;{objResponses[i] || '...'}&rdquo;
                          </blockquote>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startResearch(i)}
                            style={{
                              background: '#0d9488', color: '#fff', border: 'none',
                              borderRadius: 8, padding: '7px 16px', cursor: 'pointer',
                              fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
                            }}
                          >
                            📚 Research
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {/* Generate essay button — appears when all objectives complete */}
              {objectives.length > 0 && completedObj.length === objectives.length && (
                <div style={{ padding: '16px 20px 4px' }}>
                  <button
                    type="button"
                    onClick={handleGenerateEssay}
                    disabled={generatingEssay}
                    style={{
                      width: '100%', background: generatingEssay ? '#1e293b' : '#0d9488',
                      color: '#fff', border: 'none', borderRadius: 10,
                      padding: '11px 20px', cursor: generatingEssay ? 'default' : 'pointer',
                      fontWeight: 800, fontSize: 14, fontFamily: 'inherit',
                    }}
                  >
                    {generatingEssay ? '✍️ Writing your essay…' : '✨ Make my essay'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Essay full-screen overlay */}
      {essayMode && essay && createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: '#0f172a',
          overflowY: 'auto',
          padding: '28px 20px 48px',
        }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => setEssayMode(false)}
                style={{
                  background: 'rgba(255,255,255,0.08)', border: 'none', color: '#94a3b8',
                  borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                  fontSize: 13, fontFamily: 'inherit',
                }}
              >← Back</button>
              <div style={{ color: '#0d9488', fontWeight: 800, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                Your Essay
              </div>
              <div style={{ width: 60 }} />
            </div>
            {/* Headline */}
            <h2 style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 800, margin: '0 0 6px' }}>
              🎉 You did it!
            </h2>
            <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
              These are <em>your</em> words, put together into an essay.
              Copy it onto paper in your own handwriting!
            </p>
            {/* Essay text */}
            <div style={{
              background: '#1e293b',
              borderRadius: 16,
              padding: '24px 28px',
              fontSize: 16,
              lineHeight: 2,
              color: '#e2e8f0',
              whiteSpace: 'pre-wrap',
              boxShadow: '0 0 0 2px #0d9488',
              marginBottom: 28,
            }}>
              {essay}
            </div>
            {/* Copy-down instruction */}
            <div style={{
              background: '#0f2438',
              border: '1px dashed #0d9488',
              borderRadius: 12,
              padding: '16px 20px',
              color: '#94a3b8',
              fontSize: 13,
              lineHeight: 1.7,
            }}>
              ✏️ <strong style={{ color: '#e2e8f0' }}>Copy It Down!</strong><br />
              Write every word on lined paper — this helps your brain remember it!
              You can decorate the margins and add a title when you&apos;re done.
            </div>
            {/* Complete lesson button */}
            {(() => {
              const lk = selectedLesson?.lessonKey || selectedLesson?.lesson_id || selectedLesson?.id
              const alreadyDone = lk && webbCompletionMap[lk]?.completed
              return (
                <button
                  type="button"
                  onClick={() => { if (!alreadyDone) handleCompleteLesson() }}
                  style={{
                    marginTop: 20,
                    width: '100%',
                    background: alreadyDone ? '#1e293b' : '#0d9488',
                    color: alreadyDone ? '#94a3b8' : '#fff',
                    border: alreadyDone ? '1px solid #334155' : 'none',
                    borderRadius: 12,
                    padding: '14px 20px',
                    cursor: alreadyDone ? 'default' : 'pointer',
                    fontWeight: 800,
                    fontSize: 15,
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 20 }}>👩🏻‍🏫</span>
                  {alreadyDone ? 'Lesson Completed ✓' : 'Complete Lesson'}
                </button>
              )
            })()}
          </div>
        </div>,
        document.body
      )}

      {newlyCompletedObj && createPortal(
        <div style={{
          position: 'fixed',
          bottom: 80, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 999,
          width: 'min(88vw, 360px)',
          animation: 'webb-tablet-in 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
          pointerEvents: 'none',
        }}>
          {/* tablet frame */}
          <div style={{
            background: '#1a1a2e',
            borderRadius: 22,
            padding: '6px 8px 10px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.55), 0 0 0 2px #0d9488',
          }}>
            {/* camera notch */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
              <div style={{ width: 40, height: 6, borderRadius: 3, background: '#2d2d4e' }} />
            </div>
            {/* screen area */}
            <div style={{
              background: '#0f172a',
              borderRadius: 14,
              padding: '18px 20px 16px',
              border: '1px solid #1e40af',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 22 }}>✅</span>
                <span style={{ color: '#0d9488', fontWeight: 800, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' }}>Objective Complete</span>
              </div>
              <p style={{
                color: '#e2e8f0', fontSize: 13, lineHeight: 1.6,
                margin: 0, fontStyle: 'italic',
              }}>“{newlyCompletedObj.text}”</p>
              {/* completed tally */}
              <div style={{ marginTop: 12, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {objectives.map((_, i) => (
                  <div key={i} style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: completedObj.includes(i) ? '#0d9488' : '#374151',
                    transition: 'background 0.3s',
                  }} />
                ))}
              </div>
            </div>
            {/* home button row */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #374151', background: '#1a1a2e' }} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const overlayBtnStyle = {
  background: '#1f2937', color: '#fff', border: 'none',
  width: 'clamp(34px, 6.2vw, 52px)', height: 'clamp(34px, 6.2vw, 52px)',
  display: 'grid', placeItems: 'center',
  borderRadius: '50%', cursor: 'pointer',
  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  transition: 'background 0.2s',
}

const primaryBtn = {
  background: '#0d9488', color: '#fff', border: 'none',
  borderRadius: 8, padding: '10px 20px',
  fontSize: 14, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'inherit',
}

const headerBtn = {
  background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.35)',
  color: '#fff', borderRadius: 8, padding: '6px 14px',
  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}

const footerStyle = {
  flexShrink: 0, background: '#fff',
  borderTop: '1px solid #e5e7eb',
  padding: '10px 16px',
  paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
}

// ── WebbLessonBrowser ─────────────────────────────────────────────────────────
function WebbLessonBrowser({
  availableLessons, allOwnedLessons, recentSessions, historyLessons,
  listTab, setListTab, ownedFilters, setOwnedFilters,
  listError, setListError, onStart, learnerName, starting = false,
  webbCompletionMap = {}, listLoading = false,
}) {
  const getLk = l => l.lessonKey || l.lesson_id || `${l.subject || 'general'}/${l.file || ''}`

  const mergedMap = new Map(allOwnedLessons.map(l => [getLk(l), l]))
  Object.entries(historyLessons).forEach(([k, l]) => { if (!mergedMap.has(k)) mergedMap.set(k, l) })

  const completedKeys = new Set(recentSessions.map(s => s.lesson_id))
  const activeList = availableLessons.filter(l => !completedKeys.has(getLk(l)))
  const recentList = recentSessions.map(s => ({ session: s, lesson: mergedMap.get(s.lesson_id) }))

  const fullOwnedLessons = [...mergedMap.values()]
  const allSubjects = [...new Set(fullOwnedLessons.map(l => l.subject).filter(s => s && s !== 'generated'))].sort()
  const allGrades = [...new Set(fullOwnedLessons.map(l => l.grade).filter(v => v != null))].sort((a, b) => Number(a) - Number(b))
  const ownedList = fullOwnedLessons.filter(l => {
    if (ownedFilters.subject && l.subject !== ownedFilters.subject) return false
    if (ownedFilters.grade && String(l.grade) !== ownedFilters.grade) return false
    return true
  })

  const tabStyle = active => ({
    background: active ? C.accent : 'transparent',
    color: active ? '#fff' : C.muted,
    border: `1.5px solid ${active ? C.accent : C.border}`,
    borderRadius: 8, padding: '6px 16px',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', letterSpacing: 0.5, transition: 'all 0.15s',
  })

  const LessonCard = ({ lesson, dateLabel }) => {
    const lk = getLk(lesson)
    const done = completedKeys.has(lk)
    const webbDone = !!(webbCompletionMap[lk]?.completed)
    const subjectLabel = (lesson.subject || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const gradeLabel = lesson.grade ? `Grade ${lesson.grade}` : ''
    const diffLabel = lesson.difficulty ? lesson.difficulty.charAt(0).toUpperCase() + lesson.difficulty.slice(1) : ''
    return (
      <button
        type="button"
        onClick={() => onStart(lesson)}
        style={{
          background: '#fff', borderRadius: 12,
          border: `1.5px solid ${webbDone ? C.accent : done ? C.success : C.border}`,
          padding: '14px 16px', textAlign: 'left',
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12, width: '100%',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)', fontFamily: 'inherit',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            {webbDone && <span style={{ marginRight: 6 }}>👩🏻‍🏫</span>}
            {!webbDone && done && <span style={{ color: C.success, marginRight: 6 }}>&#10003;</span>}
            {lesson.title || lk}
          </div>
          <div style={{ color: C.muted, fontSize: 12 }}>
            {[subjectLabel, gradeLabel, diffLabel].filter(Boolean).join(' \u00b7 ')}
            {webbDone && <span style={{ color: C.accent, marginLeft: 8 }}>Essay complete</span>}
            {!webbDone && done && <span style={{ color: C.success, marginLeft: 8 }}>Completed</span>}
            {dateLabel && <span style={{ marginLeft: 8 }}>{dateLabel}</span>}
          </div>
        </div>
        <div style={{ color: C.accent, fontWeight: 800, fontSize: 20, flexShrink: 0 }}>&#9654;</div>
      </button>
    )
  }

  const RecentRow = ({ session, lesson }) => {
    const dateLabel = session.ended_at
      ? new Date(session.ended_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : ''
    if (lesson) return <LessonCard lesson={lesson} dateLabel={dateLabel} />
    return (
      <div style={{ background: '#f9fafb', border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', opacity: 0.6 }}>
        <div style={{ color: C.muted, fontSize: 13 }}>{session.lesson_id || '\u2014'}</div>
        {dateLabel && <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{dateLabel}</div>}
      </div>
    )
  }

  return (
    <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* Starting overlay */}
      {starting && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ color: C.accentDark, fontSize: 14, fontWeight: 600 }}>Starting lesson&hellip;</div>
        </div>
      )}

      {/* Controls strip */}
      <div style={{ flexShrink: 0, padding: '14px 14px 0', maxWidth: 680, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, color: C.accentDark, fontSize: 15 }}>
            {learnerName ? `Hi, ${learnerName}! \uD83D\uDC4B` : 'Welcome to Mrs. Webb!'}
          </div>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Choose a lesson to begin chatting.</div>
        </div>

        {listError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ color: C.danger, fontSize: 12 }}>{listError}</span>
            <button type="button" onClick={() => setListError('')} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>&#10005;</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={tabStyle(listTab === 'active')} onClick={() => setListTab('active')}>ACTIVE</button>
          <button type="button" style={tabStyle(listTab === 'recent')} onClick={() => setListTab('recent')}>
            RECENT{recentList.length > 0 ? ` (${recentList.length})` : ''}
          </button>
          <button type="button" style={tabStyle(listTab === 'owned')} onClick={() => setListTab('owned')}>
            OWNED{mergedMap.size > 0 ? ` (${mergedMap.size})` : ''}
          </button>
        </div>

        {listTab === 'owned' && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <select value={ownedFilters.subject} onChange={e => setOwnedFilters(f => ({ ...f, subject: e.target.value }))}
                style={{ background: '#fff', color: ownedFilters.subject ? C.text : C.muted, border: `1.5px solid ${C.border}`, borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                <option value=''>ALL SUBJECTS</option>
                {allSubjects.map(s => <option key={s} value={s}>{s.replace(/-/g, ' ').toUpperCase()}</option>)}
              </select>
              <select value={ownedFilters.grade} onChange={e => setOwnedFilters(f => ({ ...f, grade: e.target.value }))}
                style={{ background: '#fff', color: ownedFilters.grade ? C.text : C.muted, border: `1.5px solid ${C.border}`, borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                <option value=''>ALL GRADES</option>
                {allGrades.map(g => <option key={g} value={String(g)}>GRADE {g}</option>)}
              </select>
              {(ownedFilters.subject || ownedFilters.grade) && (
                <button type="button" onClick={() => setOwnedFilters({ subject: '', grade: '' })}
                  style={{ background: 'none', border: `1.5px solid ${C.border}`, borderRadius: 6, color: C.muted, fontSize: 12, cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' }}>
                  &#10005; CLEAR
                </button>
              )}
            </div>
            {mergedMap.size > 0 && <div style={{ color: C.muted, fontSize: 11 }}>{ownedList.length} of {mergedMap.size} lessons</div>}
          </div>
        )}
      </div>

      {/* Scrollable list */}
      <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: '12px 14px 24px', maxWidth: 680, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {listTab === 'active' && (
          listLoading
            ? (
              <div style={{ textAlign: 'center', marginTop: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <svg style={{ width: 28, height: 28, animation: 'spin 0.9s linear infinite', color: C.accent }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="9" strokeDasharray="28 8" />
                </svg>
                <span style={{ color: C.muted, fontSize: 13 }}>Loading lessons&hellip;</span>
              </div>
            )
            : availableLessons.length === 0
            ? <div style={{ textAlign: 'center', marginTop: 40, color: C.muted, fontSize: 14 }}>No lessons available yet.</div>
            : activeList.length === 0
              ? <div style={{ textAlign: 'center', marginTop: 40, color: C.success, fontSize: 14 }}>All lessons completed! Check RECENT or OWNED. &#10003;</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ color: C.muted, fontSize: 11, letterSpacing: 1, marginBottom: 4 }}>{activeList.length} LESSON{activeList.length !== 1 ? 'S' : ''} AVAILABLE</div>
                  {activeList.map((l, i) => <LessonCard key={getLk(l) || i} lesson={l} />)}
                </div>
        )}
        {listTab === 'recent' && (
          recentList.length === 0
            ? <div style={{ textAlign: 'center', marginTop: 40, color: C.muted, fontSize: 14 }}>No completed lessons yet.</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ color: C.muted, fontSize: 11, letterSpacing: 1, marginBottom: 4 }}>{recentList.length} COMPLETED LESSON{recentList.length !== 1 ? 'S' : ''}</div>
                {recentList.map((r, i) => <RecentRow key={r.session.id || i} session={r.session} lesson={r.lesson} />)}
              </div>
        )}
        {listTab === 'owned' && (
          ownedList.length === 0
            ? <div style={{ textAlign: 'center', marginTop: 40, color: C.muted, fontSize: 14 }}>NO LESSONS MATCH FILTERS</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ownedList.map((l, i) => <LessonCard key={getLk(l) || i} lesson={l} />)}
              </div>
        )}
      </div>
    </div>
  )
}

// ── StudentInput ──────────────────────────────────────────────────────────────
function StudentInput({ onSend, loading }) {
  const [value, setValue] = useState('')
  const ref = useRef(null)

  useEffect(() => { if (!loading) ref.current?.focus() }, [loading])

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