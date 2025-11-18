'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

const GRID_SIZE = 25;
const CELL_SIZE = 24;
const INITIAL_SPEED = 150;
const SPEED_INCREMENT = 10;

const DIRECTION = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

function getRandomPosition() {
  return {
    x: Math.floor(Math.random() * GRID_SIZE),
    y: Math.floor(Math.random() * GRID_SIZE),
  };
}

export default function Snake({ onExit }) {
  const [gameStarted, setGameStarted] = useState(false);
  const [snake, setSnake] = useState([{ x: 10, y: 10 }]);
  const [direction, setDirection] = useState(DIRECTION.RIGHT);
  const [food, setFood] = useState(getRandomPosition());
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [highScore, setHighScore] = useState(0);

  // Detect orientation - must be declared early to avoid hook order issues
  const [isLandscape, setIsLandscape] = useState(typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false);

  const directionRef = useRef(direction);
  const gameLoopRef = useRef(null);

  // Orientation detection effect
  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update direction ref when direction changes
  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  const resetGame = useCallback(() => {
    setSnake([{ x: 10, y: 10 }]);
    setDirection(DIRECTION.RIGHT);
    directionRef.current = DIRECTION.RIGHT;
    setFood(getRandomPosition());
    setScore(0);
    setGameOver(false);
    setSpeed(INITIAL_SPEED);
    setGameStarted(true);
  }, []);

  const moveSnake = useCallback(() => {
    setSnake((prevSnake) => {
      const head = prevSnake[0];
      const newHead = {
        x: head.x + directionRef.current.x,
        y: head.y + directionRef.current.y,
      };

      // Check wall collision
      if (
        newHead.x < 0 ||
        newHead.x >= GRID_SIZE ||
        newHead.y < 0 ||
        newHead.y >= GRID_SIZE
      ) {
        setGameOver(true);
        return prevSnake;
      }

      // Check self collision
      if (prevSnake.some((segment) => segment.x === newHead.x && segment.y === newHead.y)) {
        setGameOver(true);
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // Check food collision
      if (newHead.x === food.x && newHead.y === food.y) {
        setScore((prev) => {
          const newScore = prev + 10;
          setHighScore((high) => Math.max(high, newScore));
          return newScore;
        });
        setFood(getRandomPosition());
        // Speed up slightly
        setSpeed((prev) => Math.max(50, prev - SPEED_INCREMENT));
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [food]);

  // Game loop
  useEffect(() => {
    if (!gameStarted || gameOver) {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
      return;
    }

    gameLoopRef.current = setInterval(() => {
      moveSnake();
    }, speed);

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [gameStarted, gameOver, speed, moveSnake]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!gameStarted || gameOver) return;

      const key = e.key;
      e.preventDefault();

      setDirection((currentDir) => {
        // Prevent 180-degree turns
        if (key === 'ArrowUp' && currentDir !== DIRECTION.DOWN) return DIRECTION.UP;
        if (key === 'ArrowDown' && currentDir !== DIRECTION.UP) return DIRECTION.DOWN;
        if (key === 'ArrowLeft' && currentDir !== DIRECTION.RIGHT) return DIRECTION.LEFT;
        if (key === 'ArrowRight' && currentDir !== DIRECTION.LEFT) return DIRECTION.RIGHT;
        return currentDir;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStarted, gameOver]);

  // Touch/Click controls
  const handleDirectionClick = useCallback((newDir) => {
    if (!gameStarted || gameOver) return;

    setDirection((currentDir) => {
      // Prevent 180-degree turns
      if (newDir === DIRECTION.UP && currentDir === DIRECTION.DOWN) return currentDir;
      if (newDir === DIRECTION.DOWN && currentDir === DIRECTION.UP) return currentDir;
      if (newDir === DIRECTION.LEFT && currentDir === DIRECTION.RIGHT) return currentDir;
      if (newDir === DIRECTION.RIGHT && currentDir === DIRECTION.LEFT) return currentDir;
      return newDir;
    });
  }, [gameStarted, gameOver]);

  // Start screen
  if (!gameStarted) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 20,
        padding: 20,
      }}>
        <h2 style={{ color: '#1f2937', fontSize: 32, fontWeight: 800, margin: 0 }}>
          🐍 Snake Game
        </h2>
        <p style={{ color: '#4b5563', fontSize: 16, textAlign: 'center', maxWidth: 400 }}>
          Use arrow keys or the control buttons to guide the snake. Eat the red food to grow and score points!
        </p>
        {highScore > 0 && (
          <p style={{ color: '#10b981', fontSize: 20, fontWeight: 700 }}>
            High Score: {highScore}
          </p>
        )}
        <button
          onClick={resetGame}
          style={{
            background: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '16px 32px',
            fontSize: 18,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
          }}
        >
          Start Game
        </button>
        <button
          onClick={onExit}
          style={{
            background: '#6b7280',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '12px 24px',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Back to Games
        </button>
      </div>
    );
  }

  // Game over screen
  if (gameOver) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 20,
        padding: 20,
      }}>
        <h2 style={{ color: '#ef4444', fontSize: 32, fontWeight: 800, margin: 0 }}>
          Game Over!
        </h2>
        <p style={{ color: '#1f2937', fontSize: 24, fontWeight: 700 }}>
          Score: {score}
        </p>
        {score === highScore && score > 0 && (
          <p style={{ color: '#10b981', fontSize: 18, fontWeight: 600 }}>
            🎉 New High Score! 🎉
          </p>
        )}
        <div style={{ display: 'flex', gap: 16, marginTop: 20 }}>
          <button
            onClick={resetGame}
            style={{
              background: '#c7442e',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '16px 32px',
              fontSize: 18,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(199, 68, 46, 0.3)',
            }}
          >
            Play Again
          </button>
          <button
            onClick={onExit}
            style={{
              background: '#6b7280',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '16px 32px',
              fontSize: 18,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Back to Games
          </button>
        </div>
      </div>
    );
  }



  const changeDirection = (newDirectionString) => {
    const newDirection = DIRECTION[newDirectionString];
    
    // Prevent reversing into self
    if (
      (newDirection === DIRECTION.UP && direction === DIRECTION.DOWN) ||
      (newDirection === DIRECTION.DOWN && direction === DIRECTION.UP) ||
      (newDirection === DIRECTION.LEFT && direction === DIRECTION.RIGHT) ||
      (newDirection === DIRECTION.RIGHT && direction === DIRECTION.LEFT)
    ) {
      return;
    }
    setDirection(newDirection);
  };

  const TouchControls = () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '4px',
      width: '120px'
    }}>
      <div></div>
      <button
        onTouchStart={(e) => { e.preventDefault(); changeDirection('UP'); }}
        onClick={() => changeDirection('UP')}
        style={{
          padding: '8px',
          fontSize: '16px',
          background: '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          userSelect: 'none',
          height: '40px'
        }}
      >
        ↑
      </button>
      <div></div>
      <button
        onTouchStart={(e) => { e.preventDefault(); changeDirection('LEFT'); }}
        onClick={() => changeDirection('LEFT')}
        style={{
          padding: '8px',
          fontSize: '16px',
          background: '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          userSelect: 'none',
          height: '40px'
        }}
      >
        ←
      </button>
      <div></div>
      <button
        onTouchStart={(e) => { e.preventDefault(); changeDirection('RIGHT'); }}
        onClick={() => changeDirection('RIGHT')}
        style={{
          padding: '8px',
          fontSize: '16px',
          background: '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          userSelect: 'none',
          height: '40px'
        }}
      >
        →
      </button>
      <div></div>
      <button
        onTouchStart={(e) => { e.preventDefault(); changeDirection('DOWN'); }}
        onClick={() => changeDirection('DOWN')}
        style={{
          padding: '8px',
          fontSize: '16px',
          background: '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          userSelect: 'none',
          height: '40px'
        }}
      >
        ↓
      </button>
      <div></div>
    </div>
  );

  // Active game
  return (
    <div style={{
      display: 'flex',
      flexDirection: isLandscape ? 'row' : 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: 20,
      gap: 20,
    }}>
      {/* Left controls (landscape only) */}
      {isLandscape && <TouchControls />}

      {/* Game area */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          maxWidth: GRID_SIZE * CELL_SIZE,
        }}>
          <div style={{ color: '#1f2937', fontSize: 18, fontWeight: 700 }}>
            Score: {score}
          </div>
          <div style={{ color: '#6b7280', fontSize: 16, fontWeight: 600 }}>
            High: {highScore}
          </div>
        </div>

        {/* Game grid */}
        <div
          style={{
            position: 'relative',
            width: GRID_SIZE * CELL_SIZE,
            height: GRID_SIZE * CELL_SIZE,
            background: '#f3f4f6',
            border: '4px solid #1f2937',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
          }}
        >
          {/* Snake */}
          {snake.map((segment, index) => (
            <div
              key={index}
              style={{
                position: 'absolute',
                left: segment.x * CELL_SIZE,
                top: segment.y * CELL_SIZE,
                width: CELL_SIZE,
                height: CELL_SIZE,
                background: index === 0 ? '#10b981' : '#34d399',
                borderRadius: 4,
                border: '1px solid #059669',
              }}
            />
          ))}

          {/* Food */}
          <div
            style={{
              position: 'absolute',
              left: food.x * CELL_SIZE,
              top: food.y * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE,
              background: '#ef4444',
              borderRadius: '50%',
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
            }}
          />
        </div>

        {/* Touch controls (portrait only) */}
        {!isLandscape && <TouchControls />}

        <p style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', maxWidth: 400 }}>
          Use arrow keys or touch controls to guide the snake
        </p>
      </div>

      {/* Right controls (landscape only) */}
      {isLandscape && <TouchControls />}
    </div>
  );
}
