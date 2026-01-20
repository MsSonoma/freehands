// Next.js API route for Ms. Sonoma (OpenAI)
// Macro Objective: Single, continuous API call using instructions and innertext only

import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import textToSpeech from '@google-cloud/text-to-speech'
import { validateInput, validateOutput, hardenInstructions, getFallbackResponse } from '@/lib/contentSafety'

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
function normalizeBlanksForSpeech(escaped) {
  try {
    // Speak runs of three or more underscores as the word "blank" with a brief pause.
    // This avoids the engine reading out "underscore underscore ..." which is distracting.
    return escaped.replace(/_{2,}/g, ' blank <break time="250ms"/> ')
  } catch { return escaped }
}

function toSsml(text) {
  const safe = escapeForSsml(text)
  // Insert short breaks for paragraph/blank-line gaps (used to pace jokes and similar beats)
  const withParagraphBreaks = safe.replace(/(?:\r?\n){2,}/g, ' <break time="700ms"/> ')
  const withBlanks = normalizeBlanksForSpeech(withParagraphBreaks)
  const withBreaks = addMcBreaks(withBlanks, getMcBreakMs())
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
    // Failed to load Google TTS credentials
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
    // Google TTS credentials not configured
    return null
  }

  ttsClientPromise = (async () => {
    try {
      return new TextToSpeechClient({ credentials })
    } catch (error) {
      // Failed to initialize Google TTS client
      // Reset to allow future retries
      ttsClientPromise = undefined
      return null
    }
  })()

  // If the promise rejects, clear cache so a future call can retry
  ttsClientPromise.catch(() => { ttsClientPromise = undefined })
  return ttsClientPromise
}

// Note: No system prompt is used; the client sends exact per-step instructions in a single user message.

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
  let skipAudio = false

    const contentType = (req.headers?.get?.('content-type') || '').toLowerCase()
    try {
      if (contentType.includes('application/json')) {
        // Read the raw body once to avoid double consumption issues
        const raw = (await req.text()) || ''
        try {
          const body = JSON.parse(raw)
          const instruction = body.instruction || ''
          innertext = body.innertext || ''
          skipAudio = Boolean(body.skipAudio)
          // Got structured body
          instructions = instruction
        } catch {
          // If JSON parse fails, treat the entire body as plain-text instructions
          instructions = raw.trim()
          // Invalid JSON; using raw text body as instructions
        }
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const form = await req.formData()
        instructions = form.get('instruction')?.toString() || form.get('instructions')?.toString() || ''
        innertext = form.get('innertext')?.toString() ?? ''
        skipAudio = String(form.get('skipAudio') ?? '').toLowerCase() === 'true'
        // Received URL-encoded form payload
      } else {
        // Fallback: treat entire body as text instructions
        const textBody = (await req.text())?.trim()
        instructions = textBody
        // Non-JSON payload received
      }
    } catch (parseErr) {
      // If anything unexpected happens, default to empty instructions
      // Failed to read request body
      instructions = ''
    }

    const trimmedInstructions = typeof instructions === 'string' ? instructions.trim() : ''
    const trimmedInnertext = typeof innertext === 'string' ? innertext.trim() : ''

    if (!trimmedInstructions) {
      // Missing instructions payload
      return NextResponse.json({ error: 'Instructions are required.' }, { status: 400 })
    }

    // CONTENT SAFETY: Validate learner input if present
    if (trimmedInnertext) {
      const inputValidation = validateInput(trimmedInnertext, 'general')
      if (!inputValidation.safe) {
        const fallback = getFallbackResponse('input_rejected')
        return NextResponse.json({ reply: fallback, audio: null }, { status: 200 })
      }
    }

    // Received instructions
    // Stateless API: only the provided instructions are sent to the LLM (no system message)

    // Keys by provider
    const openaiKey = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (PROVIDER === 'openai' && !openaiKey) {
      // OPENAI_API_KEY not configured
      // Dev fallback: allow local testing without LLM while still providing TTS when available
      if (process.env.NODE_ENV !== 'production') {
        const { stub, audio } = await buildDevStubWithOptionalTts(trimmedInstructions, trimmedInnertext, skipAudio)
        providerUsed = 'dev-stub'
        // Dev stub reply
        return NextResponse.json({ reply: stub, audio }, { status: 200 })
      }
      return NextResponse.json({ error: 'Ms. Sonoma is unavailable.' }, { status: 500 })
    }
    if (PROVIDER === 'anthropic' && !anthropicKey) {
      // ANTHROPIC_API_KEY not configured
      if (openaiKey) {
        // Falling back to OpenAI provider
      } else if (process.env.NODE_ENV !== 'production') {
        const { stub, audio } = await buildDevStubWithOptionalTts(trimmedInstructions, trimmedInnertext, skipAudio)
        providerUsed = 'dev-stub'
        // Dev stub reply
        return NextResponse.json({ reply: stub, audio }, { status: 200 })
      } else {
        return NextResponse.json({ error: 'Ms. Sonoma is unavailable.' }, { status: 500 })
      }
    }
    // CONTENT SAFETY: Harden instructions with safety preamble
    const hardenedInstructions = hardenInstructions(trimmedInstructions, 'educational content', [])
    
    // Minimal user payload: single user message containing instructions + (optional) innertext
    const combined = trimmedInnertext
      ? `${hardenedInstructions}\n\nLearner question: "${trimmedInnertext}"`
      : hardenedInstructions
    const userMessages = [{ role: 'user', content: combined }]
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
          messages: userMessages.map(m => ({ role: m.role, content: [{ type: 'text', text: m.content }] }))
        })
      })
      const aText = await aRes.text()
      let aJson
      try { aJson = JSON.parse(aText) } catch { aJson = aText }
      if (!aRes.ok) {
        // Try fallback model on 400/404 model errors
        if ((aRes.status === 400 || aRes.status === 404) && ANTHROPIC_MODEL_FALLBACK && ANTHROPIC_MODEL_FALLBACK !== anthropicModel) {
          // Anthropic model unavailable, retrying with fallback
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
              messages: userMessages.map(m => ({ role: m.role, content: [{ type: 'text', text: m.content }] }))
            })
          })
          const retryText = await aRes.text()
          try { aJson = JSON.parse(retryText) } catch { aJson = retryText }
        }
      }
      if (!aRes.ok) {
        // Anthropic request failed
        // Optional fallback to OpenAI if configured
        if (openaiKey) {
          const { reply, errorStatus } = await callOpenAI(userMessages, openaiKey, undefined, logPrefix)
          if (!reply) return NextResponse.json({ error: 'LLM request failed.' }, { status: errorStatus || 500 })
          msSonomaReply = reply
          providerUsed = 'openai-fallback'
        } else {
          return NextResponse.json({ error: 'Anthropic request failed.' }, { status: aRes.status })
        }
      } else {
        // Anthropic response received
        const c = Array.isArray(aJson?.content) ? aJson.content.find(p => p.type === 'text') : null
        msSonomaReply = (c?.text || '').trim()
        
        // CONTENT SAFETY: Validate Anthropic output
        // Skip OpenAI Moderation API (too strict - blocks innocent words like "pajamas")
        // Rely on instruction hardening + lightweight keyword check instead
        const outputValidation = await validateOutput(msSonomaReply, anthropicKey, true)
        if (!outputValidation.safe) {
          msSonomaReply = getFallbackResponse('output_rejected')
        }
      }
    } else {
      // OpenAI Chat Completions API
      providerUsed = 'openai'
      const { reply, errorStatus, raw } = await callOpenAI(userMessages, openaiKey, OPENAI_MODEL_DEFAULT, logPrefix)
      if (!reply) return NextResponse.json({ error: 'OpenAI request failed.' }, { status: errorStatus || 500 })
      msSonomaReply = reply
      // OpenAI response received
      
      // CONTENT SAFETY: Validate OpenAI output
      // Skip OpenAI Moderation API (too strict - blocks innocent words like "pajamas")
      // Rely on instruction hardening + lightweight keyword check instead
      const outputValidation = await validateOutput(msSonomaReply, openaiKey, true)
      if (!outputValidation.safe) {
        msSonomaReply = getFallbackResponse('output_rejected')
      }
    }

    let audioContent = skipAudio ? null : undefined
    if (!skipAudio && msSonomaReply) {
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
          // Text-to-Speech synthesis failed
        }
      }
      }
    }

    // Reply generated

  return NextResponse.json({ reply: msSonomaReply, audio: audioContent })
  } catch (error) {
    // Unexpected error
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
    // End teaching with a concise wrap (no spoken gate question); UI handles the Yes/No gate
    return 'Today we will learn together. That wraps up the key steps.'
  }
  if (instr.includes('test complete')) {
    return 'Great job finishing the test. We will review your answers now.'
  }
  // Generic friendly fallback
  return innertext ? `Thanks for sharing. Let’s keep going.` : `Hello there! Let’s get started.`
}

// OpenAI request helper
async function callOpenAI(userMessages, apiKey, modelOverride, logPrefix) {
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
        messages: userMessages,
        max_tokens: 1024
      })
    })
    const rawBody = await response.text()
    let parsedBody
    try { parsedBody = JSON.parse(rawBody) } catch { parsedBody = rawBody }
    if (!response.ok) {
      console.error(`${logTag} OpenAI request failed - Status: ${response.status}`);
      console.error(`${logTag} OpenAI error body:`, JSON.stringify(parsedBody, null, 2));
      return { reply: '', errorStatus: response.status, raw: parsedBody }
    }
    const reply = parsedBody?.choices?.[0]?.message?.content?.trim() ?? ''
    return { reply, raw: parsedBody }
  } catch (e) {
    // OpenAI call error
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
async function buildDevStubWithOptionalTts(trimmedInstructions, trimmedInnertext, skipAudio = false) {
  const stub = buildStubReply(trimmedInstructions, trimmedInnertext)
  let audio = skipAudio ? null : undefined

  if (skipAudio) return { stub, audio }
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
