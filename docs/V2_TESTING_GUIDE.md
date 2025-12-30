# V2 Testing Guide

## What's Ready

**Complete teaching flow** with event-driven architecture:
- AudioEngine: Manages audio playback (Synthetic/HTMLAudio/WebAudio)
- TeachingController: Manages definitions → examples with sentence navigation
- Zero state coupling between components

## How to Test

### Method 1: Direct Test Route (Easiest)

1. Start dev server: `npm run dev`
2. Navigate to: **http://localhost:3001/session/v2test**
3. Click "Start Teaching"
4. Watch the flow:
   - Definitions stage (3 vocab terms)
   - Sentence-by-sentence navigation
   - Final gate (click Next to continue)
   - Examples stage (3 example sentences)
   - Sentence-by-sentence navigation
   - Final gate (click Next to complete)
   - Teaching complete!

### Method 2: Feature Flag (Production Integration)

1. Load any session page: `http://localhost:3001/session?lesson=123`
2. Open browser console
3. Enable V2: `localStorage.setItem('session_architecture_v2', 'true')`
4. Reload page
5. You're now running V2 instead of V1

To revert to V1:
```javascript
localStorage.removeItem('session_architecture_v2');
window.location.reload();
```

## What to Test

### 1. Audio Playback
- **Synthetic mode** (no actual audio, just captions with timing)
  - Should show captions advancing automatically
  - Video should play during audio
  - Captions should clear when done

### 2. Teaching Stage Progression
- **Definitions stage**
  - Should show 3 vocab terms as sentences
  - "Next Sentence" advances to next definition
  - "Repeat" replays current sentence
  - After last sentence, shows "Final Gate"
  - At gate, "Continue to Examples" button appears

- **Examples stage**
  - Should show 3 example sentences
  - Same navigation (Next/Repeat)
  - Final gate shows "Complete Teaching"
  - Clicking completes teaching

### 3. Controls
- **Navigation**: Next Sentence, Repeat, Restart Stage
- **Stage control**: Skip to Examples (only in definitions)
- **Audio transport**: Stop, Pause, Resume, Mute

### 4. Event Log
Watch the event log at the bottom for debugging:
- `AudioEngine START/END` events
- `TeachingController` stage changes
- Sentence advance events
- Final gate events
- Teaching complete event

## Known Limitations (By Design)

1. **No real TTS yet**: Using synthetic audio (captions only)
2. **Test data only**: Hardcoded photosynthesis lesson
3. **No lesson API**: Not loading from database
4. **Teaching stage only**: No discussion, comprehension, or closing phases yet

## What This Proves

If the teaching flow works smoothly:
- ✅ Event-driven architecture eliminates state coupling
- ✅ AudioEngine is a clean boundary
- ✅ TeachingController is a clean boundary  
- ✅ Sentence navigation has no race conditions
- ✅ Gate controls work deterministically
- ✅ No ref/state divergence

This is the architectural foundation for the rest of V2.

## Next Steps After Successful Test

1. Add real TTS API integration
2. Add real lesson API integration
3. Build PhaseOrchestrator (discussion → teaching → comprehension → closing)
4. Build question flows (comprehension, exercise, worksheet, test)
5. Add snapshot persistence
6. Side-by-side V1 vs V2 comparison with same lesson

## If Something Breaks

Check the event log - it will show exactly which component failed:
- AudioEngine events show audio system state
- TeachingController events show teaching stage state
- No need to debug both systems together

This is the debugging isolation the new architecture provides.
