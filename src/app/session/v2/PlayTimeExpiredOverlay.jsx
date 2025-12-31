/**
 * PlayTimeExpiredOverlay.jsx
 * 
 * Overlay displayed when play timer expires. Shows 30-second countdown before
 * transitioning to work mode. Allows learner to skip countdown with Go button.
 * 
 * V2 architectural patterns:
 * - Event-driven communication via EventBus
 * - Private fields for encapsulation
 * - Auto-cleans up on unmount
 * 
 * Timer colors:
 * - Green: countdown > 5 seconds
 * - Amber: countdown <= 5 seconds (warning)
 * 
 * Events:
 * - playTimerExpired: Triggers overlay display
 * 
 * Methods:
 * - transitionToWork(): Calls TimerService.transitionToWork(phase)
 */

'use client';

import { useState, useEffect, useRef } from 'react';

const COUNTDOWN_DURATION = 30; // seconds

export default function PlayTimeExpiredOverlay({ 
  eventBus, 
  timerService, 
  phase,
  onTransition 
}) {
  const [show, setShow] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_DURATION);
  const countdownIntervalRef = useRef(null);
  const listenerRemoversRef = useRef([]);
  
  useEffect(() => {
    // Listen for play timer expiration
    const removeExpiredListener = eventBus.on('playTimerExpired', (data) => {
      if (data.phase === phase) {
        setShow(true);
        setCountdown(COUNTDOWN_DURATION);
        startCountdown();
      }
    });
    
    listenerRemoversRef.current.push(removeExpiredListener);
    
    return () => {
      stopCountdown();
      listenerRemoversRef.current.forEach(remove => remove());
      listenerRemoversRef.current = [];
    };
  }, [eventBus, phase]);
  
  const startCountdown = () => {
    if (countdownIntervalRef.current) return;
    
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        const next = prev - 1;
        
        if (next <= 0) {
          handleTransition();
          return 0;
        }
        
        return next;
      });
    }, 1000);
  };
  
  const stopCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };
  
  const handleTransition = () => {
    stopCountdown();
    setShow(false);
    
    // Transition to work mode
    timerService.transitionToWork(phase);
    
    // Notify parent
    if (onTransition) {
      onTransition();
    }
  };
  
  const handleGoClick = () => {
    handleTransition();
  };
  
  if (!show) return null;
  
  const isWarning = countdown <= 5;
  const timerColor = isWarning ? 'text-amber-500' : 'text-green-500';
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
        <h2 className="text-2xl font-bold mb-4">Time to Get Back to Work!</h2>
        
        <p className="text-gray-700 mb-6">
          Your play time is up. Time to focus on your lesson.
        </p>
        
        <div className={`text-6xl font-bold mb-6 ${timerColor}`}>
          {countdown}
        </div>
        
        <p className="text-sm text-gray-500 mb-6">
          Starting work mode automatically...
        </p>
        
        <button
          onClick={handleGoClick}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-lg transition-colors"
        >
          Go Now
        </button>
      </div>
    </div>
  );
}
