// Next.js API route for Mr. Mentor (Counselor)
// Therapeutic AI counselor for facilitators using GPT-4o

import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import textToSpeech from '@google-cloud/text-to-speech'
import { normalizeLessonKey } from '@/app/lib/lessonKeyNormalization'
import { canonicalizeAiGeneratedLessonChoices } from '@/app/lib/aiGeneratedChoiceOrder.mjs'
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
import { AI_MODEL } from '@/app/lib/aiModel'
import { classifyConversationSafety, buildConversationSafetyContext } from '@/lib/contentSafety'
import {
  MENTOR_TOOL_REGISTRY,
  buildMentorToolPrompt,
  getMentorCapabilities,
  getMentorOpenAiTools,
  getMentorTool,
  mentorToolConfirmationPrompt,
  mentorToolNeedsConfirmation,
  mentorToolUsesDirectResult,
} from '@/lib/mentor/toolRegistry'
const OPENAI_MODEL = AI_MODEL

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

// Mr. Mentor is the facilitator-facing educational planning and evidence assistant.
// Tool descriptions are injected from the same registry used for actual dispatch.
const MENTOR_SYSTEM_PROMPT = `You are Mr. Mentor, the adult-facing educational planning, evidence, and product assistant for Ms. Sonoma.

CURRENT DATE: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} (${new Date().toISOString().split('T')[0]})

MISSION AND AUTHORITY:
- Learner mastery is the first priority.
- Actively inspect evidence, identify patterns, explain what is observed, and recommend concrete next steps.
- AI may do meaningful facilitation and planning work, but the facilitator retains educational authorship, judgment, values, boundaries, and final authority.
- The active Syllabus is the authoritative planning source. Canonical learning evidence is the authoritative source for mastery, comprehension, and retention claims.
- Legacy schedule templates and legacy curriculum-preference records are not authoritative once a learner has an active Syllabus.

EVIDENCE LANGUAGE:
- Observed = directly present in current evidence or product state.
- Inferred = a conclusion supported by observed evidence.
- Proposed = a recommendation or draft that has not changed active educational intent.
- Verified = an action completed through an authorized tool and confirmed by its result/readback.
- Never turn an inference into an observation, a proposal into an active plan, or an unverified write into a completed action.

HOW TO WORK:
- Use tools proactively when the answer depends on current Ms. Sonoma state.
- Read the Syllabus and learning evidence before making learner-specific progression recommendations when they are relevant.
- Search existing lessons before generating when the facilitator asks for recommendations. Generate only when they want a new lesson created.
- Prefer the currently selected learner. Ask which learner only when there is no unambiguous selected or named learner.
- For educator-authority changes, follow the tool confirmation boundary. Do not silently rewrite active Syllabus intent.
- Never claim that something was scheduled, assigned, changed, generated, or saved unless the tool result says it succeeded. Use "verified" only when the result is actually verified.
- Keep technical implementation details and function names out of normal user-facing prose.

PRODUCT SURFACES:
The facilitator experience includes Mr. Mentor, Syllabus, Calendar, Lessons, Generated Lessons, Lesson Maker, Learners, Prepare, Account, and Notifications. Use open_surface when the facilitator asks you to take them to one of these surfaces.

STYLE:
- Calm, direct, intelligent, concrete, and patient.
- Give the facilitator useful conclusions and options instead of forcing every exchange into Socratic questioning.
- Ask a question only when it genuinely advances the work or a required decision is missing.
- Keep the learner visible in planning discussions and separate observation, inference, proposal, and verified action.

${buildMentorToolPrompt()}`;

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

// Capability information is generated from the live tool registry.
function getCapabilitiesInfo(args = {}) {
  return getMentorCapabilities(args?.action || 'all')
}

function toolError(message, details = null) {
  return { error: String(message || 'Tool action failed'), ...(details ? { details } : {}) }
}

function toolSuccess(action, message, data = {}, verified = true) {
  return { success: true, verified: verified === true, action, message, ...data }
}

async function internalApiJson(request, pathname, { method = 'GET', body = null, searchParams = null } = {}) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return { ok: false, status: 401, data: { error: 'Authentication required' } }
  const url = new URL(pathname, resolveBaseUrl(request))
  if (searchParams && typeof searchParams === 'object') {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
    }
  }
  const headers = { Authorization: authHeader }
  if (body !== null) headers['Content-Type'] = 'application/json'
  const response = await fetch(url, { method, headers, ...(body !== null ? { body: JSON.stringify(body) } : {}) })
  const data = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, data }
}

async function resolveOwnedLearner(args, request, toolContext = {}) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Authentication required')
  const token = authHeader.slice(7).trim()
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  const user = authData?.user
  if (authError || !user) throw new Error('Authentication required')
  const { data: learners, error } = await supabase
    .from('learners')
    .select('id, name, grade')
    .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
  if (error) throw new Error('Could not load the facilitator?s learners')
  const owned = Array.isArray(learners) ? learners : []
  const explicitId = String(args?.learnerId || '').trim()
  if (explicitId) {
    const match = owned.find((learner) => String(learner.id) === explicitId)
    if (!match) throw new Error('The requested learner was not found or is not authorized for this facilitator')
    return match
  }
  const explicitName = String(args?.learnerName || '').trim().toLocaleLowerCase()
  if (explicitName) {
    const matches = owned.filter((learner) => String(learner.name || '').trim().toLocaleLowerCase() === explicitName)
    if (matches.length === 1) return matches[0]
    if (matches.length > 1) throw new Error('More than one learner has that name. Select the intended learner first.')
    throw new Error('No authorized learner with that name was found')
  }
  const selectedId = String(toolContext?.selectedLearnerId || '').trim()
  if (selectedId) {
    const match = owned.find((learner) => String(learner.id) === selectedId)
    if (match) return match
  }
  const selectedName = String(toolContext?.selectedLearnerName || '').trim().toLocaleLowerCase()
  if (selectedName) {
    const matches = owned.filter((learner) => String(learner.name || '').trim().toLocaleLowerCase() === selectedName)
    if (matches.length === 1) return matches[0]
  }
  if (owned.length === 1) return owned[0]
  throw new Error('Select or name a learner first')
}

function compactSyllabusItem(item = {}) {
  const keep = [
    'placement_kind', 'planned_date', 'subject', 'sort_order', 'title', 'description',
    'lesson_key', 'lineage_id', 'occurrence_id', 'execution_occurrence_id', 'item_type',
    'assigned_instructional_teacher', 'instructional_teacher', 'actual_instructional_teacher',
    'slate_assignment_id', 'run_purpose', 'completed_at', 'status', 'metadata',
  ]
  return Object.fromEntries(keep.filter((key) => item[key] !== undefined).map((key) => [key, item[key]]))
}

function compactSyllabusPayload(data = {}, view = 'summary') {
  const limit = view === 'full' ? 100 : 30
  const active = data?.active_revision || null
  const proposal = data?.proposed_learning_forecast || null
  return {
    has_active_syllabus: data?.has_active_syllabus === true,
    resolved_today: data?.resolved_today || null,
    resolved_timezone: data?.resolved_timezone || null,
    active_revision: active ? {
      id: active.id,
      revision_number: active.revision_number,
      effective_from: active.effective_from,
      goals: active.goals,
      subjects: active.subjects,
      weekly_pattern: active.weekly_pattern,
      teaching_guidance: active.teaching_guidance,
      planning_policy: active.planning_policy,
    } : null,
    timeline_items: (Array.isArray(data?.timeline_items) ? data.timeline_items : []).slice(0, limit).map(compactSyllabusItem),
    forecast_items: (Array.isArray(data?.forecast_items) ? data.forecast_items : []).slice(0, limit).map(compactSyllabusItem),
    no_school_dates: (Array.isArray(data?.no_school_dates) ? data.no_school_dates : []).slice(0, 100),
    proposed_learning_forecast: proposal ? {
      revision: proposal.revision ? { id: proposal.revision.id, base_revision_id: proposal.revision.base_revision_id, proposal_kind: proposal.revision.proposal_kind } : null,
      forecast_items: (Array.isArray(proposal.forecast_items) ? proposal.forecast_items : []).slice(0, limit).map(compactSyllabusItem),
    } : null,
  }
}

async function loadSyllabusData(learnerId, request) {
  const response = await internalApiJson(request, '/api/syllabus', { searchParams: { learnerId } })
  if (!response.ok) throw new Error(response.data?.error || 'Could not load the learner?s Syllabus')
  return response.data
}

async function executeGetSyllabus(args, request, toolLog, toolContext) {
  try {
    const learner = await resolveOwnedLearner(args, request, toolContext)
    pushToolLog(toolLog, { name: 'get_syllabus', phase: 'start', context: { learnerId: learner.id } })
    const data = await loadSyllabusData(learner.id, request)
    const payload = compactSyllabusPayload(data, args?.view === 'full' ? 'full' : 'summary')
    pushToolLog(toolLog, { name: 'get_syllabus', phase: 'success', context: { learnerId: learner.id, active: payload.has_active_syllabus } })
    return toolSuccess('get_syllabus', payload.has_active_syllabus ? `Loaded the active Syllabus for ${learner.name}.` : `No active Syllabus is established for ${learner.name}.`, { learner: { id: learner.id, name: learner.name, grade: learner.grade }, syllabus: payload })
  } catch (error) {
    pushToolLog(toolLog, { name: 'get_syllabus', phase: 'error', context: { message: error.message } })
    return toolError(error.message)
  }
}

async function executeGetLearningEvidence(args, request, toolLog, toolContext) {
  try {
    const learner = await resolveOwnedLearner(args, request, toolContext)
    const limit = Math.max(1, Math.min(10, Number(args?.limit) || 5))
    pushToolLog(toolLog, { name: 'get_learning_evidence', phase: 'start', context: { learnerId: learner.id, limit } })
    const response = await internalApiJson(request, `/api/facilitator/learners/${encodeURIComponent(learner.id)}/evidence`, {
      searchParams: { limit, lesson_key: args?.lessonKey || null },
    })
    if (!response.ok) return toolError(response.data?.error || 'Could not load learning evidence', response.data)
    const items = (Array.isArray(response.data?.items) ? response.data.items : []).slice(0, limit).map((item) => ({
      session: item.session,
      lesson: item.lesson,
      target: item.target,
      completeness: item.completeness,
      baseline: item.baseline,
      assistance: item.assistance,
      independent_evidence: item.independent_evidence,
      retention: item.retention,
      concept_evidence: item.concept_evidence,
      score: item.score,
      interventions: item.interventions,
      interpretations: item.interpretations,
      options: item.options,
      learning_summary: item.learning_summary,
    }))
    pushToolLog(toolLog, { name: 'get_learning_evidence', phase: 'success', context: { learnerId: learner.id, reports: items.length } })
    return toolSuccess('get_learning_evidence', `Loaded ${items.length} canonical evidence report(s) for ${learner.name}.`, {
      learner: { id: learner.id, name: learner.name, grade: learner.grade },
      evidence_enabled: response.data?.enabled !== false,
      items,
      reviews: Array.isArray(response.data?.reviews) ? response.data.reviews.slice(0, 10) : [],
      pagination: response.data?.pagination || null,
    })
  } catch (error) {
    pushToolLog(toolLog, { name: 'get_learning_evidence', phase: 'error', context: { message: error.message } })
    return toolError(error.message)
  }
}

function addDaysIso(dateText, days) {
  const date = new Date(`${dateText}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function executeGetSchedule(args, request, toolLog, toolContext) {
  try {
    const learner = await resolveOwnedLearner(args, request, toolContext)
    const syllabus = await loadSyllabusData(learner.id, request).catch(() => null)
    const startDate = String(args?.startDate || syllabus?.resolved_today || new Date().toISOString().slice(0, 10)).slice(0, 10)
    const endDate = String(args?.endDate || addDaysIso(startDate, 14) || startDate).slice(0, 10)
    pushToolLog(toolLog, { name: 'get_schedule', phase: 'start', context: { learnerId: learner.id, startDate, endDate } })
    const response = await internalApiJson(request, '/api/lesson-schedule', { searchParams: { learnerId: learner.id, startDate, endDate } })
    if (!response.ok) return toolError(response.data?.error || 'Could not load the lesson schedule', response.data)
    const schedule = Array.isArray(response.data?.schedule) ? response.data.schedule : (Array.isArray(response.data) ? response.data : [])
    pushToolLog(toolLog, { name: 'get_schedule', phase: 'success', context: { learnerId: learner.id, count: schedule.length } })
    return toolSuccess('get_schedule', `Loaded ${schedule.length} scheduled lesson(s) for ${learner.name} from ${startDate} through ${endDate}.`, { learner: { id: learner.id, name: learner.name }, startDate, endDate, schedule: schedule.slice(0, 100) })
  } catch (error) {
    pushToolLog(toolLog, { name: 'get_schedule', phase: 'error', context: { message: error.message } })
    return toolError(error.message)
  }
}

async function executeProposeSyllabusPlan(args, request, toolLog, toolContext) {
  try {
    const learner = await resolveOwnedLearner(args, request, toolContext)
    const current = await loadSyllabusData(learner.id, request)
    const expectedActiveRevisionId = current?.active_revision?.id
    if (!current?.has_active_syllabus || !expectedActiveRevisionId) return toolError(`No active Syllabus is established for ${learner.name}.`)
    const action = String(args?.action || '')
    pushToolLog(toolLog, { name: 'propose_syllabus_plan', phase: 'start', context: { learnerId: learner.id, action } })
    let response
    if (action === 'forecast') {
      response = await internalApiJson(request, '/api/syllabus/forecast', { method: 'POST', body: { learnerId: learner.id, expectedActiveRevisionId } })
    } else if (action === 'suggest') {
      response = await internalApiJson(request, '/api/syllabus/planning', { method: 'POST', body: { learnerId: learner.id, expectedActiveRevisionId, action: 'suggest', slots: Array.isArray(args?.slots) ? args.slots : [] } })
    } else if (action === 'edit_forecast') {
      response = await internalApiJson(request, '/api/syllabus/planning', { method: 'POST', body: { learnerId: learner.id, expectedActiveRevisionId, action: 'edit_forecast', proposalRevisionId: args?.proposalRevisionId, lineageId: args?.lineageId, title: args?.title, description: args?.description } })
    } else if (action === 'replace_forecast') {
      response = await internalApiJson(request, '/api/syllabus/planning', { method: 'POST', body: { learnerId: learner.id, expectedActiveRevisionId, action: 'replace_forecast', proposalRevisionId: args?.proposalRevisionId, lineageId: args?.lineageId, changeRequest: args?.changeRequest || '' } })
    } else {
      return toolError('Unsupported Syllabus proposal action')
    }
    if (!response.ok) return toolError(response.data?.error || 'Could not create the Syllabus proposal', response.data)
    pushToolLog(toolLog, { name: 'propose_syllabus_plan', phase: 'success', context: { learnerId: learner.id, action } })
    return toolSuccess('propose_syllabus_plan', `Created a ${action.replaceAll('_', ' ')} proposal for ${learner.name}. The active Syllabus was not silently rewritten.`, {
      learner: { id: learner.id, name: learner.name },
      proposal: response.data,
      activeChanged: false,
      expectedActiveRevisionId,
    })
  } catch (error) {
    pushToolLog(toolLog, { name: 'propose_syllabus_plan', phase: 'error', context: { message: error.message } })
    return toolError(error.message)
  }
}

function mergePlanDetailsPatch(activeRevision, patch = {}) {
  const out = {}
  const has = (key) => Object.prototype.hasOwnProperty.call(patch, key)
  if (has('goals')) out.goals = (patch.goals && typeof patch.goals === 'object' && !Array.isArray(patch.goals)) ? { ...(activeRevision?.goals || {}), ...patch.goals } : patch.goals
  if (has('subjects')) out.subjects = patch.subjects
  if (has('weekly_pattern')) out.weekly_pattern = patch.weekly_pattern
  if (has('teaching_guidance')) out.teaching_guidance = (patch.teaching_guidance && typeof patch.teaching_guidance === 'object' && !Array.isArray(patch.teaching_guidance)) ? { ...(activeRevision?.teaching_guidance || {}), ...patch.teaching_guidance } : patch.teaching_guidance
  out.change_reason = 'Facilitator-directed Syllabus update through Mr. Mentor'
  return out
}

async function executeUpdateSyllabusPlan(args, request, toolLog, toolContext) {
  try {
    const learner = await resolveOwnedLearner(args, request, toolContext)
    const current = await loadSyllabusData(learner.id, request)
    const expectedActiveRevisionId = current?.active_revision?.id
    if (!current?.has_active_syllabus || !expectedActiveRevisionId) return toolError(`No active Syllabus is established for ${learner.name}.`)
    const action = String(args?.action || '')
    pushToolLog(toolLog, { name: 'update_syllabus_plan', phase: 'start', context: { learnerId: learner.id, action, expectedActiveRevisionId } })
    let response
    if (action === 'set_plan_details') {
      const patch = args?.planDetailsPatch
      if (!patch || typeof patch !== 'object' || Array.isArray(patch) || !Object.keys(patch).some((key) => ['goals', 'subjects', 'weekly_pattern', 'teaching_guidance'].includes(key))) {
        return toolError('A planDetailsPatch with goals, subjects, weekly_pattern, or teaching_guidance is required')
      }
      response = await internalApiJson(request, '/api/syllabus/activate', { method: 'POST', body: { learnerId: learner.id, expectedActiveRevisionId, planDetails: mergePlanDetailsPatch(current.active_revision, patch) } })
    } else if (action === 'create_day') {
      response = await internalApiJson(request, '/api/syllabus/planning', { method: 'POST', body: { learnerId: learner.id, expectedActiveRevisionId, action: 'create_day', plannedDate: args?.plannedDate, subject: args?.subject, title: args?.title, description: args?.description, generationSpec: args?.generationSpec || null } })
    } else if (action === 'edit_concept') {
      response = await internalApiJson(request, '/api/syllabus/planning', { method: 'POST', body: { learnerId: learner.id, expectedActiveRevisionId, action: 'edit', lineageId: args?.lineageId, title: args?.title, description: args?.description } })
    } else if (action === 'remove_concept') {
      response = await internalApiJson(request, '/api/syllabus/planning', { method: 'POST', body: { learnerId: learner.id, expectedActiveRevisionId, action: 'remove', lineageId: args?.lineageId } })
    } else if (action === 'activate_forecast') {
      if (!args?.proposalRevisionId) return toolError('proposalRevisionId is required to activate a forecast proposal')
      response = await internalApiJson(request, '/api/syllabus/activate', { method: 'POST', body: { learnerId: learner.id, expectedActiveRevisionId, proposalRevisionId: args.proposalRevisionId } })
    } else {
      return toolError('Unsupported active Syllabus update action')
    }
    if (!response.ok) return toolError(response.data?.error || 'Could not update the active Syllabus', response.data)
    const readback = await loadSyllabusData(learner.id, request)
    const activeRevisionId = readback?.active_revision?.id || null
    const verified = Boolean(activeRevisionId && activeRevisionId !== expectedActiveRevisionId)
    pushToolLog(toolLog, { name: 'update_syllabus_plan', phase: verified ? 'success' : 'error', context: { learnerId: learner.id, action, activeRevisionId } })
    return toolSuccess('update_syllabus_plan', verified ? `Updated and verified the active Syllabus for ${learner.name}.` : `The Syllabus update returned successfully, but the new active revision could not be verified.`, { learner: { id: learner.id, name: learner.name }, previousActiveRevisionId: expectedActiveRevisionId, activeRevisionId, result: response.data }, verified)
  } catch (error) {
    pushToolLog(toolLog, { name: 'update_syllabus_plan', phase: 'error', context: { message: error.message } })
    return toolError(error.message)
  }
}

async function executeMaterializeSyllabusLesson(args, request, toolLog, toolContext) {
  try {
    const learner = await resolveOwnedLearner(args, request, toolContext)
    const current = await loadSyllabusData(learner.id, request)
    const expectedActiveRevisionId = current?.active_revision?.id
    if (!expectedActiveRevisionId) return toolError(`No active Syllabus is established for ${learner.name}.`)
    const lineageId = String(args?.lineageId || '').trim()
    if (!lineageId) return toolError('An exact Syllabus lineageId is required')
    pushToolLog(toolLog, { name: 'materialize_syllabus_lesson', phase: 'start', context: { learnerId: learner.id, lineageId } })
    const response = await internalApiJson(request, '/api/syllabus/materialize', { method: 'POST', body: { learnerId: learner.id, lineageId, expectedActiveRevisionId, proposalRevisionId: args?.proposalRevisionId || null, existingLessonKey: args?.existingLessonKey || null } })
    if (!response.ok) return toolError(response.data?.error || 'Could not materialize the Syllabus lesson', response.data)
    const readback = await loadSyllabusData(learner.id, request)
    const items = Array.isArray(readback?.timeline_items) ? readback.timeline_items : []
    const materialized = items.find((item) => String(item?.lineage_id || '') === lineageId && item?.lesson_key)
    const verified = Boolean(materialized?.lesson_key || response.data?.lesson_key || response.data?.lessonKey)
    pushToolLog(toolLog, { name: 'materialize_syllabus_lesson', phase: verified ? 'success' : 'error', context: { learnerId: learner.id, lineageId, lessonKey: materialized?.lesson_key || null } })
    return toolSuccess('materialize_syllabus_lesson', verified ? `Materialized and verified the Syllabus lesson for ${learner.name}.` : 'Materialization returned successfully, but the lesson binding could not be verified.', { learner: { id: learner.id, name: learner.name }, lineageId, materialized: materialized ? compactSyllabusItem(materialized) : null, result: response.data }, verified)
  } catch (error) {
    pushToolLog(toolLog, { name: 'materialize_syllabus_lesson', phase: 'error', context: { message: error.message } })
    return toolError(error.message)
  }
}

async function executeSetInstructionalTeacher(args, request, toolLog, toolContext) {
  try {
    const learner = await resolveOwnedLearner(args, request, toolContext)
    const lessonKey = normalizeLessonKey(args?.lessonKey)
    const occurrenceId = String(args?.occurrenceId || '').trim()
    const instructionalTeacher = String(args?.instructionalTeacher || '').trim().toLowerCase()
    if (!lessonKey || !occurrenceId || !['sonoma', 'webb'].includes(instructionalTeacher)) return toolError('lessonKey, occurrenceId, and a valid instructionalTeacher are required')
    pushToolLog(toolLog, { name: 'set_instructional_teacher', phase: 'start', context: { learnerId: learner.id, occurrenceId, instructionalTeacher } })
    const response = await internalApiJson(request, '/api/syllabus/lesson-associations', { method: 'PATCH', body: { learnerId: learner.id, lessonKey, occurrenceId, instructionalTeacher } })
    if (!response.ok) return toolError(response.data?.error || 'Could not set the instructional teacher', response.data)
    const savedTeacher = response.data?.association?.instructional_teacher || response.data?.association?.instructionalTeacher || instructionalTeacher
    const verified = savedTeacher === instructionalTeacher
    pushToolLog(toolLog, { name: 'set_instructional_teacher', phase: verified ? 'success' : 'error', context: { learnerId: learner.id, occurrenceId, instructionalTeacher } })
    return toolSuccess('set_instructional_teacher', verified ? `Assigned ${instructionalTeacher === 'webb' ? 'Mrs. Webb' : 'Ms. Sonoma'} to that Syllabus occurrence for ${learner.name}.` : 'The teacher assignment returned successfully but could not be verified.', { learner: { id: learner.id, name: learner.name }, occurrenceId, instructionalTeacher, association: response.data?.association || null }, verified)
  } catch (error) {
    pushToolLog(toolLog, { name: 'set_instructional_teacher', phase: 'error', context: { message: error.message } })
    return toolError(error.message)
  }
}

async function executeManageSlatePractice(args, request, toolLog, toolContext) {
  try {
    const learner = await resolveOwnedLearner(args, request, toolContext)
    const action = String(args?.action || '')
    pushToolLog(toolLog, { name: 'manage_slate_practice', phase: 'start', context: { learnerId: learner.id, action } })
    let response
    if (action === 'schedule') {
      const lessonKey = normalizeLessonKey(args?.lessonKey)
      if (!lessonKey || !args?.occurrenceId || !args?.scheduledDate) return toolError('lessonKey, occurrenceId, and scheduledDate are required to schedule Mr. Slate')
      response = await internalApiJson(request, '/api/syllabus/slate-assignments', { method: 'POST', body: { learnerId: learner.id, lessonKey, occurrenceId: args.occurrenceId, scheduledDate: args.scheduledDate, runPurpose: args?.runPurpose || 'practice' } })
    } else if (action === 'remove') {
      if (!args?.assignmentId) return toolError('assignmentId is required to remove a Mr. Slate assignment')
      response = await internalApiJson(request, '/api/syllabus/slate-assignments', { method: 'DELETE', body: { learnerId: learner.id, assignmentId: args.assignmentId } })
    } else {
      return toolError('Unsupported Mr. Slate action')
    }
    if (!response.ok) return toolError(response.data?.error || 'Could not update Mr. Slate practice', response.data)
    pushToolLog(toolLog, { name: 'manage_slate_practice', phase: 'success', context: { learnerId: learner.id, action } })
    return toolSuccess('manage_slate_practice', action === 'schedule' ? `Scheduled Mr. Slate work for ${learner.name}.` : `Removed the Mr. Slate assignment for ${learner.name}.`, { learner: { id: learner.id, name: learner.name }, result: response.data })
  } catch (error) {
    pushToolLog(toolLog, { name: 'manage_slate_practice', phase: 'error', context: { message: error.message } })
    return toolError(error.message)
  }
}

async function executeManageNoSchoolDate(args, request, toolLog, toolContext) {
  try {
    const learner = await resolveOwnedLearner(args, request, toolContext)
    const action = String(args?.action || '')
    pushToolLog(toolLog, { name: 'manage_no_school_date', phase: 'start', context: { learnerId: learner.id, action, date: args?.date || null } })
    if (action === 'list') {
      const response = await internalApiJson(request, '/api/no-school-dates', { searchParams: { learnerId: learner.id } })
      if (!response.ok) return toolError(response.data?.error || 'Could not load no-school dates', response.data)
      return toolSuccess('manage_no_school_date', `Loaded no-school dates for ${learner.name}.`, { learner: { id: learner.id, name: learner.name }, dates: response.data?.dates || [] })
    }
    const date = String(args?.date || '').slice(0, 10)
    if (!date) return toolError('A YYYY-MM-DD date is required')
    const response = action === 'add'
      ? await internalApiJson(request, '/api/no-school-dates', { method: 'POST', body: { learnerId: learner.id, date, reason: args?.reason || null } })
      : action === 'remove'
        ? await internalApiJson(request, '/api/no-school-dates', { method: 'DELETE', searchParams: { learnerId: learner.id, date } })
        : null
    if (!response) return toolError('Unsupported no-school-date action')
    if (!response.ok) return toolError(response.data?.error || 'Could not update the no-school date', response.data)
    const readback = await internalApiJson(request, '/api/no-school-dates', { searchParams: { learnerId: learner.id } })
    const dates = Array.isArray(readback.data?.dates) ? readback.data.dates : []
    const exists = dates.some((entry) => String(entry?.date || entry).slice(0, 10) === date)
    const verified = readback.ok && (action === 'add' ? exists : !exists)
    pushToolLog(toolLog, { name: 'manage_no_school_date', phase: verified ? 'success' : 'error', context: { learnerId: learner.id, action, date } })
    return toolSuccess('manage_no_school_date', verified ? `${action === 'add' ? 'Added' : 'Removed'} and verified ${date} ${action === 'add' ? 'as' : 'from'} a no-school date for ${learner.name}.` : 'The no-school-date write returned successfully but readback did not verify it.', { learner: { id: learner.id, name: learner.name }, date, dates }, verified)
  } catch (error) {
    pushToolLog(toolLog, { name: 'manage_no_school_date', phase: 'error', context: { message: error.message } })
    return toolError(error.message)
  }
}

function executeOpenSurface(args) {
  const routes = {
    syllabus: '/facilitator',
    calendar: '/facilitator/calendar',
    lessons: '/facilitator/lessons',
    generated_lessons: '/facilitator/generator/generated',
    lesson_maker: '/facilitator/generator/lesson-maker',
    learners: '/facilitator/learners',
    prepare: '/facilitator/prepare',
    account: '/facilitator/account',
    notifications: '/facilitator/notifications',
    mr_mentor: '/facilitator/generator/counselor',
  }
  const surface = String(args?.surface || '')
  const base = routes[surface]
  if (!base) return toolError('Unknown facilitator surface')
  const href = surface === 'syllabus' && args?.learnerId ? `${base}?learnerId=${encodeURIComponent(args.learnerId)}` : base
  return toolSuccess('open_surface', 'Opening that Ms. Sonoma surface.', { uiAction: { type: 'navigate', href }, surface })
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
async function executeLessonScheduling(args, request, toolLog, toolContext = {}) {
  try {
    const learner = await resolveOwnedLearner(args, request, toolContext)
    const lessonKey = normalizeLessonKey(args?.lessonKey)
    const scheduledDate = String(args?.scheduledDate || '').slice(0, 10)
    if (!lessonKey) return toolError('Missing lessonKey')
    if (!scheduledDate) return toolError('Missing scheduledDate in YYYY-MM-DD format')
    pushToolLog(toolLog, { name: 'schedule_lesson', phase: 'start', context: { learnerId: learner.id, scheduledDate, lessonKey } })
    const response = await internalApiJson(request, '/api/lesson-schedule', {
      method: 'POST',
      body: { learnerId: learner.id, lessonKey, scheduledDate },
    })
    if (!response.ok) {
      pushToolLog(toolLog, { name: 'schedule_lesson', phase: 'error', context: { learnerId: learner.id, message: response.data?.error || 'Lesson scheduling failed' } })
      return toolError(response.data?.error || 'Lesson scheduling failed', response.data)
    }
    const readback = await internalApiJson(request, '/api/lesson-schedule', {
      searchParams: { learnerId: learner.id, startDate: scheduledDate, endDate: scheduledDate },
    })
    const rows = Array.isArray(readback.data?.schedule) ? readback.data.schedule : (Array.isArray(readback.data) ? readback.data : [])
    const verified = readback.ok && rows.some((row) => String(normalizeLessonKey(row?.lesson_key || row?.lessonKey || '')) === String(lessonKey) && String(row?.scheduled_date || row?.scheduledDate || '').slice(0, 10) === scheduledDate)
    pushToolLog(toolLog, { name: 'schedule_lesson', phase: verified ? 'success' : 'error', context: { learnerId: learner.id, scheduledDate, lessonKey, verified } })
    return toolSuccess('schedule_lesson', verified ? `Scheduled and verified the lesson for ${learner.name} on ${scheduledDate}.` : `The schedule write succeeded for ${learner.name}, but readback did not verify it.`, {
      learner: { id: learner.id, name: learner.name }, lessonKey, scheduledDate, result: response.data,
    }, verified)
  } catch (error) {
    pushToolLog(toolLog, { name: 'schedule_lesson', phase: 'error', context: { message: error.message } })
    return toolError(error.message)
  }
}

// Helper function to execute lesson assignment (approved_lessons)
async function executeLessonAssignment(args, request, toolLog, toolContext = {}) {
  try {
    const learner = await resolveOwnedLearner(args, request, toolContext)
    const lessonKey = normalizeLessonKey(args?.lessonKey)
    if (!lessonKey) return toolError('Missing lessonKey')
    pushToolLog(toolLog, { name: 'assign_lesson', phase: 'start', context: { learnerId: learner.id, lessonKey } })
    const response = await internalApiJson(request, '/api/lesson-assign', {
      method: 'POST',
      body: { learnerId: learner.id, lessonKey, assigned: true },
    })
    if (!response.ok) {
      pushToolLog(toolLog, { name: 'assign_lesson', phase: 'error', context: { learnerId: learner.id, message: response.data?.error || 'Lesson assignment failed' } })
      return toolError(response.data?.error || 'Lesson assignment failed', response.data)
    }
    let lessonTitle = args?.lessonTitle || null
    if (!lessonTitle) {
      const details = await executeGetLessonDetails({ lessonKey }, request, toolLog)
      if (details?.success) lessonTitle = details.title || details.lessonTitle || null
    }
    pushToolLog(toolLog, { name: 'assign_lesson', phase: 'success', context: { learnerId: learner.id, lessonKey } })
    return toolSuccess('assign_lesson', `Assigned the lesson to ${learner.name}.`, {
      learner: { id: learner.id, name: learner.name }, lessonKey, lessonTitle, result: response.data,
    })
  } catch (error) {
    pushToolLog(toolLog, { name: 'assign_lesson', phase: 'error', context: { message: error.message } })
    return toolError(error.message)
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
    const canonicalUpdates = canonicalizeAiGeneratedLessonChoices(updates)
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
      body: JSON.stringify({ lessonKey, updates: canonicalUpdates })
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

const MENTOR_TOOL_EXECUTORS = Object.freeze({
  get_capabilities: async (args) => getCapabilitiesInfo(args),
  search_lessons: (args, context) => executeSearchLessons(args, context.request, context.toolLog),
  get_lesson_details: (args, context) => executeGetLessonDetails(args, context.request, context.toolLog),
  get_syllabus: (args, context) => executeGetSyllabus(args, context.request, context.toolLog, context),
  get_learning_evidence: (args, context) => executeGetLearningEvidence(args, context.request, context.toolLog, context),
  get_schedule: (args, context) => executeGetSchedule(args, context.request, context.toolLog, context),
  propose_syllabus_plan: (args, context) => executeProposeSyllabusPlan(args, context.request, context.toolLog, context),
  generate_lesson: (args, context) => executeLessonGeneration(args, context.request, context.toolLog),
  schedule_lesson: (args, context) => executeLessonScheduling(args, context.request, context.toolLog, context),
  assign_lesson: (args, context) => executeLessonAssignment(args, context.request, context.toolLog, context),
  edit_lesson: (args, context) => executeLessonEdit(args, context.request, context.toolLog),
  update_syllabus_plan: (args, context) => executeUpdateSyllabusPlan(args, context.request, context.toolLog, context),
  materialize_syllabus_lesson: (args, context) => executeMaterializeSyllabusLesson(args, context.request, context.toolLog, context),
  set_instructional_teacher: (args, context) => executeSetInstructionalTeacher(args, context.request, context.toolLog, context),
  manage_slate_practice: (args, context) => executeManageSlatePractice(args, context.request, context.toolLog, context),
  manage_no_school_date: (args, context) => executeManageNoSchoolDate(args, context.request, context.toolLog, context),
  open_surface: async (args, context) => executeOpenSurface({ ...args, learnerId: args?.learnerId || context.selectedLearnerId || null }),
  get_conversation_memory: (args, context) => executeGetConversationMemory({ ...args, learner_id: args?.learner_id || context.selectedLearnerId || null }, context.request, context.toolLog),
  search_conversation_history: (args, context) => executeSearchConversationHistory(args, context.request, context.toolLog),
})

const MISSING_MENTOR_EXECUTORS = MENTOR_TOOL_REGISTRY.map((tool) => tool.name).filter((name) => !MENTOR_TOOL_EXECUTORS[name])
const EXTRA_MENTOR_EXECUTORS = Object.keys(MENTOR_TOOL_EXECUTORS).filter((name) => !getMentorTool(name))
if (MISSING_MENTOR_EXECUTORS.length || EXTRA_MENTOR_EXECUTORS.length) {
  throw new Error(`Mr. Mentor tool registry/dispatcher mismatch. Missing: ${MISSING_MENTOR_EXECUTORS.join(', ') || 'none'}; extra: ${EXTRA_MENTOR_EXECUTORS.join(', ') || 'none'}`)
}

async function executeMentorTool(name, args, context) {
  const registered = getMentorTool(name)
  const executor = MENTOR_TOOL_EXECUTORS[name]
  if (!registered || !executor) return toolError(`Unknown Mr. Mentor tool: ${name}`)
  return executor(args || {}, context)
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
    let generationConfirmed = false
    let disableTools = []
    let subjectKey = null
    let useCohereChronograph = false
    let cohereSector = 'both'
    let cohereMode = 'standard'
    let selectedLearnerId = null
    let selectedLearnerName = null
    let confirmedTools = []
    let requestPayload = null
    
    const contentType = (req.headers?.get?.('content-type') || '').toLowerCase()
    let learnerTranscript = null
    let goalsNotes = null
    try {
      if (contentType.includes('application/json')) {
        const body = await req.json()
        requestPayload = body
        userMessage = (body.message || '').trim()
        conversationHistory = Array.isArray(body.history) ? body.history : []
        learnerTranscript = body.learner_transcript || null
        goalsNotes = body.goals_notes || null
        followup = body.followup || null
        generationConfirmed = !!body.generation_confirmed
        confirmedTools = Array.isArray(body.confirmed_tools) ? body.confirmed_tools.map((value) => String(value || '').trim()).filter(Boolean) : []
        selectedLearnerId = typeof body.selected_learner_id === 'string' && body.selected_learner_id !== 'none' ? body.selected_learner_id.trim() : null
        selectedLearnerName = typeof body.selected_learner_name === 'string' ? body.selected_learner_name.trim() : null
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
    const safetyClassification = classifyConversationSafety(userMessage, { educational: false }).classification
    systemPrompt += `\n\n${buildConversationSafetyContext(safetyClassification, { lessonTopic: 'educational planning', audience: 'facilitator' })}`
    
    if (goalsNotes) {
      systemPrompt += `\n\n=== PERSISTENT GOALS & PRIORITIES ===\nThe facilitator has set these persistent goals that should guide all conversations:\n\nPersistent Goals:\n${goalsNotes}\n\n=== END PERSISTENT GOALS ===\n\nIMPORTANT: These goals persist across all conversations. Reference them when relevant, and help the facilitator work toward them. The facilitator can update these goals anytime using the Goals clipboard button (ðŸ“‹) on screen.`
    }
    
    if (selectedLearnerId) {
      systemPrompt += `\n\n=== SELECTED LEARNER TARGET ===\nLearner ID: ${selectedLearnerId}\nLearner name: ${selectedLearnerName || 'selected learner'}\nUse this learner by default for learner-scoped tools unless the facilitator explicitly names another learner.\n=== END SELECTED LEARNER TARGET ===`
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
          const learnerId = selectedLearnerId
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
          const blindspot = requestPayload?.interceptor_context?.mentor_blindspot
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

    // Define available functions from the authoritative Mr. Mentor registry.
    let tools = getMentorOpenAiTools()

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
            max_completion_tokens: 1500,
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
      max_completion_tokens: 1500,
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
      // Confirmation policy comes from the authoritative tool registry.
      const confirmedToolSet = new Set(confirmedTools)
      if (generationConfirmed) confirmedToolSet.add('generate_lesson')
      const confirmationCall = toolCalls.find((toolCall) => {
        const name = toolCall?.function?.name
        return mentorToolNeedsConfirmation(name) && !confirmedToolSet.has(name)
      })
      if (confirmationCall) {
        const confirmationTool = confirmationCall.function.name
        const mentorReply = mentorToolConfirmationPrompt(confirmationTool)
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
                meta: { call_id: callId, needs_confirmation: true, confirmation_tool: confirmationTool }
              })
            }
          } catch {}
        }
        return NextResponse.json({
          reply: mentorReply,
          audio: audioContent,
          toolLog,
          needsConfirmation: true,
          confirmationTool,
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
          result = await executeMentorTool(functionName, functionArgs, {
            request: req,
            toolLog,
            selectedLearnerId,
            selectedLearnerName,
          })
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

      const hasGenerationToolCall = toolCalls.some(tc => tc.function.name === 'generate_lesson')
      const directResultIndex = toolCalls.findIndex(tc => mentorToolUsesDirectResult(tc.function.name))
      const firstErrorResult = parsedToolResults.find(result => result?.error)

      if (hasGenerationToolCall || directResultIndex >= 0 || firstErrorResult) {
        let mentorReplyText
        if (firstErrorResult) {
          mentorReplyText = `I ran into an issue: ${firstErrorResult.error}`
        } else {
          const directResult = directResultIndex >= 0 ? parsedToolResults[directResultIndex] : parsedToolResults[0]
          mentorReplyText = directResult?.message || 'The requested action completed.'
        }
        const responsePayload = {
          reply: mentorReplyText,
          audio: null,
          functionCalls: toolCalls.map(tc => ({ name: tc.function.name, args: JSON.parse(tc.function.arguments) })),
          toolLog,
          toolResults: parsedToolResults,
          needsFollowUp: hasGenerationToolCall && !firstErrorResult,
          usage: parsedBody?.usage || null,
        }
        if (hasGenerationToolCall && !firstErrorResult) {
          responsePayload.followUp = { assistantMessage, functionResults }
        }
        return NextResponse.json(responsePayload)
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
          max_completion_tokens: 1500,
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
