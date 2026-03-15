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

  if (assessmentPush) {
    lines.push(
      `\nYou just finished showing the student key moments from the video. Now is the time to draw out their understanding.`,
      `Write 2-3 sentences: briefly celebrate that they watched the key moments, then ask ONE specific question that requires them to explain something from the lesson in their own words.`,
      `The question should target the most important undemonstrated objective (listed above) if any remain, otherwise ask about the most important concept from the lesson.`,
      `Be warm and conversational — this should feel like natural curiosity, not a quiz. No markdown. No bullet points.`,
    )
  }

  return lines.filter(Boolean).join('\n')
}

export async function POST(req) {
  try {
    const { messages = [], lesson = {}, media = {}, remainingObjectives = [], assessmentPush = false, seekRequest = null, researchMode = false, targetObjective = '' } = await req.json()

    // ── Seek request: "show me the part where..." ─────────────────────────
    // Client sends { seekRequest: { momentList }, messages } instead of going through
    // the normal chat path. We ask GPT to pick the best matching moment index.
    if (seekRequest?.momentList) {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) return NextResponse.json({ error: 'OpenAI not configured' }, { status: 503 })

      const lastUser = [...messages].reverse().find(m => m.role === 'user')
      const userRequest = lastUser?.content || ''

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

      const idxMatch   = raw.match(/INDEX:\s*(\d+)/)
      const replyMatch = raw.match(/REPLY:\s*(.+)/)
      const idx        = idxMatch ? parseInt(idxMatch[1], 10) : -1
      const reply      = replyMatch?.[1]?.trim() || ''
      return NextResponse.json({ reply, seekMomentIdx: idx >= 0 ? idx : undefined })
    }

    // ── Research mode: teach a specific objective ─────────────────────────
    // Client sends { researchMode: true, targetObjective: string }.
    // Webb explains the objective and ends with a "say it in your own words" prompt.
    if (researchMode && targetObjective) {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) return NextResponse.json({ error: 'OpenAI not configured' }, { status: 503 })
      const sysContent = buildResearchSystem(lesson, targetObjective, media)
      const r = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [{ role: 'system', content: sysContent }],
          max_tokens: 180,
          temperature: 0.7,
        }),
      })
      if (!r.ok) return NextResponse.json({ error: 'AI unavailable' }, { status: 502 })
      const d = await r.json()
      const reply = d.choices?.[0]?.message?.content?.trim() || `Let me tell you about: ${targetObjective}. Can you explain it back to me in your own words?`
      return NextResponse.json({ reply })
    }

    // Safety-check the last user message
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    if (lastUser) {
      const check = validateInput(String(lastUser.content || ''), 'general')
      if (!check.safe) {
        return NextResponse.json({
          reply: "Let's keep our conversation focused on the lesson! What would you like to know?",
        })
      }
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI not configured' }, { status: 503 })
    }

    const oaiMessages = [
      { role: 'system', content: buildSystem(lesson, media, remainingObjectives, assessmentPush) },
      ...messages.map(m => ({ role: m.role, content: String(m.content || '') })),
    ]

    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: oaiMessages,
        max_tokens: 160,
        temperature: 0.75,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Webb-chat OpenAI error:', err)
      return NextResponse.json({ error: 'AI unavailable' }, { status: 502 })
    }

    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content?.trim() ||
      "That's a great question! What else would you like to know about this topic?"

    return NextResponse.json({ reply })
  } catch (e) {
    console.error('Webb-chat error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}