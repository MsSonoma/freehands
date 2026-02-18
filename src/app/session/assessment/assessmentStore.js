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
					if (data) {
						const normalized = normalizeShape(data);
						try { localStorage.setItem(buildKey(lessonId), JSON.stringify(normalized)); } catch {}
						return normalized;
					}
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
	}
	return null;
}


function mergePools(existing, incoming) {
	const ex = normalizeShape(existing || {});
	const next = { ...ex };
	const mergeOne = (key) => {
		const inc = incoming ? incoming[key] : undefined;
		// Rule: once a pool is set (non-empty), keep it stable until explicitly cleared.
		if (Array.isArray(ex[key]) && ex[key].length > 0) return;
		if (Array.isArray(inc) && inc.length > 0) {
			next[key] = inc;
			return;
		}
		// Otherwise preserve existing (including empty arrays).
	};
	mergeOne('worksheet');
	mergeOne('test');
	mergeOne('comprehension');
	mergeOne('exercise');
	return next;
}

async function fetchRemoteAssessments(lessonId, learnerId, token) {
	if (!lessonId || !learnerId || !token) return null;
	try {
		const url = `/api/assessments?learner_id=${encodeURIComponent(learnerId)}&lesson_key=${encodeURIComponent(lessonId)}`;
		const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
		if (!resp.ok) return null;
		const json = await resp.json().catch(() => null);
		const data = json?.assessments || null;
		return data ? normalizeShape(data) : null;
	} catch {
		return null;
	}
}

export async function saveAssessments(lessonId, incoming = {}, { learnerId } = {}) {
	if (typeof window === 'undefined') return;

	// Merge against local immediately for fast UX.
	let localExisting = null;
	try {
		const raw = localStorage.getItem(buildKey(lessonId));
		localExisting = raw ? JSON.parse(raw) : null;
	} catch {}

	const mergedLocal = mergePools(localExisting, incoming);
	const localPayload = normalizeShape({ ...mergedLocal, savedAt: new Date().toISOString() });
	try { localStorage.setItem(buildKey(lessonId), JSON.stringify(localPayload)); } catch {}

	// Best-effort remote: merge against remote before POST so we can't clobber
	// previously saved pools on another device.
	try {
		const supabaseMod = await import('@/app/lib/supabaseClient');
		const supabase = supabaseMod.getSupabaseClient?.();
		const hasEnv = supabaseMod.hasSupabaseEnv?.();
		if (supabase && hasEnv && learnerId) {
			const { data: { session } } = await supabase.auth.getSession();
			const token = session?.access_token;
			if (token) {
				const remoteExisting = await fetchRemoteAssessments(lessonId, learnerId, token);
				const mergedRemote = mergePools(remoteExisting || localPayload, incoming);
				const remotePayload = normalizeShape({ ...mergedRemote, savedAt: new Date().toISOString() });
				try { localStorage.setItem(buildKey(lessonId), JSON.stringify(remotePayload)); } catch {}
				await fetch('/api/assessments', {
					method: 'POST',
					headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
					body: JSON.stringify({ learner_id: learnerId, lesson_key: lessonId, data: remotePayload })
				}).catch(() => {});
			}
		}
	} catch (e) {
		// ignore; local already saved
	}
}

export async function clearAssessments(lessonId, { learnerId } = {}) {
	if (typeof window === 'undefined') return;
	try { localStorage.removeItem(buildKey(lessonId)); } catch (e) { }
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
