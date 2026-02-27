'use client';

const LS_PREFIX = 'flashcards_progress_v1:';
export const FLASHCARDS_PROGRESS_LESSON_KEY = 'flashcards_progress_v1';

export function getFlashcardsProgressLocalStorageKey(learnerId) {
  return `${LS_PREFIX}${learnerId || 'anon'}`;
}

export function loadFlashcardsProgressLocal(learnerId) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getFlashcardsProgressLocalStorageKey(learnerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveFlashcardsProgressLocal(learnerId, progress) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      getFlashcardsProgressLocalStorageKey(learnerId),
      JSON.stringify(progress && typeof progress === 'object' ? progress : {})
    );
  } catch {
    // ignore
  }
}

async function getAccessToken() {
  try {
    const supabaseMod = await import('@/app/lib/supabaseClient');
    const supabase = supabaseMod.getSupabaseClient?.();
    const hasEnv = supabaseMod.hasSupabaseEnv?.();
    if (!supabase || !hasEnv) return null;

    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
}

export async function fetchFlashcardsProgressRemote(learnerId) {
  if (typeof window === 'undefined') return null;
  if (!learnerId || learnerId === 'anon') return null;

  const token = await getAccessToken();
  if (!token) return null;

  const url = `/api/snapshots?learner_id=${encodeURIComponent(learnerId)}&lesson_key=${encodeURIComponent(FLASHCARDS_PROGRESS_LESSON_KEY)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 1500);
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: ctrl.signal,
  }).catch(() => null);
  clearTimeout(t);
  if (!resp?.ok) return null;

  const json = await resp.json().catch(() => null);
  const data = json?.snapshot || null;
  return data && typeof data === 'object' ? data : null;
}

export async function saveFlashcardsProgressRemote(learnerId, progress) {
  if (typeof window === 'undefined') return { ok: false, skipped: true };
  if (!learnerId || learnerId === 'anon') return { ok: false, skipped: true };
  if (!progress || typeof progress !== 'object') return { ok: false, skipped: true };

  const token = await getAccessToken();
  if (!token) return { ok: false, skipped: true };

  const resp = await fetch('/api/snapshots', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      learner_id: learnerId,
      lesson_key: FLASHCARDS_PROGRESS_LESSON_KEY,
      data: progress,
    }),
  }).catch(() => null);

  if (!resp?.ok) return { ok: false };
  const json = await resp.json().catch(() => null);
  if (json && json.ok === false) return { ok: false };
  return { ok: true };
}
