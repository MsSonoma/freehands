export const metadata = { title: 'Help' }

import { Suspense } from 'react'
import CounselorClient from '../generator/counselor/CounselorClient'

export default function FacilitatorHelpPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}><p>Loading Help...</p></main>}>
      <CounselorClient />
    </Suspense>
  )
}
