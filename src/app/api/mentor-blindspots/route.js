import { NextResponse } from 'next/server'
import {
  cohereGetUserAndClient,
  cohereEnsureThread
} from '@/app/lib/cohereStyleMentor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
}

function clampInt(value, { min, max, fallback }) {
  const n = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

export async function GET(req) {
  try {
    const auth = await cohereGetUserAndClient(req)
    if (auth?.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { supabase } = auth

    const { searchParams } = new URL(req.url)
    const subjectKey = (searchParams.get('subjectKey') || 'facilitator').trim()
    const sector = (searchParams.get('sector') || 'both').trim()
    const limit = clampInt(searchParams.get('limit'), { min: 50, max: 2000, fallback: 500 })

    const { tenantId, threadId } = await cohereEnsureThread({ supabase, sector, subjectKey })

    const { data, error } = await supabase
      .from('events')
      .select('id, role, text, meta, created_at')
      .eq('tenant_id', tenantId)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const events = Array.isArray(data) ? data : []

    const blindspotEvents = events
      .map((e) => {
        const meta = e?.meta && typeof e.meta === 'object' ? e.meta : null
        const blindspot = meta?.mentor_blindspot && typeof meta.mentor_blindspot === 'object'
          ? meta.mentor_blindspot
          : null

        if (!blindspot) return null

        const query = typeof blindspot.query === 'string' && blindspot.query.trim()
          ? blindspot.query.trim()
          : (typeof e?.text === 'string' ? e.text.trim() : '')

        if (!query) return null

        return {
          id: e.id,
          role: e.role,
          created_at: e.created_at,
          query,
          blindspot
        }
      })
      .filter(Boolean)

    const byQuery = new Map()
    for (const item of blindspotEvents) {
      const key = normalizeText(item.query)
      if (!key) continue

      const existing = byQuery.get(key) || {
        key,
        query: item.query,
        count: 0,
        lastSeenAt: null,
        samples: []
      }

      existing.count += 1
      if (!existing.lastSeenAt || String(item.created_at) > String(existing.lastSeenAt)) {
        existing.lastSeenAt = item.created_at
      }

      if (existing.samples.length < 3) {
        existing.samples.push({
          created_at: item.created_at,
          query: item.query
        })
      }

      byQuery.set(key, existing)
    }

    const groups = Array.from(byQuery.values())
      .sort((a, b) => (b.count - a.count) || String(b.lastSeenAt).localeCompare(String(a.lastSeenAt)))

    return NextResponse.json({
      tenantId,
      threadId,
      subjectKey,
      sector,
      totalEventsScanned: events.length,
      blindspotEvents: blindspotEvents.length,
      groups
    })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
