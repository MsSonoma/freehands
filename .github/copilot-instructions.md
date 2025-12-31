# GitHub Copilot Instructions for Ms. Sonoma Project (freehands directory only. When working on other repos in the workspace ignore these rules and do not update the brain. The brain applies only to Ms. Sonoma code in the freehands directory.)


## BRAIN FILE PROTOCOL [COPILOT]

Before making changes to core systems:

1. **CHECK**: Read `docs/brain/manifest.json` to find which brain file covers this system

2. **READ**: If a brain file exists, read it completely - it is canonical truth about current design

3. **IMPLEMENT**: Make code changes based on what the USER requested (not your assumptions)

4. **DOCUMENT**: After making code changes, IMMEDIATELY update brain documentation BEFORE committing:
   - **SEQUENCE**: Code edit → Brain file update → Changelog entry → Commit/push
   - If brain file exists: Update relevant section (rewrite completely, kill zombies, don't append)
   - If NO brain file exists for core system: Create one using "How It Works", "What NOT To Do", "Key Files" structure
   - Core systems: APIs, flows, persistence, authentication, UI patterns, prompt engineering, data schemas, integrations
   - Update manifest.json (timestamp + keywords for new/updated files)
   - **NEVER commit code changes without updating the brain file first**
   - If no code changes were made in this response, inform user and skip brain update

5. **LOG**: Include brain changes in changelog.md entry with keyword markup: "Updated {topic}.md section X [#{file-id}: keyword1, keyword2]" or "Created {topic}.md [#{file-id}: keyword1, keyword2]"

---

## CRITICAL GUARDRAILS

- **Mandatory sequence**: Code edit → Brain update → Changelog → Commit (NEVER commit without brain update)
- **Never append to brain files** (always rewrite sections completely to kill zombies)
- **Check manifest first**: if system is already listed, update that file, don't create duplicate
- **Brain updates happen BEFORE commits** (not after, not when user asks - immediately after code changes)
- **If no code changes**: Inform user no brain update needed and proceed normally
- **Never trust your memory over what's in the brain file**
- **If brain file contradicts your understanding, the brain file is correct**
- **Core systems requiring documentation**: APIs, flows, persistence, authentication, UI patterns, prompt engineering, data schemas, integrations

---

## Code/Debug/Record Workflow

### Modes (Internal Discipline)

- **Research mode**: Check manifest.json → read brain file → read code → understand before acting
- **Code mode**: Implement smallest viable change that satisfies request; keep changes scoped and ASCII-clean
- **Debug mode**: Reproduce, isolate root cause, apply least-broad fix; avoid unrelated refactors
- **Record mode**: Document what changed and why to prevent drift; update changelog entry

### Read-First Protocol

Before any Code or Debug action, follow this MANDATORY sequence:

1. **Read changelog.md FIRST** - Latest 20 entries in `docs/brain/changelog.md`. Extract keyword markup `[#brain-file-id: terms]` from relevant entries.
2. **Check manifest.json** - Use file-id from changelog markup to find brain file. Match keywords to system.
3. **Read brain file completely** - It is canonical truth about design, patterns, gotchas.
4. **Scan directly-related code files** - Implementation specifics (function signatures, props, line numbers) ONLY after understanding design.

This sequence prevents zombie drift: Changelog → Manifest → Brain file → Code. Never reverse this order.

Additional guidelines:
- Prefer local sources over web
- Do not reference UI/runtime in Ms. Sonoma payloads

### Changelog "Up-to-Speed" Contract

- **File**: `docs/brain/changelog.md` (create if missing)
- **Order**: Newest entries at top (reverse chronological)
- **Format per line**: `YYYY-MM-DDTHH:MM:SSZ | Copilot | <summary up to 150 chars> [#brain-file-id: keyword1, keyword2]`
- **Keyword markup**: ALWAYS include `[#brain-file-id: keywords]` when entry relates to a brain file
  - Use manifest.json file IDs (e.g., `#snapshot-persistence`, `#timer-system`, `#mr-mentor-conversation-flows`)
  - Include 2-5 relevant keywords from manifest (e.g., `atomic-gates`, `timer-state`, `golden-key`)
  - Multiple brain files: `[#file-1: terms] [#file-2: terms]`
- ASCII-only; no secrets
- On each response, write new entry at top
- If concurrent edits occur, rewrite to restore newest-first order

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
