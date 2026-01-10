'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LessonMakerRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/facilitator/generator')
  }, [router])

  return (
    <main style={{ padding: 24 }}>
      <p>Redirecting...</p>
    </main>
  )
}
