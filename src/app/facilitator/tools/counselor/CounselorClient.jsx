'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ensurePinAllowed } from '@/app/lib/pinGate'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier } from '@/app/lib/entitlements'
import { fetchLearnerTranscript } from '@/app/lib/learnerTranscript'

export default function CounselorClient() {
  const router = useRouter()
  const [pinChecked, setPinChecked] = useState(false)
  const [tierChecked, setTierChecked] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  
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

  // Check PIN on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const allowed = await ensurePinAllowed('facilitator-page')
        if (!allowed) {
          router.push('/')
          return
        }
        if (!cancelled) setPinChecked(true)
      } catch (e) {
        if (!cancelled) setPinChecked(true)
      }
    })()
    return () => { cancelled = true }
  }, [router])

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
            frac = 0.40
          } else if (h >= hMax) {
            frac = 0.70
          } else {
            const t = (h - hMin) / (hMax - hMin)
            frac = 0.40 + t * (0.70 - 0.40)
          }
          const target = Math.round(h * frac)
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

    try {
      const response = await fetch('/api/counselor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          // Send previous conversation history (API will append current message to build full context)
          history: conversationHistory,
          // Include learner context if a learner is selected
          learner_transcript: learnerTranscript || null
        })
      })

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
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

    } catch (err) {
      console.error('[Mr. Mentor] Request failed:', err)
      setError('Failed to reach Mr. Mentor. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [userInput, loading, conversationHistory, playAudio])

  // Handle Enter key to send message
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      sendMessage()
    }
  }

  // Clear conversation
  const clearConversation = useCallback(() => {
    if (confirm('Are you sure you want to start a new session? This will clear your conversation history.')) {
      setConversationHistory([])
      setCaptionText('')
      setCaptionSentences([])
      setCaptionIndex(0)
      setUserInput('')
      setError('')
      try {
        localStorage.removeItem('mr_mentor_conversation')
      } catch {}
    }
  }, [])

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

  // Listen for menu actions from HeaderBar hamburger
  useEffect(() => {
    const onExport = () => exportConversation()
    const onNewSession = () => clearConversation()
    
    window.addEventListener('ms:mentor:export', onExport)
    window.addEventListener('ms:mentor:new-session', onNewSession)
    
    return () => {
      window.removeEventListener('ms:mentor:export', onExport)
      window.removeEventListener('ms:mentor:new-session', onNewSession)
    }
  }, [exportConversation, clearConversation])

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

  if (!hasAccess) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Mr. Mentor</h1>
        <div style={{ 
          border: '1px solid #e5e7eb', 
          borderRadius: 12, 
          padding: 16, 
          background: '#fff',
          maxWidth: 600 
        }}>
          <h3 style={{ marginTop: 0 }}>Premium Required</h3>
          <p style={{ color: '#555' }}>
            Mr. Mentor is available exclusively to Premium subscribers. 
            Upgrade to access personalized counseling and curriculum planning support.
          </p>
          <a 
            href="/facilitator/plan" 
            style={{ 
              display: 'inline-block', 
              padding: '8px 12px', 
              border: '1px solid #111', 
              background: '#111', 
              color: '#fff', 
              borderRadius: 8, 
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            View Plans
          </a>
        </div>
      </main>
    )
  }

  const videoEffectiveHeight = videoMaxHeight && Number.isFinite(videoMaxHeight) ? videoMaxHeight : null

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      maxHeight: '100vh',
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
          flex: isMobileLandscape ? 1 : '0 0 auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#000',
          position: 'relative',
          minHeight: 0
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
              objectFit: 'cover'
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
          ref={captionBoxRef}
          style={{
            flex: 1,
            padding: 16,
            background: '#fff',
            borderRadius: isMobileLandscape ? 8 : 0,
            border: isMobileLandscape ? '1px solid #e5e7eb' : 'none',
            overflowY: 'auto',
            fontSize: 16,
            lineHeight: 1.6,
            color: '#374151',
            minHeight: 0
          }}
        >
          {conversationHistory.length === 0 ? (
            <div style={{ color: '#9ca3af', textAlign: 'center', paddingTop: 40 }}>
              <p style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                Welcome to Mr. Mentor
              </p>
              <p style={{ fontSize: 14 }}>
                I'm here to support you in your teaching journey. 
                Share your challenges, goals, or questions about curriculum planning.
              </p>
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
              placeholder="Type your message and press Enter to send..."
              disabled={loading || isSpeaking}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 14,
                fontFamily: 'inherit'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!userInput.trim() || loading || isSpeaking}
              style={{
                padding: '8px 24px',
                border: 'none',
                borderRadius: 8,
                background: (!userInput.trim() || loading || isSpeaking) ? '#d1d5db' : '#2563eb',
                color: '#fff',
                cursor: (!userInput.trim() || loading || isSpeaking) ? 'not-allowed' : 'pointer',
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
    </div>
  )
}
