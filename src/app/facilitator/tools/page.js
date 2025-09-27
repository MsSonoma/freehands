// Facilitator Tools
export const metadata = { title: 'Tools | Ms. Sonoma' }

import { Suspense } from 'react'
import ClientTools from './ClientTools'

export default function FacilitatorToolsPage(){
  return (
    <Suspense fallback={<main style={{ padding:24 }}><p>Loading…</p></main>}> 
      <ClientTools />
    </Suspense>
  )
}
