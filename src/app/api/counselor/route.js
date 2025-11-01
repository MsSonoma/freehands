// Next.js API route for Mr. Mentor (Counselor)
// Therapeutic AI counselor for facilitators using GPT-4o

import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import textToSpeech from '@google-cloud/text-to-speech'
import { normalizeLessonKey } from '@/app/lib/lessonKeyNormalization'

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

const FALLBACK_LOCAL_BASE_URL = 'http://localhost:3001'

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

  return FALLBACK_LOCAL_BASE_URL
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

You have 5 function calling tools available. Use them actively during conversations:

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

3. GENERATE_LESSON - Create new custom lessons
   - When they explicitly ask you to create a lesson → USE THIS TOOL
   - ALWAYS search first to avoid duplicates
   - Takes 30-60 seconds to complete

4. SCHEDULE_LESSON - Add lessons to calendars
   - When they say "schedule this" "add that to Monday" "put it on the calendar" → YOU MUST ACTUALLY CALL THIS FUNCTION
   - You can use the learner's NAME (like "Emma") - the system will find them
   - Need: learner name, lesson key from search/generate, date in YYYY-MM-DD format
   - CRITICAL: DO NOT say you've scheduled something unless you ACTUALLY call the schedule_lesson function
   - NEVER confirm scheduling without calling the function first

5. EDIT_LESSON - Modify existing lessons (ALL lessons: installed subjects AND facilitator-created)
   - When they ask to change/fix/update/edit a lesson → USE THIS TOOL
   - Can edit: vocabulary, teaching notes, blurb, questions (all types)
   - Works on both pre-installed lessons AND custom facilitator lessons

6. GET_CONVERSATION_MEMORY - Retrieve past conversation summaries
   - When you need context from previous sessions → USE THIS TOOL
   - When they mention something discussed before → USE THIS TOOL
   - Automatically loads at start of each conversation for continuity
   - Can search across all past conversations with keywords

7. SEARCH_CONVERSATION_HISTORY - Search past conversations with keywords
   - When they say "what did we discuss about X?" → USE THIS TOOL
   - When they want to review past advice or plans → USE THIS TOOL
   - Uses fuzzy matching to find relevant past conversations
   - Searches both current and archived conversations

CRITICAL: When someone asks about lessons, DON'T say "I can't access" or "I'm unable to" - JUST USE THE SEARCH TOOL.
CRITICAL: When someone asks you to schedule a lesson, you MUST call the schedule_lesson function. DO NOT confirm scheduling without actually calling it.
CRITICAL: NEVER say "I've scheduled" or "has been scheduled" unless you actually called the schedule_lesson function and got a success response.
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
    console.log(`${logPrefix} Using cached TTS audio`)
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
          console.log(`${logPrefix} Synthesized and cached TTS audio`)
        }
      } catch (ttsError) {
        console.error(`${logPrefix} TTS synthesis failed:`, ttsError)
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
      purpose: 'Create a custom lesson when existing lessons don\'t meet the need',
      when_to_use: 'When facilitator explicitly asks you to create/generate a lesson, or after searching shows no good match',
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
      notes: 'Takes 30-60 seconds. Requires premium tier. ALWAYS search first before generating.',
      example: 'Generate 5th grade science: {title: "Water Cycle", subject: "science", grade: "5th", difficulty: "Intermediate", description: "Learn about evaporation, condensation, and precipitation"}'
    },
    
    schedule_lesson: {
      name: 'schedule_lesson',
      purpose: 'Add a lesson to a learner\'s calendar for a specific date',
      when_to_use: 'When facilitator asks to schedule/add a lesson to a calendar, or says "put that on Monday"',
      parameters: {
        learnerId: 'Required. The learner\'s ID from context (you get this from learner transcript when they select a learner)',
        lessonKey: 'Required. Format: "subject/filename.json" (you get this from search results or after generating)',
        scheduledDate: 'Required. Date in YYYY-MM-DD format. CRITICAL: The current year is 2025. When user says "October 26th" they mean 2025-10-26, NOT 2023. Always use year 2025 unless they specify a different year. Convert natural language like "next Monday" to proper format.'
      },
      returns: 'Success confirmation with scheduled date and lesson key',
      notes: 'Learner must be selected in dropdown for you to have their ID in context',
      example: 'Schedule for Emma on Dec 18: {learnerId: "abc123", lessonKey: "math/Multiplication_Basics.json", scheduledDate: "2025-12-18"}'
    },
    
    edit_lesson: {
      name: 'edit_lesson',
      purpose: 'Modify an existing lesson (works on ALL lessons: installed subjects like math/science AND facilitator-created lessons)',
      when_to_use: 'When facilitator asks to change/fix/update/edit a lesson, correct errors, add vocabulary, improve questions, etc.',
      parameters: {
        lessonKey: 'Required. Format: "subject/filename.json" (from search results)',
        updates: 'Required. Object with fields to update. Can include: title, blurb, teachingNotes, vocab (array of {term, definition}), sample, truefalse, multiplechoice, shortanswer, fillintheblank (arrays of questions)'
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
        console.error(`Failed to fetch lessons for ${subj}:`, err)
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
      
    console.log('[GET_LESSON_DETAILS] Fetching:', lessonUrl.toString())
      
    const lessonResponse = await fetch(lessonUrl, {
        method: 'GET',
        headers: {
          'Authorization': authHeader
        }
      })
      
      if (!lessonResponse.ok) {
        const errorText = await lessonResponse.text()
        console.error('[GET_LESSON_DETAILS] Fetch failed:', lessonResponse.status, errorText)
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
        sample: (lessonData.sample || []).length,
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
    const baseUrl = resolveBaseUrl(request)
    pushToolLog(toolLog, {
      name: 'generate_lesson',
      phase: 'start',
      context: { title: args?.title }
    })
    
    // Import validation functions
    const { validateLessonQuality, buildValidationChangeRequest } = await import('@/app/lib/lessonValidation')
    
    // STEP 1: Call the lesson generation API directly (avoid HTTP timeout stacking)
    console.log('[Mr. Mentor] Generating lesson...')
    console.log('[Mr. Mentor] Generate args:', JSON.stringify(args, null, 2))
    
    let result
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
      
      console.log('[Mr. Mentor] Generate response status:', genResponse.status)
      
      if (!genResponse.ok) {
        console.error('[Mr. Mentor] Generate failed:', responseData)
        pushToolLog(toolLog, {
          name: 'generate_lesson',
          phase: 'error',
          context: { title: args?.title, message: responseData.error }
        })
        return { error: responseData.error || 'Lesson generation failed' }
      }
      
      result = responseData
      console.log('[Mr. Mentor] Generate result keys:', Object.keys(result))
    } catch (genError) {
      console.error('[Mr. Mentor] Generation error:', genError)
      pushToolLog(toolLog, {
        name: 'generate_lesson',
        phase: 'error',
        context: { title: args?.title, message: genError.message }
      })
      return { error: 'Lesson generation failed: ' + genError.message }
    }
    
    // Build the lessonKey in the format needed for scheduling: "facilitator/filename.json"
    const lessonKey = `facilitator/${result.file}`
    
    // STEP 2: Validate the lesson quality
    console.log('[Mr. Mentor] Validating lesson quality...')
        pushToolLog(toolLog, {
          name: 'validate_lesson',
          phase: 'start',
          context: { title: result.lesson?.title }
        })
    const validation = validateLessonQuality(result.lesson)
    
    if (!validation.passed && validation.issues.length > 0) {
      console.log('[Mr. Mentor] Validation failed, auto-fixing:', validation.issues)
          pushToolLog(toolLog, {
            name: 'validate_lesson',
            phase: 'error',
            context: { issueCount: validation.issues.length }
          })
      
      // STEP 3: Auto-fix with request-changes API (call directly to avoid timeout stacking)
      try {
            pushToolLog(toolLog, {
              name: 'improve_lesson',
              phase: 'start',
              context: { title: result.lesson?.title }
            })
        const changeRequest = buildValidationChangeRequest(validation.issues)
        
        // Import and call the request-changes route's POST handler directly
        const { POST: requestChangesPOST } = await import('@/app/api/facilitator/lessons/request-changes/route')
        
        const mockFixRequest = new Request('http://localhost/api/facilitator/lessons/request-changes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            file: result.file,
            userId: result.userId,
            changeRequest: changeRequest
          })
        })
        
        const fixResponse = await requestChangesPOST(mockFixRequest)
        const fixResult = await fixResponse.json()
        
        if (fixResponse.ok) {
          console.log('[Mr. Mentor] Auto-fix successful')
          pushToolLog(toolLog, {
            name: 'improve_lesson',
            phase: 'success',
            context: { title: result.lesson?.title }
          })
          pushToolLog(toolLog, {
            name: 'generate_lesson',
            phase: 'success',
            context: { title: result.lesson?.title }
          })
          return {
            success: true,
            lessonFile: result.file,
            lessonKey: lessonKey,
            lessonTitle: result.lesson?.title,
            message: `Lesson "${result.lesson?.title}" has been created and optimized for quality. You can now schedule it using the lesson key: ${lessonKey}`
          }
        } else {
          console.error('[Mr. Mentor] Auto-fix failed:', fixResult.error)
          pushToolLog(toolLog, {
            name: 'improve_lesson',
            phase: 'error',
            context: { message: fixResult.error }
          })
          pushToolLog(toolLog, {
            name: 'generate_lesson',
            phase: 'success',
            context: { title: result.lesson?.title }
          })
          // Still return success but with warning
          return {
            success: true,
            lessonFile: result.file,
            lessonKey: lessonKey,
            lessonTitle: result.lesson?.title,
            message: `Lesson "${result.lesson?.title}" has been created successfully. You can now schedule it using the lesson key: ${lessonKey}\n\nNote: Some quality improvements may be needed.`
          }
        }
      } catch (fixError) {
        console.error('[Mr. Mentor] Auto-fix error:', fixError)
        pushToolLog(toolLog, {
          name: 'improve_lesson',
          phase: 'error',
          context: { message: fixError?.message || String(fixError) }
        })
        pushToolLog(toolLog, {
          name: 'generate_lesson',
          phase: 'success',
          context: { title: result.lesson?.title }
        })
        // Still return success but with warning
        return {
          success: true,
          lessonFile: result.file,
          lessonKey: lessonKey,
          lessonTitle: result.lesson?.title,
          message: `Lesson "${result.lesson?.title}" has been created successfully. You can now schedule it using the lesson key: ${lessonKey}`
        }
      }
    } else {
      // Passed validation on first try
      console.log('[Mr. Mentor] Validation passed')
      if (validation.warnings.length > 0) {
        console.log('[Mr. Mentor] Warnings:', validation.warnings)
      }
      pushToolLog(toolLog, {
        name: 'validate_lesson',
        phase: 'success',
        context: { warningCount: validation.warnings.length }
      })
      pushToolLog(toolLog, {
        name: 'generate_lesson',
        phase: 'success',
        context: { title: result.lesson?.title }
      })
      
      return {
        success: true,
        lessonFile: result.file,
        lessonKey: lessonKey,
        lessonTitle: result.lesson?.title,
        message: `Lesson "${result.lesson?.title}" has been created successfully. You can now schedule it using the lesson key: ${lessonKey}`
      }
    }
  } catch (err) {
    console.error('[Mr. Mentor] Lesson generation error:', err)
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
    
  console.log('[Mr. Mentor] Scheduling lesson with args:', JSON.stringify(args, null, 2))
    
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
    
    console.log(`[Mr. Mentor] Found learner: ${matchingLearner.name} (${matchingLearner.id})`)
    
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
      console.error('[Mr. Mentor] Scheduling failed:', result)
      pushToolLog(toolLog, {
        name: 'schedule_lesson',
        phase: 'error',
        context: { message: result.error || 'Lesson scheduling failed' }
      })
      return { error: result.error || 'Lesson scheduling failed', details: result }
    }
    
    console.log('[Mr. Mentor] Scheduling succeeded')
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
    console.error('[Mr. Mentor] Scheduling exception:', err)
    pushToolLog(toolLog, {
      name: 'schedule_lesson',
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
  
  console.log(`${logPrefix} POST request received`)
  console.log(`${logPrefix} Headers:`, Object.fromEntries(req.headers.entries()))
  const baseUrl = resolveBaseUrl(req)
  
  try {
    // Parse request body
    let userMessage = ''
    let conversationHistory = []
    
    const contentType = (req.headers?.get?.('content-type') || '').toLowerCase()
    let learnerTranscript = null
    let goalsNotes = null
    try {
      if (contentType.includes('application/json')) {
        const body = await req.json()
        console.log(`${logPrefix} Parsed body:`, JSON.stringify(body).substring(0, 200))
        userMessage = (body.message || '').trim()
        conversationHistory = Array.isArray(body.history) ? body.history : []
        learnerTranscript = body.learner_transcript || null
        goalsNotes = body.goals_notes || null
        console.log(`${logPrefix} Received message with ${conversationHistory.length} history items`)
        if (learnerTranscript) {
          console.log(`${logPrefix} Learner context provided (${learnerTranscript.length} chars)`)
        }
        if (goalsNotes) {
          console.log(`${logPrefix} Goals notes provided (${goalsNotes.length} chars)`)
        }
      } else {
        const textBody = await req.text()
        userMessage = textBody.trim()
        console.warn(`${logPrefix} Non-JSON payload; treating as message text`)
      }
    } catch (parseErr) {
      console.error(`${logPrefix} Failed to parse request:`, parseErr)
      return NextResponse.json({ error: `Invalid request format: ${parseErr.message}` }, { status: 400 })
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

    // Build system prompt with learner context and goals if available
    let systemPrompt = MENTOR_SYSTEM_PROMPT
    
    if (goalsNotes) {
      systemPrompt += `\n\n=== PERSISTENT GOALS & PRIORITIES ===\nThe facilitator has set these persistent goals that should guide all conversations:\n\nPersistent Goals:\n${goalsNotes}\n\n=== END PERSISTENT GOALS ===\n\nIMPORTANT: These goals persist across all conversations. Reference them when relevant, and help the facilitator work toward them. The facilitator can update these goals anytime using the Goals clipboard button (📋) on screen.`
    }
    
    if (learnerTranscript) {
      systemPrompt += `\n\n=== CURRENT LEARNER CONTEXT ===\nThe facilitator has selected a specific learner to discuss. Here is their profile and progress:\n\n${learnerTranscript}\n\n=== END LEARNER CONTEXT ===\n\nIMPORTANT INSTRUCTIONS FOR THIS LEARNER:\n- When generating lessons, ALWAYS use the grade level shown in the learner profile above\n- When scheduling lessons, you can use the learner's name (e.g., "Emma", "John") and the system will find them\n- When searching for lessons, consider their current grade level and adjust difficulty accordingly\n\nUse this information to provide personalized, data-informed guidance. Reference specific achievements, struggles, or patterns you notice. Ask questions that help the facilitator reflect on this learner's unique needs and progress.`
    }

    // Load conversation memory for continuity (only if this is the first message in the conversation)
    if (conversationHistory.length === 0) {
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
              console.log(`${logPrefix} Loaded conversation memory with ${memory.turn_count} turns`)
            }
          }
        }
      } catch (memErr) {
        console.warn(`${logPrefix} Failed to load conversation memory:`, memErr)
        // Continue without memory - don't fail the request
      }
    }

    // Build conversation messages
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ]

    // Define available functions
    const tools = [
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
                description: 'Specific action to get help with (optional). Options: generate_lesson, schedule_lesson, search_lessons, get_lesson_details, or omit for all capabilities.',
                enum: ['generate_lesson', 'schedule_lesson', 'search_lessons', 'get_lesson_details', 'all']
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
          description: 'Generate a custom lesson for a facilitator. Use this when the facilitator asks you to create a lesson on a specific topic.',
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
                description: 'Object containing the fields to update. Can include: title, blurb, teachingNotes, vocab (array), sample (array), truefalse (array), multiplechoice (array), shortanswer (array), fillintheblank (array)',
                properties: {
                  title: { type: 'string' },
                  blurb: { type: 'string' },
                  teachingNotes: { type: 'string' },
                  vocab: { 
                    type: 'array',
                    items: { type: 'object' }
                  },
                  sample: { 
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

    // Call OpenAI
    console.log(`${logPrefix} Calling OpenAI with ${messages.length} messages`)
    
    const requestBody = {
      model: OPENAI_MODEL,
      messages: messages,
      max_tokens: 1500,
      temperature: 0.8,
      tools: tools,
      tool_choice: 'auto'
    }
    
    console.log(`${logPrefix} Request body size: ${JSON.stringify(requestBody).length} chars`)
    
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    const rawBody = await response.text()
    let parsedBody
    try {
      parsedBody = JSON.parse(rawBody)
    } catch {
      parsedBody = rawBody
    }

    if (!response.ok) {
      console.error(`${logPrefix} OpenAI request failed with status ${response.status}`)
      console.error(`${logPrefix} OpenAI error details:`, JSON.stringify(parsedBody, null, 2))
      return NextResponse.json({ error: 'Failed to get response from Mr. Mentor.' }, { status: response.status })
    }

  const assistantMessage = parsedBody?.choices?.[0]?.message
  const toolCalls = assistantMessage?.tool_calls
  const toolLog = []
    
    // Handle function calls
    if (toolCalls && toolCalls.length > 0) {
      console.log(`${logPrefix} Processing ${toolCalls.length} function call(s)`)
      
      const functionResults = []
      
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name
        const functionArgs = JSON.parse(toolCall.function.arguments)
        
        console.log(`${logPrefix} Calling function: ${functionName} with args:`, JSON.stringify(functionArgs, null, 2))
        
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
          } else if (functionName === 'edit_lesson') {
            result = await executeLessonEdit(functionArgs, req, toolLog)
          } else if (functionName === 'get_conversation_memory') {
            result = await executeGetConversationMemory(functionArgs, req, toolLog)
          } else if (functionName === 'search_conversation_history') {
            result = await executeSearchConversationHistory(functionArgs, req, toolLog)
          } else {
            result = { error: 'Unknown function' }
          }
          
          // Log result for debugging (truncate large results)
          const resultPreview = result?.error ? result : { 
            success: result?.success, 
            count: result?.count || result?.lessons?.length,
            message: result?.message,
            title: result?.title
          }
          console.log(`${logPrefix} Function ${functionName} result:`, resultPreview)
          
          // Check if result contains an error
          if (result?.error) {
            console.error(`${logPrefix} Function ${functionName} returned error:`, result.error)
          }
        } catch (err) {
          console.error(`${logPrefix} Function ${functionName} exception:`, err.message, err.stack)
          result = { error: err.message || String(err) }
        }
        
        functionResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: functionName,
          content: JSON.stringify(result)
        })
      }
      
      // Call OpenAI again with function results to get final response
      const followUpMessages = [
        ...messages,
        assistantMessage,
        ...functionResults
      ]
      
      console.log(`${logPrefix} Calling OpenAI again with function results (${functionResults.length} results)`)
      console.log(`${logPrefix} Follow-up message count: ${followUpMessages.length}`)
      
      const followUpResponse = await fetch(OPENAI_URL, {
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
      })
      
      if (!followUpResponse.ok) {
        console.error(`${logPrefix} Follow-up OpenAI request failed with status ${followUpResponse.status}`)
        const errorBody = await followUpResponse.text()
        console.error(`${logPrefix} Follow-up error body:`, errorBody)
        return NextResponse.json({ error: 'Failed to get follow-up response from Mr. Mentor.' }, { status: followUpResponse.status })
      }
      
      const followUpBody = await followUpResponse.json()
      const mentorReply = followUpBody?.choices?.[0]?.message?.content?.trim() ?? ''
      
      console.log(`${logPrefix} Follow-up response received, length: ${mentorReply.length}`)
      
      if (!mentorReply) {
        console.warn(`${logPrefix} Empty follow-up reply from OpenAI`)
        console.warn(`${logPrefix} Full response:`, JSON.stringify(followUpBody, null, 2))
        return NextResponse.json({ error: 'Mr. Mentor had no response.' }, { status: 500 })
      }
      
      console.log(`${logPrefix} Mr. Mentor follow-up reply:\n${previewText(mentorReply)}`)
      
      // Synthesize audio and return
      let audioContent = await synthesizeAudio(mentorReply, logPrefix)
      
      return NextResponse.json({
        reply: mentorReply,
        audio: audioContent,
        functionCalls: toolCalls.map(tc => ({ name: tc.function.name, args: JSON.parse(tc.function.arguments) })),
        toolLog
      })
    }

    const mentorReply = assistantMessage?.content?.trim() ?? ''
    
    if (!mentorReply) {
      console.warn(`${logPrefix} Empty reply from OpenAI`)
      return NextResponse.json({ error: 'Mr. Mentor had no response.' }, { status: 500 })
    }

    console.log(`${logPrefix} Mr. Mentor reply:\n${previewText(mentorReply)}`)

    // Synthesize audio
    const audioContent = await synthesizeAudio(mentorReply, logPrefix)

    return NextResponse.json({
      reply: mentorReply,
      audio: audioContent,
      toolLog
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
