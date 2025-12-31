/**
 * OpeningActionsController.jsx
 * 
 * Manages opening actions (Ask, Riddle, Poem, Story, Fill-in-Fun) in V2 architecture.
 * Available during play time in phases 2-5 (Comprehension, Exercise, Worksheet, Test).
 * 
 * V2 architectural patterns:
 * - Event-driven communication via EventBus
 * - Private fields for encapsulation (#)
 * - Single source of truth (no state duplication)
 * - Deterministic async/await chains
 * 
 * Events emitted:
 * - openingActionStart: { action, phase }
 * - openingActionComplete: { action, phase }
 * - openingActionCancel: { action, phase }
 * 
 * Events consumed:
 * - (none currently - self-contained controller)
 * 
 * Opening Actions:
 * 1. Ask: Learner asks Ms. Sonoma questions
 * 2. Riddle: Present riddle with hint/reveal
 * 3. Poem: Read subject-themed poem
 * 4. Story: Collaborative storytelling
 * 5. Fill-in-Fun: Mad Libs word game
 */

import { pickNextRiddle } from '@/app/lib/riddles';
import { getGradeAndDifficultyStyle } from '../utils/constants';

export class OpeningActionsController {
  #eventBus;
  #audioEngine;
  #phase;
  #subject;
  #learnerGrade;
  #difficulty;
  
  // Current action state
  #currentAction = null; // 'ask' | 'riddle' | 'poem' | 'story' | 'fill-in-fun' | null
  #actionState = {}; // Action-specific state
  
  constructor(eventBus, audioEngine, options = {}) {
    this.#eventBus = eventBus;
    this.#audioEngine = audioEngine;
    this.#phase = options.phase || null;
    this.#subject = options.subject || 'math';
    this.#learnerGrade = options.learnerGrade || '';
    this.#difficulty = options.difficulty || 'moderate';
  }
  
  /**
   * Start Ask Ms. Sonoma action
   */
  async startAsk() {
    this.#currentAction = 'ask';
    this.#actionState = {
      stage: 'awaiting-input', // 'awaiting-input' | 'confirming' | 'generating' | 'complete'
      question: '',
      answer: ''
    };
    
    this.#eventBus.emit('openingActionStart', {
      action: 'ask',
      phase: this.#phase
    });
    
    const greeting = 'I\'m listening. What would you like to know?';
    await this.#audioEngine.speak(greeting);
    
    return { success: true, message: 'Ask action started' };
  }
  
  /**
   * Submit question in Ask action
   * @param {string} question - Learner's question
   */
  async submitAskQuestion(question) {
    if (this.#currentAction !== 'ask') {
      return { success: false, error: 'Ask action not active' };
    }
    
    this.#actionState.question = question;
    this.#actionState.stage = 'generating';
    
    // Call Ms. Sonoma API
    try {
      const instruction = [
        `You are Ms. Sonoma. ${getGradeAndDifficultyStyle(this.#learnerGrade, this.#difficulty)}`,
        `The learner asked: "${question}"`,
        'Answer their question in 2-3 short sentences.',
        'Be warm, encouraging, and age-appropriate.',
        'If the question is off-topic or inappropriate, gently redirect.'
      ].join(' ');
      
      const response = await fetch('/api/sonoma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, innertext: '' })
      });
      
      if (!response.ok) {
        throw new Error('Sonoma API request failed');
      }
      
      const data = await response.json();
      const answer = data.reply || 'That\'s an interesting question! Let me think about that.';
      
      this.#actionState.answer = answer;
      this.#actionState.stage = 'complete';
      
      await this.#audioEngine.speak(answer);
      
      return { success: true, answer };
    } catch (err) {
      console.error('[OpeningActionsController] Ask API error:', err);
      
      const fallback = 'That\'s a great question! Keep thinking about it.';
      this.#actionState.answer = fallback;
      this.#actionState.stage = 'complete';
      
      await this.#audioEngine.speak(fallback);
      
      return { success: true, answer: fallback };
    }
  }
  
  /**
   * Cancel Ask action
   */
  cancelAsk() {
    if (this.#currentAction !== 'ask') return;
    
    this.#eventBus.emit('openingActionCancel', {
      action: 'ask',
      phase: this.#phase
    });
    
    this.#currentAction = null;
    this.#actionState = {};
  }
  
  /**
   * Complete Ask action and return to opening actions
   */
  completeAsk() {
    if (this.#currentAction !== 'ask') return;
    
    this.#eventBus.emit('openingActionComplete', {
      action: 'ask',
      phase: this.#phase
    });
    
    this.#currentAction = null;
    this.#actionState = {};
  }
  
  /**
   * Start Riddle action
   */
  async startRiddle() {
    this.#currentAction = 'riddle';
    
    // Pick random riddle
    const riddleObj = pickNextRiddle(this.#subject);
    
    this.#actionState = {
      stage: 'question', // 'question' | 'hint' | 'answer'
      riddle: riddleObj
    };
    
    this.#eventBus.emit('openingActionStart', {
      action: 'riddle',
      phase: this.#phase
    });
    
    const text = `Here's a riddle for you! ${riddleObj.question}`;
    await this.#audioEngine.speak(text);
    
    return { success: true, riddle: riddleObj };
  }
  
  /**
   * Reveal riddle hint
   */
  async revealRiddleHint() {
    if (this.#currentAction !== 'riddle') {
      return { success: false, error: 'Riddle action not active' };
    }
    
    this.#actionState.stage = 'hint';
    
    const hint = this.#actionState.riddle.hint || 'Think carefully about the words.';
    const text = `Here's a hint: ${hint}`;
    await this.#audioEngine.speak(text);
    
    return { success: true, hint };
  }
  
  /**
   * Reveal riddle answer
   */
  async revealRiddleAnswer() {
    if (this.#currentAction !== 'riddle') {
      return { success: false, error: 'Riddle action not active' };
    }
    
    this.#actionState.stage = 'answer';
    
    const answer = this.#actionState.riddle.answer || 'The answer is a secret!';
    const text = `The answer is: ${answer}`;
    await this.#audioEngine.speak(text);
    
    return { success: true, answer };
  }
  
  /**
   * Complete Riddle action
   */
  completeRiddle() {
    if (this.#currentAction !== 'riddle') return;
    
    this.#eventBus.emit('openingActionComplete', {
      action: 'riddle',
      phase: this.#phase
    });
    
    this.#currentAction = null;
    this.#actionState = {};
  }
  
  /**
   * Get current action state (for UI rendering)
   * @returns {Object} { action, stage, data }
   */
  getState() {
    return {
      action: this.#currentAction,
      stage: this.#actionState.stage || null,
      data: { ...this.#actionState }
    };
  }
  
  /**
   * Check if an action is currently active
   * @returns {boolean}
   */
  isActive() {
    return this.#currentAction !== null;
  }
  
  /**
   * Clean up controller
   */
  destroy() {
    this.#currentAction = null;
    this.#actionState = {};
  }
}
