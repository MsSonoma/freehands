import calmCatalog from './calm';
import funnyCatalog from './funny';
import hilariousCatalog from './hilarious';

export const HUMOR_LEVELS = ['calm', 'funny', 'hilarious'];
const SUBJECT_KEYS = ['math', 'science', 'language arts', 'social studies', 'general'];

const catalogsByHumor = {
  calm: calmCatalog,
  funny: funnyCatalog,
  hilarious: hilariousCatalog,
};

function normalizeSubject(subject) {
  const key = typeof subject === 'string' ? subject.trim().toLowerCase() : '';
  return SUBJECT_KEYS.includes(key) ? key : 'general';
}

export function normalizeHumorLevel(level) {
  const value = typeof level === 'string' ? level.trim().toLowerCase() : '';
  return HUMOR_LEVELS.includes(value) ? value : 'calm';
}

export function getHumorCatalog(level) {
  const normalized = normalizeHumorLevel(level);
  return catalogsByHumor[normalized] || catalogsByHumor.calm;
}

export function getPreferredHumorLevel() {
  if (typeof window === 'undefined') return 'calm';
  try {
    const learnerId = localStorage.getItem('learner_id');
    const candidates = [];
    if (learnerId) candidates.push(localStorage.getItem(`learner_humor_level_${learnerId}`));
    candidates.push(localStorage.getItem('learner_humor_level'));
    for (const candidate of candidates) {
      if (typeof candidate !== 'string') continue;
      const trimmed = candidate.trim().toLowerCase();
      if (HUMOR_LEVELS.includes(trimmed)) return trimmed;
    }
  } catch {}
  return 'calm';
}

export function renderJoke(joke) {
  try {
    return Array.isArray(joke?.lines) ? joke.lines.join('\n\n') : '';
  } catch {
    return '';
  }
}

export function getJokesForSubject(subject, options = {}) {
  const humorLevel = normalizeHumorLevel(options.humorLevel ?? getPreferredHumorLevel());
  const subjectKey = normalizeSubject(subject);
  const catalog = getHumorCatalog(humorLevel);
  return catalog[subjectKey] || [];
}

export function pickNextJoke(subject, options = {}) {
  const humorLevel = normalizeHumorLevel(options.humorLevel ?? getPreferredHumorLevel());
  const subjectKey = normalizeSubject(subject);
  const catalog = getHumorCatalog(humorLevel);
  const list = catalog[subjectKey] || [];
  if (!list.length) return null;
  if (typeof window === 'undefined') return list[0];
  try {
    const key = `joke_idx_${humorLevel}_${subjectKey.replace(/\s+/g, '_')}`;
    let idx = Number.parseInt(localStorage.getItem(key) || '', 10);
    if (!Number.isFinite(idx) || idx < 0 || idx >= list.length) {
      idx = Math.floor(Math.random() * list.length);
    } else {
      idx = (idx + 1) % list.length;
    }
    localStorage.setItem(key, String(idx));
    return list[idx];
  } catch {
    return list[Math.floor(Math.random() * list.length)];
  }
}

export default catalogsByHumor;
