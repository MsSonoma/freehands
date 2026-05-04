'use client'

import { useState, useRef } from 'react'

export default function VoiceStudioPage() {
  const [text, setText] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [audioUrl, setAudioUrl] = useState(null)
  const [filename, setFilename] = useState('sonoma-voice.mp3')
  const [errorMsg, setErrorMsg] = useState('')
  const audioRef = useRef(null)

  async function handleSynthesize() {
    const trimmed = text.trim()
    if (!trimmed) return
    setStatus('loading')
    setAudioUrl(null)
    setErrorMsg('')
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      })
      const data = await res.json()
      if (!data.audio) throw new Error(data.error || 'No audio returned')
      // data.audio is "data:audio/mp3;base64,..."
      setAudioUrl(data.audio)
      setStatus('ready')
      // Auto-play
      setTimeout(() => { audioRef.current?.play() }, 50)
    } catch (e) {
      setErrorMsg(e.message || 'Synthesis failed')
      setStatus('error')
    }
  }

  function handleDownload() {
    if (!audioUrl) return
    // Convert data URL to blob and trigger download
    const base64 = audioUrl.split(',')[1]
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: 'audio/mpeg' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || 'sonoma-voice.mp3'
    a.click()
    URL.revokeObjectURL(url)
  }

  const charCount = text.length
  const overLimit = charCount > 4800

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0f0f',
      color: '#e8e8e8',
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '48px 24px',
    }}>
      <div style={{ width: '100%', maxWidth: 720 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: '#fff' }}>
          Ms. Sonoma — Voice Studio
        </h1>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 32 }}>
          Internal tool · en-GB-Neural2-F · {'\u00A0'}
          <span style={{ color: overLimit ? '#e55' : '#666' }}>{charCount}/4800 chars</span>
        </p>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Enter the text you want Ms. Sonoma to read…"
          rows={10}
          style={{
            width: '100%',
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: 8,
            color: '#e8e8e8',
            fontSize: 15,
            lineHeight: 1.6,
            padding: '14px 16px',
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        {/* Filename row */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16, alignItems: 'center' }}>
          <label style={{ fontSize: 13, color: '#888', whiteSpace: 'nowrap' }}>Save as:</label>
          <input
            value={filename}
            onChange={e => setFilename(e.target.value)}
            style={{
              flex: 1,
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: 6,
              color: '#e8e8e8',
              fontSize: 13,
              padding: '6px 10px',
              outline: 'none',
            }}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button
            onClick={handleSynthesize}
            disabled={!text.trim() || status === 'loading' || overLimit}
            style={{
              background: status === 'loading' ? '#333' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 24px',
              fontSize: 15,
              fontWeight: 600,
              cursor: status === 'loading' || !text.trim() ? 'not-allowed' : 'pointer',
              opacity: (!text.trim() || overLimit) ? 0.5 : 1,
              transition: 'background 0.15s',
            }}
          >
            {status === 'loading' ? 'Synthesizing…' : '▶ Synthesize'}
          </button>

          {status === 'ready' && audioUrl && (
            <button
              onClick={handleDownload}
              style={{
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 24px',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ↓ Download MP3
            </button>
          )}
        </div>

        {/* Error */}
        {status === 'error' && (
          <p style={{ marginTop: 16, color: '#e55', fontSize: 14 }}>
            Error: {errorMsg}
          </p>
        )}

        {/* Audio player */}
        {status === 'ready' && audioUrl && (
          <div style={{ marginTop: 28 }}>
            <audio
              ref={audioRef}
              controls
              src={audioUrl}
              style={{ width: '100%', accentColor: '#2563eb' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
