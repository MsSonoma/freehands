import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * PUT /api/facilitator/lessons/update
 * Update an existing lesson JSON file in storage
 */
export async function PUT(req) {
  try {
    // Authenticate user from Bearer token
    const auth = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    const supabase = createClient(url, anon, { 
      global: { headers: { Authorization: `Bearer ${token}` } }, 
      auth: { persistSession: false } 
    })
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check premium status using service role key for direct access
    const admin = svc ? createClient(url, svc, { auth: { persistSession: false } }) : null
    let tier = 'free'
    
    if (admin) {
      const { data: profile } = await admin
        .from('profiles')
        .select('plan_tier')
        .eq('id', user.id)
        .maybeSingle()
      
      tier = (profile?.plan_tier || 'free').toLowerCase()
    }
    
    if (tier !== 'premium' && tier !== 'lifetime') {
      return NextResponse.json({ error: 'Premium required' }, { status: 403 })
    }

    // Use admin client for storage operations
    const storageClient = admin || supabase

    const body = await req.json()
    const { file, lesson, userId } = body

    if (!file || !lesson) {
      return NextResponse.json({ error: 'Missing file or lesson data' }, { status: 400 })
    }

    // Validate lesson structure
    if (!lesson.title || !lesson.grade || !lesson.difficulty) {
      return NextResponse.json({ error: 'Lesson must have title, grade, and difficulty' }, { status: 400 })
    }

    // Ensure the file belongs to this facilitator
    const targetUserId = userId || user.id
    if (targetUserId !== user.id) {
      return NextResponse.json({ error: 'Cannot edit another facilitator\'s lesson' }, { status: 403 })
    }

    const storagePath = `${targetUserId}/${file}`

    // Verify file exists and belongs to this user
    const { data: existingFile, error: fetchError } = await storageClient
      .storage
      .from('lessons')
      .list(targetUserId, { search: file })

    if (fetchError || !existingFile || existingFile.length === 0) {
      return NextResponse.json({ error: 'Lesson file not found' }, { status: 404 })
    }

    // Update the lesson file
    const lessonContent = JSON.stringify(lesson, null, 2)
    const { error: uploadError } = await storageClient
      .storage
      .from('lessons')
      .update(storagePath, lessonContent, {
        contentType: 'application/json',
        upsert: true
      })

    if (uploadError) {
      console.error('[UPDATE_LESSON] Upload error:', uploadError)
      return NextResponse.json({ error: `Failed to update lesson: ${uploadError.message}` }, { status: 500 })
    }

    // If the lesson was previously marked as needing updates, clear that flag
    // by setting approved back to true (assuming it was already approved)
    // This is handled by the approve endpoint, so we don't need to do it here

    return NextResponse.json({ 
      success: true, 
      file,
      message: 'Lesson updated successfully'
    })

  } catch (err) {
    console.error('[UPDATE_LESSON] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
