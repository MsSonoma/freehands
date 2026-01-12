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
  const [scale, setScale] = useState(1);

  const gameLoopRef = useRef(null);
  const keysPressed = useRef({});
  const touchLeft = useRef(false);
  const touchRight = useRef(false);
  const onGroundRef = useRef(false);
  const isJumpingRef = useRef(false);
  const currentPlatformRef = useRef(null);

  // Orientation detection and responsive scaling
  useEffect(() => {
    const handleResize = () => {
      const newIsLandscape = window.innerWidth > window.innerHeight;
      setIsLandscape(newIsLandscape);
      
      // Calculate scale based on available viewport space
      // Reserve space for controls and padding
      const controlsWidth = newIsLandscape ? 350 : 0; // Increased to account for two control sets (175px each)
      const controlsHeight = newIsLandscape ? 0 : 220;
      const padding = newIsLandscape ? 10 : 40; // Minimal padding in landscape
      
      const availableWidth = window.innerWidth - controlsWidth - padding;
      const availableHeight = window.innerHeight - controlsHeight - padding - (newIsLandscape ? 40 : 80); // Extra for header/back button
      
      const scaleX = availableWidth / GAME_WIDTH;
      const scaleY = availableHeight / GAME_HEIGHT;
      const newScale = Math.min(scaleX, scaleY, 1.0); // Cap at 1.0x for landscape to ensure fit
      
      setScale(Math.max(newScale, 0.3)); // Minimum scale of 0.3 for very small screens
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const GAME_WIDTH = 800;
  const GAME_HEIGHT = 500;
  const PLAYER_SIZE = 30;
  const GRAVITY = 0.6;
  const JUMP_STRENGTH = -12;
  const TRAMPOLINE_BOUNCE = -20; // Stronger bounce from trampolines
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
    },
    21: {
      name: 'Trampoline Intro',
      platforms: [
        { x: 0, y: 450, width: 80, height: 20 },
        { x: 150, y: 400, width: 60, height: 20, trampoline: true },
        { x: 300, y: 200, width: 80, height: 20 },
        { x: 450, y: 400, width: 60, height: 20, trampoline: true },
        { x: 600, y: 150, width: 100, height: 20 },
      ],
      startPos: { x: 30, y: 400 },
      goalArea: { x: 600, y: 100, width: 100, height: 50 }
    },
    22: {
      name: 'Bounce Chain',
      platforms: [
        { x: 0, y: 470, width: 70, height: 20 },
        { x: 100, y: 430, width: 50, height: 20, trampoline: true },
        { x: 200, y: 250, width: 50, height: 20 },
        { x: 300, y: 430, width: 50, height: 20, trampoline: true },
        { x: 400, y: 200, width: 50, height: 20 },
        { x: 500, y: 430, width: 50, height: 20, trampoline: true },
        { x: 650, y: 150, width: 100, height: 20 },
      ],
      startPos: { x: 25, y: 420 },
      goalArea: { x: 650, y: 100, width: 100, height: 50 }
    },
    23: {
      name: 'High Bounce',
      platforms: [
        { x: 0, y: 460, width: 60, height: 20 },
        { x: 100, y: 460, width: 50, height: 20, trampoline: true },
        { x: 200, y: 250, width: 60, height: 20 },
        { x: 320, y: 350, width: 50, height: 20, trampoline: true },
        { x: 450, y: 200, width: 60, height: 20 },
        { x: 570, y: 380, width: 50, height: 20, trampoline: true },
        { x: 700, y: 120, width: 100, height: 20 },
      ],
      startPos: { x: 25, y: 410 },
      goalArea: { x: 700, y: 70, width: 100, height: 50 }
    },
    24: {
      name: 'Trampoline Maze',
      platforms: [
        { x: 0, y: 450, width: 60, height: 20 },
        { x: 90, y: 400, width: 40, height: 20, trampoline: true },
        { x: 170, y: 450, width: 40, height: 20 },
        { x: 250, y: 400, width: 40, height: 20, trampoline: true },
        { x: 330, y: 200, width: 50, height: 20 },
        { x: 430, y: 400, width: 40, height: 20, trampoline: true },
        { x: 520, y: 250, width: 50, height: 20 },
        { x: 620, y: 400, width: 40, height: 20, trampoline: true },
        { x: 720, y: 150, width: 80, height: 20 },
      ],
      startPos: { x: 25, y: 400 },
      goalArea: { x: 720, y: 100, width: 80, height: 50 }
    },
    25: {
      name: 'Sky Launcher',
      platforms: [
        { x: 0, y: 470, width: 60, height: 20 },
        { x: 100, y: 450, width: 50, height: 20, trampoline: true },
        { x: 220, y: 250, width: 40, height: 20 },
        { x: 300, y: 180, width: 40, height: 20 },
        { x: 380, y: 120, width: 40, height: 20 },
        { x: 460, y: 180, width: 40, height: 20 },
        { x: 540, y: 250, width: 40, height: 20 },
        { x: 620, y: 350, width: 50, height: 20 },
        { x: 700, y: 200, width: 100, height: 20 },
      ],
      startPos: { x: 25, y: 420 },
      goalArea: { x: 700, y: 150, width: 100, height: 50 }
    },
    26: {
      name: 'Narrow Bounce',
      platforms: [
        { x: 0, y: 450, width: 55, height: 20 },
        { x: 90, y: 420, width: 35, height: 20, trampoline: true },
        { x: 170, y: 250, width: 30, height: 20 },
        { x: 250, y: 350, width: 30, height: 20 },
        { x: 330, y: 420, width: 35, height: 20, trampoline: true },
        { x: 420, y: 200, width: 35, height: 20 },
        { x: 510, y: 350, width: 30, height: 20 },
        { x: 590, y: 420, width: 35, height: 20, trampoline: true },
        { x: 680, y: 150, width: 120, height: 20 },
      ],
      startPos: { x: 22, y: 400 },
      goalArea: { x: 680, y: 100, width: 120, height: 50 }
    },
    27: {
      name: 'Double Bounce',
      platforms: [
        { x: 0, y: 460, width: 60, height: 20 },
        { x: 90, y: 440, width: 40, height: 20, trampoline: true },
        { x: 170, y: 420, width: 40, height: 20, trampoline: true },
        { x: 350, y: 100, width: 60, height: 20 },
        { x: 480, y: 420, width: 40, height: 20, trampoline: true },
        { x: 560, y: 440, width: 40, height: 20, trampoline: true },
        { x: 650, y: 300, width: 60, height: 20 },
        { x: 740, y: 200, width: 60, height: 20 },
      ],
      startPos: { x: 25, y: 410 },
      goalArea: { x: 740, y: 150, width: 60, height: 50 }
    },
    28: {
      name: 'Timing Test',
      platforms: [
        { x: 0, y: 450, width: 50, height: 20 },
        { x: 80, y: 430, width: 35, height: 20, trampoline: true },
        { x: 155, y: 300, width: 30, height: 20 },
        { x: 225, y: 430, width: 35, height: 20, trampoline: true },
        { x: 305, y: 250, width: 30, height: 20 },
        { x: 380, y: 430, width: 35, height: 20, trampoline: true },
        { x: 460, y: 200, width: 30, height: 20 },
        { x: 540, y: 430, width: 35, height: 20, trampoline: true },
        { x: 620, y: 250, width: 30, height: 20 },
        { x: 700, y: 430, width: 35, height: 20, trampoline: true },
        { x: 760, y: 150, width: 40, height: 20 },
      ],
      startPos: { x: 20, y: 400 },
      goalArea: { x: 760, y: 100, width: 40, height: 50 }
    },
    29: {
      name: 'Mixed Heights',
      platforms: [
        { x: 0, y: 470, width: 55, height: 20 },
        { x: 85, y: 390, width: 40, height: 20 },
        { x: 165, y: 450, width: 35, height: 20, trampoline: true },
        { x: 240, y: 200, width: 40, height: 20 },
        { x: 320, y: 320, width: 35, height: 20 },
        { x: 395, y: 450, width: 35, height: 20, trampoline: true },
        { x: 475, y: 150, width: 40, height: 20 },
        { x: 560, y: 300, width: 35, height: 20 },
        { x: 640, y: 400, width: 35, height: 20 },
        { x: 720, y: 250, width: 80, height: 20 },
      ],
      startPos: { x: 22, y: 420 },
      goalArea: { x: 720, y: 200, width: 80, height: 50 }
    },
    30: {
      name: 'Trampoline Tower',
      platforms: [
        { x: 0, y: 470, width: 60, height: 20 },
        { x: 100, y: 450, width: 40, height: 20, trampoline: true },
        { x: 200, y: 350, width: 40, height: 20 },
        { x: 280, y: 430, width: 40, height: 20, trampoline: true },
        { x: 380, y: 250, width: 40, height: 20 },
        { x: 460, y: 410, width: 40, height: 20, trampoline: true },
        { x: 560, y: 180, width: 40, height: 20 },
        { x: 640, y: 390, width: 40, height: 20, trampoline: true },
        { x: 740, y: 110, width: 60, height: 20 },
      ],
      startPos: { x: 25, y: 420 },
      goalArea: { x: 740, y: 60, width: 60, height: 50 }
    },
    31: {
      name: 'Precision Bounce',
      platforms: [
        { x: 0, y: 460, width: 50, height: 20 },
        { x: 80, y: 440, width: 30, height: 20, trampoline: true },
        { x: 150, y: 280, width: 25, height: 20 },
        { x: 215, y: 360, width: 25, height: 20 },
        { x: 280, y: 440, width: 30, height: 20, trampoline: true },
        { x: 355, y: 200, width: 25, height: 20 },
        { x: 425, y: 300, width: 25, height: 20 },
        { x: 495, y: 440, width: 30, height: 20, trampoline: true },
        { x: 575, y: 220, width: 25, height: 20 },
        { x: 645, y: 340, width: 25, height: 20 },
        { x: 720, y: 120, width: 80, height: 20 },
      ],
      startPos: { x: 20, y: 410 },
      goalArea: { x: 720, y: 70, width: 80, height: 50 }
    },
    32: {
      name: 'Extreme Bounce',
      platforms: [
        { x: 0, y: 470, width: 55, height: 20 },
        { x: 100, y: 460, width: 40, height: 20, trampoline: true },
        { x: 400, y: 60, width: 50, height: 20 },
        // Bridge platform near the end so the level is solvable without increasing jump height.
        { x: 200, y: 470, width: 420, height: 20 },
        { x: 600, y: 460, width: 40, height: 20, trampoline: true },
        { x: 750, y: 200, width: 50, height: 20 },
      ],
      startPos: { x: 22, y: 420 },
      goalArea: { x: 750, y: 150, width: 50, height: 50 }
    },
    33: {
      name: 'Stairway Bounce',
      platforms: [
        { x: 0, y: 460, width: 50, height: 20 },
        { x: 80, y: 440, width: 35, height: 20, trampoline: true },
        { x: 155, y: 360, width: 30, height: 20 },
        { x: 225, y: 420, width: 35, height: 20, trampoline: true },
        { x: 300, y: 280, width: 30, height: 20 },
        { x: 370, y: 400, width: 35, height: 20, trampoline: true },
        { x: 445, y: 220, width: 30, height: 20 },
        { x: 515, y: 380, width: 35, height: 20, trampoline: true },
        { x: 590, y: 180, width: 30, height: 20 },
        { x: 660, y: 360, width: 35, height: 20, trampoline: true },
        { x: 735, y: 120, width: 65, height: 20 },
      ],
      startPos: { x: 20, y: 410 },
      goalArea: { x: 735, y: 70, width: 65, height: 50 }
    },
    34: {
      name: 'Tiny Trampolines',
      platforms: [
        { x: 0, y: 450, width: 45, height: 20 },
        { x: 75, y: 430, width: 25, height: 20, trampoline: true },
        { x: 140, y: 250, width: 25, height: 20 },
        { x: 205, y: 350, width: 25, height: 20 },
        { x: 270, y: 430, width: 25, height: 20, trampoline: true },
        { x: 340, y: 200, width: 25, height: 20 },
        { x: 410, y: 320, width: 25, height: 20 },
        { x: 480, y: 430, width: 25, height: 20, trampoline: true },
        { x: 555, y: 180, width: 25, height: 20 },
        { x: 630, y: 300, width: 25, height: 20 },
        { x: 705, y: 430, width: 25, height: 20, trampoline: true },
        { x: 760, y: 120, width: 40, height: 20 },
      ],
      startPos: { x: 18, y: 400 },
      goalArea: { x: 760, y: 70, width: 40, height: 50 }
    },
    35: {
      name: 'Bounce Gauntlet',
      platforms: [
        { x: 0, y: 460, width: 50, height: 20 },
        { x: 75, y: 440, width: 30, height: 20, trampoline: true },
        { x: 140, y: 420, width: 30, height: 20, trampoline: true },
        { x: 205, y: 400, width: 30, height: 20, trampoline: true },
        { x: 400, y: 150, width: 50, height: 20 },
        { x: 520, y: 400, width: 30, height: 20, trampoline: true },
        { x: 585, y: 420, width: 30, height: 20, trampoline: true },
        { x: 650, y: 440, width: 30, height: 20, trampoline: true },
        { x: 730, y: 130, width: 70, height: 20 },
      ],
      startPos: { x: 20, y: 410 },
      goalArea: { x: 730, y: 80, width: 70, height: 50 }
    },
    36: {
      name: 'Alternating Paths',
      platforms: [
        { x: 0, y: 450, width: 50, height: 20 },
        { x: 80, y: 400, width: 35, height: 20 },
        { x: 155, y: 430, width: 30, height: 20, trampoline: true },
        { x: 225, y: 300, width: 30, height: 20 },
        { x: 295, y: 380, width: 30, height: 20 },
        { x: 365, y: 430, width: 30, height: 20, trampoline: true },
        { x: 435, y: 250, width: 30, height: 20 },
        { x: 505, y: 350, width: 30, height: 20 },
        { x: 575, y: 430, width: 30, height: 20, trampoline: true },
        { x: 645, y: 200, width: 30, height: 20 },
        { x: 720, y: 300, width: 30, height: 20 },
        { x: 770, y: 110, width: 30, height: 20 },
      ],
      startPos: { x: 20, y: 400 },
      goalArea: { x: 770, y: 60, width: 30, height: 50 }
    },
    37: {
      name: 'Super Launcher',
      platforms: [
        { x: 0, y: 470, width: 55, height: 20 },
        { x: 100, y: 465, width: 45, height: 20, trampoline: true },
        { x: 350, y: 50, width: 100, height: 20 },
        { x: 550, y: 465, width: 45, height: 20, trampoline: true },
        { x: 700, y: 80, width: 100, height: 20 },
      ],
      startPos: { x: 22, y: 420 },
      goalArea: { x: 700, y: 30, width: 100, height: 50 }
    },
    38: {
      name: 'Bounce Pyramid',
      platforms: [
        { x: 0, y: 470, width: 50, height: 20 },
        { x: 75, y: 450, width: 30, height: 20, trampoline: true },
        { x: 145, y: 350, width: 30, height: 20 },
        { x: 215, y: 430, width: 30, height: 20, trampoline: true },
        { x: 285, y: 280, width: 30, height: 20 },
        { x: 355, y: 410, width: 30, height: 20, trampoline: true },
        { x: 425, y: 220, width: 30, height: 20 },
        { x: 495, y: 390, width: 30, height: 20, trampoline: true },
        { x: 565, y: 180, width: 30, height: 20 },
        { x: 635, y: 370, width: 30, height: 20, trampoline: true },
        { x: 705, y: 140, width: 30, height: 20 },
        { x: 765, y: 90, width: 35, height: 20 },
      ],
      startPos: { x: 20, y: 420 },
      goalArea: { x: 765, y: 40, width: 35, height: 50 }
    },
    39: {
      name: 'Quick Bounce',
      platforms: [
        { x: 0, y: 455, width: 45, height: 20 },
        { x: 70, y: 435, width: 25, height: 20, trampoline: true },
        { x: 130, y: 415, width: 25, height: 20, trampoline: true },
        { x: 190, y: 395, width: 25, height: 20, trampoline: true },
        { x: 250, y: 375, width: 25, height: 20, trampoline: true },
        { x: 400, y: 150, width: 50, height: 20 },
        { x: 520, y: 375, width: 25, height: 20, trampoline: true },
        { x: 580, y: 395, width: 25, height: 20, trampoline: true },
        { x: 640, y: 415, width: 25, height: 20, trampoline: true },
        { x: 700, y: 435, width: 25, height: 20, trampoline: true },
        { x: 755, y: 120, width: 45, height: 20 },
      ],
      startPos: { x: 18, y: 405 },
      goalArea: { x: 755, y: 70, width: 45, height: 50 }
    },
    40: {
      name: 'Ultimate Bounce',
      platforms: [
        { x: 0, y: 470, width: 50, height: 20 },
        { x: 80, y: 455, width: 30, height: 20, trampoline: true },
        { x: 150, y: 340, width: 25, height: 20 },
        { x: 215, y: 440, width: 30, height: 20, trampoline: true },
        { x: 285, y: 260, width: 25, height: 20 },
        { x: 350, y: 425, width: 30, height: 20, trampoline: true },
        { x: 420, y: 200, width: 25, height: 20 },
        { x: 485, y: 410, width: 30, height: 20, trampoline: true },
        { x: 555, y: 160, width: 25, height: 20 },
        { x: 620, y: 395, width: 30, height: 20, trampoline: true },
        { x: 690, y: 140, width: 25, height: 20 },
        { x: 755, y: 380, width: 30, height: 20, trampoline: true },
        { x: 790, y: 100, width: 10, height: 20 },
      ],
      startPos: { x: 20, y: 420 },
      goalArea: { x: 790, y: 50, width: 10, height: 50 }
    },
    41: {
      name: 'Triple Spring',
      platforms: [
        { x: 0, y: 460, width: 50, height: 20 },
        { x: 80, y: 445, width: 25, height: 20, trampoline: true },
        { x: 140, y: 430, width: 25, height: 20, trampoline: true },
        { x: 200, y: 415, width: 25, height: 20, trampoline: true },
        { x: 350, y: 120, width: 40, height: 20 },
        { x: 480, y: 415, width: 25, height: 20, trampoline: true },
        { x: 540, y: 430, width: 25, height: 20, trampoline: true },
        { x: 600, y: 445, width: 25, height: 20, trampoline: true },
        { x: 720, y: 100, width: 80, height: 20 },
      ],
      startPos: { x: 20, y: 410 },
      goalArea: { x: 720, y: 50, width: 80, height: 50 }
    },
    42: {
      name: 'Diagonal Bounce',
      platforms: [
        { x: 0, y: 470, width: 45, height: 20 },
        { x: 70, y: 440, width: 25, height: 20, trampoline: true },
        { x: 135, y: 330, width: 25, height: 20 },
        { x: 200, y: 410, width: 25, height: 20, trampoline: true },
        { x: 265, y: 260, width: 25, height: 20 },
        { x: 330, y: 380, width: 25, height: 20, trampoline: true },
        { x: 395, y: 200, width: 25, height: 20 },
        { x: 460, y: 350, width: 25, height: 20, trampoline: true },
        { x: 525, y: 160, width: 25, height: 20 },
        { x: 590, y: 320, width: 25, height: 20, trampoline: true },
        { x: 655, y: 140, width: 25, height: 20 },
        { x: 720, y: 290, width: 25, height: 20, trampoline: true },
        { x: 775, y: 100, width: 25, height: 20 },
      ],
      startPos: { x: 18, y: 420 },
      goalArea: { x: 775, y: 50, width: 25, height: 50 }
    },
    43: {
      name: 'Mega Bounce',
      platforms: [
        { x: 0, y: 465, width: 50, height: 20 },
        { x: 90, y: 460, width: 40, height: 20, trampoline: true },
        { x: 400, y: 40, width: 60, height: 20 },
        { x: 670, y: 460, width: 40, height: 20, trampoline: true },
        { x: 760, y: 60, width: 40, height: 20 },
      ],
      startPos: { x: 20, y: 415 },
      goalArea: { x: 760, y: 10, width: 40, height: 50 }
    },
    44: {
      name: 'Weave Bounce',
      platforms: [
        { x: 0, y: 455, width: 45, height: 20 },
        { x: 70, y: 430, width: 25, height: 20, trampoline: true },
        { x: 135, y: 350, width: 25, height: 20 },
        { x: 200, y: 280, width: 25, height: 20 },
        { x: 265, y: 420, width: 25, height: 20, trampoline: true },
        { x: 330, y: 240, width: 25, height: 20 },
        { x: 395, y: 330, width: 25, height: 20 },
        { x: 460, y: 410, width: 25, height: 20, trampoline: true },
        { x: 525, y: 210, width: 25, height: 20 },
        { x: 590, y: 310, width: 25, height: 20 },
        { x: 655, y: 400, width: 25, height: 20, trampoline: true },
        { x: 720, y: 190, width: 25, height: 20 },
        { x: 770, y: 100, width: 30, height: 20 },
      ],
      startPos: { x: 18, y: 405 },
      goalArea: { x: 770, y: 50, width: 30, height: 50 }
    },
    45: {
      name: 'Insane Bounce',
      platforms: [
        { x: 0, y: 470, width: 45, height: 20 },
        { x: 70, y: 450, width: 25, height: 20, trampoline: true },
        { x: 135, y: 430, width: 25, height: 20, trampoline: true },
        { x: 200, y: 410, width: 25, height: 20, trampoline: true },
        { x: 265, y: 390, width: 25, height: 20, trampoline: true },
        { x: 330, y: 370, width: 25, height: 20, trampoline: true },
        { x: 480, y: 80, width: 40, height: 20 },
        { x: 600, y: 370, width: 25, height: 20, trampoline: true },
        { x: 665, y: 390, width: 25, height: 20, trampoline: true },
        { x: 730, y: 410, width: 25, height: 20, trampoline: true },
        { x: 795, y: 430, width: 25, height: 20, trampoline: true },
        { x: 860, y: 450, width: 25, height: 20, trampoline: true },
        { x: 750, y: 60, width: 50, height: 20 },
      ],
      startPos: { x: 18, y: 420 },
      goalArea: { x: 750, y: 10, width: 50, height: 50 }
    },
    46: {
      name: 'Chaos Theory',
      platforms: [
        { x: 0, y: 460, width: 40, height: 20 },
        { x: 60, y: 440, width: 20, height: 20, trampoline: true },
        { x: 115, y: 380, width: 20, height: 20 },
        { x: 170, y: 430, width: 20, height: 20, trampoline: true },
        { x: 225, y: 300, width: 20, height: 20 },
        { x: 280, y: 420, width: 20, height: 20, trampoline: true },
        { x: 335, y: 240, width: 20, height: 20 },
        { x: 390, y: 350, width: 20, height: 20 },
        { x: 445, y: 410, width: 20, height: 20, trampoline: true },
        { x: 500, y: 200, width: 20, height: 20 },
        { x: 555, y: 320, width: 20, height: 20 },
        { x: 610, y: 400, width: 20, height: 20, trampoline: true },
        { x: 665, y: 170, width: 20, height: 20 },
        { x: 720, y: 280, width: 20, height: 20 },
        { x: 775, y: 390, width: 20, height: 20, trampoline: true },
        { x: 795, y: 120, width: 5, height: 20 },
      ],
      startPos: { x: 16, y: 410 },
      goalArea: { x: 795, y: 70, width: 5, height: 50 }
    },
    47: {
      name: 'Spring Loaded',
      platforms: [
        { x: 0, y: 465, width: 45, height: 20 },
        { x: 70, y: 445, width: 25, height: 20, trampoline: true },
        { x: 135, y: 300, width: 20, height: 20 },
        { x: 195, y: 200, width: 20, height: 20 },
        { x: 255, y: 435, width: 25, height: 20, trampoline: true },
        { x: 320, y: 160, width: 20, height: 20 },
        { x: 380, y: 260, width: 20, height: 20 },
        { x: 440, y: 425, width: 25, height: 20, trampoline: true },
        { x: 505, y: 140, width: 20, height: 20 },
        { x: 565, y: 240, width: 20, height: 20 },
        { x: 625, y: 415, width: 25, height: 20, trampoline: true },
        { x: 690, y: 130, width: 20, height: 20 },
        { x: 750, y: 220, width: 20, height: 20 },
        { x: 785, y: 90, width: 15, height: 20 },
      ],
      startPos: { x: 18, y: 415 },
      goalArea: { x: 785, y: 40, width: 15, height: 50 }
    },
    48: {
      name: 'Final Test',
      platforms: [
        { x: 0, y: 470, width: 40, height: 20 },
        { x: 60, y: 450, width: 20, height: 20, trampoline: true },
        { x: 115, y: 430, width: 20, height: 20, trampoline: true },
        { x: 170, y: 410, width: 20, height: 20, trampoline: true },
        { x: 300, y: 180, width: 30, height: 20 },
        { x: 400, y: 300, width: 20, height: 20 },
        { x: 500, y: 410, width: 20, height: 20, trampoline: true },
        { x: 555, y: 430, width: 20, height: 20, trampoline: true },
        { x: 610, y: 450, width: 20, height: 20, trampoline: true },
        { x: 740, y: 150, width: 30, height: 20 },
        { x: 790, y: 80, width: 10, height: 20 },
      ],
      startPos: { x: 16, y: 420 },
      goalArea: { x: 790, y: 30, width: 10, height: 50 }
    },
    49: {
      name: 'Endurance',
      platforms: [
        { x: 0, y: 465, width: 40, height: 20 },
        { x: 60, y: 445, width: 20, height: 20, trampoline: true },
        { x: 115, y: 360, width: 18, height: 20 },
        { x: 168, y: 280, width: 18, height: 20 },
        { x: 221, y: 430, width: 20, height: 20, trampoline: true },
        { x: 276, y: 220, width: 18, height: 20 },
        { x: 329, y: 320, width: 18, height: 20 },
        { x: 382, y: 415, width: 20, height: 20, trampoline: true },
        { x: 437, y: 180, width: 18, height: 20 },
        { x: 490, y: 290, width: 18, height: 20 },
        { x: 543, y: 400, width: 20, height: 20, trampoline: true },
        { x: 598, y: 150, width: 18, height: 20 },
        { x: 651, y: 260, width: 18, height: 20 },
        { x: 704, y: 385, width: 20, height: 20, trampoline: true },
        { x: 759, y: 130, width: 18, height: 20 },
        { x: 795, y: 70, width: 5, height: 20 },
      ],
      startPos: { x: 16, y: 415 },
      goalArea: { x: 795, y: 20, width: 5, height: 50 }
    },
    50: {
      name: 'CHAMPION!',
      platforms: [
        { x: 0, y: 470, width: 35, height: 20 },
        { x: 55, y: 450, width: 18, height: 20, trampoline: true },
        { x: 105, y: 430, width: 18, height: 20, trampoline: true },
        { x: 155, y: 410, width: 18, height: 20, trampoline: true },
        { x: 205, y: 390, width: 18, height: 20, trampoline: true },
        { x: 350, y: 120, width: 25, height: 20 },
        { x: 450, y: 230, width: 15, height: 20 },
        { x: 530, y: 390, width: 18, height: 20, trampoline: true },
        { x: 580, y: 410, width: 18, height: 20, trampoline: true },
        { x: 630, y: 430, width: 18, height: 20, trampoline: true },
        { x: 680, y: 450, width: 18, height: 20, trampoline: true },
        { x: 750, y: 170, width: 20, height: 20 },
        { x: 792, y: 60, width: 8, height: 20 },
      ],
      startPos: { x: 14, y: 420 },
      goalArea: { x: 792, y: 10, width: 8, height: 50 }
    }
  };

  const maxLevel = Object.keys(levels).length;
  const currentLevel = levels[level];

  // When the player completes the final level, briefly celebrate then return to Games.
  useEffect(() => {
    if (!gameWon) return;
    if (level !== maxLevel) return;
    const timeoutId = setTimeout(() => {
      onBack();
    }, 2500);
    return () => clearTimeout(timeoutId);
  }, [gameWon, level, maxLevel, onBack]);

  // Reset player position when level changes
  useEffect(() => {
    if (gameStarted && !gameWon) {
      setPlayerPos(currentLevel.startPos);
      setPlayerVelocity({ x: 0, y: 0 });
      setIsJumping(false);
      isJumpingRef.current = false;
      setOnGround(false);
      onGroundRef.current = false;
    }
  }, [level, gameStarted, gameWon]);

  const startGame = () => {
    keysPressed.current = {}; // Clear all pressed keys
    setPlayerPos(currentLevel.startPos);
    setPlayerVelocity({ x: 0, y: 0 });
    setIsJumping(false);
    isJumpingRef.current = false;
    setOnGround(false);
    onGroundRef.current = false;
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
    isJumpingRef.current = false;
    setOnGround(false);
    onGroundRef.current = false;
    setGameLost(false);
  };

  // Shared jump function for both keyboard and touch
  const performJump = useCallback(() => {
    // Simple check: only jump if on ground
    if (onGroundRef.current) {
      // Check if jumping from a trampoline
      const jumpStrength = (currentPlatformRef.current && currentPlatformRef.current.trampoline) 
        ? TRAMPOLINE_BOUNCE 
        : JUMP_STRENGTH;
      setPlayerVelocity(v => ({ ...v, y: jumpStrength }));
      setIsJumping(true);
      isJumpingRef.current = true;
      onGroundRef.current = false;
      setOnGround(false);
      currentPlatformRef.current = null; // Clear platform reference when jumping
    }
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Enter key should work for both Start Level and Next Level screens.
      if (e.key === 'Enter' && !e.repeat) {
        if (!gameStarted && !gameWon && !gameLost) {
          e.preventDefault();
          startGame();
          return;
        }

        if (gameWon) {
          e.preventDefault();
          if (level >= maxLevel) {
            onBack();
          } else {
            nextLevel();
          }
          return;
        }

        if (gameLost) {
          e.preventDefault();
          resetLevel();
          return;
        }

        // Do nothing with Enter during active play or on loss screen.
        return;
      }

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
        // Only apply gravity if player is not on ground - use ref for immediate state
        let newVelY = onGroundRef.current ? 0 : prevVel.y + GRAVITY;
        
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

          // Platform collision detection - update refs immediately
          let landed = false;
          for (const platform of currentLevel.platforms) {
            // Check if player is on platform (falling OR standing still)
            if (
              newVelY >= 0 &&
              prevPos.y + PLAYER_SIZE <= platform.y &&
              newY + PLAYER_SIZE >= platform.y &&
              newX + PLAYER_SIZE > platform.x &&
              newX < platform.x + platform.width
            ) {
              newY = platform.y - PLAYER_SIZE;
              newVelY = 0; // Stop vertical movement
              landed = true;
              
              // Update refs IMMEDIATELY for instant jump availability
              onGroundRef.current = true;
              isJumpingRef.current = false;
              currentPlatformRef.current = platform; // Remember which platform we're on
              setOnGround(true);
              setIsJumping(false);
              break;
            }
          }

          if (!landed && onGroundRef.current) {
            // Update refs IMMEDIATELY when leaving ground
            onGroundRef.current = false;
            currentPlatformRef.current = null;
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
      WebkitTouchCallout: 'none',
      flexShrink: 0,
      minWidth: 'fit-content'
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
      height: '100vh',
      display: 'flex',
      flexDirection: isLandscape ? 'row' : 'column',
      alignItems: 'center',
      justifyContent: isLandscape ? 'space-evenly' : 'center',
      padding: isLandscape ? '5px' : '10px',
      boxSizing: 'border-box',
      background: '#f9fafb',
      gap: isLandscape ? '5px' : '10px',
      overflow: 'hidden'
    }}>
      {/* Left controls (landscape only) */}
      {isLandscape && gameStarted && !gameWon && !gameLost && <TouchControls />}

      {/* Game area */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: isLandscape ? '4px' : '8px',
        maxWidth: '100%',
        overflow: 'visible',
        flexShrink: 1,
        minWidth: 0
      }}>
        <div style={{
          fontSize: `${Math.max(14, 20 * scale)}px`,
          fontWeight: 700,
          color: '#1f2937',
          textAlign: 'center',
          whiteSpace: 'nowrap'
        }}>
          Level {level}: {currentLevel.name}
        </div>

        <div style={{
          position: 'relative',
          width: GAME_WIDTH,
          height: GAME_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          background: 'linear-gradient(180deg, #bfdbfe 0%, #dbeafe 100%)',
          border: isLandscape ? '2px solid #1f2937' : '4px solid #1f2937',
          borderRadius: isLandscape ? '4px' : '8px',
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
              background: platform.trampoline ? '#10b981' : '#78350f',
              border: platform.trampoline ? '2px solid #059669' : '2px solid #451a03',
              borderRadius: '4px',
              boxShadow: platform.trampoline ? '0 0 8px rgba(16, 185, 129, 0.5)' : 'none'
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
              {level < maxLevel ? (
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
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  alignItems: 'center',
                  textAlign: 'center',
                  color: '#1f2937'
                }}>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>
                    You beat all the levels!
                  </div>
                  <div style={{ fontSize: '16px', color: '#6b7280', fontWeight: 600 }}>
                    More levels are coming soon.
                  </div>
                </div>
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
            marginTop: '8px',
            padding: `${Math.max(6, 10 * scale)}px ${Math.max(16, 24 * scale)}px`,
            fontSize: `${Math.max(12, 16 * scale)}px`,
            fontWeight: 600,
            background: '#6b7280',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          whiteSpace: 'nowrap'
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
