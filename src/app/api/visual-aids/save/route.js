import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { downloadAndStoreImage } from '../lib/downloadImage'

export const dynamic = 'force-dynamic'
export const maxDuration = 25 // Vercel timeout protection (30s max, 5s buffer)

/**
 * POST/PUT /api/visual-aids/save
 * Save or update visual aids for a lesson (facilitator-specific)
 * Body: { lessonKey, generatedImages, selectedImages, generationCount, persistGenerated }
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
    const { lessonKey, generatedImages, generationCount, persistGenerated } = body

    if (!lessonKey) {
      return NextResponse.json({ error: 'Missing lessonKey' }, { status: 400 })
    }

    // Normalize lesson key by stripping folder prefixes (so same lesson from different routes shares visual aids)
    const normalizedLessonKey = lessonKey.replace(/^(generated|facilitator|math|science|language-arts|social-studies|demo)\//, '')

    const safeGeneratedImages = Array.isArray(generatedImages) ? generatedImages : []
    const explicitSelectedImages = safeGeneratedImages.filter((img) => Boolean(img?.selected))
    const bodySelectedImages = Array.isArray(body?.selectedImages) ? body.selectedImages : []
    const selectedImages = explicitSelectedImages.length > 0 ? explicitSelectedImages : bodySelectedImages

    const shouldPersistGenerated = Boolean(persistGenerated)

    // Fetch existing record (if present) so we can preserve/merge without wiping.
    const { data: existing, error: existingError } = await supabase
      .from('visual_aids')
      .select('generated_images, selected_images')
      .eq('facilitator_id', user.id)
      .eq('lesson_key', normalizedLessonKey)
      .maybeSingle()

    if (existingError && existingError.code !== 'PGRST116') {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    const existingGenerated = Array.isArray(existing?.generated_images) ? existing.generated_images : []
    const existingSelected = Array.isArray(existing?.selected_images) ? existing.selected_images : []

    const isPermanentUrl = (url) =>
      typeof url === 'string' && url.includes('/storage/v1/object/public/visual-aids/')

    const summarizePersistError = (err) => {
      if (!err) return { stage: 'unknown', message: 'Unknown error' }
      const stage = err.stage || 'unknown'
      const status = err.status || err.statusCode
      const base = err.message || String(err)
      return {
        stage,
        status,
        message: typeof status !== 'undefined' ? `${base} (status ${status})` : base
      }
    }

    const makePermanent = async (img) => {
      if (!img?.url) return null
      if (isPermanentUrl(img.url)) return img

      try {
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
        const info = summarizePersistError(err)
        const tagged = {
          ...img,
          __persistError: info
        }
        return tagged
      }
    }

    // 1) Optionally persist generated images immediately (so later selection does not depend on expiring URLs).
    let nextGeneratedImages = existingGenerated
    if (shouldPersistGenerated && safeGeneratedImages.length > 0) {
      const permanentCandidates = await Promise.all(safeGeneratedImages.map(makePermanent))
      const permanentGenerated = permanentCandidates.filter((img) => Boolean(img?.url) && !img?.__persistError)

      const failures = permanentCandidates
        .filter((img) => Boolean(img?.__persistError))
        .map((img) => img.__persistError)

      if (permanentGenerated.length === 0) {
        console.error('[visual-aids/save] persistGenerated failed', {
          lessonKey: normalizedLessonKey,
          failures: failures.slice(0, 3)
        })
        return NextResponse.json(
          {
            error:
              'All images failed to persist (download and/or upload). This is not necessarily an expiry issue. See details.',
            details: failures.slice(0, 3)
          },
          { status: 500 }
        )
      }

      const byId = new Map()
      for (const img of existingGenerated) {
        if (img?.id) byId.set(img.id, img)
      }
      for (const img of permanentGenerated) {
        if (img?.id) byId.set(img.id, img)
      }

      nextGeneratedImages = safeGeneratedImages
        .map((img) => (img?.id ? byId.get(img.id) || img : img))
        .filter((img) => Boolean(img?.url))
    }

    // 2) If a selection is provided, ensure selected images are permanent and update selected_images.
    let nextSelectedImages = existingSelected
    if (Array.isArray(selectedImages) && selectedImages.length > 0) {
      const generatedById = new Map()
      for (const img of nextGeneratedImages) {
        if (img?.id) generatedById.set(img.id, img)
      }

      const selectedResolved = selectedImages.map((img) => {
        if (img?.id && generatedById.has(img.id)) return generatedById.get(img.id)
        return img
      })

      const permanentCandidates = await Promise.all(selectedResolved.map(makePermanent))
      const permanentSelected = permanentCandidates.filter((img) => Boolean(img?.url) && !img?.__persistError)

      const failures = permanentCandidates
        .filter((img) => Boolean(img?.__persistError))
        .map((img) => img.__persistError)

      if (permanentSelected.length === 0) {
        console.error('[visual-aids/save] persistSelected failed', {
          lessonKey: normalizedLessonKey,
          failures: failures.slice(0, 3)
        })
        return NextResponse.json(
          {
            error:
              'All selected images failed to persist (download and/or upload). This is not necessarily an expiry issue. See details.',
            details: failures.slice(0, 3)
          },
          { status: 500 }
        )
      }

      nextSelectedImages = permanentSelected
    }

    // 3) Persist changes without wiping unrelated fields.
    const upsertPayload = {
      facilitator_id: user.id,
      lesson_key: normalizedLessonKey,
      generation_count: generationCount || 0,
      max_generations: 4
    }

    if (shouldPersistGenerated) {
      upsertPayload.generated_images = nextGeneratedImages
    }

    if (Array.isArray(selectedImages) && selectedImages.length > 0) {
      upsertPayload.selected_images = nextSelectedImages
    }

    const { data, error } = await supabase
      .from('visual_aids')
      .upsert(upsertPayload, {
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
