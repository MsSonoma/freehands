import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { lessonMusicTrackSrc, PLAY_TIMER_MUSIC_SRC, switchLessonMusicTrack } from './lessonMusic.mjs';

test('play timers choose the shared play track and work timers restore the lesson track', () => {
  for (const defaultSrc of ['/media/Quietly%20Curious.wav', '/media/Almost%20There.wav']) {
    assert.equal(lessonMusicTrackSrc(defaultSrc, false), defaultSrc);
    assert.equal(lessonMusicTrackSrc(defaultSrc, true), PLAY_TIMER_MUSIC_SRC);
    assert.equal(lessonMusicTrackSrc(defaultSrc, false), defaultSrc);
  }
});

function fakeAudio() {
  const calls = [];
  const audio = {
    src: '/media/default.wav',
    loop: false,
    preload: 'none',
    volume: 0,
    pause() { calls.push('pause'); },
    load() { calls.push('load'); },
    play() { calls.push('play'); return Promise.resolve(); },
  };
  return { audio, calls };
}

test('switch pauses old track before playing new track with saved volume', () => {
  const { audio, calls } = fakeAudio();
  switchLessonMusicTrack(audio, PLAY_TIMER_MUSIC_SRC, { volume: 0.27 });
  assert.deepEqual(calls, ['pause', 'load', 'play']);
  assert.equal(audio.src, PLAY_TIMER_MUSIC_SRC);
  assert.equal(audio.volume, 0.27);
  assert.equal(audio.loop, true);
  assert.equal(audio.preload, 'auto');
});

test('muted tracks remain stopped when switching between play and work', () => {
  const { audio, calls } = fakeAudio();
  switchLessonMusicTrack(audio, '/media/default.wav', { muted: true });
  assert.deepEqual(calls, ['pause', 'load']);
  assert.equal(audio.src, '/media/default.wav');
});

test('autoplay rejection does not break timer music selection', async () => {
  const { audio } = fakeAudio();
  audio.play = () => Promise.reject(new Error('autoplay blocked'));
  switchLessonMusicTrack(audio, PLAY_TIMER_MUSIC_SRC);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(audio.src, PLAY_TIMER_MUSIC_SRC);
});

test('both lesson music controls follow their own timer mode', () => {
  const sonoma = fs.readFileSync(new URL('../components/SonomaBackgroundMusicControl.jsx', import.meta.url), 'utf8');
  const webb = fs.readFileSync(new URL('../webb/WebbBackgroundMusicControl.jsx', import.meta.url), 'utf8');
  const session = fs.readFileSync(new URL('../v2/SessionPageV2.jsx', import.meta.url), 'utf8');
  const webbSession = fs.readFileSync(new URL('../webb/page.jsx', import.meta.url), 'utf8');
  for (const control of [sonoma, webb]) {
    assert.match(control, /lessonMusicTrackSrc\(TRACK_SRC, playTimerActive\)/);
    assert.match(control, /switchLessonMusicTrack\(audio, trackSrc/);
  }
  assert.match(session, /SonomaBackgroundMusicControl playTimerActive=\{currentTimerMode\[getCurrentPhaseName\(\)\] === 'play'\}/);
  assert.match(webbSession, /WebbBackgroundMusicControl compact=\{keyboardCompact\} playTimerActive=\{!!activePlayBreak\}/);
});
