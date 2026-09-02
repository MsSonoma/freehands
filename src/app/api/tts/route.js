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

// Strip emoji and other non-speech characters so TTS does not read them aloud.
function stripEmojiForSpeech(text) {
  if (!text) return text
  return String(text)
    // Emoji: covers the vast majority of Unicode emoji blocks
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')   // CJK/Mahjong/Domino/misc supplementary
    .replace(/[\u{2600}-\u{27BF}]/gu, '')       // Misc symbols, dingbats
    .replace(/[\u{2300}-\u{23FF}]/gu, '')       // Misc technical
    .replace(/[\u{2B00}-\u{2BFF}]/gu, '')       // Misc symbols and arrows
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')       // Variation selectors
    .replace(/\u{20E3}/gu, '')                  // Combining enclosing keycap
    .replace(/[\u{E0020}-\u{E007F}]/gu, '')     // Tags block (flag sequences)
    // Normalize typographic apostrophes/quotes to ASCII before the catch-all so
    // contractions like "We\u2019ll" are not stripped down to "Well".
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    // Catch-all: any remaining characters outside Basic Latin + Latin-1 that aren't
    // normal punctuation or accented letters (covers stray symbols, private use, etc.)
    .replace(/[^\u0000-\u02FF\u0300-\u036F\u0370-\u03FF]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Convert numeric fractions (e.g. 1/4) to spoken form ("one fourth") so TTS does
// not read them as "one divided by four".
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

// Strip markdown formatting so TTS does not read asterisks, underscores, etc.
function stripMarkdownForSpeech(text) {
  if (!text) return text
  return String(text)
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold**
    .replace(/\*([^*]+)\*/g, '$1')       // *italic*
    .replace(/_([^_]+)_/g, '$1')         // _italic_
    .replace(/`([^`]+)`/g, '$1')         // `code`
}

function toSsml(text) {
  const deEmojied = stripEmojiForSpeech(text || '')
  const stripped = stripMarkdownForSpeech(deEmojied)
  const withFractions = normalizeFractionsForSpeech(stripped)
  const safe = escapeForSsml(withFractions)
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
