"use client";
import { useEffect, useState } from 'react'
import { DEFAULT_HOTKEYS, getHotkeysLocal, setHotkeysLocal, fetchHotkeysServer, saveHotkeysServer } from '@/app/lib/hotkeys'

export default function HotkeysManager() {
  const [loading, setLoading] = useState(true)
  const [hotkeys, setHotkeys] = useState(() => getHotkeysLocal())
  const [serverHotkeys, setServerHotkeys] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [recordingField, setRecordingField] = useState(null)

  const BRAND_ACCENT = '#c7442e'
  const BRAND_ACCENT_HOVER = '#b23b2a'

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetchHotkeysServer()
        if (res?.ok && res.hotkeys) {
          if (!cancelled) {
            setHotkeys(prev => ({ ...prev, ...res.hotkeys }))
            setServerHotkeys(res.hotkeys)
          }
        }
      } catch {}
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const isModifierCode = (code) => [
    'ShiftLeft','ShiftRight','ControlLeft','ControlRight','AltLeft','AltRight',
    'MetaLeft','MetaRight','CapsLock','NumLock','ScrollLock','Fn','FnLock','Hyper','Super'
  ].includes(code)

  useEffect(() => {
    if (!recordingField) return
    const onKeyDown = (e) => {
      const code = e.code || e.key
      if (!code || code === 'Unidentified') return
      if (code === 'Escape') {
        e.preventDefault()
        setHotkeys(h => ({ ...h, [recordingField]: '' }))
        setRecordingField(null)
        return
      }
      if (isModifierCode(code)) return
      e.preventDefault()
      setHotkeys(h => ({ ...h, [recordingField]: code }))
      setRecordingField(null)
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [recordingField])

  const fields = [
    { key:'beginSend', label:'Begin/Send' },
    { key:'micHold', label:'Mic (hold to record)' },
    { key:'skip', label:'Skip' },
    { key:'repeat', label:'Repeat' },
    { key:'muteToggle', label:'Mute toggle' },
    { key:'nextSentence', label:'Next Sentence (teaching)' },
    { key:'goButton', label:'Go Button (opening actions)' },
  ]

  const resetDefaults = () => {
    setHotkeys({ ...DEFAULT_HOTKEYS })
    setMsg('Defaults restored (not yet saved)')
  }

  if (loading) return <p>Loading…</p>

  return (
    <div style={{ display:'grid', gap:6, alignItems:'start', width: '100%' }}>
      <div style={{ display:'grid', gap:6 }}>
        {fields.map(f => {
          const isRec = recordingField === f.key
          return (
            <div key={f.key} style={{ display:'grid', gap:3 }}>
              <label style={{ color:'#374151', fontSize:14, display:'flex', alignItems:'center', gap:8 }}>
                <span>{f.label}</span>
                {isRec && <span style={{ fontSize:12, color:'#6b7280' }}>Recording… press a key (Esc to clear)</span>}
              </label>
              <div style={{ display:'flex', gap:5, alignItems:'center', flexWrap:'wrap' }}>
                <input
                  type="text"
                  value={hotkeys[f.key] ?? ''}
                  placeholder={DEFAULT_HOTKEYS[f.key] || ''}
                  onChange={(e)=> setHotkeys(h => ({ ...h, [f.key]: e.target.value }))}
                  style={{
                    padding:'6px 10px',
                    border:'1px solid #e5e7eb',
                    borderRadius:8,
                    width: 'clamp(40vw, calc((100vw * 2) / 3 - 100px), 50vw)',
                    maxWidth: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  onClick={() => setRecordingField(prev => prev === f.key ? null : f.key)}
                  title={isRec ? 'Stop recording' : 'Record this key'}
                  type="button"
                  onMouseEnter={(e)=>{ e.currentTarget.style.background = BRAND_ACCENT_HOVER; e.currentTarget.style.borderColor = BRAND_ACCENT_HOVER; }}
                  onMouseLeave={(e)=>{ const base = isRec ? BRAND_ACCENT_HOVER : BRAND_ACCENT; e.currentTarget.style.background = base; e.currentTarget.style.borderColor = base; }}
                  onFocus={(e)=>{ e.currentTarget.style.boxShadow = '0 0 0 3px rgba(199,68,46,0.25)'; }}
                  onBlur={(e)=>{ e.currentTarget.style.boxShadow = 'none'; }}
                  style={{ padding:'6px 10px', border:`1px solid ${isRec ? BRAND_ACCENT_HOVER : BRAND_ACCENT}`, borderRadius:8, background: isRec ? BRAND_ACCENT_HOVER : BRAND_ACCENT, color:'#fff', fontWeight:600 }}
                >
                  {isRec ? 'Stop' : 'Record'}
                </button>
                <button
                  onClick={() => setHotkeys(h => ({ ...h, [f.key]: '' }))}
                  type="button"
                  style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff' }}
                >
                  Clear
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
        <button
          onClick={async ()=>{
            setSaving(true); setMsg('')
            try {
              const cleaned = Object.fromEntries(Object.entries(hotkeys).map(([k,v]) => [k, (typeof v === 'string' ? v.trim() : '')]))
              const res = await saveHotkeysServer(cleaned)
              if (!res?.ok) { /* local still saves */ }
              setHotkeysLocal(cleaned)
              setServerHotkeys(cleaned)
              setMsg('Saved')
            } catch (e) {
              setMsg(e?.message || 'Failed to save')
            } finally { setSaving(false) }
          }}
          disabled={saving}
          style={{ padding:'6px 12px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff', fontWeight:600 }}
        >
          {saving ? 'Saving…' : 'Save hotkeys'}
        </button>
        <button
          onClick={resetDefaults}
          disabled={saving}
          style={{ padding:'6px 12px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff' }}
        >
          Restore defaults
        </button>
        {msg && <span style={{ color:'#374151' }}>{msg}</span>}
      </div>
      <p style={{ color:'#6b7280', fontSize:12, marginTop:2 }}>
        Tip: Click Record, press a key to capture its code. Use codes like Enter, ArrowLeft, NumpadAdd. Press Esc while recording to clear. Leave blank to disable.
      </p>
    </div>
  )
}
