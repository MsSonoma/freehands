// Remote-first persistence for generated sets per lesson key and learner.
// Shape: { worksheet: [...], test: [...], comprehension: [...], exercise: [...], savedAt: ISO }
// Falls back to localStorage when remote is unavailable. Backward compatible with older shape.

const KEY_PREFIX = 'lesson_assessments:';

function buildKey(lessonId) {
	return `${KEY_PREFIX}${lessonId}`;
}

export async function getStoredAssessments(lessonId, { learnerId } = {}) {
	if (typeof window === 'undefined') return null;
	// Try remote first when authenticated
	try {
		const supabase = (await import('@/app/lib/supabaseClient')).getSupabaseClient?.();
		const hasEnv = (await import('@/app/lib/supabaseClient')).hasSupabaseEnv?.();
		if (supabase && hasEnv) {
			const { data: { session } } = await supabase.auth.getSession();
			const token = session?.access_token;
			if (token && learnerId) {
				const url = `/api/assessments?learner_id=${encodeURIComponent(learnerId)}&lesson_key=${encodeURIComponent(lessonId)}`;
				const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
				if (resp.ok) {
					const json = await resp.json().catch(() => null);
					const data = json?.assessments || null;
					if (data) return normalizeShape(data);
				}
			}
		}
	} catch (e) {
		// fall through to local
	}
	// Local fallback
	try {
		const raw = localStorage.getItem(buildKey(lessonId));
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === 'object' && (Array.isArray(parsed.worksheet) || Array.isArray(parsed.test))) {
			return normalizeShape(parsed);
		}
	} catch (e) {
		console.warn('[assessmentStore] Failed to parse stored assessments', e);
	}
	return null;
}

export async function saveAssessments(lessonId, { worksheet = [], test = [], comprehension = [], exercise = [] } = {}, { learnerId } = {}) {
	if (typeof window === 'undefined') return;
	const payload = normalizeShape({ worksheet, test, comprehension, exercise, savedAt: new Date().toISOString() });
	// Write local immediately for fast UX
	try { localStorage.setItem(buildKey(lessonId), JSON.stringify(payload)); } catch {}
	// Best-effort remote
	try {
		const supabaseMod = await import('@/app/lib/supabaseClient');
		const supabase = supabaseMod.getSupabaseClient?.();
		const hasEnv = supabaseMod.hasSupabaseEnv?.();
		if (supabase && hasEnv && learnerId) {
			const { data: { session } } = await supabase.auth.getSession();
			const token = session?.access_token;
			if (token) {
				await fetch('/api/assessments', {
					method: 'POST',
					headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
					body: JSON.stringify({ learner_id: learnerId, lesson_key: lessonId, data: payload })
				}).catch(() => {});
			}
		}
	} catch (e) {
		// ignore; local already saved
	}
}

export async function clearAssessments(lessonId, { learnerId } = {}) {
	if (typeof window === 'undefined') return;
	try { localStorage.removeItem(buildKey(lessonId)); } catch (e) { console.warn('[assessmentStore] Failed to clear local assessments', e); }
	// Best-effort remote delete
	try {
		const supabaseMod = await import('@/app/lib/supabaseClient');
		const supabase = supabaseMod.getSupabaseClient?.();
		const hasEnv = supabaseMod.hasSupabaseEnv?.();
		if (supabase && hasEnv && learnerId) {
			const { data: { session } } = await supabase.auth.getSession();
			const token = session?.access_token;
			if (token) {
				const url = `/api/assessments?learner_id=${encodeURIComponent(learnerId)}&lesson_key=${encodeURIComponent(lessonId)}`;
				await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
			}
		}
	} catch (e) { /* ignore */ }
}

// Optional helper to nuke everything (not used yet)
export function clearAllAssessments() {
	if (typeof window === 'undefined') return;
	try {
		const keys = Object.keys(localStorage);
		for (const k of keys) {
			if (k.startsWith(KEY_PREFIX)) localStorage.removeItem(k);
		}
	} catch (e) {
		console.warn('[assessmentStore] Failed to clear all assessments', e);
	}
}

function normalizeShape(obj) {
	const out = { worksheet: [], test: [], comprehension: [], exercise: [], savedAt: obj?.savedAt || new Date().toISOString() };
	if (Array.isArray(obj?.worksheet)) out.worksheet = obj.worksheet;
	if (Array.isArray(obj?.test)) out.test = obj.test;
	if (Array.isArray(obj?.comprehension)) out.comprehension = obj.comprehension;
	if (Array.isArray(obj?.exercise)) out.exercise = obj.exercise;
	return out;
}

const assessmentStoreApi = { getStoredAssessments, saveAssessments, clearAssessments, clearAllAssessments };
export default assessmentStoreApi;
