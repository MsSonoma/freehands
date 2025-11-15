// Force refresh - investigating visual aids button rendering
import { useEffect, useState } from "react";
import CurrentAssessmentPrompt from "./CurrentAssessmentPrompt.js";

const COMPREHENSION_TARGET = 5;
const EXERCISE_TARGET = 5;

function VideoPanel({ isMobileLandscape, isShortHeight, videoMaxHeight, videoRef, showBegin, isSpeaking, onBegin, onBeginComprehension, onBeginWorksheet, onBeginTest, onBeginSkippedExercise, phase, subPhase, ticker, currentWorksheetIndex, testCorrectCount, testFinalPercent, lessonParam, muted, userPaused, onToggleMute, onSkip, loading, overlayLoading, exerciseSkippedAwaitBegin, skipPendingLessonLoad, currentCompProblem, onCompleteLesson, testActiveIndex, testList, isLastWorksheetQuestion, onOpenReview, visualAids, onShowVisualAids }) {
  // Reduce horizontal max width in mobile landscape to shrink vertical footprint (height scales with width via aspect ratio)
  // Remove horizontal clamp: let the video occupy the full available width of its column
  const containerMaxWidth = 'none';
  const dynamicHeightStyle = (isMobileLandscape && videoMaxHeight) ? { maxHeight: videoMaxHeight, height: videoMaxHeight, minHeight: 0 } : {};
  // Responsive control sizing: derive a target size from container width via CSS clamp.
  // We'll expose a CSS variable --ctrlSize and reuse for skip + play/pause/mute for symmetry.
  const controlClusterStyle = {
    position: 'absolute',
    bottom: 16,
    right: 16,
    display: 'flex',
    gap: 12,
    zIndex: 10,
    // size calculation moved to child buttons via CSS var
  };
  const controlButtonBase = {
    background: '#1f2937',
    color: '#fff',
    border: 'none',
    width: 'var(--ctrlSize)',
    height: 'var(--ctrlSize)',
    display: 'grid',
    placeItems: 'center',
    borderRadius: '50%',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
  };
  // Begin overlays removed. Keep controls always enabled.
  const atPhaseBegin = false;
  // Portrait refinement: instead of padding the outer wrapper, shrink the video width a bit so
  // the empty space on each side is symmetrical and the video remains visually centered.
  // We choose a slight shrink (e.g. 92%) to create subtle gutters. Landscape keeps full width.
  const outerWrapperStyle = { position: 'relative', margin: '0 auto', width: '100%' };

  // In portrait, interpolate height from 25svh at 1:1 to 35svh at 2:1 (height:width), clamped outside that range.
  const [portraitSvH, setPortraitSvH] = useState(35);
  useEffect(() => {
    const computePortraitHeight = () => {
      try {
        const w = Math.max(1, window.innerWidth || 1);
        const h = Math.max(1, window.innerHeight || 1);
        const ratio = h / w; // 1 => square; 2 => twice as tall as wide
        const t = Math.min(1, Math.max(0, (ratio - 1) / (2 - 1))); // 0..1 over [1,2]
  const svh = 35 - (10 * t); // 35..25
        setPortraitSvH(svh);
      } catch {}
    };
    if (!isMobileLandscape) {
      computePortraitHeight();
      window.addEventListener('resize', computePortraitHeight);
      window.addEventListener('orientationchange', computePortraitHeight);
      return () => {
        window.removeEventListener('resize', computePortraitHeight);
        window.removeEventListener('orientationchange', computePortraitHeight);
      };
    }
  }, [isMobileLandscape]);

  const innerVideoWrapperStyle = isMobileLandscape
    ? { position: 'relative', overflow: 'hidden', aspectRatio: '16 / 7.2', minHeight: 200, width: '100%', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.12)', background: '#000', '--ctrlSize': 'clamp(34px, 6.2vw, 52px)', ...dynamicHeightStyle }
    : { position: 'relative', overflow: 'hidden', height: `${portraitSvH}svh`, width: '92%', margin: '0 auto', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.12)', background: '#000', '--ctrlSize': 'clamp(34px, 6.2vw, 52px)' };
  return (
    <div style={outerWrapperStyle}>
      <div style={innerVideoWrapperStyle}>
        <video
          ref={videoRef}
          src="/media/ms-sonoma-3.mp4"
          muted={muted}
          loop
          playsInline
          preload="auto"
          onLoadedMetadata={() => {
            try {
              // Ensure the first frame is visible on load without auto-playing
              if (videoRef.current) {
                try { videoRef.current.currentTime = 0; } catch {}
                try { videoRef.current.pause(); } catch {}
              }
            } catch {}
          }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
        />
        {/* No black screen during test */}
        {(phase === 'comprehension' || phase === 'exercise') && (
          <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(17,24,39,0.78)', color: '#fff', padding: '6px 10px', borderRadius: 8, fontSize: 'clamp(0.85rem, 1.6vw, 1rem)', fontWeight: 600, letterSpacing: 0.3, boxShadow: '0 2px 6px rgba(0,0,0,0.25)', zIndex: 10000, pointerEvents: 'none' }}>
            {phase === 'comprehension' ? `${ticker}/${COMPREHENSION_TARGET}` : `${ticker}/${EXERCISE_TARGET}`}
          </div>
        )}
        {(phase === 'worksheet' && subPhase === 'worksheet-active') ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 32px', pointerEvents: 'none', textAlign: 'center' }}>
            <div style={{ fontSize: 'clamp(1.75rem, 4.2vw, 3.25rem)', fontWeight: 800, lineHeight: 1.18, color: '#ffffff', textShadow: '0 0 4px rgba(0,0,0,0.9), 0 2px 6px rgba(0,0,0,0.85), 0 4px 22px rgba(0,0,0,0.65)', letterSpacing: 0.5, fontFamily: 'Inter, system-ui, sans-serif', width: '100%' }}>
              <CurrentAssessmentPrompt phase={phase} subPhase={subPhase} testActiveIndex={testActiveIndex} testList={testList} />
            </div>
          </div>
        ) : null}
        {/* Ticker for worksheet/test phases rendered after prompt overlay to stay on top */}
        {((phase === 'worksheet' && subPhase === 'worksheet-active') || (phase === 'test' && subPhase === 'test-active')) && (
          <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(17,24,39,0.78)', color: '#fff', padding: '6px 10px', borderRadius: 8, fontSize: 'clamp(0.85rem, 1.6vw, 1rem)', fontWeight: 600, letterSpacing: 0.3, boxShadow: '0 2px 6px rgba(0,0,0,0.25)', zIndex: 10000, pointerEvents: 'none' }}>
            {phase === 'worksheet' ? `Question ${Number((typeof currentWorksheetIndex === 'number' ? currentWorksheetIndex : 0) + 1)}` : `Question ${Number((typeof testActiveIndex === 'number' ? testActiveIndex : 0) + 1)}`}
          </div>
        )}
        {((phase === 'congrats') || (phase === 'test' && typeof subPhase === 'string' && subPhase.startsWith('review'))) && typeof testFinalPercent === 'number' && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(17,24,39,0.85)', color: '#fff', padding: '10px 14px', borderRadius: 10, fontSize: 'clamp(1rem, 2vw, 1.25rem)', fontWeight: 700, letterSpacing: 0.4, boxShadow: '0 2px 10px rgba(0,0,0,0.4)' }}>Score: {testFinalPercent}%</div>
        )}
  {/* Ticker badges handled above for all phases */}
        {overlayLoading && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 5, pointerEvents: 'none', background: 'rgba(0,0,0,0.38)', padding: '46px 50px', borderRadius: 160, backdropFilter: 'blur(2px)', boxShadow: '0 6px 28px rgba(0,0,0,0.45)' }}>
            <div className="ms-spinner-legacy" aria-hidden="true">
              <div className="ms-spinner" role="status" aria-label="Loading" />
            </div>
            <div style={{ color: '#fff', fontSize: 'clamp(0.95rem, 1.6vw, 1rem)', fontWeight: 600, letterSpacing: 0.5, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Loading...</div>
          </div>
        )}
        {/* Begin overlays removed intentionally */}
  {/* Primary control cluster (mute + visual aids) */}
  <div style={controlClusterStyle}>
    {/* Visual Aids button - only show if lesson has visual aids */}
    {(() => {
      const isArray = Array.isArray(visualAids);
      const hasLength = visualAids && visualAids.length > 0;
      const hasHandler = typeof onShowVisualAids === 'function';
      return isArray && hasLength && hasHandler;
    })() && (
      <button 
        type="button" 
        onClick={onShowVisualAids} 
        aria-label="Visual Aids" 
        title="Visual Aids" 
        style={controlButtonBase}
      >
        <span style={{ fontSize: '1.5em' }}>🖼️</span>
      </button>
    )}
    
    <button type="button" onClick={onToggleMute} aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'} style={controlButtonBase}>
      {muted ? (
        <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M23 9l-6 6" /><path d="M17 9l6 6" /></svg>
      ) : (
        <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19 8a5 5 0 010 8" /><path d="M15 11a2 2 0 010 2" /></svg>
      )}
    </button>
  </div>
        {/* Skip button when speaking */}
        {isSpeaking && typeof onSkip === 'function' && (
          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip"
            title="Skip"
            style={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              background: '#1f2937',
              color: '#fff',
              border: 'none',
              width: 'var(--ctrlSize)',
              height: 'var(--ctrlSize)',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '50%',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              zIndex: 10
            }}
          >
            <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 4 15 12 5 20 5 4" />
              <line x1="19" y1="5" x2="19" y2="19" />
            </svg>
          </button>
        )}
        {skipPendingLessonLoad && (
          <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(31,41,55,0.85)', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 'clamp(0.75rem, 1.4vw, 0.9rem)', fontWeight: 600, letterSpacing: 0.4, boxShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>Loading lesson… skip will apply</div>
        )}
        {/* Last-worksheet safety: show explicit Review button to enter facilitator override */}
        {(phase === 'worksheet' && subPhase === 'worksheet-active' && isLastWorksheetQuestion && typeof onOpenReview === 'function') && (
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10002, pointerEvents: 'auto' }}>
            <button
              type="button"
              onClick={onOpenReview}
              style={{
                background: '#2563EB',
                color: '#fff',
                fontWeight: 800,
                letterSpacing: 0.3,
                borderRadius: 12,
                padding: '10px 18px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(0,0,0,0.25)'
              }}
            >
              Review
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default VideoPanel;
