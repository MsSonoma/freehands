// Simple PIN gate utility with per-action preferences. Prompts for PIN
// when an action is gated. Prefers server verification; falls back to local.

const PIN_KEY = 'facilitator_pin';
const PREFS_KEY = 'facilitator_pin_prefs';
const UNLOCK_KEY = 'facilitator_pin_unlocked'; // session-level

// Default preferences when a PIN exists but prefs are not saved yet
const DEFAULT_PREFS = {
	downloads: true,         // worksheet/test previews & downloads
	facilitatorKey: true,    // combined facilitator key
	skipTimeline: true,      // skip buttons and timeline jumps
	changeLearner: true,     // change learner on Learn page
    refresh: true,         // re-generate worksheet & test
};

function readPrefsLocal() {
	if (typeof window === 'undefined') return { ...DEFAULT_PREFS };
	try {
		const raw = localStorage.getItem(PREFS_KEY);
		if (!raw) return null;
		const js = JSON.parse(raw);
		return { ...DEFAULT_PREFS, ...js };
	} catch {
		return null;
	}
}

export function setPinPrefsLocal(prefs) {
	if (typeof window === 'undefined') return;
	try { localStorage.setItem(PREFS_KEY, JSON.stringify({ ...DEFAULT_PREFS, ...prefs })); } catch {}
}

export function getPinPrefsLocal() {
	return readPrefsLocal() || { ...DEFAULT_PREFS };
}

export function setFacilitatorPin(pin) {
	if (typeof window === 'undefined') return;
	try { localStorage.setItem(PIN_KEY, pin); } catch {}
}

export function clearFacilitatorPin() {
	if (typeof window === 'undefined') return;
	try { localStorage.removeItem(PIN_KEY); } catch {}
	try { sessionStorage.removeItem(UNLOCK_KEY); } catch {}
}

function mapActionToPrefKey(action) {
	switch (action) {
		case 'download': return 'downloads';
		case 'facilitator':
		case 'facilitator-key': return 'facilitatorKey';
		case 'skip':
		case 'timeline': return 'skipTimeline';
		case 'change-learner': return 'changeLearner';
        case 'refresh': return 'refresh';
		default: return null;
	}
}

async function fetchServerPrefsAndHasPin() {
	try {
		// Attempt to get a Supabase session access token via the browser SDK if available
		// Import lazily to avoid SSR/bundle issues
		const mod = await import('@/app/lib/supabaseClient');
		const getSupabaseClient = mod.getSupabaseClient;
		const supabase = getSupabaseClient?.();
		const { data: { session } } = await supabase.auth.getSession();
		const token = session?.access_token;
		if (!token) return { hasPin: !!(typeof window !== 'undefined' && localStorage.getItem(PIN_KEY)), prefs: readPrefsLocal() };
		const res = await fetch('/api/facilitator/pin', { headers: { Authorization: `Bearer ${token}` } });
		const js = await res.json().catch(()=>({}));
		if (!res.ok || !js?.ok) return { hasPin: !!(typeof window !== 'undefined' && localStorage.getItem(PIN_KEY)), prefs: readPrefsLocal() };
		// Persist a local copy for quick reads
		if (js?.prefs && typeof window !== 'undefined') setPinPrefsLocal(js.prefs);
		return { hasPin: !!js.hasPin, prefs: js?.prefs || readPrefsLocal() };
	} catch {
		return { hasPin: !!(typeof window !== 'undefined' && localStorage.getItem(PIN_KEY)), prefs: readPrefsLocal() };
	}
}

async function verifyPinServer(pin) {
	try {
		const mod = await import('@/app/lib/supabaseClient');
		const getSupabaseClient = mod.getSupabaseClient;
		const supabase = getSupabaseClient?.();
		const { data: { session } } = await supabase.auth.getSession();
		const token = session?.access_token;
		if (!token) return null; // unknown
		const res = await fetch('/api/facilitator/pin/verify', { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ pin }) });
		const js = await res.json().catch(()=>({}));
		if (!res.ok || !js) return false;
		return !!js.ok;
	} catch {
		return null;
	}
}

function unlockedThisSession() {
	if (typeof window === 'undefined') return true;
	try { return sessionStorage.getItem(UNLOCK_KEY) === '1'; } catch { return false; }
}

function setUnlockedSession(v) {
	if (typeof window === 'undefined') return;
	try { if (v) sessionStorage.setItem(UNLOCK_KEY, '1'); else sessionStorage.removeItem(UNLOCK_KEY); } catch {}
}

export async function ensurePinAllowed(action = 'action') {
	if (typeof window === 'undefined') return true; // SSR: allow
	try {
		const { hasPin, prefs } = await fetchServerPrefsAndHasPin();
		const prefKey = mapActionToPrefKey(action);
		const shouldGate = Boolean(hasPin && (prefKey ? (prefs?.[prefKey] ?? DEFAULT_PREFS[prefKey]) : true));
		if (!shouldGate) return true;
		if (unlockedThisSession()) return true;

		// Prompt for PIN; prefer a minimal built-in prompt to avoid bundling a modal here.
		const input = window.prompt('Enter facilitator PIN');
		if (input == null || input === '') return false;

		// Try server verification; fallback to local
		const serverOk = await verifyPinServer(input);
		let ok = (serverOk === true);
		if (serverOk === null) {
			// No server; compare to local fallback
			try { ok = (localStorage.getItem(PIN_KEY) || '') === input; } catch { ok = true; }
		}
		if (!ok) {
			try { alert('Incorrect PIN.'); } catch {}
			return false;
		}
		setUnlockedSession(true);
		return true;
	} catch {
		return true; // fail-open to avoid blocking core flow
	}
}

const pinGateApi = { ensurePinAllowed, setFacilitatorPin, clearFacilitatorPin, getPinPrefsLocal, setPinPrefsLocal };
export default pinGateApi;
