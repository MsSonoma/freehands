"use client";
import HotkeysManager from '@/components/HotkeysManager'

export default function FacilitatorHotkeysPage() {
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
