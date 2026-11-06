'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getReusableMicrophoneStream, pauseReusableMicrophoneStream } from '../utils/microphoneSession'

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
  const [starting, setStarting] = useState(false)
  const startingRef = useRef(false)
  const mountedRef = useRef(true)
  const requestTokenRef = useRef(0)
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const stopTimerRef = useRef(null)
  const abortRef = useRef(null)

  const cleanupStream = useCallback(() => {
    pauseReusableMicrophoneStream(streamRef.current)
    streamRef.current = null
  }, [])

  const transcribe = useCallback(async (blob) => {
    if (!mountedRef.current) return
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
      // A bounded request prevents the microphone from appearing stuck forever.
      const timeout = setTimeout(() => controller.abort(), 50000)
      let response
      try { response = await fetch('/api/stt', { method: 'POST', body, signal: controller.signal }) }
      finally { clearTimeout(timeout) }
      if (!mountedRef.current) return
      if (!response.ok) {
        const temporary = response.status === 503 || response.status === 504 || response.status === 429
        setError(temporary ? 'Speech service busy. Tap mic to retry.' : 'Could not transcribe. Tap mic to retry.')
        return
      }
      const data = await response.json()
      if (!mountedRef.current) return
      const transcript = String(data?.transcript || '').trim()
      if (!transcript) {
        setError('No speech detected')
        return
      }
      onActivity?.()
      onTranscript?.(transcript)
    } catch (cause) {
      if (!mountedRef.current) return
      setError(cause?.name === 'AbortError' ? 'Transcription timed out. Tap mic to retry.' : 'Could not transcribe. Tap mic to retry.')
    } finally {
      abortRef.current = null
      if (mountedRef.current) setUploading(false)
    }
  }, [onActivity, onTranscript])

  const stopRecording = useCallback(() => {
    // Cancels microphone permission requests that have not resolved yet.
    requestTokenRef.current += 1
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
    if (disabled || recording || uploading || startingRef.current || recorderRef.current) return
    startingRef.current = true
    const requestToken = ++requestTokenRef.current
    setStarting(true)
    setError('')
    try {
      onBeforeRecord?.()
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function' || typeof MediaRecorder === 'undefined') {
        throw new Error('Voice input unavailable')
      }
      const mimeType = chooseWebbSpeechMimeType(MediaRecorder)
      if (!mimeType) throw new Error('Voice input unavailable')
      const stream = await getReusableMicrophoneStream()
      if (!mountedRef.current || disabledRef.current || requestToken !== requestTokenRef.current) {
        pauseReusableMicrophoneStream(stream)
        return
      }
      streamRef.current = stream
      const releaseStream = () => {
        if (streamRef.current === stream) streamRef.current = null
        pauseReusableMicrophoneStream(stream)
      }
      const recorder = new MediaRecorder(stream, { mimeType })
      recorderRef.current = recorder
      let recorderFailed = false
      chunksRef.current = []
      recorder.ondataavailable = event => {
        if (event.data?.size) chunksRef.current.push(event.data)
      }
      recorder.onstart = () => {
        if (!mountedRef.current || disabledRef.current || requestToken !== requestTokenRef.current) {
          try { recorder.stop() } catch {}
          return
        }
        onActivity?.()
        setRecording(true)
      }
      recorder.onerror = () => {
        recorderFailed = true
        if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
        stopTimerRef.current = null
        if (recorderRef.current === recorder) recorderRef.current = null
        setRecording(false)
        setError('Recording failed. Tap mic to retry.')
        releaseStream()
      }
      recorder.onstop = async () => {
        if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
        stopTimerRef.current = null
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType })
        if (recorderRef.current === recorder) recorderRef.current = null
        releaseStream()
        if (!recorderFailed && mountedRef.current && !disabledRef.current) await transcribe(blob)
      }
      recorder.start()
      stopTimerRef.current = setTimeout(stopRecording, 30000)
    } catch (cause) {
      recorderRef.current = null
      cleanupStream()
      setRecording(false)
      if (mountedRef.current) setError(['NotAllowedError', 'SecurityError'].includes(cause?.name) ? 'Mic permission denied' : 'Voice input unavailable')
    } finally {
      startingRef.current = false
      if (mountedRef.current) setStarting(false)
    }
  }, [cleanupStream, disabled, onActivity, onBeforeRecord, recording, stopRecording, transcribe, uploading])

  const toggleRecording = useCallback(() => {
    if (recording) stopRecording()
    else void startRecording()
  }, [recording, startRecording, stopRecording])

  // Disabling input (e.g. while judging an answer) must not leave the mic
  // recording or allow a late permission grant to turn it back on.
  useEffect(() => {
    if (disabled) stopRecording()
  }, [disabled, stopRecording])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestTokenRef.current += 1
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
      try { abortRef.current?.abort() } catch {}
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        try { recorder.stop() } catch {}
      }
      cleanupStream()
    }
  }, [cleanupStream])

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <button
        type="button"
        disabled={disabled || uploading || starting}
        onClick={toggleRecording}
        aria-label={recording ? 'Stop voice input' : starting ? 'Connecting microphone' : 'Use voice input'}
        aria-pressed={recording}
        title={recording ? 'Tap to stop' : starting ? 'Connecting microphone' : 'Tap to talk without opening the keyboard'}
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
          cursor: disabled || uploading || starting ? 'default' : 'pointer',
          opacity: disabled ? 0.45 : 1,
          fontSize: compact ? 16 : 18,
          padding: 0,
          fontFamily: 'inherit',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
        }}
      >
        {uploading || starting ? '…' : recording ? '■' : '🎤'}
      </button>
      {error && !compact && (
        <span role="status" style={{ maxWidth: 120, fontSize: 10, lineHeight: 1.15, color: '#b91c1c' }}>
          {error}
        </span>
      )}
    </span>
  )
}
