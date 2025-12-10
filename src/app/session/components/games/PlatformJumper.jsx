"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * PlatformJumper - Jump across platforms to reach the goal
 * Kids use spacebar to jump and arrow keys to move
 */
export default function PlatformJumper({ onBack }) {
  const [playerPos, setPlayerPos] = useState({ x: 50, y: 300 });
  const [playerVelocity, setPlayerVelocity] = useState({ x: 0, y: 0 });
  const [isJumping, setIsJumping] = useState(false);
  const [onGround, setOnGround] = useState(false);
  const [level, setLevel] = useState(1);
  const [gameWon, setGameWon] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameLost, setGameLost] = useState(false);

  // Detect orientation - must be declared early to avoid hook order issues
  const [isLandscape, setIsLandscape] = useState(typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false);

  const gameLoopRef = useRef(null);
  const keysPressed = useRef({});
  const touchLeft = useRef(false);
  const touchRight = useRef(false);

  // Orientation detection effect
  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const GAME_WIDTH = 800;
  const GAME_HEIGHT = 500;
  const PLAYER_SIZE = 30;
  const GRAVITY = 0.6;
  const JUMP_STRENGTH = -10;
  const MOVE_SPEED = 5;
  const MAX_FALL_Y = GAME_HEIGHT + 50;

  // Platform layouts for different levels
  const levels = {
    1: {
      name: 'Getting Started',
      platforms: [
        { x: 0, y: 350, width: 150, height: 20 }, // Start platform
        { x: 200, y: 350, width: 100, height: 20 },
        { x: 350, y: 300, width: 100, height: 20 },
        { x: 500, y: 250, width: 100, height: 20 },
        { x: 650, y: 200, width: 150, height: 20 }, // Goal platform
      ],
      startPos: { x: 50, y: 300 },
      goalArea: { x: 650, y: 150, width: 150, height: 50 }
    },
    2: {
      name: 'The Gap',
      platforms: [
        { x: 0, y: 400, width: 120, height: 20 },
        { x: 180, y: 350, width: 80, height: 20 },
        { x: 320, y: 300, width: 80, height: 20 },
        { x: 460, y: 250, width: 80, height: 20 },
        { x: 600, y: 300, width: 80, height: 20 },
        { x: 720, y: 350, width: 80, height: 20 },
      ],
      startPos: { x: 50, y: 350 },
      goalArea: { x: 720, y: 300, width: 80, height: 50 }
    },
    3: {
      name: 'Stairway Up',
      platforms: [
        { x: 0, y: 450, width: 100, height: 20 },
        { x: 120, y: 400, width: 80, height: 20 },
        { x: 220, y: 350, width: 80, height: 20 },
        { x: 320, y: 300, width: 80, height: 20 },
        { x: 420, y: 250, width: 80, height: 20 },
        { x: 520, y: 200, width: 80, height: 20 },
        { x: 620, y: 150, width: 100, height: 20 },
        { x: 740, y: 100, width: 60, height: 20 },
      ],
      startPos: { x: 40, y: 400 },
      goalArea: { x: 740, y: 50, width: 60, height: 50 }
    },
    4: {
      name: 'The Zigzag',
      platforms: [
        { x: 0, y: 400, width: 100, height: 20 },
        { x: 150, y: 350, width: 70, height: 20 },
        { x: 300, y: 300, width: 70, height: 20 },
        { x: 450, y: 250, width: 70, height: 20 },
        { x: 300, y: 200, width: 70, height: 20 },
        { x: 450, y: 150, width: 70, height: 20 },
        { x: 600, y: 100, width: 100, height: 20 },
      ],
      startPos: { x: 40, y: 350 },
      goalArea: { x: 600, y: 50, width: 100, height: 50 }
    },
    5: {
      name: 'Expert Challenge',
      platforms: [
        { x: 0, y: 450, width: 80, height: 20 },
        { x: 120, y: 400, width: 60, height: 20 },
        { x: 220, y: 350, width: 60, height: 20 },
        { x: 320, y: 300, width: 60, height: 20 },
        { x: 420, y: 250, width: 60, height: 20 },
        { x: 320, y: 200, width: 60, height: 20 },
        { x: 220, y: 150, width: 60, height: 20 },
        { x: 320, y: 100, width: 60, height: 20 },
        { x: 450, y: 100, width: 60, height: 20 },
        { x: 580, y: 100, width: 60, height: 20 },
        { x: 700, y: 150, width: 100, height: 20 },
      ],
      startPos: { x: 30, y: 400 },
      goalArea: { x: 700, y: 100, width: 100, height: 50 }
    },
    6: {
      name: 'Sky Steps',
      platforms: [
        { x: 0, y: 450, width: 70, height: 20 },
        { x: 110, y: 400, width: 60, height: 20 },
        { x: 210, y: 350, width: 60, height: 20 },
        { x: 310, y: 300, width: 60, height: 20 },
        { x: 410, y: 250, width: 50, height: 20 },
        { x: 500, y: 200, width: 50, height: 20 },
        { x: 590, y: 150, width: 50, height: 20 },
        { x: 680, y: 100, width: 120, height: 20 },
      ],
      startPos: { x: 30, y: 400 },
      goalArea: { x: 680, y: 50, width: 120, height: 50 }
    },
    7: {
      name: 'Narrow Path',
      platforms: [
        { x: 0, y: 400, width: 80, height: 20 },
        { x: 120, y: 350, width: 50, height: 20 },
        { x: 210, y: 300, width: 50, height: 20 },
        { x: 300, y: 250, width: 50, height: 20 },
        { x: 390, y: 300, width: 50, height: 20 },
        { x: 480, y: 250, width: 50, height: 20 },
        { x: 570, y: 200, width: 50, height: 20 },
        { x: 660, y: 150, width: 50, height: 20 },
        { x: 740, y: 100, width: 60, height: 20 },
      ],
      startPos: { x: 30, y: 350 },
      goalArea: { x: 740, y: 50, width: 60, height: 50 }
    },
    8: {
      name: 'Double Back',
      platforms: [
        { x: 0, y: 450, width: 70, height: 20 },
        { x: 100, y: 400, width: 60, height: 20 },
        { x: 200, y: 350, width: 60, height: 20 },
        { x: 300, y: 300, width: 60, height: 20 },
        { x: 400, y: 250, width: 60, height: 20 },
        { x: 300, y: 200, width: 60, height: 20 },
        { x: 400, y: 150, width: 60, height: 20 },
        { x: 500, y: 150, width: 60, height: 20 },
        { x: 600, y: 150, width: 60, height: 20 },
        { x: 700, y: 100, width: 100, height: 20 },
      ],
      startPos: { x: 30, y: 400 },
      goalArea: { x: 700, y: 50, width: 100, height: 50 }
    },
    9: {
      name: 'Big Leaps',
      platforms: [
        { x: 0, y: 450, width: 70, height: 20 },
        { x: 140, y: 400, width: 50, height: 20 },
        { x: 280, y: 350, width: 50, height: 20 },
        { x: 420, y: 300, width: 50, height: 20 },
        { x: 560, y: 250, width: 50, height: 20 },
        { x: 700, y: 200, width: 100, height: 20 },
      ],
      startPos: { x: 30, y: 400 },
      goalArea: { x: 700, y: 150, width: 100, height: 50 }
    },
    10: {
      name: 'Floating Islands',
      platforms: [
        { x: 0, y: 450, width: 60, height: 20 },
        { x: 100, y: 400, width: 50, height: 20 },
        { x: 190, y: 350, width: 50, height: 20 },
        { x: 280, y: 300, width: 45, height: 20 },
        { x: 365, y: 250, width: 45, height: 20 },
        { x: 450, y: 200, width: 45, height: 20 },
        { x: 535, y: 250, width: 45, height: 20 },
        { x: 620, y: 200, width: 45, height: 20 },
        { x: 705, y: 150, width: 95, height: 20 },
      ],
      startPos: { x: 25, y: 400 },
      goalArea: { x: 705, y: 100, width: 95, height: 50 }
    },
    11: {
      name: 'High Stakes',
      platforms: [
        { x: 0, y: 450, width: 60, height: 20 },
        { x: 100, y: 400, width: 50, height: 20 },
        { x: 190, y: 350, width: 45, height: 20 },
        { x: 275, y: 300, width: 45, height: 20 },
        { x: 360, y: 250, width: 45, height: 20 },
        { x: 275, y: 200, width: 45, height: 20 },
        { x: 190, y: 150, width: 45, height: 20 },
        { x: 275, y: 100, width: 45, height: 20 },
        { x: 360, y: 100, width: 45, height: 20 },
        { x: 450, y: 100, width: 45, height: 20 },
        { x: 540, y: 100, width: 45, height: 20 },
        { x: 630, y: 100, width: 45, height: 20 },
        { x: 720, y: 100, width: 80, height: 20 },
      ],
      startPos: { x: 25, y: 400 },
      goalArea: { x: 720, y: 50, width: 80, height: 50 }
    },
    12: {
      name: 'Precision Jump',
      platforms: [
        { x: 0, y: 450, width: 60, height: 20 },
        { x: 120, y: 400, width: 45, height: 20 },
        { x: 225, y: 350, width: 45, height: 20 },
        { x: 330, y: 300, width: 40, height: 20 },
        { x: 430, y: 250, width: 40, height: 20 },
        { x: 530, y: 200, width: 40, height: 20 },
        { x: 630, y: 150, width: 40, height: 20 },
        { x: 730, y: 100, width: 70, height: 20 },
      ],
      startPos: { x: 25, y: 400 },
      goalArea: { x: 730, y: 50, width: 70, height: 50 }
    },
    13: {
      name: 'The Pyramid',
      platforms: [
        { x: 0, y: 470, width: 60, height: 20 },
        { x: 90, y: 420, width: 50, height: 20 },
        { x: 180, y: 370, width: 45, height: 20 },
        { x: 265, y: 320, width: 45, height: 20 },
        { x: 350, y: 270, width: 40, height: 20 },
        { x: 430, y: 220, width: 40, height: 20 },
        { x: 510, y: 170, width: 40, height: 20 },
        { x: 590, y: 120, width: 40, height: 20 },
        { x: 670, y: 170, width: 40, height: 20 },
        { x: 750, y: 120, width: 50, height: 20 },
      ],
      startPos: { x: 25, y: 420 },
      goalArea: { x: 750, y: 70, width: 50, height: 50 }
    },
    14: {
      name: 'Tiny Platforms',
      platforms: [
        { x: 0, y: 450, width: 55, height: 20 },
        { x: 95, y: 400, width: 40, height: 20 },
        { x: 175, y: 350, width: 40, height: 20 },
        { x: 255, y: 300, width: 40, height: 20 },
        { x: 335, y: 250, width: 35, height: 20 },
        { x: 410, y: 200, width: 35, height: 20 },
        { x: 485, y: 250, width: 35, height: 20 },
        { x: 560, y: 200, width: 35, height: 20 },
        { x: 635, y: 150, width: 35, height: 20 },
        { x: 710, y: 100, width: 90, height: 20 },
      ],
      startPos: { x: 22, y: 400 },
      goalArea: { x: 710, y: 50, width: 90, height: 50 }
    },
    15: {
      name: 'The W Pattern',
      platforms: [
        { x: 0, y: 450, width: 60, height: 20 },
        { x: 90, y: 400, width: 40, height: 20 },
        { x: 170, y: 350, width: 40, height: 20 },
        { x: 250, y: 300, width: 40, height: 20 },
        { x: 330, y: 250, width: 35, height: 20 },
        { x: 405, y: 300, width: 35, height: 20 },
        { x: 480, y: 250, width: 35, height: 20 },
        { x: 555, y: 300, width: 35, height: 20 },
        { x: 630, y: 250, width: 35, height: 20 },
        { x: 705, y: 200, width: 35, height: 20 },
        { x: 760, y: 150, width: 40, height: 20 },
      ],
      startPos: { x: 25, y: 400 },
      goalArea: { x: 760, y: 100, width: 40, height: 50 }
    },
    16: {
      name: 'Extreme Gaps',
      platforms: [
        { x: 0, y: 450, width: 55, height: 20 },
        { x: 130, y: 400, width: 40, height: 20 },
        { x: 245, y: 350, width: 40, height: 20 },
        { x: 360, y: 300, width: 35, height: 20 },
        { x: 475, y: 250, width: 35, height: 20 },
        { x: 590, y: 200, width: 35, height: 20 },
        { x: 705, y: 150, width: 95, height: 20 },
      ],
      startPos: { x: 22, y: 400 },
      goalArea: { x: 705, y: 100, width: 95, height: 50 }
    },
    17: {
      name: 'Triple Bounce',
      platforms: [
        { x: 0, y: 470, width: 50, height: 20 },
        { x: 80, y: 420, width: 40, height: 20 },
        { x: 155, y: 370, width: 35, height: 20 },
        { x: 225, y: 320, width: 35, height: 20 },
        { x: 155, y: 270, width: 35, height: 20 },
        { x: 225, y: 220, width: 35, height: 20 },
        { x: 295, y: 170, width: 35, height: 20 },
        { x: 365, y: 220, width: 35, height: 20 },
        { x: 435, y: 170, width: 35, height: 20 },
        { x: 505, y: 120, width: 35, height: 20 },
        { x: 575, y: 170, width: 35, height: 20 },
        { x: 645, y: 120, width: 35, height: 20 },
        { x: 715, y: 120, width: 85, height: 20 },
      ],
      startPos: { x: 20, y: 420 },
      goalArea: { x: 715, y: 70, width: 85, height: 50 }
    },
    18: {
      name: 'Pixel Perfect',
      platforms: [
        { x: 0, y: 450, width: 50, height: 20 },
        { x: 90, y: 400, width: 35, height: 20 },
        { x: 165, y: 350, width: 35, height: 20 },
        { x: 240, y: 300, width: 30, height: 20 },
        { x: 310, y: 250, width: 30, height: 20 },
        { x: 380, y: 200, width: 30, height: 20 },
        { x: 450, y: 150, width: 30, height: 20 },
        { x: 520, y: 200, width: 30, height: 20 },
        { x: 590, y: 150, width: 30, height: 20 },
        { x: 660, y: 100, width: 30, height: 20 },
        { x: 730, y: 100, width: 70, height: 20 },
      ],
      startPos: { x: 20, y: 400 },
      goalArea: { x: 730, y: 50, width: 70, height: 50 }
    },
    19: {
      name: 'The Gauntlet',
      platforms: [
        { x: 0, y: 470, width: 50, height: 20 },
        { x: 85, y: 430, width: 35, height: 20 },
        { x: 155, y: 390, width: 30, height: 20 },
        { x: 220, y: 350, width: 30, height: 20 },
        { x: 285, y: 310, width: 30, height: 20 },
        { x: 350, y: 270, width: 30, height: 20 },
        { x: 285, y: 230, width: 30, height: 20 },
        { x: 220, y: 190, width: 30, height: 20 },
        { x: 285, y: 150, width: 30, height: 20 },
        { x: 350, y: 110, width: 30, height: 20 },
        { x: 420, y: 110, width: 30, height: 20 },
        { x: 490, y: 110, width: 30, height: 20 },
        { x: 560, y: 110, width: 30, height: 20 },
        { x: 630, y: 110, width: 30, height: 20 },
        { x: 700, y: 110, width: 100, height: 20 },
      ],
      startPos: { x: 20, y: 420 },
      goalArea: { x: 700, y: 60, width: 100, height: 50 }
    },
    20: {
      name: 'Master Champion',
      platforms: [
        { x: 0, y: 470, width: 45, height: 20 },
        { x: 80, y: 430, width: 30, height: 20 },
        { x: 145, y: 390, width: 30, height: 20 },
        { x: 210, y: 350, width: 30, height: 20 },
        { x: 275, y: 310, width: 25, height: 20 },
        { x: 335, y: 270, width: 25, height: 20 },
        { x: 395, y: 230, width: 25, height: 20 },
        { x: 335, y: 190, width: 25, height: 20 },
        { x: 275, y: 150, width: 25, height: 20 },
        { x: 335, y: 110, width: 25, height: 20 },
        { x: 395, y: 110, width: 25, height: 20 },
        { x: 455, y: 110, width: 25, height: 20 },
        { x: 515, y: 150, width: 25, height: 20 },
        { x: 575, y: 110, width: 25, height: 20 },
        { x: 635, y: 150, width: 25, height: 20 },
        { x: 695, y: 110, width: 25, height: 20 },
        { x: 755, y: 110, width: 45, height: 20 },
      ],
      startPos: { x: 18, y: 420 },
      goalArea: { x: 755, y: 60, width: 45, height: 50 }
    }
  };

  const currentLevel = levels[level];

  // Reset player position when level changes
  useEffect(() => {
    if (gameStarted && !gameWon) {
      setPlayerPos(currentLevel.startPos);
      setPlayerVelocity({ x: 0, y: 0 });
      setIsJumping(false);
      setOnGround(false);
    }
  }, [level, gameStarted, gameWon]);

  const startGame = () => {
    keysPressed.current = {}; // Clear all pressed keys
    setPlayerPos(currentLevel.startPos);
    setPlayerVelocity({ x: 0, y: 0 });
    setIsJumping(false);
    setOnGround(false);
    setGameWon(false);
    setGameLost(false);
    setGameStarted(true);
  };

  const nextLevel = () => {
    keysPressed.current = {}; // Clear all pressed keys
    if (level < Object.keys(levels).length) {
      setLevel(level + 1);
      setGameWon(false);
      setGameStarted(false);
    } else {
      // Completed all levels
      setLevel(1);
      setGameWon(false);
      setGameStarted(false);
    }
  };

  const resetLevel = () => {
    keysPressed.current = {}; // Clear all pressed keys
    setPlayerPos(currentLevel.startPos);
    setPlayerVelocity({ x: 0, y: 0 });
    setIsJumping(false);
    setOnGround(false);
    setGameLost(false);
  };

  // Shared jump function for both keyboard and touch
  const performJump = useCallback(() => {
    if (onGround && !isJumping) {
      setPlayerVelocity(v => ({ ...v, y: JUMP_STRENGTH }));
      setIsJumping(true);
      setOnGround(false);
    }
  }, [onGround, isJumping]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!gameStarted || gameWon || gameLost) return;
      keysPressed.current[e.key] = true;

      if (e.key === ' ') {
        e.preventDefault();
        performJump();
      }
    };

    const handleKeyUp = (e) => {
      keysPressed.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameStarted, gameWon, gameLost, performJump]);

  // Game loop
  useEffect(() => {
    if (!gameStarted || gameWon || gameLost) return;

    gameLoopRef.current = setInterval(() => {
      setPlayerVelocity(prevVel => {
        // Only apply gravity if player is not on ground
        let newVelY = onGround ? 0 : prevVel.y + GRAVITY;
        
        setPlayerPos(prevPos => {
          let newVelX = 0;

          // Horizontal movement - check both keyboard and touch
          const movingLeft = keysPressed.current['ArrowLeft'] || touchLeft.current;
          const movingRight = keysPressed.current['ArrowRight'] || touchRight.current;
          
          if (movingLeft && !movingRight) {
            newVelX = -MOVE_SPEED;
          } else if (movingRight && !movingLeft) {
            newVelX = MOVE_SPEED;
          }

          let newX = prevPos.x + newVelX;
          let newY = prevPos.y + newVelY;

          // Boundary checks
          if (newX < 0) newX = 0;
          if (newX > GAME_WIDTH - PLAYER_SIZE) newX = GAME_WIDTH - PLAYER_SIZE;
          if (newY < 0) {
            newY = 0;
            newVelY = 0; // Stop upward velocity when hitting ceiling
          }

          // Check if fell off screen
          if (newY > MAX_FALL_Y) {
            setGameLost(true);
            return prevPos;
          }

          // Platform collision detection
          let landed = false;
          for (const platform of currentLevel.platforms) {
            // Check if player is above platform and falling
            if (
              newVelY > 0 &&
              prevPos.y + PLAYER_SIZE <= platform.y &&
              newY + PLAYER_SIZE >= platform.y &&
              newX + PLAYER_SIZE > platform.x &&
              newX < platform.x + platform.width
            ) {
              newY = platform.y - PLAYER_SIZE;
              newVelY = 0;
              landed = true;
              setOnGround(true);
              setIsJumping(false);
              break;
            }
          }

          if (!landed && onGround) {
            setOnGround(false);
          }

          // Check if reached goal
          const goal = currentLevel.goalArea;
          if (
            newX + PLAYER_SIZE > goal.x &&
            newX < goal.x + goal.width &&
            newY + PLAYER_SIZE > goal.y &&
            newY < goal.y + goal.height
          ) {
            setGameWon(true);
          }

          return { x: newX, y: newY };
        });

        return { x: 0, y: newVelY };
      });
    }, 1000 / 60); // 60 FPS

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [gameStarted, gameWon, gameLost, onGround, currentLevel]);

  // Touch control handlers - simply set/clear refs
  const startTouchLeft = useCallback(() => {
    touchLeft.current = true;
  }, []);

  const stopTouchLeft = useCallback(() => {
    touchLeft.current = false;
  }, []);

  const startTouchRight = useCallback(() => {
    touchRight.current = true;
  }, []);

  const stopTouchRight = useCallback(() => {
    touchRight.current = false;
  }, []);

  // Global pointer listener as fallback
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      touchLeft.current = false;
      touchRight.current = false;
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, []);

  const TouchControls = () => {
    return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      alignItems: 'center',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      WebkitTouchCallout: 'none'
    }}>
      {/* Left and Right arrows in a row */}
      <div style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}>
        <button
          onPointerDown={(e) => { 
            e.preventDefault();
            startTouchLeft();
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            stopTouchLeft();
          }}
          onPointerLeave={(e) => {
            e.preventDefault();
            stopTouchLeft();
          }}
          onPointerCancel={(e) => {
            e.preventDefault();
            stopTouchLeft();
          }}
          style={{
            padding: '12px',
            fontSize: '28px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'none',
            width: '70px',
            height: '70px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
          }}
        >
          ←
        </button>
        <button
          onPointerDown={(e) => { 
            e.preventDefault();
            startTouchRight();
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            stopTouchRight();
          }}
          onPointerLeave={(e) => {
            e.preventDefault();
            stopTouchRight();
          }}
          onPointerCancel={(e) => {
            e.preventDefault();
            stopTouchRight();
          }}
          style={{
            padding: '12px',
            fontSize: '28px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'none',
            width: '70px',
            height: '70px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
          }}
        >
          →
        </button>
      </div>
      {/* Jump button below */}
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          performJump();
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerCancel={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
        }}
        onMouseDown={(e) => {
          e.preventDefault();
        }}
        onTouchStart={(e) => {
          e.preventDefault();
        }}
        style={{
          padding: '12px 20px',
          fontSize: '18px',
          fontWeight: 'bold',
          background: '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'none',
          width: '152px',
          height: '60px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
          WebkitTapHighlightColor: 'rgba(0,0,0,0)'
        }}
      >
        JUMP
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
      background: '#f9fafb',
      gap: '20px'
    }}>
      {/* Left controls (landscape only) */}
      {isLandscape && gameStarted && !gameWon && !gameLost && <TouchControls />}

      {/* Game area */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{
          fontSize: '20px',
          fontWeight: 700,
          color: '#1f2937'
        }}>
          Level {level}: {currentLevel.name}
        </div>

        <div style={{
          position: 'relative',
          width: GAME_WIDTH,
          height: GAME_HEIGHT,
          background: 'linear-gradient(180deg, #bfdbfe 0%, #dbeafe 100%)',
          border: '4px solid #1f2937',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
        {/* Platforms */}
        {currentLevel.platforms.map((platform, index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: platform.x,
              top: platform.y,
              width: platform.width,
              height: platform.height,
              background: '#78350f',
              border: '2px solid #451a03',
              borderRadius: '4px'
            }}
          />
        ))}

        {/* Goal area */}
        <div
          style={{
            position: 'absolute',
            left: currentLevel.goalArea.x,
            top: currentLevel.goalArea.y,
            width: currentLevel.goalArea.width,
            height: currentLevel.goalArea.height,
            background: 'rgba(34, 197, 94, 0.3)',
            border: '3px dashed #22c55e',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px'
          }}
        >
          🏆
        </div>

        {/* Player */}
        {gameStarted && !gameWon && !gameLost && (
          <div
            style={{
              position: 'absolute',
              left: playerPos.x,
              top: playerPos.y,
              width: PLAYER_SIZE,
              height: PLAYER_SIZE,
              fontSize: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none'
            }}
          >
            😊
          </div>
        )}

        {/* Start screen */}
        {!gameStarted && !gameWon && (
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
            gap: '20px'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#1f2937' }}>
              Platform Jumper
            </div>
            <div style={{ fontSize: '20px', color: '#1f2937', fontWeight: 600 }}>
              Level {level}: {currentLevel.name}
            </div>
            <div style={{ fontSize: '16px', color: '#6b7280', textAlign: 'center', maxWidth: '400px' }}>
              Use ← → arrows to move and SPACEBAR to jump. Reach the trophy to win!
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
              Start Level
            </button>
          </div>
        )}

        {/* Win screen */}
        {gameWon && (
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
            <div style={{ fontSize: '48px' }}>🎉</div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#10b981' }}>
              Level Complete!
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              {level < Object.keys(levels).length ? (
                <button
                  onClick={nextLevel}
                  style={{
                    padding: '10px 24px',
                    fontSize: '16px',
                    fontWeight: 600,
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#2563eb'}
                  onMouseLeave={(e) => e.target.style.background = '#3b82f6'}
                >
                  Next Level →
                </button>
              ) : (
                <button
                  onClick={nextLevel}
                  style={{
                    padding: '10px 24px',
                    fontSize: '16px',
                    fontWeight: 600,
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#059669'}
                  onMouseLeave={(e) => e.target.style.background = '#10b981'}
                >
                  🎊 Play Again from Start
                </button>
              )}
            </div>
          </div>
        )}

        {/* Lost screen */}
        {gameLost && (
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
            <div style={{ fontSize: '48px' }}>😢</div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#ef4444' }}>
              You Fell!
            </div>
            <button
              onClick={resetLevel}
              style={{
                padding: '10px 24px',
                fontSize: '16px',
                fontWeight: 600,
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => e.target.style.background = '#2563eb'}
              onMouseLeave={(e) => e.target.style.background = '#3b82f6'}
            >
              Try Again
            </button>
          </div>
        )}
      </div>

        {/* Touch controls (portrait only) */}
        {!isLandscape && gameStarted && !gameWon && !gameLost && <TouchControls />}

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
      </div>

      {/* Right controls (landscape only) */}
      {isLandscape && gameStarted && !gameWon && !gameLost && <TouchControls />}
    </div>
  );
}
