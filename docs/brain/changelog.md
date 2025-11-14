2025-11-15T00:00:00Z | Copilot | Starting surgical log removal. Inventory: ~500+ console statements. Plan: lib files -> client -> server -> API routes. Commit each.
2025-11-14T23:25:00Z | Copilot | Fixed Mr. Mentor page requiring refresh by optimizing session initialization to wait for all dependencies before running.
2025-11-14T23:50:00Z | Copilot | Fixed LessonsOverlay requiring refresh: added initial load on mount and clear loading state when cache skip happens.
2025-11-14T23:45:00Z | Copilot | Fixed Mr. Mentor initialization hang by removing isMountedRef check from initial guard (React remount was causing false negative).
2025-11-14T23:35:00Z | Copilot | Fixed Mr. Mentor page hanging on initialization by ensuring sessionLoading is set to false on all early return paths.
2025-11-14T23:20:00Z | Copilot | All AI Rewrite buttons now align left for consistent layout across LessonEditor and LessonMakerOverlay.
2025-11-14T23:15:00Z | Copilot | Vocabulary editor now shows AI Rewrite and Remove buttons on same row for cleaner layout.
2025-11-14T23:10:00Z | Copilot | Added AI Rewrite to Mr. Mentor overlays: LessonsOverlay and GeneratedLessonsOverlay now have handlers for description, notes, vocab.
2025-11-14T23:05:00Z | Copilot | Added AI Rewrite to standalone Lesson Editor page with handlers for blurb, teaching notes, and vocabulary definitions.
2025-11-14T22:52:00Z | Copilot | Added AI Rewrite buttons to Mr. Mentor Lesson Generator overlay for Description, Notes, and Vocabulary fields.
2025-11-14T22:33:00Z | Copilot | Added AI Rewrite buttons to Lesson Generator for Short Description, Vocabulary Terms, and Additional Notes fields.
2025-11-14T22:25:00Z | Copilot | Removed setShowBegin(true) during lesson completion to prevent unresponsive-looking flash back to Begin state before exit.
2025-11-14T21:33:00Z | Copilot | Added lessonKey and handleTimerClick props to VideoPanel component to fix scope error in timer controls.
2025-11-14T21:32:00Z | Copilot | Fixed lessonKey scope error by computing it at top level with useMemo instead of inside useEffect.
2025-11-14T21:30:00Z | Copilot | Facilitator timer controls implemented: timer clickable with PIN, overlay allows time adjustment, pause/resume, and golden key apply/suspend.
2025-11-14T20:15:00Z | Copilot | Timer state now lesson-specific using scoped sessionStorage keys; prevents timer interference between different lessons.
2025-11-14T20:00:00Z | Copilot | Timer state now clears when returning to Begin screen; prevents completed lesson timer from carrying over to new lessons.
2025-11-14T19:45:00Z | Copilot | Removed blocking alert on golden key award; navigation now immediate with non-blocking toast notification on lessons page.
2025-11-14T19:30:00Z | Copilot | Complete Lesson button now prevents duplicate clicks and multiple golden key awards with completion lock and disabled state.
2025-11-14T19:00:00Z | Copilot | PIN gate now sets facilitator section flag on session-exit so users don't get prompted twice when leaving lessons and entering facilitator pages.
2025-11-13T19:35:00Z | Copilot | Visual aids overlay generates custom prompt from teaching notes on open; user can edit before generating images.
2025-11-13T19:30:00Z | Copilot | Visual aids overlay now opens first with custom prompt input before generating; user can edit guidance before initial generation.
2025-11-13T19:25:00Z | Copilot | Visual aids now generate kid-friendly descriptions during creation; explain reads stored description instead of calling API.
2025-11-13T19:15:00Z | Copilot | Visual aids now download and store selected images permanently in Supabase Storage; DALL-E URLs replaced with permanent URLs on save.
2025-11-13T16:52:00Z | Copilot | Normalized visual aids lesson_key on both save and load sides; created migration script to fix existing data.
2025-11-13T16:09:26Z | Copilot | Created reusable AI text rewriting system with AIRewriteButton component and /api/ai/rewrite-text endpoint for site-wide use.
2025-11-13T01:48:00Z | Copilot | Transcript list now sorted newest-first by session timestamp.
2025-11-13T01:42:00Z | Copilot | Transcript API now downloads and inspects content to filter header-only files.
2025-11-13T01:05:32Z | Copilot | Added script to sanitize existing transcripts and remove InvalidJWT-only artifacts.
2025-11-13T00:57:21Z | Copilot | Filtered InvalidJWT transcript artifacts and skip uploading empty ledgers.
2025-11-13T00:25:00Z | Copilot | Opening captions now tag assistant lines and transcript slices normalize roles.
2025-11-13T00:12:00Z | Copilot | Transcript API now paginates Supabase storage so all lessons appear.
2025-11-13T00:06:00Z | Copilot | Transcript fetch waits for PIN and surfaces errors instead of hanging.
2025-11-12T23:59:00Z | Copilot | Transcript page now loads after PIN gate check completes.
2025-11-12T23:43:30Z | Copilot | Restore repeat button after skips so Ms Sonoma can re-read lines.
2025-11-12T20:44:10Z | Copilot | Persisted Mr Mentor sessions across visits and reset ID when ending chats.
2025-11-12T19:38:33Z | Copilot | Removed Generated option from facilitator subject dropdown.
2025-11-12T19:15:33Z | Copilot | Facilitator lessons list loads without learner and hides learner-only controls.
2025-11-12T21:45:00Z | Copilot | Added printable plain-text export for lesson history modal.
2025-11-12T20:55:00Z | Copilot | Auto-mark stale lesson sessions as incomplete during history fetch.
2025-11-12T20:30:00Z | Copilot | Lesson history API now provides session event timelines across views.
2025-11-12T19:45:00Z | Copilot | Added lesson history modal and last-completed badges across facilitator, mentor, and learner views.
2025-11-12T19:00:00Z | Copilot | Updated Mentor landing copy to reflect single generator overlay.
2025-11-12T18:45:00Z | Copilot | Mentor client now sends Supabase token when loading learner goals.