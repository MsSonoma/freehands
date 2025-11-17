/**
 * MentorInterceptor - Front-end conversation handler for Mr. Mentor
 * 
 * Intercepts user messages and handles common tasks without API calls:
 * - Lesson search and selection
 * - Parameter gathering for generation/scheduling/editing
 * - Confirmation flows
 * - Conversation memory search
 * 
 * Only forwards to API when:
 * - User explicitly bypasses ("Different issue")
 * - Free-form discussion after lesson selected
 * - Complex queries that need LLM reasoning
 */

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
  
  // Extract grade
  const gradeMatch = text.match(/\b(\d+)(st|nd|rd|th)?\s*(grade)?\b/i) || 
                     text.match(/\b(k|kindergarten)\b/i)
  if (gradeMatch) {
    params.grade = gradeMatch[1].toLowerCase() === 'k' || gradeMatch[1].toLowerCase() === 'kindergarten'
      ? 'K'
      : `${gradeMatch[1]}${gradeMatch[2] || 'th'}`
  }
  
  // Extract subject
  const subjects = ['math', 'science', 'language arts', 'social studies', 'general']
  for (const subject of subjects) {
    if (normalized.includes(subject)) {
      params.subject = subject
      break
    }
  }
  
  // Extract difficulty
  const difficulties = ['beginner', 'intermediate', 'advanced']
  for (const diff of difficulties) {
    if (normalized.includes(diff)) {
      params.difficulty = diff.charAt(0).toUpperCase() + diff.slice(1)
      break
    }
  }
  
  return params
}

// Extract date from text
function extractDate(text) {
  const normalized = normalizeText(text)
  
  // Check for ISO format YYYY-MM-DD
  const isoMatch = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/)
  if (isoMatch) {
    return isoMatch[0]
  }
  
  // Check for month/day patterns
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
    const dayMatch = text.match(new RegExp(`${monthName}\\s+(\\d{1,2})`, 'i'))
    if (dayMatch) {
      const day = dayMatch[1].padStart(2, '0')
      const month = monthNum.toString().padStart(2, '0')
      return `2025-${month}-${day}`
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
    // Implementation continues...
    return { handled: false }
  }
  
  /**
   * Handle lesson generation flow
   */
  async handleGenerate(userMessage, context) {
    // Implementation continues...
    return { handled: false }
  }
  
  /**
   * Handle lesson scheduling flow
   */
  async handleSchedule(userMessage, context) {
    // Implementation continues...
    return { handled: false }
  }
  
  /**
   * Handle lesson editing flow
   */
  async handleEdit(userMessage, context) {
    // Implementation continues...
    return { handled: false }
  }
  
  /**
   * Handle conversation recall
   */
  async handleRecall(userMessage, context) {
    // Implementation continues...
    return { handled: false }
  }
  
  /**
   * Execute confirmed action
   */
  async executeAction() {
    // Implementation continues...
    return { handled: false }
  }
}

export default MentorInterceptor
