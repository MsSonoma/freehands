'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier } from '@/app/lib/entitlements'
import { getMedalsForLearner, emojiForTier } from '@/app/lib/medalsClient'
import { ensurePinAllowed } from '@/app/lib/pinGate'

export default function FacilitatorLessonsPage() {
  const router = useRouter()
  const [pinChecked, setPinChecked] = useState(false)
  const [tier, setTier] = useState('free')
  const [learners, setLearners] = useState([])
  const [selectedLearnerId, setSelectedLearnerId] = useState(null)
  const [allLessons, setAllLessons] = useState({}) // { subject: [lessons] }
  const [approvedLessons, setApprovedLessons] = useState({}) // { 'subject/lesson_file': true }
  const [medals, setMedals] = useState({}) // { lesson_key: { bestPercent, medalTier } }
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedSubjects, setExpandedSubjects] = useState({}) // { subject: true/false }
  const [gradeFilters, setGradeFilters] = useState({}) // { subject: 'K' | '1' | '2' | ... | 'all' }

  const subjects = ['math', 'science', 'language arts', 'social studies', 'facilitator']
  const grades = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

  // Check PIN requirement on mount
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

  useEffect(() => {
    if (!pinChecked) return
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const { data } = await supabase.from('profiles').select('plan_tier').eq('id', session.user.id).maybeSingle()
          if (!cancelled && data?.plan_tier) setTier((data.plan_tier || 'free').toLowerCase())
          
          // Fetch learners
          const { data: learnersData } = await supabase.from('learners').select('*').order('created_at', { ascending: false })
          if (!cancelled && learnersData) {
            setLearners(learnersData)
            if (learnersData.length > 0) {
              // Try to get active learner from localStorage first
              let defaultLearnerId = null
              try {
                const activeLearnerId = localStorage.getItem('learner_id')
                if (activeLearnerId && learnersData.some(l => l.id === activeLearnerId)) {
                  defaultLearnerId = activeLearnerId
                }
              } catch {}
              
              // Fall back to first learner if no active learner found
              setSelectedLearnerId(defaultLearnerId || learnersData[0].id)
            }
          }
        }
      } catch {}
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [pinChecked])

  // Load all lessons from all subjects
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const lessonsMap = {}
      for (const subject of subjects) {
        try {
          console.log(`[FRONTEND] Fetching lessons for subject: ${subject}`);
          const headers = subject === 'facilitator' && token ? { Authorization: `Bearer ${token}` } : {};
          const res = await fetch(`/api/lessons/${encodeURIComponent(subject)}`, { 
            cache: 'no-store',
            headers
          })
          console.log(`[FRONTEND] Response for ${subject}:`, res.status, res.ok);
          const list = res.ok ? await res.json() : []
          console.log(`[FRONTEND] Lessons for ${subject}:`, list.length);
          lessonsMap[subject] = Array.isArray(list) ? list : []
        } catch (err) {
          console.error(`[FRONTEND] Error fetching ${subject}:`, err);
          lessonsMap[subject] = []
        }
      }
      console.log('[FRONTEND] All lessons loaded:', lessonsMap);
      if (!cancelled) setAllLessons(lessonsMap)
    })()
    return () => { cancelled = true }
  }, []) // No dependency - fetch once on mount

  // Load approved lessons for selected learner and set grade filters to learner's grade
  useEffect(() => {
    if (!selectedLearnerId) {
      setApprovedLessons({})
      setGradeFilters({})
      setMedals({})
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const { data } = await supabase.from('learners').select('approved_lessons, grade').eq('id', selectedLearnerId).maybeSingle()
        if (!cancelled) {
          setApprovedLessons(data?.approved_lessons || {})
          
          // Set grade filters to learner's grade for all subjects
          if (data?.grade) {
            const learnerGrade = String(data.grade).trim().replace(/(?:st|nd|rd|th)$/i, '').toUpperCase()
            const defaultFilters = {}
            subjects.forEach(subject => {
              defaultFilters[subject] = learnerGrade
            })
            setGradeFilters(defaultFilters)
          } else {
            setGradeFilters({})
          }
        }
        
        // Fetch medals for this learner
        const medalsData = await getMedalsForLearner(selectedLearnerId)
        if (!cancelled) {
          setMedals(medalsData || {})
        }
      } catch {
        setApprovedLessons({})
        setGradeFilters({})
        setMedals({})
      }
    })()
    return () => { cancelled = true }
  }, [selectedLearnerId])

  async function toggleApproval(subject, lessonFile) {
    if (!selectedLearnerId) return
    const lessonKey = `${subject}/${lessonFile}`
    const newApproved = { ...approvedLessons }
    
    if (newApproved[lessonKey]) {
      delete newApproved[lessonKey]
    } else {
      newApproved[lessonKey] = true
    }
    
    setApprovedLessons(newApproved)
    setSaving(true)
    
    try {
      const supabase = getSupabaseClient()
      await supabase.from('learners').update({ approved_lessons: newApproved }).eq('id', selectedLearnerId)
    } catch (e) {
      alert('Failed to save: ' + (e?.message || 'Unknown error'))
      // Revert on error
      setApprovedLessons(approvedLessons)
    } finally {
      setSaving(false)
    }
  }

  function toggleSubject(subject) {
    setExpandedSubjects(prev => ({
      ...prev,
      [subject]: !prev[subject]
    }))
  }

  function setGradeFilter(subject, grade) {
    setGradeFilters(prev => ({
      ...prev,
      [subject]: grade
    }))
  }

  function filterLessonsByGrade(lessons, subject) {
    const selectedGrade = gradeFilters[subject]
    if (!selectedGrade || selectedGrade === 'all') return lessons
    return lessons.filter(lesson => {
      if (!lesson.grade) return false
      // Normalize lesson grade: "4th" -> "4", "K" -> "K", "10th" -> "10"
      const lessonGrade = String(lesson.grade).trim().replace(/(?:st|nd|rd|th)$/i, '').toUpperCase()
      return lessonGrade === selectedGrade
    })
  }

  const ent = featuresForTier(tier)
  const card = { border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#fff', marginBottom: 8 }
  const accordionHeader = { 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    padding: '12px 16px', 
    border: '1px solid #e5e7eb', 
    borderRadius: 8, 
    background: '#f9fafb',
    cursor: 'pointer',
    marginBottom: 8,
    userSelect: 'none'
  }
  const accordionContent = {
    marginBottom: 16,
    paddingLeft: 8
  }

  if (loading) {
    return (
      <main style={{ padding: '12px 24px' }}>
        <h1>Lessons</h1>
        <p>Loading...</p>
      </main>
    )
  }

  if (!ent.facilitatorTools) {
    return (
      <main style={{ padding: '12px 24px' }}>
        <h1>Lessons</h1>
        <p style={{ color: '#555' }}>Upgrade to Premium to manage approved lessons for learners.</p>
        <a href="/facilitator/plan">View plans</a>
      </main>
    )
  }

  if (!pinChecked) {
    return <main style={{ padding: '12px 24px' }}><p>Loading…</p></main>
  }

  if (loading) {
    return (
      <main style={{ padding: '12px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ marginBottom: 16 }}>Manage Approved Lessons</h1>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: 12 }}>
          <div style={{ width: 48, height: 48, border: '4px solid #e5e7eb', borderTop: '4px solid #111', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ color: '#6b7280' }}>Loading lessons...</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </main>
    )
  }

  return (
    <main style={{ padding: '12px 24px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 16 }}>Manage Approved Lessons</h1>
      
      {learners.length === 0 ? (
        <div>
          <p>No learners found. <a href="/facilitator/learners/add">Add a learner</a> first.</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 24 }}>
            <label htmlFor="learner-select" style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
              Select Learner:
            </label>
            <select
              id="learner-select"
              value={selectedLearnerId || ''}
              onChange={(e) => setSelectedLearnerId(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                fontSize: 16,
                width: '100%',
                maxWidth: 400
              }}
            >
              {learners.map(learner => (
                <option key={learner.id} value={learner.id}>
                  {learner.name} {learner.grade ? `(Grade ${learner.grade})` : ''}
                </option>
              ))}
            </select>
          </div>

          {saving && <p style={{ color: '#555' }}>Saving...</p>}

          {subjects.map(subject => {
            const lessons = allLessons[subject] || []
            // For facilitator lessons, only show approved ones
            const displayLessons = subject === 'facilitator' 
              ? lessons.filter(l => l.approved === true)
              : lessons
            const filteredLessons = filterLessonsByGrade(displayLessons, subject)
            const displaySubject = subject === 'facilitator' ? 'Facilitator Lessons' : 
                                   subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
            
            // Always show facilitator subject even when empty; hide others if empty
            if (displayLessons.length === 0 && subject !== 'facilitator') return null

            const isExpanded = expandedSubjects[subject]
            const approvedCount = filteredLessons.filter(l => approvedLessons[`${subject}/${l.file}`]).length
            const selectedGrade = gradeFilters[subject] || 'all'

            return (
              <div key={subject}>
                <div 
                  style={accordionHeader}
                  onClick={(e) => {
                    // Don't toggle if clicking on the dropdown
                    if (e.target.tagName === 'SELECT') return
                    toggleSubject(subject)
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 600 }}>
                      {isExpanded ? '▼' : '▶'}
                    </span>
                    <span style={{ fontSize: 18, fontWeight: 600 }}>
                      {displaySubject}
                    </span>
                    <span style={{ 
                      fontSize: 14, 
                      color: '#6b7280',
                      background: '#e5e7eb',
                      padding: '2px 8px',
                      borderRadius: 12
                    }}>
                      {approvedCount}/{filteredLessons.length}
                    </span>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <select
                      value={selectedGrade}
                      onChange={(e) => setGradeFilter(subject, e.target.value)}
                      style={{
                        padding: '4px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                        fontSize: 14,
                        background: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="all">All Grades</option>
                      {grades.map(grade => (
                        <option key={grade} value={grade}>Grade {grade}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {isExpanded && (
                  <div style={accordionContent}>
                    {filteredLessons.length === 0 ? (
                      <p style={{ color: '#6b7280', padding: '12px', textAlign: 'center' }}>
                        {subject === 'facilitator' && selectedGrade === 'all' 
                          ? 'No generated lessons yet. Use the Lesson Maker to create custom lessons.'
                          : `No lessons found for Grade ${selectedGrade}`}
                      </p>
                    ) : subject === 'facilitator' ? (
                      // For facilitator lessons, group by subject
                      (() => {
                        const grouped = {}
                        filteredLessons.forEach(lesson => {
                          const subj = lesson.subject || 'other'
                          if (!grouped[subj]) grouped[subj] = []
                          grouped[subj].push(lesson)
                        })
                        
                        return Object.keys(grouped).sort().map(subj => (
                          <div key={subj} style={{ marginBottom: 24 }}>
                            <h3 style={{ 
                              fontSize: 16, 
                              fontWeight: 600, 
                              marginBottom: 8, 
                              color: '#374151',
                              textTransform: 'capitalize',
                              paddingLeft: 8
                            }}>
                              {subj === 'language arts' ? 'Language Arts' : subj === 'social studies' ? 'Social Studies' : subj.charAt(0).toUpperCase() + subj.slice(1)}
                            </h3>
                            {grouped[subj].map(lesson => {
                              const lessonKey = `${subject}/${lesson.file}`
                              const isApproved = !!approvedLessons[lessonKey]
                              const medalInfo = medals[lessonKey]
                              const hasCompleted = medalInfo && medalInfo.bestPercent > 0
                              const medalEmoji = medalInfo?.medalTier ? emojiForTier(medalInfo.medalTier) : null
                              
                              return (
                                <div key={lesson.file} style={card}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <input
                                      type="checkbox"
                                      checked={isApproved}
                                      onChange={() => toggleApproval(subject, lesson.file)}
                                      id={`lesson-${lessonKey}`}
                                      className="brand-checkbox"
                                    />
                                    <label
                                      htmlFor={`lesson-${lessonKey}`}
                                      style={{ flex: 1, cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontWeight: 600 }}>{lesson.title}</span>
                                        {hasCompleted && (
                                          <span style={{ 
                                            fontSize: 12, 
                                            background: '#dcfce7', 
                                            color: '#166534',
                                            padding: '2px 6px',
                                            borderRadius: 4,
                                            fontWeight: 600
                                          }}>
                                            ✓ Completed
                                          </span>
                                        )}
                                        {medalEmoji && (
                                          <span style={{ fontSize: 20 }} title={`${medalInfo.medalTier} medal - ${medalInfo.bestPercent}%`}>
                                            {medalEmoji}
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ fontSize: 14, color: '#6b7280' }}>
                                        {lesson.grade && `Grade ${lesson.grade}`}
                                        {lesson.grade && lesson.difficulty && ' · '}
                                        {lesson.difficulty && lesson.difficulty.charAt(0).toUpperCase() + lesson.difficulty.slice(1)}
                                        {hasCompleted && medalInfo.bestPercent && (
                                          <span style={{ marginLeft: 8, color: '#059669' }}>
                                            · Best: {medalInfo.bestPercent}%
                                          </span>
                                        )}
                                      </div>
                                      {lesson.blurb && (
                                        <div style={{ fontSize: 14, color: '#9ca3af', marginTop: 4 }}>
                                          {lesson.blurb}
                                        </div>
                                      )}
                                    </label>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ))
                      })()
                    ) : (
                      // For other subjects, render normally
                      filteredLessons.map(lesson => {
                        const lessonKey = `${subject}/${lesson.file}`
                        const isApproved = !!approvedLessons[lessonKey]
                        const medalInfo = medals[lessonKey]
                        const hasCompleted = medalInfo && medalInfo.bestPercent > 0
                        const medalEmoji = medalInfo?.medalTier ? emojiForTier(medalInfo.medalTier) : null
                        
                        return (
                          <div key={lesson.file} style={card}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <input
                                type="checkbox"
                                checked={isApproved}
                                onChange={() => toggleApproval(subject, lesson.file)}
                                id={`lesson-${lessonKey}`}
                                className="brand-checkbox"
                              />
                              <label
                                htmlFor={`lesson-${lessonKey}`}
                                style={{ flex: 1, cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontWeight: 600 }}>{lesson.title}</span>
                                  {hasCompleted && (
                                    <span style={{ 
                                      fontSize: 12, 
                                      background: '#dcfce7', 
                                      color: '#166534',
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      fontWeight: 600
                                    }}>
                                      ✓ Completed
                                    </span>
                                  )}
                                  {medalEmoji && (
                                    <span style={{ fontSize: 20 }} title={`${medalInfo.medalTier} medal - ${medalInfo.bestPercent}%`}>
                                      {medalEmoji}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 14, color: '#6b7280' }}>
                                  {lesson.grade && `Grade ${lesson.grade}`}
                                  {lesson.grade && lesson.difficulty && ' · '}
                                  {lesson.difficulty && lesson.difficulty.charAt(0).toUpperCase() + lesson.difficulty.slice(1)}
                                  {hasCompleted && medalInfo.bestPercent && (
                                    <span style={{ marginLeft: 8, color: '#059669' }}>
                                      · Best: {medalInfo.bestPercent}%
                                    </span>
                                  )}
                                </div>
                                {lesson.blurb && (
                                  <div style={{ fontSize: 14, color: '#9ca3af', marginTop: 4 }}>
                                    {lesson.blurb}
                                  </div>
                                )}
                              </label>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </main>
  )
}
