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
  
  #snapshot = null;
  #lastSaveTime = null;
  #saveInProgress = false;
  
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
    if (!this.#supabaseClient) {
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
        lastUpdated: data.updated_at,
        createdAt: data.created_at
      };
    } catch (err) {
      console.error('[SnapshotService] Load error:', err);
      return null;
    }
  }
  
  // Public API: Save phase completion
  async savePhaseCompletion(phase, phaseData = {}) {
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
        lastUpdated: new Date().toISOString()
      };
      
      if (!this.#supabaseClient) {
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
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'session_id,learner_id'
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      this.#snapshot = snapshot;
      this.#lastSaveTime = Date.now();
      
      return snapshot;
    } catch (err) {
      console.error('[SnapshotService] Save error:', err);
      throw err;
    } finally {
      this.#saveInProgress = false;
    }
  }
  
  // Public API: Delete snapshot (session complete or restart)
  async deleteSnapshot() {
    if (!this.#supabaseClient) {
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
        throw error;
      }
      
      this.#snapshot = null;
    } catch (err) {
      console.error('[SnapshotService] Delete error:', err);
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
  #loadFromLocalStorage() {
    try {
      const key = `snapshot_${this.#sessionId}_${this.#learnerId}`;
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
      const key = `snapshot_${this.#sessionId}_${this.#learnerId}`;
      localStorage.setItem(key, JSON.stringify(snapshot));
    } catch (err) {
      console.error('[SnapshotService] LocalStorage save error:', err);
    }
  }
  
  #deleteFromLocalStorage() {
    try {
      const key = `snapshot_${this.#sessionId}_${this.#learnerId}`;
      localStorage.removeItem(key);
    } catch (err) {
      console.error('[SnapshotService] LocalStorage delete error:', err);
    }
  }
}
