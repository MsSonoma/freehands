# Instruction Brain Hub

## Purpose
This directory is the central hub for every non-code rule, template, and drift-prevention note that governs Copilot behavior in this repo. All assistants should review these files before acting so everyone executes from the same playbook.

## What Lives Here
- Canonical guidance that shapes Copilot execution (no application code).
- Summaries or migrations of scattered rules that need a permanent home.
- References back to source documents when content must remain in place (e.g., `.github/copilot-instructions.md`, `AGENTS.md`).

## Update Expectations
1. Capture every new rule or nuance here before treating it as live.
2. Record the change in `changelog.md` with a UTC timestamp and short rationale.
3. Keep entries ASCII-clean and scoped to process guidance only.
4. If a rule originates elsewhere, link to the source and note any outstanding migration work.

## Current Canonical Sources
| File | Purpose | Steward |
| --- | --- | --- |
| `.github/copilot-instructions.md` | Live guardrails for Copilot responses, including Sonoma payload rules. | Copilot editors |
| `AGENTS.md` | Brain-builder protocol and repository-wide operating rules. | Brain team |
| `docs/brain/README.md` | Central index and process guidance (this file). | Brain team |

## Instruction Inventory
| Area | Reference | Notes |
| --- | --- | --- |
| Beta program gating | `docs/BETA_PROGRAM_IMPLEMENTATION.md` | Contains flow and schema details; summarize key guardrails here after review. |
| Universal gating overlays | `docs/UNIVERSAL_GATING_SYSTEM.md` | Track overlay patterns and migration status. |
| Lesson approvals | `APPROVED_LESSONS_IMPLEMENTATION.md` | Record facilitator approval protocol highlights. |
| Session timing | `docs/session-timer-system.md` | Capture timers, warnings, and dependencies. |
| Profanity filtering | `docs/profanity-filter*.md` | Note vocabulary policies and testing steps. |

## Migration Backlog
- [ ] Beta program guide distilled into a brain summary.
- [ ] Universal gating patterns captured with decision tree.
- [ ] Short-answer judging rules aligned with leniency section.
- [ ] Lesson calendar procedures referenced from `lesson-calendar-feature.md`.
- [ ] Profanity filter mitigations summarized with escalation steps.

## Entry Template for New Guidance
```
Title: <Feature or rule name>
Last reviewed: <UTC timestamp>

Summary
- One or two sentences describing the intent.

Key Rules
- Bulleted list of non-negotiable guardrails.

Support Files
- Links to source documents, PRs, or specs.

Open Questions
- Optional list of follow-ups or pending decisions.
```

## Changelog Requirements
The changelog is the live, newest-first log used by both BrainMaker and Copilot to sync state quickly.

- File: `docs/brain/changelog.md`.
- Order: newest entries at the top (reverse chronological).
- Retention: keep only the most recent 20 entries; trim on each write.
- Read-before-reply: read the latest 20 entries before acting on a prompt.
- Write-after-reply: write one line at the top after completing a response.
- Line format: `YYYY-MM-DDTHH:MM:SSZ | <ENGINE> | <summary up to 150 chars>`.
- ASCII-only: use straight quotes and single punctuation; no secrets.
- Include file references or PR links when helpful.

## Audit Cadence
- Run a quick audit of this hub at least once per month (or before shipping major instruction changes).
- During each audit, verify inventory accuracy, close completed backlog items, and ensure changelog formatting remains consistent.
- Record the audit in the changelog with an [audit] note and any follow-up actions.

## Changelog Workflow
- Before BrainMaker or Copilot respond to any prompt, they must read the latest 20 changelog updates.
- On every response, write a new single-line entry at the top and trim the file to the most recent 20 entries.
- Include cross-engine signals and relevant forward/back references so either system can reconnect context quickly.

Stay disciplined: keep the brain authoritative, versioned, and easy to audit.

