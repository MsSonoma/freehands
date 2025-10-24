'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import LessonEditor from '@/components/LessonEditor'
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
        
        const headers = {}
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }
        
        const res = await fetch(`/api/lesson-file?key=${encodeURIComponent(lessonKey)}`, {
          headers
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

  const handleSave = async (updatedLesson) => {
    setSaving(true)
    setError('')
    
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
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
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
