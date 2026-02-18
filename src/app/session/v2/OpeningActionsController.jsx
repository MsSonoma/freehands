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

import { pickNextRiddle, renderRiddle } from '@/app/lib/riddles';
import { pickNextJoke, renderJoke } from '@/app/lib/jokes';
import { fetchTTS } from './services';
import { getGradeAndDifficultyStyle } from '../utils/constants';

export class OpeningActionsController {
  #eventBus;
  #audioEngine;
  #phase;
  #subject;
  #learnerGrade;
  #difficulty;

  #actionNonce = 0;

  #fillInFunTemplatePromise = null;
  
  // Current action state
  #currentAction = null; // 'ask' | 'riddle' | 'poem' | 'story' | 'fill-in-fun' | 'joke' | null
  #actionState = {}; // Action-specific state
  
  constructor(eventBus, audioEngine, options = {}) {
    this.#eventBus = eventBus;
    this.#audioEngine = audioEngine;
    this.#phase = options.phase || null;
    this.#subject = options.subject || 'math';
    this.#learnerGrade = options.learnerGrade || '';
    this.#difficulty = options.difficulty || 'moderate';

    // Provide a speak shim when AudioEngine doesn't expose one (V1 parity helper)
    if (this.#audioEngine && typeof this.#audioEngine.speak !== 'function') {
      this.#audioEngine.speak = async (text) => {
        const spoken = String(text ?? '').trim();
        if (!spoken || typeof this.#audioEngine?.playAudio !== 'function') return;
        let audioBase64 = null;
        try {
          audioBase64 = await fetchTTS(spoken);
        } catch (err) {
          console.warn('[OpeningActionsController] TTS fetch failed, using synthetic captions:', err);
        }
        try {
          await this.#audioEngine.playAudio(audioBase64, [spoken]);
        } catch (err) {
          console.error('[OpeningActionsController] speak shim playback failed:', err);
        }
      };
    }
  }
  
  /**
   * Start Ask Ms. Sonoma action
   */
  async startAsk() {
    this.#actionNonce += 1;
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
  async submitAskQuestion(question, askContext = {}) {
    if (this.#currentAction !== 'ask') {
      return { success: false, error: 'Ask action not active' };
    }

    const nonce = this.#actionNonce;
    
    this.#actionState.question = question;
    this.#actionState.stage = 'generating';

    const {
      lessonTitle: ctxLessonTitle,
      vocabChunk = '',
      problemChunk = '',
      subject: ctxSubject,
      difficulty: ctxDifficulty,
      gradeLevel: ctxGradeLevel
    } = askContext || {};

    const lessonTitle = (ctxLessonTitle || this.#subject || 'this topic').toString();
    const subject = (ctxSubject || this.#subject || 'math').toString();
    const gradeLevel = ctxGradeLevel || this.#learnerGrade;
    const difficulty = ctxDifficulty || this.#difficulty;
    
    // Call Ms. Sonoma API
    try {
      const instruction = [
        `You are Ms. Sonoma. ${getGradeAndDifficultyStyle(gradeLevel, difficulty)}`,
        `Lesson title: "${lessonTitle}".`,
        subject ? `Subject: ${subject}.` : '',
        question ? `The learner asked: "${question}".` : '',
        vocabChunk || '',
        problemChunk || '',
        'Answer their question in 2-3 short sentences.',
        'Use the provided vocab meanings when relevant so words with multiple definitions stay on-topic.',
        'Be warm, encouraging, and age-appropriate.',
        'Do not ask the learner any questions in your reply.',
        'If the question is off-topic or inappropriate, gently redirect.'
      ].filter(Boolean).join(' ');
      
      const response = await fetch('/api/sonoma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Ask uses the frontend audio engine for speech; skip server-side TTS to
        // avoid large base64 payloads and reduce failure risk.
        body: JSON.stringify({ instruction, innertext: question, skipAudio: true })
      });
      
      if (!response.ok) {
        throw new Error(`Sonoma API request failed (status ${response.status})`);
      }
      
      const data = await response.json();
      const answer = data.reply || data.text || 'That\'s an interesting question! Let me think about that.';
      
      this.#actionState.answer = answer;
      this.#actionState.stage = 'complete';

      if (nonce !== this.#actionNonce || this.#currentAction !== 'ask') {
        return { success: false, cancelled: true };
      }
      
      try {
        await this.#audioEngine.speak(answer);
      } catch (err) {
        // If playback is interrupted (skip/stop), do not fail the flow.
      }

      // Ask follow-up after answering (requested parity: always invite more questions)
      if (nonce !== this.#actionNonce || this.#currentAction !== 'ask') {
        return { success: false, cancelled: true };
      }
      try {
        await this.#audioEngine.speak('Do you have any more questions?');
      } catch (err) {
        // Ignore interruptions
      }
      
      return { success: true, answer };
    } catch (err) {
      console.error('[OpeningActionsController] Ask API error:', err);
      
      const fallback = 'That\'s a great question! Keep thinking about it.';
      this.#actionState.answer = fallback;
      this.#actionState.stage = 'complete';

      if (nonce !== this.#actionNonce || this.#currentAction !== 'ask') {
        return { success: false, cancelled: true };
      }
      
      try {
        await this.#audioEngine.speak(fallback);
      } catch (err) {
        // Ignore interruptions
      }

      // Ask follow-up after fallback as well
      if (nonce !== this.#actionNonce || this.#currentAction !== 'ask') {
        return { success: false, cancelled: true };
      }
      try {
        await this.#audioEngine.speak('Do you have any more questions?');
      } catch (err) {
        // Ignore interruptions
      }
      
      return { success: true, answer: fallback };
    }
  }
  
  /**
   * Cancel Ask action
   */
  cancelAsk() {
    if (this.#currentAction !== 'ask') return;

    // Invalidate any in-flight ask work/speech.
    this.#actionNonce += 1;
    
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

    // Invalidate any in-flight ask work/speech.
    this.#actionNonce += 1;
    
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
    const riddleText = renderRiddle(riddleObj) || '';
    
    this.#actionState = {
      stage: 'question', // 'question' | 'hint' | 'answer'
      riddle: {
        ...riddleObj,
        question: riddleText,
        text: riddleText
      }
    };
    
    this.#eventBus.emit('openingActionStart', {
      action: 'riddle',
      type: 'riddle',
      phase: this.#phase
    });
    
    const text = `Here's a riddle for you! ${riddleText}`;
    await this.#audioEngine.speak(text);
    
    return { success: true, riddle: this.#actionState.riddle };
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
   * Accept a learner guess for the riddle (conversational input)
   * Uses simple normalization to compare against the answer and responds aloud.
   * @param {string} guess - Learner's guess typed in the shared input field
   */
  async submitRiddleGuess(guess) {
    if (this.#currentAction !== 'riddle') {
      return { success: false, error: 'Riddle action not active' };
    }

    const attempt = String(guess || '').trim();
    if (!attempt) {
      return { success: false, error: 'Please enter a guess first.' };
    }

    const normalize = (text) => String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const answer = this.#actionState?.riddle?.answer || '';
    const isCorrect = normalize(attempt) && normalize(attempt) === normalize(answer);

    let reply = '';
    if (isCorrect) {
      this.#actionState.stage = 'answer';
      reply = `You got it. The answer is ${answer}. Nice thinking.`;
    } else {
      const hint = this.#actionState?.riddle?.hint;
      const hintLine = hint ? `Try again. Hint: ${hint}` : 'Good try. Think about the clue words.';
      reply = hintLine;
    }

    await this.#audioEngine.speak(reply);
    return { success: true, correct: isCorrect, reply };
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
      stage: 'awaiting-topic',
      showSuggestions: true
    };
    
    this.#eventBus.emit('openingActionStart', {
      action: 'poem',
      type: 'poem',
      phase: this.#phase
    });
    
    await this.#audioEngine.speak('What would you like the poem to be about?');
    
    return { success: true, stage: 'awaiting-topic' };
  }
  
  /**
   * Show poem topic suggestions
   */
  async showPoemSuggestions() {
    if (this.#currentAction !== 'poem') return;
    
    this.#actionState.showSuggestions = false;
    await this.#audioEngine.speak('You could ask for a poem about your favorite animal, a fun adventure, or something you learned today.');
    
    return { success: true };
  }
  
  /**
   * Generate poem with user's topic
   */
  async generatePoem(topic) {
    if (this.#currentAction !== 'poem') return { success: false, error: 'Not in poem mode' };
    
    this.#actionState.stage = 'generating';
    this.#actionState.showSuggestions = false;
    
    const instruction = [
      `You are Ms. Sonoma. ${getGradeAndDifficultyStyle(this.#learnerGrade, this.#difficulty)}`,
      `Write a short, fun poem (4-8 lines) about ${topic}.`,
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
      this.#actionState.stage = 'reading';
      await this.#audioEngine.speak(poem);
      this.#actionState.stage = 'complete';
      
      return { success: true, poem };
    } catch (err) {
      console.error('[OpeningActionsController] Poem error:', err);
      
      const fallback = 'Learning is fun, every single day! Knowledge helps us grow in every way!';
      this.#actionState.poem = fallback;
      this.#actionState.stage = 'reading';
      await this.#audioEngine.speak(fallback);
      this.#actionState.stage = 'complete';
      
      return { success: true, poem: fallback };
    }
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
  async startStory(existingTranscript = []) {
    this.#currentAction = 'story';
    
    this.#eventBus.emit('openingActionStart', {
      action: 'story',
      type: 'story',
      phase: this.#phase
    });
    
    // Check if continuing from previous phase
    if (existingTranscript.length > 0) {
      this.#actionState = {
        stage: 'awaiting-turn',
        transcript: existingTranscript,
        setupStep: 'complete'
      };
      
      // Generate reminder and prompt based on phase
      const isTestPhase = this.#phase === 'test';
      const lastAssistant = [...existingTranscript].reverse().find(t => t.role === 'assistant');
      
      let briefSummary = 'Let me remind you where we left off in our story.';
      if (lastAssistant) {
        const summaryInstruction = [
          `You are Ms. Sonoma. ${getGradeAndDifficultyStyle(this.#learnerGrade, this.#difficulty)}`,
          `Briefly paraphrase this story part in 1-2 short sentences: "${lastAssistant.text.replace(/To be continued\.?/i, '').trim()}"`,
          'Keep it simple and exciting.',
          'Do not add "To be continued."'
        ].join(' ');
        
        try {
          const res = await fetch('/api/sonoma', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instruction: summaryInstruction, innertext: '' })
          });
          if (res.ok) {
            const data = await res.json();
            briefSummary = data?.reply?.trim() || briefSummary;
          }
        } catch (err) {
          // Use fallback
        }
      }
      
      let prompt;
      if (isTestPhase) {
        prompt = `${briefSummary} How would you like the story to end?`;
      } else {
        // Generate suggestions for continuation
        const storyContext = existingTranscript.slice(-4).map(turn => 
          turn.role === 'user' ? `Child: "${turn.text}"` : `You: "${turn.text}"`
        ).join(' ');
        
        const suggestionInstruction = [
          `You are Ms. Sonoma. ${getGradeAndDifficultyStyle(this.#learnerGrade, this.#difficulty)}`,
          `Story so far: ${storyContext}`,
          'Suggest 3 brief, exciting story possibilities for what could happen next.',
          'Keep each suggestion to 4-6 words maximum.',
          'Make them fun and age-appropriate.',
          'Format as: "You could say: [option 1], or [option 2], or [option 3]."'
        ].join(' ');
        
        let suggestions = 'You could say: the hero finds treasure, or a friend appears, or something magical happens.';
        try {
          const res = await fetch('/api/sonoma', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instruction: suggestionInstruction, innertext: '' })
          });
          if (res.ok) {
            const data = await res.json();
            suggestions = data?.reply || suggestions;
          }
        } catch (err) {
          // Use fallback
        }
        
        prompt = `${briefSummary} What would you like to happen next? ${suggestions}`;
      }
      
      await this.#audioEngine.speak(prompt);
      return { success: true, prompt };
    }
    
    // New story - start 3-step setup
    this.#actionState = {
      stage: 'awaiting-setup',
      setupStep: 'characters',
      transcript: [],
      characters: '',
      setting: '',
      plot: ''
    };
    
    await this.#audioEngine.speak('Who are the characters in the story?');
    return { success: true, prompt: 'Who are the characters in the story?' };
  }
  
  /**
   * Continue story with learner input (handles setup steps and turns)
   */
  async continueStory(userInput) {
    if (this.#currentAction !== 'story') {
      return { success: false, error: 'Story not active' };
    }
    
    const trimmed = (userInput || '').trim();
    if (!trimmed) {
      return { success: false, error: 'Please say something for the story!' };
    }
    
    const { setupStep } = this.#actionState;
    
    // Handle setup phase
    if (setupStep === 'characters') {
      this.#actionState.characters = trimmed;
      this.#actionState.setupStep = 'setting';
      await this.#audioEngine.speak('Where does the story take place?');
      return { success: true, setupComplete: false };
    }
    
    if (setupStep === 'setting') {
      this.#actionState.setting = trimmed;
      this.#actionState.setupStep = 'plot';
      await this.#audioEngine.speak('What happens in the story?');
      return { success: true, setupComplete: false };
    }
    
    if (setupStep === 'plot') {
      this.#actionState.plot = trimmed;
      this.#actionState.setupStep = 'complete';
      
      // Generate first part of story with all setup info
      const instruction = [
        `You are Ms. Sonoma. ${getGradeAndDifficultyStyle(this.#learnerGrade, this.#difficulty)}`,
        'You are starting a collaborative story.',
        `The characters are: ${this.#actionState.characters}`,
        `The setting is: ${this.#actionState.setting}`,
        `The plot involves: ${trimmed}`,
        'Tell the first part of the story in 4-6 sentences.',
        'Follow the child\'s ideas closely and make the story about what they want unless it\'s inappropriate.',
        'Make it fun and age-appropriate for a child.',
        'End by saying "To be continued."'
      ].join(' ');
      
      let responseText = 'Once upon a time. To be continued.';
      try {
        const res = await fetch('/api/sonoma', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instruction, innertext: '' })
        });
        if (res.ok) {
          const data = await res.json();
          responseText = data?.reply || responseText;
        }
      } catch (err) {
        // Use fallback
      }
      
      // Build transcript with setup entries
      this.#actionState.transcript = [
        { role: 'user', text: `Characters: ${this.#actionState.characters}` },
        { role: 'user', text: `Setting: ${this.#actionState.setting}` },
        { role: 'user', text: `Plot: ${trimmed}` },
        { role: 'assistant', text: responseText }
      ];
      
      this.#actionState.stage = 'complete';
      await this.#audioEngine.speak(responseText);
      
      return { success: true, setupComplete: true, story: responseText };
    }
    
    // Handle story continuation after setup
    this.#actionState.transcript.push({ role: 'user', text: trimmed });
    
    const isTestPhase = this.#phase === 'test';
    const storyContext = this.#actionState.transcript.map(turn => 
      turn.role === 'user' ? `Child: "${turn.text}"` : `You: "${turn.text}"`
    ).join(' ');
    
    const instruction = isTestPhase
      ? [
          `You are Ms. Sonoma. ${getGradeAndDifficultyStyle(this.#learnerGrade, this.#difficulty)}`,
          'You are ending a collaborative story.',
          `Story so far: ${storyContext}`,
          `The child wants the story to end like this: "${trimmed.replace(/["]/g, "'")}"`,
          'End the story based on their idea in 4-6 sentences.',
          'Follow the child\'s ideas closely and make the ending about what they want unless it\'s inappropriate.',
          'Make it satisfying and age-appropriate for a child.',
          'Say "The end." at the very end.'
        ].join(' ')
      : [
          `You are Ms. Sonoma. ${getGradeAndDifficultyStyle(this.#learnerGrade, this.#difficulty)}`,
          'You are telling a collaborative story in turns.',
          `Story so far: ${storyContext}`,
          `The child just said: "${trimmed.replace(/["]/g, "'")}"`,
          'Continue the story in 4-6 sentences.',
          'Follow the child\'s ideas closely unless inappropriate.',
          'Make it fun and age-appropriate for a child.',
          'End by saying "To be continued."'
        ].join(' ');
    
    let responseText = isTestPhase 
      ? 'And they all lived happily ever after. The end.'
      : 'And then something amazing happened! To be continued.';
    
    try {
      const res = await fetch('/api/sonoma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, innertext: '' })
      });
      if (res.ok) {
        const data = await res.json();
        responseText = data?.reply || responseText;
      }
    } catch (err) {
      // Use fallback
    }
    
    this.#actionState.transcript.push({ role: 'assistant', text: responseText });
    this.#actionState.stage = isTestPhase ? 'ended' : 'continued';
    await this.#audioEngine.speak(responseText);
    
    return { success: true, continuation: responseText, ended: isTestPhase };
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
      stage: 'loading-template',
      template: null,
      wordTypes: [],
      words: [],
      currentIndex: 0
    };
    
    this.#eventBus.emit('openingActionStart', {
      action: 'fill-in-fun',
      type: 'fill-in-fun',
      phase: this.#phase
    });
    
    const intro = "Let's play Fill-in-Fun! We can create a fun and mixed-up story! You'll need to come up with words to fill in the blanks. Ready?";

    const ensureTemplatePromise = () => {
      if (!this.#fillInFunTemplatePromise) {
        const instruction = [
          `You are Ms. Sonoma. ${getGradeAndDifficultyStyle(this.#learnerGrade, this.#difficulty)}`,
          `Create ONE short Mad Libs template sentence about ${this.#subject}.`,
          'The template MUST contain these blanks in this exact order:',
          '[ADJECTIVE] then [VERB] then [PLACE] then [ADJECTIVE] then [NOUN] then [ADJECTIVE] then [NUMBER].',
          'Return ONLY the template sentence. No intro. No explanation. No quotes. No markdown.',
          'Do not put two blanks adjacent; ensure normal spaces/punctuation between blanks.'
        ].join(' ');

        this.#fillInFunTemplatePromise = fetch('/api/sonoma', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instruction, innertext: '' })
        })
          .then(async (res) => {
            if (!res.ok) throw new Error('Fill-in-Fun generation failed');
            const data = await res.json();
            return String(data?.reply || '').trim();
          })
          .catch((err) => {
            console.error('[OpeningActionsController] Fill-in-Fun error:', err);
            return '';
          });
      }
      return this.#fillInFunTemplatePromise;
    };

    // Start prefetch immediately, then speak the hardwired intro.
    const templatePromise = ensureTemplatePromise();
    await this.#audioEngine.speak(intro);

    const templateRaw = await templatePromise;
    this.#fillInFunTemplatePromise = null;

    const fallbackTemplate = 'The [ADJECTIVE] calculator was [VERB]ing in the [PLACE] with a [ADJECTIVE] [NOUN] and [ADJECTIVE] [NUMBER].';
    const template = templateRaw && templateRaw.includes('[') ? templateRaw : fallbackTemplate;
    this.#actionState.template = template;

    // Extract word types in the order they appear
    const wordTypes = template.match(/\[([A-Z]+)\]/g) || [];
    const parsedTypes = wordTypes.map((t) => t.replace(/[\[\]]/g, '')).filter(Boolean);
    this.#actionState.wordTypes = parsedTypes.length ? parsedTypes : ['ADJECTIVE', 'VERB', 'PLACE', 'ADJECTIVE', 'NOUN', 'ADJECTIVE', 'NUMBER'];
    this.#actionState.stage = 'collecting';

    const firstType = this.#actionState.wordTypes[0] || 'ADJECTIVE';
    const firstPrompt = `Give me a ${String(firstType).toLowerCase()}.`;
    await this.#audioEngine.speak(firstPrompt);

    return { success: true, template: this.#actionState.template, prompt: firstPrompt };
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

      const finalText = `Here's your story: ${completedStory} That was so fun and random.`;
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
   * Start Joke action
   */
  async startJoke() {
    this.#currentAction = 'joke';
    this.#actionState = {
      stage: 'reading',
      joke: ''
    };

    this.#eventBus.emit('openingActionStart', {
      action: 'joke',
      type: 'joke',
      phase: this.#phase
    });

    try {
      const jokeObj = pickNextJoke(this.#subject);
      const text = renderJoke(jokeObj) || 'Here is a quick joke to start us off.';
      this.#actionState.joke = text;
      await this.#audioEngine.speak(text);
      this.#actionState.stage = 'complete';
      return { success: true, joke: text };
    } catch (err) {
      console.error('[OpeningActionsController] Joke error:', err);
      const fallback = 'What do you call a funny mountain? Hill-arious.';
      this.#actionState.joke = fallback;
      await this.#audioEngine.speak(fallback);
      this.#actionState.stage = 'complete';
      return { success: true, joke: fallback };
    }
  }

  /**
   * Complete Joke action
   */
  completeJoke() {
    if (this.#currentAction !== 'joke') return;

    this.#eventBus.emit('openingActionComplete', {
      action: 'joke',
      type: 'joke',
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
    this.#actionNonce += 1;
    this.#currentAction = null;
    this.#actionState = {};
  }

  /**
   * Cancel any active action
   */
  cancelCurrent() {
    if (!this.#currentAction) return;

    // Invalidate any in-flight action work/speech.
    this.#actionNonce += 1;
    this.#eventBus.emit('openingActionCancel', {
      action: this.#currentAction,
      type: this.#currentAction,
      phase: this.#phase
    });
    this.#currentAction = null;
    this.#actionState = {};
  }
}
