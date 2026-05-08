import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { createClient } from '@supabase/supabase-js'
import { AI_MODEL } from '@/app/lib/aiModel'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/lesson-generate
 * Generate lesson content items using AI with full lesson context.
 * Body: { lesson, type }
 *   lesson — full lesson JSON object
 *   type   — 'vocab' | 'multiplechoice' | 'truefalse' | 'shortanswer' | 'fillintheblank'
 * Returns: { items: [...] }
 */
export async function POST(req) {
  try {
    const auth = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the user token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { lesson, type } = body

    if (!lesson || !type) {
      return NextResponse.json({ error: 'Missing lesson or type' }, { status: 400 })
    }

    const validTypes = ['vocab', 'multiplechoice', 'truefalse', 'shortanswer', 'fillintheblank']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `Invalid type: ${type}` }, { status: 400 })
    }

    // Strip large arrays from lesson context to keep prompt focused but readable
    const lessonContext = JSON.stringify(lesson, null, 2)

    const prompts = {
      vocab: {
        system: `You are an expert curriculum writer creating vocabulary for elementary school lessons.
Always return valid JSON as: {"items": [{"term": "...", "definition": "..."}, ...]}
Generate exactly 4 vocabulary terms unless the lesson already has many.`,
        user: `Given this lesson, generate 4 relevant vocabulary terms with clear, age-appropriate definitions that match the grade level and subject. Terms should be important to understanding this lesson's content.

LESSON:
${lessonContext}

Return ONLY a JSON object: {"items": [{"term": "...", "definition": "..."}, ...]}`,
      },

      multiplechoice: {
        system: `You are an expert curriculum writer creating multiple choice questions for elementary school lessons.
Always return valid JSON as: {"items": [{"question": "...", "choices": ["A text", "B text", "C text", "D text"], "correct": 0}, ...]}
"correct" is the 0-based index of the correct choice.`,
        user: `Given this lesson, generate 2 multiple choice questions with 4 answer choices each. Questions should test key concepts from the lesson content at the appropriate grade level.

LESSON:
${lessonContext}

Return ONLY a JSON object: {"items": [{"question": "...", "choices": ["choice 1", "choice 2", "choice 3", "choice 4"], "correct": 0}, ...]}`,
      },

      truefalse: {
        system: `You are an expert curriculum writer creating true/false questions for elementary school lessons.
Always return valid JSON as: {"items": [{"question": "...", "answer": true}, ...]}`,
        user: `Given this lesson, generate 3 true/false questions. Vary the answers (not all true or all false). Questions should test key facts and concepts from the lesson.

LESSON:
${lessonContext}

Return ONLY a JSON object: {"items": [{"question": "...", "answer": true}, ...]}`,
      },

      shortanswer: {
        system: `You are an expert curriculum writer creating short answer questions for elementary school lessons.
Always return valid JSON as: {"items": [{"question": "...", "expectedAny": ["answer1", "answer2"]}, ...]}
Include 2-3 acceptable answer variants per question.`,
        user: `Given this lesson, generate 2 short answer questions. Each should have 2-3 acceptable answer variants (students only need to match one). Questions should test understanding of key concepts at the appropriate grade level.

LESSON:
${lessonContext}

Return ONLY a JSON object: {"items": [{"question": "...", "expectedAny": ["answer1", "answer2"]}, ...]}`,
      },

      fillintheblank: {
        system: `You are an expert curriculum writer creating fill-in-the-blank questions for elementary school lessons.
Always return valid JSON as: {"items": [{"question": "...", "expectedAny": ["answer1"]}, ...]}
Use exactly _____ (5 underscores) for the blank. Include 1-2 acceptable answers per question.`,
        user: `Given this lesson, generate 2 fill-in-the-blank questions. Use _____ (exactly 5 underscores) to mark where the blank goes. Each question should have 1-2 acceptable answers.

LESSON:
${lessonContext}

Return ONLY a JSON object: {"items": [{"question": "The _____ is...", "expectedAny": ["answer1"]}, ...]}`,
      },
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: prompts[type].system },
        { role: 'user', content: prompts[type].user },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0]?.message?.content?.trim() || '{}'
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 })
    }

    const items = Array.isArray(parsed.items) ? parsed.items : []
    return NextResponse.json({ items })

  } catch (err) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
