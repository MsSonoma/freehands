# Safer Feature Implementations: Ask, Poem, Story

## RECOMMENDATION: Disable Poem & Story Immediately

The safest immediate action is to set these environment variables:

```bash
NEXT_PUBLIC_ENABLE_POEM_FEATURE=false
NEXT_PUBLIC_ENABLE_STORY_FEATURE=false
```

Then gate the features in `session/page.js`:

```javascript
// At the top of the component
const enableAsk = process.env.NEXT_PUBLIC_ENABLE_ASK_FEATURE !== 'false'
const enablePoem = process.env.NEXT_PUBLIC_ENABLE_POEM_FEATURE === 'true'
const enableStory = process.env.NEXT_PUBLIC_ENABLE_STORY_FEATURE === 'true'

// In the UI rendering section
{enableAsk && (
  <button onClick={handleAskQuestionStart}>Ask</button>
)}

{enablePoem && (
  <button onClick={handlePoemStart}>Poem</button>
)}

{enableStory && (
  <button onClick={handleStoryStart}>Story</button>
)}
```

## Option 1: Safest - Template-Based Poem (No LLM)

Replace freeform poem generation with pre-written templates:

```javascript
const POEM_TEMPLATES = [
  {
    name: "Acrostic",
    description: "First letters spell out the word",
    generate: (word) => {
      const lines = word.split('').map(letter => 
        `${letter.toUpperCase()} is for ${letter === 'A' ? 'Apple' : '___'}`
      )
      return lines.join('\n')
    }
  },
  {
    name: "Haiku",
    description: "5-7-5 syllable pattern",
    template: `{word} is nice (5 syllables)
{word} makes me happy today (7 syllables)
I like {word} a lot (5 syllables)`
  },
  {
    name: "Rhyming Couplet",
    template: `{word} is really great,
It's the best, don't hesitate!`
  }
]

async function handlePoemStart() {
  // 1. User selects a vocab term from dropdown
  const vocabTerm = await showVocabPicker(lessonVocab)
  
  // 2. User selects a template from list
  const template = await showTemplatePicker(POEM_TEMPLATES)
  
  // 3. Generate poem by substituting vocab term
  const poem = template.template.replace(/{word}/g, vocabTerm)
  
  // 4. Display the poem
  setTranscript(prev => [...prev, {
    role: 'assistant',
    text: `Here's your ${template.name} about ${vocabTerm}:\n\n${poem}`,
    timestamp: new Date().toISOString()
  }])
  
  // No LLM call needed!
}
```

## Option 2: Moderate - Choice-Based Story (Limited LLM)

Replace freeform story with dropdown choices:

```javascript
const STORY_TEMPLATES = [
  {
    id: 'adventure',
    title: 'Math Adventure',
    characters: ['Number Knight', 'Fraction Fairy', 'Geometry Giant', 'Algebra Alchemist'],
    settings: ['Math Mountain', 'Problem Palace', 'Equation Empire', 'Solution City'],
    plots: [
      'must solve a puzzle',
      'needs to find the missing number',
      'has to rescue the answer',
      'discovers a secret pattern'
    ],
    maxTurns: 5
  },
  {
    id: 'mystery',
    title: 'Science Mystery',
    characters: ['Detective Data', 'Professor Hypothesis', 'Lab Assistant Lucy', 'Scientist Sam'],
    settings: ['Science Lab', 'Research Station', 'Experiment Room', 'Discovery Zone'],
    plots: [
      'investigates a strange reaction',
      'discovers a new element',
      'solves an experiment mystery',
      'tests a big hypothesis'
    ],
    maxTurns: 5
  }
]

async function handleStoryStart() {
  // 1. Pick a template (filtered by lesson subject)
  const relevantTemplates = STORY_TEMPLATES.filter(t => 
    t.title.toLowerCase().includes(subjectParam.toLowerCase())
  )
  
  if (relevantTemplates.length === 0) {
    await speakFrontendRef.current("Let's focus on the lesson for now.")
    return
  }
  
  const template = relevantTemplates[0]
  
  // 2. Show dropdown for character selection
  const character = await showDropdownChoice('Pick your hero:', template.characters)
  
  // 3. Show dropdown for setting
  const setting = await showDropdownChoice('Where does it happen?', template.settings)
  
  // 4. Show dropdown for plot
  const plot = await showDropdownChoice('What happens?', template.plots)
  
  // 5. Generate opening with LLM (but VERY constrained)
  const safePrompt = `You are Ms. Sonoma. Write exactly 2-3 short sentences for children.
Start a ${template.title} where ${character} ${plot} in ${setting}.
Keep it simple, fun, and age-appropriate for ages 6-12.
Do NOT include violence, scary content, or anything inappropriate.`
  
  const opening = await callSonomaAPI(safePrompt, '')
  
  // 6. For each turn, show 2-3 choice buttons (no freeform input)
  setStoryState({
    template,
    character,
    setting,
    plot,
    transcript: [opening],
    turn: 1,
    maxTurns: template.maxTurns
  })
}

async function handleStoryChoice(choice) {
  const { template, transcript, turn, maxTurns } = storyState
  
  if (turn >= maxTurns) {
    // End the story
    const ending = `The end! Great story about ${template.title.toLowerCase()}!`
    await speakFrontendRef.current(ending)
    setStoryState(null)
    return
  }
  
  // Generate next part based on choice (with strict constraints)
  const safePrompt = `You are Ms. Sonoma. Continue this children's story with exactly 1-2 sentences.
The child chose: ${choice}
Previous story: ${transcript.join(' ')}
Keep it simple, fun, and age-appropriate. No violence or scary content.`
  
  const nextPart = await callSonomaAPI(safePrompt, '')
  
  // Show 2-3 new choices for next turn
  const choices = generateSafeChoices(template, turn + 1)
  
  setStoryState({
    ...storyState,
    transcript: [...transcript, nextPart],
    turn: turn + 1,
    currentChoices: choices
  })
}
```

## Option 3: Safest Ask Implementation

Limit Ask to pattern-matching question types only:

```javascript
const ASK_PATTERNS = [
  {
    pattern: /what (does|is) {VOCAB}( mean)?/i,
    response: (term) => `Let me explain ${term}. ${getDefinition(term)}`
  },
  {
    pattern: /can you explain {VOCAB}/i,
    response: (term) => `Sure! ${getDefinition(term)}`
  },
  {
    pattern: /give (me )?an example (of )?{VOCAB}/i,
    response: (term) => `Here's an example of ${term}: ${getExample(term)}`
  },
  {
    pattern: /how do (i|you) {VERB}/i,
    response: () => `Let me show you the steps: ${getLessonSteps()}`
  }
]

async function handleAskQuestionStart() {
  const question = learnerInput.trim().toLowerCase()
  
  // Try to match against safe patterns
  for (const pattern of ASK_PATTERNS) {
    // Replace {VOCAB} placeholder with actual vocab terms
    const vocabRegex = pattern.pattern.source.replace(
      '{VOCAB}',
      lessonVocab.map(v => v.term).join('|')
    )
    
    const regex = new RegExp(vocabRegex, 'i')
    const match = question.match(regex)
    
    if (match) {
      const term = match[1] || match[2]
      const response = pattern.response(term)
      
      // Use pre-defined response, no LLM needed
      setTranscript(prev => [...prev, {
        role: 'assistant',
        text: response,
        timestamp: new Date().toISOString()
      }])
      
      await speakFrontendRef.current(response, null)
      setCanSend(true)
      setLearnerInput('')
      return
    }
  }
  
  // If no pattern matches, reject
  const fallback = "I can help you with questions about our lesson. Try asking: What does [vocab term] mean?"
  setTranscript(prev => [...prev, {
    role: 'assistant',
    text: fallback,
    timestamp: new Date().toISOString()
  }])
  
  await speakFrontendRef.current(fallback, null)
  setCanSend(true)
  setLearnerInput('')
}
```

## UI Helper Components

### Dropdown Choice Component

```javascript
function DropdownChoice({ question, options, onSelect }) {
  const [selected, setSelected] = useState('')
  
  return (
    <div style={styles.choiceContainer}>
      <p style={styles.question}>{question}</p>
      <select 
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        style={styles.dropdown}
      >
        <option value="">Choose...</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <button
        disabled={!selected}
        onClick={() => onSelect(selected)}
        style={styles.confirmButton}
      >
        Continue
      </button>
    </div>
  )
}
```

### Button Choice Component (for stories)

```javascript
function ButtonChoices({ choices, onSelect }) {
  return (
    <div style={styles.buttonContainer}>
      <p style={styles.prompt}>What happens next?</p>
      {choices.map(choice => (
        <button
          key={choice}
          onClick={() => onSelect(choice)}
          style={styles.choiceButton}
        >
          {choice}
        </button>
      ))}
    </div>
  )
}
```

## Feature Comparison Matrix

| Feature | Risk Level | Current | Safest Option | Moderate Option |
|---------|-----------|---------|---------------|-----------------|
| **Ask** | Medium | Freeform LLM | Pattern-matching only | Limited LLM with validation |
| **Poem** | High | Freeform LLM | Template substitution | Vocab-constrained LLM |
| **Story** | CRITICAL | Freeform LLM | Dropdown choices only | Choice-based with limited LLM |
| **Joke** | Low | Pre-written | Keep as-is | Keep as-is |
| **Riddle** | Low | Pre-written | Keep as-is | Keep as-is |

## Immediate Action Plan

**Week 1:**
1. ✅ Disable Poem and Story features via environment variables
2. ✅ Implement content safety validation in API route
3. ✅ Add OpenAI Moderation API calls
4. ✅ Create safety incident logging

**Week 2:**
1. ✅ Implement pattern-based Ask (no freeform LLM)
2. ✅ Create template-based Poem system
3. ✅ Test adversarial inputs

**Week 3:**
1. ✅ Implement choice-based Story system
2. ✅ Add monitoring dashboard
3. ✅ Re-enable Poem with templates
4. ✅ Re-enable Story with choices

**Week 4:**
1. ✅ Audit logs for any incidents
2. ✅ Fine-tune constraints
3. ✅ Public announcement of new safety features
