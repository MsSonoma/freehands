/**
 * MentorInterceptor - Front-end conversation handler for Mr. Mentor
 * 
 * Intercepts user messages and handles common tasks without API calls:
 * - Lesson search and selection
 * - Parameter gathering for generation/scheduling/editing
 * - Confirmation flows
 * - Conversation memory search
 * - FAQ and feature explanations
 * 
 * Only forwards to API when:
 * - User explicitly bypasses ("Different issue")
 * - Free-form discussion after lesson selected
 * - Complex queries that need LLM reasoning
 */

import { searchFeatures, getFeatureById } from '@/lib/faq/faqLoader'

// Fuzzy string matching for normalization
function normalizeText(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')
}

function fuzzyMatch(input, targets, threshold = 0.6) {
  const normalized = normalizeText(input)
  
  for (const target of targets) {
    const normalizedTarget = normalizeText(target)
    if (normalized.includes(normalizedTarget) || normalizedTarget.includes(normalized)) {
      return true
    }
  }
  
  return false
}

// Intent detection patterns
const INTENT_PATTERNS = {
  search: {
    keywords: ['find', 'search', 'look for', 'show me', 'do you have', 'what lessons'],
    confidence: (text) => {
      const normalized = normalizeText(text)
      return INTENT_PATTERNS.search.keywords.some(kw => normalized.includes(kw)) ? 0.8 : 0
    }
  },
  
  generate: {
    keywords: ['generate', 'create', 'make', 'build', 'new lesson'],
    confidence: (text) => {
      const normalized = normalizeText(text)
      return INTENT_PATTERNS.generate.keywords.some(kw => normalized.includes(kw)) ? 0.8 : 0
    }
  },
  
  schedule: {
    keywords: ['schedule', 'add to calendar', 'put on', 'assign for', 'plan for'],
    confidence: (text) => {
      const normalized = normalizeText(text)
      return INTENT_PATTERNS.schedule.keywords.some(kw => normalized.includes(kw)) ? 0.8 : 0
    }
  },
  
  edit: {
    keywords: ['edit', 'change', 'modify', 'update', 'fix', 'correct'],
    confidence: (text) => {
      const normalized = normalizeText(text)
      return INTENT_PATTERNS.edit.keywords.some(kw => normalized.includes(kw)) ? 0.8 : 0
    }
  },
  
  recall: {
    keywords: ['remember', 'recall', 'last time', 'previously', 'earlier', 'before'],
    confidence: (text) => {
      const normalized = normalizeText(text)
      return INTENT_PATTERNS.recall.keywords.some(kw => normalized.includes(kw)) ? 0.7 : 0
    }
  },
  
  faq: {
    keywords: ['what is', 'what are', 'how do i', 'how does', 'how can i', 'explain', 'tell me about', 'help with', 'how to', 'show me', 'where is', 'what does', 'can you explain'],
    confidence: (text) => {
      const normalized = normalizeText(text)
      return INTENT_PATTERNS.faq.keywords.some(kw => normalized.includes(kw)) ? 0.7 : 0
    }
  }
}

// Confirmation detection (yes/no)
function detectConfirmation(text) {
  const normalized = normalizeText(text)
  
  const yesPatterns = ['yes', 'yep', 'yeah', 'sure', 'ok', 'okay', 'correct', 'right', 'confirm', 'go ahead', 'do it']
  const noPatterns = ['no', 'nope', 'nah', 'cancel', 'stop', 'nevermind', 'never mind', 'dont', 'not']
  
  if (yesPatterns.some(p => normalized.includes(p))) return 'yes'
  if (noPatterns.some(p => normalized.includes(p))) return 'no'
  
  return null
}

// Extract lesson parameters from text
function extractLessonParams(text) {
  const normalized = normalizeText(text)
  const params = {}
  
  // Extract grade with normalization
  const gradeMatch = text.match(/\b(\d+)(st|nd|rd|th)?\s*(grade)?\b/i) || 
                     text.match(/\b(k|kindergarten)\b/i)
  if (gradeMatch) {
    const gradeNum = gradeMatch[1].toLowerCase()
    if (gradeNum === 'k' || gradeNum === 'kindergarten') {
      params.grade = 'K'
    } else {
      // Normalize to format like "4th", "5th", etc
      const num = parseInt(gradeNum)
      if (num >= 1 && num <= 12) {
        const suffix = num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th'
        params.grade = `${num}${suffix}`
      }
    }
  }
  
  // Extract subject with comprehensive topic-to-subject mapping
  const subjectTopicMappings = {
    'math': [
      // Basic operations
      'addition', 'subtraction', 'multiplication', 'division', 'multiply', 'divide', 'add', 'subtract',
      // Advanced math
      'algebra', 'geometry', 'calculus', 'trigonometry', 'statistics', 'probability',
      // Number concepts
      'fractions', 'decimals', 'percentages', 'ratios', 'proportions', 'integers', 'numbers',
      // Math skills
      'word problems', 'equations', 'graphing', 'measurement', 'estimation', 'rounding',
      // Specific topics
      'place value', 'prime numbers', 'factors', 'multiples', 'exponents', 'square roots',
      'coordinates', 'angles', 'shapes', 'perimeter', 'area', 'volume', 'symmetry',
      // General
      'math', 'mathematics', 'arithmetic', 'counting', 'number sense'
    ],
    'science': [
      // Life science
      'biology', 'plants', 'animals', 'cells', 'organisms', 'ecosystems', 'habitats',
      'photosynthesis', 'food chain', 'adaptations', 'classification', 'life cycle',
      'human body', 'anatomy', 'organs', 'systems', 'digestion', 'respiration', 'circulation',
      // Physical science
      'physics', 'chemistry', 'matter', 'energy', 'force', 'motion', 'gravity',
      'atoms', 'molecules', 'elements', 'compounds', 'reactions', 'states of matter',
      'electricity', 'magnetism', 'light', 'sound', 'waves', 'heat', 'temperature',
      // Earth science
      'geology', 'rocks', 'minerals', 'fossils', 'soil', 'landforms', 'volcanoes', 'earthquakes',
      'weather', 'climate', 'water cycle', 'atmosphere', 'seasons', 'clouds', 'precipitation',
      'solar system', 'planets', 'stars', 'moon', 'sun', 'space', 'astronomy',
      // General
      'science', 'scientific method', 'experiments', 'observations', 'hypothesis'
    ],
    'language arts': [
      // Reading
      'reading', 'comprehension', 'phonics', 'sight words', 'fluency', 'vocabulary',
      'main idea', 'details', 'inference', 'context clues', 'summarizing', 'predicting',
      // Writing
      'writing', 'essays', 'paragraphs', 'sentences', 'composition', 'creative writing',
      'narratives', 'persuasive', 'informative', 'opinion', 'descriptive',
      // Grammar
      'grammar', 'punctuation', 'capitalization', 'spelling', 'parts of speech',
      'nouns', 'verbs', 'adjectives', 'adverbs', 'pronouns', 'conjunctions', 'prepositions',
      'subjects', 'predicates', 'clauses', 'phrases', 'tenses', 'sentence structure',
      // Literature
      'literature', 'stories', 'poetry', 'poems', 'fiction', 'nonfiction', 'genre',
      'characters', 'setting', 'plot', 'theme', 'conflict', 'resolution', 'point of view',
      // General
      'english', 'ela', 'language', 'literacy', 'communication'
    ],
    'social studies': [
      // History
      'history', 'historical', 'timeline', 'ancient', 'medieval', 'modern',
      'american history', 'world history', 'civil war', 'revolution', 'exploration',
      'colonies', 'pioneers', 'settlers', 'immigrants', 'presidents', 'leaders',
      // Geography
      'geography', 'maps', 'continents', 'countries', 'states', 'cities', 'regions',
      'landforms', 'oceans', 'rivers', 'mountains', 'compass', 'cardinal directions',
      'longitude', 'latitude', 'equator', 'hemispheres', 'climate zones',
      // Civics/Government
      'government', 'civics', 'constitution', 'democracy', 'elections', 'voting',
      'laws', 'rights', 'responsibilities', 'citizenship', 'branches of government',
      'legislative', 'executive', 'judicial', 'congress', 'senate', 'house',
      // Economics
      'economics', 'economy', 'money', 'trade', 'goods', 'services', 'supply', 'demand',
      'producers', 'consumers', 'resources', 'scarcity', 'entrepreneurship',
      // Culture
      'culture', 'traditions', 'customs', 'diversity', 'communities', 'society',
      'holidays', 'celebrations', 'beliefs', 'values',
      // General
      'social studies', 'society'
    ]
  }
  
  // Check topic keywords first (most specific)
  for (const [canonical, keywords] of Object.entries(subjectTopicMappings)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        params.subject = canonical
        break
      }
    }
    if (params.subject) break
  }
  
  // Fallback to direct subject name matching
  if (!params.subject) {
    const directSubjectMappings = {
      'math': ['math', 'mathematics', 'arithmetic'],
      'science': ['science'],
      'language arts': ['language arts', 'english', 'ela'],
      'social studies': ['social studies'],
      'general': ['general', 'other', 'misc', 'miscellaneous']
    }
    
    for (const [canonical, variants] of Object.entries(directSubjectMappings)) {
      for (const variant of variants) {
        if (normalized.includes(variant)) {
          params.subject = canonical
          break
        }
      }
      if (params.subject) break
    }
  }
  
  // Extract difficulty with normalization
  const difficultyMappings = {
    'Beginner': ['beginner', 'easy', 'basic', 'simple', 'intro', 'introductory'],
    'Intermediate': ['intermediate', 'medium', 'moderate', 'average', 'mid'],
    'Advanced': ['advanced', 'hard', 'difficult', 'challenging', 'expert']
  }
  
  for (const [canonical, variants] of Object.entries(difficultyMappings)) {
    for (const variant of variants) {
      if (normalized.includes(variant)) {
        params.difficulty = canonical
        break
      }
    }
    if (params.difficulty) break
  }
  
  return params
}

// Extract date from text
function extractDate(text) {
  const normalized = normalizeText(text)
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentDay = now.getDate()
  
  // Check for ISO format YYYY-MM-DD
  const isoMatch = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/)
  if (isoMatch) {
    return isoMatch[0]
  }
  
  // Check for numeric formats: MM/DD, MM/DD/YY, MM/DD/YYYY, DD/MM/YY, DD/MM/YYYY
  // US format: 11/24 or 11/24/25 or 11/24/2025
  const usDateMatch = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/)
  if (usDateMatch) {
    const month = parseInt(usDateMatch[1])
    const day = parseInt(usDateMatch[2])
    let year = usDateMatch[3] ? parseInt(usDateMatch[3]) : null
    
    // Validate month and day
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      // If no year provided, determine based on whether date has passed
      if (!year) {
        year = currentYear
        if (month < currentMonth || (month === currentMonth && day < currentDay)) {
          year = currentYear + 1
        }
      } else if (year < 100) {
        // Two-digit year: assume 20XX
        year = 2000 + year
      }
      
      const monthStr = month.toString().padStart(2, '0')
      const dayStr = day.toString().padStart(2, '0')
      return `${year}-${monthStr}-${dayStr}`
    }
  }
  
  // Check for month/day patterns (including "24th", "1st", "2nd", "3rd")
  const months = {
    january: 1, jan: 1,
    february: 2, feb: 2,
    march: 3, mar: 3,
    april: 4, apr: 4,
    may: 5,
    june: 6, jun: 6,
    july: 7, jul: 7,
    august: 8, aug: 8,
    september: 9, sep: 9, sept: 9,
    october: 10, oct: 10,
    november: 11, nov: 11,
    december: 12, dec: 12
  }
  
  for (const [monthName, monthNum] of Object.entries(months)) {
    // Match patterns like "November 24th", "Nov 24", "november 3rd"
    const dayMatch = text.match(new RegExp(`${monthName}\\s+(\\d{1,2})(?:st|nd|rd|th)?`, 'i'))
    if (dayMatch) {
      const day = parseInt(dayMatch[1])
      if (day >= 1 && day <= 31) {
        const dayStr = day.toString().padStart(2, '0')
        const monthStr = monthNum.toString().padStart(2, '0')
        
        // Determine year - if month has passed this year, use next year
        let targetYear = currentYear
        if (monthNum < currentMonth || (monthNum === currentMonth && day < currentDay)) {
          targetYear = currentYear + 1
        }
        
        return `${targetYear}-${monthStr}-${dayStr}`
      }
    }
  }
  
  // Check for relative dates
  const today = new Date()
  
  if (normalized.includes('today')) {
    return today.toISOString().split('T')[0]
  }
  
  if (normalized.includes('tomorrow')) {
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }
  
  // Next Monday, Tuesday, etc.
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  for (let i = 0; i < daysOfWeek.length; i++) {
    if (normalized.includes(`next ${daysOfWeek[i]}`)) {
      const targetDay = i
      const currentDay = today.getDay()
      const daysUntil = (targetDay - currentDay + 7) % 7 || 7
      const nextDate = new Date(today)
      nextDate.setDate(nextDate.getDate() + daysUntil)
      return nextDate.toISOString().split('T')[0]
    }
    
    // Also check for just the day name (this Monday, Monday, etc)
    if (normalized.includes(daysOfWeek[i]) && !normalized.includes('next')) {
      const targetDay = i
      const currentDay = today.getDay()
      let daysUntil = targetDay - currentDay
      if (daysUntil <= 0) daysUntil += 7
      const nextDate = new Date(today)
      nextDate.setDate(nextDate.getDate() + daysUntil)
      return nextDate.toISOString().split('T')[0]
    }
  }
  
  return null
}

/**
 * Main interceptor class
 */
export class MentorInterceptor {
  constructor() {
    this.state = {
      flow: null,          // Current conversation flow (search, generate, schedule, edit, recall)
      context: {},         // Gathered parameters
      awaitingConfirmation: false,
      awaitingInput: null, // What parameter we're waiting for
      selectedLesson: null,
      conversationMemory: []
    }
  }
  
  /**
   * Reset conversation state
   */
  reset() {
    this.state = {
      flow: null,
      context: {},
      awaitingConfirmation: false,
      awaitingInput: null,
      selectedLesson: null,
      conversationMemory: this.state.conversationMemory
    }
  }
  
  /**
   * Process user input and return response or API forward
   * 
   * @param {string} userMessage - User's message
   * @param {object} context - Available context (lessons, learners, etc)
   * @returns {object} - { handled: boolean, response?: string, apiForward?: object, action?: object }
   */
  async process(userMessage, context = {}) {
    const { allLessons = {}, selectedLearnerId, learnerName, conversationHistory = [] } = context
    
    // Check for "more" in recall flow
    if (this.state.flow === 'recall' && this.state.context.recallMatches) {
      if (fuzzyMatch(userMessage, ['more', 'another', 'next', 'keep going', 'show more'])) {
        const matches = this.state.context.recallMatches
        const index = this.state.context.recallIndex || 1
        
        if (index >= matches.length) {
          this.reset()
          return {
            handled: true,
            response: "That's all I found about that topic. Anything else I can help with?"
          }
        }
        
        const nextMatch = matches[index]
        this.state.context.recallIndex = index + 1
        
        let response = `I also recall: "${nextMatch.content || nextMatch.text}"`
        
        if (index + 1 < matches.length) {
          response += `\n\nWould you like to hear more?`
        } else {
          response += `\n\nThat's everything I found.`
        }
        
        return {
          handled: true,
          response
        }
      }
    }
    
    // Check for bypass command
    if (fuzzyMatch(userMessage, ['different issue', 'something else', 'nevermind', 'skip'])) {
      this.reset()
      return {
        handled: false,
        apiForward: { message: userMessage, bypassInterceptor: true }
      }
    }
    
    // Handle confirmation if awaiting
    if (this.state.awaitingConfirmation) {
      const confirmation = detectConfirmation(userMessage)
      
      if (confirmation === 'yes') {
        return await this.executeAction()
      } else if (confirmation === 'no') {
        this.reset()
        return {
          handled: true,
          response: "No problem. How else can I help you?"
        }
      } else {
        return {
          handled: true,
          response: "I didn't catch that. Please say yes to confirm or no to cancel."
        }
      }
    }
    
    // Handle parameter gathering if in flow
    if (this.state.flow && this.state.awaitingInput) {
      return await this.handleParameterInput(userMessage, context)
    }
    
    // Detect intent
    const intents = {}
    for (const [intentName, pattern] of Object.entries(INTENT_PATTERNS)) {
      intents[intentName] = pattern.confidence(userMessage)
    }
    
    const topIntent = Object.entries(intents)
      .filter(([_, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])[0]
    
    if (!topIntent) {
      // No clear intent - forward to API
      return {
        handled: false,
        apiForward: { message: userMessage }
      }
    }
    
    const [intent, confidence] = topIntent
    
    // Route to appropriate handler
    switch (intent) {
      case 'search':
        return await this.handleSearch(userMessage, context)
      
      case 'generate':
        return await this.handleGenerate(userMessage, context)
      
      case 'schedule':
        return await this.handleSchedule(userMessage, context)
      
      case 'edit':
        return await this.handleEdit(userMessage, context)
      
      case 'recall':
        return await this.handleRecall(userMessage, context)
      
      case 'faq':
        return await this.handleFaq(userMessage, context)
      
      default:
        return {
          handled: false,
          apiForward: { message: userMessage }
        }
    }
  }
  
  /**
   * Handle lesson search flow
   */
  async handleSearch(userMessage, context) {
    const { allLessons = {} } = context
    const params = extractLessonParams(userMessage)
    
    // Search lessons
    const results = this.searchLessons(allLessons, params, userMessage)
    
    if (results.length === 0) {
      return {
        handled: true,
        response: "I couldn't find any lessons matching that description. Would you like me to generate a custom lesson instead?"
      }
    }
    
    // Show top results
    const lessonList = results.slice(0, 5).map((lesson, idx) => 
      `${idx + 1}. ${lesson.title} - ${lesson.grade} ${lesson.subject} (${lesson.difficulty})`
    ).join('\n')
    
    this.state.flow = 'search'
    this.state.context.searchResults = results
    this.state.awaitingInput = 'lesson_selection'
    
    return {
      handled: true,
      response: `It looks like you might be referring to one of these lessons:\n\n${lessonList}\n\nWhich lesson would you like to work with? You can say the number or the lesson name.`
    }
  }
  
  /**
   * Search lessons based on parameters
   */
  searchLessons(allLessons, params, searchTerm) {
    const results = []
    const normalizedSearch = normalizeText(searchTerm)
    
    for (const [subject, lessons] of Object.entries(allLessons)) {
      if (!Array.isArray(lessons)) continue
      
      for (const lesson of lessons) {
        let score = 0
        
        // Match subject
        if (params.subject && subject.toLowerCase() === params.subject.toLowerCase()) {
          score += 10
        }
        
        // Match grade
        if (params.grade && lesson.grade === params.grade) {
          score += 10
        }
        
        // Match difficulty
        if (params.difficulty && lesson.difficulty === params.difficulty) {
          score += 5
        }
        
        // Match title
        const normalizedTitle = normalizeText(lesson.title || '')
        if (normalizedTitle.includes(normalizedSearch) || normalizedSearch.includes(normalizedTitle)) {
          score += 15
        }
        
        if (score > 0) {
          results.push({
            ...lesson,
            subject,
            lessonKey: lesson.isGenerated ? `generated/${lesson.file}` : `${subject}/${lesson.file}`,
            score
          })
        }
      }
    }
    
    return results.sort((a, b) => b.score - a.score)
  }
  
  /**
   * Handle parameter input during a flow
   */
  async handleParameterInput(userMessage, context) {
    const { allLessons, selectedLearnerId, learnerName } = context
    
    // Handle FAQ feature selection (when multiple matches)
    if (this.state.awaitingInput === 'faq_feature_select') {
      const candidates = this.state.context.faqCandidates || []
      
      // Try to match by number
      const numberMatch = userMessage.match(/\b(\d+)\b/)
      if (numberMatch) {
        const index = parseInt(numberMatch[1]) - 1
        if (index >= 0 && index < candidates.length) {
          const featureId = candidates[index]
          this.state.context.selectedFeatureId = featureId
          this.state.awaitingInput = 'faq_feature_confirm'
          
          const feature = getFeatureById(featureId)
          return {
            handled: true,
            response: `You selected ${feature.title}. Is that correct?`
          }
        }
      }
      
      // Try to match by feature name
      const normalizedInput = normalizeText(userMessage)
      for (const featureId of candidates) {
        const feature = getFeatureById(featureId)
        if (feature && normalizeText(feature.title).includes(normalizedInput)) {
          this.state.context.selectedFeatureId = featureId
          this.state.awaitingInput = 'faq_feature_confirm'
          
          return {
            handled: true,
            response: `You selected ${feature.title}. Is that correct?`
          }
        }
      }
      
      return {
        handled: true,
        response: "I couldn't match that to one of the options. Could you try saying the number or exact feature name?"
      }
    }
    
    // Handle post-generation schedule prompt
    if (this.state.awaitingInput === 'post_generation_schedule') {
      const confirmation = detectConfirmation(userMessage)
      
      if (confirmation === 'yes') {
        // Move to schedule flow with the generated lesson
        this.state.flow = 'schedule'
        this.state.context.lessonKey = this.state.selectedLesson.lessonKey
        this.state.awaitingInput = 'schedule_date'
        this.state.awaitingConfirmation = false
        
        return {
          handled: true,
          response: `What date would you like to schedule ${this.state.selectedLesson.title} for ${learnerName || 'this learner'}?`
        }
      } else if (confirmation === 'no') {
        this.reset()
        return {
          handled: true,
          response: "No problem. The lesson is ready in your lessons tab whenever you need it. How else can I help you?"
        }
      } else {
        return {
          handled: true,
          response: "Would you like to schedule this lesson? Please say yes or no."
        }
      }
    }
    
    // Handle lesson selection from search results
    if (this.state.awaitingInput === 'lesson_selection') {
      const results = this.state.context.searchResults || []
      
      // Try to match by number
      const numberMatch = userMessage.match(/\b(\d+)\b/)
      if (numberMatch) {
        const index = parseInt(numberMatch[1]) - 1
        if (index >= 0 && index < results.length) {
          this.state.selectedLesson = results[index]
          this.state.awaitingInput = 'lesson_action'
          
          return {
            handled: true,
            response: `Would you like to schedule, edit, or discuss ${this.state.selectedLesson.title}?`
          }
        }
      }
      
      // Try to match by title
      const normalizedInput = normalizeText(userMessage)
      for (const lesson of results) {
        if (normalizeText(lesson.title).includes(normalizedInput) || 
            normalizedInput.includes(normalizeText(lesson.title))) {
          this.state.selectedLesson = lesson
          this.state.awaitingInput = 'lesson_action'
          
          return {
            handled: true,
            response: `Would you like to schedule, edit, or discuss ${lesson.title}?`
          }
        }
      }
      
      return {
        handled: true,
        response: "I couldn't find that lesson in the list. Could you try saying the number or the exact lesson name?"
      }
    }
    
    // Handle lesson action choice
    if (this.state.awaitingInput === 'lesson_action') {
      const normalized = normalizeText(userMessage)
      
      if (normalized.includes('schedule')) {
        this.state.flow = 'schedule'
        this.state.context.lessonKey = this.state.selectedLesson.lessonKey
        this.state.awaitingInput = 'schedule_date'
        
        if (selectedLearnerId) {
          return {
            handled: true,
            response: `What date would you like to schedule ${this.state.selectedLesson.title} for ${learnerName || 'this learner'}?`
          }
        } else {
          return {
            handled: true,
            response: "Please select a learner from the dropdown first, then we can schedule the lesson."
          }
        }
      }
      
      if (normalized.includes('edit')) {
        this.state.flow = 'edit'
        this.state.context.lessonKey = this.state.selectedLesson.lessonKey
        this.state.awaitingInput = 'edit_changes'
        
        return {
          handled: true,
          response: `What would you like me to change in ${this.state.selectedLesson.title}?`
        }
      }
      
      if (normalized.includes('discuss')) {
        // Forward to API with lesson context
        return {
          handled: false,
          apiForward: {
            message: userMessage,
            context: {
              selectedLesson: this.state.selectedLesson
            }
          }
        }
      }
      
      return {
        handled: true,
        response: "Would you like to schedule it, edit it, or discuss it? Please choose one."
      }
    }
    
    // Handle generation parameters
    if (this.state.flow === 'generate') {
      return await this.handleGenerateParameterInput(userMessage, context)
    }
    
    // Handle schedule date input
    if (this.state.awaitingInput === 'schedule_date') {
      const date = extractDate(userMessage)
      
      if (!date) {
        return {
          handled: true,
          response: "I couldn't understand that date. Please try saying something like 'Monday', 'December 18th', or '2025-12-18'."
        }
      }
      
      this.state.context.scheduledDate = date
      this.state.awaitingConfirmation = true
      this.state.awaitingInput = null
      
      const lesson = this.state.selectedLesson
      const formattedDate = new Date(date).toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric',
        year: 'numeric'
      })
      
      return {
        handled: true,
        response: `Should I schedule ${lesson.title} (${lesson.grade} ${lesson.subject}, ${lesson.difficulty}) on ${formattedDate}?`
      }
    }
    
    // Handle edit changes input
    if (this.state.awaitingInput === 'edit_changes') {
      this.state.context.editInstructions = userMessage
      this.state.awaitingConfirmation = true
      this.state.awaitingInput = null
      
      return {
        handled: true,
        response: `Should I make these changes to ${this.state.selectedLesson.title}?`
      }
    }
    
    return {
      handled: false,
      apiForward: { message: userMessage }
    }
  }
  
  /**
   * Handle lesson generation flow
   */
  async handleGenerate(userMessage, context) {
    this.state.flow = 'generate'
    this.state.context = extractLessonParams(userMessage)
    
    // Extract topic/description from initial message
    const topicMatch = userMessage.match(/(?:on|about|for|covering)\s+([^,.]+)/i)
    if (topicMatch) {
      this.state.context.topicDescription = topicMatch[1].trim()
    } else if (userMessage.length > 20) {
      // Whole message might be the topic description
      this.state.context.topicDescription = userMessage
    }
    
    // Start gathering missing parameters
    return await this.gatherGenerationParameters(context)
  }
  
  /**
   * Normalize lesson title using GPT-4o-mini
   */
  async normalizeLessonTitle(userInput, context) {
    const { topicDescription, grade, subject, difficulty } = context
    
    try {
      const response = await fetch('/api/normalize-lesson-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput,
          topicDescription,
          grade,
          subject,
          difficulty
        })
      })
      
      if (!response.ok) {
        throw new Error('Normalization API failed')
      }
      
      const data = await response.json()
      return data.title || userInput
    } catch (err) {
      // Fallback to user input if API fails
      return userInput
    }
  }
  
  /**
   * Gather parameters for lesson generation
   */
  async gatherGenerationParameters(context) {
    const { selectedLearnerId, learnerName, learnerGrade } = context
    const ctx = this.state.context
    
    // Check for learner
    if (!selectedLearnerId) {
      return {
        handled: true,
        response: "Please select a learner from the dropdown first, then I can help generate a lesson."
      }
    }
    
    // Check for topic/description (user's raw input)
    if (!ctx.topicDescription && !ctx.title) {
      this.state.awaitingInput = 'generate_topic'
      return {
        handled: true,
        response: "What topic should this lesson cover?"
      }
    }
    
    // Check for grade - use learner's grade if available
    if (!ctx.grade) {
      if (learnerGrade) {
        // Learner has a grade - ask for confirmation
        this.state.context.suggestedGrade = learnerGrade
        this.state.awaitingInput = 'generate_grade_confirm'
        return {
          handled: true,
          response: `Is this lesson for ${learnerName}'s grade (${learnerGrade})?`
        }
      } else {
        // No learner grade - ask what grade
        this.state.awaitingInput = 'generate_grade'
        return {
          handled: true,
          response: `What grade level is this lesson for ${learnerName || 'the learner'}?`
        }
      }
    }
    
    // Check for subject
    if (!ctx.subject) {
      this.state.awaitingInput = 'generate_subject'
      return {
        handled: true,
        response: "What subject is this lesson? (math, science, language arts, social studies, or general)"
      }
    }
    
    // Check for difficulty
    if (!ctx.difficulty) {
      this.state.awaitingInput = 'generate_difficulty'
      return {
        handled: true,
        response: "What difficulty level? (beginner, intermediate, or advanced)"
      }
    }
    
    // Ask for a clean title if we don't have one yet
    if (!ctx.title) {
      this.state.awaitingInput = 'generate_title'
      return {
        handled: true,
        response: "What should I title the lesson?"
      }
    }
    
    // All parameters gathered - confirm
    this.state.context.description = ctx.description || ctx.topicDescription || `Learn about ${ctx.title}`
    this.state.awaitingConfirmation = true
    this.state.awaitingInput = null
    
    return {
      handled: true,
      response: `Should I generate the lesson "${ctx.title}" (${ctx.grade} ${ctx.subject}, ${ctx.difficulty})?`
    }
  }
  
  /**
   * Handle generation parameter inputs
   */
  async handleGenerateParameterInput(userMessage, context) {
    const ctx = this.state.context
    
    if (this.state.awaitingInput === 'generate_topic') {
      ctx.topicDescription = userMessage
      this.state.awaitingInput = null
      return await this.gatherGenerationParameters(context)
    }
    
    if (this.state.awaitingInput === 'generate_grade_confirm') {
      // User is confirming learner's grade
      const confirmation = detectConfirmation(userMessage)
      
      if (confirmation === 'yes') {
        // Use the suggested grade
        ctx.grade = ctx.suggestedGrade
        this.state.awaitingInput = null
        return await this.gatherGenerationParameters(context)
      } else if (confirmation === 'no') {
        // Ask for a different grade
        this.state.awaitingInput = 'generate_grade'
        return {
          handled: true,
          response: "What grade level should this lesson be for?"
        }
      } else {
        // Unclear response
        return {
          handled: true,
          response: `Is this for ${ctx.suggestedGrade}? Please say yes or no.`
        }
      }
    }
    
    if (this.state.awaitingInput === 'generate_grade') {
      const params = extractLessonParams(userMessage)
      if (params.grade) {
        ctx.grade = params.grade
        this.state.awaitingInput = null
        return await this.gatherGenerationParameters(context)
      }
      return {
        handled: true,
        response: "I couldn't understand that grade. Please say something like '4th grade' or 'K'."
      }
    }
    
    if (this.state.awaitingInput === 'generate_subject') {
      const params = extractLessonParams(userMessage)
      if (params.subject) {
        ctx.subject = params.subject
        this.state.awaitingInput = null
        return await this.gatherGenerationParameters(context)
      }
      return {
        handled: true,
        response: "Please choose: math, science, language arts, social studies, or general."
      }
    }
    
    if (this.state.awaitingInput === 'generate_difficulty') {
      const params = extractLessonParams(userMessage)
      if (params.difficulty) {
        ctx.difficulty = params.difficulty
        this.state.awaitingInput = null
        return await this.gatherGenerationParameters(context)
      }
      return {
        handled: true,
        response: "Please choose: beginner, intermediate, or advanced."
      }
    }
    
    if (this.state.awaitingInput === 'generate_title') {
      // Use GPT-4o-mini to normalize the title
      try {
        const normalizedTitle = await this.normalizeLessonTitle(userMessage, ctx)
        ctx.title = normalizedTitle
        this.state.awaitingInput = null
        return await this.gatherGenerationParameters(context)
      } catch (err) {
        // Fallback to user's input if API fails
        ctx.title = userMessage
        this.state.awaitingInput = null
        return await this.gatherGenerationParameters(context)
      }
    }
    
    return { handled: false }
  }
  
  /**
   * Handle lesson scheduling flow
   */
  async handleSchedule(userMessage, context) {
    const { selectedLearnerId, learnerName, allLessons } = context
    
    if (!selectedLearnerId) {
      return {
        handled: true,
        response: "Please select a learner from the dropdown first, then I can schedule a lesson."
      }
    }
    
    this.state.flow = 'schedule'
    
    // Extract date
    const date = extractDate(userMessage)
    if (date) {
      this.state.context.scheduledDate = date
    }
    
    // Extract lesson info
    const params = extractLessonParams(userMessage)
    
    // If we have lesson context from previous interaction
    if (this.state.selectedLesson) {
      this.state.context.lessonKey = this.state.selectedLesson.lessonKey
      
      if (date) {
        // Have both lesson and date - confirm
        this.state.awaitingConfirmation = true
        
        const lesson = this.state.selectedLesson
        const formattedDate = new Date(date).toLocaleDateString('en-US', { 
          weekday: 'long', 
          month: 'long', 
          day: 'numeric',
          year: 'numeric'
        })
        
        return {
          handled: true,
          response: `Should I schedule ${lesson.title} (${lesson.grade} ${lesson.subject}, ${lesson.difficulty}) on ${formattedDate} for ${learnerName}?`
        }
      } else {
        // Have lesson, need date
        this.state.awaitingInput = 'schedule_date'
        return {
          handled: true,
          response: `What date would you like to schedule ${this.state.selectedLesson.title} for ${learnerName}?`
        }
      }
    }
    
    // Need to find the lesson first
    if (Object.keys(params).length > 0 || userMessage.length > 10) {
      const results = this.searchLessons(allLessons, params, userMessage)
      
      if (results.length === 0) {
        return {
          handled: true,
          response: "I couldn't find a lesson matching that description. Could you be more specific about the lesson you want to schedule?"
        }
      }
      
      if (results.length === 1) {
        // Only one match - use it
        this.state.selectedLesson = results[0]
        this.state.context.lessonKey = results[0].lessonKey
        
        if (date) {
          // Confirm
          this.state.awaitingConfirmation = true
          
          const formattedDate = new Date(date).toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric',
            year: 'numeric'
          })
          
          return {
            handled: true,
            response: `Should I schedule ${results[0].title} (${results[0].grade} ${results[0].subject}, ${results[0].difficulty}) on ${formattedDate} for ${learnerName}?`
          }
        } else {
          // Need date
          this.state.awaitingInput = 'schedule_date'
          return {
            handled: true,
            response: `What date would you like to schedule ${results[0].title} for ${learnerName}?`
          }
        }
      }
      
      // Multiple matches - let them choose
      const lessonList = results.slice(0, 5).map((lesson, idx) => 
        `${idx + 1}. ${lesson.title} - ${lesson.grade} ${lesson.subject} (${lesson.difficulty})`
      ).join('\n')
      
      this.state.context.searchResults = results
      this.state.awaitingInput = 'lesson_selection'
      
      return {
        handled: true,
        response: `I found multiple lessons. Which one would you like to schedule?\n\n${lessonList}\n\nSay the number or lesson name.`
      }
    }
    
    // Not enough info
    this.state.awaitingInput = 'schedule_lesson_search'
    return {
      handled: true,
      response: "What lesson would you like to schedule?"
    }
  }
  
  /**
   * Handle lesson editing flow
   */
  async handleEdit(userMessage, context) {
    const { allLessons } = context
    
    this.state.flow = 'edit'
    
    // If we have lesson context from previous interaction
    if (this.state.selectedLesson) {
      this.state.context.lessonKey = this.state.selectedLesson.lessonKey
      this.state.awaitingInput = 'edit_changes'
      
      return {
        handled: true,
        response: `What would you like me to change in ${this.state.selectedLesson.title}?`
      }
    }
    
    // Try to find lesson from message
    const params = extractLessonParams(userMessage)
    const results = this.searchLessons(allLessons, params, userMessage)
    
    if (results.length === 0) {
      this.state.awaitingInput = 'edit_lesson_search'
      return {
        handled: true,
        response: "What lesson would you like to edit?"
      }
    }
    
    if (results.length === 1) {
      // Only one match
      this.state.selectedLesson = results[0]
      this.state.context.lessonKey = results[0].lessonKey
      
      this.state.awaitingConfirmation = true
      this.state.awaitingInput = null
      
      return {
        handled: true,
        response: `Do you want to edit ${results[0].title} (${results[0].grade} ${results[0].subject}, ${results[0].difficulty})?`
      }
    }
    
    // Multiple matches
    const lessonList = results.slice(0, 5).map((lesson, idx) => 
      `${idx + 1}. ${lesson.title} - ${lesson.grade} ${lesson.subject} (${lesson.difficulty})`
    ).join('\n')
    
    this.state.context.searchResults = results
    this.state.awaitingInput = 'lesson_selection'
    
    return {
      handled: true,
      response: `I found multiple lessons. Which one would you like to edit?\n\n${lessonList}\n\nSay the number or lesson name.`
    }
  }
  
  /**
   * Handle conversation recall
   */
  async handleRecall(userMessage, context) {
    const { conversationHistory = [] } = context
    
    // Extract search terms
    const normalized = normalizeText(userMessage)
    const searchTerms = normalized
      .replace(/remember|recall|last time|previously|earlier|before|when we|talked about|discussed/g, '')
      .trim()
    
    if (!searchTerms) {
      return {
        handled: true,
        response: "What would you like me to recall from our previous conversations?"
      }
    }
    
    // Search conversation history
    const matches = conversationHistory
      .filter(turn => {
        const turnText = normalizeText(turn.content || turn.text || '')
        return turnText.includes(searchTerms) || searchTerms.includes(turnText)
      })
      .slice(0, 3)
    
    if (matches.length === 0) {
      return {
        handled: true,
        response: `I don't recall discussing ${searchTerms} in our previous conversations. Could you provide more details?`
      }
    }
    
    // Return first match and offer to see more
    const firstMatch = matches[0]
    let response = `I recall we discussed: "${firstMatch.content || firstMatch.text}"`
    
    if (matches.length > 1) {
      response += `\n\nI found ${matches.length} conversations about this. Would you like to hear more?`
    }
    
    this.state.context.recallMatches = matches
    this.state.context.recallIndex = 1
    
    return {
      handled: true,
      response
    }
  }
  
  /**
   * Handle FAQ and feature explanation requests
   */
  async handleFaq(userMessage, context) {
    // Check if awaiting feature selection confirmation
    if (this.state.awaitingInput === 'faq_feature_confirm') {
      const featureId = this.state.context.selectedFeatureId
      const feature = getFeatureById(featureId)
      
      if (!feature) {
        this.reset()
        return {
          handled: true,
          response: "I couldn't find that feature. What else can I help you with?"
        }
      }
      
      // Check if user confirmed by saying the feature name
      const normalized = normalizeText(userMessage)
      const normalizedTitle = normalizeText(feature.title)
      
      if (normalized.includes(normalizedTitle) || normalizedTitle.includes(normalized) || detectConfirmation(userMessage) === 'yes') {
        // User confirmed - provide explanation
        this.reset()
        
        let response = `${feature.title}: ${feature.description}\n\n`
        response += `${feature.howToUse}`
        
        if (feature.relatedFeatures && feature.relatedFeatures.length > 0) {
          response += `\n\nThis is related to: ${feature.relatedFeatures.map(id => {
            const related = getFeatureById(id)
            return related ? related.title : id
          }).join(', ')}.`
        }
        
        return {
          handled: true,
          response
        }
      } else if (detectConfirmation(userMessage) === 'no') {
        // User rejected - reset
        this.reset()
        return {
          handled: true,
          response: "No problem. What else would you like to know about?"
        }
      } else {
        // Unclear - ask again
        return {
          handled: true,
          response: `Are you asking about ${feature.title}? Please say yes, no, or the feature name to confirm.`
        }
      }
    }
    
    // Search for matching features
    const matches = searchFeatures(userMessage)
    
    if (matches.length === 0) {
      // No matches - forward to API
      return {
        handled: false,
        apiForward: { message: userMessage }
      }
    }
    
    if (matches.length === 1) {
      // Single match - ask for confirmation before explaining
      const match = matches[0]
      this.state.flow = 'faq'
      this.state.awaitingInput = 'faq_feature_confirm'
      this.state.context.selectedFeatureId = match.feature.id
      
      return {
        handled: true,
        response: `It looks like you're asking about ${match.feature.title}. Is that correct?`
      }
    }
    
    // Multiple matches - list candidates
    this.state.flow = 'faq'
    this.state.awaitingInput = 'faq_feature_select'
    
    const topMatches = matches.slice(0, 5)
    const featureList = topMatches.map((m, idx) => `${idx + 1}. ${m.feature.title}`).join('\n')
    
    // Store all match IDs for selection
    this.state.context.faqCandidates = topMatches.map(m => m.feature.id)
    
    let response = `I found several features that might match what you're asking about:\n\n${featureList}\n\n`
    response += `Which one would you like to learn about? You can say the name or number.`
    
    return {
      handled: true,
      response
    }
  }
  
  /**
   * Execute confirmed action
   */
  async executeAction() {
    const flow = this.state.flow
    const ctx = this.state.context
    
    if (flow === 'schedule') {
      const lesson = this.state.selectedLesson
      
      return {
        handled: true,
        action: {
          type: 'schedule',
          lessonKey: ctx.lessonKey,
          scheduledDate: ctx.scheduledDate
        },
        response: `I've scheduled ${lesson.title} for ${new Date(ctx.scheduledDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.`
      }
    }
    
    if (flow === 'generate') {
      return {
        handled: true,
        action: {
          type: 'generate',
          title: ctx.title,
          subject: ctx.subject,
          grade: ctx.grade,
          difficulty: ctx.difficulty,
          description: ctx.description,
          vocab: ctx.vocab || '',
          notes: ctx.notes || ''
        },
        response: `Generating ${ctx.title}... This will take about 30-60 seconds.`
      }
    }
    
    if (flow === 'edit') {
      const lesson = this.state.selectedLesson
      
      return {
        handled: true,
        action: {
          type: 'edit',
          lessonKey: ctx.lessonKey,
          editInstructions: ctx.editInstructions
        },
        response: `I'm editing ${lesson.title} now...`
      }
    }
    
    this.reset()
    return {
      handled: false
    }
  }
}

export default MentorInterceptor
