import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, anon, service };
}

async function getUserFromAuthHeader(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.split(' ')[1];
  const { url, anon } = getEnv();
  if (!url || !anon) return null;
  const supabase = createClient(url, anon, { auth: { persistSession: false } });
  const { data } = await supabase.auth.getUser(token);
  return data?.user || null;
}

export async function POST(req) {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const reasons = Array.isArray(body?.reasons) ? body.reasons.filter(x => typeof x === 'string' && x.trim()).slice(0, 10) : [];
    const message = typeof body?.message === 'string' ? body.message.slice(0, 2000) : null;
    const allowContact = Boolean(body?.allowContact);

    const { url, service } = getEnv();
    const svc = createClient(url, service, { auth: { persistSession: false } });
    const payload = { user_id: user.id, reasons, message, allow_contact: allowContact, created_at: new Date().toISOString() };
    const { error } = await svc.from('cancellation_feedback').insert(payload);
    if (error) {
      const msg = (error?.message || '').toLowerCase();
      const hint = msg.includes('relation "cancellation_feedback" does not exist')
        ? 'Create the cancellation_feedback table. See docs/cancellation-feedback.md.'
        : undefined;
      return NextResponse.json({ stored: false, hint }, { status: 200 });
    }
    return NextResponse.json({ stored: true });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
