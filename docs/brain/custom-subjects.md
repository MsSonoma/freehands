# Custom Subjects (Per Facilitator)

## How It Works

- Custom subjects are stored in the Supabase table `custom_subjects` and are scoped to a single facilitator via `facilitator_id`.
- The canonical API surface is `GET/POST/DELETE /api/custom-subjects`.
  - `GET` returns `{ subjects: [...] }` ordered by `display_order` then `name`.
  - `POST` creates a subject for the authenticated facilitator.
  - `DELETE` deletes a subject only if it belongs to the authenticated facilitator.
- Client surfaces that need subject dropdown options should treat subjects as:
  - Core subjects (universal): `math`, `science`, `language arts`, `social studies`, `general`.
  - Custom subjects (per facilitator): fetched from `/api/custom-subjects` using the facilitator session token.
  - Special subject `generated` is a UI bucket used in some facilitator/Mr. Mentor views (not a custom subject). In the Mr. Mentor lessons overlay, `generated` is intentionally not shown as a subject dropdown option.
- Shared client hook:
  - `useFacilitatorSubjects()` fetches custom subjects for the signed-in facilitator and returns merged dropdown-ready lists.

## What NOT To Do

- Do not make custom subjects global. They must remain per-facilitator (`custom_subjects.facilitator_id`).
- Do not fetch public lesson lists for custom subjects. Only core subjects have public lesson endpoints (`/api/lessons/[subject]`).
- Do not store custom subjects in browser storage as the source of truth.

## Key Files

- API
  - `src/app/api/custom-subjects/route.js`
- Shared subject utilities
  - `src/app/hooks/useFacilitatorSubjects.js`
  - `src/app/lib/subjects.js`
- UI surfaces that must reflect custom subjects
  - `src/app/facilitator/calendar/LessonPicker.js` (scheduler subject filter)
  - `src/app/facilitator/lessons/page.js` (lesson library subject filter)
  - `src/components/LessonEditor.jsx` (lesson subject field)
  - `src/app/facilitator/generator/page.js` (Lesson Maker)
  - `src/app/facilitator/generator/counselor/overlays/*` (Mr. Mentor overlays)
