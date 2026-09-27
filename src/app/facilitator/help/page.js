export const metadata = { title: 'Ms. Sonoma | Facilitator Help' }

import { Suspense } from 'react'
import CounselorClient from '../generator/counselor/CounselorClient'

export default function FacilitatorHelpPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}><p>Loading Ms. Sonoma...</p></main>}>
      <CounselorClient />
    </Suspense>
  )
}
