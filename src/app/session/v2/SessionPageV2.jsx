"use client";

/**
 * Session Page V2 - AudioEngine Test Harness
 * 
 * This demonstrates the AudioEngine working in isolation with all three playback paths.
 * Enable via localStorage flag: localStorage.setItem('session_architecture_v2', 'true')
 * 
 * Test Controls:
 * - Synthetic: Plays captions with timing, no audio (fastest to test)
 * - HTMLAudio: Preferred path, uses Audio element
 * - WebAudio: iOS fallback, uses Web Audio API
 * - Stop/Pause/Resume/Mute controls
 * - Real-time state display
 */

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { AudioEngine } from './AudioEngine';

export default function SessionPageV2() {
  return (
    <Suspense fallback={null}>
      <SessionPageV2Inner />
    </Suspense>
  );
}

// Export inner component for direct test route
export { SessionPageV2Inner };

function SessionPageV2Inner() {
  const searchParams = useSearchParams();
  const subjectParam = searchParams?.get('subject') || 'math';
  const lessonParam = searchParams?.get('lesson') || '';
  const difficultyParam = searchParams?.get('difficulty') || 'beginner';
  
  const videoRef = useRef(null);
  const engineRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentCaption, setCurrentCaption] = useState(0);
  const [captions, setCaptions] = useState([]);
  const [events, setEvents] = useState([]);
  
  // Test sentences
  const testSentences = [
    "Welcome to the V2 architecture test.",
    "This is testing the AudioEngine component.",
    "It manages all audio playback independently.",
    "Watch the caption index change in real time.",
    "The video should play during audio.",
    "And pause when audio stops."
  ];
  
  // Initialize AudioEngine
  useEffect(() => {
    if (!videoRef.current) return;
    
    const engine = new AudioEngine({ videoElement: videoRef.current });
    engineRef.current = engine;
    
    // Subscribe to all events
    engine.on('start', (data) => {
      addEvent('🎬 Audio started');
      setIsPlaying(true);
      setCaptions(data.sentences);
      setCurrentCaption(data.startIndex);
    });
    
    engine.on('end', (data) => {
      addEvent(`🏁 Audio ended (completed: ${data.completed})`);
      setIsPlaying(false);
    });
    
    engine.on('captionChange', (index) => {
      setCurrentCaption(index);
    });
    
    engine.on('captionsDone', () => {
      addEvent('📝 All captions displayed');
    });
    
    engine.on('error', (err) => {
      addEvent(`❌ Error: ${err.message || err}`);
    });
    
    return () => {
      engine.destroy();
    };
  }, []);
  
  const addEvent = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setEvents(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 10));
  };
  
  const playSynthetic = () => {
    if (engineRef.current) {
      addEvent('▶️ Playing synthetic (no audio)...');
      engineRef.current.playAudio('', testSentences);
    }
  };
  
  const playHTMLAudio = async () => {
    if (engineRef.current) {
      addEvent('▶️ Fetching TTS for HTML path...');
      try {
        // Call a mock TTS endpoint or use a test base64
        // For now, fall back to synthetic
        addEvent('⚠️ No TTS endpoint configured, using synthetic');
        engineRef.current.playAudio('', testSentences);
      } catch (err) {
        addEvent(`❌ TTS fetch failed: ${err.message}`);
      }
    }
  };
  
  const playWebAudio = () => {
    if (engineRef.current) {
      addEvent('▶️ WebAudio path not implemented yet');
      // Would decode base64 to ArrayBuffer here
      engineRef.current.playAudio('', testSentences);
    }
  };
  
  const stop = () => {
    if (engineRef.current) {
      addEvent('⏹️ Stopping playback');
      engineRef.current.stop();
    }
  };
  
  const pause = () => {
    if (engineRef.current) {
      addEvent('⏸️ Pausing playback');
      engineRef.current.pause();
      setIsPlaying(false);
    }
  };
  
  const resume = () => {
    if (engineRef.current) {
      addEvent('▶️ Resuming playback');
      engineRef.current.resume();
      setIsPlaying(true);
    }
  };
  
  const toggleMute = () => {
    if (engineRef.current) {
      const newMuted = !isMuted;
      engineRef.current.setMuted(newMuted);
      setIsMuted(newMuted);
      addEvent(newMuted ? '🔇 Muted' : '🔊 Unmuted');
    }
  };
  
  const clearEvents = () => setEvents([]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#e0e0e0',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 2rem',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
      }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>
          🚀 AudioEngine Test Harness
        </h1>
        <p style={{ margin: '0.25rem 0 0 0', opacity: 0.9, fontSize: '0.9rem' }}>
          Testing V2 architecture: {subjectParam} / {lessonParam || 'demo'}
        </p>
      </div>
      
      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, gap: '1rem', padding: '1rem' }}>
        {/* Video + Caption Panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Video */}
          <div style={{
            background: '#1a1a1a',
            borderRadius: '8px',
            overflow: 'hidden',
            aspectRatio: '16/9'
          }}>
            <video
              ref={videoRef}
              src="/media/msSonoma_introVideo.mp4"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              muted
              loop
            />
          </div>
          
          {/* Caption Display */}
          <div style={{
            background: '#1a1a1a',
            borderRadius: '8px',
            padding: '1.5rem',
            minHeight: '150px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ fontSize: '0.85rem', opacity: 0.7, fontWeight: 'bold' }}>
              CAPTIONS ({currentCaption + 1} / {captions.length || 0})
            </div>
            <div style={{
              fontSize: '1.25rem',
              lineHeight: '1.6',
              flex: 1,
              display: 'flex',
              alignItems: 'center'
            }}>
              {captions[currentCaption] || 'No caption playing'}
            </div>
            
            {/* All captions */}
            <div style={{
              fontSize: '0.75rem',
              opacity: 0.5,
              maxHeight: '100px',
              overflow: 'auto',
              borderTop: '1px solid #333',
              paddingTop: '0.5rem'
            }}>
              {captions.map((s, i) => (
                <div
                  key={i}
                  style={{
                    padding: '0.25rem',
                    background: i === currentCaption ? '#667eea22' : 'transparent',
                    color: i === currentCaption ? '#fff' : '#888'
                  }}
                >
                  {i + 1}. {s}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Controls Panel */}
        <div style={{ width: '350px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* State Display */}
          <div style={{
            background: '#1a1a1a',
            borderRadius: '8px',
            padding: '1rem'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>
              ENGINE STATE
            </div>
            <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Playing:</span>
                <span style={{ color: isPlaying ? '#4ade80' : '#666' }}>
                  {isPlaying ? '✓ Yes' : '✗ No'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Muted:</span>
                <span style={{ color: isMuted ? '#f87171' : '#666' }}>
                  {isMuted ? '✓ Yes' : '✗ No'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Caption Index:</span>
                <span style={{ color: '#667eea' }}>{currentCaption}</span>
              </div>
            </div>
          </div>
          
          {/* Playback Controls */}
          <div style={{
            background: '#1a1a1a',
            borderRadius: '8px',
            padding: '1rem'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>
              PLAYBACK TESTS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button onClick={playSynthetic} style={buttonStyle('#667eea')}>
                ▶️ Test Synthetic
              </button>
              <button onClick={playHTMLAudio} style={buttonStyle('#764ba2')}>
                ▶️ Test HTMLAudio
              </button>
              <button onClick={playWebAudio} style={buttonStyle('#8b5cf6')}>
                ▶️ Test WebAudio
              </button>
            </div>
          </div>
          
          {/* Transport Controls */}
          <div style={{
            background: '#1a1a1a',
            borderRadius: '8px',
            padding: '1rem'
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>
              TRANSPORT
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button onClick={stop} style={buttonStyle('#ef4444')}>
                ⏹️ Stop
              </button>
              <button onClick={isPlaying ? pause : resume} style={buttonStyle('#f59e0b')}>
                {isPlaying ? '⏸️ Pause' : '▶️ Resume'}
              </button>
              <button onClick={toggleMute} style={buttonStyle('#10b981')}>
                {isMuted ? '🔊 Unmute' : '🔇 Mute'}
              </button>
            </div>
          </div>
          
          {/* Event Log */}
          <div style={{
            background: '#1a1a1a',
            borderRadius: '8px',
            padding: '1rem',
            flex: 1,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
                EVENT LOG
              </div>
              <button onClick={clearEvents} style={{
                ...buttonStyle('#666'),
                fontSize: '0.7rem',
                padding: '0.25rem 0.5rem'
              }}>
                Clear
              </button>
            </div>
            <div style={{
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              overflow: 'auto',
              flex: 1
            }}>
              {events.length === 0 && (
                <div style={{ opacity: 0.5, fontStyle: 'italic' }}>
                  No events yet. Click a test button above.
                </div>
              )}
              {events.map((event, i) => (
                <div key={i} style={{
                  padding: '0.25rem 0',
                  borderBottom: i < events.length - 1 ? '1px solid #333' : 'none'
                }}>
                  {event}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div style={{
        padding: '1rem 2rem',
        background: '#1a1a1a',
        borderTop: '1px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
          V2 Architecture: AudioEngine isolated test
        </div>
        <button
          onClick={() => {
            localStorage.removeItem('session_architecture_v2');
            window.location.reload();
          }}
          style={{
            ...buttonStyle('#667eea'),
            fontSize: '0.85rem',
            padding: '0.5rem 1rem'
          }}
        >
          ← Back to V1
        </button>
      </div>
    </div>
  );
}

const buttonStyle = (color) => ({
  background: color,
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  padding: '0.75rem',
  fontSize: '0.9rem',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'transform 0.1s, opacity 0.2s',
  ':hover': {
    transform: 'scale(1.02)',
    opacity: 0.9
  }
});
