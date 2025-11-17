import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * POST /api/normalize-lesson-title
 * 
 * Use GPT-4o-mini to convert user's conversational input into a clean lesson title
 */
export async function POST(request) {
  try {
    const { userInput, topicDescription, grade, subject, difficulty } = await request.json()
    
    if (!userInput) {
      return NextResponse.json(
        { error: 'userInput is required' },
        { status: 400 }
      )
    }
    
    // Build context for GPT
    const contextParts = []
    if (topicDescription) contextParts.push(`Topic: ${topicDescription}`)
    if (grade) contextParts.push(`Grade: ${grade}`)
    if (subject) contextParts.push(`Subject: ${subject}`)
    if (difficulty) contextParts.push(`Difficulty: ${difficulty}`)
    
    const contextString = contextParts.length > 0 
      ? `\n\nContext:\n${contextParts.join('\n')}` 
      : ''
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a lesson title normalizer. Convert user's conversational input into a clean, concise lesson title suitable for an educational lesson.

Rules:
- Output ONLY the title, nothing else
- Keep it short (2-6 words ideal)
- Use title case (capitalize major words)
- Remove filler words like "I need", "Can you make", "something about"
- Focus on the core topic or skill
- Make it classroom-appropriate and professional

Examples:
User: "I need another division practice. Long division."
Output: Long Division Practice

User: "fractions for beginners"
Output: Introduction to Fractions

User: "can you make a lesson about photosynthesis and plants"
Output: Photosynthesis in Plants

User: "the water cycle"
Output: The Water Cycle`
        },
        {
          role: 'user',
          content: `User's input: "${userInput}"${contextString}\n\nNormalized title:`
        }
      ],
      temperature: 0.3,
      max_tokens: 50
    })
    
    const title = completion.choices[0]?.message?.content?.trim() || userInput
    
    return NextResponse.json({ 
      title,
      usage: completion.usage
    })
    
  } catch (error) {
    console.error('[normalize-lesson-title] Error:', error)
    return NextResponse.json(
      { error: 'Failed to normalize title', details: error.message },
      { status: 500 }
    )
  }
}
