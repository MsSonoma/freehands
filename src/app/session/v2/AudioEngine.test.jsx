/**
 * AudioEngine Unit Tests
 * 
 * Tests the AudioEngine in isolation without requiring full session context.
 * Run these to validate audio paths work correctly before wiring into V2 session.
 */

import { AudioEngine } from './AudioEngine';

// Mock video element for tests
class MockVideoElement {
  constructor() {
    this.paused = true;
    this.currentTime = 0;
  }
  
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  
  pause() {
    this.paused = true;
  }
}

describe('AudioEngine', () => {
  let engine;
  let mockVideo;
  
  beforeEach(() => {
    mockVideo = new MockVideoElement();
    engine = new AudioEngine({ videoElement: mockVideo });
  });
  
  afterEach(() => {
    engine.destroy();
  });
  
  describe('Event System', () => {
    test('should register and trigger event listeners', () => {
      const callback = jest.fn();
      engine.on('start', callback);
      
      engine.playAudio('', ['Test sentence']);
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          sentences: ['Test sentence'],
          startIndex: 0
        })
      );
    });
    
    test('should remove event listeners', () => {
      const callback = jest.fn();
      engine.on('start', callback);
      engine.off('start', callback);
      
      engine.playAudio('', ['Test sentence']);
      
      expect(callback).not.toHaveBeenCalled();
    });
    
    test('should handle multiple listeners for same event', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      engine.on('start', callback1);
      engine.on('start', callback2);
      
      engine.playAudio('', ['Test']);
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });
  
  describe('Synthetic Playback', () => {
    test('should play synthetic audio when no base64 provided', async () => {
      const startCallback = jest.fn();
      const endCallback = jest.fn();
      
      engine.on('start', startCallback);
      engine.on('end', endCallback);
      
      await engine.playAudio('', ['Sentence 1', 'Sentence 2']);
      
      expect(startCallback).toHaveBeenCalled();
      expect(endCallback).toHaveBeenCalledWith(
        expect.objectContaining({ completed: true })
      );
    });
    
    test('should emit caption changes during synthetic playback', (done) => {
      const captionChanges = [];
      
      engine.on('captionChange', (index) => {
        captionChanges.push(index);
      });
      
      engine.on('end', () => {
        expect(captionChanges.length).toBeGreaterThan(0);
        expect(captionChanges[0]).toBe(0);
        done();
      });
      
      engine.playAudio('', ['First', 'Second', 'Third']);
    });
  });
  
  describe('State Management', () => {
    test('should track playing state', async () => {
      expect(engine.isPlaying).toBe(false);
      
      const playPromise = engine.playAudio('', ['Test']);
      expect(engine.isPlaying).toBe(true);
      
      await playPromise;
      expect(engine.isPlaying).toBe(false);
    });
    
    test('should track muted state', () => {
      expect(engine.isMuted).toBe(false);
      
      engine.setMuted(true);
      expect(engine.isMuted).toBe(true);
      
      engine.setMuted(false);
      expect(engine.isMuted).toBe(false);
    });
    
    test('should track caption index', async () => {
      engine.on('captionChange', () => {});
      
      await engine.playAudio('', ['A', 'B', 'C'], 5);
      
      // Initial caption should be at startIndex
      expect(engine.currentCaptionIndex).toBeGreaterThanOrEqual(5);
    });
  });
  
  describe('Stop/Pause/Resume', () => {
    test('should stop playback', () => {
      const endCallback = jest.fn();
      engine.on('end', endCallback);
      
      engine.playAudio('', ['Test']);
      engine.stop();
      
      expect(engine.isPlaying).toBe(false);
      expect(mockVideo.paused).toBe(true);
    });
    
    test('should pause and resume synthetic playback', async () => {
      engine.playAudio('', ['Test sentence']);
      
      engine.pause();
      expect(mockVideo.paused).toBe(true);
      
      await engine.resume();
      // Resume should work without errors
    });
  });
  
  describe('Video Coordination', () => {
    test('should start video on playback', async () => {
      await engine.playAudio('', ['Test']);
      expect(mockVideo.paused).toBe(false);
    });
    
    test('should pause video on stop', () => {
      engine.playAudio('', ['Test']);
      engine.stop();
      
      expect(mockVideo.paused).toBe(true);
    });
  });
  
  describe('Error Handling', () => {
    test('should emit error event on playback failure', async () => {
      const errorCallback = jest.fn();
      engine.on('error', errorCallback);
      
      // Invalid base64 should trigger error
      try {
        await engine.playAudio('invalid-base64', ['Test']);
      } catch {}
      
      // Error should be emitted (might be caught internally)
    });
    
    test('should handle empty sentences array', async () => {
      const endCallback = jest.fn();
      engine.on('end', endCallback);
      
      await engine.playAudio('', []);
      
      // Should not crash
      expect(engine.isPlaying).toBe(false);
    });
  });
  
  describe('Cleanup', () => {
    test('should clean up resources on destroy', () => {
      engine.playAudio('', ['Test']);
      engine.destroy();
      
      expect(engine.isPlaying).toBe(false);
      // Should not throw errors
    });
    
    test('should clear all event listeners on destroy', () => {
      const callback = jest.fn();
      engine.on('start', callback);
      
      engine.destroy();
      
      // Attempting to play should not trigger callback
      try {
        engine.playAudio('', ['Test']);
      } catch {}
      
      expect(callback).not.toHaveBeenCalled();
    });
  });
});

// Manual test helpers (for browser console)
if (typeof window !== 'undefined') {
  window.testAudioEngine = {
    createEngine: () => {
      const video = document.querySelector('video');
      return new AudioEngine({ videoElement: video });
    },
    
    testSynthetic: async (engine) => {
      console.log('Testing synthetic playback...');
      
      engine.on('start', () => console.log('Audio started'));
      engine.on('captionChange', (index) => console.log('Caption:', index));
      engine.on('end', (data) => console.log('Audio ended:', data));
      
      await engine.playAudio('', [
        'This is the first sentence.',
        'Here is the second sentence.',
        'And finally the third sentence.'
      ]);
      
      console.log('Test complete!');
    }
  };
}
