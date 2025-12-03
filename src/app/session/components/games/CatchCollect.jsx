"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * CatchCollect - Catch falling items with a basket
 * Kids move a basket left/right to catch falling emoji items
 */
export default function CatchCollect({ onBack }) {
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [basketX, setBasketX] = useState(300); // Center of 600px wide game
  const [fallingItems, setFallingItems] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [highScore, setHighScore] = useState(0);

  // Detect orientation - must be declared early to avoid hook order issues
  const [isLandscape, setIsLandscape] = useState(typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false);

  const gameLoopRef = useRef(null);
  const itemIdCounter = useRef(0);
  const leftIntervalRef = useRef(null);
  const rightIntervalRef = useRef(null);

  // Orientation detection effect
  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const GAME_WIDTH = 600;
  const GAME_HEIGHT = 500;
  const BASKET_WIDTH = 80;
  const BASKET_HEIGHT = 60;
  const ITEM_SIZE = 40;
  const BASKET_SPEED = 5;
  const FALL_SPEED = 3;
  const SPAWN_INTERVAL = 1500; // ms between new items

  const CATCHABLE_ITEMS = ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍑', '🥝', '🍒'];

  // Load high score
  useEffect(() => {
    const saved = localStorage.getItem('catchCollectHighScore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // Save high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('catchCollectHighScore', score.toString());
    }
  }, [score, highScore]);

  // Spawn items periodically
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const spawnTimer = setInterval(() => {
      const newItem = {
        id: itemIdCounter.current++,
        x: Math.random() * (GAME_WIDTH - ITEM_SIZE),
        y: -ITEM_SIZE,
        emoji: CATCHABLE_ITEMS[Math.floor(Math.random() * CATCHABLE_ITEMS.length)]
      };
      setFallingItems(prev => [...prev, newItem]);
    }, SPAWN_INTERVAL);

    return () => clearInterval(spawnTimer);
  }, [gameStarted, gameOver]);

  // Game loop - move items down and check collisions
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    gameLoopRef.current = setInterval(() => {
      setFallingItems(prev => {
        const updated = prev.map(item => ({
          ...item,
          y: item.y + FALL_SPEED
        }));

        // Check for collisions with basket
        const caught = [];
        const remaining = updated.filter(item => {
          const itemCenterX = item.x + ITEM_SIZE / 2;
          const itemBottom = item.y + ITEM_SIZE;
          const basketTop = GAME_HEIGHT - BASKET_HEIGHT;
          const basketLeft = basketX - BASKET_WIDTH / 2;
          const basketRight = basketX + BASKET_WIDTH / 2;

          // Check if item hit the basket
          if (
            itemBottom >= basketTop &&
            itemBottom <= basketTop + 20 &&
            itemCenterX >= basketLeft &&
            itemCenterX <= basketRight
          ) {
            caught.push(item);
            return false; // Remove caught item
          }

          // Check if item fell past the bottom
          if (item.y > GAME_HEIGHT) {
            setLives(l => {
              const newLives = l - 1;
              if (newLives <= 0) {
                setGameOver(true);
              }
              return newLives;
            });
            return false; // Remove missed item
          }

          return true; // Keep item
        });

        // Add score for caught items
        if (caught.length > 0) {
          setScore(s => s + (caught.length * 10));
        }

        return remaining;
      });
    }, 1000 / 60); // 60 FPS

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [gameStarted, gameOver, basketX]);

  // Keyboard controls
  const handleKeyDown = useCallback((e) => {
    if (gameOver || !gameStarted) return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setBasketX(prev => Math.max(BASKET_WIDTH / 2, prev - BASKET_SPEED));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setBasketX(prev => Math.min(GAME_WIDTH - BASKET_WIDTH / 2, prev + BASKET_SPEED));
    }
  }, [gameOver, gameStarted]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const startGame = () => {
    setScore(0);
    setLives(3);
    setGameOver(false);
    setBasketX(300);
    setFallingItems([]);
    itemIdCounter.current = 0;
    setGameStarted(true);
  };

  const resetGame = () => {
    setGameStarted(false);
    setScore(0);
    setLives(3);
    setGameOver(false);
    setBasketX(300);
    setFallingItems([]);
    itemIdCounter.current = 0;
  };

  const moveLeft = useCallback(() => {
    if (!gameStarted || gameOver) return;
    setBasketX(prev => Math.max(BASKET_WIDTH / 2, prev - BASKET_SPEED));
  }, [gameStarted, gameOver]);

  const moveRight = useCallback(() => {
    if (!gameStarted || gameOver) return;
    setBasketX(prev => Math.min(GAME_WIDTH - BASKET_WIDTH / 2, prev + BASKET_SPEED));
  }, [gameStarted, gameOver]);

  const startMovingLeft = useCallback(() => {
    if (!gameStarted || gameOver) return;
    // Stop any right movement
    if (rightIntervalRef.current) {
      clearInterval(rightIntervalRef.current);
      rightIntervalRef.current = null;
    }
    // Start moving left if not already
    if (!leftIntervalRef.current) {
      moveLeft(); // Move immediately
      leftIntervalRef.current = setInterval(moveLeft, 16); // Continue every ~60fps
    }
  }, [gameStarted, gameOver, moveLeft]);

  const stopMovingLeft = useCallback(() => {
    if (leftIntervalRef.current) {
      clearInterval(leftIntervalRef.current);
      leftIntervalRef.current = null;
    }
  }, []);

  const startMovingRight = useCallback(() => {
    if (!gameStarted || gameOver) return;
    // Stop any left movement
    if (leftIntervalRef.current) {
      clearInterval(leftIntervalRef.current);
      leftIntervalRef.current = null;
    }
    // Start moving right if not already
    if (!rightIntervalRef.current) {
      moveRight(); // Move immediately
      rightIntervalRef.current = setInterval(moveRight, 16); // Continue every ~60fps
    }
  }, [gameStarted, gameOver, moveRight]);

  const stopMovingRight = useCallback(() => {
    if (rightIntervalRef.current) {
      clearInterval(rightIntervalRef.current);
      rightIntervalRef.current = null;
    }
  }, []);

  // Clean up intervals when game ends
  useEffect(() => {
    if (gameOver || !gameStarted) {
      if (leftIntervalRef.current) {
        clearInterval(leftIntervalRef.current);
        leftIntervalRef.current = null;
      }
      if (rightIntervalRef.current) {
        clearInterval(rightIntervalRef.current);
        rightIntervalRef.current = null;
      }
    }
  }, [gameOver, gameStarted]);

  // Global touchend listener as fallback to ensure movement stops
  useEffect(() => {
    const handleGlobalTouchEnd = () => {
      stopMovingLeft();
      stopMovingRight();
    };

    window.addEventListener('touchend', handleGlobalTouchEnd);
    return () => window.removeEventListener('touchend', handleGlobalTouchEnd);
  }, [stopMovingLeft, stopMovingRight]);

  const TouchControls = () => {
    return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      gap: '20px'
    }}>
      <button
        onMouseDown={startMovingLeft}
        onMouseUp={stopMovingLeft}
        onMouseLeave={stopMovingLeft}
        onTouchStart={(e) => { 
          e.preventDefault(); 
          e.stopPropagation();
          startMovingLeft(); 
        }}
        onTouchEnd={(e) => { 
          e.preventDefault(); 
          e.stopPropagation();
          stopMovingLeft(); 
        }}
        onTouchCancel={(e) => { 
          e.preventDefault(); 
          stopMovingLeft(); 
        }}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          padding: '16px 24px',
          fontSize: '24px',
          background: '#f59e0b',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          userSelect: 'none',
          width: '80px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          touchAction: 'none',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          WebkitTapHighlightColor: 'transparent'
        }}
      >
        ←
      </button>
      <button
        onMouseDown={startMovingRight}
        onMouseUp={stopMovingRight}
        onMouseLeave={stopMovingRight}
        onTouchStart={(e) => { 
          e.preventDefault(); 
          e.stopPropagation();
          startMovingRight(); 
        }}
        onTouchEnd={(e) => { 
          e.preventDefault(); 
          e.stopPropagation();
          stopMovingRight(); 
        }}
        onTouchCancel={(e) => { 
          e.preventDefault(); 
          stopMovingRight(); 
        }}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          padding: '16px 24px',
          fontSize: '24px',
          background: '#f59e0b',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          userSelect: 'none',
          width: '80px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          touchAction: 'none',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          WebkitTapHighlightColor: 'transparent'
        }}
      >
        →
      </button>
    </div>
    );
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: isLandscape ? 'row' : 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      boxSizing: 'border-box',
      gap: '20px'
    }}>
      {/* Left controls (landscape only) */}
      {isLandscape && gameStarted && !gameOver && <TouchControls />}

      {/* Game area */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px'
      }}>
      <div style={{
        marginBottom: '16px',
        display: 'flex',
        gap: '20px',
        fontSize: '18px',
        fontWeight: 600,
        color: '#1f2937'
      }}>
        <div>Score: {score}</div>
        <div>Lives: {'❤️'.repeat(Math.max(0, lives))}</div>
        <div>High Score: {highScore}</div>
      </div>

      <div style={{
        position: 'relative',
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        background: 'linear-gradient(180deg, #87CEEB 0%, #E0F6FF 100%)',
        border: '4px solid #1f2937',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        {/* Falling items */}
        {fallingItems.map(item => (
          <div
            key={item.id}
            style={{
              position: 'absolute',
              left: item.x,
              top: item.y,
              fontSize: ITEM_SIZE,
              lineHeight: '1',
              pointerEvents: 'none',
              userSelect: 'none'
            }}
          >
            {item.emoji}
          </div>
        ))}

        {/* Basket */}
        {gameStarted && !gameOver && (
          <div style={{
            position: 'absolute',
            left: basketX - BASKET_WIDTH / 2,
            bottom: 0,
            width: BASKET_WIDTH,
            height: BASKET_HEIGHT,
            fontSize: '60px',
            lineHeight: '1',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            userSelect: 'none'
          }}>
            🧺
          </div>
        )}

        {/* Start screen */}
        {!gameStarted && !gameOver && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.9)',
            gap: '20px'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#1f2937', textAlign: 'center' }}>
              Catch & Collect
            </div>
            <div style={{ fontSize: '18px', color: '#4b5563', textAlign: 'center', maxWidth: '400px' }}>
              Use ← → arrow keys to move the basket and catch falling items!
            </div>
            <button
              onClick={startGame}
              style={{
                padding: '12px 32px',
                fontSize: '18px',
                fontWeight: 600,
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
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
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.95)',
            gap: '16px'
          }}>
            <div style={{ fontSize: '36px', fontWeight: 700, color: '#ef4444' }}>
              Game Over!
            </div>
            <div style={{ fontSize: '24px', color: '#1f2937' }}>
              Final Score: {score}
            </div>
            {score === highScore && score > 0 && (
              <div style={{ fontSize: '20px', color: '#10b981', fontWeight: 600 }}>
                🎉 New High Score! 🎉
              </div>
            )}
            <button
              onClick={startGame}
              style={{
                padding: '12px 32px',
                fontSize: '18px',
                fontWeight: 600,
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                marginTop: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => e.target.style.background = '#2563eb'}
              onMouseLeave={(e) => e.target.style.background = '#3b82f6'}
            >
              Play Again
            </button>
          </div>
        )}
      </div>



      <button
        onClick={onBack}
        style={{
          marginTop: '20px',
          padding: '10px 24px',
          fontSize: '16px',
          fontWeight: 600,
          background: '#6b7280',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
        onMouseEnter={(e) => e.target.style.background = '#4b5563'}
        onMouseLeave={(e) => e.target.style.background = '#6b7280'}
      >
        ← Back to Games
      </button>

      {/* Touch controls (portrait only) */}
      {!isLandscape && gameStarted && !gameOver && <TouchControls />}
      </div>

      {/* Right controls (landscape only) */}
      {isLandscape && gameStarted && !gameOver && <TouchControls />}
    </div>
  );
}
