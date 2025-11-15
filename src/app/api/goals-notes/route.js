// API endpoint for persistent goals/notes
// GET: Load goals for learner or facilitator
// POST: Save goals for learner or facilitator

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getCookieValue(cookieHeader, name) {
  if (!cookieHeader || !name) return null
  const parts = cookieHeader.split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.startsWith(`${name}=`)) {
      try {
        return decodeURIComponent(trimmed.slice(name.length + 1))
      } catch {
        return null
      }
    }
  }
  return null
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}

export async function GET(request) {
  try {
    const supabase = getSupabaseServiceClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }
    
    // Try Bearer token first
    const authHeader = request.headers.get('authorization')
    let session = null
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (!error && user) {
        session = { user }
      }
    }
    
    // Fallback to cookie-based session
    if (!session) {
      const cookieHeader = request.headers.get('cookie')
      const accessToken = getCookieValue(cookieHeader, 'sb-access-token')
      if (accessToken) {
        const { data: { user }, error } = await supabase.auth.getUser(accessToken)
        if (!error && user) {
          session = { user }
        }
      }
    }
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const learnerId = searchParams.get('learner_id')

    if (learnerId) {
      // Load goals for specific learner
      
      // First check if learner exists at all
      const { data: checkData, error: checkError } = await supabase
        .from('learners')
        .select('id, facilitator_id, goals_notes')
        .eq('id', learnerId)
        .maybeSingle()
      
      const { data, error } = await supabase
        .from('learners')
        .select('goals_notes')
        .eq('id', learnerId)
        .eq('facilitator_id', session.user.id)
        .maybeSingle()

      if (error) {
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
        return NextResponse.json({ error: 'Failed to load goals' }, { status: 500 })
      }

      return NextResponse.json({ goals_notes: data?.goals_notes || '' })
    }
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const supabase = getSupabaseServiceClient()
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }
    
    // Try Bearer token first
    const authHeader = request.headers.get('authorization')
    let session = null
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (!error && user) {
        session = { user }
      }
    }
    
    // Fallback to cookie-based session
    if (!session) {
      const cookieHeader = request.headers.get('cookie')
      const accessToken = getCookieValue(cookieHeader, 'sb-access-token')
      if (accessToken) {
        const { data: { user }, error } = await supabase.auth.getUser(accessToken)
        if (!error && user) {
          session = { user }
        }
      }
    }
    
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
      const { data, error, count } = await supabase
        .from('learners')
        .update({ goals_notes: goals_notes || null })
        .eq('id', learner_id)
        .eq('facilitator_id', session.user.id)
        .select()

      if (error) {
        return NextResponse.json({ error: 'Failed to save goals', detail: error.message }, { status: 500 })
      }
      
      if (!data || data.length === 0) {
        return NextResponse.json({ error: 'Learner not found or access denied' }, { status: 404 })
      }
      
    } else {
      // Save facilitator's own goals
      const { data, error } = await supabase
        .from('profiles')
        .update({ goals_notes: goals_notes || null })
        .eq('id', session.user.id)
        .select()

      if (error) {
        return NextResponse.json({ error: 'Failed to save goals', detail: error.message }, { status: 500 })
      }
      
      if (!data || data.length === 0) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
      }
      
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
