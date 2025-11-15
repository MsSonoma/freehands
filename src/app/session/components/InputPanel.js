import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_HOTKEYS = { micHold: 'NumpadAdd', beginSend: 'Enter' };

function InputPanel({ learnerInput, setLearnerInput, sendDisabled, canSend, loading, onSend, showBegin, isSpeaking, phase, subPhase, tipOverride, abortKey, currentCompProblem, compact = false, hotkeys }) {
  const [focused, setFocused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const autoStopRef = useRef(null);
  const inputRef = useRef(null);
  // Track whether Numpad+ is currently held to avoid repeat triggers
  const hotkeyDownRef = useRef(false);
  // Track touch-hold lifecycle so we can start on touchstart and stop on touchend without triggering synthetic clicks
  const touchActiveRef = useRef(false);

  // Abort controller for STT fetch
  const sttAbortRef = useRef(null);

  const transcribeBlob = useCallback(async (blob) => {
    if (!blob) return;
    setUploading(true);
    setErrorMsg('');
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'input.webm');
      fd.append('language', 'en-US');
      const ctrl = new AbortController();
      sttAbortRef.current = ctrl;
      const res = await fetch('/api/stt', { method: 'POST', body: fd, signal: ctrl.signal });
      if (!res.ok) throw new Error(`STT failed ${res.status}`);
      const data = await res.json();
      const text = (data?.transcript || '').trim();
      if (text) {
        // Populate the input with the transcript; facilitator can edit/press Send
        setLearnerInput(text);
      } else {
        setErrorMsg('No speech detected');
      }
    } catch (e) {
      if (e?.name === 'AbortError') {
        // STT aborted
        return;
      }
      // Transcription failed
      setErrorMsg('Transcription failed');
    } finally {
      setUploading(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || uploading) return;
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      try { if (typeof window !== 'undefined') localStorage.setItem('ms_micAllowed', 'true'); } catch {}
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      // When recording actually starts, clear any existing typed text so mic can be used to retry without manual delete
      mr.onstart = () => {
        setIsRecording(true);
        try {
          if (typeof learnerInput === 'string' && learnerInput.trim().length > 0) {
            setLearnerInput('');
          }
        } catch {}
      };
      mr.onerror = (e) => { setIsRecording(false); setErrorMsg('Recording error'); };
      mr.onstop = async () => {
        try { stream.getTracks().forEach(tr => tr.stop()); } catch {}
        const out = new Blob(chunksRef.current, { type: 'audio/webm' });
        await transcribeBlob(out);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      autoStopRef.current = setTimeout(() => { try { mr.state !== 'inactive' && mr.stop(); } catch {} }, 30000);
    } catch (e) {
      // Mic permission denied
      setErrorMsg('Mic permission denied');
      try {
        if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError' || e.name === 'NotFoundError')) {
          if (typeof window !== 'undefined') localStorage.setItem('ms_micAllowed', 'false');
        }
      } catch {}
    }
  }, [isRecording, uploading, transcribeBlob, learnerInput, setLearnerInput]);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
    if (mr && mr.state !== 'inactive') {
      try { mr.stop(); } catch {}
    }
    setIsRecording(false);
  }, []);

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
      if (isRecording) {
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
    try { mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive' && mediaRecorderRef.current.stop(); } catch {}
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
  }, []);

  // Stop any in-progress mic/STT when abortKey changes (skip pressed)
  useEffect(() => {
    // Abort STT fetch
    try { if (sttAbortRef.current) sttAbortRef.current.abort('skip'); } catch {}
    // Stop recording if active
    try {
      // Clear any pending auto-stop timer so it doesn't try to stop again later
      if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch {}
    setIsRecording(false);
    setUploading(false);
    setErrorMsg('');
  }, [abortKey]);

  // If user hits Enter or Send while recording, stop first
  const handleSend = useCallback(() => {
    if (isRecording) stopRecording();
    onSend();
  }, [isRecording, stopRecording, onSend]);
  // Auto-focus when the field becomes actionable (enabled and allowed to send)
  // Add a tiny retry window to avoid races right after TTS ends or layout settles
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (sendDisabled || !canSend) return;
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
  <div style={{ display: "flex", alignItems: "center", gap: (typeof compact !== 'undefined' && compact) ? 6 : 8, marginBottom: 0, width: '100%', maxWidth: '100%', marginLeft: 'auto', marginRight: 'auto', boxSizing: 'border-box', paddingLeft: (typeof compact !== 'undefined' && compact) ? 8 : (compact ? 12 : '4%'), paddingRight: (typeof compact !== 'undefined' && compact) ? 8 : (compact ? 12 : '4%') }}>
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
  disabled={sendDisabled}
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
          if (isRecording) {
            stopRecording();
          }
        }}
        onTouchCancel={(e) => {
          e.preventDefault();
          touchActiveRef.current = false;
          if (isRecording) {
            stopRecording();
          }
        }}
        onClick={() => {
          if (sendDisabled) return;
          if (isRecording) {
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
        onFocus={() => setFocused(true)}
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
  disabled={sendDisabled}
  onClick={handleSend}
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
    {errorMsg && (
  <div style={{ position:'absolute', bottom:-18, left:4, fontSize:'clamp(0.7rem, 1.2vw, 0.8rem)', color:'#c7442e' }}>{errorMsg}</div>
    )}
    </div>
  );
}

export default InputPanel;
