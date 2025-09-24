import { getSupabaseClient, hasSupabaseEnv } from '@/app/lib/supabaseClient';

// Local storage fallback shape:
// medals_by_learner = {
//   [learnerId]: { [lessonKey]: { bestPercent: number, medalTier: 'bronze'|'silver'|'gold' } }
// }
const LS_KEY = 'medals_by_learner';

const TIER_RANK = { none: 0, bronze: 1, silver: 2, gold: 3 };

export function tierForPercent(percent) {
  const p = Number(percent);
  if (!Number.isFinite(p)) return null;
  if (p >= 90) return 'gold';
  if (p >= 80) return 'silver';
  if (p >= 70) return 'bronze';
  return null;
}

export function emojiForTier(tier) {
  if (tier === 'gold') return '🥇';
  if (tier === 'silver') return '🥈';
  if (tier === 'bronze') return '🥉';
  return '';
}

function readLocal() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function writeLocal(obj) {
  localStorage.setItem(LS_KEY, JSON.stringify(obj));
}

// Adaptive owner column detection (user_id vs owner_id vs none)
let supabaseOwnerColumn = null; // 'user_id' | 'owner_id' | 'none' | null
let supabaseMedalsDisabled = false; // cache when table/resource is missing so we don't keep hitting 404s
function isUndefinedColumnOrTable(error) {
  const msg = error?.message || '';
  return (
    error?.code === '42703' || // undefined_column
    error?.code === '42P01' || // undefined_table
    error?.status === 404 || // PostgREST Not Found (resource/table)
    /column .* does not exist/i.test(msg) ||
    /could not find .* column/i.test(msg) ||
    /relation .* does not exist/i.test(msg) ||
    /not found/i.test(msg) ||
    /schema cache/i.test(msg)
  );
}

async function ownerScopedSelect(supabase, uid) {
  if (supabaseMedalsDisabled) return { data: [], error: null };
  const base = () => supabase.from('learner_medals').select('*');
  // Prefer plain select first to leverage RLS and avoid owner-column 404s
  const r0 = await base();
  if (!r0.error) return r0;
  if (isUndefinedColumnOrTable(r0.error)) { supabaseMedalsDisabled = true; return { data: [], error: null }; }
  // Fallback to explicit owner columns if needed (non-schema errors)
  if (supabaseOwnerColumn === 'user_id') return base().eq('user_id', uid);
  if (supabaseOwnerColumn === 'owner_id') return base().eq('owner_id', uid);
  const r1 = await base().eq('user_id', uid);
  if (!r1.error) { supabaseOwnerColumn = 'user_id'; return r1; }
  if (!isUndefinedColumnOrTable(r1.error)) return r1;
  const r2 = await base().eq('owner_id', uid);
  if (!r2.error) { supabaseOwnerColumn = 'owner_id'; return r2; }
  if (isUndefinedColumnOrTable(r2.error)) { supabaseOwnerColumn = 'none'; supabaseMedalsDisabled = true; }
  // If table/columns missing, synthesize empty rows
  return { data: [], error: null };
}

async function ownerScopedUpsert(supabase, uid, row) {
  if (supabaseMedalsDisabled) return { data: null, error: new Error('medals table disabled') };
  // Prefer RLS-only upsert (no owner column) first
  const plain = await supabase.from('learner_medals').upsert({ ...row }).select('*').maybeSingle();
  if (!plain.error) return plain;
  if (isUndefinedColumnOrTable(plain.error)) { supabaseMedalsDisabled = true; return { data: null, error: plain.error }; }
  // Try explicit owner fields if needed
  if (supabaseOwnerColumn === 'user_id') return supabase.from('learner_medals').upsert({ ...row, user_id: uid }).select('*').maybeSingle();
  if (supabaseOwnerColumn === 'owner_id') return supabase.from('learner_medals').upsert({ ...row, owner_id: uid }).select('*').maybeSingle();
  let r1 = await supabase.from('learner_medals').upsert({ ...row, user_id: uid }).select('*').maybeSingle();
  if (!r1.error) { supabaseOwnerColumn = 'user_id'; return r1; }
  if (!isUndefinedColumnOrTable(r1.error)) return r1;
  let r2 = await supabase.from('learner_medals').upsert({ ...row, owner_id: uid }).select('*').maybeSingle();
  if (!r2.error) { supabaseOwnerColumn = 'owner_id'; return r2; }
  if (isUndefinedColumnOrTable(r2.error)) { supabaseOwnerColumn = 'none'; supabaseMedalsDisabled = true; }
  return r2;
}

async function ownerScopedSelectOne(supabase, uid, where) {
  if (supabaseMedalsDisabled) return { data: null, error: null };
  const base = () => supabase.from('learner_medals').select('*').match(where).limit(1).maybeSingle();
  // Prefer RLS-only first
  const r0 = await base();
  if (!r0.error) return r0;
  if (isUndefinedColumnOrTable(r0.error)) { supabaseMedalsDisabled = true; return { data: null, error: null }; }
  // Fallback to explicit owner columns
  if (supabaseOwnerColumn === 'user_id') return supabase.from('learner_medals').select('*').match({ ...where, user_id: uid }).limit(1).maybeSingle();
  if (supabaseOwnerColumn === 'owner_id') return supabase.from('learner_medals').select('*').match({ ...where, owner_id: uid }).limit(1).maybeSingle();
  let r1 = await supabase.from('learner_medals').select('*').match({ ...where, user_id: uid }).limit(1).maybeSingle();
  if (!r1.error) { supabaseOwnerColumn = 'user_id'; return r1; }
  if (!isUndefinedColumnOrTable(r1.error)) return r1;
  let r2 = await supabase.from('learner_medals').select('*').match({ ...where, owner_id: uid }).limit(1).maybeSingle();
  if (!r2.error) { supabaseOwnerColumn = 'owner_id'; return r2; }
  if (isUndefinedColumnOrTable(r2.error)) { supabaseOwnerColumn = 'none'; supabaseMedalsDisabled = true; }
  // Missing table/columns => behave as if no record exists
  return { data: null, error: null };
}

export async function getMedalsForLearner(learnerId) {
  if (!learnerId) return {};
  const supabase = getSupabaseClient();
  if (supabase && hasSupabaseEnv()) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        const url = `/api/medals?learner_id=${encodeURIComponent(learnerId)}`;
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        if (resp.ok) {
          const json = await resp.json().catch(() => null);
          if (json && typeof json.medals === 'object') return json.medals;
        }
      }
    } catch (e) {
      // fall back local
    }
  }
  const all = readLocal();
  return all[learnerId] || {};
}

export async function upsertMedal(learnerId, lessonKey, percent) {
  if (!learnerId || !lessonKey) return false;
  const newTier = tierForPercent(percent);
  // Below 70%: record best percent locally but no tier; do not downgrade existing tier
  const supabase = getSupabaseClient();
  if (supabase && hasSupabaseEnv()) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        const resp = await fetch('/api/medals', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ learner_id: learnerId, lesson_key: lessonKey, percent: Number(percent) || 0 })
        });
        if (resp.ok) return true;
      }
    } catch (e) {
      // fall back to local storage if table/columns missing or other errors
    }
  }
  // local fallback
  const all = readLocal();
  const byLearner = all[learnerId] || {};
  const current = byLearner[lessonKey] || { bestPercent: 0, medalTier: null };
  const currentRank = TIER_RANK[current.medalTier || 'none'] || 0;
  const newRank = TIER_RANK[newTier || 'none'] || 0;
  const nextTier = newRank > currentRank ? newTier : current.medalTier;
  const bestPercent = Math.max(Number(current.bestPercent) || 0, Number(percent) || 0);
  byLearner[lessonKey] = { bestPercent, medalTier: nextTier || null };
  all[learnerId] = byLearner;
  writeLocal(all);
  return true;
}

export default { tierForPercent, emojiForTier, getMedalsForLearner, upsertMedal };
