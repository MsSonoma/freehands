# AI Rewrite System

## How It Works

Reusable AI-powered text rewriting system used throughout the application to improve and enhance user-written text.

### AIRewriteButton Component
- Location: `src/components/AIRewriteButton.jsx`
- Props: `text`, `onRewrite`, `disabled`, `loading`, `size`, `style`
- Button sizes: 'small', 'medium', 'large'
- Shows loading state during rewrite

### AI Rewrite API
- Location: `src/app/api/ai/rewrite-text/route.js`
- Endpoint: `POST /api/ai/rewrite-text`
- Request body: `{ text, context?, purpose }`
- Response: `{ rewritten }`

### Rewrite Purposes

**visual-aid-description**
- Rewrites image descriptions for kid-friendly educational content (ages 6-12)
- Simple, age-appropriate language
- Warm and encouraging tone
- 2-3 short sentences
- Natural spoken tone for Ms. Sonoma

**generation-prompt**
- Improves AI image generation prompts for DALL-E 3
- Specific and descriptive
- Includes style guidance
- Educational clarity focus
- Concise but detailed

**general**
- General text improvement
- Clear and concise
- Maintains original meaning
- Improved grammar and flow
- Professional polish

## Current Usage

### Visual Aids Carousel
- Location: `src/components/VisualAidsCarousel.jsx`
- Two rewrite buttons:
  1. **Image Description**: Rewrites user's basic description into kid-friendly language
     - Purpose: `visual-aid-description`
     - Context: Lesson title
  2. **Generation Prompt**: Improves custom prompt for "Generate More"
     - Purpose: `generation-prompt`
     - Context: Lesson title

### Integration Example
```javascript
const handleRewriteDescription = async (index) => {
  const currentDesc = imageDescriptions[index] || ''
  if (!currentDesc.trim()) return
  
  setRewritingIndex(index)
  try {
    const response = await fetch('/api/ai/rewrite-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: currentDesc,
        context: lessonTitle,
        purpose: 'visual-aid-description'
      })
    })
    
    const { rewritten } = await response.json()
    // Update description with rewritten text
  } catch (error) {
    console.error('Rewrite failed:', error)
  } finally {
    setRewritingIndex(null)
  }
}
```

## Key Files

- `src/components/AIRewriteButton.jsx` - Reusable button component
- `src/app/api/ai/rewrite-text/route.js` - Rewrite API endpoint
- `src/components/VisualAidsCarousel.jsx` - Current usage example

## What NOT To Do

- Never expose rewrite API publicly (requires auth)
- Never skip purpose parameter (determines prompt style)
- Never rewrite without user trigger (button click required)
- Never cache rewritten text globally (user-specific content)
