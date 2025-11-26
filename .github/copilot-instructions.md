```instructions
---
applyTo: '*'
---

# GitHub Copilot Instructions for Ms. Sonoma Project

## Scope

This file contains the essential protocol and guardrails for working with the Ms. Sonoma codebase. For detailed teaching system rules, see `docs/brain/ms-sonoma-teaching-system.md`. For Beta program details, see `docs/brain/beta-program.md`.

**Role**:
- Copilot is the programmer assistant
- Never emit child-directed text directly
- Build templates and validators only
- Refer to brain files for authoritative system documentation

**Allowed Outputs**: Code patches, reviews, diffs, tests, templates, validators, developer guidance

**Out of Scope**: Child-directed spoken text/persona outputs. If a request looks like payload, return developer templates or code that renders it, or ask for missing literals.

**Ambiguity Rule**: When ambiguous, default to developer templates, not payload.

---

## BRAIN FILE PROTOCOL [COPILOT]

Before making changes to core systems:

1. **CHECK**: Read `docs/brain/manifest.json` to find which brain file covers this system

2. **READ**: If a brain file exists, read it completely - it is canonical truth about current design

3. **IMPLEMENT**: Make code changes based on what the USER requested (not your assumptions)

4. **DOCUMENT**: After changes work, ALWAYS check if system needs brain documentation:
   - If brain file exists: Ask "Should I update [filename] to reflect these changes?"
   - If NO brain file exists for this system: Ask "This system isn't documented yet. Should I create docs/brain/[topic].md and add to manifest.json?"
   - NEVER skip documentation for core systems (APIs, flows, persistence, UI patterns, prompt engineering)
   - If unsure whether system qualifies: ASK, don't assume it's not worth documenting

5. **UPDATE**: Only if user confirms:
   - If updating existing brain file: rewrite the relevant section completely (kill zombies), don't append
   - If creating new brain file: use "How It Works", "What NOT To Do", "Key Files" structure
   - Update manifest.json with new entry or last_updated timestamp
   - List all relevant systems/keywords in manifest entry

6. **LOG**: Add one line to docs/brain/changelog.md: "Updated {topic}.md: {brief what changed}" or "Created {topic}.md: {brief what it documents}"

---

## PRE-FLIGHT CHECKLIST

**Complete BEFORE any code changes to core systems**

When user requests changes to snapshot persistence, teaching flow, comprehension, session tracking, or other core systems:

1. **Show this checklist filled out**:
   ```
   BRAIN CHECK:
   □ Checked manifest.json - relevant file: _______________
   □ Read brain file - current design summary: _______________
   □ User request: _______________
   □ Conflicts with brain? YES/NO - explanation: _______________
   □ Proceeding with: _______________
   ```

2. **Wait for user confirmation before writing code**

3. This creates a visible checkpoint and prevents autopilot coding

---

## CRITICAL GUARDRAILS

- **Never write to brain files without user approval**
- **Never append to brain files** (always rewrite sections completely to kill zombies)
- **Never create new brain files without user approval** (check manifest first for logical home)
- **NEVER skip asking about brain documentation when making core system changes**
- **Core systems requiring documentation**: APIs, flows, persistence, authentication, UI patterns, prompt engineering, data schemas, integrations
- **If you make code changes and don't mention brain documentation, you violated protocol**
- **Never trust your memory over what's in the brain file**
- **If brain file contradicts your understanding, the brain file is correct**
- **Manifest prevents duplicate files**: if a system is already listed, add to that file, don't create new one

---

## Code/Debug/Record Workflow

### Modes (Internal Discipline)

- **Code mode**: Implement smallest viable change that satisfies request; keep changes scoped and ASCII-clean
- **Debug mode**: Reproduce, isolate root cause, apply least-broad fix; avoid unrelated refactors
- **Record mode**: Document what changed and why to prevent drift; update changelog entry

### Read-First Protocol

- Before any Code or Debug action, scan directly-related files and recent changelog entries (latest 20) in `docs/brain/changelog.md`
- Prefer local sources over web
- Do not reference UI/runtime in Ms. Sonoma payloads

### Changelog "Up-to-Speed" Contract

- **File**: `docs/brain/changelog.md` (create if missing)
- **Order**: Newest entries at top (reverse chronological)
- **Format per line**: `YYYY-MM-DDTHH:MM:SSZ | Copilot | <summary up to 150 chars>`
- ASCII-only; no secrets
- On each response, write new entry at top and trim to most recent 20 entries
- If concurrent edits occur, rewrite to restore newest-first order and re-apply 20-line trim

### Changelog Discipline

- For substantial rule or structure changes, include file references and brief rationale in entry

### Ownership Boundaries

- **Signals are read-only**: Do not modify `.github/Signals/*` or restate signal texts
- **Syntax rules are BrainMaker-owned**: Propose changes via user, do not edit directly
- **Structure surfaces may be edited**: Keep edits scoped and recorded

---

## Brain File Index

**Current Brain Files** (see `docs/brain/manifest.json` for full index):

- **snapshot-persistence.md**: Snapshot saves, localStorage, database persistence, atomic gates
- **session-takeover.md**: Session ownership, device conflict detection, PIN-validated takeover
- **MentorInterceptor_Architecture.md**: Mr. Mentor counselor flows
- **visual-aids.md**: DALL-E 3 generation, no-text constraint, image storage
- **ms-sonoma-teaching-system.md**: Teaching flow, phases, content safety, leniency modes, brand signals
- **beta-program.md**: Tutorial gating, surveys, event instrumentation, golden key unlock

**When to consult brain files**:
- Before making changes to any system listed in manifest.json
- When debugging unexpected behavior
- When user asks about architecture or design decisions
- Before proposing new features that might overlap with existing systems

---

## Ms. Sonoma Quick Reference

**For full details, see `docs/brain/ms-sonoma-teaching-system.md`**

### Core Principles

- **Stateless**: Each call stands alone
- **Instruction-only**: Behavior derives from inline text
- **Closed world**: No files, variables, tools, APIs, or network references in payloads
- **ASCII-only**: Straight quotes, single punctuation, no emoji
- **6-12 words per sentence**: Warm tone, one idea per sentence
- **Placeholders never reach Ms. Sonoma**: Always substitute literals before send

### Allowed Phases

1. Opening (greeting + joke + silly question)
2. Teaching Definitions
3. Teaching Examples
4. Repeat
5. Transition to Comprehension
6. Comprehension Ask/Feedback
7. Closing

### Content Safety

- **Forbidden topics**: Violence, weapons, death, injury, sexual content, drugs, alcohol, profanity, hate speech, political opinions, religious doctrine
- **If child asks forbidden topic**: "That's not part of today's lesson. Let's focus on [lesson topic]!"
- **Defense layer**: `src/lib/contentSafety.js` validates before LLM

### Brand Signal Lexicon

- **Preferred**: calm, clear, focus, steps, notice, practice, steady, thinking
- **Avoid**: amazing, awesome, epic, crushed, nailed, genius
- **Exclamation count**: 0-1 per response

---

## Beta Program Quick Reference

**For full details, see `docs/brain/beta-program.md`**

- Beta tier users must complete tutorials before access
- Post-lesson survey with password re-auth unlocks golden key
- Event instrumentation tracks: transcripts, notes, repeats, session duration
- Feature flags: `FORCE_TUTORIALS_FOR_BETA`, `SURVEY_GOLDEN_KEY_ENABLED`, `TUTORIALS_AVAILABLE_FOR_ALL`
- Non-Beta users: tutorials optional, not blocked

---

## Validation Checklist for Ms. Sonoma Payloads

Before sending content to Ms. Sonoma, verify:

- [ ] Payload contains only speakable text
- [ ] Child's name and lesson title are literal (no placeholders)
- [ ] Exactly one phase represented
- [ ] No syntax or labels: no [], {}, <>, no [COPILOT]/[SONOMA]/[VERBATIM]/[SAMPLE]
- [ ] No placeholders: no {PLACEHOLDER}, [PLACEHOLDER], <PLACEHOLDER>, or stray ALLCAPS tokens
- [ ] ASCII-only punctuation
- [ ] 6-12 words per sentence
- [ ] Preferred lexicon used, avoid list absent
- [ ] Exclamation count: 0-1

---

## Key File References

### Ms. Sonoma API
- `src/app/api/sonoma/route.js` - Main API endpoint with content safety

### Content Safety
- `src/lib/contentSafety.js` - 7-layer defense system

### Teaching Flow
- `src/app/session/hooks/useTeachingFlow.js` - Definitions and examples stages
- `src/app/session/hooks/usePhaseHandlers.js` - Phase transitions
- `src/app/session/page.js` - Main session orchestration

### Snapshot Persistence
- `src/app/session/hooks/useSnapshotPersistence.js` - Atomic save/restore
- `src/app/api/snapshots/route.js` - Database persistence

### Brand Signals (Read-Only)
- `.github/Signals/MsSonoma_Voice_and_Vocabulary_Guide.pdf`
- `.github/Signals/MsSonoma_Messaging_Matrix_Text.pdf`
- `.github/Signals/MsSonoma_OnePage_Brand_Story.pdf`
- `.github/Signals/MsSonoma_Homepage_Copy_Framework.pdf`
- `.github/Signals/MsSonoma_Launch_Deck_The_Calm_Revolution.pdf`
- `.github/Signals/MsSonoma_SignalFlow_Full_Report.pdf`

---

**Remember**: When in doubt, consult the brain files. They are canonical truth.

```
