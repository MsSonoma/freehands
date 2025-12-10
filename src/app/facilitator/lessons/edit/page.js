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
    if (!pinChecked || !lessonKey) return
    
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
  }, [pinChecked, lessonKey])

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
          generationCount: count
        })
      })
      
      if (!res.ok) {
        return
      }

      // Only reload if explicitly requested (e.g., after user saves selections)
      if (shouldReload) {
        const loadRes = await fetch(`/api/visual-aids/load?lessonKey=${encodeURIComponent(lessonKey)}`, {
          headers: token ? {
            'Authorization': `Bearer ${token}`
          } : {}
        })

        if (loadRes.ok) {
          const visualAidsData = await loadRes.json()
          setVisualAidsImages(visualAidsData.generatedImages || [])
          setGenerationCount(visualAidsData.generationCount || 0)
        }
      }
    } catch (err) {
      // Silent error handling
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
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleCancel}
            disabled={saving}
            style={{
              padding: '8px 16px',
              background: '#f3f4f6',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              cursor: saving ? 'wait' : 'pointer',
              fontSize: 14,
              fontWeight: 600
            }}
          >
            ← Back
          </button>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>
            Edit Lesson
          </h1>
        </div>
        
        <button
          onClick={handleGenerateVisualAids}
          disabled={saving || generatingVisualAids || !lesson?.teachingNotes}
          style={{
            padding: '8px 16px',
            background: (!lesson?.teachingNotes || generatingVisualAids) ? '#9ca3af' : '#6366f1',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: (!lesson?.teachingNotes || generatingVisualAids) ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 600
          }}
          title={!lesson?.teachingNotes ? 'Add teaching notes first' : (visualAidsImages.length > 0 ? 'View and manage visual aids' : 'Generate visual aids from teaching notes')}
        >
          {generatingVisualAids 
            ? (generationProgress || 'Generating...') 
            : (visualAidsImages.length > 0 ? '🖼️ Visual Aids' : '🖼️ Generate Visual Aids')}
        </button>
      </div>

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
          onNotes={() => setShowNotes(true)}
          onSchedule={() => setShowSchedule(true)}
          onAssign={() => setShowAssign(true)}
          onDelete={() => setShowDeleteConfirm(true)}
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
      
      {/* Notes Modal - Placeholder for now */}
      {showNotes && (
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
            <h3 style={{ marginTop: 0 }}>Lesson Notes</h3>
            <p style={{ color: '#6b7280', fontSize: 14 }}>Notes functionality requires learner context. Please use the main Lessons page to add notes when a learner is selected.</p>
            <button
              onClick={() => setShowNotes(false)}
              style={{
                marginTop: 16,
                padding: '8px 16px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
      
      {/* Schedule Modal - Placeholder for now */}
      {showSchedule && (
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
            <h3 style={{ marginTop: 0 }}>Schedule Lesson</h3>
            <p style={{ color: '#6b7280', fontSize: 14 }}>Schedule functionality requires learner context. Please use the main Lessons page to schedule when a learner is selected.</p>
            <button
              onClick={() => setShowSchedule(false)}
              style={{
                marginTop: 16,
                padding: '8px 16px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
      
      {/* Assign Modal - Placeholder for now */}
      {showAssign && (
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
            <h3 style={{ marginTop: 0 }}>Assign to Learners</h3>
            <p style={{ color: '#6b7280', fontSize: 14 }}>Assign functionality allows you to make lessons available to specific learners. Please use the main Lessons page to assign when viewing your learner list.</p>
            <button
              onClick={() => setShowAssign(false)}
              style={{
                marginTop: 16,
                padding: '8px 16px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Close
            </button>
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
              Are you sure you want to delete "{lesson?.title}"? This action cannot be undone.
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
