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

export function resolveWebbProviderProvenance(env = process.env) {
  return {
    provider: 'openai',
    model: env.WEBB_OPENAI_MODEL || AI_MODEL || null,
    app_build_id: env.VERCEL_GIT_COMMIT_SHA || env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || env.VERCEL_GIT_COMMIT_REF || null,
    teaching_protocol_version: 'webb-conversation-v1',
    teaching_protocol_hash: null,
  };
}

export function resolveSlateProviderProvenance(env = process.env) {
  return {
    provider: 'deterministic_app',
    model: env.SONOMA_OPENAI_MODEL || AI_MODEL || null,
    app_build_id: env.VERCEL_GIT_COMMIT_SHA || env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || env.VERCEL_GIT_COMMIT_REF || null,
    teaching_protocol_version: 'slate-mastery-retention-v1',
    teaching_protocol_hash: null,
  };
}

export const SERVER_OWNED_PROVENANCE_FIELDS = Object.freeze([
  'provider',
  'model',
  'app_build_id',
  'teaching_protocol_version',
  'teaching_protocol_hash',
]);

export function resolveEvidenceSessionProvenance(evidenceSession, env = process.env) {
  const sessionId = String(evidenceSession?.session_id || '').trim().toLowerCase();
  const protocol = String(evidenceSession?.teaching_protocol_version || '').trim().toLowerCase();
  const fallback = sessionId.startsWith('slate:') || protocol.startsWith('slate-')
    ? resolveSlateProviderProvenance(env)
    : (protocol.startsWith('webb-')
      ? resolveWebbProviderProvenance(env)
      : resolveSonomaProviderProvenance(env));

  return {
    provider: evidenceSession?.provider || fallback.provider,
    model: evidenceSession?.model || fallback.model,
    app_build_id: evidenceSession?.app_build_id || fallback.app_build_id,
    teaching_protocol_version: evidenceSession?.teaching_protocol_version || fallback.teaching_protocol_version,
    teaching_protocol_hash: evidenceSession?.teaching_protocol_hash || fallback.teaching_protocol_hash,
  };
}

export function mergeProvenance(base, incoming, { protectedFields = [] } = {}) {
  const cleanIncoming = incoming && typeof incoming === 'object' && !Array.isArray(incoming)
    ? incoming
    : {};
  const cleanBase = base && typeof base === 'object' && !Array.isArray(base) ? base : {};
  const merged = { ...cleanBase, ...cleanIncoming };
  for (const field of protectedFields) {
    if (Object.prototype.hasOwnProperty.call(cleanBase, field)) merged[field] = cleanBase[field];
  }
  return Object.fromEntries(
    Object.entries(merged)
      .filter(([, value]) => value !== undefined)
  );
}
