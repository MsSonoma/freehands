'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ensurePinAllowed } from '@/app/lib/pinGate'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier } from '@/app/lib/entitlements'
import { fetchLearnerTranscript } from '@/app/lib/learnerTranscript'
import ClipboardOverlay from './ClipboardOverlay'
import GoalsClipboardOverlay from './GoalsClipboardOverlay'
import CalendarOverlay from './overlays/CalendarOverlay'
import LessonsOverlay from './overlays/LessonsOverlay'
import LessonMakerOverlay from './overlays/LessonMakerOverlay'

export default function CounselorClient() {
  const router = useRouter()
  const [pinChecked, setPinChecked] = useState(false)
  const [tierChecked, setTierChecked] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [tier, setTier] = useState('free')
  const [sessionStarted, setSessionStarted] = useState(false)
  const [currentSessionTokens, setCurrentSessionTokens] = useState(0)
  
  // Learner selection
  const [learners, setLearners] = useState([])
  const [selectedLearnerId, setSelectedLearnerId] = useState('none')
  const [learnerTranscript, setLearnerTranscript] = useState('')
  const [goalsNotes, setGoalsNotes] = useState('')
  
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
  
  // Goals clipboard state
  const [showGoalsClipboard, setShowGoalsClipboard] = useState(false)
  
  // Caption state (similar to session page)
  const [captionText, setCaptionText] = useState('')
  const [captionSentences, setCaptionSentences] = useState([])
  const [captionIndex, setCaptionIndex] = useState(0)
  
  // Screen overlay state
  const [activeScreen, setActiveScreen] = useState('mentor') // 'mentor' | 'calendar' | 'lessons' | 'generated' | 'maker'
  
  // Audio/Video refs
  const videoRef = useRef(null)
  const buttonVideoRef = useRef(null)
  const audioRef = useRef(null)
  const captionBoxRef = useRef(null)
  
  // Mute state - persisted in localStorage
  const [muted, setMuted] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      const stored = localStorage.getItem('mr_mentor_muted')
      return stored === 'true'
    } catch {
      return false
    }
  })
  
  // Layout state
  const [isMobileLandscape, setIsMobileLandscape] = useState(false)
  const [isMobilePortrait, setIsMobilePortrait] = useState(false)
  const [isNarrowScreen, setIsNarrowScreen] = useState(false)
  const [isShortHeight, setIsShortHeight] = useState(false)
  const [videoMaxHeight, setVideoMaxHeight] = useState(null)
  const [captionPanelFlex, setCaptionPanelFlex] = useState('0 0 50%')
  const [menuOpen, setMenuOpen] = useState(false)

  // Calculate caption panel height based on screen height
  useEffect(() => {
    const updateCaptionHeight = () => {
      const h = window.innerHeight
      // Interpolate: 600px -> 20%, 1000px -> 30%
      // Below 600: clamp to 20%, above 1000: clamp to 30%
      let percent
      if (h <= 600) {
        percent = 20
      } else if (h >= 1000) {
        percent = 30
      } else {
        // Linear interpolation between 600 and 1000
        const t = (h - 600) / (1000 - 600)
        percent = 20 + (10 * t)
      }
      setCaptionPanelFlex(`0 0 ${percent}%`)
    }
    
    updateCaptionHeight()
    window.addEventListener('resize', updateCaptionHeight)
    return () => window.removeEventListener('resize', updateCaptionHeight)
  }, [])

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
            const planTier = (data?.plan_tier || 'free').toLowerCase()
            const ent = featuresForTier(planTier)
            if (!cancelled) {
              setTier(planTier)
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
      setGoalsNotes('')
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

  // Load goals notes when selection changes
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const params = new URLSearchParams()
        if (selectedLearnerId && selectedLearnerId !== 'none') {
          params.append('learner_id', selectedLearnerId)
        }
        
        const response = await fetch(`/api/goals-notes?${params.toString()}`)
        if (response.ok && !cancelled) {
          const data = await response.json()
          setGoalsNotes(data.goals_notes || '')
          console.log('[Mr. Mentor] Loaded goals notes:', data.goals_notes?.substring(0, 100))
        }
      } catch (err) {
        console.error('[Mr. Mentor] Failed to load goals notes:', err)
        if (!cancelled) setGoalsNotes('')
      }
    })()
    return () => { cancelled = true }
  }, [selectedLearnerId])

  // Load existing draft summary on mount and when learner changes
  useEffect(() => {
    if (!hasAccess || !tierChecked) return
    
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        if (!supabase) return
        
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) return

        const learnerId = selectedLearnerId !== 'none' ? selectedLearnerId : null
        
        const response = await fetch(`/api/conversation-drafts?learner_id=${learnerId || ''}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok && !cancelled) {
          const data = await response.json()
          if (data.draft?.draft_summary) {
            setDraftSummary(data.draft.draft_summary)
            console.log('[Mr. Mentor] Loaded existing draft summary')
          }
        }
      } catch (err) {
        console.warn('[Mr. Mentor] Failed to load existing draft:', err)
      }
    })()
    
    return () => { cancelled = true }
  }, [hasAccess, tierChecked, selectedLearnerId])

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
        const isLandscape = w > h && (w / h) >= 1.0
        const isPortrait = h > w && !isLandscape
        
        setIsMobileLandscape(isLandscape)
        setIsMobilePortrait(isPortrait)
        setIsNarrowScreen(w < 370)
        setIsShortHeight(h <= 600)
        
        // Calculate video height for landscape
        if (isLandscape) {
          // Multi-stage smooth ramp: 45% at 375px -> 70% at 600px -> 105% at 1200px
          let frac
          if (h <= 375) {
            frac = 0.45
          } else if (h <= 600) {
            // Ramp from 45% at 375px to 70% at 600px
            const t = (h - 375) / (600 - 375)
            frac = 0.45 + t * (0.70 - 0.45)
          } else if (h <= 1200) {
            // Ramp from 70% at 600px to 105% at 1200px
            const t = (h - 600) / (1200 - 600)
            frac = 0.70 + t * (1.05 - 0.70)
          } else {
            frac = 1.05
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
        if (buttonVideoRef.current) {
          buttonVideoRef.current.pause()
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
      
      // Start button video if available
      if (buttonVideoRef.current) {
        try {
          await buttonVideoRef.current.play()
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
    
    // Pause button video
    if (buttonVideoRef.current) {
      try {
        buttonVideoRef.current.pause()
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
          learner_transcript: learnerTranscript || null,
          // Include persistent goals notes
          goals_notes: goalsNotes || null
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
      console.log('[Mr. Mentor] Updating draft summary...')
      
      // Only send the last 2 turns (user + assistant) to update incrementally
      const recentTurns = conversationHistory.slice(-2)
      
      const learnerId = selectedLearnerId !== 'none' ? selectedLearnerId : null
      
      console.log('[Mr. Mentor] Sending draft update:', { learnerId, turnCount: recentTurns.length })
      
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
        console.log('[Mr. Mentor] Draft response:', data)
        if (data.draft?.draft_summary) {
          setDraftSummary(data.draft.draft_summary)
          console.log('[Mr. Mentor] Draft summary updated:', data.draft.draft_summary.substring(0, 50) + '...')
        } else {
          console.warn('[Mr. Mentor] No draft_summary in response')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('[Mr. Mentor] Draft update failed:', response.status, errorData)
      }
      
      console.log('[Mr. Mentor] Draft summary update complete')
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

    // Show clipboard overlay immediately (skip audio instructions to avoid playback errors)
    // The overlay itself provides clear UI instructions
    setShowClipboard(true)
  }, [conversationHistory])

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
      // Persist to localStorage
      try {
        localStorage.setItem('mr_mentor_muted', String(next))
      } catch {}
      return next
    })
  }, [])

  // Simple markdown renderer for bold text
  const renderMarkdown = (text) => {
    if (!text) return null
    
    // Split by **bold** markers
    const parts = text.split(/(\*\*[^*]+\*\*)/)
    
    return parts.map((part, idx) => {
      // Check if this part is bold
      if (part.startsWith('**') && part.endsWith('**')) {
        const boldText = part.slice(2, -2)
        return <strong key={idx}>{boldText}</strong>
      }
      return <span key={idx}>{part}</span>
    })
  }

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
        padding: isMobileLandscape ? 16 : 0,
        ...(isMobileLandscape && videoEffectiveHeight ? {
          '--mrMentorSideBySideH': `${videoEffectiveHeight}px`
        } : {})
      }}>
        {/* Video/Overlay panel */}
        <div style={{
          flex: isMobileLandscape ? '0 0 50%' : '0 0 50%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: isMobileLandscape ? '#000' : '#f9fafb',
          position: 'relative',
          minHeight: 0,
          padding: isMobileLandscape ? 0 : 16,
          overflow: 'hidden',
          ...(isMobileLandscape ? {
            aspectRatio: '16 / 9',
            width: '100%',
            // Use maxHeight to cap the container while letting aspectRatio determine natural size
            ...(videoEffectiveHeight ? { maxHeight: 'var(--mrMentorSideBySideH)' } : {})
          } : {})
        }}>
          {/* Video - direct child like Ms. Sonoma, hidden when showing overlays */}
          <video
            ref={videoRef}
            src="/media/Mr Mentor.mp4"
            loop
            muted
            playsInline
            preload="auto"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 35%',
              visibility: activeScreen === 'mentor' ? 'visible' : 'hidden',
              pointerEvents: activeScreen === 'mentor' ? 'auto' : 'none'
            }}
          />

          {/* Overlay buttons - positioned relative to video panel container */}
          {activeScreen === 'mentor' && (
            <>
              {/* Goals clipboard button (top-left) */}
              <button
                onClick={() => setShowGoalsClipboard(true)}
                aria-label="Goals"
                title="Set persistent goals"
                style={{
                  position: 'absolute',
                  top: 16,
                  left: 16,
                  background: goalsNotes ? '#fef3c7' : '#1f2937',
                  color: goalsNotes ? '#92400e' : '#fff',
                  border: 'none',
                  width: 'clamp(48px, 10vw, 64px)',
                  height: 'clamp(48px, 10vw, 64px)',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  zIndex: 10,
                  fontSize: 'clamp(22px, 5vw, 32px)'
                }}
              >
                📋
              </button>

              {/* New Conversation button (top-right) - visible when conversation exists */}
              {conversationHistory.length > 0 && (
                <button
                  onClick={startNewConversation}
                  aria-label="New Conversation"
                  title="New Conversation"
                  style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    background: '#1f2937',
                    color: '#fff',
                    border: 'none',
                    width: 'clamp(48px, 10vw, 64px)',
                    height: 'clamp(48px, 10vw, 64px)',
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    zIndex: 10,
                    fontSize: 'clamp(22px, 5vw, 32px)'
                  }}
                >
                  💾
                </button>
              )}

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

              {/* Mute button overlay - matches Ms. Sonoma's style */}
              <button
                onClick={toggleMute}
                aria-label={muted ? 'Unmute' : 'Mute'}
                title={muted ? 'Unmute' : 'Mute'}
                style={{
                  position: 'absolute',
                  bottom: 16,
                  right: 16,
                  background: '#1f2937',
                  color: '#fff',
                  border: 'none',
                  width: 'clamp(48px, 10vw, 64px)',
                  height: 'clamp(48px, 10vw, 64px)',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  zIndex: 10
                }}
              >
                {muted ? (
                  <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <path d="M23 9l-6 6" />
                    <path d="M17 9l6 6" />
                  </svg>
                ) : (
                  <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <path d="M19 8a5 5 0 010 8" />
                    <path d="M15 11a2 2 0 010 2" />
                  </svg>
                )}
              </button>
            </>
          )}

          {/* Overlays - shown on top when activeScreen is not 'mentor' */}
          {activeScreen !== 'mentor' && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: '#fff',
              zIndex: 5,
              overflow: 'hidden'
            }}>
              {activeScreen === 'calendar' && (
                <CalendarOverlay 
                  learnerId={selectedLearnerId}
                />
              )}
              {activeScreen === 'lessons' && (
                <LessonsOverlay 
                  learnerId={selectedLearnerId}
                />
              )}
              {activeScreen === 'maker' && (
                <LessonMakerOverlay tier={tier} />
              )}
            </div>
          )}
        </div>

        {/* Caption panel */}
        <div
          style={{
            flex: isMobileLandscape ? 1 : captionPanelFlex,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            background: '#fff',
            borderRadius: isMobileLandscape ? 8 : 0,
            border: isMobileLandscape ? '1px solid #e5e7eb' : 'none',
            minHeight: 0,
            ...(isMobileLandscape && videoEffectiveHeight ? {
              height: 'var(--mrMentorSideBySideH)',
              maxHeight: 'var(--mrMentorSideBySideH)',
              minHeight: 0
            } : {})
          }}
        >
          <div
            ref={captionBoxRef}
            style={{
              flex: 1,
              padding: 16,
              overflowY: 'auto',
              fontSize: 16,
              lineHeight: 1.6,
              color: '#374151',
              minHeight: 0
            }}
          >
          {conversationHistory.length === 0 ? (
            <div style={{ color: '#9ca3af', paddingTop: 8, maxWidth: 700, margin: '0 auto' }}>
              <p style={{ fontSize: 18, fontWeight: 500, marginBottom: 12, color: '#374151', textAlign: 'center' }}>
                Welcome to Mr. Mentor
              </p>
              <p style={{ fontSize: 14, marginBottom: 16, textAlign: 'center' }}>
                I'm here to support you in your teaching journey. 
                Share your challenges, goals, or questions about curriculum planning.
              </p>
              <div style={{ fontSize: 14, marginBottom: 16, color: '#6b7280', textAlign: 'left' }}>
                <p style={{ fontWeight: 600, marginBottom: 8, color: '#374151' }}>I can help you:</p>
                <ul style={{ paddingLeft: 24, marginBottom: 12, lineHeight: 1.6 }}>
                  <li>Process feelings and challenges around teaching</li>
                  <li>Plan curriculum and create learning schedules</li>
                  <li>Develop strategies for specific learning situations</li>
                  <li>Balance academic expectations with family dynamics</li>
                </ul>
                <p style={{ fontWeight: 600, marginBottom: 8, color: '#374151' }}>Background Actions (Just Ask!):</p>
                <ul style={{ paddingLeft: 24, marginBottom: 12, lineHeight: 1.6 }}>
                  <li><strong>Search Lessons:</strong> "What fractions lessons do you have for 3rd grade?"</li>
                  <li><strong>Review Details:</strong> "Tell me more about the photosynthesis lesson"</li>
                  <li><strong>Generate Lessons:</strong> "Create a 5th grade math lesson on fractions"</li>
                  <li><strong>Schedule Lessons:</strong> "Add the photosynthesis lesson to Emma's calendar for Monday"</li>
                </ul>
                <p style={{ fontWeight: 600, marginBottom: 8, color: '#374151' }}>Quick Access Screens:</p>
                <ul style={{ paddingLeft: 24, marginBottom: 12, lineHeight: 1.6 }}>
                  <li><strong>📚 Lessons:</strong> Browse and review all available lessons</li>
                  <li><strong>🎨 Generator:</strong> Create custom lessons for your learners</li>
                  <li><strong>✨ Generated:</strong> View your previously generated lessons</li>
                  <li><strong>📅 Calendar:</strong> Manage learner schedules and lesson plans</li>
                </ul>
                <p style={{ fontSize: 13, fontStyle: 'italic', color: '#9ca3af', marginTop: 12 }}>
                  Select a learner from the dropdown below to get personalized guidance based on their progress. Use the menu button to access different screens.
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
                  {renderMarkdown(msg.content)}
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

      {/* Goals Clipboard Overlay */}
      <GoalsClipboardOverlay
        visible={showGoalsClipboard}
        onClose={() => setShowGoalsClipboard(false)}
        learnerId={selectedLearnerId}
        learnerName={learners.find(l => l.id === selectedLearnerId)?.name}
        onSave={(text) => setGoalsNotes(text)}
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
          {/* Learner selection dropdown and screen buttons */}
          {learners.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4
              }}>
                <select
                  id="learner-select"
                  value={selectedLearnerId}
                  onChange={(e) => setSelectedLearnerId(e.target.value)}
                  disabled={loading || isSpeaking}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    background: '#fff',
                    cursor: (loading || isSpeaking) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <option value="none">No Learner Selected (general discussion)</option>
                  {learners.map(learner => (
                    <option key={learner.id} value={learner.id}>
                      {learner.name} {learner.grade ? `(Grade ${learner.grade})` : ''}
                    </option>
                  ))}
                </select>
                
                {/* Screen toggle buttons */}
                {isMobilePortrait ? (
                  // Hamburger menu for mobile portrait
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setMenuOpen(!menuOpen)}
                      title="Menu"
                      style={{
                        width: 40,
                        height: 40,
                        border: '2px solid #d1d5db',
                        borderRadius: 6,
                        background: menuOpen ? '#dbeafe' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: 4,
                        padding: 8,
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ width: '70%', height: 2, background: '#374151', borderRadius: 1 }} />
                      <div style={{ width: '70%', height: 2, background: '#374151', borderRadius: 1 }} />
                      <div style={{ width: '70%', height: 2, background: '#374151', borderRadius: 1 }} />
                    </button>
                    
                    {/* Popup menu */}
                    {menuOpen && (
                      <>
                        {/* Backdrop to close menu */}
                        <div 
                          onClick={() => setMenuOpen(false)}
                          style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 998
                          }}
                        />
                        
                        {/* Menu panel */}
                        <div style={{
                          position: 'absolute',
                          bottom: 48,
                          right: 0,
                          background: '#fff',
                          border: '2px solid #d1d5db',
                          borderRadius: 8,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          padding: 8,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          zIndex: 999,
                          minWidth: 160
                        }}>
                          <button
                            onClick={() => {
                              setActiveScreen('mentor')
                              setMenuOpen(false)
                            }}
                            title="Mr. Mentor Video"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 12px',
                              border: '2px solid',
                              borderColor: activeScreen === 'mentor' ? '#3b82f6' : '#d1d5db',
                              borderRadius: 6,
                              background: activeScreen === 'mentor' ? '#dbeafe' : '#fff',
                              cursor: 'pointer',
                              fontSize: 14,
                              fontWeight: 500,
                              transition: 'all 0.2s',
                              justifyContent: 'flex-start'
                            }}
                          >
                            <div style={{
                              width: 32,
                              height: 32,
                              border: '1px solid #d1d5db',
                              borderRadius: 4,
                              background: '#000',
                              overflow: 'hidden',
                              flexShrink: 0
                            }}>
                              <video
                                loop
                                muted
                                playsInline
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  display: 'block'
                                }}
                              >
                                <source src="/media/Mr Mentor.mp4" type="video/mp4" />
                              </video>
                            </div>
                            <span>Mr. Mentor</span>
                          </button>
                          
                          <button
                            onClick={() => {
                              setActiveScreen('lessons')
                              setMenuOpen(false)
                            }}
                            title="Lessons"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 12px',
                              border: '2px solid',
                              borderColor: activeScreen === 'lessons' ? '#3b82f6' : '#d1d5db',
                              borderRadius: 6,
                              background: activeScreen === 'lessons' ? '#dbeafe' : '#fff',
                              cursor: 'pointer',
                              fontSize: 14,
                              fontWeight: 500,
                              transition: 'all 0.2s',
                              justifyContent: 'flex-start'
                            }}
                          >
                            <span style={{ fontSize: 20, width: 32, textAlign: 'center', flexShrink: 0 }}>📚</span>
                            <span>Lessons</span>
                          </button>
                          
                          <button
                            onClick={() => {
                              setActiveScreen('maker')
                              setMenuOpen(false)
                            }}
                            title="Lesson Generator"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 12px',
                              border: '2px solid',
                              borderColor: activeScreen === 'maker' ? '#3b82f6' : '#d1d5db',
                              borderRadius: 6,
                              background: activeScreen === 'maker' ? '#dbeafe' : '#fff',
                              cursor: 'pointer',
                              fontSize: 14,
                              fontWeight: 500,
                              transition: 'all 0.2s',
                              justifyContent: 'flex-start'
                            }}
                          >
                            <span style={{ fontSize: 20, width: 32, textAlign: 'center', flexShrink: 0 }}>🎨</span>
                            <span>Generator</span>
                          </button>
                          
                          <button
                            onClick={() => {
                              setActiveScreen('calendar')
                              setMenuOpen(false)
                            }}
                            title="Calendar"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 12px',
                              border: '2px solid',
                              borderColor: activeScreen === 'calendar' ? '#3b82f6' : '#d1d5db',
                              borderRadius: 6,
                              background: activeScreen === 'calendar' ? '#dbeafe' : '#fff',
                              cursor: 'pointer',
                              fontSize: 14,
                              fontWeight: 500,
                              transition: 'all 0.2s',
                              justifyContent: 'flex-start'
                            }}
                          >
                            <span style={{ fontSize: 20, width: 32, textAlign: 'center', flexShrink: 0 }}>📅</span>
                            <span>Calendar</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  // Regular button row for landscape and desktop
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => setActiveScreen('mentor')}
                      title="Mr. Mentor Video"
                      style={{
                        width: 40,
                        height: 40,
                        border: '2px solid',
                        borderColor: activeScreen === 'mentor' ? '#3b82f6' : '#d1d5db',
                        borderRadius: 6,
                        background: '#000',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                        overflow: 'hidden',
                        padding: 0,
                        position: 'relative'
                      }}
                    >
                      <video
                        ref={buttonVideoRef}
                        loop
                        muted
                        playsInline
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block'
                        }}
                      >
                        <source src="/media/Mr Mentor.mp4" type="video/mp4" />
                      </video>
                    </button>
                    <button
                      onClick={() => setActiveScreen('lessons')}
                      title="Lessons"
                      style={{
                        width: 40,
                        height: 40,
                        border: '2px solid',
                        borderColor: activeScreen === 'lessons' ? '#3b82f6' : '#d1d5db',
                        borderRadius: 6,
                        background: activeScreen === 'lessons' ? '#dbeafe' : '#fff',
                        cursor: 'pointer',
                        fontSize: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      📚
                    </button>
                    <button
                      onClick={() => setActiveScreen('maker')}
                      title="Lesson Generator"
                      style={{
                        width: 40,
                        height: 40,
                        border: '2px solid',
                        borderColor: activeScreen === 'maker' ? '#3b82f6' : '#d1d5db',
                        borderRadius: 6,
                        background: activeScreen === 'maker' ? '#dbeafe' : '#fff',
                        cursor: 'pointer',
                        fontSize: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      🎨
                    </button>
                    <button
                      onClick={() => setActiveScreen('calendar')}
                      title="Calendar"
                      style={{
                        width: 40,
                        height: 40,
                        border: '2px solid',
                        borderColor: activeScreen === 'calendar' ? '#3b82f6' : '#d1d5db',
                        borderRadius: 6,
                        background: activeScreen === 'calendar' ? '#dbeafe' : '#fff',
                        cursor: 'pointer',
                        fontSize: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      ✨
                    </button>
                    <button
                      onClick={() => setActiveScreen('calendar')}
                      title="Calendar"
                      style={{
                        width: 40,
                        height: 40,
                        border: '2px solid',
                        borderColor: activeScreen === 'calendar' ? '#3b82f6' : '#d1d5db',
                        borderRadius: 6,
                        background: activeScreen === 'calendar' ? '#dbeafe' : '#fff',
                        cursor: 'pointer',
                        fontSize: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      📅
                    </button>
                  </div>
                )}
              </div>
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
                padding: isNarrowScreen ? '8px 12px' : '8px 24px',
                border: 'none',
                borderRadius: 8,
                background: (!hasAccess || !userInput.trim() || loading || isSpeaking) ? '#d1d5db' : '#2563eb',
                color: '#fff',
                cursor: (!hasAccess || !userInput.trim() || loading || isSpeaking) ? 'not-allowed' : 'pointer',
                fontSize: isNarrowScreen ? '1.25rem' : 14,
                fontWeight: 600,
                flexShrink: 0
              }}
            >
              {loading ? (isNarrowScreen ? '⏳' : 'Sending...') : (isNarrowScreen ? '📤' : 'Send')}
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
                href="/facilitator/account/plan"
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
