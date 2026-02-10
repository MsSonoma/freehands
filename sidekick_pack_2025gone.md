# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
CalendarOverlay regression: 2025 schedule disappears again. Find where CalendarOverlay overwrites/clears scheduledLessons/plannedLessons (including applying empty payloads) and how to preserve last-known data across refresh.
```

Filter terms used:
```text
CalendarOverlay
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

CalendarOverlay

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/facilitator/generator/counselor/CounselorClient.jsx (0668681be224267d9671c598e57c9015d5c720a7c0ab3910d9eaffd6e45797cb)
- bm25: -1.3546 | entity_overlap_w: 2.00 | adjusted: -1.8546 | relevance: 1.0000

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ensurePinAllowed } from '@/app/lib/pinGate'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier, resolveEffectiveTier } from '@/app/lib/entitlements'
import { fetchLearnerTranscript } from '@/app/lib/learnerTranscript'
import { validateLessonQuality, buildValidationChangeRequest } from '@/app/lib/lessonValidation'
import ClipboardOverlay from './ClipboardOverlay'
import GoalsClipboardOverlay from './GoalsClipboardOverlay'
import CalendarOverlay from './overlays/CalendarOverlay'
import LessonsOverlay from './overlays/LessonsOverlay'
import LessonMakerOverlay from './overlays/LessonMakerOverlay'
import MentorThoughtBubble from './MentorThoughtBubble'
import SessionTakeoverDialog from './SessionTakeoverDialog'
import MentorInterceptor from './MentorInterceptor'

### 2. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (27ad50647e146778f905e5321709c6ae561586b10876f4876c05a8335ed3f565)
- bm25: -1.3120 | entity_overlap_w: 2.00 | adjusted: -1.8120 | relevance: 1.0000

// Compact calendar view for Mr. Mentor overlay
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import LessonGeneratorOverlay from '@/app/facilitator/calendar/LessonGeneratorOverlay'
import LessonPlanner from '@/app/facilitator/calendar/LessonPlanner'
import LessonEditor from '@/components/LessonEditor'
import LessonNotesModal from '@/app/facilitator/calendar/LessonNotesModal'
import VisualAidsManagerModal from '@/app/facilitator/calendar/VisualAidsManagerModal'
import PortfolioScansModal from '@/app/facilitator/calendar/PortfolioScansModal'
import TypedRemoveConfirmModal from '@/app/facilitator/calendar/TypedRemoveConfirmModal'
import { normalizeLessonKey } from '@/app/lib/lessonKeyNormalization'

export default function CalendarOverlay({ learnerId, learnerGrade, tier, canPlan, accessToken }) {
  const OVERLAY_Z_INDEX = 2147483647

const devStringify = (value) => {
    try {
      if (value instanceof Error) {
        return JSON.stringify({ name: value.name, message: value.message, stack: value.stack })
      }
      return JSON.stringify(value)
    } catch {
      try {
        return String(value)
      } catch {
        return '[unstringifiable]'
      }
    }
  }

const devWarn = (...args) => {
    try {
      if (process.env.NODE_ENV !== 'production') {
        const formatted = (args || []).map((a) => (typeof a === 'string' ? a : devStringify(a)))
        // eslint-disable-next-line no-console
        console.log('[CalendarOverlay]', ...formatted)
      }
    } catch {}
  }

### 3. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (3d1b372ef3bfab2cc2635e4a4a64cc477fd0518066e8d917e7fb0678f150ca81)
- bm25: -1.4724 | relevance: 1.0000

setPlannedLessons((prev) => ({ ...prev, [selectedDate]: next }))
  }

### 4. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (4ddc76e46ed4eab70ed7cbbfd9950566ce33f066219c46bf1e160abad4e4e3af)
- bm25: -1.4543 | relevance: 1.0000

return isMounted ? createPortal(overlay, document.body) : null
  }

### 5. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (d257b2bfcd46588a0b492803388c6fa1e14f61c8d824b988b099d9d31721b40c)
- bm25: -1.4109 | relevance: 1.0000

try {
      const token = await getBearerToken()
      if (!token) throw new Error('Not authenticated')

### 6. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (fbed32e034c935b3a59f2756dc1cdeb7f8ce3dbb7863e0e5ef01a865e585e0a6)
- bm25: -1.4109 | relevance: 1.0000

useEffect(() => {
    if (selectedDate && scheduledLessons[selectedDate]) {
      setScheduledForSelectedDate(scheduledLessons[selectedDate])
    } else {
      setScheduledForSelectedDate([])
    }
  }, [selectedDate, scheduledLessons])

### 7. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (6af35ed8107a810e1691adcd81ff3ab1276e36962b879ebe3e2ad3e96c91032f)
- bm25: -1.3861 | relevance: 1.0000

<div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#374151' }}>
            {formattedSelectedDate || 'Select a date'}
          </div>

### 8. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (2e8e39a66aef17c7cc5c0f04d5cb938be9c171eefd511c688c736f6373659cee)
- bm25: -1.3780 | relevance: 1.0000

const promptUpdate = String(
        (redoPromptDrafts && plannedLesson?.id && redoPromptDrafts[plannedLesson.id] !== undefined)
          ? redoPromptDrafts[plannedLesson.id]
          : (plannedLesson?.promptUpdate || '')
      ).trim()

### 9. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (3c0b33b48ae3596659e9fabb96f2880257ceae9b12fffd87dd45f5ad933c8b4f)
- bm25: -1.3390 | relevance: 1.0000

const formattedSelectedDate = selectedDate
    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    : null

### 10. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (790b13098cdb4300f499f309471c39901fc31080950165b433f8a3b1e3ea8b8c)
- bm25: -1.3315 | relevance: 1.0000

// In this overlay, keep past scheduled lessons visible as history.
        // Completion is still computed (for labeling), but should not hide schedule rows.

### 11. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (281fd0b3b8af91485551b8e57df6b9afdb194e00be007ac2b586b02231436bc3)
- bm25: -1.3240 | relevance: 1.0000

devWarn(`schedule: history response ms=${Date.now() - startedAtMs} status=${String(historyRes?.status)} ok=${String(historyRes?.ok)}`)
          const historyJson = await historyRes.json().catch(() => null)

### 12. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (c4ea059b7e6ec2e6374112a9a2bc210267338b377ebcc8437ee081fc3e4071f2)
- bm25: -1.3166 | relevance: 1.0000

const response = await fetch('/api/facilitator/lessons/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ file, lesson: updatedLesson })
      })

### 13. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (f7a74017f91ff9dd78981c57105ea611c96f2d518ee99adefc29fdd81edadb09)
- bm25: -1.2672 | relevance: 1.0000

const getLocalTodayStr = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

### 14. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (e5fdc46b298a439caa0898d99e9cc93420e88023859c9956645aea444cf67dd7)
- bm25: -1.2605 | relevance: 1.0000

// Get all scheduled lessons for this learner
      let response
      try {
        response = await fetch(`/api/lesson-schedule?learnerId=${targetLearnerId}&includeAll=1`, {
          headers: {
            'authorization': `Bearer ${token}`
          },
          signal: controller.signal
        })
      } finally {
        // scheduleTimeoutId cleared in finally
      }

### 15. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (9368f6d1710315c88e94ce35f134cdda23d752080d2c80ec1901fb2cc5a1b05c)
- bm25: -1.2538 | relevance: 1.0000

const getBearerToken = useCallback(async () => {
    const fallback = tokenFallbackRef.current || ''
    if (fallback) return fallback
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      return session?.access_token || tokenFallbackRef.current || ''
    } catch {
      return tokenFallbackRef.current || ''
    }
  }, [])

### 16. src/app/facilitator/generator/counselor/CounselorClient.jsx (9cdc5ff6b12c83bffa0790f39936509ec027087e3ba44aec2e2a1aa46cb2b064)
- bm25: -0.9869 | entity_overlap_w: 1.00 | adjusted: -1.2369 | relevance: 1.0000

{/* Overlays - always rendered but hidden when not active */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: '#fff',
            zIndex: 5,
            overflow: 'hidden',
            display: activeScreen !== 'mentor' ? 'block' : 'none'
          }}>
            <div style={{ display: activeScreen === 'calendar' ? 'block' : 'none', height: '100%' }}>
              <CalendarOverlay 
                learnerId={selectedLearnerId}
                learnerGrade={learners.find(l => l.id === selectedLearnerId)?.grade}
                accessToken={accessToken}
                tier={tier}
                canPlan={canPlan}
              />
            </div>
            <div style={{ display: activeScreen === 'lessons' ? 'block' : 'none', height: '100%' }}>
              <LessonsOverlay 
                learnerId={selectedLearnerId}
              />
            </div>
            <div style={{ display: activeScreen === 'maker' ? 'block' : 'none', height: '100%' }}>
              <LessonMakerOverlay tier={tier} />
            </div>
          </div>

### 17. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (f01f139a04dcca15e65b707fa5149e2dea022f99962fb92efa5d4f0a5db1ca01)
- bm25: -1.2342 | relevance: 1.0000

const handleNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }
  
  const loadScheduleForLearner = useCallback(async (targetLearnerId, opts = {}) => {
    if (!targetLearnerId || targetLearnerId === 'none') {
      devWarn('schedule: no learner selected', { targetLearnerId })
      setScheduledLessons({})
      scheduleLoadedForLearnerRef.current = null
      scheduleLoadedAtRef.current = 0
      return
    }

### 18. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (cc50fb32aa96990fe09fe663ae17880db5226c4ad936027492e6e463d6a65258)
- bm25: -1.2028 | relevance: 1.0000

const todayStr = getLocalTodayStr()
    const scheduledDates = Object.keys(scheduledLessons || {}).filter((d) => (scheduledLessons?.[d]?.length || 0) > 0)
    const plannedDates = Object.keys(plannedLessons || {}).filter((d) => (plannedLessons?.[d]?.length || 0) > 0)
    const tabDates = (listTab === 'planned' ? plannedDates : scheduledDates)
    const anyDates = Array.from(new Set([...(scheduledDates || []), ...(plannedDates || [])]))

### 19. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (a4a99aa029dd97fb994cebf6e9ccd9ea3cf1d90af17893eeca90de6dbcdef176)
- bm25: -1.1967 | relevance: 1.0000

if (!findResponse.ok) throw new Error('Failed to find schedule entry')
      
      const findResult = await findResponse.json()
      const schedules = findResult.schedule || []
      const scheduleItem = schedules.find(s => s.lesson_key === lessonKey && s.scheduled_date === oldDate)
      
      if (!scheduleItem) throw new Error('Schedule entry not found')

### 20. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (49f6e1e8ce154f51a1db9f8606bdb9e7ffc33824924a616815fec16203e487e0)
- bm25: -1.1907 | relevance: 1.0000

<div style={{ flex: 1, overflowY: 'auto' }}>
            <LessonPlanner
              learnerId={learnerId}
              learnerGrade={learnerGrade}
              tier={tier}
              canPlan={canPlan}
              selectedDate={selectedDate}
              plannedLessons={plannedLessons}
              initialPlanStartDate={plannerInit?.startDate || undefined}
              initialPlanDuration={plannerInit?.durationMonths || undefined}
              autoGeneratePlan={!!plannerInit?.autoGenerate}
              onPlannedLessonsChange={savePlannedLessons}
              onLessonGenerated={async () => {
                setScheduledLessons({})
                scheduleLoadedForLearnerRef.current = null
                await loadSchedule()
              }}
            />
          </div>
        </div>
      </div>
    )

### 21. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (e610884dd2034313e1cd2874b6258f7e350b760e320a28f981adc1b81a628dc1)
- bm25: -1.1729 | relevance: 1.0000

// If generator overlay is open, show it
  if (showGenerator) {
    const overlay = (
      <LessonGeneratorOverlay
        learnerId={learnerId}
        learnerGrade={learnerGrade}
        tier={tier}
        scheduledDate={selectedDate}
        prefilledData={generatorData}
        onClose={() => setShowGenerator(false)}
        onGenerated={async () => {
          setShowGenerator(false)
          // Ensure scheduled markers refresh
          setScheduledLessons({})
          scheduleLoadedForLearnerRef.current = null
          await loadSchedule()
        }}
      />
    )

return isMounted ? createPortal(overlay, document.body) : null
  }

### 22. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (3c8f9b39a389451cce4366741f5ae096b937fe7b09e69c0110030840f31cb783)
- bm25: -1.1671 | relevance: 1.0000

const force = !!opts?.force
    if (plannedLoadInFlightRef.current) {
      const inFlightLearner = plannedInFlightLearnerRef.current
      if (inFlightLearner && inFlightLearner !== targetLearnerId) {
        abortInFlightLoad(plannedAbortRef, plannedInFlightLearnerRef, 'planned')
      } else {
        devWarn('planned: in-flight, skipping', { inFlightLearner })
        return
      }
    }
    if (!force
      && plannedLoadedForLearnerRef.current === targetLearnerId
      && (Date.now() - (plannedLoadedAtRef.current || 0)) < MIN_REFRESH_INTERVAL_MS
    ) {
      devWarn('planned: throttled, skipping', { targetLearnerId })
      return
    }

### 23. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (1a0fdbb16a2db4d7ecb228c12336a363a34bb13e66ed33f12f8f0ea4dc9e2113)
- bm25: -1.1501 | relevance: 1.0000

if (requestId >= (scheduleLastAppliedRequestIdRef.current || 0)) {
          scheduleLastAppliedRequestIdRef.current = requestId
          setScheduledLessons((prev) => {
            const base = (prev && typeof prev === 'object') ? prev : {}
            const next = { ...base }
            for (const [k, v] of Object.entries(immediate || {})) {
              next[k] = v
            }
            return next
          })
          devWarn(`schedule: immediate loaded dates=${Object.keys(immediate || {}).length}`)
        } else {
          devWarn('schedule: older immediate result ignored')
        }
      } catch {}

### 24. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (415149cffdc25bcd8313e51a5a80e977238a33fed1a5063cbeca9490b93cf36a)
- bm25: -1.0968 | relevance: 1.0000

window.addEventListener('mr-mentor:open-lesson-planner', handleOpenPlanner)
    return () => {
      window.removeEventListener('preload-overlays', handlePreload)
      window.removeEventListener('mr-mentor:lesson-scheduled', handleLessonScheduled)
      window.removeEventListener('mr-mentor:open-lesson-planner', handleOpenPlanner)
    }
  }, [learnerId, loadCalendarData, loadSchedule])
  
  useEffect(() => {
    if (learnerId && learnerId !== 'none') {
      loadCalendarData({ force: true })
      
      // Poll for updates every 2 minutes
      const pollInterval = setInterval(() => {
        loadCalendarData({ force: true })
      }, 2 * 60 * 1000)
      
      return () => clearInterval(pollInterval)
    }
  }, [learnerId, loadCalendarData])

### 25. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (70d0d1bcde3f90f927d0565435d0d0439122bc996c034f27f9aeb62c5be4d76e)
- bm25: -1.0817 | relevance: 1.0000

const current = Array.isArray(plannedLessons[selectedDate]) ? plannedLessons[selectedDate] : []
                            const next = current.map((l) => (l.id === lesson.id ? { ...l, promptUpdate: value } : l))
                            const ok = await persistPlannedForDate(selectedDate, next)
                            if (!ok) return
                            setPlannedLessons((prev) => ({ ...prev, [selectedDate]: next }))
                          }}
                          placeholder="Example: Different topic; focus on map skills."
                          rows={2}
                          style={{
                            width: '100%',
                            resize: 'vertical',
                            fontSize: 11,
                            padding: 6,
                            border: '1px solid #e5e7eb',
                            borderRadius: 6
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

### 26. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (257587ad84cfe42adfe78b6c754df594700baf34b532e8cd1693a20426d6b29b)
- bm25: -1.0671 | relevance: 1.0000

<div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#1e40af', marginBottom: 4 }}>
                          Redo prompt update (optional)
                        </div>
                        <textarea
                          value={
                            redoPromptDrafts[lesson.id] !== undefined
                              ? redoPromptDrafts[lesson.id]
                              : (lesson.promptUpdate || '')
                          }
                          onChange={(e) => {
                            const value = e.target.value
                            setRedoPromptDrafts((prev) => ({ ...prev, [lesson.id]: value }))
                          }}
                          onBlur={async () => {
                            if (!selectedDate) return
                            const value = String(
                              redoPromptDrafts[lesson.id] !== undefined
                                ? redoPromptDrafts[lesson.id]
                                : (lesson.promptUpdate || '')
                            )
                            if (String(lesson.promptUpdate || '') === value) return

### 27. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (aa1ced3352a95a6984afe2eba3f35837139291c3921b98d4dd063918f9925844)
- bm25: -1.0671 | relevance: 1.0000

<LessonNotesModal
        open={!!notesLesson}
        onClose={() => setNotesLesson(null)}
        learnerId={learnerId}
        lessonKey={notesLesson?.lessonKey}
        lessonTitle={notesLesson?.lessonTitle || 'Lesson Notes'}
        portal
        zIndex={OVERLAY_Z_INDEX}
      />

<VisualAidsManagerModal
        open={!!visualAidsLesson}
        onClose={() => setVisualAidsLesson(null)}
        learnerId={learnerId}
        lessonKey={visualAidsLesson?.lessonKey}
        lessonTitle={visualAidsLesson?.lessonTitle || 'Visual Aids'}
        authToken={authToken}
        portal
        zIndex={OVERLAY_Z_INDEX}
      />

<PortfolioScansModal
        open={!!portfolioScansLesson}
        onClose={() => setPortfolioScansLesson(null)}
        learnerId={learnerId}
        lessonKey={portfolioScansLesson?.lessonKey}
        lessonTitle={portfolioScansLesson?.lessonTitle || 'Lesson'}
        authToken={authToken}
        portal
        zIndex={OVERLAY_Z_INDEX}
      />

### 28. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (51fc5055cb5f6febd4556dcb3d780c61c971154218d000b0865dc9ef511fe9f5)
- bm25: -1.0575 | relevance: 1.0000

<button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Previous month"
            title="Previous month"
            style={{
              padding: '4px 8px',
              fontSize: 14,
              fontWeight: 900,
              borderRadius: 6,
              background: '#fff',
              border: '1px solid #d1d5db',
              cursor: 'pointer',
              lineHeight: 1
            }}
          >
            {'<'}
          </button>

<button
            type="button"
            onClick={handleNextMonth}
            aria-label="Next month"
            title="Next month"
            style={{
              padding: '4px 8px',
              fontSize: 14,
              fontWeight: 900,
              borderRadius: 6,
              background: '#fff',
              border: '1px solid #d1d5db',
              cursor: 'pointer',
              lineHeight: 1
            }}
          >
            {'>'}
          </button>
        </div>
      </div>

### 29. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (7635b7d8f84acb85958cb425f490d97db227e741e72b16bac69ca4a5c58e0e53)
- bm25: -1.0481 | relevance: 1.0000

<div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowPlannerOverlay(true)}
                    disabled={!learnerId || learnerId === 'none'}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 12,
                      fontWeight: 800,
                      borderRadius: 8,
                      border: '1px solid #d1d5db',
                      background: (!learnerId || learnerId === 'none') ? '#f3f4f6' : '#111827',
                      color: (!learnerId || learnerId === 'none') ? '#9ca3af' : '#fff',
                      cursor: (!learnerId || learnerId === 'none') ? 'not-allowed' : 'pointer'
                    }}
                    title={(!learnerId || learnerId === 'none') ? 'Select a learner first' : 'Open the full Lesson Planner'}
                  >
                    Create a Lesson Plan
                  </button>
                </div>
              </>
            )
          )}
        </div>
        </>
      </div>

### 30. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (7fd02cc4a845613738b559f4bc2afd15e862070bd19891a05e2bf03314289519)
- bm25: -1.0435 | relevance: 1.0000

const scheduleLoadedForLearnerRef = useRef(null)
  const plannedLoadedForLearnerRef = useRef(null)
  const scheduleLoadedAtRef = useRef(0)
  const plannedLoadedAtRef = useRef(0)
  const scheduleLoadInFlightRef = useRef(false)
  const plannedLoadInFlightRef = useRef(false)
  const scheduleInFlightLearnerRef = useRef(null)
  const plannedInFlightLearnerRef = useRef(null)
  const scheduleAbortRef = useRef(null)
  const plannedAbortRef = useRef(null)
  const scheduleRequestIdRef = useRef(0)
  const plannedRequestIdRef = useRef(0)
  const scheduleLastAppliedRequestIdRef = useRef(0)
  const plannedLastAppliedRequestIdRef = useRef(0)
  const autoSelectedDateRef = useRef(false)
  const userSelectedTabRef = useRef(false)
  const MIN_REFRESH_INTERVAL_MS = 15 * 1000

### 31. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (a691d3886062b90c90a5904b9af0bcd4421842223bc19fe52f0842a0633ba8a6)
- bm25: -1.0389 | relevance: 1.0000

// Build a context string so Redo doesn't loop the same topics.
      let contextText = ''

const LOW_SCORE_REVIEW_THRESHOLD = 70
      const HIGH_SCORE_AVOID_REPEAT_THRESHOLD = 85

const lowScoreNames = new Set()
      const highScoreNames = new Set()

const [historyRes, medalsRes] = await Promise.all([
        fetch(`/api/learner/lesson-history?learner_id=${learnerId}`, {
          headers: { 'authorization': `Bearer ${token}` }
        }),
        fetch(`/api/medals?learnerId=${learnerId}`, {
          headers: { 'authorization': `Bearer ${token}` }
        })
      ])

let medals = {}
      if (medalsRes.ok) {
        medals = (await medalsRes.json().catch(() => ({}))) || {}
      }

### 32. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (5ec3f00860de3f17db7f0ee3a4c340edc7e46dbb3e9a08c96f50e7a6c33b2c98)
- bm25: -0.9787 | relevance: 1.0000

<div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  const dateInput = document.getElementById('reschedule-date-overlay')
                  const lesson = scheduledForSelectedDate.find(item => item.id === rescheduling)
                  if (dateInput?.value && lesson) {
                    handleRescheduleLesson(lesson.lesson_key, selectedDate, dateInput.value)
                  }
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: 'none',
                  borderRadius: 6,
                  background: '#2563eb',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Reschedule
              </button>
              <button
                onClick={() => setRescheduling(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: '#fff',
                  color: '#374151',
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

### 33. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (1e845d90f680be3e1104ba97bce7283a9e029144ac09e29c70a6ad3eae27755a)
- bm25: -0.9707 | relevance: 1.0000

contextText += '\n\n=== REDO RULES: SAME AS PLANNER GENERATION ==='
      contextText += '\nYou are regenerating a planned lesson outline.'
      contextText += `\nPrefer NEW topics most of the time, but you MAY plan a rephrased Review for low scores (<= ${LOW_SCORE_REVIEW_THRESHOLD}%).`
      contextText += `\nAvoid repeating high-score topics (>= ${HIGH_SCORE_AVOID_REPEAT_THRESHOLD}%) unless the facilitator explicitly requests it.`
      contextText += "\nIf you choose a Review lesson, the title MUST start with 'Review:' and it must use different examples."
      contextText += '\nDo NOT produce an exact duplicate of any scheduled/planned lesson above.'

### 34. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (fa30e249c421d6955cd0613b8c96162e9596ba3c085bd1a7f9d83136f4faa4d6)
- bm25: -0.9324 | relevance: 1.0000

<div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowPlannerOverlay(true)}
                    disabled={!learnerId || learnerId === 'none'}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 12,
                      fontWeight: 800,
                      borderRadius: 8,
                      border: '1px solid #d1d5db',
                      background: (!learnerId || learnerId === 'none') ? '#f3f4f6' : '#111827',
                      color: (!learnerId || learnerId === 'none') ? '#9ca3af' : '#fff',
                      cursor: (!learnerId || learnerId === 'none') ? 'not-allowed' : 'pointer'
                    }}
                    title={(!learnerId || learnerId === 'none') ? 'Select a learner first' : 'Open the full Lesson Planner'}
                  >
                    Create a Lesson Plan
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
                  {(!learnerId || learnerId === 'none')
                    ? 'Select a learner to view planned lessons'
                    : (selectedDate ? 'No planned lessons' : 'Select a date to view planned lessons')}
                </div>

### 35. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (1c48aa8e329dd38ecc3c0eadc6aaf38e9d878639ffa5edadce1ce48445f621db)
- bm25: -0.9108 | relevance: 1.0000

{listTab === 'scheduled' ? (
            scheduledForSelectedDate.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {scheduledForSelectedDate.map((lesson, idx) => (
                  <div key={lesson.id || idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: 6,
                    background: '#fff',
                    borderRadius: 6,
                    border: '1px solid #e5e7eb',
                    fontSize: 11
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#1f2937' }}>{lesson.lesson_title}</div>
                      <div style={{ color: '#6b7280', fontSize: 10 }}>
                        {lesson.subject} • {lesson.grade}
                      </div>
                    </div>
                    {selectedDate && selectedDate < getLocalTodayStr() ? (
                      <>
                        <button
                          onClick={() => setNotesLesson({ lessonKey: lesson.lesson_key, lessonTitle: lesson.lesson_title })}
                          style={{
                            padding: '2px 6px',
                            fontSize: 10,
                            fontWeight: 600,
                            borderRadius: 4,
                            border: 'none',
                            cursor: 'pointer',
                            background: '#f3f4f6',
                            color: '#111827'
                          }}
                        >
                          Notes
                        </button>
                        <button
                          onClick={() => setVisualAids

### 36. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (814d0b720fc99a578a0dd0aaf9705fee335d0a7baafd34f086e843aa4725f5ea)
- bm25: -0.8771 | relevance: 1.0000

if (historyRes.ok) {
        const history = await historyRes.json()
        const sessions = Array.isArray(history?.sessions) ? history.sessions : []
        if (sessions.length > 0) {
          contextText += '\n\nLearner lesson history (scores guide Review vs new topics):\n'
          sessions
            .slice()
            .sort((a, b) => new Date(a.started_at || a.ended_at || 0) - new Date(b.started_at || b.ended_at || 0))
            .slice(-60)
            .forEach((s) => {
              const status = s.status || 'unknown'
              const name = s.lesson_id || 'unknown'
              const bestPercent = status === 'completed' ? medals?.[name]?.bestPercent : null
              if (status === 'completed' && Number.isFinite(bestPercent)) {
                if (bestPercent <= LOW_SCORE_REVIEW_THRESHOLD) lowScoreNames.add(name)
                if (bestPercent >= HIGH_SCORE_AVOID_REPEAT_THRESHOLD) highScoreNames.add(name)
                contextText += `- ${name} (${status}, score: ${bestPercent}%)\n`
              } else {
                contextText += `- ${name} (${status})\n`
              }
            })
        }
      }

### 37. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (c8580cf23f4842233cf46c318ff3c9b8c097a32e5eb2ddceb81c1a593df511c6)
- bm25: -0.8738 | relevance: 1.0000

const js = await response.json().catch(() => null)
      if (!response.ok) throw new Error(js?.error || 'Failed to save lesson')

alert('Lesson updated successfully!')
      setEditingLesson(null)
      setLessonEditorData(null)
    } catch (err) {
      alert('Failed to save lesson changes')
    } finally {
      setLessonEditorSaving(false)
    }
  }

// Listen for preload event to trigger initial load
  useEffect(() => {
    const handlePreload = () => {
      if (learnerId && learnerId !== 'none') {
        loadCalendarData({ force: true })
      }
    }
    
    const handleLessonScheduled = () => {
      // Clear cache and reload
      setScheduledLessons({})
      scheduleLoadedForLearnerRef.current = null
      scheduleLoadedAtRef.current = 0
      loadSchedule({ force: true })
    }
    
    window.addEventListener('preload-overlays', handlePreload)
    window.addEventListener('mr-mentor:lesson-scheduled', handleLessonScheduled)

const handleOpenPlanner = (evt) => {
      const detail = evt?.detail || {}
      const targetLearnerId = detail?.learnerId
      if (targetLearnerId && learnerId && targetLearnerId !== learnerId) return

setPlannerInit({
        startDate: detail?.startDate || null,
        durationMonths: detail?.durationMonths || null,
        autoGenerate: !!detail?.autoGenerate
      })
      setShowPlannerOverlay(true)
    }

### 38. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (0d6620436be9c21a92a053e70599b74b0d6a7fcd5ef520a3ad30acaa33e12bee)
- bm25: -0.8611 | relevance: 1.0000

const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [scheduledLessons, setScheduledLessons] = useState({})
  const [scheduledForSelectedDate, setScheduledForSelectedDate] = useState([])
  const [plannedLessons, setPlannedLessons] = useState({})
  const [plannedForSelectedDate, setPlannedForSelectedDate] = useState([])
  const [tableExists, setTableExists] = useState(true)
  const [rescheduling, setRescheduling] = useState(null) // Track which lesson is being rescheduled
  const [listTab, setListTab] = useState('scheduled') // 'scheduled' | 'planned'

const [showGenerator, setShowGenerator] = useState(false)
  const [generatorData, setGeneratorData] = useState(null)
  const [redoingLesson, setRedoingLesson] = useState(null)
  const [redoPromptDrafts, setRedoPromptDrafts] = useState({})

const [showPlannerOverlay, setShowPlannerOverlay] = useState(false)
  const [plannerInit, setPlannerInit] = useState(null)

const [notesLesson, setNotesLesson] = useState(null)
  const [visualAidsLesson, setVisualAidsLesson] = useState(null)
  const [portfolioScansLesson, setPortfolioScansLesson] = useState(null)
  const [removeConfirmLesson, setRemoveConfirmLesson] = useState(null)

const [editingLesson, setEditingLesson] = useState(null)
  const [lessonEditorLoading, setLessonEditorLoading] = useState(false)
  const [lessonEditorSaving, setLessonEditorSaving] = useState(false)
  const [lessonEditorData, setLessonEditorData] = useState(null)

### 39. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (684e5fa7c7303fbdfbcfae9a1ca16eb1fac0d2179881d3bf469ee98ee5346d78)
- bm25: -0.8518 | relevance: 1.0000

const force = !!opts?.force
    if (scheduleLoadInFlightRef.current) {
      const inFlightLearner = scheduleInFlightLearnerRef.current
      if (inFlightLearner && inFlightLearner !== targetLearnerId) {
        abortInFlightLoad(scheduleAbortRef, scheduleInFlightLearnerRef, 'schedule')
      } else {
        devWarn('schedule: in-flight, skipping', { inFlightLearner })
        return
      }
    }
    if (!force
      && scheduleLoadedForLearnerRef.current === targetLearnerId
      && (Date.now() - (scheduleLoadedAtRef.current || 0)) < MIN_REFRESH_INTERVAL_MS
    ) {
      devWarn('schedule: throttled, skipping', { targetLearnerId })
      return
    }

devWarn(`schedule: start learner=${targetLearnerId} force=${String(force)} hasTokenFallback=${String(Boolean(tokenFallbackRef.current))}`)

const controller = new AbortController()
    scheduleAbortRef.current = controller
    scheduleInFlightLearnerRef.current = targetLearnerId
    scheduleLoadInFlightRef.current = true
    const requestId = ++scheduleRequestIdRef.current
    const startedAtMs = Date.now()
    const scheduleTimeoutId = setTimeout(() => {
      try { controller.abort() } catch {}
    }, 45000)
    
    try {
      const token = await getBearerToken()
      devWarn(`schedule: got token ms=${Date.now() - startedAtMs} hasToken=${String(Boolean(token))}`)

if (token) {
        setAuthToken((prev) => (prev === token ? prev : token))
      }

if (!token) {
        devWarn('schedule: missing auth token')
        return
      }

### 40. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (bd83046669078108532e54a3b09b0a35da3e1ced52ad144922ab25506e02e8bd)
- bm25: -0.8518 | relevance: 1.0000

const result = await response.json()
      const nextPlanned = result.plannedLessons || {}
      if (requestId >= (plannedLastAppliedRequestIdRef.current || 0)) {
        plannedLastAppliedRequestIdRef.current = requestId
        setPlannedLessons(nextPlanned)
        const dateKeys = Object.keys(nextPlanned || {})
        const totalLessons = dateKeys.reduce((sum, k) => sum + (Array.isArray(nextPlanned?.[k]) ? nextPlanned[k].length : 0), 0)
        devWarn(`planned: loaded dates=${dateKeys.length} lessons=${totalLessons}`)
        plannedLoadedForLearnerRef.current = targetLearnerId
        plannedLoadedAtRef.current = Date.now()
      } else {
        devWarn('planned: older result ignored')
      }
    } catch (err) {
      if (String(err?.name || '') === 'AbortError') {
        devWarn('planned: timeout/abort', err)
        // Do not clear state on timeout; a newer request may have succeeded.
      } else {
        const msg = 'planned: unexpected error'
        devWarn(msg, err)
        if (requestId === plannedRequestIdRef.current) {
          setPlannedLessons({})
        }
      }
    } finally {
      clearTimeout(plannedTimeoutId)
      if (plannedAbortRef.current === controller) {
        plannedAbortRef.current = null
        plannedInFlightLearnerRef.current = null
        plannedLoadInFlightRef.current = false
      }
      devWarn(`planned: done ms=${Date.now() - startedAtMs}`)
    }
  }, [])
