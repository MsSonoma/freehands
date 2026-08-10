/**
 * /api/sonoma-exercise
 * Ms. Sonoma – Exercise phase conversational endpoint.
 *
 * POST { action: 'ask', lesson, learnerName, question, questionIndex, totalQuestions }
 *   → { text }  — Ms. Sonoma asks the question conversationally
 *
 * POST { action: 'feedback', lesson, learnerName, question, correctAnswer,
 *        isCorrect, attemptNumber, isLastQuestion, userAnswer }
 *   → { text }  — Ms. Sonoma responds to the answer (praise / hint / reveal)
 */
import { NextResponse } from 'next/server'
import { validateInput } from '@/lib/contentSafety'
import { AI_MODEL } from '@/app/lib/aiModel'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = AI_MODEL

// ── Helpers ──────────────────────────────────────────────────────────────────

function lessonDesc(lesson) {
  const title   = lesson?.title   || 'this topic'
  const subject = lesson?.subject || 'general'
  const grade   = lesson?.grade   ? `Grade ${lesson.grade}` : 'elementary school'
  return `"${title}" (${subject}, ${grade})`
}

function buildQuestionPrompt(q) {
  const text = q?.question || q?.text || ''
  const type = q?.type || 'mc'
  const opts = Array.isArray(q?.options) ? q.options : []
  const anyLabel = /^\s*\(?[A-Z]\)?\s*[.:\)\-]\s*/i
  const labels   = ['A', 'B', 'C', 'D', 'E']

  if (type === 'tf') {
    return `Type: True/False\nQuestion: ${text}`
  }
  if (opts.length > 0) {
    const formatted = opts.slice(0, 4).map((o, i) => {
      const clean = String(o ?? '').trim().replace(anyLabel, '').trim()
      return `(${labels[i]}) ${clean}`
    }).join(', ')
    return `Type: Multiple Choice\nQuestion: ${text}\nOptions: ${formatted}`
  }
  return `Type: Short Answer\nQuestion: ${text}`
}

function buildFeedbackUserContent(question, correctAnswer, userAnswer, isCorrect, attemptNumber) {
  const qText = question?.question || question?.text || ''
  const lines = [`Question: ${qText}`]
  if (userAnswer) lines.push(`Student answered: "${userAnswer}"`)
  if (isCorrect) {
    lines.push('The student answered CORRECTLY.')
  } else if (attemptNumber >= 3) {
    lines.push(`The student answered INCORRECTLY for the third time. Correct answer: "${correctAnswer}"`)
  } else {
    lines.push(`The student answered INCORRECTLY (attempt ${attemptNumber}).`)
  }
  return lines.join('\n')
}

// ── System prompt builders ────────────────────────────────────────────────────

function buildAskSystem(lesson, learnerName, questionIndex, totalQuestions) {
  const isFirst = questionIndex === 0
  return [
    `You are Ms. Sonoma, a warm and encouraging teacher.`,
    `You are helping ${learnerName || 'a student'} practice ${lessonDesc(lesson)}.`,
    `You will be given an exercise question. Your job:`,
    isFirst
      ? `1. Start with a brief warm-up intro (1 short sentence) like "Let's put your knowledge to the test!" or "Time to practice!"`
      : `1. Use a short natural transition phrase like "Here's your next question:", "Let's try another:", or "Ready for the next one?"`,
    `2. Ask the question naturally — as if talking to a student face to face.`,
    `3. For multiple choice: after the question, list the options conversationally, e.g. "(A) …, (B) …, (C) …, or (D) …?"`,
    `4. For true/false: say "True or false:" before the question.`,
    `5. For short answer: just ask the question naturally.`,
    `Keep it SHORT — 2 to 3 sentences total. No markdown. Natural spoken language.`,
    `This is question ${questionIndex + 1} of ${totalQuestions}.`,
  ].join('\n')
}

function buildFeedbackSystem(lesson, learnerName, isCorrect, attemptNumber, isLastQuestion) {
  const lines = [
    `You are Ms. Sonoma, a warm and encouraging teacher.`,
    `You are helping ${learnerName || 'a student'} practice ${lessonDesc(lesson)}.`,
    `Keep replies SHORT — 1 to 3 sentences — they are read aloud. No markdown. Natural spoken language.`,
  ]

  if (isCorrect) {
    if (isLastQuestion) {
      lines.push(
        `The student just answered the LAST exercise question CORRECTLY. Celebrate warmly!`,
        `1. Express genuine excitement (1-2 sentences). Be specific.`,
        `2. Tell them the exercise is now complete. Do NOT ask another question.`,
      )
    } else {
      lines.push(
        `The student answered CORRECTLY.`,
        `Give a short, genuine praise (1 sentence) — vary your expressions, be enthusiastic.`,
        `Then a very brief natural bridge to signal the next question is coming.`,
        `Examples: "That's right! Here comes the next one." / "Exactly! Ready for more?" / "Correct! Let's keep going."`,
        `Keep it to 1-2 sentences. Do NOT ask the next question yourself.`,
      )
    }
  } else if (attemptNumber === 1) {
    lines.push(
      `The student answered INCORRECTLY on their first try.`,
      `1. Be gently encouraging — do NOT say "wrong", "incorrect", or "that's not right".`,
      `2. Give a subtle, helpful hint that nudges them toward the correct answer without giving it away.`,
      `3. Invite them to try again in a warm way.`,
    )
  } else if (attemptNumber === 2) {
    lines.push(
      `The student answered INCORRECTLY on their second try — this is getting tricky.`,
      `1. Acknowledge it's a tough one. Stay warm and supportive.`,
      `2. Give a stronger, more direct hint — still not revealing the answer, but clearly pointing toward it.`,
      `3. Encourage one more try.`,
    )
  } else {
    // 3rd wrong — reveal
    lines.push(
      `The student has answered incorrectly 3 times. Time to gently reveal the correct answer.`,
      `1. Let them know it's okay — this was a tricky one.`,
      `2. State the correct answer clearly (it is provided in the user message).`,
      `3. Give a very brief, encouraging explanation if helpful.`,
      `2-3 sentences max.`,
    )
  }

  return lines.filter(Boolean).join('\n')
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

  let body
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    action,
    lesson,
    learnerName,
    question,
    questionIndex,
    totalQuestions,
    correctAnswer,
    isCorrect,
    attemptNumber,
    isLastQuestion,
    userAnswer,
  } = body

  // ── Ask action ────────────────────────────────────────────────────────────
  if (action === 'ask') {
    if (!question) return NextResponse.json({ error: 'question required' }, { status: 400 })

    const system       = buildAskSystem(lesson, learnerName, questionIndex || 0, totalQuestions || 1)
    const questionText = buildQuestionPrompt(question)

    try {
      const res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user',   content: `Ask this exercise question: ${questionText}` },
          ],
          max_completion_tokens: 150,
          temperature: 0.75,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        console.error('[sonoma-exercise] OpenAI ask error:', json)
        return NextResponse.json({ error: 'OpenAI API error', detail: json }, { status: 502 })
      }
      return NextResponse.json({ text: json.choices?.[0]?.message?.content?.trim() || '' })
    } catch (err) {
      console.error('[sonoma-exercise] Ask fetch error:', err)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
  }

  // ── Feedback action ───────────────────────────────────────────────────────
  if (action === 'feedback') {
    // Validate learner input for safety
    if (userAnswer) {
      const { safe, reason } = validateInput(String(userAnswer))
      if (!safe) return NextResponse.json({ error: 'Message flagged', reason }, { status: 400 })
    }

    const system      = buildFeedbackSystem(lesson, learnerName, !!isCorrect, attemptNumber || 1, !!isLastQuestion)
    const userContent = buildFeedbackUserContent(question, correctAnswer, userAnswer, isCorrect, attemptNumber)

    try {
      const res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user',   content: userContent },
          ],
          max_completion_tokens: 120,
          temperature: 0.8,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        console.error('[sonoma-exercise] OpenAI feedback error:', json)
        return NextResponse.json({ error: 'OpenAI API error', detail: json }, { status: 502 })
      }
      return NextResponse.json({ text: json.choices?.[0]?.message?.content?.trim() || '' })
    } catch (err) {
      console.error('[sonoma-exercise] Feedback fetch error:', err)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
