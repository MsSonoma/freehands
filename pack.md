# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

Search for the render gating/filters in CalendarOverlay.jsx that could cause a blank UI even when scheduledLessons/plannedLessons state is populated. Identify: (1) any conditional returns, (2) any filtering of past lessons pending completion history, (3) any dependency on 'tableExists' or 'isLoading' flags. Provide chunk IDs.

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (794f51f6b415d06fd9a76fb8545513e96e23216bc9a2bb9029aa606c1256b82c)
- bm25: -14.3607 | relevance: 1.0000

contextText += '\n\n=== REDO RULES: SAME AS PLANNER GENERATION ==='
      contextText += '\nYou are regenerating a planned lesson outline.'
      contextText += `\nPrefer NEW topics most of the time, but you MAY plan a rephrased Review for low scores (<= ${LOW_SCORE_REVIEW_THRESHOLD}%).`
      contextText += `\nAvoid repeating high-score topics (>= ${HIGH_SCORE_AVOID_REPEAT_THRESHOLD}%) unless the facilitator explicitly requests it.`
      contextText += "\nIf you choose a Review lesson, the title MUST start with 'Review:' and it must use different examples."
      contextText += '\nDo NOT produce an exact duplicate of any scheduled/planned lesson above.'

### 2. src/app/api/planned-lessons/route.js (343b4ca5051beb3247ceb138f38e20ea48dd8d8ff5a9dbd9426f26ab307e073b)
- bm25: -13.4316 | relevance: 1.0000

// Insert all the planned lessons
    const rows = []
    for (const [dateStr, lessons] of Object.entries(plannedLessons)) {
      for (const lesson of lessons) {
        rows.push({
          facilitator_id: user.id,
          learner_id: learnerId,
          scheduled_date: dateStr,
          lesson_data: lesson
        })
      }
    }

### 3. src/app/facilitator/generator/counselor/CounselorClient.jsx (e330adee56816c81999633910ee719abe2102c8a46a383cf22f33933363801fb)
- bm25: -13.0597 | relevance: 1.0000

if (!res.ok) {
                  const js = await res.json().catch(() => null)
                  // Clear any pending confirmation state, since the action did not complete.
                  if (interceptorRef.current?.reset) interceptorRef.current.reset()
                  interceptResult.response = js?.error
                    ? `I couldn't update lesson availability: ${js.error}`
                    : "I couldn't update lesson availability. Please try again."
                } else {
                  window.dispatchEvent(new Event('mr-mentor:lesson-assigned'))
                }
              } catch (err) {
                if (interceptorRef.current?.reset) interceptorRef.current.reset()
                interceptResult.response = "I couldn't update lesson availability. Please try again."
              }
            } else {
              if (interceptorRef.current?.reset) interceptorRef.current.reset()
              interceptResult.response = 'Please select a learner first.'
            }
          } else if (action.type === 'generate') {
            setLoadingThought("Generating your custom lesson with AI...")
            // Generate lesson via interceptor (keeps context)
            const supabase = getSupabaseClient()
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token
            
            if (token && selectedLearnerId) {
              try {
                // Call generation API
                const genResponse = await fetch('/api/facilitator/lessons/generate', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.st

### 4. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (3ff2001d1b38b93c2f7405475f5a1dd8877dfa62616a92a0f0d8280a343b7099)
- bm25: -12.6351 | relevance: 1.0000

// Build a completion lookup.
      // Past scheduled dates will show only completed lessons.
      // NOTE: Lessons may be completed after their scheduled date (make-up work).
      let completedKeySet = new Set()
      let completedDatesByLesson = new Map()
      let completionLookupFailed = false
      try {
        const pastSchedule = (data || []).filter(row => row?.scheduled_date && row.scheduled_date < todayStr)
        const minPastDate = pastSchedule.reduce((min, r) => (min && min < r.scheduled_date ? min : r.scheduled_date), null)

### 5. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (cdb649a673b844a807410485a9f3f98df83a1dfc70eeeb6a8a07c2740d4b4870)
- bm25: -12.1193 | relevance: 1.0000

const result = await response.json()
      devWarn(`schedule: parsed json ms=${Date.now() - startedAtMs}`)
      const data = result.schedule || []

const todayStr = getLocalTodayStr()

// Fast-path: render today's + future scheduled lessons immediately.
      // Completion history lookup can be slow; it should not block basic schedule visibility.
      try {
        const immediate = {}
        for (const item of (data || [])) {
          const dateStr = item?.scheduled_date
          const lessonKey = item?.lesson_key
          if (!dateStr || !lessonKey) continue
          if (dateStr < todayStr) continue

if (!immediate[dateStr]) immediate[dateStr] = []
          immediate[dateStr].push({
            id: item.id,
            facilitator_id: item.facilitator_id,
            lesson_title: item.lesson_key?.split('/')[1]?.replace('.json', '').replace(/_/g, ' ') || 'Lesson',
            subject: item.lesson_key?.split('/')[0] || 'Unknown',
            grade: 'Various',
            lesson_key: item.lesson_key,
            completed: false
          })
        }

if (requestId === scheduleRequestIdRef.current) {
          setScheduledLessons(immediate)
          devWarn(`schedule: immediate loaded dates=${Object.keys(immediate || {}).length}`)
        }
      } catch {}

### 6. src/app/facilitator/generator/counselor/CounselorClient.jsx (0cfd9fad62d7fbfc6f7777e33bafc3dd9dcfeb4000945f4f833d493d6441d65d)
- bm25: -11.3387 | relevance: 1.0000

// Get loading thought based on interceptor state
  const getLoadingThought = useCallback((flow, awaitingInput, action) => {
    // Action-based thoughts (highest priority)
    if (action?.type === 'generate') {
      return "Generating your custom lesson with AI..."
    }
    if (action?.type === 'schedule') {
      return "Adding this lesson to the calendar..."
    }
    if (action?.type === 'edit') {
      return "Opening the lesson editor..."
    }
    
    // Flow and input-based thoughts
    if (flow === 'generate') {
      if (awaitingInput === 'generate_topic') return "Thinking about lesson topics..."
      if (awaitingInput === 'generate_grade_confirm') return "Checking learner's grade level..."
      if (awaitingInput === 'generate_grade') return "Considering grade levels..."
      if (awaitingInput === 'generate_subject') return "Identifying the subject area..."
      if (awaitingInput === 'generate_difficulty') return "Determining difficulty level..."
      if (awaitingInput === 'generate_title') return "Crafting the perfect title..."
      return "Preparing lesson parameters..."
    }
    
    if (flow === 'schedule') {
      if (awaitingInput === 'schedule_date') return "Looking at the calendar..."
      if (awaitingInput === 'schedule_lesson_search') return "Searching for lessons to schedule..."
      if (awaitingInput === 'post_generation_schedule') return "Reviewing the generated lesson..."
      return "Scheduling the lesson..."
    }
    
    if (flow === 'search') {
      if (awaitingInput === 'lesson_selection') return "Found several matches, reviewing them..."
      return "Searching through your lessons..."
    }
    
    if (flow === 'edit') {
      if (awaitingInput === 'edit_changes') return "Analyzing the requested changes..."
      if (awaiti

### 7. src/app/facilitator/generator/counselor/CounselorClient.jsx (ef8192c3563a04d5a6d34e4178fbc548d838d1c90e9629ff35618ea9a0d53a68)
- bm25: -10.9469 | relevance: 1.0000

- Title: ${genData.lesson.title}
- Grade: ${genData.lesson.grade}
- Difficulty: ${genData.lesson.difficulty}
- Vocabulary: ${vocab}
- Teaching Notes: ${notes}

As a next step, you might consider adding this lesson to your learner's plan. You can either schedule it on a specific date, or assign it so it shows up as available for ${learnerName || 'this learner'}.

Would you like me to schedule this lesson, or assign it to ${learnerName || 'this learner'}?`

// Set state to await schedule vs assign
                    interceptorRef.current.state.awaitingInput = 'post_generation_action'
                    
                    // Dispatch event to refresh lessons overlay
                    window.dispatchEvent(new CustomEvent('mr-mentor:lesson-generated'))
                  }
                }
              } catch (err) {
                // Generation failed - will show in response
              }
            }
          } else if (action.type === 'edit') {
            // Trigger lesson editor
            setActiveScreen('lessons')
            // Could pass edit instructions as context
          } else if (action.type === 'save_curriculum_preferences') {
            setLoadingThought('Saving curriculum preferences...')

const supabase = getSupabaseClient()
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token

### 8. src/app/api/planned-lessons/route.js (61d4c28ba90f1d8e1e9174584b7c682b2d97aedbd8d4340b91e8ddb0c66f0ead)
- bm25: -10.5785 | relevance: 1.0000

const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return NextResponse.json({ error: 'Invalid authorization token' }, { status: 401 })
    }
    
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })
    
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

const body = await request.json()
    const { learnerId, plannedLessons } = body

if (!learnerId || !plannedLessons) {
      return NextResponse.json({ error: 'learnerId and plannedLessons required' }, { status: 400 })
    }

// Verify the learner belongs to this facilitator/owner
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

// Get all dates in the new plan
    const newPlanDates = Object.keys(plannedLessons)

// Delete existing planned lessons ONLY for dates in the new plan
    // This allows multiple non-overlapping plans to coexist
    if (newPlanDates.length > 0) {
      await adminSupabase
        .from('planned_lessons')
        .delete()
        .eq('learner_id', learnerId)
        .eq('facilitator_id', user.id)
        .in('scheduled_date', newPlanDates)
    }

### 9. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (75e2e696ebf006525b84ee60353b4eccf50aea9225f050bcc8f024e87d58e293)
- bm25: -10.4033 | relevance: 1.0000

const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [scheduledLessons, setScheduledLessons] = useState({})
  const [scheduledForSelectedDate, setScheduledForSelectedDate] = useState([])
  const [plannedLessons, setPlannedLessons] = useState({})
  const [plannedForSelectedDate, setPlannedForSelectedDate] = useState([])
  const [tableExists, setTableExists] = useState(true)
  const [rescheduling, setRescheduling] = useState(null) // Track which lesson is being rescheduled
  const [listTab, setListTab] = useState('scheduled') // 'scheduled' | 'planned'

### 10. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (b39565838ee1524f1aef0810ea1c684a8168b5cc913c06f629090734dea69e11)
- bm25: -10.2079 | relevance: 1.0000

const scheduledFlat = []
      Object.entries(scheduledLessons || {}).forEach(([date, arr]) => {
        ;(Array.isArray(arr) ? arr : []).forEach((l) => {
          scheduledFlat.push({ date, key: l.lesson_key })
        })
      })
      if (scheduledFlat.length > 0) {
        contextText += '\n\nScheduled lessons (do NOT reuse these topics):\n'
        scheduledFlat
          .slice()
          .sort((a, b) => String(a.date).localeCompare(String(b.date)))
          .slice(-60)
          .forEach((l) => {
            contextText += `- ${l.date}: ${l.key}\n`
          })
      }

const plannedFlat = []
      Object.entries(plannedLessons || {}).forEach(([date, arr]) => {
        ;(Array.isArray(arr) ? arr : []).forEach((l) => {
          plannedFlat.push({ date, subject: l.subject, title: l.title, description: l.description })
        })
      })
      if (plannedFlat.length > 0) {
        contextText += '\n\nPlanned lessons already in the calendar plan (do NOT repeat these topics):\n'
        plannedFlat
          .slice()
          .sort((a, b) => String(a.date).localeCompare(String(b.date)))
          .slice(-80)
          .forEach((l) => {
            contextText += `- ${l.date} (${l.subject || 'general'}): ${l.title || l.description || 'planned lesson'}\n`
          })
      }

### 11. src/app/api/planned-lessons/route.js (13b1caac815cc9c704fe436689e8b167bcfdb8a8352521129c2b4450d7acf36d)
- bm25: -10.0230 | relevance: 1.0000

const primary = await adminSupabase
      .from('planned_lessons')
      .select('*')
      .eq('learner_id', learnerId)
      .eq('facilitator_id', user.id)
      .order('scheduled_date', { ascending: true })

data = primary.data
    error = primary.error

if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

if (!Array.isArray(data) || data.length === 0) {
      const fallback = await adminSupabase
        .from('planned_lessons')
        .select('*')
        .eq('learner_id', learnerId)
        .order('scheduled_date', { ascending: true })

if (fallback.error) {
        return NextResponse.json({ error: fallback.error.message }, { status: 500 })
      }

const allRows = Array.isArray(fallback.data) ? fallback.data : []
      const distinctFacilitators = Array.from(
        new Set(allRows.map(r => r?.facilitator_id).filter(Boolean))
      )

// Only return fallback rows if they're clearly a single legacy owner/facilitator namespace.
      if (distinctFacilitators.length === 1) {
        data = allRows
      } else {
        data = []
      }
    }

// Transform to the format expected by the calendar: { 'YYYY-MM-DD': [{...}] }
    const plannedLessons = {}
    for (const row of data || []) {
      const dateStr = row.scheduled_date
      if (!plannedLessons[dateStr]) {
        plannedLessons[dateStr] = []
      }
      plannedLessons[dateStr].push(row.lesson_data)
    }

return NextResponse.json({ plannedLessons })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

### 12. src/app/facilitator/generator/counselor/CounselorClient.jsx (e6e5bdb04e4f8ffb58e98629cf1d83f0226fdcc0dfd83c9a80ba52c1cfcc1582)
- bm25: -9.6391 | relevance: 1.0000

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
          message: finalForwardMessage,
          // Send previous conversation history (API will append current message to build full context)
          history: conversationHistory,
          // Include learner context if a learner is selected
          learner_transcript: learnerTranscript || null,
          // Include persistent goals notes
          goals_notes: goalsNotes || null,
          // Include any context from interceptor
          interceptor_context: Object.keys(forwardContext).length > 0 ? forwardContext : undefined,
          require_generation_confirmation: true,
          generation_confirmed: generationConfirmed,
          disableTools
        })
      })

### 13. src/app/facilitator/generator/counselor/CounselorClient.jsx (4145f1d7e34498e1118fdd78106e988516bd72021cebb8b84d061bc7cd6ab9c1)
- bm25: -9.5793 | relevance: 1.0000

// Play audio from base64
  const playAudio = useCallback(async (base64Audio) => {
    if (!base64Audio) return
    
    try {
      // Stop any existing audio
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }

### 14. src/app/facilitator/generator/counselor/CounselorClient.jsx (21734fbea5937685ad9d6ba7995e1caa4e37b653463a67210256ef9a110f2ea6)
- bm25: -9.2256 | relevance: 1.0000

// Check if THIS session was deactivated (taken over)
        if (updatedSession.session_id === sessionId && oldSession.is_active && !updatedSession.is_active) {
          console.log('[Realtime] THIS SESSION taken over - showing PIN overlay')
          
          // Clear persisted session ID so next load generates a new one
          clearPersistedSessionIdentifier()
          initializedSessionIdRef.current = null
          
          // Clear conversation state
          setConversationHistory([])
          setDraftSummary('')
          setCurrentSessionTokens(0)
          setSessionStarted(false)
          setSessionLoading(false)
          
          // Fetch the active session to show in takeover dialog
          ;(async () => {
            try {
              const checkRes = await fetch(`/api/mentor-session?sessionId=${sessionId}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              })
              if (checkRes.ok) {
                const checkData = await checkRes.json()
                if (checkData.session) {
                  setConflictingSession(checkData.session)
                }
              }
            } catch (err) {
              console.error('[Realtime] Failed to fetch active session:', err)
            }
          })()
          
          setShowTakeoverDialog(true)
        } else {
          console.log('[Realtime] Update is for different session or not a takeover:', {
            isSameSession: updatedSession.session_id === sessionId,
            wasActive: oldSession.is_active,
            isActive: updatedSession.is_active
          })
        }
      })
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status)
      })

### 15. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (d3b32d06583cbe6c80ee50fe70405a41a90ce6de5db7f49eebe3ae5239e196d1)
- bm25: -9.2134 | relevance: 1.0000

useEffect(() => {
    if (!learnerId || learnerId === 'none') return
    if (!accessToken) return
    loadCalendarData({ force: true })
  }, [accessToken, learnerId, loadCalendarData])

useEffect(() => {
    setSelectedDate(null)
    setRescheduling(null)
    setListTab('scheduled')
    setScheduledLessons({})
    setPlannedLessons({})
    scheduleLoadedForLearnerRef.current = null
    plannedLoadedForLearnerRef.current = null
    scheduleLoadedAtRef.current = 0
    plannedLoadedAtRef.current = 0
    scheduleLoadInFlightRef.current = false
    plannedLoadInFlightRef.current = false
  }, [learnerId])

useEffect(() => {
    if (selectedDate && scheduledLessons[selectedDate]) {
      setScheduledForSelectedDate(scheduledLessons[selectedDate])
    } else {
      setScheduledForSelectedDate([])
    }
  }, [selectedDate, scheduledLessons])

useEffect(() => {
    if (selectedDate && plannedLessons[selectedDate]) {
      setPlannedForSelectedDate(plannedLessons[selectedDate])
    } else {
      setPlannedForSelectedDate([])
    }
  }, [selectedDate, plannedLessons])

useEffect(() => {
    setRedoPromptDrafts((prev) => {
      const next = { ...prev }
      plannedForSelectedDate.forEach((l) => {
        if (!l?.id) return
        if (next[l.id] === undefined && l.promptUpdate) {
          next[l.id] = String(l.promptUpdate)
        }
      })
      return next
    })
  }, [plannedForSelectedDate])

const daysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

const firstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

### 16. src/app/facilitator/generator/counselor/CounselorClient.jsx (916dddf93a7a0b0ffe53e9475fbb2bdc224f45bac40f2525a5224d848e78d27d)
- bm25: -8.3380 | relevance: 1.0000

if (!token) {
              interceptResult.response = 'Please sign in first.'
            } else {
              try {
                const res = await fetch('/api/custom-subjects', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ name: action.name })
                })
                const js = await res.json().catch(() => null)
                if (!res.ok) {
                  interceptResult.response = js?.error
                    ? `I couldn't add that subject: ${js.error}`
                    : "I couldn't add that subject. Please try again."
                } else {
                  interceptResult.response = `Added custom subject: ${js?.subject?.name || action.name}.`
                }
              } catch {
                interceptResult.response = "I couldn't add that subject. Please try again."
              }
            }
          } else if (action.type === 'delete_custom_subject') {
            setLoadingThought('Deleting custom subject...')

### 17. src/app/facilitator/generator/counselor/CounselorClient.jsx (05d7e2cc80309cccfac87b5554e4c5c853cacf8a876cc5fd8acfb029da709e01)
- bm25: -8.3322 | relevance: 1.0000

// Update draft summary in background (async, non-blocking)
      updateDraftSummary(finalHistory, token).catch(err => {
        // Silent error handling - don't block the UI
      })

} catch (err) {
      // Silent error handling
      enqueueToolThoughts([
        {
          id: `error-${Date.now()}`,
          name: 'system',
          phase: 'error',
          message: 'I hit a connection snag reaching the server. Please try once more.'
        }
      ])
      setError('Failed to reach Mr. Mentor. Please try again.')
    } finally {
      setLoading(false)
      setLoadingThought(null)
    }
  }, [userInput, loading, conversationHistory, playAudio, learnerTranscript, goalsNotes, selectedLearnerId, sessionStarted, currentSessionTokens, enqueueToolThoughts, handleLessonGeneration, continueLessonFollowUp, learners, loadAllLessons, getLoadingThought])

### 18. src/app/facilitator/generator/counselor/CounselorClient.jsx (9c1aca6e6bf5f84ae15d9ced5a9b809e987bab3361e247d57b6b14a612c1fab6)
- bm25: -6.8652 | relevance: 1.0000

return response.json()
  }, [learnerTranscript, goalsNotes])
  
  // Load all lessons for interceptor
  const loadAllLessons = useCallback(async () => {
    const SUBJECTS = ['math', 'science', 'language arts', 'social studies', 'general']
    const results = {}
    
    for (const subject of SUBJECTS) {
      try {
        const res = await fetch(`/api/lessons/${encodeURIComponent(subject)}`, {
          cache: 'no-store'
        })
        if (res.ok) {
          const list = await res.json()
          if (Array.isArray(list)) {
            results[subject] = list
          }
        }
      } catch (err) {
        // Silent error - continue with other subjects
      }
    }
    
    // Load generated lessons
    const supabase = getSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    
    if (token) {
      try {
        const res = await fetch('/api/facilitator/lessons/list', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const generatedList = await res.json()
          results['generated'] = generatedList.map(lesson => ({
            ...lesson,
            isGenerated: true
          }))
          
          // Also add generated lessons to their subject buckets
          for (const lesson of generatedList) {
            const subject = lesson.subject || 'math'
            if (!results[subject]) results[subject] = []
            results[subject].push({
              ...lesson,
              isGenerated: true
            })
          }
        }
      } catch (err) {
        // Silent error
      }
    }
    
    return results
  }, [])

### 19. src/app/facilitator/generator/counselor/CounselorClient.jsx (022845e3b117a6121d0f0b6e36faa1e11181c90e6e01e77f800967fa44977d55)
- bm25: -6.8227 | relevance: 1.0000

// Initialize session when all dependencies are ready
  useEffect(() => {
    // Only attempt initialization when all required dependencies are ready
    if (!sessionId || !accessToken || !hasAccess || !tierChecked) {
      // If we're still waiting for dependencies, keep loading state true only if we haven't checked yet
      if (tierChecked && (!hasAccess || !accessToken)) {
        // Dependencies are checked but we don't have access - stop loading
        setSessionLoading(false)
      }
      return
    }
    
    // Don't re-initialize if we've already initialized this session ID
    if (initializedSessionIdRef.current === sessionId) {
      return
    }
    
    // Mark this session ID as initialized
    initializedSessionIdRef.current = sessionId
    
    // All dependencies ready - initialize
    initializeMentorSession()
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, accessToken, hasAccess, tierChecked])

### 20. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (264a74c57f0ac59d9216cc10bf0647c827faa69854b9b70ced5b4fc17ae349a4)
- bm25: -6.5531 | relevance: 1.0000

const result = await response.json()
      const nextPlanned = result.plannedLessons || {}
      if (requestId === plannedRequestIdRef.current) {
        setPlannedLessons(nextPlanned)
        const dateKeys = Object.keys(nextPlanned || {})
        const totalLessons = dateKeys.reduce((sum, k) => sum + (Array.isArray(nextPlanned?.[k]) ? nextPlanned[k].length : 0), 0)
        devWarn(`planned: loaded dates=${dateKeys.length} lessons=${totalLessons}`)
        plannedLoadedForLearnerRef.current = targetLearnerId
        plannedLoadedAtRef.current = Date.now()
      } else {
        devWarn('planned: stale result ignored')
      }
    } catch (err) {
      if (String(err?.name || '') === 'AbortError') {
        devWarn('planned: timeout/abort', err)
        // Do not clear state on timeout; a newer request may have succeeded.
      } else {
        const msg = 'planned: unexpected error'
        devWarn(msg, err)
        if (requestId === plannedRequestIdRef.current) {
          setPlannedLessons({})
        }
      }
    } finally {
      plannedLoadInFlightRef.current = false
      devWarn(`planned: done ms=${Date.now() - startedAtMs}`)
    }
  }, [])

### 21. src/app/facilitator/generator/counselor/CounselorClient.jsx (31756784cb65087c8fc1e9ae92644b1d3fcf8ecb57e3879160209d2f20256407)
- bm25: -6.3902 | relevance: 1.0000

if (!target?.id) {
                  interceptResult.response = `I couldn't find a custom subject named "${action.name}".`
                } else {
                  const delRes = await fetch(`/api/custom-subjects?id=${encodeURIComponent(target.id)}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                  })
                  const delJs = await delRes.json().catch(() => null)
                  if (!delRes.ok) {
                    interceptResult.response = delJs?.error
                      ? `I couldn't delete that subject: ${delJs.error}`
                      : "I couldn't delete that subject. Please try again."
                  } else {
                    interceptResult.response = `Deleted custom subject: ${target.name}.`
                  }
                }
              } catch {
                interceptResult.response = "I couldn't delete that subject. Please try again."
              }
            }
          } else if (action.type === 'generate_lesson_plan') {
            setLoadingThought('Opening Lesson Planner...')

### 22. src/app/facilitator/generator/counselor/CounselorClient.jsx (dd7b611e88c5b42266461e2e45b4b2badc67b95514a976c22c91a15e202e9836)
- bm25: -5.9076 | relevance: 1.0000

// Load existing draft summary on mount and when learner changes
  useEffect(() => {
    if (!tierChecked || !accessToken) return
    
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        if (!supabase) return
        
        const learnerId = selectedLearnerId !== 'none' ? selectedLearnerId : null
        
        const response = await fetch(`/api/conversation-drafts?learner_id=${learnerId || ''}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

if (response.ok && !cancelled) {
          const data = await response.json()
          if (data.draft?.draft_summary) {
            setDraftSummary(data.draft.draft_summary)
          }
        }
      } catch (err) {
        // Silent error handling
      }
    })()
    
    return () => { cancelled = true }
  }, [accessToken, tierChecked, selectedLearnerId])

// Preload overlay data in background after page is ready
  useEffect(() => {
    if (!tierChecked || !accessToken) return
    
    // Delay preload to let visible content load first
    const preloadTimer = setTimeout(() => {
      // Trigger loads by dispatching events to overlays
      window.dispatchEvent(new CustomEvent('preload-overlays', { 
        detail: { learnerId: selectedLearnerId } 
      }))
    }, 1000) // 1 second delay after page load
    
    return () => clearTimeout(preloadTimer)
  }, [accessToken, tierChecked, selectedLearnerId])

### 23. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (ff1d44c554c726fe22e61f47b5f18ac18e6472615c3b39a821fb2f56ebc0bf62)
- bm25: -5.9000 | relevance: 1.0000

const persistPlannedForDate = async (dateStr, lessonsForDate) => {
    if (!learnerId || learnerId === 'none') return false

try {
      const token = await getBearerToken()
      if (!token) throw new Error('Not authenticated')

const response = await fetch('/api/planned-lessons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          learnerId,
          plannedLessons: { [dateStr]: lessonsForDate }
        })
      })

const js = await response.json().catch(() => null)
      if (!response.ok) throw new Error(js?.error || 'Failed to save planned lessons')
      return true
    } catch (err) {
      alert('Failed to save planned lessons')
      return false
    }
  }

const savePlannedLessons = async (lessons) => {
    setPlannedLessons(lessons)

if (!learnerId || learnerId === 'none') return

try {
      const token = await getBearerToken()
      if (!token) return

await fetch('/api/planned-lessons', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          learnerId,
          plannedLessons: lessons
        })
      })
    } catch (err) {
      alert('Failed to save planned lessons')
    }
  }

const loadPlannedForLearner = useCallback(async (targetLearnerId, opts = {}) => {
    if (!targetLearnerId || targetLearnerId === 'none') {
      devWarn('planned: no learner selected', { targetLearnerId })
      setPlannedLessons({})
      plannedLoadedForLearnerRef.current = null
      plannedLoadedAtRef.current = 0
      return
    }

### 24. src/app/facilitator/generator/counselor/CounselorClient.jsx (8130a463fc027ebf8053f904e0645b8927e907d60d1c0f63619014114803962e)
- bm25: -5.8597 | relevance: 1.0000

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
        { role: 'user', content: finalForwardMessage }
      ]
      setConversationHistory(updatedHistory)

// Display user message in captions
      setCaptionText(finalForwardMessage)
      setCaptionSentences([finalForwardMessage])
      setCaptionIndex(0)

### 25. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (ed50d954a1dd822da6f1ed2b2ebf87ead4a192226980aba45214b14e7ccc7a67)
- bm25: -5.6416 | relevance: 1.0000

for (const [k, dates] of completedDatesByLesson.entries()) {
              const uniq = Array.from(new Set((dates || []).filter(Boolean))).sort()
              completedDatesByLesson.set(k, uniq)
            }
          }
        }
      } catch {
        completedKeySet = new Set()
        completedDatesByLesson = new Map()
        completionLookupFailed = true
      }

### 26. src/app/facilitator/generator/counselor/CounselorClient.jsx (542e1bc6da6adb7ab2d4955176ca6acd616e9a6cf47c7cac811f899580bb8fe2)
- bm25: -5.5880 | relevance: 1.0000

// Subscribe to mentor_sessions changes for this facilitator
    // Note: Can't filter by session_id in postgres_changes, so we filter in the callback
    const channel = supabase
      .channel('mentor-session-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'mentor_sessions'
      }, (payload) => {
        console.log('[Realtime] RAW event received:', {
          event: payload.eventType,
          table: payload.table,
          hasNew: !!payload.new,
          hasOld: !!payload.old
        })

### 27. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (28602697ba00b2af8158c9603145a0584ababbe072f4c635f3ab91d358a825a5)
- bm25: -5.4790 | relevance: 1.0000

{/* Calendar Grid */}
      <div style={{ flex: 1, padding: 8, overflowY: 'auto' }}>
        <>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)', 
            gap: 3,
            marginBottom: 6
          }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} style={{ 
                textAlign: 'center', 
                fontSize: 11,
                fontWeight: 700,
                color: '#6b7280',
                padding: '2px 0'
              }}>
                {day}
              </div>
          ))}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {calendarDays.map((item, idx) => {
            const isToday = item.date === today
            const isSelected = item.date === selectedDate
            const scheduledCount = item.date ? (scheduledLessons[item.date]?.length || 0) : 0
            const plannedCount = item.date ? (plannedLessons[item.date]?.length || 0) : 0
            const hasScheduled = scheduledCount > 0
            const hasPlanned = plannedCount > 0
            const tabHasLessons = listTab === 'planned' ? hasPlanned : hasScheduled
            
            return (
              <button
                key={idx}
                onClick={() => handleDateClick(item.date)}
                disabled={!item.day}
                style={{
                  aspectRatio: '1',
                  border: '1px solid',
                  borderColor: isSelected ? '#3b82f6' : isToday ? '#10b981' : '#e5e7eb',
                  borderRadius: 6,
                  background: isSelected
                    ? '#dbeafe'
                    : isToday
                      ? '#d1fae5'

### 28. src/app/facilitator/generator/counselor/CounselorClient.jsx (24e9e0fb465985f6109813afc4c484cad220215f85d2e7fd8acf00da6a56b9bd)
- bm25: -5.4379 | relevance: 1.0000

// Generate and persist unique session ID on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

let resolvedId = null

try {
      resolvedId = localStorage.getItem('mr_mentor_active_session_id')
    } catch (err) {
      // Silent error handling
    }

if (!resolvedId) {
      try {
        resolvedId = sessionStorage.getItem('mr_mentor_session_id')
      } catch {}
    }

if (!resolvedId) {
      resolvedId = generateSessionIdentifier()
    }

assignSessionIdentifier(resolvedId)
  }, [assignSessionIdentifier, generateSessionIdentifier])

// (initializeMentorSession defined later, after realtime subscription helper)

// Replace polling with realtime subscription for instant conflict detection
  const startRealtimeSubscription = useCallback(async () => {
    if (!sessionId || !accessToken || !hasAccess) return
    
    // Clean up existing subscription
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.unsubscribe()
      realtimeChannelRef.current = null
    }

const supabase = getSupabaseClient()
    if (!supabase) return

// Get user ID for filtering
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('[Realtime] Cannot start subscription - no user')
      return
    }

console.log('[Realtime] Starting subscription for session:', sessionId, 'user:', user.id)

### 29. src/app/facilitator/generator/counselor/CounselorClient.jsx (5e9a1fde43a303665b912c12a2715edf1c58592fe07c30a6c78c3dc85e6937aa)
- bm25: -5.4171 | relevance: 1.0000

try {
      // Try interceptor first
      const selectedLearner = learners.find(l => l.id === selectedLearnerId)
      const learnerName = selectedLearner?.name
      const learnerGrade = selectedLearner?.grade
      const allLessons = await loadAllLessons()
      
      setLoadingThought(getLoadingThought(
        interceptorRef.current.state.flow,
        interceptorRef.current.state.awaitingInput,
        null
      ))
      
      const interceptResult = await interceptorRef.current.process(message, {
        allLessons,
        selectedLearnerId,
        learnerName,
        learnerGrade,
        conversationHistory
      })
      
      console.log('[CounselorClient] Interceptor result:', JSON.stringify({
        handled: interceptResult.handled,
        hasResponse: !!interceptResult.response,
        hasAction: !!interceptResult.action,
        response: interceptResult.response?.substring(0, 100),
        fullResponse: interceptResult.response
      }, null, 2))
      
      if (interceptResult.handled) {
        // Update loading thought based on what we're doing
        if (interceptResult.action) {
          setLoadingThought(getLoadingThought(
            interceptorRef.current.state.flow,
            interceptorRef.current.state.awaitingInput,
            interceptResult.action
          ))
        }
        
        // Add user message to conversation
        const updatedHistory = [
          ...conversationHistory,
          { role: 'user', content: message }
        ]
        
        // Handle action if present
        if (interceptResult.action) {
          const action = interceptResult.action
          
          if (action.type === 'schedule') {
            setLoadingThought("Adding this lesson to the calendar...")
            // Schedule the les

### 30. src/app/facilitator/generator/counselor/CounselorClient.jsx (074ab67a7549c93d89a73279040d8a5520afa9d027ed9fc76e624620ac00c47c)
- bm25: -5.2721 | relevance: 1.0000

// Send message to Mr. Mentor
  const sendMessage = useCallback(async () => {
    const message = userInput.trim()
    if (!message || loading) return

// Flags for generation confirmation flow
    let generationConfirmed = false
    const disableTools = []
    let declineNote = null

if (pendingConfirmationTool === 'generate_lesson') {
      const lower = message.toLowerCase()
      const yesPattern = /\b(yes|yep|yeah|sure|ok|okay|alright|do it|go ahead|please|generate|create)\b/
      const noPattern = /\b(no|nah|not now|stop|cancel|wait|hold on|recommend|advice|idea|later|don['’]?t|do not)\b/

if (yesPattern.test(lower)) {
        generationConfirmed = true
      } else {
        disableTools.push('generate_lesson')
        declineNote = '(User declined generation. Respond by providing assistance with the user\'s problem.)'
      }

setPendingConfirmationTool(null)
    }

// If no session ID exists (e.g., after delete), generate a new one
    if (!sessionId) {
      const newSessionIdentifier = generateSessionIdentifier()
      assignSessionIdentifier(newSessionIdentifier)
      // Session will be initialized on next render cycle via useEffect
    }

setLoading(true)
    setLoadingThought("Processing your request...")
    setError('')
    setUserInput('')

### 31. src/app/facilitator/generator/counselor/CounselorClient.jsx (522ab39063e230157e6930834c7b91eac4dc40718127b5c4c4cde7d3441a9ebd)
- bm25: -5.1912 | relevance: 1.0000

// Helper: Handle lesson generation with client-side validation and fixing (like lesson-maker)
  const handleLessonGeneration = async (toolResult, token) => {
    const summary = {
      lessonFile: toolResult.lessonFile,
      lessonTitle: toolResult.lesson?.title || toolResult.lessonTitle || 'Lesson',
      status: 'pending',
      issueCount: 0,
      warningCount: 0,
      fixApplied: false,
      message: '',
      error: null
    }

### 32. src/app/facilitator/generator/counselor/CounselorClient.jsx (9cdc5ff6b12c83bffa0790f39936509ec027087e3ba44aec2e2a1aa46cb2b064)
- bm25: -4.7712 | entity_overlap_w: 1.00 | adjusted: -5.0212 | relevance: 1.0000

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

### 33. src/app/facilitator/generator/counselor/CounselorClient.jsx (b1289d38ff12f70a9375aa7cb7a8c3bca106c07240fc2f93983179ed030fcd09)
- bm25: -4.9565 | relevance: 1.0000

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

### 34. src/app/facilitator/generator/counselor/CounselorClient.jsx (79678d04dcd49568cd2a00ec07a8f6ec9351ccf6675aff2938379c24a475f8ec)
- bm25: -4.7895 | relevance: 1.0000

// Ensure the calendar overlay is mounted to receive the event.
            setActiveScreen('calendar')

if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('mr-mentor:open-lesson-planner', {
                detail: {
                  learnerId: action.learnerId || selectedLearnerId,
                  startDate: action.startDate,
                  durationMonths: action.durationMonths,
                  autoGenerate: true
                }
              }))
            }

### 35. src/app/facilitator/generator/counselor/CounselorClient.jsx (42143f09ae9e41426986d7e75fae9367f7c29dddc775b64f6f9978a58a51627e)
- bm25: -4.5994 | relevance: 1.0000

realtimeChannelRef.current = channel
  }, [sessionId, accessToken, hasAccess])

// Clean up realtime subscription on unmount
  useEffect(() => {
    return () => {
      if (realtimeChannelRef.current) {
        realtimeChannelRef.current.unsubscribe()
        realtimeChannelRef.current = null
      }
    }
  }, [])

// Monitor conversation length and enforce turn limits
  useEffect(() => {
    const turnCount = conversationHistory.length

// Warning at 30 turns
    if (turnCount === 30 && !turnWarningShown) {
      setTurnWarningShown(true)
      alert('Your conversation is getting long. Consider starting a new conversation soon for better performance.')
    }

// Force overlay at 50 turns
    if (turnCount >= 50 && !showClipboard) {
      setShowClipboard(true)
      setClipboardForced(true)
    }
  }, [conversationHistory.length, showClipboard, turnWarningShown])

// Reset warning flag when new conversation starts
  useEffect(() => {
    if (conversationHistory.length === 0) {
      setTurnWarningShown(false)
      setClipboardForced(false)
    }
  }, [conversationHistory.length])

const initializeMentorSession = useCallback(async () => {
    if (!sessionId || !accessToken || !hasAccess || !tierChecked) {
      return
    }

console.log('[Mr. Mentor] Initializing session:', sessionId)
    setSessionLoading(true)

try {
      const checkRes = await fetch(`/api/mentor-session?sessionId=${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

if (!isMountedRef.current) {
        setSessionLoading(false)
        return
      }

if (!checkRes.ok) {
        const data = await checkRes.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to check existing session')
      }

### 36. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (72f71f21d7008430b2e555fcff567c82b39bcb4d1b3afbe778bd4b7dac89488f)
- bm25: -4.5308 | relevance: 1.0000

<div style={{ flex: 1, overflowY: 'auto' }}>
            <LessonPlanner
              learnerId={learnerId}
              learnerGrade={learnerGrade}
              tier={tier}
              canPlan={canPlan}
              selectedDate={selectedDate}
              plannedLessons={plannedLessons}
              initialPlanStartDate={plannerInit?.startDate || undefined}
              initialPlanDuration={plannerInit?.durationMonths || undefined}
              autoGeneratePlan={!!plannerInit?.autoGenerate}
              onPlannedLessonsChange={savePlannedLessons}
              onLessonGenerated={async () => {
                setScheduledLessons({})
                scheduleLoadedForLearnerRef.current = null
                await loadSchedule()
              }}
            />
          </div>
        </div>
      </div>
    )

### 37. src/app/facilitator/generator/counselor/CounselorClient.jsx (574462716c3e57fd62d3b538f020e78cac04d380eb1ec5b82e2d4fc6776bb067)
- bm25: -4.4354 | relevance: 1.0000

// Helper: Actually clear conversation state after save/delete
  const clearConversationAfterSave = async () => {
    // End current session in database
    if (sessionId && accessToken) {
      try {
        await fetch(`/api/mentor-session?sessionId=${sessionId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })
      } catch (e) {
        // Silent error handling
      }
    }
    
    // End current session usage tracking
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
        // Silent error handling
      }
    }
    
    if (sessionPollInterval.current) {
      clearInterval(sessionPollInterval.current)
      sessionPollInterval.current = null
    }

### 38. src/app/facilitator/generator/counselor/CounselorClient.jsx (ce2fbe1986b441a81ce4477430a0a63798f32d329cd1a0b749d476315bdc9736)
- bm25: -4.3225 | relevance: 1.0000

if (initialToolResults.length > 0) {
        setLoadingThought("Processing tool results...")
        for (const toolResult of initialToolResults) {
          if (toolResult.lesson && toolResult.lessonFile && toolResult.userId) {
            setLoadingThought("Validating generated lesson...")
            const summary = await handleLessonGeneration(toolResult, token)
            if (summary) {
              validationSummaries.push(summary)
            }
          }
          
          // Dispatch events for schedule_lesson success
          if (toolResult.success && toolResult.scheduled) {
            setLoadingThought("Updating calendar...")
            try {
              window.dispatchEvent(new CustomEvent('mr-mentor:lesson-scheduled', {
                detail: {
                  learnerName: toolResult.learnerName,
                  scheduledDate: toolResult.scheduledDate,
                  lessonTitle: toolResult.lessonTitle
                }
              }))
            } catch (err) {
              // Silent error handling
            }
          }
        }
      }

### 39. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (10cfa11e1affbf6cb59a97c6edd24c05ba3e13c56e05a25d75d1e364b68e9788)
- bm25: -4.2359 | relevance: 1.0000

const current = Array.isArray(plannedLessons[selectedDate]) ? plannedLessons[selectedDate] : []
                            const next = current.map((l) => (l.id === lesson.id ? { ...l, promptUpdate: value } : l))
                            const ok = await persistPlannedForDate(selectedDate, next)
                            if (!ok) return
                            setPlannedLessons((prev) => ({ ...prev, [selectedDate]: next }))
                          }}
                          placeholder="Example: Different topic; focus on map skills."
                          rows={2}
                          style={{
                            width: '100%',
                            resize: 'vertical',
                            fontSize: 11,
                            padding: 6,
                            border: '1px solid #e5e7eb',
                            borderRadius: 6
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

### 40. src/app/facilitator/generator/counselor/CounselorClient.jsx (ff285077ec24364a3d15a828b25960da37c088fbeb7771884ec5d2aa164606df)
- bm25: -4.1642 | relevance: 1.0000

if (!isMountedRef.current) {
          console.log('[Realtime] Ignoring - component unmounted')
          return
        }

const updatedSession = payload.new
        const oldSession = payload.old

// Only process updates for this user's sessions
        if (updatedSession.facilitator_id !== user.id) {
          console.log('[Realtime] Ignoring - different user:', {
            eventUserId: updatedSession.facilitator_id,
            myUserId: user.id
          })
          return
        }

console.log('[Realtime] Session update detected:', { 
          updatedSessionId: updatedSession.session_id, 
          mySessionId: sessionId,
          isActive: updatedSession.is_active,
          wasActive: oldSession.is_active,
          facilitatorId: updatedSession.facilitator_id,
          deviceName: updatedSession.device_name
        })
