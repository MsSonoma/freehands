'use client'

const INSTRUCTIONAL_REVIEW_SECTIONS = [
  { key: 'truefalse', title: 'True/False' },
  { key: 'multiplechoice', title: 'Multiple Choice' },
  { key: 'fillintheblank', title: 'Fill in the Blank' },
  { key: 'shortanswer', title: 'Short Answer' },
  { key: 'worksheet', title: 'Worksheet' },
]

const RESERVED_REVIEW_SECTIONS = [
  { key: 'baseline', title: 'Baseline Pool' },
  { key: 'test', title: 'Reserved Test Pool' },
  { key: 'retention', title: 'Delayed Retention Pool' },
  { key: 'dailyFollowup', title: 'Daily Follow-Up Pool' },
  { key: 'weeklyReview', title: 'Weekly Review Pool' },
]

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function textValue(value) {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(', ')
  if (typeof value === 'object') return ''
  return String(value)
}

function questionText(item) {
  return textValue(item?.question ?? item?.prompt ?? item?.Q ?? item?.q)
}

function expectedAnswers(item) {
  const answers = []
  ;[
    item?.expectedAny,
    item?.acceptableAnswers,
    item?.acceptable_answers,
    item?.expected,
    item?.answer,
    item?.A,
    item?.a,
  ].forEach((value) => {
    if (Array.isArray(value)) answers.push(...value.map(textValue).filter(Boolean))
    else {
      const text = textValue(value)
      if (text) answers.push(text)
    }
  })
  if (Array.isArray(item?.choices) && Number.isInteger(item?.correct)) {
    const correctChoice = item.choices[item.correct]
    const text = textValue(correctChoice)
    if (text) answers.push(text)
  }
  return Array.from(new Set(answers))
}

function supportText(item) {
  const parts = []
  ;[item?.hint, item?.hints, item?.explanation, item?.rationale].forEach((value) => {
    const text = textValue(value)
    if (text) parts.push(text)
  })
  return Array.from(new Set(parts))
}

export default function GeneratedLessonReview({ lesson }) {
  const title = lesson?.title || 'Lesson content'
  const vocab = asArray(lesson?.vocab)
  const instructionalSections = INSTRUCTIONAL_REVIEW_SECTIONS
    .map((section) => ({ ...section, items: asArray(lesson?.[section.key]) }))
    .filter((section) => section.items.length > 0)
  const reservedSections = RESERVED_REVIEW_SECTIONS
    .map((section) => ({ ...section, count: asArray(lesson?.[section.key]).length }))
    .filter((section) => section.count > 0)

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: 12, background: '#fff' }}>
        <strong>{title}</strong>
        {lesson?.blurb && <p style={{ margin: '6px 0 0', color: '#4b5563', lineHeight: 1.5 }}>{lesson.blurb}</p>}
        {lesson?.teachingNotes && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}>Teaching Notes</div>
            <p style={{ margin: '4px 0 0', color: '#4b5563', lineHeight: 1.5 }}>{lesson.teachingNotes}</p>
          </div>
        )}
      </div>

      {vocab.length > 0 && (
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Vocabulary</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {vocab.map((entry, index) => {
              const term = typeof entry === 'string' ? entry : (entry?.term || `Term ${index + 1}`)
              const definition = typeof entry === 'object' && entry ? entry.definition : ''
              return (
                <div key={`${term}-${index}`} style={{ borderTop: index ? '1px solid #f3f4f6' : 'none', paddingTop: index ? 8 : 0 }}>
                  <strong>{term}</strong>
                  {definition && <p style={{ margin: '3px 0 0', color: '#4b5563' }}>{definition}</p>}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {instructionalSections.map((section) => (
        <section key={section.key} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>{section.title}</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {section.items.map((item, index) => {
              const answers = expectedAnswers(item)
              const support = supportText(item)
              return (
                <div key={`${section.key}-${index}`} style={{ borderTop: index ? '1px solid #f3f4f6' : 'none', paddingTop: index ? 10 : 0 }}>
                  <div style={{ fontWeight: 700, color: '#111827' }}>{index + 1}. {questionText(item) || 'Question text unavailable'}</div>
                  {Array.isArray(item?.choices) && item.choices.length > 0 && (
                    <ol style={{ margin: '6px 0 0', paddingLeft: 22, color: '#374151' }}>
                      {item.choices.map((choice, choiceIndex) => (
                        <li key={`${section.key}-${index}-${choiceIndex}`}>{textValue(choice)}</li>
                      ))}
                    </ol>
                  )}
                  {answers.length > 0 && (
                    <p style={{ margin: '6px 0 0', color: '#065f46' }}>
                      <strong>Expected answer:</strong> {answers.join('; ')}
                    </p>
                  )}
                  {support.length > 0 && (
                    <p style={{ margin: '6px 0 0', color: '#4b5563' }}>
                      <strong>Hint/explanation:</strong> {support.join(' ')}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {reservedSections.length > 0 && (
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#f9fafb' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Reserved Assessment Pools</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {reservedSections.map((section) => (
              <span key={section.key} style={{ border: '1px solid #d1d5db', borderRadius: 999, padding: '4px 8px', background: '#fff', fontSize: 13 }}>
                {section.title}: {section.count}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
