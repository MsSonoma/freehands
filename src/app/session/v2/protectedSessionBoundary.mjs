export async function requireProtectedSessionCreation(startSession) {
  const result = await startSession()
  if (result?.conflict) return result
  if (!result?.id) {
    throw new Error('Unable to confirm this lesson session. Return to the Syllabus and try again.')
  }
  return result
}
