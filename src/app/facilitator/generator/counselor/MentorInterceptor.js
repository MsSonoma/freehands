/**
 * MentorInterceptor
 *
 * Lightweight client-side context helper for Mr. Mentor.
 * Operational actions are intentionally owned by the server-side Mentor Tool
 * Registry so there is only one mutation/confirmation/verification path.
 */

import {
  isLikelyAppFeatureQuery,
  searchMentorFeatures,
} from '@/lib/mentor/featureRegistry'

export default class MentorInterceptor {
  async process(userMessage, context = {}) {
    void context
    const message = String(userMessage || '')
    const matches = searchMentorFeatures(message)
    const shouldLogBlindspot = matches.length === 0 && isLikelyAppFeatureQuery(message)

    return {
      handled: false,
      apiForward: {
        message,
        ...(shouldLogBlindspot ? {
          context: {
            mentor_blindspot: {
              kind: 'feature_registry',
              query: message,
              created_at: new Date().toISOString(),
            },
          },
        } : {}),
      },
    }
  }
}
