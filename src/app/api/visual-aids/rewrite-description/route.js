import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'

export const dynamic = 'force-dynamic'

/**
 * POST /api/visual-aids/rewrite-description
 * Rewrite a user's basic description into kid-friendly educational language
 * Body: { description, lessonTitle }
 */
export async function POST(req) {
  try {
    const auth = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { description, lessonTitle } = body

    if (!description) {
      return NextResponse.json({ error: 'Missing description' }, { status: 400 })
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    const prompt = `You are an educational content writer specializing in kid-friendly explanations for elementary students (ages 6-12).

Rewrite the following basic image description into a clear, warm, engaging explanation that Ms. Sonoma (an AI tutor) can read aloud to a child during a lesson.

Lesson: ${lessonTitle || 'General lesson'}
Basic description: ${description}

Requirements:
- Use simple, age-appropriate language (6-12 year olds)
- Keep it warm and encouraging
- 2-3 short sentences maximum
- Focus on what the image shows and how it helps explain the concept
- No emojis or special characters
- Natural spoken tone (it will be read aloud)

Rewritten description:`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert educational content writer for elementary students.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 150
    })

    const rewritten = completion.choices[0]?.message?.content?.trim() || description

    return NextResponse.json({ 
      rewritten 
    })
    
  } catch (err) {
    console.error('[REWRITE_DESCRIPTION] Error:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
