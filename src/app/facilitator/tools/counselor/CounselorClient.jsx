'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ensurePinAllowed } from '@/app/lib/pinGate'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier } from '@/app/lib/entitlements'
import { fetchLearnerTranscript } from '@/app/lib/learnerTranscript'
import ClipboardOverlay from './ClipboardOverlay'

export default function CounselorClient() {
  const router = useRouter()
  const [pinChecked, setPinChecked] = useState(false)
  const [tierChecked, setTierChecked] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [currentSessionTokens, setCurrentSessionTokens] = useState(0)
  
  // Learner selection
  const [learners, setLearners] = useState([])
  const [selectedLearnerId, setSelectedLearnerId] = useState('none')
  const [learnerTranscript, setLearnerTranscript] = useState('')
  
  // Conversation state
  const [conversationHistory, setConversationHistory] = useState([])
  const [userInput, setUserInput] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Draft summary state
  const [draftSummary, setDraftSummary] = useState('')
  const [showClipboard, setShowClipboard] = useState(false)
  const [clipboardInstructions, setClipboardInstructions] = useState(false)
  
  // Caption state (similar to session page)
  const [captionText, setCaptionText] = useState('')
  const [captionSentences, setCaptionSentences] = useState([])
  const [captionIndex, setCaptionIndex] = useState(0)
  
  // Audio/Video refs
  const videoRef = useRef(null)
  const audioRef = useRef(null)
  const captionBoxRef = useRef(null)
  
  // Mute state
  const [muted, setMuted] = useState(false)
  
  // Layout state
  const [isMobileLandscape, setIsMobileLandscape] = useState(false)
  const [videoMaxHeight, setVideoMaxHeight] = useState(null)

  // Skip PIN check entirely for window shopping experience
  // Users can browse freely; PIN only needed for actual functionality (checked later)
  useEffect(() => {
    setPinChecked(true)
  }, [])

  // Check premium tier
  useEffect(() => {
    if (!pinChecked) return
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession()
          const uid = session?.user?.id
          if (uid) {
            const { data } = await supabase.from('profiles').select('plan_tier').eq('id', uid).maybeSingle()
            const tier = (data?.plan_tier || 'free').toLowerCase()
            const ent = featuresForTier(tier)
            if (!cancelled) {
              setHasAccess(ent.facilitatorTools)
              setTierChecked(true)
            }
          } else {
            if (!cancelled) {
              setHasAccess(false)
              setTierChecked(true)
            }
          }
        } else {
          if (!cancelled) {
            setHasAccess(false)
            setTierChecked(true)
          }
        }
      } catch {
        if (!cancelled) {
          setHasAccess(false)
          setTierChecked(true)
        }
      }
    })()
    return () => { cancelled = true }
  }, [pinChecked])

  // Load learners list
  useEffect(() => {
    if (!hasAccess || !tierChecked) return
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        if (supabase) {
          const { data } = await supabase.from('learners').select('*').order('created_at', { ascending: false })
          if (!cancelled && data) {
            setLearners(data)
          }
        }
      } catch (err) {
        console.error('[Mr. Mentor] Failed to load learners:', err)
      }
    })()
    return () => { cancelled = true }
  }, [hasAccess, tierChecked])

  // Load learner transcript when selection changes
  useEffect(() => {
    if (selectedLearnerId === 'none') {
      setLearnerTranscript('')
      return
    }
    
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        if (supabase) {
          const transcript = await fetchLearnerTranscript(selectedLearnerId, supabase)
          if (!cancelled) {
            setLearnerTranscript(transcript)
            console.log('[Mr. Mentor] Loaded learner transcript:', transcript.substring(0, 200))
          }
        }
      } catch (err) {
        console.error('[Mr. Mentor] Failed to load learner transcript:', err)
        if (!cancelled) setLearnerTranscript('')
      }
    })()
    return () => { cancelled = true }
  }, [selectedLearnerId])

  // Dispatch title to header (like session page)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.dispatchEvent(new CustomEvent('ms:session:title', { detail: 'Mr. Mentor' }))
    } catch {}
    return () => {
      try {
        window.dispatchEvent(new CustomEvent('ms:session:title', { detail: '' }))
      } catch {}
    }
  }, [])

  // Load conversation from localStorage on mount
  useEffect(() => {
    if (!hasAccess || !tierChecked) return
    try {
      const saved = localStorage.getItem('mr_mentor_conversation')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setConversationHistory(parsed)
          // Display last message in captions if available
          if (parsed.length > 0) {
            const lastMsg = parsed[parsed.length - 1]
            if (lastMsg.role === 'assistant') {
              setCaptionText(lastMsg.content)
              const sentences = splitIntoSentences(lastMsg.content)
              setCaptionSentences(sentences)
              setCaptionIndex(sentences.length - 1)
            }
          }
        }
      }
    } catch {}
  }, [hasAccess, tierChecked])

  // Save conversation to localStorage whenever it changes
  useEffect(() => {
    if (!hasAccess || conversationHistory.length === 0) return
    try {
      localStorage.setItem('mr_mentor_conversation', JSON.stringify(conversationHistory))
    } catch {}
  }, [conversationHistory, hasAccess])

  // Detect landscape orientation
  useEffect(() => {
    const check = () => {
      try {
        const w = window.innerWidth
        const h = window.innerHeight
        setIsMobileLandscape(w > h && (w / h) >= 1.0)
        
        // Calculate video height for landscape
        if (w > h) {
          const hMin = 375
          const hMax = 600
          let frac
          if (h <= hMin) {
            frac = 0.44
          } else if (h >= hMax) {
            frac = 0.65
          } else {
            const t = (h - hMin) / (hMax - hMin)
            frac = 0.44 + t * (0.65 - 0.44)
          }
          // Subtract padding (16px top, 16px in landscape)
          const target = Math.round(h * frac) - 16
          setVideoMaxHeight(target)
        } else {
          setVideoMaxHeight(null)
        }
      } catch {}
    }
    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  // Split text into sentences for caption display
  const splitIntoSentences = (text) => {
    if (!text) return []
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
    return sentences.map(s => s.trim()).filter(Boolean)
  }

  // Play audio from base64
  const playAudio = useCallback(async (base64Audio) => {
    if (!base64Audio) return
    
    try {
      // Stop any existing audio
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }

      const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`)
      audio.muted = muted
      audio.volume = muted ? 0 : 1
      audioRef.current = audio

      audio.onended = () => {
        setIsSpeaking(false)
        if (videoRef.current) {
          videoRef.current.pause()
        }
        audioRef.current = null
      }

      audio.onerror = () => {
        setIsSpeaking(false)
        audioRef.current = null
      }

      setIsSpeaking(true)
      await audio.play()
      
      // Start video if available
      if (videoRef.current) {
        try {
          await videoRef.current.play()
        } catch {}
      }
    } catch (err) {
      console.error('[Mr. Mentor] Audio playback failed:', err)
      setIsSpeaking(false)
    }
  }, [muted])

  // Skip speech: stop audio and video, jump to end of response
  const handleSkipSpeech = useCallback(() => {
    console.log('[Mr. Mentor] Skipping current speech')
    
    // Stop audio
    if (audioRef.current) {
      try {
        audioRef.current.pause()
        audioRef.current = null
      } catch {}
    }
    
    // Pause video
    if (videoRef.current) {
      try {
        videoRef.current.pause()
      } catch {}
    }
    
    // Set speaking to false
    setIsSpeaking(false)
  }, [])

  // Send message to Mr. Mentor
  const sendMessage = useCallback(async () => {
    const message = userInput.trim()
    if (!message || loading) return

    setLoading(true)
    setError('')
    setUserInput('')

    try {
      // Start session if this is the first message
      if (!sessionStarted) {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        
        if (token) {
          await fetch('/api/usage/mentor/increment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action: 'start' })
          })
          setSessionStarted(true)
        }
      }

      // Add user message to conversation
      const updatedHistory = [
        ...conversationHistory,
        { role: 'user', content: message }
      ]
      setConversationHistory(updatedHistory)

      // Display user message in captions
      setCaptionText(message)
      setCaptionSentences([message])
      setCaptionIndex(0)

      // Get auth token for function calling
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const headers = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch('/api/counselor', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          message: message,
          // Send previous conversation history (API will append current message to build full context)
          history: conversationHistory,
          // Include learner context if a learner is selected
          learner_transcript: learnerTranscript || null
        })
      })

      if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`
        try {
          const errorData = await response.json()
          if (errorData.error) {
            errorMessage += `: ${errorData.error}`
          }
        } catch {
          // If response isn't JSON, use default message
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      const mentorReply = data.reply || ''

      if (!mentorReply) {
        throw new Error('Empty response from Mr. Mentor')
      }

      // Add mentor response to conversation
      const finalHistory = [
        ...updatedHistory,
        { role: 'assistant', content: mentorReply }
      ]
      setConversationHistory(finalHistory)

      // Display mentor response in captions
      setCaptionText(mentorReply)
      const sentences = splitIntoSentences(mentorReply)
      setCaptionSentences(sentences)
      setCaptionIndex(0)

      // Play audio if available
      if (data.audio) {
        await playAudio(data.audio)
      }

      // Track token usage for this exchange
      if (token && data.usage && data.usage.total_tokens) {
        const tokensUsed = data.usage.total_tokens
        const newTotal = currentSessionTokens + tokensUsed
        setCurrentSessionTokens(newTotal)
        
        // Send token count to backend
        await fetch('/api/usage/mentor/increment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            action: 'add_tokens',
            tokens: tokensUsed
          })
        })
      }

      // Update draft summary in background (async, non-blocking)
      updateDraftSummary(finalHistory, token).catch(err => {
        console.warn('[Mr. Mentor] Failed to update draft summary:', err)
        // Don't block the UI or show error - this is a background operation
      })

    } catch (err) {
      console.error('[Mr. Mentor] Request failed:', err)
      setError('Failed to reach Mr. Mentor. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [userInput, loading, conversationHistory, playAudio, learnerTranscript, selectedLearnerId, sessionStarted, currentSessionTokens])

  // Helper: Update draft summary after each exchange (not saved to memory until approved)
  const updateDraftSummary = async (conversationHistory, token) => {
    try {
      // Only send the last 2 turns (user + assistant) to update incrementally
      const recentTurns = conversationHistory.slice(-2)
      
      const learnerId = selectedLearnerId !== 'none' ? selectedLearnerId : null
      
      const response = await fetch('/api/conversation-drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          learner_id: learnerId,
          conversation_turns: recentTurns
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.draft?.draft_summary) {
          setDraftSummary(data.draft.draft_summary)
        }
      }
      
      console.log('[Mr. Mentor] Draft summary updated')
    } catch (err) {
      // Silent failure - don't interrupt user experience
      console.warn('[Mr. Mentor] Draft update failed:', err)
    }
  }

  // Handle Enter key to send message
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      sendMessage()
    }
  }

  // Trigger new conversation flow (show clipboard first)
  const startNewConversation = useCallback(async () => {
    if (conversationHistory.length === 0) {
      // No conversation to save, just start fresh
      return
    }

    // First, speak instructions
    setClipboardInstructions(true)
    
    // Play Mr. Mentor's instruction audio
    const instructionText = "Before we start a new conversation, let's save what we discussed. I've prepared a summary for you. You can review it, edit if needed, and choose to save it to my memory or delete it entirely. You can also export the whole conversation if you'd like to keep a complete record."
    
    try {
      await playAudio(instructionText)
    } catch (err) {
      console.warn('[Mr. Mentor] Failed to play instructions:', err)
    }
    
    // Show clipboard overlay
    setShowClipboard(true)
  }, [conversationHistory, playAudio])

  // Handle clipboard save (commit to permanent memory)
  const handleClipboardSave = useCallback(async (editedSummary) => {
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      if (!token) {
        alert('Unable to save: not authenticated')
        return
      }

      const learnerId = selectedLearnerId !== 'none' ? selectedLearnerId : null

      // Save to conversation_updates (permanent memory)
      await fetch('/api/conversation-memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          learner_id: learnerId,
          conversation_turns: conversationHistory,
          summary_override: editedSummary // Use the user-edited summary
        })
      })

      // Delete the draft
      await fetch(`/api/conversation-drafts?learner_id=${learnerId || ''}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      // Clear conversation and start fresh
      await clearConversationAfterSave()
      
      setShowClipboard(false)
      setClipboardInstructions(false)
      
      alert('Conversation saved to memory!')
    } catch (err) {
      console.error('[Mr. Mentor] Failed to save:', err)
      alert('Failed to save conversation. Please try again.')
    }
  }, [conversationHistory, selectedLearnerId])

  // Handle clipboard delete (discard conversation)
  const handleClipboardDelete = useCallback(async () => {
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      if (!token) return

      const learnerId = selectedLearnerId !== 'none' ? selectedLearnerId : null

      // Delete the draft
      await fetch(`/api/conversation-drafts?learner_id=${learnerId || ''}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      // Clear conversation
      await clearConversationAfterSave()
      
      setShowClipboard(false)
      setClipboardInstructions(false)
      
      alert('Conversation deleted.')
    } catch (err) {
      console.error('[Mr. Mentor] Failed to delete:', err)
      alert('Failed to delete conversation.')
    }
  }, [selectedLearnerId])

  // Helper: Actually clear conversation state after save/delete
  const clearConversationAfterSave = async () => {
    // End current session if one is active
    if (sessionStarted) {
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        
        if (token) {
          await fetch('/api/usage/mentor/increment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action: 'end' })
          })
        }
      } catch (e) {
        console.error('Failed to end mentor session:', e)
      }
    }
    
    setConversationHistory([])
    setCaptionText('')
    setCaptionSentences([])
    setCaptionIndex(0)
    setUserInput('')
    setError('')
    setSessionStarted(false)
    setCurrentSessionTokens(0)
    setDraftSummary('')
    try {
      localStorage.removeItem('mr_mentor_conversation')
    } catch {}
  }

  // Toggle mute
  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev
      if (audioRef.current) {
        audioRef.current.muted = next
        audioRef.current.volume = next ? 0 : 1
      }
      return next
    })
  }, [])

  // Export conversation
  const exportConversation = useCallback(() => {
    if (conversationHistory.length === 0) {
      alert('No conversation to export.')
      return
    }

    const timestamp = new Date().toISOString().split('T')[0]
    let content = `Mr. Mentor Conversation - ${timestamp}\n\n`
    
    conversationHistory.forEach((msg, idx) => {
      const label = msg.role === 'user' ? 'You' : 'Mr. Mentor'
      content += `${label}:\n${msg.content}\n\n`
    })

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mr-mentor-${timestamp}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [conversationHistory])

  // Listen for menu actions from HeaderBar (no longer used, but keep for backwards compat)
  useEffect(() => {
    const onExport = () => exportConversation()
    const onNewSession = () => startNewConversation()
    
    window.addEventListener('ms:mentor:export', onExport)
    window.addEventListener('ms:mentor:new-session', onNewSession)
    
    return () => {
      window.removeEventListener('ms:mentor:export', onExport)
      window.removeEventListener('ms:mentor:new-session', onNewSession)
    }
  }, [exportConversation, startNewConversation])

  // Auto-scroll captions to bottom
  useEffect(() => {
    if (captionBoxRef.current) {
      captionBoxRef.current.scrollTop = captionBoxRef.current.scrollHeight
    }
  }, [captionText, captionIndex])

  if (!pinChecked || !tierChecked) {
    return (
      <main style={{ padding: 24 }}>
        <p>Loading...</p>
      </main>
    )
  }

  const videoEffectiveHeight = videoMaxHeight && Number.isFinite(videoMaxHeight) ? videoMaxHeight : null

  // Debug logging
  console.log('[Mr. Mentor Layout]', {
    isMobileLandscape,
    videoMaxHeight,
    videoEffectiveHeight,
    windowHeight: typeof window !== 'undefined' ? window.innerHeight : 'N/A',
    calculatedPercentage: videoEffectiveHeight && typeof window !== 'undefined' ? (videoEffectiveHeight / window.innerHeight * 100).toFixed(1) + '%' : 'N/A'
  })

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      maxHeight: '100vh',
      width: '100vw',
      position: 'fixed',
      top: 0,
      left: 0,
      paddingTop: isMobileLandscape ? 'clamp(48px, 8svh, 60px)' : 'clamp(56px, 9svh, 72px)',
      background: '#f9fafb',
      overflow: 'hidden'
    }}>
      {/* Main content area */}
      <div style={{
        flex: isMobileLandscape ? '0 0 70%' : 1,
        display: 'flex',
        flexDirection: isMobileLandscape ? 'row' : 'column',
        overflow: 'hidden',
        gap: isMobileLandscape ? 16 : 0,
        padding: isMobileLandscape ? 16 : 0
      }}>
        {/* Video panel */}
        <div style={{
          flex: isMobileLandscape ? 1 : '0 0 30%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: isMobileLandscape ? '#000' : '#f9fafb',
          position: 'relative',
          minHeight: 0,
          padding: isMobileLandscape ? 0 : 16
        }}>
          <video
            ref={videoRef}
            src="/media/Mr Mentor.mp4"
            loop
            muted
            playsInline
            preload="auto"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 35%'
            }}
          />
          {/* Skip button (bottom-left, visible when speaking) */}
          {isSpeaking && (
            <button
              onClick={handleSkipSpeech}
              aria-label="Skip"
              title="Skip"
              style={{
                position: 'absolute',
                bottom: 16,
                left: 16,
                background: '#1f2937',
                color: '#fff',
                border: 'none',
                width: 'clamp(34px, 6.2vw, 52px)',
                height: 'clamp(34px, 6.2vw, 52px)',
                display: 'grid',
                placeItems: 'center',
                borderRadius: '50%',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                zIndex: 10
              }}
            >
              <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 4 15 12 5 20 5 4" />
                <line x1="19" y1="5" x2="19" y2="19" />
              </svg>
            </button>
          )}

          {/* Mute button overlay */}
          <button
            onClick={toggleMute}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              padding: '8px 12px',
              border: 'none',
              borderRadius: 6,
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500
            }}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? '🔇 Muted' : '🔊 Sound'}
          </button>
        </div>

        {/* Caption panel */}
        <div
          style={{
            flex: isMobileLandscape ? 1 : '0 0 35%',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            background: '#fff',
            borderRadius: isMobileLandscape ? 8 : 0,
            border: isMobileLandscape ? '1px solid #e5e7eb' : 'none',
            minHeight: 0
          }}
        >
          {/* New Conversation button (top-left of caption area) */}
          {conversationHistory.length > 0 && (
            <button
              onClick={startNewConversation}
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                padding: '8px 12px',
                fontSize: '0.875rem',
                fontWeight: 600,
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                zIndex: 10,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#2563eb'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#3b82f6'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              🔄 New Conversation
            </button>
          )}
          
          <div
            ref={captionBoxRef}
            style={{
              flex: 1,
              padding: conversationHistory.length > 0 ? '56px 16px 16px' : 16,
              overflowY: 'auto',
              fontSize: 16,
              lineHeight: 1.6,
              color: '#374151',
              minHeight: 0
            }}
          >
          {conversationHistory.length === 0 ? (
            <div style={{ color: '#9ca3af', paddingTop: 40, maxWidth: 700, margin: '0 auto' }}>
              <p style={{ fontSize: 18, fontWeight: 500, marginBottom: 16, color: '#374151', textAlign: 'center' }}>
                Welcome to Mr. Mentor
              </p>
              <p style={{ fontSize: 14, marginBottom: 20, textAlign: 'center' }}>
                I'm here to support you in your teaching journey. 
                Share your challenges, goals, or questions about curriculum planning.
              </p>
              <div style={{ fontSize: 14, marginBottom: 20, color: '#6b7280', textAlign: 'left' }}>
                <p style={{ fontWeight: 600, marginBottom: 8, color: '#374151' }}>I can help you:</p>
                <ul style={{ paddingLeft: 24, marginBottom: 16, lineHeight: 1.8 }}>
                  <li>Process feelings and challenges around teaching</li>
                  <li>Plan curriculum and create learning schedules</li>
                  <li>Develop strategies for specific learning situations</li>
                  <li>Balance academic expectations with family dynamics</li>
                </ul>
                <p style={{ fontWeight: 600, marginBottom: 8, color: '#374151' }}>Background Actions (Just Ask!):</p>
                <ul style={{ paddingLeft: 24, marginBottom: 16, lineHeight: 1.8 }}>
                  <li><strong>Search Lessons:</strong> "What fractions lessons do you have for 3rd grade?"</li>
                  <li><strong>Review Details:</strong> "Tell me more about the photosynthesis lesson"</li>
                  <li><strong>Generate Lessons:</strong> "Create a 5th grade math lesson on fractions"</li>
                  <li><strong>Schedule Lessons:</strong> "Add the photosynthesis lesson to Emma's calendar for Monday"</li>
                </ul>
                <p style={{ fontSize: 13, fontStyle: 'italic', color: '#9ca3af' }}>
                  Select a learner from the dropdown below to get personalized guidance based on their progress.
                </p>
              </div>
            </div>
          ) : (
            conversationHistory.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: 16,
                  paddingBottom: 16,
                  borderBottom: idx < conversationHistory.length - 1 ? '1px solid #e5e7eb' : 'none'
                }}
              >
                <div style={{
                  fontWeight: 600,
                  marginBottom: 4,
                  color: msg.role === 'user' ? '#2563eb' : '#059669'
                }}>
                  {msg.role === 'user' ? 'You' : 'Mr. Mentor'}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>
              Mr. Mentor is thinking...
            </div>
          )}
          {error && (
            <div style={{ 
              color: '#dc2626', 
              padding: 12, 
              background: '#fee2e2', 
              borderRadius: 6,
              marginTop: 12
            }}>
              {error}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Clipboard Overlay */}
      <ClipboardOverlay
        summary={draftSummary}
        onSave={handleClipboardSave}
        onDelete={handleClipboardDelete}
        onExport={exportConversation}
        onClose={() => {
          setShowClipboard(false)
          setClipboardInstructions(false)
        }}
        show={showClipboard}
      />

      {/* Input footer */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '8px 16px',
        background: '#fff',
        borderTop: '1px solid #e5e7eb',
        zIndex: 10
      }}>
        <div style={{ 
          maxWidth: isMobileLandscape ? '100%' : 800, 
          margin: 0,
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          {/* Learner selection dropdown */}
          {learners.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <label htmlFor="learner-select" style={{ 
                display: 'block', 
                marginBottom: 4, 
                fontSize: 13,
                fontWeight: 600,
                color: '#374151'
              }}>
                Discussing learner:
              </label>
              <select
                id="learner-select"
                value={selectedLearnerId}
                onChange={(e) => setSelectedLearnerId(e.target.value)}
                disabled={loading || isSpeaking}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  background: '#fff',
                  cursor: (loading || isSpeaking) ? 'not-allowed' : 'pointer'
                }}
              >
                <option value="none">None (general discussion)</option>
                {learners.map(learner => (
                  <option key={learner.id} value={learner.id}>
                    {learner.name} {learner.grade ? `(Grade ${learner.grade})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {/* Message input row */}
          <div style={{ 
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            marginBottom: 0
          }}>
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={!hasAccess ? "Premium required to use Mr. Mentor..." : "Type your message and press Enter to send..."}
              disabled={!hasAccess || loading || isSpeaking}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 14,
                fontFamily: 'inherit',
                cursor: !hasAccess ? 'not-allowed' : 'text'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!hasAccess || !userInput.trim() || loading || isSpeaking}
              style={{
                padding: '8px 24px',
                border: 'none',
                borderRadius: 8,
                background: (!hasAccess || !userInput.trim() || loading || isSpeaking) ? '#d1d5db' : '#2563eb',
                color: '#fff',
                cursor: (!hasAccess || !userInput.trim() || loading || isSpeaking) ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 600,
                flexShrink: 0
              }}
            >
              {loading ? 'Sending...' : 'Send'}
            </button>
            {(loading || isSpeaking) && (
              <div style={{ 
                fontSize: 12, 
                color: '#6b7280',
                flexShrink: 0
              }}>
                {isSpeaking ? '🔊 Speaking...' : '💭 Waiting...'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upgrade Overlay - Window Shopping Experience */}
      {!hasAccess && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 20
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 16,
            padding: '32px 24px',
            maxWidth: 500,
            width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎓</div>
            <h2 style={{ 
              margin: '0 0 16px 0', 
              fontSize: 24, 
              fontWeight: 700,
              color: '#111'
            }}>
              Unlock Mr. Mentor
            </h2>
            <p style={{ 
              color: '#555', 
              fontSize: 16, 
              lineHeight: 1.6,
              marginBottom: 24
            }}>
              Get personalized counseling and curriculum planning support with Mr. Mentor. 
              Available exclusively to Premium subscribers.
            </p>
            
            <div style={{ 
              background: '#f9fafb', 
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
              textAlign: 'left'
            }}>
              <p style={{ fontWeight: 600, marginBottom: 12, color: '#111' }}>What You Get:</p>
              <ul style={{ 
                margin: 0, 
                paddingLeft: 20, 
                fontSize: 14,
                lineHeight: 2,
                color: '#374151'
              }}>
                <li>AI-powered counseling for teaching challenges</li>
                <li>Search, review, and generate custom lessons</li>
                <li>Schedule lessons directly to learner calendars</li>
                <li>Data-informed guidance based on learner progress</li>
                <li>Curriculum planning and goal-setting support</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <a
                href="/facilitator/plan"
                style={{
                  display: 'inline-block',
                  padding: '12px 32px',
                  background: '#2563eb',
                  color: '#fff',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 16,
                  textDecoration: 'none',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                Upgrade to Premium
              </a>
              <button
                onClick={() => router.back()}
                style={{
                  padding: '12px 24px',
                  background: 'transparent',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 16,
                  cursor: 'pointer'
                }}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
