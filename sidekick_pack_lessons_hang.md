# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
LessonsOverlay stuck on 'Loading lessons...'. Trace client loadLessons -> /api/lessons/[subject] implementation, including any filesystem/storage calls that could hang. Show key files and likely hang points.
```

Filter terms used:
```text
/api/lessons
LessonsOverlay
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/api/lessons LessonsOverlay

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack_loading_lessons.md (92cfd3be7aa969ae1ddeba972b66d04a8f07ebb8615b1f764e18666e784e6d6c)
- bm25: -5.5356 | entity_overlap_w: 5.00 | adjusted: -6.7856 | relevance: 1.0000

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

### 2. sidekick_pack_loading_lessons.md (0ccc50a8a4ec68820ccc29ddea356733780b4ac02ab39285e82828bf40e0d20d)
- bm25: -5.3966 | entity_overlap_w: 5.00 | adjusted: -6.6466 | relevance: 1.0000

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

### 3. sidekick_pack_loading_lessons.md (81a4ace242d2cdcf28509bbd3b6ed862dd1c767c76e4ad49fe7e648b2fe6f405)
- bm25: -4.8148 | entity_overlap_w: 2.00 | adjusted: -5.3148 | relevance: 1.0000

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

### 4. sidekick_pack_loading_lessons.md (30926489db8e71cc9b182fb06697b301423c6fc1f1b9a1652fc31ef37f15d32f)
- bm25: -5.0332 | entity_overlap_w: 1.00 | adjusted: -5.2832 | relevance: 1.0000

### 39. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (89443f13230086ec4bca1246580f5297d77446d20d7db80bb3e2516fc64cef57)
- bm25: -2.5007 | relevance: 1.0000

### 5. sidekick_pack_loading_lessons.md (cac05eaec21abe2e83713174fb4e35199dc0429da556843e6c731857988c4248)
- bm25: -5.0332 | entity_overlap_w: 1.00 | adjusted: -5.2832 | relevance: 1.0000

### 33. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (fa9f619e76b0e11f2f7ee928f1e85e117095d7dd3edfe4a18c2ae178cdf1d603)
- bm25: -2.5774 | relevance: 1.0000

### 6. sidekick_pack_loading_lessons.md (d81020cd095697f348ecd568be46bdd140d05b0877cc43a812719dfdd49b2e98)
- bm25: -5.0332 | entity_overlap_w: 1.00 | adjusted: -5.2832 | relevance: 1.0000

### 37. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (b7270a02ccd4f5686bf5e6ef592cbda73203c8f02bf686749ab9f6264f86581b)
- bm25: -2.5173 | relevance: 1.0000

### 7. sidekick_pack_loading_lessons.md (e06ecb86371ef34c1afe171b78b6875e65c9cb1f8b0c66324210f576e2ff6568)
- bm25: -5.0332 | entity_overlap_w: 1.00 | adjusted: -5.2832 | relevance: 1.0000

### 16. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (b82360a69b78854594e5217eb5c6015c1a6763e0715c389c07f66e027e4bba91)
- bm25: -3.7545 | relevance: 1.0000

### 8. sidekick_pack_loading_lessons.md (e48458982a7cd3f796bdd4a2aaab0ce4e9080557128a6902b53e44a1504d97e6)
- bm25: -4.7319 | entity_overlap_w: 2.00 | adjusted: -5.2319 | relevance: 1.0000

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

### 9. sidekick_pack_loading_lessons.md (3da1f087bc577c3cbdd6e86b1da254bd32cabf0c8dbb64f3d11f5b3a05da3714)
- bm25: -4.6674 | entity_overlap_w: 2.00 | adjusted: -5.1674 | relevance: 1.0000

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

### 10. sidekick_pack_loading_lessons.md (dd9a716e1695ca6cacf3bcb205ebd8cdff05bd2f268af22a4230580f961d4b0d)
- bm25: -4.3616 | entity_overlap_w: 3.00 | adjusted: -5.1116 | relevance: 1.0000

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

### 11. sidekick_pack_loading_lessons.md (d1c3b9621fd6d6d8ee2b9af7d9453aa0894b09e1948e62403c793223ca0ed362)
- bm25: -4.6090 | entity_overlap_w: 2.00 | adjusted: -5.1090 | relevance: 1.0000

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

### 12. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (309ee794da8d03103cf14a0174b846a1fb4b8127c744437dc899f149daff2129)
- bm25: -5.0921 | relevance: 1.0000

const { normalized: approvedMap, changed: approvedChanged } = normalizeApprovedLessonKeys(approvedData?.approved_lessons)
      setApprovedLessons(approvedMap)

### 13. sidekick_pack_loading_lessons.md (bfd10e4ff960324cd59d07b2c71ec6770594957c142b760497b04a9cd064f329)
- bm25: -4.7320 | entity_overlap_w: 1.00 | adjusted: -4.9820 | relevance: 1.0000

if (!res.ok) {
        throw new Error('Failed to rewrite vocabulary definition')
      }

### 35. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (16564d89d19e7dcc8085f9b8929f3929a7987c4e10ec6148659fbbd7d2415879)
- bm25: -2.5257 | relevance: 1.0000

### 14. sidekick_pack_loading_lessons.md (8b50ecb1863eb1c1601a2a848f16391e16b551291c234f9fa9789adf00db3f66)
- bm25: -4.3974 | entity_overlap_w: 2.00 | adjusted: -4.8974 | relevance: 1.0000

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

### 15. sidekick_pack_loading_lessons.md (7979d6a7fd57cf7cd2c624c0b2b78cbf0803be38160a059396baf173e015e2be)
- bm25: -4.3752 | entity_overlap_w: 2.00 | adjusted: -4.8752 | relevance: 1.0000

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

### 16. sidekick_pack_loading_lessons.md (4b636fcb285e60a8b46e254b9cad598b1d82ea47196da12932f66d4af95208d9)
- bm25: -4.3315 | entity_overlap_w: 2.00 | adjusted: -4.8315 | relevance: 1.0000

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

### 17. sidekick_pack_loading_lessons.md (5197d7f1ae5d3aabbc2f1c68f4fd7eab667d995cb0dcc54ea923c36b816a5a09)
- bm25: -4.2835 | entity_overlap_w: 2.00 | adjusted: -4.7835 | relevance: 1.0000

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

### 18. sidekick_pack_loading_lessons.md (84bdd70982a5632e45a7924c2ac993558585eb9262c4269186505b72c2f21bf7)
- bm25: -4.2753 | entity_overlap_w: 2.00 | adjusted: -4.7753 | relevance: 1.0000

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

### 19. sidekick_pack_loading_lessons.md (d98dbd0ff3e3282115d473641456fa166f42af93173b50443343bc2b1509ec5c)
- bm25: -4.2630 | entity_overlap_w: 2.00 | adjusted: -4.7630 | relevance: 1.0000

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

### 20. sidekick_pack_loading_lessons.md (4ac0632ef1fc04cdf33bf21a1acc65d9a03f181f87c16662c7c0e9a487174eb9)
- bm25: -4.1787 | entity_overlap_w: 2.00 | adjusted: -4.6787 | relevance: 1.0000

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

### 21. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (47a25c1e95ff05cf0bcc6f028e1aeba5de44430e2aa72546d9705357fb81f9f0)
- bm25: -4.3723 | entity_overlap_w: 1.00 | adjusted: -4.6223 | relevance: 1.0000

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

### 22. sidekick_pack_loading_lessons.md (af0617eae5baef03a569c74f37269de59d9ff012e6a6d4f08bbc63537fb82eab)
- bm25: -3.9935 | entity_overlap_w: 2.00 | adjusted: -4.4935 | relevance: 1.0000

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

### 23. sidekick_pack_api_mentor_session.md (4855132618822a362a64f503352c2317423f958b837508d272e5034660ab6c18)
- bm25: -3.9232 | entity_overlap_w: 2.00 | adjusted: -4.4232 | relevance: 1.0000

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

### 24. sidekick_pack_api_mentor_session.md (73c4298bc7de9a58755bf4aff6cbce4f6e03440873ec094745b515d30da4d5de)
- bm25: -3.9232 | entity_overlap_w: 2.00 | adjusted: -4.4232 | relevance: 1.0000

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

### 25. sidekick_pack_loading_lessons.md (8b9dec7ce854b24867c93172cc7f3648e383381002da8b8651448794e8737d13)
- bm25: -4.1064 | entity_overlap_w: 1.00 | adjusted: -4.3564 | relevance: 1.0000

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

### 26. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (d625761d71543bdb74a9ba947b48cfd8c49653dbd3941fb9be1ddd9a918b7303)
- bm25: -4.1654 | relevance: 1.0000

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

### 27. src/app/facilitator/generator/counselor/CounselorClient.jsx (f7ffbd62ec5c154f73c9ce61ebbd9f78b22c0627dce67964d62da5b98c71ac0e)
- bm25: -3.6063 | entity_overlap_w: 2.00 | adjusted: -4.1063 | relevance: 1.0000

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

### 28. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (9b205fd971924b2e45a69c1b09abf6fd5914e9770cd9d78c4a623e2e29e5d1d2)
- bm25: -4.0143 | relevance: 1.0000

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

### 29. sidekick_pack_loading_lessons.md (55cdc7f64f74aa171bb2a6cc01ac4d53af2311af96927ad6abb6a81c580f9c82)
- bm25: -3.7271 | entity_overlap_w: 1.00 | adjusted: -3.9771 | relevance: 1.0000

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

### 30. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (4653131fd5fb610db65b1e8fb452a5f7804db1fce5ef55bbb35a2587d36a2fca)
- bm25: -3.9760 | relevance: 1.0000

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

### 31. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (2b0f4538429a91b581441a56250d2d26e90eba97c8107e6558eb48f1295c4761)
- bm25: -3.9493 | relevance: 1.0000

const filteredLessons = getFilteredLessons()

### 32. sidekick_pack_loading_lessons.md (f9f969db003f53102e85b1e3c7155423150a98822c92dcc253f71eff7d9010c0)
- bm25: -3.5683 | entity_overlap_w: 1.00 | adjusted: -3.8183 | relevance: 1.0000

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

### 33. src/app/facilitator/generator/counselor/CounselorClient.jsx (a9ee07d528dacf17a5a5988ecdd3025bc4f515644b1b5739ccf24e5ffdfcd85e)
- bm25: -3.5674 | entity_overlap_w: 1.00 | adjusted: -3.8174 | relevance: 1.0000

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

### 34. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (55027a32a234aefb01a2f2bee632f667a1c038d2f6f8ee095f84934800ee02f4)
- bm25: -3.3884 | entity_overlap_w: 1.50 | adjusted: -3.7634 | relevance: 1.0000

const loadLessons = useCallback(async (force = false) => {
    if (!force && hasPrefetchedLessonsRef.current) return

const FALLBACK_SUBJECTS = ['math', 'science', 'language arts', 'social studies', 'general']
    const subjectsToFetch = Array.isArray(coreSubjects) && coreSubjects.length > 0 ? coreSubjects : FALLBACK_SUBJECTS

setLoading(true)
    setLoadError(false)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

const results = {}

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

### 35. sidekick_pack_takeover.md (6ab7b739334afeaea082c2424ed18760868b0056056cb4146b9f1cb05cd5b365)
- bm25: -3.2179 | entity_overlap_w: 2.00 | adjusted: -3.7179 | relevance: 1.0000

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

### 36. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (f9ed138f6a64155027d6864be4dafa5fa4c68361220388b9efe24ca2d10ef9c3)
- bm25: -3.6782 | relevance: 1.0000

for (const lesson of sortedGeneratedList) {
              const subject = lesson.subject || 'math'
              const generatedLesson = {
                ...lesson,
                isGenerated: true
              }

### 37. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (92c0d7afb6dba06e12a94d384f9d14809093f01609b28b4fd3401fd2bf47e6ae)
- bm25: -3.6323 | relevance: 1.0000

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

### 38. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (4fbdb7580dd7a2d1fe5768bbfbafef86327f01f52cfb2cd8d26ad6e65970bd3b)
- bm25: -3.4981 | relevance: 1.0000

const isLearnerScoped = Boolean(learnerId && learnerId !== 'none')
  const subjectOptions = useMemo(
    () => subjectNames.filter((s) => String(s).toLowerCase() !== 'generated'), // Don't show 'generated' in this dropdown
    [subjectNames]
  )

### 39. sidekick_pack_loading_lessons.md (8d24c82c6aba14de5f38fd2b056eaddcbb51d6e9e163b406ed5d48abad6c6499)
- bm25: -3.2117 | entity_overlap_w: 1.00 | adjusted: -3.4617 | relevance: 1.0000

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

### 40. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (aaf1e8e21ab68b34cfe29536efa3c98952802661d71ad9e886cd0f99f8700531)
- bm25: -3.4419 | relevance: 1.0000

const handleUploadImage = async (file) => {
    try {
      const reader = new FileReader()
      const dataURL = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
