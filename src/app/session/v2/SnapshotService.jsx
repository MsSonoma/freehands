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
    if (!this.#supabaseClient || this.#forceLocalStorage) {
      console.warn('[SnapshotService] No Supabase client - using localStorage fallback');
      return this.#loadFromLocalStorage();
    }
    
    try {
      const { data, error } = await this.#supabaseClient
        .from('snapshots')
        .select('*')
        .eq('session_id', this.#sessionId)
        .eq('learner_id', this.#learnerId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned (not an error for new sessions)
        if (this.#shouldFallbackToLocalStorage(error)) {
          this.#disableSupabaseForSession('loadSnapshot', error);
          return this.#loadFromLocalStorage();
        }
        throw error;
      }
      
      if (!data) {
        return null;
      }
      
      return {
        sessionId: data.session_id,
        learnerId: data.learner_id,
        lessonKey: data.lesson_key,
        currentPhase: data.current_phase,
        completedPhases: data.completed_phases || [],
        phaseData: data.phase_data || {},
        timerState: data.timer_state || null,
        lastUpdated: data.updated_at,
        createdAt: data.created_at
      };
    } catch (err) {
      if (this.#shouldFallbackToLocalStorage(err)) {
        this.#disableSupabaseForSession('loadSnapshot catch', err);
        return this.#loadFromLocalStorage();
      }
      console.error('[SnapshotService] Load error:', this.#formatErrorForLog(err), err);
      return null;
    }
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
      
      const snapshot = {
        sessionId: this.#sessionId,
        learnerId: this.#learnerId,
        lessonKey: this.#lessonKey,
        currentPhase: phase,
        completedPhases: completedPhases,
        phaseData: allPhaseData,
        timerState: phaseData.timerState || null,
        lastUpdated: new Date().toISOString()
      };
      
      if (!this.#supabaseClient || this.#forceLocalStorage) {
        console.warn('[SnapshotService] No Supabase client - using localStorage fallback');
        this.#saveToLocalStorage(snapshot);
        this.#snapshot = snapshot;
        this.#lastSaveTime = Date.now();
        return snapshot;
      }
      
      // Upsert snapshot
      const { data, error } = await this.#supabaseClient
        .from('snapshots')
        .upsert({
          session_id: this.#sessionId,
          learner_id: this.#learnerId,
          lesson_key: this.#lessonKey,
          current_phase: phase,
          completed_phases: completedPhases,
          phase_data: allPhaseData,
          timer_state: snapshot.timerState,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'session_id,learner_id'
        })
        .select()
        .single();
      
      if (error) {
        if (this.#shouldFallbackToLocalStorage(error)) {
          this.#disableSupabaseForSession('savePhaseCompletion upsert', error);
          this.#saveToLocalStorage(snapshot);
          this.#snapshot = snapshot;
          this.#lastSaveTime = Date.now();
          return snapshot;
        }
        throw error;
      }
      
      this.#snapshot = snapshot;
      this.#lastSaveTime = Date.now();
      
      return snapshot;
    } catch (err) {
      if (this.#shouldFallbackToLocalStorage(err)) {
        this.#disableSupabaseForSession('savePhaseCompletion catch', err);
        // Best-effort fallback so the session can proceed.
        try {
          const completedPhases = this.#snapshot?.completedPhases || [];
          const allPhaseData = {
            ...(this.#snapshot?.phaseData || {}),
            [phase]: {
              ...phaseData,
              completedAt: new Date().toISOString()
            }
          };
          const snapshot = {
            sessionId: this.#sessionId,
            learnerId: this.#learnerId,
            lessonKey: this.#lessonKey,
            currentPhase: phase,
            completedPhases: completedPhases.includes(phase) ? completedPhases : [...completedPhases, phase],
            phaseData: allPhaseData,
            timerState: phaseData.timerState || null,
            lastUpdated: new Date().toISOString()
          };
          this.#saveToLocalStorage(snapshot);
          this.#snapshot = snapshot;
          this.#lastSaveTime = Date.now();
          return snapshot;
        } catch (fallbackErr) {
          console.error('[SnapshotService] Save fallback error:', this.#formatErrorForLog(fallbackErr), fallbackErr);
          return { success: false, fallbackFailed: true };
        }
      }
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
      // Merge update data into current phase data
      const currentPhase = this.#snapshot?.currentPhase || 'idle';
      const allPhaseData = {
        ...(this.#snapshot?.phaseData || {}),
        [currentPhase]: {
          ...(this.#snapshot?.phaseData?.[currentPhase] || {}),
          ...updateData,
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
        lastUpdated: new Date().toISOString()
      };
      
      if (!this.#supabaseClient || this.#forceLocalStorage) {
        // For granular saves, update localStorage throttled
        this.#saveToLocalStorage(snapshot);
        this.#snapshot = snapshot;
        this.#lastSaveTime = Date.now();
        return snapshot;
      }
      
      // Upsert snapshot
      const { data, error } = await this.#supabaseClient
        .from('snapshots')
        .upsert({
          session_id: this.#sessionId,
          learner_id: this.#learnerId,
          lesson_key: this.#lessonKey,
          current_phase: currentPhase,
          completed_phases: this.#snapshot?.completedPhases || [],
          phase_data: allPhaseData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'session_id,learner_id'
        })
        .select()
        .single();
      
      if (error) {
        if (this.#shouldFallbackToLocalStorage(error)) {
          this.#disableSupabaseForSession('saveProgress upsert', error);
          this.#saveToLocalStorage(snapshot);
          this.#snapshot = snapshot;
          this.#lastSaveTime = Date.now();
          return snapshot;
        }
        throw error;
      }
      
      this.#snapshot = snapshot;
      this.#lastSaveTime = Date.now();
      
      return snapshot;
    } catch (err) {
      if (this.#shouldFallbackToLocalStorage(err)) {
        this.#disableSupabaseForSession('saveProgress catch', err);
        // Best-effort silent fallback
        try {
          const currentPhase = this.#snapshot?.currentPhase || 'idle';
          const allPhaseData = {
            ...(this.#snapshot?.phaseData || {}),
            [currentPhase]: {
              ...(this.#snapshot?.phaseData?.[currentPhase] || {}),
              ...updateData,
              lastAction: trigger,
              lastActionAt: new Date().toISOString()
            }
          };
          const snapshot = {
            sessionId: this.#sessionId,
            learnerId: this.#learnerId,
            lessonKey: this.#lessonKey,
            currentPhase,
            completedPhases: this.#snapshot?.completedPhases || [],
            phaseData: allPhaseData,
            lastUpdated: new Date().toISOString()
          };
          this.#saveToLocalStorage(snapshot);
          this.#snapshot = snapshot;
          this.#lastSaveTime = Date.now();
          return snapshot;
        } catch (_) {
          // Still silent
        }
        return;
      }
      console.error('[SnapshotService] Granular save error:', this.#formatErrorForLog(err), err);
      // Don't throw - granular saves should fail silently
    } finally {
      this.#saveInProgress = false;
    }
  }
  
  // Public API: Delete snapshot (session complete or restart)
  async deleteSnapshot() {
    if (!this.#supabaseClient || this.#forceLocalStorage) {
      console.warn('[SnapshotService] No Supabase client - using localStorage fallback');
      this.#deleteFromLocalStorage();
      this.#snapshot = null;
      return;
    }
    
    try {
      const { error } = await this.#supabaseClient
        .from('snapshots')
        .delete()
        .eq('session_id', this.#sessionId)
        .eq('learner_id', this.#learnerId);
      
      if (error) {
        if (this.#shouldFallbackToLocalStorage(error)) {
          this.#disableSupabaseForSession('deleteSnapshot', error);
          this.#deleteFromLocalStorage();
          this.#snapshot = null;
          return;
        }
        throw error;
      }
      
      this.#snapshot = null;
    } catch (err) {
      if (this.#shouldFallbackToLocalStorage(err)) {
        this.#disableSupabaseForSession('deleteSnapshot catch', err);
        this.#deleteFromLocalStorage();
        this.#snapshot = null;
        return;
      }
      console.error('[SnapshotService] Delete error:', this.#formatErrorForLog(err), err);
      throw err;
    }
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
      const key = this.#getLocalStorageKey();
      localStorage.setItem(key, JSON.stringify(snapshot));
    } catch (err) {
      console.error('[SnapshotService] LocalStorage save error:', err);
    }
  }
  
  #deleteFromLocalStorage() {
    try {
      const key = this.#getLocalStorageKey();
      localStorage.removeItem(key);
    } catch (err) {
      console.error('[SnapshotService] LocalStorage delete error:', err);
    }
  }
}
