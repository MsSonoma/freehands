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

    // Generate image prompts based on teaching notes
    const images = []
    
    for (let i = 0; i < count; i++) {
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
                content: 'You create short, kid-friendly image prompts for educational visual aids. Each prompt should describe a clear, simple illustration that helps explain the lesson concept. Keep prompts under 100 words, focus on clarity and educational value. Make images colorful, engaging, and appropriate for children aged 6-12. IMPORTANT: Do NOT include any text, labels, words, letters, or written language in the images - focus purely on visual concepts, objects, scenes, and illustrations.'
              },
              {
                role: 'user',
                content: customPrompt 
                  ? `Create image prompt #${i + 1} for visual aid with this custom guidance:\n\n${customPrompt}\n\nLesson context:\nTitle: ${lessonTitle || 'Educational Lesson'}\nTeaching Notes: ${teachingNotes}`
                  : `Create image prompt #${i + 1} for visual aid based on this lesson:\n\nTitle: ${lessonTitle || 'Educational Lesson'}\n\nTeaching Notes:\n${teachingNotes}\n\nCreate a distinct educational illustration that helps explain a key concept from these notes.`
              }
            ],
            temperature: 0.8,
            max_tokens: 150
          })
        })

        if (!promptRequest.ok) {
          console.error('[VISUAL_AIDS] Prompt generation failed:', await promptRequest.text())
          continue
        }

        const promptData = await promptRequest.json()
        const imagePrompt = promptData.choices?.[0]?.message?.content?.trim()

        if (!imagePrompt) {
          console.error('[VISUAL_AIDS] No prompt generated')
          continue
        }

        // Generate image using DALL-E 3
        const imageRequest = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: imagePrompt,
            n: 1,
            size: '1024x1024',
            quality: 'standard',
            style: 'vivid'
          })
        })

        if (!imageRequest.ok) {
          console.error('[VISUAL_AIDS] Image generation failed:', await imageRequest.text())
          continue
        }

        const imageData = await imageRequest.json()
        const imageUrl = imageData.data?.[0]?.url

        if (imageUrl) {
          images.push({
            url: imageUrl,
            prompt: imagePrompt,
            id: `img-${Date.now()}-${i}`
          })
        }
      } catch (err) {
        console.error('[VISUAL_AIDS] Error generating image:', err)
        // Continue to next image
      }
    }

    if (images.length === 0) {
      return NextResponse.json({ error: 'Failed to generate any images' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      images
    })
    
  } catch (err) {
    console.error('[VISUAL_AIDS] Error:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
