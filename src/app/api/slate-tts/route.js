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

// Convert numeric fractions (e.g. 1/4) to spoken form so TTS does not read "divided by".
function normalizeFractionsForSpeech(text) {
  if (!text) return text
  const ordinals = {
    2: ['half', 'halves'], 3: ['third', 'thirds'], 4: ['fourth', 'fourths'],
    5: ['fifth', 'fifths'], 6: ['sixth', 'sixths'], 7: ['seventh', 'sevenths'],
    8: ['eighth', 'eighths'], 9: ['ninth', 'ninths'], 10: ['tenth', 'tenths'],
    12: ['twelfth', 'twelfths'], 16: ['sixteenth', 'sixteenths'], 100: ['hundredth', 'hundredths'],
  }
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
  return String(text).replace(/\b(\d{1,2})\/(\d{1,3})\b/g, (match, ns, ds) => {
    const n = parseInt(ns, 10), d = parseInt(ds, 10)
    if (n >= d || !ordinals[d]) return match
    const nWord = n <= 20 ? ones[n] : ns
    return `${nWord} ${n === 1 ? ordinals[d][0] : ordinals[d][1]}`
  })
}

function toSsml(text) {
  const stripped = stripMarkdownForSpeech(text || '')
  const withFractions = normalizeFractionsForSpeech(stripped)
  const safe = escapeForSsml(withFractions)
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
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
