/**
 * TimerService.jsx
 * Manages session and work phase timers
 * 
 * Timers:
 * - Session timer: Tracks total session duration from start to complete
 * - Work phase timers: Tracks time for exercise, worksheet, test phases (for golden key)
 * 
 * Golden Key Requirements:
 * - Need 3 work phases completed within time limit
 * - Work phases: exercise, worksheet, test
 * - Time limits defined per grade/subject
 * 
 * Events emitted:
 * - sessionTimerStart: { timestamp } - Session timer started
 * - sessionTimerTick: { elapsed, formatted } - Every second while running
 * - sessionTimerStop: { elapsed, formatted } - Session timer stopped
 * - workPhaseTimerStart: { phase, timestamp } - Work phase timer started
 * - workPhaseTimerComplete: { phase, elapsed, onTime } - Work phase completed
 * - workPhaseTimerStop: { phase, elapsed } - Work phase stopped
 * - goldenKeyEligible: { completedPhases } - 3 on-time work phases achieved
 */

'use client';

export class TimerService {
  constructor(eventBus, options = {}) {
    this.eventBus = eventBus;
    
    // Session timer
    this.sessionStartTime = null;
    this.sessionElapsed = 0; // seconds
    this.sessionInterval = null;
    
    // Work phase timers
    this.workPhaseTimers = new Map(); // phase -> { startTime, elapsed, timeLimit, completed }
    this.workPhaseInterval = null;
    this.currentWorkPhase = null;
    
    // Work phase time limits (seconds)
    this.workPhaseTimeLimits = options.workPhaseTimeLimits || {
      exercise: 180,   // 3 minutes
      worksheet: 300,  // 5 minutes
      test: 600        // 10 minutes
    };
    
    // Golden key tracking
    this.onTimeCompletions = 0;
    this.goldenKeyAwarded = false;
    
    // Bind public methods
    this.startSessionTimer = this.startSessionTimer.bind(this);
    this.stopSessionTimer = this.stopSessionTimer.bind(this);
    this.startWorkPhaseTimer = this.startWorkPhaseTimer.bind(this);
    this.completeWorkPhaseTimer = this.completeWorkPhaseTimer.bind(this);
    this.stopWorkPhaseTimer = this.stopWorkPhaseTimer.bind(this);
    // Private methods are automatically bound
  }
  
  /**
   * Start session timer
   */
  startSessionTimer() {
    if (this.sessionInterval) {
      console.warn('[TimerService] Session timer already running');
      return;
    }
    
    this.sessionStartTime = Date.now();
    this.sessionElapsed = 0;
    
    this.eventBus.emit('sessionTimerStart', {
      timestamp: this.sessionStartTime
    });
    
    // Tick every second
    this.sessionInterval = setInterval(this.#tickSessionTimer, 1000);
  }
  
  /**
   * Stop session timer
   */
  stopSessionTimer() {
    if (!this.sessionInterval) {
      return;
    }
    
    clearInterval(this.sessionInterval);
    this.sessionInterval = null;
    
    const elapsed = this.sessionElapsed;
    const formatted = this.#formatTime(elapsed);
    
    this.eventBus.emit('sessionTimerStop', {
      elapsed,
      formatted
    });
  }
  
  /**
   * Start work phase timer
   * @param {string} phase - Phase name: 'exercise' | 'worksheet' | 'test'
   */
  startWorkPhaseTimer(phase) {
    if (!['exercise', 'worksheet', 'test'].includes(phase)) {
      console.warn('[TimerService] Invalid work phase:', phase);
      return;
    }
    
    if (this.workPhaseTimers.has(phase)) {
      console.warn('[TimerService] Work phase timer already exists:', phase);
      return;
    }
    
    const timeLimit = this.workPhaseTimeLimits[phase] || 600;
    
    this.workPhaseTimers.set(phase, {
      startTime: Date.now(),
      elapsed: 0,
      timeLimit,
      completed: false,
      onTime: false
    });
    
    this.currentWorkPhase = phase;
    
    this.eventBus.emit('workPhaseTimerStart', {
      phase,
      timestamp: Date.now(),
      timeLimit
    });
    
    // Start work phase ticker if not running
    if (!this.workPhaseInterval) {
      this.workPhaseInterval = setInterval(this.#tickWorkPhaseTimers, 1000);
    }
  }
  
  /**
   * Complete work phase timer (phase finished)
   * @param {string} phase - Phase name
   */
  completeWorkPhaseTimer(phase) {
    const timer = this.workPhaseTimers.get(phase);
    
    if (!timer) {
      console.warn('[TimerService] No timer for phase:', phase);
      return;
    }
    
    if (timer.completed) {
      console.warn('[TimerService] Phase already completed:', phase);
      return;
    }
    
    // Calculate final elapsed time
    const now = Date.now();
    const elapsed = Math.floor((now - timer.startTime) / 1000);
    const onTime = elapsed <= timer.timeLimit;
    
    timer.elapsed = elapsed;
    timer.completed = true;
    timer.onTime = onTime;
    
    this.eventBus.emit('workPhaseTimerComplete', {
      phase,
      elapsed,
      timeLimit: timer.timeLimit,
      onTime,
      formatted: this.#formatTime(elapsed)
    });
    
    // Track on-time completions for golden key
    if (onTime) {
      this.onTimeCompletions++;
      
      // Check golden key eligibility (3 on-time work phases)
      if (this.onTimeCompletions >= 3 && !this.goldenKeyAwarded) {
        this.goldenKeyAwarded = true;
        this.eventBus.emit('goldenKeyEligible', {
          completedPhases: Array.from(this.workPhaseTimers.keys())
            .filter(p => this.workPhaseTimers.get(p).onTime)
        });
      }
    }
    
    this.currentWorkPhase = null;
  }
  
  /**
   * Stop work phase timer without completing
   * @param {string} phase - Phase name
   */
  stopWorkPhaseTimer(phase) {
    const timer = this.workPhaseTimers.get(phase);
    
    if (!timer) {
      return;
    }
    
    const elapsed = timer.elapsed;
    
    this.eventBus.emit('workPhaseTimerStop', {
      phase,
      elapsed,
      formatted: this.#formatTime(elapsed)
    });
    
    this.currentWorkPhase = null;
  }
  
  /**
   * Get session elapsed time
   * @returns {{ elapsed: number, formatted: string }}
   */
  getSessionTime() {
    return {
      elapsed: this.sessionElapsed,
      formatted: this.#formatTime(this.sessionElapsed)
    };
  }
  
  /**
   * Get work phase timer
   * @param {string} phase - Phase name
   * @returns {{ elapsed: number, timeLimit: number, remaining: number, formatted: string, onTime: boolean } | null}
   */
  getWorkPhaseTime(phase) {
    const timer = this.workPhaseTimers.get(phase);
    
    if (!timer) {
      return null;
    }
    
    const remaining = Math.max(0, timer.timeLimit - timer.elapsed);
    
    return {
      elapsed: timer.elapsed,
      timeLimit: timer.timeLimit,
      remaining,
      formatted: this.#formatTime(timer.elapsed),
      remainingFormatted: this.#formatTime(remaining),
      onTime: timer.elapsed <= timer.timeLimit,
      completed: timer.completed
    };
  }
  
  /**
   * Get golden key status
   * @returns {{ eligible: boolean, onTimeCompletions: number, required: number }}
   */
  getGoldenKeyStatus() {
    return {
      eligible: this.goldenKeyAwarded,
      onTimeCompletions: this.onTimeCompletions,
      required: 3
    };
  }
  
  /**
   * Serialize state for snapshot persistence
   * @returns {Object}
   */
  serialize() {
    return {
      sessionElapsed: this.sessionElapsed,
      workPhaseTimers: Array.from(this.workPhaseTimers.entries()).map(([phase, timer]) => ({
        phase,
        elapsed: timer.elapsed,
        timeLimit: timer.timeLimit,
        completed: timer.completed,
        onTime: timer.onTime
      })),
      onTimeCompletions: this.onTimeCompletions,
      goldenKeyAwarded: this.goldenKeyAwarded
    };
  }
  
  /**
   * Restore state from snapshot
   * @param {Object} data - Serialized state
   */
  restore(data) {
    if (!data) return;
    
    this.sessionElapsed = data.sessionElapsed || 0;
    this.onTimeCompletions = data.onTimeCompletions || 0;
    this.goldenKeyAwarded = data.goldenKeyAwarded || false;
    
    // Restore work phase timers
    if (data.workPhaseTimers) {
      this.workPhaseTimers.clear();
      
      data.workPhaseTimers.forEach(timer => {
        this.workPhaseTimers.set(timer.phase, {
          startTime: null, // Don't resume timing
          elapsed: timer.elapsed,
          timeLimit: timer.timeLimit,
          completed: timer.completed,
          onTime: timer.onTime
        });
      });
    }
  }
  
  /**
   * Tick session timer
   * @private
   */
  #tickSessionTimer() {
    if (!this.sessionStartTime) return;
    
    const now = Date.now();
    this.sessionElapsed = Math.floor((now - this.sessionStartTime) / 1000);
    
    this.eventBus.emit('sessionTimerTick', {
      elapsed: this.sessionElapsed,
      formatted: this.#formatTime(this.sessionElapsed)
    });
  }
  
  /**
   * Tick work phase timers
   * @private
   */
  #tickWorkPhaseTimers() {
    if (!this.currentWorkPhase) return;
    
    const timer = this.workPhaseTimers.get(this.currentWorkPhase);
    if (!timer || timer.completed) return;
    
    const now = Date.now();
    timer.elapsed = Math.floor((now - timer.startTime) / 1000);
    
    const remaining = Math.max(0, timer.timeLimit - timer.elapsed);
    const onTime = timer.elapsed <= timer.timeLimit;
    
    this.eventBus.emit('workPhaseTimerTick', {
      phase: this.currentWorkPhase,
      elapsed: timer.elapsed,
      remaining,
      timeLimit: timer.timeLimit,
      onTime,
      formatted: this.#formatTime(timer.elapsed),
      remainingFormatted: this.#formatTime(remaining)
    });
  }
  
  /**
   * Format seconds to MM:SS
   * @private
   * @param {number} seconds
   * @returns {string}
   */
  #formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  /**
   * Clean up timers
   */
  destroy() {
    if (this.sessionInterval) {
      clearInterval(this.sessionInterval);
      this.sessionInterval = null;
    }
    
    if (this.workPhaseInterval) {
      clearInterval(this.workPhaseInterval);
      this.workPhaseInterval = null;
    }
    
    this.workPhaseTimers.clear();
  }
}
