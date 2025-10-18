import { NextResponse } from 'next/server'
import { getSupabaseClientServer } from '@/app/lib/supabaseServer'

/**
 * PUT /api/facilitator/lessons/update
 * Update an existing lesson JSON file in storage
 */
export async function PUT(req) {
  try {
    const supabase = getSupabaseClientServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check premium status
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan_tier')
      .eq('id', user.id)
      .maybeSingle()

    const tier = (profile?.plan_tier || 'free').toLowerCase()
    if (tier !== 'premium' && tier !== 'lifetime') {
      return NextResponse.json({ error: 'Premium required' }, { status: 403 })
    }

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
    const { data: existingFile, error: fetchError } = await supabase
      .storage
      .from('lessons')
      .list(targetUserId, { search: file })

    if (fetchError || !existingFile || existingFile.length === 0) {
      return NextResponse.json({ error: 'Lesson file not found' }, { status: 404 })
    }

    // Update the lesson file
    const lessonContent = JSON.stringify(lesson, null, 2)
    const { error: uploadError } = await supabase
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
