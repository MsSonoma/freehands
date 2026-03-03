// API route for curriculum preferences (learner-specific)
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const learnerId = searchParams.get('learnerId')

    if (!learnerId) {
      return NextResponse.json({ error: 'Learner ID is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('curriculum_preferences')
      .select('*')
      .eq('facilitator_id', user.id)
      .eq('learner_id', learnerId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching curriculum preferences:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ preferences: data || null })
  } catch (err) {
    console.error('Curriculum preferences GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { learnerId, subject = 'all', bannedWords, bannedTopics, bannedConcepts, focusTopics, focusConcepts, focusKeywords } = body

    if (!learnerId) {
      return NextResponse.json({ error: 'Learner ID is required' }, { status: 400 })
    }

    const now = new Date().toISOString()

    if (subject === 'all') {
      // Save global (all-subjects) preferences using the existing top-level columns
      const { data, error } = await supabase
        .from('curriculum_preferences')
        .upsert({
          facilitator_id: user.id,
          learner_id: learnerId,
          banned_words: bannedWords || [],
          banned_topics: bannedTopics || [],
          banned_concepts: bannedConcepts || [],
          focus_topics: focusTopics || [],
          focus_concepts: focusConcepts || [],
          focus_keywords: focusKeywords || [],
          updated_at: now
        }, {
          onConflict: 'facilitator_id,learner_id'
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving curriculum preferences:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ preferences: data }, { status: 200 })
    }

    // Save per-subject preferences into the subject_preferences JSONB column.
    // Requires scripts/add-curriculum-subject-preferences.sql to have been run.

    // 1. Fetch existing row — try to read subject_preferences for merge;
    //    if the column doesn't exist the select will error, so we fall back to id-only.
    let existingId = null
    let existingSubjectPrefs = {}
    let columnExists = true

    const { data: existing, error: fetchErr } = await supabase
      .from('curriculum_preferences')
      .select('id, subject_preferences')
      .eq('facilitator_id', user.id)
      .eq('learner_id', learnerId)
      .maybeSingle()

    if (fetchErr) {
      const isColMissing =
        fetchErr.message?.includes('subject_preferences') ||
        fetchErr.code === '42703' ||
        fetchErr.code === 'PGRST204'
      if (isColMissing) {
        // Column not yet added — fall back to id-only fetch so we at least know row state
        columnExists = false
        const { data: idOnly } = await supabase
          .from('curriculum_preferences')
          .select('id')
          .eq('facilitator_id', user.id)
          .eq('learner_id', learnerId)
          .maybeSingle()
        existingId = idOnly?.id || null
      } else {
        console.error('Error fetching existing curriculum preferences:', fetchErr)
        return NextResponse.json({ error: fetchErr.message }, { status: 500 })
      }
    } else {
      existingId = existing?.id || null
      existingSubjectPrefs = existing?.subject_preferences || {}
    }

    if (!columnExists) {
      return NextResponse.json({
        error: 'Per-subject preferences require a one-time database update. Run scripts/add-curriculum-subject-preferences.sql in Supabase.',
        migrationNeeded: true
      }, { status: 500 })
    }

    // Merge this subject's data into existing subject_preferences map
    const mergedSubjectPrefs = {
      ...existingSubjectPrefs,
      [subject]: {
        focusTopics: focusTopics || [],
        focusConcepts: focusConcepts || [],
        focusKeywords: focusKeywords || [],
        bannedTopics: bannedTopics || [],
        bannedConcepts: bannedConcepts || [],
        bannedWords: bannedWords || [],
      }
    }

    let data, error
    if (existingId) {
      const res = await supabase
        .from('curriculum_preferences')
        .update({ subject_preferences: mergedSubjectPrefs, updated_at: now })
        .eq('id', existingId)
        .select()
        .single()
      data = res.data
      error = res.error
    } else {
      const res = await supabase
        .from('curriculum_preferences')
        .upsert({
          facilitator_id: user.id,
          learner_id: learnerId,
          banned_words: [],
          banned_topics: [],
          banned_concepts: [],
          focus_topics: [],
          focus_concepts: [],
          focus_keywords: [],
          subject_preferences: mergedSubjectPrefs,
          updated_at: now
        }, { onConflict: 'facilitator_id,learner_id' })
        .select()
        .single()
      data = res.data
      error = res.error
    }

    if (error) {
      const isMissingColumn =
        error.message?.includes('subject_preferences') ||
        error.code === '42703' ||
        error.code === 'PGRST204'
      if (isMissingColumn) {
        console.error('subject_preferences column missing — run scripts/add-curriculum-subject-preferences.sql', error)
        return NextResponse.json({
          error: 'Per-subject preferences require a one-time database update. Run scripts/add-curriculum-subject-preferences.sql in Supabase.',
          migrationNeeded: true
        }, { status: 500 })
      }
      console.error('Error saving subject curriculum preferences:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ preferences: data }, { status: 200 })
  } catch (err) {
    console.error('Curriculum preferences POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const learnerId = searchParams.get('learnerId')

    if (!learnerId) {
      return NextResponse.json({ error: 'Learner ID is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('curriculum_preferences')
      .delete()
      .eq('facilitator_id', user.id)
      .eq('learner_id', learnerId)

    if (error) {
      console.error('Error deleting curriculum preferences:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Curriculum preferences DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
