# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Calendar + Calendar overlay: make completed lesson cells light grey (not orange like scheduled). Make highlighted/selected cell a dark outline (not blue like planned lessons). Find the cell style logic and apply minimal changes.
```

Filter terms used:
```text
Calendar
Calendar
overlay
make
completed
lesson
cells
light
grey
not
orange
like
scheduled
Make
highlighted
selected
cell
dark
outline
not
blue
like
planned
lessons
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

Calendar Calendar overlay make completed lesson cells light grey not orange like scheduled Make highlighted selected cell dark outline not blue like planned lessons

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack_calendar.md (c15e93dc3f822d93b3c56ed5d9a2f14c0045a84177352fe11823046decb59212)
- bm25: -26.3303 | relevance: 1.0000

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

### 33. src/app/facilitator/calendar/LessonPlanner.jsx (fd591deb67440b85e69d10a8c0629a0abe24abd9a3d4d3f92016c00b9d8bf080)
- bm25: -2.1781 | relevance: 1.0000

const allSubjects = [...CORE_SUBJECTS, ...customSubjects.map(s => s.name)]

### 2. src/app/facilitator/calendar/page.js (4f93e9cc0018c9b6e27aad45f0db5ed725a2d8b9081a5d3956bf19db6ce6f906)
- bm25: -25.2128 | relevance: 1.0000

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

### 3. sidekick_pack_calendar.md (5c380a01e2f9ba9c992f2a7c9e8a9e5293956b3a263df08f6f6b4786875ba2f8)
- bm25: -20.8933 | relevance: 1.0000

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

### 4. src/app/facilitator/calendar/LessonPlanner.jsx (fd591deb67440b85e69d10a8c0629a0abe24abd9a3d4d3f92016c00b9d8bf080)
- bm25: -20.2222 | relevance: 1.0000

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

### 5. sidekick_pack_lessons_prefetch.md (0db672eefdc58e7c37d6d5b098e9e40164ec1f2a714985ad6351f4a49bd65d3c)
- bm25: -19.7439 | relevance: 1.0000

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

### 6. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (4cd036bf58ff786a0e1a3fe6fe1aa9d8359267c257e10efaae60b9fb4028999d)
- bm25: -18.4371 | relevance: 1.0000

// Build a completion lookup.
      // Past scheduled dates will show only completed lessons.
      // NOTE: Lessons may be completed after their scheduled date (make-up work).
      let completedKeySet = new Set()
      let completedDatesByLesson = new Map()
      let completedEventsByDate = new Map()
      let completionLookupFailed = false
      try {
        const pastSchedule = (data || [])
          .map((row) => normalizeDateKey(row?.scheduled_date))
          .filter((d) => d && d < todayStr)
        const minPastDate = pastSchedule.reduce((min, d) => (min && min < d ? min : d), null)

const fallbackFrom = addDaysToDateStr(todayStr, -365)
        const historyFrom = minPastDate || fallbackFrom

if (historyFrom) {
          devWarn(`schedule: history lookup start from=${historyFrom} to=${todayStr}`)
          const historyController = new AbortController()
          const historyTimeoutId = setTimeout(() => {
            try { historyController.abort() } catch {}
          }, 45000)

const fetchHistoryJson = async (url) => {
            const res = await fetch(url, {
              headers: { 'authorization': `Bearer ${token}` },
              cache: 'no-store',
              signal: historyController.signal,
            })
            const json = await res.json().catch(() => null)
            return { res, json }
          }

### 7. src/app/facilitator/calendar/page.js (0a377186862f438af1cc355b6434ce533b912b26ddfc368cb5a3ca5eecb19ddc)
- bm25: -18.3542 | relevance: 1.0000

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

### 8. sidekick_pack_lessons_prefetch.md (a5eebdda6719df2b69da494ad9a4acc7292864ee174d331f68842d17dcf78a5b)
- bm25: -18.2470 | relevance: 1.0000

const createdSession = createData.session || createData

### 28. src/app/facilitator/calendar/LessonPlanner.jsx (fd591deb67440b85e69d10a8c0629a0abe24abd9a3d4d3f92016c00b9d8bf080)
- bm25: -14.8336 | relevance: 1.0000

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

### 29. sidekick_pack_takeover.md (d2b72071b1a2c2c6817565e96ed76f09ce317391276449fdde4792537f9e2326)
- bm25: -14.7237 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

### 9. sidekick_pack_calendar.md (1976d8bacd6ac6d60b1fef6f0b9cdc571093dd2d252f2a1b35aa75f4022a4a22)
- bm25: -17.2634 | relevance: 1.0000

const scheduledUpcoming = scheduledDates.filter((d) => d >= todayStr)
    const plannedUpcoming = plannedDates.filter((d) => d >= todayStr)

// Prefer showing the tab that has UPCOMING lessons. A single old completed scheduled item
    // shouldn't prevent the overlay from auto-switching to a planned week in the future.
    if (listTab === 'scheduled' && scheduledUpcoming.length === 0 && plannedUpcoming.length > 0) {
      setListTab('planned')
    } else if (listTab === 'planned' && plannedUpcoming.length === 0 && scheduledUpcoming.length > 0) {
      setListTab('scheduled')
    } else if (listTab === 'scheduled' && scheduledDates.length === 0 && plannedDates.length > 0) {
      setListTab('planned')
    } else if (listTab === 'planned' && plannedDates.length === 0 && scheduledDates.length > 0) {
      setListTab('scheduled')
    }
  }, [learnerId, listTab, scheduledLessons, plannedLessons])

### 10. sidekick_pack_lessons_prefetch.md (581ced3247e84673130cd81f41660d634e97be0fdce3f78c418551c7745d62c5)
- bm25: -17.2577 | relevance: 1.0000

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

### 11. sidekick_pack_planned_all.md (398638bf1b3b8229ece229dc1a4fcb9d0afa530681b0736417839961c17c8686)
- bm25: -17.0113 | relevance: 1.0000

### 37. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (a6a5f703bef748c4d747d394cc6cbe45b727739626d59197af352fbca88834f3)
- bm25: -0.8782 | relevance: 1.0000

contextText += '\n\n=== REDO RULES: SAME AS PLANNER GENERATION ==='
      contextText += '\nYou are regenerating a planned lesson outline.'
      contextText += `\nPrefer NEW topics most of the time, but you MAY plan a rephrased Review for low scores (<= ${LOW_SCORE_REVIEW_THRESHOLD}%).`
      contextText += `\nAvoid repeating high-score topics (>= ${HIGH_SCORE_AVOID_REPEAT_THRESHOLD}%) unless the facilitator explicitly requests it.`
      contextText += "\nIf you choose a Review lesson, the title MUST start with 'Review:' and it must use different examples."
      contextText += '\nDo NOT produce an exact duplicate of any scheduled/planned lesson above.'

### 38. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (b690a18afe1a98c7ffdb598a8ad305d257461e7db5099a5e51bade73b4b5f2b9)
- bm25: -0.8782 | relevance: 1.0000

const todayStr = getLocalTodayStr()

// Fast-path: render scheduled lessons immediately.
      // Completion history lookup can be slow; it should not block schedule visibility.
      try {
        const immediate = {}
        for (const item of (data || [])) {
          const dateStr = normalizeDateKey(item?.scheduled_date)
          const lessonKey = item?.lesson_key
          if (!dateStr || !lessonKey) continue

### 24. src/app/facilitator/calendar/page.js (4835d0d6e747efbb6e84edf7a10a2bc8a9f755d7b63ab15c2f5dd9ecb27821a9)
- bm25: -5.0098 | entity_overlap_w: 1.50 | adjusted: -5.3848 | relevance: 1.0000

setNoSchoolDates(grouped)
    } catch (err) {
      console.error('Error loading no-school dates:', err)
    }
  }

### 12. sidekick_pack_calendar.md (258d8c1362721ef3f6020d0619c94208e25a733fcb4ef15e9de02acebefc4da9)
- bm25: -16.1435 | relevance: 1.0000

### 29. src/app/facilitator/calendar/LessonPlanner.jsx (9304f9697a56abc0792ac130be58f504e565f9ce5e89cac035cad64c213eb58b)
- bm25: -2.3119 | relevance: 1.0000

if (response.ok) {
                const result = await response.json()
                const outline = result.outline

if (!lessons[dateStr]) {
                  lessons[dateStr] = []
                }

lessons[dateStr].push({
                  ...outline,
                  id: `${dateStr}-${subjectInfo.subject}`,
                  subject: subjectInfo.subject
                })

generatedSoFar.push({
                  date: dateStr,
                  subject: subjectInfo.subject,
                  title: outline?.title || ''
                })
              }
            } catch (err) {
              console.error('Error generating outline:', err)
            }
          }
        }
      }

if (onPlannedLessonsChange) {
        onPlannedLessonsChange(lessons)
      }
    } catch (err) {
      console.error('Error generating planned lessons:', err)
      alert('Failed to generate lesson plan')
    } finally {
      setGenerating(false)
    }
  }

useEffect(() => {
    if (!autoGeneratePlan) return
    if (!learnerId) return
    if (!planStartDate) return
    if (!weeklyPatternLoadedRef.current) return
    if (generating) return

const key = `${learnerId}|${planStartDate}|${planDuration}`
    if (autoGenerateKeyRef.current === key) return

const hasAnySubjects = DAYS.some(day => weeklyPattern[day]?.length > 0)
    if (!hasAnySubjects) return

autoGenerateKeyRef.current = key
    const weeksToGenerate = Number(planDuration) * 4
    generatePlannedLessons(planStartDate, weeksToGenerate)
  }, [autoGeneratePlan, learnerId, planStartDate, planDuration, weeklyPattern, generating])

### 13. src/app/facilitator/calendar/LessonPlanner.jsx (9304f9697a56abc0792ac130be58f504e565f9ce5e89cac035cad64c213eb58b)
- bm25: -15.2637 | relevance: 1.0000

if (response.ok) {
                const result = await response.json()
                const outline = result.outline

if (!lessons[dateStr]) {
                  lessons[dateStr] = []
                }

lessons[dateStr].push({
                  ...outline,
                  id: `${dateStr}-${subjectInfo.subject}`,
                  subject: subjectInfo.subject
                })

generatedSoFar.push({
                  date: dateStr,
                  subject: subjectInfo.subject,
                  title: outline?.title || ''
                })
              }
            } catch (err) {
              console.error('Error generating outline:', err)
            }
          }
        }
      }

if (onPlannedLessonsChange) {
        onPlannedLessonsChange(lessons)
      }
    } catch (err) {
      console.error('Error generating planned lessons:', err)
      alert('Failed to generate lesson plan')
    } finally {
      setGenerating(false)
    }
  }

useEffect(() => {
    if (!autoGeneratePlan) return
    if (!learnerId) return
    if (!planStartDate) return
    if (!weeklyPatternLoadedRef.current) return
    if (generating) return

const key = `${learnerId}|${planStartDate}|${planDuration}`
    if (autoGenerateKeyRef.current === key) return

const hasAnySubjects = DAYS.some(day => weeklyPattern[day]?.length > 0)
    if (!hasAnySubjects) return

autoGenerateKeyRef.current = key
    const weeksToGenerate = Number(planDuration) * 4
    generatePlannedLessons(planStartDate, weeksToGenerate)
  }, [autoGeneratePlan, learnerId, planStartDate, planDuration, weeklyPattern, generating])

### 14. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (7ca690b9f9be797a355ccd6ef51c93f4ad200f06a4e334a1afd989e2a00dad07)
- bm25: -14.9523 | relevance: 1.0000

contextText += '\n\n=== REDO RULES: SAME AS PLANNER GENERATION ==='
      contextText += '\nYou are regenerating a planned lesson outline.'
      contextText += `\nPrefer NEW topics most of the time, but you MAY plan a rephrased Review for low scores (<= ${LOW_SCORE_REVIEW_THRESHOLD}%).`
      contextText += `\nAvoid repeating high-score topics (>= ${HIGH_SCORE_AVOID_REPEAT_THRESHOLD}%) unless the facilitator explicitly requests it.`
      contextText += "\nIf you choose a Review lesson, the title MUST start with 'Review:' and it must use different examples."
      contextText += '\nDo NOT produce an exact duplicate of any scheduled/planned lesson above.'

### 15. sidekick_pack_lessons_prefetch.md (0edab3558a337e0312e5383e12976113374fe0515eb939cc4a9f3fbed7eae765)
- bm25: -14.8004 | relevance: 1.0000

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

### 39. sidekick_pack_planned_all.md (80c748684a01d5fcb48348b44514e2e51b5da42c9b018c454190dc86994a0269)
- bm25: -2.4963 | relevance: 1.0000

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

### 16. sidekick_pack_takeover.md (43a876c4969af73582fdaf97e1ecc2d3ff1171f983087f27b2b9f814cd3cfd75)
- bm25: -14.7271 | relevance: 1.0000

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

### 39. sidekick_pack_planned_all.md (80c748684a01d5fcb48348b44514e2e51b5da42c9b018c454190dc86994a0269)
- bm25: -2.4963 | relevance: 1.0000

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

### 17. sidekick_pack_lessons_prefetch.md (7a9fd59dd7f239fde07e906d19eb353faaddb50e639eeff80f8c295e6eb0cd13)
- bm25: -14.5715 | relevance: 1.0000

// Prefer showing the tab that has UPCOMING lessons. A single old completed scheduled item
    // shouldn't prevent the overlay from auto-switching to a planned week in the future.
    if (listTab === 'scheduled' && scheduledUpcoming.length === 0 && plannedUpcoming.length > 0) {
      setListTab('planned')
    } else if (listTab === 'planned' && plannedUpcoming.length === 0 && scheduledUpcoming.length > 0) {
      setListTab('scheduled')
    } else if (listTab === 'scheduled' && scheduledDates.length === 0 && plannedDates.length > 0) {
      setListTab('planned')
    } else if (listTab === 'planned' && plannedDates.length === 0 && scheduledDates.length > 0) {
      setListTab('scheduled')
    }
  }, [learnerId, listTab, scheduledLessons, plannedLessons])

### 18. src/app/api/learner/lesson-history/route.js (7d697a5fcc734c31556b755f300cb812a873cedd801e9c20a6e320607bb12044)
- bm25: -14.5388 | relevance: 1.0000

// If it already looks like a canonical lesson key, keep it.
  if (key.includes('/')) {
    return key
  }

### 19. sidekick_pack_calendar.md (e1260b37624b2715be0d2aa874920875ac6bf0e06f93fe12ab2bcb2346976220)
- bm25: -14.4684 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Facilitator calendar page: for learner Emma, where do 2026 scheduled and planned lessons come from? Identify the APIs/tables used (lesson_schedule vs lesson_schedule_keys vs planned_lessons or others) and how the UI merges/backfills 2025/2026. Provide entrypoints and key functions.
```

Filter terms used:
```text
lesson_schedule
lesson_schedule_keys
planned_lessons
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

lesson_schedule lesson_schedule_keys planned_lessons

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/api/planned-lessons/route.js (13ab95e2c88ec5cc604a496e80fd74f45cb5f1a254133d4b8bd7639cc043e74b)
- bm25: -4.5542 | entity_overlap_w: 1.00 | adjusted: -4.8042 | relevance: 1.0000

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

### 2. src/app/api/planned-lessons/route.js (db1a9cc005c7ceee5fb09554e6f8802d9c3c6b43eda28afc6d987b8be33f1c49)
- bm25: -4.3282 | entity_overlap_w: 1.00 | adjusted: -4.5782 | relevance: 1.0000

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

### 20. sidekick_pack_lessons_prefetch.md (a7841a704ade50afc2df05c178b2a622fe0681ce4b5261b44cf8ac284f52721e)
- bm25: -14.3512 | relevance: 1.0000

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

// Generate and persist unique session ID on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

let resolvedId = null

try {
      resolvedId = localStorage.getItem('mr_mentor_active_session_id')
    } catch (err) {
      // Silent error handling
    }

### 33. src/app/facilitator/calendar/page.js (0a377186862f438af1cc355b6434ce533b912b26ddfc368cb5a3ca5eecb19ddc)
- bm25: -13.6889 | relevance: 1.0000

### 21. sidekick_pack_planned_all.md (ccfc16941934d1c73cb9b713bc34b9edbbc5377b8a728c9ebde39fbc6cd06222)
- bm25: -14.0685 | relevance: 1.0000

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

### 8. src/app/api/planned-lessons/route.js (13ab95e2c88ec5cc604a496e80fd74f45cb5f1a254133d4b8bd7639cc043e74b)
- bm25: -6.5669 | relevance: 1.0000

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

### 9. sidekick_pack_calendar.md (2a3e86ef656681a0f342082ad621f01e89dfc9483227c5d812966dc60315f5b5)
- bm25: -6.1697 | entity_overlap_w: 1.50 | adjusted: -6.5447 | relevance: 1.0000

### 22. src/app/session/page.js (27796fde7c14ef49198b3fd4995dbe0260fc5037462ba72a4d4350f843a25991)
- bm25: -13.9587 | relevance: 1.0000

// Session takeover UI state (hoist before hooks that reference them)
  const [showTakeoverDialog, setShowTakeoverDialog] = useState(false);
  const [conflictingSession, setConflictingSession] = useState(null);
  const [sessionConflictChecked, setSessionConflictChecked] = useState(false);

useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Learner profile is selected locally on each device (localStorage)
    // Same learner can be selected on multiple devices
    // Backend enforces ONE active lesson per learner globally
    try {
      const storedId = localStorage.getItem('learner_id');
      if (storedId && storedId !== 'demo') {
        console.log('[SESSION] Using learner_id from localStorage:', storedId);
        setTrackingLearnerId(storedId);
      } else {
        setTrackingLearnerId(null);
      }
    } catch {
      setTrackingLearnerId(null);
    }
  }, []);

// lessonSessionKey removed - using lessonKey for both snapshots and session tracking

// Normalized key for visual aids (strips folder prefixes so same lesson from different routes shares visual aids)
  const visualAidsLessonKey = useMemo(() => {
    if (!lessonParam) return null;
    // Strip folder prefixes like generated/, facilitator/, math/, etc.
    const normalizedLesson = lessonParam.replace(/^(generated|facilitator|math|science|language-arts|social-studies|demo)\//, '');
    return normalizedLesson;
  }, [lessonParam]);

### 23. sidekick_pack_calendar.md (2a3e86ef656681a0f342082ad621f01e89dfc9483227c5d812966dc60315f5b5)
- bm25: -13.9133 | relevance: 1.0000

### 34. src/app/facilitator/calendar/LessonPlanner.jsx (6b168bfbed05e5a77c41e13237992b2579bfb9cb2101795ff35d795651c6016e)
- bm25: -2.0760 | relevance: 1.0000

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

### 24. sidekick_pack_planned_all.md (222f12cf61f748251a3c55b61f04a417bbf6d36b0a671960c3bb15c0e3ce026d)
- bm25: -13.4557 | relevance: 1.0000

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

const shouldApplyToState = () => activeLearnerIdRef.current === targetLearnerId

### 4. sidekick_pack_calendar.md (e4850ca724432dcd515d17e688953f4328c7d15cbaa7795617e091d25879d8e8)
- bm25: -6.4466 | entity_overlap_w: 2.50 | adjusted: -7.0716 | relevance: 1.0000

if (token) {
        setAuthToken((prev) => (prev === token ? prev : token))
      }

if (!token) {
        devWarn('schedule: missing auth token')
        return
      }

// Get all scheduled lessons for this learner
      let response
      try {
        response = await fetch(`/api/lesson-schedule?learnerId=${targetLearnerId}&includeAll=1`, {
          headers: {
            'authorization': `Bearer ${token}`
          },
          cache: 'no-store',
          signal: controller.signal
        })
      } finally {
        // scheduleTimeoutId cleared in finally
      }

devWarn(`schedule: response ms=${Date.now() - startedAtMs} status=${String(response?.status)} ok=${String(response?.ok)}`)

### 25. sidekick_pack_calendar.md (29b39d5fa52826bd4ba8cf0d363e16cf77ed20a67cc2b323f425e620657cc20b)
- bm25: -13.4416 | relevance: 1.0000

const loadPlannedForLearner = useCallback(async (targetLearnerId, opts = {}) => {
    if (!targetLearnerId || targetLearnerId === 'none') {
      devWarn('planned: no learner selected', { targetLearnerId })
      setPlannedLessons({})
      plannedLoadedForLearnerRef.current = null
      plannedLoadedAtRef.current = 0
      return
    }

### 26. sidekick_pack_planned_all.md (7e6f9e099ed0bba77cc78887bd83ba39f37066930a72a67bd840f9de1f9e3b5a)
- bm25: -13.4163 | relevance: 1.0000

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

### 10. sidekick_pack_calendar.md (0265ef4f1639cb46a8abe3529dd0c20c6f5a521386f8bce166be11efa580ae7a)
- bm25: -6.1819 | relevance: 1.0000

### 27. sidekick_pack_completions_mismatch2.md (eed9343c65d4330eee6ff773961b17ee3e8f9be9662dca410fc9b7e9a57c2e2c)
- bm25: -13.2976 | relevance: 1.0000

### 19. src/app/facilitator/calendar/page.js (45a3f960320e40cd0f5d44fbd1557244327369796a5b24116ee137e4fc1a97a6)
- bm25: -5.2523 | entity_overlap_w: 1.50 | adjusted: -5.6273 | relevance: 1.0000

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

### 31. sidekick_pack_calendar.md (e1260b37624b2715be0d2aa874920875ac6bf0e06f93fe12ab2bcb2346976220)
- bm25: -6.7466 | entity_overlap_w: 3.00 | adjusted: -7.4966 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Facilitator calendar page: for learner Emma, where do 2026 scheduled and planned lessons come from? Identify the APIs/tables used (lesson_schedule vs lesson_schedule_keys vs planned_lessons or others) and how the UI merges/backfills 2025/2026. Provide entrypoints and key functions.
```

Filter terms used:
```text
lesson_schedule
lesson_schedule_keys
planned_lessons
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

lesson_schedule lesson_schedule_keys planned_lessons

## Forced Context

(none)

## Ranked Evidence

### 28. sidekick_pack_lessons_prefetch.md (b34f3066b625795936e9e732c5c3e4d708e949e9a1e1ff5e4d51726401ea7f21)
- bm25: -13.2944 | relevance: 1.0000

## Question

/api/lesson-schedule /api/planned-lessons CalendarOverlay

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack_calendar.md (e1260b37624b2715be0d2aa874920875ac6bf0e06f93fe12ab2bcb2346976220)
- bm25: -8.3892 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Facilitator calendar page: for learner Emma, where do 2026 scheduled and planned lessons come from? Identify the APIs/tables used (lesson_schedule vs lesson_schedule_keys vs planned_lessons or others) and how the UI merges/backfills 2025/2026. Provide entrypoints and key functions.
```

Filter terms used:
```text
lesson_schedule
lesson_schedule_keys
planned_lessons
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

lesson_schedule lesson_schedule_keys planned_lessons

## Forced Context

(none)

## Ranked Evidence

### 3. sidekick_pack_calendar.md (e1260b37624b2715be0d2aa874920875ac6bf0e06f93fe12ab2bcb2346976220)
- bm25: -24.3352 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Facilitator calendar page: for learner Emma, where do 2026 scheduled and planned lessons come from? Identify the APIs/tables used (lesson_schedule vs lesson_schedule_keys vs planned_lessons or others) and how the UI merges/backfills 2025/2026. Provide entrypoints and key functions.
```

Filter terms used:
```text
lesson_schedule
lesson_schedule_keys
planned_lessons
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

### 29. sidekick_pack_completions_mismatch2.md (cf2909ee835ccee007620e4414be403be411d5a4000d0df6f1f90ad3f04f540e)
- bm25: -13.2847 | relevance: 1.0000

### 8. src/app/api/planned-lessons/route.js (13ab95e2c88ec5cc604a496e80fd74f45cb5f1a254133d4b8bd7639cc043e74b)
- bm25: -6.5669 | relevance: 1.0000

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

### 9. sidekick_pack_calendar.md (2a3e86ef656681a0f342082ad621f01e89dfc9483227c5d812966dc60315f5b5)
- bm25: -6.1697 | entity_overlap_w: 1.50 | adjusted: -6.5447 | relevance: 1.0000

### 17. sidekick_pack_completions_mismatch.md (814a0d88bc7f48ddfcb3092fed303122da90706d4ea90535df855709402f7f64)
- bm25: -10.5857 | relevance: 1.0000

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

### 30. src/app/facilitator/calendar/LessonPlanner.jsx (6b168bfbed05e5a77c41e13237992b2579bfb9cb2101795ff35d795651c6016e)
- bm25: -13.1028 | relevance: 1.0000

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

### 31. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (678fc9164b378a09b6e102a9357522a6f1bffad00943fcc9d0e950694fbda1b5)
- bm25: -13.0810 | relevance: 1.0000

useEffect(() => {
    if (!learnerId || learnerId === 'none') return
    if (!accessToken) return
    loadCalendarData({ force: true })
  }, [accessToken, learnerId, loadCalendarData])

// If the current tab has no lessons but the other does, auto-switch tabs.
  // This prevents the overlay from looking "empty" when (for example) only planned lessons exist.
  useEffect(() => {
    if (!learnerId || learnerId === 'none') return
    if (userSelectedTabRef.current) return

const todayStr = getLocalTodayStr()
    const scheduledDates = Object.keys(scheduledLessons || {}).filter((d) => (scheduledLessons?.[d]?.length || 0) > 0)
    const plannedDates = Object.keys(plannedLessons || {}).filter((d) => (plannedLessons?.[d]?.length || 0) > 0)

const scheduledUpcoming = scheduledDates.filter((d) => d >= todayStr)
    const plannedUpcoming = plannedDates.filter((d) => d >= todayStr)

// Prefer showing the tab that has UPCOMING lessons. A single old completed scheduled item
    // shouldn't prevent the overlay from auto-switching to a planned week in the future.
    if (listTab === 'scheduled' && scheduledUpcoming.length === 0 && plannedUpcoming.length > 0) {
      setListTab('planned')
    } else if (listTab === 'planned' && plannedUpcoming.length === 0 && scheduledUpcoming.length > 0) {
      setListTab('scheduled')
    } else if (listTab === 'scheduled' && scheduledDates.length === 0 && plannedDates.length > 0) {
      setListTab('planned')
    } else if (listTab === 'planned' && plannedDates.length === 0 && scheduledDates.length > 0) {
      setListTab('scheduled')
    }
  }, [learnerId, listTab, scheduledLessons, plannedLessons])

### 32. src/app/facilitator/generator/counselor/CounselorClient.jsx (f62c317c6eb970dda0e79fd7b4884c08d22b8ac6dad5ae57ffb78a297567f2b5)
- bm25: -13.0688 | relevance: 1.0000

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

### 33. sidekick_pack_planned_all.md (d32ec42280065bf36096853714387cbf112aaf8b2e2e135ab2e0095a3bcb82f9)
- bm25: -12.9938 | relevance: 1.0000

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

### 2. src/app/api/planned-lessons/route.js (db1a9cc005c7ceee5fb09554e6f8802d9c3c6b43eda28afc6d987b8be33f1c49)
- bm25: -4.3282 | entity_overlap_w: 1.00 | adjusted: -4.5782 | relevance: 1.0000

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

### 2. sidekick_pack_calendar.md (678a099578ce7dfb438cb5f5fdf33a5ee0a1659724364fe1bd4e3d78e5de8141)
- bm25: -7.0414 | entity_overlap_w: 4.00 | adjusted: -8.0414 | relevance: 1.0000

### 4. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (78704a7836d4dd1067eb47baa5b1f38c321b2794cfd9945f1afc04804cd08e34)
- bm25: -4.1971 | relevance: 1.0000

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

### 34. sidekick_pack_completions_mismatch2.md (cf4007aba7a504357e8da3b8190e60adb83a22807016353154beaf867ab6660b)
- bm25: -12.7700 | relevance: 1.0000

Prompt (original):
```text
Facilitator calendar page: for learner Emma, where do 2026 scheduled and planned lessons come from? Identify the APIs/tables used (lesson_schedule vs lesson_schedule_keys vs planned_lessons or others) and how the UI merges/backfills 2025/2026. Provide entrypoints and key functions.
```

### 35. sidekick_pack_lessons_prefetch.md (2390cc8c1a98ee66d8a9d843298a4361d30d6a8020709d5e15903ce5cb6c6558)
- bm25: -12.6987 | relevance: 1.0000

### 34. src/app/api/planned-lessons/route.js (7f4030d9bf7a1414ad7d0582b42b03e4f7424290402ad9566f507a6ded607bdf)
- bm25: -13.5474 | relevance: 1.0000

// Verify the learner belongs to this facilitator/owner.
    // Planned lessons are treated as per-learner data (not per-facilitator), but still require authorization.
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

### 35. src/app/api/planned-lessons/route.js (146c46c2ac9daf4464d5c46347f5662137c1074fa42a8e7030c5330b92a8e553)
- bm25: -13.3256 | relevance: 1.0000

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

// Fetch planned lessons for this learner.
    // Default behavior matches the facilitator calendar page:
    //   - Primary: scoped to this facilitator.
    //   - Fallback: if there are legacy rows under a single different facilitator_id, return them (read compatibility).
    // includeAll=1 mode intentionally returns *all* planned_lessons rows for the learner (authorized),
    // to surface legacy/other-namespace plans (e.g., 2026) without changing the default UI behavior.
    let data = null
    let error = null

if (includeAll) {
      const all = await adminSupabase
        .from('planned_lessons')
        .select('*')
        .eq('learner_id', learnerId)
        .order('scheduled_date', { ascending: true })

### 36. sidekick_pack_planned_all.md (79af748cc863cfa32eda062671f812e41cf02adf095a46eb36bd42871ec402a0)
- bm25: -12.6883 | relevance: 1.0000

### 11. sidekick_pack_calendar.md (acf9ce08465f001f4925abe0b71ac34df61a9dc795d33bdd8bbeb9368f36447d)
- bm25: -6.1819 | relevance: 1.0000

### 36. src/app/api/planned-lessons/route.js (669f59ed11e30a0d8781e7c15939a84b6684017e4f4bf05eec7efec4e3226256)
- bm25: -2.0327 | relevance: 1.0000

### 12. sidekick_pack_calendar.md (c66d0eceedc8044113d18d3f20d1fcad9d89003c88db6ca34a5052754108ac85)
- bm25: -6.1819 | relevance: 1.0000

### 6. src/app/api/planned-lessons/route.js (715e20f8c79adf81a24d6bba0df47ad7f44fc6912f0e3f031bde78b0436fec4e)
- bm25: -3.8146 | relevance: 1.0000

### 13. src/app/api/planned-lessons/route.js (db1a9cc005c7ceee5fb09554e6f8802d9c3c6b43eda28afc6d987b8be33f1c49)
- bm25: -6.1458 | relevance: 1.0000

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

// Delete all planned lessons for this learner
    const { error } = await adminSupabase
      .from('planned_lessons')
      .delete()
      .eq('learner_id', learnerId)
      .eq('facilitator_id', user.id)

if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

### 14. src/app/api/planned-lessons/route.js (715e20f8c79adf81a24d6bba0df47ad7f44fc6912f0e3f031bde78b0436fec4e)
- bm25: -6.1081 | relevance: 1.0000

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

### 37. sidekick_pack_planned_all.md (fcdd85c93f7380b5bf23fdc7818062b0fa026e2a26299a65d7e5bad85d0f4db6)
- bm25: -12.5932 | relevance: 1.0000

// Transform to the format expected by the calendar: { 'YYYY-MM-DD': [{...}] }
    const plannedLessons = {}
    for (const row of data || []) {
      const dateStr = normalizeScheduledDate(row.scheduled_date)
      if (!plannedLessons[dateStr]) {
        plannedLessons[dateStr] = []
      }
      plannedLessons[dateStr].push(row.lesson_data)
    }

### 32. sidekick_pack_calendar.md (8433d094a6742c2a6805901913b61d0bfbfbc49e078e5ba8657783f75d33e24f)
- bm25: -5.0205 | relevance: 1.0000

// Verify the learner belongs to this facilitator/owner.
    // Planned lessons are treated as per-learner data (not per-facilitator), but still require authorization.
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

### 17. src/app/api/lesson-schedule/route.js (ff3ad28ef7a262ca477170ea0d60d5d1724049c3c3c5d136f9f3e4532a21cf91)
- bm25: -3.2672 | relevance: 1.0000

// Verify the learner belongs to this facilitator
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

### 18. src/app/facilitator/calendar/page.js (4835d0d6e747efbb6e84edf7a10a2bc8a9f755d7b63ab15c2f5dd9ecb27821a9)
- bm25: -3.1783 | relevance: 1.0000

setNoSchoolDates(grouped)
    } catch (err) {
      console.error('Error loading no-school dates:', err)
    }
  }

### 38. src/app/api/planned-lessons/route.js (146c46c2ac9daf4464d5c46347f5662137c1074fa42a8e7030c5330b92a8e553)
- bm25: -12.5905 | relevance: 1.0000

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

// Fetch planned lessons for this learner.
    // Default behavior matches the facilitator calendar page:
    //   - Primary: scoped to this facilitator.
    //   - Fallback: if there are legacy rows under a single different facilitator_id, return them (read compatibility).
    // includeAll=1 mode intentionally returns *all* planned_lessons rows for the learner (authorized),
    // to surface legacy/other-namespace plans (e.g., 2026) without changing the default UI behavior.
    let data = null
    let error = null

if (includeAll) {
      const all = await adminSupabase
        .from('planned_lessons')
        .select('*')
        .eq('learner_id', learnerId)
        .order('scheduled_date', { ascending: true })

data = all.data
      error = all.error
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    } else {
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

### 39. sidekick_pack_planned_all.md (f884e37f0e473e31e5f38a557a22c1570b4058bb8caea88c847083d32becc8c9)
- bm25: -12.5295 | relevance: 1.0000

const handleRedoClick = async (plannedLesson) => {
    if (!selectedDate) return
    if (!learnerId || learnerId === 'none') return

setRedoingLesson(plannedLesson.id)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

### 39. sidekick_pack_calendar.md (b9dc078a93d41db44527a41092413104e7cbd0203a87c119851dce73c1008662)
- bm25: -4.7312 | relevance: 1.0000

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

### 40. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (db05d8c56a11272789cf6fb81a17a6ab1b6c87a3cfe7d92671d7557644b178d3)
- bm25: -4.7248 | relevance: 1.0000

### 40. sidekick_pack_completions_mismatch2.md (e96045e71660d3233da099fd8f7a1132d3dcbd9de19ddd4bdbcb1628e5eb6beb)
- bm25: -12.2256 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Trace completed lesson tracking: where do lesson completions get recorded (session teaching flow), and where do Completed Lessons page, Learn Awards (medals), and Calendar read from? Anchor on getMedalsForLearner, /api/medals, /api/learner/lesson-history, lesson_session_events, lesson_schedule, useTeachingFlow.
```

Filter terms used:
```text
/api/learner/lesson-history
/api/medals
lesson_schedule
lesson_session_events
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/api/learner/lesson-history /api/medals lesson_schedule lesson_session_events

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/facilitator/calendar/LessonPlanner.jsx (6b168bfbed05e5a77c41e13237992b2579bfb9cb2101795ff35d795651c6016e)
- bm25: -14.5857 | entity_overlap_w: 3.00 | adjusted: -15.3357 | relevance: 1.0000

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
