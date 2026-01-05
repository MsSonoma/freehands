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
      type: 'ask',
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
      type: 'ask',
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
      type: 'ask',
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
      type: 'riddle',
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
      type: 'riddle',
      phase: this.#phase
    });
    
    this.#currentAction = null;
    this.#actionState = {};
  }
  
  /**
   * Start Poem action
   */
  async startPoem() {
    this.#currentAction = 'poem';
    this.#actionState = {
      stage: 'reading'
    };
    
    this.#eventBus.emit('openingActionStart', {
      action: 'poem',
      type: 'poem',
      phase: this.#phase
    });
    
    // Generate subject-themed poem using GPT-4
    const instruction = [
      `You are Ms. Sonoma. ${getGradeAndDifficultyStyle(this.#learnerGrade, this.#difficulty)}`,
      `Write a short, fun poem (4-8 lines) about ${this.#subject}.`,
      'Make it age-appropriate, educational, and upbeat.',
      'Use simple rhymes and clear language.'
    ].join(' ');
    
    try {
      const response = await fetch('/api/sonoma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, innertext: '' })
      });
      
      if (!response.ok) {
        throw new Error('Poem generation failed');
      }
      
      const data = await response.json();
      const poem = data.reply || 'Learning is fun, every single day!';
      
      this.#actionState.poem = poem;
      await this.#audioEngine.speak(poem);
      
      return { success: true, poem };
    } catch (err) {
      console.error('[OpeningActionsController] Poem error:', err);
      
      const fallback = 'Learning is fun, every single day! Knowledge helps us grow in every way!';
      this.#actionState.poem = fallback;
      await this.#audioEngine.speak(fallback);
      
      return { success: true, poem: fallback };
    }
    
    this.#actionState.stage = 'complete';
  }
  
  /**
   * Complete Poem action
   */
  completePoem() {
    if (this.#currentAction !== 'poem') return;
    
    this.#eventBus.emit('openingActionComplete', {
      action: 'poem',
      type: 'poem',
      phase: this.#phase
    });
    
    this.#currentAction = null;
    this.#actionState = {};
  }
  
  /**
   * Start Story action (collaborative storytelling)
   */
  async startStory() {
    this.#currentAction = 'story';
    this.#actionState = {
      stage: 'setup',
      transcript: [],
      turn: 0
    };
    
    this.#eventBus.emit('openingActionStart', {
      action: 'story',
      type: 'story',
      phase: this.#phase
    });
    
    // Start story setup
    const setupPrompt = 'Let\'s tell a story together! What kind of character should we have?';
    await this.#audioEngine.speak(setupPrompt);
    
    return { success: true, prompt: setupPrompt };
  }
  
  /**
   * Continue story with learner input
   */
  async continueStory(userInput) {
    if (this.#currentAction !== 'story') {
      return { success: false, error: 'Story not active' };
    }
    
    const trimmed = (userInput || '').trim();
    if (!trimmed) {
      return { success: false, error: 'Please say something for the story!' };
    }
    
    // Add user input to transcript
    this.#actionState.transcript.push({ role: 'user', text: trimmed });
    this.#actionState.turn++;
    
    // Generate story continuation
    const storyContext = this.#actionState.transcript.map(turn => 
      turn.role === 'user' ? `Child: "${turn.text}"` : `You: "${turn.text}"`
    ).join(' ');
    
    const instruction = [
      `You are Ms. Sonoma. ${getGradeAndDifficultyStyle(this.#learnerGrade, this.#difficulty)}`,
      `Continue this collaborative story: ${storyContext}`,
      'Add 1-2 exciting sentences based on what the child said.',
      'Keep it fun, age-appropriate, and encourage their creativity.',
      'End with "What happens next?" if the story should continue.'
    ].join(' ');
    
    try {
      const response = await fetch('/api/sonoma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, innertext: '' })
      });
      
      if (!response.ok) {
        throw new Error('Story continuation failed');
      }
      
      const data = await response.json();
      const continuation = data.reply || 'And then something amazing happened! What happens next?';
      
      this.#actionState.transcript.push({ role: 'assistant', text: continuation });
      this.#actionState.stage = 'telling';
      await this.#audioEngine.speak(continuation);
      
      return { success: true, continuation };
    } catch (err) {
      console.error('[OpeningActionsController] Story error:', err);
      
      const fallback = 'That\'s a great idea! The adventure continues. What happens next?';
      this.#actionState.transcript.push({ role: 'assistant', text: fallback });
      this.#actionState.stage = 'telling';
      await this.#audioEngine.speak(fallback);
      
      return { success: true, continuation: fallback };
    }
  }
  
  /**
   * Complete Story action
   */
  completeStory() {
    if (this.#currentAction !== 'story') return;
    
    this.#eventBus.emit('openingActionComplete', {
      action: 'story',
      type: 'story',
      phase: this.#phase
    });
    
    this.#currentAction = null;
    this.#actionState = {};
  }
  
  /**
   * Start Fill-in-Fun action (Mad Libs style)
   */
  async startFillInFun() {
    this.#currentAction = 'fill-in-fun';
    this.#actionState = {
      stage: 'collecting',
      template: null,
      words: [],
      currentIndex: 0
    };
    
    this.#eventBus.emit('openingActionStart', {
      action: 'fill-in-fun',
      type: 'fill-in-fun',
      phase: this.#phase
    });
    
    // Generate fill-in-fun template
    const instruction = [
      `You are Ms. Sonoma. ${getGradeAndDifficultyStyle(this.#learnerGrade, this.#difficulty)}`,
      `Create a fun Mad Libs style story about ${this.#subject}.`,
      'Use this format: "The [ADJECTIVE] [NOUN] was [VERB]ing in the [PLACE]."',
      'Make it educational and age-appropriate.',
      'Include 4-5 blanks with labels like [ADJECTIVE], [NOUN], [VERB], [PLACE].'
    ].join(' ');
    
    try {
      const response = await fetch('/api/sonoma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, innertext: '' })
      });
      
      if (!response.ok) {
        throw new Error('Fill-in-Fun generation failed');
      }
      
      const data = await response.json();
      const template = data.reply || 'The [ADJECTIVE] [NOUN] was [VERB]ing!';
      
      this.#actionState.template = template;
      
      // Extract word types needed
      const wordTypes = template.match(/\[([A-Z]+)\]/g) || [];
      this.#actionState.wordTypes = wordTypes.map(type => type.replace(/[\[\]]/g, ''));
      
      const firstPrompt = `Let's play Fill-in-Fun! Give me a ${this.#actionState.wordTypes[0].toLowerCase()}.`;
      await this.#audioEngine.speak(firstPrompt);
      
      return { success: true, template, prompt: firstPrompt };
    } catch (err) {
      console.error('[OpeningActionsController] Fill-in-Fun error:', err);
      
      const fallbackTemplate = 'The [ADJECTIVE] [NOUN] was very [ADJECTIVE]!';
      this.#actionState.template = fallbackTemplate;
      this.#actionState.wordTypes = ['ADJECTIVE', 'NOUN', 'ADJECTIVE'];
      
      const firstPrompt = 'Let\'s play Fill-in-Fun! Give me an adjective.';
      await this.#audioEngine.speak(firstPrompt);
      
      return { success: true, template: fallbackTemplate, prompt: firstPrompt };
    }
  }
  
  /**
   * Add word to Fill-in-Fun
   */
  async addFillInFunWord(word) {
    if (this.#currentAction !== 'fill-in-fun') {
      return { success: false, error: 'Fill-in-Fun not active' };
    }
    
    const trimmed = (word || '').trim();
    if (!trimmed) {
      return { success: false, error: 'Please say a word!' };
    }
    
    this.#actionState.words.push(trimmed);
    this.#actionState.currentIndex++;
    
    // Check if we need more words
    if (this.#actionState.currentIndex < this.#actionState.wordTypes.length) {
      const nextType = this.#actionState.wordTypes[this.#actionState.currentIndex];
      const prompt = `Great! Now give me a ${nextType.toLowerCase()}.`;
      await this.#audioEngine.speak(prompt);
      
      return { success: true, prompt };
    } else {
      // All words collected - read completed story
      this.#actionState.stage = 'complete';
      
      let completedStory = this.#actionState.template;
      this.#actionState.words.forEach(word => {
        completedStory = completedStory.replace(/\[[A-Z]+\]/, word);
      });
      
      const finalText = `Here's your story: ${completedStory}`;
      await this.#audioEngine.speak(finalText);
      this.#eventBus.emit('openingActionComplete', {
        action: 'fill-in-fun',
        type: 'fill-in-fun',
        phase: this.#phase
      });
      this.#currentAction = null;
      this.#actionState = {};
      
      return { success: true, completed: true, story: completedStory };
    }
  }
  
  /**
   * Complete Fill-in-Fun action
   */
  completeFillInFun() {
    if (this.#currentAction !== 'fill-in-fun') return;
    
    this.#eventBus.emit('openingActionComplete', {
      action: 'fill-in-fun',
      type: 'fill-in-fun',
      phase: this.#phase
    });
    
    this.#currentAction = null;
    this.#actionState = {};
  }
  
  /**
   * Complete Riddle action
   */
  completeRiddle() {
    if (this.#currentAction !== 'riddle') return;
    
    this.#eventBus.emit('openingActionComplete', {
      action: 'riddle',
      type: 'riddle',
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
