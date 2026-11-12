// Independent MediaRecorder containers keep each Google STT request below its
// 60-second synchronous recognition limit. A MediaRecorder timeslice alone is
// not enough: later WebM chunks may lack headers and cannot decode in isolation.
export const SPEECH_SEGMENT_MS = 30000;
export const MAX_SPEECH_RECORDING_MS = 120000;

export function chooseSpeechMimeType(Recorder = typeof MediaRecorder !== 'undefined' ? MediaRecorder : null) {
  if (!Recorder) return '';
  const supported = typeof Recorder.isTypeSupported === 'function'
    ? type => { try { return Recorder.isTypeSupported(type); } catch { return false; } }
    : () => false;
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']
    .find(supported) || '';
}

export function createSegmentedSpeechRecording({
  stream,
  mimeType,
  Recorder = typeof MediaRecorder !== 'undefined' ? MediaRecorder : null,
  segmentMs = SPEECH_SEGMENT_MS,
  maxDurationMs = MAX_SPEECH_RECORDING_MS,
  onStart = () => {},
  onComplete = () => {},
  onFailure = () => {},
  onStopped = () => {},
}) {
  if (!stream || !Recorder || !mimeType) throw new Error('Voice input unavailable');

  const segments = [];
  let activeRecorder = null;
  let segmentTimer = null;
  let recordingTimer = null;
  let requestedStop = false;
  let cancelled = false;
  let completed = false;
  let started = false;

  const clearTimers = () => {
    if (segmentTimer !== null) clearTimeout(segmentTimer);
    if (recordingTimer !== null) clearTimeout(recordingTimer);
    segmentTimer = null;
    recordingTimer = null;
  };

  const finish = (error = null) => {
    if (completed) return;
    completed = true;
    clearTimers();
    onStopped();
    if (cancelled) return;
    if (error) onFailure(error);
    else onComplete(segments.slice());
  };

  const stopCurrent = () => {
    if (segmentTimer !== null) clearTimeout(segmentTimer);
    segmentTimer = null;
    if (!activeRecorder) return finish(new Error('Recording stopped unexpectedly'));
    try {
      if (activeRecorder.state !== 'inactive') activeRecorder.stop();
    } catch (error) {
      finish(error);
    }
  };

  const nextSegment = () => {
    if (completed || cancelled) return;
    let recorder;
    try {
      recorder = new Recorder(stream, { mimeType });
      activeRecorder = recorder;
      const chunks = [];
      recorder.ondataavailable = event => {
        if (event.data?.size) chunks.push(event.data);
      };
      recorder.onstart = () => {
        if (completed || cancelled) return;
        if (!started) {
          started = true;
          onStart();
        }
      };
      recorder.onerror = event => {
        finish(event?.error || new Error('Recording failed'));
        try { if (recorder.state !== 'inactive') recorder.stop(); } catch {}
      };
      recorder.onstop = () => {
        if (completed || cancelled) return;
        if (chunks.length) {
          const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
          if (blob.size) segments.push(blob);
        }
        activeRecorder = null;
        if (requestedStop) finish();
        else nextSegment();
      };
      recorder.start();
      segmentTimer = setTimeout(stopCurrent, segmentMs);
    } catch (error) {
      finish(error);
    }
  };

  return {
    start() {
      if (started || completed || activeRecorder) return;
      recordingTimer = setTimeout(() => {
        requestedStop = true;
        stopCurrent();
      }, maxDurationMs);
      nextSegment();
    },
    stop() {
      if (completed || cancelled || requestedStop) return;
      requestedStop = true;
      stopCurrent();
    },
    cancel() {
      if (completed) return;
      cancelled = true;
      const recorder = activeRecorder;
      finish();
      try { if (recorder?.state !== 'inactive') recorder.stop(); } catch {}
    },
  };
}
