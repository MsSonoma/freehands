// Simple localStorage-backed persistence for generated worksheet & test sets per lesson id.
// Stored structure: { worksheet: [...], test: [...], savedAt: <ISO string> }
// These sets are regenerated when lesson content changes (caller handles mismatch detection).

const KEY_PREFIX = 'lesson_assessments:';

function buildKey(lessonId) {
	return `${KEY_PREFIX}${lessonId}`;
}

export function getStoredAssessments(lessonId) {
	if (typeof window === 'undefined') return null;
	try {
		const raw = localStorage.getItem(buildKey(lessonId));
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === 'object' && (Array.isArray(parsed.worksheet) || Array.isArray(parsed.test))) {
			return parsed;
		}
	} catch (e) {
		console.warn('[assessmentStore] Failed to parse stored assessments', e);
	}
	return null;
}

export function saveAssessments(lessonId, { worksheet = [], test = [] } = {}) {
	if (typeof window === 'undefined') return;
	try {
		const payload = { worksheet, test, savedAt: new Date().toISOString() };
		localStorage.setItem(buildKey(lessonId), JSON.stringify(payload));
	} catch (e) {
		console.warn('[assessmentStore] Failed to save assessments', e);
	}
}

export function clearAssessments(lessonId) {
	if (typeof window === 'undefined') return;
	try {
		localStorage.removeItem(buildKey(lessonId));
	} catch (e) {
		console.warn('[assessmentStore] Failed to clear assessments', e);
	}
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

const assessmentStoreApi = { getStoredAssessments, saveAssessments, clearAssessments, clearAllAssessments };
export default assessmentStoreApi;
