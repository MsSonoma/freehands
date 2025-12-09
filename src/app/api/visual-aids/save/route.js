import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { downloadAndStoreImage } from '../lib/downloadImage'

export const dynamic = 'force-dynamic'
export const maxDuration = 25 // Vercel timeout protection (30s max, 5s buffer)

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
    const { lessonKey, generatedImages, generationCount } = body

    if (!lessonKey) {
      return NextResponse.json({ error: 'Missing lessonKey' }, { status: 400 })
    }

    // Normalize lesson key by stripping folder prefixes (so same lesson from different routes shares visual aids)
    const normalizedLessonKey = lessonKey.replace(/^(generated|facilitator|math|science|language-arts|social-studies|demo)\//, '')

    // Download and store ONLY selected images permanently
    // Unselected images are discarded and not saved
    let permanentSelectedImages = []
    const selectedImages = generatedImages.filter(img => img.selected)
    
    if (selectedImages && selectedImages.length > 0) {
      
      permanentSelectedImages = await Promise.all(
        selectedImages.map(async (img) => {
          try {
            // Check if URL is already a permanent Supabase Storage URL
            if (img.url && img.url.includes('/storage/v1/object/public/visual-aids/')) {
              return img
            }

            // Check if it's a data URL (uploaded file)
            if (img.url && img.url.startsWith('data:')) {
              // For uploaded files, we still need to convert data URL to permanent storage
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
            // Return null to filter out - don't save expired URLs
            return null
          }
        })
      )
      
      // Filter out failed downloads (null values)
      permanentSelectedImages = permanentSelectedImages.filter(img => img !== null)
      
      // If all images failed, return error
      if (permanentSelectedImages.length === 0) {
        return NextResponse.json({ 
          error: 'All images failed to download after retries. DALL-E URLs may have expired. Please regenerate the images.'
        }, { status: 500 })
      }
    }

    // Save ONLY the selected images - unselected images are discarded
    // Store selected images in both fields so they appear on reload

    // Save ONLY the selected images - unselected images are discarded
    // Store selected images in both fields so they appear on reload
    const { data, error } = await supabase
      .from('visual_aids')
      .upsert({
        facilitator_id: user.id,
        lesson_key: normalizedLessonKey,
        generated_images: permanentSelectedImages,
        selected_images: permanentSelectedImages,
        generation_count: generationCount || 0,
        max_generations: 4
      }, {
        onConflict: 'facilitator_id,lesson_key'
      })
      .select()
      .single()

    if (error) {
      // Upsert error
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      data 
    })
    
  } catch (err) {
    // General error
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
