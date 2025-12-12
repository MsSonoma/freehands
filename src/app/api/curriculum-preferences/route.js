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
    const { learnerId, bannedWords, bannedTopics, bannedConcepts, focusTopics, focusConcepts, focusKeywords } = body

    if (!learnerId) {
      return NextResponse.json({ error: 'Learner ID is required' }, { status: 400 })
    }

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
        updated_at: new Date().toISOString()
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
