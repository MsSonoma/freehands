'use client'
import { useState, useEffect } from 'react'

/**
 * LessonEditor - Structured editor for lesson JSON
 * Allows facilitators to edit lessons in a form-based interface while maintaining JSON integrity
 */
export default function LessonEditor({ initialLesson, onSave, onCancel, busy = false, compact = false }) {
  const [lesson, setLesson] = useState(initialLesson || {})
  const [errors, setErrors] = useState([])

  useEffect(() => {
    if (initialLesson) {
      // Normalize the lesson data to ensure consistent field names
      const normalized = normalizeLessonData(initialLesson)
      setLesson(normalized)
    }
  }, [initialLesson])

  // Normalize lesson data to consistent field names
  const normalizeLessonData = (lessonData) => {
    const normalized = JSON.parse(JSON.stringify(lessonData))
    console.log('[LessonEditor] Original lesson data:', lessonData)
    
    // Normalize multiple choice questions
    if (normalized.multiplechoice) {
      normalized.multiplechoice = toArray(normalized.multiplechoice).map(q => ({
        question: q.question || q.q || q.Q || '',
        choices: toArray(q.choices || q.options || q.A || []).map(c => 
          typeof c === 'string' ? c : (c?.text || c?.label || c?.choice || '')
        ),
        correct: q.correct !== undefined ? q.correct : 
                 (q.correctIndex !== undefined ? q.correctIndex : 
                 (q.answerIndex !== undefined ? q.answerIndex : 0))
      }))
    }
    
    // Normalize true/false questions
    if (normalized.truefalse) {
      normalized.truefalse = toArray(normalized.truefalse).map(q => ({
        question: q.question || q.q || q.Q || '',
        answer: q.answer !== undefined ? q.answer : 
                (q.correct !== undefined ? q.correct : true)
      }))
    }
    
    // Normalize short answer questions
    if (normalized.shortanswer) {
      normalized.shortanswer = toArray(normalized.shortanswer).map(q => {
        const answers = q.expectedAny || q.expected || q.answers || q.answer || q.a || q.A
        const answerArray = toArray(answers)
        console.log('[Normalize SA] Question:', q.question, 'Raw answers:', answers, 'Array:', answerArray)
        return {
          question: q.question || q.q || q.Q || '',
          expectedAny: answerArray.length > 0 ? answerArray : ['']
        }
      })
    }
    
    // Normalize fill in blank questions
    if (normalized.fillintheblank || normalized.fillInBlank || normalized.fillIn) {
      const fibKey = normalized.fillintheblank ? 'fillintheblank' : 
                     normalized.fillInBlank ? 'fillInBlank' : 'fillIn'
      const fibData = normalized[fibKey]
      normalized.fillintheblank = toArray(fibData).map(q => {
        const answers = q.expectedAny || q.expected || q.answers || q.answer || q.a || q.A
        const answerArray = toArray(answers)
        return {
          question: q.question || q.q || q.Q || '',
          expectedAny: answerArray.length > 0 ? answerArray : ['']
        }
      })
      // Clean up alternate keys
      if (fibKey !== 'fillintheblank') delete normalized[fibKey]
    }
    
    // Normalize sample Q&A
    if (normalized.sample) {
      normalized.sample = toArray(normalized.sample).map(q => {
        const answers = q.expectedAny || q.expected || q.answers || q.answer || q.sample || q.a || q.A
        const answerArray = toArray(answers)
        return {
          question: q.question || q.q || q.Q || '',
          expectedAny: answerArray.length > 0 ? answerArray : ['']
        }
      })
    }
    
    // Normalize vocabulary
    if (normalized.vocab) {
      normalized.vocab = toArray(normalized.vocab).map(v => {
        if (typeof v === 'string') return { term: v, definition: '' }
        return {
          term: v.term || v.word || v.name || '',
          definition: v.definition || v.def || v.meaning || ''
        }
      })
    }
    
    console.log('[LessonEditor] Normalized lesson data:', normalized)
    return normalized
  }

  // Utility functions
  const toArray = (x) => {
    if (!x) return []
    if (Array.isArray(x)) return x
    return [x]
  }

  const updateField = (path, value) => {
    setLesson(prev => {
      const updated = JSON.parse(JSON.stringify(prev))
      let current = updated
      const keys = path.split('.')
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {}
        current = current[keys[i]]
      }
      current[keys[keys.length - 1]] = value
      return updated
    })
  }

  const updateArrayItem = (arrayPath, index, value) => {
    setLesson(prev => {
      const updated = JSON.parse(JSON.stringify(prev))
      const arr = toArray(updated[arrayPath])
      arr[index] = value
      updated[arrayPath] = arr
      return updated
    })
  }

  const addArrayItem = (arrayPath, defaultItem) => {
    setLesson(prev => {
      const updated = JSON.parse(JSON.stringify(prev))
      const arr = toArray(updated[arrayPath])
      updated[arrayPath] = [...arr, defaultItem]
      return updated
    })
  }

  const removeArrayItem = (arrayPath, index) => {
    setLesson(prev => {
      const updated = JSON.parse(JSON.stringify(prev))
      const arr = toArray(updated[arrayPath])
      updated[arrayPath] = arr.filter((_, i) => i !== index)
      return updated
    })
  }

  const validateLesson = () => {
    const errs = []
    
    // Basic info validation
    if (!lesson.title?.trim()) errs.push('Title is required')
    if (!lesson.grade?.trim()) errs.push('Grade is required')
    if (!lesson.difficulty?.trim()) errs.push('Difficulty is required')
    
    // Vocabulary validation
    const vocab = toArray(lesson.vocab || [])
    vocab.forEach((v, idx) => {
      if (v && !v.term?.trim()) {
        errs.push(`Vocabulary term #${idx + 1} is missing a term name`)
      }
    })
    
    // Multiple choice validation
    const mc = toArray(lesson.multiplechoice || [])
    mc.forEach((q, idx) => {
      if (!q.question?.trim()) {
        errs.push(`Multiple choice question #${idx + 1} is missing question text`)
      }
      if (!q.choices || q.choices.length < 2) {
        errs.push(`Multiple choice question #${idx + 1} needs at least 2 choices`)
      }
      if (q.choices && q.choices.some(c => !c?.trim())) {
        errs.push(`Multiple choice question #${idx + 1} has empty choices`)
      }
      if (q.correct === undefined || q.correct < 0 || q.correct >= (q.choices?.length || 0)) {
        errs.push(`Multiple choice question #${idx + 1} has invalid correct answer index`)
      }
    })
    
    // True/False validation
    const tf = toArray(lesson.truefalse || [])
    tf.forEach((q, idx) => {
      if (!q.question?.trim()) {
        errs.push(`True/False question #${idx + 1} is missing question text`)
      }
      if (q.answer === undefined || q.answer === null) {
        errs.push(`True/False question #${idx + 1} is missing an answer`)
      }
    })
    
    // Short answer validation
    const sa = toArray(lesson.shortanswer || [])
    sa.forEach((q, idx) => {
      if (!q.question?.trim()) {
        errs.push(`Short answer question #${idx + 1} is missing question text`)
      }
      const answers = toArray(q.expectedAny || [])
      if (answers.length === 0 || answers.every(a => !a?.trim())) {
        errs.push(`Short answer question #${idx + 1} needs at least one acceptable answer`)
      }
    })
    
    // Fill in blank validation
    const fib = toArray(lesson.fillintheblank || [])
    fib.forEach((q, idx) => {
      if (!q.question?.trim()) {
        errs.push(`Fill in blank question #${idx + 1} is missing question text`)
      }
      if (!q.question?.includes('_____')) {
        errs.push(`Fill in blank question #${idx + 1} should include _____ for the blank`)
      }
      const answers = toArray(q.expectedAny || [])
      if (answers.length === 0 || answers.every(a => !a?.trim())) {
        errs.push(`Fill in blank question #${idx + 1} needs at least one acceptable answer`)
      }
    })
    
    // Sample Q&A validation
    const sample = toArray(lesson.sample || [])
    sample.forEach((q, idx) => {
      if (!q.question?.trim()) {
        errs.push(`Sample question #${idx + 1} is missing question text`)
      }
    })
    
    setErrors(errs)
    return errs.length === 0
  }

  const cleanLesson = (lessonData) => {
    // Remove empty fields and clean up arrays
    const cleaned = JSON.parse(JSON.stringify(lessonData))
    
    // Clean vocabulary - remove empty terms
    if (cleaned.vocab) {
      cleaned.vocab = toArray(cleaned.vocab).filter(v => v?.term?.trim())
    }
    
    // Clean each question type - remove empty questions
    const questionTypes = [
      'multiplechoice', 'truefalse', 'shortanswer', 
      'fillintheblank', 'sample'
    ]
    
    questionTypes.forEach(type => {
      if (cleaned[type]) {
        cleaned[type] = toArray(cleaned[type]).filter(q => {
          if (!q) return false
          const hasQuestion = (q.question || q.q || '').trim()
          if (!hasQuestion) return false
          
          // For questions with expectedAny, filter out empty answers
          if (q.expectedAny) {
            q.expectedAny = toArray(q.expectedAny).filter(a => a?.trim())
          }
          
          // For multiple choice, filter out empty choices
          if (q.choices) {
            q.choices = toArray(q.choices).filter(c => c?.trim())
          }
          
          return true
        })
        
        // Remove the array if it's empty
        if (cleaned[type].length === 0) {
          delete cleaned[type]
        }
      }
    })
    
    return cleaned
  }

  const handleSave = () => {
    console.log('[LessonEditor] handleSave called')
    console.log('[LessonEditor] Current lesson state:', JSON.stringify(lesson, null, 2).substring(0, 500))
    
    if (!validateLesson()) {
      console.log('[LessonEditor] Validation failed, not saving')
      return
    }
    
    const cleanedLesson = cleanLesson(lesson)
    console.log('[LessonEditor] Cleaned lesson data:', JSON.stringify(cleanedLesson, null, 2).substring(0, 500))
    console.log('[LessonEditor] Calling onSave with cleaned lesson')
    
    onSave(cleanedLesson)
  }

  // Styles - compact mode for overlays
  const sectionStyle = compact 
    ? { marginBottom: 12, padding: 8, border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb' }
    : { marginBottom: 24, padding: 16, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb' }
  const labelStyle = compact
    ? { display: 'block', fontWeight: 600, marginBottom: 2, fontSize: 11 }
    : { display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 14 }
  const inputStyle = compact
    ? { width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 11 }
    : { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }
  const textareaStyle = compact
    ? { ...inputStyle, minHeight: 50, fontFamily: 'inherit' }
    : { ...inputStyle, minHeight: 80, fontFamily: 'inherit' }
  const btnStyle = compact
    ? { padding: '4px 8px', border: '1px solid #111', background: '#111', color: '#fff', borderRadius: 4, fontWeight: 600, fontSize: 10, cursor: 'pointer' }
    : { padding: '6px 10px', border: '1px solid #111', background: '#111', color: '#fff', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }
  const btnSecondaryStyle = { ...btnStyle, background: '#6b7280', borderColor: '#6b7280' }
  const btnDangerStyle = { ...btnStyle, background: '#dc2626', borderColor: '#dc2626' }
  const btnAddStyle = { ...btnStyle, background: '#059669', borderColor: '#059669' }

  return (
    <div style={compact 
      ? { padding: 8, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }
      : { padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }
    }>
      <h2 style={compact 
        ? { marginTop: 0, marginBottom: 12, fontSize: 14 }
        : { marginTop: 0, marginBottom: 20 }
      }>Edit Lesson</h2>

      {errors.length > 0 && (
        <div style={compact
          ? { padding: 8, background: '#fee2e2', border: '1px solid #dc2626', borderRadius: 6, marginBottom: 8, fontSize: 11 }
          : { padding: 12, background: '#fee2e2', border: '1px solid #dc2626', borderRadius: 8, marginBottom: 16 }
        }>
          <strong>Please fix these errors:</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: compact ? 10 : 13 }}>
            {errors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        </div>
      )}

      {/* Basic Info */}
      <div style={sectionStyle}>
        <h3 style={compact 
          ? { marginTop: 0, marginBottom: 8, fontSize: 12 }
          : { marginTop: 0, marginBottom: 12 }
        }>Basic Information</h3>
        
        <label style={labelStyle}>Title *</label>
        <input
          style={inputStyle}
          value={lesson.title || ''}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="Lesson title"
        />

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr 1fr', 
          gap: compact ? 6 : 12, 
          marginTop: compact ? 6 : 12 
        }}>
          <div>
            <label style={labelStyle}>Grade *</label>
            <input
              style={inputStyle}
              value={lesson.grade || ''}
              onChange={(e) => updateField('grade', e.target.value)}
              placeholder="e.g., 4th"
            />
          </div>
          <div>
            <label style={labelStyle}>Difficulty *</label>
            <select
              style={inputStyle}
              value={lesson.difficulty || 'intermediate'}
              onChange={(e) => updateField('difficulty', e.target.value)}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Subject</label>
            <input
              style={inputStyle}
              value={lesson.subject || ''}
              onChange={(e) => updateField('subject', e.target.value)}
              placeholder="e.g., math"
            />
          </div>
        </div>

        <label style={{ ...labelStyle, marginTop: compact ? 6 : 12 }}>Description / Blurb</label>
        <textarea
          style={textareaStyle}
          value={lesson.blurb || ''}
          onChange={(e) => updateField('blurb', e.target.value)}
          placeholder="Brief overview of the lesson"
        />

        <label style={{ ...labelStyle, marginTop: compact ? 6 : 12 }}>Teaching Notes</label>
        <textarea
          style={textareaStyle}
          value={lesson.teachingNotes || ''}
          onChange={(e) => updateField('teachingNotes', e.target.value)}
          placeholder="Notes for the teacher"
        />
      </div>

      {/* Vocabulary */}
      <VocabularyEditor
        vocab={toArray(lesson.vocab || [])}
        onChange={(newVocab) => updateField('vocab', newVocab)}
        styles={{ sectionStyle, labelStyle, inputStyle, btnAddStyle, btnDangerStyle }}
      />

      {/* Multiple Choice Questions */}
      <MultipleChoiceEditor
        questions={toArray(lesson.multiplechoice || [])}
        onChange={(newQuestions) => updateField('multiplechoice', newQuestions)}
        styles={{ sectionStyle, labelStyle, inputStyle, textareaStyle, btnAddStyle, btnDangerStyle }}
      />

      {/* True/False Questions */}
      <TrueFalseEditor
        questions={toArray(lesson.truefalse || [])}
        onChange={(newQuestions) => updateField('truefalse', newQuestions)}
        styles={{ sectionStyle, labelStyle, inputStyle, btnAddStyle, btnDangerStyle }}
      />

      {/* Short Answer Questions */}
      <ShortAnswerEditor
        questions={toArray(lesson.shortanswer || [])}
        onChange={(newQuestions) => updateField('shortanswer', newQuestions)}
        styles={{ sectionStyle, labelStyle, inputStyle, textareaStyle, btnAddStyle, btnDangerStyle }}
      />

      {/* Fill in the Blank */}
      <FillInBlankEditor
        questions={toArray(lesson.fillintheblank || [])}
        onChange={(newQuestions) => updateField('fillintheblank', newQuestions)}
        styles={{ sectionStyle, labelStyle, inputStyle, textareaStyle, btnAddStyle, btnDangerStyle }}
      />

      {/* Sample Q&A */}
      <SampleQAEditor
        questions={toArray(lesson.sample || [])}
        onChange={(newQuestions) => updateField('sample', newQuestions)}
        styles={{ sectionStyle, labelStyle, inputStyle, textareaStyle, btnAddStyle, btnDangerStyle }}
      />

      {/* Action Buttons */}
      <div style={{ 
        marginTop: compact ? 12 : 24, 
        display: 'flex', 
        gap: compact ? 6 : 12, 
        justifyContent: 'flex-end' 
      }}>
        <button style={btnSecondaryStyle} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button style={btnStyle} onClick={handleSave} disabled={busy}>
          {busy ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// Vocabulary Editor Component
function VocabularyEditor({ vocab, onChange, styles }) {
  const addTerm = () => {
    onChange([...vocab, { term: '', definition: '' }])
  }

  const updateTerm = (index, field, value) => {
    const updated = [...vocab]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const removeTerm = (index) => {
    onChange(vocab.filter((_, i) => i !== index))
  }

  return (
    <div style={styles.sectionStyle}>
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Vocabulary Terms</h3>
      {vocab.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 14 }}>No vocabulary terms yet. Add one below.</p>
      ) : (
        vocab.map((item, idx) => (
          <div key={idx} style={{ marginBottom: 12, padding: 12, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff' }}>
            <div style={{ marginBottom: 8 }}>
              <label style={styles.labelStyle}>Term</label>
              <textarea
                style={{ 
                  ...styles.inputStyle, 
                  minHeight: 'auto', 
                  fontFamily: 'inherit', 
                  resize: 'none',
                  overflow: 'hidden'
                }}
                value={item.term || ''}
                onChange={(e) => {
                  updateTerm(idx, 'term', e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                }}
                onInput={(e) => {
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                }}
                ref={(el) => {
                  if (el) {
                    el.style.height = 'auto'
                    el.style.height = el.scrollHeight + 'px'
                  }
                }}
                placeholder="Vocabulary term"
                rows={1}
              />
            </div>
            
            <div style={{ marginBottom: 8 }}>
              <label style={styles.labelStyle}>Definition</label>
              <textarea
                style={{ 
                  ...styles.inputStyle, 
                  minHeight: 'auto', 
                  fontFamily: 'inherit', 
                  resize: 'none',
                  overflow: 'hidden'
                }}
                value={item.definition || item.def || ''}
                onChange={(e) => {
                  updateTerm(idx, 'definition', e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                }}
                onInput={(e) => {
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                }}
                ref={(el) => {
                  if (el) {
                    el.style.height = 'auto'
                    el.style.height = el.scrollHeight + 'px'
                  }
                }}
                placeholder="Definition"
                rows={1}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button style={styles.btnDangerStyle} onClick={() => removeTerm(idx)}>
                Remove
              </button>
            </div>
          </div>
        ))
      )}
      <button style={styles.btnAddStyle} onClick={addTerm}>
        + Add Vocabulary Term
      </button>
    </div>
  )
}

// Multiple Choice Editor Component
function MultipleChoiceEditor({ questions, onChange, styles }) {
  console.log('[MultipleChoiceEditor] Received questions:', questions)
  
  const addQuestion = () => {
    onChange([...questions, { question: '', choices: ['', '', '', ''], correct: 0 }])
  }

  const updateQuestion = (index, field, value) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const updateChoice = (qIndex, cIndex, value) => {
    const updated = [...questions]
    const choices = [...(updated[qIndex].choices || [])]
    choices[cIndex] = value
    updated[qIndex] = { ...updated[qIndex], choices }
    onChange(updated)
  }

  const addChoice = (qIndex) => {
    const updated = [...questions]
    const choices = [...(updated[qIndex].choices || []), '']
    updated[qIndex] = { ...updated[qIndex], choices }
    onChange(updated)
  }

  const removeChoice = (qIndex, cIndex) => {
    const updated = [...questions]
    const choices = updated[qIndex].choices.filter((_, i) => i !== cIndex)
    updated[qIndex] = { ...updated[qIndex], choices }
    // Adjust correct index if needed
    if (updated[qIndex].correct >= choices.length) {
      updated[qIndex].correct = Math.max(0, choices.length - 1)
    }
    onChange(updated)
  }

  const removeQuestion = (index) => {
    onChange(questions.filter((_, i) => i !== index))
  }

  return (
    <div style={styles.sectionStyle}>
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Multiple Choice Questions</h3>
      {questions.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 14 }}>No multiple choice questions yet. Add one below.</p>
      ) : (
        questions.map((q, qIdx) => (
          <div key={qIdx} style={{ marginBottom: 16, padding: 12, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong>Question {qIdx + 1}</strong>
              <button style={styles.btnDangerStyle} onClick={() => removeQuestion(qIdx)}>
                Remove Question
              </button>
            </div>
            
            <label style={styles.labelStyle}>Question Text</label>
            <input
              style={styles.inputStyle}
              value={q.question || q.q || ''}
              onChange={(e) => updateQuestion(qIdx, 'question', e.target.value)}
              placeholder="Enter the question"
            />

            <label style={{ ...styles.labelStyle, marginTop: 12 }}>Choices</label>
            {(q.choices || []).map((choice, cIdx) => (
              <div key={cIdx} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <input
                  type="radio"
                  name={`correct-${qIdx}`}
                  checked={q.correct === cIdx}
                  onChange={() => updateQuestion(qIdx, 'correct', cIdx)}
                />
                <span style={{ fontWeight: 600, minWidth: 20 }}>{String.fromCharCode(65 + cIdx)})</span>
                <input
                  style={{ ...styles.inputStyle, flex: 1 }}
                  value={choice}
                  onChange={(e) => updateChoice(qIdx, cIdx, e.target.value)}
                  placeholder={`Choice ${String.fromCharCode(65 + cIdx)}`}
                />
                {(q.choices || []).length > 2 && (
                  <button style={{ ...styles.btnDangerStyle, padding: '4px 8px' }} onClick={() => removeChoice(qIdx, cIdx)}>
                    ×
                  </button>
                )}
              </div>
            ))}
            <button style={{ ...styles.btnAddStyle, padding: '4px 8px', fontSize: 12 }} onClick={() => addChoice(qIdx)}>
              + Add Choice
            </button>
          </div>
        ))
      )}
      <button style={styles.btnAddStyle} onClick={addQuestion}>
        + Add Multiple Choice Question
      </button>
    </div>
  )
}

// True/False Editor Component
function TrueFalseEditor({ questions, onChange, styles }) {
  const addQuestion = () => {
    onChange([...questions, { question: '', answer: true }])
  }

  const updateQuestion = (index, field, value) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const removeQuestion = (index) => {
    onChange(questions.filter((_, i) => i !== index))
  }

  return (
    <div style={styles.sectionStyle}>
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>True/False Questions</h3>
      {questions.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 14 }}>No true/false questions yet. Add one below.</p>
      ) : (
        questions.map((q, idx) => (
          <div key={idx} style={{ marginBottom: 12, padding: 12, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong>Question {idx + 1}</strong>
              <button style={styles.btnDangerStyle} onClick={() => removeQuestion(idx)}>
                Remove
              </button>
            </div>
            
            <label style={styles.labelStyle}>Question Text</label>
            <input
              style={styles.inputStyle}
              value={q.question || q.q || ''}
              onChange={(e) => updateQuestion(idx, 'question', e.target.value)}
              placeholder="Enter the statement"
            />

            <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
              <label style={styles.labelStyle}>Correct Answer:</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="radio"
                  checked={q.answer === true}
                  onChange={() => updateQuestion(idx, 'answer', true)}
                />
                True
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="radio"
                  checked={q.answer === false}
                  onChange={() => updateQuestion(idx, 'answer', false)}
                />
                False
              </label>
            </div>
          </div>
        ))
      )}
      <button style={styles.btnAddStyle} onClick={addQuestion}>
        + Add True/False Question
      </button>
    </div>
  )
}

// Short Answer Editor Component
function ShortAnswerEditor({ questions, onChange, styles }) {
  console.log('[ShortAnswerEditor] Received questions:', questions)
  
  const addQuestion = () => {
    onChange([...questions, { question: '', expectedAny: [''] }])
  }

  const updateQuestion = (index, field, value) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const updateAnswer = (qIndex, aIndex, value) => {
    const updated = [...questions]
    const answers = [...(updated[qIndex].expectedAny || [])]
    answers[aIndex] = value
    updated[qIndex] = { ...updated[qIndex], expectedAny: answers }
    onChange(updated)
  }

  const addAnswer = (qIndex) => {
    const updated = [...questions]
    const answers = [...(updated[qIndex].expectedAny || []), '']
    updated[qIndex] = { ...updated[qIndex], expectedAny: answers }
    onChange(updated)
  }

  const removeAnswer = (qIndex, aIndex) => {
    const updated = [...questions]
    const answers = updated[qIndex].expectedAny.filter((_, i) => i !== aIndex)
    updated[qIndex] = { ...updated[qIndex], expectedAny: answers }
    onChange(updated)
  }

  const removeQuestion = (index) => {
    onChange(questions.filter((_, i) => i !== index))
  }

  return (
    <div style={styles.sectionStyle}>
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Short Answer Questions</h3>
      {questions.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 14 }}>No short answer questions yet. Add one below.</p>
      ) : (
        questions.map((q, qIdx) => (
          <div key={qIdx} style={{ marginBottom: 16, padding: 12, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong>Question {qIdx + 1}</strong>
              <button style={styles.btnDangerStyle} onClick={() => removeQuestion(qIdx)}>
                Remove Question
              </button>
            </div>
            
            <label style={styles.labelStyle}>Question Text</label>
            <textarea
              style={{ 
                ...styles.inputStyle, 
                minHeight: 'auto', 
                fontFamily: 'inherit', 
                resize: 'none',
                overflow: 'hidden'
              }}
              value={q.question || q.q || ''}
              onChange={(e) => {
                updateQuestion(qIdx, 'question', e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              onInput={(e) => {
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              ref={(el) => {
                if (el) {
                  el.style.height = 'auto'
                  el.style.height = el.scrollHeight + 'px'
                }
              }}
              placeholder="Enter the question"
              rows={1}
            />

            <label style={{ ...styles.labelStyle, marginTop: 12 }}>Acceptable Answers</label>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 8px' }}>
              Add multiple acceptable answers. Students only need to match one.
            </p>
            {(q.expectedAny || []).map((answer, aIdx) => (
              <div key={aIdx} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <textarea
                  style={{ 
                    ...styles.inputStyle, 
                    flex: 1, 
                    minHeight: 'auto', 
                    fontFamily: 'inherit', 
                    resize: 'none',
                    overflow: 'hidden'
                  }}
                  value={answer}
                  onChange={(e) => {
                    updateAnswer(qIdx, aIdx, e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = e.target.scrollHeight + 'px'
                  }}
                  onInput={(e) => {
                    e.target.style.height = 'auto'
                    e.target.style.height = e.target.scrollHeight + 'px'
                  }}
                  ref={(el) => {
                    if (el) {
                      el.style.height = 'auto'
                      el.style.height = el.scrollHeight + 'px'
                    }
                  }}
                  placeholder={`Acceptable answer ${aIdx + 1}`}
                  rows={1}
                />
                {(q.expectedAny || []).length > 1 && (
                  <button style={{ ...styles.btnDangerStyle, padding: '4px 8px' }} onClick={() => removeAnswer(qIdx, aIdx)}>
                    ×
                  </button>
                )}
              </div>
            ))}
            <button style={{ ...styles.btnAddStyle, padding: '4px 8px', fontSize: 12 }} onClick={() => addAnswer(qIdx)}>
              + Add Acceptable Answer
            </button>
          </div>
        ))
      )}
      <button style={styles.btnAddStyle} onClick={addQuestion}>
        + Add Short Answer Question
      </button>
    </div>
  )
}

// Fill in the Blank Editor (similar to short answer)
function FillInBlankEditor({ questions, onChange, styles }) {
  console.log('[FillInBlankEditor] Received questions:', questions)
  
  const addQuestion = () => {
    onChange([...questions, { question: '', expectedAny: [''] }])
  }

  const updateQuestion = (index, field, value) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const updateAnswer = (qIndex, aIndex, value) => {
    const updated = [...questions]
    const answers = [...(updated[qIndex].expectedAny || [])]
    answers[aIndex] = value
    updated[qIndex] = { ...updated[qIndex], expectedAny: answers }
    onChange(updated)
  }

  const addAnswer = (qIndex) => {
    const updated = [...questions]
    const answers = [...(updated[qIndex].expectedAny || []), '']
    updated[qIndex] = { ...updated[qIndex], expectedAny: answers }
    onChange(updated)
  }

  const removeAnswer = (qIndex, aIndex) => {
    const updated = [...questions]
    const answers = updated[qIndex].expectedAny.filter((_, i) => i !== aIndex)
    updated[qIndex] = { ...updated[qIndex], expectedAny: answers }
    onChange(updated)
  }

  const removeQuestion = (index) => {
    onChange(questions.filter((_, i) => i !== index))
  }

  return (
    <div style={styles.sectionStyle}>
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Fill in the Blank Questions</h3>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px' }}>
        Use _____ in the question text to indicate where the blank should be.
      </p>
      {questions.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 14 }}>No fill-in-the-blank questions yet. Add one below.</p>
      ) : (
        questions.map((q, qIdx) => (
          <div key={qIdx} style={{ marginBottom: 16, padding: 12, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong>Question {qIdx + 1}</strong>
              <button style={styles.btnDangerStyle} onClick={() => removeQuestion(qIdx)}>
                Remove Question
              </button>
            </div>
            
            <label style={styles.labelStyle}>Question Text (use _____ for blank)</label>
            <input
              style={styles.inputStyle}
              value={q.question || q.q || ''}
              onChange={(e) => updateQuestion(qIdx, 'question', e.target.value)}
              placeholder="E.g., The capital of France is _____."
            />

            <label style={{ ...styles.labelStyle, marginTop: 12 }}>Acceptable Answers</label>
            {(q.expectedAny || []).map((answer, aIdx) => (
              <div key={aIdx} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input
                  style={{ ...styles.inputStyle, flex: 1 }}
                  value={answer}
                  onChange={(e) => updateAnswer(qIdx, aIdx, e.target.value)}
                  placeholder={`Acceptable answer ${aIdx + 1}`}
                />
                {(q.expectedAny || []).length > 1 && (
                  <button style={{ ...styles.btnDangerStyle, padding: '4px 8px' }} onClick={() => removeAnswer(qIdx, aIdx)}>
                    ×
                  </button>
                )}
              </div>
            ))}
            <button style={{ ...styles.btnAddStyle, padding: '4px 8px', fontSize: 12 }} onClick={() => addAnswer(qIdx)}>
              + Add Acceptable Answer
            </button>
          </div>
        ))
      )}
      <button style={styles.btnAddStyle} onClick={addQuestion}>
        + Add Fill in the Blank Question
      </button>
    </div>
  )
}

// Sample Q&A Editor (similar to short answer)
function SampleQAEditor({ questions, onChange, styles }) {
  console.log('[SampleQAEditor] Received questions:', questions)
  
  const addQuestion = () => {
    onChange([...questions, { question: '', expectedAny: [''] }])
  }

  const updateQuestion = (index, field, value) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const updateAnswer = (qIndex, aIndex, value) => {
    const updated = [...questions]
    const answers = [...(updated[qIndex].expectedAny || [])]
    answers[aIndex] = value
    updated[qIndex] = { ...updated[qIndex], expectedAny: answers }
    onChange(updated)
  }

  const addAnswer = (qIndex) => {
    const updated = [...questions]
    const answers = [...(updated[qIndex].expectedAny || []), '']
    updated[qIndex] = { ...updated[qIndex], expectedAny: answers }
    onChange(updated)
  }

  const removeAnswer = (qIndex, aIndex) => {
    const updated = [...questions]
    const answers = updated[qIndex].expectedAny.filter((_, i) => i !== aIndex)
    updated[qIndex] = { ...updated[qIndex], expectedAny: answers }
    onChange(updated)
  }

  const removeQuestion = (index) => {
    onChange(questions.filter((_, i) => i !== index))
  }

  return (
    <div style={styles.sectionStyle}>
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Sample Q&A (Teaching Examples)</h3>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px' }}>
        These are sample questions used during the teaching phase.
      </p>
      {questions.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 14 }}>No sample Q&A yet. Add one below.</p>
      ) : (
        questions.map((q, qIdx) => (
          <div key={qIdx} style={{ marginBottom: 16, padding: 12, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong>Question {qIdx + 1}</strong>
              <button style={styles.btnDangerStyle} onClick={() => removeQuestion(qIdx)}>
                Remove Question
              </button>
            </div>
            
            <label style={styles.labelStyle}>Question Text</label>
            <input
              style={styles.inputStyle}
              value={q.question || q.q || ''}
              onChange={(e) => updateQuestion(qIdx, 'question', e.target.value)}
              placeholder="Enter the sample question"
            />

            <label style={{ ...styles.labelStyle, marginTop: 12 }}>Sample Answers</label>
            {(q.expectedAny || []).map((answer, aIdx) => (
              <div key={aIdx} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input
                  style={{ ...styles.inputStyle, flex: 1 }}
                  value={answer}
                  onChange={(e) => updateAnswer(qIdx, aIdx, e.target.value)}
                  placeholder={`Sample answer ${aIdx + 1}`}
                />
                {(q.expectedAny || []).length > 1 && (
                  <button style={{ ...styles.btnDangerStyle, padding: '4px 8px' }} onClick={() => removeAnswer(qIdx, aIdx)}>
                    ×
                  </button>
                )}
              </div>
            ))}
            <button style={{ ...styles.btnAddStyle, padding: '4px 8px', fontSize: 12 }} onClick={() => addAnswer(qIdx)}>
              + Add Sample Answer
            </button>
          </div>
        ))
      )}
      <button style={styles.btnAddStyle} onClick={addQuestion}>
        + Add Sample Question
      </button>
    </div>
  )
}
