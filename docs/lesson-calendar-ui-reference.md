# Lesson Calendar - Visual Interface Reference

## Main Calendar Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Hub                                                   │
│                                                                   │
│  Lesson Calendar                                                 │
│  Schedule lessons for specific dates. Lessons automatically      │
│  appear on the learner's page on scheduled days.                 │
├─────────────────────────────────────────────────────────────────┤
│  Select Learner: [Emma (Grade 4) ▼]                             │
├──────────────────────────────────┬──────────────────────────────┤
│                                  │                              │
│  ┌─ CALENDAR ─────────────────┐ │ ┌─ LESSON PICKER ──────────┐│
│  │  ← Prev  October 2025  Next→│ │ │ Schedule Lessons for     ││
│  │                              │ │ │ October 21, 2025         ││
│  ├─────────────────────────────┤ │ ├──────────────────────────┤│
│  │ S  M  T  W  T  F  S         │ │ │ [Search lessons...]      ││
│  │                              │ │ │                          ││
│  │       1  2  3  4  5          │ │ │ [All] [Math] [Science]  ││
│  │ 6  7  8  9 10 11 12          │ │ │ [Language] [Social]     ││
│  │13 14 15 16 17 18 19          │ │ ├──────────────────────────┤│
│  │20 [21] 22 23 24 25 26        │ │ │ ✓ Addition Basics        ││
│  │    ②                         │ │ │   Math                   ││
│  │27 28 29 30 31                │ │ │   [✓ Scheduled]          ││
│  │                              │ │ │                          ││
│  │ Legend:                      │ │ │ □ Multiplication Tables  ││
│  │ [==] Today                   │ │ │   Math                   ││
│  │ [..] Has lessons             │ │ │   [Schedule]             ││
│  │ [##] Selected                │ │ │                          ││
│  └──────────────────────────────┘ │ └──────────────────────────┘│
│                                  │                              │
│                                  │ ┌─ SCHEDULED FOR DATE ─────┐│
│                                  │ │ Scheduled for Oct 21      ││
│                                  │ ├──────────────────────────┤│
│                                  │ │ Addition Basics          ││
│                                  │ │ Math        [Remove]     ││
│                                  │ │                          ││
│                                  │ │ Solar System             ││
│                                  │ │ Science     [Remove]     ││
│                                  │ └──────────────────────────┘│
└──────────────────────────────────┴──────────────────────────────┘
```

## Calendar Cell States

```
┌────────┐  Normal day (no lessons)
│   15   │
└────────┘

┌────────┐  Today (blue border)
║   21   ║
╚════════╝

┌────────┐  Selected (blue background)
│▓▓ 21 ▓▓│
└────────┘

┌────────┐  Has scheduled lessons (green background, badge)
│   15   │
│   (3)  │  ← Lesson count badge
└────────┘

┌────────┐  Past date (gray text)
│   10   │
└────────┘
```

## Lesson Picker States

```
┌──────────────────────────────────┐
│ Addition Basics                  │
│ Math                             │  ← Not scheduled
│ [Schedule]                       │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ Multiplication Tables            │
│ Math                             │  ← Already scheduled
│ [✓ Scheduled]                    │     (disabled state)
└──────────────────────────────────┘
```

## Scheduled List Item

```
┌──────────────────────────────────┐
│ Solar System              [Remove]│
│ Science                           │
└──────────────────────────────────┘
```

## Color Scheme

- **Today**: Blue border (#3B82F6)
- **Selected**: Blue background (#DBEAFE)
- **Has Lessons**: Green tint (#F0FDF4) with green badge (#10B981)
- **Past Date**: Gray text (#9CA3AF)
- **Scheduled Button**: Green (#10B981)
- **Remove Button**: Red text (#DC2626)

## Interactions

### Calendar
- **Click date** → Select for scheduling
- **← Prev / Next →** → Navigate months
- **Badge number** → Shows lesson count

### Lesson Picker
- **Search box** → Filter by name
- **Subject buttons** → Filter by subject
- **Schedule button** → Add lesson to selected date
- **✓ Scheduled** → Indicates already scheduled (disabled)

### Scheduled List
- **Remove button** → Unschedule lesson from date

## Responsive Behavior

**Desktop (≥1024px)**
```
┌──────────────────────────────────┐
│  [Calendar]  │  [Picker + List]  │
└──────────────────────────────────┘
```

**Mobile (<1024px)**
```
┌──────────────────┐
│   [Calendar]     │
├──────────────────┤
│   [Picker]       │
├──────────────────┤
│   [List]         │
└──────────────────┘
```

## Premium Gate

If user lacks `facilitatorTools` entitlement:

```
┌─────────────────────────────────┐
│                                 │
│      Premium Feature            │
│                                 │
│  The Lesson Calendar is a      │
│  premium facilitator tool.     │
│  Upgrade your plan to access.  │
│                                 │
│      [View Plans]               │
│                                 │
└─────────────────────────────────┘
```

## Loading States

**Initial Load**
```
Loading...
```

**No Learners**
```
┌─────────────────────────────────┐
│  No learners found.             │
│  Add learners first.            │
│                                 │
│  [Manage Learners]              │
└─────────────────────────────────┘
```

**No Approved Lessons**
```
┌─────────────────────────────────┐
│  No approved lessons found.     │
│  Approve lessons in the         │
│  Lessons page first.            │
└─────────────────────────────────┘
```

## User Feedback

**Success Messages**
- "Lesson scheduled successfully!"
- Badge count updates immediately
- Scheduled list refreshes

**Error States**
- "Please select a date first"
- "Failed to schedule lesson"
- "Failed to remove lesson"

## Accessibility

- Keyboard navigation for calendar grid
- ARIA labels on buttons
- Focus indicators on interactive elements
- Screen reader friendly date announcements
