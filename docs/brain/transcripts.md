# Transcript System

**Feature:** Every word spoken by the AI and every answer given by the learner is saved in a structured ledger. The facilitator can view and download transcripts from the hub.

**Related Brain Files:**
- **[feature-edge-map.md](feature-edge-map.md)** — Full dependency graph for all 9 session features
- **[snapshot-persistence.md](snapshot-persistence.md)** — Snapshot holds RUNTIME transcript lines (for resume captions)
- **[session-takeover.md](session-takeover.md)** — Transcript continues on new device (lines in snapshot restored)

---

## Core Architecture

**Two Separate Concepts — Do Not Confuse:**

| Concept | Location | Purpose | Cleared When |
|---------|----------|---------|-------------|
| **Runtime transcript** | `snapshot.transcript.lines` (SnapshotService + localStorage) | Resume captions, show on-screen | `deleteSnapshot()` on lesson complete |
| **Persistent ledger** | Supabase Storage `transcripts` bucket | Facilitator record, PDF/TXT/RTF | Never deleted (append-only forever) |

---

## Key Files

- `src/app/lib/transcriptsClient.js` — Core API (`appendTranscriptSegment`, `updateTranscriptLiveSegment`)
- `src/app/session/v2/SessionPageV2.jsx` — Saves final segment on `sessionComplete`
- `src/app/session/utils/snapshotPersistenceUtils.js` — Passes `transcriptLinesRef` into snapshot saves

---

## Supabase Storage Structure

```
transcripts/
  v1/
    {ownerId}/
      {learnerId}/
        {lessonId}/
          ledger.json          ← Array of segments (append-only)
          transcript.pdf       ← Regenerated from ledger
          transcript.txt       ← Regenerated from ledger
          transcript.rtf       ← Regenerated from ledger
          sessions/
            {sessionId}/
              ledger.json      ← Per-session view (same format, subset)
```

**Ledger schema:**
```javascript
[
  {
    startedAt: "2025-01-01T12:00:00Z",  // ISO timestamp when session started
    completedAt: "2025-01-01T12:30:00Z", // ISO timestamp when session ended
    lines: [
      { role: "assistant", text: "Welcome to today's lesson..." },
      { role: "user", text: "The answer is photosynthesis" }
    ]
  },
  // ... one entry per completed session
]
```

---

## Two Update Modes (Critical Distinction)

### `updateTranscriptLiveSegment(...)` — Used During Session
- **Behavior:** Finds segment by `startedAt`, upserts its `lines` (overwrites existing lines for that segment)
- **Effect:** Ledger stays same size; current session's lines updated in-place
- **When called:** Every scheduled snapshot save (`scheduleSaveSnapshotCore`)
- **Why:** Prevents segment explosion; guarantees at most one in-progress segment per session

### `appendTranscriptSegment(...)` — Used On Lesson Complete
- **Behavior:** Creates a NEW entry at the end of the ledger array
- **Effect:** Ledger grows by one entry; `completedAt` timestamp set
- **When called:** `sessionComplete` event in `SessionPageV2.jsx`
- **Why:** Finalizes the session record; makes it available in facilitator history

**RULE: Never use `appendTranscriptSegment` for autosaves. Only `updateTranscriptLiveSegment` for in-progress updates.**

---

## Session Complete Flow

1. `sessionComplete` event fires
2. Read `transcriptLinesRef.current` (ref to avoid stale closure)
3. Call `appendTranscriptSegment({ learnerId, learnerName, lessonId, lessonTitle, segment: { startedAt, completedAt: now(), lines } })`
4. Backend loads existing ledger → appends new segment → regenerates PDF/TXT/RTF → uploads to Storage
5. Snapshot cleared after this (`deleteSnapshot()`)

---

## Cross-Device Continuity

On takeover (device switch):
1. New device restores snapshot → `snapshot.transcript` restored
2. `transcriptLinesRef.current` seeded from restored lines
3. Session continues appending new lines to the existing array
4. On complete, ALL lines (including pre-takeover lines) go into the final `appendTranscriptSegment` call

---

## Special Cases

- **Demo learner** (`learnerId === 'demo'`): Remote save is skipped entirely. No ledger written.
- **Webb/Slate lessons**: Path uses `/v1/{ownerId}/{learnerId}/webb/{lessonId}/` subfolder
- **Teacher-aware paths**: Standard Sonoma lessons use flat `/v1/{ownerId}/{learnerId}/{lessonId}/`
- **Invalid lines**: Regex filter strips JWT errors and malformed JSON before persisting (`INVALID_LINE_PATTERNS`)

---

## DO NOT BREAK

1. **Append vs. upsert distinction**: `appendTranscriptSegment` on autosave creates duplicate ledger entries. ALWAYS use `updateTranscriptLiveSegment` for in-progress saves.

2. **Lines sanitization**: Lines with JWT tokens or invalid JSON MUST be stripped before persisting. `INVALID_LINE_PATTERNS` regex must not be removed.

3. **`transcriptLinesRef` not state**: Use `transcriptLinesRef.current` in the `sessionComplete` handler. The state variable will be stale inside the event callback.

4. **Snapshot transcript ≠ ledger**: Clearing `snapshot.transcript` on lesson complete is correct. The ledger is already written. Never clear the ledger when clearing the snapshot.

5. **Dual-write on sessionId**: When `sessionId` is provided, write to BOTH `/sessions/{sessionId}/ledger.json` AND the top-level `/ledger.json`. Skipping the top-level write breaks the consolidated facilitator view.

6. **PDF regenerated on every upsert**: `writeLedgerAndArtifacts()` must always run after any ledger mutation. Skipping it leaves PDFs stale.
