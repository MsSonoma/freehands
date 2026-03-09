// Mr. Slate TTS route — uses a male, Standard US voice for a robotic quality
// Intentionally distinct from /api/tts (Ms. Sonoma) which uses a Neural GB female voice

import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import textToSpeech from '@google-cloud/text-to-speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const { TextToSpeechClient } = textToSpeech
let ttsClientPromise

// Standard US male voice — Standard (not Neural) gives a more robotic character
const SLATE_VOICE = {
  languageCode: 'en-US',
  name: 'en-US-Standard-B',
  ssmlGender: 'MALE',
}

const SLATE_AUDIO_CONFIG = {
  audioEncoding: 'MP3',
  speakingRate: 1.08, // slightly faster/crisper than Sonoma
  pitch: -1.5,        // slightly lower pitch for mechanical feel
}

function decodeCredentials(raw) {
  if (!raw) return null
  try { return JSON.parse(raw) } catch {}
  try { const decoded = Buffer.from(raw, 'base64').toString('utf8'); return JSON.parse(decoded) } catch {}
  return null
}

function loadTtsCredentials() {
  const inline = process.env.GOOGLE_TTS_CREDENTIALS
  const inlineCreds = decodeCredentials(inline)
  if (inlineCreds) return inlineCreds
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'google-tts-key.json')
  try {
    if (credentialPath && fs.existsSync(credentialPath)) {
      const raw = fs.readFileSync(credentialPath, 'utf8').trim()
      if (raw) return decodeCredentials(raw) || JSON.parse(raw)
    }
  } catch {}
  return null
}

async function getTtsClient() {
  if (ttsClientPromise) return ttsClientPromise
  const credentials = loadTtsCredentials()
  if (!credentials) return null
  ttsClientPromise = (async () => {
    try { return new TextToSpeechClient({ credentials }) } catch {
      ttsClientPromise = undefined; return null
    }
  })()
  ttsClientPromise.catch(() => { ttsClientPromise = undefined })
  return ttsClientPromise
}

function escapeForSsml(s) {
  if (!s) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function stripMarkdownForSpeech(text) {
  if (!text) return text
  return String(text)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
}

function toSsml(text) {
  const stripped = stripMarkdownForSpeech(text || '')
  const safe = escapeForSsml(stripped)
  // Replace degree symbols for natural reading
  const withDegrees = safe.replace(/°/g, ' degrees')
  return `<speak>${withDegrees}</speak>`
}

export async function POST(req) {
  try {
    let payload = ''
    const ct = (req.headers?.get?.('content-type') || '').toLowerCase()
    if (ct.includes('application/json')) {
      const raw = await req.text()
      try { const body = JSON.parse(raw); payload = (body.text || body.reply || body.speech || '').toString() } catch { payload = (raw || '').toString() }
    } else {
      payload = (await req.text())?.toString() || ''
    }
    const text = (payload || '').trim()
    if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 })

    const client = await getTtsClient()
    if (!client) return NextResponse.json({ reply: text, audio: undefined })

    const ssml = toSsml(text)
    const [res] = await client.synthesizeSpeech({ input: { ssml }, voice: SLATE_VOICE, audioConfig: SLATE_AUDIO_CONFIG })
    const base64 = res?.audioContent
      ? (typeof res.audioContent === 'string' ? res.audioContent : Buffer.from(res.audioContent).toString('base64'))
      : undefined
    const dataUrl = base64 ? `data:audio/mp3;base64,${base64}` : undefined
    return NextResponse.json({ reply: text, audio: dataUrl })
  } catch {
    return NextResponse.json({ error: 'tts_failed' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const client = await getTtsClient()
    return NextResponse.json({ ok: true, ready: !!client })
  } catch {
    return NextResponse.json({ ok: true, ready: false })
  }
}
