import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { normalizeLessonKey } from '@/app/lib/lessonKeyNormalization'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const LESSONS_ROOT = path.join(process.cwd(), 'public', 'lessons')
const FACILITATOR_FOLDER = 'Facilitator Lessons'
const STOCK_SUBJECTS = new Set(['math', 'science', 'social studies', 'language arts'])

function buildApprovedLookup(raw = {}) {
  const normalized = {}
  const rawLookup = {}
  Object.entries(raw || {}).forEach(([key, value]) => {
    if (!value) return
    const normalizedKey = normalizeLessonKey(key) || key
    if (!normalizedKey) return
    normalized[normalizedKey] = true
    if (!rawLookup[normalizedKey]) rawLookup[normalizedKey] = []
    if (!rawLookup[normalizedKey].includes(key)) {
      rawLookup[normalizedKey].push(key)
    }
  })
  return { normalized, rawLookup }
}

function mapFromKeys(keys = []) {
  const map = {}
  keys.forEach(key => {
    if (key) {
      map[key] = true
    }
  })
  return map
}

async function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const learnerId = searchParams.get('learner_id')
    
    if (!learnerId) {
      return NextResponse.json({ error: 'learner_id required' }, { status: 400 })
    }
    
    const supabase = await getSupabaseAdmin()
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }
    
    // Get the learner's approved lessons and scheduled lessons
    const { data: learnerData } = await supabase
      .from('learners')
      .select('approved_lessons, facilitator_id')
      .eq('id', learnerId)
      .single()
    
    if (!learnerData) {
      return NextResponse.json({ lessons: [] })
    }
    
    const approvedLessons = learnerData.approved_lessons || {}
    const facilitatorId = learnerData.facilitator_id
    const { normalized: approvedNormalizedMap } = buildApprovedLookup(approvedLessons)
    const approvedKeys = Object.keys(approvedNormalizedMap)

    // Get today's scheduled lessons using local date (not UTC)
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const today = `${year}-${month}-${day}`

    const { data: scheduleData, error: scheduleError } = await supabase
      .from('lesson_schedule')
      .select('lesson_key')
      .eq('learner_id', learnerId)
      .eq('scheduled_date', today)

    if (scheduleError) {
      console.error('[Available Lessons API] Failed to load schedule rows:', scheduleError)
    }

    const scheduleRows = Array.isArray(scheduleData) ? scheduleData : []
    console.log('[Available Lessons API] Raw schedule rows for', learnerId, today, ':', scheduleRows)

    const scheduledKeys = scheduleRows
      .map(item => item?.lesson_key ? normalizeLessonKey(item.lesson_key) : null)
      .filter(Boolean)

    // Combine approved and scheduled (normalized for consistency)
    const uniqueKeys = [...new Set([...approvedKeys, ...scheduledKeys])].filter(Boolean)
    console.log('[Available Lessons API] Learner:', learnerId, 'Approved:', approvedKeys, 'Scheduled:', scheduledKeys)

    // Track stale entries for cleanup
    const approvedKeySet = new Set(approvedKeys)
    const scheduledKeySet = new Set(scheduledKeys)
    const staleApprovedKeys = new Set()
    const staleScheduledKeys = new Set()
    const lessons = []

    for (const key of uniqueKeys) {
      const normalizedKey = normalizeLessonKey(key)
      if (!normalizedKey) continue
      const parts = normalizedKey.split('/')
      const rawSubject = parts[0] || ''
      const subject = rawSubject.toLowerCase()
      const filename = parts.slice(1).join('/') || normalizedKey

      let lessonData = null
      let missingReason = null

      if (!parts || parts.length < 2) {
        missingReason = 'invalid-key'
      } else if (subject === 'generated') {
        if (facilitatorId) {
          const { data, error } = await supabase.storage
            .from('lessons')
            .download(`facilitator-lessons/${facilitatorId}/${filename}`)

          if (!error && data) {
            const text = await data.text()
            lessonData = JSON.parse(text)
            lessonData.isGenerated = true
            lessonData.subject = 'generated'
            lessonData.file = filename
          } else {
            if (error?.status === 404) {
              missingReason = 'not-found'
            }
            console.error('[Available Lessons API] Error loading generated lesson:', normalizedKey, error)
          }
        } else {
          missingReason = 'missing-facilitator'
          console.warn('[Available Lessons API] Missing facilitator for generated lesson:', normalizedKey)
        }
      } else if (subject === 'general') {
        const facilitatorFilePath = path.join(LESSONS_ROOT, FACILITATOR_FOLDER, filename)
        let diskMissing = false
        let storageMissing = false

        try {
          const raw = await fs.promises.readFile(facilitatorFilePath, 'utf8')
          lessonData = JSON.parse(raw)
          lessonData.subject = 'general'
          lessonData.file = filename
        } catch (readErr) {
          if (readErr.code === 'ENOENT') {
            diskMissing = true
          } else {
            console.error('[Available Lessons API] Error reading general lesson from disk:', normalizedKey, readErr)
          }
        }

        if (!lessonData && facilitatorId) {
          const { data, error } = await supabase.storage
            .from('lessons')
            .download(`facilitator-lessons/${facilitatorId}/${filename}`)

          if (!error && data) {
            const text = await data.text()
            lessonData = JSON.parse(text)
            lessonData.subject = 'general'
            lessonData.file = filename
          } else if (error?.status === 404) {
            storageMissing = true
          } else if (error) {
            console.error('[Available Lessons API] Error loading general lesson from storage:', normalizedKey, error)
          }
        }

        if (!lessonData && (diskMissing || storageMissing || (!facilitatorId && diskMissing))) {
          missingReason = 'not-found'
        }
      } else if (STOCK_SUBJECTS.has(subject)) {
        const subjectFolder = subject.replace(/_/g, ' ')
        const stockFilePath = path.join(LESSONS_ROOT, subjectFolder, filename)
        try {
          const raw = await fs.promises.readFile(stockFilePath, 'utf8')
          lessonData = JSON.parse(raw)
          lessonData.subject = subject
          lessonData.file = filename
        } catch (readErr) {
          if (readErr.code === 'ENOENT') {
            missingReason = 'not-found'
            console.warn('[Available Lessons API] Stock lesson not found on disk:', normalizedKey)
          } else {
            console.error('[Available Lessons API] Error reading stock lesson from disk:', normalizedKey, readErr)
          }
        }
      } else {
        const legacySubject = rawSubject.replace(/_/g, ' ')
        const legacySubjectLower = legacySubject.toLowerCase()
        if (STOCK_SUBJECTS.has(legacySubjectLower)) {
          const legacyPath = path.join(LESSONS_ROOT, legacySubjectLower, filename)
          try {
            const raw = await fs.promises.readFile(legacyPath, 'utf8')
            lessonData = JSON.parse(raw)
            lessonData.subject = legacySubjectLower
            lessonData.file = filename
          } catch (legacyErr) {
            if (legacyErr.code === 'ENOENT') {
              missingReason = 'not-found'
              console.warn('[Available Lessons API] Legacy stock lesson not found on disk:', normalizedKey)
            } else {
              console.error('[Available Lessons API] Legacy stock read error:', normalizedKey, legacyErr)
            }
          }
        } else {
          missingReason = 'invalid-key'
          console.warn('[Available Lessons API] Unrecognized lesson key format:', normalizedKey)
        }
      }

      if (lessonData) {
        lessonData.lessonKey = normalizedKey
        lessonData.subject = lessonData.subject || subject || rawSubject || 'general'
        lessonData.file = lessonData.file || filename
        lessons.push(lessonData)
      } else {
        if (approvedKeySet.has(normalizedKey) && missingReason) {
          staleApprovedKeys.add(normalizedKey)
        }
        if (scheduledKeySet.has(normalizedKey) && missingReason) {
          staleScheduledKeys.add(normalizedKey)
        }
      }
    }

    const validApprovedKeys = approvedKeys.filter(key => !staleApprovedKeys.has(key))
    const validScheduledKeys = scheduledKeys.filter(key => !staleScheduledKeys.has(key))
    const cleanedApprovedMap = mapFromKeys(validApprovedKeys)

    if (staleApprovedKeys.size > 0) {
      console.warn('[Available Lessons API] Removing stale approved lesson keys for learner', learnerId, Array.from(staleApprovedKeys))
      const { error: cleanupError } = await supabase
        .from('learners')
        .update({ approved_lessons: cleanedApprovedMap })
        .eq('id', learnerId)
      if (cleanupError) {
        console.error('[Available Lessons API] Failed to clean approved lessons map:', cleanupError)
      }
    }

    if (staleScheduledKeys.size > 0) {
      console.warn('[Available Lessons API] Removing stale scheduled lesson keys for learner', learnerId, Array.from(staleScheduledKeys))
      const staleList = Array.from(staleScheduledKeys)
      const { error: scheduleCleanupError } = await supabase
        .from('lesson_schedule')
        .delete()
        .eq('learner_id', learnerId)
        .eq('scheduled_date', today)
        .in('lesson_key', staleList)
      if (scheduleCleanupError) {
        console.error('[Available Lessons API] Failed to clean schedule entries:', scheduleCleanupError)
      }
    }

    const filteredScheduleRows = scheduleRows.filter(item => {
      const normalizedKey = item?.lesson_key ? normalizeLessonKey(item.lesson_key) : null
      return normalizedKey && !staleScheduledKeys.has(normalizedKey)
    })

    console.log('[Available Lessons API] Returning', lessons.length, 'lessons after cleanup')

    const responseBody = {
      lessons,
      scheduledKeys: validScheduledKeys,
      approvedKeys: validApprovedKeys,
      rawSchedule: filteredScheduleRows,
      scheduleError: scheduleError ? scheduleError.message || String(scheduleError) : null,
      staleApprovedKeys: Array.from(staleApprovedKeys),
      staleScheduledKeys: Array.from(staleScheduledKeys)
    }

    return NextResponse.json(responseBody)
    
  } catch (error) {
    console.error('[Available Lessons API] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
