'use client';
import { useState, useEffect, useCallback } from 'react';

const CARD_SETS = {
  easy: [
    { id: 1, content: '🌟', pair: 'a' },
    { id: 2, content: '🌟', pair: 'a' },
    { id: 3, content: '🎨', pair: 'b' },
    { id: 4, content: '🎨', pair: 'b' },
    { id: 5, content: '🎵', pair: 'c' },
    { id: 6, content: '🎵', pair: 'c' },
    { id: 7, content: '📚', pair: 'd' },
    { id: 8, content: '📚', pair: 'd' },
  ],
  medium: [
    { id: 1, content: '🌟', pair: 'a' },
    { id: 2, content: '🌟', pair: 'a' },
    { id: 3, content: '🎨', pair: 'b' },
    { id: 4, content: '🎨', pair: 'b' },
    { id: 5, content: '🎵', pair: 'c' },
    { id: 6, content: '🎵', pair: 'c' },
    { id: 7, content: '📚', pair: 'd' },
    { id: 8, content: '📚', pair: 'd' },
    { id: 9, content: '🌈', pair: 'e' },
    { id: 10, content: '🌈', pair: 'e' },
    { id: 11, content: '🎭', pair: 'f' },
    { id: 12, content: '🎭', pair: 'f' },
  ],
  hard: [
    { id: 1, content: '🌟', pair: 'a' },
    { id: 2, content: '🌟', pair: 'a' },
    { id: 3, content: '🎨', pair: 'b' },
    { id: 4, content: '🎨', pair: 'b' },
    { id: 5, content: '🎵', pair: 'c' },
    { id: 6, content: '🎵', pair: 'c' },
    { id: 7, content: '📚', pair: 'd' },
    { id: 8, content: '📚', pair: 'd' },
    { id: 9, content: '🌈', pair: 'e' },
    { id: 10, content: '🌈', pair: 'e' },
    { id: 11, content: '🎭', pair: 'f' },
    { id: 12, content: '🎭', pair: 'f' },
    { id: 13, content: '🎪', pair: 'g' },
    { id: 14, content: '🎪', pair: 'g' },
    { id: 15, content: '🎯', pair: 'h' },
    { id: 16, content: '🎯', pair: 'h' },
  ],
};

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function MemoryMatch({ onExit }) {
  const [difficulty, setDifficulty] = useState(null);
  const [cards, setCards] = useState([]);
  const [flippedCards, setFlippedCards] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState([]);
  const [moves, setMoves] = useState(0);
  const [gameWon, setGameWon] = useState(false);

  const startGame = useCallback((level) => {
    const cardSet = CARD_SETS[level];
    setCards(shuffleArray(cardSet));
    setFlippedCards([]);
    setMatchedPairs([]);
    setMoves(0);
    setGameWon(false);
    setDifficulty(level);
  }, []);

  const handleCardClick = useCallback((cardId) => {
    if (flippedCards.length === 2) return;
    if (flippedCards.includes(cardId)) return;
    if (matchedPairs.includes(cards.find(c => c.id === cardId)?.pair)) return;

    const newFlipped = [...flippedCards, cardId];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      const [first, second] = newFlipped.map(id => cards.find(c => c.id === id));
      
      if (first.pair === second.pair) {
        // Match found
        setTimeout(() => {
          setMatchedPairs(prev => [...prev, first.pair]);
          setFlippedCards([]);
        }, 500);
      } else {
        // No match
        setTimeout(() => {
          setFlippedCards([]);
        }, 1000);
      }
    }
  }, [flippedCards, cards, matchedPairs]);

  useEffect(() => {
    if (difficulty && matchedPairs.length === CARD_SETS[difficulty].length / 2) {
      setGameWon(true);
    }
  }, [matchedPairs, difficulty]);

  const resetGame = useCallback(() => {
    setDifficulty(null);
    setCards([]);
    setFlippedCards([]);
    setMatchedPairs([]);
    setMoves(0);
    setGameWon(false);
  }, []);

  // Difficulty selection screen
  if (!difficulty) {
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
        <h2 style={{ color: '#1f2937', fontSize: 28, fontWeight: 800, margin: 0 }}>
          Memory Match
        </h2>
        <p style={{ color: '#4b5563', fontSize: 16, margin: 0 }}>
          Choose a difficulty level:
        </p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => startGame('easy')}
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
            Easy (8 cards)
          </button>
          <button
            onClick={() => startGame('medium')}
            style={{
              background: '#f59e0b',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '16px 32px',
              fontSize: 18,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
            }}
          >
            Medium (12 cards)
          </button>
          <button
            onClick={() => startGame('hard')}
            style={{
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '16px 32px',
              fontSize: 18,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
            }}
          >
            Hard (16 cards)
          </button>
        </div>
        <button
          onClick={onExit}
          style={{
            marginTop: 20,
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

  // Game won screen
  if (gameWon) {
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
        <h2 style={{ color: '#10b981', fontSize: 32, fontWeight: 800, margin: 0 }}>
          🎉 You Won! 🎉
        </h2>
        <p style={{ color: '#1f2937', fontSize: 20, margin: 0 }}>
          Completed in {moves} moves!
        </p>
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

  // Active game screen
  const gridCols = difficulty === 'easy' ? 4 : 4;
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      height: '100%',
      padding: 20,
      gap: 20,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        maxWidth: 600,
      }}>
        <div style={{ color: '#1f2937', fontSize: 18, fontWeight: 700 }}>
          Moves: {moves}
        </div>
        <div style={{ color: '#1f2937', fontSize: 18, fontWeight: 700 }}>
          Pairs: {matchedPairs.length}/{cards.length / 2}
        </div>
        <button
          onClick={resetGame}
          style={{
            background: '#6b7280',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          New Game
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
        gap: 12,
        maxWidth: 600,
        width: '100%',
      }}>
        {cards.map((card) => {
          const isFlipped = flippedCards.includes(card.id);
          const isMatched = matchedPairs.includes(card.pair);
          const isVisible = isFlipped || isMatched;

          return (
            <button
              key={card.id}
              onClick={() => handleCardClick(card.id)}
              disabled={isMatched}
              style={{
                aspectRatio: '1',
                background: isVisible ? '#10b981' : '#c7442e',
                border: 'none',
                borderRadius: 12,
                fontSize: 40,
                cursor: isMatched ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isMatched 
                  ? '0 2px 8px rgba(16, 185, 129, 0.3)' 
                  : '0 4px 12px rgba(0, 0, 0, 0.15)',
                opacity: isMatched ? 0.6 : 1,
                transition: 'all 0.3s ease',
                transform: isFlipped ? 'rotateY(0deg)' : 'rotateY(0deg)',
              }}
            >
              {isVisible ? card.content : '?'}
            </button>
          );
        })}
      </div>
    </div>
  );
}
