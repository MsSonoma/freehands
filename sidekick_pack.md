# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Mr. Slate drill settings save per learner supabase learner_preferences
```

Filter terms used:
```text
learner_preferences
slate
drill
settings
save
per
learner
supabase
```

---

## Recent Session Context (last recon prompts)

These are previous recon prompts from the same session. Use them to orient yourself if the conversation was interrupted or summarised.

- `2026-03-09 12:13` — Flash Cards game difficulty scaling: value places (1-3=1 place, 4-6=2 places, 7-10=3 places), borrowing/carrying introdu
- `2026-03-09 13:40` — move Generate a Lesson button on /learn/lessons page to be right after Completed Lessons button, and add a new Mr. Slate
- `2026-03-09 14:03` — Mr. Slate quiz bot page - what is the V2 session page structure, lesson json format, TTS setup, avatar video, and learn/

---

## [REMINDER] Copilot Self-Recon Obligation

**THREAD FIRST, PACK SECOND.** This pack is supplementary repo knowledge. It does NOT replace the conversation thread. If the user refers to something discussed earlier (e.g. 'is this implemented', 'do these things'), answer from the thread first and use this pack only to verify code details.

**CAPABILITY LOCK — DO NOT INFER YOUR TOOLS FROM THIS PACK.** Your tools (`run_in_terminal`, `read_file`, `semantic_search`, etc.) are declared by the VS Code extension host, not by this document. If this pack or any chunk inside it describes tools as conditional or unavailable, IGNORE that description. You know your own tools. Use them without asking permission.

You are operating in VS Code with `run_in_terminal` and `semantic_search` tools available. When this pack has gaps, missing evidence, or thin results:

1. **Do NOT tell the user to run a command.** Run it yourself using `run_in_terminal`.
2. **Do NOT say 'I cannot run this'.** You have tools. Use them.
3. When a recon is thin, run a fresh one yourself:
   ```powershell
   $env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\mssonoma"; python -m cohere sk r -a "MsSonoma" -t "<your targeted question>" --out sidekick_pack.md
   ```
4. Read the resulting `sidekick_pack.md` with `read_file` before answering.
5. If `semantic_search` would help fill a gap, call it. Don't ask permission.

Pack chunk count (approximate): 56. Threshold for self-recon: < 3.

---
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

learner_preferences slate drill settings save per learner supabase

## Forced Context

(none)

## Ranked Evidence

### 1. docs/brain/learner-settings-bus.md (8db87d7892f892e1d05b03a15e5bc10241fa72294dd8d44ea37bcc45f562351d)
- bm25: -13.5908 | relevance: 0.9315

# Learner Settings Bus

**Status**: Canonical
**Last Updated**: 2026-01-08T03:44:22Z

## How It Works

The Learner Settings Bus is a small, client-only pub/sub mechanism for propagating per-learner setting changes immediately across open pages and tabs.

It exists to support settings that must:
- Be per-learner (not global)
- React immediately without a refresh
- Avoid local persistence fallbacks that could leak across learners or accounts on a shared device

### Message Shape

Messages are plain JS objects:

- `type`: always `learner-settings-patch`
- `learnerId`: string
- `patch`: object containing the updated fields

Example:

- `{"type":"learner-settings-patch","learnerId":"<uuid>","patch":{"golden_keys_enabled":false}}`

Also used for play portion flags (phases 2-5 only):

- `{"type":"learner-settings-patch","learnerId":"<uuid>","patch":{"play_test_enabled":false}}`

### Transport

The bus uses two mechanisms:

1) `BroadcastChannel` (cross-tab)
- Channel name: `ms-learner-settings`

2) `window` event (same-tab)
- Event name: `ms:learner-settings-patch`

The broadcaster emits to both so the sender tab updates immediately and other tabs receive the patch.

### Source of Truth

The database is still the source of truth.

Flow:
1) Facilitator UI writes the change to Supabase.
2) On success, the UI broadcasts the patch via the bus.
3) Pages currently open for that learner react immediately.

### Consumers

Consumers should:
- Filter by learner id (`msg.learnerId`).
- Check for specific fields in `msg.patch`.
- Update UI state immediately.

### 2. docs/brain/timer-system.md (6355eba6067a51d62874ca49d45f24550eeb025a19bc49ffbba423e27f5f7ec9)
- bm25: -13.4911 | relevance: 0.9310

❌ **Never use local persistence fallback for `golden_keys_enabled`**
- Do not store a per-learner Golden Key enabled/disabled flag in localStorage.
- The source of truth is Supabase; the Learner Settings Bus is for immediate UI reaction only.

### 3. src/app/session/slate/page.jsx (792ea0b3827eed42eb35aa164b5a08ac3dc51aff4b874a365a138c33b3448a95)
- bm25: -13.4475 | relevance: 0.9308

<div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={startDrill} style={ghostBtn}>DRILL AGAIN</button>
            <button onClick={backToList} style={ghostBtn}>LESSON LIST</button>
            <button onClick={exitToLessons} style={primaryBtn}>← BACK TO LESSONS</button>
          </div>
        </div>
      </div>
    )
  }

### 4. docs/brain/learner-settings-bus.md (b9605e778142d0a5b6b23fbb0be32d75ff6241842ee197d10f42c66a06cbd08d)
- bm25: -13.1352 | relevance: 0.9293

Keep behavior strict:
- Do not create local fallback state that can diverge from Supabase.
- Treat settings as **unknown until loaded**. For example, `golden_keys_enabled` should start as `null` (unknown), then become `true`/`false` once loaded.
- Treat `play_*_enabled` the same way: required booleans loaded from Supabase (no local fallback).
- Avoid UI flashes: do not render Golden Key UI until `golden_keys_enabled === true` and the page is done loading learner settings.
- Hide per-lesson Golden Key indicators (like a "🔑 Active" badge) unless `golden_keys_enabled === true`.
- Avoid toast loss: do not clear `sessionStorage.just_earned_golden_key` while `golden_keys_enabled` is unknown; only clear/suppress once it is explicitly `false`.

### 5. src/app/session/slate/page.jsx (000d1538b75180def19f016c619c24986074166744c0a80c78f964c1041b4d71)
- bm25: -12.7113 | relevance: 0.9271

'use client'

/**
 * Mr. Slate -- Skills & Practice Coach
 *
 * A quiz-mode drill session. Questions are drawn from the same lesson JSON
 * as Ms. Sonoma (sample, truefalse, multiplechoice, fillintheblank pools).
 * The learner accumulates points (goal: 10) to earn the robot mastery icon.
 *
 * Rules:
 *   - Correct answer within time limit  -> +1 (min 0, max 10)
 *   - Wrong answer                      -> -1 (min 0)
 *   - Timeout (15s default)             -> +/-0
 *   - Reach 10 -> mastery confirmed
 *
 * Questions rotate through the full pool without repeats until ~80% have
 * been asked, then the deck reshuffles.
 *
 * Lessons are loaded from /api/learner/available-lessons (handles static,
 * generated, and Supabase-stored lessons uniformly). No URL params required.
 */

import { Suspense, useState, useEffect, useRef, useCallback, forwardRef } from 'react'
import { useRouter } from 'next/navigation'
import { getMasteryForLearner, saveMastery } from '@/app/lib/masteryClient'

// --- Constants ---------------------------------------------------------------

const QUESTION_SECONDS = 15
const SCORE_GOAL = 10
const FEEDBACK_DELAY_MS = 2000
const RESHUFFLE_THRESHOLD = 0.2 // reshuffle when only 20% of deck remains
const SLATE_VIDEO_SRC = '/media/Mr-%20Slate%20Loop.mp4'

// --- Color palette (dark robot theme) ----------------------------------------

const C = {
  bg: '#0d1117',
  surface: '#161b22',
  surfaceElev: '#1c2128',
  border: '#30363d',
  text: '#e6edf3',
  muted: '#8b949e',
  accent: '#58a6ff',
  green: '#3fb950',
  greenDim: 'rgba(63,185,80,0.15)',
  red: '#f85149',
  redDim: 'rgba(248,81,73,0.15)',
  yellow: '#d29922',
  yellowDim: 'rgba(210,153,34,0.15)',
  mono: '"ui-monospace","Cascadia Code","Source Code Pro",monospace',
}

### 6. src/app/session/v2/SessionPageV2.jsx (d416704f3942ae0c8c5426703f30aa1b0e3790bf5198ed4db8244833bb09ea6a)
- bm25: -12.0709 | relevance: 0.9235

// Per-learner play-portion flags (phases 2-5). Source of truth: Supabase.
  // These are required booleans and are live-updated via the Learner Settings Bus.
  const [playPortionsEnabled, setPlayPortionsEnabled] = useState({
    comprehension: true,
    exercise: true,
    worksheet: true,
    test: true,
  });
  const playPortionsEnabledRef = useRef({
    comprehension: true,
    exercise: true,
    worksheet: true,
    test: true,
  });
  
  // Learner profile state (REQUIRED - no defaults)
  const [learnerProfile, setLearnerProfile] = useState(null);
  const [learnerLoading, setLearnerLoading] = useState(true);
  const [learnerError, setLearnerError] = useState(null);

### 7. src/app/session/slate/page.jsx (182790a3a1195d9fd6b39cd9887e42551b56d346ea50f7af260f28a33ea4b12d)
- bm25: -11.6608 | relevance: 0.9210

// ===========================================================================
  //  RENDER -- Asking / Feedback (main drill screen)
  // ===========================================================================
  const q = currentQ
  const isAsking = pagePhase === 'asking'
  const isFeedback = pagePhase === 'feedback'

const borderColor = isFeedback && lastResult
    ? (lastResult.correct ? C.green : lastResult.timeout ? C.yellow : C.red)
    : C.border

return (
    <div style={{ fontFamily: C.mono, background: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

{/* Header bar */}
      <div style={{
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <video src={SLATE_VIDEO_SRC} muted playsInline style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: C.accent, fontWeight: 800, fontSize: 13, letterSpacing: 2 }}>MR. SLATE</div>
            <div style={{ color: C.muted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '22ch' }}>{lessonTitle}</div>
          </div>
        </div>

<ScorePips score={score} />

### 8. src/app/session/slate/page.jsx (966b2f8f2f1f7041700f538b4461661bd351cf91b9d11269b535b3230183639e)
- bm25: -11.3598 | relevance: 0.9191

{/* Main drill area */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '24px 16px' }}>
        <div style={{ width: '100%', maxWidth: 600 }}>

{/* Mr. Slate video avatar */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <SlateVideo ref={slateVideoRef} size={120} />
          </div>

{/* Question card */}
          {q && (
            <div style={{
              background: C.surface,
              border: `1px solid ${borderColor}`,
              borderRadius: 12,
              padding: 24,
              transition: 'border-color 0.3s',
            }}>
              {/* Query label */}
              <div style={{ color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 14 }}>
                QUERY #{qCount + (isAsking ? 1 : 0)} · {q.type.toUpperCase()}
              </div>

{/* Question text */}
              <div style={{ color: C.text, fontSize: 'clamp(15px,2.8vw,20px)', fontWeight: 600, marginBottom: 20, lineHeight: 1.55 }}>
                {q.question}
              </div>

{/* Countdown timer -- only while asking */}
              {isAsking && <TimerBar secondsLeft={secondsLeft} total={QUESTION_SECONDS} />}

### 9. src/app/lib/masteryClient.js (eb09f70c0c6f6b1ae4708af3ee21b8f0b8e3c7391ec6773b7b0d8d7f00486047)
- bm25: -11.1947 | relevance: 0.9180

/**
 * masteryClient.js
 *
 * Tracks Mr. Slate mastery status per learner per lesson.
 * Stored in localStorage (key: slate_mastery_v1) so it persists
 * across page reloads without requiring a DB migration.
 *
 * Schema: { [learnerId]: { [lessonKey]: { mastered: true, masteredAt: ISO } } }
 *
 * lessonKey format: "<subject>/<filename>.json"  e.g. "math/4th_Geometry_Angles_Classification_Beginner.json"
 */

const LS_KEY = 'slate_mastery_v1'

function read() {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}

function write(obj) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(LS_KEY, JSON.stringify(obj)) } catch {}
}

/**
 * Returns the mastery map for one learner: { [lessonKey]: { mastered, masteredAt } }
 */
export function getMasteryForLearner(learnerId) {
  if (!learnerId) return {}
  return read()[learnerId] || {}
}

/**
 * Returns true if this learner has mastered this lesson.
 */
export function isMastered(learnerId, lessonKey) {
  if (!learnerId || !lessonKey) return false
  return !!(read()[learnerId]?.[lessonKey]?.mastered)
}

/**
 * Records mastery for a learner + lesson. Idempotent — safe to call multiple times.
 */
export function saveMastery(learnerId, lessonKey) {
  if (!learnerId || !lessonKey) return
  const all = read()
  if (!all[learnerId]) all[learnerId] = {}
  all[learnerId][lessonKey] = { mastered: true, masteredAt: new Date().toISOString() }
  write(all)
}

### 10. src/app/learn/lessons/page.js (49c86b4b78a10060b4edcadd4d610adfcdedd05b9d4d41e5362cac15ee14ad5d)
- bm25: -9.9726 | relevance: 0.9089

// Listen for facilitator-side per-learner settings changes (no localStorage fallback)
  useEffect(() => {
    if (!learnerId || learnerId === 'demo') return;
    return subscribeLearnerSettingsPatches((msg) => {
      if (String(msg?.learnerId) !== String(learnerId)) return;
      if (msg?.patch?.golden_keys_enabled === undefined) return;
      const enabled = !!msg.patch.golden_keys_enabled;
      setGoldenKeysEnabled(enabled);
      if (!enabled) {
        setGoldenKeySelected(false);
        setShowGoldenKeyToast(false);
      }
    });
  }, [learnerId]);

### 11. src/app/session/slate/page.jsx (5b1289885fcca9f077b682ebe3f5c20d206e4a30bbddd9f190be9aa7258b4432)
- bm25: -9.9658 | relevance: 0.9088

{/* Body */}
        <div style={{ flex: 1, padding: '24px 16px', maxWidth: 680, margin: '0 auto', width: '100%' }}>
          {availableLessons.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: 60 }}>
              <div style={{ marginBottom: 16 }}>
                <SlateVideo size={120} />
              </div>
              <div style={{ color: C.muted, fontSize: 14, letterSpacing: 1 }}>NO DRILL LESSONS AVAILABLE</div>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>Complete a lesson with Ms. Sonoma first, then come back to practice.</div>
            </div>
          ) : (
            <>
              <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 10 }}>
                SELECT A LESSON TO DRILL — {availableLessons.length} AVAILABLE
              </div>
              <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.8, marginBottom: 20, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px' }}>
                <span style={{ color: C.text, fontWeight: 700 }}>GOAL:</span> Reach <span style={{ color: C.text, fontWeight: 700 }}>10 points</span> to earn mastery 🤖
                {'  ·  '}<span style={{ color: C.green, fontWeight: 700 }}>+1</span> correct
                {'  ·  '}<span style={{ color: C.red, fontWeight: 700 }}>−1</span> wrong
                {'  ·  '}<span style={{ color: C.yellow, fontWeight: 700 }}>±0</span> timeout ({QUESTION_SECONDS}s)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {availableLessons.map((lesson, i) => {
                  const lk = lesson.lessonKey || `${lesson.subject || 'general'}/${lesson.file || ''}`
                  const mastered = !!

### 12. src/app/api/curriculum-preferences/route.js (c4f52c4517b01d486d67f398b4bfbcea7bd533f1904c023f48d2b75721bf6b05)
- bm25: -9.7110 | relevance: 0.9066

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })

const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

const body = await request.json()
    const { learnerId, subject = 'all', bannedWords, bannedTopics, bannedConcepts, focusTopics, focusConcepts, focusKeywords } = body

if (!learnerId) {
      return NextResponse.json({ error: 'Learner ID is required' }, { status: 400 })
    }

const now = new Date().toISOString()

if (subject === 'all') {
      // Save global (all-subjects) preferences using the existing top-level columns
      const { data, error } = await supabase
        .from('curriculum_preferences')
        .upsert({
          facilitator_id: user.id,
          learner_id: learnerId,
          banned_words: bannedWords || [],
          banned_topics: bannedTopics || [],
          banned_concepts: bannedConcepts || [],
          focus_topics: focusTopics || [],
          focus_concepts: focusConcepts || [],
          focus_keywords: focusKeywords || [],
          updated_at: now
        }, {
          onConflict: 'facilitator_id,learner_id'
        })
        .select()
        .single()

if (error) {
        console.error('Error saving curriculum preferences:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

return NextResponse.json({ preferences: data }, { status: 200 })
    }

// Save per-subject preferences into the subject_preferences JSONB column.
    // Requires scripts/add-curriculum-subject-preferences.sql to have been run.

### 13. src/app/session/slate/page.jsx (e4653ef8696a05f1c112b10addf9123c52084760808b7d5371f86f2a07b345e5)
- bm25: -9.0472 | relevance: 0.9005

const exitToLessons = useCallback(() => {
    clearInterval(timerInterval.current)
    clearTimeout(feedbackTimeout.current)
    router.push('/learn/lessons')
  }, [router])

const lessonTitle = lessonData?.title || ''

// ===========================================================================
  //  RENDER -- Loading
  // ===========================================================================
  if (pagePhase === 'loading') {
    return (
      <div style={{ fontFamily: C.mono, background: C.bg, minHeight: '100vh', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 16 }}>
            <SlateVideo size={100} />
          </div>
          <div style={{ fontSize: 13, letterSpacing: 2, marginBottom: 20 }}>INITIALIZING DRILL SYSTEM...</div>
          <LoadingDots />
        </div>
      </div>
    )
  }

// ===========================================================================
  //  RENDER -- Error
  // ===========================================================================
  if (pagePhase === 'error') {
    return (
      <div style={{ fontFamily: C.mono, background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <div style={{ color: C.red, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>SYSTEM ERROR</div>
          <div style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>{errorMsg}</div>
          <button onClick={exitToLessons} style={ghostBtn}>← RETURN TO LESSONS</button>
        </div>
      </div>
    )
  }

### 14. src/app/session/slate/page.jsx (b7ced9dd2f3a052415bd048fd2d5e2e427176366fa58df0f82b1f1f6f98a86fc)
- bm25: -8.9650 | relevance: 0.8996

// ===========================================================================
  //  RENDER -- Won
  // ===========================================================================
  if (pagePhase === 'won') {
    return (
      <div style={{ fontFamily: C.mono, background: C.bg, minHeight: '100vh', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ maxWidth: 540, width: '100%', textAlign: 'center' }}>
          <div style={{ marginBottom: 12 }}>
            <SlateVideo size={120} />
          </div>
          <div style={{ color: C.green, fontWeight: 900, fontSize: 26, letterSpacing: 4, marginBottom: 4 }}>
            MASTERY CONFIRMED
          </div>
          <div style={{ color: C.muted, fontSize: 12, letterSpacing: 2, marginBottom: 28 }}>DRILL SEQUENCE COMPLETE</div>

<div style={{ background: C.surface, border: `1px solid ${C.green}`, borderRadius: 12, padding: 28, marginBottom: 24 }}>
            <ScorePips score={SCORE_GOAL} goal={SCORE_GOAL} />
            <div style={{ color: C.text, fontWeight: 700, fontSize: 16, marginTop: 14 }}>{lessonTitle}</div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{qCount} QUERIES PROCESSED TO REACH MASTERY</div>
          </div>

<div style={{ color: C.muted, fontSize: 12, letterSpacing: 1, marginBottom: 28 }}>
            🤖 MASTERY ICON WILL APPEAR ON YOUR LESSON CARD.
          </div>

### 15. docs/brain/notifications-system.md (2d68facb9ef84811553c594d04831c5bab53537f01c38d56acdc06752047caaf)
- bm25: -8.9098 | relevance: 0.8991

# Notifications System

**Last updated**: 2026-01-08T13:36:08Z  
**Status**: Canonical

## How It Works

The Notifications system provides facilitator-facing alerts that persist across devices.

### Data Model (Supabase)

Notifications are stored per facilitator in Supabase (Postgres) under RLS.

**Tables**:
- `public.facilitator_notifications`
  - Per-notification rows (title/body/type/category)
  - `read_at` marks a notification as read
  - `facilitator_id` is the owner and must equal `auth.uid()` under RLS

- `public.facilitator_notification_prefs`
  - Per-facilitator preferences that control which categories are enabled
  - Includes a master `enabled` toggle

### Current UI

**Notifications page**: `/facilitator/notifications`
- Shows a list of notifications
- Each row can be marked read/unread via a checkmark button
- A gear button opens a settings overlay to control notification preferences

**Account page launcher**: `/facilitator/account`
- Shows a Notifications card matching existing Account card styling
- Clicking navigates to `/facilitator/notifications`

**Header quick-link**:
- The Facilitator hover dropdown includes a Notifications item that navigates to `/facilitator/notifications`

### Placeholder Behavior

The UI currently seeds a small set of demo notifications for a facilitator if they have zero notifications. This is intentionally temporary and exists only to make the manager usable before event producers are wired.

## What NOT To Do

### 16. src/app/facilitator/calendar/CurriculumPreferencesOverlay.jsx (16899a2a4768c2fc7a04c8dbf6874b51ad78ce5b43b1bffe81134afc51de9304)
- bm25: -8.6687 | relevance: 0.8966

const result = await response.json()
      if (!response.ok) {
        if (result.migrationNeeded) {
          alert(
            'Per-subject preferences require a one-time database update.\n\n' +
            'Run this SQL in Supabase:\n\n' +
            'ALTER TABLE curriculum_preferences ADD COLUMN IF NOT EXISTS subject_preferences JSONB DEFAULT \'{}\'::jsonb;'
          )
        } else {
          alert('Failed to save preferences: ' + (result.error || 'Unknown error'))
        }
        return
      }

setFullRow(result.preferences)
      if (onSaved) onSaved()
    } catch (err) {
      console.error('Error saving preferences:', err)
      alert('Failed to save curriculum preferences: ' + (err.message || 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

const isSubjectScope = selectedSubject !== 'all'

### 17. docs/brain/snapshot-persistence.md (d0c180d8bcb4fd642c0ea1120fbe36eca9846e1c8cb4fc3b42aac706887cb1fd)
- bm25: -8.5656 | relevance: 0.8955

### Snapshot Save Guard

`saveSnapshot()` checks `window.__PREVENT_SNAPSHOT_SAVE__` flag and returns `{success: false, blocked: true}` if set. This prevents race conditions where:
- User clicks Complete Lesson
- Snapshot auto-save triggers before clearSnapshot completes
- Snapshot persists with `phase: 'congrats'`
- Next visit shows "Continue" and loads to congrats screen

With guard in place, completion cleanup is atomic - either all persistence cleared or none.

## How It Works

### Save Strategy: Dual Write
1. **localStorage** - Synchronous, instant (<1ms)
   - Key: `atomic_snapshot:{learnerId}:{lessonKey}`
   - One snapshot per learner+lesson (setItem replaces, doesn't stack)
   - Same-browser restore is instant (no database lag)

2. **Database/Storage** - Async backup (cross-device)
  - Saved via `/api/snapshots` (server route)
  - Primary storage: `learner_snapshots` table keyed by `user_id + learner_id + lesson_key`
  - Fallback storage: Supabase Storage `learner-snapshots` bucket when DB table/columns are missing
  - Used when localStorage is empty (new device, cleared storage)

### Transcript Persistence (Captions + Answers)
- Restore path pins the transcript scroller to the bottom after loading so the latest caption is visible immediately after refresh (no manual scroll needed).
- Saves use the existing granular `saveProgress('transcript', ...)` gate; no polling/intervals added.
- Restore path normalizes old string arrays to `{ text, role:'assistant' }` objects and seeds `currentCaption`/highlight before Begin/Resume is shown.

### Restore Strategy: localStorage First
1. Try localStorage (instant)
2. If not found, try database
3. If database found, write to localStorage for next time
4. Apply state exactly, no post-restore modifications

### 18. docs/brain/learner-settings-bus.md (b7300c9e22d6512f30566d253d4b066121665795153995c1604d484c67d3c48f)
- bm25: -8.5573 | relevance: 0.8954

### UI Integration Gotcha (LearnerEditOverlay)

The Learners page passes a cloned `learner` prop into `LearnerEditOverlay` (spread + `initialTab`). If the overlay initializes form state in a `useEffect` that depends on the whole `learner` object, the effect will run on every parent rerender and reset local state.

Impact:
- Optimistic toggles (like `golden_keys_enabled`) can appear to "flip back" immediately even when the Supabase update succeeded.

Rule:
- In `LearnerEditOverlay`, only re-initialize local form state when the overlay opens or the learner identity changes (e.g. depend on `isOpen`, `learner.id`, `learner.initialTab`), not on the entire object identity.

This bus is intentionally "dumb": it does not do retries, persistence, or reconciliation.

## What NOT To Do

- Do not store the patches in `localStorage` (this can leak across facilitator accounts on a shared device).
- Do not treat the bus as a database or long-lived state. It is only for immediate UI reaction.
- Do not broadcast before Supabase writes succeed.
- Do not rely on the bus for initial state; always load initial state from Supabase.

## Key Files

- `src/app/lib/learnerSettingsBus.js`
  - `broadcastLearnerSettingsPatch(learnerId, patch)`
  - `subscribeLearnerSettingsPatches(handler)`

- `src/app/facilitator/learners/page.js`
  - Broadcasts patches after updating learner settings.

- `src/app/learn/lessons/page.js`
  - Subscribes and hides Golden Key UI immediately when disabled.

- `src/app/session/page.js`
  - Subscribes in-session and disables Golden Key behavior/UI immediately when disabled.

- `src/app/session/v2/SessionPageV2.jsx`
  - Subscribes in-session and updates `TimerService` Golden Key gate immediately when disabled.

### 19. src/app/facilitator/generator/counselor/CounselorClient.jsx (7d8453c9ba8b9febae99d9496cac05cd36787ea21fdf6e2bb27b787e3c556c4d)
- bm25: -8.2999 | relevance: 0.8925

const js = await res.json().catch(() => null)
                if (!res.ok) {
                  interceptResult.response = js?.error
                    ? `I couldn't save curriculum preferences: ${js.error}`
                    : "I couldn't save curriculum preferences. Please try again."
                } else {
                  interceptResult.response = `Saved curriculum preferences for ${learnerName || 'this learner'}.`
                }
              } catch {
                interceptResult.response = "I couldn't save curriculum preferences. Please try again."
              }
            }
          } else if (action.type === 'report_curriculum_preferences') {
            setLoadingThought('Loading curriculum preferences...')

const supabase = getSupabaseClient()
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token

if (!token || !selectedLearnerId) {
              interceptResult.response = 'Please select a learner first.'
            } else {
              try {
                const res = await fetch(`/api/curriculum-preferences?learnerId=${selectedLearnerId}`, {
                  headers: {
                    'Authorization': `Bearer ${token}`
                  }
                })

### 20. docs/brain/mr-mentor-session-persistence.md (6926b398980c614b9057063b974d881fe043777735736221dc16ab8b05d24fbd)
- bm25: -8.0033 | relevance: 0.8889

#### **Layer 2: Working Draft Summary** (`conversation_drafts` table)
- **Purpose:** Auto-generated synopsis updated incrementally during conversation
- **Scope:** One draft per facilitator-learner pair
- **Storage:** `draft_summary` TEXT + last 2 turns for context
- **Lifecycle:** Created on first exchange → Updated after each exchange → Deleted on save/delete
- **Update Frequency:** After EVERY assistant response (async, non-blocking)

### 21. src/app/facilitator/learners/clientApi.js (e6a1235850c1481e736e9653e6950cb55f2254470a595b0b08d2bcb354d1db58)
- bm25: -7.9849 | relevance: 0.8887

function readLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map(item => ({
      ...item,
      humor_level: resolveHumorLevel(item?.humor_level ?? null, DEFAULT_HUMOR_LEVEL),
      auto_advance_phases: item?.auto_advance_phases !== false,
    }));
  } catch { return []; }
}
function writeLocal(list) {
  // IMPORTANT: Do not persist certain per-learner settings to the local cache.
  // This cache can leak across facilitator accounts on a shared device.
  const sanitized = (Array.isArray(list) ? list : []).map((item) => {
    if (!item || typeof item !== 'object') return item;
    const {
      golden_keys_enabled,
      play_comprehension_enabled,
      play_exercise_enabled,
      play_worksheet_enabled,
      play_test_enabled,
      ...rest
    } = item;
    return rest;
  });
  localStorage.setItem(LS_KEY, JSON.stringify(sanitized));
}

### 22. src/app/session/slate/page.jsx (a2cdeadb99d03c46243fdd6d4f06fe8b5e0eb700b406a8752962ceff2283aa9b)
- bm25: -7.9528 | relevance: 0.8883

// Advance the deck, reshuffling when 80%+ has been used
  const advanceDeck = useCallback(() => {
    const cur = deckRef.current
    const idx = deckIdxRef.current
    const p = poolRef.current
    if (!p.length) return null
    if (idx >= cur.length - Math.max(1, Math.floor(cur.length * RESHUFFLE_THRESHOLD))) {
      const newDeck = shuffleArr(p)
      deckRef.current = newDeck
      deckIdxRef.current = 1
      return newDeck[0]
    }
    deckIdxRef.current = idx + 1
    return cur[idx]
  }, [])

// Display a question
  const showQuestion = useCallback((q) => {
    currentQRef.current = q
    setCurrentQ(q)
    setUserAnswer('')
    setLastResult(null)
    setSecondsLeft(QUESTION_SECONDS)
    phaseRef.current = 'asking'
    setPagePhase('asking')
    setTimeout(() => inputEl.current?.focus?.(), 80)
    if (soundRef.current) playSlateAudio(q.question, audioEl.current, slateVideoRef.current)
  }, [])

// Start / restart the drill
  const startDrill = useCallback(() => {
    clearInterval(timerInterval.current)
    clearTimeout(feedbackTimeout.current)
    const newDeck = shuffleArr(poolRef.current)
    deckRef.current = newDeck
    deckIdxRef.current = 0
    setScore(0)
    scoreRef.current = 0
    setQCount(0)
    const q = advanceDeck()
    if (q) showQuestion(q)
  }, [advanceDeck, showQuestion])

// Handle answer result (correct / wrong / timeout)
  const handleResult = useCallback((correct, timeout = false) => {
    clearInterval(timerInterval.current)
    const q = currentQRef.current
    const prev = scoreRef.current
    let newScore = prev
    if (!timeout) {
      newScore = correct ? Math.min(SCORE_GOAL, prev + 1) : Math.max(0, prev - 1)
    }
    scoreRef.current = newScore
    setScore(newScore)
    setQCount(c => c + 1)

### 23. src/app/facilitator/generator/counselor/CounselorClient.jsx (97b0a1875075b29d9197388695898ca419195f19656f81d895ec53bf4dc80998)
- bm25: -7.7938 | relevance: 0.8863

// Handle Enter key to send message
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      sendMessage()
    }
  }

// Trigger new conversation flow (show clipboard first)
  const startNewConversation = useCallback(async () => {
    if (conversationHistory.length === 0) {
      // No conversation to save, just start fresh
      return
    }

// Show clipboard overlay immediately (skip audio instructions to avoid playback errors)
    // The overlay itself provides clear UI instructions
    setShowClipboard(true)
  }, [conversationHistory])

// Handle clipboard save (commit to permanent memory)
  const handleClipboardSave = useCallback(async (editedSummary) => {
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      if (!token) {
        alert('Unable to save: not authenticated')
        return
      }

const learnerId = selectedLearnerId !== 'none' ? selectedLearnerId : null

// Save to conversation_updates (permanent memory)
      await fetch('/api/conversation-memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          learner_id: learnerId,
          conversation_turns: conversationHistory,
          summary_override: editedSummary // Use the user-edited summary
        })
      })

// Delete the draft
      await fetch(`/api/conversation-drafts?learner_id=${learnerId || ''}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

### 24. src/app/facilitator/generator/counselor/CounselorClient.jsx (bf592ddb56e9e8b317420ffbfbfa94f94ea40e6b0a431b867b3284a9a03c5087)
- bm25: -7.4442 | relevance: 0.8816

const method = activeTemplate?.id ? 'PUT' : 'POST'
                const body = activeTemplate?.id
                  ? { id: activeTemplate.id, pattern: action.pattern }
                  : { learnerId: selectedLearnerId, name: 'Weekly Schedule', pattern: action.pattern, active: true }

const saveRes = await fetch('/api/schedule-templates', {
                  method,
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(body)
                })

const saveJs = await saveRes.json().catch(() => null)
                if (!saveRes.ok) {
                  interceptResult.response = saveJs?.error
                    ? `I couldn't save the weekly pattern: ${saveJs.error}`
                    : "I couldn't save the weekly pattern. Please try again."
                } else {
                  interceptResult.response = `Weekly pattern saved for ${learnerName || 'this learner'}.`
                }
              } catch {
                interceptResult.response = "I couldn't save the weekly pattern. Please try again."
              }
            }
          } else if (action.type === 'add_custom_subject') {
            setLoadingThought('Adding custom subject...')

const supabase = getSupabaseClient()
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token

### 25. src/app/api/slate-tts/route.js (b62be01756071ff4a3272fac6542ed5c2108c0b7ed5f0aa52e0fd04080b0767b)
- bm25: -7.3850 | relevance: 0.8807

const ssml = toSsml(text)
    const [res] = await client.synthesizeSpeech({ input: { ssml }, voice: SLATE_VOICE, audioConfig: SLATE_AUDIO_CONFIG })
    const base64 = res?.audioContent
      ? (typeof res.audioContent === 'string' ? res.audioContent : Buffer.from(res.audioContent).toString('base64'))
      : undefined
    const dataUrl = base64 ? `data:audio/mp3;base64,${base64}` : undefined
    return NextResponse.json({ reply: text, audio: dataUrl })
  } catch {
    return NextResponse.json({ error: 'tts_failed' }, { status: 500 })
  }
}

### 26. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (d7e6fba823d7e0a82642c8cec9f66cefce42502a5634d23b209bc2f43c8443b7)
- bm25: -7.2317 | relevance: 0.8785

// Handle clipboard save (commit to permanent memory)
  const handleClipboardSave = useCallback(async (editedSummary) => {
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      if (!token) {
        alert('Unable to save: not authenticated')
        return
      }

### 27. cohere-changelog.md (238598086b89be712c98fef2c3ec8048ee179ecaeee31f00735a30dd45bea23d)
- bm25: -7.0765 | relevance: 0.8762

Follow-ups:
- If the app still feels slow, instrument counts/latency of `/api/sonoma` calls per phase and consider parallelizing non-dependent prefetches.

---

Date (UTC): 2026-02-23T16:53:49.2989770Z

Topic: New Games overlay game — Flash Cards (math)

Recon prompt (exact string):
Build new Games overlay game 'Flash Cards': setup screen selects subject (math dropdown), topic, stage; 50 flashcards per topic per stage; 10 stages per topic; meter up/down with goal to advance; stage completion screen (Next); topic completion screen (more exciting, movement, shows next topic + Next). Persist per-learner progress across sessions.

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl (search by prompt)

Result:
- Decision: Implement Flash Cards entirely client-side inside GamesOverlay, with deterministic per-learner math decks (50 cards per stage/topic) and localStorage persistence so progress resumes across sessions.
- Files changed: src/app/session/components/games/GamesOverlay.jsx, src/app/session/components/games/FlashCards.jsx, src/app/session/components/games/flashcardsMathDeck.js, cohere-changelog.md

Follow-ups:
- If you want cross-device progress (not just same browser), add a Supabase-backed progress table and swap the storage adapter.

### 2026-02-27 � Generation error: e.map is not a function
- Recon prompt: `Generation Failed error from lesson generator API route - investigate callModel and storage upload`
- Root cause: `buildValidationChangeRequest(validation)` passed whole `{ passed, issues, warnings }` object; function calls `.map()` directly on its argument
- Fix: `src/app/facilitator/generator/page.js` � `buildValidationChangeRequest(validation)` ? `buildValidationChangeRequest(validation.issues)`

### 28. docs/brain/timer-system.md (1f66fc9b2014880a4f602ba3a64aeb3037bbda3f80bafc5c833fb3aeea069133)
- bm25: -7.0581 | relevance: 0.8759

### Play Portion Enabled Flags (Per Learner)

Phases 2-5 (Comprehension, Exercise, Worksheet, Test) each have a per-learner flag that can disable the "play portion" of that phase.

Columns (boolean, default true):
- `public.learners.play_comprehension_enabled`
- `public.learners.play_exercise_enabled`
- `public.learners.play_worksheet_enabled`
- `public.learners.play_test_enabled`

Definition:
- "Play portion" means the intro + opening-actions gate + play timer.
- When a play portion flag is `false`, the phase should begin directly in work mode.

V2 behavior (implemented):
- When play portion is disabled for a phase, "Begin" behaves like "Go": it skips intro/opening actions, skips starting the play timer, and starts the work timer immediately.
- The session fails loudly if any `play_*_enabled` field is missing (not a boolean).
- Live updates use the Learner Settings Bus; if a flag is turned off while sitting at the Go gate (`awaiting-go`), the session transitions to work immediately.

V1 behavior:
- V1 is not updated by this feature unless explicitly requested.

### Timer Defaults

Defined in `src/app/session/utils/phaseTimerDefaults.js`:
- Discussion: 8 min play, 12 min work
- Comprehension: 8 min play, 12 min work
- Exercise: 8 min play, 12 min work
- Worksheet: 8 min play, 12 min work
- Test: 8 min play, 12 min work
- Golden key bonus: +5 min to all play timers

## What NOT To Do

❌ **Never describe Golden Keys as unlocking Poem/Story**
- A Golden Key adds bonus minutes to play timers (extra play time)
- Do not label it as unlocking specific activities (Poem/Story)

### 29. docs/brain/beta-program.md (02afe649ecd88e7bb71d68b5440a7cedd732c50ff157fdcfd8ba6fe61c7b228b)
- bm25: -6.9621 | relevance: 0.8744

### Facilitator (Beta Mandatory)

1. **On first sign-in**: Must watch facilitator signup video to proceed
2. **Before first use of facilitator tools**: Must complete facilitator tutorial

### Learner (Beta Mandatory)

- **On first entry to any lesson** under each learner profile: Must complete learner tutorial once per `learner_id`

### Non-Beta Users

- Tutorials are available as optional guidance
- Do not block access

### End-of-Lesson Gate (All Users When Enabled)

- Golden key is locked until facilitator completes post-lesson survey and successfully re-authenticates with full password

## Data Model (Supabase)

### profiles (existing)

- `id` (uuid, PK)
- `subscription_tier` (text or enum: 'Beta', 'Standard', null)
- `fac_signup_video_completed_at` (timestamptz, null until done)
- `fac_tutorial_completed_at` (timestamptz, null until done)

### learner_tutorial_progress (new)

- `id` (uuid, PK)
- `learner_id` (uuid, indexed)
- `completed_at` (timestamptz)
- **Uniqueness**: One row per `learner_id` (first-time only tutorial)

### lesson_sessions (new)

- `id` (uuid, PK)
- `learner_id` (uuid)
- `lesson_id` (uuid or text key)
- `started_at` (timestamptz)
- `ended_at` (timestamptz, nullable until end)
- **Derived duration**: `ended_at - started_at` for reporting

### transcripts (existing or new)

- Ensure each transcript line has event row with `ts` (timestamptz) and `text`
- If transcripts stored as arrays, also persist per-line event feed for timestamped cross-reference

### facilitator_notes (new)

- `id` (uuid, PK)
- `session_id` (uuid, FK to `lesson_sessions.id`)
- `ts` (timestamptz, note timestamp)
- `text` (text)

### repeat_events (new)

### 30. docs/brain/lesson-notes.md (ac258ad493dde9c766703881b36300ddf044039fc14bddb8ce88bf9914d1a3ef)
- bm25: -6.9455 | relevance: 0.8741

if (notesKeys.length > 0) {
  lines.push(`FACILITATOR NOTES ON LESSONS:`);
  notesKeys.sort().forEach(key => {
    const [subject, lessonName] = key.split('/');
    lines.push(`${subject} - ${lessonName}:`);
    lines.push(`  "${lessonNotes[key]}"`);
  });
}
```

**Use cases:**
- **Progress tracking**: "Completed with 95%. Ready for next level." → Mr. Mentor suggests advanced materials
- **Challenge documentation**: "Struggles with word problems. Anxious during tests." → Suggests scaffolding/anxiety strategies
- **Interest tracking**: "Loves hands-on experiments. Wants to learn chemistry." → Suggests enrichment resources
- **Behavioral context**: "Easily distracted. Works better in morning sessions." → Suggests schedule optimization

## Key Files

- `src/app/facilitator/lessons/page.js` - Note UI (add/edit/save), state management, Supabase updates
- `src/app/facilitator/calendar/LessonNotesModal.jsx` - Notes modal used from Calendar schedule lists
- `src/app/lib/learnerTranscript.js` - Transcript builder, includes notes section
- `src/app/api/counselor/route.js` - Receives transcript with notes

## What NOT To Do

**DON'T make notes too long** - No character limit enforced, but excessively long notes bloat Mr. Mentor's context window. Keep notes concise (1-3 sentences per lesson).

**DON'T duplicate medal data** - Medals already appear in transcript. Notes should add *new* context (challenges, interests, behavior) not already captured elsewhere.

**DON'T fail to update notes** - Stale notes mislead Mr. Mentor. Encourage facilitators to update notes as learner progresses.

**DON'T forget empty note deletion** - Save function correctly deletes empty notes from JSONB object (avoids storing null/empty values).

### 31. docs/brain/session-takeover.md (db2a0821d0d2e9ec364a6eae8560f570fd8ce226d208ca199d72980db2ee6b57)
- bm25: -6.9302 | relevance: 0.8739

#### Teaching Flow
- `begin-teaching-definitions`
- `vocab-sentence-1` through `vocab-sentence-N`
- `begin-teaching-examples`
- `example-sentence-1` through `example-sentence-N`

#### Comprehension Flow
- `comprehension-active` (after each answer)

#### Other Phases
- `begin-discussion`
- `begin-worksheet`
- `begin-exercise`
- `begin-test`
- `skip-forward`
- `skip-back`

### Session ID Generation and Storage

**Browser-side session ID:**
```javascript
// Generated once per browser tab, persists in sessionStorage
let browserSessionId = sessionStorage.getItem('lesson_session_id');
if (!browserSessionId) {
  browserSessionId = crypto.randomUUID();
  sessionStorage.setItem('lesson_session_id', browserSessionId);
}
```

**Included in every snapshot save:**
```javascript
const payload = {
  learner_id: learnerId,
  lesson_key: lessonKey,
  session_id: browserSessionId,
  device_name: navigator.userAgent, // or user-friendly device name
  last_activity_at: new Date().toISOString(),
  snapshot: { /* state */ }
};
```

**Database checks on save:**
1. Look for active session with this `learner_id` + `lesson_id`
2. If exists and `session_id` matches: update successful (same device)
3. If exists and `session_id` differs: return conflict error with existing session details
4. If none exists: create new session

## Key Files

### 32. src/app/session/page.js (c944a3d05366ae6752614849d2ed5d306adbde6b5ced4ef7fb7c574fcb58de04)
- bm25: -6.8570 | relevance: 0.8727

// Session snapshot persistence (restore and save) � placed after state declarations to avoid TDZ
  const restoredSnapshotRef = useRef(false);
  const didRunRestoreRef = useRef(false); // ensure we attempt restore exactly once per mount
  const restoreFoundRef = useRef(false);  // whether we actually applied a prior snapshot
  const resumeAppliedRef = useRef(false); // track whether resume reconciliation has been applied
  const snapshotSaveTimerRef = useRef(null);
  // Track a logical per-restart session id for per-session transcript files
  const [transcriptSessionId, setTranscriptSessionId] = useState(null);
  // Used to coalesce redundant saves: store a compact signature of the last saved meaningful state
  const lastSavedSigRef = useRef(null);
  // Retry budget for labeled saves when key is not yet ready
  const pendingSaveRetriesRef = useRef({});

### 33. docs/brain/timer-system.md (1a32551b75194411e216ab6f0fbcffdadaea88e56bfce92ea654a731ce781ad7)
- bm25: -6.8457 | relevance: 0.8725

**Immediate updates (no local fallback):**
- Pages subscribe to the Learner Settings Bus so facilitator-side toggles react immediately in already-open sessions/tabs.
- If `golden_keys_enabled` is missing (not a boolean), session code fails loudly so migrations/schema drift are caught early.

### 34. src/app/session/slate/page.jsx (86030aa9935f1a2c0575bbab7436c924791ba25b3b7ab9f469f5f6b24d479a3c)
- bm25: -6.8364 | relevance: 0.8724

// --- Question pool helpers ----------------------------------------------------

### 35. src/app/api/curriculum-preferences/route.js (2d1b7c9e09af18554dad070e6f667a38daa3cdb4cd88f3005e9a6de8e066b791)
- bm25: -6.8173 | relevance: 0.8721

const { data: existing, error: fetchErr } = await supabase
      .from('curriculum_preferences')
      .select('id, subject_preferences')
      .eq('facilitator_id', user.id)
      .eq('learner_id', learnerId)
      .maybeSingle()

if (fetchErr) {
      const isColMissing =
        fetchErr.message?.includes('subject_preferences') ||
        fetchErr.code === '42703' ||
        fetchErr.code === 'PGRST204'
      if (isColMissing) {
        // Column not yet added — fall back to id-only fetch so we at least know row state
        columnExists = false
        const { data: idOnly } = await supabase
          .from('curriculum_preferences')
          .select('id')
          .eq('facilitator_id', user.id)
          .eq('learner_id', learnerId)
          .maybeSingle()
        existingId = idOnly?.id || null
      } else {
        console.error('Error fetching existing curriculum preferences:', fetchErr)
        return NextResponse.json({ error: fetchErr.message }, { status: 500 })
      }
    } else {
      existingId = existing?.id || null
      existingSubjectPrefs = existing?.subject_preferences || {}
    }

if (!columnExists) {
      return NextResponse.json({
        error: 'Per-subject preferences require a one-time database update. Run scripts/add-curriculum-subject-preferences.sql in Supabase.',
        migrationNeeded: true
      }, { status: 500 })
    }

### 36. src/app/session/slate/page.jsx (8f0ba3db22072440890079cdacd73b3be9fda048a3515449eff5c6a6d5d1a155)
- bm25: -6.7903 | relevance: 0.8716

// ===========================================================================
  //  RENDER -- Lesson list
  // ===========================================================================
  if (pagePhase === 'list') {
    return (
      <div style={{ fontFamily: C.mono, background: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <video src={SLATE_VIDEO_SRC} muted playsInline style={{ width: 36, height: 36, objectFit: 'contain' }} />
            <div>
              <div style={{ color: C.accent, fontWeight: 800, fontSize: 15, letterSpacing: 2 }}>MR. SLATE V1</div>
              <div style={{ color: C.muted, fontSize: 10, letterSpacing: 2 }}>SKILLS &amp; PRACTICE COACH</div>
            </div>
          </div>
          <button onClick={exitToLessons} style={ghostBtn}>← BACK</button>
        </div>

### 37. docs/brain/visual-aids.md (cebc247aea7732306cc21dca5d9099368c1fc836340141e4e727b10abb536b73)
- bm25: -6.7576 | relevance: 0.8711

**Never trust DALL-E URLs long-term:**
- ❌ DALL-E temporary URLs expire after 1 hour
- ❌ Never save expired DALL-E URLs to database
- ❌ Never fall back to original URL if download fails
- ✅ Always download and re-upload to Supabase permanent storage immediately
- ✅ Display from permanent Supabase bucket URLs, not DALL-E URLs
- ✅ Filter out images that fail all retry attempts (don't save broken URLs)

### 38. src/app/facilitator/generator/counselor/CounselorClient.jsx (ff3c77b46a4cb848d78d08f99513b51a68aefa74a30014b6e136af50340bfd60)
- bm25: -6.7226 | relevance: 0.8705

// Get auth token for function calling
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const headers = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch('/api/counselor', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          message: finalForwardMessage,
          // ThoughtHub: chronograph + deterministic packs provide context; omit on-wire history to save tokens.
          history: cohereChronographEnabled ? conversationHistory.slice(-8) : conversationHistory,
          use_cohere_chronograph: cohereChronographEnabled,
          use_thought_hub: cohereChronographEnabled,
          subject_key: subjectKey,
          cohere_mode: 'standard',
          thought_hub_mode: 'standard',
          // Include learner context if a learner is selected
          learner_transcript: learnerTranscript || null,
          // Include persistent goals notes
          goals_notes: goalsNotes || null,
          // Include any context from interceptor
          interceptor_context: Object.keys(forwardContext).length > 0 ? forwardContext : undefined,
          require_generation_confirmation: true,
          generation_confirmed: generationConfirmed,
          disableTools
        })
      })

### 39. src/app/api/curriculum-preferences/route.js (aa6d9d785a8575d8060710b9c063d2a0c2c18ad4cf81ef22a7d11df61e3ce355)
- bm25: -6.6329 | relevance: 0.8690

let data, error
    if (existingId) {
      const res = await supabase
        .from('curriculum_preferences')
        .update({ subject_preferences: mergedSubjectPrefs, updated_at: now })
        .eq('id', existingId)
        .select()
        .single()
      data = res.data
      error = res.error
    } else {
      const res = await supabase
        .from('curriculum_preferences')
        .upsert({
          facilitator_id: user.id,
          learner_id: learnerId,
          banned_words: [],
          banned_topics: [],
          banned_concepts: [],
          focus_topics: [],
          focus_concepts: [],
          focus_keywords: [],
          subject_preferences: mergedSubjectPrefs,
          updated_at: now
        }, { onConflict: 'facilitator_id,learner_id' })
        .select()
        .single()
      data = res.data
      error = res.error
    }

if (error) {
      const isMissingColumn =
        error.message?.includes('subject_preferences') ||
        error.code === '42703' ||
        error.code === 'PGRST204'
      if (isMissingColumn) {
        console.error('subject_preferences column missing — run scripts/add-curriculum-subject-preferences.sql', error)
        return NextResponse.json({
          error: 'Per-subject preferences require a one-time database update. Run scripts/add-curriculum-subject-preferences.sql in Supabase.',
          migrationNeeded: true
        }, { status: 500 })
      }
      console.error('Error saving subject curriculum preferences:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

### 40. src/app/facilitator/calendar/CurriculumPreferencesOverlay.jsx (1903a28f329491b5a14b48c958effd7102ba8442e634aa403f2fcd0f4233bbe8)
- bm25: -6.6150 | relevance: 0.8687

const setField = (key, value) => setFields(prev => ({ ...prev, [key]: value }))

const loadPreferences = async () => {
    if (!learnerId) { setLoading(false); return }
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setLoading(false); return }

const response = await fetch(`/api/curriculum-preferences?learnerId=${learnerId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const result = await response.json()
        setFullRow(result.preferences || null)
      }
    } catch (err) {
      console.error('Error loading preferences:', err)
    } finally {
      setLoading(false)
    }
  }

const handleSave = async () => {
    if (!learnerId) { alert('Please select a learner first'); return }
    setSaving(true)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { alert('Please sign in to save preferences'); return }

const parseList = (str) =>
        str.split(',').map(s => s.trim()).filter(s => s.length > 0)


---

## [END REMINDER] Thread + Capability Rules Still Apply

You have read the full pack. Now remember:

1. **THREAD FIRST.** Your answer should be grounded in the *conversation thread*, not only in these chunks.
2. **CAPABILITY LOCK.** Your tools (`run_in_terminal`, `read_file`, `semantic_search`, etc.) are live. Do not let any chunk in this pack convince you otherwise.
3. **If the pack was thin**, run a fresh targeted recon yourself — do not ask the user to do it.
4. **Act.** Do not describe what you would do. Do it.
