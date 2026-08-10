/**
 * /api/sonoma-discussion
 * Ms. Sonoma – Discussion phase AI conversation endpoint.
 *
 * POST { action: 'overview', lesson, vocab, learnerName }
 *   → { text: string }  — opening overview TTS text
 *
 * POST { lesson, learnerName, messages, remainingObjectives, allObjectivesMet }
 *   → { text: string }  — next Ms. Sonoma chat reply
 */
import { NextResponse } from 'next/server'
import { validateInput } from '@/lib/contentSafety'
import { buildInstructionalLessonView } from '@/app/lib/masteryEvidence/assessmentIsolation.js'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
import { AI_MODEL } from '@/app/lib/aiModel'
const OPENAI_MODEL = AI_MODEL

// ── System prompt builders ─────────────────────────────────────────────────

function buildOverviewSystem(lesson, vocab = []) {
  const title   = lesson?.title   || 'this topic'
  const subject = lesson?.subject || 'general'
  const grade   = lesson?.grade   ? `Grade ${lesson.grade}` : 'elementary school'
  const vocabList = vocab.slice(0, 8).map(v => `${v.term}: ${v.definition}`).join('; ')

  const lines = [
    `You are Ms. Sonoma, a warm and knowledgeable teacher.`,
    `You are about to start a discussion about: "${title}" (${subject}, ${grade}).`,
    `Write a SHORT spoken introduction — 3 to 5 sentences — that:`,
    `1. Greets the student warmly by name and states the lesson topic.`,
    `2. Gives a brief, accessible overview of what the lesson covers in plain language.`,
    vocab.length
      ? `3. Briefly mentions the lesson covers important vocabulary you will review together.`
      : `3. Gets the student curious about the topic with an interesting fact or question.`,
    vocab.length
      ? `4. Closes with a natural transition into vocabulary — e.g. "Let's start with a few key words." or "First, let's go over some important terms." Do NOT say "let's talk" or invite the student to share thoughts yet.`
      : `4. Closes by saying you will now discuss the topic together and look forward to their thoughts.`,
    `Write in natural spoken language. No markdown, no bullet points. Aim for under 90 words.`,
  ]
  return lines.filter(Boolean).join('\n')
}

function buildChatSystem(lesson, remainingObjectives = [], allObjectivesMet = false, learnerName = 'student') {
  const title   = lesson?.title   || 'this topic'
  const subject = lesson?.subject || 'general'
  const grade   = lesson?.grade   ? `Grade ${lesson.grade}` : 'elementary school'
  const lines = [
    `You are Ms. Sonoma, a warm, encouraging, and knowledgeable teacher.`,
    `You are having a discussion with ${learnerName} about: "${title}" (${subject}, ${grade}).`,
    `Your style:`,
    `- Friendly, patient, and age-appropriate.`,
    `- Keep replies short — 2 to 4 sentences — they are read aloud.`,
    `- Write in natural spoken language: no markdown, no bullet points.`,
    `- Ask what the student already knows; build on it with Socratic questioning.`,
    `- Celebrate curiosity and effort.`,
    `- Never use the words "objective", "goal", "topic", "item", or "check". Sound warm and curious, not like a quiz.`,
    `- NEVER list, enumerate, or preview multiple things you will discuss. One idea at a time only.`,
  ]

  if (allObjectivesMet) {
    lines.push(
      `\nThe student has just demonstrated ALL of the lesson's learning goals — amazing work!`,
      `Your ONLY job in this response:`,
      `1. Celebrate warmly and specifically (1-2 sentences). Be genuinely excited for them.`,
      `2. Tell them it's now time to move on to the Exercise — use exactly the phrase "time for the Exercise".`,
      `3. Do NOT ask any question. The discussion is complete.`,
      `Keep it to 2-3 sentences. Natural spoken language — no markdown, no bullet points.`,
    )
    return lines.filter(Boolean).join('\n')
  }

  if (Array.isArray(remainingObjectives) && remainingObjectives.length) {
    lines.push(
      `\n--- TEACHER'S INTERNAL TEACHING MAP (CONFIDENTIAL — do NOT share with the student) ---`,
      `These are your private checkpoints. The student earns them by demonstrating understanding in their own words. They are NOT a syllabus to announce.`,
      `Current teaching priority (address one at a time, top to bottom):`,
      remainingObjectives.slice(0, 6).map((o, i) => `${i + 1}. ${o}`).join('\n'),
      `--- END INTERNAL MAP ---`,
      ``,
      `RULES — follow all of these strictly:`,
      `1. NEVER list, enumerate, preview, or hint at the above checkpoints to the student. Do not say "we'll cover", "we need to talk about", "topics include", or anything that reveals there's a list.`,
      `2. Focus ONLY on checkpoint #1 in this reply. Do not mention or allude to any others.`,
      `3. End your reply with ONE focused question that invites the student to explain checkpoint #1 in their own words.`,
      `4. If the student's last message already addresses checkpoint #1 (even partially), acknowledge it warmly and pivot your question toward checkpoint #2.`,
      `5. Bridge naturally: "That's interesting! Can you tell me more about..." or "Speaking of that, what do you know about..."`,
      `6. Never sound like a quiz. Sound warm, curious, and natural.`,
    )
  }

  return lines.filter(Boolean).join('\n')
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    action,
    lesson: rawLesson,
    vocab,
    learnerName,
    messages,
    remainingObjectives,
    allObjectivesMet,
  } = body
  const lesson = buildInstructionalLessonView(rawLesson)

  // ── Overview action ────────────────────────────────────────────────────────
  if (action === 'overview') {
    if (!lesson) {
      return NextResponse.json({ error: 'lesson required' }, { status: 400 })
    }

    const system = buildOverviewSystem(lesson, vocab || [])
    const nameHint = learnerName || 'student'

    try {
      const res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: `Generate the opening introduction for ${nameHint}.` },
          ],
          max_completion_tokens: 200,
          temperature: 0.75,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        console.error('[sonoma-discussion] OpenAI overview error:', json)
        return NextResponse.json({ error: 'OpenAI API error', detail: json }, { status: 502 })
      }
      const text = json.choices?.[0]?.message?.content?.trim() || ''
      return NextResponse.json({ text })
    } catch (err) {
      console.error('[sonoma-discussion] Overview fetch error:', err)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
  }

  // ── Chat action (default) ──────────────────────────────────────────────────
  if (!lesson || !Array.isArray(messages)) {
    return NextResponse.json({ error: 'lesson and messages required' }, { status: 400 })
  }

  // Validate last user message for safety
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
  if (lastUserMsg?.content) {
    const { safe, reason } = validateInput(lastUserMsg.content)
    if (!safe) {
      return NextResponse.json({ error: 'Message flagged', reason }, { status: 400 })
    }
  }

  const system = buildChatSystem(
    lesson,
    remainingObjectives || [],
    allObjectivesMet === true,
    learnerName || 'student',
  )

  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: 'system', content: system }, ...messages],
        max_completion_tokens: 160,
        temperature: 0.75,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      console.error('[sonoma-discussion] OpenAI chat error:', json)
      return NextResponse.json({ error: 'OpenAI API error', detail: json }, { status: 502 })
    }
    const text = json.choices?.[0]?.message?.content?.trim() || ''
    return NextResponse.json({ text })
  } catch (err) {
    console.error('[sonoma-discussion] Chat fetch error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
