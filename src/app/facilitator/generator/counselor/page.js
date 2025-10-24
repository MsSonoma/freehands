// Mr. Mentor - AI Counselor for Facilitators
export const metadata = { title: 'Mr. Mentor | Ms. Sonoma' }

import { Suspense } from 'react'
import CounselorClient from './CounselorClient'

export default function CounselorPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}><p>Loading Mr. Mentor...</p></main>}>
      <CounselorClient />
    </Suspense>
  )
}
