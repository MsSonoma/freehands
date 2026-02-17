// ThoughtHub chronograph access for Mr. Mentor
// Provides deterministic recent event history for a given subjectKey.

import { NextResponse } from 'next/server'
import {
  cohereGetUserAndClient,
  cohereEnsureThread,
  cohereBuildPack,
  thoughtHubUpsertEventsDeduped
} from '@/app/lib/cohereStyleMentor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function packEventsToChatHistory(pack) {
  const events = Array.isArray(pack?.recent_events) ? pack.recent_events : []
  return events
    .map((e) => {
      if (!e || typeof e.text !== 'string') return null
      const role = e.role === 'assistant' ? 'assistant' : (e.role === 'user' ? 'user' : 'system')
      const content = e.text
      return { role, content }
    })
    .filter(Boolean)
}

export async function GET(req) {
  try {
    const auth = await cohereGetUserAndClient(req)
    if (auth?.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { supabase } = auth
    const authHeader = req.headers.get('authorization')
    const cookieHeader = req.headers.get('cookie')

    const { searchParams } = new URL(req.url)
    const subjectKey = (searchParams.get('subjectKey') || '').trim()
    const sector = (searchParams.get('sector') || 'both').trim()
    const mode = (searchParams.get('mode') || 'minimal').trim()
    const ingestFallback = (searchParams.get('ingestFallback') || '1').trim() !== '0'

    if (!subjectKey) {
      return NextResponse.json({ error: 'subjectKey required' }, { status: 400 })
    }

    const { tenantId, threadId } = await cohereEnsureThread({ supabase, sector, subjectKey })

    // ThoughtHub backfill bridge:
    // If legacy conversation history exists (mentor_conversation_threads via /api/mentor-session),
    // ingest it into ThoughtHub events and then clear the legacy JSON.
    if (ingestFallback && authHeader) {
      try {
        const origin = new URL(req.url).origin
        const legacyUrl = new URL('/api/mentor-session', origin)
        legacyUrl.searchParams.set('subjectKey', subjectKey)

        const legacyRes = await fetch(legacyUrl.toString(), {
          method: 'GET',
          headers: {
            Authorization: authHeader,
            ...(cookieHeader ? { Cookie: cookieHeader } : {})
          },
          cache: 'no-store'
        })

        if (legacyRes.ok) {
          const legacyJson = await legacyRes.json().catch(() => null)
          const isOwner = !!legacyJson?.isOwner
          const legacyHistory = legacyJson?.session?.conversation_history

          if (isOwner && Array.isArray(legacyHistory) && legacyHistory.length > 0) {
            const rows = legacyHistory
              .map((m, idx) => {
                const role = m?.role === 'assistant' ? 'assistant' : (m?.role === 'user' ? 'user' : (m?.role === 'system' ? 'system' : null))
                const text = typeof m?.content === 'string' ? m.content : ''
                if (!role) return null
                if (!text.trim()) return null
                return {
                  tenant_id: tenantId,
                  thread_id: threadId,
                  role,
                  text,
                  dedupe_key: `legacy:${subjectKey}:${idx}`,
                  meta: {
                    source: 'legacy_mentor_conversation_threads',
                    subjectKey,
                    legacy_index: idx
                  }
                }
              })
              .filter(Boolean)

            if (rows.length > 0) {
              await thoughtHubUpsertEventsDeduped({ supabase, events: rows })

              const clearRes = await fetch(new URL('/api/mentor-session', origin).toString(), {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: authHeader,
                  ...(cookieHeader ? { Cookie: cookieHeader } : {})
                },
                body: JSON.stringify({
                  subjectKey,
                  conversationHistory: [],
                  lastLocalUpdateAt: new Date().toISOString()
                })
              })

              // If clear fails, we leave legacy as-is; ingestion is idempotent once dedupe_key exists.
              void clearRes
            }
          }
        }
      } catch {
        // Silent failure: never block chronograph read path.
      }
    }

    const pack = await cohereBuildPack({
      supabase,
      tenantId,
      threadId,
      sector,
      question: '',
      mode
    })

    const history = packEventsToChatHistory(pack)

    return NextResponse.json({
      tenantId,
      threadId,
      sector,
      subjectKey,
      pack,
      history
    })
  } catch (err) {
    return NextResponse.json({ error: 'Chronograph unavailable' }, { status: 500 })
  }
}
