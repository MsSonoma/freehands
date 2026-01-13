"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const MAX_LEVEL = 20;

const LEVEL_OPTIONS = Array.from({ length: MAX_LEVEL }, (_, i) => ({ level: i + 1 }));

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAnswer(value) {
  return (value || '').toString().toLowerCase().trim().replace(/\s+/g, ' ');
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleArray(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function scrambleWord(word) {
  const raw = (word || '').toString();
  const letters = raw.replace(/[^a-zA-Z]/g, '').toLowerCase().split('');
  if (letters.length <= 1) return raw.toLowerCase();

  const target = letters.join('');
  for (let tries = 0; tries < 12; tries += 1) {
    const candidate = shuffleArray(letters).join('');
    if (candidate !== target) return candidate;
  }

  // Fall back to the original if it won't change (e.g., all same letter).
  return target;
}

function scrambleAnswer(answer) {
  const normalized = (answer || '').toString().trim();
  if (!normalized) return '';
  return normalized
    .split(/\s+/)
    .map((w) => scrambleWord(w))
    .join(' ');
}

function buildDecks() {
  const level1 = [
    { emoji: '🐮', answer: 'cow' },
    { emoji: '🐶', answer: 'dog' },
    { emoji: '🐱', answer: 'cat' },
    { emoji: '🐷', answer: 'pig' },
    { emoji: '🦊', answer: 'fox' },
    { emoji: '🐝', answer: 'bee' },
    { emoji: '🐜', answer: 'ant' },
    { emoji: '☀️', answer: 'sun' },
    { emoji: '🌙', answer: 'moon' },
    { emoji: '⭐', answer: 'star' },
    { emoji: '🍎', answer: 'apple' },
    { emoji: '🚗', answer: 'car' },
    { emoji: '🚌', answer: 'bus' },
    { emoji: '📚', answer: 'book' },
    { emoji: '✏️', answer: 'pencil' },
    { emoji: '🏠', answer: 'house' },
  ];

  const level2 = [
    { emoji: '🐸', answer: 'frog' },
    { emoji: '🐟', answer: 'fish' },
    { emoji: '🍞', answer: 'bread' },
    { emoji: '🥛', answer: 'milk' },
    { emoji: '✏️', answer: 'pencil' },
    { emoji: '🏠', answer: 'house' },
    { emoji: '🧃', answer: 'juice' },
    { emoji: '🚲', answer: 'bicycle' },
    { emoji: '🧠', answer: 'brain' },
    { emoji: '🧩', answer: 'puzzle' },
    { emoji: '🧪', answer: 'science' },
    { emoji: '🧊', answer: 'ice' },
    { emoji: '⚡', answer: 'lightning' },
  ];

  const level3 = [
    { emoji: '🧁', answer: 'cupcake' },
    { emoji: '🥪', answer: 'sandwich' },
    { emoji: '🏔️', answer: 'mountain' },
    { emoji: '🌋', answer: 'volcano' },
    { emoji: '🪐', answer: 'planet' },
    { emoji: '📖', answer: 'reading' },
    { emoji: '🦋', answer: 'butterfly' },
    { emoji: '🐢', answer: 'turtle' },
    { emoji: '🦒', answer: 'giraffe' },
  ];

  const level4 = [
    { emoji: '🧭', answer: 'compass' },
    { emoji: '🔬', answer: 'microscope' },
    { emoji: '📜', answer: 'history' },
    { emoji: '🛰️', answer: 'satellite' },
    { emoji: '🌡️', answer: 'temperature' },
    { emoji: '🧮', answer: 'calculator' },
    { emoji: '🗺️', answer: 'geography' },
    { emoji: '🧵', answer: 'thread' },
    { emoji: '🎭', answer: 'theater' },
    { emoji: '🏛️', answer: 'museum' },
    { emoji: '🌊', answer: 'ocean' },
    { emoji: '🌪️', answer: 'tornado' },
    { emoji: '🧱', answer: 'building' },
  ];

  const level5 = [
    { emoji: '⚖️', answer: 'justice' },
    { emoji: '🧾', answer: 'receipt' },
    { emoji: '📈', answer: 'analysis' },
    { emoji: '🧑‍💻', answer: 'programming' },
    { emoji: '🧠', answer: 'cognition' },
    { emoji: '🧪', answer: 'chemistry' },
    { emoji: '🛰️', answer: 'telemetry' },
    { emoji: '🧬', answer: 'molecular' },
    { emoji: '📚', answer: 'literature' },
    { emoji: '🌎', answer: 'environment' },
    { emoji: '🧬', answer: 'genetics' },
  ];

  return {
    level1,
    level2,
    level3,
    level4,
    level5,
  };
}

function pickDeckKeyForLevel(levelNum) {
  if (levelNum <= 4) return 'level1';
  if (levelNum <= 8) return 'level2';
  if (levelNum <= 12) return 'level3';
  if (levelNum <= 16) return 'level4';
  return 'level5';
}

function getParamsForLevel(levelNum) {
  const t = clampNumber((levelNum - 1) / (MAX_LEVEL - 1), 0, 1);

  const startDelayMs = Math.round(1500 - 650 * t);
  const waterRisePerSec = 1.2 + 1.9 * t;
  const climbPerCorrect = clampNumber(8 - Math.floor((levelNum - 1) / 4), 4, 8);
  const wrongPenalty = clampNumber(6 + Math.floor((levelNum - 1) / 2), 6, 16);
  const topGoal = clampNumber(10 - Math.floor((levelNum - 1) / 5), 5, 10);

  return {
    startDelayMs,
    waterRisePerSec,
    climbPerCorrect,
    wrongPenalty,
    topGoal,
    loseGap: 2,
  };
}

function getLevelNumber(levelValue) {
  const raw = (levelValue ?? '').toString().trim();
  if (!raw) return null;
  const match = raw.match(/\d+/);
  if (!match) return null;
  return parseInt(match[0], 10);
}

function getConfig(levelValue) {
  const levelNum = getLevelNumber(levelValue);
  if (levelNum === null) return null;

  const safeLevel = clampNumber(levelNum, 1, MAX_LEVEL);

  const decks = buildDecks();
  const deckKey = pickDeckKeyForLevel(safeLevel);
  const deck = decks[deckKey];
  if (!deck?.length) return null;

  return {
    level: safeLevel,
    deckKey,
    ...getParamsForLevel(safeLevel),
    deck,
  };
}

export default function FloodClimbSpelling({ onBack }) {
  const [level, setLevel] = useState('1');
  const [gameStarted, setGameStarted] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [gameLost, setGameLost] = useState(false);

  const START_CLIMBER_HEIGHT = 86; // 0=top, 100=bottom
  const CLIMBER_HEAD_OFFSET = 4; // percent above center; lose when water reaches head

  const [climberHeight, setClimberHeight] = useState(START_CLIMBER_HEIGHT);
  const [waterHeight, setWaterHeight] = useState(98);

  const [prompt, setPrompt] = useState(null);
  const [scrambled, setScrambled] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [statusText, setStatusText] = useState('');

  const inputRef = useRef(null);
  const tickRef = useRef(null);
  const lastTickMsRef = useRef(0);
  const gameStartMsRef = useRef(0);
  const autoStartRequestedRef = useRef(false);

  const config = useMemo(() => getConfig(level), [level]);

  const refocusInputIfPlayable = useCallback(() => {
    if (!gameStarted) return;
    if (gameWon || gameLost) return;
    setTimeout(() => inputRef.current?.focus?.(), 0);
  }, [gameLost, gameStarted, gameWon]);

  const pickNextPrompt = useCallback(() => {
    if (!config?.deck?.length) return;
    const next = pickRandom(config.deck);
    setPrompt(next);
    setScrambled(scrambleAnswer(next.answer));
    setAttempts(0);
    setInput('');
    setStatusText('');
    setTimeout(() => inputRef.current?.focus?.(), 0);
  }, [config]);

  const resetAll = useCallback(() => {
    setGameStarted(false);
    setGameWon(false);
    setGameLost(false);
    setClimberHeight(START_CLIMBER_HEIGHT);
    setWaterHeight(98);
    setPrompt(null);
    setScrambled('');
    setAttempts(0);
    setInput('');
    setScore(0);
    setStreak(0);
    setStatusText('');
  }, [START_CLIMBER_HEIGHT]);

  const startGame = useCallback(() => {
    if (!config) {
      setStatusText('');
      return;
    }

    setGameStarted(true);
    setGameWon(false);
    setGameLost(false);
    setClimberHeight(START_CLIMBER_HEIGHT);
    setWaterHeight(98);
    setStreak(0);
    setAttempts(0);
    setScrambled('');
    setStatusText('');

    gameStartMsRef.current = performance.now();

    setTimeout(() => {
      pickNextPrompt();
      inputRef.current?.focus?.();
    }, 0);
  }, [config, pickNextPrompt, START_CLIMBER_HEIGHT]);

  const startNextLevel = useCallback(() => {
    const current = getLevelNumber(level);
    if (current === null) {
      setStatusText('');
      return;
    }

    const next = Math.min(MAX_LEVEL, current + 1);
    if (next === current) {
      setStatusText('You beat the final level!');
      return;
    }

    autoStartRequestedRef.current = true;
    setLevel(String(next));
    setGameStarted(false);
    setGameWon(false);
    setGameLost(false);
    setStatusText('');
  }, [level]);

  useEffect(() => {
    if (!autoStartRequestedRef.current) return;
    if (!config) return;
    autoStartRequestedRef.current = false;
    startGame();
  }, [config, startGame]);

  // Water rising loop
  useEffect(() => {
    if (!gameStarted || gameWon || gameLost) return;
    if (!config) return;

    lastTickMsRef.current = performance.now();

    tickRef.current = setInterval(() => {
      const now = performance.now();
      const dt = Math.max(0, now - lastTickMsRef.current);
      lastTickMsRef.current = now;

      const elapsed = now - gameStartMsRef.current;
      if (elapsed < (config.startDelayMs || 0)) return;

      const perMs = config.waterRisePerSec / 1000;
      const rise = perMs * dt;

      setWaterHeight((prev) => {
        const next = prev - rise; // water height is "from top"; smaller means higher
        return Math.max(0, Math.min(99, next));
      });
    }, 100);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [gameStarted, gameWon, gameLost, config]);

  // Win/lose detection
  useEffect(() => {
    if (!gameStarted || gameWon || gameLost) return;
    if (!config) return;

    // Lose if water catches climber (water is higher when value is smaller)
    const climberY = climberHeight;
    const waterY = waterHeight;
    const waterIsAtOrAboveHead = waterY <= (climberY - CLIMBER_HEAD_OFFSET);

    if (waterIsAtOrAboveHead) {
      setGameLost(true);
      setStatusText('Oh no! The water caught you.');
      return;
    }

    // Win if climber reaches the top zone
    if (climberY <= config.topGoal) {
      setGameWon(true);
      setStatusText('You made it! Great spelling.');
    }
  }, [gameStarted, gameWon, gameLost, climberHeight, waterHeight, config, CLIMBER_HEAD_OFFSET]);

  const submit = useCallback(() => {
    if (!gameStarted || gameWon || gameLost) return;
    if (!prompt || !config) return;

    const typed = normalizeAnswer(input);
    const correct = normalizeAnswer(prompt.answer);

    if (!typed) {
      setStatusText('Type the word to climb.');
      return;
    }

    if (typed === correct) {
      setAttempts(0);
      setScore((s) => s + 1);
      setStreak((prevStreak) => {
        const nextStreak = prevStreak + 1;
        const streakBonus = nextStreak >= 6 ? 1 : 0;
        setClimberHeight((h) => Math.max(0, h - config.climbPerCorrect - streakBonus));
        return nextStreak;
      });
      setStatusText('Nice! Keep going.');

      setTimeout(() => {
        pickNextPrompt();
      }, 150);
      return;
    }

    // Wrong
    setAttempts((a) => a + 1);
    setStreak(0);

    setWaterHeight((w) => Math.max(0, w - config.wrongPenalty));

    const nextAttempts = attempts + 1;
    if (nextAttempts >= 3) {
      const first = normalizeAnswer(prompt.answer).slice(0, 1);
      setStatusText(`Try again. Hint: starts with "${first}".`);
    } else {
      setStatusText('Try again.');
    }

    setTimeout(() => inputRef.current?.focus?.(), 0);
  }, [attempts, config, gameLost, gameStarted, gameWon, input, pickNextPrompt, prompt]);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  }, [submit]);

  const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #e0f2fe 0%, #bae6fd 40%, #fef3c7 100%)',
    padding: 16,
    boxSizing: 'border-box',
  };

  const cardStyle = {
    maxWidth: 900,
    margin: '0 auto',
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.18)',
    overflow: 'hidden',
    border: '2px solid #e5e7eb',
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderBottom: '2px solid #e5e7eb',
    background: '#f9fafb',
  };

  const buttonStyle = {
    left: '8%',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  };

  const smallButton = {
    ...buttonStyle,
    background: '#374151',
    padding: '9px 12px',
    fontWeight: 800,
  };

  const stageStyle = {
    position: 'relative',
    height: 420,
    background: 'linear-gradient(180deg, #f3f4f6 0%, #e5e7eb 100%)',
    borderTop: '2px solid #e5e7eb',
    borderBottom: '2px solid #e5e7eb',
    overflow: 'hidden',
    isolation: 'isolate',
  };

  const mountainStyle = {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    background:
      'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.9), rgba(255,255,255,0) 45%),' +
      'radial-gradient(circle at 70% 35%, rgba(255,255,255,0.7), rgba(255,255,255,0) 45%),' +
      'linear-gradient(180deg, #f3f4f6 0%, #e5e7eb 100%)',
  };

  const rockWallStyle = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '6%',
    zIndex: 2,
    backgroundImage: "url('/media/flood-climb-rockwall.svg?v=2026-01-13T03:35:15Z')",
    backgroundRepeat: 'no-repeat',
    backgroundSize: '100% 100%',
    backgroundPosition: 'center',
    backgroundColor: '#d7dee6',
    borderRight: '2px solid rgba(148,163,184,0.70)',
    boxShadow: 'inset -4px 0 8px rgba(15,23,42,0.04)',
  };

  const waterStyle = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: `${waterHeight}%`,
    bottom: 0,
    zIndex: 3,
    background: 'linear-gradient(180deg, rgba(59,130,246,0.75) 0%, rgba(37,99,235,0.95) 100%)',
  };

  const waterTop = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 24,
    background: 'rgba(255,255,255,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
  };

  const climberStyle = {
    position: 'absolute',
    left: '6%',
    top: `${climberHeight}%`,
    zIndex: 2,
    transform: 'translate(-50%, -50%)',
    fontSize: 44,
    filter: 'drop-shadow(0 10px 12px rgba(0,0,0,0.25))',
  };

  const flagStyle = {
    position: 'absolute',
    left: '6%',
    top: '6%',
    zIndex: 6,
    transform: 'translate(-100%, -50%)',
    fontSize: 36,
  };

  const skyPromptStyle = {
    position: 'absolute',
    top: 12,
    left: '8%',
    right: 12,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '10px 12px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.88)',
    border: '2px solid rgba(17,24,39,0.22)',
    boxShadow: '0 10px 28px rgba(0,0,0,0.14)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    transform: 'translateZ(0)',
  };

  const skyPromptEmojiStyle = {
    fontSize: 64,
    lineHeight: 1,
    filter: 'drop-shadow(0 10px 12px rgba(0,0,0,0.16))',
  };

  const skyPromptTextStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  };

  const skyPromptLettersStyle = {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 22,
    fontWeight: 900,
    color: '#111827',
    letterSpacing: 1,
    wordBreak: 'break-word',
  };

  const skyEndStyle = {
    ...skyPromptStyle,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
  };

  const skyEndButtonsStyle = {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  };

  const skyHowToStyle = {
    ...skyPromptStyle,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  };


  const promptCard = {
    padding: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  };

  const inputStyle = {
    width: 360,
    height: 40,
    borderRadius: 10,
    border: '2px solid #e5e7eb',
    padding: '0 12px',
    fontSize: 16,
    fontWeight: 800,
    outline: 'none',
  };

  const gradeSelectStyle = {
    height: 40,
    borderRadius: 10,
    border: '2px solid #e5e7eb',
    padding: '0 10px',
    fontSize: 14,
    fontWeight: 800,
    background: '#fff',
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <button type="button" onClick={onBack} style={{ ...buttonStyle, background: '#ef4444' }}>
            ← Back
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#111827' }}>🌊 Flood Climb</div>
            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>
              Spell the word to climb before the water rises.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#111827' }}>Score: {score}</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#111827' }}>Streak: {streak}</div>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                resetAll();
                refocusInputIfPlayable();
              }}
              style={smallButton}
            >
              Reset
            </button>
          </div>
        </div>

        <div style={stageStyle}>
          <div style={mountainStyle} />
          <div style={rockWallStyle} />
          <div style={flagStyle}>🏁</div>

          {!gameStarted && (
            <div style={skyHowToStyle}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#111827' }}>How to play</div>
              <div style={{ color: '#374151', fontSize: 13, fontWeight: 800, lineHeight: 1.35 }}>
                <div>1) Look at the emoji.</div>
                <div>2) Type the word and press Enter.</div>
                <div>3) Right = climb. Wrong = water jumps up.</div>
              </div>
            </div>
          )}

          {gameStarted && !gameWon && !gameLost && (
            <div style={skyPromptStyle}>
              <div style={skyPromptEmojiStyle}>{prompt?.emoji || '❓'}</div>
              <div style={skyPromptTextStyle}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#111827' }}>Type the word</div>
                <div style={{ fontSize: 12, color: '#374151', fontWeight: 800 }}>
                  Letters: <span style={skyPromptLettersStyle}>{scrambled || '...'}</span>
                </div>
              </div>
            </div>
          )}

          {(gameWon || gameLost) && (
            <div style={skyEndStyle}>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#111827' }}>
                {gameWon ? '🏁 You reached the top!' : '🌊 Game over'}
              </div>
              <div style={{ color: '#374151', fontSize: 14, fontWeight: 700 }}>{statusText}</div>
              <div style={skyEndButtonsStyle}>
                <button type="button" onClick={startGame} style={{ ...buttonStyle, background: '#10b981' }}>
                  Play Again
                </button>
                {gameWon ? (
                  <button type="button" onClick={startNextLevel} style={smallButton}>
                    Next Level
                  </button>
                ) : (
                  <button type="button" onClick={() => setGameStarted(false)} style={smallButton}>
                    Change Level
                  </button>
                )}
              </div>
            </div>
          )}

          <div style={waterStyle}>
            <div style={waterTop}>🌊 🌊 🌊</div>
          </div>

          <div style={climberStyle}>🧗</div>
        </div>

        {!gameStarted && (
          <div style={{ padding: 18 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                style={gradeSelectStyle}
                aria-label="Level"
              >
                {LEVEL_OPTIONS.map((c) => (
                  <option key={c.level} value={String(c.level)}>
                    Level {c.level}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={startGame}
                style={{
                  ...buttonStyle,
                  background: '#10b981',
                  cursor: 'pointer',
                }}
              >
                Start
              </button>
            </div>

            {statusText && (
              <div style={{ marginTop: 12, fontSize: 14, fontWeight: 900, color: '#b45309' }}>{statusText}</div>
            )}
          </div>
        )}

        {gameStarted && (
          <div style={promptCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                style={inputStyle}
                placeholder="Type your answer and press Enter."
                disabled={gameWon || gameLost}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  submit();
                  refocusInputIfPlayable();
                }}
                style={{
                  ...buttonStyle,
                  background: '#3b82f6',
                }}
                disabled={gameWon || gameLost}
              >
                Submit
              </button>
            </div>
          </div>
        )}

        {gameStarted && !gameWon && !gameLost && statusText && (
          <div style={{ padding: '0 18px 18px', color: '#b45309', fontWeight: 900 }}>{statusText}</div>
        )}
      </div>
    </div>
  );
}
