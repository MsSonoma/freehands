'use client'
import { useRouter } from 'next/navigation'
import LegalFooter from '@/components/LegalFooter'
import LearnerSelector from '@/app/learn/LearnerSelector'

export default function SelectLearner() {
  const r = useRouter()

  return (
    <div style={{ minHeight:'calc(100dvh - 64px)', display:'flex', flexDirection:'column' }}>
      <main style={{ flex:'1 0 auto', display:'grid', placeItems:'center', padding:24 }}>
        <div style={{ width:'100%', maxWidth:520, textAlign:'center' }}>
          <h1>Select Learner</h1>
          <div style={{ marginTop:12 }}>
            <LearnerSelector
              onSelect={(learner) => {
                // LearnerSelector already handles localStorage setting
                r.push('/learn')
              }}
            />
          </div>
        </div>
      </main>
      <LegalFooter />
    </div>
  )
}
