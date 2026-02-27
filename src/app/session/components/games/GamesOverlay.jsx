'use client';
import { useState } from 'react';
import MemoryMatch from './MemoryMatch';
import Snake from './Snake';
import CatchCollect from './CatchCollect';
import MazeRunner from './MazeRunner';
import WhackAMole from './WhackAMole';
import PlatformJumper from './PlatformJumper';
import FloodClimbSpelling from './FloodClimbSpelling';
import FlashCards from './FlashCards';

export default function GamesOverlay({ onClose, playTimer }) {
  const [selectedGame, setSelectedGame] = useState(null);

  const gamesList = [
    {
      id: 'memory-match',
      name: 'Memory Match',
      description: 'Find matching pairs of cards',
      icon: '🎴',
      color: '#10b981',
    },
    {
      id: 'snake',
      name: 'Snake',
      description: 'Eat food and grow longer!',
      icon: '🐍',
      color: '#8b5cf6',
    },
    {
      id: 'catch-collect',
      name: 'Catch & Collect',
      description: 'Catch falling items with your basket!',
      icon: '🧺',
      color: '#f59e0b',
    },
    {
      id: 'maze-runner',
      name: 'Maze Runner',
      description: 'Navigate through the maze to the flag!',
      icon: '🏁',
      color: '#ef4444',
    },
    {
      id: 'whack-a-mole',
      name: 'Whack-a-Mole',
      description: 'Click the moles before they hide!',
      icon: '🦫',
      color: '#06b6d4',
    },
    {
      id: 'platform-jumper',
      name: 'Platform Jumper',
      description: 'Jump across platforms to reach the trophy!',
      icon: '🏆',
      color: '#ec4899',
    },
    {
      id: 'flood-climb',
      name: 'Flood Climb',
      description: 'Spell the emoji word to climb to safety!',
      icon: '🌊',
      color: '#3b82f6',
    },
    {
      id: 'flash-cards',
      name: 'Flash Cards',
      description: 'Answer cards to level up stages',
      icon: '🃏',
      color: '#111827',
    },
    // Future games will go here
  ];

  // Game selection menu
  if (!selectedGame) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          zIndex: 20000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 16,
            maxWidth: 600,
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            position: 'relative',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Play timer in upper left */}
          {playTimer && (
            <div
              style={{
                position: 'absolute',
                top: 16,
                left: 16,
                zIndex: 10001,
              }}
            >
              {playTimer}
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              width: 40,
              height: 40,
              fontSize: 20,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
            }}
          >
            ✕
          </button>

          {/* Header */}
          <div
            style={{
              padding: '24px 24px 16px',
              borderBottom: '2px solid #e5e7eb',
              textAlign: 'center',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 800,
                color: '#1f2937',
              }}
            >
              🎮 Choose a Game
            </h2>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 16,
                color: '#6b7280',
              }}
            >
              Pick a game to play as your reward!
            </p>
          </div>

          {/* Games list */}
          <div
            style={{
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {gamesList.map((game) => (
              <button
                key={game.id}
                onClick={() => setSelectedGame(game.id)}
                style={{
                  background: '#f9fafb',
                  border: `2px solid ${game.color}`,
                  borderRadius: 12,
                  padding: 20,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                }}
              >
                <div
                  style={{
                    fontSize: 48,
                    lineHeight: 1,
                  }}
                >
                  {game.icon}
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: '#1f2937',
                      marginBottom: 4,
                    }}
                  >
                    {game.name}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: '#6b7280',
                    }}
                  >
                    {game.description}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 24,
                    color: game.color,
                    fontWeight: 700,
                  }}
                >
                  ▶
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Active game screen
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#fff',
        zIndex: 20000,
        overflow: 'auto',
      }}
    >
      {/* Play timer in upper left */}
      {playTimer && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: 16,
            zIndex: 10001,
          }}
        >
          {playTimer}
        </div>
      )}

      {/* Render the selected game */}
      {selectedGame === 'memory-match' && (
        <MemoryMatch onExit={() => setSelectedGame(null)} />
      )}
      {selectedGame === 'snake' && (
        <Snake onExit={() => setSelectedGame(null)} />
      )}
      {selectedGame === 'catch-collect' && (
        <CatchCollect onBack={() => setSelectedGame(null)} />
      )}
      {selectedGame === 'maze-runner' && (
        <MazeRunner onBack={() => setSelectedGame(null)} />
      )}
      {selectedGame === 'whack-a-mole' && (
        <WhackAMole onBack={() => setSelectedGame(null)} />
      )}
      {selectedGame === 'platform-jumper' && (
        <PlatformJumper onBack={() => setSelectedGame(null)} />
      )}
      {selectedGame === 'flood-climb' && (
        <FloodClimbSpelling onBack={() => setSelectedGame(null)} />
      )}
      {selectedGame === 'flash-cards' && (
        <FlashCards onBack={() => setSelectedGame(null)} />
      )}
    </div>
  );
}
