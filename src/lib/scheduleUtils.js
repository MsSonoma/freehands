// Utility function to get scheduled lessons for a learner on a specific date
// This integrates scheduled lessons with the approved lessons system

export async function getActiveScheduledLessons(learnerId, date = null) {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0]
    
    const response = await fetch(
      `/api/lesson-schedule?learnerId=${learnerId}&action=active`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.error('Failed to fetch scheduled lessons')
      return []
    }

    const data = await response.json()
    return data.lessons || []
  } catch (error) {
    console.error('Error fetching scheduled lessons:', error)
    return []
  }
}

// Merge scheduled lessons with approved lessons
export function mergeScheduledWithApproved(approvedLessons, scheduledLessons) {
  const merged = { ...approvedLessons }
  
  // Add scheduled lessons for today
  scheduledLessons.forEach(item => {
    if (item.lesson_key) {
      merged[item.lesson_key] = true
    }
  })
  
  return merged
}

// Check if a lesson is currently scheduled for today
export function isLessonScheduledToday(lessonKey, scheduledLessons) {
  return scheduledLessons.some(item => item.lesson_key === lessonKey)
}

// Get all scheduled dates for a lesson
export async function getLessonScheduleDates(learnerId, lessonKey) {
  try {
    const startDate = new Date()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + 3) // Look ahead 3 months

    const response = await fetch(
      `/api/lesson-schedule?learnerId=${learnerId}&startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) return []

    const data = await response.json()
    const schedule = data.schedule || []
    
    return schedule
      .filter(item => item.lesson_key === lessonKey)
      .map(item => item.scheduled_date)
  } catch (error) {
    console.error('Error fetching lesson schedule dates:', error)
    return []
  }
}
