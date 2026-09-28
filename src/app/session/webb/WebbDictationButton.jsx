'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const WEBB_STT_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
]

export function chooseWebbSpeechMimeType(MediaRecorderCtor = typeof MediaRecorder !== 'undefined' ? MediaRecorder : null) {
  if (!MediaRecorderCtor) return ''
  const supports = typeof MediaRecorderCtor.isTypeSupported === 'function'
    ? (type) => MediaRecorderCtor.isTypeSupported(type)
    : () => false
  return WEBB_STT_MIME_TYPES.find(type => {
    try { return supports(type) } catch { return false }
  }) || ''
}

export default function WebbDictationButton({
  disabled = false,
  compact = false,
  onBeforeRecord,
  onTranscript,
  onActivity,
}) {
  const [recording, setRecording] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const stopTimerRef = useRef(null)
  const abortRef = useRef(null)

  const cleanupStream = useCallback(() => {
    try { streamRef.current?.getTracks?.().forEach(track => track.stop()) } catch {}
    streamRef.current = null
  }, [])

  const transcribe = useCallback(async (blob) => {
    if (!blob?.size) {
      setError('No speech detected')
      return
    }
    setUploading(true)
    setError('')
    try {
      const type = String(blob.type || '').toLowerCase()
      const extension = type.includes('ogg') ? 'ogg' : 'webm'
      const body = new FormData()
      body.append('audio', blob, `webb-dictation.${extension}`)
      body.append('language', 'en-US')
      const controller = new AbortController()
      abortRef.current = controller
      const response = await fetch('/api/stt', { method: 'POST', body, signal: controller.signal })
      if (!response.ok) throw new Error('Speech transcription failed')
      const data = await response.json()
      const transcript = String(data?.transcript || '').trim()
      if (!transcript) {
        setError('No speech detected')
        return
      }
      onActivity?.()
      onTranscript?.(transcript)
    } catch (cause) {
      if (cause?.name !== 'AbortError') setError('Could not transcribe')
    } finally {
      abortRef.current = null
      setUploading(false)
    }
  }, [onActivity, onTranscript])

  const stopRecording = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop() } catch {}
    }
    setRecording(false)
  }, [])

  const startRecording = useCallback(async () => {
    if (disabled || recording || uploading) return
    setError('')
    onBeforeRecord?.()
    try {
      if (!navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('Voice input unavailable')
      }
      const mimeType = chooseWebbSpeechMimeType(MediaRecorder)
      if (!mimeType) throw new Error('Voice input unavailable')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType })
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = event => {
        if (event.data?.size) chunksRef.current.push(event.data)
      }
      recorder.onstart = () => {
        onActivity?.()
        setRecording(true)
      }
      recorder.onerror = () => {
        setRecording(false)
        setError('Recording failed')
        cleanupStream()
      }
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType })
        recorderRef.current = null
        cleanupStream()
        await transcribe(blob)
      }
      recorder.start()
      stopTimerRef.current = setTimeout(stopRecording, 30000)
    } catch (cause) {
      cleanupStream()
      setRecording(false)
      setError(cause?.name === 'NotAllowedError' ? 'Mic permission denied' : 'Voice input unavailable')
    }
  }, [cleanupStream, disabled, onActivity, onBeforeRecord, recording, stopRecording, transcribe, uploading])

  const toggleRecording = useCallback(() => {
    if (recording) stopRecording()
    else void startRecording()
  }, [recording, startRecording, stopRecording])

  useEffect(() => () => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
    try { abortRef.current?.abort() } catch {}
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop() } catch {}
    }
    cleanupStream()
  }, [cleanupStream])

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={toggleRecording}
        aria-label={recording ? 'Stop voice input' : 'Use voice input'}
        aria-pressed={recording}
        title={recording ? 'Tap to stop' : 'Tap to talk without opening the keyboard'}
        style={{
          width: compact ? 34 : 38,
          height: compact ? 34 : 38,
          borderRadius: 999,
          border: recording ? '2px solid #ef4444' : '1px solid #99f6e4',
          background: recording ? '#fee2e2' : '#f0fdfa',
          color: recording ? '#b91c1c' : '#0f766e',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled || uploading ? 'default' : 'pointer',
          opacity: disabled ? 0.45 : 1,
          fontSize: compact ? 16 : 18,
          padding: 0,
          fontFamily: 'inherit',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
        }}
      >
        {uploading ? '…' : recording ? '■' : '🎤'}
      </button>
      {error && !compact && (
        <span role="status" style={{ maxWidth: 120, fontSize: 10, lineHeight: 1.15, color: '#b91c1c' }}>
          {error}
        </span>
      )}
    </span>
  )
}
