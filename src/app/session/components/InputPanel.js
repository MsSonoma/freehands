import { useCallback, useEffect, useRef, useState } from "react";
import { getReusableMicrophoneStream, pauseReusableMicrophoneStream } from "../utils/microphoneSession";
import { createSegmentedSpeechRecording, chooseSpeechMimeType } from "../utils/segmentedSpeechRecording.mjs";
import { transcribeSpeechSegments, replaySpeechSegments } from "../utils/speechTranscription.mjs";
import { useSonomaKeyboard, shouldUseSonomaKeyboard } from "../../components/SonomaKeyboard";

const DEFAULT_HOTKEYS = { micHold: 'NumpadAdd', beginSend: 'Enter' };

function InputPanel({ learnerInput, setLearnerInput, sendDisabled, canSend, loading, onSend, showBegin, isSpeaking, phase, subPhase, tipOverride, abortKey, currentCompProblem, compact = false, hotkeys }) {
  const [focused, setFocused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [hasSavedAudio, setHasSavedAudio] = useState(false);
  const recordingSessionRef = useRef(null);
  const requestTokenRef = useRef(0);
  const streamRef = useRef(null);
  const micRequestControllerRef = useRef(null);
  const inputRef = useRef(null);
  const sonomaKeyboard = useSonomaKeyboard();
  const hotkeyDownRef = useRef(false);
  const touchActiveRef = useRef(false);
  const sttAbortRef = useRef(null);
  const playbackAbortRef = useRef(null);
  const savedSegmentsRef = useRef(null);
  const transcriptCacheRef = useRef([]);
  const inputAtRecordingRef = useRef('');

  const transcribeSegments = useCallback(async (segments) => {
    if (!segments?.length) {
      setErrorMsg('No speech recorded. Please try again.');
      return;
    }
    savedSegmentsRef.current = segments;
    setHasSavedAudio(true);
    setUploading(true);
    setErrorMsg('');
    setProgress('Transcribing...');
    const controller = new AbortController();
    sttAbortRef.current = controller;
    try {
      const transcript = await transcribeSpeechSegments(segments, {
        transcripts: transcriptCacheRef.current,
        signal: controller.signal,
        onProgress: (count, total) => setProgress('Transcribing ' + count + ' of ' + total + ' parts'),
      });
      if (controller.signal.aborted) return;
      // Keep any text the learner typed while the recording was processing.
      setLearnerInput(current => {
        if (current && current !== inputAtRecordingRef.current) {
          return current.trim() + ' ' + transcript;
        }
        return transcript;
      });
      savedSegmentsRef.current = null;
      transcriptCacheRef.current = [];
      setHasSavedAudio(false);
      setProgress('');
    } catch (error) {
      if (controller.signal.aborted) return;
      setProgress('');
      setErrorMsg(error?.message === 'No speech detected'
        ? 'Speech was not recognized. Retry saved audio.'
        : 'Transcription interrupted. Retry saved audio.');
    } finally {
      if (sttAbortRef.current === controller) sttAbortRef.current = null;
      setUploading(false);
    }
  }, [setLearnerInput]);

  const retrySavedAudio = useCallback(() => {
    if (!uploading && savedSegmentsRef.current?.length) {
      void transcribeSegments(savedSegmentsRef.current);
    }
  }, [transcribeSegments, uploading]);

  const replaySavedAudio = useCallback(async () => {
    if (playing || !savedSegmentsRef.current?.length) return;
    const controller = new AbortController();
    playbackAbortRef.current = controller;
    setPlaying(true);
    try {
      await replaySpeechSegments(savedSegmentsRef.current, { signal: controller.signal });
    } catch (error) {
      if (!controller.signal.aborted) setErrorMsg('Playback unavailable. You can still retry transcription.');
    } finally {
      if (playbackAbortRef.current === controller) playbackAbortRef.current = null;
      setPlaying(false);
    }
  }, [playing]);

  const stopRecording = useCallback(() => {
    requestTokenRef.current += 1;
    micRequestControllerRef.current?.abort();
    micRequestControllerRef.current = null;
    recordingSessionRef.current?.stop();
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    if (sendDisabled || isRecording || uploading || micRequestControllerRef.current || recordingSessionRef.current) return;
    const requestToken = ++requestTokenRef.current;
    const controller = new AbortController();
    micRequestControllerRef.current = controller;
    setErrorMsg('');
    setProgress('');
    playbackAbortRef.current?.abort();
    // Only a deliberate new recording discards a previous, saved answer.
    savedSegmentsRef.current = null;
    transcriptCacheRef.current = [];
    setHasSavedAudio(false);
    inputAtRecordingRef.current = learnerInput;
    try {
      if (typeof MediaRecorder === 'undefined') throw new Error('Voice input unavailable');
      const mimeType = chooseSpeechMimeType(MediaRecorder);
      if (!mimeType) throw new Error('Voice input unavailable');
      const stream = await getReusableMicrophoneStream({ signal: controller.signal });
      if (controller.signal.aborted || requestToken !== requestTokenRef.current || sendDisabled) {
        pauseReusableMicrophoneStream(stream);
        return;
      }
      micRequestControllerRef.current = null;
      streamRef.current = stream;
      const releaseStream = () => {
        if (streamRef.current === stream) streamRef.current = null;
        pauseReusableMicrophoneStream(stream);
      };
      const session = createSegmentedSpeechRecording({
        stream,
        mimeType,
        onStart: () => setIsRecording(true),
        onStopped: () => {
          if (recordingSessionRef.current === session) recordingSessionRef.current = null;
          releaseStream();
          setIsRecording(false);
        },
        onFailure: () => setErrorMsg('Recording failed. Please try again.'),
        onComplete: segments => { void transcribeSegments(segments); },
      });
      recordingSessionRef.current = session;
      session.start();
    } catch (error) {
      recordingSessionRef.current = null;
      pauseReusableMicrophoneStream(streamRef.current);
      streamRef.current = null;
      if (controller.signal.aborted) return;
      setErrorMsg(['NotAllowedError', 'SecurityError'].includes(error?.name)
        ? 'Mic permission denied' : 'Voice input unavailable');
    } finally {
      if (micRequestControllerRef.current === controller) micRequestControllerRef.current = null;
    }
  }, [isRecording, uploading, sendDisabled, transcribeSegments, learnerInput]);

  // Global hotkey: Hold configured key (default NumpadPlus) to record (keydown starts, keyup stops)
  useEffect(() => {
    const onKeyDown = (e) => {
      const code = e.code || e.key;
      const micCode = (hotkeys?.micHold || DEFAULT_HOTKEYS.micHold);
      if (!micCode || code !== micCode) return;
      // Prevent text input of '+' when we handle it
      e.preventDefault();
      if (hotkeyDownRef.current) return; // ignore auto-repeat
      hotkeyDownRef.current = true;
      if (!sendDisabled && !isRecording && !uploading) {
        startRecording();
      }
    };
    const onKeyUp = (e) => {
      const code = e.code || e.key;
      const micCode = (hotkeys?.micHold || DEFAULT_HOTKEYS.micHold);
      if (!micCode || code !== micCode) return;
      e.preventDefault();
      hotkeyDownRef.current = false;
      if (isRecording || recordingSessionRef.current || micRequestControllerRef.current) {
        stopRecording();
      }
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp, { passive: false });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isRecording, uploading, sendDisabled, startRecording, stopRecording, hotkeys]);

  useEffect(() => () => {
    requestTokenRef.current += 1;
    micRequestControllerRef.current?.abort();
    micRequestControllerRef.current = null;
    sttAbortRef.current?.abort();
    playbackAbortRef.current?.abort();
    recordingSessionRef.current?.cancel();
    pauseReusableMicrophoneStream(streamRef.current);
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!sendDisabled) return;
    requestTokenRef.current += 1;
    micRequestControllerRef.current?.abort();
    micRequestControllerRef.current = null;
    recordingSessionRef.current?.cancel();
    setIsRecording(false);
  }, [sendDisabled]);

  // Skip and phase changes intentionally cancel recording and transcription.
  useEffect(() => {
    requestTokenRef.current += 1;
    micRequestControllerRef.current?.abort();
    micRequestControllerRef.current = null;
    sttAbortRef.current?.abort();
    playbackAbortRef.current?.abort();
    recordingSessionRef.current?.cancel();
    setIsRecording(false);
    setUploading(false);
    setPlaying(false);
    setErrorMsg('');
    setProgress('');
    savedSegmentsRef.current = null;
    transcriptCacheRef.current = [];
    setHasSavedAudio(false);
  }, [abortKey]);

  // Wait for recorded speech before submitting an answer.
  const handleSend = useCallback(() => {
    if (isRecording || recordingSessionRef.current || micRequestControllerRef.current) {
      stopRecording();
      return;
    }
    if (!uploading) onSend();
  }, [isRecording, stopRecording, onSend, uploading]);
  // Auto-focus when the field becomes actionable (enabled and allowed to send)
  // Add a tiny retry window to avoid races right after TTS ends or layout settles
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (sendDisabled || !canSend || shouldUseSonomaKeyboard()) return;
    let rafId = null;
    let t0 = null;
    let t1 = null;
    const doFocus = () => {
      try {
        el.focus({ preventScroll: true });
        const len = el.value.length;
        el.setSelectionRange(len, len);
      } catch {/* ignore focus errors */}
    };
    // Initial microtask/next-tick
    t0 = setTimeout(() => {
      if (document.activeElement !== el) doFocus();
    }, 0);
    // After a frame, try again if something stole focus
    rafId = requestAnimationFrame(() => {
      if (document.activeElement !== el) doFocus();
    });
    // One last short retry
    t1 = setTimeout(() => {
      if (document.activeElement !== el) doFocus();
    }, 120);
    return () => {
      if (t0) clearTimeout(t0);
      if (t1) clearTimeout(t1);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [sendDisabled, canSend]);
  const computePlaceholder = () => {
    if (tipOverride) return tipOverride;
    if (showBegin) return 'Press "Begin"';
    if (phase === 'congrats') return 'Press "Complete Lesson"';
    if (loading) return 'loading...';
    if (isSpeaking) return 'Ms. Sonoma is talking...';
    // During Teaching gate, disable text and prompt to use buttons
    if (phase === 'teaching' && subPhase === 'awaiting-gate') return 'Tap Yes or No below';
    // During Comprehension: lock input and guide clearly
    if (phase === 'comprehension') {
  if (subPhase === 'comprehension-start') return 'Press "Begin Comprehension"';
    }
  if (phase === 'exercise' && subPhase === 'exercise-awaiting-begin') return 'Press "Begin Exercise"';
  if (phase === 'worksheet' && subPhase === 'worksheet-awaiting-begin') return 'Press "Begin Worksheet"';
    if (phase === 'test' && subPhase === 'test-awaiting-begin') return 'Press "Begin Test"';
    // Show guidance any time input is actionable (buttons full color => not disabled)
    if (!sendDisabled) return 'Type your answer...';
    return '';
  };
  return (
  <div style={{ display: "flex", flexWrap: 'wrap', alignItems: "center", gap: (typeof compact !== 'undefined' && compact) ? 6 : 8, marginBottom: 0, width: '100%', maxWidth: '100%', marginLeft: 'auto', marginRight: 'auto', boxSizing: 'border-box', paddingLeft: (typeof compact !== 'undefined' && compact) ? 8 : (compact ? 12 : '4%'), paddingRight: (typeof compact !== 'undefined' && compact) ? 8 : (compact ? 12 : '4%') }}>
      <button
        style={{
          background: (sendDisabled) ? "#4b5563" : '#c7442e',
          color: "#fff",
          borderRadius: 8,
          padding: (typeof compact !== 'undefined' && compact) ? "6px 10px" : "8px 12px",
          fontWeight: 600,
          border: "none",
          cursor: (sendDisabled) ? "not-allowed" : "pointer",
          opacity: (sendDisabled) ? 0.7 : 1,
          transition: "background 0.2s, opacity 0.2s, box-shadow 0.2s",
          position: 'relative',
          boxShadow: isRecording ? '0 0 0 4px rgba(199,68,46,0.35), 0 0 12px 4px rgba(199,68,46,0.55)' : '0 2px 6px rgba(0,0,0,0.25)',
          // Prevent long-press selection/callout on mobile
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          touchAction: 'manipulation'
        }}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
  disabled={sendDisabled || uploading}
        onContextMenu={(e) => { e.preventDefault(); }}
        onDragStart={(e) => { e.preventDefault(); }}
        onTouchStart={(e) => {
          // Use hold-to-record on touch devices; prevent synthetic click
          e.preventDefault();
          if (sendDisabled) return;
          touchActiveRef.current = true;
          if (!isRecording && !uploading) {
            startRecording();
          }
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          if (!touchActiveRef.current) return;
          touchActiveRef.current = false;
          if (isRecording || recordingSessionRef.current || micRequestControllerRef.current) {
            stopRecording();
          }
        }}
        onTouchCancel={(e) => {
          e.preventDefault();
          touchActiveRef.current = false;
          if (isRecording || recordingSessionRef.current || micRequestControllerRef.current) {
            stopRecording();
          }
        }}
        onClick={() => {
          if (sendDisabled) return;
          if (isRecording || recordingSessionRef.current || micRequestControllerRef.current) {
            stopRecording();
          } else {
            startRecording();
          }
        }}
      >
        {isRecording ? (
          <div style={{ position:'relative', width:18, height:18 }}>
            <div style={{ position:'absolute', inset:0, background:'#fff', borderRadius:4, animation:'msPulse 1s ease-in-out infinite' }} />
          </div>
        ) : uploading ? (
          <div style={{ position:'relative', width:18, height:18 }}>
            <div style={{ position:'absolute', inset:0, border:'3px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'msSpinFade 0.9s linear infinite' }} />
          </div>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M19 11a7 7 0 01-14 0" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 21v-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
      {/* Removed iOS-only test sound button to simplify controls */}
      <input
        ref={inputRef}
            title={(() => {
              const micCode = (hotkeys?.micHold || DEFAULT_HOTKEYS.micHold);
              const label = micCode === 'NumpadAdd' ? 'Numpad +' : micCode || 'Numpad +';
              return isRecording ? `Release ${label} to stop` : `Hold ${label} to talk`;
            })()}
        value={learnerInput}
        data-sonoma-input
        inputMode="none"
        onPointerDown={() => { if (!sendDisabled && shouldUseSonomaKeyboard()) sonomaKeyboard.open({ ref: inputRef, onChange: setLearnerInput, layout: "text" }); }}
        onFocus={() => { setFocused(true); if (!sendDisabled && shouldUseSonomaKeyboard()) sonomaKeyboard.open({ ref: inputRef, onChange: setLearnerInput, layout: "text" }); }}
        onBlur={() => setFocused(false)}
        onChange={(event) => setLearnerInput(event.target.value)}
        onKeyDown={(e) => {
          const code = e.code || e.key;
          const beginCode = (hotkeys?.beginSend || DEFAULT_HOTKEYS.beginSend);
          if (code === beginCode) {
            e.preventDefault();
            if (!sendDisabled) {
              handleSend();
            }
          }
        }}
        placeholder={computePlaceholder()}
  disabled={sendDisabled}
        style={{
          flex: 1,
          padding: "10px",
          borderRadius: 6,
          border: "1px solid #bdbdbd",
          fontSize: 'clamp(0.95rem, 1.6vw, 1.05rem)',
          background: (!sendDisabled) ? "#fff" : "#f3f4f6",
          color: (!sendDisabled) ? "#111827" : "#9ca3af",
          transition: 'background 0.2s, color 0.2s',
          ...(loading ? { animation: 'flashInputPlaceholder 0.85s ease-in-out infinite' } : {})
        }}
      />
      <button
        style={{
          background: (sendDisabled) ? "#4b5563" : "#c7442e",
          color: "#fff",
          borderRadius: 8,
          padding: (typeof compact !== 'undefined' && compact) ? "6px 10px" : "8px 12px",
          fontWeight: 600,
          border: "none",
          cursor: (sendDisabled) ? "not-allowed" : "pointer",
          opacity: (sendDisabled) ? 0.7 : 1,
          transition: "background 0.2s, opacity 0.2s",
        }}
        aria-label="Send response"
  disabled={sendDisabled || uploading}
  data-sonoma-submit onClick={handleSend}
      >
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
          <path d="M22 2L11 13" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {/* Flash animation style for loading placeholder */}
      <style jsx>{`
        @keyframes flashInputPlaceholder {
          0% { opacity: 1; }
          50% { opacity: 0.55; }
          100% { opacity: 1; }
        }
        @keyframes msPulse { 0% { transform: scale(1); opacity:1;} 50% { transform: scale(0.55); opacity:0.5;} 100% { transform: scale(1); opacity:1;} }
        @keyframes msSpinFade {
          0% { transform: rotate(0deg); opacity: 1; }
          50% { transform: rotate(180deg); opacity: 0.55; }
          100% { transform: rotate(360deg); opacity: 1; }
        }
        .ms-spinner {
          position: relative;
          box-sizing: border-box;
          width: 64px;
          height: 64px;
          border: 6px solid rgba(255,255,255,0.22);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: msSpinFade 0.9s linear infinite;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35));
        }
      `}</style>
    {(errorMsg || progress || hasSavedAudio) && (
      <div style={{ width:'100%', display:'flex', alignItems:'center', flexWrap:'wrap', gap:6, fontSize:'clamp(0.7rem, 1.2vw, 0.8rem)', color:errorMsg ? '#c7442e' : '#374151', zIndex:2 }}>
        <span role="status">{errorMsg || progress}</span>
        {hasSavedAudio && !uploading && (
          <>
            <button type="button" disabled={sendDisabled} onClick={retrySavedAudio} style={{ fontSize:12, padding:'3px 6px', cursor:'pointer' }}>Retry audio</button>
            <button type="button" disabled={sendDisabled || playing} onClick={replaySavedAudio} style={{ fontSize:12, padding:'3px 6px', cursor:'pointer' }}>{playing ? 'Playing...' : 'Listen'}</button>
          </>
        )}
      </div>
    )}
    </div>
  );
}

export default InputPanel;
