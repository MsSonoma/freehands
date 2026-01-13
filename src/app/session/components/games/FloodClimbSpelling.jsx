"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

function normalizeAnswer(value) {
  return (value || '').toString().toLowerCase().trim().replace(/\s+/g, ' ');
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildDecks() {
  const early = [
    { emoji: '🐮', answer: 'cow' },
    { emoji: '🐶', answer: 'dog' },
    { emoji: '🐱', answer: 'cat' },
    { emoji: '🐷', answer: 'pig' },
    { emoji: '🐸', answer: 'frog' },
    { emoji: '🦊', answer: 'fox' },
    { emoji: '🐟', answer: 'fish' },
    { emoji: '🐝', answer: 'bee' },
    { emoji: '🐜', answer: 'ant' },
    { emoji: '☀️', answer: 'sun' },
    { emoji: '🌙', answer: 'moon' },
    { emoji: '⭐', answer: 'star' },
    { emoji: '🍎', answer: 'apple' },
    { emoji: '🍞', answer: 'bread' },
    { emoji: '🥛', answer: 'milk' },
    { emoji: '🚗', answer: 'car' },
    { emoji: '🚌', answer: 'bus' },
    { emoji: '📚', answer: 'book' },
    { emoji: '✏️', answer: 'pencil' },
    { emoji: '🏠', answer: 'house' },
  ];

  const upperElem = [
    { emoji: '🧃', answer: 'juice' },
    { emoji: '🧁', answer: 'cupcake' },
    { emoji: '🥪', answer: 'sandwich' },
    { emoji: '🚲', answer: 'bicycle' },
    { emoji: '🧠', answer: 'brain' },
    { emoji: '🧩', answer: 'puzzle' },
    { emoji: '🏔️', answer: 'mountain' },
    { emoji: '🌋', answer: 'volcano' },
    { emoji: '🪐', answer: 'planet' },
    { emoji: '📖', answer: 'reading' },
    { emoji: '🧪', answer: 'science' },
    { emoji: '🦋', answer: 'butterfly' },
    { emoji: '🐢', answer: 'turtle' },
    { emoji: '🦒', answer: 'giraffe' },
    { emoji: '🧊', answer: 'ice' },
    { emoji: '⚡', answer: 'lightning' },
  ];

  const middle = [
    { emoji: '🧭', answer: 'compass' },
    { emoji: '🔬', answer: 'microscope' },
    { emoji: '🧬', answer: 'genetics' },
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

  const high = [
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
  ];

  return {
    early,
    upperElem,
    middle,
    high,
  };
}

function getGradeNumber(gradeLevel) {
  const g = (gradeLevel || '').toString().trim().toLowerCase();
  if (!g) return null;
  if (g === 'k') return 0;
  const match = g.match(/\d+/);
  if (!match) return null;
  return parseInt(match[0], 10);
}

function getConfig(gradeLevel) {
  const gnum = getGradeNumber(gradeLevel);
  if (gnum === null) return null;

  const decks = buildDecks();

  if (gnum <= 2) {
    return {
      label: 'Early',
      waterRisePerSec: 6,
      climbPerCorrect: 12,
      wrongPenalty: 10,
      topGoal: 10,
      loseGap: 2,
      deck: decks.early,
    };
  }

  if (gnum <= 5) {
    return {
      label: 'Upper Elementary',
      waterRisePerSec: 8,
      climbPerCorrect: 10,
      wrongPenalty: 12,
      topGoal: 8,
      loseGap: 2,
      deck: [...decks.early, ...decks.upperElem],
    };
  }

  if (gnum <= 8) {
    return {
      label: 'Middle School',
      waterRisePerSec: 10,
      climbPerCorrect: 9,
      wrongPenalty: 14,
      topGoal: 6,
      loseGap: 2,
      deck: [...decks.upperElem, ...decks.middle],
    };
  }

  return {
    label: 'High School',
    waterRisePerSec: 12,
    climbPerCorrect: 8,
    wrongPenalty: 16,
    topGoal: 5,
    loseGap: 2,
    deck: [...decks.middle, ...decks.high],
  };
}

export default function FloodClimbSpelling({ onBack }) {
  const [gradeLevel, setGradeLevel] = useState('');
  const [gameStarted, setGameStarted] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [gameLost, setGameLost] = useState(false);

  const [climberHeight, setClimberHeight] = useState(90); // 0=top, 100=bottom
  const [waterHeight, setWaterHeight] = useState(96);

  const [prompt, setPrompt] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [statusText, setStatusText] = useState('');

  const inputRef = useRef(null);
  const tickRef = useRef(null);
  const lastTickMsRef = useRef(0);

  const config = useMemo(() => getConfig(gradeLevel), [gradeLevel]);

  const pickNextPrompt = useCallback(() => {
    if (!config?.deck?.length) return;
    const next = pickRandom(config.deck);
    setPrompt(next);
    setAttempts(0);
    setInput('');
    setStatusText('');
    setTimeout(() => inputRef.current?.focus?.(), 0);
  }, [config]);

  const resetAll = useCallback(() => {
    setGameStarted(false);
    setGameWon(false);
    setGameLost(false);
    setClimberHeight(90);
    setWaterHeight(96);
    setPrompt(null);
    setAttempts(0);
    setInput('');
    setScore(0);
    setStreak(0);
    setStatusText('');
  }, []);

  const startGame = useCallback(() => {
    if (!config) {
      setStatusText('Pick a grade level to start.');
      return;
    }

    setGameStarted(true);
    setGameWon(false);
    setGameLost(false);
    setClimberHeight(90);
    setWaterHeight(96);
    setScore(0);
    setStreak(0);
    setAttempts(0);
    setStatusText('');

    setTimeout(() => {
      pickNextPrompt();
      inputRef.current?.focus?.();
    }, 0);
  }, [config, pickNextPrompt]);

  // Water rising loop
  useEffect(() => {
    if (!gameStarted || gameWon || gameLost) return;
    if (!config) return;

    lastTickMsRef.current = performance.now();

    tickRef.current = setInterval(() => {
      const now = performance.now();
      const dt = Math.max(0, now - lastTickMsRef.current);
      lastTickMsRef.current = now;

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
    const waterIsAtOrAboveClimber = waterY <= (climberY + config.loseGap);

    if (waterIsAtOrAboveClimber) {
      setGameLost(true);
      setStatusText('Oh no! The water caught you.');
      return;
    }

    // Win if climber reaches the top zone
    if (climberY <= config.topGoal) {
      setGameWon(true);
      setStatusText('You made it! Great spelling.');
    }
  }, [gameStarted, gameWon, gameLost, climberHeight, waterHeight, config]);

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
      setStreak((st) => st + 1);

      setClimberHeight((h) => Math.max(0, h - config.climbPerCorrect - (streak >= 4 ? 2 : 0)));
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
  }, [attempts, config, gameLost, gameStarted, gameWon, input, pickNextPrompt, prompt, streak]);

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
    background: '#111827',
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
  };

  const mountainStyle = {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.9), rgba(255,255,255,0) 45%),' +
      'radial-gradient(circle at 70% 35%, rgba(255,255,255,0.7), rgba(255,255,255,0) 45%),' +
      'linear-gradient(180deg, #f3f4f6 0%, #e5e7eb 100%)',
  };

  const waterStyle = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: `${waterHeight}%`,
    bottom: 0,
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
    left: '65%',
    top: `${climberHeight}%`,
    transform: 'translate(-50%, -50%)',
    fontSize: 44,
    filter: 'drop-shadow(0 10px 12px rgba(0,0,0,0.25))',
  };

  const flagStyle = {
    position: 'absolute',
    left: '70%',
    top: '6%',
    transform: 'translate(-50%, -50%)',
    fontSize: 36,
  };

  const promptCard = {
    padding: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  };

  const inputStyle = {
    width: 260,
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
            <button type="button" onClick={resetAll} style={smallButton}>
              Reset
            </button>
          </div>
        </div>

        <div style={stageStyle}>
          <div style={mountainStyle} />
          <div style={flagStyle}>🏁</div>

          <div style={waterStyle}>
            <div style={waterTop}>🌊 🌊 🌊</div>
          </div>

          <div style={climberStyle}>🧗</div>
        </div>

        {!gameStarted && (
          <div style={{ padding: 18 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#111827' }}>Grade</div>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                style={gradeSelectStyle}
                aria-label="Grade"
              >
                <option value="">Select grade</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={startGame}
                disabled={!config}
                style={{
                  ...buttonStyle,
                  background: config ? '#10b981' : '#9ca3af',
                  cursor: config ? 'pointer' : 'not-allowed',
                }}
              >
                Start
              </button>
            </div>

            <div style={{ marginTop: 12, color: '#374151', fontSize: 14, lineHeight: 1.35 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>How to play</div>
              <div>1) Look at the emoji.</div>
              <div>2) Type the word and press Enter.</div>
              <div>3) Right = climb. Wrong = water jumps up.</div>
            </div>

            {statusText && (
              <div style={{ marginTop: 12, fontSize: 14, fontWeight: 900, color: '#b45309' }}>{statusText}</div>
            )}
          </div>
        )}

        {gameStarted && (
          <div style={promptCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 46, lineHeight: 1 }}>{prompt?.emoji || '❓'}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#111827' }}>Type the word</div>
                <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>
                  Press Enter to submit.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                style={inputStyle}
                placeholder="type here"
                disabled={gameWon || gameLost}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={submit}
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

        {(gameWon || gameLost) && (
          <div style={{ padding: 18, borderTop: '2px solid #e5e7eb', background: '#f9fafb' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#111827' }}>
              {gameWon ? '🏁 You reached the top!' : '🌊 Game over'}
            </div>
            <div style={{ marginTop: 6, color: '#374151', fontSize: 14, fontWeight: 700 }}>{statusText}</div>
            <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={startGame} style={{ ...buttonStyle, background: '#10b981' }}>
                Play Again
              </button>
              <button type="button" onClick={() => setGameStarted(false)} style={smallButton}>
                Change Grade
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
