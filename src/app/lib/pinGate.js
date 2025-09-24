// Simple PIN gate utility. Designed so certain actions (e.g., downloading PDFs)
// can be restricted unless a facilitator PIN has been entered in the session.
// For now this is a minimal placeholder that can be expanded to prompt user input.

const PIN_KEY = 'facilitator_pin';

// In a future iteration this could open a modal. For now we simply check localStorage.
export async function ensurePinAllowed(action = 'action') {
	if (typeof window === 'undefined') return true; // SSR: allow
	try {
		const stored = localStorage.getItem(PIN_KEY);
		// If a PIN system is not yet set up, allow by default.
		if (!stored) return true;
		// Could add expiration / hashing here. For now presence unlocks.
		return true;
	} catch {
		return true; // fail-open to avoid blocking core flow
	}
}

export function setFacilitatorPin(pin) {
	if (typeof window === 'undefined') return;
	try { localStorage.setItem(PIN_KEY, pin); } catch {}
}

export function clearFacilitatorPin() {
	if (typeof window === 'undefined') return;
	try { localStorage.removeItem(PIN_KEY); } catch {}
}

const pinGateApi = { ensurePinAllowed, setFacilitatorPin, clearFacilitatorPin };
export default pinGateApi;
