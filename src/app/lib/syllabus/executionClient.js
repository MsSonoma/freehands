'use client'

import { getSupabaseClient, hasSupabaseEnv } from '../supabaseClient.js'
import { startLessonSession } from '../sessionTracking.js'

export function getProtectedBrowserSessionId() {
  if (typeof window === 'undefined') return null
  let value = sessionStorage.getItem('lesson_session_id')
  if (!value) {
    value = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : null
    if (value) sessionStorage.setItem('lesson_session_id', value)
  }
  return value
}

async function accessToken() {
  if (!hasSupabaseEnv()) throw new Error('Secure lesson authorization is unavailable.')
  const { data } = await getSupabaseClient().auth.getSession()
  const token = data?.session?.access_token
  if (!token) throw new Error('Sign in is required to authorize this Syllabus lesson.')
  return token
}

export async function authorizeProtectedOccurrence({ learnerId, lessonKey, occurrenceId = '', instructionalTeacher, requestPin }, deps = {}) {
  if (!learnerId || !lessonKey) throw new Error('A learner and lesson are required.')
  const token = await (deps.accessToken || accessToken)()
  const fetchImpl = deps.fetch || fetch
  const request = async (exceptionPin) => {
    const response = await fetchImpl('/api/syllabus/execution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ learnerId, lessonKey, occurrenceId: String(occurrenceId || '').trim(), ...(instructionalTeacher ? { instructionalTeacher } : {}), ...(exceptionPin ? { exceptionPin } : {}) }),
    })
    return { response, result: await response.json().catch(() => ({})) }
  }
  let authorization = await request()
  if (authorization.response.status === 409 && authorization.result?.code === 'SYLLABUS_EXECUTION_PIN_REQUIRED') {
    const pin = await requestPin?.({ message: authorization.result.error })
    if (!pin) throw new Error('This Syllabus occurrence was not authorized.')
    authorization = await request(pin)
  }
  const canonicalOccurrenceId = String(authorization.result?.occurrenceId || '').trim()
  if (!authorization.response.ok || !authorization.result?.ok || !canonicalOccurrenceId) {
    throw new Error(authorization.result?.error || 'This Syllabus occurrence is not authorized.')
  }
  if (instructionalTeacher && authorization.result?.instructionalTeacher !== instructionalTeacher) {
    throw new Error('This lesson is assigned to a different instructional teacher.')
  }
  return { ...authorization.result, occurrenceId: canonicalOccurrenceId }
}

export async function startProtectedInstructionalSession({ learnerId, lessonKey, occurrenceId, instructionalTeacher, requestPin }, deps = {}) {
  if (!['sonoma', 'webb'].includes(instructionalTeacher)) throw new Error('A valid instructional teacher assignment is required.')
  const authorize = deps.authorizeProtectedOccurrence || authorizeProtectedOccurrence
  const authorization = await authorize({ learnerId, lessonKey, occurrenceId, instructionalTeacher, requestPin }, deps)
  const browserSessionId = (deps.getProtectedBrowserSessionId || getProtectedBrowserSessionId)()
  if (!browserSessionId) throw new Error('A secure browser session identity is required.')
  const deviceName = typeof navigator !== 'undefined' ? navigator.userAgent : null
  const start = deps.startLessonSession || startLessonSession
  let result = await start(learnerId, lessonKey, browserSessionId, deviceName, null, null, authorization.occurrenceId, instructionalTeacher)
  if (result?.conflict) {
    const takeoverPin = await requestPin?.({ message: 'This lesson is active on another device. Enter the Facilitator PIN to continue here.' })
    if (!takeoverPin) throw new Error('This lesson remains active on another device.')
    result = await start(learnerId, lessonKey, browserSessionId, deviceName, takeoverPin, result.existingSession?.id, authorization.occurrenceId, instructionalTeacher)
  }
  if (!result?.id || result?.conflict) throw new Error('Unable to confirm this protected lesson session.')
  return { ...result, occurrenceId: authorization.occurrenceId }
}
