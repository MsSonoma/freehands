# Mr. Mentor Multi-Screen Overlay System

## Overview
The Mr. Mentor interface now includes a multi-screen overlay system that allows users to switch between the video and different tool views without leaving the counselor page.

## Features Implemented

### 1. **Screen Toggle Buttons**
Located on the same row as the "Discussing learner" dropdown, five buttons allow switching between different views:
- **👨‍🏫 Mr. Mentor**: Default video view
- **📚 Lessons**: Facilitator lessons list (scrollable)
- **📅 Calendar**: Lesson calendar panel
- **✨ Generated**: Generated lessons list (scrollable)
- **🎨 Maker**: Lesson creation form

### 2. **Overlay Components**
All overlay components are designed to fit in the video screen area and match the half-screen format:

#### CalendarOverlay (`overlays/CalendarOverlay.jsx`)
- Shows only the calendar panel (not the scheduling panel)
- Learner selector at the top
- Month/year navigation
- Visual indicators for scheduled lessons
- Shows scheduled lessons for selected date

#### LessonsOverlay (`overlays/LessonsOverlay.jsx`)
- Learner selector
- Subject-based expandable sections
- Grade filters per subject
- Shows approved lessons, medals, and progress
- Fully scrollable list

#### GeneratedLessonsOverlay (`overlays/GeneratedLessonsOverlay.jsx`)
- Subject and grade filters
- Status indicators (approved, needs update)
- Scrollable lesson list
- Color-coded by status

#### LessonMakerOverlay (`overlays/LessonMakerOverlay.jsx`)
- Compact lesson generation form
- Quota display
- All fields from the full lesson maker
- Inline success/error messages
- Scrollable form

### 3. **State Management**
- `activeScreen` state tracks which view is currently displayed
- Default is 'mentor' (video view)
- Screen state is independent of conversation state
- All overlays receive necessary props (learnerId, learners, tier, etc.)

### 4. **Visual Design**
- Buttons use emoji icons for quick recognition
- Active button has blue border and light blue background
- Inactive buttons have gray border and white background
- All overlays use consistent styling with gradient headers
- Fully responsive and scrollable

## File Structure
```
src/app/facilitator/tools/counselor/
├── CounselorClient.jsx (main component - updated)
├── ClipboardOverlay.jsx (existing)
└── overlays/
    ├── CalendarOverlay.jsx (new)
    ├── LessonsOverlay.jsx (new)
    ├── GeneratedLessonsOverlay.jsx (new)
    └── LessonMakerOverlay.jsx (new)
```

## Usage

1. **Viewing Different Screens**: Click any of the emoji buttons to switch between views
2. **Learner Selection**: Available in most overlays; syncs with the main dropdown
3. **Returning to Video**: Click the 👨‍🏫 button to return to Mr. Mentor video

## Technical Details

### Props Flow
- `learners` array passed from parent to overlays
- `selectedLearnerId` synced across all components
- `tier` passed to LessonMaker for quota checks
- All overlays handle their own data fetching

### Responsive Behavior
- Overlays fill the entire video panel area
- Scrollable content areas for long lists
- Compact headers to maximize content space
- Works in both portrait and landscape modes

## Future Enhancements (Optional)
- Add keyboard shortcuts for screen switching
- Persist active screen preference to localStorage
- Add transition animations between screens
- Add quick actions (e.g., schedule directly from generated lessons)
- Replace placeholder Mr. Mentor emoji with actual video thumbnail

## Testing Checklist
- ✅ No build errors
- ⏳ Test screen switching in browser
- ⏳ Verify all overlays load data correctly
- ⏳ Test learner selection sync
- ⏳ Verify scrolling works in all overlays
- ⏳ Test in mobile landscape mode
- ⏳ Verify lesson maker form submission
- ⏳ Check calendar date selection and lesson display
