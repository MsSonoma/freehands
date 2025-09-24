// Health check endpoint for deployment diagnostics
// Returns non-sensitive status about envs and runtime
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    // Server-side keys (presence only)
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY'
  ]

  const env = Object.fromEntries(
    required.map((k) => [k, process.env[k] ? 'present' : 'missing'])
  )

  const ttsConfigured = Boolean(
    process.env.GOOGLE_TTS_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS
  )

  return NextResponse.json({
    ok: true,
    runtime: 'nodejs',
    node: process.versions?.node,
    region: process.env.VERCEL_REGION || 'unknown',
    env,
    tts: ttsConfigured ? 'configured' : 'not-configured'
  })
}
