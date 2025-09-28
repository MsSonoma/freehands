import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

async function getUserFromAuthHeader(req) {
  try {
    const auth = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) return null;
    const token = auth.split(' ')[1];
    const { url, anon } = getEnv();
    if (!url || !anon) return null;
    const supabase = createClient(url, anon, { auth: { persistSession: false } });
    const { data } = await supabase.auth.getUser(token);
    return data?.user || null;
  } catch {
    return null;
  }
}

export async function GET(req) {
  try {
    const { url, service } = getEnv();
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ ok: true, timezone: null });

    // If service role is not configured, return safe default so client can fall back to metadata
    if (!url || !service) return NextResponse.json({ ok: true, timezone: null });

    const svc = createClient(url, service, { auth: { persistSession: false } });
    const { data, error } = await svc
      .from('profiles')
      .select('timezone')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      // Table/column/RLS issues — return default instead of an error
      return NextResponse.json({ ok: true, timezone: null });
    }

    const tz = (data?.timezone && typeof data.timezone === 'string') ? data.timezone : null;
    return NextResponse.json({ ok: true, timezone: tz });
  } catch (e) {
    return NextResponse.json({ ok: true, timezone: null });
  }
}

export async function PUT(req) {
  try {
    const { url, service } = getEnv();
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const timezone = typeof body?.timezone === 'string' ? body.timezone : '';
    if (!timezone || timezone.length > 128) {
      // Be lenient; client can still mirror to metadata
      return NextResponse.json({ ok: false, error: 'Invalid timezone' }, { status: 400 });
    }

    if (!url || !service) {
      // Not configured; allow client to fall back to auth metadata without surfacing server errors
      return NextResponse.json({ ok: false, error: 'Not configured' }, { status: 503 });
    }

    const svc = createClient(url, service, { auth: { persistSession: false } });
    const { error } = await svc
      .from('profiles')
      .update({ timezone, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) return NextResponse.json({ ok: false, error: error.message || 'Failed to save timezone' }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}
