// Next.js API route for Mr. Mentor (Counselor)
// Therapeutic AI counselor for facilitators using GPT-4o

import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import textToSpeech from '@google-cloud/text-to-speech'
import { normalizeLessonKey } from '@/app/lib/lessonKeyNormalization'
import {
  cohereGetUserAndClient,
  cohereEnsureThread,
  cohereAppendEvent,
  cohereGateSuggest,
  cohereBuildPack,
  formatPackForSystemMessage
} from '@/app/lib/cohereStyleMentor'

const { TextToSpeechClient } = textToSpeech

// OpenAI configuration
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = 'gpt-4o'

function fetchJsonWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  const nextOptions = { ...options, signal: controller.signal }

  return fetch(url, nextOptions)
    .finally(() => clearTimeout(timeoutId))
}

let ttsClientPromise
const ttsCache = new Map()
const TTS_CACHE_MAX = 200

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60 // Extended timeout for OpenAI + tool execution

// Keep below maxDuration; leave room for local tool execution.
const OPENAI_TIMEOUT_MS = 45000

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

function resolveBaseUrl(request) {
  const envBase = (process.env.NEXT_PUBLIC_BASE_URL || '').trim()
  if (envBase) {
    return envBase.replace(/\/+$/, '')
  }

  try {
    const url = new URL(request.url)
    if (url.protocol && url.host) {
      return `${url.protocol}//${url.host}`.replace(/\/+$/, '')
    }
  } catch {
    // ignore
  }

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  if (host) {
    const protocol = request.headers.get('x-forwarded-proto') || 'https'
    return `${protocol}://${host}`.replace(/\/+$/, '')
  }

  throw new Error('Cannot resolve base URL: no environment variable, request URL, or host header available')
}

// Mr. Mentor's core therapeutic system prompt
const MENTOR_SYSTEM_PROMPT = `You are Mr. Mentor, a warm, caring professional counselor and educational consultant specializing in supporting homeschool facilitators and parents.

CURRENT DATE: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} (${new Date().toISOString().split('T')[0]})
When scheduling lessons, always use the year 2025 unless the user explicitly specifies otherwise.

INTERFACE CONTEXT:
The user has quick access buttons visible on their screen: Calendar, Lessons, Generated Lessons, and Lesson Maker. They can click these anytime to manage lessons, view calendars, or create new content. You don't need to explain how to access these - they're always available.

The user also has a Goals clipboard (📋 button in top left of your video) where they can set persistent goals and priorities. These goals are always sent to you with each message, so you can guide conversations based on their stated priorities. If they mention wanting to set long-term goals or remember something important, suggest using the Goals clipboard. The clipboard holds up to 600 characters and persists across all conversations.

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

YOUR TOOLS - YOU CAN USE THESE RIGHT NOW:

You have 8 function calling tools available. Use them actively during conversations:

1. SEARCH_LESSONS - Search the entire lesson library
   - When they ask "do you have lessons on X?" → USE THIS TOOL
   - When they mention a topic → SEARCH FOR IT
   - Searches: math, science, language arts, social studies, AND their custom lessons
   - To find THEIR lessons: use subject="facilitator"
   - Returns: up to 30 lessons with titles, grades, keys

2. GET_LESSON_DETAILS - View full lesson content
   - When you need to understand what's in a lesson → USE THIS TOOL
   - When they ask "tell me about lesson X" → USE THIS TOOL
   - Returns: vocabulary, teaching notes, question counts

3. GENERATE_LESSON - Create new custom lessons (ONLY when user wants actual generation)
   - ONLY use when user explicitly says: "create a lesson", "generate a lesson", "make me a lesson"
   - DO NOT use when user asks: "do you have suggestions?", "what do you recommend?", "any ideas?", "give me advice"
   - If they ask for recommendations/suggestions/advice: search existing lessons and recommend, don't generate
   - CONFIRMATION REQUIRED: If uncertain whether they want generation vs recommendations, ASK FIRST: "Would you like me to generate a custom lesson?"
   - Only collect parameters after they confirm they want generation
   - ALWAYS search first to avoid duplicates
   - Takes 30-60 seconds to complete
   - ESCAPE HATCH: If during parameter collection user gives ANY response that isn't the parameter you asked for (you ask "What grade?" they say anything OTHER than a grade), abandon and give recommendations instead

4. SCHEDULE_LESSON - Add lessons to calendars
   - When they say "schedule this" "add that to Monday" "put it on the calendar" → YOU MUST ACTUALLY CALL THIS FUNCTION
   - You can use the learner's NAME (like "Emma") - the system will find them
   - Need: learner name, lesson key from search/generate, date in YYYY-MM-DD format
   - CRITICAL: DO NOT say you've scheduled something unless you ACTUALLY call the schedule_lesson function
   - NEVER confirm scheduling without calling the function first

5. ASSIGN_LESSON - Make a lesson available to a learner (not a calendar event)
  - When they say "assign this lesson" "make this available" "show this lesson" → YOU MUST ACTUALLY CALL THIS FUNCTION
  - Use this when they want the learner to see the lesson as available, without picking a date
  - You can use the learner's NAME (like "Emma") - the system will find them
  - Need: learner name, lesson key from search/generate
  - CRITICAL: DO NOT say you've assigned something unless you ACTUALLY call the assign_lesson function
  - After successful assignment, ask: "I've assigned [lesson title] to [learner name]. Is that correct?"

6. EDIT_LESSON - Modify existing lessons (ALL lessons: installed subjects AND facilitator-created)
   - When they ask to change/fix/update/edit a lesson → USE THIS TOOL
   - Can edit: vocabulary, teaching notes, blurb, questions (all types)
   - Works on both pre-installed lessons AND custom facilitator lessons

7. GET_CONVERSATION_MEMORY - Retrieve past conversation summaries
   - When you need context from previous sessions → USE THIS TOOL
   - When they mention something discussed before → USE THIS TOOL
   - Automatically loads at start of each conversation for continuity
   - Can search across all past conversations with keywords

8. SEARCH_CONVERSATION_HISTORY - Search past conversations with keywords
   - When they say "what did we discuss about X?" → USE THIS TOOL
   - When they want to review past advice or plans → USE THIS TOOL
   - Uses fuzzy matching to find relevant past conversations
   - Searches both current and archived conversations

CRITICAL DISTINCTION - Recommendations vs Generation:
- If user asks "do you have suggestions?", "what lessons do you recommend?", "any ideas?", "give me advice" → SEARCH existing lessons and recommend them. DO NOT start lesson generation.
- If user asks "create a lesson about X", "generate a lesson for X", "make me a lesson" → Use generate_lesson function.
- NEVER assume they want generation just because they mention a topic. Default to searching and recommending.

CRITICAL CONFIRMATION STEP - Before Collecting Generation Parameters:
- NEVER start collecting generation parameters (grade, subject, difficulty) without explicit confirmation first
- Even if user says "I need a lesson not in the library" or "recommend lessons to create", they are asking for IDEAS not actual generation
- You MUST ask: "Would you like me to generate a custom lesson?" and wait for their response
- Only start collecting generation parameters if they explicitly confirm they want generation ("yes", "yes, generate", "create one", "make a lesson")
- If they say "no", "search", "recommend", "I'm not sure", "not yet", "I want ideas first" → SEARCH existing lessons and provide recommendations
- This confirmation prevents accidentally entering generation flow when they just want suggestions

CRITICAL ESCAPE MECHANISM - If You're Already Collecting Generation Parameters:
- If user responds with ANYTHING that is NOT a direct answer to the parameter you asked for, they are trying to ESCAPE generation
- Examples: You ask "What grade level?" and they say:
  - "I need recommendations" → NOT a grade level → ESCAPE
  - "I'm not ready to decide" → NOT a grade level → ESCAPE
  - "Stop asking me this" → NOT a grade level → ESCAPE
  - "Give me advice instead" → NOT a grade level → ESCAPE
  - "4th" → IS a grade level → continue
- When you detect ANY non-parameter response: IMMEDIATELY STOP collecting parameters, DO NOT call generate_lesson, respond conversationally and offer to search/recommend instead
- Re-assess what they actually want - they're telling you they don't want to generate
- Do NOT continue asking for the next parameter - they've changed their mind

CRITICAL: When someone asks about lessons, DON'T say "I can't access" or "I'm unable to" - JUST USE THE SEARCH TOOL.
CRITICAL: When someone asks you to schedule a lesson, you MUST call the schedule_lesson function. DO NOT confirm scheduling without actually calling it.
CRITICAL: NEVER say "I've scheduled" or "has been scheduled" unless you actually called the schedule_lesson function and got a success response.
CRITICAL: When someone asks you to assign a lesson to a learner (make it available), you MUST call the assign_lesson function. DO NOT confirm assignment without actually calling it.
CRITICAL: NEVER say "I've assigned" unless you actually called assign_lesson and got a success response.
If you need details on parameters, call get_capabilities first.
Use these tools proactively - they expect you to search and find things for them.

Best Practices:
1. Search first - they may have already created what they need
2. To find THEIR lessons: search with subject="facilitator"
3. Get details to understand lesson scope before recommending
4. Confirm actions: "I found 3 lessons you created on fractions..."
5. Keep it conversational - never mention "function calls" or technical details

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
    // Credentials load failed - TTS will be unavailable
  }
  return null
}

async function getTtsClient() {
  if (ttsClientPromise) return ttsClientPromise

  const credentials = loadTtsCredentials()
  if (!credentials) {
    // No credentials - voice playback disabled
    return null
  }

  ttsClientPromise = (async () => {
    try {
      return new TextToSpeechClient({ credentials })
    } catch (error) {
      // TTS client init failed
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

function pushToolLog(toolLog, entry) {
  if (!Array.isArray(toolLog)) return
  const message = buildToolLogMessage(entry?.name, entry?.phase, entry?.context)
  if (!message) return
  toolLog.push({
    id: entry?.id || createCallId(),
    timestamp: Date.now(),
    name: entry?.name,
    phase: entry?.phase,
    message,
    context: entry?.context || {}
  })
}

function buildToolLogMessage(name, phase, context = {}) {
  switch (name) {
    case 'search_lessons':
      if (phase === 'start') {
        const topic = context.searchTerm ? ` for "${context.searchTerm}"` : ''
        return `Searching the lesson library${topic}...`
      }
      if (phase === 'success') {
        const count = Number(context.count || 0)
        if (count <= 0) return 'No matching lessons yet.'
        return `Found ${count} lesson${count === 1 ? '' : 's'}.`
      }
      if (phase === 'error') return 'Could not search the lesson library.'
      break
    case 'get_lesson_details':
      if (phase === 'start') return 'Reviewing lesson details...'
      if (phase === 'success') return 'Finished reviewing the lesson.'
      if (phase === 'error') return 'Could not review the lesson.'
      break
    case 'generate_lesson':
      if (phase === 'start') return 'Designing a new lesson...'
      if (phase === 'success') return 'Lesson draft is ready.'
      if (phase === 'error') return 'Lesson generation did not finish.'
      break
    case 'validate_lesson':
      if (phase === 'start') return 'Validating the new lesson...'
      if (phase === 'success') return 'Lesson quality checks passed.'
      if (phase === 'error') return 'Lesson needs a few improvements.'
      break
    case 'improve_lesson':
      if (phase === 'start') return 'Polishing the lesson...'
      if (phase === 'success') return 'Lesson improvements applied.'
      if (phase === 'error') return 'Unable to improve the lesson automatically.'
      break
    case 'schedule_lesson':
      if (phase === 'start') return 'Adding the lesson to the schedule...'
      if (phase === 'success') {
        const learner = context.learnerName ? ` for ${context.learnerName}` : ''
        const date = context.scheduledDate ? ` on ${context.scheduledDate}` : ''
        return `Lesson scheduled${learner}${date}.`
      }
      if (phase === 'error') return 'Could not schedule the lesson.'
      break
    case 'assign_lesson':
      if (phase === 'start') return 'Making the lesson available to the learner...'
      if (phase === 'success') {
        const learner = context.learnerName ? ` for ${context.learnerName}` : ''
        return `Lesson assigned${learner}.`
      }
      if (phase === 'error') return 'Could not assign the lesson.'
      break
    case 'edit_lesson':
      if (phase === 'start') return 'Improving the lesson...'
      if (phase === 'success') return 'Lesson updates are saved.'
      if (phase === 'error') return 'Lesson updates could not be applied.'
      break
    case 'get_capabilities':
      if (phase === 'start') return 'Checking available tools...'
      if (phase === 'success') return 'Tool overview ready.'
      if (phase === 'error') return 'Could not refresh tool overview.'
      break
    case 'get_conversation_memory':
      if (phase === 'start') return 'Reviewing prior notes...'
      if (phase === 'success') {
        const turnCount = Number(context.turnCount || 0)
        return turnCount > 0 ? 'Pulled in previous conversation notes.' : 'No prior notes on this topic.'
      }
      if (phase === 'error') return 'Could not load prior notes.'
      break
    case 'search_conversation_history':
      if (phase === 'start') return 'Looking back through our conversations...'
      if (phase === 'success') {
        const count = Number(context.count || 0)
        if (count <= 0) return 'No past conversations found on that topic.'
        return `Found ${count} related conversation${count === 1 ? '' : 's'}.`
      }
      if (phase === 'error') return 'Conversation search did not work.'
      break
    default:
      if (phase === 'start') return 'Working on it...'
      if (phase === 'success') return 'All set.'
      if (phase === 'error') return 'Something went wrong.'
  }
  return ''
}

function previewText(text, max = 600) {
  if (!text) return ''
  const value = typeof text === 'string' ? text : String(text)
  if (value.length <= max) return value
  const remaining = value.length - max
  return `${value.slice(0, max)}... [truncated ${remaining} chars]`
}

// Helper function to synthesize audio with caching
async function synthesizeAudio(text, logPrefix) {
  let audioContent = undefined
  
  // Strip markdown formatting for TTS (keep text readable but remove syntax)
  // Remove **bold**, *italic*, and other markdown markers
  const cleanTextForTTS = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove **bold**
    .replace(/\*([^*]+)\*/g, '$1')      // Remove *italic*
    .replace(/_([^_]+)_/g, '$1')        // Remove _underline_
    .replace(/`([^`]+)`/g, '$1')        // Remove `code`
    .replace(/^#+\s+/gm, '')            // Remove # headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Remove [links](url)
  
  // Check cache first (use cleaned text as key)
  if (ttsCache.has(cleanTextForTTS)) {
    audioContent = ttsCache.get(cleanTextForTTS)
  } else {
    const ttsClient = await getTtsClient()
    if (ttsClient) {
      try {
        const ssml = toSsml(cleanTextForTTS)
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
          ttsCache.set(cleanTextForTTS, audioContent)
          if (ttsCache.size > TTS_CACHE_MAX) {
            const firstKey = ttsCache.keys().next().value
            ttsCache.delete(firstKey)
          }
        }
      } catch (ttsError) {
        // TTS synthesis failed - will return undefined
      }
    }
  }
  
  return audioContent
}

// Helper function to provide capability information
function getCapabilitiesInfo(args) {
  const { action } = args
  
  const capabilities = {
    search_lessons: {
      name: 'search_lessons',
      purpose: 'Search for available lessons across ALL subjects including facilitator-created lessons. You have full access to everything in the library.',
      when_to_use: 'When facilitator asks about available lessons, wants to find lessons on a topic, or needs to browse options. Use subject="facilitator" to find ONLY their custom-created lessons.',
      parameters: {
        subject: 'Optional. Filter by: math, science, language arts, social studies, or facilitator (their custom lessons)',
        grade: 'Optional. Grade level like "3rd", "5th", "8th"',
        searchTerm: 'Optional. Keywords to match in lesson titles'
      },
      returns: 'List of up to 30 matching lessons with title, grade, subject, difficulty, lessonKey (for scheduling), and blurb',
      examples: [
        'Search for 3rd grade multiplication: {subject: "math", grade: "3rd", searchTerm: "multiplication"}',
        'Find facilitator-created lessons: {subject: "facilitator"}',
        'Find their lessons on a topic: {subject: "facilitator", searchTerm: "fractions"}'
      ]
    },
    
    get_lesson_details: {
      name: 'get_lesson_details',
      purpose: 'Get full details of a specific lesson including vocabulary, teaching notes, and question counts',
      when_to_use: 'When you need to understand lesson content to make recommendations or facilitator asks "tell me more about..."',
      parameters: {
        lessonKey: 'Required. Format: "subject/filename.json" (you get this from search_lessons results)'
      },
      returns: 'Lesson details: vocabulary (first 5 terms), teaching notes, question counts by type, grade, difficulty, blurb',
      example: 'Get photosynthesis details: {lessonKey: "science/Photosynthesis_Basics.json"}'
    },
    
    generate_lesson: {
      name: 'generate_lesson',
      purpose: 'Create a custom lesson when existing lessons don\'t meet the need AND user explicitly requests generation',
      when_to_use: 'ONLY when facilitator uses imperative generation language: "create a lesson", "generate a lesson", "make me a lesson". DO NOT use when they ask "do you have suggestions?", "what do you recommend?", "any ideas?", or similar advice-seeking language. For recommendations, search existing lessons instead. If uncertain, ASK FIRST: "Would you like me to generate a custom lesson?" Only proceed with generation after explicit confirmation.',
      parameters: {
        title: 'Required. Lesson title like "Photosynthesis Basics"',
        subject: 'Required. One of: math, science, language arts, social studies',
        grade: 'Required. Grade level like "3rd", "5th", "8th"',
        difficulty: 'Required. One of: Beginner, Intermediate, Advanced',
        description: 'Required. Brief description of lesson content and what it covers',
        vocab: 'Optional. Comma-separated vocabulary terms to emphasize',
        notes: 'Optional. Additional guidance for lesson creation'
      },
      returns: 'Success confirmation with lesson file name and title. Lesson is saved to facilitator\'s library.',
      notes: 'Takes 30-60 seconds. Requires a paid plan (Standard/Pro). ALWAYS search first before generating.',
      example: 'Generate 5th grade science: {title: "Water Cycle", subject: "science", grade: "5th", difficulty: "Intermediate", description: "Learn about evaporation, condensation, and precipitation"}'
    },
    
    schedule_lesson: {
      name: 'schedule_lesson',
      purpose: 'Add a lesson to a learner\'s calendar for a specific date',
      when_to_use: 'When facilitator asks to schedule/add a lesson to a calendar, or says "put that on Monday"',
      parameters: {
        learnerName: 'Required. The learner\'s name (e.g., "Emma"). The system will find the matching learner.',
        lessonKey: 'Required. Format: "subject/filename.json" (you get this from search results or after generating)',
        scheduledDate: 'Required. Date in YYYY-MM-DD format. CRITICAL: The current year is 2025. When user says "October 26th" they mean 2025-10-26, NOT 2023. Always use year 2025 unless they specify a different year. Convert natural language like "next Monday" to proper format.'
      },
      returns: 'Success confirmation with scheduled date and lesson key',
      notes: 'Use learnerName when calling schedule_lesson. If the name is ambiguous, ask the facilitator to clarify.',
      example: 'Schedule for Emma on Dec 18: {learnerName: "Emma", lessonKey: "math/Multiplication_Basics.json", scheduledDate: "2025-12-18"}'
    },

    assign_lesson: {
      name: 'assign_lesson',
      purpose: 'Assign a lesson to a learner so it shows up as available (not scheduled on a date)',
      when_to_use: 'When facilitator asks to assign a lesson, make it available, or show it to a learner without choosing a date',
      parameters: {
        learnerName: 'Required. The learner\'s name (e.g., "Emma"). The system will find the matching learner.',
        lessonKey: 'Required. Format: "subject/filename.json" (from search results or after generating).',
        lessonTitle: 'Optional. Human-readable title for confirmation (if known). If unknown, call get_lesson_details first.'
      },
      returns: 'Success confirmation with learner name and lesson key',
      notes: 'Use assign_lesson when the user says "assign" and does not request a calendar date. For calendar placement, use schedule_lesson.',
      example: 'Assign for Emma: {learnerName: "Emma", lessonKey: "math/Multiplication_Basics.json"}'
    },
    
    edit_lesson: {
      name: 'edit_lesson',
      purpose: 'Modify an existing lesson (works on ALL lessons: installed subjects like math/science AND facilitator-created lessons)',
      when_to_use: 'When facilitator asks to change/fix/update/edit a lesson, correct errors, add vocabulary, improve questions, etc.',
      parameters: {
        lessonKey: 'Required. Format: "subject/filename.json" (from search results)',
        updates: 'Required. Object with fields to update. Can include: title, blurb, teachingNotes, vocab (array of {term, definition}), truefalse, multiplechoice, shortanswer, fillintheblank (arrays of questions)'
      },
      returns: 'Success confirmation that lesson was updated',
      notes: 'Can edit ANY lesson - both pre-installed subject lessons AND custom facilitator lessons. Get current lesson with get_lesson_details first, then send only the fields that need to change.',
      examples: [
        'Fix teaching notes: {lessonKey: "science/Photosynthesis.json", updates: {teachingNotes: "Updated notes..."}}',
        'Add vocabulary: {lessonKey: "math/Fractions.json", updates: {vocab: [{term: "numerator", definition: "Top number"}, {term: "denominator", definition: "Bottom number"}]}}',
        'Update blurb: {lessonKey: "facilitator/Custom_Lesson.json", updates: {blurb: "New description"}}'
      ]
    },
    
    get_conversation_memory: {
      name: 'get_conversation_memory',
      purpose: 'Retrieve conversation memory from previous sessions for continuity',
      when_to_use: 'To maintain context across sessions, reference past discussions, or when facilitator mentions something from before',
      parameters: {
        learner_id: 'Optional. If discussing a specific learner, provide their ID to get learner-specific conversation history. Omit for general facilitator conversations.'
      },
      returns: 'Conversation summary, recent turns, and turn count. Returns null if no previous conversation exists.',
      notes: 'This is automatically called at the start of each conversation. You can also call it explicitly when you need to reference past context.',
      example: 'Get general memory: {} or Get learner-specific: {learner_id: "abc123"}'
    },
    
    search_conversation_history: {
      name: 'search_conversation_history',
      purpose: 'Search past conversations using keywords (fuzzy matching)',
      when_to_use: 'When facilitator asks "what did we discuss about X?" or wants to review past advice, plans, or topics',
      parameters: {
        search: 'Required. Keywords or phrases to search for in conversation summaries',
        include_archive: 'Optional. Set to true to also search archived conversations (default: false)'
      },
      returns: 'List of matching conversations with summaries, dates, and learner context',
      notes: 'Uses PostgreSQL full-text search with fuzzy matching. Searches both current and optionally archived conversations.',
      examples: [
        'Search recent: {search: "math curriculum"}',
        'Search all history: {search: "Emma reading struggles", include_archive: true}'
      ]
    }
  }
  
  const workflow = {
    best_practices: [
      'SEARCH FIRST: Always search for existing lessons before generating new ones',
      'GET DETAILS: Review lesson content before recommending to ensure good fit',
      'EDIT WHEN NEEDED: If a lesson needs corrections or improvements, use edit_lesson',
      'ASK FOR CLARIFICATION: If missing required parameters, ask the facilitator',
      'CONFIRM ACTIONS: After completing an action, confirm what was done',
      'NATURAL LANGUAGE: Don\'t mention function names or technical details to the user'
    ],
    
    typical_workflow: [
      '1. Facilitator asks about a topic',
      '2. Search for relevant lessons',
      '3. Review top matches with get_lesson_details',
      '4. Recommend best fit OR generate if nothing suitable OR edit if needs changes',
      '5. Schedule for learner if requested',
      '6. Confirm completion and suggest next steps'
    ],
    
    common_scenarios: {
      'Need a lesson on topic X': 'search_lessons → get_lesson_details (top result) → recommend or generate → schedule',
      'What lessons do you have on X?': 'search_lessons → list results → offer to provide details',
      'Tell me about lesson Y': 'get_lesson_details → summarize',
      'Create a lesson about X': 'generate_lesson (but search first!)',
      'Schedule lesson for learner': 'schedule_lesson (need lessonKey from search/generate)',
      'Assign lesson to learner': 'assign_lesson (need lessonKey from search/generate)',
      'Fix/edit a lesson': 'get_lesson_details → edit_lesson (with updates)'
    }
  }
  
  if (action && action !== 'all' && capabilities[action]) {
    return {
      success: true,
      action: action,
      details: capabilities[action],
      message: `Retrieved details for ${action}`
    }
  }
  
  return {
    success: true,
    capabilities: capabilities,
    workflow: workflow,
    message: 'Retrieved all capabilities and workflow guidance'
  }
}

// Helper function to search for lessons
async function executeSearchLessons(args, request, toolLog) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return { error: 'Authentication required' }
    }
    
    const { subject, grade, searchTerm } = args
  const baseUrl = resolveBaseUrl(request)
    pushToolLog(toolLog, {
      name: 'search_lessons',
      phase: 'start',
      context: { subject, grade, searchTerm }
    })
    
  // Get lessons from all subjects
  const subjects = subject ? [subject] : ['math', 'science', 'language arts', 'social studies', 'facilitator']
  const allLessons = []
    
    for (const subj of subjects) {
      try {
  const lessonEndpoint = new URL(`/api/lessons/${encodeURIComponent(subj)}`, baseUrl)
  const lessonResponse = await fetch(lessonEndpoint, {
          method: 'GET',
          headers: {
            'Authorization': authHeader
          }
        })
        
        if (lessonResponse.ok) {
          const lessonData = await lessonResponse.json()
          // API returns array directly for most subjects, or {lessons: [...]} for some
          const lessons = Array.isArray(lessonData) ? lessonData : (lessonData.lessons || [])
          
          // Filter by grade if specified
          let filtered = lessons
          if (grade) {
            filtered = filtered.filter(l => {
              const lessonGrade = l.grade || l.gradeLevel || ''
              return lessonGrade.toLowerCase().includes(grade.toLowerCase())
            })
          }
          
          // Filter by search term if specified (fuzzy matching)
          if (searchTerm) {
            const normalizedSearch = searchTerm.toLowerCase()
              .replace(/[_-]/g, ' ')  // Replace underscores and hyphens with spaces
              .trim()
            
            // Split into words, but ignore very short words like "at", "a", "the"
            const searchWords = normalizedSearch
              .split(/\s+/)
              .filter(w => w.length > 2)  // Only keep words longer than 2 chars
            
            // Also keep the full search term for exact phrase matching
            const fullSearchTerm = normalizedSearch
            
            filtered = filtered.filter(l => {
              const title = (l.title || '').toLowerCase().replace(/[_-]/g, ' ')
              const file = (l.file || '').toLowerCase().replace(/[_-]/g, ' ')
              const blurb = (l.blurb || '').toLowerCase()
              const subject = (l.subject || '').toLowerCase()
              
              // Combine all searchable text
              const searchableText = `${title} ${file} ${blurb} ${subject}`
              
              // Exact phrase match (highest priority)
              if (searchableText.includes(fullSearchTerm)) {
                return true
              }
              
              // Match if at least 50% of significant words appear
              if (searchWords.length > 0) {
                const matchCount = searchWords.filter(word => searchableText.includes(word)).length
                const matchRatio = matchCount / searchWords.length
                return matchRatio >= 0.5  // At least half the words must match
              }
              
              // If no significant words, fall back to the full term
              return searchableText.includes(fullSearchTerm)
            })
          }
          
          // Add to results with normalized lessonKey
          filtered.forEach(lesson => {
            const combinedKey = `${subj}/${lesson.file}`
            const normalizedKey = normalizeLessonKey(combinedKey)
            allLessons.push({
              title: lesson.title,
              grade: lesson.grade || lesson.gradeLevel,
              subject: normalizedKey.split('/')[0],
              difficulty: lesson.difficulty,
              lessonKey: normalizedKey,
              rawLessonKey: combinedKey,
              blurb: lesson.blurb
            })
          })
        }
      } catch (err) {
        // Failed to fetch lessons for this subject
      }
    }
    
    // Limit results to avoid overwhelming the prompt
    const limitedResults = allLessons.slice(0, 30)
    
    const payload = {
      success: true,
      count: limitedResults.length,
      totalFound: allLessons.length,
      lessons: limitedResults,
      message: limitedResults.length === 0 
        ? 'No lessons found matching your criteria.' 
        : `Found ${allLessons.length} lessons${limitedResults.length < allLessons.length ? `, showing first ${limitedResults.length}` : ''}.`
    }

    pushToolLog(toolLog, {
      name: 'search_lessons',
      phase: 'success',
      context: { count: limitedResults.length }
    })

    return payload
  } catch (err) {
    pushToolLog(toolLog, {
      name: 'search_lessons',
      phase: 'error',
      context: { message: err?.message || String(err) }
    })
    return { error: err.message || String(err) }
  }
}

// Helper function to get lesson details
async function executeGetLessonDetails(args, request, toolLog) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return { error: 'Authentication required' }
    }
    
  const { lessonKey } = args
  const normalizedLessonKey = normalizeLessonKey(lessonKey)
  const [subject, filename] = lessonKey.split('/')
  const subjectLower = (subject || '').toLowerCase()
  const normalizedSubject = (normalizedLessonKey.split('/')[0] || subjectLower)
  const baseUrl = resolveBaseUrl(request)

    pushToolLog(toolLog, {
      name: 'get_lesson_details',
      phase: 'start',
      context: { lessonKey: normalizedLessonKey }
    })
    
    if (!subject || !filename) {
      return { error: 'Invalid lesson key format. Expected "subject/filename.json"' }
    }
    
    let lessonData
    
    // Handle facilitator-generated lessons differently (they're in Supabase, not the public folder)
    if (subjectLower === 'facilitator' || subjectLower === 'generated') {
      // Get userId from auth token
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
      if (!token) {
        return { error: 'Authentication required' }
      }
      
      // Get user ID from token
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      if (!supabaseUrl || !anonKey) {
        return { error: 'Storage not configured' }
      }
      
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const userClient = createClient(supabaseUrl, anonKey, { 
          global: { headers: { Authorization: `Bearer ${token}` } }, 
          auth: { persistSession: false } 
        })
        const { data: { user } } = await userClient.auth.getUser()
        const userId = user?.id
        
        if (!userId) {
          return { error: 'User not authenticated' }
        }
        
    // Fetch from facilitator lessons API
    const facilitatorUrl = new URL('/api/facilitator/lessons/get', baseUrl)
    facilitatorUrl.searchParams.set('file', filename)
    facilitatorUrl.searchParams.set('userId', userId)
    const facilitatorResponse = await fetch(facilitatorUrl)
        
        if (!facilitatorResponse.ok) {
          pushToolLog(toolLog, {
            name: 'get_lesson_details',
            phase: 'error',
            context: { lessonKey: normalizedLessonKey, message: 'Facilitator lesson not found' }
          })
          return { error: 'Facilitator lesson not found' }
        }
        
        lessonData = await facilitatorResponse.json()
      } catch (err) {
        pushToolLog(toolLog, {
          name: 'get_lesson_details',
          phase: 'error',
          context: { lessonKey: normalizedLessonKey, message: err?.message || String(err) }
        })
        return { error: `Failed to fetch facilitator lesson: ${err.message}` }
      }
    } else {
    // Fetch from public folder via API endpoint for standard lessons
    const lessonUrl = new URL('/api/lesson-file', baseUrl)
    lessonUrl.searchParams.set('key', normalizedLessonKey)
      
    const lessonResponse = await fetch(lessonUrl, {
        method: 'GET',
        headers: {
          'Authorization': authHeader
        }
      })
      
      if (!lessonResponse.ok) {
        const errorText = await lessonResponse.text()
        pushToolLog(toolLog, {
          name: 'get_lesson_details',
          phase: 'error',
          context: { lessonKey: normalizedLessonKey, message: errorText }
        })
        return { error: `Lesson file not found: ${errorText}` }
      }
      
      lessonData = await lessonResponse.json()
    }
    
    // Return a summary of the lesson (not the full content to keep prompt size down)
    const payload = {
  success: true,
  lessonKey: normalizedLessonKey,
      title: lessonData.title,
      grade: lessonData.grade || lessonData.gradeLevel,
      difficulty: lessonData.difficulty,
  subject: lessonData.subject || normalizedSubject,
      blurb: lessonData.blurb,
      vocabulary: (lessonData.vocab || []).slice(0, 5).map(v => typeof v === 'string' ? v : v.term),
      teachingNotes: lessonData.teachingNotes,
      questionCounts: {
        // REMOVED: sample - deprecated zombie code
        truefalse: (lessonData.truefalse || []).length,
        multiplechoice: (lessonData.multiplechoice || []).length,
        fillintheblank: (lessonData.fillintheblank || []).length,
        shortanswer: (lessonData.shortanswer || []).length
      },
      message: `Retrieved details for "${lessonData.title}"`
    }

    pushToolLog(toolLog, {
      name: 'get_lesson_details',
      phase: 'success',
      context: { lessonKey: normalizedLessonKey }
    })

    return payload
  } catch (err) {
    pushToolLog(toolLog, {
      name: 'get_lesson_details',
      phase: 'error',
      context: { message: err?.message || String(err) }
    })
    return { error: err.message || String(err) }
  }
}

// Helper function to execute lesson generation with validation and auto-fix
async function executeLessonGeneration(args, request, toolLog) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return { error: 'Authentication required' }
    }
    
    pushToolLog(toolLog, {
      name: 'generate_lesson',
      phase: 'start',
      context: { title: args?.title }
    })
    
    // Call the lesson generation API directly (avoid HTTP timeout stacking)
    try {
      // Import and call the generate route's POST handler directly
      const { POST: generatePOST } = await import('@/app/api/facilitator/lessons/generate/route')
      
      // Create a mock request object with the args and auth header
      const mockRequest = new Request('http://localhost/api/facilitator/lessons/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(args)
      })
      
      const genResponse = await generatePOST(mockRequest)
      const responseData = await genResponse.json()
      
      if (!genResponse.ok) {
        pushToolLog(toolLog, {
          name: 'generate_lesson',
          phase: 'error',
          context: { title: args?.title, message: responseData.error }
        })
        return { error: responseData.error || 'Lesson generation failed' }
      }
      
      pushToolLog(toolLog, {
        name: 'generate_lesson',
        phase: 'success',
        context: { title: responseData.lesson?.title }
      })
      
      // Build the lessonKey in the format needed for scheduling: "facilitator/filename.json"
      const lessonKey = `facilitator/${responseData.file}`
      
      // Return the generated lesson data so frontend can validate and fix if needed
      return {
        success: true,
        lessonFile: responseData.file,
        lessonKey: lessonKey,
        lessonTitle: responseData.lesson?.title,
        userId: responseData.userId,
        lesson: responseData.lesson,
        message: `Lesson "${responseData.lesson?.title}" has been generated. The system will now validate its quality.`
      }
    } catch (genError) {
      pushToolLog(toolLog, {
        name: 'generate_lesson',
        phase: 'error',
        context: { title: args?.title, message: genError.message }
      })
      return { error: 'Lesson generation failed: ' + genError.message }
    }
  } catch (err) {
    pushToolLog(toolLog, {
      name: 'generate_lesson',
      phase: 'error',
      context: { message: err?.message || String(err) }
    })
    return { error: err.message || String(err) }
  }
}

// Helper function to execute lesson scheduling
async function executeLessonScheduling(args, request, toolLog) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return { error: 'Authentication required' }
    }
    const baseUrl = resolveBaseUrl(request)
    pushToolLog(toolLog, {
      name: 'schedule_lesson',
      phase: 'start',
      context: { learnerName: args.learnerName, scheduledDate: args.scheduledDate }
    })
    
    // Validate required parameters
    if (!args.learnerName) {
      return { error: 'Missing learnerName - you need to specify which learner to schedule for' }
    }
    if (!args.lessonKey) {
      return { error: 'Missing lessonKey - need the lesson identifier like "subject/filename.json"' }
    }
    if (!args.scheduledDate) {
      return { error: 'Missing scheduledDate - need date in YYYY-MM-DD format' }
    }
    
  const normalizedLessonKey = normalizeLessonKey(args.lessonKey)

  // Look up the learner by name via Supabase
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    const { data: learners, error: learnersError } = await supabase
      .from('learners')
      .select('id, name')
      .order('created_at', { ascending: false })
    
    if (learnersError) {
      return { error: 'Failed to fetch learners list', details: learnersError }
    }
    
    const normalizedSearchName = args.learnerName.toLowerCase().trim()
    const matchingLearner = learners.find(l => 
      l.name?.toLowerCase().trim() === normalizedSearchName
    )
    
    if (!matchingLearner) {
      pushToolLog(toolLog, {
        name: 'schedule_lesson',
        phase: 'error',
        context: { message: `Learner ${args.learnerName} not found` }
      })
      return { 
        error: `Could not find a learner named "${args.learnerName}". Available learners: ${learners.map(l => l.name).join(', ')}` 
      }
    }
    
    // Call the lesson schedule API with the learner ID
  const scheduleUrl = new URL('/api/lesson-schedule', baseUrl)
  const schedResponse = await fetch(scheduleUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        learnerId: matchingLearner.id,
        lessonKey: normalizedLessonKey,
        scheduledDate: args.scheduledDate
      })
    })
    
    const result = await schedResponse.json()
    
    if (!schedResponse.ok) {
      pushToolLog(toolLog, {
        name: 'schedule_lesson',
        phase: 'error',
        context: { message: result.error || 'Lesson scheduling failed' }
      })
      return { error: result.error || 'Lesson scheduling failed', details: result }
    }
    
    pushToolLog(toolLog, {
      name: 'schedule_lesson',
      phase: 'success',
      context: { learnerName: matchingLearner.name, scheduledDate: args.scheduledDate }
    })
    return {
      success: true,
  scheduledDate: args.scheduledDate,
  lessonKey: normalizedLessonKey,
      learnerName: matchingLearner.name,
      message: `Lesson has been scheduled for ${matchingLearner.name} on ${args.scheduledDate}.`
    }
  } catch (err) {
    pushToolLog(toolLog, {
      name: 'schedule_lesson',
      phase: 'error',
      context: { message: err?.message || String(err) }
    })
    return { error: err.message || String(err) }
  }
}

// Helper function to execute lesson assignment (approved_lessons)
async function executeLessonAssignment(args, request, toolLog) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return { error: 'Authentication required' }
    }

    const baseUrl = resolveBaseUrl(request)
    pushToolLog(toolLog, {
      name: 'assign_lesson',
      phase: 'start',
      context: { learnerName: args.learnerName }
    })

    if (!args.learnerName) {
      return { error: 'Missing learnerName - you need to specify which learner to assign for' }
    }
    if (!args.lessonKey) {
      return { error: 'Missing lessonKey - need the lesson identifier like "subject/filename.json"' }
    }

    const normalizedLessonKey = normalizeLessonKey(args.lessonKey)

    // Look up the learner by name via Supabase (route will verify authorization on write)
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: learners, error: learnersError } = await supabase
      .from('learners')
      .select('id, name')
      .order('created_at', { ascending: false })

    if (learnersError) {
      return { error: 'Failed to fetch learners list', details: learnersError }
    }

    const normalizedSearchName = args.learnerName.toLowerCase().trim()
    const matchingLearner = learners.find(l =>
      l.name?.toLowerCase().trim() === normalizedSearchName
    )

    if (!matchingLearner) {
      pushToolLog(toolLog, {
        name: 'assign_lesson',
        phase: 'error',
        context: { message: `Learner ${args.learnerName} not found` }
      })
      return {
        error: `Could not find a learner named "${args.learnerName}". Available learners: ${learners.map(l => l.name).join(', ')}`
      }
    }

    const assignUrl = new URL('/api/lesson-assign', baseUrl)
    const assignResponse = await fetch(assignUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        learnerId: matchingLearner.id,
        lessonKey: normalizedLessonKey,
        assigned: true
      })
    })

    const result = await assignResponse.json().catch(() => ({}))

    if (!assignResponse.ok) {
      pushToolLog(toolLog, {
        name: 'assign_lesson',
        phase: 'error',
        context: { message: result.error || 'Lesson assignment failed' }
      })
      return { error: result.error || 'Lesson assignment failed', details: result }
    }

    pushToolLog(toolLog, {
      name: 'assign_lesson',
      phase: 'success',
      context: { learnerName: matchingLearner.name }
    })

    let resolvedTitle = args.lessonTitle || null
    if (!resolvedTitle) {
      const details = await executeGetLessonDetails({ lessonKey: normalizedLessonKey }, request, toolLog)
      if (details?.success && details?.title) {
        resolvedTitle = details.title
      }
    }

    return {
      success: true,
      lessonKey: normalizedLessonKey,
      learnerName: matchingLearner.name,
      lessonTitle: resolvedTitle,
      message: `Lesson has been assigned for ${matchingLearner.name}.`
    }
  } catch (err) {
    pushToolLog(toolLog, {
      name: 'assign_lesson',
      phase: 'error',
      context: { message: err?.message || String(err) }
    })
    return { error: err.message || String(err) }
  }
}

// Helper function to execute lesson editing
async function executeLessonEdit(args, request, toolLog) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return { error: 'Authentication required' }
    }
    const baseUrl = resolveBaseUrl(request)
    
    const { lessonKey, updates } = args
    
    if (!lessonKey || !updates) {
      return { error: 'Missing lessonKey or updates' }
    }
    pushToolLog(toolLog, {
      name: 'edit_lesson',
      phase: 'start',
      context: { lessonKey }
    })
    
    // Call the lesson edit API
  const editUrl = new URL('/api/lesson-edit', baseUrl)
  const editResponse = await fetch(editUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({ lessonKey, updates })
    })
    
    const result = await editResponse.json()
    
    if (!editResponse.ok) {
      pushToolLog(toolLog, {
        name: 'edit_lesson',
        phase: 'error',
        context: { lessonKey, message: result.error }
      })
      return { error: result.error || 'Lesson edit failed' }
    }
    
    pushToolLog(toolLog, {
      name: 'edit_lesson',
      phase: 'success',
      context: { lessonKey }
    })
    return {
      success: true,
      lessonKey: lessonKey,
      message: `Lesson "${lessonKey}" has been updated successfully.`
    }
  } catch (err) {
    pushToolLog(toolLog, {
      name: 'edit_lesson',
      phase: 'error',
      context: { message: err?.message || String(err) }
    })
    return { error: err.message || String(err) }
  }
}

// Helper function to get conversation memory
async function executeGetConversationMemory(args, request, toolLog) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return { error: 'Authentication required' }
    }
    const baseUrl = resolveBaseUrl(request)
    
    const { learner_id = null } = args
    pushToolLog(toolLog, {
      name: 'get_conversation_memory',
      phase: 'start',
      context: { learnerId: learner_id }
    })
    
    // Build URL with query params
    const url = new URL('/api/conversation-memory', baseUrl)
    if (learner_id) {
      url.searchParams.set('learner_id', learner_id)
    }
    
    const memoryResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader
      }
    })
    
    const result = await memoryResponse.json()
    
    if (!memoryResponse.ok) {
      pushToolLog(toolLog, {
        name: 'get_conversation_memory',
        phase: 'error',
        context: { message: result.error }
      })
      return { error: result.error || 'Failed to fetch conversation memory' }
    }
    
    if (!result.conversation_update) {
      pushToolLog(toolLog, {
        name: 'get_conversation_memory',
        phase: 'success',
        context: { turnCount: 0 }
      })
      return {
        success: true,
        has_memory: false,
        message: 'No previous conversation memory found for this context.'
      }
    }
    
    pushToolLog(toolLog, {
      name: 'get_conversation_memory',
      phase: 'success',
      context: { turnCount: result.conversation_update.turn_count }
    })

    return {
      success: true,
      has_memory: true,
      summary: result.conversation_update.summary,
      turn_count: result.conversation_update.turn_count,
      last_updated: result.conversation_update.updated_at,
      recent_context: result.conversation_update.recent_turns?.slice(-3) || [], // Last 3 turns for immediate context
      message: `Retrieved conversation memory with ${result.conversation_update.turn_count} turns.`
    }
  } catch (err) {
    pushToolLog(toolLog, {
      name: 'get_conversation_memory',
      phase: 'error',
      context: { message: err?.message || String(err) }
    })
    return { error: err.message || String(err) }
  }
}

// Helper function to search conversation history
async function executeSearchConversationHistory(args, request, toolLog) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return { error: 'Authentication required' }
    }
    const baseUrl = resolveBaseUrl(request)
    
    const { search, include_archive = false } = args
    
    if (!search || search.trim() === '') {
      return { error: 'Search query required' }
    }
    pushToolLog(toolLog, {
      name: 'search_conversation_history',
      phase: 'start',
      context: { search }
    })
    
    // Build URL with query params
    const url = new URL('/api/conversation-memory', baseUrl)
    url.searchParams.set('search', search)
    if (include_archive) {
      url.searchParams.set('include_archive', 'true')
    }
    
    const searchResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader
      }
    })
    
    const result = await searchResponse.json()
    
    if (!searchResponse.ok) {
      pushToolLog(toolLog, {
        name: 'search_conversation_history',
        phase: 'error',
        context: { message: result.error }
      })
      return { error: result.error || 'Search failed' }
    }
    
    if (!result.results || result.results.length === 0) {
      pushToolLog(toolLog, {
        name: 'search_conversation_history',
        phase: 'success',
        context: { count: 0 }
      })
      return {
        success: true,
        count: 0,
        results: [],
        message: `No conversations found matching "${search}".`
      }
    }
    
    // Format results for readability
    const formatted = result.results.map(r => ({
      summary: r.summary,
      turn_count: r.turn_count,
      date: r.updated_at || r.archived_at,
      learner_context: r.learner_id ? 'Learner-specific' : 'General facilitator',
      archived: r.archived || false
    }))
    
    pushToolLog(toolLog, {
      name: 'search_conversation_history',
      phase: 'success',
      context: { count: result.count }
    })

    return {
      success: true,
      count: result.count,
      results: formatted,
      message: `Found ${result.count} conversation(s) matching "${search}".`
    }
  } catch (err) {
    pushToolLog(toolLog, {
      name: 'search_conversation_history',
      phase: 'error',
      context: { message: err?.message || String(err) }
    })
    return { error: err.message || String(err) }
  }
}

export async function POST(req) {
  const callId = createCallId()
  const logPrefix = `[Mr. Mentor][${callId}]`
  
  const baseUrl = resolveBaseUrl(req)
  
  try {
    // Parse request body
    let userMessage = ''
    let conversationHistory = []
    let followup = null
    let requireGenerationConfirmation = false
    let generationConfirmed = false
    let disableTools = []
    let subjectKey = null
    let useCohereChronograph = false
    let cohereSector = 'both'
    let cohereMode = 'standard'
    
    const contentType = (req.headers?.get?.('content-type') || '').toLowerCase()
    let learnerTranscript = null
    let goalsNotes = null
    try {
      if (contentType.includes('application/json')) {
        const body = await req.json()
        userMessage = (body.message || '').trim()
        conversationHistory = Array.isArray(body.history) ? body.history : []
        learnerTranscript = body.learner_transcript || null
        goalsNotes = body.goals_notes || null
        followup = body.followup || null
        requireGenerationConfirmation = !!body.require_generation_confirmation
        generationConfirmed = !!body.generation_confirmed
        disableTools = Array.isArray(body.disableTools) ? body.disableTools.filter(Boolean) : []
        subjectKey = typeof body.subject_key === 'string' ? body.subject_key.trim() : null

        // ThoughtHub (chronograph + deterministic packs) request flags.
        // Keep legacy field names for compatibility.
        const useThoughtHub = (typeof body.use_thought_hub === 'boolean')
          ? body.use_thought_hub
          : !!body.use_cohere_chronograph
        useCohereChronograph = !!useThoughtHub

        cohereSector = typeof body.thought_hub_sector === 'string'
          ? body.thought_hub_sector
          : (typeof body.cohere_sector === 'string' ? body.cohere_sector : 'both')

        cohereMode = typeof body.thought_hub_mode === 'string'
          ? body.thought_hub_mode
          : (typeof body.cohere_mode === 'string' ? body.cohere_mode : 'standard')
      } else {
        const textBody = await req.text()
        userMessage = textBody.trim()
      }
    } catch (parseErr) {
      return NextResponse.json({ error: `Invalid request format: ${parseErr.message}` }, { status: 400 })
    }

    const isFollowup = followup && typeof followup === 'object'

    if (!isFollowup && !userMessage) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
    }

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Mr. Mentor is unavailable.' }, { status: 500 })
    }

    // Build system prompt with learner context and goals if available
    let systemPrompt = MENTOR_SYSTEM_PROMPT
    
    if (goalsNotes) {
      systemPrompt += `\n\n=== PERSISTENT GOALS & PRIORITIES ===\nThe facilitator has set these persistent goals that should guide all conversations:\n\nPersistent Goals:\n${goalsNotes}\n\n=== END PERSISTENT GOALS ===\n\nIMPORTANT: These goals persist across all conversations. Reference them when relevant, and help the facilitator work toward them. The facilitator can update these goals anytime using the Goals clipboard button (📋) on screen.`
    }
    
    if (learnerTranscript) {
      systemPrompt += `\n\n=== CURRENT LEARNER CONTEXT ===\nThe facilitator has selected a specific learner to discuss. Here is their profile and progress:\n\n${learnerTranscript}\n\n=== END LEARNER CONTEXT ===\n\nIMPORTANT INSTRUCTIONS FOR THIS LEARNER:\n- When generating lessons, ALWAYS use the grade level shown in the learner profile above\n- When scheduling lessons, you can use the learner's name (e.g., "Emma", "John") and the system will find them\n- When searching for lessons, consider their current grade level and adjust difficulty accordingly\n\nUse this information to provide personalized, data-informed guidance. Reference specific achievements, struggles, or patterns you notice. Ask questions that help the facilitator reflect on this learner's unique needs and progress.`
    }

    // Load conversation memory for continuity (only if this is the first message in the conversation)
    // NOTE: In ThoughtHub mode, we rely on deterministic packs instead of this memory endpoint.
    if (!useCohereChronograph && conversationHistory.length === 0) {
      try {
        const authHeader = req.headers.get('authorization')
        if (authHeader) {
          const learnerId = learnerTranscript ? null : null // Extract learner ID if needed from transcript
          const memoryUrl = new URL('/api/conversation-memory', baseUrl)
          if (learnerId) {
            memoryUrl.searchParams.set('learner_id', learnerId)
          }
          
          const memoryResponse = await fetch(memoryUrl.toString(), {
            method: 'GET',
            headers: { 'Authorization': authHeader }
          })
          
          if (memoryResponse.ok) {
            const memoryData = await memoryResponse.json()
            if (memoryData.conversation_update) {
              const memory = memoryData.conversation_update
              systemPrompt += `\n\n=== CONVERSATION MEMORY ===\nYou have context from previous conversations with this facilitator${learnerId ? ' about this learner' : ''}.\n\nPrevious Summary (${memory.turn_count} turns):\n${memory.summary}\n\nLast Update: ${new Date(memory.updated_at).toLocaleDateString()}\n\n=== END CONVERSATION MEMORY ===\n\nUse this context to provide continuity. Reference past discussions naturally when relevant. If they mention something you discussed before, acknowledge it.`
            }
          }
        }
      } catch (memErr) {
        // Failed to load conversation memory - continue without it
      }
    }

    // Optional: Cohere-style chronograph + deterministic pack context.
    // When enabled, we:
    // - Append the user message as an immutable event
    // - Run FAQ gate (auto-reply / clarify / pass)
    // - Build a deterministic pack and include it in the system prompt
    // - Keep the on-wire history minimal (token savings)
    let cohereContextSystemMessage = ''
    let cohereMeta = null
    if (useCohereChronograph && subjectKey) {
      try {
        const auth = await cohereGetUserAndClient(req)
        if (auth?.error) {
          return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const { supabase } = auth
        const { tenantId, threadId } = await cohereEnsureThread({
          supabase,
          sector: cohereSector,
          subjectKey
        })

        cohereMeta = { tenantId, threadId, sector: cohereSector, subjectKey, mode: cohereMode }

        if (!isFollowup && userMessage) {
          const blindspot = body?.interceptor_context?.mentor_blindspot
          const meta = {
            call_id: callId,
            ...(blindspot && typeof blindspot === 'object' ? { mentor_blindspot: blindspot } : {})
          }

          await cohereAppendEvent({
            supabase,
            tenantId,
            threadId,
            role: 'user',
            text: userMessage,
            meta
          })
        }

        if (!isFollowup && userMessage) {
          const gate = await cohereGateSuggest({
            supabase,
            tenantId,
            sector: cohereSector,
            question: userMessage
          })

          // Conservative deterministic thresholds (can be tuned later).
          const AUTO_THRESHOLD = 0.45
          const CLARIFY_THRESHOLD = 0.20
          const MARGIN_THRESHOLD = 0.10

          const candidates = Array.isArray(gate?.candidates) ? gate.candidates : []
          const top1 = candidates[0] || null
          const top2 = candidates[1] || null
          const top1Score = typeof top1?.score === 'number' ? top1.score : 0
          const top2Score = typeof top2?.score === 'number' ? top2.score : 0
          const margin = top1Score - top2Score

          const topText = (top1?.robot_text || top1?.answer_text || '').trim()

          if (topText && top1Score >= AUTO_THRESHOLD && margin >= MARGIN_THRESHOLD) {
            // Auto-reply without GPT call.
            const reply = topText

            await cohereAppendEvent({
              supabase,
              tenantId,
              threadId,
              role: 'assistant',
              text: reply,
              meta: { auto_reply: true, intent_id: top1.intent_id, call_id: callId }
            })

            // Keep output shape consistent with the normal handler.
            const audio = await synthesizeAudio(reply, logPrefix).catch(() => null)
            return NextResponse.json({ reply, audio, gate: { action: 'auto_reply', candidates }, cohere: cohereMeta })
          }

          if (candidates.length > 0 && top1Score >= CLARIFY_THRESHOLD && margin < MARGIN_THRESHOLD) {
            const labels = candidates.slice(0, 3).map(c => c?.label).filter(Boolean)
            const clarify = labels.length > 0
              ? `Before I answer, which of these are you asking about: ${labels.join(' / ')}?`
              : `Before I answer, can you clarify what you mean?`

            await cohereAppendEvent({
              supabase,
              tenantId,
              threadId,
              role: 'assistant',
              text: clarify,
              meta: { clarify: true, call_id: callId }
            })

            const audio = await synthesizeAudio(clarify, logPrefix).catch(() => null)
            return NextResponse.json({ reply: clarify, audio, gate: { action: 'clarify', candidates }, cohere: cohereMeta })
          }
        }

        // Build deterministic pack for GPT context.
        const pack = await cohereBuildPack({
          supabase,
          tenantId: cohereMeta.tenantId,
          threadId: cohereMeta.threadId,
          sector: cohereSector,
          question: userMessage,
          mode: cohereMode
        })

        const packMessage = formatPackForSystemMessage(pack)
        if (packMessage) {
          cohereContextSystemMessage = `\n\n${packMessage}`
        }
      } catch (err) {
        // If Cohere-style pack infra isn't deployed yet, fall back to the legacy history flow.
        // Keep this silent to avoid breaking production when DB functions are missing.
        cohereContextSystemMessage = ''
        cohereMeta = { error: err?.message || String(err) }
      }
    }

    const coherePackActive = !!cohereContextSystemMessage
    if (coherePackActive) {
      systemPrompt += cohereContextSystemMessage
    }

    // Build conversation messages
    // In cohere-chronograph mode, keep the on-wire history small for normal turns
    // (pack already contains recent verbatim events). For follow-ups, preserve history.
    const effectiveHistory = (useCohereChronograph && subjectKey && !isFollowup && coherePackActive)
      ? []
      : conversationHistory
    const baseMessages = [
      { role: 'system', content: systemPrompt },
      ...effectiveHistory
    ]

    const messages = (!isFollowup || userMessage)
      ? [...baseMessages, { role: 'user', content: userMessage }]
      : baseMessages

    // Define available functions
    let tools = [
      {
        type: 'function',
        function: {
          name: 'get_capabilities',
          description: 'Get detailed information about your available actions and how to use them. Call this when you need to remember how to generate lessons, schedule them, search for lessons, or understand what parameters are required.',
          parameters: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                description: 'Specific action to get help with (optional). Options: generate_lesson, schedule_lesson, assign_lesson, search_lessons, get_lesson_details, or omit for all capabilities.',
                enum: ['generate_lesson', 'schedule_lesson', 'assign_lesson', 'search_lessons', 'get_lesson_details', 'all']
              }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_lessons',
          description: 'Search for available lessons across all subjects (math, science, language arts, social studies) and facilitator-created lessons. Use this to find lessons by topic, grade, or subject. Returns lesson titles, grades, and keys for scheduling.',
          parameters: {
            type: 'object',
            properties: {
              subject: {
                type: 'string',
                description: 'Filter by subject (optional)',
                enum: ['math', 'science', 'language arts', 'social studies', 'facilitator']
              },
              grade: {
                type: 'string',
                description: 'Filter by grade level like "3rd", "5th" (optional)'
              },
              searchTerm: {
                type: 'string',
                description: 'Search term to match in lesson titles or topics (optional)'
              }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_lesson_details',
          description: 'Get full details of a specific lesson including vocabulary, teaching notes, and question types. Use this when you need to understand lesson content to make recommendations.',
          parameters: {
            type: 'object',
            properties: {
              lessonKey: {
                type: 'string',
                description: 'The lesson identifier in format "subject/filename" (e.g., "math/Addition_Basics.json")'
              }
            },
            required: ['lessonKey']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'generate_lesson',
          description: 'Generate a custom lesson ONLY after explicit user confirmation. NEVER call this function unless: (1) User explicitly said words like "yes, generate", "create it", "make the lesson" in their MOST RECENT message, OR (2) You just asked "Would you like me to generate a custom lesson?" and they responded "yes" or similar affirmative. DO NOT call if user asks for "recommendations", "suggestions", "ideas", or talks about lessons "not in the library" without explicit generation confirmation. When in doubt, ask confirmation first, do not call this function.',
          parameters: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'The lesson title (e.g., "Photosynthesis Basics")'
              },
              subject: {
                type: 'string',
                description: 'The subject area',
                enum: ['math', 'science', 'language arts', 'social studies']
              },
              grade: {
                type: 'string',
                description: 'Grade level (e.g., "3rd", "5th", "8th")'
              },
              difficulty: {
                type: 'string',
                description: 'Difficulty level',
                enum: ['Beginner', 'Intermediate', 'Advanced']
              },
              description: {
                type: 'string',
                description: 'Brief description of what the lesson covers'
              },
              vocab: {
                type: 'string',
                description: 'Comma-separated vocabulary terms to include (optional)'
              },
              notes: {
                type: 'string',
                description: 'Additional guidance for lesson creation (optional)'
              }
            },
            required: ['title', 'subject', 'grade', 'difficulty', 'description']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'schedule_lesson',
          description: 'Schedule a lesson for a specific learner on a specific date. Use this when the facilitator wants to add a lesson to a learner\'s calendar.',
          parameters: {
            type: 'object',
            properties: {
              learnerName: {
                type: 'string',
                description: 'The name of the learner (e.g., "Emma", "John"). The system will find the matching learner.'
              },
              lessonKey: {
                type: 'string',
                description: 'The lesson identifier in format "subject/filename" (e.g., "math/Addition_Basics.json")'
              },
              scheduledDate: {
                type: 'string',
                description: 'Date in YYYY-MM-DD format'
              }
            },
            required: ['learnerName', 'lessonKey', 'scheduledDate']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'assign_lesson',
          description: 'Assign a lesson to a learner so it shows up as available (not scheduled on a date). Use this when the facilitator says to assign/make available/show a lesson without picking a calendar date.',
          parameters: {
            type: 'object',
            properties: {
              learnerName: {
                type: 'string',
                description: 'The name of the learner (e.g., "Emma", "John"). The system will find the matching learner.'
              },
              lessonKey: {
                type: 'string',
                description: 'The lesson identifier in format "subject/filename" (e.g., "math/Addition_Basics.json")'
              },
              lessonTitle: {
                type: 'string',
                description: 'Optional human-readable title for confirmation (if known). If unknown, call get_lesson_details first.'
              }
            },
            required: ['learnerName', 'lessonKey']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'edit_lesson',
          description: 'Edit an existing lesson (works on ALL lessons: math, science, language arts, social studies, AND facilitator lessons). Use when facilitator wants to fix, update, or improve a lesson.',
          parameters: {
            type: 'object',
            properties: {
              lessonKey: {
                type: 'string',
                description: 'The lesson identifier in format "subject/filename" (e.g., "science/Photosynthesis.json")'
              },
              updates: {
                type: 'object',
                description: 'Object containing the fields to update. Can include: title, blurb, teachingNotes, vocab (array), truefalse (array), multiplechoice (array), shortanswer (array), fillintheblank (array)',
                properties: {
                  title: { type: 'string' },
                  blurb: { type: 'string' },
                  teachingNotes: { type: 'string' },
                  vocab: { 
                    type: 'array',
                    items: { type: 'object' }
                  },
                  truefalse: { 
                    type: 'array',
                    items: { type: 'object' }
                  },
                  multiplechoice: { 
                    type: 'array',
                    items: { type: 'object' }
                  },
                  shortanswer: { 
                    type: 'array',
                    items: { type: 'object' }
                  },
                  fillintheblank: { 
                    type: 'array',
                    items: { type: 'object' }
                  }
                }
              }
            },
            required: ['lessonKey', 'updates']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_conversation_memory',
          description: 'Retrieve conversation memory from previous sessions. This provides context continuity across conversations. Use this when you need to reference past discussions or when a facilitator mentions something from before.',
          parameters: {
            type: 'object',
            properties: {
              learner_id: {
                type: 'string',
                description: 'Optional. The ID of a specific learner if discussing learner-specific conversations. Omit for general facilitator conversations.'
              }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_conversation_history',
          description: 'Search past conversations using keywords with fuzzy matching. Use this when facilitator asks "what did we discuss about X?" or wants to review past advice, plans, or topics.',
          parameters: {
            type: 'object',
            properties: {
              search: {
                type: 'string',
                description: 'Keywords or phrases to search for in conversation summaries'
              },
              include_archive: {
                type: 'boolean',
                description: 'Optional. Set to true to also search archived conversations (default: false)'
              }
            },
            required: ['search']
          }
        }
      }
    ]

    // Apply per-request tool disabling (e.g., block generate_lesson after user declines)
    if (disableTools.length > 0) {
      const disabled = new Set(disableTools)
      tools = tools.filter(tool => {
        const fnName = tool?.function?.name
        if (!fnName) return true
        return !disabled.has(fnName)
      })
    }

    if (isFollowup) {
      const assistantMessage = followup?.assistantMessage
      const functionResults = Array.isArray(followup?.functionResults) ? followup.functionResults : []

      if (!assistantMessage || functionResults.length === 0) {
        return NextResponse.json({ error: 'Follow-up context missing. Please retry the request.' }, { status: 400 })
      }

      const followUpMessages = [
        ...messages,
        assistantMessage,
        ...functionResults
      ]

      const validationSummaries = Array.isArray(followup?.validationSummaries) ? followup.validationSummaries : []

      if (validationSummaries.length > 0) {
        const summaryLines = validationSummaries.map((summary) => {
          const title = summary.lessonTitle ? `"${summary.lessonTitle}"` : 'the lesson'
          const status = summary.status || 'completed'
          const issues = typeof summary.issueCount === 'number' ? `${summary.issueCount} issue(s)` : 'issues'
          if (status === 'fixed') {
            return `${title}: validation found ${issues} and they were improved automatically.`
          }
          if (status === 'passed') {
            return `${title}: validation passed${summary.warningCount ? ` with ${summary.warningCount} warning(s)` : ''}.`
          }
          if (status === 'needs_attention') {
            return `${title}: some issues remain that need manual review.`
          }
          if (status === 'error') {
            return `${title}: validation encountered an error (${summary.error || 'unknown error'}).`
          }
          return `${title}: validation status ${status}.`
        })

        const summaryPrompt = `Facilitator update on lesson quality:\n${summaryLines.join('\n')}\nPlease respond with guidance that reflects these results and outline any recommended next steps.`
        followUpMessages.push({ role: 'user', content: summaryPrompt })
      } else {
        followUpMessages.push({
          role: 'user',
          content: 'Facilitator update: lesson generation completed. Share the results with the facilitator and suggest next steps.'
        })
      }

      let followUpResponse
      try {
        followUpResponse = await fetchJsonWithTimeout(OPENAI_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: OPENAI_MODEL,
            messages: followUpMessages,
            max_tokens: 1500,
            temperature: 0.8
          })
        }, OPENAI_TIMEOUT_MS)
      } catch (err) {
        const isAbort = err?.name === 'AbortError'
        return NextResponse.json(
          { error: isAbort ? 'Mr. Mentor timed out contacting OpenAI.' : 'Mr. Mentor failed contacting OpenAI.' },
          { status: isAbort ? 504 : 502 }
        )
      }

      if (!followUpResponse.ok) {
        await followUpResponse.text().catch(() => '')
        return NextResponse.json({ error: 'Failed to complete Mr. Mentor follow-up.' }, { status: followUpResponse.status })
      }

      const followUpBody = await followUpResponse.json()
      const mentorReply = followUpBody?.choices?.[0]?.message?.content?.trim() ?? ''

      if (!mentorReply) {
        return NextResponse.json({ error: 'Mr. Mentor had no response.' }, { status: 500 })
      }

      if (useCohereChronograph && subjectKey && cohereMeta?.tenantId && cohereMeta?.threadId) {
        try {
          const auth = await cohereGetUserAndClient(req)
          if (!auth?.error) {
            await cohereAppendEvent({
              supabase: auth.supabase,
              tenantId: cohereMeta.tenantId,
              threadId: cohereMeta.threadId,
              role: 'assistant',
              text: mentorReply,
              meta: { call_id: callId, followup: true }
            })
          }
        } catch {}
      }

      const audioContent = await synthesizeAudio(mentorReply, logPrefix)

      return NextResponse.json({
        reply: mentorReply,
        audio: audioContent,
        toolLog: Array.isArray(followup?.toolLog) ? followup.toolLog : [],
        usage: followUpBody?.usage || null,
        needsFollowUp: false
      })
    }

    const requestBody = {
      model: OPENAI_MODEL,
      messages: messages,
      max_tokens: 1500,
      temperature: 0.8,
      tools: tools,
      tool_choice: 'auto'
    }
    
    let response
    try {
      response = await fetchJsonWithTimeout(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
      }, OPENAI_TIMEOUT_MS)
    } catch (err) {
      const isAbort = err?.name === 'AbortError'
      return NextResponse.json(
        { error: isAbort ? 'Mr. Mentor timed out contacting OpenAI.' : 'Mr. Mentor failed contacting OpenAI.' },
        { status: isAbort ? 504 : 502 }
      )
    }

    const rawBody = await response.text()
    let parsedBody
    try {
      parsedBody = JSON.parse(rawBody)
    } catch {
      parsedBody = rawBody
    }

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to get response from Mr. Mentor.' }, { status: response.status })
    }

  const assistantMessage = parsedBody?.choices?.[0]?.message
  const toolCalls = assistantMessage?.tool_calls
  const toolLog = []
    
    // Handle function calls
    if (toolCalls && toolCalls.length > 0) {
      // Intercept generation tool calls when confirmation is required but not yet granted
      const hasGenerateCall = toolCalls.some(tc => tc?.function?.name === 'generate_lesson')
      if (requireGenerationConfirmation && !generationConfirmed && hasGenerateCall) {
        const mentorReply = 'Would you like me to generate a custom lesson?'
        const audioContent = await synthesizeAudio(mentorReply, logPrefix)

        if (useCohereChronograph && subjectKey && cohereMeta?.tenantId && cohereMeta?.threadId) {
          try {
            const auth = await cohereGetUserAndClient(req)
            if (!auth?.error) {
              await cohereAppendEvent({
                supabase: auth.supabase,
                tenantId: cohereMeta.tenantId,
                threadId: cohereMeta.threadId,
                role: 'assistant',
                text: mentorReply,
                meta: { call_id: callId, needs_confirmation: true }
              })
            }
          } catch {}
        }

        return NextResponse.json({
          reply: mentorReply,
          audio: audioContent,
          toolLog,
          needsConfirmation: true,
          confirmationTool: 'generate_lesson',
          functionCalls: toolCalls.map(tc => ({ name: tc.function.name, args: JSON.parse(tc.function.arguments) })),
          usage: parsedBody?.usage || null
        })
      }

      const functionResults = []
      
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name
        const functionArgs = JSON.parse(toolCall.function.arguments)
        
        let result
        try {
          if (functionName === 'get_capabilities') {
            result = getCapabilitiesInfo(functionArgs)
          } else if (functionName === 'search_lessons') {
            result = await executeSearchLessons(functionArgs, req, toolLog)
          } else if (functionName === 'get_lesson_details') {
            result = await executeGetLessonDetails(functionArgs, req, toolLog)
          } else if (functionName === 'generate_lesson') {
            result = await executeLessonGeneration(functionArgs, req, toolLog)
          } else if (functionName === 'schedule_lesson') {
            result = await executeLessonScheduling(functionArgs, req, toolLog)
          } else if (functionName === 'assign_lesson') {
            result = await executeLessonAssignment(functionArgs, req, toolLog)
          } else if (functionName === 'edit_lesson') {
            result = await executeLessonEdit(functionArgs, req, toolLog)
          } else if (functionName === 'get_conversation_memory') {
            result = await executeGetConversationMemory(functionArgs, req, toolLog)
          } else if (functionName === 'search_conversation_history') {
            result = await executeSearchConversationHistory(functionArgs, req, toolLog)
          } else {
            result = { error: 'Unknown function' }
          }
          
        } catch (err) {
          result = { error: err.message || String(err) }
        }
        
        functionResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: functionName,
          content: JSON.stringify(result)
        })
      }

      const parsedToolResults = functionResults.map(fr => {
        try {
          return JSON.parse(fr.content)
        } catch {
          return { error: 'Failed to parse tool result' }
        }
      })

      const hasHeavyToolCall = toolCalls.some(tc => tc.function.name === 'generate_lesson')
      const firstErrorResult = parsedToolResults.find(result => result?.error)

      if (hasHeavyToolCall || firstErrorResult) {
        let mentorReplyText

        if (firstErrorResult) {
          mentorReplyText = `I ran into an issue: ${firstErrorResult.error}`
        } else {
          const generationResult = parsedToolResults.find(result => result?.lessonTitle || result?.lesson)
          mentorReplyText = generationResult?.message
            || (generationResult?.lessonTitle
              ? `I just generated "${generationResult.lessonTitle}". I'll validate it now.`
              : 'I just generated a new lesson and will validate it now.')
        }

        return NextResponse.json({
          reply: mentorReplyText,
          audio: null,
          functionCalls: toolCalls.map(tc => ({ name: tc.function.name, args: JSON.parse(tc.function.arguments) })),
          toolLog,
          toolResults: parsedToolResults,
          followUp: {
            assistantMessage,
            functionResults
          },
          needsFollowUp: true,
          usage: parsedBody?.usage || null
        })
      }
      
      // Call OpenAI again with function results to get final response
      const followUpMessages = [
        ...messages,
        assistantMessage,
        ...functionResults
      ]
      
      let followUpResponse
      try {
        followUpResponse = await fetchJsonWithTimeout(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: followUpMessages,
          max_tokens: 1500,
          temperature: 0.8
        })
        }, OPENAI_TIMEOUT_MS)
      } catch (err) {
        const isAbort = err?.name === 'AbortError'
        return NextResponse.json(
          { error: isAbort ? 'Mr. Mentor timed out contacting OpenAI.' : 'Mr. Mentor failed contacting OpenAI.' },
          { status: isAbort ? 504 : 502 }
        )
      }
      
      if (!followUpResponse.ok) {
        const errorBody = await followUpResponse.text()
        return NextResponse.json({ error: 'Failed to get follow-up response from Mr. Mentor.' }, { status: followUpResponse.status })
      }
      
      const followUpBody = await followUpResponse.json()
      const mentorReply = followUpBody?.choices?.[0]?.message?.content?.trim() ?? ''
      
      if (!mentorReply) {
        return NextResponse.json({ error: 'Mr. Mentor had no response.' }, { status: 500 })
      }

      if (useCohereChronograph && subjectKey && cohereMeta?.tenantId && cohereMeta?.threadId) {
        try {
          const auth = await cohereGetUserAndClient(req)
          if (!auth?.error) {
            await cohereAppendEvent({
              supabase: auth.supabase,
              tenantId: cohereMeta.tenantId,
              threadId: cohereMeta.threadId,
              role: 'assistant',
              text: mentorReply,
              meta: { call_id: callId, tool_followup: true }
            })
          }
        } catch {}
      }
      
      // Generate audio for tool-calling responses
      const audioContent = await synthesizeAudio(mentorReply, logPrefix)
      
      return NextResponse.json({
        reply: mentorReply,
        audio: audioContent,
        functionCalls: toolCalls.map(tc => ({ name: tc.function.name, args: JSON.parse(tc.function.arguments) })),
        toolLog,
        toolResults: parsedToolResults // Include parsed results so frontend can handle lesson validation
      })
    }

    const mentorReply = assistantMessage?.content?.trim() ?? ''
    
    if (!mentorReply) {
      return NextResponse.json({ error: 'Mr. Mentor had no response.' }, { status: 500 })
    }

    if (useCohereChronograph && subjectKey && cohereMeta?.tenantId && cohereMeta?.threadId) {
      try {
        const auth = await cohereGetUserAndClient(req)
        if (!auth?.error) {
          await cohereAppendEvent({
            supabase: auth.supabase,
            tenantId: cohereMeta.tenantId,
            threadId: cohereMeta.threadId,
            role: 'assistant',
            text: mentorReply,
            meta: { call_id: callId }
          })
        }
      } catch {}
    }

    // Synthesize audio
    const audioContent = await synthesizeAudio(mentorReply, logPrefix)

    return NextResponse.json({
      reply: mentorReply,
      audio: audioContent,
      toolLog
    })

  } catch (error) {
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
