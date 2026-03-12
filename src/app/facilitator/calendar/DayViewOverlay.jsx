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

const CORE_SUBJECTS_DV = ['math', 'language arts', 'science', 'social studies', 'general']

export default function DayViewOverlay({ 
  selectedDate, 
  scheduledLessons = [], 
  plannedLessons = [], 
  learnerId,
  learners = [],
  learnerGrade,
  tier,
  onClose,
  onLessonGenerated,
  onNoSchoolSet,
  onPlannedLessonUpdate,
  onPlannedLessonRemove,
  onPlannedLessonAdd,
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
  const [assignsOpenKey, setAssignsOpenKey] = useState(null)
  const [assigning, setAssigning] = useState(false)
  const [reschedulePickerKey, setReschedulePickerKey] = useState(null)
  const [reschedulePickerMonth, setReschedulePickerMonth] = useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() } })
  const [reschedulingBusy, setReschedulingBusy] = useState(false)

  // + Add menu state
  const [addMenuStep, setAddMenuStep] = useState(null) // null | 'top' | 'schedule' | 'own' | 'plan'
  const [ownedLessons, setOwnedLessons] = useState([])
  const [loadingOwned, setLoadingOwned] = useState(false)
  const [schedulingOwned, setSchedulingOwned] = useState(null)
  const [planningSubject, setPlanningSubject] = useState(null)
  const [dvCustomSubjects, setDvCustomSubjects] = useState([])
  const [dvCustomSubjectsLoaded, setDvCustomSubjectsLoaded] = useState(false)

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

  const handleAssignLesson = async (lessonKey, targetId) => {
    if (!lessonKey) return
    setAssigning(true)
    try {
      const supabase = getSupabaseClient()
      const toAssign = targetId === 'all' ? learners : learners.filter(l => l.id === targetId)
      for (const learner of toAssign) {
        const { data: currentData } = await supabase
          .from('learners')
          .select('approved_lessons')
          .eq('id', learner.id)
          .maybeSingle()
        const currentApproved = currentData?.approved_lessons || {}
        const newApproved = { ...currentApproved, [lessonKey]: true }
        await supabase.from('learners').update({ approved_lessons: newApproved }).eq('id', learner.id)
      }
    } catch {
      // silent fail
    } finally {
      setAssigning(false)
      setAssignsOpenKey(null)
    }
  }

  const PICKER_MONTHS_DV = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const buildPickerDaysDV = (year, month) => {
    const fd = new Date(year, month, 1).getDay()
    const dim = new Date(year, month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < fd; i++) cells.push(null)
    for (let d = 1; d <= dim; d++) cells.push(d)
    return cells
  }

  const handleRescheduleLesson = async (lesson, newDate) => {
    if (!newDate) return
    setReschedulingBusy(true)
    try {
      const token = await getAuthTokenOrThrow()
      const del = await fetch(`/api/lesson-schedule?id=${lesson.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      })
      if (!del.ok) throw new Error('Failed to remove old schedule')
      const add = await fetch('/api/lesson-schedule', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId, lessonKey: lesson.lesson_key, scheduledDate: newDate })
      })
      if (!add.ok) throw new Error('Failed to reschedule lesson')
      setReschedulePickerKey(null)
      if (onLessonGenerated) onLessonGenerated()
    } catch (err) {
      alert(err?.message || 'Failed to reschedule lesson')
    } finally {
      setReschedulingBusy(false)
    }
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

  // ── + Add menu helpers ──────────────────────────────────────────────────────

  const loadOwnedLessons = async () => {
    if (loadingOwned) return
    setLoadingOwned(true)
    try {
      const token = await getAuthTokenOrThrow()
      const res = await fetch('/api/facilitator/lessons/list', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to load lessons')
      const list = await res.json()
      setOwnedLessons(Array.isArray(list) ? list.sort((a, b) => (a.title || '').localeCompare(b.title || '')) : [])
    } catch {
      setOwnedLessons([])
    } finally {
      setLoadingOwned(false)
    }
  }

  const handleScheduleOwned = async (lesson) => {
    if (!learnerId || !selectedDate) return
    const lessonKey = `generated/${lesson.file}`
    setSchedulingOwned(lessonKey)
    try {
      const token = await getAuthTokenOrThrow()
      const res = await fetch('/api/lesson-schedule', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId, lessonKey, scheduledDate: selectedDate })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'Failed to schedule lesson')
      }
      const data = await res.json().catch(() => null)
      setAddMenuStep(null)
      if (onLessonGenerated) onLessonGenerated(data?.schedule || null)
    } catch (err) {
      alert(err?.message || 'Failed to schedule lesson')
    } finally {
      setSchedulingOwned(null)
    }
  }

  const loadCustomSubjectsDV = async () => {
    if (dvCustomSubjectsLoaded) return
    try {
      const token = await getAuthTokenOrThrow()
      const res = await fetch('/api/custom-subjects', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const result = await res.json()
        setDvCustomSubjects(result.subjects || [])
      }
    } catch {
      // silent
    } finally {
      setDvCustomSubjectsLoaded(true)
    }
  }

  const handleAutoGeneratePlan = async (subject) => {
    if (!onPlannedLessonAdd) return
    if (!learnerId || !selectedDate) return
    setPlanningSubject(subject)
    try {
      const token = await getAuthTokenOrThrow()

      // Build lightweight context (history + scheduled + planned + curriculum prefs)
      const [historyRes, medalsRes, scheduledRes, plannedRes, preferencesRes] = await Promise.all([
        fetch(`/api/learner/lesson-history?learner_id=${learnerId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/medals?learnerId=${learnerId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/lesson-schedule?learnerId=${learnerId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/planned-lessons?learnerId=${learnerId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/curriculum-preferences?learnerId=${learnerId}`, { headers: { Authorization: `Bearer ${token}` } })
      ])

      let contextText = ''
      let medals = {}
      let prefsRow = null
      if (medalsRes.ok) medals = (await medalsRes.json().catch(() => ({}))) || {}
      if (preferencesRes.ok) {
        const prefsJson = await preferencesRes.json().catch(() => ({}))
        prefsRow = prefsJson.preferences || null
      }

      const getSubjectContextAdditions = (subject) => {
        if (!prefsRow) return ''
        const globalFocusConcepts = prefsRow.focus_concepts || []
        const globalFocusTopics = prefsRow.focus_topics || []
        const globalFocusKeywords = prefsRow.focus_keywords || []
        const globalBannedConcepts = prefsRow.banned_concepts || []
        const globalBannedTopics = prefsRow.banned_topics || []
        const globalBannedWords = prefsRow.banned_words || []
        const subPrefs = prefsRow.subject_preferences?.[subject] || {}
        const focusConcepts = [...globalFocusConcepts, ...(subPrefs.focusConcepts || [])]
        const focusTopics = [...globalFocusTopics, ...(subPrefs.focusTopics || [])]
        const focusKeywords = [...globalFocusKeywords, ...(subPrefs.focusKeywords || [])]
        const bannedConcepts = [...globalBannedConcepts, ...(subPrefs.bannedConcepts || [])]
        const bannedTopics = [...globalBannedTopics, ...(subPrefs.bannedTopics || [])]
        const bannedWords = [...globalBannedWords, ...(subPrefs.bannedWords || [])]
        let additions = ''
        if (focusConcepts.length) additions += `\n\nFocus Concepts (this subject): ${focusConcepts.join(', ')}`
        if (focusTopics.length) additions += `\n\nFocus Topics (this subject): ${focusTopics.join(', ')}`
        if (focusKeywords.length) additions += `\n\nFocus Keywords (this subject): ${focusKeywords.join(', ')}`
        if (bannedConcepts.length) additions += `\n\nBanned Concepts (this subject): ${bannedConcepts.join(', ')}`
        if (bannedTopics.length) additions += `\n\nBanned Topics (this subject): ${bannedTopics.join(', ')}`
        if (bannedWords.length) additions += `\n\nBanned Words (this subject): ${bannedWords.join(', ')}`
        return additions
      }

      if (historyRes.ok) {
        const history = await historyRes.json().catch(() => ({}))
        const sessions = Array.isArray(history?.sessions) ? history.sessions : []
        if (sessions.length > 0) {
          contextText += '\nLearner lesson history:\n'
          sessions.slice(-40).forEach((s) => {
            const best = s.status === 'completed' ? medals?.[s.lesson_id]?.bestPercent : null
            contextText += `- ${s.lesson_id} (${s.status}${Number.isFinite(best) ? `, score: ${best}%` : ''})\n`
          })
        }
      }
      if (scheduledRes.ok) {
        const sd = await scheduledRes.json().catch(() => ({}))
        const sched = Array.isArray(sd?.schedule) ? sd.schedule : []
        if (sched.length > 0) {
          contextText += '\nScheduled lessons (do not reuse these topics):\n'
          sched.slice(-40).forEach((s) => { contextText += `- ${s.scheduled_date}: ${s.lesson_key}\n` })
        }
      }
      if (plannedRes.ok) {
        const pd = await plannedRes.json().catch(() => ({}))
        const allP = pd?.plannedLessons || {}
        const flat = []
        Object.entries(allP).forEach(([d, arr]) => {
          ;(Array.isArray(arr) ? arr : []).forEach((l) => flat.push({ d, subject: l.subject, title: l.title }))
        })
        if (flat.length > 0) {
          contextText += '\nAlready planned (do not repeat):\n'
          flat.slice(-60).forEach((l) => { contextText += `- ${l.d} (${l.subject || 'general'}): ${l.title || 'planned'}\n` })
        }
      }

      const res = await fetch('/api/generate-lesson-outline', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          grade: learnerGrade || '3rd',
          difficulty: 'intermediate',
          learnerId,
          context: contextText + getSubjectContextAdditions(subject)
        })
      })
      if (!res.ok) throw new Error('Failed to generate lesson outline')
      const result = await res.json()
      const outline = result.outline
      const newLesson = {
        ...outline,
        id: `${selectedDate}-${subject}-${Date.now()}`,
        subject
      }
      onPlannedLessonAdd(selectedDate, newLesson)
      setAddMenuStep(null)
    } catch (err) {
      alert(err?.message || 'Failed to generate planned lesson')
    } finally {
      setPlanningSubject(null)
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
        onGenerated={(entry) => {
          setShowGenerator(false)
          if (onLessonGenerated) onLessonGenerated(entry)
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
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ 
              fontSize: 20, 
              fontWeight: 700, 
              color: '#1f2937',
              marginBottom: 4
            }}>
              {formattedDate}
            </h2>
            <p style={{ fontSize: 13, color: '#6b7280' }}>
              {scheduledLessons.length} scheduled &nbsp; {plannedLessons.length} planned
            </p>
          </div>

          {/* + Add lesson menu */}
          {learnerId && (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => { if (addMenuStep) { setAddMenuStep(null) } else { setAddMenuStep('top') } }}
                style={{
                  padding: '7px 14px',
                  fontSize: 18,
                  fontWeight: 700,
                  lineHeight: 1,
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer'
                }}
                title="Add lesson"
              >
                +
              </button>

              {addMenuStep && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setAddMenuStep(null)} />
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      right: 0,
                      background: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
                      zIndex: 10,
                      minWidth: 200,
                      overflow: 'hidden'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* ── top level ── */}
                    {addMenuStep === 'top' && (
                      <>
                        <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', borderBottom: '1px solid #f3f4f6' }}>
                          Add to {selectedDate}
                        </div>
                        {[
                          { label: '📅  Schedule Lesson', step: 'schedule' },
                          { label: '📝  Plan Lesson', step: 'plan' }
                        ].map(({ label, step }) => (
                          <button
                            key={step}
                            onClick={() => {
                              if (step === 'plan') loadCustomSubjectsDV()
                              setAddMenuStep(step)
                            }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 14px', fontSize: 13, fontWeight: 500, border: 'none', background: 'transparent', cursor: 'pointer', color: '#111827', textAlign: 'left' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                          >
                            {label} <span style={{ color: '#9ca3af', fontSize: 12 }}>›</span>
                          </button>
                        ))}
                      </>
                    )}

                    {/* ── schedule level ── */}
                    {addMenuStep === 'schedule' && (
                      <>
                        <button
                          onClick={() => setAddMenuStep('top')}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderBottom: '1px solid #f3f4f6', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        >
                          ‹ Schedule Lesson
                        </button>
                        {[
                          { label: '🗂  Owned', next: 'own' },
                          { label: '✨  Generate', next: 'generate' }
                        ].map(({ label, next }) => (
                          <button
                            key={next}
                            onClick={() => {
                              if (next === 'own') { loadOwnedLessons(); setAddMenuStep('own') }
                              else { setAddMenuStep(null); setShowGenerator(true) }
                            }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 14px', fontSize: 13, fontWeight: 500, border: 'none', background: 'transparent', cursor: 'pointer', color: '#111827', textAlign: 'left' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                          >
                            {label} {next === 'own' && <span style={{ color: '#9ca3af', fontSize: 12 }}>›</span>}
                          </button>
                        ))}
                      </>
                    )}

                    {/* ── owned lessons panel ── */}
                    {addMenuStep === 'own' && (
                      <>
                        <button
                          onClick={() => setAddMenuStep('schedule')}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderBottom: '1px solid #f3f4f6', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        >
                          ‹ Owned Lessons
                        </button>
                        <div style={{ maxHeight: 320, overflowY: 'auto', minWidth: 280 }}>
                          {loadingOwned ? (
                            <div style={{ padding: '20px 14px', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>Loading…</div>
                          ) : ownedLessons.length === 0 ? (
                            <div style={{ padding: '20px 14px', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>No owned lessons found</div>
                          ) : (
                            ownedLessons.map((lesson) => {
                              const key = `generated/${lesson.file}`
                              const busy = schedulingOwned === key
                              return (
                                <button
                                  key={lesson.file}
                                  disabled={busy}
                                  onClick={() => handleScheduleOwned(lesson)}
                                  style={{ display: 'block', width: '100%', padding: '9px 14px', fontSize: 13, border: 'none', background: 'transparent', cursor: busy ? 'wait' : 'pointer', textAlign: 'left', opacity: busy ? 0.6 : 1 }}
                                  onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = '#f3f4f6' }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                                >
                                  <div style={{ fontWeight: 500, color: '#111827', fontSize: 13 }}>{busy ? 'Scheduling…' : lesson.title}</div>
                                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{lesson.subject} · {lesson.grade}</div>
                                </button>
                              )
                            })
                          )}
                        </div>
                      </>
                    )}

                    {/* ── plan lesson — subject picker ── */}
                    {addMenuStep === 'plan' && (
                      <>
                        <button
                          onClick={() => setAddMenuStep('top')}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderBottom: '1px solid #f3f4f6', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        >
                          ‹ Choose Subject
                        </button>
                        <div style={{ maxHeight: 320, overflowY: 'auto', minWidth: 220 }}>
                          {[...CORE_SUBJECTS_DV, ...dvCustomSubjects.map((s) => s.name)].map((subject) => {
                            const busy = planningSubject === subject
                            const anyBusy = planningSubject !== null
                            return (
                              <button
                                key={subject}
                                disabled={anyBusy}
                                onClick={() => handleAutoGeneratePlan(subject)}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 14px', fontSize: 13, fontWeight: 500, border: 'none', background: 'transparent', cursor: anyBusy ? 'wait' : 'pointer', color: '#111827', textAlign: 'left', opacity: anyBusy && !busy ? 0.5 : 1 }}
                                onMouseEnter={(e) => { if (!anyBusy) e.currentTarget.style.background = '#f3f4f6' }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                              >
                                <span>{busy ? `Generating ${subject}…` : subject}</span>
                                {busy && <span style={{ fontSize: 11, color: '#6b7280' }}>⏳</span>}
                              </button>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
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
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={() => setAssignsOpenKey(assignsOpenKey === lesson.lesson_key ? null : lesson.lesson_key)}
                            style={{
                              padding: '6px 12px',
                              fontSize: 12,
                              fontWeight: 600,
                              background: '#fff',
                              color: '#166534',
                              border: '1px solid #86efac',
                              borderRadius: 4,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            Assigns
                          </button>
                          {assignsOpenKey === lesson.lesson_key && (
                            <>
                              <div
                                style={{ position: 'fixed', inset: 0, zIndex: 9 }}
                                onClick={() => setAssignsOpenKey(null)}
                              />
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                background: '#fff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                                zIndex: 10,
                                minWidth: '150px',
                                overflow: 'hidden'
                              }}>
                                {learners.map(l => (
                                  <button
                                    key={l.id}
                                    onClick={() => handleAssignLesson(lesson.lesson_key, l.id)}
                                    disabled={assigning}
                                    style={{
                                      display: 'block',
                                      width: '100%',
                                      textAlign: 'left',
                                      padding: '7px 12px',
                                      fontSize: '12px',
                                      border: 'none',
                                      background: 'transparent',
                                      cursor: assigning ? 'wait' : 'pointer',
                                      color: '#111827'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                  >
                                    {l.name}
                                  </button>
                                ))}
                                {learners.length > 1 && (
                                  <button
                                    onClick={() => handleAssignLesson(lesson.lesson_key, 'all')}
                                    disabled={assigning}
                                    style={{
                                      display: 'block',
                                      width: '100%',
                                      textAlign: 'left',
                                      padding: '7px 12px',
                                      fontSize: '12px',
                                      border: 'none',
                                      borderTop: '1px solid #e5e7eb',
                                      background: 'transparent',
                                      cursor: assigning ? 'wait' : 'pointer',
                                      color: '#166534',
                                      fontWeight: '600'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#f0fdf4'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                  >
                                    All Learners
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
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
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={() => {
                              const n = new Date()
                              setReschedulePickerMonth({ year: n.getFullYear(), month: n.getMonth() })
                              setReschedulePickerKey(reschedulePickerKey === lesson.lesson_key ? null : lesson.lesson_key)
                            }}
                            disabled={reschedulingBusy}
                            style={{
                              padding: '6px 12px',
                              fontSize: 12,
                              fontWeight: 600,
                              background: '#fff',
                              color: '#1e40af',
                              border: '1px solid #93c5fd',
                              borderRadius: 4,
                              cursor: reschedulingBusy ? 'wait' : 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                            title="Reschedule"
                          >
                            📅
                          </button>
                          {reschedulePickerKey === lesson.lesson_key && (
                            <>
                              <div
                                style={{ position: 'fixed', inset: 0, zIndex: 9 }}
                                onClick={() => setReschedulePickerKey(null)}
                              />
                              <div style={{
                                position: 'absolute',
                                bottom: '100%',
                                right: 0,
                                background: '#fff',
                                border: '1px solid #e5e7eb',
                                borderRadius: 8,
                                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                                zIndex: 10,
                                padding: 10,
                                width: 220,
                                marginBottom: 4
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setReschedulePickerMonth(pm => { const d = new Date(pm.year, pm.month - 1, 1); return { year: d.getFullYear(), month: d.getMonth() } }) }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '0 4px', color: '#374151' }}
                                  >‹</button>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1f2937' }}>
                                    {PICKER_MONTHS_DV[reschedulePickerMonth.month]} {reschedulePickerMonth.year}
                                  </span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setReschedulePickerMonth(pm => { const d = new Date(pm.year, pm.month + 1, 1); return { year: d.getFullYear(), month: d.getMonth() } }) }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '0 4px', color: '#374151' }}
                                  >›</button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
                                  {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                                    <div key={d} style={{ fontSize: 9, fontWeight: 600, textAlign: 'center', color: '#9ca3af' }}>{d}</div>
                                  ))}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                                  {buildPickerDaysDV(reschedulePickerMonth.year, reschedulePickerMonth.month).map((day, i) => (
                                    <button
                                      key={i}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (!day) return
                                        const mm = String(reschedulePickerMonth.month + 1).padStart(2, '0')
                                        const dd = String(day).padStart(2, '0')
                                        handleRescheduleLesson(lesson, `${reschedulePickerMonth.year}-${mm}-${dd}`)
                                      }}
                                      disabled={!day}
                                      style={{
                                        padding: '3px 0',
                                        fontSize: 11,
                                        background: !day ? 'transparent' : '#f9fafb',
                                        border: 'none',
                                        borderRadius: 4,
                                        cursor: day ? 'pointer' : 'default',
                                        color: day ? '#1f2937' : 'transparent',
                                        textAlign: 'center'
                                      }}
                                      onMouseEnter={(e) => { if (day) { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#fff' } }}
                                      onMouseLeave={(e) => { if (day) { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.color = '#1f2937' } }}
                                    >
                                      {day || ''}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
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
                          🗑️
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8 }}>
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
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={() => {
                              const n = new Date()
                              setReschedulePickerMonth({ year: n.getFullYear(), month: n.getMonth() })
                              setReschedulePickerKey(reschedulePickerKey === lesson.lesson_key ? null : lesson.lesson_key)
                            }}
                            disabled={reschedulingBusy}
                            style={{
                              padding: '6px 12px',
                              fontSize: 12,
                              fontWeight: 600,
                              background: '#fff',
                              color: '#1e40af',
                              border: '1px solid #93c5fd',
                              borderRadius: 4,
                              cursor: reschedulingBusy ? 'wait' : 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            Reschedule
                          </button>
                          {reschedulePickerKey === lesson.lesson_key && (
                            <>
                              <div
                                style={{ position: 'fixed', inset: 0, zIndex: 9 }}
                                onClick={() => setReschedulePickerKey(null)}
                              />
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                background: '#fff',
                                border: '1px solid #e5e7eb',
                                borderRadius: 8,
                                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                                zIndex: 10,
                                padding: 10,
                                width: 220,
                                marginTop: 4
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setReschedulePickerMonth(pm => { const d = new Date(pm.year, pm.month - 1, 1); return { year: d.getFullYear(), month: d.getMonth() } }) }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '0 4px', color: '#374151' }}
                                  >‹</button>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1f2937' }}>
                                    {PICKER_MONTHS_DV[reschedulePickerMonth.month]} {reschedulePickerMonth.year}
                                  </span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setReschedulePickerMonth(pm => { const d = new Date(pm.year, pm.month + 1, 1); return { year: d.getFullYear(), month: d.getMonth() } }) }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '0 4px', color: '#374151' }}
                                  >›</button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
                                  {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                                    <div key={d} style={{ fontSize: 9, fontWeight: 600, textAlign: 'center', color: '#9ca3af' }}>{d}</div>
                                  ))}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                                  {buildPickerDaysDV(reschedulePickerMonth.year, reschedulePickerMonth.month).map((day, i) => (
                                    <button
                                      key={i}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (!day) return
                                        const mm = String(reschedulePickerMonth.month + 1).padStart(2, '0')
                                        const dd = String(day).padStart(2, '0')
                                        handleRescheduleLesson(lesson, `${reschedulePickerMonth.year}-${mm}-${dd}`)
                                      }}
                                      disabled={!day}
                                      style={{
                                        padding: '3px 0',
                                        fontSize: 11,
                                        background: !day ? 'transparent' : '#f9fafb',
                                        border: 'none',
                                        borderRadius: 4,
                                        cursor: day ? 'pointer' : 'default',
                                        color: day ? '#1f2937' : 'transparent',
                                        textAlign: 'center'
                                      }}
                                      onMouseEnter={(e) => { if (day) { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#fff' } }}
                                      onMouseLeave={(e) => { if (day) { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.color = '#1f2937' } }}
                                    >
                                      {day || ''}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            if (confirm(`Remove "${lessonName}" from this day?`)) {
                              handleRemoveScheduledLessonById(lesson.id)
                            }
                          }}
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
                    )}
                  </div>
                </div>
              )
            })}
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
