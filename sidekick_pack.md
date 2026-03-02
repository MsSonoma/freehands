# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
flash cards game keyboard covers game on iPad when keyboard opens
```

Filter terms used:
```text
flash
cards
game
keyboard
covers
game
on
iPad
when
keyboard
opens
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

flash cards game keyboard covers game on iPad when keyboard opens

## Forced Context

(none)

## Ranked Evidence

### 1. cohere-changelog.md (93e65a8af97333c36619803164a58725c36d5221593c9be0874f40fc6941fcd8)
- bm25: -27.8177 | relevance: 1.0000

Follow-ups:
- None (takeover enforces a single active session per account).

---

Date (UTC): 2026-02-23T17:37:08.8912021Z

Topic: Flash Cards visual polish (portrait card + slide animation)

Recon prompt (exact string):
Flash Cards game: make the card look like a real vertical flashcard and add a simple slide-in/slide-out animation between cards. Find existing animation/style patterns in the session UI and confirm where FlashCards is rendered.

Key evidence:
- sidekick_pack: sidekick_pack.md

Result:
- Updated the card UI to a tall portrait âflash cardâ and added a lightweight slide-out/slide-in transition when advancing cards.
- Files changed: src/app/session/components/games/FlashCards.jsx, cohere-changelog.md

---

Date (UTC): 2026-02-23T18:07:12.8146173Z

Topic: Flash Cards meter decay (stage-scaled time pressure)

Recon prompt (exact string):
Flash Cards game: add gradual meter degradation over time on the card screen; decay rate increases with stage. Find current meter logic in FlashCards.jsx and implement an interval/timer consistent with existing patterns.

Key evidence:
- sidekick_pack: sidekick_pack.md

Result:
- Added a meter decay interval while on the card screen; decay speeds up as stage increases, creating a variable time limit.
- Smoothed meter width changes via a short CSS transition so the bar glides left.
- Files changed: src/app/session/components/games/FlashCards.jsx, cohere-changelog.md

---

Date (UTC): 2026-02-23T21:02:07.7947459Z

Topic: Flash Cards meter decay fix (smooth tick-down + beatable)

Issue:
- Decay felt like it âwaits then clears entirelyâ and made stages effectively unbeatable.

### 2. docs/brain/platform-jumper.md (7caf44efa572f22fa67617302787b5bd0614f14c56a964f6bd0bce09734cca91)
- bm25: -26.8907 | relevance: 1.0000

# Platform Jumper (#platform-jumper)

## How It Works

Platform Jumper is a small in-session game rendered by a single client component.

The player moves and jumps using a simple velocity + gravity loop:

- `playerPos` holds the current position in game coordinates.
- `playerVelocity` holds the current velocity.
- Gravity (`GRAVITY`) accelerates downward each tick.
- Jumping sets an immediate upward `y` velocity.

Jump types:

- Normal jump uses `JUMP_STRENGTH` (negative y velocity).
- Trampoline jump uses `TRAMPOLINE_BOUNCE` when the current platform has `trampoline: true`.

Practical beatability note:

- With the current physics, trampoline bounce height is finite; avoid placing required landing platforms too close to the top of the screen unless there is an intermediate trampoline/platform.

Level layouts:

- Levels are declared in the `levels` object; keys are level numbers.
- Each level has a `platforms` array (rectangles) plus `startPos` and `goalArea`.
- Coordinates use game space: `x` increases to the right, `y` increases downward.
- Reference size: `GAME_WIDTH = 800`, `GAME_HEIGHT = 500`.
- A movement like "raise 15%" means subtract `0.15 * GAME_HEIGHT` from `y`.
- A movement like "move left 20%" means subtract `0.20 * GAME_WIDTH` from `x`.
- For beatability gaps between trampolines, prefer adding a single intermediate trampoline before changing global physics (example: Level 37 bridge).

Input:

- Keyboard: arrow keys move; Space jumps.
- Touch: left/right controls set movement; jump uses the shared `performJump` logic.

Scaling:

- The game scales to fit available viewport space using a calculated `scale` based on `GAME_WIDTH`/`GAME_HEIGHT`.

PIN-gated settings:

### 3. src/app/session/components/games/GamesOverlay.jsx (e58cc08e2f4da1c2eea41dd560fcdccf25f88f8a0daad3a853f89919bfec5882)
- bm25: -23.6843 | relevance: 1.0000

// Active game screen
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#fff',
        zIndex: 20000,
        overflow: 'auto',
      }}
    >
      {/* Play timer in upper left */}
      {playTimer && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: 16,
            zIndex: 10001,
          }}
        >
          {playTimer}
        </div>
      )}

{/* Render the selected game */}
      {selectedGame === 'memory-match' && (
        <MemoryMatch onExit={() => setSelectedGame(null)} />
      )}
      {selectedGame === 'snake' && (
        <Snake onExit={() => setSelectedGame(null)} />
      )}
      {selectedGame === 'catch-collect' && (
        <CatchCollect onBack={() => setSelectedGame(null)} />
      )}
      {selectedGame === 'maze-runner' && (
        <MazeRunner onBack={() => setSelectedGame(null)} />
      )}
      {selectedGame === 'whack-a-mole' && (
        <WhackAMole onBack={() => setSelectedGame(null)} />
      )}
      {selectedGame === 'platform-jumper' && (
        <PlatformJumper onBack={() => setSelectedGame(null)} />
      )}
      {selectedGame === 'flood-climb' && (
        <FloodClimbSpelling onBack={() => setSelectedGame(null)} />
      )}
      {selectedGame === 'flash-cards' && (
        <FlashCards onBack={() => setSelectedGame(null)} />
      )}
    </div>
  );
}

### 4. cohere-changelog.md (dd6e6ae5707d3e124658ca52a34f2bbd182750903ae093c250f5ee263693b25c)
- bm25: -21.3058 | relevance: 1.0000

Follow-ups:
- If this still reproduces, log the restored `snap.currentTimerMode`, `snap.timerSnapshot`, and which key was drift-corrected to confirm which mode was captured at save time.

---

Date (UTC): 2026-02-22T19:03:42.3423235Z

Topic: App slowness from unnecessary base64 audio payloads

Recon prompt (exact string):
Performance: the entire freehands app feels extremely slow / barely works. Identify likely bottlenecks (Next.js App Router, session page, API routes like /api/sonoma), and where to instrument or optimize. Focus on critical path on initial load.

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl (search by prompt)

Result:
- Decision: Add `skipAudio: true` to `/api/sonoma` calls that only need text (story summaries/suggestions/poems/story generation in Opening Actions), since speech is performed separately via `/api/tts` (`speakFrontend` / `audioEngine.speak`). This avoids server-side TTS + large base64 audio responses on the critical path.
- Files changed: src/app/session/hooks/useDiscussionHandlers.js, src/app/session/v2/OpeningActionsController.jsx, cohere-changelog.md

Follow-ups:
- If the app still feels slow, instrument counts/latency of `/api/sonoma` calls per phase and consider parallelizing non-dependent prefetches.

---

Date (UTC): 2026-02-23T16:53:49.2989770Z

Topic: New Games overlay game â Flash Cards (math)

Recon prompt (exact string):
Build new Games overlay game 'Flash Cards': setup screen selects subject (math dropdown), topic, stage; 50 flashcards per topic per stage; 10 stages per topic; meter up/down with goal to advance; stage completion screen (Next); topic completion screen (more exciting, movement, shows next topic + Next). Persist per-learner progress across sessions.

### 5. src/app/session/v2/SessionPageV2.jsx (66736f778361c860e5930737bf7c4d2b04bd8aa0fc7b9cef3a57fd431d1d692e)
- bm25: -20.0002 | relevance: 1.0000

timerServiceRef.current.setPlayTimerLimits({
      comprehension: m2s(phaseTimers.comprehension_play_min) + playBonusSec,
      exercise: m2s(phaseTimers.exercise_play_min) + playBonusSec,
      worksheet: m2s(phaseTimers.worksheet_play_min) + playBonusSec,
      test: m2s(phaseTimers.test_play_min) + playBonusSec
    });
  }, [phaseTimers, goldenKeyBonus, goldenKeysEnabled]);
  
  // Initialize KeyboardService
  useEffect(() => {
    if (!eventBusRef.current) return;
    
    const eventBus = eventBusRef.current;
    
    // Forward hotkey events
    const unsubHotkey = eventBus.on('hotkeyPressed', (data) => {
      handleHotkey(data);
    });
    
    const keyboard = new KeyboardService(eventBus);
    
    keyboardServiceRef.current = keyboard;
    keyboard.init();
    
    return () => {
      keyboard.destroy();
      keyboardServiceRef.current = null;
    };
  }, []);
  
  const addEvent = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setEvents(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 15));
  };

### 6. src/app/session/components/games/GamesOverlay.jsx (15dbcea69870646e196b5d308568b9c0e7ff1da1c93d4c9161d65e632f734729)
- bm25: -17.5487 | relevance: 1.0000

{/* Games list */}
          <div
            style={{
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {gamesList.map((game) => (
              <button
                key={game.id}
                onClick={() => setSelectedGame(game.id)}
                style={{
                  background: '#f9fafb',
                  border: `2px solid ${game.color}`,
                  borderRadius: 12,
                  padding: 20,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                }}
              >
                <div
                  style={{
                    fontSize: 48,
                    lineHeight: 1,
                  }}
                >
                  {game.icon}
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: '#1f2937',
                      marginBottom: 4,
                    }}
                  >
                    {game.name}

### 7. docs/brain/games-overlay.md (3d69f6755dd3a8792771418e6e2fe533bcaad2786166bfa293915f77a4ff8f9d)
- bm25: -17.2402 | relevance: 1.0000

# Games Overlay (#games-overlay)

**Status**: Canonical  
**Last Updated**: 2026-01-13T00:59:23Z

## How It Works

Games are launched from the in-session **Games overlay**.

- The session pages (V1 and V2) open `GamesOverlay` during play time.
- `GamesOverlay` renders a full-screen modal experience:
  - A game picker menu (list of games)
  - A full-screen active-game view
- A play timer badge (rendered by `SessionTimer`) is optionally passed in and displayed at the top-left.

**Click parity:** If the timer badge is present, it should remain interactive (cursor + click) so the facilitator can open `TimerControlOverlay` from within the Games overlay (PIN-gated), matching the rest of the session.

### Difficulty and Grade

The Games overlay does **not** own a global difficulty setting.

- If a specific game needs grade-driven difficulty, that game should present its own grade selector (or other difficulty control) inside the game UI.
- Games may optionally initialize their own difficulty from the currently selected learner profile (when the game is launched), but that choice must remain scoped to the game.

### Props

`GamesOverlay` accepts:
- `onClose`: closes the overlay
- `playTimer`: a React node (typically `SessionTimer`) rendered as a badge

## What NOT To Do

- Do not add an overlay-wide difficulty selector unless explicitly requested.
- Do not store or persist Games settings to localStorage as a fallback.
- Do not couple Games overlay state to Ms. Sonoma prompt/state; games are independent UI.

## Key Files

- `src/app/session/components/games/GamesOverlay.jsx`
- `src/app/session/page.js` (V1 integration)
- `src/app/session/v2/SessionPageV2.jsx` (V2 integration)

### 8. docs/brain/session-takeover.md (f547b8a84945c079f4753cfc178e83afd5ab0d6acc67018afbe877b3d81da9b9)
- bm25: -17.2029 | relevance: 1.0000

## Why We Use Gates (and Sometimes Polling)

**Gates are the primary mechanism:**
- Conflict is detected exactly at meaningful checkpoints (Begin and snapshot saves).
- This aligns with persistence writes and avoids background chatter.

**Polling is secondary and optional:**
- Polling can improve UX by discovering a takeover/end even when the learner is idle.
- Keep it low-frequency and read-only, and only while a session is active.

## Device Switch Flow Example

**Scenario:** Learner starts lesson on iPad, switches to laptop mid-teaching

1. **iPad - Teaching vocab sentence 3**
   - User clicks Next
   - Gate: `scheduleSaveSnapshot('vocab-sentence-3')`
   - Snapshot saved with `session_id: "abc-123-ipad"`, timer at 45 seconds
   - Success

2. **Laptop - Opens same lesson**
   - Page loads, generates new `session_id: "xyz-789-laptop"`
   - User clicks Begin
   - Gate: `scheduleSaveSnapshot('begin-discussion')`
   - Database detects conflict (iPad session "abc-123-ipad" still active)
   - Returns conflict error with iPad session details

3. **Laptop - Takeover dialog shows**
   - "A session for this lesson is active on another device (iPad)"
   - "Last activity: 2 minutes ago"
   - "Enter 4-digit PIN to take over"
   - User enters PIN

4. **Laptop - PIN validated**
   - Clear localStorage (force database restore)
   - Deactivate iPad session "abc-123-ipad" (set ended_at)
   - Create new session "xyz-789-laptop"
   - Restore snapshot from database (vocab-sentence-3 checkpoint)
   - Extract timer state: 45 seconds + (now - capturedAt) = ~47 seconds
   - Set timer to 47 seconds, mode 'work'
   - Resume teaching at vocab sentence 3
   - Apply teaching flow snapshot (vocab index, stage, etc.)

### 9. docs/brain/flood-climb-spelling.md (632422d834fc3ead2e54d0c5f015a851978cc243800fcc58da233e1f9df54f46)
- bm25: -16.0788 | relevance: 1.0000

# Flood Climb Spelling Game (#flood-climb-spelling)

**Status**: Canonical  
**Last Updated**: 2026-01-13T03:35:15Z

## How It Works

Flood Climb is a time-pressure spelling game inside the Games overlay.

- The player sees an emoji prompt (example: 🐮).
- The game also shows a scrambled-letter hint for the target word.
- The prompt is shown in-stage in the "sky" area (right of the rock wall).
- The rock wall uses a non-repeating polygon SVG texture (asymmetrical facets; no round blobs) with a flat, cool stone palette to match the climber rock.
- The rock wall uses the SVG palette directly (no CSS tint overlay).
- The SVG URL is cache-busted so palette tweaks show up immediately during dev.
- The "How to play" instructions are also shown in the sky area before Start.
- Win/lose messaging and the "Play Again" / "Next Level" actions also render in that same sky area.
- The player types the matching word (example: "cow") and submits (Enter or Submit).
- The input placeholder reads "Type your answer and press Enter."
- The standalone instruction line above the input is not shown.
- Clicking in-game buttons should not steal focus from the input during play.
- Score accumulates across levels and across runs during the session.
- Correct answers move the climber upward.
- Wrong answers cause the water level to jump upward.
- The water also rises continuously over time.
- The climber renders behind the water, so submerging looks underwater.
- The climber is slightly inset from the rock wall for visibility.
- The player loses when the water reaches the climber's head.
- The player wins by reaching the top zone before the water catches them.

### Level Progression (Game-Scoped)

Difficulty is owned by this game (not by the Games overlay).

### 10. src/app/session/components/games/GamesOverlay.jsx (f7b93685a61b7cfe578ae117fcc8c87cfdf1623230d58a53e84404a54c276092)
- bm25: -15.7997 | relevance: 1.0000

{/* Header */}
          <div
            style={{
              padding: '24px 24px 16px',
              borderBottom: '2px solid #e5e7eb',
              textAlign: 'center',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 800,
                color: '#1f2937',
              }}
            >
              🎮 Choose a Game
            </h2>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 16,
                color: '#6b7280',
              }}
            >
              Pick a game to play as your reward!
            </p>
          </div>

### 11. docs/brain/platform-jumper.md (99d8d1f6d607b81bae89af7c3a7f30bb039f068629132e278dee5a3ba03be196)
- bm25: -14.6363 | relevance: 1.0000

## What NOT To Do

- Do not add compatibility fallbacks for missing state; keep physics/state explicit.
- Do not change jump logic separately for touch vs keyboard; both must call the same jump function.
- Do not make trampoline behavior implicit; trampoline boost must be controlled by the `trampoline` flag on platforms.
- Avoid large physics changes (gravity, speed, jump) without validating level beatability.
- Avoid editing multiple level elements at once when fixing a single-beatability issue; move one platform, then re-check.

## Key Files

- `src/app/session/components/games/PlatformJumper.jsx`

### 12. docs/brain/flood-climb-spelling.md (236e3ac8a9612c32cbbd04f089b1ef7260b0e1cf276cd3200afd859af05644c4)
- bm25: -14.0805 | relevance: 1.0000

The game uses numbered levels (Level 1 .. Level 20). Levels are not labeled.
The level selector defaults to Level 1 (no placeholder option).

### 13. docs/brain/flood-climb-spelling.md (cd2bc0ac77d08c2d99330dacc03e08685639e9ec766a374661ebb95c861ad2e9)
- bm25: -14.0699 | relevance: 1.0000

The level controls:
- The word deck used for prompts (higher levels use harder-to-spell words)
- Water rise rate (higher level = faster)
- Climb amount per correct answer (higher level = smaller climb)
- Water penalty on wrong answers (higher level = bigger penalty)

Notes:
- The game includes a short start delay before the water begins rising.
- Starting positions provide a playable buffer so players are not forced to type instantly.

## What NOT To Do

- Do not add an overlay-wide difficulty selector to support this game.
- Do not persist the level selection via localStorage as a fallback.
- Do not require learner profile plumbing through `GamesOverlay` unless explicitly requested.

## Key Files

- `src/app/session/components/games/FloodClimbSpelling.jsx`
- `src/app/session/components/games/GamesOverlay.jsx`
- `public/media/flood-climb-rockwall.svg`

### 14. src/app/session/components/games/GamesOverlay.jsx (066072b09634e20c5d4b759980b76b47fedebc75f211edfcac86d1fcca6c8571)
- bm25: -13.8459 | relevance: 1.0000

const gamesList = [
    {
      id: 'memory-match',
      name: 'Memory Match',
      description: 'Find matching pairs of cards',
      icon: '🎴',
      color: '#10b981',
    },
    {
      id: 'snake',
      name: 'Snake',
      description: 'Eat food and grow longer!',
      icon: '🐍',
      color: '#8b5cf6',
    },
    {
      id: 'catch-collect',
      name: 'Catch & Collect',
      description: 'Catch falling items with your basket!',
      icon: '🧺',
      color: '#f59e0b',
    },
    {
      id: 'maze-runner',
      name: 'Maze Runner',
      description: 'Navigate through the maze to the flag!',
      icon: '🏁',
      color: '#ef4444',
    },
    {
      id: 'whack-a-mole',
      name: 'Whack-a-Mole',
      description: 'Click the moles before they hide!',
      icon: '🦫',
      color: '#06b6d4',
    },
    {
      id: 'platform-jumper',
      name: 'Platform Jumper',
      description: 'Jump across platforms to reach the trophy!',
      icon: '🏆',
      color: '#ec4899',
    },
    {
      id: 'flood-climb',
      name: 'Flood Climb',
      description: 'Spell the emoji word to climb to safety!',
      icon: '🌊',
      color: '#3b82f6',
    },
    {
      id: 'flash-cards',
      name: 'Flash Cards',
      description: 'Answer cards to level up stages',
      icon: '🃏',
      color: '#111827',
    },
    // Future games will go here
  ];

### 15. docs/brain/timer-system.md (42aa7c76a1e732a4ec83b46c76f7214efa5fa927819ed9a691f311cae452a2df)
- bm25: -13.6991 | relevance: 1.0000

**Rule (single instance):** Only one `SessionTimer` instance should be mounted at a time for a given `{lessonKey, phase, mode}`.
- Mounting two `SessionTimer` components simultaneously can show brief 1-second drift when `SessionTimer` is in self-timing mode.
- In Session V2, when the Games overlay is open, the on-video timer is not rendered; the Games overlay renders the timer instead.

**Rule (click parity):** Clicking the timer badge in the Games overlay must behave the same as clicking the timer during the rest of the session: it opens `TimerControlOverlay` (PIN-gated).
- The timer badge must be a `SessionTimer` with `onTimerClick` wired to the same handler used by the main session timer.

### Overlay Stacking (V2)

Games and Visual Aids overlays must render above the timeline and timer overlays.
- Timeline must not use an extremely high `zIndex`.
- Full-screen overlays should use a higher `zIndex` than the on-video timer.

**TimerControlOverlay vs GamesOverlay:** If the facilitator opens `TimerControlOverlay` while the Games overlay is open, `TimerControlOverlay` must render above `GamesOverlay` so it is visible and usable.

**PlayTimeExpiredOverlay must be above GamesOverlay:**
- `PlayTimeExpiredOverlay` is a full-screen, blocking overlay. It must have a higher `zIndex` than `GamesOverlay` so the 30-second countdown cannot appear behind a running game.

### PIN Gating (V2)

Timer controls that can change session pacing are PIN-gated:
- Opening the TimerControlOverlay is gated by `ensurePinAllowed('timer')`.
- Pause/resume toggles are gated by `ensurePinAllowed('timer')`.

Timeline jumps are also PIN-gated (see pin-protection.md action `timeline`).

### Play Time Expiration Flow

When play timer reaches 00:00:

### 16. docs/brain/platform-jumper.md (9a339a36391a029463f0f74ab945ebd04f3f2fc372d017cf1b0928812f34f96c)
- bm25: -13.5312 | relevance: 1.0000

- On the start screen (under the "Start Level" button) there is a settings (gear) button.
- Clicking the gear calls `ensurePinAllowed('skip')`.
- If allowed, the game shows a small dialog that lets the facilitator pick a level to jump to.
- Skipping resets gameplay state (`gameStarted`, `gameWon`, `gameLost`, velocity/grounding) and sets `playerPos` to the target level's `startPos`.

### 17. src/app/session/components/games/FlashCards.jsx (a9dc52302f19bd51e3d7680b5c14aefd7d026b8b0aa02fd1549e4896c13a648a)
- bm25: -13.3586 | relevance: 1.0000

<div style={headerRow}>
          <button type="button" style={softBtn} onClick={onBack}>← Back</button>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#111827' }}>Flash Cards</div>
          <div style={{ width: 90 }} />
        </div>

### 18. src/app/session/components/games/FlashCards.jsx (eca4d5f6ae2739ca4f212624a289bc316ae8fffc477b8d031d78bd4fd53d6114)
- bm25: -12.9291 | relevance: 1.0000

if (screen === 'setup') {
    return (
      <div style={frame}>
        <div style={headerRow}>
          <button type="button" style={softBtn} onClick={onBack}>← Back</button>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#111827' }}>Flash Cards</div>
          <div style={{ width: 90 }} />
        </div>

### 19. src/app/session/components/games/FlashCards.jsx (7e38e3c0b9df4de14e14205a10f230934fc06cddd160008c7210f3a3998cc0b9)
- bm25: -12.8700 | relevance: 1.0000

if (screen === 'stage-complete') {
    return (
      <div style={frame}>
        <div style={headerRow}>
          <button type="button" style={softBtn} onClick={onBack}>← Back</button>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#111827' }}>Flash Cards</div>
          <div style={{ width: 90 }} />
        </div>

### 20. src/app/facilitator/account/page.js (424d7e064b512135160a762d0e5d1aff7cdc0949854f0c32250911e6bbe54989)
- bm25: -12.1474 | relevance: 1.0000

{/* Hotkeys */}
            <div
              onClick={() => setActiveOverlay('hotkeys')}
              style={cardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
                e.currentTarget.style.borderColor = '#9ca3af'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                e.currentTarget.style.borderColor = '#e5e7eb'
              }}
            >
              <div style={iconStyle}>⌨️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: '#374151', marginBottom: 2 }}>Hotkeys</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>Customize keyboard shortcuts</div>
              </div>
            </div>

### 21. src/app/facilitator/hotkeys/page.js (011cc64e1e65e70eb1e6e0cd4f65a2ec71f6849883b78f1c3a4db7115b77b140)
- bm25: -12.0828 | relevance: 1.0000

"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensurePinAllowed } from '@/app/lib/pinGate';
import HotkeysManager from '@/components/HotkeysManager'

export default function FacilitatorHotkeysPage() {
  const router = useRouter();
  const [pinChecked, setPinChecked] = useState(false);

// Check PIN requirement on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const allowed = await ensurePinAllowed('facilitator-page');
        if (!allowed) {
          router.push('/');
          return;
        }
        if (!cancelled) setPinChecked(true);
      } catch (e) {
        if (!cancelled) setPinChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

if (!pinChecked) {
    return <main style={{ padding: 20 }}><p>Loading…</p></main>;
  }

return (
    <main style={{ padding: 20 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:12 }}>
        <h1 style={{ fontSize:24, fontWeight:800 }}>Hotkeys</h1>
      </div>
      <p style={{ color:'#6b7280', marginBottom:8 }}>Customize your keyboard shortcuts. These save to your account when possible and also locally.</p>
      <div style={{ border:'1px solid #e5e7eb', borderRadius:12, padding:8 }}>
        <HotkeysManager />
      </div>
    </main>
  )
}

### 22. src/app/facilitator/learners/components/AIFeaturesOverlay.js (8a0f5982dadaec3ff6c3348c296e3838eefba938f45a4a71dedefcf68f8b7107)
- bm25: -12.0247 | relevance: 1.0000

{/* Fill-in-Fun Feature */}
					<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
						<div>
							<div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: 4 }}>
								Fill-in-Fun Feature
							</div>
							<div style={{ fontSize: '0.9rem', color: '#666' }}>
								Mad libs style creative game with content safety
							</div>
						</div>
						<button
							onClick={() => setFillInFunDisabled(!fillInFunDisabled)}
							style={toggleButtonStyle(fillInFunDisabled)}
						>
							{fillInFunDisabled ? '🚫 Disabled' : '✅ Enabled'}
						</button>
					</div>
				</div>

### 23. cohere-changelog.md (feeda18a04f23263202dd5d2da3b92defec989d6ff6f2bdddc55380a3638cbe4)
- bm25: -11.3610 | relevance: 1.0000

---

Date (UTC): 2026-02-18T17:44:15.770Z

Topic: Fix recon auto-catch scripts (PowerShell 5.1 + meaningful anchor checks)

Recon prompt (exact string):
Fix scripts/cohere-recon.ps1 to run on Windows PowerShell 5.1 (no PS7-only syntax), implement auto-catch recon failure via anchor scoring, auto-ingest, optional gap note, and audit log.

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl (search by prompt)

Result:
- Decision: Fix PowerShell parsing issues caused by backticks in double-quoted regex strings; make anchor scoring meaningful by ignoring prompt/filter/question metadata (and pack self-citations) so âsuspiciousâ can actually trigger; make gap-note helper PS5.1 compatible.
- Files changed: scripts/cohere-recon.ps1, scripts/cohere-gap-note.ps1, cohere-changelog.md

Follow-ups:
- If we want stronger detection, add an optional manual `-Expect` list (high-value anchors) and require a minimum hit-rate (e.g., >= 30%).

---

Date (UTC): 2026-02-23T17:13:02.2543565Z

Topic: Flash Cards progress sync across devices/browsers

Recon prompt (exact string):
Flash Cards progress across all devices and browsers: locate the existing Supabase learner-scoped persistence patterns (tables, RLS, upsert/read helpers) used by sessionSnapshotStore/SnapshotService, then outline how to implement the same for flashcards progress.

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl (search by prompt)

### 24. docs/brain/v2-architecture.md (c2951fa25d44e4fc0435acc27bd610e877cb0bb0b1da4921680892c9bd47fa32)
- bm25: -11.1627 | relevance: 1.0000

**Worksheet/Test:** Worksheet and Test follow the same no-skip rule. Missing targets or empty pools must block with a clear error instead of auto-advancing to the next phase.
- The "Go" control in the Opening Actions footer must call the inline Exercise Go handler (not an ExercisePhase controller).
- Keyboard skip for Exercise should route to the inline skip handler, which advances to the next question and preserves the hint/hint/reveal attempt tracking.
- Worksheet question normalization must preserve provided `sourceType`/`type` so MC/TF items stay MC/TF (local judging, quick buttons). Only plain string questions should default to fill-in-blank.

### 25. src/app/session/hooks/useDiscussionHandlers.js (7be01249aa3dede88fdd9756fbda8fd5fed5a2c477980961af851344d51ff9f9)
- bm25: -11.1416 | relevance: 1.0000

/**
 * useDiscussionHandlers.js
 * Custom hook managing all Discussion phase interactive features:
 * - Jokes
 * - Riddles (with hint/reveal)
 * - Poems
 * - Stories (collaborative storytelling)
 * - Fill-in-Fun (word game similar to Mad Libs)
 * - Ask Questions (learner can ask Ms. Sonoma questions)
 */

import { useCallback } from 'react';
import { splitIntoSentences, mergeMcChoiceFragments, enforceNbspAfterMcLabels } from '../utils/textProcessing';
import { normalizeBase64Audio } from '../utils/audioUtils';
import { ensureQuestionMark, formatQuestionForSpeech } from '../utils/questionFormatting';
import { pickNextJoke, renderJoke } from '@/app/lib/jokes';
import { pickNextRiddle, renderRiddle } from '@/app/lib/riddles';
import { getGradeAndDifficultyStyle } from '../utils/constants';

### 26. docs/brain/session-takeover.md (60c9d4cd0ab0fea91764faad1891a96fb7c304045c5c530242436be8f9fdd5f4)
- bm25: -10.7981 | relevance: 1.0000

5. **iPad - Next gate attempt**
   - User clicks Next (or any action triggering gate)
   - Gate: `scheduleSaveSnapshot('vocab-sentence-4')`
   - Database returns "session ended" error
   - Show notification: "Lesson continued on laptop"
   - Redirect to learner dashboard (or show Resume option for laptop)

### 27. src/app/session/v2/SessionPageV2.jsx (0b4286f1a64628f23ef5951a07a7963ed09877e14b6a3bfce1a157394dbc846e)
- bm25: -10.7161 | relevance: 1.0000

try {
        engine.on?.('end', onEnd);
      } catch {
        // If we cannot subscribe, fall back to delayed start.
        deferClosingStartUntilAudioEndRef.current = false;
        setTimeout(() => phase.start(), 500);
      }
      return;
    }

phase.start();
  };
  
  // Handle keyboard hotkeys
  const handleHotkey = (data) => {
    const { action, phase, key } = data;
    
    addEvent(`âŒ¨ï¸ Hotkey: ${key} (${action})`);
    
    // Handle phase-specific actions
    if (action === 'skip') {
      if (phase === 'teaching') {
        skipSentence();
      } else if (phase === 'discussion') {
        skipDiscussion();
      } else if (phase === 'comprehension') {
        skipComprehension();
      } else if (phase === 'exercise') {
        skipExerciseQuestion();
      } else if (phase === 'worksheet') {
        skipWorksheetQuestion();
      } else if (phase === 'test') {
        skipTestQuestion();
      }
    } else if (action === 'repeat' && phase === 'teaching') {
      repeatSentence();
    } else if (action === 'next' && phase === 'teaching') {
      nextSentence();
    } else if (action === 'pause') {
      // Toggle pause/resume
      if (audioEngineRef.current) {
        const state = audioEngineRef.current.state;
        if (state === 'playing') {
          pauseAudio();
        } else if (state === 'paused') {
          resumeAudio();
        }
      }
    } else if (action === 'stop') {
      stopAudio();
    }
  };
  
  const startSession = async (options = {}) => {
    if (!orchestratorRef.current) {
      console.warn('[SessionPageV2] No orchestrator');
      return;
    }
    
    if (!audioEngineRef.current) {
      console.error('[SessionPageV2] Audio engine not ready');
      return;
    }

### 28. src/app/session/page.js (dedf2f008fa5192ca5f78b94d1d52ced408f2858b2be94b712db6be350d54b4e)
- bm25: -10.6620 | relevance: 1.0000

// Helper to get the current phase name from phase state
  const getCurrentPhaseName = useCallback(() => {
    // Map phase state to phase timer key
    // Teaching phase uses discussion timer (they're grouped together)
    if (phase === 'discussion' || phase === 'teaching') return 'discussion';
    if (phase === 'comprehension') return 'comprehension';
    if (phase === 'exercise') return 'exercise';
    if (phase === 'worksheet') return 'worksheet';
    if (phase === 'test') return 'test';
    return null;
  }, [phase]);

// Check if we're currently in play or work mode
  const isInPlayMode = useCallback(() => {
    const currentPhase = getCurrentPhaseName();
    if (!currentPhase) return false;
    return currentTimerMode[currentPhase] === 'play';
  }, [getCurrentPhaseName, currentTimerMode]);

// Handle timer time-up callback (determines if play or work timer expired)
  const handlePhaseTimerTimeUp = useCallback(() => {
    const currentPhase = getCurrentPhaseName();
    if (!currentPhase) return;
    
    const mode = currentTimerMode[currentPhase];
    if (mode === 'play') {
      handlePlayTimeUp(currentPhase);
    } else if (mode === 'work') {
      handleWorkTimeUp(currentPhase);
    }
  }, [getCurrentPhaseName, currentTimerMode, handlePlayTimeUp, handleWorkTimeUp]);

// Reset opening actions visibility on begin and on major phase changes
  useEffect(() => {
    if (phase === 'discussion' && subPhase === 'unified-discussion') {
      setShowOpeningActions(false);
      // Game usage gates removed - games are now repeatable during play time
      // Story persists across phases - don't reset or clear transcript
      // Only clear story when starting a completely new session
    }
  }, [phase, subPhase]);

### 29. cohere-changelog.md (4f71f7de200141f488aba8601ec66b31064a2b7bb9f8bfe745edd889c88f1560)
- bm25: -10.6432 | relevance: 1.0000

Result:
- Decision: Implement Flash Cards entirely client-side inside GamesOverlay, with deterministic per-learner math decks (50 cards per stage/topic) and localStorage persistence so progress resumes across sessions.
- Files changed: src/app/session/components/games/GamesOverlay.jsx, src/app/session/components/games/FlashCards.jsx, src/app/session/components/games/flashcardsMathDeck.js, cohere-changelog.md

Follow-ups:
- If you want cross-device progress (not just same browser), add a Supabase-backed progress table and swap the storage adapter.

### 2026-02-27  Generation error: e.map is not a function
- Recon prompt: `Generation Failed error from lesson generator API route - investigate callModel and storage upload`
- Root cause: `buildValidationChangeRequest(validation)` passed whole `{ passed, issues, warnings }` object; function calls `.map()` directly on its argument
- Fix: `src/app/facilitator/generator/page.js`  `buildValidationChangeRequest(validation)` ? `buildValidationChangeRequest(validation.issues)`

### 2026-02-27  Lesson generated with warnings / Missing file or changeRequest
- Root cause: generator sent `changes` in POST body but `/api/facilitator/lessons/request-changes` destructures `changeRequest`  
- Fix: `src/app/facilitator/generator/page.js`  renamed field `changes` ? `changeRequest` in request body

### 30. src/app/session/components/games/GamesOverlay.jsx (2112e811927bb34680ad0bc7aa885859d39794b54cd4be48aaabb957d4963fef)
- bm25: -10.4927 | relevance: 1.0000

// Game selection menu
  if (!selectedGame) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          zIndex: 20000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 16,
            maxWidth: 600,
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            position: 'relative',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Play timer in upper left */}
          {playTimer && (
            <div
              style={{
                position: 'absolute',
                top: 16,
                left: 16,
                zIndex: 10001,
              }}
            >
              {playTimer}
            </div>
          )}

### 31. docs/brain/pin-protection.md (099075fb976b0dc884d23cec569d3b693ff409180962ef058793b7f53217859f)
- bm25: -9.3677 | relevance: 1.0000

Session surfaces that mutate session state should gate with `ensurePinAllowed(action)` before performing the action.

**Session V2 (timeline + timer controls):**
- Timeline jumps call `ensurePinAllowed('timeline')` before switching phases.
- Timer controls call `ensurePinAllowed('timer')` before opening the timer control overlay and before pause/resume toggles.

**Games (example: Platform Jumper):**
- Facilitator-only game shortcuts (like skipping to a level) must call `ensurePinAllowed('skip')` before opening any level picker.

### Facilitator Section Flag

**Purpose**: Prevent double PIN prompts when navigating between facilitator pages

**How it works**:
1. Flag is stored in `sessionStorage` (cleared when browser tab closes)
2. When `ensurePinAllowed('facilitator-page')` succeeds, it sets the flag
3. Subsequent `facilitator-page` checks skip PIN if flag is already set
4. Flag is cleared when user navigates away from `/facilitator/*` routes

### Navigation Flow (Session → Facilitator)

**Before Fix (Double PIN Prompt)**:
1. User clicks Facilitator link from session page
2. HeaderBar calls `ensurePinAllowed('session-exit')` → prompts for PIN
3. Navigation to `/facilitator` happens
4. Facilitator page calls `ensurePinAllowed('facilitator-page')` → prompts for PIN AGAIN (flag not set)

**After Fix (Single PIN Prompt)**:
1. User clicks Facilitator link from session page
2. HeaderBar calls `ensurePinAllowed('session-exit')` → prompts for PIN
3. HeaderBar detects destination is facilitator route → calls `setInFacilitatorSection(true)`
4. Navigation to `/facilitator` happens
5. Facilitator page calls `ensurePinAllowed('facilitator-page')` → SKIPS PIN (flag already set)

### Server Verification

### 32. src/app/session/v2/SessionPageV2.jsx (aba181cea98f9fd675ef1a6ce479d4073f258f450478bdefdb45efb001343348)
- bm25: -9.1344 | relevance: 1.0000

// Keep snapshot currentPhase aligned so granular saves write under the active phase.
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.saveProgress('phase-change', { phaseOverride: data.phase });
      }
      
      // Update keyboard service phase
      if (keyboardServiceRef.current) {
        keyboardServiceRef.current.setPhase(data.phase);
      }
      
      // For discussion and test phases, initialize them but DON'T auto-start them
      // after a timeline jump. They should show the "Begin" button first.
      const isTimelineJump = timelineJumpInProgressRef.current;
      
      // Start phase-specific controller
      if (data.phase === 'discussion') {
        startDiscussionPhase();
        // Discussion has no play timer - start directly in work mode
        setCurrentTimerMode(prev => ({ ...prev, discussion: 'work' }));
        setTimerRefreshKey(k => k + 1);
        // If timeline jump, keep discussionState as 'idle' to show Begin button
        if (!isTimelineJump && discussionPhaseRef.current) {
          discussionPhaseRef.current.start();
        }
      } else if (data.phase === 'teaching') {
        startTeachingPhase();
        // Teaching uses discussion timer (grouped together, already in work mode)
      } else if (data.phase === 'comprehension') {
        const started = startComprehensionPhase();
        if (started) {
          // Start play timer for comprehension once phase exists (unless play portion is disabled)
          if (playPortionsEnabledRef.current?.comprehension !== false) {
            startPhasePlayTimer('comprehension');
          }
        } else {
          if (playPortionsEnabledRef.current?.comprehension !== false) {
            pendingPlayTimersRef.current.comprehension = true;
          }

### 33. scripts/add-cohere-style-chronograph.sql (33816351a653cd6f9ad99d8c847e11b711ea222f851ed5010e135ab07c6a9b27)
- bm25: -8.7722 | relevance: 1.0000

create index if not exists user_goal_versions_latest_idx
  on public.user_goal_versions (tenant_id, user_id, sector, ts desc, goal_version_id desc);

create table if not exists public.thread_summary_versions (
  summary_version_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(tenant_id) on delete cascade,
  thread_id uuid not null references public.threads(thread_id) on delete cascade,
  sector text not null check (sector in ('child','adult','both')),
  ts timestamptz not null default now(),
  title text not null,
  summary text not null,
  covers_event_min uuid null,
  covers_event_max uuid null,
  source_event_ids uuid[] not null default '{}'::uuid[]
);

create index if not exists thread_summary_versions_latest_idx
  on public.thread_summary_versions (tenant_id, thread_id, ts desc, summary_version_id desc);

-- FTS support on summaries
alter table public.thread_summary_versions
  add column if not exists tsv tsvector generated always as (to_tsvector('english', coalesce(summary,''))) stored;

create index if not exists thread_summary_versions_tsv_gin
  on public.thread_summary_versions using gin (tsv);

-- 5) FAQ / intent gate
create table if not exists public.gate_intents (
  intent_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(tenant_id) on delete cascade,
  sector text not null check (sector in ('child','adult','both')),
  label text not null,
  trigger_text text not null,
  answer_text text null,
  robot_text text null,
  updated_at timestamptz not null default now()
);

alter table public.gate_intents
  add column if not exists tsv tsvector generated always as (to_tsvector('english', coalesce(trigger_text,''))) stored;

### 34. docs/brain/v2-architecture.md (dcea5ecf862257a5f80f2259d150c9f5b9ae6ce42bb7e280b9ad10ee41710f36)
- bm25: -8.7314 | relevance: 1.0000

**V2 Implementation:**
- `src/app/session/v2/SessionPageV2.jsx` - Complete session flow UI (3500+ lines, includes comprehension logic)
- `src/app/session/v2/AudioEngine.jsx` - Audio playback system (600 lines)
- `src/app/session/v2/TeachingController.jsx` - Teaching stage machine with TTS (400 lines)
- `src/app/session/v2/ComprehensionPhase.jsx` - DEPRECATED, not used (comprehension handled inline in SessionPageV2)
- `src/app/session/v2/DiscussionPhase.jsx` - Discussion activities (200 lines)
- `src/app/session/v2/ExercisePhase.jsx` - Exercise questions with scoring (300 lines)
- `src/app/session/v2/WorksheetPhase.jsx` - Fill-in-blank questions (300 lines)
- `src/app/session/v2/TestPhase.jsx` - Graded test with review (400 lines)
- `src/app/session/v2/ClosingPhase.jsx` - Closing message with encouragement (150 lines)
- `src/app/session/v2/PhaseOrchestrator.jsx` - Session phase management (150 lines)
- `src/app/session/v2/SnapshotService.jsx` - Session persistence (300 lines)
- `src/app/session/v2/TimerService.jsx` - Session and work phase timers (350 lines)
- `src/app/session/v2/KeyboardService.jsx` - Keyboard hotkey management (150 lines)
- `src/app/session/v2/services.js` - API integration layer (TTS + lesson loading, includes question pools)
- `src/app/session/v2test/page.jsx` - Direct test route

### 35. docs/brain/ingests/pack-mentor-intercepts.md (3300157944d072852387421f46174f6339d6a53250501dd8a14f2dc88db84519)
- bm25: -8.6835 | relevance: 1.0000

**V2 Implementation:**
- `src/app/session/v2/SessionPageV2.jsx` - Complete session flow UI (3500+ lines, includes comprehension logic)
- `src/app/session/v2/AudioEngine.jsx` - Audio playback system (600 lines)
- `src/app/session/v2/TeachingController.jsx` - Teaching stage machine with TTS (400 lines)
- `src/app/session/v2/ComprehensionPhase.jsx` - DEPRECATED, not used (comprehension handled inline in SessionPageV2)
- `src/app/session/v2/DiscussionPhase.jsx` - Discussion activities (200 lines)
- `src/app/session/v2/ExercisePhase.jsx` - Exercise questions with scoring (300 lines)
- `src/app/session/v2/WorksheetPhase.jsx` - Fill-in-blank questions (300 lines)
- `src/app/session/v2/TestPhase.jsx` - Graded test with review (400 lines)
- `src/app/session/v2/ClosingPhase.jsx` - Closing message with encouragement (150 lines)
- `src/app/session/v2/PhaseOrchestrator.jsx` - Session phase management (150 lines)
- `src/app/session/v2/SnapshotService.jsx` - Session persistence (300 lines)
- `src/app/session/v2/TimerService.jsx` - Session and work phase timers (350 lines)
- `src/app/session/v2/KeyboardService.jsx` - Keyboard hotkey management (150 lines)
- `src/app/session/v2/services.js` - API integration layer (TTS + lesson loading, includes question pools)
- `src/app/session/v2test/page.jsx` - Direct test route

### 36. sidekick_pack.md (af53ecc19ee10a49a8b05a6d9667006979cd7d5f304dcfad57d5acde47312bea)
- bm25: -7.9834 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Calendar day cell overlay opens generator, generates lesson, lesson appears in lessons list but not in calendar day cell or as scheduled lesson - investigate the flow from Generate on date button through to calendar state update
```

Filter terms used:
```text
Calendar
day
cell
overlay
opens
generator
generates
lesson
lesson
appears
in
lessons
list
but
not
in
calendar
day
cell
or
as
scheduled
lesson
investigate
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

Calendar day cell overlay opens generator generates lesson lesson appears in lessons list but not in calendar day cell or as scheduled lesson investigate

## Forced Context

(none)

## Ranked Evidence

### 1. docs/brain/calendar-lesson-planning.md (3fa72b30c4a36a0855e8b5e9c7f63b5cb1e38fd2725c7bcf9389c3fa8d2b81ed)
- bm25: -37.0855 | relevance: 1.0000

**Completion query rule (visibility > micro-optimization):**
- Do not rely on `.in('lesson_id', [...scheduledKeys])` when loading completion events.
- Because `lesson_id` formats vary, strict filtering can miss valid completions and make past calendar history appear empty.

### 37. docs/brain/v2-architecture.md (07100d0540a5bc32812eb611909832cc0b8baa09ad9bbd8bb32fb71cf34aae1c)
- bm25: -7.9034 | relevance: 1.0000

**User Flow:**
1. Learner clicks Start Lesson
2. Discussion phase loads, plays greeting: "Hi [name], ready to learn about [topic]?"
3. Learner clicks "Begin" button
4. Teaching phase starts with play timer (green) - opening action buttons available
5. Learner can interact with opening actions during play time in teaching phase
6. Play timer expires → PlayTimeExpiredOverlay → work timer starts → teaching questions begin

---

## Why V2 Exists

The v1 session page (`src/app/session/page.js`) is a 9,797-line monolith managing 30+ coupled state machines simultaneously:
- Phase/subPhase navigation
- Teaching flow (definitions → examples with sentence-by-sentence gating)
- Audio playback (HTMLAudio vs WebAudio vs Synthetic paths)
- Caption synchronization
- Video coordination
- Question tracking (comprehension, exercise, worksheet, test)
- Discussion activities (Ask, Riddle, Poem, Story, Fill-in-Fun)
- Snapshot persistence
- Timer systems (session timer + 11 phase timers + speech guard)
- Keyboard hotkeys

**Problem:** All systems share state directly via props drilling (~150 props to each hook). Every fix breaks something else because there are no boundaries. Example: Skip hotkey clears audio, but Next Sentence hotkey fires immediately after, advancing teaching stage while audio system thinks playback is still active → examples stage plays no audio.

**Solution:** V2 implements clean architectural boundaries with event-driven communication. Systems don't manipulate each other's state—they emit events and react to events.

---

## Migration Strategy: Parallel Implementation (Option C)

### 38. src/app/session/components/games/FlashCards.jsx (8801f24301980b95bef103428a0cf7e65f48f137e5cc5eadd89d2a54d5ad029a)
- bm25: -7.8911 | relevance: 1.0000

@keyframes flashcards-card-in {
          0% { transform: translateX(120%); opacity: 0.15; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes flashcards-card-out {
          0% { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(-120%); opacity: 0.15; }
        }
      `}</style>

<div style={headerRow}>
        <button type="button" style={softBtn} onClick={onBack}>← Back</button>
        <div style={{ fontWeight: 900, fontSize: 18, color: '#111827' }}>Flash Cards</div>
        <button type="button" style={softBtn} onClick={() => setScreen('setup')}>Setup</button>
      </div>

{/* Meter */}
      <div style={{ background: '#fff', border: '2px solid #e5e7eb', borderRadius: 16, padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 900, color: '#111827' }}>{topicLabel}</div>
          <div style={{ fontWeight: 900, color: '#111827' }}>Stage {clampStage(stage)} / {STAGES_TOTAL}</div>
        </div>

<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 14, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' }}>
            <div
              style={{
                width: `${(Math.max(0, Math.min(goal, meter)) / goal) * 100}%`,
                height: '100%',
                background: '#111827',
                transition: 'width 240ms linear',
              }}
            />
          </div>
          <div style={{ minWidth: 86, textAlign: 'right', fontWeight: 900, color: '#111827' }}>
            Goal {goal}
          </div>
        </div>
      </div>

### 39. src/app/session/v2/OpeningActionsController.jsx (51c1629192972253c3170a3a832ffcd6ca03eb6a1f3a31767de88d31d50977f9)
- bm25: -7.8603 | relevance: 1.0000

/**
 * OpeningActionsController.jsx
 * 
 * Manages opening actions (Ask, Riddle, Poem, Story, Fill-in-Fun) in V2 architecture.
 * Available during play time in phases 2-5 (Comprehension, Exercise, Worksheet, Test).
 * 
 * V2 architectural patterns:
 * - Event-driven communication via EventBus
 * - Private fields for encapsulation (#)
 * - Single source of truth (no state duplication)
 * - Deterministic async/await chains
 * 
 * Events emitted:
 * - openingActionStart: { action, phase }
 * - openingActionComplete: { action, phase }
 * - openingActionCancel: { action, phase }
 * 
 * Events consumed:
 * - (none currently - self-contained controller)
 * 
 * Opening Actions:
 * 1. Ask: Learner asks Ms. Sonoma questions
 * 2. Riddle: Present riddle with hint/reveal
 * 3. Poem: Read subject-themed poem
 * 4. Story: Collaborative storytelling
 * 5. Fill-in-Fun: Mad Libs word game
 */

import { pickNextRiddle, renderRiddle } from '@/app/lib/riddles';
import { pickNextJoke, renderJoke } from '@/app/lib/jokes';
import { fetchTTS } from './services';
import { getGradeAndDifficultyStyle } from '../utils/constants';

export class OpeningActionsController {
  #eventBus;
  #audioEngine;
  #phase;
  #subject;
  #learnerGrade;
  #difficulty;

#actionNonce = 0;

#fillInFunTemplatePromise = null;
  
  // Current action state
  #currentAction = null; // 'ask' | 'riddle' | 'poem' | 'story' | 'fill-in-fun' | 'joke' | null
  #actionState = {}; // Action-specific state
  
  constructor(eventBus, audioEngine, options = {}) {
    this.#eventBus = eventBus;
    this.#audioEngine = audioEngine;
    this.#phase = options.phase || null;
    this.#subject = options.subject || 'math';
    this.#learnerGrade = options.learnerGrade || '';
    this.#difficulty = options.difficulty || 'moderate';

### 40. docs/brain/facilitator-hub.md (da9aec6fdfc1ea2738cb90fb2977c145f037ea8248bca3683693f7940f7ecae9)
- bm25: -7.5852 | relevance: 1.0000

# Facilitator Hub

## How It Works

The Facilitator hub is the main entry point for facilitator workflows at `/facilitator`.

- It shows a small grid of primary sections (cards) that route to key areas.
- It displays the current subscription tier as informational status.
- Billing is treated as part of **Account** (plan + billing lives under `/facilitator/account/*`).

## What NOT To Do

- Do not add a separate "Billing" section on the hub. Billing navigation belongs under **Account**.
- Do not duplicate billing management UIs on the hub. Use the account plan/billing pages.

## Key Files

- `src/app/facilitator/page.js` - Facilitator hub cards and subscription status display
- `src/app/facilitator/account/page.js` - Account hub (settings overlays)
- `src/app/facilitator/account/plan/page.js` - Plans & billing entry point
- `src/app/billing/manage/*` - Billing portal UI
