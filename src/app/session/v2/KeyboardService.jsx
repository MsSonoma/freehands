/**
 * KeyboardService.jsx
 * Manages keyboard hotkeys for V2 session page
 * 
 * Hotkeys:
 * - PageDown: Skip current item (teaching sentence, question, etc.)
 * - PageUp: Repeat current item (teaching sentence)
 * - End: Next sentence (teaching phase)
 * - Space: Pause/Resume audio
 * - Escape: Stop audio
 * 
 * Events emitted:
 * - hotkeyPressed: { key, action, phase } - Hotkey was pressed
 */

'use client';

export class KeyboardService {
  constructor(eventBus, options = {}) {
    this.eventBus = eventBus;
    this.enabled = true;
    this.currentPhase = 'idle';
    
    // Key mappings
    this.keyMap = {
      'PageDown': 'skip',
      'PageUp': 'repeat',
      'End': 'next',
      ' ': 'pause',
      'Escape': 'stop'
    };
    
    // Bind methods
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.enable = this.enable.bind(this);
    this.disable = this.disable.bind(this);
    this.setPhase = this.setPhase.bind(this);
  }
  
  /**
   * Initialize keyboard listeners
   */
  init() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
    }
  }
  
  /**
   * Handle keydown events
   * @private
   * @param {KeyboardEvent} event
   */
  handleKeyDown(event) {
    if (!this.enabled) return;
    
    // Ignore if user is typing in input/textarea
    const target = event.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      // Only allow PageUp/PageDown in inputs (for skip/repeat)
      if (event.key !== 'PageUp' && event.key !== 'PageDown') {
        return;
      }
    }
    
    const action = this.keyMap[event.key];
    
    if (!action) return;
    
    // Prevent default browser behavior
    event.preventDefault();
    event.stopPropagation();
    
    // Emit hotkey event
    this.eventBus.emit('hotkeyPressed', {
      key: event.key,
      action,
      phase: this.currentPhase
    });
  }
  
  /**
   * Enable keyboard hotkeys
   */
  enable() {
    this.enabled = true;
  }
  
  /**
   * Disable keyboard hotkeys
   */
  disable() {
    this.enabled = false;
  }
  
  /**
   * Set current phase (for context-aware hotkeys)
   * @param {string} phase - Current phase name
   */
  setPhase(phase) {
    this.currentPhase = phase;
  }
  
  /**
   * Check if hotkeys are enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }
  
  /**
   * Get available hotkeys for current phase
   * @returns {Array<{key: string, action: string, description: string}>}
   */
  getAvailableHotkeys() {
    const baseHotkeys = [
      { key: 'Space', action: 'pause', description: 'Pause/Resume audio' },
      { key: 'Escape', action: 'stop', description: 'Stop audio' }
    ];
    
    const phaseHotkeys = {
      teaching: [
        { key: 'PageDown', action: 'skip', description: 'Skip sentence' },
        { key: 'PageUp', action: 'repeat', description: 'Repeat sentence' },
        { key: 'End', action: 'next', description: 'Next sentence' }
      ],
      comprehension: [
        { key: 'PageDown', action: 'skip', description: 'Skip question' }
      ],
      discussion: [
        { key: 'PageDown', action: 'skip', description: 'Skip activity' }
      ],
      exercise: [
        { key: 'PageDown', action: 'skip', description: 'Skip question' }
      ],
      worksheet: [
        { key: 'PageDown', action: 'skip', description: 'Skip question' }
      ],
      test: [
        { key: 'PageDown', action: 'skip', description: 'Skip question' }
      ]
    };
    
    const phase = phaseHotkeys[this.currentPhase] || [];
    return [...baseHotkeys, ...phase];
  }
  
  /**
   * Clean up keyboard listeners
   */
  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
    }
  }
}
