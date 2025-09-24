import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon) return null;
  return {
    pub: createClient(url, anon, { auth: { persistSession: false } }),
    svc: service ? createClient(url, service, { auth: { persistSession: false } }) : null,
  };
}

export async function GET() {
  try {
    const clients = getClients();
    if (!clients) {
      return NextResponse.json({ ok: false, reason: 'no-supabase-env', hint: 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY' }, { status: 200 });
    }
    const { pub } = clients;
    // Probe medals table existence via an anonymous select (RLS may return 0 rows but should not 404).
    const { data, error, status } = await pub.from('learner_medals').select('*', { count: 'exact', head: true });
    if (error) {
      const msg = (error.message || '').toLowerCase();
      const missing = status === 404 || msg.includes('does not exist') || msg.includes('relation') || msg.includes('not found');
      if (missing) {
        return NextResponse.json({ ok: false, reason: 'missing-table', table: 'learner_medals', hintFile: '/docs/medals-schema.sql' }, { status: 200 });
      }
      return NextResponse.json({ ok: false, reason: 'query-error', detail: error.message }, { status: 200 });
    }
    return NextResponse.json({ ok: true, reason: 'present' }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: 'exception', detail: e?.message || String(e) }, { status: 200 });
  }
}
