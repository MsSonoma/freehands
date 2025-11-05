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

    console.log('[Available Lessons API] Raw schedule rows for', learnerId, today, ':', scheduleData)

    const scheduledKeys = (scheduleData || [])
      .filter(item => item?.lesson_key)
      .map(item => normalizeLessonKey(item.lesson_key))

    // Combine approved and scheduled (normalized for consistency)
    const approvedKeys = Object.keys(approvedLessons || {}).map(key => normalizeLessonKey(key))
    const allKeys = [...approvedKeys, ...scheduledKeys]
    const uniqueKeys = [...new Set(allKeys)].filter(Boolean)
    
    console.log('[Available Lessons API] Learner:', learnerId, 'Approved:', approvedKeys, 'Scheduled:', scheduledKeys)
    
    // Now fetch the actual lesson data for each key
    const lessons = []
    
    for (const key of uniqueKeys) {
      const parts = key.split('/')
      const rawSubject = parts[0] || ''
      const subject = rawSubject.toLowerCase()
      const filename = parts.slice(1).join('/') || key

      try {
        let lessonData = null

        // Generated lessons always live in facilitator storage
  if (subject === 'generated') {
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
              console.error('[Available Lessons API] Error loading generated lesson:', key, error)
            }
          } else {
            console.warn('[Available Lessons API] Missing facilitator for generated lesson:', key)
          }
        } else if (subject === 'general') {
          // General lessons default to the shared facilitator library on disk
          const facilitatorFilePath = path.join(LESSONS_ROOT, FACILITATOR_FOLDER, filename)
          try {
            const raw = await fs.promises.readFile(facilitatorFilePath, 'utf8')
            lessonData = JSON.parse(raw)
            lessonData.subject = 'general'
            lessonData.file = filename
          } catch (readErr) {
            if (readErr.code !== 'ENOENT') {
              console.error('[Available Lessons API] Error reading general lesson from disk:', key, readErr)
            }
            // Fallback: attempt facilitator storage (older uploads)
            if (!lessonData && facilitatorId) {
              const { data, error } = await supabase.storage
                .from('lessons')
                .download(`facilitator-lessons/${facilitatorId}/${filename}`)
              
              if (!error && data) {
                const text = await data.text()
                lessonData = JSON.parse(text)
                lessonData.subject = 'general'
                lessonData.file = filename
              } else if (error) {
                console.error('[Available Lessons API] Error loading general lesson from storage:', key, error)
              }
            }
          }
        } else if (STOCK_SUBJECTS.has(subject)) {
          // Stock lessons are bundled on disk inside public/lessons/<subject>
          const subjectFolder = subject.replace(/_/g, ' ')
          const stockFilePath = path.join(LESSONS_ROOT, subjectFolder, filename)
          try {
            const raw = await fs.promises.readFile(stockFilePath, 'utf8')
            lessonData = JSON.parse(raw)
            lessonData.subject = subject
            lessonData.file = filename
          } catch (readErr) {
            if (readErr.code === 'ENOENT') {
              console.warn('[Available Lessons API] Stock lesson not found on disk:', key)
            } else {
              console.error('[Available Lessons API] Error reading stock lesson from disk:', key, readErr)
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
                console.warn('[Available Lessons API] Legacy stock lesson not found on disk:', key)
              } else {
                console.error('[Available Lessons API] Legacy stock read error:', key, legacyErr)
              }
            }
          } else {
            console.warn('[Available Lessons API] Unrecognized lesson key format:', key)
          }
        }

        if (lessonData) {
          lessonData.lessonKey = key
          lessonData.subject = lessonData.subject || subject || rawSubject || 'general'
          lessons.push(lessonData)
        }
      } catch (err) {
        console.error('[Available Lessons API] Error loading', key, err)
      }
    }
    
    console.log('[Available Lessons API] Returning', lessons.length, 'lessons')

    const responseBody = {
      lessons,
      scheduledKeys,
      approvedKeys,
      rawSchedule: scheduleData || [],
      scheduleError: scheduleError ? scheduleError.message || String(scheduleError) : null
    }

    return NextResponse.json(responseBody)
    
  } catch (error) {
    console.error('[Available Lessons API] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
