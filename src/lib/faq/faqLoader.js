/**
 * FAQ Knowledge Base Loader
 * Loads and indexes all FAQ content for Mr. Mentor feature explanations
 */

import lessonsData from './lessons.json'
import learnersData from './learners.json'
import sessionData from './session.json'
import facilitatorData from './facilitator.json'
import accountData from './account.json'
import facilitatorToolsData from './facilitator-tools.json'
import facilitatorPagesData from './facilitator-pages.json'
import safetyData from './safety.json'

// Combine all FAQ data
const allFaqData = [
  lessonsData,
  learnersData,
  sessionData,
  facilitatorData,
  accountData,
  facilitatorToolsData,
  facilitatorPagesData,
  safetyData
]

// Build a flat array of all features with their keywords
export function getAllFeatures() {
  const features = []
  
  for (const category of allFaqData) {
    for (const feature of category.features) {
      features.push({
        ...feature,
        category: category.category
      })
    }
  }
  
  return features
}

// Normalize text for matching (lowercase, trim, collapse spaces)
function normalizeText(text) {
  if (!text) return ''
  return text.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Search for features matching user input
 * Returns array of matching features with relevance scores
 */
export function searchFeatures(userInput) {
  const normalized = normalizeText(userInput)
  const features = getAllFeatures()
  const matches = []
  
  for (const feature of features) {
    let score = 0
    const matchedKeywords = []
    
    // Check each keyword
    for (const keyword of feature.keywords) {
      const normalizedKeyword = normalizeText(keyword)
      
      // Exact match (highest score)
      if (normalized === normalizedKeyword) {
        score += 100
        matchedKeywords.push(keyword)
      }
      // Contains full keyword phrase
      else if (normalized.includes(normalizedKeyword)) {
        score += 50
        matchedKeywords.push(keyword)
      }
      // Keyword phrase contains user input
      else if (normalizedKeyword.includes(normalized) && normalized.length >= 4) {
        score += 30
        matchedKeywords.push(keyword)
      }
      // Fuzzy word match (all words in keyword appear in input)
      else {
        const keywordWords = normalizedKeyword.split(' ')
        const inputWords = normalized.split(' ')
        const matchedWords = keywordWords.filter(kw => 
          inputWords.some(iw => iw.includes(kw) || kw.includes(iw))
        )
        
        if (matchedWords.length === keywordWords.length && keywordWords.length > 1) {
          score += 20
          matchedKeywords.push(keyword)
        } else if (matchedWords.length >= 2) {
          score += 10
          matchedKeywords.push(keyword)
        }
      }
    }
    
    // Also check title match
    const normalizedTitle = normalizeText(feature.title)
    if (normalized.includes(normalizedTitle) || normalizedTitle.includes(normalized)) {
      score += 15
    }
    
    if (score > 0) {
      matches.push({
        feature,
        score,
        matchedKeywords: [...new Set(matchedKeywords)]
      })
    }
  }
  
  // Sort by relevance score (highest first)
  matches.sort((a, b) => b.score - a.score)
  
  return matches
}

/**
 * Get feature by ID
 */
export function getFeatureById(featureId) {
  const features = getAllFeatures()
  return features.find(f => f.id === featureId)
}

/**
 * Get all features in a category
 */
export function getFeaturesByCategory(categoryName) {
  const features = getAllFeatures()
  return features.filter(f => normalizeText(f.category) === normalizeText(categoryName))
}

/**
 * Check if user input might be asking about a feature
 * Returns true if input contains FAQ-related trigger words
 */
export function isFaqQuery(userInput) {
  const normalized = normalizeText(userInput)
  
  const faqTriggers = [
    'what is',
    'what are',
    'how do i',
    'how does',
    'how can i',
    'explain',
    'tell me about',
    'help with',
    'how to',
    'show me',
    'where is',
    'find',
    'what does',
    'can you explain'
  ]
  
  return faqTriggers.some(trigger => normalized.includes(trigger))
}
