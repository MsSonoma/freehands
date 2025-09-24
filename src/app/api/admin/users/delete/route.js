import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminToken = process.env.ADMIN_API_TOKEN; // set this to a strong random value
    const adminEnabled = process.env.ADMIN_API_ENABLED === 'true';

    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Supabase service not configured on server' }, { status: 503 });
    }
    // Safety: disable in production unless explicitly enabled
    if (process.env.NODE_ENV === 'production' && !adminEnabled) {
      return NextResponse.json({ error: 'Admin API disabled in production' }, { status: 403 });
    }

    const authz = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authz || !authz.startsWith('Bearer ') || !adminToken || authz.split(' ')[1] !== adminToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const email = body?.email?.trim?.();
    if (!email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
    const admin = supabase.auth.admin;

    let user = null;
    // Prefer getUserByEmail if available
    if (typeof admin.getUserByEmail === 'function') {
      const { data, error } = await admin.getUserByEmail(email);
      if (error && !/not.*found/i.test(error.message || '')) {
        return NextResponse.json({ error: error.message || 'Failed to lookup user' }, { status: 500 });
      }
      user = data?.user || null;
    }

    // Fallback: listUsers and filter by email
    if (!user) {
      let page = 1; const perPage = 1000;
      for (;;) {
        const { data, error } = await admin.listUsers({ page, perPage });
        if (error) {
          return NextResponse.json({ error: error.message || 'Failed to list users' }, { status: 500 });
        }
        const found = (data?.users || []).find(u => (u.email || '').toLowerCase() === email.toLowerCase());
        if (found) { user = found; break; }
        if (!data || (data.users || []).length < perPage) break; // no more pages
        page += 1;
        if (page > 100) break; // safety cap
      }
    }

    if (!user) {
      return NextResponse.json({ ok: true, message: 'User not found; nothing to delete' }, { status: 200 });
    }

    const { error: delErr } = await admin.deleteUser(user.id);
    if (delErr) {
      return NextResponse.json({ error: delErr.message || 'Failed to delete user' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deletedUserId: user.id });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
