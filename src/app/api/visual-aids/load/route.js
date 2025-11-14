import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/visual-aids/load?lessonKey=...
 * Load visual aids for a specific lesson (facilitator-specific)
 */
export async function GET(req) {
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

    const { searchParams } = new URL(req.url)
    const lessonKey = searchParams.get('lessonKey')

    if (!lessonKey) {
      return NextResponse.json({ error: 'Missing lessonKey' }, { status: 400 })
    }

    // Normalize lesson key by stripping folder prefixes (must match save normalization)
    const normalizedLessonKey = lessonKey.replace(/^(generated|facilitator|math|science|language-arts|social-studies|demo)\//, '')
    console.log('[VISUAL_AIDS_LOAD] Normalizing lesson key:', lessonKey, '->', normalizedLessonKey)

    // Fetch visual aids for this facilitator + lesson
    const { data, error } = await supabase
      .from('visual_aids')
      .select('*')
      .eq('facilitator_id', user.id)
      .eq('lesson_key', normalizedLessonKey)
      .single()

    if (error) {
      // No record found is OK - return empty state
      if (error.code === 'PGRST116') {
        return NextResponse.json({ 
          generatedImages: [],
          selectedImages: [],
          generationCount: 0,
          maxGenerations: 4
        })
      }
      console.error('[VISUAL_AIDS_LOAD] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      generatedImages: data.generated_images || [],
      selectedImages: data.selected_images || [],
      generationCount: data.generation_count || 0,
      maxGenerations: data.max_generations || 4
    })
    
  } catch (err) {
    console.error('[VISUAL_AIDS_LOAD] Error:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
