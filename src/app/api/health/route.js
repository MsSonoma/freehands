// Health check endpoint for deployment diagnostics
// - No sensitive literal values
// - Detailed env presence only in non-production
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function json(data, init = {}) {
  // Add no-store to avoid caching health responses
  const headers = new Headers(init.headers || {})
  headers.set('Cache-Control', 'no-store, max-age=0')
  return NextResponse.json(data, { ...init, headers })
}

export async function GET(req) {
  const url = new URL(req.url)
  const isProd = process.env.NODE_ENV === 'production'
  const wantDetail = url.searchParams.get('detail') === '1'

  // Only env var names; never include literal values
  const keys = [
    // Supabase
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    // Stripe
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_PRICE_STANDARD',
    'STRIPE_PRICE_PRO',
    'STRIPE_WEBHOOK_SECRET',
    // App
    'APP_URL',
  ]

  const ttsConfigured = Boolean(
    process.env.GOOGLE_TTS_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS
  )

  // In production: minimal payload only
  if (isProd && !wantDetail) {
    return json({
      ok: true,
      runtime: 'nodejs',
      node: process.versions?.node,
      region: process.env.VERCEL_REGION || 'unknown',
      tts: ttsConfigured ? 'configured' : 'not-configured',
      health: 'green',
    })
  }

  // Non-production (or explicit detail=1): show presence/missing without values
  const env = Object.fromEntries(
    keys.map((k) => [k, process.env[k] ? 'present' : 'missing'])
  )

  return json({
    ok: true,
    runtime: 'nodejs',
    node: process.versions?.node,
    region: process.env.VERCEL_REGION || 'unknown',
    env,
    tts: ttsConfigured ? 'configured' : 'not-configured',
  })
}
