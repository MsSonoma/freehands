"use client";

/**
 * Session Page V2 - Complete Teaching Flow
 * 
 * Architecture:
 * - TeachingController: Manages definitions → examples with sentence-by-sentence navigation
 * - AudioEngine: Self-contained playback with event emission
 * - Event-driven: Zero state coupling between components
 * 
 * Enable via localStorage flag: localStorage.setItem('session_architecture_v2', 'true')
 */

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { AudioEngine } from './AudioEngine';
import { TeachingController } from './TeachingController';
import { loadLesson, generateTestLesson } from './services';

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
  const lessonId = searchParams?.get('lesson') || '';
  
  const videoRef = useRef(null);
  const audioEngineRef = useRef(null);
  const teachingControllerRef = useRef(null);
  
  const [lessonData, setLessonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [teachingStage, setTeachingStage] = useState('idle');
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [totalSentences, setTotalSentences] = useState(0);
  const [isInSentenceMode, setIsInSentenceMode] = useState(true);
  
  const [currentCaption, setCurrentCaption] = useState('');
  const [engineState, setEngineState] = useState('idle');
  const [events, setEvents] = useState([]);
  
  // Load lesson data
  useEffect(() => {
    async function loadLessonData() {
      try {
        setLoading(true);
        setError(null);
        
        let lesson;
        
        // Try to load real lesson if lessonId provided
        if (lessonId) {
          try {
            lesson = await loadLesson(lessonId);
            addEvent(`📚 Loaded lesson: ${lesson.title}`);
          } catch (err) {
            console.warn('[SessionPageV2] Failed to load lesson, using test data:', err);
            lesson = generateTestLesson();
            addEvent('📚 Using test lesson (load failed)');
          }
        } else {
          // No lessonId - use test data
          lesson = generateTestLesson();
          addEvent('📚 Using test lesson (no lessonId)');
        }
        
        setLessonData(lesson);
        setLoading(false);
      } catch (err) {
        console.error('[SessionPageV2] Lesson load error:', err);
        setError(err.message);
        setLoading(false);
      }
    }
    
    loadLessonData();
  }, [lessonId]);
  
  const addEvent = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setEvents(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 15));
  };
  
  // Initialize AudioEngine
  useEffect(() => {
    if (!videoRef.current) return;
    
    const engine = new AudioEngine({ videoElement: videoRef.current });
    audioEngineRef.current = engine;
    
    // Subscribe to AudioEngine events
    engine.on('start', (data) => {
      addEvent('🎬 AudioEngine START');
      setEngineState('playing');
    });
    
    engine.on('end', (data) => {
      addEvent(`🏁 AudioEngine END (completed: ${data.completed})`);
      setEngineState('idle');
    });
    
    engine.on('captionChange', (data) => {
      setCurrentCaption(data.text);
    });
    
    engine.on('captionsDone', () => {
      setCurrentCaption('');
    });
    
    engine.on('error', (data) => {
      addEvent(`❌ AudioEngine ERROR: ${data.message}`);
      setEngineState('error');
    });
    
    return () => {
      engine.destroy();
    };
  }, []);
  
  // Initialize TeachingController when lesson loads
  useEffect(() => {
    if (!lessonData || !audioEngineRef.current) return;
    
    const controller = new TeachingController({
      audioEngine: audioEngineRef.current,
      lessonData: lessonData
    });
    
    teachingControllerRef.current = controller;
    
    // Subscribe to TeachingController events
    controller.on('stageChange', (data) => {
      addEvent(`📖 Stage: ${data.stage} (${data.totalSentences} sentences)`);
      setTeachingStage(data.stage);
      setTotalSentences(data.totalSentences);
      setSentenceIndex(0);
      setIsInSentenceMode(true);
    });
    
    controller.on('sentenceAdvance', (data) => {
      addEvent(`➡️ Sentence ${data.index + 1}/${data.total}`);
      setSentenceIndex(data.index);
    });
    
    controller.on('sentenceComplete', (data) => {
      addEvent(`✅ Sentence ${data.index + 1} complete`);
    });
    
    controller.on('finalGateReached', (data) => {
      addEvent(`🚪 Final gate: ${data.stage}`);
      setIsInSentenceMode(false);
    });
    
    controller.on('teachingComplete', (data) => {
      addEvent(`🎉 Teaching complete! (${data.vocabCount} vocab, ${data.exampleCount} examples)`);
      setTeachingStage('complete');
    });
    
    return () => {
      controller.destroy();
      teachingControllerRef.current = null;
    };
  }, [lessonData]);
  
  const startTeaching = async () => {
    if (!teachingControllerRef.current) return;
    await teachingControllerRef.current.startTeaching();
  };
  
  const nextSentence = () => {
    if (!teachingControllerRef.current) return;
    teachingControllerRef.current.nextSentence();
  };
  
  const repeatSentence = () => {
    if (!teachingControllerRef.current) return;
    teachingControllerRef.current.repeatSentence();
  };
  
  const skipToExamples = () => {
    if (!teachingControllerRef.current) return;
    teachingControllerRef.current.skipToExamples();
  };
  
  const restartStage = () => {
    if (!teachingControllerRef.current) return;
    teachingControllerRef.current.restartStage();
  };
  
  const stopAudio = () => {
    if (!audioEngineRef.current) return;
    audioEngineRef.current.stop();
  };
  
  const pauseAudio = () => {
    if (!audioEngineRef.current) return;
    audioEngineRef.current.pause();
  };
  
  const resumeAudio = () => {
    if (!audioEngineRef.current) return;
    audioEngineRef.current.resume();
  };
  
  const toggleMute = () => {
    if (!audioEngineRef.current) return;
    audioEngineRef.current.setMuted(!audioEngineRef.current.isMuted);
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading lesson...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-100 text-red-700 p-6 rounded-lg max-w-md">
          <h2 className="font-bold mb-2">Error loading lesson</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-2">V2 Architecture - Teaching Flow</h1>
          <p className="text-gray-600">TeachingController + AudioEngine with event-driven architecture</p>
          {lessonData && (
            <div className="mt-4 text-sm text-gray-500 space-y-1">
              <div className="font-semibold">{lessonData.title}</div>
              <div>Vocab: {lessonData.vocab?.length || 0} terms</div>
              <div>Examples: {lessonData.examples?.length || 0} sentences</div>
            </div>
          )}
        </div>
        
        {/* Video Panel */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Video</h2>
          <video
            ref={videoRef}
            src="/media/sonoma_vid_bg_loop.mp4"
            loop
            muted
            playsInline
            className="w-full rounded-lg bg-black"
            style={{ maxHeight: '300px' }}
          />
        </div>
        
        {/* Teaching Controls */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Teaching Controls</h2>
          
          {/* Stage Info */}
          <div className="mb-4 p-4 bg-gray-50 rounded">
            <div className="font-semibold text-lg">Stage: {teachingStage}</div>
            {(teachingStage === 'definitions' || teachingStage === 'examples') && (
              <div className="text-sm text-gray-600 mt-1">
                Sentence {sentenceIndex + 1} of {totalSentences}
                {!isInSentenceMode && <span className="ml-2 text-yellow-600">(Final Gate)</span>}
              </div>
            )}
          </div>
          
          {/* Start Button */}
          {teachingStage === 'idle' && (
            <button
              onClick={startTeaching}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
            >
              Start Teaching
            </button>
          )}
          
          {/* Navigation Controls */}
          {(teachingStage === 'definitions' || teachingStage === 'examples') && (
            <div className="space-y-3">
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={nextSentence}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {isInSentenceMode 
                    ? 'Next Sentence' 
                    : teachingStage === 'definitions' 
                      ? 'Continue to Examples' 
                      : 'Complete Teaching'
                  }
                </button>
                <button
                  onClick={repeatSentence}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                  disabled={!isInSentenceMode}
                >
                  Repeat
                </button>
                <button
                  onClick={restartStage}
                  className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                >
                  Restart Stage
                </button>
                {teachingStage === 'definitions' && (
                  <button
                    onClick={skipToExamples}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Skip to Examples
                  </button>
                )}
              </div>
              
              {/* Audio Transport */}
              <div className="flex gap-2 pt-2 border-t">
                <button
                  onClick={stopAudio}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Stop
                </button>
                <button
                  onClick={pauseAudio}
                  className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
                >
                  Pause
                </button>
                <button
                  onClick={resumeAudio}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Resume
                </button>
                <button
                  onClick={toggleMute}
                  className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Toggle Mute
                </button>
              </div>
            </div>
          )}
          
          {/* Complete */}
          {teachingStage === 'complete' && (
            <div className="text-green-600 font-semibold text-lg">
              ✓ Teaching Complete
            </div>
          )}
        </div>
        
        {/* Current Sentence */}
        {teachingControllerRef.current && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Current Sentence</h2>
            <div className="text-xl p-4 bg-blue-50 rounded min-h-[80px] flex items-center">
              {teachingControllerRef.current.currentSentence || (
                <span className="text-gray-400">No sentence</span>
              )}
            </div>
          </div>
        )}
        
        {/* Live Caption */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Live Caption</h2>
          <div className="text-2xl text-center py-8 min-h-[120px] flex items-center justify-center">
            {currentCaption || <span className="text-gray-400">No caption</span>}
          </div>
        </div>
        
        {/* System State */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">System State</h2>
          <div className="space-y-3">
            <div>
              <div className="text-sm font-semibold text-gray-600 mb-1">TeachingController</div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  teachingStage === 'definitions' || teachingStage === 'examples' ? 'bg-blue-500' :
                  teachingStage === 'complete' ? 'bg-green-500' :
                  'bg-gray-300'
                }`} />
                <span className="font-mono">{teachingStage}</span>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-600 mb-1">AudioEngine</div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  engineState === 'playing' ? 'bg-green-500' :
                  engineState === 'error' ? 'bg-red-500' :
                  'bg-gray-300'
                }`} />
                <span className="font-mono">{engineState}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Event Log */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Event Log</h2>
          <div className="space-y-1 font-mono text-sm">
            {events.length === 0 && (
              <div className="text-gray-400">No events yet</div>
            )}
            {events.map((event, i) => (
              <div key={i} className="text-gray-700">{event}</div>
            ))}
          </div>
        </div>
        
      </div>
    </div>
  );
}
