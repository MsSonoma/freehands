'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FLASHCARD_SUBJECTS,
  MATH_FLASHCARD_TOPICS,
  makeMathDeck,
  isCorrectAnswer,
  pickNextTopicId,
  getTopicLabel,
} from './flashcardsMathDeck';
import {
  fetchFlashcardsProgressRemote,
  loadFlashcardsProgressLocal,
  saveFlashcardsProgressLocal,
  saveFlashcardsProgressRemote,
} from './flashcardsProgressStore';

const STAGES_TOTAL = 10;
const DECK_SIZE = 50;
const DEFAULT_GOAL = 10;

function getLearnerIdSafe() {
  try {
    return localStorage.getItem('learner_id') || 'anon';
  } catch {
    return 'anon';
  }
}

function clampStage(n) {
  const v = Math.max(1, Math.min(STAGES_TOTAL, Number(n) || 1));
  return v;
}

function getMeterDecayIntervalMs(stage) {
  const s = clampStage(stage);
  // Kept for compatibility if referenced elsewhere.
  // For smooth decay we now use a fixed tick interval (see decay effect).
  const start = 1800;
  const end = 700;
  const t = STAGES_TOTAL <= 1 ? 1 : (s - 1) / (STAGES_TOTAL - 1);
  return Math.round(start + (end - start) * t);
}

function getMeterDecayPerSecond(stage) {
  const s = clampStage(stage);
  // Slow early, faster later, but still beatable.
  // Stage 1 drains ~10 points in ~250s; Stage 10 drains ~10 points in ~100s.
  // (Equivalently: ~25s/point at Stage 1 → ~10s/point at Stage 10)
  const start = 10 / 250;
  const end = 10 / 100;
  const t = STAGES_TOTAL <= 1 ? 1 : (s - 1) / (STAGES_TOTAL - 1);
  return start + (end - start) * t;
}

function getDefaultTopicId() {
  return MATH_FLASHCARD_TOPICS[0]?.id || 'addition';
}

function makeSeed(learnerId, subjectId, topicId, stage) {
  // Deterministic seed per (learner, subject, topic, stage)
  // Ensures decks are stable across sessions until stage changes.
  const s = `${learnerId}|${subjectId}|${topicId}|${stage}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export default function FlashCards({ onBack }) {
  const learnerId = useMemo(() => getLearnerIdSafe(), []);

  const [screen, setScreen] = useState('setup'); // setup | card | stage-complete | topic-complete

  const [subjectId, setSubjectId] = useState('math');
  const [topicId, setTopicId] = useState(getDefaultTopicId());
  const [stage, setStage] = useState(1);

  const [seed, setSeed] = useState(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [meter, setMeter] = useState(0);
  const [goal] = useState(DEFAULT_GOAL);

  const meterDecayIntervalRef = useRef(null);
  const meterRef = useRef(0);

  const [answer, setAnswer] = useState('');
  const inputRef = useRef(null);

  const [showParty, setShowParty] = useState(false);
  const partyTimerRef = useRef(null);

  const [cardAnim, setCardAnim] = useState('idle'); // idle | out | in
  const cardAnimTimersRef = useRef([]);

  const [pendingTopicComplete, setPendingTopicComplete] = useState(false);

  const [hydrationComplete, setHydrationComplete] = useState(false);
  const [remoteHydrationDone, setRemoteHydrationDone] = useState(false);
  const saveTimerRef = useRef(null);
  const lastSavedSigRef = useRef('');

  const clearCardAnimTimers = () => {
    try {
      const timers = Array.isArray(cardAnimTimersRef.current) ? cardAnimTimersRef.current : [];
      timers.forEach((t) => {
        try { clearTimeout(t); } catch {}
      });
    } catch {}
    cardAnimTimersRef.current = [];
  };

  const applyProgress = (saved) => {
    if (!saved || typeof saved !== 'object') return;

    try {
      if (saved.subjectId) setSubjectId(String(saved.subjectId));
      if (saved.topicId) setTopicId(String(saved.topicId));
      if (saved.stage) setStage(clampStage(saved.stage));
      if (saved.seed != null) setSeed(Number(saved.seed));
      if (saved.cardIndex != null) setCardIndex(Math.max(0, Number(saved.cardIndex) || 0));
      if (saved.meter != null) setMeter(Math.max(0, Number(saved.meter) || 0));
      if (saved.screen && typeof saved.screen === 'string') {
        const s = saved.screen;
        if (s === 'setup' || s === 'card' || s === 'stage-complete' || s === 'topic-complete') {
          setScreen(s);
        }
      }
      if (saved.pendingTopicComplete != null) {
        setPendingTopicComplete(!!saved.pendingTopicComplete);
      }
    } catch {
      // ignore
    }
  };

  // Hydrate from local + remote progress.
  // - Local is instant (works offline)
  // - Remote syncs progress across devices/browsers (when authenticated)
  useEffect(() => {
    let cancelled = false;
    setHydrationComplete(false);
    setRemoteHydrationDone(false);

    const local = loadFlashcardsProgressLocal(learnerId);
    if (local) applyProgress(local);

    // Allow local persistence after initial local hydration.
    // Remote persistence stays disabled until remote hydration completes.
    setHydrationComplete(true);

    (async () => {
      const remote = await fetchFlashcardsProgressRemote(learnerId);
      if (cancelled) return;

      // With takeover enforcing a single active session, we can keep this simple:
      // if remote progress exists, treat it as authoritative.
      if (remote && typeof remote === 'object') {
        applyProgress(remote);
        saveFlashcardsProgressLocal(learnerId, remote);
      }

      setRemoteHydrationDone(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [learnerId]);

  // Persist progress (local immediately; remote debounced)
  useEffect(() => {
    if (!hydrationComplete) return;

    const progressCore = {
      subjectId,
      topicId,
      stage,
      seed,
      cardIndex,
      meter,
      screen,
      pendingTopicComplete,
    };

    const progress = {
      ...progressCore,
      updatedAt: new Date().toISOString(),
    };

    saveFlashcardsProgressLocal(learnerId, progress);

    // Don't sync to server until we've checked remote state;
    // prevents overwriting cross-device progress with defaults/stale local.
    if (!remoteHydrationDone) return;

    const sig = JSON.stringify(progressCore);
    if (sig === lastSavedSigRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      lastSavedSigRef.current = sig;
      saveFlashcardsProgressRemote(learnerId, progress).catch(() => {});
    }, 800);
  }, [hydrationComplete, remoteHydrationDone, learnerId, subjectId, topicId, stage, seed, cardIndex, meter, screen, pendingTopicComplete]);

  // Clean up timers
  useEffect(() => {
    return () => {
      if (partyTimerRef.current) clearTimeout(partyTimerRef.current);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      clearCardAnimTimers();
      if (meterDecayIntervalRef.current) clearInterval(meterDecayIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    meterRef.current = Number(meter) || 0;
  }, [meter]);

  // Meter decay: gradually decreases over time; speeds up each stage.
  useEffect(() => {
    if (meterDecayIntervalRef.current) {
      try { clearInterval(meterDecayIntervalRef.current); } catch {}
      meterDecayIntervalRef.current = null;
    }

    if (screen !== 'card') return;
    const TICK_MS = 100;
    const perSecond = getMeterDecayPerSecond(stage);
    const perTick = perSecond * (TICK_MS / 1000);
    meterDecayIntervalRef.current = setInterval(() => {
      setMeter((m) => {
        const cur = Number(m) || 0;
        if (cur <= 0) return cur;
        return Math.max(0, cur - perTick);
      });
    }, TICK_MS);

    return () => {
      if (meterDecayIntervalRef.current) {
        try { clearInterval(meterDecayIntervalRef.current); } catch {}
        meterDecayIntervalRef.current = null;
      }
    };
  }, [screen, stage]);

  // If we leave the card screen mid-animation (e.g., stage complete), stop timers.
  useEffect(() => {
    if (screen === 'card') return;
    clearCardAnimTimers();
    setCardAnim('idle');
  }, [screen]);

  const deck = useMemo(() => {
    if (subjectId !== 'math') return [];
    const stageSafe = clampStage(stage);
    const seedValue = seed != null ? Number(seed) : makeSeed(learnerId, subjectId, topicId, stageSafe);
    return makeMathDeck({ topicId, stage: stageSafe, seed: seedValue, count: DECK_SIZE });
  }, [learnerId, subjectId, topicId, stage, seed]);

  const currentCard = deck.length ? deck[cardIndex % deck.length] : null;

  useEffect(() => {
    if (screen !== 'card') return;
    try {
      inputRef.current?.focus?.();
    } catch {}
  }, [screen, topicId, stage, cardIndex]);

  const startStage = () => {
    const stageSafe = clampStage(stage);
    const seedValue = makeSeed(learnerId, subjectId, topicId, stageSafe);
    setSeed(seedValue);
    setCardIndex(0);
    setMeter(0);
    setAnswer('');
    setPendingTopicComplete(false);
    setScreen('card');
  };

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (!currentCard) return;
    if (cardAnim === 'out') return;

    const ok = isCorrectAnswer({ expected: currentCard.answer, actual: answer });

    const before = Number(meterRef.current) || 0;
    const after = ok ? Math.min(goal, before + 1) : Math.max(0, before - 1);
    setMeter(after);

    if (ok) {
      setShowParty(true);
      if (partyTimerRef.current) clearTimeout(partyTimerRef.current);
      partyTimerRef.current = setTimeout(() => setShowParty(false), 700);
    } else {
      // meter already updated above
    }

    setAnswer('');

    // Slide card off, then advance and slide new card on.
    clearCardAnimTimers();
    setCardAnim('out');
    const OUT_MS = 150;
    const IN_MS = 170;
    cardAnimTimersRef.current.push(setTimeout(() => {
      setCardIndex((i) => (Number(i) || 0) + 1);
      setCardAnim('in');
      cardAnimTimersRef.current.push(setTimeout(() => {
        setCardAnim('idle');
      }, IN_MS));
    }, OUT_MS));

    // Stage completion triggers when meter hits goal.
    if (after >= goal - 1e-6) {
      const isLastStage = clampStage(stage) >= STAGES_TOTAL;
      setPendingTopicComplete(isLastStage);
      setScreen('stage-complete');
    }
  };

  const goNextStageOrTopic = () => {
    const nextStage = clampStage(stage) + 1;
    if (nextStage <= STAGES_TOTAL) {
      setStage(nextStage);
      startStage();
      return;
    }

    // End of topic stages: show topic completion screen (in addition to stage completion).
    setScreen('topic-complete');
  };

  const goNextTopic = () => {
    const nextTopicId = pickNextTopicId(topicId);
    if (!nextTopicId) {
      // No more topics yet: return to setup.
      setScreen('setup');
      return;
    }
    setTopicId(nextTopicId);
    setStage(1);
    setSeed(null);
    setCardIndex(0);
    setMeter(0);
    setAnswer('');
    setPendingTopicComplete(false);
    setScreen('card');

    // Ensure fresh deterministic deck for the new topic/stage
    queueMicrotask(() => {
      const seedValue = makeSeed(learnerId, subjectId, nextTopicId, 1);
      setSeed(seedValue);
    });
  };

  const topicLabel = getTopicLabel(topicId);
  const nextTopicId = pickNextTopicId(topicId);
  const nextTopicLabel = nextTopicId ? getTopicLabel(nextTopicId) : null;

  const frame = {
    padding: 24,
    maxWidth: 720,
    margin: '0 auto',
  };

  const headerRow = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  };

  const btn = {
    border: 'none',
    borderRadius: 12,
    padding: '10px 14px',
    background: '#111827',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
  };

  const softBtn = {
    ...btn,
    background: '#f3f4f6',
    color: '#111827',
    border: '2px solid #e5e7eb',
  };

  const select = {
    width: '100%',
    padding: '12px 12px',
    borderRadius: 12,
    border: '2px solid #e5e7eb',
    fontSize: 16,
    background: '#fff',
  };

  const label = {
    fontSize: 14,
    fontWeight: 800,
    color: '#374151',
    marginBottom: 6,
  };

  if (screen === 'setup') {
    return (
      <div style={frame}>
        <div style={headerRow}>
          <button type="button" style={softBtn} onClick={onBack}>← Back</button>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#111827' }}>Flash Cards</div>
          <div style={{ width: 90 }} />
        </div>

        <div style={{ background: '#fff', border: '2px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
          <div style={{ fontWeight: 900, fontSize: 20, color: '#111827', marginBottom: 8 }}>Choose your deck</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
            <div>
              <div style={label}>Subject</div>
              <select style={select} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                {FLASHCARD_SUBJECTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={label}>Topic</div>
              <select style={select} value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                {MATH_FLASHCARD_TOPICS.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={label}>Stage</div>
              <select style={select} value={stage} onChange={(e) => setStage(clampStage(e.target.value))}>
                {Array.from({ length: STAGES_TOTAL }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>Stage {i + 1}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              style={{ ...btn, width: '100%', padding: '14px 16px', fontSize: 18 }}
              onClick={startStage}
            >
              Go
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'stage-complete') {
    return (
      <div style={frame}>
        <div style={headerRow}>
          <button type="button" style={softBtn} onClick={onBack}>← Back</button>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#111827' }}>Flash Cards</div>
          <div style={{ width: 90 }} />
        </div>

        <div style={{ background: '#fff', border: '2px solid #e5e7eb', borderRadius: 16, padding: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🎉</div>
          <div style={{ fontWeight: 900, fontSize: 26, color: '#111827' }}>Stage {clampStage(stage)} complete!</div>
          <div style={{ marginTop: 8, fontSize: 16, color: '#4b5563' }}>{topicLabel}</div>

          <div style={{ marginTop: 18 }}>
            <button
              type="button"
              style={{ ...btn, width: '100%', padding: '14px 16px', fontSize: 18 }}
              onClick={() => {
                if (pendingTopicComplete) {
                  // In addition to stage completion, show topic completion screen next.
                  setScreen('topic-complete');
                } else {
                  goNextStageOrTopic();
                }
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'topic-complete') {
    return (
      <div style={frame}>
        <style>{`
          @keyframes flashcards-float {
            0% { transform: translateY(0); opacity: 0.9; }
            50% { transform: translateY(-14px); opacity: 1; }
            100% { transform: translateY(0); opacity: 0.9; }
          }
          @keyframes flashcards-slide {
            0% { transform: translateX(-20px); opacity: 0; }
            15% { opacity: 1; }
            50% { transform: translateX(0); opacity: 1; }
            85% { opacity: 1; }
            100% { transform: translateX(20px); opacity: 0; }
          }
        `}</style>

        <div style={headerRow}>
          <button type="button" style={softBtn} onClick={onBack}>← Back</button>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#111827' }}>Flash Cards</div>
          <div style={{ width: 90 }} />
        </div>

        <div
          style={{
            background: '#fff',
            border: '2px solid #e5e7eb',
            borderRadius: 16,
            padding: 18,
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: 14, left: 14, animation: 'flashcards-slide 1.2s ease-in-out infinite' }}>✨</div>
          <div style={{ position: 'absolute', top: 14, right: 14, animation: 'flashcards-slide 1.2s ease-in-out infinite reverse' }}>✨</div>

          <div style={{ fontSize: 52, marginBottom: 6, animation: 'flashcards-float 1.4s ease-in-out infinite' }}>🏁</div>
          <div style={{ fontWeight: 900, fontSize: 28, color: '#111827' }}>Topic complete!</div>
          <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800, color: '#111827' }}>{topicLabel}</div>

          <div style={{ marginTop: 16, padding: 12, borderRadius: 12, border: '2px solid #e5e7eb', color: '#374151' }}>
            {nextTopicLabel ? (
              <div>
                <div style={{ fontWeight: 900 }}>Next topic</div>
                <div style={{ marginTop: 6, fontSize: 16 }}>{nextTopicLabel}</div>
              </div>
            ) : (
              <div style={{ fontWeight: 900 }}>No more topics yet</div>
            )}
          </div>

          <div style={{ marginTop: 18 }}>
            <button
              type="button"
              style={{ ...btn, width: '100%', padding: '14px 16px', fontSize: 18 }}
              onClick={goNextTopic}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Card screen
  return (
    <div style={frame}>
      <style>{`
        @keyframes flashcards-party {
          0% { transform: translateX(-40px); opacity: 0; }
          20% { opacity: 1; }
          50% { transform: translateX(0); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(40px); opacity: 0; }
        }

        @keyframes flashcards-card-in {
          0% { transform: translateX(120%); opacity: 0.15; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes flashcards-card-out {
          0% { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(-120%); opacity: 0.15; }
        }
      `}</style>

      <div style={headerRow}>
        <button type="button" style={softBtn} onClick={onBack}>← Back</button>
        <div style={{ fontWeight: 900, fontSize: 18, color: '#111827' }}>Flash Cards</div>
        <button type="button" style={softBtn} onClick={() => setScreen('setup')}>Setup</button>
      </div>

      {/* Meter */}
      <div style={{ background: '#fff', border: '2px solid #e5e7eb', borderRadius: 16, padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 900, color: '#111827' }}>{topicLabel}</div>
          <div style={{ fontWeight: 900, color: '#111827' }}>Stage {clampStage(stage)} / {STAGES_TOTAL}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 14, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' }}>
            <div
              style={{
                width: `${(Math.max(0, Math.min(goal, meter)) / goal) * 100}%`,
                height: '100%',
                background: '#111827',
                transition: 'width 240ms linear',
              }}
            />
          </div>
          <div style={{ minWidth: 86, textAlign: 'right', fontWeight: 900, color: '#111827' }}>
            Goal {goal}
          </div>
        </div>
      </div>

      {/* Flash card */}
      <div style={{ background: '#fff', border: '2px solid #e5e7eb', borderRadius: 16, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              width: 'min(360px, 92vw)',
              height: 'min(520px, 62vh)',
              border: '2px solid #e5e7eb',
              borderRadius: 18,
              background: '#fff',
              position: 'relative',
              overflow: 'hidden',
              padding: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              animation:
                cardAnim === 'in'
                  ? 'flashcards-card-in 170ms ease-out'
                  : cardAnim === 'out'
                    ? 'flashcards-card-out 150ms ease-in forwards'
                    : 'none',
            }}
          >
            {showParty && (
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                  fontSize: 28,
                  animation: 'flashcards-party 0.7s ease-in-out',
                  pointerEvents: 'none',
                }}
              >
                🎉
              </div>
            )}

            <div style={{ fontSize: 38, fontWeight: 900, color: '#111827', lineHeight: 1.15 }}>
              {currentCard ? currentCard.prompt : 'Loading…'}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <input
            ref={inputRef}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer"
            style={{
              flex: 1,
              padding: '12px 12px',
              borderRadius: 12,
              border: '2px solid #e5e7eb',
              fontSize: 18,
            }}
          />
          <button type="submit" style={{ ...btn, padding: '12px 16px', fontSize: 16 }}>Send</button>
        </form>
      </div>
    </div>
  );
}
