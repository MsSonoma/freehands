// API endpoint for lesson schedule management
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server.js'
import { normalizeLessonKey } from '../../lib/lessonKeyNormalization.js'
import { featuresForTier, resolveEffectiveTier } from '../../lib/entitlements.js'
import { verifyFacilitatorLessonAccess } from '../../lib/serverLessonAccess.mjs'
import { setLessonAssociationInferenceSuppressed, upsertLessonAssociation } from '../../lib/syllabus/lessonAssociations.server.mjs'
import { inspectLearnerSyllabusPlacement } from '../../lib/syllabus/capacity.mjs'
import { verifyFacilitatorPinForUser } from '../../lib/facilitatorPin.server.mjs'
import { resolveCalendarContext } from '../../lib/calendarDate.mjs'
import { createSyllabusRepository } from '../../lib/syllabus/supabaseRepository.server.mjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const normalizeScheduledDate = (value) => {
  if (!value) return value
  const str = String(value)

  // Handles:
  // - YYYY-MM-DD
  // - YYYY-M-D
  // - YYYY-MM-DDTHH:mm:ss...
  // - YYYY-M-D HH:mm:ss...
  const match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (match) {
    const yyyy = match[1]
    const mm = String(match[2]).padStart(2, '0')
    const dd = String(match[3]).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  return str
}

const normalizeUuid = (value) => {
  const text = String(value || '').trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null
}

export async function verifyScheduleForecastLineage({ repository, facilitatorId, learnerId, forecastLineageId, lessonKey }) {
  const syllabus = await repository.findSyllabus(facilitatorId, learnerId)
  if (!syllabus?.active_revision_id) return { ok: false, status: 409, error: 'The learner has no active Syllabus for this forecast lineage.' }
  const [revision, items] = await Promise.all([
    repository.findRevision(syllabus.active_revision_id, syllabus.id),
    repository.listForecastItems(syllabus.active_revision_id),
  ])
  if (!revision) return { ok: false, status: 409, error: 'The active Syllabus revision could not be verified.' }
  const matches = (items || []).filter((item) => String(item?.lineage_id || '') === forecastLineageId
    && (item?.item_type || 'lesson') === 'lesson'
    && ['learning_forecast', 'facilitator'].includes(item?.origin))
  if (matches.length !== 1) return { ok: false, status: 409, error: 'The forecast lineage is stale, unrelated, or ambiguous.' }
  if (normalizeLessonKey(matches[0].lesson_key) !== lessonKey) {
    return { ok: false, status: 409, error: 'The forecast lineage is not bound to this lesson.' }
  }
  return { ok: true, lineageId: forecastLineageId, item: matches[0] }
}

export async function GET(request, deps = {}) {
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
    const createClientImpl = deps.createClientImpl || createClient
    const adminSupabase = createClientImpl(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })
    
    // Validate the user's token
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized', details: userError?.message }, { status: 401 })
    }

    if (!learnerId) {
      return NextResponse.json({ error: 'learnerId required' }, { status: 400 })
    }

    // Authorization must precede every service-role schedule query, including action=active.
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

    if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

    // Get active lessons for today (used by learner view)
    if (action === 'active' && learnerId) {
      const { data: profile } = await adminSupabase.from('profiles').select('timezone').eq('id', user.id).maybeSingle()
      const { today } = resolveCalendarContext({
        profileTimeZone: profile?.timezone,
        fallbackTimeZone: user?.user_metadata?.timezone,
      })
      
      const { data, error } = await adminSupabase
        .from('lesson_schedule')
        .select('lesson_key, scheduled_date, created_at, updated_at')
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
      scheduled_date: normalizeScheduledDate(item.scheduled_date),
      lesson_key: normalizeLessonKey(item.lesson_key)
    }))

    return NextResponse.json({ schedule })
  } catch (error) {
    // General GET error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request, deps = {}) {
  try {
    const body = await request.json()
    const { learnerId, lessonKey, scheduledDate, exceptionPin, scheduleId, originalScheduledDate } = body

    if (!learnerId || !lessonKey || !scheduledDate) {
      return NextResponse.json(
        { error: 'learnerId, lessonKey, and scheduledDate required' },
        { status: 400 }
      )
    }

    const normalizedLessonKey = normalizeLessonKey(lessonKey)
    const lineageWasSupplied = body?.forecastLineageId != null && String(body.forecastLineageId).trim() !== ''
    const requestedForecastLineageId = lineageWasSupplied ? normalizeUuid(body.forecastLineageId) : null
    if (lineageWasSupplied && !requestedForecastLineageId) {
      return NextResponse.json({ error: 'forecastLineageId must be a valid UUID' }, { status: 400 })
    }

    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const createClientImpl = deps.createClientImpl || createClient
    const adminSupabase = createClientImpl(
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

    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('subscription_tier, plan_tier')
      .eq('id', user.id)
      .maybeSingle()
    const effectiveTier = resolveEffectiveTier(profile?.subscription_tier, profile?.plan_tier)
    if (!featuresForTier(effectiveTier).lessonScheduling) {
      return NextResponse.json({ error: 'Scheduling requires a Standard plan or higher' }, { status: 403 })
    }

    const lessonAccess = await verifyFacilitatorLessonAccess({
      admin: adminSupabase,
      userId: user.id,
      lessonKey: normalizedLessonKey,
      fileExistsSync: deps.fileExistsSync,
      unapprovedError: 'Approve the lesson content before scheduling it',
    })
    if (!lessonAccess.ok) {
      return NextResponse.json({ error: lessonAccess.error || 'Lesson not found or unauthorized' }, { status: 403 })
    }

    let existingSchedule = null
    if (scheduleId || originalScheduledDate) {
      let existingQuery = adminSupabase.from('lesson_schedule').select('*').eq('learner_id', learnerId)
        .or(`facilitator_id.eq.${user.id},facilitator_id.is.null`)
      existingQuery = scheduleId
        ? existingQuery.eq('id', scheduleId)
        : existingQuery.eq('lesson_key', normalizedLessonKey).eq('scheduled_date', normalizeScheduledDate(originalScheduledDate))
      const { data: row, error: existingError } = await existingQuery.maybeSingle()
      if (existingError || !row) return NextResponse.json({ error: 'Schedule occurrence not found or unauthorized' }, { status: 404 })
      existingSchedule = row
    }
    if (!existingSchedule) {
      const { data: compatible, error: compatibleError } = await adminSupabase.from('lesson_schedule')
        .select('*')
        .eq('learner_id', learnerId)
        .eq('lesson_key', normalizedLessonKey)
        .eq('scheduled_date', normalizeScheduledDate(scheduledDate))
        .or(`facilitator_id.eq.${user.id},facilitator_id.is.null`)
        .maybeSingle()
      if (compatibleError) return NextResponse.json({ error: compatibleError.message }, { status: 500 })
      existingSchedule = compatible || null
    }

    const existingForecastLineageId = String(existingSchedule?.forecast_lineage_id || '').trim() || null
    if (existingForecastLineageId && requestedForecastLineageId && existingForecastLineageId !== requestedForecastLineageId) {
      return NextResponse.json({ error: 'This schedule occurrence is already linked to a different forecast lineage.' }, { status: 409 })
    }
    const forecastLineageId = existingForecastLineageId || requestedForecastLineageId
    if (forecastLineageId) {
      const repository = deps.syllabusRepository || createSyllabusRepository(adminSupabase)
      const lineage = await verifyScheduleForecastLineage({
        repository,
        facilitatorId: user.id,
        learnerId,
        forecastLineageId,
        lessonKey: normalizedLessonKey,
      })
      if (!lineage.ok) return NextResponse.json({ error: lineage.error }, { status: lineage.status })
    }

    const inspectPlacement = deps.inspectLearnerSyllabusPlacement || inspectLearnerSyllabusPlacement
    const capacity = await inspectPlacement({
      admin: adminSupabase,
      facilitatorId: user.id,
      learnerId,
      lessonKey: normalizedLessonKey,
      subject: lessonAccess.subject,
      date: normalizeScheduledDate(scheduledDate),
      excludeScheduleId: existingSchedule?.id || null,
    })
    if (!capacity.allowed) {
      if (!exceptionPin) {
        return NextResponse.json({
          error: capacity.message,
          code: 'SYLLABUS_CAPACITY_PIN_REQUIRED',
          conflict: capacity.conflict,
        }, { status: 409 })
      }
      const verifyPin = deps.verifyFacilitatorPinForUser || verifyFacilitatorPinForUser
      if (!await verifyPin(adminSupabase, user.id, exceptionPin)) {
        return NextResponse.json({ error: 'Invalid Facilitator PIN', code: 'INVALID_FACILITATOR_PIN' }, { status: 403 })
      }
    }

    // Insert or update schedule entry
    const schedulePayload = {
        facilitator_id: user.id,
        learner_id: learnerId,
        lesson_key: normalizedLessonKey,
        scheduled_date: normalizeScheduledDate(scheduledDate),
        ...(forecastLineageId ? { forecast_lineage_id: forecastLineageId } : {}),
    }
    const mutation = existingSchedule
      ? adminSupabase.from('lesson_schedule').update(schedulePayload).eq('id', existingSchedule.id)
      : adminSupabase.from('lesson_schedule').upsert(schedulePayload, { onConflict: 'learner_id,lesson_key,scheduled_date' })
    const { data, error } = await mutation.select().single()

    if (error) {
      if (forecastLineageId && error.code === '23505') {
        return NextResponse.json({ error: 'This forecast occurrence already has an explicit schedule.' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await upsertLessonAssociation({
      admin: adminSupabase,
      facilitatorId: user.id,
      learnerId,
      lessonKey: lessonAccess.lessonKey,
      subject: lessonAccess.subject,
      title: lessonAccess.title,
      readinessState: 'approved',
      associationSource: 'schedule',
      verifyLearner: false,
    })

    const clearInferenceSuppression = deps.setLessonAssociationInferenceSuppressed || setLessonAssociationInferenceSuppressed
    await clearInferenceSuppression({
      admin: adminSupabase,
      facilitatorId: user.id,
      learnerId,
      lessonKey: normalizedLessonKey,
      suppressed: false,
      verifyLearner: false,
    })

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
