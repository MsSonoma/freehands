/**
 * /api/webb-video-interpret
 * Fetches YouTube captions and uses GPT to identify 3 key moments
 * with timestamps that Mrs. Webb can seek to and replay.
 *
 * POST { videoId, lessonTitle, grade, learnerName? }
 * Returns { moments: [{ title, startSeconds, endSeconds, intro }] }
 *       | { error: 'transcript_unavailable' }
 */
import { NextResponse }      from 'next/server'
import { YoutubeTranscript } from 'youtube-transcript'

const OPENAI_URL   = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

export async function POST(req) {
  try {
    const {
      videoId     = '',
      lessonTitle = '',
      grade       = 'elementary',
      learnerName = '',
    } = await req.json()

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey)  return NextResponse.json({ error: 'Not configured'         }, { status: 503 })
    if (!videoId) return NextResponse.json({ error: 'No videoId'             }, { status: 400 })

    // ── Fetch transcript ───────────────────────────────────────────────────
    let entries
    try {
      entries = await YoutubeTranscript.fetchTranscript(videoId)
    } catch {
      return NextResponse.json({ error: 'transcript_unavailable' })
    }
    if (!entries?.length) return NextResponse.json({ error: 'transcript_unavailable' })

    // Detect units: InnerTube XML path returns ms-like integers (t="4500"),
    // the fallback timedtext path returns seconds as floats (start="4.5").
    const sampleOffset = entries.find(e => (e.offset ?? 0) > 0)?.offset ?? 0
    const isMsUnits    = sampleOffset > 500 && Number.isInteger(sampleOffset)
    const toSec        = isMsUnits ? (v) => Math.round(v / 1000) : (v) => Math.round(v)

    // Build timestamped text for GPT (trim to ~8 000 chars)
    const lines = entries.map(e => {
      const sec = toSec(e.offset ?? 0)
      const m   = Math.floor(sec / 60)
      const s   = (sec % 60).toString().padStart(2, '0')
      return `[${m}:${s}] ${(e.text || '').replace(/\n/g, ' ')}`
    })
    const trimmed = lines.join('\n').slice(0, 8000)

    // ── Ask GPT for key moments ────────────────────────────────────────────
    const nameClause = learnerName ? `The student's name is ${learnerName}.` : ''
    const addressAs  = learnerName ? learnerName : 'you'

    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content:
              `You help Mrs. Webb, an AI teacher, guide a student through a YouTube video. ` +
              `${nameClause} ` +
              `Identify 3 key moments from the transcript that best illustrate the lesson topic. ` +
              `Choose moments spread across the video — not all from the beginning. ` +
              `Each moment should be 15–45 seconds long. ` +
              `Give each moment a short descriptive title (4–8 words) and one warm intro sentence ` +
              `Mrs. Webb says to introduce it, addressing the student as "${addressAs}".`,
          },
          {
            role: 'user',
            content:
              `Grade: ${grade}. Lesson: "${lessonTitle}".\n\n` +
              `Return EXACTLY this format — 3 moments, no other text:\n\n` +
              `MOMENT 1:\nSTART: <integer seconds>\nEND: <integer seconds>\nTITLE: <4-8 words>\nINTRO: <one warm sentence>\n\n` +
              `MOMENT 2:\nSTART: <integer seconds>\nEND: <integer seconds>\nTITLE: <4-8 words>\nINTRO: <one warm sentence>\n\n` +
              `MOMENT 3:\nSTART: <integer seconds>\nEND: <integer seconds>\nTITLE: <4-8 words>\nINTRO: <one warm sentence>\n\n` +
              `Transcript:\n${trimmed}`,
          },
        ],
        max_tokens: 450,
        temperature: 0.3,
      }),
    })
    const json = await res.json()
    const raw  = json.choices?.[0]?.message?.content || ''

    // ── Parse GPT response ─────────────────────────────────────────────────
    const moments = []
    const blocks  = raw.split(/MOMENT\s+\d+:/i).slice(1)
    for (const block of blocks) {
      const startM = block.match(/START:\s*(\d+)/)
      const endM   = block.match(/END:\s*(\d+)/)
      const titleM = block.match(/TITLE:\s*(.+)/)
      const introM = block.match(/INTRO:\s*(.+)/)
      if (startM && endM && titleM) {
        const start = parseInt(startM[1], 10)
        const end   = parseInt(endM[1],   10)
        moments.push({
          startSeconds: start,
          endSeconds:   Math.max(start + 5, end),
          title:        titleM[1].trim(),
          intro:        introM?.[1]?.trim() || '',
        })
      }
    }

    return NextResponse.json({ moments })
  } catch (e) {
    console.error('[webb-video-interpret]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
