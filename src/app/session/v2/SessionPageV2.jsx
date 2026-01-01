"use client";

/**
 * Session Page V2 - Full Session Flow
 * 
 * Architecture:
 * - PhaseOrchestrator: Manages phase transitions (teaching → comprehension → exercise → worksheet → test → closing)
 * - TeachingController: Manages definitions → examples
 * - ComprehensionPhase: Manages question → answer → feedback
 * - ExercisePhase: Manages multiple choice/true-false questions with scoring
 * - WorksheetPhase: Manages fill-in-blank questions with text input
 * - TestPhase: Manages graded test questions with review
 * - ClosingPhase: Manages closing message
 * - AudioEngine: Self-contained playback
 * - Event-driven: Zero state coupling between components
 * 
 * Enable via localStorage flag: localStorage.setItem('session_architecture_v2', 'true')
 */

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { AudioEngine } from './AudioEngine';
import { TeachingController } from './TeachingController';
import { ComprehensionPhase } from './ComprehensionPhase';
import { ExercisePhase } from './ExercisePhase';
import { WorksheetPhase } from './WorksheetPhase';
import { TestPhase } from './TestPhase';
import { ClosingPhase } from './ClosingPhase';
import { DiscussionPhase } from './DiscussionPhase';
import { PhaseOrchestrator } from './PhaseOrchestrator';
import { SnapshotService } from './SnapshotService';
import { TimerService } from './TimerService';
import { KeyboardService } from './KeyboardService';
import { OpeningActionsController } from './OpeningActionsController';
import PlayTimeExpiredOverlay from './PlayTimeExpiredOverlay';
import EventBus from './EventBus';
import { loadLesson, generateTestLesson, fetchTTS } from './services';

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
  const regenerateParam = searchParams?.get('regenerate'); // Support generated lessons
  
  const videoRef = useRef(null);
  const audioEngineRef = useRef(null);
  const eventBusRef = useRef(null); // Shared EventBus for all services
  const orchestratorRef = useRef(null);
  const snapshotServiceRef = useRef(null);
  const timerServiceRef = useRef(null);
  const keyboardServiceRef = useRef(null);
  const teachingControllerRef = useRef(null);
  const openingActionsControllerRef = useRef(null);
  const comprehensionPhaseRef = useRef(null);
  const discussionPhaseRef = useRef(null);
  const exercisePhaseRef = useRef(null);
  const worksheetPhaseRef = useRef(null);
  const testPhaseRef = useRef(null);
  const closingPhaseRef = useRef(null);
  
  const [lessonData, setLessonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [currentPhase, setCurrentPhase] = useState('idle');
  
  const [teachingStage, setTeachingStage] = useState('idle');
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [totalSentences, setTotalSentences] = useState(0);
  const [isInSentenceMode, setIsInSentenceMode] = useState(true);
  
  const [comprehensionState, setComprehensionState] = useState('idle');
  const [comprehensionAnswer, setComprehensionAnswer] = useState('');
  const [comprehensionTimerMode, setComprehensionTimerMode] = useState('play');
  
  const [exerciseState, setExerciseState] = useState('idle');
  const [currentExerciseQuestion, setCurrentExerciseQuestion] = useState(null);
  const [exerciseScore, setExerciseScore] = useState(0);
  const [exerciseTotalQuestions, setExerciseTotalQuestions] = useState(0);
  const [selectedExerciseAnswer, setSelectedExerciseAnswer] = useState('');
  const [exerciseTimerMode, setExerciseTimerMode] = useState('play');
  
  const [worksheetState, setWorksheetState] = useState('idle');
  const [currentWorksheetQuestion, setCurrentWorksheetQuestion] = useState(null);
  const [worksheetScore, setWorksheetScore] = useState(0);
  const [worksheetTotalQuestions, setWorksheetTotalQuestions] = useState(0);
  const [worksheetAnswer, setWorksheetAnswer] = useState('');
  const [lastWorksheetFeedback, setLastWorksheetFeedback] = useState(null);
  const [worksheetTimerMode, setWorksheetTimerMode] = useState('play');
  
  const [testState, setTestState] = useState('idle');
  const [currentTestQuestion, setCurrentTestQuestion] = useState(null);
  const [testScore, setTestScore] = useState(0);
  const [testTotalQuestions, setTestTotalQuestions] = useState(0);
  const [testAnswer, setTestAnswer] = useState('');
  const [testGrade, setTestGrade] = useState(null);
  const [testReviewAnswer, setTestReviewAnswer] = useState(null);
  const [testReviewIndex, setTestReviewIndex] = useState(0);
  const [testTimerMode, setTestTimerMode] = useState('play');
  
  const [closingState, setClosingState] = useState('idle');
  const [closingMessage, setClosingMessage] = useState('');
  
  const [discussionState, setDiscussionState] = useState('idle');
  const [discussionActivity, setDiscussionActivity] = useState(null);
  const [discussionPrompt, setDiscussionPrompt] = useState('');
  const [discussionResponse, setDiscussionResponse] = useState('');
  const [discussionActivityIndex, setDiscussionActivityIndex] = useState(0);
  
  // Opening actions state
  const [openingActionActive, setOpeningActionActive] = useState(false);
  const [openingActionType, setOpeningActionType] = useState(null);
  const [openingActionState, setOpeningActionState] = useState({});

  const [snapshotLoaded, setSnapshotLoaded] = useState(false);
  const [resumePhase, setResumePhase] = useState(null);
  
  const [sessionTime, setSessionTime] = useState('0:00');
  const [workPhaseTime, setWorkPhaseTime] = useState('0:00');
  const [workPhaseRemaining, setWorkPhaseRemaining] = useState('0:00');
  const [goldenKeyEligible, setGoldenKeyEligible] = useState(false);
  
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
        
        // Check for generated lesson (regenerate parameter)
        if (regenerateParam) {
          try {
            addEvent('🤖 Loading generated lesson...');
            const response = await fetch(`/api/lesson-engine/regenerate?key=${regenerateParam}`);
            if (!response.ok) {
              throw new Error(`Failed to load generated lesson: ${response.statusText}`);
            }
            const data = await response.json();
            lesson = data.lesson;
            addEvent(`📚 Loaded generated lesson: ${lesson.title || 'Untitled'}`);
          } catch (err) {
            console.warn('[SessionPageV2] Failed to load generated lesson, using test data:', err);
            lesson = generateTestLesson();
            addEvent('📚 Using test lesson (generated load failed)');
          }
        }
        // Try to load public lesson if lessonId provided
        else if (lessonId) {
          try {
            lesson = await loadLesson(lessonId);
            addEvent(`📚 Loaded lesson: ${lesson.title}`);
          } catch (err) {
            console.warn('[SessionPageV2] Failed to load lesson, using test data:', err);
            lesson = generateTestLesson();
            addEvent('📚 Using test lesson (load failed)');
          }
        } else {
          // No lessonId or regenerate - use test data
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
  }, [lessonId, regenerateParam]);
  
  // Initialize shared EventBus (must be first)
  useEffect(() => {
    eventBusRef.current = new EventBus();
    
    return () => {
      if (eventBusRef.current) {
        eventBusRef.current.clear();
        eventBusRef.current = null;
      }
    };
  }, []);
  
  // Initialize SnapshotService after lesson loads
  useEffect(() => {
    if (!lessonData) return;
    
    // Generate session ID (in production, this would come from route params)
    const sessionId = `session_${Date.now()}`;
    const learnerId = 'test_learner'; // In production, from auth
    
    // Initialize Supabase client
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    const service = new SnapshotService({
      sessionId: sessionId,
      learnerId: learnerId,
      lessonKey: lessonData.key,
      supabaseClient: supabase
    });
    
    snapshotServiceRef.current = service;
    
    // Load existing snapshot
    service.initialize().then(snapshot => {
      if (snapshot) {
        addEvent(`💾 Loaded snapshot - Resume from: ${snapshot.currentPhase}`);
        setResumePhase(snapshot.currentPhase);
      } else {
        addEvent('💾 No snapshot found - Starting fresh');
      }
      setSnapshotLoaded(true);
    });
    
    return () => {
      snapshotServiceRef.current = null;
    };
  }, [lessonData]);
  
  // Initialize TimerService
  useEffect(() => {
    if (!eventBusRef.current) return;
    
    const eventBus = eventBusRef.current;
    
    // Forward timer events to UI
    const unsubSessionTick = eventBus.on('sessionTimerTick', (data) => {
      setSessionTime(data.formatted);
    });
    
    const unsubWorkTick = eventBus.on('workPhaseTimerTick', (data) => {
      setWorkPhaseTime(data.formatted);
      setWorkPhaseRemaining(data.remainingFormatted);
    });
    
    const unsubWorkComplete = eventBus.on('workPhaseTimerComplete', (data) => {
      addEvent(`⏱️ ${data.phase} timer complete!`);
    });
    
    const unsubGoldenKey = eventBus.on('goldenKeyEligible', (data) => {
      setGoldenKeyEligible(data.eligible);
      if (data.eligible) {
        addEvent('🔑 Golden Key earned!');
      }
    });
    
    const timer = new TimerService(
      eventBus,
      {
        workPhaseTimeLimits: {
          exercise: 180,   // 3 minutes
          worksheet: 300,  // 5 minutes
          test: 600        // 10 minutes
        }
      }
    );
    
    timerServiceRef.current = timer;
    
    return () => {
      timer.destroy();
      timerServiceRef.current = null;
    };
  }, []);
  
  // Initialize KeyboardService
  useEffect(() => {
    if (!eventBusRef.current) return;
    
    const eventBus = eventBusRef.current;
    
    // Forward hotkey events
    const unsubHotkey = eventBus.on('hotkeyPressed', (data) => {
      handleHotkey(data);
    });
    
    const keyboard = new KeyboardService(eventBus);
    
    keyboardServiceRef.current = keyboard;
    keyboard.init();
    
    return () => {
      keyboard.destroy();
      keyboardServiceRef.current = null;
    };
  }, []);
  
  const addEvent = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setEvents(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 15));
  };
  
  // Orientation and layout detection (matching V1)
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);
  const [videoMaxHeight, setVideoMaxHeight] = useState(null);
  const [videoColPercent, setVideoColPercent] = useState(50);
  const [sideBySideHeight, setSideBySideHeight] = useState(null);
  const [stackedCaptionHeight, setStackedCaptionHeight] = useState(null);
  const videoColRef = useRef(null);
  const captionColRef = useRef(null);
  
  // Calculate video height and column width based on viewport (matching V1 logic)
  useEffect(() => {
    const calcVideoHeight = () => {
      try {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const isLandscape = w > h;
        setIsMobileLandscape(isLandscape);
        
        if (!isLandscape) {
          setVideoMaxHeight(null);
          setVideoColPercent(50);
          return;
        }
        
        // Multi-stage smooth ramp for video height: 40% at 375px -> 65% at 600px -> 70% at 700px -> 75% at 1000px
        let frac;
        if (h <= 375) {
          frac = 0.40;
        } else if (h <= 600) {
          const t = (h - 375) / (600 - 375);
          frac = 0.40 + t * (0.65 - 0.40);
        } else if (h <= 700) {
          const t = (h - 600) / (700 - 600);
          frac = 0.65 + t * (0.70 - 0.65);
        } else if (h <= 1000) {
          const t = (h - 700) / (1000 - 700);
          frac = 0.70 + t * (0.75 - 0.70);
        } else {
          frac = 0.75;
        }
        const target = Math.round(h * frac);
        setVideoMaxHeight(target);
        
        // Video column width: 30% at 500px -> 50% at 700px
        const hwMin = 500;
        const hwMax = 700;
        let pct;
        if (h <= hwMin) {
          pct = 30;
        } else if (h >= hwMax) {
          pct = 50;
        } else {
          const t2 = (h - hwMin) / (hwMax - hwMin);
          pct = 30 + t2 * (50 - 30);
        }
        pct = Math.max(30, Math.min(50, Math.round(pct * 100) / 100));
        setVideoColPercent(pct);
      } catch {
        setVideoMaxHeight(null);
      }
    };
    
    calcVideoHeight();
    window.addEventListener('resize', calcVideoHeight);
    window.addEventListener('orientationchange', calcVideoHeight);
    
    // Listen to visualViewport for mobile URL bar changes
    let vv = null;
    try {
      vv = window.visualViewport || null;
    } catch {
      vv = null;
    }
    const handleVV = () => calcVideoHeight();
    if (vv) {
      try {
        vv.addEventListener('resize', handleVV);
      } catch {}
      try {
        vv.addEventListener('scroll', handleVV);
      } catch {}
    }
    
    return () => {
      window.removeEventListener('resize', calcVideoHeight);
      window.removeEventListener('orientationchange', calcVideoHeight);
      if (vv) {
        try {
          vv.removeEventListener('resize', handleVV);
        } catch {}
        try {
          vv.removeEventListener('scroll', handleVV);
        } catch {}
      }
    };
  }, []);
  
  // Measure video column height for side-by-side sync (landscape only)
  useEffect(() => {
    if (!isMobileLandscape) {
      setSideBySideHeight(null);
      return;
    }
    
    const v = videoColRef.current;
    if (!v) return;
    
    const measure = () => {
      try {
        const h = v.getBoundingClientRect().height;
        if (Number.isFinite(h) && h > 0) {
          const next = Math.round(h);
          setSideBySideHeight(prev => prev !== next ? next : prev);
        }
      } catch {}
    };
    
    measure();
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      try {
        ro.observe(v);
      } catch {}
    } else {
      window.addEventListener('resize', measure);
      window.addEventListener('orientationchange', measure);
    }
    
    return () => {
      try {
        ro && ro.disconnect();
      } catch {}
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [isMobileLandscape, videoMaxHeight]);
  
  // Initialize AudioEngine
  useEffect(() => {
    if (!videoRef.current) return;
    
    const engine = new AudioEngine({ videoElement: videoRef.current });
    audioEngineRef.current = engine;
    
    // Initialize audio system (required for iOS)
    const initAudio = async () => {
      try {
        await engine.initialize();
        addEvent('🔊 Audio initialized');
      } catch (err) {
        console.error('[SessionPageV2] Audio init failed:', err);
      }
    };
    
    // Auto-initialize on first user interaction
    const unlockAudio = () => {
      initAudio();
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
    
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });
    
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
    
    controller.on('requestSnapshotSave', (data) => {
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.saveProgress(data.trigger, data.data);
      }
    });
    
    // Note: teachingComplete handled in startTeachingPhase, not here
    
    return () => {
      controller.destroy();
      teachingControllerRef.current = null;
    };
  }, [lessonData]);
  
  // Initialize PhaseOrchestrator when lesson loads
  useEffect(() => {
    if (!lessonData) return;
    
    const orchestrator = new PhaseOrchestrator({
      lessonData: lessonData,
      useDiscussion: true // Enable discussion phase
    });
    
    orchestratorRef.current = orchestrator;
    
    // Initialize OpeningActionsController
    if (audioEngineRef.current && eventBusRef.current) {
      const openingController = new OpeningActionsController(
        eventBusRef.current,
        audioEngineRef.current,
        {
          phase: currentPhase,
          subject: lessonData.subject || 'math',
          learnerGrade: learnerGrade || '',
          difficulty: difficultyParam || 'moderate'
        }
      );
      
      openingActionsControllerRef.current = openingController;
      
      // Subscribe to opening action events
      eventBusRef.current.on('openingActionStart', (data) => {
        addEvent(`🎯 Opening action: ${data.type}`);
        setOpeningActionActive(true);
        setOpeningActionType(data.type);
        setOpeningActionState(openingController.getState() || {});
      });
      
      eventBusRef.current.on('openingActionComplete', (data) => {
        addEvent(`✅ Opening action complete: ${data.type}`);
        setOpeningActionActive(false);
        setOpeningActionType(null);
        setOpeningActionState({});
      });
      
      eventBusRef.current.on('openingActionCancel', (data) => {
        addEvent(`❌ Opening action cancelled: ${data.type}`);
        setOpeningActionActive(false);
        setOpeningActionType(null);
        setOpeningActionState({});
      });
    }
    
    // Subscribe to phase transitions
    orchestrator.on('phaseChange', (data) => {
      addEvent(`🔄 Phase: ${data.phase}`);
      setCurrentPhase(data.phase);
      
      // Update keyboard service phase
      if (keyboardServiceRef.current) {
        keyboardServiceRef.current.setPhase(data.phase);
      }
      
      // Start phase-specific controller
      if (data.phase === 'discussion') {
        startDiscussionPhase();
      } else if (data.phase === 'teaching') {
        startTeachingPhase();
      } else if (data.phase === 'comprehension') {
        startComprehensionPhase();
      } else if (data.phase === 'exercise') {
        startExercisePhase();
      } else if (data.phase === 'worksheet') {
        startWorksheetPhase();
      } else if (data.phase === 'test') {
        startTestPhase();
      } else if (data.phase === 'closing') {
        startClosingPhase();
      }
    });
    
    orchestrator.on('sessionComplete', (data) => {
      addEvent('🏁 Session complete!');
      setCurrentPhase('complete');
      
      // Set prevention flag to block any snapshot saves during cleanup
      if (typeof window !== 'undefined') {
        window.__PREVENT_SNAPSHOT_SAVE__ = true;
      }
      
      // Stop session timer
      if (timerServiceRef.current) {
        timerServiceRef.current.stopSessionTimer();
        const time = timerServiceRef.current.getSessionTime();
        addEvent(`⏱️ Total session time: ${time.formatted}`);
        
        // Show golden key status
        const goldenKey = timerServiceRef.current.getGoldenKeyStatus();
        if (goldenKey.eligible) {
          addEvent(`🔑 Golden Key Earned! (${goldenKey.onTimeCompletions}/3 on-time)`);
        } else {
          addEvent(`🔑 Golden Key not earned (${goldenKey.onTimeCompletions}/3 on-time)`);
        }
      }
      
      // Delete snapshot (session finished)
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.deleteSnapshot().then(() => {
          addEvent('💾 Cleared session snapshot');
          
          // Clear prevention flag after cleanup completes
          if (typeof window !== 'undefined') {
            delete window.__PREVENT_SNAPSHOT_SAVE__;
          }
        }).catch(err => {
          console.error('[SessionPageV2] Delete snapshot error:', err);
          // Clear flag even on error
          if (typeof window !== 'undefined') {
            delete window.__PREVENT_SNAPSHOT_SAVE__;
          }
        });
      }
    });
    
    return () => {
      orchestrator.destroy();
      orchestratorRef.current = null;
    };
  }, [lessonData]);
  
  // Start discussion phase
  const startDiscussionPhase = () => {
    if (!audioEngineRef.current || !eventBusRef.current || !lessonData?.discussion) return;
    
    const activities = lessonData.discussion.activities || [];
    
    if (activities.length === 0) {
      // No discussion activities - skip to teaching
      addEvent('⚠️ No discussion activities - skipping to teaching');
      if (orchestratorRef.current) {
        orchestratorRef.current.onDiscussionComplete();
      }
      return;
    }
    
    // Start with first activity
    const firstActivity = activities[0];
    setDiscussionActivityIndex(0);
    
    const phase = new DiscussionPhase(
      audioEngineRef.current,
      { fetchTTS: fetchTTS },
      eventBusRef.current
    );
    
    discussionPhaseRef.current = phase;
    
    // Subscribe to events
    eventBusRef.current.on('discussionStart', (data) => {
      addEvent(`💬 Discussion: ${data.activity}`);
      setDiscussionActivity(data.activity);
      setDiscussionState('playing-prompt');
    });
    
    eventBusRef.current.on('promptComplete', (data) => {
      addEvent('❓ Prompt complete - waiting for response...');
      setDiscussionState('awaiting-response');
    });
    
    eventBusRef.current.on('responseSubmitted', (data) => {
      addEvent(`✅ Response submitted`);
    });
    
    eventBusRef.current.on('discussionComplete', (data) => {
      // Check if there are more activities
      const nextIndex = discussionActivityIndex + 1;
      
      if (nextIndex < activities.length) {
        // Start next activity
        setDiscussionActivityIndex(nextIndex);
        const nextActivity = activities[nextIndex];
        phase.start(nextActivity.type, nextActivity.prompt);
      } else {
        // All activities complete
        addEvent('🎉 All discussion activities complete!');
        setDiscussionState('complete');
        
        // Save snapshot
        if (snapshotServiceRef.current) {
          snapshotServiceRef.current.savePhaseCompletion('discussion', {
            activitiesCompleted: activities.length
          }).then(() => {
            addEvent('💾 Saved discussion progress');
          }).catch(err => {
            console.error('[SessionPageV2] Save discussion error:', err);
          });
        }
        
        // Notify orchestrator
        if (orchestratorRef.current) {
          orchestratorRef.current.onDiscussionComplete();
        }
        
        // Cleanup
        phase.destroy();
        discussionPhaseRef.current = null;
      }
    });
    
    // Start first activity
    phase.start(firstActivity.type, firstActivity.prompt);
    setDiscussionPrompt(firstActivity.prompt);
  };
  
  // Start teaching phase
  const startTeachingPhase = () => {
    if (!teachingControllerRef.current) return;
    
    // Wire up teaching complete to orchestrator
    const handleTeachingComplete = (data) => {
      addEvent(`🎉 Teaching complete! (${data.vocabCount} vocab, ${data.exampleCount} examples)`);
      setTeachingStage('complete');
      
      // Save snapshot
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.savePhaseCompletion('teaching', {
          vocabCount: data.vocabCount,
          exampleCount: data.exampleCount
        }).then(() => {
          addEvent('💾 Saved teaching progress');
        }).catch(err => {
          console.error('[SessionPageV2] Save teaching error:', err);
        });
      }
      
      // Notify orchestrator
      if (orchestratorRef.current) {
        orchestratorRef.current.onTeachingComplete();
      }
    };
    
    teachingControllerRef.current.on('teachingComplete', handleTeachingComplete);
    teachingControllerRef.current.startTeaching();
  };
  
  // Start comprehension phase
  const startComprehensionPhase = () => {
    if (!audioEngineRef.current || !lessonData?.comprehension) return;
    
    const phase = new ComprehensionPhase({
      audioEngine: audioEngineRef.current,
      eventBus: eventBusRef.current,
      timerService: timerServiceRef.current,
      question: lessonData.comprehension.question || 'What did you learn?',
      sampleAnswer: lessonData.comprehension.sampleAnswer || ''
    });
    
    comprehensionPhaseRef.current = phase;
    
    // Subscribe to state changes
    phase.on('stateChange', (data) => {
      setComprehensionState(data.state);
      if (data.timerMode) {
        setComprehensionTimerMode(data.timerMode);
      }
      if (data.state === 'awaiting-answer') {
        addEvent('❓ Waiting for answer...');
      }
    });
    
    phase.on('comprehensionComplete', (data) => {
      addEvent(`✅ Comprehension complete: ${data.answer || '(skipped)'}`);
      setComprehensionState('complete');
      
      // Save snapshot
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.savePhaseCompletion('comprehension', {
          answer: data.answer,
          submitted: !!data.answer
        }).then(() => {
          addEvent('💾 Saved comprehension progress');
        }).catch(err => {
          console.error('[SessionPageV2] Save comprehension error:', err);
        });
      }
      
      // Notify orchestrator
      if (orchestratorRef.current) {
        orchestratorRef.current.onComprehensionComplete();
      }
      
      // Cleanup
      phase.destroy();
      comprehensionPhaseRef.current = null;
    });
    
    phase.on('error', (data) => {
      addEvent(`❌ Error: ${data.message}`);
    });
    
    phase.on('requestSnapshotSave', (data) => {
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.saveProgress(data.trigger, data.data);
      }
    });
    
    // Start phase
    phase.start();
  };
  
  // Start exercise phase
  const startExercisePhase = () => {
    if (!audioEngineRef.current || !lessonData?.exercise) return;
    
    // Generate exercise questions from lesson data
    const questions = lessonData.exercise.questions || [];
    
    if (questions.length === 0) {
      // If no exercise questions, skip to closing
      addEvent('⚠️ No exercise questions - skipping to closing');
      if (orchestratorRef.current) {
        orchestratorRef.current.onExerciseComplete();
      }
      return;
    }
    
    // Start work phase timer
    if (timerServiceRef.current) {
      timerServiceRef.current.startWorkPhaseTimer('exercise');
      addEvent('⏱️ Exercise timer started (3 min limit)');
    }
    
    const phase = new ExercisePhase({
      audioEngine: audioEngineRef.current,
      eventBus: eventBusRef.current,
      timerService: timerServiceRef.current,
      questions: questions
    });
    
    exercisePhaseRef.current = phase;
    
    // Subscribe to state changes
    phase.on('stateChange', (data) => {
      setExerciseState(data.state);
      if (data.timerMode) {
        setExerciseTimerMode(data.timerMode);
      }
    });
    
    // Subscribe to question events
    phase.on('questionStart', (data) => {
      addEvent(`📝 Question ${data.questionIndex + 1}/${data.totalQuestions}`);
      setCurrentExerciseQuestion(data.question);
      setExerciseTotalQuestions(data.totalQuestions);
    });
    
    phase.on('questionReady', (data) => {
      setExerciseState('awaiting-answer');
      addEvent('❓ Question ready for answer...');
    });
    
    phase.on('answerSubmitted', (data) => {
      const result = data.isCorrect ? '✅ Correct!' : '❌ Incorrect';
      addEvent(`${result} (Score: ${data.score}/${data.totalQuestions})`);
      setExerciseScore(data.score);
      setSelectedExerciseAnswer('');
    });
    
    phase.on('questionSkipped', (data) => {
      addEvent(`⏭️ Skipped (Score: ${data.score}/${data.totalQuestions})`);
      setSelectedExerciseAnswer('');
    });
    
    phase.on('exerciseComplete', (data) => {
      addEvent(`🎉 Exercise complete! Score: ${data.score}/${data.totalQuestions} (${data.percentage}%)`);
      setExerciseState('complete');
      
      // Complete work phase timer
      if (timerServiceRef.current) {
        timerServiceRef.current.completeWorkPhaseTimer('exercise');
        const time = timerServiceRef.current.getWorkPhaseTime('exercise');
        if (time) {
          const status = time.onTime ? '✅ On time!' : '⏰ Time exceeded';
          addEvent(`⏱️ Exercise completed in ${time.formatted} ${status}`);
        }
      }
      
      // Save snapshot
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.savePhaseCompletion('exercise', {
          score: data.score,
          totalQuestions: data.totalQuestions,
          percentage: data.percentage,
          answers: data.answers
        }).then(() => {
          addEvent('💾 Saved exercise progress');
        }).catch(err => {
          console.error('[SessionPageV2] Save exercise error:', err);
        });
      }
      
      // Notify orchestrator
      if (orchestratorRef.current) {
        orchestratorRef.current.onExerciseComplete();
      }
      
      // Cleanup
      phase.destroy();
      exercisePhaseRef.current = null;
    });
    
    phase.on('requestSnapshotSave', (data) => {
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.saveProgress(data.trigger, data.data);
      }
    });
    
    // Start phase
    phase.start();
  };
  
  // Start worksheet phase
  const startWorksheetPhase = () => {
    if (!audioEngineRef.current || !lessonData?.worksheet) return;
    
    // Generate worksheet questions from lesson data
    const questions = lessonData.worksheet.questions || [];
    
    if (questions.length === 0) {
      // If no worksheet questions, skip to closing
      addEvent('⚠️ No worksheet questions - skipping to closing');
      if (orchestratorRef.current) {
        orchestratorRef.current.onWorksheetComplete();
      }
      return;
    }
    
    // Start work phase timer
    if (timerServiceRef.current) {
      timerServiceRef.current.startWorkPhaseTimer('worksheet');
      addEvent('⏱️ Worksheet timer started (5 min limit)');
    }
    
    const phase = new WorksheetPhase({
      audioEngine: audioEngineRef.current,
      eventBus: eventBusRef.current,
      timerService: timerServiceRef.current,
      questions: questions
    });
    
    worksheetPhaseRef.current = phase;
    
    // Subscribe to state changes
    phase.on('stateChange', (data) => {
      setWorksheetState(data.state);
      if (data.timerMode) {
        setWorksheetTimerMode(data.timerMode);
      }
    });
    
    // Subscribe to question events
    phase.on('questionStart', (data) => {
      addEvent(`📝 Worksheet ${data.questionIndex + 1}/${data.totalQuestions}`);
      setCurrentWorksheetQuestion(data.question);
      setWorksheetTotalQuestions(data.totalQuestions);
      setLastWorksheetFeedback(null);
    });
    
    phase.on('questionReady', (data) => {
      setWorksheetState('awaiting-answer');
      addEvent('❓ Fill in the blank...');
    });
    
    phase.on('answerSubmitted', (data) => {
      const result = data.isCorrect ? '✅ Correct!' : `❌ Incorrect - Answer: ${data.correctAnswer}`;
      addEvent(`${result} (Score: ${data.score}/${data.totalQuestions})`);
      setWorksheetScore(data.score);
      setWorksheetAnswer('');
      setLastWorksheetFeedback({
        isCorrect: data.isCorrect,
        correctAnswer: data.correctAnswer
      });
    });
    
    phase.on('questionSkipped', (data) => {
      addEvent(`⏭️ Skipped - Answer: ${data.correctAnswer} (Score: ${data.score}/${data.totalQuestions})`);
      setWorksheetAnswer('');
      setLastWorksheetFeedback({
        isCorrect: false,
        correctAnswer: data.correctAnswer
      });
    });
    
    phase.on('worksheetComplete', (data) => {
      addEvent(`🎉 Worksheet complete! Score: ${data.score}/${data.totalQuestions} (${data.percentage}%)`);
      setWorksheetState('complete');
      
      // Complete work phase timer
      if (timerServiceRef.current) {
        timerServiceRef.current.completeWorkPhaseTimer('worksheet');
        const time = timerServiceRef.current.getWorkPhaseTime('worksheet');
        if (time) {
          const status = time.onTime ? '✅ On time!' : '⏰ Time exceeded';
          addEvent(`⏱️ Worksheet completed in ${time.formatted} ${status}`);
        }
      }
      
      // Save snapshot
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.savePhaseCompletion('worksheet', {
          score: data.score,
          totalQuestions: data.totalQuestions,
          percentage: data.percentage,
          answers: data.answers
        }).then(() => {
          addEvent('💾 Saved worksheet progress');
        }).catch(err => {
          console.error('[SessionPageV2] Save worksheet error:', err);
        });
      }
      
      // Notify orchestrator
      if (orchestratorRef.current) {
        orchestratorRef.current.onWorksheetComplete();
      }
      
      // Cleanup
      phase.destroy();
      worksheetPhaseRef.current = null;
    });
    
    phase.on('requestSnapshotSave', (data) => {
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.saveProgress(data.trigger, data.data);
      }
    });
    
    // Start phase
    phase.start();
  };
  
  // Start test phase
  const startTestPhase = () => {
    if (!audioEngineRef.current || !lessonData?.test) return;
    
    // Generate test questions from lesson data
    const questions = lessonData.test.questions || [];
    
    if (questions.length === 0) {
      // If no test questions, skip to closing
      addEvent('⚠️ No test questions - skipping to closing');
      if (orchestratorRef.current) {
        orchestratorRef.current.onTestComplete();
      }
      return;
    }
    
    // Start work phase timer
    if (timerServiceRef.current) {
      timerServiceRef.current.startWorkPhaseTimer('test');
      addEvent('⏱️ Test timer started (10 min limit)');
    }
    
    const phase = new TestPhase({
      audioEngine: audioEngineRef.current,
      eventBus: eventBusRef.current,
      timerService: timerServiceRef.current,
      questions: questions
    });
    
    testPhaseRef.current = phase;
    
    // Subscribe to state changes
    phase.on('stateChange', (data) => {
      setTestState(data.state);
      if (data.timerMode) {
        setTestTimerMode(data.timerMode);
      }
    });
    
    // Subscribe to test events
    phase.on('questionStart', (data) => {
      addEvent(`📝 Test Question ${data.questionIndex + 1}/${data.totalQuestions}`);
      setCurrentTestQuestion(data.question);
      setTestTotalQuestions(data.totalQuestions);
      setTestAnswer('');
    });
    
    phase.on('questionReady', (data) => {
      setTestState('awaiting-answer');
      addEvent('❓ Answer the test question...');
    });
    
    phase.on('answerSubmitted', (data) => {
      const result = data.isCorrect ? '✅ Correct!' : '❌ Incorrect';
      addEvent(`${result} (Score: ${data.score}/${data.totalQuestions})`);
      setTestScore(data.score);
      setTestAnswer('');
    });
    
    phase.on('questionSkipped', (data) => {
      addEvent(`⏭️ Skipped (Score: ${data.score}/${data.totalQuestions})`);
      setTestAnswer('');
    });
    
    phase.on('testQuestionsComplete', (data) => {
      addEvent(`📊 Test questions done! Score: ${data.score}/${data.totalQuestions} (${data.percentage}%) - Grade: ${data.grade}`);
      setTestGrade(data);
      setTestState('reviewing');
    });
    
    phase.on('reviewQuestion', (data) => {
      setTestReviewAnswer(data.answer);
      setTestReviewIndex(data.reviewIndex);
      addEvent(`📖 Review ${data.reviewIndex + 1}/${data.totalReviews}`);
    });
    
    phase.on('testComplete', (data) => {
      addEvent(`🎉 Test complete! Final grade: ${data.grade} (${data.percentage}%)`);
      setTestState('complete');
      
      // Complete work phase timer
      if (timerServiceRef.current) {
        timerServiceRef.current.completeWorkPhaseTimer('test');
        const time = timerServiceRef.current.getWorkPhaseTime('test');
        if (time) {
          const status = time.onTime ? '✅ On time!' : '⏰ Time exceeded';
          addEvent(`⏱️ Test completed in ${time.formatted} ${status}`);
        }
        
        // Check golden key status
        const goldenKey = timerServiceRef.current.getGoldenKeyStatus();
        if (goldenKey.eligible) {
          addEvent('🔑 Golden Key Earned! 3 on-time completions!');
        }
      }
      
      // Save snapshot
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.savePhaseCompletion('test', {
          score: data.score,
          totalQuestions: data.totalQuestions,
          percentage: data.percentage,
          grade: data.grade,
          answers: data.answers
        }).then(() => {
          addEvent('💾 Saved test progress');
        }).catch(err => {
          console.error('[SessionPageV2] Save test error:', err);
        });
      }
      
      // Notify orchestrator
      if (orchestratorRef.current) {
        orchestratorRef.current.onTestComplete();
      }
      
      // Cleanup
      phase.destroy();
      testPhaseRef.current = null;
    });
    
    phase.on('requestSnapshotSave', (data) => {
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.saveProgress(data.trigger, data.data);
      }
    });
    
    // Start phase
    phase.start();
  };
  
  // Start closing phase
  const startClosingPhase = () => {
    if (!audioEngineRef.current || !lessonData) return;
    
    const phase = new ClosingPhase({
      audioEngine: audioEngineRef.current,
      lessonTitle: lessonData.title || 'this lesson'
    });
    
    closingPhaseRef.current = phase;
    
    // Subscribe to state changes
    phase.on('stateChange', (data) => {
      setClosingState(data.state);
      setClosingMessage(data.message);
      if (data.state === 'playing') {
        addEvent(`💬 Closing: ${data.message}`);
      }
    });
    
    phase.on('closingComplete', (data) => {
      addEvent('✅ Closing complete');
      setClosingState('complete');
      
      // Notify orchestrator
      if (orchestratorRef.current) {
        orchestratorRef.current.onClosingComplete();
      }
      
      // Cleanup
      phase.destroy();
      closingPhaseRef.current = null;
    });
    
    // Start phase
    phase.start();
  };
  
  // Handle keyboard hotkeys
  const handleHotkey = (data) => {
    const { action, phase, key } = data;
    
    addEvent(`⌨️ Hotkey: ${key} (${action})`);
    
    // Handle phase-specific actions
    if (action === 'skip') {
      if (phase === 'teaching') {
        skipSentence();
      } else if (phase === 'discussion') {
        skipDiscussion();
      } else if (phase === 'comprehension') {
        skipComprehension();
      } else if (phase === 'exercise') {
        skipExerciseQuestion();
      } else if (phase === 'worksheet') {
        skipWorksheetQuestion();
      } else if (phase === 'test') {
        skipTestQuestion();
      }
    } else if (action === 'repeat' && phase === 'teaching') {
      repeatSentence();
    } else if (action === 'next' && phase === 'teaching') {
      nextSentence();
    } else if (action === 'pause') {
      // Toggle pause/resume
      if (audioEngineRef.current) {
        const state = audioEngineRef.current.state;
        if (state === 'playing') {
          pauseAudio();
        } else if (state === 'paused') {
          resumeAudio();
        }
      }
    } else if (action === 'stop') {
      stopAudio();
    }
  };
  
  const startSession = () => {
    if (!orchestratorRef.current) return;
    
    // Start session timer
    if (timerServiceRef.current) {
      timerServiceRef.current.startSessionTimer();
      addEvent('⏱️ Session timer started');
    }
    
    orchestratorRef.current.startSession();
  };
  
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
  
  // Discussion handlers
  const submitDiscussionResponse = () => {
    if (!discussionPhaseRef.current) return;
    discussionPhaseRef.current.submitResponse(discussionResponse);
    setDiscussionResponse(''); // Clear input after submit
  };
  
  const skipDiscussion = () => {
    if (!discussionPhaseRef.current) return;
    discussionPhaseRef.current.skip();
    setDiscussionResponse(''); // Clear input on skip
  };
  
  // Comprehension handlers
  const submitComprehensionAnswer = () => {
    if (!comprehensionPhaseRef.current) return;
    comprehensionPhaseRef.current.submitAnswer(comprehensionAnswer);
  };
  
  const skipComprehension = () => {
    if (!comprehensionPhaseRef.current) return;
    comprehensionPhaseRef.current.skip();
  };
  
  // Exercise handlers
  const submitExerciseAnswer = () => {
    if (!exercisePhaseRef.current || !selectedExerciseAnswer) return;
    exercisePhaseRef.current.submitAnswer(selectedExerciseAnswer);
  };
  
  const skipExerciseQuestion = () => {
    if (!exercisePhaseRef.current) return;
    exercisePhaseRef.current.skip();
  };
  
  // Worksheet handlers
  const submitWorksheetAnswer = () => {
    if (!worksheetPhaseRef.current || !worksheetAnswer.trim()) return;
    worksheetPhaseRef.current.submitAnswer(worksheetAnswer);
  };
  
  const skipWorksheetQuestion = () => {
    if (!worksheetPhaseRef.current) return;
    worksheetPhaseRef.current.skip();
  };
  
  // Test handlers
  const submitTestAnswer = () => {
    if (!testPhaseRef.current) return;
    
    const question = currentTestQuestion;
    if (!question) return;
    
    if (question.type === 'fill') {
      if (!testAnswer.trim()) return;
      testPhaseRef.current.submitAnswer(testAnswer);
    } else {
      // MC/TF
      if (!testAnswer) return;
      testPhaseRef.current.submitAnswer(testAnswer);
    }
  };
  
  const skipTestQuestion = () => {
    if (!testPhaseRef.current) return;
    testPhaseRef.current.skip();
  };
  
  const nextTestReview = () => {
    if (!testPhaseRef.current) return;
    testPhaseRef.current.nextReview();
  };
  
  const previousTestReview = () => {
    if (!testPhaseRef.current) return;
    testPhaseRef.current.previousReview();
  };
  
  const skipTestReview = () => {
    if (!testPhaseRef.current) return;
    testPhaseRef.current.skipReview();
  };
  
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '1.125rem', color: '#1f2937' }}>Loading lesson...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fef2f2', color: '#b91c1c', padding: 24, borderRadius: 8, maxWidth: 448 }}>
          <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Error loading lesson</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }
  
  // Layout wrapper style: side-by-side in landscape, stacked in portrait
  const videoEffectiveHeight = (videoMaxHeight && Number.isFinite(videoMaxHeight)) ? videoMaxHeight : null;
  const msSideBySideH = videoEffectiveHeight ? `${videoEffectiveHeight}px` : (sideBySideHeight ? `${sideBySideHeight}px` : 'auto');
  
  const mainLayoutStyle = isMobileLandscape
    ? { display: 'flex', alignItems: 'stretch', width: '100%', height: '100vh', overflow: 'hidden', background: '#ffffff', '--msSideBySideH': msSideBySideH }
    : { display: 'flex', flexDirection: 'column', width: '100%', minHeight: '100vh', background: '#ffffff' };
  
  const videoWrapperStyle = isMobileLandscape
    ? { flex: `0 0 ${videoColPercent}%`, position: 'relative', overflow: 'hidden', background: '#000', minWidth: 0, minHeight: 0, height: 'var(--msSideBySideH)', display: 'flex', flexDirection: 'column' }
    : { position: 'relative', width: '92%', margin: '0 auto', height: '35vh', overflow: 'hidden', background: '#000', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.12)' };
  
  // Dynamic height style: in landscape with videoMaxHeight, override aspectRatio with explicit height
  const dynamicHeightStyle = (isMobileLandscape && videoMaxHeight) ? { maxHeight: videoMaxHeight, height: videoMaxHeight, minHeight: 0 } : {};
  
  const videoInnerStyle = isMobileLandscape
    ? { position: 'relative', overflow: 'hidden', aspectRatio: '16 / 7.2', minHeight: 200, width: '100%', background: '#000', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.12)', ...dynamicHeightStyle }
    : { position: 'relative', overflow: 'hidden', height: '100%', width: '100%', background: '#000' };
  
  const transcriptWrapperStyle = isMobileLandscape
    ? { flex: `0 0 ${100 - videoColPercent}%`, display: 'flex', flexDirection: 'column', overflow: 'auto', minWidth: 0, minHeight: 0, background: '#ffffff', height: 'var(--msSideBySideH)', maxHeight: 'var(--msSideBySideH)' }
    : { flex: '1 1 auto', display: 'flex', flexDirection: 'column', overflow: 'auto', background: '#ffffff', padding: '8px 4%', marginTop: 8 };
  
  return (
    <div style={mainLayoutStyle}>
      {/* Video column */}
      <div ref={videoColRef} style={videoWrapperStyle}>
        <div style={videoInnerStyle}>
          <video
            ref={videoRef}
            src="/media/ms-sonoma-3.mp4"
            muted
            loop
            playsInline
            preload="auto"
            autoPlay
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
          />
        </div>
      
      {/* Video overlay controls - bottom right */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        display: 'flex',
        gap: 12,
        zIndex: 10
      }}>
        {/* Mute button */}
        <button
          type="button"
          onClick={() => {/* TODO: implement mute toggle */}}
          aria-label="Mute"
          title="Mute"
          style={{
            background: '#1f2937',
            color: '#fff',
            border: 'none',
            width: 'clamp(34px, 6.2vw, 52px)',
            height: 'clamp(34px, 6.2vw, 52px)',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '50%',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
          }}
        >
          <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <path d="M19 8a5 5 0 010 8" />
            <path d="M15 11a2 2 0 010 2" />
          </svg>
        </button>
      </div>
      
      {/* Skip/Repeat button - bottom left */}
      {currentPhase !== 'idle' && (
        <button
          type="button"
          onClick={() => {/* TODO: implement skip/repeat */}}
          aria-label="Repeat"
          title="Repeat"
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            background: '#1f2937',
            color: '#fff',
            border: 'none',
            width: 'clamp(34px, 6.2vw, 52px)',
            height: 'clamp(34px, 6.2vw, 52px)',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '50%',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            zIndex: 10
          }}
        >
          <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <polyline points="23 20 23 14 17 14" />
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
          </svg>
        </button>
      )}
      
      {/* Session Timer - overlay in top left */}
      {currentPhase !== 'idle' && sessionTime && (
        <div style={{ 
          position: 'absolute',
          top: 8,
          left: 8,
          background: 'rgba(17,24,39,0.85)',
          color: '#fff',
          padding: '10px 14px',
          borderRadius: 10,
          fontSize: 'clamp(1rem, 2vw, 1.25rem)',
          fontWeight: 700,
          letterSpacing: 0.4,
          boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
          zIndex: 10001
        }}>
          {sessionTime}
        </div>
      )}
      
      {/* Score ticker - top right */}
      {(currentPhase === 'comprehension' || currentPhase === 'exercise') && (
        <div style={{ 
          position: 'absolute', 
          top: 8, 
          right: 8, 
          background: 'rgba(17,24,39,0.78)', 
          color: '#fff', 
          padding: '6px 10px', 
          borderRadius: 8, 
          fontSize: 'clamp(0.85rem, 1.6vw, 1rem)', 
          fontWeight: 600, 
          letterSpacing: 0.3, 
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)', 
          zIndex: 10000, 
          pointerEvents: 'none' 
        }}>
          {currentPhase === 'comprehension' ? `${comprehensionScore || 0}/${comprehensionTotalQuestions || 3}` : `${exerciseScore}/${exerciseTotalQuestions}`}
        </div>
      )}
      
      {/* Worksheet/Test question counter - top right */}
      {((currentPhase === 'worksheet' && worksheetState === 'awaiting-answer') || (currentPhase === 'test' && testState === 'awaiting-answer')) && (
        <div style={{ 
          position: 'absolute', 
          top: 8, 
          right: 8, 
          background: 'rgba(17,24,39,0.78)', 
          color: '#fff', 
          padding: '6px 10px', 
          borderRadius: 8, 
          fontSize: 'clamp(0.85rem, 1.6vw, 1rem)', 
          fontWeight: 600, 
          letterSpacing: 0.3, 
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)', 
          zIndex: 10000, 
          pointerEvents: 'none' 
        }}>
          Question {currentPhase === 'worksheet' ? (worksheetScore + 1) : (testScore + 1)}
        </div>
      )}
      
      {/* Worksheet question overlay on video */}
      {currentPhase === 'worksheet' && worksheetState === 'awaiting-answer' && currentWorksheetQuestion && (
        <div style={{ 
          position: 'absolute', 
          inset: 0, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '24px 32px', 
          pointerEvents: 'none', 
          textAlign: 'center' 
        }}>
          <div style={{ 
            fontSize: 'clamp(1.75rem, 4.2vw, 3.25rem)', 
            fontWeight: 800, 
            lineHeight: 1.18, 
            color: '#ffffff', 
            textShadow: '0 0 4px rgba(0,0,0,0.9), 0 2px 6px rgba(0,0,0,0.85), 0 4px 22px rgba(0,0,0,0.65)', 
            letterSpacing: 0.5, 
            width: '100%' 
          }}>
            {currentWorksheetQuestion.question}
          </div>
        </div>
      )}
      
      {/* Work timer countdown overlay */}
      {['exercise', 'worksheet', 'test'].includes(currentPhase) && workPhaseRemaining && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'linear-gradient(135deg, rgba(249,115,22,0.95) 0%, rgba(220,38,38,0.95) 100%)',
          color: '#fff',
          padding: '32px 48px',
          borderRadius: 20,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          zIndex: 9999,
          pointerEvents: 'none',
          border: '4px solid rgba(255,255,255,0.3)'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.9, marginBottom: 8 }}>
            {currentPhase} Timer
          </div>
          <div style={{ fontSize: '4rem', fontWeight: 800, fontFamily: 'monospace', lineHeight: 1 }}>
            {workPhaseRemaining}
          </div>
        </div>
      )}
      
      {/* Caption area - bottom center */}
      {currentCaption && (
        <div style={{
          position: 'absolute',
          bottom: 120,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.8)',
          color: '#fff',
          padding: '16px 32px',
          borderRadius: 12,
          fontSize: 'clamp(1rem, 2vw, 1.5rem)',
          maxWidth: '90%',
          textAlign: 'center',
          zIndex: 10000
        }}>
          {currentCaption}
        </div>
      )}
      
      {/* Phase Controls - bottom center overlay */}
      <div style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10002
      }}>
          
          {/* Teaching Phase */}
          {currentPhase === 'teaching' && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              {(teachingStage === 'definitions' || teachingStage === 'examples') && (
                <>
                  <button
                    onClick={nextSentence}
                    style={{
                      padding: '12px 28px',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      fontSize: '1rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)'
                    }}
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
                    disabled={!isInSentenceMode}
                    style={{
                      padding: '12px 28px',
                      background: isInSentenceMode ? 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)' : '#9ca3af',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      fontSize: '1rem',
                      fontWeight: 600,
                      cursor: isInSentenceMode ? 'pointer' : 'not-allowed',
                      boxShadow: isInSentenceMode ? '0 4px 16px rgba(168, 85, 247, 0.4)' : 'none'
                    }}
                  >
                    Repeat
                  </button>
                  <button
                    onClick={restartStage}
                    style={{
                      padding: '12px 28px',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      fontSize: '1rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(245, 158, 11, 0.4)'
                    }}
                  >
                    Restart Stage
                  </button>
                  {teachingStage === 'definitions' && (
                    <button
                      onClick={skipToExamples}
                      style={{
                        padding: '12px 28px',
                        background: 'rgba(55, 65, 81, 0.9)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        fontSize: '1rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      Skip to Examples
                    </button>
                  )}
                </>
              )}
            </div>
          )}
          
          {/* Discussion Phase */}
          {currentPhase === 'discussion' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {discussionState === 'awaiting-response' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <textarea
                    value={discussionResponse}
                    onChange={(e) => setDiscussionResponse(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 12,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderRadius: 8,
                      fontSize: '1rem',
                      background: 'rgba(255,255,255,0.95)',
                      minHeight: 100
                    }}
                    rows={4}
                    placeholder="Type your response here..."
                  />
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      onClick={submitDiscussionResponse}
                      style={{
                        padding: '12px 28px',
                        background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        fontSize: '1rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(236, 72, 153, 0.4)'
                      }}
                    >
                      Submit Response
                    </button>
                    <button
                      onClick={skipDiscussion}
                      style={{
                        padding: '12px 28px',
                        background: 'rgba(107, 114, 128, 0.9)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        fontSize: '1rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}
              
              {discussionState === 'complete' && (
                <div style={{ color: '#10b981', fontWeight: 600, fontSize: '1.125rem' }}>
                  ✓ Discussion Activity Complete
                </div>
              )}
            </div>
          )}
          
          {/* Comprehension Phase */}
          {currentPhase === 'comprehension' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              {comprehensionState === 'awaiting-go' && (
                <>
                  {/* Opening Actions - Show during play time only */}
                  {comprehensionTimerMode === 'play' && !openingActionActive && (
                    <div style={{
                      padding: 16,
                      background: 'rgba(255, 255, 255, 0.95)',
                      borderRadius: 12,
                      border: '2px solid rgba(16, 185, 129, 0.5)',
                      marginBottom: 16,
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
                    }}>
                      <h3 style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: 12, color: '#1f2937' }}>🎯 Opening Actions</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                        <button
                          onClick={() => openingActionsControllerRef.current?.startAsk()}
                          style={{
                            padding: '12px 16px',
                            background: '#fff',
                            border: '2px solid #93c5fd',
                            color: '#1d4ed8',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          ❓ Ask Ms. Sonoma
                        </button>
                        <button
                          onClick={() => openingActionsControllerRef.current?.startRiddle()}
                          style={{
                            padding: '12px 16px',
                            background: '#fff',
                            border: '2px solid #c4b5fd',
                            color: '#7c3aed',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          🧩 Riddle
                        </button>
                        <button
                          onClick={() => openingActionsControllerRef.current?.startPoem()}
                          style={{
                            padding: '12px 16px',
                            background: '#fff',
                            border: '2px solid #f9a8d4',
                            color: '#db2777',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          📜 Poem
                        </button>
                        <button
                          onClick={() => openingActionsControllerRef.current?.startStory()}
                          style={{
                            padding: '12px 16px',
                            background: '#fff',
                            border: '2px solid #fdba74',
                            color: '#ea580c',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          📖 Story
                        </button>
                        <button
                          onClick={() => openingActionsControllerRef.current?.startFillInFun()}
                          style={{
                            padding: '12px 16px',
                            background: '#fff',
                            border: '2px solid #86efac',
                            color: '#16a34a',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          🎨 Fill-in-Fun
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Active Opening Action UI */}
                  {openingActionActive && (
                    <div style={{
                      padding: 16,
                      background: 'rgba(254, 252, 232, 0.98)',
                      borderRadius: 12,
                      border: '2px solid #fcd34d',
                      marginBottom: 16,
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h3 style={{ fontWeight: 700, fontSize: '1.125rem', color: '#1f2937' }}>
                          {openingActionType === 'ask' && '❓ Ask Ms. Sonoma'}
                          {openingActionType === 'riddle' && '🧩 Riddle'}
                          {openingActionType === 'poem' && '📜 Poem'}
                          {openingActionType === 'story' && '📖 Story'}
                          {openingActionType === 'fillInFun' && '🎨 Fill-in-Fun'}
                        </h3>
                        <button
                          onClick={() => openingActionsControllerRef.current?.destroy()}
                          style={{
                            padding: '6px 16px',
                            background: '#ef4444',
                            color: '#fff',
                            borderRadius: 6,
                            border: 'none',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                      
                      {/* Ask UI */}
                      {openingActionType === 'ask' && openingActionState.stage === 'awaiting-question' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <textarea
                            placeholder="What would you like to ask Ms. Sonoma?"
                            style={{
                              width: '100%',
                              padding: 12,
                              border: '1px solid #d1d5db',
                              borderRadius: 8,
                              fontSize: '1rem'
                            }}
                            rows={3}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey && e.target.value.trim()) {
                                e.preventDefault();
                                openingActionsControllerRef.current?.submitAsk(e.target.value.trim());
                              }
                            }}
                          />
                          <button
                            onClick={(e) => {
                              const textarea = e.target.previousElementSibling;
                              if (textarea.value.trim()) {
                                openingActionsControllerRef.current?.submitAsk(textarea.value.trim());
                              }
                            }}
                            style={{
                              padding: '10px 20px',
                              background: '#2563eb',
                              color: '#fff',
                              borderRadius: 8,
                              border: 'none',
                              fontWeight: 600,
                              cursor: 'pointer',
                              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)'
                            }}
                          >
                            Submit Question
                          </button>
                        </div>
                      )}
                      
                      {/* Riddle UI */}
                      {openingActionType === 'riddle' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {openingActionState.stage === 'question' && (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => openingActionsControllerRef.current?.getRiddleHint()}
                                style={{
                                  padding: '10px 20px',
                                  background: '#ca8a04',
                                  color: '#fff',
                                  borderRadius: 8,
                                  border: 'none',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  boxShadow: '0 2px 8px rgba(202, 138, 4, 0.4)'
                                }}
                              >
                                💡 Hint
                              </button>
                              <button
                                onClick={() => openingActionsControllerRef.current?.revealRiddleAnswer()}
                                style={{
                                  padding: '10px 20px',
                                  background: '#9333ea',
                                  color: '#fff',
                                  borderRadius: 8,
                                  border: 'none',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  boxShadow: '0 2px 8px rgba(147, 51, 234, 0.4)'
                                }}
                              >
                                🔍 Reveal Answer
                              </button>
                            </div>
                          )}
                          {openingActionState.stage === 'complete' && (
                            <button
                              onClick={() => openingActionsControllerRef.current?.completeRiddle()}
                              style={{
                                padding: '10px 20px',
                                background: '#16a34a',
                                color: '#fff',
                                borderRadius: 8,
                                border: 'none',
                                fontWeight: 600,
                                cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(22, 163, 74, 0.4)'
                              }}
                            >
                              ✓ Done
                            </button>
                          )}
                        </div>
                      )}
                      
                      {/* Story UI */}
                      {openingActionType === 'story' && openingActionState.stage === 'telling' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => openingActionsControllerRef.current?.continueStory()}
                            style={{
                              padding: '10px 20px',
                              background: '#ea580c',
                              color: '#fff',
                              borderRadius: 8,
                              border: 'none',
                              fontWeight: 600,
                              cursor: 'pointer',
                              boxShadow: '0 2px 8px rgba(234, 88, 12, 0.4)'
                            }}
                          >
                            ➡️ Continue Story
                          </button>
                          <button
                            onClick={() => openingActionsControllerRef.current?.completeStory()}
                            style={{
                              padding: '10px 20px',
                              background: '#16a34a',
                              color: '#fff',
                              borderRadius: 8,
                              border: 'none',
                              fontWeight: 600,
                              cursor: 'pointer',
                              boxShadow: '0 2px 8px rgba(22, 163, 74, 0.4)'
                            }}
                          >
                            ✓ Finish Story
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => comprehensionPhaseRef.current?.go()}
                      style={{
                        padding: '14px 36px',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        color: '#fff',
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        borderRadius: 12,
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)'
                      }}
                    >
                      Go
                    </button>
                  </div>
                </>
              )}
              
              {comprehensionState === 'awaiting-answer' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <textarea
                    value={comprehensionAnswer}
                    onChange={(e) => setComprehensionAnswer(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 12,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderRadius: 8,
                      fontSize: '1rem',
                      background: 'rgba(255,255,255,0.95)',
                      minHeight: 100
                    }}
                    rows={4}
                    placeholder="Type your answer here..."
                  />
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      onClick={submitComprehensionAnswer}
                      style={{
                        padding: '12px 28px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        fontSize: '1rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)'
                      }}
                    >
                      Submit Answer
                    </button>
                    <button
                      onClick={skipComprehension}
                      style={{
                        padding: '12px 28px',
                        background: 'rgba(107, 114, 128, 0.9)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        fontSize: '1rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}
              
              {comprehensionState === 'complete' && (
                <div style={{ color: '#10b981', fontWeight: 600, fontSize: '1.125rem' }}>
                  ✓ Comprehension Complete
                </div>
              )}
            </div>
          )}
          
          {/* Exercise Phase */}
          {currentPhase === 'exercise' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              {exerciseState === 'awaiting-go' && (
                <>
                  {/* Opening Actions - Show during play time only */}
                  {exerciseTimerMode === 'play' && !openingActionActive && (
                    <div style={{
                      padding: 16,
                      background: 'rgba(255, 255, 255, 0.95)',
                      borderRadius: 12,
                      border: '2px solid rgba(168, 85, 247, 0.5)',
                      marginBottom: 16,
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
                    }}>
                      <h3 style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: 12, color: '#1f2937' }}>🎯 Opening Actions</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                        <button
                          onClick={() => openingActionsControllerRef.current?.startAsk()}
                          style={{
                            padding: '12px 16px',
                            background: '#fff',
                            border: '2px solid #93c5fd',
                            color: '#1d4ed8',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          ❓ Ask Ms. Sonoma
                        </button>
                        <button
                          onClick={() => openingActionsControllerRef.current?.startRiddle()}
                          style={{
                            padding: '12px 16px',
                            background: '#fff',
                            border: '2px solid #c4b5fd',
                            color: '#7c3aed',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          🧩 Riddle
                        </button>
                        <button
                          onClick={() => openingActionsControllerRef.current?.startPoem()}
                          style={{
                            padding: '12px 16px',
                            background: '#fff',
                            border: '2px solid #f9a8d4',
                            color: '#db2777',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          📜 Poem
                        </button>
                        <button
                          onClick={() => openingActionsControllerRef.current?.startStory()}
                          style={{
                            padding: '12px 16px',
                            background: '#fff',
                            border: '2px solid #fdba74',
                            color: '#ea580c',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          📖 Story
                        </button>
                        <button
                          onClick={() => openingActionsControllerRef.current?.startFillInFun()}
                          style={{
                            padding: '12px 16px',
                            background: '#fff',
                            border: '2px solid #86efac',
                            color: '#16a34a',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          🎨 Fill-in-Fun
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => exercisePhaseRef.current?.go()}
                      style={{
                        padding: '14px 36px',
                        background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
                        color: '#fff',
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        borderRadius: 12,
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 20px rgba(168, 85, 247, 0.4)'
                      }}
                    >
                      Go
                    </button>
                  </div>
                </>
              )}
              
              {currentExerciseQuestion && exerciseState === 'awaiting-answer' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ padding: 16, background: 'rgba(255,255,255,0.95)', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                    <div style={{ fontWeight: 600, fontSize: '1.125rem', marginBottom: 12 }}>{currentExerciseQuestion.question}</div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {currentExerciseQuestion.options.map((option, index) => (
                        <label
                          key={index}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: 12,
                            background: selectedExerciseAnswer === option ? 'rgba(59, 130, 246, 0.1)' : '#fff',
                            border: selectedExerciseAnswer === option ? '2px solid #3b82f6' : '1px solid #d1d5db',
                            borderRadius: 8,
                            cursor: 'pointer'
                          }}
                        >
                          <input
                            type="radio"
                            name="exercise-answer"
                            value={option}
                            checked={selectedExerciseAnswer === option}
                            onChange={(e) => setSelectedExerciseAnswer(e.target.value)}
                            style={{ marginRight: 12 }}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      onClick={submitExerciseAnswer}
                      disabled={!selectedExerciseAnswer}
                      style={{
                        padding: '12px 28px',
                        background: selectedExerciseAnswer ? 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)' : '#9ca3af',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        fontSize: '1rem',
                        fontWeight: 600,
                        cursor: selectedExerciseAnswer ? 'pointer' : 'not-allowed',
                        boxShadow: selectedExerciseAnswer ? '0 4px 16px rgba(168, 85, 247, 0.4)' : 'none',
                        opacity: selectedExerciseAnswer ? 1 : 0.5
                      }}
                    >
                      Submit Answer
                    </button>
                    <button
                      onClick={skipExerciseQuestion}
                      style={{
                        padding: '12px 28px',
                        background: 'rgba(107, 114, 128, 0.9)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        fontSize: '1rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}
              
              {exerciseState === 'complete' && (
                <div style={{ color: '#10b981', fontWeight: 600, fontSize: '1.125rem' }}>
                  ✓ Exercise Complete - Score: {exerciseScore}/{exerciseTotalQuestions} ({Math.round((exerciseScore / exerciseTotalQuestions) * 100)}%)
                </div>
              )}
            </div>
          )}
          
          {/* Worksheet Phase */}
          {currentPhase === 'worksheet' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              {worksheetState === 'awaiting-go' && (
                <>
                  {/* Opening Actions - Show during play time only */}
                  {worksheetTimerMode === 'play' && !openingActionActive && (
                    <div style={{
                      padding: 16,
                      background: 'rgba(255, 255, 255, 0.95)',
                      borderRadius: 12,
                      border: '2px solid rgba(20, 184, 166, 0.5)',
                      marginBottom: 16,
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
                    }}>
                      <h3 style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: 12, color: '#1f2937' }}>🎯 Opening Actions</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                        <button
                          onClick={() => openingActionsControllerRef.current?.startAsk()}
                          style={{
                            padding: '12px 16px',
                            background: '#fff',
                            border: '2px solid #93c5fd',
                            color: '#1d4ed8',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          ❓ Ask Ms. Sonoma
                        </button>
                        <button
                          onClick={() => openingActionsControllerRef.current?.startRiddle()}
                          style={{
                            padding: '12px 16px',
                            background: '#fff',
                            border: '2px solid #c4b5fd',
                            color: '#7c3aed',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          🧩 Riddle
                        </button>
                        <button
                          onClick={() => openingActionsControllerRef.current?.startPoem()}
                          style={{
                            padding: '12px 16px',
                            background: '#fff',
                            border: '2px solid #f9a8d4',
                            color: '#db2777',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          📜 Poem
                        </button>
                        <button
                          onClick={() => openingActionsControllerRef.current?.startStory()}
                          style={{
                            padding: '12px 16px',
                            background: '#fff',
                            border: '2px solid #fdba74',
                            color: '#ea580c',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          📖 Story
                        </button>
                        <button
                          onClick={() => openingActionsControllerRef.current?.startFillInFun()}
                          style={{
                            padding: '12px 16px',
                            background: '#fff',
                            border: '2px solid #86efac',
                            color: '#16a34a',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          🎨 Fill-in-Fun
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => worksheetPhaseRef.current?.go()}
                      style={{
                        padding: '14px 36px',
                        background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                        color: '#fff',
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        borderRadius: 12,
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 20px rgba(20, 184, 166, 0.4)'
                      }}
                    >
                      Go
                    </button>
                  </div>
                </>
              )}
              
              {currentWorksheetQuestion && worksheetState === 'awaiting-answer' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ padding: 16, background: 'rgba(255,255,255,0.95)', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                    <div style={{ fontWeight: 600, fontSize: '1.125rem', marginBottom: 12 }}>{currentWorksheetQuestion.question}</div>
                    
                    {currentWorksheetQuestion.hint && (
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', fontStyle: 'italic', marginBottom: 12 }}>
                        Hint: {currentWorksheetQuestion.hint}
                      </div>
                    )}
                    
                    <input
                      type="text"
                      value={worksheetAnswer}
                      onChange={(e) => setWorksheetAnswer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && worksheetAnswer.trim()) {
                          submitWorksheetAnswer();
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: 12,
                        border: '2px solid rgba(20, 184, 166, 0.3)',
                        borderRadius: 8,
                        fontSize: '1.125rem',
                        background: '#fff'
                      }}
                      placeholder="Type your answer..."
                      autoFocus
                    />
                  </div>
                  
                  {lastWorksheetFeedback && (
                    <div style={{
                      padding: 12,
                      borderRadius: 8,
                      background: lastWorksheetFeedback.isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: lastWorksheetFeedback.isCorrect ? '#059669' : '#dc2626',
                      fontWeight: 600
                    }}>
                      {lastWorksheetFeedback.isCorrect ? (
                        '✓ Correct!'
                      ) : (
                        `✗ The correct answer was: ${lastWorksheetFeedback.correctAnswer}`
                      )}
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      onClick={submitWorksheetAnswer}
                      disabled={!worksheetAnswer.trim()}
                      style={{
                        padding: '12px 28px',
                        background: worksheetAnswer.trim() ? 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' : '#9ca3af',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        fontSize: '1rem',
                        fontWeight: 600,
                        cursor: worksheetAnswer.trim() ? 'pointer' : 'not-allowed',
                        boxShadow: worksheetAnswer.trim() ? '0 4px 16px rgba(20, 184, 166, 0.4)' : 'none',
                        opacity: worksheetAnswer.trim() ? 1 : 0.5
                      }}
                    >
                      Submit Answer
                    </button>
                    <button
                      onClick={skipWorksheetQuestion}
                      style={{
                        padding: '12px 28px',
                        background: 'rgba(107, 114, 128, 0.9)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        fontSize: '1rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}
              
              {worksheetState === 'complete' && (
                <div style={{ color: '#10b981', fontWeight: 600, fontSize: '1.125rem' }}>
                  ✓ Worksheet Complete - Score: {worksheetScore}/{worksheetTotalQuestions} ({Math.round((worksheetScore / worksheetTotalQuestions) * 100)}%)
                </div>
              )}
            </div>
          )}
          
          {/* Test Phase */}
          {currentPhase === 'test' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              {testState === 'awaiting-go' && (
                <>
                  {/* Opening Actions - Show during play time only */}
                  {testTimerMode === 'play' && !openingActionActive && (
                    <div style={{
                      padding: 16,
                      background: 'rgba(255, 255, 255, 0.95)',
                      borderRadius: 12,
                      border: '2px solid rgba(239, 68, 68, 0.5)',
                      marginBottom: 16,
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
                    }}>
                      <h3 style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: 12, color: '#1f2937' }}>🎯 Opening Actions</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                        <button
                          onClick={() => openingActionsControllerRef.current?.startAsk()}
                          style={{
                            padding: '12px 16px',
                            background: '#fff',
                            border: '2px solid #93c5fd',
                            color: '#1d4ed8',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          ❓ Ask Ms. Sonoma
                        </button>
                        <button
                          onClick={() => openingActionsControllerRef.current?.startRiddle()}
                          style={{
                            padding: '12px 16px',
                            background: '#fff',
                            border: '2px solid #c4b5fd',
                            color: '#7c3aed',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          🧩 Riddle
                        </button>
                        <button
                          onClick={() => openingActionsControllerRef.current?.startPoem()}
                          style={{
                            padding: '12px 16px',
                            background: '#fff',
                            border: '2px solid #f9a8d4',
                            color: '#db2777',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          📜 Poem
                        </button>
                        <button
                          onClick={() => openingActionsControllerRef.current?.startStory()}
                          style={{
                            padding: '12px 16px',
                            background: '#fff',
                            border: '2px solid #fdba74',
                            color: '#ea580c',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          📖 Story
                        </button>
                        <button
                          onClick={() => openingActionsControllerRef.current?.startFillInFun()}
                          style={{
                            padding: '12px 16px',
                            background: '#fff',
                            border: '2px solid #86efac',
                            color: '#16a34a',
                            borderRadius: 8,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          🎨 Fill-in-Fun
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => testPhaseRef.current?.go()}
                      style={{
                        padding: '14px 36px',
                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        color: '#fff',
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        borderRadius: 12,
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 20px rgba(239, 68, 68, 0.4)'
                      }}
                    >
                      Go
                    </button>
                  </div>
                </>
              )}
              
              {/* Test Questions */}
              {currentTestQuestion && testState === 'awaiting-answer' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ padding: 16, background: 'rgba(255,255,255,0.95)', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                    <div style={{ fontWeight: 600, fontSize: '1.125rem', marginBottom: 12 }}>{currentTestQuestion.question}</div>
                    
                    {currentTestQuestion.type === 'fill' ? (
                      // Fill-in-blank input
                      <div>
                        {currentTestQuestion.hint && (
                          <div style={{ fontSize: '0.875rem', color: '#6b7280', fontStyle: 'italic', marginBottom: 12 }}>
                            Hint: {currentTestQuestion.hint}
                          </div>
                        )}
                        <input
                          type="text"
                          value={testAnswer}
                          onChange={(e) => setTestAnswer(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && testAnswer.trim()) {
                              submitTestAnswer();
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: 12,
                            border: '2px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: 8,
                            fontSize: '1.125rem',
                            background: '#fff'
                          }}
                          placeholder="Type your answer..."
                          autoFocus
                        />
                      </div>
                    ) : (
                      // Multiple choice / True-False radio buttons
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {currentTestQuestion.options.map((option, index) => (
                          <label
                            key={index}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: 12,
                              background: testAnswer === option ? 'rgba(239, 68, 68, 0.1)' : '#fff',
                              border: testAnswer === option ? '2px solid #ef4444' : '1px solid #d1d5db',
                              borderRadius: 8,
                              cursor: 'pointer'
                            }}
                          >
                            <input
                              type="radio"
                              name="test-answer"
                              value={option}
                              checked={testAnswer === option}
                              onChange={(e) => setTestAnswer(e.target.value)}
                              style={{ marginRight: 12 }}
                            />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      onClick={submitTestAnswer}
                      disabled={!testAnswer || (currentTestQuestion.type === 'fill' && !testAnswer.trim())}
                      style={{
                        padding: '12px 28px',
                        background: (testAnswer && (currentTestQuestion.type !== 'fill' || testAnswer.trim())) ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : '#9ca3af',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        fontSize: '1rem',
                        fontWeight: 600,
                        cursor: (testAnswer && (currentTestQuestion.type !== 'fill' || testAnswer.trim())) ? 'pointer' : 'not-allowed',
                        boxShadow: (testAnswer && (currentTestQuestion.type !== 'fill' || testAnswer.trim())) ? '0 4px 16px rgba(239, 68, 68, 0.4)' : 'none',
                        opacity: (testAnswer && (currentTestQuestion.type !== 'fill' || testAnswer.trim())) ? 1 : 0.5
                      }}
                    >
                      Submit Answer
                    </button>
                    <button
                      onClick={skipTestQuestion}
                      style={{
                        padding: '12px 28px',
                        background: 'rgba(107, 114, 128, 0.9)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        fontSize: '1rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}
              
              {/* Test Review */}
              {testState === 'reviewing' && testReviewAnswer && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ padding: 16, background: 'rgba(255,255,255,0.95)', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <div style={{ fontWeight: 600 }}>Question {testReviewIndex + 1}:</div>
                      <div style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        background: testReviewAnswer.isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: testReviewAnswer.isCorrect ? '#059669' : '#dc2626'
                      }}>
                        {testReviewAnswer.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: 12 }}>{testReviewAnswer.question}</div>
                    
                    {testReviewAnswer.type === 'fill' ? (
                      // Fill-in-blank review
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div>
                          <span style={{ fontWeight: 600 }}>Your Answer:</span> {testReviewAnswer.userAnswer || '(skipped)'}
                        </div>
                        {!testReviewAnswer.isCorrect && (
                          <div style={{ color: '#059669' }}>
                            <span style={{ fontWeight: 600 }}>Correct Answer:</span> {testReviewAnswer.correctAnswer}
                          </div>
                        )}
                      </div>
                    ) : (
                      // MC/TF review
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {testReviewAnswer.options.map((option, index) => {
                          const isUserAnswer = option === testReviewAnswer.userAnswer;
                          const isCorrectAnswer = option === testReviewAnswer.correctAnswer;
                          
                          let bgStyle = { background: '#fff', border: '1px solid #d1d5db' };
                          if (isCorrectAnswer) bgStyle = { background: 'rgba(16, 185, 129, 0.1)', border: '2px solid #059669' };
                          else if (isUserAnswer && !isCorrectAnswer) bgStyle = { background: 'rgba(239, 68, 68, 0.1)', border: '2px solid #dc2626' };
                          
                          return (
                            <div key={index} style={{ padding: 12, borderRadius: 8, ...bgStyle }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>{option}</span>
                                {isCorrectAnswer && <span style={{ color: '#059669', fontWeight: 600 }}>✓ Correct</span>}
                                {isUserAnswer && !isCorrectAnswer && <span style={{ color: '#dc2626', fontWeight: 600 }}>✗ Your answer</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      onClick={previousTestReview}
                      disabled={testReviewIndex === 0}
                      style={{
                        padding: '10px 20px',
                        background: testReviewIndex === 0 ? '#9ca3af' : '#4b5563',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: '1rem',
                        fontWeight: 600,
                        cursor: testReviewIndex === 0 ? 'not-allowed' : 'pointer',
                        opacity: testReviewIndex === 0 ? 0.5 : 1
                      }}
                    >
                      ← Previous
                    </button>
                    <button
                      onClick={nextTestReview}
                      style={{
                        padding: '10px 20px',
                        background: '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: '1rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Next →
                    </button>
                    <button
                      onClick={skipTestReview}
                      style={{
                        padding: '10px 20px',
                        background: 'rgba(107, 114, 128, 0.9)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: '1rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Skip Review
                    </button>
                  </div>
                </div>
              )}
              
              {testState === 'complete' && testGrade && (
                <div style={{ color: '#10b981', fontWeight: 600, fontSize: '1.125rem' }}>
                  ✓ Test Complete - Grade: {testGrade.grade} ({testGrade.percentage}%) - Score: {testScore}/{testTotalQuestions}
                </div>
              )}
            </div>
          )}
          
          {/* Closing Phase */}
          {currentPhase === 'closing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {closingState === 'complete' && (
                <div style={{ color: '#10b981', fontWeight: 600, fontSize: '1.125rem' }}>
                  ✓ Closing Complete
                </div>
              )}
            </div>
          )}
          
          {/* Session Complete */}
          {currentPhase === 'complete' && (
            <div style={{ color: '#10b981', fontWeight: 600, fontSize: '1.25rem' }}>
              ✓ Session Complete!
            </div>
          )}
        </div>
        
        {/* Audio Transport Controls - Hidden debug panel (press ~ to toggle) */}
        {false && ( // Set to true to enable debug panels
        <div style={{ position: 'absolute', top: 100, right: 20, background: 'rgba(255,255,255,0.95)', borderRadius: 12, padding: 20, maxWidth: 400, maxHeight: '80vh', overflow: 'auto', zIndex: 9000 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 16 }}>Audio Transport</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={stopAudio}
                style={{ padding: '6px 12px', fontSize: '0.875rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                Stop
              </button>
              <button
                onClick={pauseAudio}
                style={{ padding: '6px 12px', fontSize: '0.875rem', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                Pause
              </button>
              <button
                onClick={resumeAudio}
                style={{ padding: '6px 12px', fontSize: '0.875rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                Resume
              </button>
              <button
                onClick={toggleMute}
                style={{ padding: '6px 12px', fontSize: '0.875rem', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                Toggle Mute
              </button>
            </div>
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
        
        {/* Keyboard Hotkeys */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Keyboard Hotkeys</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-mono text-gray-600">PageDown</span>
              <span>Skip current item</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono text-gray-600">PageUp</span>
              <span>Repeat (teaching)</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono text-gray-600">End</span>
              <span>Next sentence (teaching)</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono text-gray-600">Space</span>
              <span>Pause/Resume audio</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono text-gray-600">Escape</span>
              <span>Stop audio</span>
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
        )}
      
      {/* PlayTimeExpiredOverlay */}
      <PlayTimeExpiredOverlay
        eventBus={eventBusRef.current}
        timerService={timerServiceRef.current}
        phase={currentPhase}
        onTransition={() => {
          addEvent('⏰ Transitioned to work mode');
        }}
      />
      
      {/* Video overlay controls - bottom right cluster */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        display: 'flex',
        gap: 12,
        zIndex: 10
      }}>
        {/* Mute button */}
        <button
          type="button"
          onClick={() => {/* TODO: implement mute toggle */}}
          aria-label="Mute"
          title="Mute"
          style={{
            background: '#1f2937',
            color: '#fff',
            border: 'none',
            width: 'clamp(34px, 6.2vw, 52px)',
            height: 'clamp(34px, 6.2vw, 52px)',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '50%',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
          }}
        >
          <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <path d="M19 8a5 5 0 010 8" />
            <path d="M15 11a2 2 0 010 2" />
          </svg>
        </button>
      </div>
      
      {/* Repeat button - bottom left */}
      {currentPhase !== 'idle' && (
        <button
          type="button"
          onClick={() => {/* TODO: implement repeat */}}
          aria-label="Repeat"
          title="Repeat"
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            background: '#1f2937',
            color: '#fff',
            border: 'none',
            width: 'clamp(34px, 6.2vw, 52px)',
            height: 'clamp(34px, 6.2vw, 52px)',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '50%',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            zIndex: 10
          }}
        >
          <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <polyline points="23 20 23 14 17 14" />
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
          </svg>
        </button>
      )}
      
      </div>
      
      {/* Transcript column */}
      <div style={transcriptWrapperStyle}>
        <div style={{
          background: '#ffffff',
          borderRadius: isMobileLandscape ? 0 : 14,
          boxShadow: isMobileLandscape ? 'none' : '0 4px 12px rgba(0,0,0,0.25)',
          padding: 12,
          flex: '1 1 auto',
          overflow: 'auto',
          fontSize: 'clamp(1.125rem, 2.4vw, 1.5rem)',
          lineHeight: 1.5,
          color: '#111111'
        }}>
          {currentCaption ? (
            <div style={{ whiteSpace: 'pre-line' }}>{currentCaption}</div>
          ) : (
            <div style={{ color: '#6b7280' }}>Transcript will appear here...</div>
          )}
        </div>
      </div>
      
      {/* Fixed footer with input controls */}
      <div style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
        background: '#ffffff',
        borderTop: '1px solid #e5e7eb',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.06)'
      }}>
        <div style={{
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          padding: '4px 12px calc(4px + env(safe-area-inset-bottom, 0px))'
        }}>
          
          {/* Phase-specific Begin buttons */}
          {(() => {
            const needBeginComp = (currentPhase === 'comprehension' && comprehensionState === 'awaiting-go');
            const needBeginExercise = (currentPhase === 'exercise' && exerciseState === 'awaiting-go');
            const needBeginWorksheet = (currentPhase === 'worksheet' && worksheetState === 'awaiting-go');
            const needBeginTest = (currentPhase === 'test' && testState === 'awaiting-go');
            if (!(needBeginComp || needBeginExercise || needBeginWorksheet || needBeginTest)) return null;
            
            const ctaStyle = {
              background: '#c7442e',
              color: '#fff',
              borderRadius: 10,
              padding: '10px 18px',
              fontWeight: 800,
              fontSize: 'clamp(1rem, 2.6vw, 1.125rem)',
              border: 'none',
              boxShadow: '0 2px 12px rgba(199,68,46,0.28)',
              cursor: 'pointer'
            };
            
            return (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                paddingLeft: 12,
                paddingRight: 12,
                marginBottom: 4
              }}>
                {needBeginComp && (
                  <button type="button" style={ctaStyle} onClick={() => comprehensionPhaseRef.current?.go()}>
                    Begin Comprehension
                  </button>
                )}
                {needBeginExercise && (
                  <button type="button" style={ctaStyle} onClick={() => exercisePhaseRef.current?.go()}>
                    Begin Exercise
                  </button>
                )}
                {needBeginWorksheet && (
                  <button type="button" style={ctaStyle} onClick={() => worksheetPhaseRef.current?.go()}>
                    Begin Worksheet
                  </button>
                )}
                {needBeginTest && (
                  <button type="button" style={ctaStyle} onClick={() => testPhaseRef.current?.go()}>
                    Begin Test
                  </button>
                )}
              </div>
            );
          })()}
          
          {/* Input panel */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 0'
          }}>
            <input
              type="text"
              placeholder="Type your answer..."
              style={{
                flex: 1,
                padding: '10px 16px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: '1rem',
                outline: 'none'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  // TODO: implement send
                }
              }}
            />
            <button
              type="button"
              style={{
                background: '#c7442e',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 24px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(199,68,46,0.28)'
              }}
              onClick={() => {
                // TODO: implement send
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
