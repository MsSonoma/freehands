/**
 * Download image from URL and upload to Supabase Storage
 * Returns permanent Supabase Storage URL
 */
export async function downloadAndStoreImage(imageUrl, supabase, facilitatorId, lessonKey, imageId) {
  try {
    // Download image from DALL-E URL
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`)
    }

    const blob = await response.blob()
    
    // Generate storage path: visual-aids/{facilitator_id}/{lesson_key}/{image_id}.png
    const sanitizedLessonKey = lessonKey.replace(/\.json$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
    const storagePath = `${facilitatorId}/${sanitizedLessonKey}/${imageId}.png`

    console.log('[DOWNLOAD_IMAGE] Uploading to:', storagePath)

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('visual-aids')
      .upload(storagePath, blob, {
        contentType: 'image/png',
        upsert: true // Replace if exists
      })

    if (error) {
      console.error('[DOWNLOAD_IMAGE] Upload error:', error)
      throw error
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('visual-aids')
      .getPublicUrl(storagePath)

    console.log('[DOWNLOAD_IMAGE] Stored successfully:', urlData.publicUrl)
    
    return urlData.publicUrl

  } catch (err) {
    console.error('[DOWNLOAD_IMAGE] Error:', err)
    throw err
  }
}
