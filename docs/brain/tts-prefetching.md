# TTS Prefetching System

## Overview

TTS (text-to-speech) prefetching eliminates 2-3 second waits between questions by loading question N+1 in the background while student answers question N. This was the main performance bottleneck identified by user after zombie code cleanup.

## How It Works

### Cache Architecture

**Module**: `src/app/session/utils/ttsCache.js` (212 lines)

**Core Components**:
- `TTSCache` class: Singleton instance exported as `ttsCache`
- LRU cache: Map-based storage with timestamp tracking
- MAX_CACHE_SIZE: 10 items (prevents memory issues during long sessions)
- Eviction: Oldest by timestamp when cache full

**Cache API**:
```javascript
ttsCache.get(text)           // Returns cached base64 audio or null
ttsCache.set(text, audio)    // Stores audio, evicts oldest if full
ttsCache.prefetch(text)      // Background fetch, fire-and-forget
ttsCache.clear()             // Cancels pending fetches, clears cache
ttsCache.cancelPrefetch(text) // Aborts specific pending request
```

### Integration Points

**1. speakFrontendImpl (page.js line ~2927)**
```javascript
// Check cache first
let b64 = ttsCache.get(text);

if (!b64) {
  // Cache miss - fetch from API
  setTtsLoadingCount((c) => c + 1);
  // ... fetch logic ...
  if (b64) {
    b64 = normalizeBase64Audio(b64);
    // Store successful fetch in cache
    ttsCache.set(text, b64);
  }
  setTtsLoadingCount((c) => Math.max(0, c - 1));
}
// else: cache hit - b64 already set, no loading indicator
```

Cache hits skip loading indicator entirely since audio is instant.

**2. Prefetch Triggers**

**After Comprehension Answer (page.js line ~5895)**:
```javascript
try { await speakFrontend(`${celebration}. ${progressPhrase} ${nextQ}`, { mcLayout: 'multiline' }); } catch {}

// Prefetch the question after this one while student answers
try {
  if (Array.isArray(generatedComprehension) && currentCompIndex < generatedComprehension.length) {
    const prefetchProblem = generatedComprehension[currentCompIndex];
    const prefetchQ = ensureQuestionMark(formatQuestionForSpeech(prefetchProblem, { layout: 'multiline' }));
    const prefetchText = `${CELEBRATE_CORRECT[0]}. ${prefetchQ}`;
    ttsCache.prefetch(prefetchText);
  }
} catch {}
```

**After Exercise Answer (page.js line ~6063)**: Same pattern as comprehension.

**After Worksheet Answer (page.js line ~6264)**:
```javascript
try { await speakFrontend(`${celebration}. ${progressPhrase} ${nextQ}`, { mcLayout: 'multiline' }); } catch {}

// Prefetch trigger: load next question OR closing line while student works
const isLastW = (nextIdx + 1) >= list.length;
if (isLastW) {
  const closingW = "That's all for the worksheet. Now let's begin the test.";
  ttsCache.prefetch(closingW);
} else {
  const nextNextIdx = nextIdx + 1;
  const nextNextObj = list[nextNextIdx];
  const nextNextNum = (typeof nextNextObj?.number === 'number' && nextNextObj.number > 0) ? nextNextObj.number : (nextNextIdx + 1);
  const nextNextQ = ensureQuestionMark(`${nextNextNum}. ${formatQuestionForSpeech(nextNextObj, { layout: 'multiline' })}`);
  ttsCache.prefetch(nextNextQ);
}
```

**After Test Answer (page.js line ~6383)**:
```javascript
try { await speakFrontend(`${speech} ${nextQ}`, { mcLayout: 'multiline' }); } catch {}

// Prefetch trigger: load next question while student works
const isLastT = (nextIdx + 1) >= totalLimit;
if (!isLastT) {
  const nextNextIdx = nextIdx + 1;
  const nextNextObj = generatedTest[nextNextIdx];
  const nextNextQ = ensureQuestionMark(`${nextNextIdx + 1}. ${formatQuestionForSpeech(nextNextObj, { layout: 'multiline' })}`);
  ttsCache.prefetch(nextNextQ);
}
```

**On Phase Start (usePhaseHandlers.js line ~105 & ~163)**:
```javascript
await speakFrontend(formatted, { mcLayout: 'multiline' });

// Prefetch second question while student answers first
try {
  if (Array.isArray(generatedComprehension) && currentCompIndex < generatedComprehension.length) {
    const prefetchProblem = generatedComprehension[currentCompIndex];
    const prefetchQ = ensureQuestionMark(formatQuestionForSpeech(prefetchProblem, { layout: 'multiline' }));
    ttsCache.prefetch(prefetchQ);
  }
} catch {}
```

**Teaching Flow Sentence-by-Sentence (useTeachingFlow.js)**:

Definitions and examples are delivered sentence-by-sentence. After speaking each sentence, prefetch the next one.

**After First Vocab Sentence (line ~312)**:
```javascript
// Speak the first sentence
try { await speakFrontend(sentences[0]); } catch {}

// Prefetch next sentence while student reads/processes current one
if (sentences.length > 1) {
  ttsCache.prefetch(sentences[1]);
}
```

**After Subsequent Vocab Sentences (line ~550)**:
```javascript
const nextSentence = vocabSentencesRef.current[nextIndex];
try { await speakFrontend(nextSentence); } catch {}

// Prefetch the sentence after this one while student reads current
if (nextIndex + 1 < vocabSentencesRef.current.length) {
  ttsCache.prefetch(vocabSentencesRef.current[nextIndex + 1]);
}
```

**After First Example Sentence (line ~436)**:
```javascript
// Speak the first sentence
try { await speakFrontend(sentences[0]); } catch {}

// Prefetch next sentence while student reads/processes current one
if (sentences.length > 1) {
  ttsCache.prefetch(sentences[1]);
}
```

**After Subsequent Example Sentences (line ~607)**:
```javascript
const nextSentence = exampleSentencesRef.current[nextIndex];
try { await speakFrontend(nextSentence); } catch {}

// Prefetch the sentence after this one while student reads current
if (nextIndex + 1 < exampleSentencesRef.current.length) {
  ttsCache.prefetch(exampleSentencesRef.current[nextIndex + 1]);
}
```

**3. Cache Clearing (page.js line ~990)**
```javascript
// Clear TTS cache on phase transitions to prevent stale audio from previous phases
useEffect(() => {
  try { ttsCache.clear(); } catch {}
}, [phase]);
```

Prevents comprehension audio bleeding into exercise phase, etc.

### Abort Handling

**AbortController Pattern**:
```javascript
pendingFetches: Map<string, AbortController>

prefetch(text) {
  const controller = new AbortController();
  this.pendingFetches.set(text, controller);
  
  fetch('/api/tts', { signal: controller.signal, ... })
    .then(...)
    .catch(err => {
      if (err.name === 'AbortError') return; // Silent - expected
      // Other errors also silent - prefetch is non-critical
    })
    .finally(() => this.pendingFetches.delete(text));
}

clear() {
  this.pendingFetches.forEach(controller => controller.abort());
  this.pendingFetches.clear();
  this.cache.clear();
}
```

Ensures no memory leaks from abandoned prefetch requests.

### Text Normalization

```javascript
normalizeText(text) {
  return text.toLowerCase().trim();
}
```

Cache keys are normalized so "What is 2+2?" and "what is 2+2? " hit same entry.

### Audio Extraction

```javascript
extractAudio(data) {
  if (!data) return null;
  
  // API can return audio in multiple formats:
  // { audio, audioBase64, audioContent, content, b64 }
  return data.audio || data.audioBase64 || data.audioContent || 
         data.content || data.b64 || null;
}
```

Handles various TTS API response formats.

## What NOT To Do

**DON'T prefetch without abort capability**
- Memory leaks from abandoned requests
- Network congestion from redundant fetches
- Phase transitions leave orphaned requests

**DON'T fail loudly on prefetch errors**
- Prefetch is optimization only
- User should never see prefetch failures
- Core flow must work without cache

**DON'NOT show loading indicator on cache hits**
```javascript
// WRONG - shows loading even for instant cache hits
setTtsLoadingCount((c) => c + 1);
let b64 = ttsCache.get(text);
if (!b64) { /* fetch */ }
setTtsLoadingCount((c) => c - 1);

// RIGHT - only show loading on cache miss
let b64 = ttsCache.get(text);
if (!b64) {
  setTtsLoadingCount((c) => c + 1);
  /* fetch */
  setTtsLoadingCount((c) => c - 1);
}
```

**DON'T cache indefinitely**
- LRU eviction at 10 items prevents memory growth
- Phase transitions clear cache (old phase audio irrelevant)

**DON'T prefetch more than one question ahead**
- Student might skip, fail, or use hint - next question unpredictable
- Better to prefetch N+1 after each answer than N+2..N+10 upfront

**DON'T trust question order without increment tracking**
```javascript
// WRONG - currentCompIndex already incremented, so array[currentCompIndex] is N+2 not N+1
const nextProblem = generatedComprehension[currentCompIndex];
setCurrentCompIndex(currentCompIndex + 1);
await speakFrontend(nextProblem);
ttsCache.prefetch(generatedComprehension[currentCompIndex]); // N+2!

// RIGHT - prefetch from same index that will be used next
const nextProblem = generatedComprehension[currentCompIndex];
setCurrentCompIndex(currentCompIndex + 1);
await speakFrontend(nextProblem);
// currentCompIndex now points to N+1 (just incremented)
ttsCache.prefetch(generatedComprehension[currentCompIndex]);
```

## Key Files

**Core Module**:
- `src/app/session/utils/ttsCache.js`: TTSCache class, LRU cache, prefetch logic

**Integration**:
- `src/app/session/page.js`: Import (line 31), speakFrontendImpl cache check (line ~2927), prefetch after comprehension answer (~5934), prefetch after exercise answer (~6117), prefetch after worksheet answer (~6264), prefetch after test answer (~6383), cache clear effect (~1004)
- `src/app/session/hooks/usePhaseHandlers.js`: Import (line 13), prefetch on comprehension start (~105), prefetch on exercise start (~163)
- `src/app/session/hooks/useTeachingFlow.js`: Import (line 10), prefetch after first vocab sentence (~312), prefetch after subsequent vocab sentences (~550), prefetch after first example sentence (~436), prefetch after subsequent example sentences (~607)

**API**:
- `src/app/api/tts/route.js`: TTS endpoint that returns `{ audio: base64 }`

## Performance Impact

**Before**: 2-3 second wait between questions (TTS generation time)
**After**: Questions 2+ load instantly (cache hit), only Q1 shows loading

**Cache stats during 5-question comprehension**:
- Q1: Cache miss (no prefetch yet) - 2-3s wait
- Q2: Cache hit (prefetched during Q1) - instant
- Q3: Cache hit (prefetched during Q2) - instant
- Q4: Cache hit (prefetched during Q3) - instant
- Q5: Cache hit (prefetched during Q4) - instant

**Total time saved**: 8-12 seconds per 5-question phase.

## Edge Cases

**Skip During Prefetch**:
- Prefetch continues in background (silent)
- Cache stores result even if not used
- Worst case: slight network waste, no user impact

**Failed Prefetch**:
- Silent catch, no cache entry
- Next question falls back to normal fetch (shows loading)
- User sees 2-3s wait but flow works normally

**Concurrent Prefetches**:
- Each prefetch gets unique AbortController
- Multiple pending fetches tracked in Map
- Phase transition aborts ALL pending

**Resume from Refresh**:
- Cache doesn't persist (memory only)
- First question after refresh shows loading
- Subsequent questions prefetch normally

**Celebration Text Variations**:
```javascript
// WRONG - prefetch won't match actual spoken text
ttsCache.prefetch(nextQ); // Just the question
await speakFrontend(`${celebration}. ${nextQ}`); // Celebration + question

// RIGHT - prefetch exact text that will be spoken
const prefetchText = `${CELEBRATE_CORRECT[0]}. ${nextQ}`;
ttsCache.prefetch(prefetchText);
```

Uses first celebration variant for prefetch since we can't predict random selection.

## Debug Helpers

```javascript
// Get cache statistics
const stats = ttsCache.getStats();
console.log(stats); // { size: 3, pending: 1, maxSize: 10 }
```

Useful for verifying cache behavior during development.
