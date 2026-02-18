/**
 * Mentor Feature Registry
 *
 * Purpose:
 * - Provide a single searchable catalog of user-facing features.
 * - Support deterministic "describe" responses (FAQ-style explanations).
 * - Support deterministic "report" actions for user-specific state.
 *
 * Notes:
 * - Base FAQ data comes from src/lib/faq/*.json via faqLoader.
 * - Report-capable features are layered on top (same shape + a `report` descriptor).
 */

import { getAllFeatures as getAllFaqFeatures } from '@/lib/faq/faqLoader'

function normalizeText(text) {
  if (!text) return ''
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
}

function scoreFeatureMatch(userInput, feature) {
  const normalized = normalizeText(userInput)
  if (!normalized) return { score: 0, matchedKeywords: [] }

  let score = 0
  const matchedKeywords = []

  const keywords = Array.isArray(feature?.keywords) ? feature.keywords : []
  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword)
    if (!normalizedKeyword) continue

    if (normalized === normalizedKeyword) {
      score += 100
      matchedKeywords.push(keyword)
    } else if (normalized.includes(normalizedKeyword)) {
      score += 50
      matchedKeywords.push(keyword)
    } else if (normalizedKeyword.includes(normalized) && normalized.length >= 4) {
      score += 30
      matchedKeywords.push(keyword)
    } else {
      const keywordWords = normalizedKeyword.split(' ')
      const inputWords = normalized.split(' ')
      const matchedWords = keywordWords.filter((kw) =>
        inputWords.some((iw) => iw.includes(kw) || kw.includes(iw))
      )

      if (matchedWords.length === keywordWords.length && keywordWords.length > 1) {
        score += 20
        matchedKeywords.push(keyword)
      } else if (matchedWords.length >= 2) {
        score += 10
        matchedKeywords.push(keyword)
      }
    }
  }

  const title = feature?.title ? normalizeText(feature.title) : ''
  if (title && (normalized.includes(title) || title.includes(normalized))) {
    score += 15
  }

  return { score, matchedKeywords: [...new Set(matchedKeywords)] }
}

function getReportableFeatures() {
  return [
    {
      id: 'goals-notes',
      title: 'Goals and Notes',
      category: 'Learners',
      keywords: [
        'goals',
        'notes',
        'goals and notes',
        'learner goals',
        'learner notes',
        'my goals',
        'goals clipboard'
      ],
      description:
        'Goals and Notes are persistent observations you save about a learner (or yourself as facilitator). They help keep context across sessions and let Mr. Mentor tailor guidance.',
      howToUse:
        "To review what's saved, ask 'show my goals and notes'. To update them, open the Goals clipboard or tell me what you'd like to add/change.",
      relatedFeatures: ['learner-profiles', 'mr-mentor'],
      report: {
        actionType: 'report_goals_notes',
        requiresLearner: false
      }
    },
    {
      id: 'curriculum-preferences',
      title: 'Curriculum Preferences',
      category: 'Facilitator',
      keywords: [
        'curriculum preferences',
        'curriculum',
        'learning preferences',
        'focus topics',
        'avoid topics'
      ],
      description:
        "Curriculum preferences are learner-specific guardrails for lesson planning. They let you set topics to focus on and topics to avoid, and Mr. Mentor will use them to guide lesson generation and planning.",
      howToUse:
        "To set them, tell me focus topics and avoid topics for a selected learner, and I can save them. To review what's saved, ask 'show my curriculum preferences'.",
      relatedFeatures: [],
      report: {
        actionType: 'report_curriculum_preferences',
        requiresLearner: true
      }
    },
    {
      id: 'weekly-pattern',
      title: 'Weekly Pattern',
      category: 'Facilitator',
      keywords: [
        'weekly pattern',
        'weekly schedule',
        'schedule template',
        'schedule templates',
        'week pattern'
      ],
      description:
        'Weekly pattern is a reusable weekly subject plan for a learner (e.g., Math on Monday/Wednesday/Friday). It can be used as a planning template when building schedules.',
      howToUse:
        "To update it, tell me which day(s) and which subjects. To review what's saved, ask 'show my weekly pattern'.",
      relatedFeatures: [],
      report: {
        actionType: 'report_weekly_pattern',
        requiresLearner: true
      }
    },
    {
      id: 'custom-subjects',
      title: 'Custom Subjects',
      category: 'Facilitator',
      keywords: [
        'custom subjects',
        'custom subject',
        'add a subject',
        'subject list',
        'my subjects'
      ],
      description:
        'Custom subjects let you add your own subject labels (beyond the defaults) for planning, scheduling, and templates.',
      howToUse:
        "Ask 'show my custom subjects' to review them. Say 'add custom subject <name>' to create one, or 'delete custom subject <name>' to remove one.",
      relatedFeatures: ['weekly-pattern', 'calendar-view'],
      report: {
        actionType: 'report_custom_subjects',
        requiresLearner: false
      }
    },
    {
      id: 'planned-lessons',
      title: 'Planned Lessons (Lesson Planner)',
      category: 'Facilitator',
      keywords: [
        'planned lessons',
        'lesson planner',
        'lesson plan',
        'planner',
        'planned schedule',
        'what is planned'
      ],
      description:
        'Planned lessons are a future learning plan generated by the Lesson Planner. They represent a plan-by-date (often months ahead) and can be reviewed in the calendar/planner experience.',
      howToUse:
        "Ask 'show my planned lessons' to review the upcoming plan for the selected learner.",
      relatedFeatures: ['calendar-view', 'weekly-pattern', 'curriculum-preferences'],
      report: {
        actionType: 'report_planned_lessons',
        requiresLearner: true
      }
    },
    {
      id: 'lesson-schedule',
      title: 'Scheduled Lessons',
      category: 'Facilitator',
      keywords: [
        'scheduled lessons',
        'lesson schedule',
        'calendar schedule',
        'what is scheduled',
        'upcoming lessons'
      ],
      description:
        'Scheduled lessons are lessons assigned to specific dates on the learner calendar. They show up in the Calendar View and drive what the learner sees on their learning day.',
      howToUse:
        "Ask 'show upcoming scheduled lessons' to see the near-term schedule for the selected learner.",
      relatedFeatures: ['calendar-view', 'lesson-scheduling'],
      report: {
        actionType: 'report_lesson_schedule',
        requiresLearner: true
      }
    },
    {
      id: 'no-school-dates',
      title: 'No-School Dates',
      category: 'Facilitator',
      keywords: [
        'no school dates',
        'no-school dates',
        'holidays',
        'days off',
        'skip days'
      ],
      description:
        'No-school dates let you mark days off (holidays, travel, sick days) so planning and schedules can avoid them.',
      howToUse:
        "Ask 'show no-school dates' to review what is saved for the selected learner.",
      relatedFeatures: ['planned-lessons', 'calendar-view'],
      report: {
        actionType: 'report_no_school_dates',
        requiresLearner: true
      }
    },
    {
      id: 'medals',
      title: 'Medals (Best Scores)',
      category: 'Learners',
      keywords: [
        'medals',
        'best scores',
        'scores',
        'gold medal',
        'silver medal',
        'bronze medal'
      ],
      description:
        "Medals summarize a learner's best performance on lessons (e.g., gold/silver/bronze tiers based on percent).",
      howToUse:
        "Ask 'show medals' to see a summary for the selected learner.",
      relatedFeatures: ['assessments'],
      report: {
        actionType: 'report_medals',
        requiresLearner: true
      }
    },
    {
      id: 'account-timezone',
      title: 'Account Timezone',
      category: 'Account',
      keywords: ['timezone', 'time zone', 'account timezone', 'my timezone'],
      description:
        'Your account timezone affects how dates/times are interpreted for scheduling and calendar-related experiences.',
      howToUse:
        "Ask 'what is my timezone' to see what the app has saved.",
      relatedFeatures: ['calendar-view'],
      report: {
        actionType: 'report_account_timezone',
        requiresLearner: false
      }
    },
    {
      id: 'device-limits',
      title: 'Device Limits',
      category: 'Account',
      keywords: ['devices', 'device limit', 'multiple devices', 'session takeover', 'device cap'],
      description:
        'Device limits control how many active devices can be connected at once. Session Takeover helps you move between devices safely.',
      howToUse:
        "Ask 'how many devices are active' to see your current device usage.",
      relatedFeatures: ['session-takeover'],
      report: {
        actionType: 'report_device_limits',
        requiresLearner: false
      }
    },
    {
      id: 'daily-lesson-quota',
      title: 'Daily Lesson Quota',
      category: 'Account',
      keywords: ['lesson quota', 'daily lesson limit', 'how many lessons left', 'remaining lessons today'],
      description:
        'Daily lesson quota describes how many AI lesson generations you can do today based on your plan tier.',
      howToUse:
        "Ask 'how many lessons do I have left today' to see your remaining daily quota.",
      relatedFeatures: ['subscription-tiers'],
      report: {
        actionType: 'report_daily_lesson_quota',
        requiresLearner: false
      }
    }
  ]
}

function uniqStrings(values) {
  const out = []
  const seen = new Set()
  for (const value of values || []) {
    const s = typeof value === 'string' ? value.trim() : ''
    if (!s) continue
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}

function mergeFeature(base, overlay) {
  if (!base) return overlay
  if (!overlay) return base

  return {
    ...base,
    ...overlay,
    keywords: uniqStrings([...(base.keywords || []), ...(overlay.keywords || [])]),
    relatedFeatures: uniqStrings([
      ...(base.relatedFeatures || []),
      ...(overlay.relatedFeatures || [])
    ]),
    report: overlay.report || base.report || undefined
  }
}

export function getAllMentorFeatures() {
  const faq = getAllFaqFeatures()
  const reportable = getReportableFeatures()

  // Merge report capabilities into FAQ definitions when an id matches.
  const byId = new Map()
  for (const feature of faq) {
    if (!feature?.id) continue
    byId.set(feature.id, feature)
  }
  for (const feature of reportable) {
    if (!feature?.id) continue
    const existing = byId.get(feature.id) || null
    byId.set(feature.id, mergeFeature(existing, feature))
  }

  return Array.from(byId.values())
}

export function getMentorFeatureById(featureId) {
  const id = String(featureId || '').trim()
  if (!id) return null

  const features = getAllMentorFeatures()
  return features.find((f) => f?.id === id) || null
}

export function searchMentorFeatures(userInput) {
  const features = getAllMentorFeatures()
  const matches = []

  for (const feature of features) {
    const { score, matchedKeywords } = scoreFeatureMatch(userInput, feature)
    if (score <= 0) continue

    matches.push({ feature, score, matchedKeywords })
  }

  matches.sort((a, b) => b.score - a.score)
  return matches
}

export function shouldTreatAsReportQuery(userInput, context) {
  const normalized = normalizeText(userInput)
  const learnerName = context?.learnerName ? normalizeText(context.learnerName) : ''

  return (
    /\bmy\b/.test(normalized) ||
    normalized.includes('current') ||
    normalized.includes('right now') ||
    normalized.includes('show me') ||
    normalized.includes('list') ||
    normalized.includes('what are my') ||
    (learnerName && normalized.includes(learnerName))
  )
}

export function isLikelyAppFeatureQuery(userInput) {
  const normalized = normalizeText(userInput)
  if (!normalized) return false

  // If the user references UI or app mechanics, it's likely app-feature related.
  const uiSignals = [
    'in the app',
    'on the site',
    'on this page',
    'where is',
    'where do i',
    'button',
    'dropdown',
    'click',
    'tap',
    'menu',
    'settings',
    'calendar',
    'lessons',
    'schedule',
    'scheduled',
    'assign',
    'approved',
    'generate',
    'edit',
    'learner',
    'worksheet',
    'comprehension',
    'exercise',
    'test',
    'goals',
    'notes',
    'curriculum',
    'weekly pattern',
    'custom subject',
    'custom subjects',
    'planned lessons',
    'lesson planner',
    'no school',
    'holiday',
    'medal',
    'medals',
    'device',
    'devices',
    'subscription',
    'plan',
    'billing',
    'quota',
    'timezone',
    'mr mentor',
    'thought hub',
    'thouthub'
  ]

  return uiSignals.some((s) => normalized.includes(s))
}
