/**
 * Global AI model selector.
 *
 * To switch every AI call in the app at once, set the OPENAI_MODEL env var
 * in .env.local and in Vercel. Otherwise the fallback below is used.
 *
 * Current default: gpt-4o-mini
 */
export const AI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
