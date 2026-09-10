'use client'

export default function FeatureHelpToast({ suggestion, onConfirm, onDismiss }) {
  if (!suggestion?.features?.length) return null
  const features = suggestion.features.slice(0, 3)
  const single = features.length === 1
  return (
    <div role="status" aria-live="polite" style={{ position:'fixed', top:'max(18px, env(safe-area-inset-top, 0px))', right:18, zIndex:10050, width:'min(340px, calc(100vw - 36px))', background:'#fffdf8', border:'1px solid #ded8cb', borderRadius:12, boxShadow:'0 12px 34px rgba(45,41,36,.18)', padding:'13px 14px 12px', color:'#2d2924', fontFamily:'Arial, Helvetica, sans-serif' }}>
      <button type="button" onClick={onDismiss} aria-label="Ignore feature suggestion and continue normally" title="Ignore and continue" style={{ position:'absolute', top:7, right:8, border:0, background:'transparent', color:'#746b62', cursor:'pointer', fontSize:20, lineHeight:1, padding:5 }}>×</button>
      <div style={{ paddingRight:28, fontSize:13, lineHeight:1.35, fontWeight:700 }}>{single ? 'Are you asking about this feature?' : 'Which feature are you asking about?'}</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginTop:10 }}>
        {features.map(feature => <button key={feature.id} type="button" onClick={() => onConfirm?.(feature.id)} style={{ border:'1px solid #c7442e', background:'#c7442e', color:'#fff', borderRadius:999, padding:'7px 11px', fontSize:13, fontWeight:700, cursor:'pointer' }}>{single ? `Yes, ${feature.title}` : feature.title}</button>)}
        <button type="button" onClick={onDismiss} style={{ border:'1px solid #d6d0c5', background:'#fff', color:'#655d54', borderRadius:999, padding:'7px 11px', fontSize:13, fontWeight:600, cursor:'pointer' }}>Not this</button>
      </div>
    </div>
  )
}
