'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import LessonEditor from '@/components/LessonEditor'
import VisualAidsCarousel from '@/components/VisualAidsCarousel'
import { ensurePinAllowed } from '@/app/lib/pinGate'

function EditLessonContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const lessonKey = searchParams.get('key')
  const isNewLesson = searchParams.get('new') === '1'
  
  const [pinChecked, setPinChecked] = useState(false)
  const [lesson, setLesson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showVisualAidsCarousel, setShowVisualAidsCarousel] = useState(false)
  const [visualAidsImages, setVisualAidsImages] = useState([])
  const [generatingVisualAids, setGeneratingVisualAids] = useState(false)
  const [generationProgress, setGenerationProgress] = useState('')
  const [generationCount, setGenerationCount] = useState(0)
  const MAX_GENERATIONS = 4
  
  // AI Rewrite loading states
  const [rewritingDescription, setRewritingDescription] = useState(false)
  const [rewritingTeachingNotes, setRewritingTeachingNotes] = useState(false)
  const [rewritingVocabDefinition, setRewritingVocabDefinition] = useState({})
  
  // New states for Notes, Schedule, Assign, Delete functionality
  const [showNotes, setShowNotes] = useState(false)
  const [lessonNote, setLessonNote] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduledDate, setScheduledDate] = useState(null) // null, 'today', or 'YYYY-MM-DD'
  const [showAssign, setShowAssign] = useState(false)
  const [learners, setLearners] = useState([])
  const [assignedLearners, setAssignedLearners] = useState([]) // Array of learner IDs
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showLearnerSelect, setShowLearnerSelect] = useState(null) // 'notes', 'schedule', or 'assign'
  const [selectedLearnerId, setSelectedLearnerId] = useState(null)
  const [selectedLearner, setSelectedLearner] = useState(null)
  const [loadingLearners, setLoadingLearners] = useState(false)

  // Check PIN requirement on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const allowed = await ensurePinAllowed('facilitator-page');
        if (!allowed) {
          router.push('/');
          return;
        }
        if (!cancelled) setPinChecked(true);
      } catch (e) {
        if (!cancelled) setPinChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  // Load lesson
  useEffect(() => {
    if (!pinChecked) return

    // New lesson mode: start blank, do not create anything server-side until Save.
    if (isNewLesson) {
      setLesson({
        title: '',
        subject: 'math',
        grade: '',
        difficulty: '',
        blurb: '',
        teachingNotes: '',
        vocab: [],
        multiplechoice: [],
        truefalse: [],
        shortanswer: [],
        fillintheblank: []
      })
      setLoading(false)
      setError('')
      return
    }

    if (!lessonKey) return
    
    let cancelled = false
    ;(async () => {
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
        
        if (!cancelled) {
          setLesson(lessonData)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load lesson')
          setLoading(false)
        }
      }
    })()
    
    return () => { cancelled = true }
  }, [pinChecked, lessonKey, isNewLesson])

  // Load learners list
  useEffect(() => {
    if (!pinChecked) return
    
    let cancelled = false
    ;(async () => {
      try {
        setLoadingLearners(true)
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.id) return
        
        const { data, error } = await supabase
          .from('learners')
          .select('id, name, approved_lessons, lesson_notes')
          .eq('facilitator_id', session.user.id)
          .order('name')
        
        if (error) throw error
        
        if (!cancelled) {
          setLearners(data || [])
        }
      } catch (err) {
        console.error('Failed to load learners:', err)
      } finally {
        if (!cancelled) setLoadingLearners(false)
      }
    })()
    
    return () => { cancelled = true }
  }, [pinChecked])

  // Load visual aids separately from the database
  useEffect(() => {
    if (!pinChecked || !lessonKey) return
    
    let cancelled = false
    ;(async () => {
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
          return
        }
        
        const visualAidsData = await res.json()
        
        if (!cancelled) {
          setVisualAidsImages(visualAidsData.generatedImages || [])
          setGenerationCount(visualAidsData.generationCount || 0)
        }
      } catch (err) {
        // Silent error handling
      }
    })()
    
    return () => { cancelled = true }
  }, [pinChecked, lessonKey])

  const handleSave = async (updatedLesson) => {
    setSaving(true)
    setError('')
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (isNewLesson) {
        const res = await fetch('/api/facilitator/lessons/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify({ lesson: updatedLesson })
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => null)
          throw new Error(errorData?.error || 'Failed to create lesson')
        }

        // Success - go back to lessons page
        router.push('/facilitator/lessons')
        return
      }
      
      // Visual aids are stored separately in the database, not in the lesson file
      const res = await fetch('/api/lesson-edit', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          lessonKey: lessonKey,
          updates: updatedLesson
        })
      })
      
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to save lesson')
      }
      
      // Success - go back to lessons page
      router.push('/facilitator/lessons')
    } catch (err) {
      setError(err.message || 'Failed to save lesson')
      setSaving(false)
    }
  }

  const handleCancel = () => {
    router.push('/facilitator/lessons')
  }

  // Auto-save visual aids data to database (separate from lesson file)
  const saveVisualAidsData = async (images, count, shouldReload = false) => {
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const selectedImages = images.filter(img => img.selected)
      const persistGenerated = !shouldReload
      
      const res = await fetch('/api/visual-aids/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          lessonKey: lessonKey,
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

            // Make details copy/paste friendly (DevTools often collapses nested objects).
            try {
              console.error('[visual-aids/save] details.json:', JSON.stringify(errorData.details, null, 2))
            } catch {
              console.error('[visual-aids/save] details:', errorData.details)
            }

            // Add a tiny hint from the first failure message (kept short for UI).
            if (detailMsg) {
              const clipped = detailMsg.length > 140 ? `${detailMsg.slice(0, 140)}...` : detailMsg
              message = `${message} - ${clipped}`
            }
          }
        } catch {}
        setError(message)
        return
      }

      // Only reload if explicitly requested (e.g., after user saves selections)
      if (shouldReload) {
        const loadRes = await fetch(`/api/visual-aids/load?lessonKey=${encodeURIComponent(lessonKey)}`, {
          headers: token ? {
            'Authorization': `Bearer ${token}`
          } : {}
        })

        if (!loadRes.ok) {
          let message = 'Saved visual aids, but failed to reload them'
          try {
            const errorData = await loadRes.json()
            if (errorData?.error) message = errorData.error
          } catch {}
          setError(message)
          return
        }

        const visualAidsData = await loadRes.json()
        setVisualAidsImages(visualAidsData.generatedImages || [])
        setGenerationCount(visualAidsData.generationCount || 0)
      }
    } catch (err) {
      setError(err?.message || 'Failed to save visual aids')
    }
  }

  const handleGenerateVisualAids = async () => {
    if (!lesson?.teachingNotes) {
      setError('Teaching notes are required to generate visual aids')
      return
    }

    // Open the carousel first (user can edit prompt before generating)
    setShowVisualAidsCarousel(true)
  }

  const handleGenerateMore = async (customPrompt = '') => {
    if (!lesson?.teachingNotes) {
      return
    }

    // Check if limit reached
    if (generationCount >= MAX_GENERATIONS) {
      setError(`You've reached the maximum of ${MAX_GENERATIONS} generations for this lesson`)
      return
    }

    setGeneratingVisualAids(true)
    const isFirstGeneration = visualAidsImages.length === 0
    setGenerationProgress(isFirstGeneration ? 'Generating 3 images...' : 'Generating 3 more images...')

    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch('/api/visual-aids/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          teachingNotes: lesson.teachingNotes,
          lessonTitle: lesson.title,
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
      
      // Auto-save the generated images and count to the lesson file
      await saveVisualAidsData(allImages, newCount)
    } catch (err) {
      setError(err.message || 'Failed to generate more visual aids')
      setGenerationProgress('')
    } finally {
      setGeneratingVisualAids(false)
    }
  }

  const handleUploadImage = async (file) => {
    try {
      // Convert image to base64 data URL for display
      const reader = new FileReader()
      const dataURL = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Create new image object
      const newImage = {
        url: dataURL,
        prompt: `Uploaded: ${file.name}`,
        description: '', // Start with empty description for user to fill in
        id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        uploaded: true
      }

      // Add to images and auto-save
      const allImages = [...visualAidsImages, newImage]
      setVisualAidsImages(allImages)
      await saveVisualAidsData(allImages, generationCount)
      
      return newImage
    } catch (err) {
      setError('Failed to upload image')
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
      setError('Failed to rewrite text')
      return null
    }
  }

  // AI Rewrite handlers for Lesson Editor
  const handleRewriteLessonDescription = async (text) => {
    if (!text.trim()) return
    setRewritingDescription(true)
    try {
      const rewritten = await handleRewriteDescription(text, lesson?.title || 'lesson', 'lesson-description')
      if (rewritten && lesson) {
        setLesson({ ...lesson, blurb: rewritten })
      }
    } finally {
      setRewritingDescription(false)
    }
  }

  const handleRewriteLessonTeachingNotes = async (text) => {
    if (!text.trim()) return
    setRewritingTeachingNotes(true)
    try {
      const rewritten = await handleRewriteDescription(text, lesson?.title || 'lesson', 'teaching-notes')
      if (rewritten && lesson) {
        setLesson({ ...lesson, teachingNotes: rewritten })
      }
    } finally {
      setRewritingTeachingNotes(false)
    }
  }

  const handleRewriteVocabDefinition = async (definition, term, index) => {
    if (!definition.trim()) return
    setRewritingVocabDefinition(prev => ({ ...prev, [index]: true }))
    try {
      const rewritten = await handleRewriteDescription(definition, term || 'vocabulary term', 'vocabulary-definition')
      if (rewritten && lesson && lesson.vocab && lesson.vocab[index]) {
        const updatedVocab = [...lesson.vocab]
        updatedVocab[index] = { ...updatedVocab[index], definition: rewritten }
        setLesson({ ...lesson, vocab: updatedVocab })
      }
    } finally {
      setRewritingVocabDefinition(prev => ({ ...prev, [index]: false }))
    }
  }

  const handleGeneratePrompt = async (teachingNotes, lessonTitle) => {
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
    } catch (err) {
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
    
    // Auto-save the selection and reload to get permanent URLs
    await saveVisualAidsData(updatedImages, generationCount, true)
  }

  if (!pinChecked || loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ fontSize: 16, color: '#6b7280' }}>Loading...</div>
      </div>
    )
  }

  if (error && !lesson) {
    return (
      <div style={{ padding: 40, maxWidth: 800, margin: '0 auto' }}>
        <div style={{ color: '#dc2626', marginBottom: 20 }}>{error}</div>
        <button
          onClick={() => router.push('/facilitator/lessons')}
          style={{
            padding: '10px 20px',
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer'
          }}
        >
          Back to Lessons
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      {error && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {lesson && (
        <LessonEditor
          initialLesson={lesson}
          onSave={handleSave}
          onCancel={handleCancel}
          busy={saving}
          onRewriteDescription={handleRewriteLessonDescription}
          onRewriteTeachingNotes={handleRewriteLessonTeachingNotes}
          onRewriteVocabDefinition={handleRewriteVocabDefinition}
          rewritingDescription={rewritingDescription}
          rewritingTeachingNotes={rewritingTeachingNotes}
          rewritingVocabDefinition={rewritingVocabDefinition}
          onNotes={!isNewLesson ? (() => setShowLearnerSelect('notes')) : undefined}
          onSchedule={!isNewLesson ? (() => setShowLearnerSelect('schedule')) : undefined}
          onAssign={!isNewLesson ? (() => setShowLearnerSelect('assign')) : undefined}
          onDelete={!isNewLesson ? (() => setShowDeleteConfirm(true)) : undefined}
          onGenerateVisualAids={!isNewLesson ? handleGenerateVisualAids : undefined}
          generatingVisualAids={!isNewLesson ? generatingVisualAids : false}
          visualAidsButtonText={!isNewLesson
            ? (generatingVisualAids
              ? (generationProgress || 'Generating...')
              : (visualAidsImages.length > 0 ? '🖼️ Visual Aids' : '🖼️ Generate Visual Aids'))
            : '🖼️ Visual Aids'}
        />
      )}

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
          teachingNotes={lesson?.teachingNotes || ''}
          lessonTitle={lesson?.title || ''}
          generationProgress={generationProgress}
          generationCount={generationCount}
          maxGenerations={MAX_GENERATIONS}
        />
      )}
      
      {/* Learner Selection Dropdown */}
      {showLearnerSelect && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}
        onClick={() => setShowLearnerSelect(null)}
        >
          <div style={{
            background: '#fff',
            borderRadius: 8,
            padding: 24,
            maxWidth: 400,
            width: '90%'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Select Learner</h3>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>
              {showLearnerSelect === 'notes' && 'Choose a learner to add notes for this lesson'}
              {showLearnerSelect === 'schedule' && 'Choose a learner to schedule this lesson for'}
              {showLearnerSelect === 'assign' && 'Choose a learner to assign this lesson to'}
            </p>
            
            {loadingLearners ? (
              <p style={{ color: '#6b7280', fontSize: 14 }}>Loading learners...</p>
            ) : learners.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: 14 }}>No learners found. Please add a learner first.</p>
            ) : (
              <div style={{ marginBottom: 16 }}>
                {learners.map(learner => (
                  <button
                    key={learner.id}
                    onClick={() => {
                      setSelectedLearnerId(learner.id)
                      setSelectedLearner(learner)
                      setShowLearnerSelect(null)
                      
                      // Open the appropriate modal
                      if (showLearnerSelect === 'notes') {
                        // Load existing note if any
                        const existingNote = (learner.lesson_notes || {})[lessonKey] || ''
                        setLessonNote(existingNote)
                        setShowNotes(true)
                      } else if (showLearnerSelect === 'schedule') {
                        setShowSchedule(true)
                      } else if (showLearnerSelect === 'assign') {
                        // Load current assignment status
                        const isAssigned = !!(learner.approved_lessons || {})[lessonKey]
                        setAssignedLearners(isAssigned ? [learner.id] : [])
                        setShowAssign(true)
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '12px',
                      marginBottom: 8,
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      background: '#fff',
                      color: '#1f2937',
                      fontSize: 14,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontWeight: 500
                    }}
                    onMouseOver={(e) => e.target.style.background = '#f3f4f6'}
                    onMouseOut={(e) => e.target.style.background = '#fff'}
                  >
                    {learner.name}
                  </button>
                ))}
              </div>
            )}
            
            <button
              onClick={() => setShowLearnerSelect(null)}
              style={{
                padding: '8px 16px',
                background: '#fff',
                color: '#6b7280',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {showNotes && selectedLearnerId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}
        onClick={() => setShowNotes(false)}
        >
          <div style={{
            background: '#fff',
            borderRadius: 8,
            padding: 24,
            maxWidth: 500,
            width: '90%'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>📝 Lesson Notes</h3>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 8 }}>
              {selectedLearner?.name} - {lesson?.title}
            </p>
            <textarea
              value={lessonNote}
              onChange={(e) => setLessonNote(e.target.value)}
              placeholder="Add notes about this lesson for this learner..."
              style={{
                width: '100%',
                minHeight: 120,
                padding: 12,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical',
                marginBottom: 16,
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  try {
                    setSaving(true)
                    const supabase = getSupabaseClient()
                    
                    // Load current notes
                    const { data: currentData } = await supabase
                      .from('learners')
                      .select('lesson_notes')
                      .eq('id', selectedLearnerId)
                      .maybeSingle()
                    
                    const updatedNotes = { ...(currentData?.lesson_notes || {}) }
                    
                    if (lessonNote.trim()) {
                      updatedNotes[lessonKey] = lessonNote.trim()
                    } else {
                      delete updatedNotes[lessonKey]
                    }
                    
                    const { error } = await supabase
                      .from('learners')
                      .update({ lesson_notes: updatedNotes })
                      .eq('id', selectedLearnerId)
                    
                    if (error) throw error
                    
                    // Update learners list
                    setLearners(prev => prev.map(l => 
                      l.id === selectedLearnerId ? { ...l, lesson_notes: updatedNotes } : l
                    ))
                    
                    setShowNotes(false)
                  } catch (err) {
                    alert('Failed to save note: ' + (err.message || 'Unknown error'))
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: saving ? 'wait' : 'pointer',
                  fontWeight: 600,
                  fontSize: 14
                }}
              >
                {saving ? 'Saving...' : 'Save Note'}
              </button>
              <button
                onClick={() => setShowNotes(false)}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#fff',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  cursor: saving ? 'wait' : 'pointer',
                  fontWeight: 600,
                  fontSize: 14
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Schedule Modal */}
      {showSchedule && selectedLearnerId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}
        onClick={() => setShowSchedule(false)}
        >
          <div style={{
            background: '#fff',
            borderRadius: 8,
            padding: 24,
            maxWidth: 400,
            width: '90%'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>📅 Schedule Lesson</h3>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 8 }}>
              {selectedLearner?.name} - {lesson?.title}
            </p>
            
            <input
              type="date"
              defaultValue={new Date().toISOString().split('T')[0]}
              id="schedule-date-input"
              style={{
                width: '100%',
                padding: 10,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14,
                marginBottom: 16,
                boxSizing: 'border-box'
              }}
            />
            
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  const dateInput = document.getElementById('schedule-date-input')
                  const selectedDate = dateInput?.value
                  
                  if (!selectedDate) {
                    alert('Please select a date')
                    return
                  }
                  
                  try {
                    setSaving(true)
                    const supabase = getSupabaseClient()
                    const { data: { session } } = await supabase.auth.getSession()
                    const token = session?.access_token
                    
                    if (!token) {
                      alert('Not authenticated')
                      return
                    }
                    
                    const response = await fetch('/api/lesson-schedule', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({
                        learnerId: selectedLearnerId,
                        lessonKey: lessonKey,
                        scheduledDate: selectedDate
                      })
                    })
                    
                    if (!response.ok) {
                      const errorData = await response.json()
                      throw new Error(errorData.error || 'Failed to schedule')
                    }
                    
                    alert(`Lesson scheduled for ${selectedDate}`)
                    setShowSchedule(false)
                  } catch (err) {
                    alert('Failed to schedule: ' + (err.message || 'Unknown error'))
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: saving ? 'wait' : 'pointer',
                  fontWeight: 600,
                  fontSize: 14
                }}
              >
                {saving ? 'Scheduling...' : 'Schedule'}
              </button>
              <button
                onClick={() => setShowSchedule(false)}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#fff',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  cursor: saving ? 'wait' : 'pointer',
                  fontWeight: 600,
                  fontSize: 14
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Assign Modal */}
      {showAssign && selectedLearnerId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}
        onClick={() => setShowAssign(false)}
        >
          <div style={{
            background: '#fff',
            borderRadius: 8,
            padding: 24,
            maxWidth: 400,
            width: '90%'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>✓ Assign Lesson</h3>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>
              {selectedLearner?.name} - {lesson?.title}
            </p>
            
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>
              {assignedLearners.includes(selectedLearnerId) 
                ? 'This lesson is currently available to this learner. Click to remove access.'
                : 'This lesson is not currently available to this learner. Click to grant access.'}
            </p>
            
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={async () => {
                  try {
                    setSaving(true)
                    const supabase = getSupabaseClient()
                    
                    // Load current approved lessons
                    const { data: currentData } = await supabase
                      .from('learners')
                      .select('approved_lessons')
                      .eq('id', selectedLearnerId)
                      .maybeSingle()
                    
                    const updatedApproved = { ...(currentData?.approved_lessons || {}) }
                    const isCurrentlyAssigned = !!updatedApproved[lessonKey]
                    
                    if (isCurrentlyAssigned) {
                      delete updatedApproved[lessonKey]
                    } else {
                      updatedApproved[lessonKey] = true
                    }
                    
                    const { error } = await supabase
                      .from('learners')
                      .update({ approved_lessons: updatedApproved })
                      .eq('id', selectedLearnerId)
                    
                    if (error) throw error
                    
                    // Update learners list
                    setLearners(prev => prev.map(l => 
                      l.id === selectedLearnerId ? { ...l, approved_lessons: updatedApproved } : l
                    ))
                    
                    alert(isCurrentlyAssigned 
                      ? 'Lesson access removed' 
                      : 'Lesson assigned successfully')
                    setShowAssign(false)
                  } catch (err) {
                    alert('Failed to update assignment: ' + (err.message || 'Unknown error'))
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: assignedLearners.includes(selectedLearnerId) ? '#dc2626' : '#059669',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: saving ? 'wait' : 'pointer',
                  fontWeight: 600,
                  fontSize: 14
                }}
              >
                {saving ? 'Updating...' : (assignedLearners.includes(selectedLearnerId) ? 'Remove Access' : 'Grant Access')}
              </button>
              <button
                onClick={() => setShowAssign(false)}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#fff',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  cursor: saving ? 'wait' : 'pointer',
                  fontWeight: 600,
                  fontSize: 14
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}
        onClick={() => setShowDeleteConfirm(false)}
        >
          <div style={{
            background: '#fff',
            borderRadius: 8,
            padding: 24,
            maxWidth: 450,
            width: '90%'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, color: '#dc2626' }}>Delete Lesson?</h3>
            <p style={{ color: '#374151', fontSize: 14 }}>
              Are you sure you want to delete &ldquo;{lesson?.title}&rdquo;? This action cannot be undone.
            </p>
            <p style={{ color: '#6b7280', fontSize: 13, marginTop: 8 }}>
              Note: Only generated lessons can be deleted. Public lessons cannot be removed.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button
                onClick={async () => {
                  if (!lessonKey || !lessonKey.startsWith('generated/')) {
                    setError('Only generated lessons can be deleted')
                    setShowDeleteConfirm(false)
                    return
                  }
                  
                  try {
                    setSaving(true)
                    const supabase = getSupabaseClient()
                    const { data: { session } } = await supabase.auth.getSession()
                    const token = session?.access_token
                    
                    const filename = lessonKey.replace('generated/', '')
                    const { data: { user } } = await supabase.auth.getUser()
                    
                    if (!user) {
                      setError('Not authenticated')
                      return
                    }
                    
                    // Delete from Supabase Storage
                    const filePath = `facilitator-lessons/${user.id}/${filename}`
                    const { error: deleteError } = await supabase.storage
                      .from('lessons')
                      .remove([filePath])
                    
                    if (deleteError) {
                      setError('Failed to delete lesson: ' + deleteError.message)
                      return
                    }
                    
                    // Success - redirect to lessons page
                    router.push('/facilitator/lessons')
                  } catch (err) {
                    setError('Error deleting lesson: ' + (err.message || String(err)))
                  } finally {
                    setSaving(false)
                    setShowDeleteConfirm(false)
                  }
                }}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: saving ? 'wait' : 'pointer',
                  fontWeight: 600
                }}
              >
                {saving ? 'Deleting...' : 'Delete Lesson'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: '#fff',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  cursor: saving ? 'wait' : 'pointer',
                  fontWeight: 600
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function EditLessonPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ fontSize: 16, color: '#6b7280' }}>Loading...</div>
      </div>
    }>
      <EditLessonContent />
    </Suspense>
  )
}
