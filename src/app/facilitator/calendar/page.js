'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CalendarPage() {
  const router = useRouter()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.delete('tab')
    params.set('view', 'month')
    const query = params.toString()
    router.replace(`/facilitator${query ? `?${query}` : ''}`)
  }, [router])

  return <main style={{ maxWidth: 980, margin: '0 auto', padding: 20 }}><p>Opening Syllabus month view...</p></main>
}
