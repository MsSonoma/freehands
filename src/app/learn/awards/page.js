'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getMedalsForLearner, emojiForTier } from '@/app/lib/medalsClient'

export default function AwardsPage() {
  const router = useRouter()
  const [learnerName, setLearnerName] = useState(null)
  const [learnerId, setLearnerId] = useState(null)
  const [medals, setMedals] = useState({})
  const [allLessons, setAllLessons] = useState({})
  const [loading, setLoading] = useState(true)

  const subjects = ['math', 'science', 'language arts', 'social studies', 'facilitator']

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
      setLoading(false)
      return
    }
    (async () => {
      try {
        const data = await getMedalsForLearner(learnerId)
        setMedals(data || {})
      } catch {
        setMedals({})
      }
      setLoading(false)
    })()
  }, [learnerId])

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
      for (const subject of subjects) {
        try {
          const headers = subject === 'facilitator' && token 
            ? { 'Authorization': `Bearer ${token}` }
            : {}
          const res = await fetch(`/api/lessons/${encodeURIComponent(subject)}`, { 
            cache: 'no-store',
            headers
          })
          const list = res.ok ? await res.json() : []
          lessonsMap[subject] = Array.isArray(list) ? list : []
        } catch {
          lessonsMap[subject] = []
        }
      }
      if (!cancelled) setAllLessons(lessonsMap)
    })()
    return () => { cancelled = true }
  }, [])

  const medalsBySubject = () => {
    const grouped = {}
    
    Object.entries(medals).forEach(([lessonKey, medalData]) => {
      if (!medalData.medalTier) return // Only show lessons with medals
      
      const [subject, file] = lessonKey.split('/')
      if (!subject || !file) return
      
      const subjectLessons = allLessons[subject] || []
      const lesson = subjectLessons.find(l => l.file === file)
      
      if (lesson) {
        if (!grouped[subject]) grouped[subject] = []
        grouped[subject].push({
          ...lesson,
          medalTier: medalData.medalTier,
          bestPercent: medalData.bestPercent,
          file
        })
      }
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

  const groupedMedals = medalsBySubject()
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
        <p style={{ textAlign: 'center' }}>Loading awards...</p>
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

          {subjects.map(subject => {
            const lessons = groupedMedals[subject]
            if (!lessons || lessons.length === 0) return null

            const displaySubject = subject === 'facilitator' 
              ? 'Facilitator Lessons' 
              : subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

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
