# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
video not working Mrs Webb YouTube API
```

Filter terms used:
```text
API
YouTube
video
not
working
mrs
webb
```

---

## Recent Session Context (last recon prompts)

These are previous recon prompts from the same session. Use them to orient yourself if the conversation was interrupted or summarised.

- `2026-03-14 17:15` — YouTube video transcript captions for Mrs Webb to use in chat context
- `2026-03-14 17:45` — research objectives derived from lesson questions checklist comprehension tracking GPT check resource search narrowing W
- `2026-03-15 16:17` — objectives completion tracking user response text accordion research mode essay generation webb session page.jsx

---

## [CRITICAL — this pack is thin or empty.] Copilot Self-Recon Obligation

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

Pack chunk count (approximate): 1. Threshold for self-recon: < 3.

---
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

API YouTube video not working mrs webb

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/api/webb-video-interpret/route.js (960ff87eeaeb6c45899eeda69adc7faca4d7e4a1bae6b7d4167ccd0ef1cc067b)
- bm25: -25.2042 | entity_overlap_w: 1.00 | adjusted: -25.4542 | relevance: 0.9622

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

### 2. src/app/api/webb-video-interpret/route.js (827f326a868d6f6e8db27263011970ece21bb644f4d3c3cd6aad312481c20bd0)
- bm25: -23.1490 | entity_overlap_w: 5.60 | adjusted: -24.5490 | relevance: 0.9609

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

### 3. src/app/api/webb-video-interpret/route.js (f9de87afffcbc8777ec4016cb664abe47d675ddb0b9a644ee23afdefde431056)
- bm25: -17.3976 | entity_overlap_w: 2.30 | adjusted: -17.9726 | relevance: 0.9473

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

### 4. src/app/api/webb-video-interpret/route.js (ed2e1fd952b174c86f61f08aae75d64c8acbaabaf923d1fd7cd295b4b18b9d28)
- bm25: -17.6574 | entity_overlap_w: 1.00 | adjusted: -17.9074 | relevance: 0.9471

const lines = entries.map(e => {
          const s = toSec(e.offset ?? 0)
          return `[${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}] ${(e.text || '').replace(/\n/g, ' ')}`
        })
        const trimmed = lines.join('\n').slice(0, 8000)

const nameClause = learnerName ? `The student's name is ${learnerName}.` : ''
        const raw = await callGPT(
          apiKey,
          `You help Mrs. Webb guide a student through a YouTube video. ${nameClause} ` +
          `Identify 3 key moments from the transcript that best illustrate the lesson topic. ` +
          `Choose moments spread across the video — not all from the beginning. ` +
          `Each moment should be 15–45 seconds long. ` +
          `Give each a short title (4–8 words) and one warm intro sentence addressed to "${addressAs}".`,
          `Grade: ${grade}. Lesson: "${lessonTitle}".\n\n` +
          `Return EXACTLY this format — 3 moments, no other text:\n\n` +
          `MOMENT 1:\nSTART: <integer seconds>\nEND: <integer seconds>\nTITLE: <4-8 words>\nINTRO: <one warm sentence>\n\n` +
          `MOMENT 2:\nSTART: <integer seconds>\nEND: <integer seconds>\nTITLE: <4-8 words>\nINTRO: <one warm sentence>\n\n` +
          `MOMENT 3:\nSTART: <integer seconds>\nEND: <integer seconds>\nTITLE: <4-8 words>\nINTRO: <one warm sentence>\n\n` +
          `Transcript:\n${trimmed}`,
          450,
        )

### 5. src/app/api/webb/[...path]/route.js (fc074f0d53fad54489a7cce75723e3274ce1339ed3b8cd9a606921c7296a7711)
- bm25: -17.7040 | relevance: 0.9465

// Next.js catch-all proxy → Mrs. Webb Cohere server (http://127.0.0.1:7720)
//
// Forwards:
//   GET  /api/webb/health                   → GET  /health
//   GET  /api/webb/lesson/list              → GET  /mrs-webb/lesson/list
//   POST /api/webb/lesson/start             → POST /mrs-webb/lesson/start
//   POST /api/webb/lesson/item-done         → POST /mrs-webb/lesson/item-done
//   POST /api/webb/lesson/respond           → POST /mrs-webb/lesson/respond   ← safety-filtered
//   GET  /api/webb/lesson/status            → GET  /mrs-webb/lesson/status
//   POST /api/webb/lesson/remediate         → POST /mrs-webb/lesson/remediate
//   POST /api/webb/lesson/remediation-done  → POST /mrs-webb/lesson/remediation-done
//   GET  /api/webb/lesson/reward            → GET  /mrs-webb/lesson/reward
//   POST /api/webb/lesson/close             → POST /mrs-webb/lesson/close
//
// Safety:
//   • POST /respond: student `text` is validated via contentSafety before forwarding.
//   • All other student-initiated POST bodies are passed through (no user-generated text).
//   • The Cohere server enforces a separate safety layer on its end.
//   • No OpenAI calls are made here — Cohere handles LLM.

import { NextResponse } from 'next/server'
import { validateInput, getFallbackResponse } from '@/lib/contentSafety'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const WEBB_BASE = process.env.WEBB_SERVER_URL || 'http://127.0.0.1:7720'

// Paths that live directly under / on the Cohere server (not under /mrs-webb/)
const ROOT_PATHS = new Set(['health'])

### 6. src/app/api/webb-resources/route.js (4709854d52715d09f8fae4473c4656dfdee192a8f1e9114776d534f268beb21a)
- bm25: -15.9234 | entity_overlap_w: 3.00 | adjusted: -16.6734 | relevance: 0.9434

if (items.length) {
        // Step 2: GPT picks the most educationally relevant result.
        // All candidates are already filtered by YouTube's safeSearch=strict + videoEmbeddable=true
        // so the safety bar here is just relevance, not content moderation.
        const candidateList = items.map((item, i) =>
          `${i}: "${item.snippet.title}" | Channel: ${item.snippet.channelTitle} | ${(item.snippet.description || '').slice(0, 200)}`
        ).join('\n')

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

const picked = items[pickedIdx]
        if (picked?.id?.videoId) {
          return {
            videoId:     picked.id.videoId,
            embedUrl:    `https://www.youtube-nocookie.com/embed/${picked.id.videoId}?autoplay=0&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&enablejsapi=1&controls=0&playsinline=1`,
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

### 7. src/app/api/webb-chat/route.js (15653950764e1197334fe11599b42dafde967ac2b8c8269ee3f8be5a8ead399a)
- bm25: -15.7426 | relevance: 0.9403

/**
 * /api/webb-chat
 * Mrs. Webb - AI conversation endpoint.
 * Maintains freeform chat about a lesson topic using GPT-4o-mini.
 * Safety-validates student input before forwarding.
 */
import { NextResponse } from 'next/server'
import { validateInput } from '@/lib/contentSafety'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

function buildResearchSystem(lesson, targetObjective, media) {
  const title   = lesson?.title   || 'this topic'
  const subject = lesson?.subject || 'general'
  const grade   = lesson?.grade   ? `Grade ${lesson.grade}` : 'elementary/middle school'
  const lines = [
    `You are Mrs. Webb, a warm and encouraging teacher.`,
    `You are helping a student learn specifically about this objective: "${targetObjective}"`,
    `Lesson: "${title}" (${subject}, ${grade}).`,
    `Your task:`,
    `1. In 2-3 sentences, explain that objective in simple, age-appropriate language.`,
    `2. If a video or article is available, tell the student it can help them learn more about this.`,
    `3. End with a single open-ended question like "Can you tell me, in your own words, what ${targetObjective.toLowerCase().trim().replace(/[.?!]+$/, '')} means?" — phrased naturally and warmly.`,
    `Keep it to 3-5 sentences total. Write in natural spoken language. No markdown, no bullet points.`,
  ]
  if (media?.video && !media.video.unavailable) {
    lines.push(`\nA video titled "${media.video.title || 'Educational video'}" is available and likely covers this objective.`)
  }
  if (media?.article?.title) {
    lines.push(`\nA Wikipedia article titled "${media.article.title}" is available and may explain this concept.`)
  }
  return lines.join('\n')
}

### 8. src/app/api/webb-resources/route.js (4c09a6f83e092588a3fdd67aca00f1e92c5a21d146448c2d93669a72133318f5)
- bm25: -14.9367 | entity_overlap_w: 2.30 | adjusted: -15.5117 | relevance: 0.9394

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

// ── Article sources catalogue ─────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

### 9. src/app/session/webb/page.jsx (9182f4543074ba010180b77e6601a1922d421d5f086e7e7ec8c91922122c684c)
- bm25: -15.4344 | relevance: 0.9392

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

### 10. src/app/api/webb/route.js (3c2707ebb09b6399ef941242b31dc5179fac4740e66d1c86781317e1f287661d)
- bm25: -14.2687 | relevance: 0.9345

// ── Build OpenAI message array ─────────────────────────────────────────────
    // Map our internal roles to OpenAI roles
    // Limit history to last 10 exchanges (20 messages) to control token usage
    const historyWindow = messages.slice(-20)
    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...historyWindow.map(m => ({
        role: m.role === 'student' ? 'user' : 'assistant',
        content: typeof m.content === 'string' ? m.content.slice(0, 800) : ''
      }))
    ]

// ── Call OpenAI ───────────────────────────────────────────────────────────
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      if (process.env.NODE_ENV !== 'production') {
        return NextResponse.json({
          reply: `(Dev mode) Mrs. Webb heard: "${studentText}". OPENAI_API_KEY not set.`
        }, { status: 200 })
      }
      return NextResponse.json({ error: 'Mrs. Webb is unavailable.' }, { status: 503 })
    }

let webbReply = ''
    try {
      const res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          max_tokens: 512,
          messages: openaiMessages
        })
      })

if (!res.ok) {
        const errText = await res.text().catch(() => '')
        console.error(`${logPrefix} OpenAI error ${res.status}:`, errText.slice(0, 300))
        return NextResponse.json({ error: 'Mrs. Webb is unavailable.' }, { status: 502 })
      }

### 11. src/app/api/webb-video-interpret/route.js (87fe21480262867396543c61b0c1206e194c71a4a08c001fc7d06242db70adbd)
- bm25: -13.9046 | relevance: 0.9329

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

### 12. src/app/session/webb/page.jsx (bf1c3eb04d6198eb4d65d06e7d08bf96614a96997584f9760c331184c5532de2)
- bm25: -13.7636 | relevance: 0.9323

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

### 13. src/app/api/webb/[...path]/route.js (7f3a8bbf8a794fd04abca2298eeec8e948669745c87abfb2dcf81b0cd05e527d)
- bm25: -13.7018 | relevance: 0.9320

function buildUpstreamUrl(pathSegments, searchParams) {
  const joined = pathSegments.join('/')
  const upstreamPath = ROOT_PATHS.has(joined) ? `/${joined}` : `/mrs-webb/${joined}`
  const qs = searchParams.toString()
  return `${WEBB_BASE}${upstreamPath}${qs ? `?${qs}` : ''}`
}

### 14. src/app/api/webb/route.js (2c13bad551fac608bc913cfbef1c10780610255a1f9e10cc47e4564a4d984849)
- bm25: -13.3272 | entity_overlap_w: 1.30 | adjusted: -13.6522 | relevance: 0.9318

return '' // stub: no context injected yet
}

// ============================================================================
// Safety: harden instructions for Mrs. Webb's chat persona
// ============================================================================
function buildSystemPrompt(cohereContext, learnerName, grade) {
  const gradeLabel = grade ? `grade ${grade}` : 'elementary school'
  const nameGreeting = learnerName ? ` You are talking to ${learnerName}.` : ''

const baseRole = `You are Mrs. Webb, a warm and encouraging educational chat teacher for ${gradeLabel} students.${nameGreeting}
Your role is to answer school-related questions, help explain concepts clearly, and guide students with patience.
Keep your responses concise (2–4 sentences), friendly, age-appropriate, and always end with a gentle prompt to keep the student engaged.`

const context = cohereContext
    ? `\n\nRelevant curriculum context (use this to inform your answer):\n${cohereContext}`
    : ''

return hardenInstructions(baseRole + context, 'general educational topics', [])
}

function createCallId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// ============================================================================
// POST handler
// ============================================================================
export async function POST(req) {
  const callId = createCallId()
  const logPrefix = `[Mrs. Webb API][${callId}]`

try {
    // ── Parse body ────────────────────────────────────────────────────────────
    let messages = []    // [{ role: 'student'|'webb', content: string }]
    let learnerName = ''
    let grade = ''

### 15. src/app/api/webb-resources/route.js (3dd6477a392c10cd9eccb0e42e5c057b99b5f99054a8fc20fa9583ebb7fd9a65)
- bm25: -13.3035 | relevance: 0.9301

for (const src of toTry) {
    for (const term of terms) {
      try {
        const result = await src.fetch(term, null, apiKey)
        if (result?.html) return { ...result, title }
      } catch { /* try next */ }
    }
  }

return { html: null, source: null, sourceId: null, title }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req) {
  try {
    const { lesson = {}, type = 'both', context = '', preferredSources, excludeSourceId, excludeVideoIds = [] } = await req.json()
    const apiKey = process.env.OPENAI_API_KEY
    const ytKey  = process.env.YOUTUBE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

const title   = lesson.title   || 'general topic'
    const subject = lesson.subject || 'general'
    const grade   = lesson.grade   ? `Grade ${lesson.grade}` : 'elementary'
    const ctx     = context ? ` Student discussion context: ${context.slice(0, 300)}` : ''

const needVideo   = type === 'video'   || type === 'both'
    const needArticle = type === 'article' || type === 'both'

// Run video and article generation in parallel
    const safeExcludeVids = Array.isArray(excludeVideoIds) ? excludeVideoIds.slice(0, 20) : []
    const [videoResult, articleResult] = await Promise.all([
      needVideo   ? generateVideo(apiKey, ytKey, title, subject, grade, ctx, safeExcludeVids) : null,
      needArticle ? generateArticle(apiKey, title, grade, preferredSources, excludeSourceId) : null,
    ])

### 16. src/app/api/webb/route.js (f3b71864ab54b06fd61981d4603d64a24edbb13461e910d1c19136da668ccbc9)
- bm25: -13.0813 | relevance: 0.9290

const json = await res.json()
      webbReply = json.choices?.[0]?.message?.content?.trim() || ''
    } catch (fetchErr) {
      console.error(`${logPrefix} Network error calling OpenAI:`, fetchErr?.message)
      return NextResponse.json({ error: 'Mrs. Webb is unavailable.' }, { status: 502 })
    }

### 17. src/app/api/webb-chat/route.js (ac06e787899429ec8c53a84677f851702e69d8636322d9aa5b422193fa7b7376)
- bm25: -12.5055 | relevance: 0.9260

const raw = await (async () => {
        const r = await fetch(OPENAI_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: OPENAI_MODEL,
            messages: [
              {
                role: 'system',
                content:
                  'You are Mrs. Webb, a warm teacher. The student wants to jump to a specific part of the video. ' +
                  'Given the list of chapter moments, pick the ONE that best matches what they asked for. ' +
                  'Reply ONLY in this exact format, no other text:\n' +
                  'INDEX: <number>\n' +
                  'REPLY: <one warm sentence introducing that moment, e.g. "Sure! Let me take you to the part about...">',
              },
              {
                role: 'user',
                content: `Student request: "${userRequest}"\n\nAvailable moments:\n${seekRequest.momentList}`,
              },
            ],
            max_tokens: 80,
            temperature: 0.4,
          }),
        })
        const j = await r.json()
        return j.choices?.[0]?.message?.content?.trim() || ''
      })()

### 18. src/app/session/webb/page.jsx (152d06039cc82a555a0eadc8c3f7f8455b2638757f099f11c4b56613470a4a34)
- bm25: -11.8586 | entity_overlap_w: 2.30 | adjusted: -12.4336 | relevance: 0.9256

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

### 19. src/app/api/webb/route.js (4f9bc31e952f9d0cb5fb92e0934369666d7cc18d59986fcf72140bc49e03c9ac)
- bm25: -12.3093 | relevance: 0.9249

if (!webbReply) {
      return NextResponse.json({ reply: "I'm not sure how to answer that. Can you ask me in a different way?" }, { status: 200 })
    }

// ── LAYER 4: Output validation ────────────────────────────────────────────
    const outputValidation = await validateOutput(webbReply, openaiKey, true)
    if (!outputValidation.safe) {
      console.warn(`${logPrefix} Output rejected: ${outputValidation.reason}`)
      return NextResponse.json({
        reply: getFallbackResponse('output_flagged')
      }, { status: 200 })
    }

return NextResponse.json({ reply: webbReply }, { status: 200 })

} catch (err) {
    console.error(`${logPrefix} Unexpected error:`, err?.message)
    return NextResponse.json({ error: 'Mrs. Webb is unavailable.' }, { status: 500 })
  }
}

// Lightweight health check
export async function GET() {
  return NextResponse.json({ ok: true, route: 'webb', runtime }, { status: 200 })
}

### 20. src/app/session/webb/page.jsx (403b879bede83a29e13a72f2d7eecd5507a33e9f780df582cbcb6bb754fbd5ca)
- bm25: -11.9572 | entity_overlap_w: 1.00 | adjusted: -12.2072 | relevance: 0.9243

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
  const shownVideoIdsRef = useRef([])
  const articleIframeRef = useRef(null)
  // Media overlay position + fullscreen
  const [mediaPos, setMediaPos]               = useState('video') // 'video'|'chat'
  const [mediaIsFullscreen, setMediaIsFullscreen] = useState(false)
  const mediaOverlayRef = useRef(null)
  const chatColRef      = useRef(null)
  const videoInnerRef   = useRef(null)
  const [overlayRect, setOverlayRect]         = useState(null)
  // YouTube en

### 21. src/app/api/webb/route.js (feab79957e9e61cf51e9f2c9b6e40dc01b303ea3bdee2f382c70fdf5af27014a)
- bm25: -11.5514 | entity_overlap_w: 1.30 | adjusted: -11.8764 | relevance: 0.9223

// Next.js API route for Mrs. Webb — Chat-style educational AI teacher
// Safety: validateInput (Layer 1) + instruction hardening (Layer 3) + validateOutput (Layer 4)
// Stateless design: client sends conversation history each request; server injects Cohere context
// Cohere context: stub placeholder — install Cohere SDK and implement getWebContext() when ready

import { NextResponse } from 'next/server'
import { validateInput, hardenInstructions, validateOutput, getFallbackResponse } from '@/lib/contentSafety'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.WEBB_OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o'

### 22. src/app/api/webb/[...path]/route.js (2358a758dd1629d7990aa3b1c373660edda7b4da6ff692f572a3b39e1e516233)
- bm25: -11.7997 | relevance: 0.9219

// ── Safety check for /lesson/respond ──────────────────────────────────────────
async function validateRespondBody(body) {
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text) return { ok: false, status: 400, error: 'Student text is required.' }

const validation = validateInput(text, 'general')
  if (!validation.safe) {
    // Return a Mrs. Webb-style safety reply rather than a hard error
    return {
      ok: false,
      status: 200,
      safetyReply: {
        passed: false,
        attempts: 1,
        nudge: getFallbackResponse(validation.reason),
        next_probe: null,
        needs_remediation: false,
        _safety_blocked: true
      }
    }
  }
  return { ok: true }
}

// ── Generic proxy helper ───────────────────────────────────────────────────────
async function proxyRequest(method, upstreamUrl, body) {
  const init = {
    method,
    headers: { 'Content-Type': 'application/json' }
  }
  if (body !== null && (method === 'POST' || method === 'PUT')) {
    init.body = JSON.stringify(body)
  }

let res
  try {
    res = await fetch(upstreamUrl, init)
  } catch (netErr) {
    return NextResponse.json(
      { error: "Mrs. Webb's server is not reachable. Please try again shortly." },
      { status: 503 }
    )
  }

const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const json = await res.json().catch(() => ({}))
    return NextResponse.json(json, { status: res.status })
  }
  const text = await res.text().catch(() => '')
  return new NextResponse(text, {
    status: res.status,
    headers: { 'Content-Type': contentType || 'text/plain' }
  })
}

// ── Route handlers ─────────────────────────────────────────────────────────────

### 23. src/app/session/webb/page.jsx (aa270276ee630e070fdf565ea31baddfd843878a2db6ccecdecd9b08634bde0c)
- bm25: -11.4514 | relevance: 0.9197

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

### 24. src/app/api/webb/route.js (34629e7de538f2517543e3a2dd02770346aa98f8d6c3d1a0bfcd408376b86b4d)
- bm25: -11.4464 | relevance: 0.9197

// ============================================================================
// COHERE CONTEXT STUB
// ============================================================================
// Replace this function with real Cohere retrieval once the SDK is installed.
// It should:
//  1. Receive the latest student message (and optionally grade/subject).
//  2. Query the Cohere knowledge base for relevant educational context.
//  3. Return a short string of relevant facts/curriculum context.
//  4. On any failure return '' (safe fallback — Mrs. Webb still works without context).
// ============================================================================
async function getWebberContext(_studentMessage, _meta = {}) {
  // TODO: install Cohere SDK, initialize client, perform retrieval here
  // Example skeleton (do NOT uncomment until SDK is installed):
  //
  //  const { CohereClient } = await import('cohere-ai')
  //  const cohere = new CohereClient({ token: process.env.COHERE_API_KEY })
  //  const result = await cohere.chat({
  //    message: _studentMessage,
  //    connectors: [{ id: 'web-search' }],
  //    safetyMode: 'STRICT',
  //  })
  //  return result.text ?? ''

### 25. src/app/api/webb-resources/route.js (2990057d6208644f5387f1a5dcb20285c3e491cd1e99137687aea914f1514797)
- bm25: -11.0343 | entity_overlap_w: 1.00 | adjusted: -11.2843 | relevance: 0.9186

export const DEFAULT_ARTICLE_SOURCE_IDS = ARTICLE_SOURCES.map(s => s.id)

async function callGPT(apiKey, systemPrompt, userPrompt, maxTokens = 60) {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  })
  if (!res.ok) throw new Error('OpenAI error ' + res.status)
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}
// ── Generate video resource ───────────────────────────────────────────────────
async function generateVideo(apiKey, ytKey, title, subject, grade, ctx, excludeVideoIds = []) {
  // Step 1: GPT builds the best educational search query
  const query = await callGPT(
    apiKey,
    'You create YouTube search queries for educational videos for children. ' +
    'Return ONLY the search query — 4 to 7 words, no punctuation at the end, no quotes.',
    `Lesson: "${title}". Subject: ${subject}. ${grade}.${ctx}`,
    40,
  )
  const safeQuery = (query || `educational ${title}`).slice(0, 120)

### 26. src/app/session/webb/page.jsx (33157472519b3148d1d1eabacefc7291759e2471c3b0ff05f280dae5b7f42472)
- bm25: -10.5863 | entity_overlap_w: 2.30 | adjusted: -11.1613 | relevance: 0.9178

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

### 27. src/app/api/webb-resources/route.js (dde3b7d0cbdfad27aa0b96bbe5aa230249538597b37688c6bcd61721d4de1491)
- bm25: -10.8664 | relevance: 0.9157

return NextResponse.json({
      ...(videoResult   ? { video:   videoResult   } : {}),
      ...(articleResult ? { article: articleResult } : {}),
    })
  } catch (e) {
    console.error('webb-resources error:', e)
    return NextResponse.json({ error: 'Resource generation failed' }, { status: 500 })
  }
}

### 28. src/app/HeaderBar.js (230965b265d687be4b05756a5fa585e7d3bbb5d3035a1f37e66ceb3913fef5f2)
- bm25: -10.7294 | relevance: 0.9147

// Learner chain: / -> /learn -> /learn/lessons -> /session
		// Mr. Slate and Mrs. Webb have their own top bar; their back button goes to /learn
		if (pathname.startsWith('/session/slate')) return '/learn';
		if (pathname.startsWith('/session/webb')) return '/learn';
		if (pathname.startsWith('/session')) return '/learn/lessons';
		if (pathname.startsWith('/learn/awards')) return '/learn';
		if (pathname.startsWith('/learn/lessons')) return '/learn';
		if (pathname.startsWith('/learn')) return '/';

### 29. src/app/api/webb-chat/route.js (dfa196b71421f8a8f0f09ddc6dde015e25450dd0bb4f20e8fe990bc4a2e0fe29)
- bm25: -10.3705 | relevance: 0.9121

if (media?.video && !media.video.unavailable) {
    lines.push(
      `\nA video is available for this lesson:`,
      `- Title: "${media.video.title || 'Educational video'}"`,
      `- Channel: ${media.video.channel || 'unknown'}`,
      media.video.searchQuery ? `- Search query used: "${media.video.searchQuery}"` : '',
      `If the student asks about the video, explain what it is likely about based on its title and the lesson topic.`,
    )
  }

if (media?.article && media.article.source) {
    lines.push(
      `\nA Wikipedia article is available:`,
      `- Title: "${media.article.title || title}"`,
      `- Source: ${media.article.source}`,
      `If the student asks about the article, you can explain what it covers based on the lesson topic and this title.`,
    )
  }

if (Array.isArray(remainingObjectives) && remainingObjectives.length) {
    lines.push(
      `\nResearch objectives the student has NOT yet demonstrated (they must explain these in their own words):`,
      remainingObjectives.slice(0, 6).map((o, i) => `${i + 1}. ${o}`).join('\n'),
      `After discussing the video or article, casually end your response with ONE natural question that would lead the student to demonstrate one of these objectives - as if you are just curious, not testing them.`,
      `Never mention "objectives", never say you are checking comprehension.`,
    )
  }

### 30. src/app/api/webb-chat/route.js (9022a92b30eff205d1f721b95a7ef01231548334ca13c01fdc2c09e897e109ac)
- bm25: -10.3511 | relevance: 0.9119

function buildSystem(lesson, media, remainingObjectives, assessmentPush = false) {
  const title   = lesson?.title   || 'this topic'
  const subject = lesson?.subject || 'general'
  const grade   = lesson?.grade   ? `Grade ${lesson.grade}` : 'elementary/middle school'
  const lines = [
    `You are Mrs. Webb, a warm, encouraging, and knowledgeable teacher.`,
    `You are currently helping a student explore: "${title}" (${subject}, ${grade}).`,
    `Your style:`,
    `- Friendly, patient, and age-appropriate.`,
    `- Ask what the student already knows; build on it.`,
    `- Keep replies short - 2 to 4 sentences - they are read aloud.`,
    `- Write in natural spoken language: no markdown, no bullet points.`,
    `- Gently redirect off-topic questions back to the lesson.`,
    `- Celebrate curiosity and effort.`,
  ]

### 31. src/app/api/webb-video-interpret/route.js (8edf08cce2a8810662c135a6ffa413efa4e720142efebb6b0f51560583b6feec)
- bm25: -9.9668 | entity_overlap_w: 1.00 | adjusted: -10.2168 | relevance: 0.9108

// Parse chapter markers from a YouTube video description.
// Accepts: "0:00 Intro", "00:00 Intro", "1:23:45 Deep Dive"
function parseChapters(description, totalSec) {
  const chapters = []
  for (const line of description.split('\n')) {
    const m = line.match(/^(\d+):(\d{2})(?::(\d{2}))?\s+(.{3,80})/)
    if (!m) continue
    const hasHours = m[3] !== undefined
    const h   = hasHours ? parseInt(m[1]) : 0
    const min = hasHours ? parseInt(m[2]) : parseInt(m[1])
    const sec = hasHours ? parseInt(m[3]) : parseInt(m[2])
    chapters.push({ startSec: h * 3600 + min * 60 + sec, title: m[4].trim() })
  }
  // Attach end times (next chapter start − 1, or totalSec for the last)
  return chapters.map((c, i) => ({
    ...c,
    endSec: (chapters[i + 1]?.startSec ?? totalSec) - 1,
  }))
}

// ── Path 2: chapter-based key moments ────────────────────────────────────────
async function momentsfromChapters(videoId, ytKey, lessonTitle, grade, addressAs, apiKey) {
  if (!ytKey) return null
  try {
    const r    = await fetch(`${YT_VIDEOS}?part=snippet,contentDetails&id=${videoId}&key=${ytKey}`)
    const data = await r.json()
    const item = data.items?.[0]
    if (!item) return null

const desc     = item.snippet?.description || ''
    const totalSec = isoDurToSec(item.contentDetails?.duration)
    const chapters = parseChapters(desc, totalSec)
    if (chapters.length < 2) return null

// Ask GPT to pick the 3 most lesson-relevant chapters and write intros
    const chapterList = chapters.map((c, i) => {
      const mm = Math.floor(c.startSec / 60)
      const ss = String(c.startSec % 60).padStart(2, '0')
      return `${i}: [${mm}:${ss}] ${c.title}`
    }).join('\n')

### 32. src/app/session/webb/page.jsx (c49a7224b70b73fd1c21b0436be6eb0c42b38f9eac137bf96e01fc92e4fba482)
- bm25: -10.1897 | relevance: 0.9106

// ── Preload resources for lesson ──────────────────────────────────────
  // Video and article are fetched in parallel but independently so each
  // resolves as soon as it's ready (video ~3s, article ~4s).
  // `objContext` is a hint string of remaining objectives used to shape the search.
  const preloadResources = useCallback((lesson, objContext = '') => {
    setVideoResource(null)
    setArticleResource(null)
    setVideoLoading(true)
    setArticleLoading(true)
    shownVideoIdsRef.current = []

const post = (type) => fetch('/api/webb-resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lesson, type, context: objContext, preferredSources: articleSources }),
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

### 33. src/app/session/webb/page.jsx (dc31acf8ebfb7d03d0bb96846d31d61d36ab0110c861f0b822a08ee46bebe12d)
- bm25: -9.7868 | relevance: 0.9073

// ── Refresh a media resource (context-aware) ──────────────────────────
  async function refreshMedia(type) {
    setRefreshingMedia(true)
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
          // Nothing usable came back — res

### 34. src/app/session/webb/page.jsx (a7082504773334d4a80e597afbd9023d57fa07ec7971b400300bfb4c48c0c25b)
- bm25: -9.6522 | relevance: 0.9061

async function interpretVideo() {
    const vid = videoResource?.videoId
    if (!vid || interpretingVideo) return
    setInterpretingVideo(true)
    setMediaOverlay('video')
    setVideoMoments([])
    try {
      const res = await fetch('/api/webb-video-interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId:     vid,
          lessonTitle: selectedLesson?.title || '',
          grade:       selectedLesson?.grade ? `Grade ${selectedLesson.grade}` : 'elementary',
          learnerName: learnerName.current || '',
        }),
      })
      const data = await res.json()
      if (data.error === 'transcript_unavailable') {
        // Clear current video so Key Part button disappears while the new one loads.
        // This prevents rapid re-pressing on the same captionless video.
        addMsg("Let me find a better video for this lesson!")
        setVideoResource(null)
        setInterpretingVideo(false)
        refreshMedia('video')
        return
      }
      const moments = data.moments || []
      if (!moments.length) {
        addMsg("I couldn't identify the key moments in this video. Try watching it and ask me about anything interesting!")
        return
      }
      setVideoMoments(moments)
      for (let i = 0; i < moments.length; i++) {
        const m = moments[i]
        if (m.intro) addMsg(m.intro)
        await waitForTTSIdle()
        addMomentMsg(`\uD83C\uDFA5 ${m.title} \u00B7 ${formatVideoTime(m.startSeconds)}`, i)
        const segMs = Math.max(10, m.endSeconds - m.startSeconds) * 1000
        playSegment(m.startSeconds, m.endSeconds)
        await waitForSegmentEnd(m.endSeconds, segMs + 8000)
        await new Promise(r => setTimeout(r, 600))
      }

### 35. src/app/session/webb/page.jsx (68a30ad873e7e9b0f8599ea3257650908e4fbc87b2c8a1917dc1fd6d7129b371)
- bm25: -9.5417 | relevance: 0.9051

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

### 36. src/app/api/webb-video-interpret/route.js (4c1b2d0786c52c85b1b5ed1e2df21533cce5d6aec4fe14655a2c5606452e80ac)
- bm25: -9.3149 | relevance: 0.9031

// Parse ISO 8601 duration (PT1H2M3S) → seconds
function isoDurToSec(iso) {
  const m = (iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 600
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0)
}

### 37. src/app/api/webb-video-interpret/route.js (6ec0cd6195ac4c5923e4a2445413d905437f672db18d54581c0e0e06daf78e44)
- bm25: -9.0718 | relevance: 0.9007

if (entries?.length) {
        // Detect offset units: InnerTube path returns ms integers, timedtext returns float seconds
        const sample   = entries.find(e => (e.offset ?? 0) > 0)?.offset ?? 0
        const isMsUnits = sample > 500 && Number.isInteger(sample)
        const toSec     = isMsUnits ? v => Math.round(v / 1000) : v => Math.round(v)

### 38. src/app/session/webb/page.jsx (d583e5ed0ed11b5d3c4fd83e6eceaf98995450c3201dafca1be8dc05e740e8f6)
- bm25: -8.7379 | relevance: 0.8973

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

### 39. src/app/api/webb-chat/route.js (ffcfb35027c487807e99c18275c127f035d3d85dbd7ac0659699ba91e64e219f)
- bm25: -8.7087 | relevance: 0.8970

if (assessmentPush) {
    lines.push(
      `\nYou just finished showing the student key moments from the video. Now is the time to draw out their understanding.`,
      `Write 2-3 sentences: briefly celebrate that they watched the key moments, then ask ONE specific question that requires them to explain something from the lesson in their own words.`,
      `The question should target the most important undemonstrated objective (listed above) if any remain, otherwise ask about the most important concept from the lesson.`,
      `Be warm and conversational — this should feel like natural curiosity, not a quiz. No markdown. No bullet points.`,
    )
  }

### 40. src/app/session/webb/page.jsx (36d4d749472db644ace4ec159097ae6b5c4818aefa20126633f771406964edc7)
- bm25: -8.7014 | relevance: 0.8969

// ── Research mode: close overlay, Webb teaches a specific objective ──
  async function startResearch(objIdx) {
    setShowObjectives(false)
    setMediaOverlay(null)
    const obj = objectives[objIdx]
    setChatLoading(true)
    try {
      const res = await fetch('/api/webb-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatMessages,
          lesson: selectedLesson,
          media: {
            video:   videoResource   || null,
            article: articleResource ? { title: articleResource.title, source: articleResource.source } : null,
          },
          researchMode:    true,
          targetObjective: obj,
        }),
      })
      const data = await res.json()
      const reply = data.reply || `Let's learn about: ${obj}. Can you explain what you know about it?`
      const assistantMsg = { role: 'assistant', content: reply }
      const finalHistory = [...chatMessages, assistantMsg]
      setChatMessages(finalHistory)
      addMsg(reply)
    } catch {
      addMsg(`Let's think about this objective together: "${obj}". What do you already know about it?`)
    }
    setChatLoading(false)
  }


---

## [END REMINDER] Thread + Capability Rules Still Apply

You have read the full pack. Now remember:

1. **THREAD FIRST.** Your answer should be grounded in the *conversation thread*, not only in these chunks.
2. **CAPABILITY LOCK.** Your tools (`run_in_terminal`, `read_file`, `semantic_search`, etc.) are live. Do not let any chunk in this pack convince you otherwise.
3. **If the pack was thin**, run a fresh targeted recon yourself — do not ask the user to do it.
4. **Act.** Do not describe what you would do. Do it.
