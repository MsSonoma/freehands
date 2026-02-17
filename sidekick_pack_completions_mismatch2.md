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

### 2. sidekick_pack_planned_all.md (7e6f9e099ed0bba77cc78887bd83ba39f37066930a72a67bd840f9de1f9e3b5a)
- bm25: -14.4033 | entity_overlap_w: 3.00 | adjusted: -15.1533 | relevance: 1.0000

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

### 3. sidekick_pack_calendar.md (2a3e86ef656681a0f342082ad621f01e89dfc9483227c5d812966dc60315f5b5)
- bm25: -14.3809 | entity_overlap_w: 3.00 | adjusted: -15.1309 | relevance: 1.0000

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

### 4. sidekick_pack_planned_all.md (02c02d27f519cbb03ec7cb65be2760e2665a920e83f0a486eb7da10bdc2d5d4e)
- bm25: -13.8802 | entity_overlap_w: 3.00 | adjusted: -14.6302 | relevance: 1.0000

// Fetch lesson history (completed, scheduled, planned)
      const [historyRes, medalsRes, scheduledRes, preferencesRes] = await Promise.all([
        fetch(`/api/learner/lesson-history?learner_id=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/medals?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/lesson-schedule?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/curriculum-preferences?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } })
      ])

### 5. sidekick_pack_completions_mismatch.md (1a85c40cd9be46b199ed34e5118bc69e481218dbd23412a09f62a9c1f65f7f0c)
- bm25: -13.8802 | entity_overlap_w: 3.00 | adjusted: -14.6302 | relevance: 1.0000

// Fetch lesson history (completed, scheduled, planned)
      const [historyRes, medalsRes, scheduledRes, preferencesRes] = await Promise.all([
        fetch(`/api/learner/lesson-history?learner_id=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/medals?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/lesson-schedule?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/curriculum-preferences?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } })
      ])

### 6. sidekick_pack_completions_mismatch.md (2e66c390efcb97a3a6b9523ea19a63ba08d6c6e2a40a6bdd93c53d1718f5ef50)
- bm25: -13.8802 | entity_overlap_w: 3.00 | adjusted: -14.6302 | relevance: 1.0000

// Fetch lesson history (completed, scheduled, planned)
      const [historyRes, medalsRes, scheduledRes, preferencesRes] = await Promise.all([
        fetch(`/api/learner/lesson-history?learner_id=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/medals?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/lesson-schedule?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/curriculum-preferences?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } })
      ])

### 7. sidekick_pack_completions_mismatch.md (c0af055b6cf2f5a126a6b41f34c9d4f4d5636ea40f3466dab55eb9dfcf930e1a)
- bm25: -13.8802 | entity_overlap_w: 3.00 | adjusted: -14.6302 | relevance: 1.0000

// Fetch lesson history (completed, scheduled, planned)
      const [historyRes, medalsRes, scheduledRes, preferencesRes] = await Promise.all([
        fetch(`/api/learner/lesson-history?learner_id=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/medals?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/lesson-schedule?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/curriculum-preferences?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } })
      ])

### 8. sidekick_pack_completions_mismatch.md (4d70ffb6cf5bf342adef7c9b1b576c15f6b660105427e60170e67a2b73029e01)
- bm25: -13.9598 | entity_overlap_w: 2.50 | adjusted: -14.5848 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
V2 completed lessons mismatch: Calendar vs Completed Lessons page vs Awards (medals). Find where lesson completion is recorded in V2 (session/teaching flow), where each screen pulls data (lesson history API, medals API, lesson schedule API), and identify why completions are missing (Emma).
```

Filter terms used:
```text
API
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

API

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack_mentor_schema.md (799992b6a1ce2f36ba290f1138f2018a0234f611b1ea4868ee056ceced015f6c)
- bm25: -0.4452 | entity_overlap_w: 2.60 | adjusted: -1.0952 | relevance: 1.0000

### 39. src/app/facilitator/calendar/page.js (5e87d7c4007b60bd8dc94a3654ecdcc51bd79003e2d025df44b062ea052b69f4)
- bm25: -2.6162 | entity_overlap_w: 1.00 | adjusted: -2.8662 | relevance: 1.0000

if (pastSchedule.length > 0 && minPastDate) {
          // IMPORTANT: Do not query lesson_session_events directly from the client.
          // In some environments, RLS causes the query to return an empty array without an error,
          // which hides all past schedule history. Use the admin-backed API endpoint instead.
          const historyRes = await fetch(
            `/api/learner/lesson-history?learner_id=${selectedLearnerId}&from=${encodeURIComponent(minPastDate)}&to=${encodeURIComponent(todayStr)}`
          )
          const historyJson = await historyRes.json().catch(() => null)

### 9. sidekick_pack_completions_mismatch.md (059f448a10c5cd83b0da0c514af0fe01d9f18c2127ef330fa2e6ea07a5c0e255)
- bm25: -11.4036 | entity_overlap_w: 4.00 | adjusted: -12.4036 | relevance: 1.0000

const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
    }

### 32. sidekick_pack_planned_all.md (02c02d27f519cbb03ec7cb65be2760e2665a920e83f0a486eb7da10bdc2d5d4e)
- bm25: -2.7920 | entity_overlap_w: 1.00 | adjusted: -3.0420 | relevance: 1.0000

// Fetch lesson history (completed, scheduled, planned)
      const [historyRes, medalsRes, scheduledRes, preferencesRes] = await Promise.all([
        fetch(`/api/learner/lesson-history?learner_id=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/medals?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/lesson-schedule?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/curriculum-preferences?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } })
      ])

### 33. src/app/api/lesson-schedule/route.js (a4a66f7a325a73d6a8b19846f515a5433ea46cb37ffe423379030e0dd63353c6)
- bm25: -2.5321 | entity_overlap_w: 2.00 | adjusted: -3.0321 | relevance: 1.0000

// Get active lessons for today (used by learner view)
    if (action === 'active' && learnerId) {
      // Use local date, not UTC
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const today = `${year}-${month}-${day}`
      
      const { data, error } = await adminSupabase
        .from('lesson_schedule')
        .select('lesson_key')
        .eq('learner_id', learnerId)
        .eq('scheduled_date', today)

### 10. sidekick_pack_mentor_schema.md (bbece32ae29276797773dfc67f0677caacb09224ced11b206097c5976ef7ac79)
- bm25: -11.4036 | entity_overlap_w: 4.00 | adjusted: -12.4036 | relevance: 1.0000

const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
    }

### 32. sidekick_pack_planned_all.md (02c02d27f519cbb03ec7cb65be2760e2665a920e83f0a486eb7da10bdc2d5d4e)
- bm25: -2.7920 | entity_overlap_w: 1.00 | adjusted: -3.0420 | relevance: 1.0000

// Fetch lesson history (completed, scheduled, planned)
      const [historyRes, medalsRes, scheduledRes, preferencesRes] = await Promise.all([
        fetch(`/api/learner/lesson-history?learner_id=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/medals?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/lesson-schedule?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/curriculum-preferences?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } })
      ])

### 33. src/app/api/lesson-schedule/route.js (a4a66f7a325a73d6a8b19846f515a5433ea46cb37ffe423379030e0dd63353c6)
- bm25: -2.5321 | entity_overlap_w: 2.00 | adjusted: -3.0321 | relevance: 1.0000

// Get active lessons for today (used by learner view)
    if (action === 'active' && learnerId) {
      // Use local date, not UTC
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const today = `${year}-${month}-${day}`
      
      const { data, error } = await adminSupabase
        .from('lesson_schedule')
        .select('lesson_key')
        .eq('learner_id', learnerId)
        .eq('scheduled_date', today)

### 11. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (a4c72fca3cb8c24f8808f6a2c19be255285f52ad570bd3bb7ebbb8da1ef75d54)
- bm25: -11.5237 | entity_overlap_w: 3.00 | adjusted: -12.2737 | relevance: 1.0000

// Build a context string so Redo doesn't loop the same topics.
      let contextText = ''

const LOW_SCORE_REVIEW_THRESHOLD = 70
      const HIGH_SCORE_AVOID_REPEAT_THRESHOLD = 85

const lowScoreNames = new Set()
      const highScoreNames = new Set()

const [historyRes, medalsRes] = await Promise.all([
        fetch(`/api/learner/lesson-history?learner_id=${learnerId}`, {
          headers: { 'authorization': `Bearer ${token}` }
        }),
        fetch(`/api/medals?learnerId=${learnerId}`, {
          headers: { 'authorization': `Bearer ${token}` }
        })
      ])

let medals = {}
      if (medalsRes.ok) {
        medals = (await medalsRes.json().catch(() => ({}))) || {}
      }

### 12. sidekick_pack_completions_mismatch.md (e05a3bb2460247b6913f6cb737031533494becf42e7caaa73ab9c1920926a6e0)
- bm25: -11.1269 | entity_overlap_w: 3.00 | adjusted: -11.8769 | relevance: 1.0000

## Question

/api/mentor-session is_active session_id SessionTakeoverDialog

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack.md (1dd92dae5e8813538d894c056cbd5ce4b3c04e2476cfbc543123ea11bb1a3d1f)
- bm25: -16.1404 | entity_overlap_w: 7.50 | adjusted: -18.0154 | relevance: 1.0000

### 29. sidekick_pack_calendar.md (2a3e86ef656681a0f342082ad621f01e89dfc9483227c5d812966dc60315f5b5)
- bm25: -0.4560 | relevance: 1.0000

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

### 13. src/app/facilitator/calendar/page.js (5e87d7c4007b60bd8dc94a3654ecdcc51bd79003e2d025df44b062ea052b69f4)
- bm25: -11.0100 | entity_overlap_w: 2.50 | adjusted: -11.6350 | relevance: 1.0000

if (pastSchedule.length > 0 && minPastDate) {
          // IMPORTANT: Do not query lesson_session_events directly from the client.
          // In some environments, RLS causes the query to return an empty array without an error,
          // which hides all past schedule history. Use the admin-backed API endpoint instead.
          const historyRes = await fetch(
            `/api/learner/lesson-history?learner_id=${selectedLearnerId}&from=${encodeURIComponent(minPastDate)}&to=${encodeURIComponent(todayStr)}`
          )
          const historyJson = await historyRes.json().catch(() => null)

### 14. sidekick_pack_completions_mismatch.md (5002bc813fb9a5481519a3b7d62a32151c374d104dc48676ea5b20beddab1eaf)
- bm25: -11.1922 | relevance: 1.0000

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

### 15. src/app/api/learner/lesson-history/route.js (5a218f2a3961460c8101e0ab3f4ddd93851d72b79a01f8c880344a7204fefe39)
- bm25: -10.7751 | entity_overlap_w: 1.00 | adjusted: -11.0251 | relevance: 1.0000

if (!existingIncomplete) {
        try {
          const { data: insertedEvent, error: insertError } = await supabase
            .from('lesson_session_events')
            .insert({
              session_id: session.id,
              learner_id: learnerId,
              lesson_id: session.lesson_id,
              event_type: 'incomplete',
              occurred_at: incompleteAtIso,
              metadata: {
                reason: 'auto-marked-stale',
                minutes_since_activity: Math.round((nowMs - latestActivityMs) / 60000),
              },
            })
            .select('id, session_id, lesson_id, event_type, occurred_at, metadata')
            .single()

### 16. sidekick_pack_planned_all.md (ccfc16941934d1c73cb9b713bc34b9edbbc5377b8a728c9ebde39fbc6cd06222)
- bm25: -10.9518 | relevance: 1.0000

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

lessonContext = [...completed, ...incomplete]
      }

### 26. sidekick_pack_api_mentor_session.md (a0d6a2635e5a0a5206309222151f8fcf78f90a50e4cf0fb8484706065d407fee)
- bm25: -0.4585 | relevance: 1.0000

if (!isMountedRef.current) {
          setSessionLoading(false)
          setSessionLoading(false)
          return
        }

### 27. sidekick_pack_planned_all.md (7e6f9e099ed0bba77cc78887bd83ba39f37066930a72a67bd840f9de1f9e3b5a)
- bm25: -0.4567 | relevance: 1.0000

if (!token) {
        setGenerating(false)
        return
      }

### 18. sidekick_pack_completions_mismatch.md (1cda830423b4d6072cf9ec18deb118eb1ee1c949f664b16a12ededd9c41ecd4d)
- bm25: -10.0530 | relevance: 1.0000

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

### 28. sidekick_pack_takeover.md (d2b72071b1a2c2c6817565e96ed76f09ce317391276449fdde4792537f9e2326)
- bm25: -0.4563 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Locate and fix takeover ownership: clearPersistedSessionIdentifier initializedSessionIdRef SessionTakeoverDialog /api/mentor-session handleSessionTakeover isOwner session_id is_active. Also locate how counselor conversations are keyed vs selectedLearnerId.
```

Filter terms used:
```text
/api/mentor-session
is_active
session_id
SessionTakeoverDialog
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

### 19. sidekick_pack_mentor_schema.md (39a25c8f4dd35bb60c363264655285429fab2b99add0ec834537b67589edf875)
- bm25: -9.4507 | entity_overlap_w: 1.00 | adjusted: -9.7007 | relevance: 1.0000

### 37. src/app/api/learner/lesson-history/route.js (5a218f2a3961460c8101e0ab3f4ddd93851d72b79a01f8c880344a7204fefe39)
- bm25: -2.7138 | entity_overlap_w: 1.00 | adjusted: -2.9638 | relevance: 1.0000

if (!existingIncomplete) {
        try {
          const { data: insertedEvent, error: insertError } = await supabase
            .from('lesson_session_events')
            .insert({
              session_id: session.id,
              learner_id: learnerId,
              lesson_id: session.lesson_id,
              event_type: 'incomplete',
              occurred_at: incompleteAtIso,
              metadata: {
                reason: 'auto-marked-stale',
                minutes_since_activity: Math.round((nowMs - latestActivityMs) / 60000),
              },
            })
            .select('id, session_id, lesson_id, event_type, occurred_at, metadata')
            .single()

### 38. src/app/facilitator/generator/counselor/CounselorClient.jsx (8d5a3f01beb2e24d3994f08ab4fab74c23d4c10cb67803937aa80785a3d668bb)
- bm25: -2.9345 | relevance: 1.0000

### 20. sidekick_pack_mentor_schema.md (799992b6a1ce2f36ba290f1138f2018a0234f611b1ea4868ee056ceced015f6c)
- bm25: -8.5662 | entity_overlap_w: 2.50 | adjusted: -9.1912 | relevance: 1.0000

### 39. src/app/facilitator/calendar/page.js (5e87d7c4007b60bd8dc94a3654ecdcc51bd79003e2d025df44b062ea052b69f4)
- bm25: -2.6162 | entity_overlap_w: 1.00 | adjusted: -2.8662 | relevance: 1.0000

if (pastSchedule.length > 0 && minPastDate) {
          // IMPORTANT: Do not query lesson_session_events directly from the client.
          // In some environments, RLS causes the query to return an empty array without an error,
          // which hides all past schedule history. Use the admin-backed API endpoint instead.
          const historyRes = await fetch(
            `/api/learner/lesson-history?learner_id=${selectedLearnerId}&from=${encodeURIComponent(minPastDate)}&to=${encodeURIComponent(todayStr)}`
          )
          const historyJson = await historyRes.json().catch(() => null)

### 40. src/app/api/mentor-session/route.js (db7d65cfdea6e1a307048bbac453e8b202e2c2d9bacf853983bae8dbe1bac88d)
- bm25: -2.5657 | entity_overlap_w: 1.00 | adjusted: -2.8157 | relevance: 1.0000

// PIN validated, copy conversation from existing session
      const conversationToCopy = existingSession.conversation_history || []
      const draftSummaryToCopy = existingSession.draft_summary || ''

console.log('[Takeover API] Copying conversation:', {
        oldSessionId: existingSession.session_id,
        oldDeviceName: existingSession.device_name,
        conversationLength: conversationToCopy.length,
        hasDraft: !!draftSummaryToCopy,
        newSessionId: sessionId,
        newDeviceName: deviceName
      })

// Deactivate old session
      const deactivated = await deactivateSessionById(existingSession.id)

if (!deactivated) {
        return Response.json({ error: 'Failed to deactivate previous session' }, { status: 500 })
      }

### 21. src/app/api/learner/lesson-history/route.js (fd1937ffd513cfdcd8c204297d056e1d4b876af7f6a90ff015155c1bac2dfd24)
- bm25: -8.5779 | entity_overlap_w: 1.00 | adjusted: -8.8279 | relevance: 1.0000

if (sessionError) {
      return NextResponse.json({ error: 'Failed to load lesson sessions' }, { status: 500 })
    }

const sessions = Array.isArray(sessionRows)
      ? sessionRows.map((row) => {
          const startedAt = row?.started_at || null
          const endedAt = row?.ended_at || null
          let durationSeconds = null
          if (startedAt && endedAt) {
            const start = new Date(startedAt)
            const end = new Date(endedAt)
            const diff = Math.max(0, end.getTime() - start.getTime())
            durationSeconds = Math.round(diff / 1000)
          }
          return {
            id: row?.id || null,
            learner_id: row?.learner_id || null,
            lesson_id: row?.lesson_id || null,
            started_at: startedAt,
            ended_at: endedAt,
            status: endedAt ? 'completed' : 'in-progress',
            duration_seconds: durationSeconds
          }
        })
      : []

let events = []
    try {
      let eventsQueryBase = () => {
        let q = supabase
          .from('lesson_session_events')
          .select('id, session_id, lesson_id, event_type, occurred_at, metadata')
          .eq('learner_id', learnerId)

if (fromIso) q = q.gte('occurred_at', fromIso)
        if (toExclusiveIso) q = q.lt('occurred_at', toExclusiveIso)

return q.order('occurred_at', { ascending: false })
      }

### 22. sidekick_pack_mentor_schema.md (e5991b12568d946fff390d6ecba64208d9e83f7848fd27ce2a5943d79da66d92)
- bm25: -8.6137 | relevance: 1.0000

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

### 23. sidekick_pack_completions_mismatch.md (f533ca4590ba528b3fae4d32a35123611e935ad97e833c439bc07b66439dfc8e)
- bm25: -7.9825 | entity_overlap_w: 2.50 | adjusted: -8.6075 | relevance: 1.0000

if (action === 'force_end') {
      if (!pinCode) {
        return Response.json({
          error: 'PIN required to force end session',
          requiresPin: true
        }, { status: 403 })
      }

### 6. sidekick_pack_api_mentor_session.md (5388e78bba3c5d5c4ba59b06b030271c9ebca9ffc6db3797c2d5648e94849b7c)
- bm25: -15.3720 | entity_overlap_w: 9.00 | adjusted: -17.6220 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Where is /api/mentor-session implemented? Show route file and how it determines isOwner, session conflict, deviceName, is_active, facilitator_id. Also where SessionTakeoverDialog calls takeover endpoint.
```

Filter terms used:
```text
/api/mentor-session
facilitator_id
is_active
SessionTakeoverDialog
```
# Context Pack

### 4. src/app/facilitator/calendar/page.js (5e87d7c4007b60bd8dc94a3654ecdcc51bd79003e2d025df44b062ea052b69f4)
- bm25: -0.4434 | entity_overlap_w: 1.30 | adjusted: -0.7684 | relevance: 1.0000

if (pastSchedule.length > 0 && minPastDate) {
          // IMPORTANT: Do not query lesson_session_events directly from the client.
          // In some environments, RLS causes the query to return an empty array without an error,
          // which hides all past schedule history. Use the admin-backed API endpoint instead.
          const historyRes = await fetch(
            `/api/learner/lesson-history?learner_id=${selectedLearnerId}&from=${encodeURIComponent(minPastDate)}&to=${encodeURIComponent(todayStr)}`
          )
          const historyJson = await historyRes.json().catch(() => null)

### 24. sidekick_pack_api_mentor_session.md (2b1d53bf4856f429b237f5c2eba3881b13b044e01c166bd29f4cbd3a216af661)
- bm25: -8.3314 | entity_overlap_w: 1.00 | adjusted: -8.5814 | relevance: 1.0000

### 37. src/app/api/planned-lessons/route.js (0cb34597997923379f49f1a5824d6852b3ad04d47f6f03a6981194ba09861b6b)
- bm25: -3.5216 | entity_overlap_w: 1.00 | adjusted: -3.7716 | relevance: 1.0000

// Verify the learner belongs to this facilitator/owner
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

### 38. sidekick_pack_takeover.md (ea828774f1131ea6f2317efabbac4596bdf128f70ff03d1758deadd5cd1aca30)
- bm25: -3.3936 | entity_overlap_w: 1.50 | adjusted: -3.7686 | relevance: 1.0000

if (!resolvedId) {
      resolvedId = generateSessionIdentifier()
    }

### 11. src/app/api/learner/lesson-history/route.js (5a218f2a3961460c8101e0ab3f4ddd93851d72b79a01f8c880344a7204fefe39)
- bm25: -7.6764 | entity_overlap_w: 2.00 | adjusted: -8.1764 | relevance: 1.0000

if (!existingIncomplete) {
        try {
          const { data: insertedEvent, error: insertError } = await supabase
            .from('lesson_session_events')
            .insert({
              session_id: session.id,
              learner_id: learnerId,
              lesson_id: session.lesson_id,
              event_type: 'incomplete',
              occurred_at: incompleteAtIso,
              metadata: {
                reason: 'auto-marked-stale',
                minutes_since_activity: Math.round((nowMs - latestActivityMs) / 60000),
              },
            })
            .select('id, session_id, lesson_id, event_type, occurred_at, metadata')
            .single()

### 25. sidekick_pack_mentor_sessions_sql.md (0b2a6c358e7024498983e01453215cfdd9b09041e3d20a19221f0a745189384d)
- bm25: -8.5792 | relevance: 1.0000

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

### 26. src/app/facilitator/calendar/page.js (45a3f960320e40cd0f5d44fbd1557244327369796a5b24116ee137e4fc1a97a6)
- bm25: -8.5792 | relevance: 1.0000

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

### 27. sidekick_pack_takeover.md (ea828774f1131ea6f2317efabbac4596bdf128f70ff03d1758deadd5cd1aca30)
- bm25: -8.2441 | entity_overlap_w: 1.00 | adjusted: -8.4941 | relevance: 1.0000

if (!resolvedId) {
      resolvedId = generateSessionIdentifier()
    }

### 11. src/app/api/learner/lesson-history/route.js (5a218f2a3961460c8101e0ab3f4ddd93851d72b79a01f8c880344a7204fefe39)
- bm25: -7.6764 | entity_overlap_w: 2.00 | adjusted: -8.1764 | relevance: 1.0000

if (!existingIncomplete) {
        try {
          const { data: insertedEvent, error: insertError } = await supabase
            .from('lesson_session_events')
            .insert({
              session_id: session.id,
              learner_id: learnerId,
              lesson_id: session.lesson_id,
              event_type: 'incomplete',
              occurred_at: incompleteAtIso,
              metadata: {
                reason: 'auto-marked-stale',
                minutes_since_activity: Math.round((nowMs - latestActivityMs) / 60000),
              },
            })
            .select('id, session_id, lesson_id, event_type, occurred_at, metadata')
            .single()

### 12. src/app/facilitator/generator/counselor/CounselorClient.jsx (fe35cada78006265a115c3c1e903d4415d9fcd7a8f619558635d36e4465be49f)
- bm25: -6.9062 | entity_overlap_w: 2.50 | adjusted: -7.5312 | relevance: 1.0000

// Periodic heartbeat to detect if session was taken over (backup to realtime)
  useEffect(() => {
    if (!sessionId || !accessToken || !hasAccess || sessionLoading) return

const checkSessionStatus = async () => {
      try {
        const res = await fetch(`/api/mentor-session?sessionId=${sessionId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        
        if (!res.ok) return

### 28. sidekick_pack_takeover.md (7ba0b55dd2e1da3e5871fd86269c2ba23c40511c9483186fc05780559c22f4d5)
- bm25: -7.8730 | entity_overlap_w: 1.00 | adjusted: -8.1230 | relevance: 1.0000

### 27. src/app/api/learner/lesson-history/route.js (fd1937ffd513cfdcd8c204297d056e1d4b876af7f6a90ff015155c1bac2dfd24)
- bm25: -4.2302 | entity_overlap_w: 1.00 | adjusted: -4.4802 | relevance: 1.0000

if (sessionError) {
      return NextResponse.json({ error: 'Failed to load lesson sessions' }, { status: 500 })
    }

const sessions = Array.isArray(sessionRows)
      ? sessionRows.map((row) => {
          const startedAt = row?.started_at || null
          const endedAt = row?.ended_at || null
          let durationSeconds = null
          if (startedAt && endedAt) {
            const start = new Date(startedAt)
            const end = new Date(endedAt)
            const diff = Math.max(0, end.getTime() - start.getTime())
            durationSeconds = Math.round(diff / 1000)
          }
          return {
            id: row?.id || null,
            learner_id: row?.learner_id || null,
            lesson_id: row?.lesson_id || null,
            started_at: startedAt,
            ended_at: endedAt,
            status: endedAt ? 'completed' : 'in-progress',
            duration_seconds: durationSeconds
          }
        })
      : []

let events = []
    try {
      let eventsQueryBase = () => {
        let q = supabase
          .from('lesson_session_events')
          .select('id, session_id, lesson_id, event_type, occurred_at, metadata')
          .eq('learner_id', learnerId)

if (fromIso) q = q.gte('occurred_at', fromIso)
        if (toExclusiveIso) q = q.lt('occurred_at', toExclusiveIso)

return q.order('occurred_at', { ascending: false })
      }

### 28. src/app/facilitator/generator/counselor/CounselorClient.jsx (174b7ff50955eb6cc8e15301c9d45c27764e03725c38994bd8f2f4fed1db44af)
- bm25: -4.2855 | relevance: 1.0000

### 29. sidekick_pack_lessons_prefetch.md (b34f3066b625795936e9e732c5c3e4d708e949e9a1e1ff5e4d51726401ea7f21)
- bm25: -6.8112 | entity_overlap_w: 5.00 | adjusted: -8.0612 | relevance: 1.0000

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

### 30. sidekick_pack_planned_all.md (20b1ecbe2d8aede35d69d0fc7b8c69ee6d260fe72a83f9545a6e4831fa3d8f80)
- bm25: -8.0139 | relevance: 1.0000

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
        // Match the main facilitator calendar page:
        // - Primary fetch (facilitator-scoped + safe legacy null facilitator_id rows)
        // - Secondary includeAll=1 fetch to pick up older/legacy rows that may live under other facilitator namespaces
        const [primaryRes, allRes] = await Promise.all([
          fetch(`/api/lesson-schedule?learnerId=${targetLearnerId}`, {
            headers: {
              'authorization': `Bearer ${token}`
            },
            cache: 'no-store',
            signal: controller.signal
          }),
          fetch(`/api/lesson-schedule?learnerId=${targetLearnerId}&includeAll=1`, {
            headers: {
              'authorization': `Bearer ${token}`
            },
            cache: 'no-store',
            signal: controller.signal
          })
        ])

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

### 32. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (30e216f4b5590298bcf5722da0c9ddfbc88a8285661c898b4e03326734439f87)
- bm25: -7.4610 | relevance: 1.0000

if (historyRes.ok) {
        const history = await historyRes.json()
        const sessions = Array.isArray(history?.sessions) ? history.sessions : []
        if (sessions.length > 0) {
          contextText += '\n\nLearner lesson history (scores guide Review vs new topics):\n'
          sessions
            .slice()
            .sort((a, b) => new Date(a.started_at || a.ended_at || 0) - new Date(b.started_at || b.ended_at || 0))
            .slice(-60)
            .forEach((s) => {
              const status = s.status || 'unknown'
              const name = s.lesson_id || 'unknown'
              const bestPercent = status === 'completed' ? medals?.[name]?.bestPercent : null
              if (status === 'completed' && Number.isFinite(bestPercent)) {
                if (bestPercent <= LOW_SCORE_REVIEW_THRESHOLD) lowScoreNames.add(name)
                if (bestPercent >= HIGH_SCORE_AVOID_REPEAT_THRESHOLD) highScoreNames.add(name)
                contextText += `- ${name} (${status}, score: ${bestPercent}%)\n`
              } else {
                contextText += `- ${name} (${status})\n`
              }
            })
        }
      }

### 33. sidekick_pack_mentor_route.md (c9e6972b2c0e082b4b1b4664645d942604554927adef69ceb960ed1986a3796a)
- bm25: -7.1340 | entity_overlap_w: 1.00 | adjusted: -7.3840 | relevance: 1.0000

if (!existingIncomplete) {
        try {
          const { data: insertedEvent, error: insertError } = await supabase
            .from('lesson_session_events')
            .insert({
              session_id: session.id,
              learner_id: learnerId,
              lesson_id: session.lesson_id,
              event_type: 'incomplete',
              occurred_at: incompleteAtIso,
              metadata: {
                reason: 'auto-marked-stale',
                minutes_since_activity: Math.round((nowMs - latestActivityMs) / 60000),
              },
            })
            .select('id, session_id, lesson_id, event_type, occurred_at, metadata')
            .single()

### 21. src/app/api/mentor-session/route.js (a35cf334171c13312e31e3a837acf94d5ed0fc2b2b550c703de719e2385bfa99)
- bm25: -12.1950 | entity_overlap_w: 2.00 | adjusted: -12.6950 | relevance: 1.0000

} catch (err) {
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH: Update session (conversation history, draft summary, last activity)
export async function PATCH(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return Response.json({ error: 'Invalid token' }, { status: 401 })
    }

const access = await requireMrMentorAccess(user.id)
    if (!access.allowed) {
      return Response.json({ error: 'Pro plan required' }, { status: 403 })
    }

### 34. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (2a938234217ddc4bbe3fa752d0674cb474afe0e962d03962810e28b81a1eee8a)
- bm25: -6.5948 | entity_overlap_w: 3.00 | adjusted: -7.3448 | relevance: 1.0000

const okFull = !!(historyRes && historyRes.ok)
          if (!okFull) {
            try {
              const smallerFrom = addDaysToDateStr(todayStr, -180) || historyFrom
              historyAttempt = 'recent'
              devWarn(`schedule: history retry attempt=${historyAttempt} from=${smallerFrom} to=${todayStr}`)
              ;({ res: historyRes, json: historyJson } = await fetchHistoryJson(
                `/api/learner/lesson-history?learner_id=${targetLearnerId}&from=${encodeURIComponent(smallerFrom)}&to=${encodeURIComponent(todayStr)}`
              ))
            } catch (err) {
              if (String(err?.name || '') === 'AbortError') throw err
            }
          }

const okRecent = !!(historyRes && historyRes.ok)
          if (!okRecent) {
            try {
              // Last resort: unwindowed fetch is bounded by the API (fast) and often enough to catch recent 2026 activity.
              historyAttempt = 'bounded'
              devWarn(`schedule: history retry attempt=${historyAttempt} (no window)`)
              ;({ res: historyRes, json: historyJson } = await fetchHistoryJson(
                `/api/learner/lesson-history?learner_id=${targetLearnerId}`
              ))
            } catch (err) {
              if (String(err?.name || '') === 'AbortError') throw err
            }
          }
        
          devWarn(
            `schedule: history response ms=${Date.now() - startedAtMs} attempt=${historyAttempt} ` +
            `status=${String(historyRes?.status)} ok=${String(historyRes?.ok)}`
          )
          clearTimeout(historyTimeoutId)

### 35. sidekick_pack_calendar.md (5664748c8577fd0132da3c25664f52295fd4045d681f2dc40fb2b982e6013bfb)
- bm25: -7.0403 | entity_overlap_w: 1.00 | adjusted: -7.2903 | relevance: 1.0000

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

### 23. src/app/facilitator/calendar/page.js (45a3f960320e40cd0f5d44fbd1557244327369796a5b24116ee137e4fc1a97a6)
- bm25: -3.0747 | relevance: 1.0000

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

### 36. sidekick_pack_planned_all.md (6674f39b1a48416b009443ca2cf88e758108c2e528bc2acccb1cd9fa3f4d0107)
- bm25: -6.5029 | entity_overlap_w: 3.00 | adjusted: -7.2529 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Implement includeAll=1 for /api/planned-lessons similar to /api/lesson-schedule and update CalendarOverlay to fetch planned lessons with includeAll to surface legacy 2026 planned data without wiping 2025.
```

Filter terms used:
```text
/api/lesson-schedule
/api/planned-lessons
CalendarOverlay
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

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

### 37. sidekick_pack_completions_mismatch.md (bc991b8929993ad75a3a017ee392fba0144e8741fb40d9c1454a3a8501cf4726)
- bm25: -6.4093 | entity_overlap_w: 3.00 | adjusted: -7.1593 | relevance: 1.0000

const okFull = !!(historyRes && historyRes.ok)
          if (!okFull) {
            try {
              const smallerFrom = addDaysToDateStr(todayStr, -180) || historyFrom
              historyAttempt = 'recent'
              devWarn(`schedule: history retry attempt=${historyAttempt} from=${smallerFrom} to=${todayStr}`)
              ;({ res: historyRes, json: historyJson } = await fetchHistoryJson(
                `/api/learner/lesson-history?learner_id=${targetLearnerId}&from=${encodeURIComponent(smallerFrom)}&to=${encodeURIComponent(todayStr)}`
              ))
            } catch (err) {
              if (String(err?.name || '') === 'AbortError') throw err
            }
          }

const okRecent = !!(historyRes && historyRes.ok)
          if (!okRecent) {
            try {
              // Last resort: unwindowed fetch is bounded by the API (fast) and often enough to catch recent 2026 activity.
              historyAttempt = 'bounded'
              devWarn(`schedule: history retry attempt=${historyAttempt} (no window)`)
              ;({ res: historyRes, json: historyJson } = await fetchHistoryJson(
                `/api/learner/lesson-history?learner_id=${targetLearnerId}`
              ))
            } catch (err) {
              if (String(err?.name || '') === 'AbortError') throw err
            }
          }
        
          devWarn(
            `schedule: history response ms=${Date.now() - startedAtMs} attempt=${historyAttempt} ` +
            `status=${String(historyRes?.status)} ok=${String(historyRes?.ok)}`
          )
          clearTimeout(historyTimeoutId)

### 7. sidekick_pack_planned_all.md (4eccd72e9e830a67d41e2c664cc187b253d6f8de3b4d4434938e2983b422175b)
- bm25: -0.4320 | entity_overlap_w: 1.30 | adjusted: -0.7570 | relevance: 1.0000

### 38. src/app/api/lesson-schedule/route.js (a4a66f7a325a73d6a8b19846f515a5433ea46cb37ffe423379030e0dd63353c6)
- bm25: -6.3392 | entity_overlap_w: 2.00 | adjusted: -6.8392 | relevance: 1.0000

// Get active lessons for today (used by learner view)
    if (action === 'active' && learnerId) {
      // Use local date, not UTC
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const today = `${year}-${month}-${day}`
      
      const { data, error } = await adminSupabase
        .from('lesson_schedule')
        .select('lesson_key')
        .eq('learner_id', learnerId)
        .eq('scheduled_date', today)

if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

const lessons = (data || []).map(item => ({
        ...item,
        lesson_key: normalizeLessonKey(item.lesson_key)
      }))

return NextResponse.json({ lessons })
    }

// Get schedule for date range
    if (!learnerId) {
      return NextResponse.json({ error: 'learnerId required' }, { status: 400 })
    }

// Verify the learner belongs to this facilitator.
    // (GET previously relied only on facilitator_id filtering, which can hide legacy schedule rows.)
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

let query = adminSupabase
      .from('lesson_schedule')
      .select('*')
      .eq('learner_id', learnerId)
      .order('scheduled_date', { ascending: true })

### 39. sidekick_pack_completions_mismatch.md (08f9fe6f42d50d6217717954e743020ebe9b347867f94b73b52623c82b526c06)
- bm25: -6.2367 | entity_overlap_w: 2.00 | adjusted: -6.7367 | relevance: 1.0000

### 19. sidekick_pack_planned_all.md (6674f39b1a48416b009443ca2cf88e758108c2e528bc2acccb1cd9fa3f4d0107)
- bm25: -0.4783 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Implement includeAll=1 for /api/planned-lessons similar to /api/lesson-schedule and update CalendarOverlay to fetch planned lessons with includeAll to surface legacy 2026 planned data without wiping 2025.
```

Filter terms used:
```text
/api/lesson-schedule
/api/planned-lessons
CalendarOverlay
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

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

### 40. sidekick_pack_planned_all.md (4eccd72e9e830a67d41e2c664cc187b253d6f8de3b4d4434938e2983b422175b)
- bm25: -6.2187 | entity_overlap_w: 1.50 | adjusted: -6.5937 | relevance: 1.0000

const okRecent = !!(historyRes && historyRes.ok)
          if (!okRecent) {
            try {
              // Last resort: unwindowed fetch is bounded by the API (fast) and often enough to catch recent 2026 activity.
              historyAttempt = 'bounded'
              devWarn(`schedule: history retry attempt=${historyAttempt} (no window)`)
              ;({ res: historyRes, json: historyJson } = await fetchHistoryJson(
                `/api/learner/lesson-history?learner_id=${targetLearnerId}`
              ))
            } catch (err) {
              if (String(err?.name || '') === 'AbortError') throw err
            }
          }
        
          devWarn(
            `schedule: history response ms=${Date.now() - startedAtMs} attempt=${historyAttempt} ` +
            `status=${String(historyRes?.status)} ok=${String(historyRes?.ok)}`
          )
          clearTimeout(historyTimeoutId)
