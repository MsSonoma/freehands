// API for Mr. Mentor conversation drafts (unapproved summaries)
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// OpenAI configuration
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = 'gpt-4o-mini' // Using mini for draft summarization (same task as conversation-memory)

function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceKey) return null
  return createClient(supabaseUrl, supabaseServiceKey)
}

// GET: Retrieve current draft for a facilitator/learner pair
export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = getSupabaseAdmin()
    if (!supabase) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    }

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Get learner_id from query params
    const { searchParams } = new URL(request.url)
    const learner_id = searchParams.get('learner_id') || null
    
    // Normalize learner_id: convert string "null" or empty string to actual null
    const normalizedLearnerId = (learner_id === 'null' || learner_id === '' || !learner_id) ? null : learner_id
    
    // Fetch draft
    // Note: Use .is() for null values, .eq() for non-null values
    let query = supabase
      .from('conversation_drafts')
      .select('*')
      .eq('facilitator_id', user.id)
    
    if (normalizedLearnerId === null) {
      query = query.is('learner_id', null)
    } else {
      query = query.eq('learner_id', normalizedLearnerId)
    }
    
    const { data: draft, error: fetchError } = await query.maybeSingle()

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch draft' }, { status: 500 })
    }
    
    return NextResponse.json({
      draft: draft || null
    })

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Update or create draft summary (incremental updates)
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = getSupabaseAdmin()
    if (!supabase) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    }

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { learner_id = null, conversation_turns = [] } = body
    
    // Normalize learner_id: convert string "null" or empty string to actual null
    const normalizedLearnerId = (learner_id === 'null' || learner_id === '' || !learner_id) ? null : learner_id

    // Fetch existing draft
    // Note: Use .is() for null values, .eq() for non-null values
    let query = supabase
      .from('conversation_drafts')
      .select('*')
      .eq('facilitator_id', user.id)
    
    if (normalizedLearnerId === null) {
      query = query.is('learner_id', null)
    } else {
      query = query.eq('learner_id', normalizedLearnerId)
    }
    
    const { data: existing, error: fetchError } = await query.maybeSingle()

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to check existing draft', details: fetchError.message }, { status: 500 })
    }

    // Generate summary using OpenAI
    const summaryText = await generateDraftSummary(conversation_turns, existing?.draft_summary)

    if (!summaryText) {
      return NextResponse.json({ error: 'Failed to generate summary', details: 'OpenAI call failed or returned empty' }, { status: 500 })
    }
    
    // Update or insert draft
    if (existing) {
      // Update existing draft
      const { data: updated, error: updateError } = await supabase
        .from('conversation_drafts')
        .update({
          draft_summary: summaryText,
          recent_turns: conversation_turns,
          turn_count: (existing.turn_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (updateError) {
        return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Draft updated',
        draft: updated
      })

    } else {
      // Create new draft
      const { data: created, error: insertError } = await supabase
        .from('conversation_drafts')
        .insert({
          facilitator_id: user.id,
          learner_id: normalizedLearnerId,
          draft_summary: summaryText,
          recent_turns: conversation_turns,
          turn_count: 1
        })
        .select()
        .single()

      if (insertError) {
        return NextResponse.json({ error: 'Failed to create draft' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Draft created',
        draft: created
      })
    }

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Remove draft (user chose to delete conversation)
export async function DELETE(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = getSupabaseAdmin()
    if (!supabase) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    }

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Get learner_id from query params
    const { searchParams } = new URL(request.url)
    const learner_id = searchParams.get('learner_id') || null
    
    // Normalize learner_id: convert string "null" or empty string to actual null
    const normalizedLearnerId = (learner_id === 'null' || learner_id === '' || !learner_id) ? null : learner_id

    // Delete draft
    // Note: Use .is() for null values, .eq() for non-null values
    let query = supabase
      .from('conversation_drafts')
      .delete()
      .eq('facilitator_id', user.id)
    
    if (normalizedLearnerId === null) {
      query = query.is('learner_id', null)
    } else {
      query = query.eq('learner_id', normalizedLearnerId)
    }
    
    const { error: deleteError } = await query

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Draft deleted'
    })

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper: Generate incremental summary using OpenAI
async function generateDraftSummary(conversationTurns, existingSummary = null) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return null
    }

    // Build prompt for incremental summarization
    let prompt = ''
    if (existingSummary) {
      prompt = `You are updating a conversation summary. Here is the existing summary:

${existingSummary}

Here are the most recent turns to incorporate:

${conversationTurns.map(t => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`).join('\n\n')}

Please provide an updated summary in 3-5 complete sentences (max 600 characters). Focus on key topics, decisions, and concrete actions taken (lessons generated, lessons scheduled, edits made). EXCLUDE the assistant's formulaic ending questions - those are just conversational prompts, not meaningful content. End with a complete sentence - do not cut off mid-thought.`
    } else {
      prompt = `Please summarize the following conversation in 3-5 complete sentences (max 600 characters). Focus on key topics, decisions, and concrete actions taken (lessons generated, lessons scheduled, edits made). EXCLUDE the assistant's formulaic ending questions - those are just conversational prompts, not meaningful content. End with a complete sentence - do not cut off mid-thought:

${conversationTurns.map(t => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`).join('\n\n')}`
    }

    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 300,
        temperature: 0.3
      })
    })

    if (!response.ok) {
      // Silent error
      return null
    }

    const data = await response.json()
    const summaryText = data.choices[0]?.message?.content?.trim() || ''
    
    if (!summaryText) {
      return null
    }
    
    // Return the summary as-is (GPT should respect the length constraint in the prompt)
    return summaryText

  } catch (error) {
    return null
  }
}
