// API endpoint for assigning/unassigning lessons to a learner (approved_lessons)
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { normalizeLessonKey } from '@/app/lib/lessonKeyNormalization'

function getAuthToken(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '').trim()
  return token || null
}

function normalizeApprovedLessonsMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!key) continue
    out[String(key)] = !!value
  }
  return out
}

function buildKeyVariants(lessonKey) {
  const variants = new Set()
  if (lessonKey) variants.add(String(lessonKey))

  const normalized = lessonKey ? normalizeLessonKey(lessonKey) : null
  if (normalized) variants.add(normalized)

  // Legacy migration path used in older approved_lessons maps
  if (lessonKey && String(lessonKey).includes('general/')) {
    const legacy = String(lessonKey).replace('general/', 'facilitator/')
    variants.add(legacy)
    const legacyNormalized = normalizeLessonKey(legacy)
    if (legacyNormalized) variants.add(legacyNormalized)
  }

  return Array.from(variants).filter(Boolean)
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null)
    const learnerId = body?.learnerId
    const lessonKey = body?.lessonKey
    const assigned = body?.assigned

    if (!learnerId || !lessonKey || typeof assigned !== 'boolean') {
      return NextResponse.json(
        { error: 'learnerId, lessonKey, and assigned (boolean) are required' },
        { status: 400 }
      )
    }

    const token = getAuthToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the learner belongs to this facilitator
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id, name, approved_lessons')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

    if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

    const previous = normalizeApprovedLessonsMap(learner.approved_lessons)
    const next = { ...previous }

    const variants = buildKeyVariants(lessonKey)
    const canonicalKey = normalizeLessonKey(lessonKey)

    if (assigned) {
      // Assign: set the canonical key to true, but leave other keys alone
      next[canonicalKey] = true
    } else {
      // Unassign: remove all known variants
      for (const key of variants) {
        delete next[key]
      }
      delete next[canonicalKey]
    }

    const { error: updateError } = await adminSupabase
      .from('learners')
      .update({ approved_lessons: next })
      .eq('id', learnerId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      learnerId: learner.id,
      learnerName: learner.name,
      lessonKey: canonicalKey,
      assigned
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
