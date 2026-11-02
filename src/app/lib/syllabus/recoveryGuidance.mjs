// Messages describe the application's state, never assign fault to the facilitator.
export function syllabusRecoveryGuidance(error) {
  const raw = String(error || '')
  if (/timeout|took too long|generat|model|forecast/i.test(raw)) return 'Ms. Sonoma could not finish preparing the lesson or suggestions. You can retry, create a lesson yourself, or use one you already approved.'
  if (/holiday|day.off|no.school/i.test(raw)) return 'This date is marked as a day off. Open its day options to remove the mark before placing a lesson here.'
  if (/revis|stale|superseded|changed|conflict|ambiguous|receipt|artifact|lineage|recover|identity|binding/i.test(raw)) return 'The Syllabus changed while Ms. Sonoma was working. Refresh to load the current version, then choose your lesson action again. Your previously saved work is not deleted.'
  if (/quota|upgrade|entitlement|plan.*required|access/i.test(raw)) return 'This action is not available with the current account access. You can use the Syllabus controls still available or review your plan options.'
  if (/not found|unauthorized|forbidden|learner/i.test(raw)) return 'Ms. Sonoma could not confirm access to this lesson. Check the selected learner and refresh the Syllabus.'
  return 'Ms. Sonoma could not complete that action. Refresh the Syllabus, or choose an available lesson action below. Previously saved work is not deleted.'
}
