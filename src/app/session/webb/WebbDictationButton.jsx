'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getReusableMicrophoneStream, pauseReusableMicrophoneStream } from '../utils/microphoneSession'
import { createSegmentedSpeechRecording } from '../utils/segmentedSpeechRecording.mjs'
import { transcribeSpeechSegments, replaySpeechSegments } from '../utils/speechTranscription.mjs'

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
  const [uploading, setUploading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [hasSavedAudio, setHasSavedAudio] = useState(false)
  const startingRef = useRef(false)
  const mountedRef = useRef(true)
  const requestTokenRef = useRef(0)
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled
  const recordingSessionRef = useRef(null)
  const streamRef = useRef(null)
  const micRequestControllerRef = useRef(null)
  const abortRef = useRef(null)
  const playbackAbortRef = useRef(null)
  const savedSegmentsRef = useRef(null)
  const transcriptCacheRef = useRef([])

  const cleanupStream = useCallback(() => {
    pauseReusableMicrophoneStream(streamRef.current)
    streamRef.current = null
  }, [])

  const transcribe = useCallback(async (segments) => {
    if (!mountedRef.current || !segments?.length) {
      if (mountedRef.current) setError('No speech recorded. Please try again.')
      return
    }
    savedSegmentsRef.current = segments
    setHasSavedAudio(true)
    setUploading(true)
    setError('')
    setProgress('Transcribing...')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const transcript = await transcribeSpeechSegments(segments, {
        transcripts: transcriptCacheRef.current,
        signal: controller.signal,
        onProgress: (count, total) => {
          if (mountedRef.current) setProgress('Transcribing ' + count + ' of ' + total + ' parts')
        },
      })
      if (!mountedRef.current || disabledRef.current || controller.signal.aborted) return
      savedSegmentsRef.current = null
      transcriptCacheRef.current = []
      setHasSavedAudio(false)
      setProgress('')
      onActivity?.()
      onTranscript?.(transcript)
    } catch (cause) {
      if (!mountedRef.current || controller.signal.aborted) return
      setProgress('')
      setError(cause?.message === 'No speech detected'
        ? 'Speech was not recognized. Retry saved audio.'
        : 'Transcription interrupted. Retry saved audio.')
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      if (mountedRef.current) setUploading(false)
    }
  }, [onActivity, onTranscript])

  const retrySavedAudio = useCallback(() => {
    if (!uploading && savedSegmentsRef.current?.length) {
      void transcribe(savedSegmentsRef.current)
    }
  }, [transcribe, uploading])

  const replaySavedAudio = useCallback(async () => {
    if (playing || !savedSegmentsRef.current?.length) return
    const controller = new AbortController()
    playbackAbortRef.current = controller
    setPlaying(true)
    try {
      await replaySpeechSegments(savedSegmentsRef.current, { signal: controller.signal })
    } catch (cause) {
      if (mountedRef.current && !controller.signal.aborted) setError('Playback unavailable. You can still retry transcription.')
    } finally {
      if (playbackAbortRef.current === controller) playbackAbortRef.current = null
      if (mountedRef.current) setPlaying(false)
    }
  }, [playing])

  const stopRecording = useCallback(() => {
    requestTokenRef.current += 1
    micRequestControllerRef.current?.abort()
    micRequestControllerRef.current = null
    recordingSessionRef.current?.stop()
    setRecording(false)
  }, [])

  const startRecording = useCallback(async () => {
    if (disabled || recording || uploading || startingRef.current || recordingSessionRef.current) return
    startingRef.current = true
    const requestToken = ++requestTokenRef.current
    const controller = new AbortController()
    micRequestControllerRef.current = controller
    setStarting(true)
    setError('')
    setProgress('')
    playbackAbortRef.current?.abort()
    // Starting a new recording deliberately replaces the old one. A failed
    // transcription never clears the saved recording.
    savedSegmentsRef.current = null
    transcriptCacheRef.current = []
    setHasSavedAudio(false)
    try {
      onBeforeRecord?.()
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function' || typeof MediaRecorder === 'undefined') {
        throw new Error('Voice input unavailable')
      }
      const mimeType = chooseWebbSpeechMimeType(MediaRecorder)
      if (!mimeType) throw new Error('Voice input unavailable')
      const stream = await getReusableMicrophoneStream({ signal: controller.signal })
      if (micRequestControllerRef.current === controller) micRequestControllerRef.current = null
      if (controller.signal.aborted || !mountedRef.current || disabledRef.current || requestToken !== requestTokenRef.current) {
        pauseReusableMicrophoneStream(stream)
        return
      }
      streamRef.current = stream
      const releaseStream = () => {
        if (streamRef.current === stream) streamRef.current = null
        pauseReusableMicrophoneStream(stream)
      }
      const session = createSegmentedSpeechRecording({
        stream,
        mimeType,
        onStart: () => {
          if (!mountedRef.current || disabledRef.current) {
            recordingSessionRef.current?.cancel()
            return
          }
          onActivity?.()
          setRecording(true)
        },
        onStopped: () => {
          if (recordingSessionRef.current === session) recordingSessionRef.current = null
          releaseStream()
          if (mountedRef.current) setRecording(false)
        },
        onFailure: () => {
          if (mountedRef.current) setError('Recording failed. Please try again.')
        },
        onComplete: segments => {
          if (mountedRef.current && !disabledRef.current) void transcribe(segments)
        },
      })
      recordingSessionRef.current = session
      session.start()
    } catch (cause) {
      recordingSessionRef.current = null
      cleanupStream()
      setRecording(false)
      if (mountedRef.current && !controller.signal.aborted) setError(
        ['NotAllowedError', 'SecurityError'].includes(cause?.name)
          ? 'Mic permission denied' : 'Voice input unavailable'
      )
    } finally {
      if (micRequestControllerRef.current === controller) micRequestControllerRef.current = null
      startingRef.current = false
      if (mountedRef.current) setStarting(false)
    }
  }, [cleanupStream, disabled, onActivity, onBeforeRecord, recording, transcribe, uploading])

  const toggleRecording = useCallback(() => {
    if (recording) stopRecording()
    else void startRecording()
  }, [recording, startRecording, stopRecording])

  useEffect(() => {
    if (disabled) {
      // A phase change cancels recording, but temporary STT errors preserve it.
      micRequestControllerRef.current?.abort()
      micRequestControllerRef.current = null
      recordingSessionRef.current?.cancel()
      setRecording(false)
      abortRef.current?.abort()
    }
  }, [disabled])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestTokenRef.current += 1
      micRequestControllerRef.current?.abort()
      micRequestControllerRef.current = null
      try { abortRef.current?.abort() } catch {}
      try { playbackAbortRef.current?.abort() } catch {}
      recordingSessionRef.current?.cancel()
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
      {(error || progress) && (
        <span role="status" style={{ maxWidth: compact ? 96 : 160, fontSize: 11, lineHeight: 1.15, color: error ? '#b91c1c' : '#0f766e' }}>
          {error || progress}
        </span>
      )}
      {hasSavedAudio && !uploading && (
        <>
          <button type="button" disabled={disabled} onClick={retrySavedAudio} title="Retry the saved answer without speaking again"
            style={{ fontSize: 11, padding: '4px 6px', cursor: 'pointer' }}>
            Retry audio
          </button>
          <button type="button" disabled={disabled || playing} onClick={replaySavedAudio} title="Listen to the saved answer"
            style={{ fontSize: 11, padding: '4px 6px', cursor: 'pointer' }}>
            {playing ? 'Playing...' : 'Listen'}
          </button>
        </>
      )}
    </span>
  )
}
