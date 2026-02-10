// API endpoint for lesson schedule management
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { normalizeLessonKey } from '@/app/lib/lessonKeyNormalization'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const learnerId = searchParams.get('learnerId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const action = searchParams.get('action') // 'active' to get today's active lessons
    const includeAll = searchParams.get('includeAll') === '1'

    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
    }

    // Extract the token from "Bearer <token>"
    const token = authHeader.replace('Bearer ', '').trim()
    
    if (!token) {
      return NextResponse.json({ error: 'Invalid authorization token' }, { status: 401 })
    }
    
    // Use service key for admin operations, but verify user's token
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })
    
    // Validate the user's token
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized', details: userError?.message }, { status: 401 })
    }

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

      const lessons = (data || []).map(item => ({
        ...item,
        lesson_key: normalizeLessonKey(item.lesson_key)
      }))

      return NextResponse.json({ lessons })
    }

    // Get schedule for date range
    if (!learnerId) {
      return NextResponse.json({ error: 'learnerId required' }, { status: 400 })
    }

    // Verify the learner belongs to this facilitator.
    // (GET previously relied only on facilitator_id filtering, which can hide legacy schedule rows.)
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

    if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

    let query = adminSupabase
      .from('lesson_schedule')
      .select('*')
      .eq('learner_id', learnerId)
      .order('scheduled_date', { ascending: true })

    // Default behavior: prefer facilitator-scoped schedule rows, plus safe legacy rows where facilitator_id is null.
    // Overlay/debug callers can pass includeAll=1 to retrieve all schedule rows for an owned learner.
    if (!includeAll) {
      query = query.or(`facilitator_id.eq.${user.id},facilitator_id.is.null`)
    }

    if (startDate && endDate) {
      query = query.gte('scheduled_date', startDate).lte('scheduled_date', endDate)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const schedule = (data || []).map(item => ({
      ...item,
      lesson_key: normalizeLessonKey(item.lesson_key)
    }))

    return NextResponse.json({ schedule })
  } catch (error) {
    // General GET error
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

    const normalizedLessonKey = normalizeLessonKey(lessonKey)

    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
        lesson_key: normalizedLessonKey,
        scheduled_date: scheduledDate
      }, {
        onConflict: 'learner_id,lesson_key,scheduled_date'
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const normalizedData = data ? { ...data, lesson_key: normalizeLessonKey(data.lesson_key) } : null

    return NextResponse.json({ success: true, data: normalizedData })
  } catch (error) {
    // General POST error
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
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let query = adminSupabase
      .from('lesson_schedule')
      .delete()
      .eq('facilitator_id', user.id)

    if (scheduleId) {
      query = query.eq('id', scheduleId)
    } else if (learnerId && lessonKey && scheduledDate) {
      const normalizedLessonKey = normalizeLessonKey(lessonKey)
      const keySet = Array.from(new Set([normalizedLessonKey, lessonKey].filter(Boolean)))

      query = query
        .eq('learner_id', learnerId)
        .eq('scheduled_date', scheduledDate)

      if (keySet.length === 1) {
        query = query.eq('lesson_key', keySet[0])
      } else {
        query = query.in('lesson_key', keySet)
      }
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
    // General DELETE error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
