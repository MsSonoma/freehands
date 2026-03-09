// Math flashcards deck generator (deterministic by seed)

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, minInclusive, maxInclusive) {
  const min = Math.ceil(minInclusive);
  const max = Math.floor(maxInclusive);
  return Math.floor(rng() * (max - min + 1)) + min;
}

function clampInt(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function stageRange(stage, ranges) {
  const idx = clampInt(Number(stage) || 1, 1, 10) - 1;
  return ranges[idx] ?? ranges[ranges.length - 1];
}

function makeAdditionCard(rng, stage) {
  const s = clampInt(Number(stage) || 1, 1, 10);
  // Value places: stages 1-3 → 1 place (0-9), 4-6 → 2 places (0-99), 7-10 → 3 places (0-999)
  const places = s <= 3 ? 1 : s <= 6 ? 2 : 3;
  const max = Math.pow(10, places) - 1;
  // Carry rules: no carry at stages 1-2, introduce at stage 3 (single-digit), none at 4-5, allow 6-10
  const allowCarry = s === 3 || s >= 6;

  if (allowCarry) {
    const a = randInt(rng, 0, max);
    const b = randInt(rng, 0, max);
    return { prompt: `${a} + ${b} = ?`, answer: String(a + b) };
  }

  // No carry: generate each digit column independently so digit_a + digit_b <= 9
  let a = 0, b = 0;
  for (let p = 0; p < places; p++) {
    const dA = randInt(rng, 0, 9);
    const dB = randInt(rng, 0, 9 - dA);
    a += dA * Math.pow(10, p);
    b += dB * Math.pow(10, p);
  }
  return { prompt: `${a} + ${b} = ?`, answer: String(a + b) };
}

function makeSubtractionCard(rng, stage) {
  const s = clampInt(Number(stage) || 1, 1, 10);
  // Value places: stages 1-3 → 1 place, 4-6 → 2 places, 7-10 → 3 places
  const places = s <= 3 ? 1 : s <= 6 ? 2 : 3;
  const max = Math.pow(10, places) - 1;
  // Borrow rules: no borrow at stages 1-5 (carry introduces at 3 for addition; borrow re-enters at 6 for subtraction)
  const allowBorrow = s >= 6;

  if (allowBorrow) {
    const a = randInt(rng, 0, max);
    const b = randInt(rng, 0, max);
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    return { prompt: `${hi} − ${lo} = ?`, answer: String(hi - lo) };
  }

  // No borrow: ensure each digit of hi >= corresponding digit of lo (column by column)
  let hi = 0, lo = 0;
  for (let p = 0; p < places; p++) {
    const hiD = randInt(rng, 0, 9);
    const loD = randInt(rng, 0, hiD);
    hi += hiD * Math.pow(10, p);
    lo += loD * Math.pow(10, p);
  }
  return { prompt: `${hi} − ${lo} = ?`, answer: String(hi - lo) };
}

function makeMultiplicationCard(rng, stage) {
  const [aMax, bMax] = stageRange(stage, [
    [5, 5],
    [10, 5],
    [10, 10],
    [12, 12],
    [15, 12],
    [20, 12],
    [25, 15],
    [50, 20],
    [100, 50],
    [250, 100],
  ]);
  const a = randInt(rng, 0, aMax);
  const b = randInt(rng, 0, bMax);
  return { prompt: `${a} × ${b} = ?`, answer: String(a * b) };
}

function makeDivisionCard(rng, stage) {
  const [divMax, quotMax] = stageRange(stage, [
    [5, 5],
    [10, 5],
    [12, 10],
    [15, 12],
    [20, 15],
    [25, 20],
    [50, 25],
    [100, 50],
    [200, 100],
    [500, 200],
  ]);
  const divisor = randInt(rng, 1, divMax);
  const quotient = randInt(rng, 0, quotMax);
  const dividend = divisor * quotient;
  return { prompt: `${dividend} ÷ ${divisor} = ?`, answer: String(quotient) };
}

function makePlaceValueCard(rng, stage) {
  const digits = stageRange(stage, [
    2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
  ]);
  const places = ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands', 'hundred-thousands'];
  const placeIndex = randInt(rng, 0, Math.min(digits - 1, places.length - 1));

  const nums = [];
  for (let i = 0; i < digits; i++) {
    nums.push(randInt(rng, 0, 9));
  }
  if (nums[0] === 0) nums[0] = randInt(rng, 1, 9);

  const n = Number(nums.join(''));
  const power = digits - 1 - placeIndex;
  const digit = nums[placeIndex];
  const value = digit * Math.pow(10, power);

  return {
    prompt: `In ${n.toLocaleString()}, what is the value of the ${digit} in the ${places[power]} place?`,
    answer: String(value),
  };
}

function makeDecimalAddSubCard(rng, stage, op) {
  const places = stageRange(stage, [
    1, 1, 1, 2, 2, 2, 2, 2, 2, 2,
  ]);
  const intMax = stageRange(stage, [
    9, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000,
  ]);

  const scale = Math.pow(10, places);
  const a = randInt(rng, 0, intMax * scale) / scale;
  const b = randInt(rng, 0, intMax * scale) / scale;
  if (op === '+') {
    const ans = (a + b).toFixed(places);
    return { prompt: `${a} + ${b} = ?`, answer: String(Number(ans)) };
  }
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  const ans = (hi - lo).toFixed(places);
  return { prompt: `${hi} − ${lo} = ?`, answer: String(Number(ans)) };
}

function makeFractionLikeDenCard(rng, stage) {
  const den = stageRange(stage, [
    2, 2, 3, 4, 4, 5, 6, 8, 10, 12,
  ]);
  const a = randInt(rng, 1, den - 1);
  const b = randInt(rng, 1, den - 1);
  const num = a + b;

  // Reduce
  const gcd = (x, y) => {
    let aa = Math.abs(x);
    let bb = Math.abs(y);
    while (bb) {
      const t = bb;
      bb = aa % bb;
      aa = t;
    }
    return aa || 1;
  };

  const g = gcd(num, den);
  const rn = num / g;
  const rd = den / g;

  return {
    prompt: `${a}/${den} + ${b}/${den} = ?  (answer as a fraction like 1/2)`,
    answer: `${rn}/${rd}`,
  };
}

export const FLASHCARD_SUBJECTS = [
  { id: 'math', label: 'Math' },
];

export const MATH_FLASHCARD_TOPICS = [
  { id: 'addition', label: 'Addition', makeCard: makeAdditionCard },
  { id: 'subtraction', label: 'Subtraction', makeCard: makeSubtractionCard },
  { id: 'multiplication', label: 'Multiplication', makeCard: makeMultiplicationCard },
  { id: 'division', label: 'Division', makeCard: makeDivisionCard },
  { id: 'place-value', label: 'Place Value', makeCard: makePlaceValueCard },
  { id: 'decimals-add', label: 'Decimals: Add', makeCard: (rng, stage) => makeDecimalAddSubCard(rng, stage, '+') },
  { id: 'decimals-sub', label: 'Decimals: Subtract', makeCard: (rng, stage) => makeDecimalAddSubCard(rng, stage, '-') },
  { id: 'fractions-add', label: 'Fractions: Add (like denominators)', makeCard: makeFractionLikeDenCard },
];

export function makeMathDeck({ topicId, stage, seed, count = 50 }) {
  const topic = MATH_FLASHCARD_TOPICS.find((t) => t.id === topicId) || MATH_FLASHCARD_TOPICS[0];
  const rng = mulberry32(Number(seed) || 1);
  const deck = [];
  for (let i = 0; i < count; i++) {
    deck.push({
      id: `${topic.id}:${stage}:${i}`,
      ...topic.makeCard(rng, stage),
    });
  }
  return deck;
}

export function normalizeAnswer(input) {
  return String(input ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[−–]/g, '-')
    .toLowerCase();
}

export function isCorrectAnswer({ expected, actual }) {
  const e = normalizeAnswer(expected);
  const a = normalizeAnswer(actual);
  if (!e || !a) return false;

  // fraction strict match (already reduced by generator)
  if (e.includes('/') || a.includes('/')) {
    return e === a;
  }

  // numeric compare
  const en = Number(e);
  const an = Number(a);
  if (Number.isFinite(en) && Number.isFinite(an)) {
    return Math.abs(en - an) < 1e-9;
  }

  return e === a;
}

export function pickNextTopicId(currentTopicId) {
  const idx = MATH_FLASHCARD_TOPICS.findIndex((t) => t.id === currentTopicId);
  if (idx < 0) return MATH_FLASHCARD_TOPICS[0]?.id || 'addition';
  return MATH_FLASHCARD_TOPICS[idx + 1]?.id || null;
}

export function getTopicLabel(topicId) {
  return MATH_FLASHCARD_TOPICS.find((t) => t.id === topicId)?.label || 'Math';
}
