// Retry configuration
const RETRY_CONFIG = {
  maxAttempts: 3,
  delays: [1000, 2000, 4000], // milliseconds: 1s, 2s, 4s
  retryableStatuses: [403, 404, 408, 429, 500, 502, 503, 504],
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN']
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Check if error is retryable
 */
function isRetryable(error) {
  // Check HTTP status codes
  if (error.status) {
    return RETRY_CONFIG.retryableStatuses.includes(error.status)
  }
  
  if (error.response?.status) {
    return RETRY_CONFIG.retryableStatuses.includes(error.response.status)
  }
  
  // Check error codes (network errors)
  if (error.code) {
    return RETRY_CONFIG.retryableErrors.includes(error.code)
  }
  
  // Check error messages for network issues
  const message = error.message?.toLowerCase() || ''
  return message.includes('network') || 
         message.includes('timeout') || 
         message.includes('fetch failed') ||
         message.includes('failed to fetch')
}

/**
 * Retry wrapper with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} attempt - Current attempt number (1-indexed)
 * @param {string} context - Logging context
 * @returns {Promise} - Result from fn or throws after all retries exhausted
 */
async function retryWithBackoff(fn, attempt = 1, context = '') {
  try {
    return await fn()
  } catch (error) {
    const isLastAttempt = attempt >= RETRY_CONFIG.maxAttempts
    const shouldRetry = isRetryable(error)
    
    if (isLastAttempt || !shouldRetry) {
      throw error
    }
    
    const delay = RETRY_CONFIG.delays[attempt - 1]
    await sleep(delay)
    return retryWithBackoff(fn, attempt + 1, context)
  }
}

/**
 * Download image from URL and upload to Supabase Storage with retry logic
 * Returns permanent Supabase Storage URL
 * @param {string} imageUrl - Source URL (DALL-E temporary or data URL)
 * @param {Object} supabase - Supabase client
 * @param {string} facilitatorId - User ID
 * @param {string} lessonKey - Normalized lesson identifier
 * @param {string} imageId - Unique image identifier
 * @returns {Promise<string>} - Permanent Supabase Storage URL
 * @throws {Error} - After all retries exhausted
 */
export async function downloadAndStoreImage(imageUrl, supabase, facilitatorId, lessonKey, imageId) {
  // Download image with retry logic
  const blob = await retryWithBackoff(async () => {
    const response = await fetch(imageUrl)
    if (!response.ok) {
      const error = new Error(`Failed to download image: ${response.status}`)
      error.status = response.status
      throw error
    }
    return await response.blob()
  }, 1, `download-${imageId}`)
  
  // Generate storage path: visual-aids/{facilitator_id}/{lesson_key}/{image_id}.png
  const sanitizedLessonKey = lessonKey.replace(/\.json$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
  const storagePath = `${facilitatorId}/${sanitizedLessonKey}/${imageId}.png`

  // Upload to Supabase Storage with retry logic
  await retryWithBackoff(async () => {
    const { error } = await supabase.storage
      .from('visual-aids')
      .upload(storagePath, blob, {
        contentType: 'image/png',
        upsert: true // Replace if exists
      })

    if (error) {
      throw error
    }
  }, 1, `upload-${imageId}`)

  // Get public URL (no retry needed - local operation)
  const { data: urlData } = supabase.storage
    .from('visual-aids')
    .getPublicUrl(storagePath)
  
  return urlData.publicUrl
}
