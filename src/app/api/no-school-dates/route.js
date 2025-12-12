// API route for no-school dates
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
      global: { headers: { Authorization: `Bearer ```` } }
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
      .from('no_school_dates')
      .select('*')
      .eq('facilitator_id', user.id)
      .eq('learner_id', learnerId)

    if (error) {
      console.error('Error fetching no-school dates:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ dates: data || [] })
  } catch (err) {
    console.error('No-school dates GET error:', err)
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
      global: { headers: { Authorization: `Bearer ```` } }
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { learnerId, date, reason } = body

    if (!learnerId || !date) {
      return NextResponse.json({ error: 'Learner ID and date are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('no_school_dates')
      .upsert({
        facilitator_id: user.id,
        learner_id: learnerId,
        date,
        reason: reason || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'facilitator_id,learner_id,date'
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving no-school date:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ date: data }, { status: 200 })
  } catch (err) {
    console.error('No-school dates POST error:', err)
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
      global: { headers: { Authorization: `Bearer ```` } }
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const learnerId = searchParams.get('learnerId')
    const date = searchParams.get('date')

    if (!learnerId || !date) {
      return NextResponse.json({ error: 'Learner ID and date are required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('no_school_dates')
      .delete()
      .eq('facilitator_id', user.id)
      .eq('learner_id', learnerId)
      .eq('date', date)

    if (error) {
      console.error('Error deleting no-school date:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('No-school dates DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
