# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Lessons overlay stuck on 'Loading Lessons'. Find where Loading Lessons is rendered in LessonsOverlay and what controls the loading flag; identify why loadLessons might not run.
```

Filter terms used:
```text
LessonsOverlay
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

LessonsOverlay

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack_api_mentor_session.md (4855132618822a362a64f503352c2317423f958b837508d272e5034660ab6c18)
- bm25: -4.2644 | entity_overlap_w: 2.00 | adjusted: -4.7644 | relevance: 1.0000

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

### 2. sidekick_pack_api_mentor_session.md (73c4298bc7de9a58755bf4aff6cbce4f6e03440873ec094745b515d30da4d5de)
- bm25: -4.2644 | entity_overlap_w: 2.00 | adjusted: -4.7644 | relevance: 1.0000

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

### 3. src/app/facilitator/generator/counselor/CounselorClient.jsx (f7ffbd62ec5c154f73c9ce61ebbd9f78b22c0627dce67964d62da5b98c71ac0e)
- bm25: -4.2287 | entity_overlap_w: 2.00 | adjusted: -4.7287 | relevance: 1.0000

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

### 4. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (4f3b2e6cf21c5d25515f4f0d251347e0effba8088f650add2e60b16ab20e3266)
- bm25: -4.6273 | relevance: 1.0000

const filteredLessons = getFilteredLessons()

### 5. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (4bb7c174d2a56bc8cad7a7e8f8605c9311387e31ab0d5826615aae119e48b891)
- bm25: -4.4114 | relevance: 1.0000

const { normalized: approvedMap, changed: approvedChanged } = normalizeApprovedLessonKeys(approvedData?.approved_lessons)
      setApprovedLessons(approvedMap)

### 6. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (6437fb78ee3ba9bf330f86eff1e10946fb76f9b7c03e50f7e7c03a5e5ed6f480)
- bm25: -4.3108 | relevance: 1.0000

for (const lesson of sortedGeneratedList) {
              const subject = lesson.subject || 'math'
              const generatedLesson = {
                ...lesson,
                isGenerated: true
              }

### 7. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (a038f11fda0fb6193e8fc67ac61ce6a38ece6ed632ac3be600a4c97f09f48b03)
- bm25: -4.1914 | relevance: 1.0000

// Load learner data when learner changes
  useEffect(() => {
    if (learnerId && learnerId !== 'none') {
      loadLearnerData()
    } else {
      setApprovedLessons({})
      setLessonNotes({})
      setScheduledLessons({})
      setFutureScheduledLessons({})
      setMedals({})
    }
  }, [learnerId, loadLearnerData])

### 8. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (f03bd3a08dc5af3f3bd99cd08c65ee9b707741e6d77049f7c4c7a2c53cea39e2)
- bm25: -4.1005 | relevance: 1.0000

const isLearnerScoped = Boolean(learnerId && learnerId !== 'none')
  const subjectOptions = useMemo(
    () => subjectNames.filter((s) => String(s).toLowerCase() !== 'generated'), // Don't show 'generated' in this dropdown
    [subjectNames]
  )

### 9. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (e7bc7ef7311774434d7a7501d25a6a58e5d609d61a3ae995ce3006ffa5f8505f)
- bm25: -4.0349 | relevance: 1.0000

const handleUploadImage = async (file) => {
    try {
      const reader = new FileReader()
      const dataURL = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

### 10. sidekick_pack_takeover.md (6ab7b739334afeaea082c2424ed18760868b0056056cb4146b9f1cb05cd5b365)
- bm25: -3.5201 | entity_overlap_w: 2.00 | adjusted: -4.0201 | relevance: 1.0000

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

### 15. src/app/api/learner/lesson-history/route.js (9157c225ea6bb007ac2531e96a366b9e76432a349cd594c07c251457ecf6abf4)
- bm25: -6.6673 | entity_overlap_w: 1.00 | adjusted: -6.9173 | relevance: 1.0000

const eventsBySession = new Map()
    for (const event of events) {
      const sessionId = event?.session_id
      if (!sessionId) continue
      if (!eventsBySession.has(sessionId)) {
        eventsBySession.set(sessionId, [])
      }
      eventsBySession.get(sessionId).push(event)
    }

const nowMs = Date.now()
    const staleMillis = STALE_MINUTES * 60 * 1000

for (const session of sessions) {
      if (!session?.id || session?.ended_at) continue

### 11. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (85b6837f00aa19a3ed73a721342683556ddc064504c4f87635d87ab4d500d5b4)
- bm25: -3.6299 | entity_overlap_w: 1.00 | adjusted: -3.8799 | relevance: 1.0000

if (!results[subject]) results[subject] = []
              results[subject].unshift(generatedLesson)
              results['generated'].push(generatedLesson)
            }
          }
        } catch (err) {
          // Silent error handling
        }
      }

setAllLessons(results)
      hasPrefetchedLessonsRef.current = true
      setLoadError(false)
      setRetryCount(0)
    } catch (err) {
      console.error('[LessonsOverlay] Failed to load lessons:', err)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [coreSubjects])

// Auto-retry on error with exponential backoff
  useEffect(() => {
    if (loadError && retryCount < 3) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000) // 1s, 2s, 4s max
      const timer = setTimeout(() => {
        setRetryCount(prev => prev + 1)
        loadLessons(true)
      }, delay)
      return () => clearTimeout(timer)
    }
  }, [loadError, retryCount, loadLessons])

const loadLearnerData = useCallback(async () => {
    if (!learnerId || learnerId === 'none') {
      setApprovedLessons({})
      setLessonNotes({})
      setScheduledLessons({})
      setFutureScheduledLessons({})
      setMedals({})
      return
    }
    
    setLearnerDataLoading(true)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

// Load approved lessons, notes, and grade
      const { data: approvedData } = await supabase
        .from('learners')
        .select('approved_lessons, lesson_notes, grade')
        .eq('id', learnerId)
        .maybeSingle()

### 12. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (645171b22d996f37933dca3f49c49279b4afe9e545b146606f821b3f14c62bad)
- bm25: -3.8697 | relevance: 1.0000

{/* Visual Aids Carousel */}
      {showVisualAidsCarousel && editingLesson && lessonEditorData && (
        <VisualAidsCarousel
          images={visualAidsImages}
          onClose={() => setShowVisualAidsCarousel(false)}
          onSave={handleSaveVisualAids}
          onGenerateMore={handleGenerateMore}
          onUploadImage={handleUploadImage}
          onRewriteDescription={handleRewriteDescription}
          generating={generatingVisualAids}
          teachingNotes={lessonEditorData?.teachingNotes || ''}
          lessonTitle={lessonEditorData?.title || ''}
          generationProgress={generationProgress}
          generationCount={generationCount}
          maxGenerations={MAX_GENERATIONS}
        />
      )}

### 13. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (96160adb6e8cb2a59a8ccc3ab2896dc9437bc82c7c94b6080ae94db6acbd5b5a)
- bm25: -3.5954 | entity_overlap_w: 1.00 | adjusted: -3.8454 | relevance: 1.0000

export default function LessonsOverlay({ learnerId }) {
  const router = useRouter()
  const { coreSubjects, subjectNames } = useFacilitatorSubjects({ includeGenerated: true })
  const [allLessons, setAllLessons] = useState({})
  const hasPrefetchedLessonsRef = useRef(false)
  const [approvedLessons, setApprovedLessons] = useState({})
  const [lessonNotes, setLessonNotes] = useState({})
  const [scheduledLessons, setScheduledLessons] = useState({})
  const [futureScheduledLessons, setFutureScheduledLessons] = useState({})
  const [medals, setMedals] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('all')
  const [selectedGrade, setSelectedGrade] = useState('all')
  const [editingNote, setEditingNote] = useState(null)
  const [editingLesson, setEditingLesson] = useState(null) // Track which lesson is being edited
  const [lessonEditorData, setLessonEditorData] = useState(null) // Hold lesson data for editing
  const [lessonEditorLoading, setLessonEditorLoading] = useState(false)
  const [lessonEditorSaving, setLessonEditorSaving] = useState(false)
  const [schedulingLesson, setSchedulingLesson] = useState(null)
  const [learnerDataLoading, setLearnerDataLoading] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  
  // Visual aids state
  const [showVisualAidsCarousel, setShowVisualAidsCarousel] = useState(false)
  const [visualAidsImages, setVisualAidsImages] = useState([])
  const [generatingVisualAids, setGeneratingVisualAids] = useState(false)
  const [generationProgress, setGenerationProgress] = useState('')
  const [generationCount, setGenerationCount] = useState(0)

### 14. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (7f4590ea98293edc1e4e4aacd21a59c17bdf9a0d487c11727a28dd22e0cd485e)
- bm25: -3.7921 | relevance: 1.0000

<button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSchedulingLesson(isSchedulingThis ? null : lessonKey)
                      }}
                      style={{
                        padding: '3px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        background: '#fff',
                        color: '#6b7280',
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                      title="Schedule lesson"
                    >
                      📅 Calendar
                    </button>
                  </div>

### 15. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (36ef3fe15498d097fd45b3839493f03a2d43aedfbabb197f0ef571c740d6bf07)
- bm25: -3.7545 | relevance: 1.0000

const handleSaveVisualAids = async (selectedImages) => {
    const updatedImages = visualAidsImages.map(img => {
      const isSelected = selectedImages.some(sel => sel.id === img.id)
      return {
        ...img,
        selected: isSelected,
        description: selectedImages.find(sel => sel.id === img.id)?.description || img.description
      }
    })
    
    setVisualAidsImages(updatedImages)
    setShowVisualAidsCarousel(false)
    
    await saveVisualAidsData(updatedImages, generationCount)
  }

### 16. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (b82360a69b78854594e5217eb5c6015c1a6763e0715c389c07f66e027e4bba91)
- bm25: -3.7545 | relevance: 1.0000

const data = await res.json()
      const rewritten = data.rewritten
      
      if (rewritten) {
        setLessonEditorData(prev => {
          const newVocab = [...(prev.vocab || [])]
          if (newVocab[index]) {
            newVocab[index] = { ...newVocab[index], definition: rewritten }
          }
          return { ...prev, vocab: newVocab }
        })
      }
    } catch (err) {
      // Silent error handling
    } finally {
      setRewritingVocabDefinition(prev => ({ ...prev, [index]: false }))
    }
  }

### 17. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (c46646042c57e8d058317b26d1028bcef414706b45bbd889435b6978aefdeeb9)
- bm25: -3.6111 | relevance: 1.0000

try {
      const supabase = getSupabaseClient()
      if (!supabase) throw new Error('Not authenticated')
      const { error } = await supabase.from('learners').update({ approved_lessons: next }).eq('id', learnerId)
      if (error) throw error
    } catch (err) {
      // Silent error handling
      alert('Failed to update lesson availability. Please try again.')
      setApprovedLessons(previous)
    } finally {
      setSaving(false)
    }
  }, [approvedLessons, learnerId])

### 18. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (8c61ce0432b28db014ae2c98ba330f121e2127c1450ab5a5760629eabdb68a85)
- bm25: -3.3548 | relevance: 1.0000

// Visual aids handlers
  const loadVisualAidsForLesson = async (lessonKey) => {
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const res = await fetch(`/api/visual-aids/load?lessonKey=${encodeURIComponent(lessonKey)}`, {
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      })
      
      if (!res.ok) {
        // Failed to load visual aids
        return
      }
      
      const visualAidsData = await res.json()
      setVisualAidsImages(visualAidsData.generatedImages || [])
      setGenerationCount(visualAidsData.generationCount || 0)
    } catch (err) {
      // Silent error handling
    }
  }

### 19. src/app/facilitator/generator/counselor/CounselorClient.jsx (a9ee07d528dacf17a5a5988ecdd3025bc4f515644b1b5739ccf24e5ffdfcd85e)
- bm25: -3.0940 | entity_overlap_w: 1.00 | adjusted: -3.3440 | relevance: 1.0000

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

### 20. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (65d0a3a2ac9017874c91545a9a53a264a93f17c8e553237a422d1a21ff2c89ca)
- bm25: -3.2678 | relevance: 1.0000

const saveNote = async (lessonKey, noteText) => {
    if (!learnerId || learnerId === 'none') return
    
    const newNotes = { ...lessonNotes }
    if (noteText && noteText.trim()) {
      newNotes[lessonKey] = noteText.trim()
    } else {
      delete newNotes[lessonKey]
    }
    
    setLessonNotes(newNotes)
    setEditingNote(null)
    setSaving(true)
    
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.from('learners').update({ lesson_notes: newNotes }).eq('id', learnerId)
      if (error) throw error
      // Note saved successfully
    } catch (e) {
      // Silent error handling
      alert('Failed to save note')
      setLessonNotes(lessonNotes) // Revert
    } finally {
      setSaving(false)
    }
  }

### 21. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (6878c02f0897ef2e67ed757061b1ff18c0a36fcfd60fafea6000b47d415c695e)
- bm25: -3.2398 | relevance: 1.0000

const data = await res.json()
        
        if (data.images && data.images.length > 0) {
          newImages.push(...data.images)
          setVisualAidsImages(prev => [...prev, ...data.images])
        }
      }
      
      const newCount = generationCount + 1
      setGenerationCount(newCount)
      setGenerationProgress('Complete!')
      setTimeout(() => setGenerationProgress(''), 1000)
      
      // Don't save yet - wait for user to select and save from carousel
      // const allImages = [...visualAidsImages, ...newImages]
      // await saveVisualAidsData(allImages, newCount)
      
      if (newImages.length > 0) {
        setShowVisualAidsCarousel(true)
      }
    } catch (err) {
      setVisualAidsError(err.message || 'Failed to generate visual aids')
      setGenerationProgress('')
    } finally {
      setGeneratingVisualAids(false)
    }
  }

### 22. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (d3f77b0ae0c3731c06cb7958a5697877f49ed53d0668bb71a3279fef427a2ab3)
- bm25: -3.2260 | relevance: 1.0000

<LessonHistoryModal
        open={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        sessions={lessonHistorySessions}
        events={lessonHistoryEvents}
        medals={medals}
        loading={lessonHistoryLoading}
        error={lessonHistoryError}
        onRefresh={refreshLessonHistory}
        titleLookup={(lessonId) => lessonTitleLookup[lessonId]}
      />
    </div>
    
    {/* Visual Aids Carousel - rendered outside main container for proper z-index using portal */}
    {showVisualAidsCarousel && editingLesson && lessonEditorData && typeof document !== 'undefined' && createPortal(
      <VisualAidsCarousel
        images={visualAidsImages}
        onClose={() => setShowVisualAidsCarousel(false)}
        onSave={handleSaveVisualAids}
        onGenerateMore={handleGenerateMore}
        onUploadImage={handleUploadImage}
        onRewriteDescription={handleRewriteDescription}
        generating={generatingVisualAids}
        teachingNotes={lessonEditorData?.teachingNotes || ''}
        lessonTitle={lessonEditorData?.title || ''}
        generationProgress={generationProgress}
        generationCount={generationCount}
        maxGenerations={MAX_GENERATIONS}
      />,
      document.body
    )}
    </>
  )
}

### 23. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (63648bba29c4a0e07db4bd04b7992f7e07908f57f85b7a5a2300d41ef5d15c7a)
- bm25: -3.1987 | relevance: 1.0000

// Get future scheduled lessons
          const futureEnd = new Date()
          futureEnd.setFullYear(futureEnd.getFullYear() + 1)
          const allScheduleResponse = await fetch(`/api/lesson-schedule?learnerId=${learnerId}&startDate=${today}&endDate=${futureEnd.toISOString().split('T')[0]}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (allScheduleResponse.ok) {
            const allScheduleData = await allScheduleResponse.json()
            const allScheduledLessons = allScheduleData.schedule || []
            const futureScheduled = {}
            allScheduledLessons.forEach(item => {
              if (item.lesson_key && item.scheduled_date && item.scheduled_date > today) {
                futureScheduled[item.lesson_key] = item.scheduled_date
              }
            })
            setFutureScheduledLessons(futureScheduled)
          }
        }
      } catch (schedErr) {
        // Silent error handling
      }

### 24. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (cec498ef76cfdd85a949a53c79a2aa8ddb985893c53f47cd8bab72cf903e92db)
- bm25: -3.1719 | relevance: 1.0000

<div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => {
                              const dateInput = document.getElementById(`schedule-date-${lessonKey}`)
                              if (dateInput?.value) {
                                scheduleLesson(lessonKey, dateInput.value)
                              }
                            }}
                            disabled={saving}
                            style={{
                              flex: 1,
                              padding: '8px',
                              border: 'none',
                              borderRadius: 6,
                              background: '#2563eb',
                              color: '#fff',
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: saving ? 'wait' : 'pointer'
                            }}
                          >
                            {saving ? 'Scheduling...' : 'Schedule'}
                          </button>
                          <button
                            onClick={() => setSchedulingLesson(null)}
                            disabled={saving}
                            style={{
                              flex: 1,
                              padding: '8px',
                              border: '1px solid #d1d5db',
                              borderRadius: 6,
                              background: '#fff',
                              color: '#374151',
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: saving ? 'wait' : 'pointer'
                            }}
                          >

### 25. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (2a8e744f5dad2fc553530375c53981999972ea8a937b1105b0f61ad682d9e93e)
- bm25: -3.0940 | relevance: 1.0000

{/* Compact action buttons */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        loadLessonForEditing(lessonKey)
                      }}
                      style={{
                        padding: '3px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        background: '#fff',
                        color: '#6b7280',
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                      title="Edit lesson"
                    >
                      ✏️ Edit
                    </button>

<button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingNote(isEditingThisNote ? null : lessonKey)
                      }}
                      style={{
                        padding: '3px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        background: noteText ? '#fef3c7' : '#fff',
                        color: '#6b7280',
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                      title={noteText ? 'Edit note' : 'Add note'}
                    >
                      📝 {noteText ? 'Note' : 'Notes'}
                    </button>

### 26. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (d298b8da29d86c5722b79b93673d6bd583631facd5a902592bdae988e945ca06)
- bm25: -3.0442 | relevance: 1.0000

const loadLessonForEditing = async (lessonKey) => {
    setEditingLesson(lessonKey)
    setLessonEditorLoading(true)
    setLessonEditorData(null)
    setVisualAidsImages([])
    setGenerationCount(0)
    setVisualAidsError('')
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const res = await fetch(`/api/lesson-file?key=${encodeURIComponent(lessonKey)}`, {
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      })
      
      if (!res.ok) {
        throw new Error('Failed to load lesson')
      }
      
      const lessonData = await res.json()
      setLessonEditorData(lessonData)
      
      // Load visual aids for this lesson
      await loadVisualAidsForLesson(lessonKey)
    } catch (err) {
      // Silent error handling
      alert('Failed to load lesson: ' + err.message)
      setEditingLesson(null)
    } finally {
      setLessonEditorLoading(false)
    }
  }

### 27. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (483f03fcdf6e6fc8d65aae87b0a2d0229907f8bc8092f4720f983d5a8843af3c)
- bm25: -3.0320 | relevance: 1.0000

{/* Notes editing section */}
                  {isEditingThisNote && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
                      <textarea
                        defaultValue={noteText}
                        placeholder="Add notes..."
                        autoFocus
                        rows={2}
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          fontSize: 11,
                          fontFamily: 'inherit',
                          resize: 'vertical',
                          marginBottom: 6,
                          boxSizing: 'border-box'
                        }}
                        id={`note-${lessonKey}`}
                      />
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => {
                            const textarea = document.getElementById(`note-${lessonKey}`)
                            saveNote(lessonKey, textarea?.value || '')
                          }}
                          disabled={saving}
                          style={{
                            padding: '4px 10px',
                            border: 'none',
                            borderRadius: 4,
                            background: '#2563eb',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: saving ? 'wait' : 'pointer'
                          }}
                        >
                          Save

### 28. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (e5ce3cee4831fc9904c70758706bb0c77f1fe7597f3ef016ed629d1641a167c9)
- bm25: -2.9960 | relevance: 1.0000

const saveLessonEdits = async (updatedLesson) => {
    if (!editingLesson) return
    
    setLessonEditorSaving(true)
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const res = await fetch('/api/lesson-edit', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          lessonKey: editingLesson,
          updates: updatedLesson
        })
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to save lesson')
      }
      
      // Success - close editor
      setEditingLesson(null)
      setLessonEditorData(null)
      // Lesson saved successfully
    } catch (err) {
      // Silent error handling
      alert('Failed to save lesson: ' + err.message)
    } finally {
      setLessonEditorSaving(false)
    }
  }

### 29. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (b4fc80e46cb6a9229cb6072cfa108c194405e6fb39ab86ed5a064e69d24ef5a3)
- bm25: -2.8709 | relevance: 1.0000

{/* Schedule selector overlay */}
                  {isSchedulingThis && (
                    <div 
                      style={{ 
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10000
                      }}
                      onClick={() => setSchedulingLesson(null)}
                    >
                      <div 
                        style={{
                          background: '#fff',
                          borderRadius: 8,
                          padding: 16,
                          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                          maxWidth: 280,
                          width: '90%'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#1f2937' }}>
                          📅 Schedule Lesson
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                          {lesson.title}
                        </div>
                        
                        <input
                          type="date"
                          defaultValue={new Date().toISOString().split('T')[0]}
                          style={{
                            width: '100%',
                            padding: '8px',
                            border: '1px solid #d1d5db',

### 30. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (353aff4e34954d0d4bfbc7038f6914904c63f8389402dc622d75a55678058d56)
- bm25: -2.7260 | relevance: 1.0000

if (approvedChanged) {
        try {
          await supabase.from('learners').update({ approved_lessons: approvedMap }).eq('id', learnerId)
        } catch (normErr) {
          // Silent error handling
        }
      }

setLessonNotes(approvedData?.lesson_notes || {})

// Set grade filter to learner's grade
      if (approvedData?.grade && selectedGrade === 'all') {
        const learnerGrade = String(approvedData.grade).trim().replace(/(?:st|nd|rd|th)$/i, '').toUpperCase()
        setSelectedGrade(learnerGrade)
      }

// Load scheduled lessons
      try {
        const today = new Date().toISOString().split('T')[0]
        const token = session?.access_token
        
        if (token) {
          // Get today's scheduled lessons
          const scheduleResponse = await fetch(`/api/lesson-schedule?learnerId=${learnerId}&action=active`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (scheduleResponse.ok) {
            const scheduleData = await scheduleResponse.json()
            const scheduledLessons = scheduleData.lessons || []
            const scheduled = {}
            scheduledLessons.forEach(item => {
              if (item.lesson_key) {
                scheduled[item.lesson_key] = true
              }
            })
            setScheduledLessons(scheduled)
          }

### 31. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (dc574903fd51d020e8c1acf16b694336cbf0e939d60a0f9fd4687332ccd7fd81)
- bm25: -2.6968 | relevance: 1.0000

// Load medals
      const medalsData = await getMedalsForLearner(learnerId)
      setMedals(medalsData || {})
    } catch (err) {
      // Silent error handling
      setApprovedLessons({})
      setLessonNotes({})
      setScheduledLessons({})
      setFutureScheduledLessons({})
      setMedals({})
    } finally {
      setLearnerDataLoading(false)
    }
  }, [learnerId, selectedGrade])

// Prefetch lessons once coreSubjects are ready (so first overlay open feels instant).
  useEffect(() => {
    loadLessons(false)
  }, [loadLessons])

// Initial learner-scoped load
  useEffect(() => {
    if (learnerId && learnerId !== 'none') {
      loadLearnerData()
    }
  }, [learnerId, loadLearnerData])

// Listen for preload event to trigger initial load
  useEffect(() => {
    const handlePreload = () => {
      loadLessons(false) // Warm cache; don't thrash network if already loaded
      if (learnerId && learnerId !== 'none') {
        loadLearnerData()
      }
    }
    
    const handleLessonGenerated = () => {
      // Clear cache and reload
      setAllLessons({})
      setRetryCount(0)
      setLoadError(false)
      loadLessons(true)
    }
    
    window.addEventListener('preload-overlays', handlePreload)
    window.addEventListener('mr-mentor:lesson-generated', handleLessonGenerated)
    return () => {
      window.removeEventListener('preload-overlays', handlePreload)
      window.removeEventListener('mr-mentor:lesson-generated', handleLessonGenerated)
    }
  }, [learnerId, loadLessons, loadLearnerData])

### 32. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (f9c0d007faeea184e8bb75bd128bec339343d7fa7b8f61fe831893f09ebb37a7)
- bm25: -2.6683 | relevance: 1.0000

return (
                <div
                  key={`${subject}-${lessonKey}`}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #f3f4f6',
                    background: isApproved ? '#f0fdf4' : '#fff'
                  }}
                >
                  {/* Main lesson info with floating buttons */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: 6,
                    flexWrap: 'wrap'
                  }}>
                    <input
                      type="checkbox"
                      checked={isApproved}
                      onChange={() => toggleLessonApproval(lessonKey)}
                      disabled={saving || !learnerId || learnerId === 'none'}
                      style={{
                        marginTop: 2,
                        cursor: (saving || !learnerId || learnerId === 'none') ? 'not-allowed' : 'pointer',
                        width: 16,
                        height: 16
                      }}
                      title="Show this lesson to learner"
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      {isScheduled && <span style={{ fontSize: 12 }} title="Scheduled for today">📅</span>}
                      {!isScheduled && futureDate && <span style={{ fontSize: 12, opacity: 0.5 }} title={`Scheduled for ${futureDate}`}>📅</span>}
                      {medal && <span style={{ fontSize: 14 }}>{emojiForTier(medal.medalTier)}</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontWeight: 600, color: '

### 33. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (fa9f619e76b0e11f2f7ee928f1e85e117095d7dd3edfe4a18c2ae178cdf1d603)
- bm25: -2.5774 | relevance: 1.0000

{/* Full Lesson Editor Overlay */}
      {editingLesson && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            overflow: 'auto'
          }}
          onClick={(e) => {
            // Only close if clicking the backdrop, not the editor itself
            if (e.target === e.currentTarget && !lessonEditorSaving) {
              if (window.confirm('Close editor without saving?')) {
                setEditingLesson(null)
                setLessonEditorData(null)
              }
            }
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              width: '100%',
              height: '100%',
              boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              zIndex: 1002,
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {lessonEditorLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#6b7280', fontSize: 16 }}>
                Loading lesson data...
              </div>
            ) : lessonEditorData ? (
              <>
                {/* Header with Visual Aids button */}
                <div style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 's

### 34. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (1ffa09b8c4571a2e4a3416e7b2662d57a2595c68a51e9814e46c79eabb02db43)
- bm25: -2.5342 | relevance: 1.0000

// Lesson editor-specific rewrite handlers
  const handleRewriteLessonDescription = async (description) => {
    setRewritingDescription(true)
    const lessonTitle = lessonEditorData?.title || 'Lesson'
    const rewritten = await handleRewriteDescription(description, lessonTitle, 'lesson-description')
    setRewritingDescription(false)
    
    if (rewritten) {
      setLessonEditorData(prev => ({
        ...prev,
        blurb: rewritten
      }))
    }
  }

const handleRewriteLessonTeachingNotes = async (notes) => {
    setRewritingTeachingNotes(true)
    const lessonTitle = lessonEditorData?.title || 'Lesson'
    const rewritten = await handleRewriteDescription(notes, lessonTitle, 'teaching-notes')
    setRewritingTeachingNotes(false)
    
    if (rewritten) {
      setLessonEditorData(prev => ({
        ...prev,
        teachingNotes: rewritten
      }))
    }
  }

const handleRewriteVocabDefinition = async (definition, term, index) => {
    setRewritingVocabDefinition(prev => ({ ...prev, [index]: true }))
    const lessonTitle = lessonEditorData?.title || 'Lesson'
    const context = `${lessonTitle} - Term: ${term}`
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

const res = await fetch('/api/ai/rewrite-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          text: definition,
          context: context,
          purpose: 'vocabulary-definition'
        })
      })

if (!res.ok) {
        throw new Error('Failed to rewrite vocabulary definition')
      }

### 35. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (16564d89d19e7dcc8085f9b8929f3929a7987c4e10ec6148659fbbd7d2415879)
- bm25: -2.5257 | relevance: 1.0000

{/* Lessons List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: 12 }}>
            Loading lessons...
            {retryCount > 0 && <div style={{ marginTop: 8, fontSize: 11 }}>Retry {retryCount}/3...</div>}
          </div>
        ) : loadError && retryCount >= 3 ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>
              Failed to load lessons after {retryCount} attempts
            </div>
            <button
              onClick={() => {
                setRetryCount(0)
                setLoadError(false)
                loadLessons(true)
              }}
              style={{
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Retry Now
            </button>
          </div>
        ) : filteredLessons.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: 12 }}>
            {Object.keys(allLessons).length === 0 
              ? 'No lessons loaded' 
              : 'No lessons match your filters'}
          </div>
        ) : (
          <div>
            {filteredLessons.map(lesson => {
              const { lessonKey, subject, displayGrade } = lesson
              const legacyKey = lessonKey.replace('general/', 'facilitator/')
              const isApproved = !!approvedLessons[lessonKey] || !!approvedLessons[legacyKey]
              const isSchedu

### 36. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (0689c8e442db0663eb90a898f1002040671ecc4b0ff9b96f101371b791fa895d)
- bm25: -2.5173 | relevance: 1.0000

const {
    sessions: lessonHistorySessions,
    events: lessonHistoryEvents,
    lastCompleted: lessonHistoryLastCompleted,
    inProgress: lessonHistoryInProgress,
    loading: lessonHistoryLoading,
    error: lessonHistoryError,
    refresh: refreshLessonHistory,
  } = useLessonHistory(learnerId, { limit: 150 })

const completedLessonCount = useMemo(() => Object.keys(lessonHistoryLastCompleted || {}).length, [lessonHistoryLastCompleted])
  const activeLessonCount = useMemo(() => Object.keys(lessonHistoryInProgress || {}).length, [lessonHistoryInProgress])

const lessonTitleLookup = useMemo(() => {
    const map = {}
    Object.entries(allLessons || {}).forEach(([subject, lessons]) => {
      if (!Array.isArray(lessons)) return
      lessons.forEach((lesson) => {
        if (!lesson || !lesson.file) return
        const key = lesson.isGenerated ? `generated/${lesson.file}` : `${subject}/${lesson.file}`
        if (!map[key] && lesson.title) {
          map[key] = lesson.title
        }
      })
    })
    return map
  }, [allLessons])

const formatDateOnly = useCallback((isoString) => {
    if (!isoString) return null
    try {
      const date = new Date(isoString)
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return isoString
    }
  }, [])

const formatDateTime = useCallback((isoString) => {
    if (!isoString) return null
    try {
      const date = new Date(isoString)
      return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    } catch {
      return isoString
    }
  }, [])

### 37. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (b7270a02ccd4f5686bf5e6ef592cbda73203c8f02bf686749ab9f6264f86581b)
- bm25: -2.5173 | relevance: 1.0000

return (
    <>
      <div style={{ 
        height: '100%', 
        background: '#fff', 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #6b7280',
        borderRadius: 8
      }}>
      {/* Header */}
      <div style={{ 
        padding: '12px 16px', 
        background: 'linear-gradient(to right, #eff6ff, #eef2ff)',
        borderBottom: '1px solid #e5e7eb',
        flexShrink: 0
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', marginBottom: 8 }}>
          📚 Lessons
        </div>
        
        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: '1',
              minWidth: '120px',
              padding: '6px 8px',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              fontSize: 12,
              background: '#fff'
            }}
          />
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            style={{
              padding: '6px 8px',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              fontSize: 12,
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Subjects</option>
            {subjectOptions.map(subject => (
              <option key={subject} value={subject} style={{ textTransform: 'capitalize' }}>
                {subject === 'language arts' ? 'Language Arts' : 
                 subject === 'social s

### 38. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (d864a179b267041335556b865ee9c5602644c8125cfc959cee99a962cd811af6)
- bm25: -2.5173 | relevance: 1.0000

const handleGenerateVisualAids = async () => {
    if (!lessonEditorData?.teachingNotes) {
      setVisualAidsError('Teaching notes are required to generate visual aids')
      return
    }

// If we already have images, just open the carousel
    if (visualAidsImages.length > 0) {
      setShowVisualAidsCarousel(true)
      return
    }

// Check if limit reached
    if (generationCount >= MAX_GENERATIONS) {
      setVisualAidsError(`You've reached the maximum of ${MAX_GENERATIONS} generations for this lesson`)
      return
    }

setGeneratingVisualAids(true)
    setGenerationProgress('Starting generation...')
    setVisualAidsError('')

try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

const newImages = []
      for (let i = 0; i < 3; i++) {
        setGenerationProgress(`Generating image ${i + 1} of 3...`)
        
        const res = await fetch('/api/visual-aids/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify({
            teachingNotes: lessonEditorData.teachingNotes,
            lessonTitle: lessonEditorData.title,
            count: 1
          })
        })

if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.error || 'Failed to generate visual aids')
        }

### 39. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (89443f13230086ec4bca1246580f5297d77446d20d7db80bb3e2516fc64cef57)
- bm25: -2.5007 | relevance: 1.0000

const newImage = {
        url: dataURL,
        prompt: `Uploaded: ${file.name}`,
        description: '',
        id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        uploaded: true
      }

const allImages = [...visualAidsImages, newImage]
      setVisualAidsImages(allImages)
      // Don't save yet - wait for user to select and save from carousel
      // await saveVisualAidsData(allImages, generationCount)
      
      return newImage
    } catch (err) {
      // Silent error handling
      setVisualAidsError('Failed to upload image')
      return null
    }
  }

const handleRewriteDescription = async (description, lessonTitle, purpose = 'visual-aid-description') => {
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

const res = await fetch('/api/ai/rewrite-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          text: description,
          context: lessonTitle,
          purpose: purpose
        })
      })

if (!res.ok) {
        throw new Error('Failed to rewrite text')
      }

const data = await res.json()
      return data.rewritten
    } catch (err) {
      // Silent error handling
      setVisualAidsError('Failed to rewrite text')
      return null
    }
  }

### 40. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (cd12334d845815e884da326687ab65408524c603850da9193dbea36b22545964)
- bm25: -2.4600 | relevance: 1.0000

const loadLessons = useCallback(async (force = false) => {
    if (!force && hasPrefetchedLessonsRef.current) return
    if (!Array.isArray(coreSubjects) || coreSubjects.length === 0) return

setLoading(true)
    setLoadError(false)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

const results = {}
      const subjectsToFetch = coreSubjects

for (const subject of subjectsToFetch) {
        try {
          const res = await fetch(`/api/lessons/${encodeURIComponent(subject)}`, {
            cache: 'no-store'
          })
          if (!res.ok) {
            if (res.status === 401) {
              results[subject] = []
              continue
            }
            results[subject] = []
            continue
          }
          const list = await res.json()
          results[subject] = Array.isArray(list) ? list : []
        } catch (err) {
          results[subject] = []
        }
      }

if (token) {
        try {
          const res = await fetch('/api/facilitator/lessons/list', {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}` }
          })
          if (res.ok) {
            const generatedList = await res.json()
            const sortedGeneratedList = generatedList.sort((a, b) => {
              const timeA = new Date(a.created_at || 0).getTime()
              const timeB = new Date(b.created_at || 0).getTime()
              return timeB - timeA
            })

if (!results['generated']) results['generated'] = []
