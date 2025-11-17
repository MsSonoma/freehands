// Text-to-speech API for Mr. Mentor
// Uses Google Cloud TTS with Mr. Mentor's voice (en-US-Neural2-D, Male, 0.88 speed)

import { NextResponse } from 'next/server'
import textToSpeech from '@google-cloud/text-to-speech'
import fs from 'node:fs'
import path from 'node:path'

const { TextToSpeechClient } = textToSpeech

let ttsClientPromise
const ttsCache = new Map()
const TTS_CACHE_MAX = 200

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Mr. Mentor's voice - warm, caring American male
const MENTOR_VOICE = {
  languageCode: 'en-US',
  name: 'en-US-Neural2-D',
  ssmlGender: 'MALE'
}

// Slightly slower speaking rate for thoughtful, therapeutic delivery
const MENTOR_AUDIO_CONFIG = {
  audioEncoding: 'MP3',
  speakingRate: 0.88
}

function loadTtsCredentials() {
  const inline = process.env.GOOGLE_TTS_CREDENTIALS
  if (inline) return JSON.parse(inline)
  
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'google-tts-key.json')
  try {
    return JSON.parse(fs.readFileSync(credentialPath, 'utf8'))
  } catch {
    // Credentials load failed - TTS will be unavailable
    return null
  }
}

async function getTtsClient() {
  if (ttsClientPromise) return ttsClientPromise
  
  const credentials = loadTtsCredentials()
  if (!credentials) return null
  
  ttsClientPromise = (async () => {
    try {
      return new TextToSpeechClient({ credentials })
    } catch {
      // TTS client init failed
      ttsClientPromise = undefined
      return null
    }
  })()
  
  ttsClientPromise.catch(() => { ttsClientPromise = undefined })
  return ttsClientPromise
}

function toSsml(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
  
  return `<speak>${escaped}</speak>`
}

export async function POST(request) {
  try {
    const { text } = await request.json()
    
    if (!text) {
      return NextResponse.json(
        { error: 'Missing text parameter' },
        { status: 400 }
      )
    }
    
    // Strip markdown formatting for TTS
    const cleanText = text
      .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove **bold**
      .replace(/\*([^*]+)\*/g, '$1')      // Remove *italic*
      .replace(/_([^_]+)_/g, '$1')        // Remove _underline_
      .replace(/`([^`]+)`/g, '$1')        // Remove `code`
      .replace(/^#+\s+/gm, '')            // Remove # headers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Remove [links](url)
    
    let audioContent = undefined
    
    // Check cache first
    if (ttsCache.has(cleanText)) {
      audioContent = ttsCache.get(cleanText)
    } else {
      const ttsClient = await getTtsClient()
      
      if (ttsClient) {
        try {
          const ssml = toSsml(cleanText)
          const [ttsResponse] = await ttsClient.synthesizeSpeech({
            input: { ssml },
            voice: MENTOR_VOICE,
            audioConfig: MENTOR_AUDIO_CONFIG
          })
          
          if (ttsResponse?.audioContent) {
            audioContent = typeof ttsResponse.audioContent === 'string'
              ? ttsResponse.audioContent
              : Buffer.from(ttsResponse.audioContent).toString('base64')
            
            // Cache with naive LRU
            ttsCache.set(cleanText, audioContent)
            if (ttsCache.size > TTS_CACHE_MAX) {
              const firstKey = ttsCache.keys().next().value
              ttsCache.delete(firstKey)
            }
          }
        } catch (ttsError) {
          console.error('[mentor-tts] Synthesis error:', ttsError)
        }
      }
    }
    
    return NextResponse.json({
      audio: audioContent
    })
    
  } catch (error) {
    console.error('[mentor-tts] Error:', error)
    return NextResponse.json(
      { error: 'TTS generation failed' },
      { status: 500 }
    )
  }
}
