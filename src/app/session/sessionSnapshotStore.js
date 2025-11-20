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
//   // Story persistence fields
//   storyState, storyUsedThisGate, storyTranscript,
//   storySetupStep, storyCharacters, storySetting, storyPlot, storyPhase,
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

function sanitizeStoryTranscript(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        if (!trimmed) return null;
        return { role: 'assistant', text: trimmed };
      }
      const text = typeof entry.text === 'string' ? entry.text.trim() : '';
      if (!text) return null;
      const role = entry.role === 'user' ? 'user' : 'assistant';
      return { role, text };
    })
    .filter(Boolean);
}

function sanitizeSentenceArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

function sanitizeTeachingFlowState(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const vocabSentences = sanitizeSentenceArray(obj.vocabSentences);
  const exampleSentences = sanitizeSentenceArray(obj.exampleSentences);
  const vocabSentenceIndex = Math.max(0, Math.min(vocabSentences.length ? vocabSentences.length - 1 : 0, Number(obj.vocabSentenceIndex) || 0));
  const exampleSentenceIndex = Math.max(0, Math.min(exampleSentences.length ? exampleSentences.length - 1 : 0, Number(obj.exampleSentenceIndex) || 0));
  const hasContent = vocabSentences.length || exampleSentences.length || vocabSentenceIndex || exampleSentenceIndex || obj.isInSentenceMode;
  if (!hasContent) return null;
  return {
    vocabSentences,
    vocabSentenceIndex,
    exampleSentences,
    exampleSentenceIndex,
    isInSentenceMode: !!obj.isInSentenceMode,
  };
}

function sanitizeTimerMode(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  const allowedPhases = ['discussion', 'comprehension', 'exercise', 'worksheet', 'test'];
  allowedPhases.forEach((phase) => {
    const mode = obj[phase];
    if (mode === 'play' || mode === 'work') {
      out[phase] = mode;
    }
  });
  return out;
}

function sanitizeWorkPhaseCompletions(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (typeof key === 'string') {
      out[key] = !!value;
    }
  });
  return out;
}

function sanitizeTimerStates(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (typeof key === 'string' && key.startsWith('session_timer_state:')) {
      try {
        out[key] = JSON.parse(JSON.stringify(value));
      } catch {
        // Ignore unserializable entries
      }
    }
  });
  return out;
}

export function normalizeSnapshot(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const storyStateOptions = ['inactive', 'awaiting-setup', 'awaiting-turn', 'ending'];
  const storySetupOptions = ['characters', 'setting', 'plot', 'complete'];
  const out = {
    // Snapshot version marker (v2 = atomic checkpoint system, v1 or undefined = old signature-based)
    snapshotVersion: Number.isFinite(obj.snapshotVersion) ? obj.snapshotVersion : undefined,
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

    congratsStarted: !!obj.congratsStarted,
    congratsDone: !!obj.congratsDone,

    captionSentences: sanitizeCaptionSentences(obj.captionSentences || []),
    captionIndex: Number.isFinite(obj.captionIndex) ? obj.captionIndex : 0,

    usedTestCuePhrases: Array.isArray(obj.usedTestCuePhrases) ? obj.usedTestCuePhrases : [],

    generatedComprehension: Array.isArray(obj.generatedComprehension) ? obj.generatedComprehension : null,
    generatedExercise: Array.isArray(obj.generatedExercise) ? obj.generatedExercise : null,
    generatedWorksheet: Array.isArray(obj.generatedWorksheet) ? obj.generatedWorksheet : null,
    generatedTest: Array.isArray(obj.generatedTest) ? obj.generatedTest : null,

    currentTimerMode: sanitizeTimerMode(obj.currentTimerMode),
    workPhaseCompletions: sanitizeWorkPhaseCompletions(obj.workPhaseCompletions),
    timerStates: sanitizeTimerStates(obj.timerStates),

    storyState: (typeof obj.storyState === 'string' && storyStateOptions.includes(obj.storyState))
      ? obj.storyState
      : 'inactive',
    storySetupStep: (typeof obj.storySetupStep === 'string' && storySetupOptions.includes(obj.storySetupStep))
      ? obj.storySetupStep
      : '',
    storyCharacters: typeof obj.storyCharacters === 'string' ? obj.storyCharacters : '',
    storySetting: typeof obj.storySetting === 'string' ? obj.storySetting : '',
    storyPlot: typeof obj.storyPlot === 'string' ? obj.storyPlot : '',
    storyPhase: typeof obj.storyPhase === 'string' ? obj.storyPhase : '',
    storyUsedThisGate: !!obj.storyUsedThisGate,
    storyTranscript: sanitizeStoryTranscript(obj.storyTranscript || []),
  teachingFlowState: sanitizeTeachingFlowState(obj.teachingFlowState),

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
  
  // Try localStorage first (instant, no replication lag)
  try {
    const lsKey = `atomic_snapshot:${learnerId}:${lessonKey}`;
    const cached = localStorage.getItem(lsKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object') {
        return normalizeSnapshot(parsed);
      }
    }
  } catch {}
  
  // Fallback to server (cross-device or localStorage cleared)
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
          if (data) {
            const normalized = normalizeSnapshot(data);
            // Update localStorage with server data
            try {
              const lsKey = `atomic_snapshot:${learnerId}:${lessonKey}`;
              localStorage.setItem(lsKey, JSON.stringify(normalized));
            } catch {}
            return normalized;
          }
        }
      }
    }
  } catch (e) {
    // Silent error handling
  }
  return null;
}

export async function saveSnapshot(lessonKey, snapshot, { learnerId } = {}) {
  if (typeof window === 'undefined') return;
  const payload = normalizeSnapshot({ ...(snapshot || {}), savedAt: new Date().toISOString() });
  
  // Save to localStorage IMMEDIATELY for instant restore on refresh
  try {
    const lsKey = `atomic_snapshot:${learnerId}:${lessonKey}`;
    localStorage.setItem(lsKey, JSON.stringify(payload));
  } catch {}
  
  // Save to server (slower but persistent across devices)
  try {
    const supabaseMod = await import('@/app/lib/supabaseClient');
    const supabase = supabaseMod.getSupabaseClient?.();
    const hasEnv = supabaseMod.hasSupabaseEnv?.();
    if (supabase && hasEnv && learnerId) {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        const response = await fetch('/api/snapshots', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ learner_id: learnerId, lesson_key: lessonKey, data: payload })
        });
        // Check if the save actually succeeded
        if (!response.ok) {
          console.error('[ATOMIC SNAPSHOT] Database save FAILED. Status:', response.status, 'Key:', lessonKey);
          const text = await response.text().catch(() => '(no response body)');
          console.error('[ATOMIC SNAPSHOT] Error response:', text);
        } else {
          const json = await response.json().catch(() => null);
          if (json && !json.ok) {
            console.error('[ATOMIC SNAPSHOT] Database save returned ok:false. Response:', json);
          }
        }
      }
    }
  } catch (e) {
    console.error('[ATOMIC SNAPSHOT] Save exception:', e);
  }
}

export async function clearSnapshot(lessonKey, { learnerId } = {}) {
  if (typeof window === 'undefined') return;
  // Delete from server only (no localStorage)
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
  } catch (e) {
    // Silent error handling
  }
}

// Consolidate legacy/variant keys - no-op now that snapshots are server-only
export async function consolidateSnapshots(lessonKey, { learnerId } = {}) {
  // No-op: snapshots are stored server-side only
  return;
}

const api = { getStoredSnapshot, saveSnapshot, clearSnapshot, consolidateSnapshots };
export default api;
