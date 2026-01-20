// Day view overlay showing all scheduled and planned lessons for a selected date
'use client'
import { useEffect, useState } from 'react'
import LessonGeneratorOverlay from './LessonGeneratorOverlay'
import LessonEditor from '@/components/LessonEditor'
import VisualAidsCarousel from '@/components/VisualAidsCarousel'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import LessonNotesModal from './LessonNotesModal'
import VisualAidsManagerModal from './VisualAidsManagerModal'
import PortfolioScansModal from './PortfolioScansModal'
import TypedRemoveConfirmModal from './TypedRemoveConfirmModal'

export default function DayViewOverlay({ 
  selectedDate, 
  scheduledLessons = [], 
  plannedLessons = [], 
  learnerId,
  learnerGrade,
  tier,
  onClose,
  onLessonGenerated,
  onNoSchoolSet,
  onPlannedLessonUpdate,
  onPlannedLessonRemove,
  noSchoolReason = null
}) {
  const getLocalTodayStr = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const isPastSelectedDate = selectedDate < getLocalTodayStr()

  const [showGenerator, setShowGenerator] = useState(false)
  const [generatorData, setGeneratorData] = useState(null)
  const [editingLesson, setEditingLesson] = useState(null)
  const [lessonEditorData, setLessonEditorData] = useState(null)
  const [lessonEditorLoading, setLessonEditorLoading] = useState(false)
  const [lessonEditorSaving, setLessonEditorSaving] = useState(false)
  const [showVisualAidsCarousel, setShowVisualAidsCarousel] = useState(false)
  const [visualAidsImages, setVisualAidsImages] = useState([])
  const [generatingVisualAids, setGeneratingVisualAids] = useState(false)
  const [generationProgress, setGenerationProgress] = useState('')
  const [generationCount, setGenerationCount] = useState(0)
  const [visualAidsLessonKey, setVisualAidsLessonKey] = useState(null)
  const [showNoSchoolInput, setShowNoSchoolInput] = useState(false)
  const [noSchoolInputValue, setNoSchoolInputValue] = useState(noSchoolReason || '')
  const [redoingLesson, setRedoingLesson] = useState(null)
  const [redoPromptDrafts, setRedoPromptDrafts] = useState({})

  const [authToken, setAuthToken] = useState('')
  const [notesLesson, setNotesLesson] = useState(null)
  const [visualAidsLesson, setVisualAidsLesson] = useState(null)
  const [portfolioScansLesson, setPortfolioScansLesson] = useState(null)
  const [removeConfirmLesson, setRemoveConfirmLesson] = useState(null)

  const MAX_GENERATIONS = 4

  useEffect(() => {
    // Initialize drafts from saved planned lesson data (do not overwrite in-progress typing)
    setRedoPromptDrafts((prev) => {
      const next = { ...prev }
      ;(plannedLessons || []).forEach((l) => {
        if (!l?.id) return
        if (next[l.id] === undefined && l.promptUpdate) {
          next[l.id] = String(l.promptUpdate)
        }
      })
      return next
    })
  }, [plannedLessons])

  const computeNormalizedLessonKey = (raw) => {
    const normalized = String(raw || '')
      .replace(/^generated\//, '')
      .replace(/\.json$/i, '')
    return normalized ? `${normalized}.json` : ''
  }

  const getAuthTokenOrThrow = async () => {
    const supabase = getSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) throw new Error('Not authenticated')
    setAuthToken((prev) => (prev === token ? prev : token))
    return token
  }

  const handleRemoveScheduledLessonById = async (scheduleId) => {
    if (!scheduleId) return
    try {
      const token = await getAuthTokenOrThrow()
      const res = await fetch(`/api/lesson-schedule?id=${scheduleId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      if (!res.ok) throw new Error('Failed to remove lesson')
      if (onLessonGenerated) onLessonGenerated()
    } catch (err) {
      alert(err?.message || 'Failed to remove lesson')
    }
  }

  const loadVisualAidsData = async (lessonKeyForVisualAids) => {
    if (!lessonKeyForVisualAids) return

    try {
      const token = await getAuthTokenOrThrow()
      const res = await fetch(`/api/visual-aids/load?lessonKey=${encodeURIComponent(lessonKeyForVisualAids)}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (!res.ok) return
      const data = await res.json()
      setVisualAidsImages(data.generatedImages || [])
      setGenerationCount(data.generationCount || 0)
    } catch {
      // Silent by design (matches regular lesson editor behavior)
    }
  }

  const saveVisualAidsData = async (images, count, shouldReload = false) => {
    if (!visualAidsLessonKey) return

    try {
      const token = await getAuthTokenOrThrow()

      const selectedImages = (Array.isArray(images) ? images : []).filter(img => img?.selected)
      const persistGenerated = !shouldReload

      const res = await fetch('/api/visual-aids/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          lessonKey: visualAidsLessonKey,
          generatedImages: images,
          selectedImages: selectedImages,
          generationCount: count,
          persistGenerated
        })
      })

      if (!res.ok) {
        let message = 'Failed to save visual aids'
        try {
          const errorData = await res.json()
          if (errorData?.error) message = errorData.error
          if (Array.isArray(errorData?.details) && errorData.details.length > 0) {
            const d = errorData.details[0]
            const stage = d?.stage ? `stage: ${d.stage}` : null
            const status = (typeof d?.status !== 'undefined') ? `status: ${d.status}` : null
            const detailMsg = (typeof d?.message === 'string' && d.message.trim()) ? d.message.trim() : null
            const extra = [stage, status].filter(Boolean).join(', ')
            if (extra) message = `${message} (${extra})`
            if (detailMsg) {
              const clipped = detailMsg.length > 140 ? `${detailMsg.slice(0, 140)}...` : detailMsg
              message = `${message} - ${clipped}`
            }
          }
        } catch {}
        alert(message)
        return
      }

      if (shouldReload) {
        const loadRes = await fetch(`/api/visual-aids/load?lessonKey=${encodeURIComponent(visualAidsLessonKey)}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })

        if (!loadRes.ok) {
          let message = 'Saved visual aids, but failed to reload them'
          try {
            const errorData = await loadRes.json()
            if (errorData?.error) message = errorData.error
          } catch {}
          alert(message)
          return
        }

        const visualAidsData = await loadRes.json()
        setVisualAidsImages(visualAidsData.generatedImages || [])
        setGenerationCount(visualAidsData.generationCount || 0)
      }
    } catch (err) {
      alert(err?.message || 'Failed to save visual aids')
    }
  }

  const handleGenerateVisualAids = async () => {
    if (!lessonEditorData?.teachingNotes) {
      alert('Teaching notes are required to generate visual aids')
      return
    }
    setShowVisualAidsCarousel(true)
  }

  const handleGenerateMore = async (customPrompt = '') => {
    if (!lessonEditorData?.teachingNotes) {
      return
    }

    if (generationCount >= MAX_GENERATIONS) {
      alert(`You've reached the maximum of ${MAX_GENERATIONS} generations for this lesson`)
      return
    }

    setGeneratingVisualAids(true)
    const isFirstGeneration = visualAidsImages.length === 0
    setGenerationProgress(isFirstGeneration ? 'Generating 3 images...' : 'Generating 3 more images...')

    try {
      const token = await getAuthTokenOrThrow()
      const res = await fetch('/api/visual-aids/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          teachingNotes: lessonEditorData.teachingNotes,
          lessonTitle: lessonEditorData.title,
          customPrompt: customPrompt.trim() || undefined,
          count: 3
        })
      })

      if (!res.ok) {
        throw new Error('Failed to generate more visual aids')
      }

      const data = await res.json()
      let allImages = visualAidsImages
      if (data.images && data.images.length > 0) {
        allImages = [...visualAidsImages, ...data.images]
        setVisualAidsImages(allImages)
      }

      const newCount = generationCount + 1
      setGenerationCount(newCount)
      setGenerationProgress('Complete!')
      setTimeout(() => setGenerationProgress(''), 1000)

      await saveVisualAidsData(allImages, newCount)
    } catch (err) {
      alert(err?.message || 'Failed to generate more visual aids')
      setGenerationProgress('')
    } finally {
      setGeneratingVisualAids(false)
    }
  }

  const handleUploadImage = async (file) => {
    try {
      const reader = new FileReader()
      const dataURL = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const newImage = {
        url: dataURL,
        prompt: `Uploaded: ${file.name}`,
        description: '',
        id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        uploaded: true
      }

      const allImages = [...visualAidsImages, newImage]
      setVisualAidsImages(allImages)
      await saveVisualAidsData(allImages, generationCount)
      return newImage
    } catch {
      alert('Failed to upload image')
      return null
    }
  }

  const handleRewriteDescription = async (description, lessonTitle, purpose = 'visual-aid-description') => {
    try {
      const token = await getAuthTokenOrThrow()
      const res = await fetch('/api/ai/rewrite-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          text: description,
          context: lessonTitle,
          purpose
        })
      })

      if (!res.ok) {
        throw new Error('Failed to rewrite text')
      }

      const data = await res.json()
      return data.rewritten
    } catch {
      return null
    }
  }

  const handleGeneratePrompt = async (teachingNotes, lessonTitle) => {
    try {
      const token = await getAuthTokenOrThrow()
      const res = await fetch('/api/ai/rewrite-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          text: teachingNotes,
          context: lessonTitle,
          purpose: 'visual-aid-prompt-from-notes'
        })
      })

      if (!res.ok) {
        throw new Error('Failed to generate prompt')
      }

      const data = await res.json()
      return data.rewritten
    } catch {
      return null
    }
  }

  const handleSaveVisualAids = async (selectedImages) => {
    const updatedImages = visualAidsImages.map(img => {
      const isSelected = selectedImages.some(sel => sel.id === img.id)
      return {
        ...img,
        selected: isSelected,
        description: selectedImages.find(sel => sel.id === img.id)?.description || img.description
      }
    })

    setShowVisualAidsCarousel(false)
    await saveVisualAidsData(updatedImages, generationCount, true)
  }

  useEffect(() => {
    if (!editingLesson) return
    const key = computeNormalizedLessonKey(editingLesson)
    setVisualAidsLessonKey(key)
    // Start fresh for each lesson edit session
    setShowVisualAidsCarousel(false)
    setVisualAidsImages([])
    setGenerationCount(0)
    setGenerationProgress('')
    setGeneratingVisualAids(false)
    loadVisualAidsData(key)
  }, [editingLesson])

  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })

  const handleGenerateClick = (plannedLesson) => {
    setGeneratorData({
      grade: learnerGrade || plannedLesson.grade || '',
      difficulty: plannedLesson.difficulty || 'intermediate',
      subject: plannedLesson.subject || '',
      title: plannedLesson.title || '',
      description: plannedLesson.description || ''
    })
    setShowGenerator(true)
  }

  const handleEditClick = async (scheduledLesson) => {
    setEditingLesson(scheduledLesson.lesson_key)
    setLessonEditorLoading(true)
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const authedUserId = session?.user?.id

      if (!token || !authedUserId) {
        throw new Error('Not authenticated')
      }

      // Safety check: scheduled lessons should belong to the signed-in facilitator
      if (scheduledLesson.facilitator_id && scheduledLesson.facilitator_id !== authedUserId) {
        throw new Error('Cannot edit another facilitator\'s lesson')
      }

      const params = new URLSearchParams({
        file: scheduledLesson.lesson_key
      })

      const response = await fetch(`/api/facilitator/lessons/get?${params}`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      if (!response.ok) {
        const errorData = await response.json()
        console.error('Lesson load failed:', JSON.stringify(errorData, null, 2))
        throw new Error(errorData.error || 'Failed to load lesson')
      }
      
      const data = await response.json()
      setLessonEditorData(data)
    } catch (err) {
      console.error('Error loading lesson:', err)
      alert('Failed to load lesson for editing')
      setEditingLesson(null)
      setShowVisualAidsCarousel(false)
      setVisualAidsImages([])
      setGenerationCount(0)
      setGenerationProgress('')
      setGeneratingVisualAids(false)
      setVisualAidsLessonKey(null)
    } finally {
      setLessonEditorLoading(false)
    }
  }

  const handleSaveLessonEdits = async (updatedLesson) => {
    setLessonEditorSaving(true)
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        throw new Error('Not authenticated')
      }

      const normalizedFile = String(editingLesson || '')
        .replace(/^generated\//, '')
        .replace(/\.json$/i, '')
      const file = `${normalizedFile}.json`

      const response = await fetch('/api/facilitator/lessons/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ file, lesson: updatedLesson })
      })

      const js = await response.json().catch(() => null)
      if (!response.ok) throw new Error(js?.error || 'Failed to save lesson')
      
      alert('Lesson updated successfully!')
      setEditingLesson(null)
      setLessonEditorData(null)
      setShowVisualAidsCarousel(false)
      if (onLessonGenerated) onLessonGenerated()
    } catch (err) {
      console.error('Error saving lesson:', err)
      alert('Failed to save lesson changes')
    } finally {
      setLessonEditorSaving(false)
    }
  }

  const handleNoSchoolSave = () => {
    if (onNoSchoolSet) {
      onNoSchoolSet(selectedDate, noSchoolInputValue.trim() || null)
    }
    setShowNoSchoolInput(false)
  }

  const handleRedoClick = async (plannedLesson) => {
    if (!onPlannedLessonUpdate) return
    
    setRedoingLesson(plannedLesson.id)
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        throw new Error('Not authenticated')
      }

      const promptUpdate = String(
        (redoPromptDrafts && plannedLesson?.id && redoPromptDrafts[plannedLesson.id] !== undefined)
          ? redoPromptDrafts[plannedLesson.id]
          : (plannedLesson?.promptUpdate || '')
      ).trim()

      const [historyRes, medalsRes, scheduledRes, plannedRes] = await Promise.all([
        fetch(`/api/learner/lesson-history?learner_id=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/medals?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/lesson-schedule?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/planned-lessons?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } })
      ])

      let contextText = ''

      let medals = {}
      if (medalsRes.ok) {
        medals = (await medalsRes.json().catch(() => ({}))) || {}
      }

      const LOW_SCORE_REVIEW_THRESHOLD = 70
      const HIGH_SCORE_AVOID_REPEAT_THRESHOLD = 85

      const lowScoreNames = new Set()
      const highScoreNames = new Set()

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

      if (scheduledRes.ok) {
        const scheduledData = await scheduledRes.json()
        const schedule = Array.isArray(scheduledData?.schedule) ? scheduledData.schedule : []
        if (schedule.length > 0) {
          contextText += '\n\nScheduled lessons (do NOT reuse these topics):\n'
          schedule
            .slice()
            .sort((a, b) => String(a.scheduled_date || '').localeCompare(String(b.scheduled_date || '')))
            .slice(-60)
            .forEach((s) => {
              contextText += `- ${s.scheduled_date}: ${s.lesson_key}\n`
            })
        }
      }

      if (plannedRes.ok) {
        const plannedData = await plannedRes.json()
        const allPlanned = plannedData?.plannedLessons || {}
        const flattened = []
        Object.entries(allPlanned).forEach(([date, arr]) => {
          ;(Array.isArray(arr) ? arr : []).forEach((l) => {
            flattened.push({ date, subject: l.subject, title: l.title, description: l.description })
          })
        })
        if (flattened.length > 0) {
          contextText += '\n\nPlanned lessons already in the calendar plan (do NOT repeat these topics):\n'
          flattened
            .slice()
            .sort((a, b) => String(a.date).localeCompare(String(b.date)))
            .slice(-80)
            .forEach((l) => {
              contextText += `- ${l.date} (${l.subject || 'general'}): ${l.title || l.description || 'planned lesson'}\n`
            })
        }
      }

      contextText += '\n\n=== REDO RULES: SAME AS PLANNER GENERATION ==='
      contextText += '\nYou are regenerating a planned lesson outline.'
      contextText += `\nPrefer NEW topics most of the time, but you MAY plan a rephrased Review for low scores (<= ${LOW_SCORE_REVIEW_THRESHOLD}%).`
      contextText += `\nAvoid repeating high-score topics (>= ${HIGH_SCORE_AVOID_REPEAT_THRESHOLD}%) unless the facilitator explicitly requests it.`
      contextText += "\nIf you choose a Review lesson, the title MUST start with 'Review:' and it must use different examples."
      contextText += '\nDo NOT produce an exact duplicate of any scheduled/planned lesson above.'

      const response = await fetch('/api/generate-lesson-outline', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subject: plannedLesson.subject,
          grade: learnerGrade || plannedLesson.grade || '3rd',
          difficulty: plannedLesson.difficulty || 'intermediate',
          learnerId,
          context: contextText,
          promptUpdate
        })
      })

      if (!response.ok) throw new Error('Failed to generate outline')
      
      const result = await response.json()
      const newOutline = result.outline

      // Keep the same id and subject, but update title and description
      const updatedLesson = {
        ...plannedLesson,
        title: newOutline.title,
        description: newOutline.description,
        promptUpdate
      }
      
      onPlannedLessonUpdate(selectedDate, plannedLesson.id, updatedLesson)
    } catch (err) {
      console.error('Error regenerating lesson:', err)
      alert('Failed to regenerate lesson outline')
    } finally {
      setRedoingLesson(null)
    }
  }

  const handleRemoveClick = (plannedLesson) => {
    if (!onPlannedLessonRemove) return
    
    if (confirm(`Remove "${plannedLesson.title}" from ${formattedDate}?`)) {
      onPlannedLessonRemove(selectedDate, plannedLesson.id)
    }
  }

  // If generator overlay is open, show it
  if (showGenerator) {
    return (
      <LessonGeneratorOverlay
        learnerId={learnerId}
        learnerGrade={learnerGrade}
        tier={tier}
        scheduledDate={selectedDate}
        prefilledData={generatorData}
        onClose={() => setShowGenerator(false)}
        onGenerated={() => {
          setShowGenerator(false)
          if (onLessonGenerated) onLessonGenerated()
        }}
      />
    )
  }

  // If lesson editor is open, show it
  if (editingLesson) {
    return (
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001,
          padding: 16
        }}
        onClick={() => {
          if (!lessonEditorSaving && confirm('Close without saving changes?')) {
            setEditingLesson(null)
            setLessonEditorData(null)
            setShowVisualAidsCarousel(false)
          }
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            width: '100%',
            maxWidth: 900,
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {lessonEditorLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
              Loading lesson...
            </div>
          ) : lessonEditorData ? (
            <LessonEditor
              initialLesson={lessonEditorData}
              onSave={handleSaveLessonEdits}
              onCancel={() => {
                if (!lessonEditorSaving || confirm('Cancel editing?')) {
                  setEditingLesson(null)
                  setLessonEditorData(null)
                  setShowVisualAidsCarousel(false)
                }
              }}
              busy={lessonEditorSaving}
              onGenerateVisualAids={handleGenerateVisualAids}
              generatingVisualAids={generatingVisualAids}
              visualAidsButtonText={generatingVisualAids 
                ? (generationProgress || 'Generating...') 
                : (visualAidsImages.length > 0 ? '🖼️ Visual Aids' : '🖼️ Generate Visual Aids')}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: 60, color: '#ef4444' }}>
              Failed to load lesson
            </div>
          )}
        </div>

        {showVisualAidsCarousel && (
          <VisualAidsCarousel
            images={visualAidsImages}
            onClose={() => setShowVisualAidsCarousel(false)}
            onSave={handleSaveVisualAids}
            onGenerateMore={handleGenerateMore}
            onUploadImage={handleUploadImage}
            onRewriteDescription={handleRewriteDescription}
            onGeneratePrompt={handleGeneratePrompt}
            generating={generatingVisualAids}
            teachingNotes={lessonEditorData?.teachingNotes || ''}
            lessonTitle={lessonEditorData?.title || ''}
            generationProgress={generationProgress}
            generationCount={generationCount}
            maxGenerations={MAX_GENERATIONS}
            zIndex={10002}
          />
        )}
      </div>
    )
  }

  // Main day view overlay
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 24,
          maxWidth: 700,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ 
            fontSize: 20, 
            fontWeight: 700, 
            color: '#1f2937',
            marginBottom: 4
          }}>
            {formattedDate}
          </h2>
          <p style={{ fontSize: 13, color: '#6b7280' }}>
            {scheduledLessons.length} scheduled  {plannedLessons.length} planned
          </p>
        </div>

        {/* No School Section */}
        <div style={{ 
          marginBottom: 20,
          padding: 12,
          background: noSchoolReason ? '#fef3c7' : '#f9fafb',
          borderRadius: 8,
          border: `1px solid ${noSchoolReason ? '#fbbf24' : '#e5e7eb'}`
        }}>
          {noSchoolReason ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#92400e' }}>
                   No School
                </span>
                <button
                  onClick={() => {
                    setNoSchoolInputValue('')
                    handleNoSchoolSave()
                  }}
                  style={{
                    marginLeft: 'auto',
                    padding: '2px 8px',
                    fontSize: 11,
                    background: 'transparent',
                    border: '1px solid #d97706',
                    borderRadius: 4,
                    color: '#92400e',
                    cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
              </div>
              <p style={{ fontSize: 13, color: '#78350f', margin: 0 }}>
                {noSchoolReason}
              </p>
            </div>
          ) : showNoSchoolInput ? (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Reason (optional)
              </label>
              <input
                type="text"
                value={noSchoolInputValue}
                onChange={(e) => setNoSchoolInputValue(e.target.value)}
                placeholder="e.g., Holiday, Field Trip, Teacher Planning Day"
                autoFocus
                style={{
                  width: '100%',
                  padding: 8,
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  fontSize: 13,
                  boxSizing: 'border-box',
                  marginBottom: 8
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleNoSchoolSave}
                  style={{
                    padding: '6px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowNoSchoolInput(false)
                    setNoSchoolInputValue(noSchoolReason || '')
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                    background: '#fff',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNoSchoolInput(true)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 600,
                background: '#fff',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
               Mark as No School
            </button>
          )}
        </div>

        {/* Lessons */}
        {scheduledLessons.length === 0 && plannedLessons.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: 40, 
            color: '#9ca3af',
            background: '#f9fafb',
            borderRadius: 8
          }}>
            No lessons scheduled or planned for this day
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Scheduled Lessons */}
            {scheduledLessons.map(lesson => {
              const [subject, filename] = lesson.lesson_key.split('/')
              const lessonName = filename?.replace('.json', '').replace(/_/g, ' ') || lesson.lesson_key
              
              return (
                <div
                  key={lesson.id}
                  style={{
                    padding: 12,
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: 8
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        fontSize: 11, 
                        fontWeight: 700, 
                        color: '#065f46',
                        textTransform: 'uppercase',
                        marginBottom: 4
                      }}>
                         Scheduled
                      </div>
                      <div style={{ 
                        fontSize: 14, 
                        fontWeight: 600, 
                        color: '#111827',
                        marginBottom: 2
                      }}>
                        {lessonName}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {subject}
                      </div>
                    </div>
                    {isPastSelectedDate ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setNotesLesson({ lessonKey: lesson.lesson_key, lessonTitle: lessonName })}
                          style={{
                            padding: '6px 12px',
                            fontSize: 12,
                            fontWeight: 600,
                            background: '#fff',
                            color: '#111827',
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Notes
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await getAuthTokenOrThrow()
                            } catch {
                              return
                            }
                            setVisualAidsLesson({ lessonKey: lesson.lesson_key, lessonTitle: lessonName })
                          }}
                          style={{
                            padding: '6px 12px',
                            fontSize: 12,
                            fontWeight: 600,
                            background: '#fff',
                            color: '#2563eb',
                            border: '1px solid #93c5fd',
                            borderRadius: 4,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Visual Aids
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await getAuthTokenOrThrow()
                            } catch {
                              return
                            }
                            setPortfolioScansLesson({ lessonKey: lesson.lesson_key, lessonTitle: lessonName })
                          }}
                          style={{
                            padding: '6px 12px',
                            fontSize: 12,
                            fontWeight: 600,
                            background: '#fff',
                            color: '#5b21b6',
                            border: '1px solid #ddd6fe',
                            borderRadius: 4,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Add Images
                        </button>
                        <button
                          onClick={() => setRemoveConfirmLesson({ scheduleId: lesson.id, lessonTitle: lessonName })}
                          style={{
                            padding: '6px 12px',
                            fontSize: 12,
                            fontWeight: 600,
                            background: '#fff',
                            color: '#dc2626',
                            border: '1px solid #fca5a5',
                            borderRadius: 4,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEditClick(lesson)}
                        style={{
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          background: '#fff',
                          color: '#065f46',
                          border: '1px solid #86efac',
                          borderRadius: 4,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Edit Lesson
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Planned Lessons */}
            {plannedLessons.map(lesson => (
              <div
                key={lesson.id}
                style={{
                  padding: 12,
                  background: '#eff6ff',
                  border: '1px solid #93c5fd',
                  borderRadius: 8
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontSize: 11, 
                      fontWeight: 700, 
                      color: '#1e40af',
                      textTransform: 'uppercase',
                      marginBottom: 4
                    }}>
                       Planned
                    </div>
                    <div style={{ 
                      fontSize: 14, 
                      fontWeight: 600, 
                      color: '#111827',
                      marginBottom: 4
                    }}>
                      {lesson.title}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                      {lesson.description}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>
                      {lesson.subject}  {lesson.grade}  {lesson.difficulty}
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', marginBottom: 4 }}>
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
                        onBlur={() => {
                          if (!onPlannedLessonUpdate) return
                          const value = String(
                            redoPromptDrafts[lesson.id] !== undefined
                              ? redoPromptDrafts[lesson.id]
                              : (lesson.promptUpdate || '')
                          )

                          // Persist only when it actually changes
                          if (String(lesson.promptUpdate || '') !== value) {
                            onPlannedLessonUpdate(selectedDate, lesson.id, {
                              ...lesson,
                              promptUpdate: value
                            })
                          }
                        }}
                        placeholder="Example: Different topic than fractions; focus on measurement."
                        rows={2}
                        style={{
                          width: '100%',
                          resize: 'vertical',
                          fontSize: 12,
                          padding: 8,
                          border: '1px solid #93c5fd',
                          borderRadius: 6,
                          outline: 'none'
                        }}
                      />
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                        This text is added to the GPT prompt when you click Redo.
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button
                      onClick={() => handleGenerateClick(lesson)}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Generate
                    </button>
                    <button
                      onClick={() => handleRedoClick(lesson)}
                      disabled={redoingLesson === lesson.id}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        background: '#fff',
                        color: '#2563eb',
                        border: '1px solid #93c5fd',
                        borderRadius: 4,
                        cursor: redoingLesson === lesson.id ? 'not-allowed' : 'pointer',
                        opacity: redoingLesson === lesson.id ? 0.6 : 1,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {redoingLesson === lesson.id ? 'Redoing...' : 'Redo'}
                    </button>
                    <button
                      onClick={() => handleRemoveClick(lesson)}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        background: '#fff',
                        color: '#dc2626',
                        border: '1px solid #fca5a5',
                        borderRadius: 4,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Close Button */}
        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              background: '#fff',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>

      <LessonNotesModal
        open={!!notesLesson}
        onClose={() => setNotesLesson(null)}
        learnerId={learnerId}
        lessonKey={notesLesson?.lessonKey}
        lessonTitle={notesLesson?.lessonTitle || 'Lesson Notes'}
        zIndex={10020}
      />

      <VisualAidsManagerModal
        open={!!visualAidsLesson}
        onClose={() => setVisualAidsLesson(null)}
        learnerId={learnerId}
        lessonKey={visualAidsLesson?.lessonKey}
        lessonTitle={visualAidsLesson?.lessonTitle || 'Visual Aids'}
        authToken={authToken}
        zIndex={10025}
      />

      <PortfolioScansModal
        open={!!portfolioScansLesson}
        onClose={() => setPortfolioScansLesson(null)}
        learnerId={learnerId}
        lessonKey={portfolioScansLesson?.lessonKey}
        lessonTitle={portfolioScansLesson?.lessonTitle || 'Lesson'}
        authToken={authToken}
        zIndex={10027}
      />

      <TypedRemoveConfirmModal
        open={!!removeConfirmLesson}
        onClose={() => setRemoveConfirmLesson(null)}
        title="Remove lesson?"
        description="This cannot be undone. Type remove to confirm."
        confirmWord="remove"
        confirmLabel="Remove"
        zIndex={10030}
        onConfirm={async () => {
          if (!removeConfirmLesson?.scheduleId) return
          await handleRemoveScheduledLessonById(removeConfirmLesson.scheduleId)
        }}
      />
    </div>
  )
}
