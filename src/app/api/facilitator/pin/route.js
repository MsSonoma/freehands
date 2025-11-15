import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';

function getEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
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

function validatePin(pin) {
  // 4-8 digits only
  if (typeof pin !== 'string') return 'PIN must be a string';
  if (!/^\d{4,8}$/.test(pin)) return 'PIN must be 4-8 digits';
  return null;
}

function scryptHash(pin, salt) {
  const N = 16384, r = 8, p = 1; // modest defaults
  const keyLen = 64;
  const derived = crypto.scryptSync(pin, salt, keyLen, { N, r, p });
  return `s1$${salt}$${derived.toString('hex')}`;
}

function makeNewHash(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  return scryptHash(pin, salt);
}

function verifyPin(pin, stored) {
  if (typeof stored !== 'string') return false;
  // format: s1$<salt>$<hex>
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 's1') return false;
  const [, salt, hex] = parts;
  const recomputed = scryptHash(pin, salt);
  return crypto.timingSafeEqual(Buffer.from(recomputed), Buffer.from(`s1$${salt}$${hex}`));
}

export async function GET(req) {
  try {
    const { url, service } = getEnv();
    if (!url || !service) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = createClient(url, service, { auth: { persistSession: false } });
    const { data, error } = await svc.from('profiles').select('facilitator_pin_hash, facilitator_pin_prefs').eq('id', user.id).maybeSingle();
    // If column/table missing or RLS blocks, return safe defaults so UI can fall back to local storage
    if (error) {
      return NextResponse.json({ ok: true, hasPin: false, prefs: null });
    }
    const hasPin = Boolean(data?.facilitator_pin_hash);
    // Default prefs when unset
    const prefs = data?.facilitator_pin_prefs || null;
    return NextResponse.json({ ok: true, hasPin, prefs });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { url, service } = getEnv();
    if (!url || !service) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    }
    const user = await getUserFromAuthHeader(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

  const body = await req.json().catch(() => ({}));
  const newPin = `${body?.pin ?? ''}`;
    const currentPin = body?.currentPin != null ? `${body.currentPin}` : null;
    const v = validatePin(newPin);
    if (v) {
      return NextResponse.json({ error: v }, { status: 400 });
    }

    const svc = createClient(url, service, { auth: { persistSession: false } });

    // If a PIN already exists, require currentPin and verify
    const { data: row, error: readErr } = await svc
      .from('profiles')
      .select('facilitator_pin_hash')
      .eq('id', user.id)
      .maybeSingle();
    if (readErr) {
      return NextResponse.json({ error: readErr.message || 'Failed to read' }, { status: 500 });
    }

    if (row?.facilitator_pin_hash) {
      if (!currentPin) {
        return NextResponse.json({ error: 'Current PIN required' }, { status: 400 });
      }
      const ok = verifyPin(currentPin, row.facilitator_pin_hash);
      if (!ok) {
        return NextResponse.json({ error: 'Current PIN is incorrect' }, { status: 403 });
      }
    }

    const hash = makeNewHash(newPin);
    // Allow optional prefs update in same call
    const prefs = (body && typeof body.prefs === 'object') ? body.prefs : undefined;
    const payload = { 
      id: user.id,
      facilitator_pin_hash: hash, 
      updated_at: new Date().toISOString() 
    };
    if (prefs) payload.facilitator_pin_prefs = prefs;
    const { error: upsertErr } = await svc
      .from('profiles')
      .upsert(payload, { onConflict: 'id' });
    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message || 'Failed to save' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { url, service } = getEnv();
    if (!url || !service) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = createClient(url, service, { auth: { persistSession: false } });
    const { error } = await svc
      .from('profiles')
      .update({ facilitator_pin_hash: null, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) return NextResponse.json({ error: error.message || 'Failed to clear PIN' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}

// Update preferences without changing the PIN
export async function PUT(req) {
  try {
    const { url, service } = getEnv();
    if (!url || !service) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    const user = await getUserFromAuthHeader(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(()=>({}));
    const prefs = (body && typeof body.prefs === 'object') ? body.prefs : null;
    if (!prefs) return NextResponse.json({ error: 'prefs object required' }, { status: 400 });
    const svc = createClient(url, service, { auth: { persistSession: false } });
    const { error } = await svc
      .from('profiles')
      .update({ facilitator_pin_prefs: prefs, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) return NextResponse.json({ error: error.message || 'Failed to save prefs' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 });
  }
}
