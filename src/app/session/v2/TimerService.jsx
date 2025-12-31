/**
 * TimerService.jsx
 * Manages session, play, and work phase timers
 * 
 * Timers:
 * - Session timer: Tracks total session duration from start to complete
 * - Play timers: Green timer for exploration/opening actions (phases 2-5: Comprehension, Exercise, Worksheet, Test)
 * - Work phase timers: Amber/red timer for focused work (for golden key)
 * 
 * Timer Modes:
 * - Phase 1 (Discussion): No play timer, no opening actions (eliminates play timer exploit)
 * - Phases 2-5 (Comprehension, Exercise, Worksheet, Test): Play timer → opening actions → work timer
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
 * - playTimerStart: { phase, timestamp, timeLimit } - Play timer started
 * - playTimerTick: { phase, elapsed, remaining, formatted } - Every second during play time
 * - playTimerExpired: { phase } - Play timer reached 0:00
 * - workPhaseTimerStart: { phase, timestamp } - Work phase timer started
 * - workPhaseTimerTick: { phase, elapsed, remaining, onTime } - Every second during work time
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
    
    // Play timers (phases 2-5: comprehension, exercise, worksheet, test)
    this.playTimers = new Map(); // phase -> { startTime, elapsed, timeLimit, expired }
    this.playTimerInterval = null;
    this.currentPlayPhase = null;
    
    // Play timer time limits (seconds) - default 3 minutes per phase
    this.playTimerLimits = options.playTimerLimits || {
      comprehension: 180, // 3 minutes
      exercise: 180,      // 3 minutes  
      worksheet: 180,     // 3 minutes
      test: 180           // 3 minutes
    };
    
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
    
    // SessionStorage cache for refresh recovery
    this.lessonKey = options.lessonKey || null;
    this.phase = options.phase || null;
    this.mode = 'play'; // play or work
    
    // Restore from sessionStorage if available
    this.#loadFromSessionStorage();
    
    // Bind public methods
    this.startSessionTimer = this.startSessionTimer.bind(this);
    this.stopSessionTimer = this.stopSessionTimer.bind(this);
    this.startPlayTimer = this.startPlayTimer.bind(this);
    this.stopPlayTimer = this.stopPlayTimer.bind(this);
    this.transitionToWork = this.transitionToWork.bind(this);
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
   * Starts the play timer for a phase (phases 2-5 only).
   * Play timers allow exploration/opening actions with a time limit.
   * When expired, transitions to work mode via PlayTimeExpiredOverlay.
   * 
   * @param {string} phase - Phase name ('comprehension', 'exercise', 'worksheet', 'test')
   * @param {number} [timeLimit] - Optional time limit override (seconds)
   */
  startPlayTimer(phase, timeLimit = null) {
    // Discussion phase has no play timer (architectural decision)
    if (phase === 'discussion') return;
    
    // Only valid for phases 2-5
    const validPhases = ['comprehension', 'exercise', 'worksheet', 'test'];
    if (!validPhases.includes(phase)) {
      console.warn(`[TimerService] Invalid phase "${phase}" for play timer`);
      return;
    }
    
    const limit = timeLimit !== null ? timeLimit : this.playTimerLimits[phase];
    if (!limit) {
      console.warn(`[TimerService] No time limit configured for phase "${phase}"`);
      return;
    }
    
    // Initialize play timer
    this.playTimers.set(phase, {
      startTime: Date.now(),
      elapsed: 0,
      timeLimit: limit,
      expired: false
    });
    this.currentPlayPhase = phase;
    this.mode = 'play';
    
    this.eventBus.emit('playTimerStart', {
      phase,
      timestamp: Date.now(),
      timeLimit: limit,
      formattedLimit: this.#formatTime(limit)
    });
    
    // Start tick interval if not already running
    if (!this.playTimerInterval) {
      this.playTimerInterval = setInterval(this.#tickPlayTimers.bind(this), 1000);
    }
    
    this.#saveToSessionStorage();
  }
  
  /**
   * Stops the play timer for a phase.
   * 
   * @param {string} phase - Phase name
   */
  stopPlayTimer(phase) {
    this.playTimers.delete(phase);
    if (this.currentPlayPhase === phase) {
      this.currentPlayPhase = null;
    }
    
    // Clear interval if no active play timers
    if (this.playTimers.size === 0 && this.playTimerInterval) {
      clearInterval(this.playTimerInterval);
      this.playTimerInterval = null;
    }
    
    this.#saveToSessionStorage();
  }
  
  /**
   * Transitions from play mode to work mode for a phase.
   * Stops play timer and starts work timer.
   * 
   * @param {string} phase - Phase name
   */
  transitionToWork(phase) {
    this.stopPlayTimer(phase);
    this.mode = 'work';
    this.startWorkPhaseTimer(phase);
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
      playTimers: Array.from(this.playTimers.entries()).map(([phase, timer]) => ({
        phase,
        elapsed: timer.elapsed,
        timeLimit: timer.timeLimit,
        expired: timer.expired
      })),
      workPhaseTimers: Array.from(this.workPhaseTimers.entries()).map(([phase, timer]) => ({
        phase,
        elapsed: timer.elapsed,
        timeLimit: timer.timeLimit,
        completed: timer.completed,
        onTime: timer.onTime
      })),
      onTimeCompletions: this.onTimeCompletions,
      goldenKeyAwarded: this.goldenKeyAwarded,
      mode: this.mode
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
    this.mode = data.mode || 'play';
    
    // Restore play timers
    if (data.playTimers) {
      this.playTimers.clear();
      
      data.playTimers.forEach(timer => {
        this.playTimers.set(timer.phase, {
          startTime: Date.now() - (timer.elapsed * 1000), // Resume from elapsed
          elapsed: timer.elapsed,
          timeLimit: timer.timeLimit,
          expired: timer.expired
        });
        
        if (!timer.expired) {
          this.currentPlayPhase = timer.phase;
          if (!this.playTimerInterval) {
            this.playTimerInterval = setInterval(this.#tickPlayTimers.bind(this), 1000);
          }
        }
      });
    }
    
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
    
    this.#saveToSessionStorage();
  }
  
  /**
   * Tick play timers
   * @private
   */
  #tickPlayTimers() {
    if (!this.currentPlayPhase) return;
    
    const timer = this.playTimers.get(this.currentPlayPhase);
    if (!timer || timer.expired) return;
    
    const now = Date.now();
    timer.elapsed = Math.floor((now - timer.startTime) / 1000);
    const remaining = Math.max(0, timer.timeLimit - timer.elapsed);
    
    this.eventBus.emit('playTimerTick', {
      phase: this.currentPlayPhase,
      elapsed: timer.elapsed,
      remaining,
      formatted: this.#formatTime(timer.elapsed),
      remainingFormatted: this.#formatTime(remaining)
    });
    
    // Check for expiration
    if (remaining === 0 && !timer.expired) {
      timer.expired = true;
      this.eventBus.emit('playTimerExpired', {
        phase: this.currentPlayPhase,
        timestamp: Date.now()
      });
      
      // Stop the play timer
      this.stopPlayTimer(this.currentPlayPhase);
    }
    
    this.#saveToSessionStorage();
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
    
    // Save to sessionStorage after each tick
    this.#saveToSessionStorage();
    
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
    
    if (this.playTimerInterval) {
      clearInterval(this.playTimerInterval);
      this.playTimerInterval = null;
    }
    
    if (this.workPhaseInterval) {
      clearInterval(this.workPhaseInterval);
      this.workPhaseInterval = null;
    }
    
    // Clear sessionStorage on destroy
    this.#clearSessionStorage();
  }
  
  // SessionStorage cache methods
  #getSessionStorageKey() {
    if (!this.lessonKey || !this.phase) return null;
    return `session_timer_state:${this.lessonKey}:${this.phase}:${this.mode}`;
  }
  
  #loadFromSessionStorage() {
    if (typeof window === 'undefined') return;
    
    const key = this.#getSessionStorageKey();
    if (!key) return;
    
    try {
      const stored = sessionStorage.getItem(key);
      if (!stored) return;
      
      const data = JSON.parse(stored);
      this.sessionElapsed = data.sessionElapsed || 0;
      this.onTimeCompletions = data.onTimeCompletions || 0;
      this.goldenKeyAwarded = data.goldenKeyAwarded || false;
      this.mode = data.mode || 'play';
      
      // Restore play timer state if present
      if (data.currentPlayPhase && data.playTimerElapsed !== undefined) {
        const phase = data.currentPlayPhase;
        const limit = this.playTimerLimits[phase];
        if (limit) {
          this.playTimers.set(phase, {
            startTime: Date.now() - (data.playTimerElapsed * 1000),
            elapsed: data.playTimerElapsed,
            timeLimit: limit,
            expired: data.playTimerExpired || false
          });
          this.currentPlayPhase = phase;
          
          if (!data.playTimerExpired && !this.playTimerInterval) {
            this.playTimerInterval = setInterval(this.#tickPlayTimers.bind(this), 1000);
          }
        }
      }
      
      console.log('[TimerService] Restored from sessionStorage:', data);
    } catch (err) {
      console.error('[TimerService] SessionStorage load error:', err);
    }
  }
  
  #saveToSessionStorage() {
    if (typeof window === 'undefined') return;
    
    const key = this.#getSessionStorageKey();
    if (!key) return;
    
    try {
      const data = {
        sessionElapsed: this.sessionElapsed,
        onTimeCompletions: this.onTimeCompletions,
        goldenKeyAwarded: this.goldenKeyAwarded,
        mode: this.mode,
        timestamp: Date.now()
      };
      
      // Save play timer state if active
      if (this.currentPlayPhase) {
        const timer = this.playTimers.get(this.currentPlayPhase);
        if (timer) {
          data.currentPlayPhase = this.currentPlayPhase;
          data.playTimerElapsed = timer.elapsed;
          data.playTimerExpired = timer.expired;
        }
      }
      
      sessionStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      console.error('[TimerService] SessionStorage save error:', err);
    }
  }
  
  #clearSessionStorage() {
    if (typeof window === 'undefined') return;
    
    const key = this.#getSessionStorageKey();
    if (!key) return;
    
    try {
      sessionStorage.removeItem(key);
    } catch (err) {
      console.error('[TimerService] SessionStorage clear error:', err);
    }
  }
}
