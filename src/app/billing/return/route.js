import { NextResponse } from 'next/server'

// Trampoline redirect to avoid BFCache/stale state after returning from Stripe
// Usage: /billing/return?to=/facilitator or /billing/return?to=/facilitator/account/plan?checkout=cancel
export async function GET(request) {
  const url = new URL(request.url)
  const toParam = url.searchParams.get('to') || '/'
  // only allow same-origin absolute path starting with '/'
  const safePath = typeof toParam === 'string' && toParam.startsWith('/') ? toParam : '/'

  // Build absolute redirect URL on same origin and add a cache-busting param
  const target = new URL(safePath, url.origin)
  target.searchParams.set('rts', Date.now().toString())

  const res = NextResponse.redirect(target, { status: 302 })
  // Strongly discourage BFCache and caching on this trampoline
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.headers.set('Pragma', 'no-cache')
  res.headers.set('Expires', '0')
  return res
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
