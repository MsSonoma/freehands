// Mr. Slate drill settings — per-learner configurable drill parameters
// Stored in learners.slate_settings (JSONB). Run scripts/add-slate-settings-column.sql first.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_SETTINGS = {
  scoreGoal: 10,
  correctPts: 1,
  wrongPts: 1,
  timeoutPts: 0,
  timeoutOffset: 0,
  questionSecs: 15,
}

// Allowed keys and their valid ranges (guards against arbitrary writes)
const ALLOWED = {
  scoreGoal:    { min: 3,  max: 30  },
  correctPts:   { min: 1,  max: 5   },
  wrongPts:     { min: 0,  max: 5   },
  timeoutPts:    { min: 0, max: 5   },
  timeoutOffset:  { min: 0, max: 5   },
  questionSecs:  { min: 5, max: 120 },
}

function sanitize(raw) {
  const out = {}
  for (const [key, { min, max }] of Object.entries(ALLOWED)) {
    const v = Number(raw?.[key])
    out[key] = Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : DEFAULT_SETTINGS[key]
  }
  return out
}

async function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const learnerId = searchParams.get('learner_id')

  if (!learnerId) return NextResponse.json({ settings: DEFAULT_SETTINGS })

  try {
    const supabase = await getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ settings: DEFAULT_SETTINGS })

    const { data, error } = await supabase
      .from('learners')
      .select('slate_settings')
      .eq('id', learnerId)
      .maybeSingle()

    if (error || !data) return NextResponse.json({ settings: DEFAULT_SETTINGS })

    return NextResponse.json({ settings: { ...DEFAULT_SETTINGS, ...(data.slate_settings || {}) } })
  } catch {
    return NextResponse.json({ settings: DEFAULT_SETTINGS })
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json()
    const { learner_id, settings: raw } = body

    if (!learner_id) return NextResponse.json({ error: 'learner_id required' }, { status: 400 })
    if (!raw || typeof raw !== 'object') return NextResponse.json({ error: 'settings required' }, { status: 400 })

    const supabase = await getSupabaseAdmin()
    if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 500 })

    const safe = sanitize(raw)

    const { error } = await supabase
      .from('learners')
      .update({ slate_settings: safe })
      .eq('id', learner_id)

    if (error) {
      if (error.message?.includes('slate_settings') || error.code === '42703') {
        return NextResponse.json(
          { error: 'Column slate_settings not found. Run scripts/add-slate-settings-column.sql in Supabase.' },
          { status: 422 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, settings: safe })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
