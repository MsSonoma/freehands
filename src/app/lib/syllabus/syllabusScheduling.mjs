function clean(value) { return String(value || '').trim() }

export function buildSchedulableLessonOptions({ publicLessonsBySubject = {}, facilitatorLessons = [] } = {}) {
  const options = new Map()
  const ownedSourceKeys = new Set((facilitatorLessons || []).map((lesson) => {
    const subject = clean(lesson?.subject).toLocaleLowerCase() || 'math'
    const file = clean(lesson?.file)
    return subject && file ? `${subject}/${file}` : ''
  }).filter(Boolean))
  for (const [subjectValue, lessons] of Object.entries(publicLessonsBySubject || {})) {
    const subject = clean(subjectValue).toLocaleLowerCase()
    if (!subject || !Array.isArray(lessons)) continue
    for (const lesson of lessons) {
      const file = clean(lesson?.file)
      if (!file) continue
      const lessonKey = `${subject}/${file}`
      if (ownedSourceKeys.has(lessonKey)) continue
      options.set(lessonKey, {
        lessonKey,
        title: clean(lesson?.title) || file.replace(/\.json$/i, ''),
        subject: clean(lesson?.subject) || subject,
        grade: clean(lesson?.grade),
        source: 'public',
      })
    }
  }
  for (const lesson of facilitatorLessons || []) {
    const file = clean(lesson?.file)
    if (!file || lesson?.approved !== true) continue
    const lessonKey = `generated/${file}`
    options.set(lessonKey, {
      lessonKey,
      title: clean(lesson?.title) || file.replace(/\.json$/i, ''),
      subject: clean(lesson?.subject) || 'generated',
      grade: clean(lesson?.grade),
      source: 'facilitator',
      needsUpdate: lesson?.needsUpdate === true,
    })
  }
  return [...options.values()].sort((left, right) => (
    left.subject.localeCompare(right.subject, undefined, { sensitivity: 'base' })
    || left.title.localeCompare(right.title, undefined, { sensitivity: 'base' })
    || left.lessonKey.localeCompare(right.lessonKey)
  ))
}

export function buildLessonSchedulePayload({ learnerId, lessonKey, scheduledDate, scheduleId = '', forecastLineageId = '', exceptionPin = '' } = {}) {
  const payload = {
    learnerId: clean(learnerId),
    lessonKey: clean(lessonKey),
    scheduledDate: clean(scheduledDate).slice(0, 10),
  }
  const occurrenceId = clean(scheduleId)
  const lineageId = clean(forecastLineageId)
  const pin = clean(exceptionPin)
  if (occurrenceId) payload.scheduleId = occurrenceId
  if (lineageId) payload.forecastLineageId = lineageId
  if (pin) payload.exceptionPin = pin
  return payload
}

export async function postLessonScheduleWithCapacityPin({ payload, postSchedule, requestPin } = {}) {
  const send = async (body) => {
    const response = await postSchedule(body)
    return { response, json: await response.json().catch(() => ({})) }
  }
  let result = await send(buildLessonSchedulePayload(payload))
  if (result.response.status === 409 && result.json?.code === 'SYLLABUS_CAPACITY_PIN_REQUIRED') {
    const pin = await requestPin(result.json.error)
    if (!pin) throw new Error('The placement exception was not approved.')
    result = await send(buildLessonSchedulePayload({ ...payload, exceptionPin: pin }))
  }
  return result
}

export function canAddLessonToSyllabusDay({ role, day, today, schedulingAllowed } = {}) {
  const date = clean(day).slice(0, 10)
  const currentDate = clean(today).slice(0, 10)
  return role === 'facilitator' && schedulingAllowed === true && Boolean(date && currentDate) && date >= currentDate
}
