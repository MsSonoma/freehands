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

    const { email, plan } = await req.json().catch(() => ({}));
    const normalizedEmail = (email || '').trim().toLowerCase();
    const normalizedPlan = (plan || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }
    if (!['free','basic','plus','premium'].includes(normalizedPlan)) {
      return NextResponse.json({ error: 'Invalid plan; use free|basic|plus|premium' }, { status: 400 });
    }

    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
    const admin = supabase.auth.admin;

    // Find user by email
    let user = null;
    if (typeof admin.getUserByEmail === 'function') {
      const { data, error } = await admin.getUserByEmail(normalizedEmail);
      if (error && !/not.*found/i.test(error.message || '')) {
        return NextResponse.json({ error: error.message || 'Failed to lookup user' }, { status: 500 });
      }
      user = data?.user || null;
    }
    if (!user) {
      let page = 1; const perPage = 1000;
      for (;;) {
        const { data, error } = await admin.listUsers({ page, perPage });
        if (error) return NextResponse.json({ error: error.message || 'Failed to list users' }, { status: 500 });
        const found = (data?.users || []).find(u => (u.email || '').toLowerCase() === normalizedEmail);
        if (found) { user = found; break; }
        if (!data || (data.users || []).length < perPage) break;
        page += 1; if (page > 100) break;
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Upsert profile plan_tier
    const { error: upErr } = await supabase
      .from('profiles')
      .upsert({ id: user.id, plan_tier: normalizedPlan }, { onConflict: 'id' });
    if (upErr) return NextResponse.json({ error: upErr.message || 'Failed to set plan' }, { status: 500 });

    return NextResponse.json({ ok: true, user_id: user.id, email: user.email, plan: normalizedPlan });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 });
  }
}

// Provide a no-op GET to avoid build-time module resolution issues if Next tries to
// prefetch or inspect the route for static analysis. Returns 405 instructing clients
// to use POST. (Some Next.js internals may attempt to load the file generically.)
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 });
}
