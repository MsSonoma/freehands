/**
 * closingSignals.js
 * Brand signal anchors for Closing/Goodbye phase
 * Front-end lexicon pools with zero token cost
 */

/**
 * Engagement level types for closing messages
 * @typedef {'steady' | 'focused' | 'patient' | 'thoughtful' | 'careful'} EngagementLevel
 */

/**
 * Generate a closing message for session end
 * CLOSING anchor: Celebrate process and learning, not achievement
 * Tone: Warm, grounded
 * Lexicon: learned, practiced, worked, steady, progress, focus
 * Avoid: nailed it, perfect, genius, crushed
 * Shape: "[Effort observation]. [One thing learned]. [Goodbye]."
 * 
 * @param {Object} config - Configuration object
 * @param {string} config.conceptLearned - What the child practiced (e.g., "the zero property")
 * @param {EngagementLevel} config.engagementLevel - How they engaged ('steady', 'focused', 'patient', 'thoughtful', 'careful')
 * @param {string} [config.learnerName] - Optional learner name for personalized goodbye
 * @returns {string} Complete closing message
 */
export function generateClosing(config = {}) {
  const { 
    conceptLearned = 'today\'s lesson', 
    engagementLevel = 'focused',
    learnerName = null
  } = config;
  
  const effort = getEffortPhrase(engagementLevel);
  const learning = getLearningPhrase(conceptLearned);
  const goodbye = getGoodbye(learnerName);
  
  return `${effort}. ${learning}. ${goodbye}`;
}

/**
 * Get an effort observation phrase based on engagement level
 * @param {EngagementLevel} level - Engagement level
 * @returns {string} Effort observation
 */
function getEffortPhrase(level) {
  const phrases = {
    steady: [
      'You worked steadily today',
      'You stayed steady through the lesson',
      'You kept a steady pace today',
      'Your steady work showed today'
    ],
    focused: [
      'Great focus today',
      'You stayed focused today',
      'Your focus was clear today',
      'You kept your focus today',
      'Strong focus today'
    ],
    patient: [
      'You stayed patient today',
      'You worked patiently today',
      'Your patience showed today',
      'You were patient through each step'
    ],
    thoughtful: [
      'You thought carefully today',
      'Your thinking was thoughtful today',
      'You worked thoughtfully today',
      'You took your time to think today'
    ],
    careful: [
      'You worked carefully today',
      'You took care with each step today',
      'Your careful work showed today',
      'You were careful and thorough today'
    ]
  };
  
  const options = phrases[level] || phrases.focused;
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Get a learning observation phrase
 * @param {string} concept - What was learned/practiced
 * @returns {string} Learning observation
 */
function getLearningPhrase(concept) {
  const verbs = [
    'practiced',
    'worked on',
    'learned',
    'explored',
    'studied',
    'focused on',
    'worked through'
  ];
  
  const verb = verbs[Math.floor(Math.random() * verbs.length)];
  return `You ${verb} ${concept}`;
}

/**
 * Get a goodbye phrase
 * @param {string|null} learnerName - Optional learner name
 * @returns {string} Goodbye phrase
 */
function getGoodbye(learnerName = null) {
  if (learnerName) {
    return `Goodbye ${learnerName}`;
  }
  
  const goodbyes = [
    'See you next time',
    'Talk soon',
    'See you soon',
    'Until next time',
    'Goodbye',
    'See you later',
    'Bye for now'
  ];
  
  return goodbyes[Math.floor(Math.random() * goodbyes.length)];
}

/**
 * Get a simple encouragement for test-end or progress milestones
 * (Less elaborate than full closing, but still warm and grounded)
 * @returns {string} Brief encouragement
 */
export function getSimpleEncouragement() {
  const options = [
    'Nice work today',
    'You did well today',
    'Good work today',
    'You worked hard today',
    'Strong effort today',
    'You stayed focused',
    'Good focus today',
    'Well done today'
  ];
  
  return options[Math.floor(Math.random() * options.length)];
}
