// Google Cloud Speech-to-Text route
// Accepts multipart/form-data with field `audio` (webm/opus or other audio) and optional `language` (default en-US)
// Returns: { transcript }
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Use explicit Node.js runtime (not edge) because Google SDK requires Node environment
export const runtime = 'nodejs'

let cachedSpeechClient = null

function decodeCredentials(raw) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf8')
      return JSON.parse(decoded)
    } catch {
      return null
    }
  }
}

async function getCredentialsJSON() {
  // Prefer inline env var (JSON or base64-encoded JSON)
  const inline = process.env.GOOGLE_TTS_CREDENTIALS
  const inlineCreds = decodeCredentials(inline)
  if (inlineCreds) return inlineCreds

  // If GOOGLE_APPLICATION_CREDENTIALS points to a file, try reading it
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (credPath) {
    try {
      const raw = await fs.promises.readFile(credPath, 'utf8')
      const parsed = decodeCredentials(raw) || JSON.parse(raw)
      if (parsed) return parsed
    } catch { /* ignore */ }
  }

  // Fallback to repo-local file for development
  const filePath = path.join(process.cwd(), 'google-tts-key.json')
  try {
    const raw = await fs.promises.readFile(filePath, 'utf8')
    return decodeCredentials(raw) || JSON.parse(raw)
  } catch { return null }
}

async function getSpeechClient() {
  if (cachedSpeechClient) return cachedSpeechClient
  const creds = await getCredentialsJSON()
  if (!creds) throw new Error('Missing Google credentials for Speech-to-Text')
  const { SpeechClient } = await import('@google-cloud/speech')
  cachedSpeechClient = new SpeechClient({ credentials: creds })
  return cachedSpeechClient
}

export async function POST(req) {
  try {
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Expected multipart/form-data.' }, { status: 400 })
    }
    const formData = await req.formData()
    const file = formData.get('audio')
    const language = (formData.get('language') || 'en-US').toString()
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Missing audio file.' }, { status: 400 })
    }
    const MAX_BYTES = 8 * 1024 * 1024
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Audio too large (max 8MB).' }, { status: 413 })
    }
    const arrayBuffer = await file.arrayBuffer()
    const audioBytes = Buffer.from(arrayBuffer).toString('base64')
    const client = await getSpeechClient()
    // Determine encoding heuristically (MediaRecorder default webm/opus)
    let encoding = undefined
    if ((file.type || '').includes('webm')) encoding = 'WEBM_OPUS'
    // speech API request
    const request = {
      audio: { content: audioBytes },
      config: {
        languageCode: language,
        enableAutomaticPunctuation: true,
        model: 'latest_long', // let Google choose appropriate; adjust if needed
        encoding,
      }
    }
    const [response] = await client.recognize(request)
    const transcript = (response.results || [])
      .map(r => r.alternatives && r.alternatives[0] && r.alternatives[0].transcript || '')
      .filter(Boolean)
      .join(' ')
      .trim()
    return NextResponse.json({ transcript })
  } catch (err) {
    // Google Speech error
    return NextResponse.json({ error: 'Transcription failed.' }, { status: 500 })
  }
}
