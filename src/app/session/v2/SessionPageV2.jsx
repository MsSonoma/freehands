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
import { AudioEngine } from './AudioEngine';
import { TeachingController } from './TeachingController';
import { ComprehensionPhase } from './ComprehensionPhase';
import { ExercisePhase } from './ExercisePhase';
import { WorksheetPhase } from './WorksheetPhase';
import { TestPhase } from './TestPhase';
import { ClosingPhase } from './ClosingPhase';
import { PhaseOrchestrator } from './PhaseOrchestrator';
import { SnapshotService } from './SnapshotService';
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
  const orchestratorRef = useRef(null);
  const snapshotServiceRef = useRef(null);
  const teachingControllerRef = useRef(null);
  const comprehensionPhaseRef = useRef(null);
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
  
  const [exerciseState, setExerciseState] = useState('idle');
  const [currentExerciseQuestion, setCurrentExerciseQuestion] = useState(null);
  const [exerciseScore, setExerciseScore] = useState(0);
  const [exerciseTotalQuestions, setExerciseTotalQuestions] = useState(0);
  const [selectedExerciseAnswer, setSelectedExerciseAnswer] = useState('');
  
  const [worksheetState, setWorksheetState] = useState('idle');
  const [currentWorksheetQuestion, setCurrentWorksheetQuestion] = useState(null);
  const [worksheetScore, setWorksheetScore] = useState(0);
  const [worksheetTotalQuestions, setWorksheetTotalQuestions] = useState(0);
  const [worksheetAnswer, setWorksheetAnswer] = useState('');
  const [lastWorksheetFeedback, setLastWorksheetFeedback] = useState(null);
  
  const [testState, setTestState] = useState('idle');
  const [currentTestQuestion, setCurrentTestQuestion] = useState(null);
  const [testScore, setTestScore] = useState(0);
  const [testTotalQuestions, setTestTotalQuestions] = useState(0);
  const [testAnswer, setTestAnswer] = useState('');
  const [testGrade, setTestGrade] = useState(null);
  const [testReviewAnswer, setTestReviewAnswer] = useState(null);
  const [testReviewIndex, setTestReviewIndex] = useState(0);
  
  const [closingState, setClosingState] = useState('idle');
  const [closingMessage, setClosingMessage] = useState('');

  const [snapshotLoaded, setSnapshotLoaded] = useState(false);
  const [resumePhase, setResumePhase] = useState(null);
  
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
  
  // Initialize SnapshotService after lesson loads
  useEffect(() => {
    if (!lessonData) return;
    
    // Generate session ID (in production, this would come from route params)
    const sessionId = `session_${Date.now()}`;
    const learnerId = 'test_learner'; // In production, from auth
    
    const service = new SnapshotService({
      sessionId: sessionId,
      learnerId: learnerId,
      lessonKey: lessonData.key,
      supabaseClient: null // Using localStorage fallback for now
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
      lessonData: lessonData
    });
    
    orchestratorRef.current = orchestrator;
    
    // Subscribe to phase transitions
    orchestrator.on('phaseChange', (data) => {
      addEvent(`🔄 Phase: ${data.phase}`);
      setCurrentPhase(data.phase);
      
      // Start phase-specific controller
      if (data.phase === 'teaching') {
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
      
      // Delete snapshot (session finished)
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.deleteSnapshot().then(() => {
          addEvent('💾 Cleared session snapshot');
        }).catch(err => {
          console.error('[SessionPageV2] Delete snapshot error:', err);
        });
      }
    });
    
    return () => {
      orchestrator.destroy();
      orchestratorRef.current = null;
    };
  }, [lessonData]);
  
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
      question: lessonData.comprehension.question || 'What did you learn?',
      sampleAnswer: lessonData.comprehension.sampleAnswer || ''
    });
    
    comprehensionPhaseRef.current = phase;
    
    // Subscribe to state changes
    phase.on('stateChange', (data) => {
      setComprehensionState(data.state);
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
    
    const phase = new ExercisePhase({
      audioEngine: audioEngineRef.current,
      questions: questions
    });
    
    exercisePhaseRef.current = phase;
    
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
    
    const phase = new WorksheetPhase({
      audioEngine: audioEngineRef.current,
      questions: questions
    });
    
    worksheetPhaseRef.current = phase;
    
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
    
    const phase = new TestPhase({
      audioEngine: audioEngineRef.current,
      questions: questions
    });
    
    testPhaseRef.current = phase;
    
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
  
  const startSession = () => {
    if (!orchestratorRef.current) return;
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
          <h1 className="text-2xl font-bold mb-2">V2 Architecture - Full Session Flow</h1>
          <p className="text-gray-600">Teaching + Comprehension + Exercise + Worksheet + Test + Review</p>
          {lessonData && (
            <div className="mt-4 text-sm text-gray-500 space-y-1">
              <div className="font-semibold">{lessonData.title}</div>
              <div>Current Phase: <span className="font-bold text-blue-600">{currentPhase}</span></div>
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
        
        {/* Phase Controls */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Phase Controls</h2>
          
          {/* Session Start */}
          {currentPhase === 'idle' && (
            <button
              onClick={startSession}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
            >
              Start Session
            </button>
          )}
          
          {/* Teaching Phase */}
          {currentPhase === 'teaching' && (
            <div>
              <div className="mb-4 p-4 bg-gray-50 rounded">
                <div className="font-semibold text-lg">Teaching Stage: {teachingStage}</div>
                {(teachingStage === 'definitions' || teachingStage === 'examples') && (
                  <div className="text-sm text-gray-600 mt-1">
                    Sentence {sentenceIndex + 1} of {totalSentences}
                    {!isInSentenceMode && <span className="ml-2 text-yellow-600">(Final Gate)</span>}
                  </div>
                )}
              </div>
              
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
                </div>
              )}
            </div>
          )}
          
          {/* Comprehension Phase */}
          {currentPhase === 'comprehension' && (
            <div>
              <div className="mb-4 p-4 bg-blue-50 rounded">
                <div className="font-semibold text-lg">Comprehension Question</div>
                <div className="text-sm text-gray-600 mt-1">State: {comprehensionState}</div>
              </div>
              
              {comprehensionState === 'awaiting-answer' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Your Answer:</label>
                    <textarea
                      value={comprehensionAnswer}
                      onChange={(e) => setComprehensionAnswer(e.target.value)}
                      className="w-full p-3 border rounded-lg"
                      rows={4}
                      placeholder="Type your answer here..."
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={submitComprehensionAnswer}
                      className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Submit Answer
                    </button>
                    <button
                      onClick={skipComprehension}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}
              
              {comprehensionState === 'complete' && (
                <div className="text-green-600 font-semibold">
                  ✓ Comprehension Complete
                </div>
              )}
            </div>
          )}
          
          {/* Exercise Phase */}
          {currentPhase === 'exercise' && (
            <div>
              <div className="mb-4 p-4 bg-purple-50 rounded">
                <div className="font-semibold text-lg">Exercise Questions</div>
                <div className="text-sm text-gray-600 mt-1">
                  State: {exerciseState} | Score: {exerciseScore}/{exerciseTotalQuestions}
                </div>
              </div>
              
              {currentExerciseQuestion && exerciseState === 'awaiting-answer' && (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded">
                    <div className="font-semibold mb-3">{currentExerciseQuestion.question}</div>
                    
                    <div className="space-y-2">
                      {currentExerciseQuestion.options.map((option, index) => (
                        <label
                          key={index}
                          className="flex items-center p-3 bg-white border rounded hover:bg-blue-50 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="exercise-answer"
                            value={option}
                            checked={selectedExerciseAnswer === option}
                            onChange={(e) => setSelectedExerciseAnswer(e.target.value)}
                            className="mr-3"
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={submitExerciseAnswer}
                      disabled={!selectedExerciseAnswer}
                      className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Submit Answer
                    </button>
                    <button
                      onClick={skipExerciseQuestion}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}
              
              {exerciseState === 'complete' && (
                <div className="text-green-600 font-semibold">
                  ✓ Exercise Complete - Score: {exerciseScore}/{exerciseTotalQuestions} ({Math.round((exerciseScore / exerciseTotalQuestions) * 100)}%)
                </div>
              )}
            </div>
          )}
          
          {/* Worksheet Phase */}
          {currentPhase === 'worksheet' && (
            <div>
              <div className="mb-4 p-4 bg-teal-50 rounded">
                <div className="font-semibold text-lg">Worksheet - Fill in the Blank</div>
                <div className="text-sm text-gray-600 mt-1">
                  State: {worksheetState} | Score: {worksheetScore}/{worksheetTotalQuestions}
                </div>
              </div>
              
              {currentWorksheetQuestion && worksheetState === 'awaiting-answer' && (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded">
                    <div className="font-semibold mb-3">{currentWorksheetQuestion.question}</div>
                    
                    {currentWorksheetQuestion.hint && (
                      <div className="text-sm text-gray-600 italic mb-3">
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
                      className="w-full p-3 border rounded-lg text-lg"
                      placeholder="Type your answer..."
                      autoFocus
                    />
                  </div>
                  
                  {lastWorksheetFeedback && (
                    <div className={`p-3 rounded ${lastWorksheetFeedback.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {lastWorksheetFeedback.isCorrect ? (
                        '✓ Correct!'
                      ) : (
                        `✗ The correct answer was: ${lastWorksheetFeedback.correctAnswer}`
                      )}
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <button
                      onClick={submitWorksheetAnswer}
                      disabled={!worksheetAnswer.trim()}
                      className="px-6 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Submit Answer
                    </button>
                    <button
                      onClick={skipWorksheetQuestion}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}
              
              {worksheetState === 'complete' && (
                <div className="text-green-600 font-semibold">
                  ✓ Worksheet Complete - Score: {worksheetScore}/{worksheetTotalQuestions} ({Math.round((worksheetScore / worksheetTotalQuestions) * 100)}%)
                </div>
              )}
            </div>
          )}
          
          {/* Test Phase */}
          {currentPhase === 'test' && (
            <div>
              <div className="mb-4 p-4 bg-red-50 rounded">
                <div className="font-semibold text-lg">Test - Final Assessment</div>
                <div className="text-sm text-gray-600 mt-1">
                  State: {testState} | Score: {testScore}/{testTotalQuestions}
                  {testGrade && ` | Grade: ${testGrade.grade} (${testGrade.percentage}%)`}
                </div>
              </div>
              
              {/* Test Questions */}
              {currentTestQuestion && testState === 'awaiting-answer' && (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded">
                    <div className="font-semibold mb-3">{currentTestQuestion.question}</div>
                    
                    {currentTestQuestion.type === 'fill' ? (
                      // Fill-in-blank input
                      <div>
                        {currentTestQuestion.hint && (
                          <div className="text-sm text-gray-600 italic mb-3">
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
                          className="w-full p-3 border rounded-lg text-lg"
                          placeholder="Type your answer..."
                          autoFocus
                        />
                      </div>
                    ) : (
                      // Multiple choice / True-False radio buttons
                      <div className="space-y-2">
                        {currentTestQuestion.options.map((option, index) => (
                          <label
                            key={index}
                            className="flex items-center p-3 bg-white border rounded hover:bg-blue-50 cursor-pointer"
                          >
                            <input
                              type="radio"
                              name="test-answer"
                              value={option}
                              checked={testAnswer === option}
                              onChange={(e) => setTestAnswer(e.target.value)}
                              className="mr-3"
                            />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={submitTestAnswer}
                      disabled={!testAnswer || (currentTestQuestion.type === 'fill' && !testAnswer.trim())}
                      className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Submit Answer
                    </button>
                    <button
                      onClick={skipTestQuestion}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              )}
              
              {/* Test Review */}
              {testState === 'reviewing' && testReviewAnswer && (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="font-semibold">Question {testReviewIndex + 1}:</div>
                      <div className={`px-3 py-1 rounded text-sm font-semibold ${testReviewAnswer.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {testReviewAnswer.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                      </div>
                    </div>
                    
                    <div className="mb-3">{testReviewAnswer.question}</div>
                    
                    {testReviewAnswer.type === 'fill' ? (
                      // Fill-in-blank review
                      <div className="space-y-2">
                        <div>
                          <span className="font-semibold">Your Answer:</span> {testReviewAnswer.userAnswer || '(skipped)'}
                        </div>
                        {!testReviewAnswer.isCorrect && (
                          <div className="text-green-700">
                            <span className="font-semibold">Correct Answer:</span> {testReviewAnswer.correctAnswer}
                          </div>
                        )}
                      </div>
                    ) : (
                      // MC/TF review
                      <div className="space-y-2">
                        {testReviewAnswer.options.map((option, index) => {
                          const isUserAnswer = option === testReviewAnswer.userAnswer;
                          const isCorrectAnswer = option === testReviewAnswer.correctAnswer;
                          
                          let bgClass = 'bg-white';
                          if (isCorrectAnswer) bgClass = 'bg-green-100 border-green-500';
                          else if (isUserAnswer && !isCorrectAnswer) bgClass = 'bg-red-100 border-red-500';
                          
                          return (
                            <div key={index} className={`p-3 border rounded ${bgClass}`}>
                              <div className="flex items-center justify-between">
                                <span>{option}</span>
                                {isCorrectAnswer && <span className="text-green-700 font-semibold">✓ Correct</span>}
                                {isUserAnswer && !isCorrectAnswer && <span className="text-red-700 font-semibold">✗ Your answer</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={previousTestReview}
                      disabled={testReviewIndex === 0}
                      className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ← Previous
                    </button>
                    <button
                      onClick={nextTestReview}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Next →
                    </button>
                    <button
                      onClick={skipTestReview}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      Skip Review
                    </button>
                  </div>
                </div>
              )}
              
              {testState === 'complete' && testGrade && (
                <div className="text-green-600 font-semibold text-lg">
                  ✓ Test Complete - Grade: {testGrade.grade} ({testGrade.percentage}%) - Score: {testScore}/{testTotalQuestions}
                </div>
              )}
            </div>
          )}
          
          {/* Closing Phase */}
          {currentPhase === 'closing' && (
            <div>
              <div className="mb-4 p-4 bg-green-50 rounded">
                <div className="font-semibold text-lg">Closing Message</div>
                <div className="text-sm text-gray-600 mt-1">State: {closingState}</div>
              </div>
              
              {closingState === 'playing' && closingMessage && (
                <div className="p-4 bg-blue-50 rounded mb-3">
                  <div className="text-lg text-gray-800">{closingMessage}</div>
                </div>
              )}
              
              {closingState === 'complete' && (
                <div className="text-green-600 font-semibold">
                  ✓ Closing Complete
                </div>
              )}
            </div>
          )}
          
          {/* Session Complete */}
          {currentPhase === 'complete' && (
            <div className="text-green-600 font-semibold text-lg">
              ✓ Session Complete!
            </div>
          )}
        </div>
        
        {/* Audio Transport Controls */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Audio Transport</h2>
          <div className="flex gap-2">
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
