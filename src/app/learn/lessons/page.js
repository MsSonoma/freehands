'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier, resolveEffectiveTier } from '@/app/lib/entitlements'
import { getMedalsForLearner, emojiForTier } from '@/app/lib/medalsClient'
import { getLearner, updateLearner } from '@/app/facilitator/learners/clientApi'
import { ensurePinAllowed, ensureFacilitatorPinException } from '@/app/lib/pinGate'
import LoadingProgress from '@/components/LoadingProgress'
import GoldenKeyCounter from '@/app/learn/GoldenKeyCounter'
import { getActiveLessonSession } from '@/app/lib/sessionTracking'
import { useLessonHistory } from '@/app/hooks/useLessonHistory'
import LessonHistoryModal from '@/app/components/LessonHistoryModal'
import { subscribeLearnerSettingsPatches } from '@/app/lib/learnerSettingsBus'
import { getFollowUps, startFollowUp } from '@/app/lib/followUpsClient'
import { getCanonicalMasteryForLearner, slateEmojiForTier } from '@/app/lib/masteryClient'
import { getWebbCompletionForLearner } from '@/app/lib/webbCompletionClient'
import PageTutorialOverlay from '@/app/components/PageTutorialOverlay'
import SyllabusDocument from '@/app/components/syllabus/SyllabusDocument'
import { resolveSyllabusReadModel } from '@/app/lib/syllabus/timeline.mjs'
import {
  buildLessonSessionRoute,
  getLessonListRequest,
  initializeDemoLearner,
  isDemoLearnerId,
  resolveTeacherForLearner,
} from '@/app/learn/demoLearner.mjs'

const LESSONS_TUTORIAL_STEPS = [
  {
    icon: '📚',
    title: 'Your Lesson Library',
    body: 'Here you\'ll find all the lessons your teacher has prepared for you. Tap any lesson card to begin!',
  },
  {
    icon: '🎓',
    title: 'Choose Your Teacher',
    body: 'Use the teacher selector in the sidebar to switch between Ms. Sonoma, Mr. Slate, and Mrs. Webb. Each one teaches in their own unique way.',
  },
  {
    icon: '📋',
    title: 'Lesson Tabs',
    body: 'Active shows lessons ready for you today. Recent shows lessons you have started. Owned shows lessons created just for you by your teacher.',
  },
  {
    icon: '▶️',
    title: 'Starting a Lesson',
    body: 'Tap a lesson card to begin. If you left mid-lesson, your progress is saved automatically — you\'ll pick up right where you stopped.',
  },
  {
    icon: '🗝️',
    title: 'Golden Keys',
    body: 'Finish work phases before the timer runs out to earn a Golden Key! Earn enough in a lesson to unlock a special bonus reward.',
  },
  {
    icon: '🏅',
    title: 'Medals & Mastery',
    body: 'Complete a lesson to earn a medal. Score high enough on the test to earn a Mastery badge. All achievements show up on the Awards page!',
  },
]

function localCalendarDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const SUBJECTS = ['math', 'science', 'language arts', 'social studies', 'general', 'generated']

function normalizeApprovedLessonKeys(map = {}) {
  const normalized = {}
  let changed = false
  Object.entries(map || {}).forEach(([key, value]) => {
    if (typeof key === 'string' && key.startsWith('Facilitator Lessons/')) {
      const suffix = key.slice('Facilitator Lessons/'.length)
      normalized[`general/${suffix}`] = value
      changed = true
    } else if (key) {
      normalized[key] = value
    }
  })
  return { normalized, changed }
}

function snapshotHasMeaningfulProgress(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false

  const phase = snapshot.phase || 'discussion'
  const subPhase = snapshot.subPhase || 'greeting'
  const resume = snapshot.resume || null

  // CRITICAL: Don't treat 'congrats' or 'test' as meaningful progress
  // Lesson is complete - no point resuming to "Complete Lesson" button
  // Test phase includes both in-progress tests AND completed tests (testFinalPercent may be null)
  if (phase === 'congrats' || phase === 'test') return false

  if (snapshot.showBegin === false) return true
  if (snapshot.qaAnswersUnlocked) return true

  const progressedPhases = new Set(['teaching', 'comprehension', 'exercise', 'worksheet'])
  if (progressedPhases.has(phase)) return true
  if (resume && typeof resume === 'object') {
    if (resume.phase && progressedPhases.has(resume.phase)) return true
    if (resume.kind === 'question') return true
  }

  if (subPhase && subPhase !== 'greeting') return true

  if (typeof snapshot.currentCompIndex === 'number' && snapshot.currentCompIndex > 0) return true
  if (typeof snapshot.currentExIndex === 'number' && snapshot.currentExIndex > 0) return true
  if (typeof snapshot.currentWorksheetIndex === 'number' && snapshot.currentWorksheetIndex > 0) return true
  if (typeof snapshot.testActiveIndex === 'number' && snapshot.testActiveIndex > 0) return true
  if (snapshot.currentCompProblem) return true
  if (snapshot.currentExerciseProblem) return true

  if (Array.isArray(snapshot.testUserAnswers) && snapshot.testUserAnswers.some(v => v != null && String(v).trim().length > 0)) return true
  if (Array.isArray(snapshot.storyTranscript) && snapshot.storyTranscript.length > 0) return true

  return false
}

function LessonsPageInner(){
  const router = useRouter()
  const [showTutorial, setShowTutorial] = useState(false)

  // Auto-show tutorial on first visit
  useEffect(() => {
    try {
      const storedLearnerId = localStorage.getItem('learner_id')
      if (!isDemoLearnerId(storedLearnerId) && !localStorage.getItem('ms_lessons_tutorial_seen')) {
        setShowTutorial(true)
      }
    } catch {}
  }, [])

  const [scheduledLessons, setScheduledLessons] = useState({}) // { 'subject/lesson_file': isoTimestamp } - lessons scheduled for today
  const [allLessons, setAllLessons] = useState({})
  const [availableLessons, setAvailableLessons] = useState({}) // { 'subject/lesson_file': true } - lessons marked as available by facilitator
  const [loading, setLoading] = useState(true)
  const [lessonsLoading, setLessonsLoading] = useState(true)
  const [medals, setMedals] = useState({})
  const [learnerName, setLearnerName] = useState(null)
  const [learnerId, setLearnerId] = useState(null)
  const [planTier, setPlanTier] = useState('free')
  const [syllabusPayload, setSyllabusPayload] = useState(null)
  const [syllabusStatus, setSyllabusStatus] = useState('idle')
  const [syllabusError, setSyllabusError] = useState('')
  const [todaysCount, setTodaysCount] = useState(0)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [goldenKeySelected, setGoldenKeySelected] = useState(false)
  const [pendingKeyLessonKey, setPendingKeyLessonKey] = useState(() => {
    if (typeof window === 'undefined') return null
    try {
      const raw = sessionStorage.getItem('golden_key_pending_lesson')
      if (!raw) return null
      return JSON.parse(raw).lessonKey || null
    } catch { return null }
  })
  const [activeGoldenKeys, setActiveGoldenKeys] = useState({}) // Track lessons with active golden keys
  const [refreshTrigger, setRefreshTrigger] = useState(0) // Used to force refresh at midnight and on schedule changes
  const [lessonNotes, setLessonNotes] = useState({}) // { 'subject/lesson_file': 'note text' }
  const [editingNote, setEditingNote] = useState(null) // lesson key currently being edited
  const [saving, setSaving] = useState(false)
  const [lessonSnapshots, setLessonSnapshots] = useState({}) // { 'subject/lesson_file': true } - lessons with saved snapshots
  const [sessionGateReady, setSessionGateReady] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showGoldenKeyToast, setShowGoldenKeyToast] = useState(false) // Show golden key earned notification
  // null = unknown (still loading learner settings); true/false = loaded value
  const [goldenKeysEnabled, setGoldenKeysEnabled] = useState(null)
  const [masteryMap, setMasteryMap] = useState({}) // { 'subject/file.json': { mastered, masteredAt } } — Mr. Slate mastery
  const [webbMap, setWebbMap] = useState({}) // { 'lessonKey': { completed, completedAt } } — Mrs. Webb completions
  const [showLessonDetailHistory, setShowLessonDetailHistory] = useState(null) // { lessonKey, title } | null
  const [selectedTeacher, setSelectedTeacher] = useState(() => {
    if (typeof window === 'undefined') return 'sonoma'
    try {
      return resolveTeacherForLearner(
        localStorage.getItem('learner_id'),
        localStorage.getItem('selected_teacher')
      )
    } catch { return 'sonoma' }
  }) // 'sonoma' | 'webb' | 'slate'
  const [teacherDropdownOpen, setTeacherDropdownOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  // Lesson detail overlay: { l, subject, lessonKey, isDemo } | null
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [overlayNoteEditing, setOverlayNoteEditing] = useState(false)
  const [listTab, setListTab] = useState('active') // 'active' | 'recent' | 'owned'
  const [allGeneratedLessons, setAllGeneratedLessons] = useState([])
  const [generatedLoading, setGeneratedLoading] = useState(false)
  const [ownedSubjectFilter, setOwnedSubjectFilter] = useState('')
  const [ownedSort, setOwnedSort] = useState('title-asc')
  const [historyLessons, setHistoryLessons] = useState({}) // lessonKey → metadata for history-only lessons
  const [followUpCards, setFollowUpCards] = useState([])
  const [followUpsLoading, setFollowUpsLoading] = useState(false)
  const [followUpStarting, setFollowUpStarting] = useState(null)

  const {
    sessions: lessonHistorySessions,
    events: lessonHistoryEvents,
    lastCompleted: lessonHistoryLastCompleted,
    inProgress: lessonHistoryInProgress,
    loading: lessonHistoryLoading,
    error: lessonHistoryError,
    refresh: refreshLessonHistory,
  } = useLessonHistory(learnerId, { limit: 150, refreshKey: refreshTrigger })

  const completedLessonCount = useMemo(() => Object.keys(lessonHistoryLastCompleted || {}).length, [lessonHistoryLastCompleted])
  const activeLessonCount = useMemo(() => Object.keys(lessonHistoryInProgress || {}).length, [lessonHistoryInProgress])

  useEffect(() => {
    let cancelled = false
    if (!learnerId || learnerId === 'demo') {
      setFollowUpCards([])
      return () => { cancelled = true }
    }
    setFollowUpsLoading(true)
    getFollowUps(learnerId)
      .then((result) => {
        if (!cancelled) setFollowUpCards(Array.isArray(result?.cards) ? result.cards : [])
      })
      .catch(() => {
        if (!cancelled) setFollowUpCards([])
      })
      .finally(() => {
        if (!cancelled) setFollowUpsLoading(false)
      })
    return () => { cancelled = true }
  }, [learnerId, refreshTrigger])

  const openFollowUp = async (card) => {
    if (!card || followUpStarting) return
    setFollowUpStarting(card.id)
    try {
      if (card.run_id) {
        router.push(`/session/slate?reviewRunId=${encodeURIComponent(card.run_id)}`)
        return
      }
      const result = await startFollowUp(learnerId, card.id)
      if (!result?.run?.id) throw new Error('Follow-Up could not start')
      router.push(`/session/slate?reviewRunId=${encodeURIComponent(result.run.id)}`)
    } catch (error) {
      alert(error?.message || 'Follow-Up could not start')
      setFollowUpStarting(null)
    }
  }

  const lessonTitleLookup = useMemo(() => {
    const map = {}
    Object.entries(allLessons || {}).forEach(([subject, lessons]) => {
      if (!Array.isArray(lessons)) return
      lessons.forEach((lesson) => {
        if (!lesson || !lesson.file) return
        const key = lesson.isGenerated ? `generated/${lesson.file}` : `${subject}/${lesson.file}`
        if (!map[key] && lesson.title) {
          map[key] = lesson.title
        }
      })
    })
    return map
  }, [allLessons])

  const formatDateOnly = (isoString) => {
    if (!isoString) return null
    try {
      const date = new Date(isoString)
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return isoString
    }
  }

  const formatDateTime = (isoString) => {
    if (!isoString) return null
    try {
      const date = new Date(isoString)
      return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    } catch {
      return isoString
    }
  }

  // Set up midnight refresh timer
  useEffect(() => {
    const scheduleNextMidnightRefresh = () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)
      const msUntilMidnight = tomorrow.getTime() - now.getTime()
      
      const timer = setTimeout(() => {
        setRefreshTrigger(prev => prev + 1)
        // Schedule next midnight refresh
        scheduleNextMidnightRefresh()
      }, msUntilMidnight)
      
      return timer
    }
    
    const timer = scheduleNextMidnightRefresh()
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!learnerId) {
      setSyllabusPayload(null)
      setSyllabusStatus('idle')
      setSyllabusError('')
      return
    }
    if (isDemoLearnerId(learnerId)) {
      setSyllabusPayload(null)
      setSyllabusStatus('ready')
      setSyllabusError('')
      return
    }
    let cancelled = false
    setSyllabusStatus('loading')
    setSyllabusError('')
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) throw new Error('Syllabus access is unavailable in this session')
        const response = await fetch(`/api/syllabus?learnerId=${encodeURIComponent(learnerId)}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || 'Could not load the Syllabus')
        if (!cancelled) setSyllabusPayload(json)
      } catch (cause) {
        if (!cancelled) {
          setSyllabusPayload(null)
          setSyllabusError(cause.message || 'Could not load the Syllabus')
        }
      } finally {
        if (!cancelled) setSyllabusStatus('ready')
      }
    })()
    return () => { cancelled = true }
  }, [learnerId])

  // Poll for newly scheduled lessons every 30 seconds
  useEffect(() => {
    if (!learnerId) return
    
    // DISABLED: Polling causes too many reloads, schedule changes are rare
    // Users can manually refresh if needed
    // const pollInterval = setInterval(() => {
    //   console.log('[Learn Lessons] Polling for schedule changes')
    //   setRefreshTrigger(prev => prev + 1)
    // }, 30 * 1000) // 30 seconds
    
    // return () => clearInterval(pollInterval)
  }, [learnerId])

  // Clear pending golden key once the target lesson is detected as completed
  useEffect(() => {
    if (!lessonHistoryLastCompleted) return
    try {
      const raw = sessionStorage.getItem('golden_key_pending_lesson')
      if (!raw) return
      const { lessonKey, startedAt } = JSON.parse(raw)
      const completedAt = lessonHistoryLastCompleted[lessonKey]
      if (completedAt && new Date(completedAt).getTime() > startedAt) {
        sessionStorage.removeItem('golden_key_pending_lesson')
        setGoldenKeySelected(false)
        setPendingKeyLessonKey(null)
      }
    } catch {}
  }, [lessonHistoryLastCompleted])

  // Check for golden key earned notification
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // Only show or suppress the toast once we know the learner setting.
      // (Avoid clearing it while the setting is still loading to prevent “missing toast” bugs.)
      if (goldenKeysEnabled === false) {
        sessionStorage.removeItem('just_earned_golden_key');
        return;
      }
      if (goldenKeysEnabled !== true) return;

      const justEarned = sessionStorage.getItem('just_earned_golden_key');
      if (justEarned !== 'true') return;

      sessionStorage.removeItem('just_earned_golden_key');
      setShowGoldenKeyToast(true);
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => setShowGoldenKeyToast(false), 5000);
      return () => clearTimeout(timer);
    } catch {}
  }, [goldenKeysEnabled]);

  // Listen for facilitator-side per-learner settings changes (no localStorage fallback)
  useEffect(() => {
    if (!learnerId || learnerId === 'demo') return;
    return subscribeLearnerSettingsPatches((msg) => {
      if (String(msg?.learnerId) !== String(learnerId)) return;
      if (msg?.patch?.golden_keys_enabled === undefined) return;
      const enabled = !!msg.patch.golden_keys_enabled;
      setGoldenKeysEnabled(enabled);
      if (!enabled) {
        setGoldenKeySelected(false);
        setPendingKeyLessonKey(null);
        try { sessionStorage.removeItem('golden_key_pending_lesson') } catch {}
        setShowGoldenKeyToast(false);
      }
    });
  }, [learnerId]);

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/sonoma', { method: 'GET', headers: { 'Accept': 'application/json' } })
      } catch {}
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    try {
      const id = localStorage.getItem('learner_id')
      const n = localStorage.getItem('learner_name')
      if (n) setLearnerName(n)
      if (id) {
        if (isDemoLearnerId(id)) {
          initializeDemoLearner(localStorage)
          setSelectedTeacher('sonoma')
          setShowTutorial(false)
        }
        setLearnerId(id)
        getCanonicalMasteryForLearner(id).then(setMasteryMap).catch(() => setMasteryMap({}))
        setWebbMap(getWebbCompletionForLearner(id))
      }
    } catch {}
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            const { data } = await supabase.from('profiles').select('subscription_tier,plan_tier').eq('id', session.user.id).maybeSingle()
            setPlanTier(resolveEffectiveTier(data?.subscription_tier, data?.plan_tier))
          }
        }
      } catch {}
      try {
        const dateKey = localCalendarDate()
        const key = `lesson_unique:${dateKey}`
        const raw = localStorage.getItem(key)
        if (raw) {
          const set = new Set(JSON.parse(raw))
          setTodaysCount(set.size)
        } else {
          setTodaysCount(0)
        }
      } catch {}
    })()
  }, [])

  useEffect(() => {
    let cancelled = false

    if (!learnerId || learnerId === 'demo') {
      setSessionGateReady(true)
      return () => { cancelled = true }
    }

    setSessionGateReady(false)

    ;(async () => {
      try {
        // Just check for active session without PIN requirement
        // The lessons page should be freely accessible
        const active = await getActiveLessonSession(learnerId)
        if (cancelled) return
        // No PIN gate here - let learners view lessons freely
        if (!cancelled) setSessionGateReady(true)
      } catch (err) {
        if (!cancelled) setSessionGateReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [learnerId, refreshTrigger, router])

  useEffect(() => {
    (async () => {
      try {
        if (!learnerId) {
          setMedals({})
          return
        }
        const data = await getMedalsForLearner(learnerId)
        setMedals(data || {})
      } catch {
        setMedals({})
      }
    })()
  }, [learnerId])

  // Load all facilitator-generated lessons for the Owned tab
  useEffect(() => {
    if (!learnerId || learnerId === 'demo') {
      setAllGeneratedLessons([])
      return
    }
    let cancelled = false
    setGeneratedLoading(true)
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) { if (!cancelled) { setAllGeneratedLessons([]); setGeneratedLoading(false) }; return }
        const res = await fetch('/api/facilitator/lessons/list', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!cancelled) setAllGeneratedLessons(res.ok ? (await res.json()) : [])
      } catch {
        if (!cancelled) setAllGeneratedLessons([])
      } finally {
        if (!cancelled) setGeneratedLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [learnerId])

  // Back-fill metadata for history keys not already in allLessons/allGeneratedLessons
  useEffect(() => {
    if (!learnerId || learnerId === 'demo') return
    const completedKeys = Object.keys(lessonHistoryLastCompleted || {})
    const inProgressKeys = Object.keys(lessonHistoryInProgress || {})
    const allHistoryKeys = [...new Set([...completedKeys, ...inProgressKeys])]
    if (allHistoryKeys.length === 0) return

    // Build the set of keys we already have metadata for
    const knownKeys = new Set()
    Object.entries(allLessons).forEach(([subject, lessons]) => {
      lessons?.forEach(l => {
        const key = l.lessonKey || (l.isGenerated ? `generated/${l.file}` : `${subject}/${l.file}`)
        if (key) knownKeys.add(key)
      })
    })
    allGeneratedLessons.forEach(l => knownKeys.add(`generated/${l.file}`))

    const missing = allHistoryKeys.filter(k => !knownKeys.has(k))
    if (missing.length === 0) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/lessons/meta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys: missing, learner_id: learnerId }),
        })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (cancelled) return
        const map = {}
        for (const l of (data?.lessons || [])) {
          const key = l.lessonKey || l.lesson_key
          if (key) map[key] = l
        }
        if (!cancelled) setHistoryLessons(map)
      } catch {}
    })()
    return () => { cancelled = true }
  }, [learnerId, lessonHistoryLastCompleted, lessonHistoryInProgress, allLessons, allGeneratedLessons])

  useEffect(() => {
    if (!sessionGateReady) return

    let cancelled = false
    ;(async () => {
      if (!learnerId) {
        setLessonsLoading(false)
        return
      }

      setLessonsLoading(true)
      
      const lessonsMap = {}
      
      // Load demo lessons if it's the demo learner
      if (isDemoLearnerId(learnerId)) {
        try {
          const { url, subject } = getLessonListRequest(learnerId)
          const res = await fetch(url, { cache: 'no-store' })
          const list = res.ok ? await res.json() : []
          lessonsMap[subject] = Array.isArray(list) ? list : []
        } catch {
          lessonsMap['demo'] = []
        }
      } else if (learnerId) {
        // OPTIMIZED: Call single API that returns only checked/scheduled lessons
        try {
          const { url } = getLessonListRequest(learnerId)
          const res = await fetch(url, {
            cache: 'no-store'
          })
          
          if (res.ok) {
            const {
              lessons,
              scheduledKeys: serverScheduledKeys,
              rawSchedule: serverRawSchedule,
              approvedKeys: serverApprovedKeys,
              staleApprovedKeys,
              staleScheduledKeys
            } = await res.json()
            let cleanupTriggered = false
            if (Array.isArray(staleApprovedKeys) && staleApprovedKeys.length > 0) {
              cleanupTriggered = true
            }
            if (Array.isArray(staleScheduledKeys) && staleScheduledKeys.length > 0) {
              cleanupTriggered = true
            }
            if (cleanupTriggered) {
              setRefreshTrigger(prev => prev + 1)
            }
            
            // Group by subject
            for (const lesson of lessons) {
              const subject = lesson.isGenerated ? 'generated' : (lesson.subject || 'general')
              if (!lessonsMap[subject]) lessonsMap[subject] = []
              lessonsMap[subject].push(lesson)
            }
          }
        } catch (err) {
        }
      }
      
      if (!cancelled) {
        setAllLessons(lessonsMap)
        setLessonsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [learnerId, sessionGateReady, availableLessons, scheduledLessons])

  useEffect(() => {
    if (!learnerId) {
      setActiveGoldenKeys({})
      // Keep golden key UI hidden until we know whether a learner is selected.
      setGoldenKeysEnabled(null)
      setLoading(false)
      return
    }
    // Demo learner doesn't need database lookup
    if (learnerId === 'demo') {
      setActiveGoldenKeys({})
      setGoldenKeysEnabled(true)
      setLoading(false)
      return
    }

    // Hide Golden Key UI until we load the learner setting.
    setGoldenKeysEnabled(null)

    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        // Load active golden keys, lesson notes, approved lessons, and golden key feature flag
        let data, error
        const result = await supabase.from('learners').select('active_golden_keys, lesson_notes, approved_lessons, golden_keys_enabled').eq('id', learnerId).maybeSingle()
        data = result.data
        error = result.error
        
        // If error, use empty defaults
        if (error) {
          data = null
        }
        
        // Load today's scheduled lessons
        let scheduled = {}
        try {
          const { data: { session } } = await supabase.auth.getSession()
          const token = session?.access_token
          
          if (!token) {
          } else {
            const scheduleResponse = await fetch(`/api/lesson-schedule?learnerId=${learnerId}&action=active`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              }
            })
            if (scheduleResponse.ok) {
              const scheduleData = await scheduleResponse.json()
              const scheduledLessons = scheduleData.lessons || []
              
              // Track scheduled lessons (store timestamp for Recent tab ordering)
              scheduledLessons.forEach(item => {
                if (item.lesson_key) {
                  scheduled[item.lesson_key] = item.updated_at || item.created_at || (item.scheduled_date + 'T00:00:00.000Z')
                }
              })
            } else {
            }
          }
        } catch (schedErr) {
        }
        
        if (!cancelled) {
          setScheduledLessons(scheduled)
          setActiveGoldenKeys(data?.active_golden_keys || {})
          setGoldenKeysEnabled(data?.golden_keys_enabled !== false)
          setLessonNotes(data?.lesson_notes || {})
          const { normalized: approvedNormalized } = normalizeApprovedLessonKeys(data?.approved_lessons || {})
          setAvailableLessons(approvedNormalized)
        }
      } catch (err) {
        if (!cancelled) {
          setActiveGoldenKeys({})
          setAvailableLessons({})
        }
      }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [learnerId, refreshTrigger, sessionGateReady])

  async function openLesson(subject, fileBaseName, syllabusOccurrence = null){
    const ent = featuresForTier(planTier)
    
    // Skip quota checks for demo lessons - they're unlimited
    const isDemoLesson = subject === 'demo';
    
    if (!isDemoLesson) {
      try {
        const dateKey = localCalendarDate()
        const key = `lesson_unique:${dateKey}`
        const raw = localStorage.getItem(key)
        const set = new Set(raw ? JSON.parse(raw) : [])
        const lessonKey = `${subject}/${fileBaseName}`
        if (!set.has(lessonKey)) {
          const cap = ent.lessonsPerDay
          if (Number.isFinite(cap) && set.size >= cap) {
            alert(`Daily limit reached. Your plan allows ${cap === Infinity ? 'unlimited' : cap} unique lessons per day.`)
            return
          }
          set.add(lessonKey)
          localStorage.setItem(key, JSON.stringify(Array.from(set)))
          setTodaysCount(set.size)
        }
      } catch {}
    }
    
    // Handle golden key consumption - decrement from database
    const thisLessonKey = `${subject}/${fileBaseName}`
    const alreadyHasPendingKey = pendingKeyLessonKey === thisLessonKey
    if (goldenKeysEnabled === true && (goldenKeySelected || alreadyHasPendingKey) && learnerId) {
      if (goldenKeySelected && !alreadyHasPendingKey) {
        // First application — decrement DB and lock key to this lesson
        try {
          const learner = await getLearner(learnerId)
          if (learner && learner.golden_keys > 0) {
            await updateLearner(learnerId, { 
              name: learner.name,
              grade: learner.grade,
              targets: {
                comprehension: learner.comprehension,
                exercise: learner.exercise,
                worksheet: learner.worksheet,
                test: learner.test
              },
              session_timer_minutes: learner.session_timer_minutes,
              golden_keys: learner.golden_keys - 1
            })
          }
        } catch (e) {
        }
        // Persist the pending key across navigation — clears only when lesson is completed
        try { sessionStorage.setItem('golden_key_pending_lesson', JSON.stringify({ lessonKey: thisLessonKey, startedAt: Date.now() })) } catch {}
        setPendingKeyLessonKey(thisLessonKey)
      }
      // If alreadyHasPendingKey, key was already spent — just re-pass URL param without decrementing
    }
    
    const currentTeacher = (() => {
      try {
        const resolved = resolveTeacherForLearner(learnerId, localStorage.getItem('selected_teacher'))
        if (isDemoLearnerId(learnerId)) localStorage.setItem('selected_teacher', resolved)
        return resolved
      } catch { return 'sonoma' }
    })()

    if (currentTeacher === 'slate') {
      setSessionLoading(true)
      const lessonKey = `${subject}/${fileBaseName}`
      try { sessionStorage.setItem('slate_pending_lesson_key', lessonKey) } catch {}
      router.push(buildLessonSessionRoute({ learnerId, subject, fileName: fileBaseName, selectedTeacher: currentTeacher, occurrenceId: syllabusOccurrence?.occurrence_id || '' }))
      return
    }

    if (currentTeacher === 'webb') {
      setSessionLoading(true)
      const lessonKey = `${subject}/${fileBaseName}`
      try { sessionStorage.setItem('webb_pending_lesson_key', lessonKey) } catch {}
      router.push(buildLessonSessionRoute({ learnerId, subject, fileName: fileBaseName, selectedTeacher: currentTeacher, occurrenceId: syllabusOccurrence?.occurrence_id || '' }))
      return
    }

    setSessionLoading(true)
    const withKey = buildLessonSessionRoute({
      learnerId,
      subject,
      fileName: fileBaseName,
      selectedTeacher: currentTeacher,
      goldenKey: goldenKeysEnabled === true && (goldenKeySelected || alreadyHasPendingKey),
      occurrenceId: syllabusOccurrence?.occurrence_id || '',
    })
    router.push(withKey)
  }

  async function saveNote(lessonKey, noteText) {
    if (!learnerId) return
    
    // Require PIN before saving notes
    const allowed = await ensurePinAllowed('lesson-notes')
    if (!allowed) {
      alert('PIN required to manage lesson notes')
      setEditingNote(null)
      return
    }
    
    const newNotes = { ...lessonNotes }
    if (noteText && noteText.trim()) {
      newNotes[lessonKey] = noteText.trim()
    } else {
      delete newNotes[lessonKey]
    }
    
    setLessonNotes(newNotes)
    setEditingNote(null)
    setSaving(true)
    
    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.from('learners').update({ lesson_notes: newNotes }).eq('id', learnerId)
      if (error) {
        throw error
      }
    } catch (e) {
      alert('Failed to save note: ' + (e?.message || e?.hint || 'Unknown error'))
      // Revert on error
      setLessonNotes(lessonNotes)
    } finally {
      setSaving(false)
    }
  }

  const row = {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '13px 16px',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    background: '#fff',
    cursor: 'pointer',
    transition: 'background 0.12s, box-shadow 0.12s',
    textAlign: 'left',
    width: '100%',
  }
  const btn = { display:'inline-flex', justifyContent:'center', alignItems:'center', gap:8, width:'100%', padding:'12px 16px', border:'1px solid #111', borderRadius:10, background:'#111', color:'#fff', fontWeight:700, fontSize:15, cursor:'pointer' }
  const btnDisabled = { ...btn, background:'#9ca3af', borderColor:'#9ca3af', cursor:'not-allowed' }
  const list = { display:'flex', flexDirection:'column', gap:8 }

  const lessonsBySubject = useMemo(() => {
    const grouped = {}
    SUBJECTS.forEach(subject => {
      const subjectLessons = allLessons[subject] || []
      // Filter by available lessons - show lessons that are EITHER:
      // 1. Marked available by facilitator (checkbox), OR
      // 2. Scheduled for today (calendar)
      const availableForSubject = subjectLessons.filter(lesson => {
        const lessonKey = lesson.isGenerated 
          ? `generated/${lesson.file}`
          : `${subject}/${lesson.file}`
        // Also check legacy facilitator/ key for general lessons
        const legacyKey = lessonKey.replace('general/', 'facilitator/')
        // Also check just the filename (no subject prefix) for backwards compatibility
        const filenameOnly = lesson.file
        const isAvailable = availableLessons[lessonKey] === true 
          || availableLessons[legacyKey] === true 
          || availableLessons[filenameOnly] === true
          || !!scheduledLessons[lessonKey]
          || !!scheduledLessons[legacyKey]
          || !!scheduledLessons[filenameOnly]
        return isAvailable
      }).map(lesson => {
        // Add lessonKey to each lesson object for snapshot lookup
        const lessonKey = lesson.isGenerated 
          ? `generated/${lesson.file}`
          : `${subject}/${lesson.file}`
        return { ...lesson, lessonKey }
      })
      if (availableForSubject.length > 0) {
        grouped[subject] = availableForSubject
      }
    })
    // Demo lessons bypass the available/scheduled filter — show all
    if (allLessons['demo']?.length > 0) {
      grouped['demo'] = allLessons['demo'].map(l => ({ ...l, lessonKey: `demo/${l.file}` }))
    }
    return grouped
  }, [allLessons, availableLessons, scheduledLessons])

  const hasLessons = Object.keys(lessonsBySubject).length > 0

  // Set of lessonKeys that are currently active (approved + scheduled today)
  const activeSet = useMemo(() => {
    const s = new Set()
    Object.values(lessonsBySubject).forEach(lessons => {
      lessons?.forEach(l => l.lessonKey && s.add(l.lessonKey))
    })
    return s
  }, [lessonsBySubject])

  // Flat metadata lookup: lessonKey → lesson object (for Recent/Owned overlays)
  const recentMetaLookup = useMemo(() => {
    const map = {}
    Object.entries(allLessons).forEach(([subject, lessons]) => {
      lessons?.forEach(l => {
        const key = l.lessonKey || (l.isGenerated ? `generated/${l.file}` : `${subject}/${l.file}`)
        if (key && !map[key]) map[key] = { ...l, subject, lessonKey: key }
      })
    })
    allGeneratedLessons.forEach(l => {
      const key = `generated/${l.file}`
      if (!map[key]) map[key] = { ...l, isGenerated: true, subject: 'generated', lessonKey: key }
    })
    // Backfill from history metadata fetch
    Object.entries(historyLessons).forEach(([key, l]) => {
      if (!map[key]) map[key] = { ...l, lessonKey: key }
    })
    return map
  }, [allLessons, allGeneratedLessons, historyLessons])
  const syllabusModel = resolveSyllabusReadModel(syllabusPayload)

  function syllabusLessonState(item) {
    const lessonKey = item?.lesson_key
    const hasProgress = Boolean(lessonKey && (item?.readiness_state === 'in_progress' || lessonSnapshots[lessonKey] || lessonHistoryInProgress?.[lessonKey]))
    return {
      hasLessonArtifact: Boolean(lessonKey && recentMetaLookup[lessonKey]
        && (hasProgress || ['approved', 'available', 'in_progress', 'completed'].includes(item?.readiness_state))),
      hasProgress,
    }
  }

  async function openSyllabusLesson(item, action = { id: 'view', requires_pin: false }) {
    const lessonKey = item?.lesson_key
    const lesson = lessonKey ? recentMetaLookup[lessonKey] : null
    if (!lesson) return
    let exceptionApproved = false
    if (action?.requires_pin) {
      const completed = item.actual_kind === 'completed'
      const planned = new Date(`${dateOnly(item.planned_date)}T12:00:00.000Z`).toLocaleDateString(undefined, { weekday: 'long' })
      exceptionApproved = await ensureFacilitatorPinException({
        message: completed
          ? `You already completed ${item.title || 'this lesson'}. Enter the Facilitator PIN to do it again.`
          : `This lesson is planned for ${planned}. Enter the Facilitator PIN to do it today.`,
      })
      if (!exceptionApproved) return
    }
    const subject = lesson.isGenerated ? 'generated' : (lesson.subject || lessonKey.split('/')[0] || 'general')
    setSelectedLesson({ l: lesson, subject, lessonKey, isDemo: false, syllabusItem: item, syllabusExceptionApproved: exceptionApproved })
    setOverlayNoteEditing(false)
  }

  // Recent tab: union of completed + in-progress + scheduled keys, most recent first
  const recentList = useMemo(() => {
    const completedKeys = Object.keys(lessonHistoryLastCompleted || {})
    const inProgressKeys = Object.keys(lessonHistoryInProgress || {})
    const scheduledKeys = Object.keys(scheduledLessons || {})
    const allKeys = [...new Set([...completedKeys, ...inProgressKeys, ...scheduledKeys])]
    return allKeys
      .map(key => {
        const lastAt = lessonHistoryLastCompleted?.[key]
        const inProgressAt = lessonHistoryInProgress?.[key]
        const scheduledAt = scheduledLessons?.[key] && typeof scheduledLessons[key] === 'string' ? scheduledLessons[key] : null
        const candidates = [lastAt, inProgressAt, scheduledAt].filter(Boolean)
        const mostRecent = candidates.length
          ? candidates.reduce((a, b) => new Date(a) > new Date(b) ? a : b)
          : ''
        return { lessonKey: key, lastAt, inProgressAt, scheduledAt, mostRecent, meta: recentMetaLookup[key] || null }
      })
      .filter(e => e.mostRecent)
      .sort((a, b) => new Date(b.mostRecent) - new Date(a.mostRecent))
  }, [lessonHistoryLastCompleted, lessonHistoryInProgress, scheduledLessons, recentMetaLookup])

  // Owned tab: all facilitator-generated lessons
  const ownedList = useMemo(() => {
    return allGeneratedLessons.map(l => ({
      ...l,
      isGenerated: true,
      subject: l.subject || 'generated',
      lessonKey: `generated/${l.file}`,
    }))
  }, [allGeneratedLessons])

  // Owned tab: unique subjects for filter dropdown
  const ownedSubjects = useMemo(() => {
    const s = new Set()
    ownedList.forEach(l => { if (l.subject) s.add(l.subject) })
    return [...s].sort()
  }, [ownedList])

  // Owned tab: filtered + sorted list
  const filteredOwnedList = useMemo(() => {
    let list = ownedSubjectFilter
      ? ownedList.filter(l => l.subject === ownedSubjectFilter)
      : ownedList
    return [...list].sort((a, b) => {
      switch (ownedSort) {
        case 'title-asc':  return (a.title || '').localeCompare(b.title || '')
        case 'title-desc': return (b.title || '').localeCompare(a.title || '')
        case 'subject':    return (a.subject || '').localeCompare(b.subject || '')
        case 'grade-asc':  return (Number(a.grade) || 0) - (Number(b.grade) || 0)
        case 'grade-desc': return (Number(b.grade) || 0) - (Number(a.grade) || 0)
        case 'active':     return (activeSet.has(b.lessonKey) ? 1 : 0) - (activeSet.has(a.lessonKey) ? 1 : 0)
        default: return 0
      }
    })
  }, [ownedList, ownedSubjectFilter, ownedSort, activeSet])

  // Check for existing snapshots from server - must use lesson.id not filename
  useEffect(() => {
    if (!sessionGateReady) return
    if (!learnerId || lessonsLoading) return
    
    // Wait for lessons to be loaded with their IDs
    const allLoadedLessons = Object.values(lessonsBySubject).flat()
    if (allLoadedLessons.length === 0) return
    
    let cancelled = false
    
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        if (!supabase) {
          if (!cancelled) setLessonSnapshots({})
          return
        }
        
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) {
          if (!cancelled) setLessonSnapshots({})
          return
        }
        
        const snapshotsFound = {}
        
        // Check each loaded lesson for a snapshot using its filename
        for (const lesson of allLoadedLessons) {
          if (cancelled) break
          
          // Use filename without extension (matches how sessions save snapshots via URL param).
          // lesson.id can differ from the filename (e.g. "LA-4-ADV-001" vs "4th_The_Importance_of_Courage_advanced")
          // and must NOT be used as the primary key here.
          const lessonId = lesson.file?.replace(/\.json$/i, '') || lesson.lessonKey?.split('/').pop()?.replace(/\.json$/i, '') || lesson.id
          if (!lessonId) continue
          
          try {
            const res = await fetch(
              `/api/snapshots?learner_id=${encodeURIComponent(learnerId)}&lesson_key=${encodeURIComponent(lessonId)}`,
              { headers: { Authorization: `Bearer ${token}` } }
            )
            
            if (res.ok) {
              const { snapshot } = await res.json()
              if (snapshot && snapshot.savedAt && snapshotHasMeaningfulProgress(snapshot)) {
                snapshotsFound[lesson.lessonKey] = true
              }
            }
          } catch (e) {
          }
        }
        
        if (!cancelled) setLessonSnapshots(snapshotsFound)
      } catch (e) {
        if (!cancelled) setLessonSnapshots({})
      }
    })()
    
    return () => { cancelled = true }
  }, [learnerId, lessonsBySubject, lessonsLoading, sessionGateReady])

  if (!sessionGateReady) {
    return (
      <main style={{ padding:24, maxWidth:980, margin:'0 auto' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'320px', gap:12, marginTop:32 }}>
          <div style={{
            width:48,
            height:48,
            border:'4px solid #e5e7eb',
            borderTop:'4px solid #111',
            borderRadius:'50%',
            animation:'spin 1s linear infinite'
          }}></div>
          <p style={{ color:'#6b7280', fontSize:15, textAlign:'center' }}>Hang tight—enter the facilitator PIN to unlock lessons.</p>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </main>
    )
  }

  return (
    <main style={{ padding: '16px 12px', maxWidth: 1100, margin: '0 auto' }}>
      {showTutorial && (
        <PageTutorialOverlay
          steps={LESSONS_TUTORIAL_STEPS}
          onClose={() => {
            setShowTutorial(false)
            try { localStorage.setItem('ms_lessons_tutorial_seen', '1') } catch {}
          }}
        />
      )}
      {/* Golden Key Earned Toast Notification */}
      {showGoldenKeyToast && goldenKeysEnabled === true && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
          color: '#78350f',
          padding: '16px 24px',
          borderRadius: 12,
          boxShadow: '0 10px 40px rgba(251, 191, 36, 0.4), 0 4px 12px rgba(0, 0, 0, 0.1)',
          fontWeight: 700,
          fontSize: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          animation: 'slideDown 0.3s ease-out',
          border: '2px solid #fcd34d',
          maxWidth: '90vw'
        }}>
          <span style={{ fontSize: 28 }}>🔑</span>
          <div>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Golden Key Earned!</div>
            <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.9 }}>
              Adds bonus play time to your next lesson
            </div>
          </div>
          <button
            onClick={() => setShowGoldenKeyToast(false)}
            style={{
              marginLeft: 8,
              background: 'rgba(120, 53, 15, 0.1)',
              border: 'none',
              borderRadius: 6,
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              color: '#78350f'
            }}
            aria-label="Dismiss"
          >×</button>
        </div>
      )}

      <section aria-label="My active Syllabus" style={{ marginBottom: 28 }}>
        {syllabusStatus === 'loading' && <div style={{ minHeight: 220, display: 'grid', placeItems: 'center', border: '1px solid #ded8cb', background: '#fffdf8', color: '#6b7280' }}>Opening your Syllabus…</div>}
        {syllabusStatus === 'ready' && syllabusModel.kind === 'active' && (
          <SyllabusDocument
            revision={syllabusModel.revision}
            forecastItems={syllabusModel.forecast_items}
            timelineItems={syllabusModel.timeline_items}
            role="learner"
            learnerId={learnerId || ''}
            planTier={planTier}
            learnerName={learnerName || ''}
            lessonState={syllabusLessonState}
            onOpenLesson={openSyllabusLesson}
            today={syllabusModel.resolved_today}
          />
        )}
        {syllabusStatus === 'ready' && syllabusModel.kind === 'fallback' && (
          <div style={{ padding: '28px 30px', border: '1px solid #ded8cb', background: '#fffdf8', boxShadow: '0 12px 36px rgba(65,52,36,.08)' }}>
            <p style={{ margin: 0, color: '#9a4634', fontSize: 11, fontWeight: 800, letterSpacing: '.09em' }}>MY SYLLABUS</p>
            <h1 style={{ margin: '5px 0 8px', font: '500 30px Georgia, serif', color: '#2d2924' }}>{syllabusError ? 'Your Syllabus could not be opened' : 'Your learning place is being prepared'}</h1>
            <p style={{ margin: 0, maxWidth: 680, color: '#655d54', lineHeight: 1.6 }}>{syllabusError ? 'The existing lesson library remains available below.' : 'You can keep using the lesson library below. When your facilitator activates a Syllabus, this page will open centered on NOW.'}</p>
          </div>
        )}
        {syllabusError && <p role="status" style={{ margin: '8px 0 0', color: '#7c5f25', fontSize: 13 }}>The Syllabus could not be opened, so the existing lesson library remains available. {syllabusError}</p>}
      </section>

      {syllabusModel.kind !== 'active' && <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, margin: '0 0 10px' }}>
        <h2 style={{ margin: 0, fontSize: 17, color: '#252525' }}>Lesson library and learning tools</h2>
        <span style={{ color: '#7b7b7b', fontSize: 12 }}>Available while the Syllabus is being established</span>
      </div>}

      {/* ── Sidebar + Content layout ── */}
      <div data-syllabus-supporting-library style={{ display: syllabusModel.kind === 'active' && !selectedLesson ? 'none' : 'flex', alignItems: 'flex-start', gap: 0 }}>

        {/* Sidebar */}
        <div style={{
          width: sidebarOpen ? 240 : 44,
          flexShrink: 0,
          transition: 'width 0.22s ease',
          overflow: 'hidden',
          background: '#fafafa',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          marginRight: 16,
          minHeight: 300,
          position: 'sticky',
          top: 16,
          alignSelf: 'flex-start',
        }}>
          {/* Toggle button */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: sidebarOpen ? 'flex-end' : 'center',
              width: '100%', padding: '10px 12px',
              background: 'none', border: 'none', borderBottom: '1px solid #e5e7eb',
              cursor: 'pointer', fontSize: 16, color: '#6b7280',
            }}
          >{sidebarOpen ? '◀' : '▶'}</button>

          {sidebarOpen && (
            <div style={{ padding: '16px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111' }}>Select a Lesson</h2>
                <button
                  onClick={() => setShowTutorial(true)}
                  title="Show page tour"
                  style={{
                    padding: '3px 9px',
                    border: '1px solid #c7d2fe',
                    borderRadius: 7,
                    background: '#eef2ff',
                    color: '#6366f1',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                    lineHeight: 1.4,
                    flexShrink: 0,
                  }}
                >? Tour</button>
              </div>

              {/* Teacher selector */}
              {(() => {
                const TEACHERS = [
                  { key: 'sonoma', label: 'Ms. Sonoma', emoji: '👩🏻‍🦰', color: '#c7442e' },
                  { key: 'slate',  label: 'Mr. Slate',  emoji: '🤖',       color: '#6366f1' },
                  { key: 'webb',   label: 'Mrs. Webb',  emoji: '👩🏻‍🏫',     color: '#0d9488' },
                ]
                const current = TEACHERS.find(t => t.key === selectedTeacher) || TEACHERS[0]
                return (
                  <div style={{ position: 'relative', marginBottom: 14 }}>
                    <button
                      onClick={() => { if (learnerId === 'demo') return; setTeacherDropdownOpen(o => !o) }}
                      title={learnerId === 'demo' ? 'Teacher selection is not available in demo mode' : undefined}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        padding: '8px 12px', borderRadius: 8,
                        border: `2px solid ${current.color}`,
                        background: '#fff', cursor: learnerId === 'demo' ? 'default' : 'pointer',
                        fontSize: 13, fontWeight: 700, color: current.color,
                        opacity: learnerId === 'demo' ? 0.5 : 1,
                      }}
                    >
                      <span style={{ flex: 1, textAlign: 'left' }}>{current.emoji} {current.label}</span>
                      <span style={{ fontSize: 11, opacity: 0.7 }}>{teacherDropdownOpen ? '▲' : '▼'}</span>
                    </button>
                    {teacherDropdownOpen && (
                      <div style={{
                        position: 'absolute', top: '105%', left: 0, right: 0,
                        background: '#fff', border: '1px solid #e5e7eb',
                        borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        zIndex: 200, overflow: 'hidden',
                      }}>
                        {TEACHERS.map(t => (
                          <button
                            key={t.key}
                            onClick={() => {
                              setSelectedTeacher(t.key)
                              try { localStorage.setItem('selected_teacher', t.key) } catch {}
                              setTeacherDropdownOpen(false)
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              width: '100%', padding: '10px 14px',
                              border: 'none', background: t.key === selectedTeacher ? `${t.color}12` : '#fff',
                              cursor: 'pointer', fontSize: 13, fontWeight: t.key === selectedTeacher ? 700 : 500,
                              color: t.key === selectedTeacher ? t.color : '#374151',
                              textAlign: 'left',
                              borderLeft: t.key === selectedTeacher ? `3px solid ${t.color}` : '3px solid transparent',
                            }}
                          >
                            <span>{t.emoji}</span>
                            <span>{t.label}</span>
                            {t.key === selectedTeacher && <span style={{ marginLeft: 'auto', fontSize: 11 }}>✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Learner name */}
              {learnerName && (
                <div style={{ marginBottom: 14, fontSize: 13, color: '#666' }}>
                  Learning with <strong style={{ color: '#111' }}>{learnerName}</strong>
                </div>
              )}

              {/* Golden Key Counter — only shown when Ms. Sonoma is selected */}
              {goldenKeysEnabled === true && !loading && !lessonsLoading && selectedTeacher === 'sonoma' && (
                <div style={{ marginBottom: 14 }}>
                  <GoldenKeyCounter
                    learnerId={learnerId}
                    selected={goldenKeySelected}
                    onToggle={() => setGoldenKeySelected(prev => !prev)}
                  />
                </div>
              )}

              {/* Action buttons */}
              {learnerId && learnerId !== 'demo' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    onClick={() => setShowHistoryModal(true)}
                    style={{
                      padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8,
                      background: '#fff', color: '#111827', fontSize: 13, fontWeight: 600,
                      cursor: lessonHistoryLoading ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    }}
                    disabled={lessonHistoryLoading && !lessonHistorySessions.length}
                    title={lessonHistoryLoading ? 'Loading history…' : 'See completed lessons'}
                  >
                    ✅ Completed Lessons{completedLessonCount ? ` (${completedLessonCount})` : ''}
                    {activeLessonCount > 0 && (
                      <span style={{ fontSize: 11, color: '#d97706' }}>⏳ {activeLessonCount}</span>
                    )}
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await ensurePinAllowed('facilitator-page')
                      if (ok) router.push('/facilitator/generator')
                    }}
                    style={{
                      padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8,
                      background: '#fff', color: '#111827', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    }}
                  >
                    ✨ Generate a Lesson
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await ensurePinAllowed('facilitator-page')
                      if (ok) router.push('/facilitator/lessons')
                    }}
                    style={{
                      padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8,
                      background: '#fff', color: '#111827', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    }}
                  >
                    📚 Lessons
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>

      {/* ── Tab bar: Active / Recent / Owned ── */}
      {!loading && !lessonsLoading && learnerId && learnerId !== 'demo' && (
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #f3f4f6' }}>
          {[
            { key: 'active', label: 'Active' },
            { key: 'recent', label: `Recent${recentList.length > 0 ? ` (${recentList.length})` : ''}` },
            { key: 'owned', label: `Owned${ownedList.length > 0 ? ` (${ownedList.length})` : ''}` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setListTab(key)}
              style={{
                padding: '8px 18px',
                border: 'none',
                borderBottom: `2px solid ${listTab === key ? '#111' : 'transparent'}`,
                background: 'none',
                fontWeight: listTab === key ? 700 : 500,
                fontSize: 14,
                color: listTab === key ? '#111' : '#9ca3af',
                cursor: 'pointer',
                marginBottom: -2,
                transition: 'color 0.12s',
              }}
            >{label}</button>
          ))}
        </div>
      )}

      {loading || lessonsLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: 12, marginTop: 32 }}>
          <div style={{ 
            width: 48, 
            height: 48, 
            border: '4px solid #e5e7eb', 
            borderTop: '4px solid #111', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite' 
          }}></div>
          <p style={{ textAlign:'center', color: '#6b7280', fontSize: 16 }}>Loading lessons...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : (
        <>
          {/* ── Active tab ── */}
          {(listTab === 'active' || learnerId === 'demo') && (
            !hasLessons && followUpCards.length === 0 ? (
              <div style={{ textAlign:'center', marginTop:32 }}>
                <p style={{ color:'#6b7280' }}>No lessons available yet.</p>
                <p style={{ color:'#9ca3af', fontSize:14 }}>
                  Ask your facilitator to add lessons in the Facilitator portal.
                </p>
              </div>
            ) : (
          <div style={list}>
            {followUpsLoading && followUpCards.length === 0 && (
              <div style={{ ...row, color: '#6b7280', justifyContent: 'center' }}>
                Checking for Follow-Ups…
              </div>
            )}
            {followUpCards.map((card) => {
              const daily = card.review_type === 'daily_followup'
              const busy = followUpStarting === card.id
              return (
                <button
                  key={card.id}
                  style={{
                    ...row,
                    border: `1px solid ${daily ? '#bfdbfe' : '#ddd6fe'}`,
                    background: daily ? '#eff6ff' : '#f5f3ff',
                    cursor: busy ? 'wait' : 'pointer',
                  }}
                  onClick={() => openFollowUp(card)}
                  disabled={!!followUpStarting}
                >
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: daily ? '#1d4ed8' : '#6d28d9' }}>
                        {daily ? 'DAILY FOLLOW-UP' : 'WEEKLY REVIEW'}
                      </span>
                      {card.resume && <span style={{ fontSize: 11, color: '#047857', fontWeight: 700 }}>Resume</span>}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{card.title}</div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                      {card.subtitle} · {card.remaining_count} {card.remaining_count === 1 ? 'question' : 'questions'}
                    </div>
                  </div>
                  <span style={{ color: '#6b7280', fontSize: 14 }}>{busy ? 'Opening…' : 'Start →'}</span>
                </button>
              )
            })}
            {/* Show demo lessons first if they exist */}
            {lessonsBySubject['demo'] && lessonsBySubject['demo'].map((l) => {
              const lessonKey = `demo/${l.file}`
              const hasSnapshot = lessonSnapshots[lessonKey]
              const medalTier = medals[lessonKey]?.medalTier || null
              const medal = medalTier ? emojiForTier(medalTier) : ''
              const subjectLabel = l.subject ? l.subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Tutorial'
              return (
                <button
                  key={`demo-${l.file}`}
                  style={row}
                  onClick={() => { setSelectedLesson({ l, subject: 'demo', lessonKey, isDemo: true }); setOverlayNoteEditing(false) }}
                  onMouseEnter={e => { e.currentTarget.style.background='#f9fafb'; e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.07)' }}
                  onMouseLeave={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.boxShadow='none' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, background: '#dbeafe', color: '#1e40af', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>Demo</span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{subjectLabel}</span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {l.title}{medal ? ` ${medal}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {hasSnapshot && <span style={{ fontSize: 11, background: '#d1fae5', color: '#065f46', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>In progress</span>}
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ color: '#9ca3af' }}><path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </button>
              )
            })}

            {SUBJECTS.map(subject => {
              const lessons = lessonsBySubject[subject]
              if (!lessons || lessons.length === 0) return null
              const displaySubject = subject === 'generated' ? 'Generated Lessons' :
                subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
              return lessons.map((l) => {
                const lessonKey = `${subject}/${l.file}`
                const hasSnapshot = lessonSnapshots[lessonKey]
                const isScheduled = !!scheduledLessons[lessonKey]
                const medalTier = medals[lessonKey]?.medalTier || null
                const medal = medalTier ? emojiForTier(medalTier) : ''
                const slateTier = masteryMap[lessonKey]?.medalTier
                const teacherAward = selectedTeacher === 'slate'
                  ? (masteryMap[lessonKey] ? ` ${slateTier ? slateEmojiForTier(slateTier) : '�'}` : '')
                  : selectedTeacher === 'webb'
                    ? (webbMap[lessonKey]?.completed ? ' 🏆' : '')
                    : (medal ? ` ${medal}` : '')
                const hasActiveKey = activeGoldenKeys[lessonKey] === true
                const inProgressAt = lessonHistoryInProgress?.[lessonKey]
                const subjectBadge = subject === 'generated' && l.subject
                  ? l.subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                  : displaySubject
                return (
                  <button
                    key={`${subject}-${l.file}`}
                    style={row}
                    onClick={() => { setSelectedLesson({ l, subject, lessonKey, isDemo: false }); setOverlayNoteEditing(false) }}
                    onMouseEnter={e => { e.currentTarget.style.background='#f9fafb'; e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.07)' }}
                    onMouseLeave={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.boxShadow='none' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, background: '#f3f4f6', color: '#374151', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>{subjectBadge}</span>
                        {l.grade && <span style={{ fontSize: 11, color: '#9ca3af' }}>Grade {l.grade}</span>}
                        {l.difficulty && <span style={{ fontSize: 11, color: '#9ca3af' }}>{l.difficulty.charAt(0).toUpperCase() + l.difficulty.slice(1)}</span>}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {l.title}{teacherAward}{medals[lessonKey]?.medalTier ? ' 👩🏻‍🦰' : ''}{masteryMap[lessonKey] ? ' 🤖' : ''}{webbMap[lessonKey]?.completed ? ' 👩🏻‍🏫' : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {isScheduled && <span style={{ fontSize: 16 }} title="Scheduled for today">📅</span>}
                      {goldenKeysEnabled === true && hasActiveKey && <span style={{ fontSize: 13, background: '#fef3c7', color: '#92400e', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>🔑</span>}
                      {hasSnapshot && <span style={{ fontSize: 11, background: '#d1fae5', color: '#065f46', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>Continue</span>}
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ color: '#9ca3af' }}><path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </button>
                )
              })
            })}
          </div>
            )
          )}

          {/* ── Recent tab ── */}
          {listTab === 'recent' && learnerId !== 'demo' && (
            recentList.length === 0 ? (
              <div style={{ textAlign:'center', marginTop:32 }}>
                <p style={{ color:'#6b7280' }}>No recently attempted lessons.</p>
                <p style={{ color:'#9ca3af', fontSize:14 }}>Complete or start a lesson to see it here.</p>
              </div>
            ) : (
              <div style={list}>
                {recentList.map(({ lessonKey: rk, meta }) => {
                  if (!meta) {
                    return (
                      <div key={rk} style={{ ...row, cursor: 'default', opacity: 0.4 }}>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rk}</div>
                      </div>
                    )
                  }
                  const isActive = activeSet.has(rk)
                  const rMedalTier = medals[rk]?.medalTier || null
                  const rMedal = rMedalTier ? emojiForTier(rMedalTier) : ''
                  const rSlateTier = masteryMap[rk]?.medalTier
                  const rTeacherAward = selectedTeacher === 'slate'
                    ? (masteryMap[rk] ? ` ${rSlateTier ? slateEmojiForTier(rSlateTier) : '�'}` : '')
                    : selectedTeacher === 'webb'
                      ? (webbMap[rk]?.completed ? ' 🏆' : '')
                      : (rMedal ? ` ${rMedal}` : '')
                  const rSubjectBadge = meta.isGenerated
                    ? (meta.subject && meta.subject !== 'generated' ? meta.subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Generated')
                    : (meta.subject || 'general').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                  return (
                    <button
                      key={rk}
                      style={row}
                      onClick={() => { setSelectedLesson({ l: meta, subject: meta.subject || 'general', lessonKey: rk, isDemo: false }); setOverlayNoteEditing(false) }}
                      onMouseEnter={e => { e.currentTarget.style.background='#f9fafb'; e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.07)' }}
                      onMouseLeave={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.boxShadow='none' }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, background: '#f3f4f6', color: '#374151', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>{rSubjectBadge}</span>
                          {meta.grade && <span style={{ fontSize: 11, color: '#9ca3af' }}>Grade {meta.grade}</span>}
                          {meta.difficulty && <span style={{ fontSize: 11, color: '#9ca3af' }}>{meta.difficulty.charAt(0).toUpperCase() + meta.difficulty.slice(1)}</span>}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 15, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {meta.title || rk}{rTeacherAward}{medals[rk]?.medalTier ? ' 👩🏻‍🦰' : ''}{masteryMap[rk] ? ' 🤖' : ''}{webbMap[rk]?.completed ? ' 👩🏻‍🏫' : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {lessonHistoryInProgress?.[rk] && <span style={{ fontSize: 11, background: '#d1fae5', color: '#065f46', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>In progress</span>}
                        {lessonHistoryLastCompleted?.[rk] && !lessonHistoryInProgress?.[rk] && <span style={{ fontSize: 11, color: '#9ca3af' }}>{formatDateOnly(lessonHistoryLastCompleted[rk])}</span>}
                        {!isActive && <span style={{ fontSize: 13 }} title="Requires facilitator PIN to start">🔒</span>}
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ color: '#9ca3af' }}><path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          )}

          {/* ── Owned tab: facilitator-generated lessons ── */}
          {listTab === 'owned' && learnerId !== 'demo' && (
            generatedLoading ? (
              <div style={{ textAlign:'center', marginTop:32, color:'#9ca3af', fontSize:14 }}>Loading generated lessons…</div>
            ) : ownedList.length === 0 ? (
              <div style={{ textAlign:'center', marginTop:32 }}>
                <p style={{ color:'#6b7280' }}>No generated lessons yet.</p>
                <p style={{ color:'#9ca3af', fontSize:14 }}>Generate a lesson to see it here.</p>
              </div>
            ) : (
              <>
                {/* Filter + sort bar */}
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, flexWrap:'wrap' }}>
                  {ownedSubjects.length > 1 && (
                    <select
                      value={ownedSubjectFilter}
                      onChange={e => setOwnedSubjectFilter(e.target.value)}
                      style={{ fontSize:12, padding:'4px 8px', borderRadius:6, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', cursor:'pointer' }}
                    >
                      <option value=''>All Subjects</option>
                      {ownedSubjects.map(s => (
                        <option key={s} value={s}>{s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</option>
                      ))}
                    </select>
                  )}
                  <select
                    value={ownedSort}
                    onChange={e => setOwnedSort(e.target.value)}
                    style={{ fontSize:12, padding:'4px 8px', borderRadius:6, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', cursor:'pointer' }}
                  >
                    <option value='title-asc'>Title A → Z</option>
                    <option value='title-desc'>Title Z → A</option>
                    <option value='subject'>Subject</option>
                    <option value='grade-asc'>Grade ↑</option>
                    <option value='grade-desc'>Grade ↓</option>
                    <option value='active'>Active first</option>
                  </select>
                  <span style={{ fontSize:12, color:'#9ca3af', marginLeft:'auto' }}>
                    {filteredOwnedList.length === ownedList.length
                      ? `${ownedList.length} lesson${ownedList.length !== 1 ? 's' : ''}`
                      : `${filteredOwnedList.length} of ${ownedList.length}`}
                  </span>
                </div>
                {filteredOwnedList.length === 0 ? (
                  <div style={{ textAlign:'center', marginTop:32, color:'#9ca3af', fontSize:14 }}>No lessons match filters.</div>
                ) : (
                  <div style={list}>
                    {filteredOwnedList.map((ol) => {
                      const olk = ol.lessonKey
                      const isActive = activeSet.has(olk)
                      const oMedalTier = medals[olk]?.medalTier || null
                      const oMedal = oMedalTier ? emojiForTier(oMedalTier) : ''
                      const oSlateTier = masteryMap[olk]?.medalTier
                      const oTeacherAward = selectedTeacher === 'slate'
                        ? (masteryMap[olk] ? ` ${oSlateTier ? slateEmojiForTier(oSlateTier) : '�'}` : '')
                        : selectedTeacher === 'webb'
                          ? (webbMap[olk]?.completed ? ' 🏆' : '')
                          : (oMedal ? ` ${oMedal}` : '')
                      const oSubjectBadge = ol.subject && ol.subject !== 'generated'
                        ? ol.subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                        : 'Generated'
                      return (
                        <button
                          key={olk}
                          style={row}
                          onClick={() => { setSelectedLesson({ l: ol, subject: 'generated', lessonKey: olk, isDemo: false }); setOverlayNoteEditing(false) }}
                          onMouseEnter={e => { e.currentTarget.style.background='#f9fafb'; e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.07)' }}
                          onMouseLeave={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.boxShadow='none' }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, background: '#f3f4f6', color: '#374151', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>{oSubjectBadge}</span>
                              {ol.grade && <span style={{ fontSize: 11, color: '#9ca3af' }}>Grade {ol.grade}</span>}
                              {ol.difficulty && <span style={{ fontSize: 11, color: '#9ca3af' }}>{ol.difficulty.charAt(0).toUpperCase() + ol.difficulty.slice(1)}</span>}
                            </div>
                            <div style={{ fontWeight: 600, fontSize: 15, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {ol.title || olk}{oTeacherAward}{medals[olk]?.medalTier ? ' 👩🏻‍🦰' : ''}{masteryMap[olk] ? ' 🤖' : ''}{webbMap[olk]?.completed ? ' 👩🏻‍🏫' : ''}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            {isActive
                              ? <span style={{ fontSize: 11, background: '#d1fae5', color: '#065f46', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>Active</span>
                              : <span style={{ fontSize: 13 }} title="Requires facilitator PIN to start">🔒</span>
                            }
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ color: '#9ca3af' }}><path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )
          )}

          {/* Lesson detail overlay */}
          {selectedLesson && (() => {
            const { l, subject, lessonKey, isDemo, syllabusItem, syllabusExceptionApproved } = selectedLesson
            const ent = featuresForTier(planTier)
            const cap = ent.lessonsPerDay
            const capped = !isDemo && Number.isFinite(cap) && todaysCount >= cap
            const hasSnapshot = (() => {
              if (isDemo) return false
              if (selectedTeacher === 'slate') {
                try {
                  const saved = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('slate_session') || 'null' : 'null')
                  return !!(saved?.lessonData && saved.lessonKey === lessonKey)
                } catch { return false }
              }
              if (selectedTeacher === 'webb') {
                try {
                  const saved = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem(`webb_session_${lessonKey}`) || 'null' : 'null')
                  return !!(saved?.chatMessages?.length)
                } catch { return false }
              }
              return !!lessonSnapshots[lessonKey]
            })()
            const medalTier = medals[lessonKey]?.medalTier || null
            const medal = medalTier ? emojiForTier(medalTier) : ''
            const hasActiveKey = !isDemo && activeGoldenKeys[lessonKey] === true
            const noteText = lessonNotes[lessonKey] || ''
            const lastCompletedAt = isDemo ? null : lessonHistoryLastCompleted?.[lessonKey]
            const inProgressAt = isDemo ? null : lessonHistoryInProgress?.[lessonKey]
            const displaySubject = isDemo
              ? (l.subject ? l.subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Tutorial')
              : (subject === 'generated' && l.subject
                  ? l.subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                  : (subject === 'generated' ? 'Generated' : subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')))
            const isScheduled = !isDemo && !!scheduledLessons[lessonKey]

            const handleStartLesson = async () => {
              if (isDemo) { openLesson('demo', l.file); return }
              // PIN gate for lessons not currently active (not approved/scheduled)
              if (!syllabusItem && !activeSet.has(lessonKey) && !syllabusExceptionApproved) {
                const ok = await ensurePinAllowed('facilitator-key')
                if (!ok) return
              }
              try {
                const supabase = getSupabaseClient()
                const { data: { session } } = await supabase.auth.getSession()
                const token = session?.access_token
                if (!token) { openLesson(subject, l.file); return }
                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
                const res = await fetch('/api/lessons/quota', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({ lesson_key: lessonKey, timezone: tz })
                })
                if (res.ok) {
                  openLesson(subject, l.file, syllabusItem)
                } else if (res.status === 429) {
                  const js = await res.json()
                  alert(js.error || 'Daily lesson limit reached')
                } else {
                  openLesson(subject, l.file, syllabusItem)
                }
              } catch {
                openLesson(subject, l.file, syllabusItem)
              }
            }

            return (
              <>
                {/* Backdrop */}
                <div
                  onClick={() => { setSelectedLesson(null); setOverlayNoteEditing(false) }}
                  style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
                    zIndex: 1000, backdropFilter: 'blur(2px)'
                  }}
                />
                {/* Modal */}
                <div style={{
                  position: 'fixed', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 1001,
                  background: '#fff',
                  borderRadius: 16,
                  boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
                  width: '92vw', maxWidth: 520,
                  maxHeight: '88vh',
                  overflow: 'hidden',
                  display: 'flex', flexDirection: 'column'
                }}>
                  {/* Modal header */}
                  <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                          {isDemo
                            ? <span style={{ fontSize: 11, background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>Demo</span>
                            : <span style={{ fontSize: 11, background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{displaySubject}</span>
                          }
                          {isScheduled && <span style={{ fontSize: 11, background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>📅 Scheduled</span>}
                        </div>
                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111', lineHeight: 1.25 }}>
                          {l.title}
                        </h2>
                        {(l.grade || l.difficulty) && (
                          <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>
                            {l.grade && `Grade ${l.grade}`}
                            {l.grade && l.difficulty && '  ·  '}
                            {l.difficulty && l.difficulty.charAt(0).toUpperCase() + l.difficulty.slice(1)}
                          </div>
                        )}
                        {/* Teacher achievement badges — show all three teachers' grades */}
                        {!isDemo && (medals[lessonKey]?.medalTier || masteryMap[lessonKey] || webbMap[lessonKey]?.completed) && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                            {medals[lessonKey]?.medalTier && (
                              <span style={{ fontSize: 13, background: '#fef3c7', color: '#92400e', padding: '2px 9px', borderRadius: 20, fontWeight: 600 }}>
                                {emojiForTier(medals[lessonKey].medalTier)} 👩🏻‍🦰 Ms. Sonoma
                              </span>
                            )}
                            {masteryMap[lessonKey] && (
                              <span style={{ fontSize: 13, background: '#ede9fe', color: '#5b21b6', padding: '2px 9px', borderRadius: 20, fontWeight: 600 }}>
                                {masteryMap[lessonKey]?.medalTier ? slateEmojiForTier(masteryMap[lessonKey].medalTier) : '�'} 🤖 Mr. Slate
                              </span>
                            )}
                            {webbMap[lessonKey]?.completed && (
                              <span style={{ fontSize: 13, background: '#d1fae5', color: '#065f46', padding: '2px 9px', borderRadius: 20, fontWeight: 600 }}>
                                🏆 👩🏻‍🏫 Mrs. Webb
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => { setSelectedLesson(null); setOverlayNoteEditing(false) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9ca3af', fontSize: 22, lineHeight: 1, flexShrink: 0 }}
                        aria-label="Close"
                      >×</button>
                    </div>
                  </div>

                  {/* Scrollable body */}
                  <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
                    {l.blurb && (
                      <p style={{ margin: '0 0 16px', color: '#374151', fontSize: 15, lineHeight: 1.6 }}>{l.blurb}</p>
                    )}

                    {/* Golden Key toggle — only when Ms. Sonoma is selected */}
                    {goldenKeysEnabled === true && !isDemo && selectedTeacher === 'sonoma' && (() => {
                      const keyOn = goldenKeySelected || pendingKeyLessonKey === lessonKey || hasActiveKey
                      const facilitatorOnly = hasActiveKey && !goldenKeySelected && pendingKeyLessonKey !== lessonKey
                      return (
                        <button
                          onClick={() => {
                            if (facilitatorOnly) return // facilitator-set, not learner-togglable
                            if (pendingKeyLessonKey === lessonKey) {
                              // Key was already applied to this lesson — remove the pending entry
                              try { sessionStorage.removeItem('golden_key_pending_lesson') } catch {}
                              setPendingKeyLessonKey(null)
                              setGoldenKeySelected(false)
                            } else {
                              setGoldenKeySelected(prev => !prev)
                            }
                          }}
                          title={facilitatorOnly ? 'Golden Key applied by facilitator' : keyOn ? 'Golden Key active — click to remove' : 'Apply a Golden Key to this lesson'}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            background: keyOn ? '#fef3c7' : '#f3f4f6',
                            border: `1px solid ${keyOn ? '#f59e0b' : '#d1d5db'}`,
                            borderRadius: 20, padding: '3px 10px 3px 6px',
                            cursor: facilitatorOnly ? 'default' : 'pointer', marginBottom: 14, fontSize: 13, fontWeight: 600,
                            color: keyOn ? '#92400e' : '#6b7280',
                            transition: 'all 0.15s'
                          }}
                        >
                          <span style={{ fontSize: 15, filter: keyOn ? 'none' : 'grayscale(1) opacity(0.5)' }}>🔑</span>
                          {keyOn ? 'Golden Key On' : 'Use Golden Key'}
                        </button>
                      )
                    })()}

                    {/* History */}
                    {(inProgressAt || lastCompletedAt) && (
                      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {inProgressAt && <span>⏳ In progress since {formatDateTime(inProgressAt)}</span>}
                        {lastCompletedAt && <span>✅ Last completed {formatDateOnly(lastCompletedAt)}</span>}
                      </div>
                    )}

                    {/* View all attempts link */}
                    {!isDemo && (
                      <button
                        onClick={() => setShowLessonDetailHistory({ lessonKey, title: l.title })}
                        style={{ fontSize: 13, color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', marginBottom: 16 }}
                      >
                        📋 View all attempts
                      </button>
                    )}

                    {/* Facilitator note */}
                    {!overlayNoteEditing && noteText && (
                      <div style={{ background: '#fef3c7', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 14, color: '#92400e' }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>📝 Facilitator Note</div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{noteText}</div>
                      </div>
                    )}
                    {!overlayNoteEditing && !isDemo && (
                      <button
                        onClick={() => setOverlayNoteEditing(true)}
                        style={{ fontSize: 13, color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', marginBottom: 16 }}
                      >
                        {noteText ? '📝 Edit note' : '📝 Add note'}
                      </button>
                    )}
                    {overlayNoteEditing && (
                      <div style={{ marginBottom: 16 }}>
                        <textarea
                          defaultValue={noteText}
                          placeholder="Add facilitator notes..."
                          autoFocus
                          rows={3}
                          id={`overlay-note-${lessonKey}`}
                          style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', marginBottom: 8 }}
                        />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => {
                              const el = document.getElementById(`overlay-note-${lessonKey}`)
                              saveNote(lessonKey, el?.value || '')
                              setOverlayNoteEditing(false)
                            }}
                            disabled={saving}
                            style={{ padding: '6px 14px', border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer' }}
                          >{saving ? 'Saving...' : 'Save'}</button>
                          <button
                            onClick={() => setOverlayNoteEditing(false)}
                            style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}
                          >Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer with action button */}
                  <div style={{ padding: '14px 20px', borderTop: '1px solid #f3f4f6' }}>
                    <button
                      style={capped ? btnDisabled : btn}
                      disabled={capped}
                      onClick={handleStartLesson}
                    >
                      {!isDemo && !activeSet.has(lessonKey) ? '🔒 ' : ''}{hasSnapshot ? 'Continue' : 'Start Lesson'}
                    </button>
                    {capped && (
                      <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, marginTop: 8, marginBottom: 0 }}>
                        Daily lesson limit reached
                      </p>
                    )}
                  </div>
                </div>
              </>
            )
          })()}
        </>
      )}

      {/* Per-lesson history sub-overlay */}
      {showLessonDetailHistory && (() => {
        const { lessonKey: hk, title: hTitle } = showLessonDetailHistory
        const sonomaSessions = (lessonHistorySessions || []).filter(s => {
          const fname = hk.split('/').pop()?.replace(/\.json$/i, '')
          return s.lesson_id === fname || s.lesson_id === hk
        })
        const sonomaCompleted = sonomaSessions.filter(s => s.status === 'completed').length
        const sonomaBest = medals[hk]?.medalTier ? emojiForTier(medals[hk].medalTier) : null
        const sonomaLastAt = lessonHistoryLastCompleted?.[hk]
        const sonomaInProgress = lessonHistoryInProgress?.[hk]
        const slateEntry = masteryMap[hk]
        const webbEntry = webbMap[hk]
        const hasSomething = sonomaCompleted > 0 || sonomaBest || sonomaInProgress || slateEntry || webbEntry
        return (
          <>
            <div
              onClick={() => setShowLessonDetailHistory(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100 }}
            />
            <div style={{
              position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1101, padding: '16px'
            }}>
              <div style={{
                background: '#fff', borderRadius: 16,
                boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
                width: '92vw', maxWidth: 460,
                maxHeight: '80vh',
                overflow: 'hidden',
                display: 'flex', flexDirection: 'column'
              }}>
                {/* Header */}
                <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>LESSON HISTORY</div>
                    <div style={{ fontWeight: 700, fontSize: 17, color: '#111', lineHeight: 1.25 }}>{hTitle}</div>
                  </div>
                  <button
                    onClick={() => setShowLessonDetailHistory(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9ca3af', fontSize: 22, lineHeight: 1, flexShrink: 0 }}
                    aria-label="Close"
                  >×</button>
                </div>
                {/* Body */}
                <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {!hasSomething && (
                    <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>No attempts recorded yet for this lesson.</p>
                  )}
                  {/* Ms. Sonoma */}
                  {(sonomaCompleted > 0 || sonomaBest || sonomaInProgress) && (
                    <div style={{ background: '#fff7ed', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e', marginBottom: 6 }}>👩🏻‍🦰 Ms. Sonoma</div>
                      {sonomaBest && <div style={{ fontSize: 13, color: '#374151', marginBottom: 3 }}>Best grade: {sonomaBest}</div>}
                      {sonomaCompleted > 0 && <div style={{ fontSize: 13, color: '#374151', marginBottom: 3 }}>Sessions completed: {sonomaCompleted}</div>}
                      {sonomaLastAt && <div style={{ fontSize: 13, color: '#374151', marginBottom: 3 }}>Last completed: {formatDateOnly(sonomaLastAt)}</div>}
                      {sonomaInProgress && <div style={{ fontSize: 13, color: '#374151' }}>⏳ In progress since {formatDateTime(sonomaInProgress)}</div>}
                    </div>
                  )}
                  {/* Mr. Slate */}
                  {slateEntry && (
                    <div style={{ background: '#ede9fe', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#5b21b6', marginBottom: 6 }}>🤖 Mr. Slate</div>
                      {slateEntry.bestPercent != null
                        ? <div style={{ fontSize: 13, color: '#374151', marginBottom: 3 }}>Best grade: {slateEmojiForTier(slateEntry.medalTier)} {slateEntry.bestPercent}%</div>
                        : <div style={{ fontSize: 13, color: '#374151', marginBottom: 3 }}>� Mastered</div>
                      }
                      {slateEntry.masteredAt && <div style={{ fontSize: 13, color: '#374151' }}>Mastered on: {formatDateOnly(slateEntry.masteredAt)}</div>}
                    </div>
                  )}
                  {/* Mrs. Webb */}
                  {webbEntry?.completed && (
                    <div style={{ background: '#d1fae5', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#065f46', marginBottom: 6 }}>👩🏻‍🏫 Mrs. Webb</div>
                      <div style={{ fontSize: 13, color: '#374151', marginBottom: 3 }}>🏆 Completed</div>
                      {webbEntry.completedAt && <div style={{ fontSize: 13, color: '#374151' }}>Completed on: {formatDateOnly(webbEntry.completedAt)}</div>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )
      })()}

      {(() => {
        const ent = featuresForTier(planTier)
        const cap = ent.lessonsPerDay
        const used = Number.isFinite(todaysCount) ? todaysCount : 0
        const unlimited = cap === Infinity
        return (
          <p style={{ textAlign: 'center', color: '#9ca3af', marginTop: 24, fontSize: 13 }}>
            {unlimited
              ? `Lessons started today: ${used} (no daily limit on your plan)`
              : `Lessons started today: ${used} of ${cap} — ${Math.max(0, cap - used)} remaining`}
          </p>
        )
      })()}

        </div>{/* end main content */}
      </div>{/* end sidebar+content flex row */}

      <LoadingProgress
        isLoading={sessionLoading}
        onComplete={() => setSessionLoading(false)}
      />

      <LessonHistoryModal
        open={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        sessions={lessonHistorySessions}
        events={lessonHistoryEvents}
        loading={lessonHistoryLoading}
        error={lessonHistoryError}
        onRefresh={refreshLessonHistory}
        titleLookup={(lessonId) => lessonTitleLookup[lessonId]}
      />
    </main>
  )
}

export default function LessonsPage(){
  return (
    <Suspense fallback={<main style={{padding:24}}><p>Loading lessons</p></main>}>
      <LessonsPageInner />
    </Suspense>
  )
}
