import { NextResponse } from 'next/server'

const AUDIENCE_ID = '1743ddf7-62ae-4a05-99db-103d95da4daf'

/**
 * POST /api/email/subscribe
 * Body: { email, first_name?, last_name? }
 *
 * Adds a contact to the Resend "Ms. Sonoma Email List" audience.
 * Safe to call on every signup — Resend upserts by email.
 */
export async function POST(req) {
  try {
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const email = (body.email || '').trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    const firstName = (body.first_name || '').trim().slice(0, 100)
    const lastName = (body.last_name || '').trim().slice(0, 100)

    const res = await fetch(`https://api.resend.com/audiences/${AUDIENCE_ID}/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        first_name: firstName,
        last_name: lastName,
        unsubscribed: false,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('[email/subscribe] Resend error:', res.status, errBody)
      return NextResponse.json({ error: 'Failed to subscribe' }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[email/subscribe] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
