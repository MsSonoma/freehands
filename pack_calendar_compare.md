# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

Compare scheduled-lesson rendering rules between the facilitator calendar page and the Mr Mentor CalendarOverlay. Specifically: does the facilitator calendar hide past scheduled lessons unless completed? Identify the relevant logic in both places and any differences. Provide chunk IDs.

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/facilitator/calendar/page.js (4f93e9cc0018c9b6e27aad45f0db5ed725a2d8b9081a5d3956bf19db6ce6f906)
- bm25: -25.1607 | relevance: 1.0000

if (!response.ok) {
        const errorText = await response.text()
        let errorData = {}
        try {
          errorData = JSON.parse(errorText)
        } catch {
          // Silent fail on parse error
        }
        
        if (errorData.error?.includes('lesson_schedule') || errorData.error?.includes('does not exist') || errorData.error?.includes('relation')) {
          setScheduledLessons({})
          setTableExists(false)
          return
        }
        
        if (response.status === 401) {
          setScheduledLessons({})
          return
        }
        
        throw new Error(errorData.error || 'Failed to load schedule')
      }
      
      setTableExists(true)

const data = await response.json()
      const schedule = data.schedule || []

const todayStr = getLocalTodayStr()

// Build a completion lookup from lesson_session_events.
      // Past scheduled dates will show only completed lessons.
      // NOTE: Lessons may be completed after their scheduled date (make-up work).
      // We treat a scheduled lesson as completed if it is completed on the same date OR within a short window after.
      let completedKeySet = new Set()
      let completedDatesByLesson = new Map()
      let completionLookupFailed = false
      try {
        const pastSchedule = (schedule || []).filter(s => s?.scheduled_date && s.scheduled_date < todayStr)
        const minPastDate = pastSchedule.reduce((min, s) => (min && min < s.scheduled_date ? min : s.scheduled_date), null)

### 2. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (794f51f6b415d06fd9a76fb8545513e96e23216bc9a2bb9029aa606c1256b82c)
- bm25: -24.1119 | relevance: 1.0000

contextText += '\n\n=== REDO RULES: SAME AS PLANNER GENERATION ==='
      contextText += '\nYou are regenerating a planned lesson outline.'
      contextText += `\nPrefer NEW topics most of the time, but you MAY plan a rephrased Review for low scores (<= ${LOW_SCORE_REVIEW_THRESHOLD}%).`
      contextText += `\nAvoid repeating high-score topics (>= ${HIGH_SCORE_AVOID_REPEAT_THRESHOLD}%) unless the facilitator explicitly requests it.`
      contextText += "\nIf you choose a Review lesson, the title MUST start with 'Review:' and it must use different examples."
      contextText += '\nDo NOT produce an exact duplicate of any scheduled/planned lesson above.'

### 3. src/app/facilitator/calendar/page.js (c9c353ed7ee343f531886f74706eac2c2bef9932de9d89f1819a6330fa59cca5)
- bm25: -19.7678 | relevance: 1.0000

// Canonical lesson id used for matching completion events to scheduled lessons.
  // Completion rows often store a filename-ish id, while schedule stores subject/prefix paths.
  // Canonicalize both to the same basename-without-extension.
  const canonicalLessonId = (raw) => {
    if (!raw) return null
    const normalized = normalizeLessonKey(String(raw)) || String(raw)
    const base = normalized.includes('/') ? normalized.split('/').pop() : normalized
    const withoutExt = String(base || '').replace(/\.json$/i, '')
    return withoutExt || null
  }

### 4. src/app/facilitator/calendar/page.js (45a3f960320e40cd0f5d44fbd1557244327369796a5b24116ee137e4fc1a97a6)
- bm25: -18.9432 | relevance: 1.0000

// Load the full schedule history for this learner.
      // This enables retroactive backfills (from lesson_history) to show up on older months.
      // We still filter past dates to only completed lessons after loading.
      const response = await fetch(
        `/api/lesson-schedule?learnerId=${selectedLearnerId}`,
        {
          headers: {
            'authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

### 5. src/app/facilitator/calendar/page.js (5e87d7c4007b60bd8dc94a3654ecdcc51bd79003e2d025df44b062ea052b69f4)
- bm25: -18.2822 | relevance: 1.0000

if (pastSchedule.length > 0 && minPastDate) {
          // IMPORTANT: Do not query lesson_session_events directly from the client.
          // In some environments, RLS causes the query to return an empty array without an error,
          // which hides all past schedule history. Use the admin-backed API endpoint instead.
          const historyRes = await fetch(
            `/api/learner/lesson-history?learner_id=${selectedLearnerId}&from=${encodeURIComponent(minPastDate)}&to=${encodeURIComponent(todayStr)}`
          )
          const historyJson = await historyRes.json().catch(() => null)

### 6. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (3ff2001d1b38b93c2f7405475f5a1dd8877dfa62616a92a0f0d8280a343b7099)
- bm25: -17.7255 | relevance: 1.0000

// Build a completion lookup.
      // Past scheduled dates will show only completed lessons.
      // NOTE: Lessons may be completed after their scheduled date (make-up work).
      let completedKeySet = new Set()
      let completedDatesByLesson = new Map()
      let completionLookupFailed = false
      try {
        const pastSchedule = (data || []).filter(row => row?.scheduled_date && row.scheduled_date < todayStr)
        const minPastDate = pastSchedule.reduce((min, r) => (min && min < r.scheduled_date ? min : r.scheduled_date), null)

### 7. src/app/facilitator/calendar/LessonPlanner.jsx (426d7a2069ad0af30eac2d862612b0b84c4fccada605caa681924ce5f5f81bb4)
- bm25: -15.3795 | relevance: 1.0000

if (lowScoreCompleted.length > 0) {
            contextText += `\n\nLow-score completed lessons that are eligible for REVIEW (<= ${LOW_SCORE_REVIEW_THRESHOLD}%):\n`
            lowScoreCompleted.forEach((l) => {
              contextText += `- ${l.name} (score: ${l.score}%)\n`
            })
          }

if (highScoreCompleted.length > 0) {
            contextText += `\n\nHigh-score completed lessons to AVOID repeating (>= ${HIGH_SCORE_AVOID_REPEAT_THRESHOLD}%):\n`
            highScoreCompleted.forEach((l) => {
              contextText += `- ${l.name} (score: ${l.score}%)\n`
            })
          }

contextText += '\n\nWhen you choose a REVIEW lesson:'
          contextText += '\n- It can revisit the underlying concept of a low-score lesson'
          contextText += '\n- It MUST be rephrased with different examples and practice (not a near-duplicate)'
          contextText += "\n- The title MUST start with 'Review:'"

contextText += '\n\nAlso: you are generating a multi-week plan.'
          contextText += '\nFor weekly recurring subjects, each week MUST progress naturally.'
          contextText += "\nDo not repeat last week's topic unless it is explicitly a 'Review:' for a low-score concept."

contextText += '\n\nCurriculum Evolution Guidelines:'
          contextText += '\n- Mix new instruction with occasional review based on scores'
          contextText += '\n- Build sequentially (e.g., after "Fractions Intro" → "Comparing Fractions" → "Adding Fractions")'
          contextText += '\n- Reference prior concepts but teach something genuinely new'
          contextText += `\n- Target difficulty: ${recommendedDifficulty} (maintain for 3-4 lessons before advancing)`

### 8. src/app/facilitator/calendar/LessonPlanner.jsx (8ae7a00c94a81bb7d0702b0c9983dad57ff00de8515e988d59101520fa46cf82)
- bm25: -15.3095 | relevance: 1.0000

if (contextText) {
        contextText += '\n\n=== PLANNING RULES: NEW TOPICS vs REVIEW ==='
          contextText += `\nPrefer NEW topics most of the time, but schedule REVIEW lessons for low scores (<= ${LOW_SCORE_REVIEW_THRESHOLD}%).`
          contextText += `\nAvoid repeating lessons that scored well (>= ${HIGH_SCORE_AVOID_REPEAT_THRESHOLD}%).`

### 9. src/app/api/planned-lessons/route.js (61d4c28ba90f1d8e1e9174584b7c682b2d97aedbd8d4340b91e8ddb0c66f0ead)
- bm25: -15.1661 | relevance: 1.0000

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

### 10. src/app/facilitator/generator/counselor/CounselorClient.jsx (79678d04dcd49568cd2a00ec07a8f6ec9351ccf6675aff2938379c24a475f8ec)
- bm25: -15.0921 | relevance: 1.0000

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

### 11. src/app/facilitator/calendar/LessonPlanner.jsx (fd591deb67440b85e69d10a8c0629a0abe24abd9a3d4d3f92016c00b9d8bf080)
- bm25: -14.9665 | relevance: 1.0000

const allSubjects = [...CORE_SUBJECTS, ...customSubjects.map(s => s.name)]

return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Title and Workflow Guide */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', margin: 0 }}>
          Create a Lesson Plan
        </h2>
        <WorkflowGuide
          workflowKey="lesson-planner-workflow"
          title="How Automated Lesson Planning Works"
          steps={[
            { 
              step: 'Set your weekly pattern', 
              description: 'Check which subjects you want to teach on each day of the week below' 
            },
            { 
              step: 'Choose start date and duration', 
              description: 'Select when to begin and how many weeks/months to plan' 
            },
            { 
              step: 'Generate lesson plan', 
              description: 'We create lesson outlines based on your learner\'s history and grade level' 
            },
            { 
              step: 'Review and generate full lessons', 
              description: 'Click dates in the calendar to see planned lessons. Generate full lesson content for any outline you like' 
            }
          ]}
        />
      </div>

### 12. src/app/api/planned-lessons/route.js (343b4ca5051beb3247ceb138f38e20ea48dd8d8ff5a9dbd9426f26ab307e073b)
- bm25: -13.9897 | relevance: 1.0000

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

### 13. src/app/facilitator/generator/counselor/CounselorClient.jsx (f4f593304c4caaa4f37c3d531c00e6df1a69a1150f8aecb45ed20ffadae9f60e)
- bm25: -13.6277 | relevance: 1.0000

const ent = featuresForTier(tier)
  const mentorLimit = ent.mentorSessions
  const mentorAllowanceBanner = mentorLimit === 0 ? (
    <div style={{
      border: '1px solid #fcd34d',
      background: '#fef3c7',
      color: '#92400e',
      padding: 12,
      borderRadius: 10,
      fontSize: 14,
      lineHeight: 1.5
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <strong>View-only:</strong> Mr. Mentor is available on the Pro plan.
          <div>Sending and saving are disabled on your current plan.</div>
        </div>
        <a
          href="/facilitator/account/plan"
          style={{
            display: 'inline-block',
            padding: '8px 12px',
            background: '#2563eb',
            color: '#fff',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            textDecoration: 'none',
            whiteSpace: 'nowrap'
          }}
        >
          Upgrade to Pro
        </a>
      </div>
    </div>
  ) : null

const videoEffectiveHeight = videoMaxHeight && Number.isFinite(videoMaxHeight) ? videoMaxHeight : null

### 14. src/app/facilitator/generator/counselor/CounselorClient.jsx (0cfd9fad62d7fbfc6f7777e33bafc3dd9dcfeb4000945f4f833d493d6441d65d)
- bm25: -13.5539 | relevance: 1.0000

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

### 15. src/app/api/planned-lessons/route.js (13b1caac815cc9c704fe436689e8b167bcfdb8a8352521129c2b4450d7acf36d)
- bm25: -13.3799 | relevance: 1.0000

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

### 16. src/app/facilitator/generator/counselor/CounselorClient.jsx (05d7e2cc80309cccfac87b5554e4c5c853cacf8a876cc5fd8acfb029da709e01)
- bm25: -12.9341 | relevance: 1.0000

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

### 17. src/app/facilitator/calendar/page.js (0a377186862f438af1cc355b6434ce533b912b26ddfc368cb5a3ca5eecb19ddc)
- bm25: -12.7512 | relevance: 1.0000

{/* Day View Overlay */}
            {showDayView && selectedDate && (
              <DayViewOverlay
                selectedDate={selectedDate}
                scheduledLessons={scheduledLessons[selectedDate] || []}
                plannedLessons={plannedLessons[selectedDate] || []}
                learnerId={selectedLearnerId}
                learnerGrade={learners.find(l => l.id === selectedLearnerId)?.grade || '3rd'}
                tier={tier}
                noSchoolReason={noSchoolDates[selectedDate] || null}
                onClose={() => setShowDayView(false)}
                onLessonGenerated={() => {
                  loadSchedule()
                  loadNoSchoolDates()
                }}
                onNoSchoolSet={handleNoSchoolSet}
                onPlannedLessonUpdate={handlePlannedLessonUpdate}
                onPlannedLessonRemove={handlePlannedLessonRemove}
              />
            )}
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-600">No learners found. Add learners first.</p>
            <button
              onClick={() => router.push('/facilitator/learners')}
              className="mt-4 bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition"
            >
              Manage Learners
            </button>
          </div>
        )}
      </div>
    </div>
    
    <GatedOverlay
      show={!isAuthenticated}
      gateType="auth"
      feature="Lesson Calendar"
      emoji="📅"
      description="Sign in to schedule lessons, plan learning activities, and track completion over time."
      benefits={[
        'Schedule lessons in advance for each learner',
        'View all scheduled lessons in a monthly calend

### 18. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (54713806970d7949cc281153da2374c8935f784d9db11eb12a8f5d04a6c0c14c)
- bm25: -12.0708 | relevance: 1.0000

window.addEventListener('mr-mentor:open-lesson-planner', handleOpenPlanner)
    return () => {
      window.removeEventListener('preload-overlays', handlePreload)
      window.removeEventListener('mr-mentor:lesson-scheduled', handleLessonScheduled)
      window.removeEventListener('mr-mentor:open-lesson-planner', handleOpenPlanner)
    }
  }, [learnerId, loadCalendarData, loadSchedule])
  
  useEffect(() => {
    if (learnerId && learnerId !== 'none') {
      loadCalendarData({ force: true })
      
      // Poll for updates every 2 minutes
      const pollInterval = setInterval(() => {
        loadCalendarData({ force: true })
      }, 2 * 60 * 1000)
      
      return () => clearInterval(pollInterval)
    }
  }, [learnerId, loadCalendarData])

### 19. src/app/facilitator/calendar/page.js (e50e23b7dedf60004ac28a1acc2235aed210964f1d9ccd0e8cd0ea70960fa01a)
- bm25: -11.6993 | relevance: 1.0000

{/* Tab Content - Both tabs remain mounted, only visibility changes */}
                <div style={{ display: activeTab === 'scheduler' ? 'block' : 'none' }}>
                  {/* Date Header - only shows when date is selected */}
                  {selectedDate && (
                    <div style={{ 
                      background: 'linear-gradient(to right, #dbeafe, #e0e7ff)', 
                      borderRadius: '8px', 
                      padding: '10px 12px',
                      border: '1px solid #93c5fd'
                    }}>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e40af', marginBottom: '2px' }}>
                        {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                      <div style={{ fontSize: '12px', color: '#3b82f6' }}>
                        {scheduledForSelectedDate.length} scheduled
                      </div>
                    </div>
                  )}

### 20. src/app/facilitator/generator/counselor/CounselorClient.jsx (fc467573538e1b1d5bbce51520f7625005fc49c596b4dab3b23b83b1548b7c5b)
- bm25: -11.4157 | relevance: 1.0000

interceptResult.response = `Ok. I\'m opening the Lesson Planner and generating a ${action.durationMonths}-month plan starting ${action.startDate}.`
          }
        }
        
        // Add interceptor response to conversation
        const finalHistory = [
          ...updatedHistory,
          { role: 'assistant', content: interceptResult.response }
        ]
        setConversationHistory(finalHistory)
        
        // Display interceptor response in captions
        setCaptionText(interceptResult.response)
        const sentences = splitIntoSentences(interceptResult.response)
        setCaptionSentences(sentences)
        setCaptionIndex(0)
        
        // Play TTS for interceptor response (Mr. Mentor's voice)
        setLoadingThought("Preparing response...")
        try {
          const ttsResponse = await fetch('/api/mentor-tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: interceptResult.response })
          })
          
          if (ttsResponse.ok) {
            const ttsData = await ttsResponse.json()
            if (ttsData.audio) {
              await playAudio(ttsData.audio)
            }
          }
        } catch (err) {
          // Silent TTS error - don't block UX
        }
        
        setLoading(false)
        setLoadingThought(null)
        return
      }
      
      // Interceptor didn't handle - forward to API
      setLoadingThought("Consulting my knowledge base...")
      const forwardMessage = interceptResult.apiForward?.message || message
      const finalForwardMessage = declineNote ? `${forwardMessage}\n\n${declineNote}` : forwardMessage
      const forwardContext = interceptResult.apiForward?.context || {}

### 21. src/app/facilitator/generator/counselor/CounselorClient.jsx (542e1bc6da6adb7ab2d4955176ca6acd616e9a6cf47c7cac811f899580bb8fe2)
- bm25: -11.3402 | relevance: 1.0000

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

### 22. src/app/facilitator/generator/counselor/CounselorClient.jsx (ce2fbe1986b441a81ce4477430a0a63798f32d329cd1a0b749d476315bdc9736)
- bm25: -11.3360 | relevance: 1.0000

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

### 23. src/app/facilitator/calendar/page.js (72f70893c01946442b9eded07b75bb6144d62ca4c9aa3ec475af49117056e8d3)
- bm25: -11.2839 | relevance: 1.0000

if (!response.ok) throw new Error('Failed to set no-school date')
      }

await loadNoSchoolDates()
    } catch (err) {
      console.error('Error setting no-school date:', err)
      alert('Failed to update no-school date')
    }
  }

const handleDateSelect = (dateStr) => {
    setSelectedDate(dateStr)
    setShowDayView(true)
  }

if (authLoading || loading) {
    return <div style={{ padding: '24px' }}><p>Loading…</p></div>
  }

return (
    <>
      <div style={{ minHeight: '100vh', background: '#f9fafb', opacity: !isAuthenticated ? 0.5 : 1, pointerEvents: !isAuthenticated ? 'none' : 'auto' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: 12 }}>

{/* Database Setup Warning */}
        {!tableExists && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6">
            <h3 className="text-yellow-800 font-semibold mb-2">⚠️ Database Setup Required</h3>
            <p className="text-yellow-700 text-sm mb-3">
              The lesson_schedule table hasn&apos;t been created yet. Please run the migration in your Supabase SQL Editor:
            </p>
            <code className="block bg-yellow-100 text-yellow-900 p-2 rounded text-xs mb-2">
              scripts/add-lesson-schedule-table.sql
            </code>
            <p className="text-yellow-700 text-xs">
              After running the migration, refresh this page.
            </p>
          </div>
        )}

### 24. src/app/facilitator/calendar/LessonPlanner.jsx (41ec7548b52e447db2478cb50a65390c52556cc5ecbf7d6d75228acf5d3f016b)
- bm25: -10.9109 | relevance: 1.0000

{/* Weekly Pattern Section */}
      <div style={{
        background: '#fff',
        borderRadius: 8,
        border: '1px solid #e5e7eb',
        padding: '16px 4px'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 12,
          paddingLeft: 8,
          paddingRight: 8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', margin: 0 }}>
              Weekly Schedule Pattern
            </h3>
            <InlineExplainer
              helpKey="weekly-pattern-explainer"
              title="Weekly Pattern"
            >
              <p>Check the subjects you want to teach on each day. This pattern repeats every week for the duration you specify.</p>
              <p className="mt-2">Example: Check "Math" on Monday, Wednesday, Friday to schedule 3 math lessons per week.</p>
            </InlineExplainer>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowPreferences(true)}
              disabled={!learnerId}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: '#fff',
                color: '#374151',
                cursor: learnerId ? 'pointer' : 'not-allowed'
              }}
            >
              Curriculum Preferences
            </button>
            <button
              onClick={saveWeeklyPattern}
              disabled={!learnerId}
              style={{
                padding: '8px 16px',

### 25. src/app/facilitator/calendar/LessonPlanner.jsx (7c5ea150fdf1be1697b630d21b376c1ccdf38f66e2661d68ded1f22149901697)
- bm25: -10.8615 | relevance: 1.0000

const buildGenerationSoFarText = (subject) => {
        if (generatedSoFar.length === 0) return ''

const sameSubject = generatedSoFar.filter((l) => l.subject === subject)
        const lines = []

lines.push('\n\nPlanned lessons generated earlier in THIS SAME plan run (do not repeat these topics):')
          lines.push('\n\nPlanned lessons generated earlier in THIS SAME plan run (avoid repeating these exact topics unless explicitly planning a Review):')
        sameSubject.slice(-12).forEach((l) => {
          lines.push(`- ${l.date} (${l.subject}): ${l.title}`)
        })

if (sameSubject.length === 0) {
          lines.push('- (none yet for this subject)')
        }

return `\n${lines.join('\n')}`
      }

// Start from the exact date provided (no Monday adjustment)
      // Parse as local date to avoid timezone issues
      const [year, month, day] = startDate.split('-').map(Number)
      const start = new Date(year, month - 1, day)
      
      for (let week = 0; week < weeks; week++) {
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
          const currentDate = new Date(start)
          currentDate.setDate(start.getDate() + (week * 7) + dayIndex)
          
          const dayName = DAYS[currentDate.getDay()]
          const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
          const daySubjects = weeklyPattern[dayName] || []

for (const subjectInfo of daySubjects) {
            // Generate outline for each subject on this day
            try {
              const dynamicContextText = `${contextText}${buildGenerationSoFarText(subjectInfo.subject)}`

### 26. src/app/facilitator/calendar/page.js (7150390142ddd564e9dea3eae18d3c134f9f08597abc11de6462147a72dbfda5)
- bm25: -10.6629 | relevance: 1.0000

// Past dates: show only completed lessons.
        if (isPast && !completed && !completionLookupFailed) return

if (!grouped[dateStr]) grouped[dateStr] = []
        grouped[dateStr].push({ ...item, completed })
      })

setScheduledLessons(grouped)
    } catch (err) {
      setScheduledLessons({})
    }
  }

const loadPlannedLessons = async () => {
    if (!selectedLearnerId) return
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) return

const response = await fetch(
        `/api/planned-lessons?learnerId=${selectedLearnerId}`,
        {
          headers: {
            'authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

if (!response.ok) {
        setPlannedLessons({})
        return
      }
      
      const data = await response.json()
      setPlannedLessons(data.plannedLessons || {})
    } catch (err) {
      console.error('Error loading planned lessons:', err)
      setPlannedLessons({})
    }
  }

const loadNoSchoolDates = async () => {
    if (!selectedLearnerId) return
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) return

const response = await fetch(
        `/api/no-school-dates?learnerId=${selectedLearnerId}`,
        {
          headers: {
            'authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

if (!response.ok) return
      
      const data = await response.json()
      const dates = data.dates || []

### 27. src/app/facilitator/calendar/LessonPlanner.jsx (6b168bfbed05e5a77c41e13237992b2579bfb9cb2101795ff35d795651c6016e)
- bm25: -10.5419 | relevance: 1.0000

if (!token) {
        setGenerating(false)
        return
      }

// Fetch lesson history (completed, scheduled, planned)
      const [historyRes, medalsRes, scheduledRes, preferencesRes] = await Promise.all([
        fetch(`/api/learner/lesson-history?learner_id=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/medals?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/lesson-schedule?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/curriculum-preferences?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } })
      ])

let lessonContext = []
      let curriculumPrefs = {}

// Build chronological lesson history with scores
      if (historyRes.ok) {
        const history = await historyRes.json()
        let medals = {}
        
        // Get medals if available
        if (medalsRes.ok) {
          medals = await medalsRes.json()
        }
        
        // Completed lessons with scores
        const completed = (history.sessions || [])
          .filter(s => s.status === 'completed')
          .map(s => ({
            name: s.lesson_id,
            date: s.ended_at,
            status: 'completed',
            score: medals[s.lesson_id]?.bestPercent || null
          }))

// Incomplete lessons
        const incomplete = (history.sessions || [])
          .filter(s => s.status === 'incomplete')
          .map(s => ({
            name: s.lesson_id,
            date: s.started_at,
            status: 'incomplete'
          }))

lessonContext = [...completed, ...incomplete]
      }

### 28. src/app/facilitator/calendar/LessonPlanner.jsx (2cdb279d41617abc41fcf9088b8da7c5c209b33cd6b03cc5f9bccb95193eb4d0)
- bm25: -10.5100 | relevance: 1.0000

// Add scheduled lessons
      if (scheduledRes.ok) {
        const scheduledData = await scheduledRes.json()
        const scheduledLessons = (scheduledData.schedule || []).map(s => ({
          name: s.lesson_key,
          date: s.scheduled_date,
          status: 'scheduled'
        }))
        lessonContext = [...lessonContext, ...scheduledLessons]
      }

### 29. src/app/facilitator/calendar/page.js (bfe7321fc7a959811547aba1de597f5beb1fc404d96fb554f58900f22e144113)
- bm25: -10.4756 | relevance: 1.0000

const checkAccess = async () => {
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      // Don't redirect - let the overlay handle it
      if (!session?.user) {
        setCanPlan(false)
        setLoading(false)
        return
      }

### 30. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (eeae3b5c04991b38d96a5b1da021e36bd55776fb2e00ddf3dd71310d55c39e7e)
- bm25: -10.2637 | relevance: 1.0000

const js = await response.json().catch(() => null)
      if (!response.ok) throw new Error(js?.error || 'Failed to save lesson')

alert('Lesson updated successfully!')
      setEditingLesson(null)
      setLessonEditorData(null)
    } catch (err) {
      alert('Failed to save lesson changes')
    } finally {
      setLessonEditorSaving(false)
    }
  }

// Listen for preload event to trigger initial load
  useEffect(() => {
    const handlePreload = () => {
      if (learnerId && learnerId !== 'none') {
        loadCalendarData({ force: true })
      }
    }
    
    const handleLessonScheduled = () => {
      // Clear cache and reload
      setScheduledLessons({})
      scheduleLoadedForLearnerRef.current = null
      scheduleLoadedAtRef.current = 0
      loadSchedule({ force: true })
    }
    
    window.addEventListener('preload-overlays', handlePreload)
    window.addEventListener('mr-mentor:lesson-scheduled', handleLessonScheduled)

const handleOpenPlanner = (evt) => {
      const detail = evt?.detail || {}
      const targetLearnerId = detail?.learnerId
      if (targetLearnerId && learnerId && targetLearnerId !== learnerId) return

setPlannerInit({
        startDate: detail?.startDate || null,
        durationMonths: detail?.durationMonths || null,
        autoGenerate: !!detail?.autoGenerate
      })
      setShowPlannerOverlay(true)
    }

### 31. src/app/facilitator/calendar/LessonPlanner.jsx (25995026c679706cc4664bad8fa9d83f36a2ea4d46f0cceb4221a8654af8eb71)
- bm25: -10.2357 | relevance: 1.0000

{customSubjects.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {customSubjects.map(subject => (
              <div
                key={subject.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  background: '#f3f4f6',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#374151'
                }}
              >
                {subject.name}
                <button
                  onClick={() => handleDeleteCustomSubject(subject.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: 14,
                    padding: 0,
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

{/* Planned Lessons Info */}
      {Object.keys(plannedLessons).length > 0 && (
        <div style={{
          background: '#eff6ff',
          borderRadius: 8,
          border: '1px solid #93c5fd',
          padding: 12
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e40af' }}>
            ✓ Lesson plan generated! Click on dates in the calendar to see planned lessons.
          </div>
        </div>
      )}

### 32. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (b39565838ee1524f1aef0810ea1c684a8168b5cc913c06f629090734dea69e11)
- bm25: -9.9891 | relevance: 1.0000

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

### 33. src/app/facilitator/calendar/page.js (c2521be237a199cb7f605cd99dfb540049509998146be81842fe1b7cce9cc3de)
- bm25: -9.7844 | relevance: 1.0000

const response = await fetch('/api/lesson-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          learnerId: selectedLearnerId,
          lessonKey,
          scheduledDate: date,
        }),
      })

if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to schedule lesson')
      }

await loadSchedule()
      alert('Lesson scheduled successfully!')
    } catch (err) {
      alert(err.message || 'Failed to schedule lesson')
    }
  }

const handleRemoveScheduledLesson = async (item, opts = {}) => {
    if (!requirePlannerAccess()) return
    if (!opts?.skipConfirm) {
      if (!confirm('Remove this lesson from the schedule?')) return
    }

try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

const response = await fetch(
        `/api/lesson-schedule?id=${item.id}`,
        {
          method: 'DELETE',
          headers: {
            'authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

if (!response.ok) throw new Error('Failed to remove lesson')

await loadSchedule()
    } catch (err) {
      alert('Failed to remove lesson')
    }
  }

const handleRescheduleLesson = async (item, newDate) => {
    if (!requirePlannerAccess()) return
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

### 34. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (cdb649a673b844a807410485a9f3f98df83a1dfc70eeeb6a8a07c2740d4b4870)
- bm25: -9.4902 | relevance: 1.0000

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

### 35. src/app/facilitator/calendar/LessonPlanner.jsx (e9cf5e70186db834620635e577a8473855b662fc7c2f36e7d71705984e06c869)
- bm25: -9.4847 | relevance: 1.0000

const requirePlannerAccess = () => {
    if (canPlan) return true
    alert('View-only: upgrade to Pro to use the Lesson Planner.')
    return false
  }

### 36. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (d7b01919719064e439c7903e0e3656a9e5e558677faf7d250b4c7dbc3811a30e)
- bm25: -9.4347 | relevance: 1.0000

const grouped = {}
      data.forEach(item => {
        const dateStr = item.scheduled_date
        const lessonKey = item.lesson_key
        if (!dateStr || !lessonKey) return

const isPast = dateStr < todayStr
        const canonical = canonicalLessonId(lessonKey)
        const direct = canonical ? completedKeySet.has(`${canonical}|${dateStr}`) : false
        const windowEnd = addDaysToDateStr(dateStr, 7)
        const makeup = (() => {
          if (!canonical || !windowEnd) return false
          const dates = completedDatesByLesson.get(canonical) || []
          return dates.some(d => d > dateStr && d <= windowEnd)
        })()
        const completed = direct || makeup

if (isPast && !completed && !completionLookupFailed) return

### 37. src/app/facilitator/generator/counselor/CounselorClient.jsx (8130a463fc027ebf8053f904e0645b8927e907d60d1c0f63619014114803962e)
- bm25: -9.1480 | relevance: 1.0000

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

### 38. src/app/facilitator/generator/counselor/CounselorClient.jsx (59a74988ee5310bcc613f519e0ef8bddd2d94d672b5c0a06f68ab26fbfd64771)
- bm25: -9.0692 | relevance: 1.0000

// Periodic heartbeat to detect if session was taken over (backup to realtime)
  useEffect(() => {
    if (!sessionId || !accessToken || !hasAccess || sessionLoading) return

const checkSessionStatus = async () => {
      try {
        const res = await fetch(`/api/mentor-session?sessionId=${sessionId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        
        if (!res.ok) return

const data = await res.json()
        
        console.log('[Heartbeat] Checking session status:', {
          mySessionId: sessionId,
          activeSessionId: data.session?.session_id,
          isOwner: data.isOwner,
          sessionStarted,
          hasSession: !!data.session
        })
        
        // Only show PIN if there's an active session AND we're not the owner
        // If there's no session at all, don't show PIN - user can start fresh
        if (data.session && !data.isOwner) {
          console.log('[Heartbeat] Not owner - showing PIN overlay')
          
          clearPersistedSessionIdentifier()
          initializedSessionIdRef.current = null
          
          setConversationHistory([])
          setDraftSummary('')
          setCurrentSessionTokens(0)
          setSessionStarted(false)
          setSessionLoading(false)
          
          // Show takeover dialog with the active session info
          setConflictingSession(data.session)
          setShowTakeoverDialog(true)
        }
      } catch (err) {
        console.error('[Heartbeat] Error:', err)
      }
    }

### 39. src/app/facilitator/calendar/page.js (41368a402d7cbe710899b1488e18b75941c2b0bb81b6e0e5dd3fb09cfcd9e774)
- bm25: -9.0469 | relevance: 1.0000

{/* Scheduled Lessons - Show first if any exist */}
                  {selectedDate && scheduledForSelectedDate.length > 0 && (
                    <div className="bg-white rounded-lg shadow-md border border-gray-300 overflow-hidden">
                      <div style={{ background: '#f0fdf4', padding: '8px 12px', borderBottom: '1px solid #bbf7d0' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#065f46', margin: 0 }}>
                          Scheduled for This Day
                        </h3>
                      </div>
                      <div>
                        {scheduledForSelectedDate.map(item => {
                          const [subject, filename] = item.lesson_key.split('/')
                          const lessonName = filename?.replace('.json', '').replace(/_/g, ' ') || item.lesson_key
                          const isPastSelectedDate = selectedDate < getLocalTodayStr()
                          
                          return (
                            <div
                              key={item.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 12px',
                                borderBottom: '1px solid #e5e7eb'
                              }}
                            >
                              <div style={{ flex: '1', minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>
                                  {lessonName}
                                </div>
                              </div>
                              {isPastSelectedDate ? (

### 40. src/app/facilitator/calendar/page.js (569159c022eeefbef72c84948696a977e7abd5cab0f47ded3ae5961abff0e070)
- bm25: -8.6135 | relevance: 1.0000

if (!historyRes.ok) {
            completionLookupFailed = true
          } else {
            const events = Array.isArray(historyJson?.events) ? historyJson.events : []
            for (const row of events) {
              if (row?.event_type && row.event_type !== 'completed') continue
              const completedDate = toLocalDateStr(row?.occurred_at)
              const key = canonicalLessonId(row?.lesson_id)
              if (!completedDate || !key) continue
              completedKeySet.add(`${key}|${completedDate}`)
              const prev = completedDatesByLesson.get(key) || []
              prev.push(completedDate)
              completedDatesByLesson.set(key, prev)
            }

// De-dup + sort dates per lesson for stable comparisons.
            for (const [k, dates] of completedDatesByLesson.entries()) {
              const uniq = Array.from(new Set((dates || []).filter(Boolean))).sort()
              completedDatesByLesson.set(k, uniq)
            }
          }
        }
      } catch {
        // If completion lookup fails, fall back to showing schedule as-is.
        completedKeySet = new Set()
        completedDatesByLesson = new Map()
        completionLookupFailed = true
      }

const grouped = {}
      schedule.forEach(item => {
        const dateStr = item?.scheduled_date
        const lessonKey = item?.lesson_key
        if (!dateStr || !lessonKey) return
