// API for Mr. Mentor conversation drafts (unapproved summaries)
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

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

    // Fetch draft
    const { data: draft, error: fetchError } = await supabase
      .from('conversation_drafts')
      .select('*')
      .eq('facilitator_id', user.id)
      .eq('learner_id', learner_id)
      .maybeSingle()

    if (fetchError) {
      console.error('[Conversation Drafts] Fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch draft' }, { status: 500 })
    }

    return NextResponse.json({
      draft: draft || null
    })

  } catch (error) {
    console.error('[Conversation Drafts] Unexpected error:', error)
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

    console.log(`[Conversation Drafts] Updating draft for facilitator ${user.id}, learner ${learner_id || 'none'}, turns: ${conversation_turns.length}`)

    // Fetch existing draft
    const { data: existing, error: fetchError } = await supabase
      .from('conversation_drafts')
      .select('*')
      .eq('facilitator_id', user.id)
      .eq('learner_id', learner_id)
      .maybeSingle()

    if (fetchError) {
      console.error('[Conversation Drafts] Error fetching existing:', fetchError)
      return NextResponse.json({ error: 'Failed to check existing draft' }, { status: 500 })
    }

    // Generate summary using Claude
    const summaryText = await generateDraftSummary(conversation_turns, existing?.draft_summary)

    if (!summaryText) {
      console.error('[Conversation Drafts] Summary generation failed')
      return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
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
        console.error('[Conversation Drafts] Update error:', updateError)
        return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 })
      }

      console.log(`[Conversation Drafts] Updated draft ${updated.id}, now ${updated.turn_count} total turns`)
      
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
          learner_id,
          draft_summary: summaryText,
          recent_turns: conversation_turns,
          turn_count: 1
        })
        .select()
        .single()

      if (insertError) {
        console.error('[Conversation Drafts] Insert error:', insertError)
        return NextResponse.json({ error: 'Failed to create draft' }, { status: 500 })
      }

      console.log(`[Conversation Drafts] Created new draft ${created.id}`)
      
      return NextResponse.json({
        success: true,
        message: 'Draft created',
        draft: created
      })
    }

  } catch (error) {
    console.error('[Conversation Drafts] Unexpected error:', error)
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

    // Delete draft
    const { error: deleteError } = await supabase
      .from('conversation_drafts')
      .delete()
      .eq('facilitator_id', user.id)
      .eq('learner_id', learner_id)

    if (deleteError) {
      console.error('[Conversation Drafts] Delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 })
    }

    console.log(`[Conversation Drafts] Deleted draft for facilitator ${user.id}, learner ${learner_id || 'none'}`)

    return NextResponse.json({
      success: true,
      message: 'Draft deleted'
    })

  } catch (error) {
    console.error('[Conversation Drafts] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper: Generate incremental summary using Claude
async function generateDraftSummary(conversationTurns, existingSummary = null) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('[Conversation Drafts] Missing Anthropic API key')
      return null
    }

    const anthropic = new Anthropic({ apiKey })

    // Build prompt for incremental summarization
    let prompt = ''
    if (existingSummary) {
      prompt = `You are updating a conversation summary. Here is the existing summary:

${existingSummary}

Here are the most recent turns to incorporate:

${conversationTurns.map(t => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`).join('\n\n')}

Please provide an updated, concise summary (max 500 characters) that incorporates the new information while maintaining context. Focus on key topics, decisions, and insights.`
    } else {
      prompt = `Please summarize the following conversation concisely (max 500 characters). Focus on key topics, decisions, and insights:

${conversationTurns.map(t => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`).join('\n\n')}`
    }

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 300,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const summaryText = response.content[0]?.text?.trim() || ''
    
    // Ensure it fits within 500 char limit
    return summaryText.substring(0, 500)

  } catch (error) {
    console.error('[Conversation Drafts] Summary generation error:', error)
    return null
  }
}
