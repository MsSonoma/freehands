// Local snapshot persistence for full session state (per learner + lesson key)
// Shape: {
//   // Core UI flow
//   phase, subPhase, showBegin, ticker,
//   teachingStage,                // 'idle' | 'definitions' | 'explanation' | 'examples'
//   stageRepeats,                 // { definitions: number, explanation: number, examples: number }
//   qaAnswersUnlocked, jokeUsedThisGate, riddleUsedThisGate, poemUsedThisGate,
//   currentCompIndex, currentExIndex, currentWorksheetIndex, testActiveIndex,
//   currentCompProblem, currentExerciseProblem,
//   testUserAnswers, testCorrectByIndex, testCorrectCount, testFinalPercent,
//   captionSentences, captionIndex,
//   usedTestCuePhrases,
//
//   // Normalized resume pointer (authoritative minimal state)
//   // kind: 'phase-entrance' | 'question' | 'teaching-stage'
//   // phase: 'discussion'|'teaching'|'comprehension'|'exercise'|'worksheet'|'test'
//   // stage?: for teaching-stage kind ('definitions'|'explanation'|'examples')
//   // index?: 1-based question index when kind === 'question'
//   // ticker?: current correct count snapshot
//   resume,
//
//   savedAt
// }

const KEY_PREFIX = 'lesson_session:';

function canonicalLessonKey(k) {
  try { return String(k || '').replace(/\.json$/i, ''); } catch { return String(k || ''); }
}
function buildKey(lessonKey, learnerId) {
  const lid = learnerId || 'none';
  const base = canonicalLessonKey(lessonKey);
  return `${KEY_PREFIX}${base}:L:${lid}`;
}

function sanitizeCaptionSentences(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((ln) => {
    if (ln && typeof ln === 'object' && typeof ln.text === 'string') {
      return { text: String(ln.text), role: ln.role === 'user' ? 'user' : 'assistant' };
    }
    return String(ln ?? '');
  });
}

export function normalizeSnapshot(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const out = {
    phase: obj.phase || 'discussion',
    subPhase: obj.subPhase || 'greeting',
    showBegin: !!obj.showBegin,
    ticker: Number.isFinite(obj.ticker) ? obj.ticker : 0,

    teachingStage: (typeof obj.teachingStage === 'string' && ['idle','definitions','explanation','examples'].includes(obj.teachingStage))
      ? obj.teachingStage
      : 'idle',
    stageRepeats: (obj.stageRepeats && typeof obj.stageRepeats === 'object')
      ? {
          definitions: Number.isFinite(obj.stageRepeats.definitions) ? obj.stageRepeats.definitions : 0,
          explanation: Number.isFinite(obj.stageRepeats.explanation) ? obj.stageRepeats.explanation : 0,
          examples: Number.isFinite(obj.stageRepeats.examples) ? obj.stageRepeats.examples : 0,
        }
      : { definitions: 0, explanation: 0, examples: 0 },

    qaAnswersUnlocked: !!obj.qaAnswersUnlocked,
    jokeUsedThisGate: !!obj.jokeUsedThisGate,
    riddleUsedThisGate: !!obj.riddleUsedThisGate,
    poemUsedThisGate: !!obj.poemUsedThisGate,

    currentCompIndex: Number.isFinite(obj.currentCompIndex) ? obj.currentCompIndex : 0,
    currentExIndex: Number.isFinite(obj.currentExIndex) ? obj.currentExIndex : 0,
    currentWorksheetIndex: Number.isFinite(obj.currentWorksheetIndex) ? obj.currentWorksheetIndex : 0,
    testActiveIndex: Number.isFinite(obj.testActiveIndex) ? obj.testActiveIndex : 0,

    currentCompProblem: obj.currentCompProblem || null,
    currentExerciseProblem: obj.currentExerciseProblem || null,

    testUserAnswers: Array.isArray(obj.testUserAnswers) ? obj.testUserAnswers : [],
    testCorrectByIndex: Array.isArray(obj.testCorrectByIndex) ? obj.testCorrectByIndex : [],
    testCorrectCount: Number.isFinite(obj.testCorrectCount) ? obj.testCorrectCount : 0,
    testFinalPercent: (typeof obj.testFinalPercent === 'number') ? obj.testFinalPercent : null,

    captionSentences: sanitizeCaptionSentences(obj.captionSentences || []),
    captionIndex: Number.isFinite(obj.captionIndex) ? obj.captionIndex : 0,

    usedTestCuePhrases: Array.isArray(obj.usedTestCuePhrases) ? obj.usedTestCuePhrases : [],

    // Normalized resume pointer (kept minimal and safe)
    resume: (() => {
      const r = obj.resume;
      if (!r || typeof r !== 'object') return null;
      const kind = (typeof r.kind === 'string' && ['phase-entrance','question','teaching-stage'].includes(r.kind)) ? r.kind : null;
      const phase = (typeof r.phase === 'string' && ['discussion','teaching','comprehension','exercise','worksheet','test'].includes(r.phase)) ? r.phase : null;
      const stage = (typeof r.stage === 'string' && ['definitions','explanation','examples'].includes(r.stage)) ? r.stage : undefined;
      const index = Number.isFinite(r.index) && r.index >= 0 ? Math.floor(r.index) : undefined;
      const ticker = Number.isFinite(r.ticker) && r.ticker >= 0 ? Math.floor(r.ticker) : undefined;
      if (!kind || !phase) return null;
      const base = { kind, phase };
      if (kind === 'teaching-stage' && stage) return { ...base, stage };
      if (kind === 'question' && (typeof index === 'number')) return { ...base, index, ticker: typeof ticker === 'number' ? ticker : undefined };
      if (kind === 'phase-entrance') return { ...base, ticker: typeof ticker === 'number' ? ticker : undefined };
      return { ...base };
    })(),

    savedAt: obj.savedAt || new Date().toISOString(),
  };
  return out;
}

export async function getStoredSnapshot(lessonKey, { learnerId } = {}) {
  if (typeof window === 'undefined') return null;
  // Try remote first when authenticated
  try {
    const supabase = (await import('@/app/lib/supabaseClient')).getSupabaseClient?.();
    const hasEnv = (await import('@/app/lib/supabaseClient')).hasSupabaseEnv?.();
    if (supabase && hasEnv && learnerId) {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        const url = `/api/snapshots?learner_id=${encodeURIComponent(learnerId)}&lesson_key=${encodeURIComponent(lessonKey)}`;
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        if (resp.ok) {
          const json = await resp.json().catch(() => null);
          const data = json?.snapshot || null;
          if (data) return normalizeSnapshot(data);
        }
      }
    }
  } catch (e) {
    // fall through to local
  }
  // Local fallback
  try {
    const k = buildKey(lessonKey, learnerId);
    const raw = localStorage.getItem(k);
    if (raw) {
      const parsed = JSON.parse(raw);
      return normalizeSnapshot(parsed);
    }
    // Legacy/local compatibility: search for any prior keys that used a suffixed lessonKey variant
    // such as `${lessonKey}:W<T>:T<U>` (order may vary) before the `:L:<learnerId>` suffix.
    // Choose the most recent by savedAt.
    let best = null;
    let bestAt = 0;
    const PREFIX = KEY_PREFIX;
    const suffix = `:L:${learnerId || 'none'}`;
    const canon = canonicalLessonKey(lessonKey);
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      if (!key.endsWith(suffix)) continue;
      // Extract the lessonKey portion between prefix and suffix
      const middle = key.slice(PREFIX.length, key.length - suffix.length);
      // Accept exact match or legacy variants that start with the provided lessonKey
      if (!middle) continue;
      // Match canonical or extension variant and legacy suffixed forms
      const middleCanon = canonicalLessonKey(middle);
      if (middleCanon !== canon && !middleCanon.startsWith(`${canon}:`)) continue;
      try {
        const val = localStorage.getItem(key);
        if (!val) continue;
        const parsed = JSON.parse(val);
        const norm = normalizeSnapshot(parsed);
        const t = Date.parse(norm?.savedAt || '') || 0;
        if (t >= bestAt) { best = norm; bestAt = t; }
      } catch { /* ignore parse errors */ }
    }
    if (best) return best;
    return null;
  } catch (e) {
    console.warn('[sessionSnapshotStore] Failed to load snapshot', e);
    return null;
  }
}

export async function saveSnapshot(lessonKey, snapshot, { learnerId } = {}) {
  if (typeof window === 'undefined') return;
  const payload = normalizeSnapshot({ ...(snapshot || {}), savedAt: new Date().toISOString() });
  // Write local immediately
  try {
    const k = buildKey(lessonKey, learnerId);
    localStorage.setItem(k, JSON.stringify(payload));
  } catch (e) { console.warn('[sessionSnapshotStore] Failed to save local snapshot', e); }
  // Best-effort remote
  try {
    const supabaseMod = await import('@/app/lib/supabaseClient');
    const supabase = supabaseMod.getSupabaseClient?.();
    const hasEnv = supabaseMod.hasSupabaseEnv?.();
    if (supabase && hasEnv && learnerId) {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        await fetch('/api/snapshots', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ learner_id: learnerId, lesson_key: lessonKey, data: payload })
        }).catch(() => {});
      }
    }
  } catch (e) {
    // ignore, local already saved
  }
}

export async function clearSnapshot(lessonKey, { learnerId } = {}) {
  if (typeof window === 'undefined') return;
  try {
    const k = buildKey(lessonKey, learnerId);
    localStorage.removeItem(k);
  } catch (e) {
    console.warn('[sessionSnapshotStore] Failed to clear local snapshot', e);
  }
  // Best-effort remote delete
  try {
    const supabaseMod = await import('@/app/lib/supabaseClient');
    const supabase = supabaseMod.getSupabaseClient?.();
    const hasEnv = supabaseMod.hasSupabaseEnv?.();
    if (supabase && hasEnv && learnerId) {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        const url = `/api/snapshots?learner_id=${encodeURIComponent(learnerId)}&lesson_key=${encodeURIComponent(lessonKey)}`;
        await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
      }
    }
  } catch (e) { /* ignore */ }
}

// Consolidate legacy/variant keys down to the canonical key for the given lessonKey + learner.
// Keeps the most recent snapshot and removes other matching variant keys.
export async function consolidateSnapshots(lessonKey, { learnerId } = {}) {
  if (typeof window === 'undefined') return;
  try {
    const targetKey = buildKey(lessonKey, learnerId);
    const PREFIX = KEY_PREFIX;
    const suffix = `:L:${learnerId || 'none'}`;
    const canon = canonicalLessonKey(lessonKey);
    let newest = null;
    let newestAt = 0;
    const candidates = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      if (!k.endsWith(suffix)) continue;
      const middle = k.slice(PREFIX.length, k.length - suffix.length);
      if (!middle) continue;
      const midCanon = canonicalLessonKey(middle);
      if (midCanon !== canon && !midCanon.startsWith(`${canon}:`)) continue;
      candidates.push(k);
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const norm = normalizeSnapshot(parsed);
        const t = Date.parse(norm?.savedAt || '') || 0;
        if (t >= newestAt) { newest = norm; newestAt = t; }
      } catch { /* ignore parse errors */ }
    }
    if (!candidates.length) return;
    if (newest) {
      try { localStorage.setItem(targetKey, JSON.stringify({ ...newest, savedAt: new Date().toISOString() })); } catch {}
    }
    for (const k of candidates) {
      if (k === targetKey) continue;
      try { localStorage.removeItem(k); } catch {}
    }
  } catch (e) {
    console.warn('[sessionSnapshotStore] consolidate failed', e);
  }
}

const api = { getStoredSnapshot, saveSnapshot, clearSnapshot, consolidateSnapshots };
export default api;
