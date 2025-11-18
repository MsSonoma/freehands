"use client";

import { useState, useEffect, useRef } from 'react';

/**
 * WhackAMole - Click the moles as they pop up!
 * Kids click on moles before they disappear to score points
 */
export default function WhackAMole({ onBack }) {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [moles, setMoles] = useState(Array(9).fill({ visible: false, hit: false }));
  const [highScore, setHighScore] = useState(0);
  const gameLoopRef = useRef(null);
  const spawnTimerRef = useRef(null);

  const GAME_DURATION = 30; // seconds
  const MIN_SPAWN_DELAY = 600; // ms
  const MAX_SPAWN_DELAY = 1500; // ms
  const MOLE_VISIBLE_TIME = 800; // ms mole stays visible

  // Load high score
  useEffect(() => {
    const saved = localStorage.getItem('whackAMoleHighScore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // Save high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('whackAMoleHighScore', score.toString());
    }
  }, [score, highScore]);

  // Game timer countdown
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setGameOver(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, gameOver]);

  // Spawn moles randomly
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const spawnMole = () => {
      // Find empty holes
      const emptyHoles = moles
        .map((mole, index) => ({ index, visible: mole.visible }))
        .filter(m => !m.visible)
        .map(m => m.index);

      if (emptyHoles.length === 0) return;

      // Pick random empty hole
      const randomHole = emptyHoles[Math.floor(Math.random() * emptyHoles.length)];

      // Show mole
      setMoles(prev => {
        const newMoles = [...prev];
        newMoles[randomHole] = { visible: true, hit: false };
        return newMoles;
      });

      // Hide mole after timeout
      setTimeout(() => {
        setMoles(prev => {
          const newMoles = [...prev];
          if (newMoles[randomHole].visible && !newMoles[randomHole].hit) {
            newMoles[randomHole] = { visible: false, hit: false };
          }
          return newMoles;
        });
      }, MOLE_VISIBLE_TIME);

      // Schedule next spawn
      const nextDelay = MIN_SPAWN_DELAY + Math.random() * (MAX_SPAWN_DELAY - MIN_SPAWN_DELAY);
      spawnTimerRef.current = setTimeout(spawnMole, nextDelay);
    };

    // Start spawning
    const initialDelay = 500;
    spawnTimerRef.current = setTimeout(spawnMole, initialDelay);

    return () => {
      if (spawnTimerRef.current) {
        clearTimeout(spawnTimerRef.current);
      }
    };
  }, [gameStarted, gameOver, moles]);

  const startGame = () => {
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setGameOver(false);
    setMoles(Array(9).fill({ visible: false, hit: false }));
    setGameStarted(true);
  };

  const whackMole = (index) => {
    if (!gameStarted || gameOver) return;
    if (!moles[index].visible || moles[index].hit) return;

    // Mark as hit and hide
    setMoles(prev => {
      const newMoles = [...prev];
      newMoles[index] = { visible: false, hit: true };
      return newMoles;
    });

    // Increase score
    setScore(s => s + 10);
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      boxSizing: 'border-box',
      background: 'linear-gradient(180deg, #86efac 0%, #4ade80 100%)'
    }}>
      <div style={{
        marginBottom: '16px',
        display: 'flex',
        gap: '20px',
        fontSize: '20px',
        fontWeight: 700,
        color: '#1f2937'
      }}>
        <div>Score: {score}</div>
        <div>Time: {timeLeft}s</div>
        <div>High Score: {highScore}</div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 140px)',
        gridTemplateRows: 'repeat(3, 140px)',
        gap: '16px',
        background: '#065f46',
        padding: '24px',
        borderRadius: '16px',
        boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
        border: '4px solid #064e3b'
      }}>
        {moles.map((mole, index) => (
          <div
            key={index}
            onClick={() => whackMole(index)}
            style={{
              width: '140px',
              height: '140px',
              background: 'radial-gradient(circle, #92400e 0%, #78350f 100%)',
              borderRadius: '50%',
              border: '4px solid #451a03',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: mole.visible ? 'pointer' : 'default',
              position: 'relative',
              boxShadow: 'inset 0 4px 8px rgba(0,0,0,0.4)',
              transition: 'transform 0.1s ease',
              userSelect: 'none'
            }}
            onMouseDown={(e) => {
              if (mole.visible) {
                e.currentTarget.style.transform = 'scale(0.95)';
              }
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {/* Mole */}
            {mole.visible && (
              <div style={{
                fontSize: '80px',
                lineHeight: '1',
                animation: 'popUp 0.2s ease-out',
                pointerEvents: 'none'
              }}>
                🦫
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Start screen */}
      {!gameStarted && !gameOver && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)',
          gap: '20px',
          zIndex: 10
        }}>
          <div style={{ fontSize: '48px', fontWeight: 700, color: '#fff', textAlign: 'center' }}>
            Whack-a-Mole! 🦫
          </div>
          <div style={{ fontSize: '18px', color: '#d1d5db', textAlign: 'center', maxWidth: '400px' }}>
            Click the moles as quickly as you can! You have 30 seconds to get the highest score!
          </div>
          <button
            onClick={startGame}
            style={{
              padding: '16px 40px',
              fontSize: '20px',
              fontWeight: 700,
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
            }}
            onMouseEnter={(e) => e.target.style.background = '#059669'}
            onMouseLeave={(e) => e.target.style.background = '#10b981'}
          >
            Start Game
          </button>
        </div>
      )}

      {/* Game over screen */}
      {gameOver && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.85)',
          gap: '20px',
          zIndex: 10
        }}>
          <div style={{ fontSize: '48px' }}>⏰</div>
          <div style={{ fontSize: '40px', fontWeight: 700, color: '#fff' }}>
            Time's Up!
          </div>
          <div style={{ fontSize: '28px', color: '#d1d5db' }}>
            Final Score: {score}
          </div>
          {score === highScore && score > 0 && (
            <div style={{ fontSize: '24px', color: '#fbbf24', fontWeight: 600 }}>
              🎉 New High Score! 🎉
            </div>
          )}
          <button
            onClick={startGame}
            style={{
              padding: '14px 36px',
              fontSize: '18px',
              fontWeight: 600,
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              marginTop: '8px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
            }}
            onMouseEnter={(e) => e.target.style.background = '#2563eb'}
            onMouseLeave={(e) => e.target.style.background = '#3b82f6'}
          >
            Play Again
          </button>
        </div>
      )}

      <button
        onClick={onBack}
        style={{
          marginTop: '24px',
          padding: '12px 28px',
          fontSize: '16px',
          fontWeight: 600,
          background: '#6b7280',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
        onMouseEnter={(e) => e.target.style.background = '#4b5563'}
        onMouseLeave={(e) => e.target.style.background = '#6b7280'}
      >
        ← Back to Games
      </button>

      <style jsx>{`
        @keyframes popUp {
          0% {
            transform: translateY(50px) scale(0.5);
            opacity: 0;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
