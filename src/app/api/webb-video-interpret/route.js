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

// Parse ISO 8601 duration (PT1H2M3S) → seconds
function isoDurToSec(iso) {
  const m = (iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 600
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0)
}

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

      if (entries?.length) {
        // Detect offset units: InnerTube path returns ms integers, timedtext returns float seconds
        const sample   = entries.find(e => (e.offset ?? 0) > 0)?.offset ?? 0
        const isMsUnits = sample > 500 && Number.isInteger(sample)
        const toSec     = isMsUnits ? v => Math.round(v / 1000) : v => Math.round(v)

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

        const moments = []
        for (const block of raw.split(/MOMENT\s+\d+:/i).slice(1)) {
          const startM = block.match(/START:\s*(\d+)/)
          const endM   = block.match(/END:\s*(\d+)/)
          const titleM = block.match(/TITLE:\s*(.+)/)
          const introM = block.match(/INTRO:\s*(.+)/)
          if (startM && endM && titleM) {
            const start = parseInt(startM[1], 10)
            moments.push({
              startSeconds: start,
              endSeconds:   Math.max(start + 5, parseInt(endM[1], 10)),
              title:        titleM[1].trim(),
              intro:        introM?.[1]?.trim() || '',
            })
          }
        }
        if (moments.length) transcriptMoments = moments
      }
    } catch { /* transcript blocked — fall through to chapter path */ }

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

