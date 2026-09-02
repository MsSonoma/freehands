import { redirect } from 'next/navigation'

export default async function LegacyFollowUpRedirect({ params }) {
  const { runId } = await params
  redirect(`/session/slate?reviewRunId=${encodeURIComponent(String(runId || ''))}`)
}
