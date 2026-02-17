'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getMedalsForLearner, emojiForTier } from '@/app/lib/medalsClient'
import { CORE_SUBJECTS, sortSubjectsForDropdown } from '@/app/lib/subjects'

export default function AwardsPage() {
  const router = useRouter()
  const [learnerName, setLearnerName] = useState(null)
  const [learnerId, setLearnerId] = useState(null)
  const [medals, setMedals] = useState({})
  const [allLessons, setAllLessons] = useState({})
  const [medalsLoading, setMedalsLoading] = useState(true)
  const [lessonsLoading, setLessonsLoading] = useState(true)
  const [customSubjects, setCustomSubjects] = useState([])
  const [customSubjectsLoading, setCustomSubjectsLoading] = useState(true)

  const normalizeSubjectKey = (value) => {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
  }

  const customSubjectNames = (customSubjects || [])
    .map((s) => s?.name)
    .filter(Boolean)

  // Fetch subjects includes generated so we can infer subject buckets for facilitator-created lessons.
  // Include custom subjects so Awards can resolve titles/blurbs where available.
  const subjectsToFetch = [
    ...CORE_SUBJECTS,
    ...customSubjectNames,
    'generated',
  ]

  useEffect(() => {
    try {
      const id = localStorage.getItem('learner_id')
      const name = localStorage.getItem('learner_name')
      if (name) setLearnerName(name)
      if (id) setLearnerId(id)
    } catch {}
  }, [])

  useEffect(() => {
    if (!learnerId) {
      setMedals({})
      setMedalsLoading(false)
      return
    }
    (async () => {
      try {
        const data = await getMedalsForLearner(learnerId)
        setMedals(data || {})
      } catch {
        setMedals({})
      }
      setMedalsLoading(false)
    })()
  }, [learnerId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setCustomSubjectsLoading(true)
      try {
        const { getSupabaseClient } = await import('@/app/lib/supabaseClient')
        const supabase = getSupabaseClient()
        if (!supabase) {
          if (!cancelled) setCustomSubjects([])
          return
        }
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) {
          if (!cancelled) setCustomSubjects([])
          return
        }

        const res = await fetch('/api/custom-subjects', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        })
        if (!res.ok) {
          if (!cancelled) setCustomSubjects([])
          return
        }
        const data = await res.json().catch(() => null)
        const subjects = Array.isArray(data?.subjects) ? data.subjects : []
        if (!cancelled) setCustomSubjects(subjects)
      } catch {
        if (!cancelled) setCustomSubjects([])
      } finally {
        if (!cancelled) setCustomSubjectsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Get auth token for facilitator lessons
      let token = null
      try {
        const { getSupabaseClient } = await import('@/app/lib/supabaseClient')
        const supabase = getSupabaseClient()
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession()
          token = session?.access_token || null
        }
      } catch {}

      const lessonsMap = {}
      for (const subject of subjectsToFetch) {
        try {
          const subjectKey = normalizeSubjectKey(subject)
          const headers = subject === 'generated' && token 
            ? { 'Authorization': `Bearer ${token}` }
            : {}
          const res = await fetch(`/api/lessons/${encodeURIComponent(subject)}`, { 
            cache: 'no-store',
            headers
          })
          const list = res.ok ? await res.json() : []
          lessonsMap[subjectKey] = Array.isArray(list) ? list : []
        } catch {
          lessonsMap[normalizeSubjectKey(subject)] = []
        }
      }
      if (!cancelled) {
        setAllLessons(lessonsMap)
        setLessonsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [customSubjectNames.join('|')])

  const medalsBySubject = () => {
    const normalizeSubject = (raw) => {
      const s = String(raw || '').trim().toLowerCase()
      if (!s) return null
      if (s === 'language-arts' || s === 'language arts') return 'language arts'
      if (s === 'social-studies' || s === 'social studies') return 'social studies'
      if (s === 'facilitator' || s === 'facilitator-lessons' || s === 'facilitator lessons') return 'generated'
      return s.replace(/\s+/g, ' ')
    }

    const ensureJsonFile = (file) => {
      const f = String(file || '').trim()
      if (!f) return f
      return f.toLowerCase().endsWith('.json') ? f : `${f}.json`
    }

    const coreSubjects = CORE_SUBJECTS

    const grouped = {}
    
    Object.entries(medals).forEach(([lessonKey, medalData]) => {
      if (!medalData.medalTier) return // Only show lessons with medals
      
      const parts = String(lessonKey || '').split('/')
      const subjectRaw = parts[0]
      const fileRaw = parts.slice(1).join('/')
      if (!subjectRaw || !fileRaw) return

      const file = ensureJsonFile(fileRaw)
      const subjectKey = normalizeSubject(subjectRaw)

      // Determine which subject bucket this medal belongs to.
      // For facilitator-generated lessons, infer from the generated lesson's metadata subject.
      let bucket = subjectKey

      const generatedList = allLessons.generated || []
      const generatedLesson = generatedList.find(l => (ensureJsonFile(l?.file) === file)) || null
      const generatedSubject = normalizeSubject(generatedLesson?.subject)

      if (!bucket || bucket === 'generated') {
        // Allow generated lessons to bucket into core OR custom subjects.
        if (generatedSubject) {
          bucket = generatedSubject
        }
      }

      if (!bucket || bucket === 'generated') {
        // If the lesson exists in any known subject folder, prefer that.
        const knownSubjects = Object.keys(allLessons || {})
        const foundInKnown = knownSubjects.find((s) => {
          const list = allLessons[s] || []
          return list.some((l) => ensureJsonFile(l?.file) === file)
        })
        if (foundInKnown) bucket = foundInKnown
      }

      if (!bucket || bucket === 'generated') {
        // Last resort: keep under general (never show "Facilitator" as a subject).
        bucket = 'general'
      }
      
      // Find best lesson metadata to display.
      const bucketLessons = allLessons[bucket] || []
      const bucketLesson = bucketLessons.find(l => ensureJsonFile(l?.file) === file) || null
      const lesson = bucketLesson || generatedLesson || null

      const fallbackLesson = {
        title: (file || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || file || 'Lesson',
        blurb: '',
        grade: null,
        difficulty: null,
        subject: bucket,
        file
      }

      if (!grouped[bucket]) grouped[bucket] = []
      grouped[bucket].push({
        ...(lesson || fallbackLesson),
        medalTier: medalData.medalTier,
        bestPercent: medalData.bestPercent ?? 0,
        file
      })
    })
    
    // Sort lessons within each subject by medal tier (gold > silver > bronze)
    const tierOrder = { gold: 3, silver: 2, bronze: 1 }
    Object.keys(grouped).forEach(subject => {
      grouped[subject].sort((a, b) => {
        const tierDiff = tierOrder[b.medalTier] - tierOrder[a.medalTier]
        if (tierDiff !== 0) return tierDiff
        return (a.title || '').localeCompare(b.title || '')
      })
    })
    
    return grouped
  }

  const loading = medalsLoading || lessonsLoading
  const groupedMedals = medalsBySubject()

  const customDisplayOrder = (customSubjects || [])
    .map((s) => ({
      key: normalizeSubjectKey(s?.name),
      name: String(s?.name || '').trim(),
      order: Number(s?.display_order ?? 999),
    }))
    .filter((s) => s.key && s.name)
    .sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  const customKeyToName = new Map(customDisplayOrder.map((s) => [s.key, s.name]))

  const subjectOrder = CORE_SUBJECTS
  const customOrderedKeys = customDisplayOrder.map((s) => s.key)

  const baseOrdered = [
    ...subjectOrder,
    ...customOrderedKeys,
  ]

  const subjectsToRender = [
    ...baseOrdered.filter((s) => Array.isArray(groupedMedals[s]) && groupedMedals[s].length > 0),
    ...Object.keys(groupedMedals)
      .filter((s) => !baseOrdered.includes(s))
      .sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }))
  ]
  const hasMedals = Object.keys(groupedMedals).length > 0
  const totalMedals = Object.values(groupedMedals).reduce((sum, arr) => sum + arr.length, 0)

  // Count medals by tier
  const medalCounts = { gold: 0, silver: 0, bronze: 0 }
  Object.values(groupedMedals).forEach(lessons => {
    lessons.forEach(lesson => {
      if (lesson.medalTier) medalCounts[lesson.medalTier]++
    })
  })

  const card = { 
    border: '1px solid #e5e7eb', 
    borderRadius: 12, 
    padding: 14, 
    background: '#fff',
    marginBottom: 8
  }

  const subjectHeading = { 
    margin: '24px 0 12px', 
    fontSize: 18, 
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 8
  }

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: '0 auto', minHeight: 'calc(100dvh - 56px)' }}>
      <h1 style={{ margin: '8px 0 4px', textAlign: 'center' }}>
        🏆 Awards
      </h1>
      
      {learnerName && (
        <div style={{ textAlign: 'center', marginBottom: 16, fontSize: 16, color: '#666' }}>
          Earned by <strong style={{ color: '#111' }}>{learnerName}</strong>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: 12, marginTop: 32 }}>
          <div style={{ 
            width: 48, 
            height: 48, 
            border: '4px solid #e5e7eb', 
            borderTop: '4px solid #111', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite' 
          }}></div>
          <p style={{ textAlign:'center', color: '#6b7280', fontSize: 16 }}>Loading awards...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : !hasMedals ? (
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <p style={{ fontSize: 48 }}>🎯</p>
          <p style={{ color: '#6b7280', fontSize: 18 }}>No medals earned yet!</p>
          <p style={{ color: '#9ca3af', fontSize: 14 }}>
            Complete lessons to earn bronze (70%+), silver (80%+), or gold (90%+) medals.
          </p>
        </div>
      ) : (
        <>
          <div style={{ 
            textAlign: 'center', 
            marginBottom: 24, 
            padding: 16, 
            background: '#f9fafb', 
            borderRadius: 12,
            display: 'flex',
            justifyContent: 'center',
            gap: 24,
            flexWrap: 'wrap'
          }}>
            <div>
              <div style={{ fontSize: 32 }}>🥇</div>
              <div style={{ fontWeight: 600, fontSize: 20 }}>{medalCounts.gold}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Gold</div>
            </div>
            <div>
              <div style={{ fontSize: 32 }}>🥈</div>
              <div style={{ fontWeight: 600, fontSize: 20 }}>{medalCounts.silver}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Silver</div>
            </div>
            <div>
              <div style={{ fontSize: 32 }}>🥉</div>
              <div style={{ fontWeight: 600, fontSize: 20 }}>{medalCounts.bronze}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Bronze</div>
            </div>
            <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: 24, marginLeft: 8 }}>
              <div style={{ fontSize: 32 }}>🎖️</div>
              <div style={{ fontWeight: 600, fontSize: 20 }}>{totalMedals}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Total</div>
            </div>
          </div>

          {subjectsToRender.map(subject => {
            const lessons = groupedMedals[subject]
            if (!lessons || lessons.length === 0) return null

            const displaySubject = customKeyToName.get(subject)
              || subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

            return (
              <div key={subject}>
                <h2 style={subjectHeading}>
                  {displaySubject}
                  <span style={{ 
                    fontSize: 14, 
                    fontWeight: 400, 
                    color: '#6b7280',
                    background: '#f3f4f6',
                    padding: '2px 8px',
                    borderRadius: 12
                  }}>
                    {lessons.length} {lessons.length === 1 ? 'medal' : 'medals'}
                  </span>
                </h2>
                
                {lessons.map(lesson => {
                  const medal = emojiForTier(lesson.medalTier)
                  
                  return (
                    <div key={`${subject}-${lesson.file}`} style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>
                            {lesson.title}
                          </h3>
                          {lesson.blurb && (
                            <p style={{ margin: '4px 0', color: '#6b7280', fontSize: 14 }}>
                              {lesson.blurb}
                            </p>
                          )}
                          {(lesson.grade || lesson.difficulty) && (
                            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                              {lesson.grade && `Grade ${lesson.grade}`}
                              {lesson.grade && lesson.difficulty && ' • '}
                              {lesson.difficulty && lesson.difficulty.charAt(0).toUpperCase() + lesson.difficulty.slice(1)}
                            </div>
                          )}
                        </div>
                        <div style={{ 
                          marginLeft: 16, 
                          fontSize: 40,
                          lineHeight: 1
                        }}>
                          {medal}
                        </div>
                      </div>
                      <div style={{ 
                        marginTop: 8, 
                        fontSize: 13, 
                        color: '#059669',
                        fontWeight: 600 
                      }}>
                        Best Score: {lesson.bestPercent}%
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </>
      )}
    </main>
  )
}
