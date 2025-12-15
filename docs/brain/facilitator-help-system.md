# Facilitator Help System

**Last Updated:** 2025-12-15  
**Status:** Canonical

---

## Overview

The facilitator help system provides **contextual in-app guidance** for complex workflows in the facilitator section. Beta testers reported confusion about calendar planning, phase timers, and learner configuration. This system adds explanations at decision points without disrupting existing UI patterns.

---

## How It Works

### Component Architecture

Three reusable help components live in `src/components/FacilitatorHelp/`:

1. **InlineExplainer** - Help icon (❓) with modal overlay
   - Shows on-demand help text when user clicks question mark emoji
   - Help content displays in centered modal overlay with backdrop
   - User can click backdrop or close button to dismiss
   - Props: `helpKey` (unique ID), `title`, `children` (help content)

2. **WorkflowGuide** - Workflow guide (❓) with modal overlay
   - Shows multi-step workflow guide when user clicks question mark emoji
   - Displays numbered steps in centered modal overlay with backdrop
   - User can click backdrop or close button to dismiss
   - Props: `workflowKey` (unique ID), `title`, `steps` (array of {step, description})

3. **PageHeader** - Consistent page title with optional subtitle
   - Replaces inconsistent h1/p patterns across facilitator pages
   - Props: `title`, `subtitle`, `children` (optional additional help content)

### Placement Strategy

**InlineExplainer** placed next to:
- Tab labels (Calendar Scheduler vs Planner)
- Feature icons (Targets, AI Features, Timers on Learners page)
- Complex controls (Weekly pattern grid, timer dials)

**WorkflowGuide** placed at:
- Top of calendar Planner tab (automated lesson planning workflow)
- Top of lessons library (approve vs schedule workflow)

**PageHeader** replaces:
- Standalone h1/p combos on Calendar, Learners, Lessons pages
- Provides consistent page context and color legend (calendar colors)

### Import Pattern

Components exported as named exports from `src/components/FacilitatorHelp/index.js`:

```javascript
import { InlineExplainer, WorkflowGuide, PageHeader } from '@/components/FacilitatorHelp'
```

---

## What NOT To Do

1. **Do NOT add help to every field** - Only explain genuinely confusing concepts (timers, planner workflow). Avoid over-explaining obvious controls.

2. **Do NOT replace existing tooltips** - LearnerEditOverlay has hover tooltips for individual timer fields. InlineExplainer supplements, doesn't replace.

3. **Do NOT hardcode content in 100 places** - Use centralized help components. If content needs to be dynamic, pass as props, don't fork components.

4. **Do NOT break dismissal persistence** - Always provide unique helpKey/workflowKey. Duplicate keys cause unintended dismissals across different help instances.

5. **Do NOT add help without user testing feedback** - This system addresses specific beta tester confusion. Don't add speculative help for features users haven't reported issues with.

6. **Do NOT use for errors or validation** - Help content is for education, not error messages. Use existing error handling patterns for failures.

---

## Key Files

### Components
- `src/components/FacilitatorHelp/InlineExplainer.jsx` - Question mark emoji modal for contextual help
- `src/components/FacilitatorHelp/WorkflowGuide.jsx` - Question mark emoji modal with numbered workflow steps
- `src/components/FacilitatorHelp/PageHeader.jsx` - Consistent page header
- `src/components/FacilitatorHelp/index.js` - Named exports

### Pages Using Help System
- `src/app/facilitator/calendar/page.js` - Tab explainers, page header with color legend
- `src/app/facilitator/calendar/LessonPlanner.jsx` - Workflow guide, weekly pattern explainer
- `src/app/facilitator/learners/page.js` - Page header with targets/AI/timers explainers
- `src/app/facilitator/learners/components/LearnerEditOverlay.jsx` - Phase timers explainer
- `src/app/facilitator/lessons/page.js` - Page header, approve vs schedule workflow guide

---

## Design Decisions

### Why localStorage Instead of Database?

Help dismissals are UI preferences, not user data. Storing per-device avoids:
- API calls for every help component render
- Profile schema bloat with dozens of dismissal flags
- Privacy concerns about tracking UI interactions

Trade-off: Dismissals don't sync across devices. User can dismiss on phone, still see on desktop. This is acceptable for help content.

### Why Inline vs Modal?

Initially tested relative-positioned tooltips, but they caused layout issues and could overflow off screen. Switched to **centered modal overlay** because:
- Always visible and readable regardless of button position
- No layout shift or overflow issues
- Clean backdrop focus on help content
- Consistent behavior across all screen sizes
- Familiar modal pattern users understand

Modal used for both individual explainers and multi-step workflows. Single consistent interaction pattern.

### Why Not Just Add Text to Pages?

Beta testers wanted **on-demand** help, not always-visible instructions. Static text:
- Clutters UI for experienced users
- Increases cognitive load
- Doesn't respect dismissal preferences

Collapsible/dismissible components give power users clean interface while supporting new users.

---

## Help Content Guidelines

### Writing Style
- **Short sentences** (6-12 words per sentence, matching Ms. Sonoma style)
- **One idea per sentence** - Don't combine concepts
- **Active voice** - "Click the calendar icon" not "The calendar icon can be clicked"
- **Concrete examples** - "Check Math on Monday, Wednesday, Friday" not "Select subjects for days"
- **No jargon** - "Lesson outlines" not "Curriculum data structures"

### Content Structure
- **Title**: 2-5 words describing the feature
- **First sentence**: What it does (outcome)
- **Second sentence**: When/why to use it (context)
- **Optional third**: Example or caveat

Example:
```jsx
<InlineExplainer title="Weekly Pattern">
  <p>Check the subjects you want to teach on each day.</p>
  <p>This pattern repeats every week for the duration you specify.</p>
  <p>Example: Check "Math" on Monday, Wednesday, Friday to schedule 3 math lessons per week.</p>
</InlineExplainer>
```

### What to Explain

**Explain:**
- Workflows spanning multiple actions (plan → review → generate → schedule)
- Differences between similar features (Scheduler vs Planner, Play vs Work timers)
- Non-obvious consequences (editing scheduled lesson affects all dates)
- Technical concepts users must understand (phases, timers, targets)

**Don't explain:**
- Standard UI patterns (dropdowns, checkboxes, buttons)
- Self-evident actions ("Click Save to save")
- Features with external documentation linked elsewhere

---

## Recent Changes

**2025-12-15**: Removed "Don't show again" functionality. Help is now fully voluntary - users click ❓ to view, click backdrop/X to close. No localStorage persistence needed. Simplified component state.

**2025-12-15**: Fixed modal overlay rendering using React Portal and inline styles instead of Tailwind classes. Modals now properly display above page content with backdrop.

**2025-12-15**: Unified both help components to use ❓ emoji. WorkflowGuide and InlineExplainer now use identical button styling for consistency. Both open centered modal overlays with backdrop on click.

**2025-12-15**: Updated InlineExplainer to use modal overlay instead of positioned tooltip. Changed button from blue circle with SVG icon to ❓ emoji. Removed placement prop (no longer needed). Modal centers on screen with backdrop, preventing layout issues and overflow problems.

**2025-12-15**: Initial implementation of help system. Added InlineExplainer, WorkflowGuide, PageHeader components. Deployed help content to calendar, learners, lessons pages. Created this brain file.

---

## Future Considerations

### Potential Enhancements
1. **Help search/index** - If help content grows, add searchable help page with all topics
2. **Video tutorials** - Screen recordings embedded in WorkflowGuide for complex workflows
3. **Contextual tips** - First-time user detection to auto-open certain guides
4. **Analytics (optional)** - Track which help topics are accessed most (if user consents)

### Expansion Points
- Account settings pages (PIN setup, 2FA, preferences)
- Mr. Mentor page (natural language commands)
- Hotkeys configuration
- Learner transcript analysis

### Maintenance
- Review help content quarterly against beta feedback
- Update when workflows change (e.g., new planner features)
- Remove help for features that become self-evident after redesign
- Keep help content in sync with actual UI behavior (no drift)

---

## Related Brain Files

- **calendar-lesson-planning.md** - Automated planning backend logic (planner workflow backend)
- **timer-system.md** - Phase timer mechanics (what timers control in lessons)
- **pin-protection.md** - Facilitator section gating (why PIN checks appear)
- **beta-program.md** - Tutorial system (complementary to help system)
