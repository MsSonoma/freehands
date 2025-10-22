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
   - When they say "add that to Monday" or "schedule for Emma" → USE THIS TOOL
   - Need: learner selected, lesson key from search, date

5. EDIT_LESSON - Modify existing lessons (ALL lessons: installed subjects AND facilitator-created)
   - When they ask to change/fix/update/edit a lesson → USE THIS TOOL
   - Can edit: vocabulary, teaching notes, blurb, questions (all types)
   - Works on both pre-installed lessons AND custom facilitator lessons

CRITICAL: When someone asks about lessons, DON'T say "I can't access" or "I'm unable to" - JUST USE THE SEARCH TOOL.
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
  
  // Check cache first
  if (ttsCache.has(text)) {
    audioContent = ttsCache.get(text)
    console.log(`${logPrefix} Using cached TTS audio`)
  } else {
    const ttsClient = await getTtsClient()
    if (ttsClient) {
      try {
        const ssml = toSsml(text)
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
          ttsCache.set(text, audioContent)
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
        scheduledDate: 'Required. Date in YYYY-MM-DD format. Convert natural language like "next Monday" to proper format.'
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
async function executeSearchLessons(args, request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return { error: 'Authentication required' }
    }
    
    const { subject, grade, searchTerm } = args
    
    // Get lessons from all subjects
    const subjects = subject ? [subject] : ['math', 'science', 'language arts', 'social studies', 'facilitator']
    const allLessons = []
    
    for (const subj of subjects) {
      try {
        const lessonResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/lessons/${subj}`, {
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
          
          // Add to results with lessonKey
          filtered.forEach(lesson => {
            allLessons.push({
              title: lesson.title,
              grade: lesson.grade || lesson.gradeLevel,
              subject: subj,
              difficulty: lesson.difficulty,
              lessonKey: `${subj}/${lesson.file}`,
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
    
    return {
      success: true,
      count: limitedResults.length,
      totalFound: allLessons.length,
      lessons: limitedResults,
      message: limitedResults.length === 0 
        ? 'No lessons found matching your criteria.' 
        : `Found ${allLessons.length} lessons${limitedResults.length < allLessons.length ? `, showing first ${limitedResults.length}` : ''}.`
    }
  } catch (err) {
    return { error: err.message || String(err) }
  }
}

// Helper function to get lesson details
async function executeGetLessonDetails(args, request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return { error: 'Authentication required' }
    }
    
    const { lessonKey } = args
    const [subject, filename] = lessonKey.split('/')
    
    if (!subject || !filename) {
      return { error: 'Invalid lesson key format. Expected "subject/filename.json"' }
    }
    
    let lessonData
    
    // Handle facilitator lessons differently (they're in Supabase, not public folder)
    if (subject === 'facilitator') {
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
        const facilitatorUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/facilitator/lessons/get?file=${encodeURIComponent(filename)}&userId=${encodeURIComponent(userId)}`
        const facilitatorResponse = await fetch(facilitatorUrl)
        
        if (!facilitatorResponse.ok) {
          return { error: 'Facilitator lesson not found' }
        }
        
        lessonData = await facilitatorResponse.json()
      } catch (err) {
        return { error: `Failed to fetch facilitator lesson: ${err.message}` }
      }
    } else {
      // Fetch from public folder via API endpoint for standard lessons
      const lessonUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/lesson-file?key=${encodeURIComponent(lessonKey)}`
      
      console.log('[GET_LESSON_DETAILS] Fetching:', lessonUrl)
      
      const lessonResponse = await fetch(lessonUrl, {
        method: 'GET',
        headers: {
          'Authorization': authHeader
        }
      })
      
      if (!lessonResponse.ok) {
        const errorText = await lessonResponse.text()
        console.error('[GET_LESSON_DETAILS] Fetch failed:', lessonResponse.status, errorText)
        return { error: `Lesson file not found: ${errorText}` }
      }
      
      lessonData = await lessonResponse.json()
    }
    
    // Return a summary of the lesson (not the full content to keep prompt size down)
    return {
      success: true,
      lessonKey: lessonKey,
      title: lessonData.title,
      grade: lessonData.grade || lessonData.gradeLevel,
      difficulty: lessonData.difficulty,
      subject: lessonData.subject || subject,
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
  } catch (err) {
    return { error: err.message || String(err) }
  }
}

// Helper function to execute lesson generation
async function executeLessonGeneration(args, request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return { error: 'Authentication required' }
    }
    
    // Call the lesson generation API
    const genResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/facilitator/lessons/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(args)
    })
    
    const result = await genResponse.json()
    
    if (!genResponse.ok) {
      return { error: result.error || 'Lesson generation failed' }
    }
    
    return {
      success: true,
      lessonFile: result.file,
      lessonTitle: result.lesson?.title,
      message: `Lesson "${result.lesson?.title}" has been created successfully.`
    }
  } catch (err) {
    return { error: err.message || String(err) }
  }
}

// Helper function to execute lesson scheduling
async function executeLessonScheduling(args, request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return { error: 'Authentication required' }
    }
    
    // Call the lesson schedule API
    const schedResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/lesson-schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(args)
    })
    
    const result = await schedResponse.json()
    
    if (!schedResponse.ok) {
      return { error: result.error || 'Lesson scheduling failed' }
    }
    
    return {
      success: true,
      scheduledDate: args.scheduledDate,
      lessonKey: args.lessonKey,
      message: `Lesson has been scheduled for ${args.scheduledDate}.`
    }
  } catch (err) {
    return { error: err.message || String(err) }
  }
}

// Helper function to execute lesson editing
async function executeLessonEdit(args, request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return { error: 'Authentication required' }
    }
    
    const { lessonKey, updates } = args
    
    if (!lessonKey || !updates) {
      return { error: 'Missing lessonKey or updates' }
    }
    
    // Call the lesson edit API
    const editResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/lesson-edit`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({ lessonKey, updates })
    })
    
    const result = await editResponse.json()
    
    if (!editResponse.ok) {
      return { error: result.error || 'Lesson edit failed' }
    }
    
    return {
      success: true,
      lessonKey: lessonKey,
      message: `Lesson "${lessonKey}" has been updated successfully.`
    }
  } catch (err) {
    return { error: err.message || String(err) }
  }
}

export async function POST(req) {
  const callId = createCallId()
  const logPrefix = `[Mr. Mentor][${callId}]`
  
  console.log(`${logPrefix} POST request received`)
  console.log(`${logPrefix} Headers:`, Object.fromEntries(req.headers.entries()))
  
  try {
    // Parse request body
    let userMessage = ''
    let conversationHistory = []
    
    const contentType = (req.headers?.get?.('content-type') || '').toLowerCase()
    let learnerTranscript = null
    try {
      if (contentType.includes('application/json')) {
        const body = await req.json()
        console.log(`${logPrefix} Parsed body:`, JSON.stringify(body).substring(0, 200))
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

    // Build system prompt with learner context if available
    let systemPrompt = MENTOR_SYSTEM_PROMPT
    if (learnerTranscript) {
      systemPrompt += `\n\n=== CURRENT LEARNER CONTEXT ===\nThe facilitator has selected a specific learner to discuss. Here is their profile and progress:\n\n${learnerTranscript}\n\n=== END LEARNER CONTEXT ===\n\nIMPORTANT: When scheduling lessons, use the learner ID shown at the top of the profile (the long UUID string after "ID:"). This is required for the schedule_lesson function. Do NOT try to use the learner's name - you MUST use their ID.\n\nUse this information to provide personalized, data-informed guidance. Reference specific achievements, struggles, or patterns you notice. Ask questions that help the facilitator reflect on this learner's unique needs and progress.`
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
              learnerId: {
                type: 'string',
                description: 'The ID of the learner'
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
            required: ['learnerId', 'lessonKey', 'scheduledDate']
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
            result = await executeSearchLessons(functionArgs, req)
          } else if (functionName === 'get_lesson_details') {
            result = await executeGetLessonDetails(functionArgs, req)
          } else if (functionName === 'generate_lesson') {
            result = await executeLessonGeneration(functionArgs, req)
          } else if (functionName === 'schedule_lesson') {
            result = await executeLessonScheduling(functionArgs, req)
          } else if (functionName === 'edit_lesson') {
            result = await executeLessonEdit(functionArgs, req)
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
      
      console.log(`${logPrefix} Calling OpenAI again with function results`)
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
      
      const followUpBody = await followUpResponse.json()
      const mentorReply = followUpBody?.choices?.[0]?.message?.content?.trim() ?? ''
      
      if (!mentorReply) {
        console.warn(`${logPrefix} Empty follow-up reply from OpenAI`)
        return NextResponse.json({ error: 'Mr. Mentor had no response.' }, { status: 500 })
      }
      
      console.log(`${logPrefix} Mr. Mentor follow-up reply:\n${previewText(mentorReply)}`)
      
      // Synthesize audio and return
      let audioContent = await synthesizeAudio(mentorReply, logPrefix)
      
      return NextResponse.json({
        reply: mentorReply,
        audio: audioContent,
        functionCalls: toolCalls.map(tc => ({ name: tc.function.name, args: JSON.parse(tc.function.arguments) }))
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
