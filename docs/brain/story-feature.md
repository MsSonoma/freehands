# Story Feature (Continuous Narrative)

## How It Works

The story feature creates a continuous narrative that progresses across all four phases (Teaching, Comprehension, Exercise, Worksheet, and Test). Instead of starting fresh each time, the story builds on itself throughout the session.

### Story Setup Phase (Initial Creation)

When a child first clicks "Story" in any phase, Ms. Sonoma asks three setup questions:
1. **"Who are the characters in the story?"** - Child responds with characters
2. **"Where does the story take place?"** - Child responds with setting
3. **"What happens in the story?"** - Child responds with plot elements

After collecting all three pieces, Ms. Sonoma tells the **first part** of the story using all setup information, ending with **"To be continued."**

### Story Continuation Across Phases

- Story transcript is **preserved** across phase changes
- Each time child clicks "Story" in subsequent phase:
  - Ms. Sonoma **reminds them where story left off** (first sentence only)
  - Asks **"What would you like to happen next?"**
  - Suggests possibilities (AI-generated)
  - Continues story based on their input
  - Ends with **"To be continued."**

### Story Ending in Test Phase

- In Test phase specifically, prompt changes
- Ms. Sonoma asks: **"How would you like the story to end?"**
- Child describes desired ending
- Ms. Sonoma ends story based on their idea, concluding with **"The end."**
- Happy Ending and Funny Ending buttons removed

### Story Direction Following

- API instructions emphasize: **"Follow the child's ideas closely and make the story about what they want unless it's inappropriate."**
- Ms. Sonoma stays on track with child's vision instead of redirecting
- Only inappropriate content triggers redirection

### Story Availability

- `storyUsedThisGate` no longer resets between phases
- Story button remains available throughout session
- Story can be accessed once per gate but continues same narrative
- Story only clears when starting new session or when story ends in Test phase

## State Variables

Location: `page.js`

```javascript
const [storySetupStep, setStorySetupStep] = useState('') // 'characters' | 'setting' | 'plot' | 'complete'
const [storyCharacters, setStoryCharacters] = useState('')
const [storySetting, setStorySetting] = useState('')
const [storyPlot, setStoryPlot] = useState('')
const [storyPhase, setStoryPhase] = useState('') // Tracks which phase story started in
const [storyState, setStoryState] = useState('inactive') // 'inactive' | 'awaiting-setup' | 'awaiting-turn' | 'ending'
const [storyTranscript, setStoryTranscript] = useState([]) // Full story history
```

## Handler Functions

Location: `useDiscussionHandlers.js`

### handleStoryStart
- Checks if `storyTranscript` has content
- **If continuing**: Reminds where story left off, asks for next part
- **If new**: Initiates setup phase asking for characters

### handleStoryYourTurn
- Handles all story input including setup and continuation
- **Setup phase**: Collects characters → setting → plot → generates first part
- **Continuation phase**: 
  - Sends full transcript history to maintain context
  - Generates next part with "To be continued."
- **Test phase**: 
  - Asks for ending preference
  - Generates final part with "The end."
  - Clears story data for next session

## User Experience Flow

### First Story Creation
1. Child clicks "Story" button
2. Ms. Sonoma: "Who are the characters in the story?"
3. Child: "A dragon and a princess"
4. Ms. Sonoma: "Where does the story take place?"
5. Child: "In a castle"
6. Ms. Sonoma: "What happens in the story?"
7. Child: "The dragon helps the princess"
8. Ms. Sonoma: *Tells first part* "Once upon a time, a dragon and a princess met in a castle. The dragon wanted to help the princess with her problem. To be continued."

### Story Continuation
1. Child clicks "Story" button
2. Ms. Sonoma: **Briefly recounts** (first sentence only): "The dragon wanted to help the princess."
3. Ms. Sonoma: "What would you like to happen next?"
4. Ms. Sonoma: **Suggests possibilities** (AI-generated): "You could say: the dragon flies away, or they find a map, or a wizard appears."
5. Child: "The dragon flies the princess to find treasure"
6. Ms. Sonoma: *Continues story* "The dragon spread its wings and flew the princess high above the clouds. Together they spotted a sparkly treasure chest below. To be continued."

### Story Ending
1. Child clicks "Story" button
2. Ms. Sonoma: **Briefly recounts** (first sentence only): "Together they spotted a sparkly treasure chest below."
3. Ms. Sonoma: "How would you like the story to end?"
4. Child describes ending
5. Ms. Sonoma: *Concludes story* "...and they lived happily ever after. The end."

## Key Files

- `page.js` - Story state variables
- `useDiscussionHandlers.js` - Story handlers (handleStoryStart, handleStoryYourTurn)
- `/api/sonoma/route.js` - Story generation API

## What NOT To Do

- Never reset storyTranscript between phases (preserve continuity)
- Never reset storyUsedThisGate between phases (one story per gate)
- Never skip setup phase on first story creation
- Never allow freeform story generation without setup (use template-based approach)
- Never forget to clear story data after "The end." in Test phase
