// API for Mr. Mentor conversation memory
// Manages clipboard knowledge of facilitator and learner conversations
// Auto-updated with each back-and-forth

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = 'gpt-4o-mini' // Using mini for summarization (faster, cheaper)

// Helper: Get authenticated user
async function getAuthenticatedUser(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Authentication required', status: 401 }
  }

  const token = authHeader.replace('Bearer ', '')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    return { error: 'Database not configured', status: 500 }
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false }
  })

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return { error: 'Invalid authentication', status: 401 }
  }

  return { user, supabase }
}

// Helper: Generate conversation summary using OpenAI
async function generateSummary(conversationTurns, existingSummary = null) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  // Build prompt for summarization
  let prompt = ''
  if (existingSummary) {
    prompt = `You are updating a conversation summary. Here is the existing summary:

${existingSummary}

And here are the new conversation turns to incorporate:

${conversationTurns.map((turn, i) => `${turn.role === 'user' ? 'Facilitator' : 'Mr. Mentor'}: ${turn.content}`).join('\n\n')}

Update the summary to include the new information. Keep it concise but comprehensive (200-400 words). Focus on:
- Main topics discussed
- Key insights or advice given
- Action items or plans
- Emotional tone and concerns
- Progress or changes from previous summary

Updated summary:`
  } else {
    prompt = `You are creating a conversation summary for a counseling session between a homeschool facilitator and Mr. Mentor (an AI counselor).

Here is the conversation:

${conversationTurns.map((turn, i) => `${turn.role === 'user' ? 'Facilitator' : 'Mr. Mentor'}: ${turn.content}`).join('\n\n')}

Create a concise but comprehensive summary (200-400 words) that captures:
- Main topics discussed
- Key insights or advice given
- Action items or plans
- Emotional tone and concerns expressed
- Any learner-specific context mentioned

Summary:`
  }

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: 'You are a professional summarizer for counseling sessions. Create clear, empathetic summaries that preserve important context.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 600,
      temperature: 0.3 // Lower temperature for more consistent summaries
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status}`)
  }

  const data = await response.json()
  const summary = data.choices?.[0]?.message?.content?.trim()
  
  if (!summary) {
    throw new Error('No summary generated')
  }

  return summary
}

// POST: Update or create conversation memory
export async function POST(request) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { user, supabase } = auth
    const body = await request.json()
    const { learner_id = null, conversation_turns = [], force_regenerate = false } = body

    if (!Array.isArray(conversation_turns) || conversation_turns.length === 0) {
      return NextResponse.json({ error: 'Conversation turns required' }, { status: 400 })
    }

    console.log(`[Conversation Memory] Updating memory for facilitator ${user.id}, learner ${learner_id || 'none'}, turns: ${conversation_turns.length}`)

    // Get existing conversation update
    const { data: existing, error: fetchError } = await supabase
      .from('conversation_updates')
      .select('*')
      .eq('facilitator_id', user.id)
      .eq('learner_id', learner_id)
      .maybeSingle()

    if (fetchError) {
      console.error('[Conversation Memory] Error fetching existing:', fetchError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Generate or update summary
    let summary
    try {
      summary = await generateSummary(
        conversation_turns, 
        force_regenerate ? null : existing?.summary
      )
    } catch (summaryError) {
      console.error('[Conversation Memory] Summary generation failed:', summaryError)
      return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
    }

    // Prepare recent turns (keep last 10 for context)
    const recentTurns = conversation_turns.slice(-10)

    if (existing) {
      // Update existing record
      const { data: updated, error: updateError } = await supabase
        .from('conversation_updates')
        .update({
          summary: summary,
          recent_turns: recentTurns,
          turn_count: (existing.turn_count || 0) + conversation_turns.length,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (updateError) {
        console.error('[Conversation Memory] Update error:', updateError)
        return NextResponse.json({ error: 'Failed to update conversation memory' }, { status: 500 })
      }

      console.log(`[Conversation Memory] Updated record ${updated.id}, now ${updated.turn_count} total turns`)

      return NextResponse.json({
        success: true,
        conversation_update: updated,
        message: 'Conversation memory updated'
      })
    } else {
      // Create new record
      const { data: created, error: insertError } = await supabase
        .from('conversation_updates')
        .insert({
          facilitator_id: user.id,
          learner_id: learner_id,
          summary: summary,
          recent_turns: recentTurns,
          turn_count: conversation_turns.length
        })
        .select()
        .single()

      if (insertError) {
        console.error('[Conversation Memory] Insert error:', insertError)
        return NextResponse.json({ error: 'Failed to create conversation memory' }, { status: 500 })
      }

      console.log(`[Conversation Memory] Created new record ${created.id}`)

      return NextResponse.json({
        success: true,
        conversation_update: created,
        message: 'Conversation memory created'
      })
    }
  } catch (error) {
    console.error('[Conversation Memory] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET: Retrieve conversation memory
export async function GET(request) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { user, supabase } = auth
    const { searchParams } = new URL(request.url)
    const learnerId = searchParams.get('learner_id')
    const search = searchParams.get('search')
    const includeArchive = searchParams.get('include_archive') === 'true'

    // Search across conversation summaries (fuzzy)
    if (search) {
      console.log(`[Conversation Memory] Searching for: "${search}"`)

      // Use PostgreSQL full-text search with ranking
      let query = supabase
        .from('conversation_updates')
        .select('*')
        .eq('facilitator_id', user.id)
        .textSearch('summary', search, {
          type: 'websearch',
          config: 'english'
        })
        .order('updated_at', { ascending: false })
        .limit(20)

      const { data: currentResults, error: currentError } = await query

      if (currentError) {
        console.error('[Conversation Memory] Search error:', currentError)
        return NextResponse.json({ error: 'Search failed' }, { status: 500 })
      }

      let results = currentResults || []

      // Also search archive if requested
      if (includeArchive) {
        const { data: archiveResults, error: archiveError } = await supabase
          .from('conversation_history_archive')
          .select('*')
          .eq('facilitator_id', user.id)
          .textSearch('search_vector', search, {
            type: 'websearch',
            config: 'english'
          })
          .order('archived_at', { ascending: false })
          .limit(20)

        if (!archiveError && archiveResults) {
          results = [...results, ...archiveResults.map(r => ({ ...r, archived: true }))]
        }
      }

      // Fallback to basic text matching if no results
      if (results.length === 0) {
        const { data: fallbackResults } = await supabase
          .from('conversation_updates')
          .select('*')
          .eq('facilitator_id', user.id)
          .ilike('summary', `%${search}%`)
          .order('updated_at', { ascending: false })
          .limit(20)

        results = fallbackResults || []
      }

      console.log(`[Conversation Memory] Found ${results.length} results for "${search}"`)

      return NextResponse.json({
        success: true,
        results: results,
        count: results.length,
        query: search
      })
    }

    // Get specific conversation memory (latest for facilitator or learner)
    let query = supabase
      .from('conversation_updates')
      .select('*')
      .eq('facilitator_id', user.id)

    if (learnerId) {
      query = query.eq('learner_id', learnerId)
    } else {
      query = query.is('learner_id', null)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      console.error('[Conversation Memory] Fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch conversation memory' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({
        success: true,
        conversation_update: null,
        message: 'No conversation memory found'
      })
    }

    console.log(`[Conversation Memory] Retrieved record ${data.id} with ${data.turn_count} turns`)

    return NextResponse.json({
      success: true,
      conversation_update: data
    })
  } catch (error) {
    console.error('[Conversation Memory] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Clear conversation memory (archives automatically via trigger)
export async function DELETE(request) {
  try {
    const auth = await getAuthenticatedUser(request)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { user, supabase } = auth
    const { searchParams } = new URL(request.url)
    const learnerId = searchParams.get('learner_id')

    let query = supabase
      .from('conversation_updates')
      .delete()
      .eq('facilitator_id', user.id)

    if (learnerId) {
      query = query.eq('learner_id', learnerId)
    } else {
      query = query.is('learner_id', null)
    }

    const { error } = await query

    if (error) {
      console.error('[Conversation Memory] Delete error:', error)
      return NextResponse.json({ error: 'Failed to delete conversation memory' }, { status: 500 })
    }

    console.log(`[Conversation Memory] Deleted conversation memory for facilitator ${user.id}, learner ${learnerId || 'none'}`)

    return NextResponse.json({
      success: true,
      message: 'Conversation memory cleared (archived for history)'
    })
  } catch (error) {
    console.error('[Conversation Memory] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
