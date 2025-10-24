"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensurePinAllowed } from '@/app/lib/pinGate';
import HotkeysManager from '@/components/HotkeysManager'

export default function FacilitatorHotkeysPage() {
  const router = useRouter();
  const [pinChecked, setPinChecked] = useState(false);

  // Check PIN requirement on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const allowed = await ensurePinAllowed('facilitator-page');
        if (!allowed) {
          router.push('/');
          return;
        }
        if (!cancelled) setPinChecked(true);
      } catch (e) {
        if (!cancelled) setPinChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (!pinChecked) {
    return <main style={{ padding: 20 }}><p>Loading…</p></main>;
  }

  return (
    <main style={{ padding: 20 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:12 }}>
        <h1 style={{ fontSize:24, fontWeight:800 }}>Hotkeys</h1>
      </div>
      <p style={{ color:'#6b7280', marginBottom:8 }}>Customize your keyboard shortcuts. These save to your account when possible and also locally.</p>
      <div style={{ border:'1px solid #e5e7eb', borderRadius:12, padding:8 }}>
        <HotkeysManager />
      </div>
    </main>
  )
}
