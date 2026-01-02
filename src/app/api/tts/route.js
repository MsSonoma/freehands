// Simple TTS-only route: synthesize provided text to MP3 base64 using Google Cloud TTS
// Reuses the same credential loading approach as /api/sonoma

import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import textToSpeech from '@google-cloud/text-to-speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const { TextToSpeechClient } = textToSpeech
let ttsClientPromise

const DEFAULT_VOICE = {
  languageCode: 'en-GB',
  name: 'en-GB-Neural2-F',
  ssmlGender: 'FEMALE'
}

const AUDIO_CONFIG = {
  audioEncoding: 'MP3',
  speakingRate: 0.92
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
  } catch (err) {
    // Failed to load Google credentials
  }
  return null
}

async function getTtsClient() {
  if (ttsClientPromise) return ttsClientPromise
  const credentials = loadTtsCredentials()
  if (!credentials) {
    // Google TTS credentials not configured
    return null
  }
  ttsClientPromise = (async () => {
    try { return new TextToSpeechClient({ credentials }) } catch (e) {
      // Failed to init client
      ttsClientPromise = undefined; return null
    }
  })()
  ttsClientPromise.catch(() => { ttsClientPromise = undefined })
  return ttsClientPromise
}

function escapeForSsml(s) {
  if (!s) return ''
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// Add a short break for blank line gaps so joke beats pace nicely
function normalizeBlanksForSpeech(safe) {
  try {
    // Replace runs of three or more underscores with a speakable cue.
    // Example: "__ __ __" or "_____" -> "blank" with a short pause for natural pacing.
    return safe.replace(/_{2,}/g, ' blank <break time="250ms"/> ')
  } catch { return safe }
}

function toSsml(text) {
  const safe = escapeForSsml(text || '')
  const withParagraphBreaks = safe.replace(/(?:\r?\n){2,}/g, ' <break time="700ms"/> ')
  const withBlanks = normalizeBlanksForSpeech(withParagraphBreaks)
  return `<speak>${withBlanks}</speak>`
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
    const [res] = await client.synthesizeSpeech({ input: { ssml }, voice: DEFAULT_VOICE, audioConfig: AUDIO_CONFIG })
    const base64 = res?.audioContent
      ? (typeof res.audioContent === 'string' ? res.audioContent : Buffer.from(res.audioContent).toString('base64'))
      : undefined
    // Add data URL prefix for AudioEngine compatibility
    const dataUrl = base64 ? `data:audio/mp3;base64,${base64}` : undefined
    // Synth ok
    return NextResponse.json({ reply: text, audio: dataUrl })
  } catch (e) {
    // Synthesis failed
    return NextResponse.json({ error: 'tts_failed' }, { status: 500 })
  }
}

// Lightweight warm-up/health endpoint
export async function GET() {
  try {
    const client = await getTtsClient();
    const ready = !!client;
    return NextResponse.json({ ok: true, ready });
  } catch {
    return NextResponse.json({ ok: true, ready: false });
  }
}
