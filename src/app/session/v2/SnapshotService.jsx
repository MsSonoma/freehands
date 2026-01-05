/**
 * Snapshot Service - Session persistence for V2 architecture
 * 
 * Handles saving and loading session progress to/from Supabase.
 * Zero coupling to phase components - consumes events and saves state.
 * 
 * Architecture:
 * - Saves after each phase completion
 * - Atomic saves (no partial writes)
 * - Resume from last completed phase
 * - Compatible with V1 snapshot schema during migration
 * 
 * Usage:
 *   const service = new SnapshotService({ sessionId, learnerId, lessonKey });
 *   await service.initialize();
 *   await service.savePhaseCompletion('teaching', { vocabCount: 5 });
 *   const snapshot = await service.loadSnapshot();
 */

export class SnapshotService {
  // Private state
  #sessionId = null;
  #learnerId = null;
  #lessonKey = null;
  #supabaseClient = null;
  #forceLocalStorage = false;
  
  #snapshot = null;
  #lastSaveTime = null;
  #saveInProgress = false;

  #formatErrorForLog(err) {
    try {
      if (!err) return { kind: 'unknown', value: err };
      if (err instanceof Error) {
        return {
          kind: 'Error',
          name: err.name,
          message: err.message,
          stack: err.stack
        };
      }
      return {
        kind: typeof err,
        message: err.message,
        code: err.code,
        details: err.details,
        hint: err.hint,
        status: err.status,
        statusCode: err.statusCode
      };
    } catch (_) {
      return { kind: 'unformattable' };
    }
  }

  #shouldFallbackToLocalStorage(err) {
    // Common Supabase/PostgREST errors when the 'snapshots' table isn't present
    const code = err?.code;
    const message = err?.message || '';
    return (
      code === 'PGRST205' ||
      code === '42P01' ||
      /Could not find the table/i.test(message) ||
      /relation .*snapshots.* does not exist/i.test(message) ||
      /schema cache/i.test(message)
    );
  }

  #disableSupabaseForSession(reason, err) {
    if (this.#forceLocalStorage) return;
    this.#forceLocalStorage = true;
    console.warn(
      `[SnapshotService] Falling back to localStorage for this session (${reason}).`,
      this.#formatErrorForLog(err)
    );
  }
  
  constructor(options = {}) {
    this.#sessionId = options.sessionId;
    this.#learnerId = options.learnerId;
    this.#lessonKey = options.lessonKey;
    this.#supabaseClient = options.supabaseClient;
    
    if (!this.#sessionId) {
      throw new Error('SnapshotService requires sessionId');
    }
    
    if (!this.#learnerId) {
      throw new Error('SnapshotService requires learnerId');
    }
    
    if (!this.#lessonKey) {
      throw new Error('SnapshotService requires lessonKey');
    }
  }

  async #getAuthToken() {
    try {
      if (!this.#supabaseClient?.auth?.getSession) return null;
      const { data } = await this.#supabaseClient.auth.getSession();
      return data?.session?.access_token || null;
    } catch {
      return null;
    }
  }

  #buildSnapshotApiUrl() {
    return `/api/snapshots?learner_id=${encodeURIComponent(this.#learnerId)}&lesson_key=${encodeURIComponent(this.#lessonKey)}`;
  }

  async #fetchSnapshotFromServer() {
    const token = await this.#getAuthToken();
    if (!token) return null;

    try {
      const url = this.#buildSnapshotApiUrl();
      const resp = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      if (!resp.ok) return null;
      const json = await resp.json().catch(() => null);
      const snapshot = json?.snapshot || null;
      if (!snapshot || typeof snapshot !== 'object') return null;
      return snapshot;
    } catch (err) {
      console.error('[SnapshotService] Server load error:', this.#formatErrorForLog(err), err);
      return null;
    }
  }

  async #persistSnapshotToServer(snapshot) {
    const token = await this.#getAuthToken();
    if (!token) return { ok: false, skipped: true };

    try {
      const resp = await fetch('/api/snapshots', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ learner_id: this.#learnerId, lesson_key: this.#lessonKey, data: snapshot })
      });
      if (!resp.ok) return { ok: false };
      const json = await resp.json().catch(() => null);
      if (json && json.ok === false) return { ok: false };
      return { ok: true };
    } catch (err) {
      console.error('[SnapshotService] Server save error:', this.#formatErrorForLog(err), err);
      return { ok: false };
    }
  }

  async #deleteSnapshotFromServer() {
    const token = await this.#getAuthToken();
    if (!token) return { ok: false, skipped: true };

    try {
      const url = this.#buildSnapshotApiUrl();
      const resp = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      return { ok: resp.ok };
    } catch (err) {
      console.error('[SnapshotService] Server delete error:', this.#formatErrorForLog(err), err);
      return { ok: false };
    }
  }
  
  // Public API: Initialize service and load existing snapshot
  async initialize() {
    try {
      this.#snapshot = await this.loadSnapshot();
      return this.#snapshot;
    } catch (err) {
      console.error('[SnapshotService] Initialize error:', err);
      return null;
    }
  }
  
  // Public API: Load snapshot from database
  async loadSnapshot() {
    // Restore strategy: localStorage first (instant), then server.
    const local = this.#loadFromLocalStorage();
    if (local) return local;

    if (!this.#supabaseClient || this.#forceLocalStorage) {
      return null;
    }

    const server = await this.#fetchSnapshotFromServer();
    if (!server) return null;

    // Cache server snapshot locally for next time.
    this.#saveToLocalStorage(server);
    return server;
  }
  
  // Public API: Save phase completion
  async savePhaseCompletion(phase, phaseData = {}) {
    // Check prevention flag (set during lesson cleanup)
    if (typeof window !== 'undefined' && window.__PREVENT_SNAPSHOT_SAVE__) {
      console.log('[SnapshotService] Snapshot save blocked by cleanup flag');
      return { success: false, blocked: true };
    }
    
    if (this.#saveInProgress) {
      console.warn('[SnapshotService] Save already in progress, queuing...');
      // Wait for current save to complete
      await this.#waitForSaveComplete();
    }
    
    this.#saveInProgress = true;
    
    try {
      const completedPhases = this.#snapshot?.completedPhases || [];
      if (!completedPhases.includes(phase)) {
        completedPhases.push(phase);
      }
      
      const allPhaseData = {
        ...(this.#snapshot?.phaseData || {}),
        [phase]: {
          ...phaseData,
          completedAt: new Date().toISOString()
        }
      };
      
      const timerState = (phaseData && typeof phaseData === 'object' && 'timerState' in phaseData)
        ? (phaseData.timerState || null)
        : (this.#snapshot?.timerState || null);

      const snapshot = {
        sessionId: this.#sessionId,
        learnerId: this.#learnerId,
        lessonKey: this.#lessonKey,
        currentPhase: phase,
        completedPhases: completedPhases,
        phaseData: allPhaseData,
        timerState,
        lastUpdated: new Date().toISOString()
      };

      // Always save locally first.
      this.#saveToLocalStorage(snapshot);

      // Best-effort server save (cross-device restore).
      if (this.#supabaseClient && !this.#forceLocalStorage) {
        await this.#persistSnapshotToServer(snapshot);
      }

      this.#snapshot = snapshot;
      this.#lastSaveTime = Date.now();
      
      return snapshot;
    } catch (err) {
      console.error('[SnapshotService] Save error:', this.#formatErrorForLog(err), err);
      throw err;
    } finally {
      this.#saveInProgress = false;
    }
  }
  
  // Public API: Save progress incrementally (granular saves for V1 parity)
  // Called after each user action (sentence completion, question answered, etc.)
  async saveProgress(trigger = 'action', updateData = {}) {
    // Check prevention flag (set during lesson cleanup)
    if (typeof window !== 'undefined' && window.__PREVENT_SNAPSHOT_SAVE__) {
      console.log('[SnapshotService] Snapshot save blocked by cleanup flag');
      return { success: false, blocked: true };
    }
    
    if (this.#saveInProgress) {
      // Don't queue granular saves - just skip to avoid backup
      return;
    }
    
    this.#saveInProgress = true;
    
    try {
      // Allow callers to override which phase receives the granular save so
      // phaseChange events can keep currentPhase in sync before checkpoints.
      const phaseOverride = updateData?.phaseOverride;
      const mergedUpdate = { ...updateData };
      if (Object.prototype.hasOwnProperty.call(mergedUpdate, 'phaseOverride')) {
        delete mergedUpdate.phaseOverride;
      }

      const currentPhase = phaseOverride || this.#snapshot?.currentPhase || 'idle';
      const allPhaseData = {
        ...(this.#snapshot?.phaseData || {}),
        [currentPhase]: {
          ...(this.#snapshot?.phaseData?.[currentPhase] || {}),
          ...mergedUpdate,
          lastAction: trigger,
          lastActionAt: new Date().toISOString()
        }
      };
      
      const snapshot = {
        sessionId: this.#sessionId,
        learnerId: this.#learnerId,
        lessonKey: this.#lessonKey,
        currentPhase: currentPhase,
        completedPhases: this.#snapshot?.completedPhases || [],
        phaseData: allPhaseData,
        timerState: (mergedUpdate && typeof mergedUpdate === 'object' && 'timerState' in mergedUpdate)
          ? (mergedUpdate.timerState || null)
          : (this.#snapshot?.timerState || null),
        lastUpdated: new Date().toISOString()
      };

      // Always save locally first.
      this.#saveToLocalStorage(snapshot);

      // Best-effort server save (cross-device restore).
      if (this.#supabaseClient && !this.#forceLocalStorage) {
        await this.#persistSnapshotToServer(snapshot);
      }

      this.#snapshot = snapshot;
      this.#lastSaveTime = Date.now();
      
      return snapshot;
    } catch (err) {
      console.error('[SnapshotService] Granular save error:', this.#formatErrorForLog(err), err);
      // Don't throw - granular saves should fail silently
    } finally {
      this.#saveInProgress = false;
    }
  }
  
  // Public API: Delete snapshot (session complete or restart)
  async deleteSnapshot() {
    // Always clear local snapshot first (this is what loads on refresh).
    this.#deleteFromLocalStorage();

    // Clear common legacy/variant keys too.
    if (typeof window !== 'undefined') {
      const keys = [
        `atomic_snapshot:${this.#learnerId}:${this.#lessonKey}`,
        `atomic_snapshot:${this.#learnerId}:${this.#lessonKey}.json`,
        `snapshot:${this.#learnerId}:${this.#lessonKey}`,
        `lesson_snapshot:${this.#lessonKey}`,
      ];
      for (const k of keys) {
        try { localStorage.removeItem(k); } catch {}
      }
    }

    // Best-effort server delete.
    if (this.#supabaseClient && !this.#forceLocalStorage) {
      await this.#deleteSnapshotFromServer();
    }

    this.#snapshot = null;
  }
  
  // Getters
  get snapshot() {
    return this.#snapshot;
  }
  
  get lastSaveTime() {
    return this.#lastSaveTime;
  }
  
  get currentPhase() {
    return this.#snapshot?.currentPhase || null;
  }
  
  get completedPhases() {
    return this.#snapshot?.completedPhases || [];
  }
  
  get phaseData() {
    return this.#snapshot?.phaseData || {};
  }
  
  // Private: Wait for save to complete
  async #waitForSaveComplete() {
    let attempts = 0;
    while (this.#saveInProgress && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
  }
  
  // Private: LocalStorage fallback (for testing without Supabase)
  #getLocalStorageKey() {
    return `atomic_snapshot:${this.#learnerId}:${this.#lessonKey}`;
  }
  
  #loadFromLocalStorage() {
    try {
      if (typeof window === 'undefined') return null;
      const key = this.#getLocalStorageKey();
      const json = localStorage.getItem(key);
      if (!json) return null;
      return JSON.parse(json);
    } catch (err) {
      console.error('[SnapshotService] LocalStorage load error:', err);
      return null;
    }
  }
  
  #saveToLocalStorage(snapshot) {
    try {
      if (typeof window === 'undefined') return;
      const key = this.#getLocalStorageKey();
      localStorage.setItem(key, JSON.stringify(snapshot));
    } catch (err) {
      console.error('[SnapshotService] LocalStorage save error:', err);
    }
  }
  
  #deleteFromLocalStorage() {
    try {
      if (typeof window === 'undefined') return;
      const key = this.#getLocalStorageKey();
      localStorage.removeItem(key);
    } catch (err) {
      console.error('[SnapshotService] LocalStorage delete error:', err);
    }
  }
}
