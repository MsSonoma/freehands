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
    refresh: true,           // re-generate worksheet & test
    timer: true,             // pause/resume session timer
    facilitatorPage: false,  // accessing facilitator page
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
        case 'timer': return 'timer';
        case 'facilitator-page': return 'facilitatorPage';
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
		
		// Debug logging for timer and facilitator-page actions
		if (action === 'timer' || action === 'facilitator-page') {
			console.log('[PIN Gate]', action, 'action:', { hasPin, prefKey, prefValue: prefs?.[prefKey], defaultValue: DEFAULT_PREFS[prefKey], shouldGate, prefs });
		}
		
		if (!shouldGate) return true;
		
		// Timer and facilitator-page actions always require fresh PIN entry (no session unlock bypass)
		const requiresFreshPin = (action === 'timer' || action === 'facilitator-page');
		if (!requiresFreshPin && unlockedThisSession()) return true;

		// Prompt for PIN using a minimal masked modal so characters are hidden.
		const input = await promptForPinMasked({ title: 'Facilitator PIN', message: 'Enter PIN to continue' });
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
		// Timer actions don't unlock the session - they always require PIN
		if (!requiresFreshPin) {
			setUnlockedSession(true);
		}
		return true;
	} catch {
		return true; // fail-open to avoid blocking core flow
	}
}

const pinGateApi = { ensurePinAllowed, setFacilitatorPin, clearFacilitatorPin, getPinPrefsLocal, setPinPrefsLocal };
export default pinGateApi;

// Lightweight, dependency-free masked PIN modal. Returns Promise<string|null>.
// - Hides characters via type="password"
// - Numeric keypad via inputMode="numeric" and pattern
// - Escape closes; Enter submits
function promptForPinMasked({ title = 'Enter PIN', message = 'Enter your PIN' } = {}) {
	if (typeof document === 'undefined') return Promise.resolve(null);
	return new Promise((resolve) => {
		let resolved = false;
		const cleanup = () => {
			if (resolved) return;
			resolved = true;
			try { document.removeEventListener('keydown', onKeyDown, true); } catch {}
			try { overlay?.remove(); } catch {}
		};

		const onCancel = () => { if (!resolved) { resolve(null); } cleanup(); };
		const onSubmit = () => {
			const val = input?.value?.trim() || '';
			if (val === '') { err.textContent = 'Please enter your PIN.'; input?.focus(); return; }
			if (!resolved) { resolve(val); }
			cleanup();
		};

		const onKeyDown = (e) => {
			if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
			if (e.key === 'Enter') { e.preventDefault(); onSubmit(); }
		};

		// Elements
		const overlay = document.createElement('div');
		overlay.setAttribute('role', 'presentation');
		overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.35);display:grid;place-items:center;';

		const dialog = document.createElement('div');
		dialog.setAttribute('role', 'dialog');
		dialog.setAttribute('aria-modal', 'true');
		dialog.setAttribute('aria-labelledby', 'ms-pin-title');
		dialog.style.cssText = 'width:100%;max-width:360px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;box-shadow:0 8px 30px rgba(0,0,0,0.12);';

		const h3 = document.createElement('h3');
		h3.id = 'ms-pin-title';
		h3.textContent = title;
		h3.style.cssText = 'margin:0 0 8px;';

		const label = document.createElement('label');
		label.style.cssText = 'display:block;margin-bottom:8px;';

		const tip = document.createElement('span');
		tip.textContent = message;
		tip.style.cssText = 'display:block;font-size:12px;color:#6b7280;margin-bottom:4px;';

		// Hidden username input to improve autofill heuristics context
		const hiddenUser = document.createElement('input');
		hiddenUser.type = 'text';
		hiddenUser.name = 'username';
		hiddenUser.autocomplete = 'username';
		hiddenUser.setAttribute('aria-hidden', 'true');
		hiddenUser.tabIndex = -1;
		hiddenUser.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;border:0;clip:rect(0 0 0 0);clip-path:inset(50%);overflow:hidden;white-space:nowrap;';

		const input = document.createElement('input');
		input.type = 'password';
		input.inputMode = 'numeric';
		input.autocomplete = 'one-time-code'; // hint numeric keypad
		input.name = 'facilitator-pin';
		input.pattern = '[0-9]*';
		input.setAttribute('aria-label', 'Facilitator PIN');
		input.style.cssText = 'width:100%;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;';

		const err = document.createElement('div');
		err.setAttribute('role', 'alert');
		err.style.cssText = 'min-height:16px;color:#b91c1c;font-size:12px;margin:8px 0;';

		const actions = document.createElement('div');
		actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:8px;';

		const cancel = document.createElement('button');
		cancel.type = 'button';
		cancel.textContent = 'Cancel';
		cancel.style.cssText = 'padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;color:#111;';
		cancel.addEventListener('click', onCancel);

		const ok = document.createElement('button');
		ok.type = 'button';
		ok.textContent = 'Confirm';
		ok.style.cssText = 'padding:8px 12px;border:1px solid #111;border-radius:8px;background:#111;color:#fff;font-weight:600;';
		ok.addEventListener('click', onSubmit);

		actions.appendChild(cancel);
		actions.appendChild(ok);

		label.appendChild(tip);
		label.appendChild(input);
		dialog.appendChild(h3);
		dialog.appendChild(hiddenUser);
		dialog.appendChild(label);
		dialog.appendChild(err);
		dialog.appendChild(actions);
		overlay.appendChild(dialog);
		document.body.appendChild(overlay);

		document.addEventListener('keydown', onKeyDown, true);
		setTimeout(() => { try { input.focus(); } catch {} }, 0);
	});
}
