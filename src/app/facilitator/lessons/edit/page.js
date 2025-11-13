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
          console.error('Failed to load visual aids')
          return
        }
        
        const visualAidsData = await res.json()
        
        if (!cancelled) {
          setVisualAidsImages(visualAidsData.generatedImages || [])
          setGenerationCount(visualAidsData.generationCount || 0)
        }
      } catch (err) {
        console.error('Error loading visual aids:', err)
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
  const saveVisualAidsData = async (images, count) => {
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
        console.error('Failed to auto-save visual aids data')
      }
    } catch (err) {
      console.error('Error auto-saving visual aids:', err)
    }
  }

  const handleGenerateVisualAids = async () => {
    if (!lesson?.teachingNotes) {
      setError('Teaching notes are required to generate visual aids')
      return
    }

    // If we already have images, just open the carousel (don't generate new ones)
    if (visualAidsImages.length > 0) {
      setShowVisualAidsCarousel(true)
      return
    }

    // Check if limit reached (shouldn't happen on first generation, but safe check)
    if (generationCount >= MAX_GENERATIONS) {
      setError(`You've reached the maximum of ${MAX_GENERATIONS} generations for this lesson`)
      return
    }

    // First time - generate initial 3 images
    setGeneratingVisualAids(true)
    setGenerationProgress('Starting generation...')
    setError('')

    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      // Generate images one at a time to show progress
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
            teachingNotes: lesson.teachingNotes,
            lessonTitle: lesson.title,
            count: 1
          })
        })

        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.error || 'Failed to generate visual aids')
        }

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
      
      // Auto-save the generated images and count to the lesson file
      const allImages = [...visualAidsImages, ...newImages]
      await saveVisualAidsData(allImages, newCount)
      
      if (newImages.length > 0) {
        setShowVisualAidsCarousel(true)
      }
    } catch (err) {
      setError(err.message || 'Failed to generate visual aids')
      setGenerationProgress('')
    } finally {
      setGeneratingVisualAids(false)
    }
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
    setGenerationProgress('Generating 3 more images...')

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
      console.error('Error uploading image:', err)
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
      console.error('Error rewriting text:', err)
      setError('Failed to rewrite text')
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
    
    setVisualAidsImages(updatedImages)
    setShowVisualAidsCarousel(false)
    
    // Auto-save the selection
    await saveVisualAidsData(updatedImages, generationCount)
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
          generating={generatingVisualAids}
          teachingNotes={lesson?.teachingNotes || ''}
          lessonTitle={lesson?.title || ''}
          generationProgress={generationProgress}
          generationCount={generationCount}
          maxGenerations={MAX_GENERATIONS}
        />
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
