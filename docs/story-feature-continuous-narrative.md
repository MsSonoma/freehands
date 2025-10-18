# Story Feature Updates - Continuous Narrative Across Phases

## Overview
The story feature has been completely redesigned to create a continuous narrative that progresses across all four phases (Teaching, Comprehension, Exercise, Worksheet, and Test). Instead of starting fresh each time, the story now builds on itself throughout the session.

## Key Changes

### 1. Story Setup Phase (Initial Story Creation)
When a child first clicks "Story" in any phase, Miss Sonoma now asks three setup questions:
- **"Who are the characters in the story?"** - Child responds with characters
- **"Where does the story take place?"** - Child responds with setting
- **"What happens in the story?"** - Child responds with plot elements

After collecting all three pieces of information, Miss Sonoma tells the **first part** of the story using all the setup information, ending with **"To be continued."**

### 2. Story Continuation Across Phases
- The story transcript is **preserved** across phase changes
- Each time the child clicks "Story" in a subsequent phase:
  - Miss Sonoma **reminds them where the story left off**
  - Asks **"What would you like to happen next?"**
  - Continues the story based on their input
  - Ends with **"To be continued."**

### 3. Story Ending in Test Phase
- In the Test phase specifically, the prompt changes
- Miss Sonoma asks: **"How would you like the story to end?"**
- The child describes their desired ending
- Miss Sonoma ends the story based on their idea, concluding with **"The end."**
- The Happy Ending and Funny Ending buttons have been **removed**

### 4. Improved Story Direction Following
The API instructions now emphasize:
- **"Follow the child's ideas closely and make the story about what they want unless it's inappropriate."**
- Miss Sonoma will stay on track with the child's vision instead of redirecting unnecessarily
- Only inappropriate content triggers redirection

### 5. Story Availability Across Phases
- `storyUsedThisGate` no longer resets between phases
- The story button remains available throughout the session
- The story can be accessed once per gate but continues the same narrative
- Story only clears when starting a completely new session or when the story ends in Test phase

## Technical Implementation

### New State Variables (page.js)
```javascript
const [storySetupStep, setStorySetupStep] = useState(''); // 'characters' | 'setting' | 'plot' | 'complete'
const [storyCharacters, setStoryCharacters] = useState('');
const [storySetting, setStorySetting] = useState('');
const [storyPlot, setStoryPlot] = useState('');
const [storyPhase, setStoryPhase] = useState(''); // Tracks which phase story started in
```

### Updated Story States
- `storyState`: 'inactive' | 'awaiting-setup' | 'awaiting-turn' | 'ending'
- **'awaiting-setup'**: New state for collecting character/setting/plot
- **'awaiting-turn'**: Used for story continuations

### Handler Updates (useDiscussionHandlers.js)

#### `handleStoryStart`
- Checks if `storyTranscript` has content
- **If continuing**: Reminds where story left off, asks for next part
- **If new**: Initiates setup phase asking for characters

#### `handleStoryYourTurn`
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

### First Story Creation (Teaching Phase Example)
1. Child clicks "Story" button
2. Miss Sonoma: "Who are the characters in the story?"
3. Child: "A dragon and a princess"
4. Miss Sonoma: "Where does the story take place?"
5. Child: "In a castle"
6. Miss Sonoma: "What happens in the story?"
7. Child: "The dragon helps the princess"
8. Miss Sonoma: *Tells first part* "Once upon a time, a dragon and a princess met in a castle. The dragon wanted to help the princess with her problem. To be continued."

### Story Continuation (Comprehension, Exercise, Worksheet Phases)
1. Child clicks "Story" button
2. Miss Sonoma: **Briefly recounts** (first sentence only): "The dragon wanted to help the princess."
3. Miss Sonoma: "What would you like to happen next?"
4. Miss Sonoma: **Suggests possibilities** (AI-generated): "You could say: the dragon flies away, or they find a map, or a wizard appears."
5. Child: "The dragon flies the princess to find treasure"
6. Miss Sonoma: *Continues story* "The dragon spread its wings and flew the princess high above the clouds. Together they spotted a sparkly treasure chest below. To be continued."

### Story Ending (Test Phase)
1. Child clicks "Story" button
2. Miss Sonoma: **Briefly recounts** (first sentence only): "Together they spotted a sparkly treasure chest below."
3. Miss Sonoma: "How would you like the story to end?"
4. Child: "They share the treasure with everyone in the kingdom"
5. Miss Sonoma: *Ends story* "The dragon and princess opened the chest and found gold coins and jewels. They flew back to the kingdom and shared the treasure with everyone, making them all happy. The end."
6. Miss Sonoma: "Thanks for helping me tell this story."

## Benefits
1. **Continuity**: Story maintains coherence across the entire session
2. **Engagement**: Children stay invested in their story throughout all phases
3. **Agency**: Children have full creative control over their story direction
4. **Natural Flow**: Story feels like a complete experience, not fragmented episodes
5. **Phase Integration**: Story serves as a rewarding thread connecting all learning phases
6. **Brief Recaps**: Only the first sentence is recounted, keeping it concise
7. **AI Suggestions**: Story possibilities are suggested to inspire creativity (like Ask questions)
8. **Gratitude**: Miss Sonoma thanks the child for their collaboration at the end
9. **Proper Phase Detection**: Story only ends in Test phase, continues in all others

## File Changes
- `src/app/session/page.js`: Added state variables, updated handlers, removed ending buttons
- `src/app/session/hooks/useDiscussionHandlers.js`: Complete rewrite of story handlers with setup flow and continuation logic
