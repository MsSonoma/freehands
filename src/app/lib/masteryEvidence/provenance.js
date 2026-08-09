import { AI_MODEL } from '../aiModel.js';

export function resolveSonomaProviderProvenance(env = process.env) {
  const provider = String(
    env.SONOMA_PROVIDER || (env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai')
  ).trim().toLowerCase();

  let model = null;
  if (provider === 'anthropic') {
    model = env.SONOMA_MODEL || env.ANTHROPIC_MODEL || 'claude-4.1-opus';
  } else if (provider === 'openai') {
    model = env.SONOMA_OPENAI_MODEL || AI_MODEL || null;
  }

  return {
    provider: provider || null,
    model: model || null,
    app_build_id:
      env.VERCEL_GIT_COMMIT_SHA
      || env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
      || env.VERCEL_GIT_COMMIT_REF
      || null,
    teaching_protocol_version: 'session-v2',
    teaching_protocol_hash: null,
  };
}

export function mergeProvenance(base, incoming) {
  const cleanIncoming = incoming && typeof incoming === 'object' && !Array.isArray(incoming)
    ? incoming
    : {};
  return Object.fromEntries(
    Object.entries({ ...(base || {}), ...cleanIncoming })
      .filter(([, value]) => value !== undefined)
  );
}
