'use client'
import { useState, useEffect } from 'react'
import AIRewriteButton from './AIRewriteButton'

/**
 * VisualAidsCarousel - Carousel overlay for selecting and managing visual aids
 * Used in lesson editor for selecting generated images
 */
export default function VisualAidsCarousel({ 
  images = [], 
  onClose, 
  onSave, 
  onGenerateMore,
  onUploadImage,
  onRewriteDescription,
  onGeneratePrompt, // NEW: function to generate initial prompt (handles auth)
  generating = false,
  teachingNotes = '',
  lessonTitle = '',
  generationProgress = '',
  generationCount = 0,
  maxGenerations = 4
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedImages, setSelectedImages] = useState(new Set())
  const [imageDescriptions, setImageDescriptions] = useState({})
  const [generationPrompt, setGenerationPrompt] = useState('')
  const [uploading, setUploading] = useState(false)
  const [rewritingIndex, setRewritingIndex] = useState(null)
  const [rewritingPrompt, setRewritingPrompt] = useState(false)
  const [generatingPrompt, setGeneratingPrompt] = useState(false)

  // Generate initial prompt from teaching notes when overlay opens
  useEffect(() => {
    const generateInitialPrompt = async () => {
      if (teachingNotes && !generationPrompt && images.length === 0 && onGeneratePrompt) {
        setGeneratingPrompt(true)
        try {
          const prompt = await onGeneratePrompt(teachingNotes, lessonTitle)
          if (prompt) {
            setGenerationPrompt(prompt)
          }
        } catch (err) {
          console.error('Failed to generate initial prompt:', err)
        } finally {
          setGeneratingPrompt(false)
        }
      }
    }
    
    generateInitialPrompt()
  }, [teachingNotes, lessonTitle, images.length, onGeneratePrompt])

  useEffect(() => {
    // Pre-select images that were already selected
    const preselected = new Set()
    const descriptions = {}
    images.forEach((img, idx) => {
      if (img.selected) {
        preselected.add(idx)
      }
      // Initialize descriptions from image data
      descriptions[idx] = img.description || img.prompt || ''
    })
    setSelectedImages(preselected)
    setImageDescriptions(descriptions)
  }, [images])

  const toggleSelection = (index) => {
    const newSelected = new Set(selectedImages)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      // Only allow selecting up to 3 images
      if (newSelected.size >= 3) {
        return
      }
      newSelected.add(index)
    }
    setSelectedImages(newSelected)
  }

  const goNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleSave = () => {
    const selected = images.filter((_, idx) => selectedImages.has(idx))
    // Add updated descriptions to selected images
    const selectedWithDescriptions = selected.map((img, originalIdx) => {
      const actualIdx = images.indexOf(img)
      return {
        ...img,
        description: imageDescriptions[actualIdx] || img.description || img.prompt
      }
    })
    onSave(selectedWithDescriptions)
  }

  const updateDescription = (index, value) => {
    setImageDescriptions(prev => ({
      ...prev,
      [index]: value
    }))
  }

  const handleUpload = async (e) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    setUploading(true)
    try {
      for (let file of files) {
        await onUploadImage(file)
      }
    } finally {
      setUploading(false)
      // Reset file input
      e.target.value = ''
    }
  }

  const handleRewriteDescription = async (index) => {
    const currentDesc = imageDescriptions[index] || ''
    if (!currentDesc.trim()) return
    
    setRewritingIndex(index)
    try {
      const rewritten = await onRewriteDescription(currentDesc, lessonTitle, 'visual-aid-description')
      if (rewritten) {
        updateDescription(index, rewritten)
      }
    } finally {
      setRewritingIndex(null)
    }
  }

  const handleRewritePrompt = async () => {
    if (!generationPrompt.trim()) return
    
    setRewritingPrompt(true)
    try {
      const rewritten = await onRewriteDescription(generationPrompt, lessonTitle, 'generation-prompt')
      if (rewritten) {
        setGenerationPrompt(rewritten)
      }
    } finally {
      setRewritingPrompt(false)
    }
  }

  if (!images || images.length === 0) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 20
      }}>
        <div style={{
          background: '#fff',
          borderRadius: 16,
          padding: 32,
          maxWidth: 600,
          width: '90%'
        }}>
          <h2 style={{ margin: 0, marginBottom: 20, fontSize: 20, fontWeight: 700, color: '#111827' }}>
            Generate Visual Aids
          </h2>

          {/* AI Warning */}
          <div style={{
            background: '#fef3c7',
            border: '2px solid #fbbf24',
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
            fontSize: 13,
            color: '#92400e'
          }}>
            <strong>⚠️ AI-Generated Content:</strong> Review all images and descriptions carefully before use.
            AI may produce inaccurate or unexpected results.
          </div>

          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>
            We've created a custom prompt based on your teaching notes. Review and edit it below to refine
            what types of visual aids will be generated.
          </p>

          {/* Custom Prompt Input */}
          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: '#374151',
              marginBottom: 8
            }}>
              Generation Guidance
            </label>
            {generatingPrompt ? (
              <div style={{
                width: '100%',
                minHeight: 80,
                padding: 12,
                fontSize: 14,
                color: '#6b7280',
                background: '#f9fafb',
                border: '2px solid #d1d5db',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                Generating custom prompt from teaching notes...
              </div>
            ) : (
              <textarea
                value={generationPrompt}
                onChange={(e) => setGenerationPrompt(e.target.value)}
                placeholder="Describe what types of visuals would help explain this lesson..."
                style={{
                  width: '100%',
                  minHeight: 80,
                  padding: 12,
                  fontSize: 14,
                  color: '#374151',
                  background: '#fff',
                  border: '2px solid #d1d5db',
                  borderRadius: 8,
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            )}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: 6
            }}>
              <AIRewriteButton
                text={generationPrompt}
                onRewrite={handleRewritePrompt}
                loading={rewritingPrompt}
                size="small"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
            <div>
              <input
                type="file"
                id="upload-visual-aid-empty"
                accept="image/*"
                multiple
                onChange={handleUpload}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => document.getElementById('upload-visual-aid-empty').click()}
                disabled={uploading}
                style={{
                  padding: '12px 24px',
                  background: uploading ? '#9ca3af' : '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: uploading ? 'wait' : 'pointer',
                  fontWeight: 600,
                  fontSize: 14
                }}
              >
                {uploading ? '📤 Uploading...' : '📤 Upload'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={onClose}
                style={{
                  padding: '12px 24px',
                  background: '#fff',
                  color: '#374151',
                  border: '2px solid #d1d5db',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => onGenerateMore(generationPrompt)}
                disabled={generating || generationCount >= maxGenerations}
                style={{
                  padding: '12px 32px',
                  background: (generating || generationCount >= maxGenerations) ? '#9ca3af' : '#6366f1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: (generating || generationCount >= maxGenerations) ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: 14
                }}
              >
                {generating ? (generationProgress || 'Generating...') : 'Generate Images (x3)'}
              </button>
            </div>
          </div>

          {/* Generation Counter */}
          {generationCount > 0 && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 12, textAlign: 'right' }}>
              {generationCount}/{maxGenerations} generations used
              {generationCount >= maxGenerations && ' - Limit reached'}
            </div>
          )}
        </div>
      </div>
    )
  }

  const currentImage = images[currentIndex]

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 20
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        maxWidth: 1000,
        width: '100%',
        height: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '2px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              Visual Aids Selection
            </h2>
            <div style={{
              background: selectedImages.size >= 3 ? '#059669' : '#e5e7eb',
              color: selectedImages.size >= 3 ? '#fff' : '#374151',
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 14,
              fontWeight: 700,
              transition: 'all 0.2s'
            }}>
              {selectedImages.size}/3 Selected
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 28,
              cursor: 'pointer',
              color: '#6b7280',
              lineHeight: 1,
              padding: 0
            }}
          >
            ×
          </button>
        </div>

        {/* Carousel Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 24
        }}>
          {/* AI Warning */}
          <div style={{
            background: '#fef3c7',
            border: '2px solid #fbbf24',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex',
            gap: 10,
            alignItems: 'start'
          }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#92400e', marginBottom: 4 }}>
                Review AI-Generated Images Carefully
              </div>
              <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.4 }}>
                AI can sometimes create unexpected or inaccurate content. Please inspect each image thoroughly before selecting it for your lesson.
              </div>
            </div>
          </div>

          {/* Large Image Preview */}
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: 700,
            margin: '0 auto 20px auto',
            aspectRatio: '1',
            background: '#f3f4f6',
            borderRadius: 12,
            overflow: 'hidden'
          }}>
            <img
              src={currentImage.url}
              alt={currentImage.prompt || `Visual aid ${currentIndex + 1}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
            />
            
            {/* Navigation Arrows */}
            {currentIndex > 0 && (
              <button
                onClick={goPrev}
                style={{
                  position: 'absolute',
                  left: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(0, 0, 0, 0.6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: 48,
                  height: 48,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24
                }}
              >
                ‹
              </button>
            )}
            
            {currentIndex < images.length - 1 && (
              <button
                onClick={goNext}
                style={{
                  position: 'absolute',
                  right: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(0, 0, 0, 0.6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: 48,
                  height: 48,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24
                }}
              >
                ›
              </button>
            )}

            {/* Checkbox */}
            <div style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: '#fff',
              borderRadius: 8,
              padding: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              opacity: (!selectedImages.has(currentIndex) && selectedImages.size >= 3) ? 0.5 : 1
            }}>
              <input
                type="checkbox"
                id={`select-${currentIndex}`}
                checked={selectedImages.has(currentIndex)}
                onChange={() => toggleSelection(currentIndex)}
                disabled={!selectedImages.has(currentIndex) && selectedImages.size >= 3}
                style={{
                  width: 20,
                  height: 20,
                  cursor: (!selectedImages.has(currentIndex) && selectedImages.size >= 3) ? 'not-allowed' : 'pointer'
                }}
              />
              <label 
                htmlFor={`select-${currentIndex}`}
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: (!selectedImages.has(currentIndex) && selectedImages.size >= 3) ? 'not-allowed' : 'pointer',
                  userSelect: 'none'
                }}
              >
                {(!selectedImages.has(currentIndex) && selectedImages.size >= 3) ? 'Limit Reached' : 'Select'}
              </label>
            </div>
          </div>

          {/* Thumbnail Strip */}
          <div style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 8,
            marginBottom: 20,
            maxWidth: 700,
            margin: '0 auto 20px auto'
          }}>
            {images.map((img, idx) => (
              <div
                key={img.id || idx}
                onClick={() => setCurrentIndex(idx)}
                style={{
                  position: 'relative',
                  minWidth: 80,
                  width: 80,
                  height: 80,
                  borderRadius: 8,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: currentIndex === idx ? '3px solid #3b82f6' : '2px solid #d1d5db',
                  opacity: currentIndex === idx ? 1 : 0.6
                }}
              >
                <img
                  src={img.url}
                  alt={`Thumbnail ${idx + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
                {selectedImages.has(idx) && (
                  <div style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    background: '#059669',
                    borderRadius: '50%',
                    width: 20,
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700
                  }}>
                    ✓
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Image Counter & Description (for Ms. Sonoma) */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#6b7280',
              marginBottom: 12
            }}>
              Image {currentIndex + 1} of {images.length}
            </div>
            
            {/* Editable Description for Ms. Sonoma */}
            <div>
              <label style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: '#374151',
                marginBottom: 6
              }}>
                Description (what Ms. Sonoma will say)
              </label>
              <textarea
                value={imageDescriptions[currentIndex] || ''}
                onChange={(e) => updateDescription(currentIndex, e.target.value)}
                placeholder="Describe what this image shows and how it helps explain the lesson..."
                style={{
                  width: '100%',
                  minHeight: 80,
                  padding: 10,
                  fontSize: 13,
                  color: '#374151',
                  background: '#fff',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 4
              }}>
                <div style={{
                  fontSize: 12,
                  color: '#6b7280'
                }}>
                  Edit how Ms. Sonoma will explain this image to learners
                </div>
                <AIRewriteButton
                  text={imageDescriptions[currentIndex]}
                  onRewrite={() => handleRewriteDescription(currentIndex)}
                  loading={rewritingIndex === currentIndex}
                  size="small"
                />
              </div>
            </div>
          </div>

          {/* Generation Prompt for New Images */}
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: '#374151',
              marginBottom: 6
            }}>
              Custom Prompt for "Generate More" (optional)
            </label>
            <textarea
              value={generationPrompt}
              onChange={(e) => setGenerationPrompt(e.target.value)}
              placeholder="e.g., 'include diagrams', 'cartoon style', 'step-by-step visuals'..."
              style={{
                width: '100%',
                minHeight: 50,
                padding: 8,
                fontSize: 13,
                color: '#374151',
                background: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: 4
            }}>
              <AIRewriteButton
                text={generationPrompt}
                onRewrite={handleRewritePrompt}
                loading={rewritingPrompt}
                size="small"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '2px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                onClick={() => onGenerateMore(generationPrompt)}
                disabled={generating || generationCount >= maxGenerations}
                style={{
                  padding: '10px 20px',
                  background: (generating || generationCount >= maxGenerations) ? '#9ca3af' : '#6366f1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: (generating || generationCount >= maxGenerations) ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: 14
                }}
              >
                {generating ? (generationProgress || 'Generating...') : `Generate More (x3)`}
              </button>
              <div style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>
                {generationCount}/{maxGenerations} generations used
                {generationCount >= maxGenerations && ' - Limit reached'}
              </div>
            </div>

            <div>
              <input
                type="file"
                id="upload-visual-aid"
                accept="image/*"
                multiple
                onChange={handleUpload}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => document.getElementById('upload-visual-aid').click()}
                disabled={uploading}
                style={{
                  padding: '10px 20px',
                  background: uploading ? '#9ca3af' : '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: uploading ? 'wait' : 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  height: 42
                }}
              >
                {uploading ? '📤 Uploading...' : '📤 Upload'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                background: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14
              }}
            >
              Cancel
            </button>
            {generationCount > 0 && (
              <button
                onClick={handleSave}
                disabled={selectedImages.size === 0}
                style={{
                  padding: '10px 20px',
                  background: selectedImages.size === 0 ? '#9ca3af' : '#059669',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: selectedImages.size === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: 14
                }}
              >
                Save Images ({selectedImages.size})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
