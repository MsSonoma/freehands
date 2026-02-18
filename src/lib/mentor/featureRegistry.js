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
    }
  ]
}

export function getAllMentorFeatures() {
  const faq = getAllFaqFeatures()
  const reportable = getReportableFeatures()

  // Prefer reportable definitions when an FAQ feature uses the same id.
  const byId = new Map()
  for (const feature of faq) {
    if (!feature?.id) continue
    byId.set(feature.id, feature)
  }
  for (const feature of reportable) {
    if (!feature?.id) continue
    byId.set(feature.id, feature)
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
    'curriculum',
    'weekly pattern',
    'custom subject',
    'mr mentor',
    'thought hub',
    'thouthub'
  ]

  return uiSignals.some((s) => normalized.includes(s))
}
