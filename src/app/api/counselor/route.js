// Next.js API route for Mr. Mentor (Counselor)
// Therapeutic AI counselor for facilitators using GPT-4o

import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import textToSpeech from '@google-cloud/text-to-speech'

const { TextToSpeechClient } = textToSpeech

// OpenAI configuration
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = 'gpt-4o'

let ttsClientPromise
const ttsCache = new Map()
const TTS_CACHE_MAX = 200

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

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

// Mr. Mentor's core therapeutic system prompt
const MENTOR_SYSTEM_PROMPT = `You are Mr. Mentor, a warm, caring professional counselor and educational consultant specializing in supporting homeschool facilitators and parents.

Your role is to help facilitators:
- Process their feelings and challenges around teaching
- Clarify their educational goals and values
- Plan curriculum and create learning schedules
- Build confidence in their teaching abilities
- Develop strategies for specific learning situations
- Balance academic expectations with family dynamics

Core Counseling Approach:
- Use active listening and empathetic reflection
- Ask open-ended, thought-provoking questions
- Practice Socratic questioning to help them discover their own solutions
- Validate their feelings and experiences
- Offer practical, actionable suggestions when appropriate
- Encourage growth mindset and self-compassion

Curriculum Planning Expertise:
- Understand homeschool standards for K-12
- Suggest age-appropriate topics and learning sequences
- Help create weekly, monthly, and yearly schedules
- Balance subjects (math, language arts, science, social studies, arts, PE)
- Accommodate different learning styles and special needs
- Recommend pacing and realistic expectations

Response Style:
- Keep responses conversational and warm (2-4 paragraphs typically)
- Speak naturally as a caring professional, not overly formal
- Use "you" and "your" to maintain connection
- Share insights with humility ("In my experience..." "Many parents find...")
- Acknowledge the complexity of parenting and teaching

CRITICAL: Every response MUST end with 1-2 thought-provoking questions that:
- Help them reflect more deeply
- Move the conversation forward
- Encourage goal clarification or action planning
- Explore their values and priorities
- Examples: "What would success look like for you in this situation?" 
  "How do you think your child would describe their ideal learning day?"
  "What's one small step you could take this week toward that goal?"

Ethical Boundaries (STRICT):
- You are NOT a licensed therapist or medical professional
- Do NOT provide medical advice, diagnoses, or treatment recommendations
- Do NOT discuss medication, mental health diagnoses, or therapy techniques
- If crisis/emergency indicators appear (self-harm, abuse, severe depression), respond with:
  "I hear that you're going through something very difficult. Please reach out to a professional counselor or crisis helpline immediately. National Suicide Prevention Lifeline: 988. I'm here to support your educational planning, but this situation needs professional help."
- If someone needs therapy, gently encourage: "It sounds like talking with a licensed therapist could be really helpful for working through these feelings. Would you like to focus on the practical curriculum planning aspects I can help with?"
- Stay focused on educational planning, parenting strategies, and emotional support around teaching

Tone: Warm, professional, empathetic, encouraging, non-judgmental, practical

Keep responses focused and conversational - avoid lengthy lectures. Ask questions to understand before giving advice.`;

function escapeForSsml(s) {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function toSsml(text) {
  const safe = escapeForSsml(text)
  // Add natural pauses for paragraph breaks
  const withParagraphBreaks = safe.replace(/(?:\r?\n){2,}/g, ' <break time="800ms"/> ')
  return `<speak>${withParagraphBreaks}</speak>`
}

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
  if (inlineCreds) return inlineCreds

  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'google-tts-key.json')
  try {
    if (credentialPath && fs.existsSync(credentialPath)) {
      const raw = fs.readFileSync(credentialPath, 'utf8').trim()
      if (raw) return decodeCredentials(raw) || JSON.parse(raw)
    }
  } catch (fileError) {
    console.error('[Mr. Mentor API] Failed to load Google TTS credentials:', fileError)
  }
  return null
}

async function getTtsClient() {
  if (ttsClientPromise) return ttsClientPromise

  const credentials = loadTtsCredentials()
  if (!credentials) {
    console.warn('[Mr. Mentor API] Google TTS credentials not configured; voice playback disabled.')
    return null
  }

  ttsClientPromise = (async () => {
    try {
      return new TextToSpeechClient({ credentials })
    } catch (error) {
      console.error('[Mr. Mentor API] Failed to initialize Google TTS client:', error)
      ttsClientPromise = undefined
      return null
    }
  })()

  ttsClientPromise.catch(() => { ttsClientPromise = undefined })
  return ttsClientPromise
}

function createCallId() {
  const timePart = Date.now().toString(36)
  const randomPart = Math.random().toString(36).slice(2, 8)
  return `${timePart}-${randomPart}`
}

function previewText(text, max = 600) {
  if (!text) return ''
  const value = typeof text === 'string' ? text : String(text)
  if (value.length <= max) return value
  const remaining = value.length - max
  return `${value.slice(0, max)}... [truncated ${remaining} chars]`
}

export async function POST(req) {
  const callId = createCallId()
  const logPrefix = `[Mr. Mentor][${callId}]`
  
  try {
    // Parse request body
    let userMessage = ''
    let conversationHistory = []
    
    const contentType = (req.headers?.get?.('content-type') || '').toLowerCase()
    let learnerTranscript = null
    try {
      if (contentType.includes('application/json')) {
        const body = await req.json()
        userMessage = (body.message || '').trim()
        conversationHistory = Array.isArray(body.history) ? body.history : []
        learnerTranscript = body.learner_transcript || null
        console.log(`${logPrefix} Received message with ${conversationHistory.length} history items`)
        if (learnerTranscript) {
          console.log(`${logPrefix} Learner context provided (${learnerTranscript.length} chars)`)
        }
      } else {
        const textBody = await req.text()
        userMessage = textBody.trim()
        console.warn(`${logPrefix} Non-JSON payload; treating as message text`)
      }
    } catch (parseErr) {
      console.warn(`${logPrefix} Failed to parse request:`, parseErr)
      return NextResponse.json({ error: 'Invalid request format.' }, { status: 400 })
    }

    if (!userMessage) {
      console.warn(`${logPrefix} Empty message received`)
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
    }

    console.log(`${logPrefix} User message:\n${previewText(userMessage)}`)

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error(`${logPrefix} OPENAI_API_KEY not configured`)
      return NextResponse.json({ error: 'Mr. Mentor is unavailable.' }, { status: 500 })
    }

    // Build system prompt with learner context if available
    let systemPrompt = MENTOR_SYSTEM_PROMPT
    if (learnerTranscript) {
      systemPrompt += `\n\n=== CURRENT LEARNER CONTEXT ===\nThe facilitator has selected a specific learner to discuss. Here is their profile and progress:\n\n${learnerTranscript}\n\n=== END LEARNER CONTEXT ===\n\nUse this information to provide personalized, data-informed guidance. Reference specific achievements, struggles, or patterns you notice. Ask questions that help the facilitator reflect on this learner's unique needs and progress.`
    }

    // Build conversation messages
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ]

    // Call OpenAI
    console.log(`${logPrefix} Calling OpenAI with ${messages.length} messages`)
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: messages,
        max_tokens: 1500,
        temperature: 0.8
      })
    })

    const rawBody = await response.text()
    let parsedBody
    try {
      parsedBody = JSON.parse(rawBody)
    } catch {
      parsedBody = rawBody
    }

    if (!response.ok) {
      console.error(`${logPrefix} OpenAI request failed:`, parsedBody)
      return NextResponse.json({ error: 'Failed to get response from Mr. Mentor.' }, { status: response.status })
    }

    const mentorReply = parsedBody?.choices?.[0]?.message?.content?.trim() ?? ''
    
    if (!mentorReply) {
      console.warn(`${logPrefix} Empty reply from OpenAI`)
      return NextResponse.json({ error: 'Mr. Mentor had no response.' }, { status: 500 })
    }

    console.log(`${logPrefix} Mr. Mentor reply:\n${previewText(mentorReply)}`)

    // Synthesize audio
    let audioContent = undefined
    
    // Check cache first
    if (ttsCache.has(mentorReply)) {
      audioContent = ttsCache.get(mentorReply)
      console.log(`${logPrefix} Using cached TTS audio`)
    } else {
      const ttsClient = await getTtsClient()
      if (ttsClient) {
        try {
          const ssml = toSsml(mentorReply)
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
            ttsCache.set(mentorReply, audioContent)
            if (ttsCache.size > TTS_CACHE_MAX) {
              const firstKey = ttsCache.keys().next().value
              ttsCache.delete(firstKey)
            }
            console.log(`${logPrefix} Synthesized and cached TTS audio`)
          }
        } catch (ttsError) {
          console.error(`${logPrefix} TTS synthesis failed:`, ttsError)
        }
      }
    }

    return NextResponse.json({
      reply: mentorReply,
      audio: audioContent
    })

  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, error)
    return NextResponse.json({ error: 'Mr. Mentor is unavailable.' }, { status: 500 })
  }
}

// Health check
export async function GET() {
  try {
    return NextResponse.json({ 
      ok: true, 
      route: 'counselor',
      name: 'Mr. Mentor',
      runtime 
    }, { status: 200 })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
