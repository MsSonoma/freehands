# AI Text Rewriting System

## Overview
A reusable AI-powered text rewriting system that can be used throughout the application to improve and enhance user-written text.

## Components

### 1. AIRewriteButton Component
**Location:** `src/components/AIRewriteButton.jsx`

A reusable button component for AI text rewriting.

**Props:**
- `text` (string): The text to rewrite
- `onRewrite` (function): Callback when button is clicked
- `disabled` (boolean): Disable the button
- `loading` (boolean): Show loading state
- `size` ('small' | 'medium' | 'large'): Button size
- `style` (object): Additional inline styles

**Usage:**
```jsx
import AIRewriteButton from '@/components/AIRewriteButton'

<AIRewriteButton
  text={myText}
  onRewrite={handleRewrite}
  loading={isRewriting}
  size="small"
/>
```

### 2. AI Rewrite API
**Location:** `src/app/api/ai/rewrite-text/route.js`

General-purpose API endpoint for AI text rewriting with context-aware prompts.

**Endpoint:** `POST /api/ai/rewrite-text`

**Request Body:**
```json
{
  "text": "The text to rewrite",
  "context": "Optional context (e.g., lesson title)",
  "purpose": "visual-aid-description | generation-prompt | general"
}
```

**Response:**
```json
{
  "rewritten": "The improved text"
}
```

### 3. Rewrite Purposes

#### `visual-aid-description`
Rewrites image descriptions for kid-friendly educational content (ages 6-12).
- Simple, age-appropriate language
- Warm and encouraging tone
- 2-3 short sentences
- Natural spoken tone for Ms. Sonoma

#### `generation-prompt`
Improves AI image generation prompts for DALL-E 3.
- Specific and descriptive
- Includes style guidance
- Educational clarity focus
- Concise but detailed

#### `general`
General text improvement.
- Clear and concise
- Maintains original meaning
- Improved grammar and flow
- Professional polish

## Current Usage

### Visual Aids Carousel
**Location:** `src/components/VisualAidsCarousel.jsx`

Two rewrite buttons:
1. **Image Description**: Rewrites user's basic description into kid-friendly language
   - Purpose: `visual-aid-description`
   - Context: Lesson title
   
2. **Generation Prompt**: Improves custom prompt for "Generate More"
   - Purpose: `generation-prompt`
   - Context: Lesson title

**Integration Example:**
```jsx
const handleRewriteDescription = async (index) => {
  const currentDesc = imageDescriptions[index] || ''
  if (!currentDesc.trim()) return
  
  setRewritingIndex(index)
  try {
    const rewritten = await onRewriteDescription(
      currentDesc, 
      lessonTitle, 
      'visual-aid-description'
    )
    if (rewritten) {
      updateDescription(index, rewritten)
    }
  } finally {
    setRewritingIndex(null)
  }
}
```

## How to Add Rewriting to Other Pages

### Step 1: Import the Component
```jsx
import AIRewriteButton from '@/components/AIRewriteButton'
```

### Step 2: Add State
```jsx
const [rewriting, setRewriting] = useState(false)
```

### Step 3: Create Handler
```jsx
const handleRewrite = async () => {
  if (!myText.trim()) return
  
  setRewriting(true)
  try {
    const supabase = getSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    const res = await fetch('/api/ai/rewrite-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({
        text: myText,
        context: contextInfo, // Optional
        purpose: 'general' // or specific purpose
      })
    })

    if (res.ok) {
      const data = await res.json()
      setMyText(data.rewritten)
    }
  } finally {
    setRewriting(false)
  }
}
```

### Step 4: Add Button
```jsx
<AIRewriteButton
  text={myText}
  onRewrite={handleRewrite}
  loading={rewriting}
  size="medium"
/>
```

## Adding New Rewrite Purposes

To add a new rewrite purpose, edit `src/app/api/ai/rewrite-text/route.js`:

```javascript
const prompts = {
  // ... existing purposes ...
  'my-new-purpose': {
    system: 'Your system message here',
    user: `Your prompt template here
    
    ${context ? `Context: ${context}` : ''}
    Original text: ${text}
    
    Requirements:
    - Your specific requirements
    
    Improved text:`
  }
}
```

## Cost Considerations

- Uses GPT-4o-mini (cost-effective)
- 150-200 tokens max per request
- Monitor usage in production
- Consider rate limiting for public-facing features

## Future Enhancements

Potential places to add AI rewriting:
- Lesson teaching notes
- Vocabulary definitions
- Comprehension questions
- Custom prompts for assessment generation
- Facilitator notes
- Email/message composition
