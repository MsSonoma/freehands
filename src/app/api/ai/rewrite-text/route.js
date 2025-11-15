import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/rewrite-text
 * General-purpose AI text rewriting for various contexts
 * Body: { text, context, purpose }
 */
export async function POST(req) {
  try {
    const auth = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { text, context = '', purpose = 'general' } = body

    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 })
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    // Different prompts based on purpose
    const prompts = {
      'visual-aid-description': {
        system: 'You are an expert educational content writer for elementary students.',
        user: `You are an educational content writer specializing in kid-friendly explanations for elementary students (ages 6-12).

Rewrite the following basic image description into a clear, warm, engaging explanation that Ms. Sonoma (an AI tutor) can read aloud to a child during a lesson.

${context ? `Lesson context: ${context}` : ''}
Basic description: ${text}

Requirements:
- Use simple, age-appropriate language (6-12 year olds)
- Keep it warm and encouraging
- 2-3 short sentences maximum
- Focus on what the image shows and how it helps explain the concept
- No emojis or special characters
- Natural spoken tone (it will be read aloud)

Rewritten description:`
      },
      'visual-aid-prompt-from-notes': {
        system: 'You are an expert at creating visual aid generation prompts for educational content.',
        user: `Based on these teaching notes, create a concise prompt that will guide AI image generation to create helpful visual aids for this lesson.

Lesson: ${context || 'Educational lesson'}
Teaching Notes:
${text}

Create a prompt that will help generate 3 different educational illustrations. Focus on:
- Key concepts that would benefit from visual representation
- Style guidance (kid-friendly, colorful, clear, educational)
- What types of visuals would help explain the material (diagrams, examples, step-by-step, etc.)

Keep the prompt under 100 words. Make it specific enough to generate relevant images but flexible enough to allow variety.

Prompt:`
      },
      'generation-prompt': {
        system: 'You are an expert at crafting AI image generation prompts for educational content.',
        user: `Improve this image generation prompt to be more specific and effective for DALL-E 3.

${context ? `Context: ${context}` : ''}
Basic prompt: ${text}

Requirements:
- Be specific and descriptive
- Include style guidance (educational, kid-friendly, clear)
- Mention important details (diagrams, labels, colors if relevant)
- Keep it concise but detailed
- Focus on educational clarity
- No emojis or special formatting

Improved prompt:`
      },
      'general': {
        system: 'You are a helpful writing assistant.',
        user: `Improve and clarify the following text while maintaining its intent:

${context ? `Context: ${context}` : ''}
Original text: ${text}

Requirements:
- Keep it clear and concise
- Maintain the original meaning
- Improve grammar and flow
- Make it more professional/polished

Improved text:`
      }
    }

    const promptConfig = prompts[purpose] || prompts.general

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: promptConfig.system },
        { role: 'user', content: promptConfig.user }
      ],
      temperature: 0.7,
      max_tokens: purpose === 'visual-aid-prompt-from-notes' ? 200 : (purpose === 'generation-prompt' ? 200 : 150)
    })

    const rewritten = completion.choices[0]?.message?.content?.trim() || text

    return NextResponse.json({ 
      rewritten 
    })
    
  } catch (err) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
