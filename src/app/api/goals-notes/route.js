// API endpoint for persistent goals/notes
// GET: Load goals for learner or facilitator
// POST: Save goals for learner or facilitator

import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/app/lib/supabaseClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const supabase = getSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const learnerId = searchParams.get('learner_id')

    if (learnerId) {
      // Load goals for specific learner
      const { data, error } = await supabase
        .from('learners')
        .select('goals_notes')
        .eq('id', learnerId)
        .eq('facilitator_id', session.user.id)
        .maybeSingle()

      if (error) {
        console.error('[goals-notes] Load error:', error)
        return NextResponse.json({ error: 'Failed to load goals' }, { status: 500 })
      }

      return NextResponse.json({ goals_notes: data?.goals_notes || '' })
    } else {
      // Load facilitator's own goals
      const { data, error } = await supabase
        .from('profiles')
        .select('goals_notes')
        .eq('id', session.user.id)
        .maybeSingle()

      if (error) {
        console.error('[goals-notes] Load error:', error)
        return NextResponse.json({ error: 'Failed to load goals' }, { status: 500 })
      }

      return NextResponse.json({ goals_notes: data?.goals_notes || '' })
    }
  } catch (err) {
    console.error('[goals-notes] GET error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const supabase = getSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { learner_id, goals_notes } = body

    // Enforce 600 character limit
    if (goals_notes && goals_notes.length > 600) {
      return NextResponse.json({ error: 'Goals exceed 600 character limit' }, { status: 400 })
    }

    if (learner_id) {
      // Save goals for specific learner
      const { error } = await supabase
        .from('learners')
        .update({ goals_notes: goals_notes || null })
        .eq('id', learner_id)
        .eq('facilitator_id', session.user.id)

      if (error) {
        console.error('[goals-notes] Save error:', error)
        return NextResponse.json({ error: 'Failed to save goals' }, { status: 500 })
      }
    } else {
      // Save facilitator's own goals
      const { error } = await supabase
        .from('profiles')
        .update({ goals_notes: goals_notes || null })
        .eq('id', session.user.id)

      if (error) {
        console.error('[goals-notes] Save error:', error)
        return NextResponse.json({ error: 'Failed to save goals' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[goals-notes] POST error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
