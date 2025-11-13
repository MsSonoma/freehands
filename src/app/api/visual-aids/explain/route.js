import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request) {
  try {
    const { imageUrl, description } = await request.json()

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      )
    }

    // Generate a new explanation using GPT-4 Vision
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are Ms. Sonoma, a warm and encouraging teacher for elementary students. Explain images in simple, clear language that a child can understand. Keep explanations to 2-3 short sentences. Be enthusiastic but calm. Focus on what the child can learn from the image.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: description 
                ? `This image is described as: "${description}". Please explain what's important about this image for the student to understand.`
                : 'Please explain what the student should notice and learn from this image.'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'low'
              }
            }
          ]
        }
      ],
      max_tokens: 150,
      temperature: 0.8
    })

    const explanation = response.choices[0]?.message?.content || 'I see something interesting here, but I need a moment to think about how to explain it.'

    return NextResponse.json({ explanation })
  } catch (error) {
    console.error('[API /visual-aids/explain] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate explanation', details: error.message },
      { status: 500 }
    )
  }
}
