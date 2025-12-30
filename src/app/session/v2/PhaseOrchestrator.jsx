/**
 * PhaseOrchestrator - Manages session phase flow
 * 
 * Coordinates transitions between phases: discussion → teaching → comprehension → closing
 * Zero knowledge of phase implementation details.
 * Phases emit completion events, orchestrator advances to next phase.
 * 
 * Architecture:
 * - Owns phase state machine
 * - Emits phaseChange events
 * - Consumes phase completion events
 * - Zero coupling to phase internals
 * 
 * Usage:
 *   const orchestrator = new PhaseOrchestrator({ lessonData });
 *   orchestrator.on('phaseChange', (phase) => updateUI(phase));
 *   orchestrator.on('sessionComplete', () => showResults());
 *   await orchestrator.startSession();
 */

export class PhaseOrchestrator {
  // Private state
  #lessonData = null;
  #currentPhase = 'idle'; // 'idle' | 'discussion' | 'teaching' | 'comprehension' | 'exercise' | 'worksheet' | 'closing' | 'complete'
  #phaseHistory = [];
  
  #listeners = new Map();
  
  constructor(options = {}) {
    this.#lessonData = options.lessonData;
    
    if (!this.#lessonData) {
      throw new Error('PhaseOrchestrator requires lessonData');
    }
  }
  
  // Public API: Event subscription
  on(event, callback) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, []);
    }
    this.#listeners.get(event).push(callback);
  }
  
  off(event, callback) {
    if (!this.#listeners.has(event)) return;
    const callbacks = this.#listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }
  
  #emit(event, data) {
    if (!this.#listeners.has(event)) return;
    this.#listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error('[PhaseOrchestrator] Event callback error:', event, err);
      }
    });
  }
  
  // Public API: Start session
  async startSession() {
    this.#phaseHistory = [];
    
    // For now, skip discussion and go straight to teaching
    // TODO: Add discussion phase when ready
    await this.#transitionTo('teaching');
  }
  
  // Public API: Phase completion handlers
  onTeachingComplete() {
    this.#transitionTo('comprehension');
  }
  
  onComprehensionComplete() {
    this.#transitionTo('exercise');
  }
  
  onExerciseComplete() {
    this.#transitionTo('worksheet');
  }
  
  onWorksheetComplete() {
    this.#transitionTo('closing');
  }
  
  onClosingComplete() {
    this.#completeSession();
  }
  
  // Public API: Manual phase navigation (for testing)
  skipToPhase(phase) {
    const validPhases = ['discussion', 'teaching', 'comprehension', 'exercise', 'worksheet', 'closing'];
    if (!validPhases.includes(phase)) {
      throw new Error(`Invalid phase: ${phase}`);
    }
    this.#transitionTo(phase);
  }
  
  // Getters
  get currentPhase() {
    return this.#currentPhase;
  }
  
  get phaseHistory() {
    return [...this.#phaseHistory];
  }
  
  get lessonData() {
    return this.#lessonData;
  }
  
  // Private: Phase transitions
  #transitionTo(nextPhase) {
    const prevPhase = this.#currentPhase;
    
    // Record history
    if (prevPhase !== 'idle') {
      this.#phaseHistory.push({
        phase: prevPhase,
        timestamp: new Date().toISOString()
      });
    }
    
    // Update state
    this.#currentPhase = nextPhase;
    
    // Emit event
    this.#emit('phaseChange', {
      phase: nextPhase,
      previousPhase: prevPhase,
      history: [...this.#phaseHistory]
    });
  }
  
  #completeSession() {
    // Record final phase
    if (this.#currentPhase !== 'idle') {
      this.#phaseHistory.push({
        phase: this.#currentPhase,
        timestamp: new Date().toISOString()
      });
    }
    
    this.#currentPhase = 'complete';
    
    this.#emit('sessionComplete', {
      history: [...this.#phaseHistory]
    });
  }
  
  // Public: Cleanup
  destroy() {
    this.#listeners.clear();
  }
}
