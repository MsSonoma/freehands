// Next.js API route for Ms. Sonoma (OpenAI)
// Macro Objective: Single, continuous API call using instructions and innertext only

import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import textToSpeech from '@google-cloud/text-to-speech'

// Providers
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

const { TextToSpeechClient } = textToSpeech

let ttsClientPromise
// Simple in-memory TTS cache to avoid re-synthesizing identical replies (best-effort, process-local)
const ttsCache = new Map() // key: text, value: base64 audio
const TTS_CACHE_MAX = 200

// Note: Removed legacy in-memory SYSTEM_CACHE and related helpers for stateless behavior

// Ensure Node.js runtime (Google SDKs are not compatible with Edge runtime)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const DEFAULT_VOICE = {
  languageCode: 'en-GB',
  name: 'en-GB-Neural2-F',
  ssmlGender: 'FEMALE'
}

const AUDIO_CONFIG = {
  audioEncoding: 'MP3',
  speakingRate: 0.92
}

// Configurable pause between multiple choice labels in SSML (milliseconds)
// Override with env SONOMA_TTS_MC_BREAK_MS, e.g., "450" or "700"
function getMcBreakMs() {
  const raw = (process.env.SONOMA_TTS_MC_BREAK_MS || '').trim()
  const n = Number(raw)
  if (!Number.isNaN(n) && n >= 200 && n <= 2000) return Math.round(n)
  return 550
}

// Escape plain text for inclusion in SSML
function escapeForSsml(s) {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Insert short breaks before MC labels B. through Z. so each choice sounds separate
function addMcBreaks(escaped, breakMs) {
  const ms = typeof breakMs === 'number' ? breakMs : getMcBreakMs()
  // Pattern: whitespace + [B-Z]. + space -> break + label (leave A. alone)
  return escaped.replace(/\s([B-Z])\.\s/g, ` <break time="${ms}ms"/>$1. `)
}

// Convert plain text to SSML with MC pauses
function toSsml(text) {
  const safe = escapeForSsml(text)
  // Insert short breaks for paragraph/blank-line gaps (used to pace jokes and similar beats)
  const withParagraphBreaks = safe.replace(/(?:\r?\n){2,}/g, ' <break time="700ms"/> ')
  const withBreaks = addMcBreaks(withParagraphBreaks, getMcBreakMs())
  return `<speak>${withBreaks}</speak>`
}

// Control how much of large strings we print in logs.
// Configure with env SONOMA_LOG_PREVIEW_MAX:
//  - 'full' | 'none' | '0' | 'off'  => no truncation
//  - number (e.g., '2000')           => that many characters
//  - default: full in development, 600 in production
const LOG_PREVIEW_MAX = (() => {
  const raw = (process.env.SONOMA_LOG_PREVIEW_MAX || '').trim().toLowerCase()
  if (raw === 'full' || raw === 'none' || raw === '0' || raw === 'off') return Infinity
  const n = Number(raw)
  if (!Number.isNaN(n) && n > 0) return n
  return process.env.NODE_ENV === 'production' ? 600 : Infinity
})()

function decodeCredentials(raw) {
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch (jsonError) {
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf8')
      return JSON.parse(decoded)
    } catch (base64Error) {
      return null
    }
  }
}

function loadTtsCredentials() {
  const inline = process.env.GOOGLE_TTS_CREDENTIALS
  const inlineCreds = decodeCredentials(inline)
  if (inlineCreds) {
    return inlineCreds
  }

  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'google-tts-key.json')

  try {
    if (credentialPath && fs.existsSync(credentialPath)) {
      const raw = fs.readFileSync(credentialPath, 'utf8').trim()
      if (raw) {
        return decodeCredentials(raw) || JSON.parse(raw)
      }
    }
  } catch (fileError) {
    console.error('[Ms. Sonoma API] Failed to load Google TTS credentials:', fileError)
  }

  return null
}

async function getTtsClient() {
  // Only return cached promise when it exists and is truthy.
  if (ttsClientPromise) return ttsClientPromise

  // Attempt to load credentials each call if we don't have a cached client
  const credentials = loadTtsCredentials()
  if (!credentials) {
    // Do NOT cache the null result; allow future calls to retry after envs are added
    console.warn('[Ms. Sonoma API] Google TTS credentials are not configured; voice playback disabled.')
    return null
  }

  ttsClientPromise = (async () => {
    try {
      return new TextToSpeechClient({ credentials })
    } catch (error) {
      console.error('[Ms. Sonoma API] Failed to initialize Google TTS client:', error)
      // Reset to allow future retries
      ttsClientPromise = undefined
      return null
    }
  })()

  // If the promise rejects, clear cache so a future call can retry
  ttsClientPromise.catch(() => { ttsClientPromise = undefined })
  return ttsClientPromise
}

// Fixed, minimal stateless base system prompt. All step-specific behavior must be sent in instructions.
const BASE_SYSTEM = [
  'Always respond with natural spoken text only. Do not use emojis, decorative characters, repeated punctuation, ASCII art, bullet lines, or other symbols.',
  'You are Ms. Sonoma. Follow only the lesson and directions given in the user\'s message.',
  'Stateless: Treat each call independently. Use only the text in this request.',
  'Closed world: Do not reference files, tools, APIs, the app, or capabilities. Do not mention UI or runtime.',
  'Stay on the current lesson only. Politely steer back if needed.',
  'Kid-friendly style: simple words for a young child; short sentences (about 6–12 words); warm tone; speak to “you” and “we”; one idea per sentence.'
].join('\n')

// Provider selection: default to Anthropic when key present or env explicitly set; else OpenAI
const PROVIDER = (process.env.SONOMA_PROVIDER || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai')).toLowerCase()
const OPENAI_MODEL_DEFAULT = process.env.SONOMA_OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o'
// Note: Model name for "Claude Opus 4.1 (Preview)" can vary; prefer env overrides. Fallback to a widely-available Claude model.
const ANTHROPIC_MODEL_DEFAULT = process.env.SONOMA_MODEL || process.env.ANTHROPIC_MODEL || 'claude-4.1-opus'
const ANTHROPIC_MODEL_FALLBACK = process.env.ANTHROPIC_MODEL_FALLBACK || 'claude-3.5-sonnet'

export async function POST(req) {
  const callId = createCallId()
  const logPrefix = `[Ms. Sonoma API][${callId}]`
  try {
    let providerUsed = PROVIDER
    // Be resilient to non-JSON payloads (text/plain, form-data) to avoid 500s during dev/smoke tests
    let instructions = ''
    let innertext = ''

    const contentType = (req.headers?.get?.('content-type') || '').toLowerCase()
    try {
      if (contentType.includes('application/json')) {
        // Read the raw body once to avoid double consumption issues
        const raw = (await req.text()) || ''
        try {
          const body = JSON.parse(raw)
          const instruction = body.instruction || ''
          innertext = body.innertext || ''
          console.log(`${logPrefix} got structured body`, { instruction: !!instruction, innertext: !!innertext })
          instructions = instruction
        } catch {
          // If JSON parse fails, treat the entire body as plain-text instructions
          instructions = raw.trim()
          console.warn(`${logPrefix} Invalid JSON; using raw text body as instructions.`)
        }
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const form = await req.formData()
        instructions = form.get('instruction')?.toString() || form.get('instructions')?.toString() || ''
        innertext = form.get('innertext')?.toString() ?? ''
        console.warn(`${logPrefix} Received URL-encoded form payload; consider sending JSON for best compatibility.`)
      } else {
        // Fallback: treat entire body as text instructions
        const textBody = (await req.text())?.trim()
        instructions = textBody
        console.warn(`${logPrefix} Non-JSON payload received; treating request body as instructions text.`)
      }
    } catch (parseErr) {
      // If anything unexpected happens, default to empty instructions
      console.warn(`${logPrefix} Failed to read request body:`, parseErr)
      instructions = ''
    }

    const trimmedInstructions = typeof instructions === 'string' ? instructions.trim() : ''
    const trimmedInnertext = typeof innertext === 'string' ? innertext.trim() : ''

    if (!trimmedInstructions) {
      console.warn(`${logPrefix} Missing instructions payload`)
      return NextResponse.json({ error: 'Instructions are required.' }, { status: 400 })
    }

    console.log(`${logPrefix} -> instructions:\n${previewText(trimmedInstructions)}`)
    if (trimmedInnertext) {
      console.log(`${logPrefix} -> innertext:\n${previewText(trimmedInnertext)}`)
    }
    // Stateless API: no session context is consumed or logged

    // Keys by provider
    const openaiKey = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (PROVIDER === 'openai' && !openaiKey) {
      console.error(`${logPrefix} OPENAI_API_KEY is not configured`)
      // Dev fallback: allow local testing without LLM while still providing TTS when available
      if (process.env.NODE_ENV !== 'production') {
        const { stub, audio } = await buildDevStubWithOptionalTts(trimmedInstructions, trimmedInnertext)
        providerUsed = 'dev-stub'
        console.log(`${logPrefix} <- reply (${providerUsed}):\n${previewText(stub)}`)
        return NextResponse.json({ reply: stub, audio }, { status: 200 })
      }
      return NextResponse.json({ error: 'Ms. Sonoma is unavailable.' }, { status: 500 })
    }
    if (PROVIDER === 'anthropic' && !anthropicKey) {
      console.error(`${logPrefix} ANTHROPIC_API_KEY is not configured for Anthropic provider`)
      if (openaiKey) {
        console.warn(`${logPrefix} Falling back to OpenAI provider because Anthropic key missing`)
      } else if (process.env.NODE_ENV !== 'production') {
        const { stub, audio } = await buildDevStubWithOptionalTts(trimmedInstructions, trimmedInnertext)
        providerUsed = 'dev-stub'
        console.log(`${logPrefix} <- reply (${providerUsed}):\n${previewText(stub)}`)
        return NextResponse.json({ reply: stub, audio }, { status: 200 })
      } else {
        return NextResponse.json({ error: 'Ms. Sonoma is unavailable.' }, { status: 500 })
      }
    }
    // Fixed system prompt for all requests (stateless)
    const systemContent = BASE_SYSTEM

    // Minimal user payload: only current step’s instructions (+ optional child utterance as a second message)
    const userMessages = []
    userMessages.push({ role: 'user', content: trimmedInstructions })
    if (trimmedInnertext) {
      userMessages.push({ role: 'user', content: trimmedInnertext })
    }
  // (Removed duplicate user payload log to reduce noise; instructions + innertext logs above are sufficient.)

    let msSonomaReply = ''
  if (PROVIDER === 'anthropic' && anthropicKey) {
      // Anthropic Messages API
      const anthropicModel = ANTHROPIC_MODEL_DEFAULT
      providerUsed = 'anthropic'
      let aRes = await fetchWithRetry(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': process.env.ANTHROPIC_VERSION || '2023-06-01'
        },
        body: JSON.stringify({
          model: anthropicModel,
          max_tokens: 1024,
          system: systemContent,
          messages: userMessages.map(m => ({ role: m.role, content: [{ type: 'text', text: m.content }] }))
        })
      })
      const aText = await aRes.text()
      let aJson
      try { aJson = JSON.parse(aText) } catch { aJson = aText }
      if (!aRes.ok) {
        // Try fallback model on 400/404 model errors
        if ((aRes.status === 400 || aRes.status === 404) && ANTHROPIC_MODEL_FALLBACK && ANTHROPIC_MODEL_FALLBACK !== anthropicModel) {
          console.warn(`${logPrefix} Anthropic model unavailable, retrying with fallback:`, ANTHROPIC_MODEL_FALLBACK)
          aRes = await fetchWithRetry(ANTHROPIC_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': anthropicKey,
              'anthropic-version': process.env.ANTHROPIC_VERSION || '2023-06-01'
            },
            body: JSON.stringify({
              model: ANTHROPIC_MODEL_FALLBACK,
              max_tokens: 1024,
              system: systemContent,
              messages: userMessages.map(m => ({ role: m.role, content: [{ type: 'text', text: m.content }] }))
            })
          })
          const retryText = await aRes.text()
          try { aJson = JSON.parse(retryText) } catch { aJson = retryText }
        }
      }
      if (!aRes.ok) {
        console.error(`${logPrefix} Anthropic request failed:`, aJson)
        // Optional fallback to OpenAI if configured
        if (openaiKey) {
          const { reply, errorStatus } = await callOpenAI(systemContent, userMessages, openaiKey, undefined, logPrefix)
          if (!reply) return NextResponse.json({ error: 'LLM request failed.' }, { status: errorStatus || 500 })
          msSonomaReply = reply
          providerUsed = 'openai-fallback'
        } else {
          return NextResponse.json({ error: 'Anthropic request failed.' }, { status: aRes.status })
        }
      } else {
        console.log(`${logPrefix} Anthropic response:`, aJson)
        const c = Array.isArray(aJson?.content) ? aJson.content.find(p => p.type === 'text') : null
        msSonomaReply = (c?.text || '').trim()
      }
    } else {
      // OpenAI Chat Completions API
      providerUsed = 'openai'
      const { reply, errorStatus, raw } = await callOpenAI(systemContent, userMessages, openaiKey, OPENAI_MODEL_DEFAULT, logPrefix)
      if (!reply) return NextResponse.json({ error: 'OpenAI request failed.' }, { status: errorStatus || 500 })
      msSonomaReply = reply
      if (raw) console.log(`${logPrefix} OpenAI response:`, raw)
    }

    let audioContent = undefined
    if (msSonomaReply) {
      // Check TTS cache first
      if (ttsCache.has(msSonomaReply)) {
        audioContent = ttsCache.get(msSonomaReply)
      } else {
      const ttsClient = await getTtsClient()
      if (ttsClient) {
        try {
          // Build SSML from plain text so we can add natural pauses for MC choices without changing transcripts
          const ssml = toSsml(msSonomaReply)
          const [ttsResponse] = await ttsClient.synthesizeSpeech({
            input: { ssml },
            voice: DEFAULT_VOICE,
            audioConfig: AUDIO_CONFIG
          })
          if (ttsResponse?.audioContent) {
            audioContent = typeof ttsResponse.audioContent === 'string'
              ? ttsResponse.audioContent
              : Buffer.from(ttsResponse.audioContent).toString('base64')
            // Insert into cache with naive LRU truncation
            try {
              ttsCache.set(msSonomaReply, audioContent)
              if (ttsCache.size > TTS_CACHE_MAX) {
                const firstKey = ttsCache.keys().next().value
                ttsCache.delete(firstKey)
              }
            } catch {}
          }
        } catch (ttsError) {
          console.error(`${logPrefix} Text-to-Speech synthesis failed:`, ttsError)
        }
      }
      }
    }

    if (msSonomaReply) {
      console.log(`${logPrefix} <- reply (${providerUsed}):\n${previewText(msSonomaReply)}`)
    } else {
      console.log(`${logPrefix} <- reply (${providerUsed}): (empty reply)`)
    }

  return NextResponse.json({ reply: msSonomaReply, audio: audioContent })
  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, error)
    return NextResponse.json({ error: 'Ms. Sonoma is unavailable.' }, { status: 500 })
  }
}

// Lightweight health check to confirm the route is registered
export async function GET() {
  try {
    return NextResponse.json({ ok: true, route: 'sonoma', runtime }, { status: 200 })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

function previewText(text, max = LOG_PREVIEW_MAX) {
  if (!text) return ''
  const value = typeof text === 'string' ? text : String(text)
  if (value.length <= max) return value
  const remaining = value.length - max
  return `${value.slice(0, max)}... [truncated ${remaining} chars]`
}

function createCallId() {
  const timePart = Date.now().toString(36)
  const randomPart = Math.random().toString(36).slice(2, 8)
  return `${timePart}-${randomPart}`
}

// Lightweight stub generator to keep flows working without OpenAI in development
function buildStubReply(instructions, innertext) {
  const instr = (instructions || '').toLowerCase()
  // Detect structured first-question tokens we use in flows
  const extract = (label) => {
    const re = new RegExp(`${label}\s*:\s*(.+)`, 'i')
    const m = instructions.match(re)
    return m ? m[1].trim() : ''
  }
  const firstExercise = extract('FIRST_EXERCISE_QUESTION')
  const firstWorksheet = extract('FIRST_WORKSHEET_QUESTION')

  if (instr.includes('exercise start')) {
    const q = firstExercise || 'What is 3 + 2?'
    return `Let’s begin the exercise. I’ll help you practice. ${q}`
  }
  if (instr.includes('worksheet start')) {
    const q = firstWorksheet || 'What is 4 + 1?'
    return `You’re ready for the worksheet. You can do this. ${q}`
  }
  if (instr.includes('comprehension')) {
    return 'Thanks for your answer. Here is the next question: What is 2 + 2?'
  }
  if (instr.includes('teaching')) {
    return 'Today we will learn together. Would you like me to go over that again?'
  }
  if (instr.includes('test complete')) {
    return 'Great job finishing the test. We will review your answers now.'
  }
  // Generic friendly fallback
  return innertext ? `Thanks for sharing. Let’s keep going.` : `Hello there! Let’s get started.`
}

// OpenAI request helper
async function callOpenAI(systemContent, userMessages, apiKey, modelOverride, logPrefix) {
  const model = modelOverride || OPENAI_MODEL_DEFAULT
  const logTag = logPrefix || '[Ms. Sonoma API]'
  try {
    const response = await fetchWithRetry(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemContent },
          ...userMessages
        ],
        max_tokens: 1024
      })
    })
    const rawBody = await response.text()
    let parsedBody
    try { parsedBody = JSON.parse(rawBody) } catch { parsedBody = rawBody }
    if (!response.ok) {
      console.error(`${logTag} OpenAI request failed:`, parsedBody)
      return { reply: '', errorStatus: response.status, raw: parsedBody }
    }
    const reply = parsedBody?.choices?.[0]?.message?.content?.trim() ?? ''
    return { reply, raw: parsedBody }
  } catch (e) {
    console.error(`${logTag} OpenAI call error:`, e)
    return { reply: '', errorStatus: 500 }
  }
}

// Small fetch retry helper with exponential backoff
async function fetchWithRetry(url, options, retries = 2, backoffMs = 500) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options)
      if (!res.ok && attempt < retries && isRetryableStatus(res.status)) {
        await sleep(backoffMs * Math.pow(2, attempt))
        continue
      }
      return res
    } catch (err) {
      lastErr = err
      if (attempt < retries) {
        await sleep(backoffMs * Math.pow(2, attempt))
        continue
      }
      throw err
    }
  }
  throw lastErr || new Error('fetchWithRetry: unknown error')
}

function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status < 600)
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Dev stub + optional TTS synthesis
async function buildDevStubWithOptionalTts(trimmedInstructions, trimmedInnertext) {
  const stub = buildStubReply(trimmedInstructions, trimmedInnertext)
  let audio
  try {
    // Serve from cache when possible
    if (ttsCache.has(stub)) {
      audio = ttsCache.get(stub)
    } else {
      const ttsClient = await getTtsClient()
      if (ttsClient && stub) {
        // Use SSML in dev too for consistent pauses between MC choices
        const ssml = toSsml(stub)
        const [ttsResponse] = await ttsClient.synthesizeSpeech({
          input: { ssml },
          voice: DEFAULT_VOICE,
          audioConfig: AUDIO_CONFIG
        })
        if (ttsResponse?.audioContent) {
          audio = typeof ttsResponse.audioContent === 'string'
            ? ttsResponse.audioContent
            : Buffer.from(ttsResponse.audioContent).toString('base64')
          try {
            ttsCache.set(stub, audio)
            if (ttsCache.size > TTS_CACHE_MAX) {
              const firstKey = ttsCache.keys().next().value
              ttsCache.delete(firstKey)
            }
          } catch {}
        }
      }
    }
  } catch {}
  return { stub, audio }
}
