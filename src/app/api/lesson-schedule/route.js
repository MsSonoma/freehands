// API endpoint for lesson schedule management
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const learnerId = searchParams.get('learnerId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const action = searchParams.get('action') // 'active' to get today's active lessons

    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      console.error('[lesson-schedule] Missing authorization header')
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
    }

    // Extract the token from "Bearer <token>"
    const token = authHeader.replace('Bearer ', '').trim()
    
    if (!token) {
      console.error('[lesson-schedule] Empty token')
      return NextResponse.json({ error: 'Invalid authorization token' }, { status: 401 })
    }
    
    // Use service key for admin operations, but verify user's token
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })
    
    // Validate the user's token
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token)
    if (userError || !user) {
      console.error('[lesson-schedule] Auth error:', userError?.message || 'No user')
      return NextResponse.json({ error: 'Unauthorized', details: userError?.message }, { status: 401 })
    }
    
    console.log('[lesson-schedule] Authenticated user:', user.id)

    // Get active lessons for today (used by learner view)
    if (action === 'active' && learnerId) {
      // Use local date, not UTC
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const today = `${year}-${month}-${day}`
      
      const { data, error } = await adminSupabase
        .from('lesson_schedule')
        .select('lesson_key')
        .eq('learner_id', learnerId)
        .eq('scheduled_date', today)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ lessons: data || [] })
    }

    // Get schedule for date range
    if (!learnerId) {
      console.error('[lesson-schedule] Missing learnerId')
      return NextResponse.json({ error: 'learnerId required' }, { status: 400 })
    }

    console.log('[lesson-schedule] Fetching schedule for:', {
      learnerId,
      facilitatorId: user.id,
      startDate,
      endDate
    })

    let query = adminSupabase
      .from('lesson_schedule')
      .select('*')
      .eq('learner_id', learnerId)
      .eq('facilitator_id', user.id)
      .order('scheduled_date', { ascending: true })

    if (startDate && endDate) {
      query = query.gte('scheduled_date', startDate).lte('scheduled_date', endDate)
    }

    const { data, error } = await query

    if (error) {
      console.error('[lesson-schedule] Query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[lesson-schedule] Found', data?.length || 0, 'scheduled lessons')
    return NextResponse.json({ schedule: data || [] })
  } catch (error) {
    console.error('Schedule GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { learnerId, lessonKey, scheduledDate } = body

    if (!learnerId || !lessonKey || !scheduledDate) {
      return NextResponse.json(
        { error: 'learnerId, lessonKey, and scheduledDate required' },
        { status: 400 }
      )
    }

    const authHeader = request.headers.get('authorization')
    console.log('[POST schedule] Auth header present:', !!authHeader)
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    console.log('[POST schedule] Validating user with token...')
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token)
    
    if (userError || !user) {
      console.error('[POST schedule] Auth error:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('[POST schedule] User validated:', user.id)

    // Verify the learner belongs to this facilitator
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

    if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

    // Insert or update schedule entry
    const { data, error } = await adminSupabase
      .from('lesson_schedule')
      .upsert({
        facilitator_id: user.id,
        learner_id: learnerId,
        lesson_key: lessonKey,
        scheduled_date: scheduledDate
      }, {
        onConflict: 'learner_id,lesson_key,scheduled_date'
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Schedule POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const scheduleId = searchParams.get('id')
    const learnerId = searchParams.get('learnerId')
    const lessonKey = searchParams.get('lessonKey')
    const scheduledDate = searchParams.get('scheduledDate')

    const authHeader = request.headers.get('authorization')
    console.log('[DELETE schedule] Auth header present:', !!authHeader)
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    console.log('[DELETE schedule] Validating user with token...')
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token)
    
    if (userError || !user) {
      console.error('[DELETE schedule] Auth error:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('[DELETE schedule] User validated:', user.id)

    let query = adminSupabase
      .from('lesson_schedule')
      .delete()
      .eq('facilitator_id', user.id)

    if (scheduleId) {
      query = query.eq('id', scheduleId)
    } else if (learnerId && lessonKey && scheduledDate) {
      query = query
        .eq('learner_id', learnerId)
        .eq('lesson_key', lessonKey)
        .eq('scheduled_date', scheduledDate)
    } else {
      return NextResponse.json(
        { error: 'Either id or (learnerId, lessonKey, scheduledDate) required' },
        { status: 400 }
      )
    }

    const { error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Schedule DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
