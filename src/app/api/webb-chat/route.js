/**
 * /api/webb-chat
 * Mrs. Webb – AI conversation endpoint.
 * Maintains freeform chat about a lesson topic using GPT-4o-mini.
 * Safety-validates student input before forwarding.
 */
import { NextResponse } from 'next/server'
import { validateInput } from '@/lib/contentSafety'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

function buildSystem(lesson) {
  const title   = lesson?.title   || 'this topic'
  const subject = lesson?.subject || 'general'
  const grade   = lesson?.grade   ? `Grade ${lesson.grade}` : 'elementary/middle school'
  return [
    `You are Mrs. Webb, a warm, encouraging, and knowledgeable teacher.`,
    `You are currently helping a student explore: "${title}" (${subject}, ${grade}).`,
    `Your style:`,
    `- Friendly, patient, and age-appropriate.`,
    `- Ask what the student already knows; build on it.`,
    `- Keep replies short — 2 to 4 sentences — they are read aloud.`,
    `- Write in natural spoken language: no markdown, no bullet points.`,
    `- Gently redirect off-topic questions back to the lesson.`,
    `- Celebrate curiosity and effort.`,
  ].join('\n')
}

export async function POST(req) {
  try {
    const { messages = [], lesson = {} } = await req.json()

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
      { role: 'system', content: buildSystem(lesson) },
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
