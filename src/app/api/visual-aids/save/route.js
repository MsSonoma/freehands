import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { downloadAndStoreImage } from '../lib/downloadImage'

export const dynamic = 'force-dynamic'

/**
 * POST/PUT /api/visual-aids/save
 * Save or update visual aids for a lesson (facilitator-specific)
 * Body: { lessonKey, generatedImages, selectedImages, generationCount }
 */
export async function POST(req) {
  try {
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
    const { lessonKey, generatedImages, selectedImages, generationCount } = body

    if (!lessonKey) {
      return NextResponse.json({ error: 'Missing lessonKey' }, { status: 400 })
    }

    // Normalize lesson key by stripping folder prefixes (so same lesson from different routes shares visual aids)
    const normalizedLessonKey = lessonKey.replace(/^(generated|facilitator|math|science|language-arts|social-studies|demo)\//, '')
    console.log('[VISUAL_AIDS_SAVE] Normalizing lesson key:', lessonKey, '->', normalizedLessonKey)

    // Download and store selected images permanently
    let permanentSelectedImages = []
    if (selectedImages && selectedImages.length > 0) {
      console.log('[VISUAL_AIDS_SAVE] Downloading', selectedImages.length, 'selected images...')
      
      permanentSelectedImages = await Promise.all(
        selectedImages.map(async (img) => {
          try {
            // Check if URL is already a permanent Supabase Storage URL
            if (img.url && img.url.includes('/storage/v1/object/public/visual-aids/')) {
              console.log('[VISUAL_AIDS_SAVE] Already permanent URL:', img.id)
              return img
            }

            // Download DALL-E image and upload to permanent storage
            const permanentUrl = await downloadAndStoreImage(
              img.url,
              supabase,
              user.id,
              normalizedLessonKey,
              img.id
            )

            return {
              ...img,
              url: permanentUrl
            }
          } catch (err) {
            console.error('[VISUAL_AIDS_SAVE] Failed to download image:', img.id, err)
            // Keep original URL if download fails
            return img
          }
        })
      )
      
      console.log('[VISUAL_AIDS_SAVE] Downloaded', permanentSelectedImages.length, 'images successfully')
    }

    // Upsert visual aids record
    const { data, error } = await supabase
      .from('visual_aids')
      .upsert({
        facilitator_id: user.id,
        lesson_key: normalizedLessonKey,
        generated_images: generatedImages || [],
        selected_images: permanentSelectedImages,
        generation_count: generationCount || 0,
        max_generations: 4
      }, {
        onConflict: 'facilitator_id,lesson_key'
      })
      .select()
      .single()

    if (error) {
      console.error('[VISUAL_AIDS_SAVE] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      data 
    })
    
  } catch (err) {
    console.error('[VISUAL_AIDS_SAVE] Error:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
