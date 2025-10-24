// Facilitator Generator
export const metadata = { title: 'Generator | Ms. Sonoma' }

import { Suspense } from 'react'
import ClientGenerator from './ClientGenerator'

export default function FacilitatorGeneratorPage(){
  return (
    <Suspense fallback={<main style={{ padding:24 }}><p>Loading…</p></main>}> 
      <ClientGenerator />
    </Suspense>
  )
}
