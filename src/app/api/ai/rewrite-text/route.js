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
        system: 'You are an expert at creating prompts for educational image generation. You understand that AI-generated images with text are illegible and must be avoided.',
        user: `Based on these teaching notes, create a concise prompt that will guide AI image generation to create helpful illustrations for this lesson.

Lesson: ${context || 'Educational lesson'}
Teaching Notes:
${text}

Create a prompt that will help generate 3 different educational illustrations. Focus on:
- Key concepts shown through VISUAL scenes, objects, and actions (not text or labels)
- Style guidance (kid-friendly, colorful, simple, photographic or illustrated)
- What types of visuals would help (real-world examples, nature scenes, everyday objects, step-by-step actions)
- CRITICAL: Images must have NO text, words, labels, captions, or written language of any kind

Keep the prompt under 80 words. Make it specific enough to generate relevant images but flexible enough to allow variety. Emphasize visual-only representation.

Prompt:`
      },
      'generation-prompt': {
        system: 'You are an expert at crafting AI image generation prompts. You know that AI-generated text in images is gibberish and must be completely avoided.',
        user: `Improve this image generation prompt to be more specific and effective for DALL-E 3.

${context ? `Context: ${context}` : ''}
Basic prompt: ${text}

Requirements:
- Be specific and descriptive about visual elements (objects, colors, scenes, actions)
- Include style guidance (photographic, illustrated, kid-friendly, simple and clear)
- Focus on showing concepts through imagery, not through text or labels
- CRITICAL: The final image must contain NO text, words, letters, numbers, labels, captions, signs, or written language
- Suggest visual metaphors or real-world examples instead of diagrams with text
- Keep it concise but visually detailed

Improved prompt (emphasize visual-only elements):`
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
