"use client";

import { getSupabaseClient, hasSupabaseEnv } from '@/app/lib/supabaseClient';
import { featuresForTier } from '@/app/lib/entitlements';

const LS_KEY = 'facilitator_learners';

// Adaptive Supabase schema mode for learners table:
// 'flat'   -> columns: comprehension, exercise, worksheet, test (numbers)
// 'json'   -> column: targets (JSONB) with { comprehension, exercise, worksheet, test }
// 'disabled' -> use localStorage fallback due to incompatible schema
let supabaseLearnersMode = null; // null|'flat'|'json'|'disabled'
let supabaseOwnerColumn = null; // null|'facilitator_id'|'owner_id'|'user_id'|'none'
let supabaseLearnersHasCreatedAt = undefined; // undefined => unknown; boolean once probed

const HUMOR_LEVELS = ['calm', 'funny', 'hilarious'];
const DEFAULT_HUMOR_LEVEL = 'calm';

function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function isUndefinedColumnOrTable(error) {
  const msg = error?.message || '';
  return (
    error?.code === '42703' || // undefined_column
    error?.code === '42P01' || // undefined_table
    /column .* does not exist/i.test(msg) ||
    /could not find .* column/i.test(msg) ||
    /relation .* does not exist/i.test(msg) ||
    /schema cache/i.test(msg)
  );
}

function resolveHumorLevel(value, fallback = DEFAULT_HUMOR_LEVEL) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  return HUMOR_LEVELS.includes(normalized) ? normalized : fallback;
}

function readLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map(item => ({
      ...item,
      humor_level: resolveHumorLevel(item?.humor_level ?? null, DEFAULT_HUMOR_LEVEL),
    }));
  } catch { return []; }
}
function writeLocal(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

export async function listLearners() {
  const supabase = getSupabaseClient();
  if (supabase && hasSupabaseEnv()) {
    if (supabaseLearnersMode === 'disabled') return readLocal();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    // If there's no session (user not logged in), clear local cache and return empty
    if (userErr || !userData?.user?.id) {
      // Clear any cached learners from previous sessions
      try { writeLocal([]); } catch {}
      return [];
    }
    const uid = userData.user.id;

    // Prefer relying on RLS to scope rows (no owner filter) and avoid 400s
    // from unknown owner columns across environments.
    const result = await selectByOwner(supabase, uid, '*', { orderByCreated: false });
    if (result.error) {
      if (isUndefinedColumnOrTable(result.error)) { supabaseLearnersMode = 'disabled'; return readLocal(); }
      throw new Error(result.error.message || 'Failed to list learners');
    }
    const list = (result.data || []).map(normalizeRow);
    // Keep a local, offline-friendly cache in sync with Supabase results.
    // This clears out any stale, previously hardcoded or demo entries (e.g., "Emma").
    try { writeLocal(list); } catch {}
    return list;
  }
  return readLocal();
}

export async function createLearner(payload) {
  const supabase = getSupabaseClient();
  if (supabase && hasSupabaseEnv()) {
    if (supabaseLearnersMode === 'disabled') {
      // In local mode, still respect the user's actual plan tier if available
      const list = readLocal();
      let tier = 'free';
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id;
        if (uid) {
          tier = await getPlanTier(supabase, uid);
        }
      } catch {}
      const ent = featuresForTier(tier);
      if (Number.isFinite(ent.learnersMax) && list.length >= ent.learnersMax) {
        throw new Error(`You've reached the maximum learners for your ${tier} plan (${ent.learnersMax}). Upgrade your plan to add more.`);
      }
      return createLocal(payload);
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw new Error(userErr.message || 'Auth error');
    const uid = userData?.user?.id;
    if (!uid) throw new Error('Please log in to create learners');

    // Gate by plan: read plan tier and current count
    const planTier = await getPlanTier(supabase, uid);
    const ent = featuresForTier(planTier);
    const currentCount = await countLearners(supabase, uid);
    if (Number.isFinite(ent.learnersMax) && currentCount >= ent.learnersMax) {
      throw new Error(`You've reached the maximum learners for your ${planTier} plan (${ent.learnersMax}). Upgrade your plan to add more.`);
    }
    const flat = toFlatTargets(payload);
    const { humor_level: flatHumorLevel, ...targetValues } = flat;
    const tryFlat = supabaseLearnersMode !== 'json';
    const humorLevel = flatHumorLevel ?? resolveHumorLevel(payload.humor_level, DEFAULT_HUMOR_LEVEL);
    if (tryFlat) {
      const { data, error } = await insertWithOwner(supabase, {
        name: payload.name,
        grade: payload.grade,
        comprehension: targetValues.comprehension,
        exercise: targetValues.exercise,
        worksheet: targetValues.worksheet,
        test: targetValues.test,
        session_timer_minutes: payload.session_timer_minutes,
        golden_keys: payload.golden_keys !== undefined ? Number(payload.golden_keys) : 0,
        active_golden_keys: payload.active_golden_keys || {},
        humor_level: humorLevel,
      }, uid);
      if (!error) { supabaseLearnersMode = 'flat'; return normalizeRow(data); }
      if (!isUndefinedColumnOrTable(error)) throw new Error(error.message || 'Failed to create learner');
      // fallthrough to JSON mode
    }
    // Try JSON targets column
    const { data: data2, error: error2 } = await insertWithOwner(supabase, {
      name: payload.name,
      grade: payload.grade,
      targets: targetValues,
      humor_level: humorLevel,
    }, uid);
    if (!error2) { supabaseLearnersMode = 'json'; return normalizeRow(data2); }
    if (isUndefinedColumnOrTable(error2)) { supabaseLearnersMode = 'disabled'; return createLocal(payload); }
    throw new Error(error2.message || 'Failed to create learner');
  }
  return createLocal(payload);
}

export async function getLearner(id) {
  const supabase = getSupabaseClient();
  if (supabase && hasSupabaseEnv()) {
    if (supabaseLearnersMode === 'disabled') {
      return readLocal().find(x => x.id === id) || null;
    }
    // If id is not a UUID, try to upgrade legacy local id -> Supabase UUID by name
    if (!isUuid(id)) {
      const local = readLocal().find(x => x.id === id) || null;
      // Attempt name-based mapping to a Supabase learner the facilitator owns
      const learnerName = typeof window !== 'undefined' ? (localStorage.getItem('learner_name') || local?.name || '').trim() : '';
      if (learnerName) {
        try {
          // Load current learners (Supabase-first) and find by exact name
          const list = await listLearners();
          const match = Array.isArray(list) ? list.find(x => x?.name === learnerName && isUuid(x?.id)) : null;
          if (match && isUuid(match.id)) {
            try {
              // Persist the upgraded UUID for future navigations
              localStorage.setItem('learner_id', match.id);
              localStorage.setItem('learner_name', match.name);
            } catch {}
            // Use the upgraded id going forward
            id = match.id;
          }
        } catch {}
      }
      // If still not a UUID after attempted upgrade, only return local (avoid invalid UUID query)
      if (!isUuid(id)) {
        return local || null;
      }
    }
    const { data, error } = await supabase.from('learners').select('*').eq('id', id).maybeSingle();
    if (error) {
      if (isUndefinedColumnOrTable(error)) {
        supabaseLearnersMode = 'disabled';
        return readLocal().find(x => x.id === id) || null;
      }
      throw new Error(error.message || 'Failed to fetch learner');
    }
    if (!data) {
      // Fallback to local if id refers to locally-stored learner
      return readLocal().find(x => x.id === id) || null;
    }
    return normalizeRow(data);
  }
  return readLocal().find(x => x.id === id) || null;
}

export async function updateLearner(id, updates) {
  console.log('🔧 updateLearner called with:', { id, updates });
  const supabase = getSupabaseClient();
  if (supabase && hasSupabaseEnv()) {
    if (supabaseLearnersMode === 'disabled') return updateLocal(id, updates);
    if (typeof id === 'string' && !/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/i.test(id)) {
      return updateLocal(id, updates);
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw new Error(userErr.message || 'Auth error');
    const uid = userData?.user?.id;
    if (!uid) throw new Error('Please log in to update learners');
    const flat = toFlatTargets(updates);
    const { humor_level: flatHumorLevel, ...targetValues } = flat;
    const humorLevel = flatHumorLevel ?? (updates.humor_level !== undefined ? resolveHumorLevel(updates.humor_level, DEFAULT_HUMOR_LEVEL) : undefined);
    console.log('📦 toFlatTargets returned:', flat);
    const tryFlat = supabaseLearnersMode !== 'json';
    if (tryFlat) {
      const updatePayload = {
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.grade !== undefined ? { grade: updates.grade } : {}),
        ...(targetValues.comprehension !== undefined ? { comprehension: targetValues.comprehension } : {}),
        ...(targetValues.exercise !== undefined ? { exercise: targetValues.exercise } : {}),
        ...(targetValues.worksheet !== undefined ? { worksheet: targetValues.worksheet } : {}),
        ...(targetValues.test !== undefined ? { test: targetValues.test } : {}),
        ...(updates.session_timer_minutes !== undefined ? { session_timer_minutes: updates.session_timer_minutes } : {}),
        ...(updates.golden_keys !== undefined ? { golden_keys: Number(updates.golden_keys) } : {}),
        ...(updates.active_golden_keys !== undefined ? { active_golden_keys: updates.active_golden_keys } : {}),
        ...(typeof humorLevel === 'string' ? { humor_level: humorLevel } : {}),
      };
      console.log('📤 Sending to Supabase (flat mode):', updatePayload);
      const { data, error } = await updateWithOwner(supabase, id, updatePayload, uid);
      if (!error) { 
        supabaseLearnersMode = 'flat'; 
        const normalized = normalizeRow(data);
        console.log('✅ Supabase update successful, normalized:', normalized);
        return normalized;
      }
      if (!isUndefinedColumnOrTable(error)) throw new Error(error.message || 'Failed to update learner');
      // fallthrough to JSON mode
    }
    const jsonPayload = {
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.grade !== undefined ? { grade: updates.grade } : {}),
      ...(Object.keys(targetValues).length > 0 ? { targets: targetValues } : {}),
      ...(typeof humorLevel === 'string' ? { humor_level: humorLevel } : {}),
    };
    const { data: data2, error: error2 } = await updateWithOwner(supabase, id, jsonPayload, uid);
    if (!error2) { supabaseLearnersMode = 'json'; return normalizeRow(data2); }
    if (isUndefinedColumnOrTable(error2)) { supabaseLearnersMode = 'disabled'; return updateLocal(id, updates); }
    throw new Error(error2.message || 'Failed to update learner');
  }
  return updateLocal(id, updates);
}

export async function deleteLearner(id) {
  const supabase = getSupabaseClient();
  if (supabase && hasSupabaseEnv()) {
    if (supabaseLearnersMode === 'disabled') return deleteLocal(id);
    if (typeof id === 'string' && !/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/i.test(id)) {
      return deleteLocal(id);
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw new Error(userErr.message || 'Auth error');
    const uid = userData?.user?.id;
    if (!uid) throw new Error('Please log in to delete learners');
    const { error } = await deleteWithOwner(supabase, id, uid);
    if (error) {
      if (isUndefinedColumnOrTable(error)) { supabaseLearnersMode = 'disabled'; return deleteLocal(id); }
      throw new Error(error.message || 'Failed to delete learner');
    }
    return true;
  }
  return deleteLocal(id);
}

// Helpers
function normalizeRow(row) {
  if (!row) return row;
  const c = (v)=> (v == null ? undefined : Number(v));
  const humorLevel = resolveHumorLevel(row.humor_level ?? row.preferences?.humor_level ?? null, DEFAULT_HUMOR_LEVEL);
  const merged = {
    ...row,
    comprehension: c(row.comprehension ?? row.targets?.comprehension),
    exercise: c(row.exercise ?? row.targets?.exercise),
    worksheet: c(row.worksheet ?? row.targets?.worksheet),
    test: c(row.test ?? row.targets?.test),
    session_timer_minutes: c(row.session_timer_minutes),
    golden_keys: c(row.golden_keys),
    active_golden_keys: row.active_golden_keys || {},
    humor_level: humorLevel,
  };
  // console.log('🔄 normalizeRow input:', row, 'output:', merged); // Removed: excessive logging
  return merged;
}

function toFlatTargets(obj) {
  const t = obj.targets || obj;
  const result = {
    comprehension: Number(t.comprehension),
    exercise: Number(t.exercise),
    worksheet: Number(t.worksheet),
    test: Number(t.test),
    session_timer_minutes: obj.session_timer_minutes !== undefined ? Number(obj.session_timer_minutes) : undefined,
    golden_keys: obj.golden_keys !== undefined ? Number(obj.golden_keys) : undefined,
    active_golden_keys: obj.active_golden_keys !== undefined ? obj.active_golden_keys : undefined,
  };
  const humor = resolveHumorLevel(obj.humor_level ?? t.humor_level ?? null, null);
  if (typeof humor === 'string') {
    result.humor_level = humor;
  }
  console.log('🔄 toFlatTargets input:', obj, 'output:', result);
  return result;
}

function createLocal(payload) {
  const list = readLocal();
  const id = Date.now().toString(36);
  const flat = toFlatTargets(payload);
  const { humor_level: flatHumorLevel, ...targetValues } = flat;
  const humorLevel = flatHumorLevel ?? resolveHumorLevel(payload.humor_level, DEFAULT_HUMOR_LEVEL);
  const item = { 
    id, 
    name: payload.name, 
    grade: payload.grade, 
    ...targetValues,
    session_timer_minutes: payload.session_timer_minutes !== undefined ? Number(payload.session_timer_minutes) : 60,
    golden_keys: payload.golden_keys !== undefined ? Number(payload.golden_keys) : 0,
    active_golden_keys: payload.active_golden_keys || {},
    humor_level: humorLevel,
  };
  list.unshift(item); writeLocal(list); return item;
}

function updateLocal(id, updates) {
  const list = readLocal();
  const idx = list.findIndex(x => x.id === id);
  if (idx !== -1) {
    const flat = toFlatTargets(updates);
    const { humor_level: flatHumorLevel, ...targetValues } = flat;
    const humorLevel = flatHumorLevel ?? (updates.humor_level !== undefined ? resolveHumorLevel(updates.humor_level, DEFAULT_HUMOR_LEVEL) : (list[idx].humor_level ?? DEFAULT_HUMOR_LEVEL));
    const updated = { 
      ...list[idx], 
      name: updates.name, 
      grade: updates.grade, 
      ...targetValues,
      ...(updates.session_timer_minutes !== undefined ? { session_timer_minutes: Number(updates.session_timer_minutes) } : {}),
      ...(updates.golden_keys !== undefined ? { golden_keys: Number(updates.golden_keys) } : {}),
      ...(updates.active_golden_keys !== undefined ? { active_golden_keys: updates.active_golden_keys } : {}),
      humor_level: humorLevel,
    };
    list[idx] = updated; writeLocal(list); return updated;
  }
  return null;
}

function deleteLocal(id) {
  const list = readLocal().filter(x => x.id !== id); writeLocal(list); return true;
}

// Owner scoping helpers
async function selectByOwner(supabase, uid, selectArg = '*', { orderByCreated = false } = {}) {
  const base = () => supabase.from('learners').select(selectArg);

  // One-time probe: check if created_at exists to avoid 400 from PostgREST
  async function ensureCreatedAtProbe() {
    if (!orderByCreated) return;
    if (typeof supabaseLearnersHasCreatedAt === 'boolean') return;
    try {
      const probe = await supabase.from('learners').select('created_at').limit(1);
      supabaseLearnersHasCreatedAt = !probe.error;
    } catch {
      supabaseLearnersHasCreatedAt = false;
    }
  }

  await ensureCreatedAtProbe();

  const run = async (ownerCol) => {
    let q = ownerCol ? base().eq(ownerCol, uid) : base();
    if (orderByCreated && supabaseLearnersHasCreatedAt) {
      q = q.order('created_at', { ascending: false });
    }
    let res = await q;
    // If created_at column is missing, try again without ordering
    if (res.error && isUndefinedColumnOrTable(res.error) && /created_at/i.test(res.error.message || '')) {
      supabaseLearnersHasCreatedAt = false; // remember so future calls skip order
      res = await (ownerCol ? base().eq(ownerCol, uid) : base());
    }
    return res;
  };

  // First try without owner filter to leverage RLS and avoid 400s on unknown columns
  const r0 = await run(null);
  if (!r0.error) { supabaseOwnerColumn = 'none'; return r0; }
  // If it's an unrelated error (not undefined column/table), return it
  if (!isUndefinedColumnOrTable(r0.error)) return r0;

  // Otherwise, try explicit owner columns
  if (supabaseOwnerColumn === 'facilitator_id') {
    return await run('facilitator_id');
  }
  if (supabaseOwnerColumn === 'user_id') {
    return await run('user_id');
  }
  if (supabaseOwnerColumn === 'owner_id') {
    return await run('owner_id');
  }
  // Prefer facilitator_id, then owner_id, then user_id
  const rf = await run('facilitator_id');
  if (!rf.error) { supabaseOwnerColumn = 'facilitator_id'; return rf; }
  if (!isUndefinedColumnOrTable(rf.error)) return rf; // other error
  const r2 = await run('owner_id');
  if (!r2.error) { supabaseOwnerColumn = 'owner_id'; return r2; }
  if (!isUndefinedColumnOrTable(r2.error)) return r2; // other error
  const r1 = await run('user_id');
  if (!r1.error) { supabaseOwnerColumn = 'user_id'; return r1; }
  if (isUndefinedColumnOrTable(r1.error)) { supabaseOwnerColumn = 'none'; }
  return r1;
}

async function insertWithOwner(supabase, row, uid) {
  if (supabaseOwnerColumn === 'facilitator_id') {
    return await supabase.from('learners').insert({ ...row, facilitator_id: uid }).select('*').maybeSingle();
  }
  if (supabaseOwnerColumn === 'owner_id') {
    return await supabase.from('learners').insert({ ...row, owner_id: uid }).select('*').maybeSingle();
  }
  if (supabaseOwnerColumn === 'user_id') {
    return await supabase.from('learners').insert({ ...row, user_id: uid }).select('*').maybeSingle();
  }
  // Try facilitator_id, then owner_id, then user_id
  let rf = await supabase.from('learners').insert({ ...row, facilitator_id: uid }).select('*').maybeSingle();
  if (!rf.error) { supabaseOwnerColumn = 'facilitator_id'; return rf; }
  if (!isUndefinedColumnOrTable(rf.error)) return rf;
  let r2 = await supabase.from('learners').insert({ ...row, owner_id: uid }).select('*').maybeSingle();
  if (!r2.error) { supabaseOwnerColumn = 'owner_id'; return r2; }
  if (!isUndefinedColumnOrTable(r2.error)) return r2;
  let r1 = await supabase.from('learners').insert({ ...row, user_id: uid }).select('*').maybeSingle();
  if (!r1.error) { supabaseOwnerColumn = 'user_id'; return r1; }
  if (isUndefinedColumnOrTable(r1.error)) { supabaseOwnerColumn = 'none'; }
  return r1;
}

async function updateWithOwner(supabase, id, updates, uid) {
  if (supabaseOwnerColumn === 'facilitator_id') {
    return await supabase.from('learners').update(updates).eq('id', id).eq('facilitator_id', uid).select('*').maybeSingle();
  }
  if (supabaseOwnerColumn === 'owner_id') {
    return await supabase.from('learners').update(updates).eq('id', id).eq('owner_id', uid).select('*').maybeSingle();
  }
  if (supabaseOwnerColumn === 'user_id') {
    return await supabase.from('learners').update(updates).eq('id', id).eq('user_id', uid).select('*').maybeSingle();
  }
  // Try with facilitator_id, then owner_id, then user_id; else fallback to id-only
  let rf = await supabase.from('learners').update(updates).eq('id', id).eq('facilitator_id', uid).select('*').maybeSingle();
  if (!rf.error) { supabaseOwnerColumn = 'facilitator_id'; return rf; }
  if (!isUndefinedColumnOrTable(rf.error)) return rf;
  let r2 = await supabase.from('learners').update(updates).eq('id', id).eq('owner_id', uid).select('*').maybeSingle();
  if (!r2.error) { supabaseOwnerColumn = 'owner_id'; return r2; }
  if (!isUndefinedColumnOrTable(r2.error)) return r2;
  let r1 = await supabase.from('learners').update(updates).eq('id', id).eq('user_id', uid).select('*').maybeSingle();
  if (!r1.error) { supabaseOwnerColumn = 'user_id'; return r1; }
  if (isUndefinedColumnOrTable(r1.error)) { supabaseOwnerColumn = 'none'; }
  // Fallback without owner filter (not ideal but avoids hard failure if schema lacks owner column)
  return await supabase.from('learners').update(updates).eq('id', id).select('*').maybeSingle();
}

async function deleteWithOwner(supabase, id, uid) {
  if (supabaseOwnerColumn === 'facilitator_id') {
    return await supabase.from('learners').delete().eq('id', id).eq('facilitator_id', uid);
  }
  if (supabaseOwnerColumn === 'owner_id') {
    return await supabase.from('learners').delete().eq('id', id).eq('owner_id', uid);
  }
  if (supabaseOwnerColumn === 'user_id') {
    return await supabase.from('learners').delete().eq('id', id).eq('user_id', uid);
  }
  // Try with facilitator_id, then owner_id, then user_id; else fallback to id-only
  let rf = await supabase.from('learners').delete().eq('id', id).eq('facilitator_id', uid);
  if (!rf.error) { supabaseOwnerColumn = 'facilitator_id'; return rf; }
  if (!isUndefinedColumnOrTable(rf.error)) return rf;
  let r2 = await supabase.from('learners').delete().eq('id', id).eq('owner_id', uid);
  if (!r2.error) { supabaseOwnerColumn = 'owner_id'; return r2; }
  if (!isUndefinedColumnOrTable(r2.error)) return r2;
  let r1 = await supabase.from('learners').delete().eq('id', id).eq('user_id', uid);
  if (!r1.error) { supabaseOwnerColumn = 'user_id'; return r1; }
  if (isUndefinedColumnOrTable(r1.error)) { supabaseOwnerColumn = 'none'; }
  return await supabase.from('learners').delete().eq('id', id);
}

// Plan and counting helpers for gating
async function getPlanTier(supabase, uid) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('plan_tier')
      .eq('id', uid)
      .maybeSingle();
    if (error) return 'free';
    const tier = (data?.plan_tier || 'free').toLowerCase();
    return tier;
  } catch {
    return 'free';
  }
}

async function countLearners(supabase, uid) {
  const res = await selectByOwner(supabase, uid, 'id', { orderByCreated: false });
  if (res.error) return 0;
  return (res.data || []).length;
}
