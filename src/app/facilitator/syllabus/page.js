import { redirect } from 'next/navigation'

// Compatibility only: the full Syllabus lives at /facilitator.
export default async function LegacySyllabusPage({ searchParams }) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries((await searchParams) || {})) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (entry != null) params.append(key, String(entry))
    }
  }
  const query = params.toString()
  redirect(query ? `/facilitator?${query}` : '/facilitator')
}
