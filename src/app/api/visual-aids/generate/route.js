import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/visual-aids/generate
 * Generate visual aid images using OpenAI DALL-E 3 based on lesson teaching notes
 * Body: { teachingNotes, count }
 * Returns: { images: [{ url, prompt }] }
 */
export async function POST(req) {
  try {
    // Authenticate user
    const auth = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    const supabase = createClient(url, anon, { 
      global: { headers: { Authorization: `Bearer ${token}` } }, 
      auth: { persistSession: false } 
    })
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { teachingNotes, lessonTitle, customPrompt, count = 3 } = body

    if (!teachingNotes) {
      return NextResponse.json({ error: 'Teaching notes are required' }, { status: 400 })
    }

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    // Generate images in parallel to avoid timeout
    // Helper function to generate a single image
    async function generateSingleImage(index) {
      try {
        // Create a kid-friendly, educational image prompt
        const promptRequest = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You create image prompts for educational illustrations. Describe scenes, objects, characters, and actions that visually represent lesson concepts. CRITICAL RULES: 1) NEVER include text, words, letters, labels, captions, signs, writing, numbers, or any written language in your descriptions. 2) Describe only visual elements like colors, shapes, objects, people, animals, and scenery. 3) Use phrases like "a colorful scene showing" or "an illustration of" rather than "diagram" or "chart". Keep under 80 words. Make images cheerful, simple, and age-appropriate for elementary students.'
              },
              {
                role: 'user',
                content: customPrompt 
                  ? `Create an educational illustration prompt based on:\n\n${customPrompt}\n\nLesson: ${lessonTitle || 'Educational Lesson'}\nConcepts: ${teachingNotes}\n\nDescribe a visual scene with objects and actions only - absolutely no text or labels in the image.`
                  : `Create an educational illustration prompt for this lesson:\n\nLesson: ${lessonTitle || 'Educational Lesson'}\nConcepts: ${teachingNotes}\n\nDescribe image #${index + 1}: Show a scene with objects, people, or nature that represents a key concept. Use only visual elements - no text, labels, or words anywhere in the image.`
              }
            ],
            temperature: 0.8,
            max_tokens: 150
          })
        })

        if (!promptRequest.ok) {
          return null
        }

        const promptData = await promptRequest.json()
        const imagePrompt = promptData.choices?.[0]?.message?.content?.trim()

        if (!imagePrompt) {
          return null
        }

        // Generate kid-friendly description and DALL-E image in parallel
        const [descriptionRequest, imageRequest] = await Promise.all([
          fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openaiKey}`
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: 'You are Ms. Sonoma, a warm and encouraging teacher. Convert technical image descriptions into simple, friendly explanations that a child aged 6-12 can understand. Use 2-3 short sentences. Be enthusiastic but clear. Speak directly to the child using "you" and "we". IMPORTANT: Always complete your sentences - never cut off mid-sentence. Use plain text only - no asterisks, markdown, bold, italics, or special formatting.'
                },
                {
                  role: 'user',
                  content: `Convert this image prompt into a kid-friendly explanation:\n\n${imagePrompt}\n\nMake it sound warm and encouraging, like you're explaining what's in the picture to help them learn. Make sure to complete all sentences. Use plain text only - no asterisks or special formatting.`
                }
              ],
              temperature: 0.7,
              max_tokens: 150
            })
          }),
          fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openaiKey}`
            },
            body: JSON.stringify({
              model: 'dall-e-3',
              prompt: `${imagePrompt} IMPORTANT: This image must contain absolutely NO text, words, letters, numbers, labels, captions, signs, or any written language of any kind. Show only visual elements.`,
              n: 1,
              size: '1024x1024',
              quality: 'standard',
              style: 'vivid'
            })
          })
        ])

        let description = imagePrompt // Fallback to technical prompt
        if (descriptionRequest.ok) {
          const descData = await descriptionRequest.json()
          const rawDescription = descData.choices?.[0]?.message?.content?.trim() || imagePrompt
          // Strip all markdown formatting
          description = rawDescription
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/_/g, '')
            .replace(/#{1,6}\s/g, '')
            .trim()
        }

        if (!imageRequest.ok) {
          return null
        }

        const imageData = await imageRequest.json()
        const imageUrl = imageData.data?.[0]?.url

        if (imageUrl) {
          return {
            url: imageUrl,
            prompt: imagePrompt,
            description: description,
            id: `img-${Date.now()}-${index}`
          }
        }

        return null
      } catch (err) {
        return null
      }
    }

    // Generate all images in parallel
    const imagePromises = Array.from({ length: count }, (_, i) => generateSingleImage(i))
    const results = await Promise.all(imagePromises)
    const images = results.filter(img => img !== null)

    if (images.length === 0) {
      return NextResponse.json({ error: 'Failed to generate any images' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      images
    })
    
  } catch (err) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
