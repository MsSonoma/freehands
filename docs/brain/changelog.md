2025-11-12T17:40:00Z | Copilot | Goals-notes API now honors Supabase cookie tokens for Mentor overlay loads.
2025-11-12T17:25:00Z | Copilot | Complete Lesson button no longer requires facilitator PIN.
2025-11-12T17:10:00Z | Copilot | Session header nav now routes through PIN guard before leaving lesson.
2025-11-12T16:20:00Z | Copilot | Begin/Resume now start Supabase lesson sessions and always insert fresh rows.
2025-11-12T15:04:58Z | Copilot | Added PIN guard screen before loading Mentor UI; kept takeover hash fix.
2025-11-12T14:50:16Z | Copilot | Mentor session API now validates hashed facilitator PINs like other gates.
2025-11-12T14:43:21Z | Copilot | Fixed SessionTakeoverDialog to use isBusy flag instead of undefined loading var.
2025-11-12T14:30:00Z | Copilot | Session polling now reopens takeover dialog instead of booting to facilitator.
2025-11-12T14:21:31Z | Copilot | Reinstated Mr Mentor PIN gate effect so page unblocks.
2025-11-12T14:18:55Z | Copilot | Restored CounselorClient wrapper so helper order change still builds.
2025-11-12T01:46:00Z | Copilot | Reordered mentor session polling helper to stop TDZ ReferenceError.
2025-11-12T01:37:00Z | Copilot | Stop test resumes from jumping into review with blank answers marked wrong.
2025-11-12T01:18:00Z | Copilot | Moved snapshot effect before PIN gate return to keep hook order stable.
2025-11-12T01:05:00Z | Copilot | Fixed useSessionTracking import path so session page builds.
2025-11-12T00:58:00Z | Copilot | Added PIN gate for active sessions and cross-device lesson access.
2025-11-12T00:32:00Z | Copilot | Enforced single active session per learner by reusing or auto-closing conflicts.
2025-11-12T00:05:00Z | Copilot | Lesson list ignores fresh snapshots so untouched lessons show Start.
2025-11-11T21:10:00Z | Copilot | Complete lesson now clears snapshot keys so new sessions start fresh.
2025-11-11T20:45:00Z | Copilot | Added mentor session cleanup helpers, force-end flow, and npm script.
2025-11-08T17:26:00Z | Copilot | Recipe parser now honors Units metadata for per-jar BOM quantities.
2025-11-08T17:05:00Z | Copilot | Installed Python env and fixed pyproject to drop unused hatch SCM hook.
