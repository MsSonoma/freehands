// Batch-upgrade lesson JSON files to add lenient grading helpers.
// - Adds expectedAny arrays for common terms, or simple singular/plural variants
// - Adds keywords/minKeywords for short answers derived from the expected text
//
// Usage (from project root):
//   node scripts/leniency-upgrader.mjs
//
// Safe to run multiple times; it won't duplicate fields.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'public', 'lessons');

const SYNONYMS = Object.freeze({
  consumers: ["consumers", "consumer", "buyers", "customers"],
  producers: ["producers", "producer", "makers", "sellers"],
  budget: ["budget", "spending plan", "money plan"],
  savings: ["savings", "saving", "money saved"],
  barter: ["barter", "bartering", "trade without money"],
  currency: ["currency", "money"],
  exchange: ["exchange", "conversion", "convert"],
  bank: ["bank", "a bank", "the bank", "banks"],
  income: ["income", "earnings", "pay", "wages", "salary"],
  "price tag": ["price tag", "tag", "price label", "sticker"],
  people: ["people", "persons", "leaders", "important people"],
  counterfeit: ["counterfeit", "fake"],
  "central bank": ["central bank", "national bank", "the central bank", "federal reserve"],
  euro: ["euro", "the euro", "eur"],
  "$": ["$", "dollar sign", "$ sign"],
  resources: ["resources", "limited resources", "money and time"],
  consumer: ["consumer", "buyer", "customer"],
  producer: ["producer", "maker", "seller", "service provider"],
  market: ["market", "marketplace", "bazaar", "online shop"],
  "digital payments": ["digital payments", "electronic payments", "mobile payments", "e-payments", "apps"],
  // Science: Water Cycle & general
  evaporation: ["evaporation", "evaporate", "evaporating"],
  condensation: ["condensation", "condense", "condensing"],
  precipitation: ["precipitation", "rain", "snow", "hail", "sleet"],
  collection: ["collection", "accumulation", "gathering"],
  transpiration: ["transpiration", "plants releasing water", "plant sweat"],
  "water vapor": ["water vapor", "water vapour", "vapor", "vapour"],
  sun: ["sun", "sunlight", "sun's energy", "solar energy"],
  "water cycle": ["water cycle", "hydrologic cycle", "hydrological cycle"],
  evaporationg: ["evaporation", "evaporate"], // common misspell fix
  cloud: ["cloud", "clouds"],
  river: ["river", "stream"],
  ocean: ["ocean", "sea"],
  lake: ["lake", "pond"],
  // Social Studies
  taxes: ["taxes", "tax", "payments to government"],
  trade: ["trade", "exchange", "barter"],
  goods: ["goods", "products", "things"],
  services: ["services", "service"],
  money: ["money", "currency", "cash"],
  budgeted: ["budget", "spending plan"],
});

const STOPWORDS = new Set([
  'the','a','an','of','and','or','to','for','in','on','with','is','are','be','it','they','their','that','this','from','by','at','as','we','you','i'
]);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t && !STOPWORDS.has(t));
}

function keywordsFromExpected(expected) {
  const tokens = tokenize(expected);
  const uniq = Array.from(new Set(tokens));
  const top = uniq.slice(0, 6);
  const min = Math.max(1, Math.ceil(top.length * 0.5));
  return { keywords: top, minKeywords: min };
}

async function *walk(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(full);
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.json')) {
      yield full;
    }
  }
}

function ensureAnyOf(item) {
  if (!item) return false;
  // Determine the primary expected text (support various shapes)
  const expectedVal = typeof item.expected === 'string'
    ? item.expected
    : (typeof item.answer === 'string' ? item.answer : null);
  if (!expectedVal) return false;
  if (Array.isArray(item.expectedAny) && item.expectedAny.length) return false;
  const key = expectedVal.toLowerCase().trim();
  const dict = SYNONYMS[key];
  if (dict) {
    item.expectedAny = dict;
    return true;
  }
  const base = expectedVal.trim();
  const variants = new Set([base, base.toLowerCase()]);
  if (/s$/.test(base)) variants.add(base.slice(0, -1));
  else variants.add(base + 's');
  item.expectedAny = Array.from(variants);
  return true;
}

function ensureShortAnswerRubric(item) {
  if (!item || typeof item.expected !== 'string') return false;
  const has = Array.isArray(item.keywords) && item.keywords.length && Number.isInteger(item.minKeywords);
  if (has) return false;
  const { keywords, minKeywords } = keywordsFromExpected(item.expected);
  item.keywords = keywords;
  item.minKeywords = minKeywords;
  return true;
}

async function processFile(file) {
  let raw;
  try {
    raw = await fsp.readFile(file, 'utf8');
  } catch {
    return;
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    console.warn('[leniency] Skipping invalid JSON:', file);
    return;
  }
  let changed = false;

  // Fill in the blank answers
  if (Array.isArray(json.fillintheblank)) {
    for (const it of json.fillintheblank) {
      if (ensureAnyOf(it)) changed = true;
    }
  }

  // REMOVED: Sample array processing - deprecated zombie code
  // See docs/KILL_SAMPLE_ARRAY.md - sample array must never be used
  // If you see this being processed, it means the zombie has returned - kill it again!

  // Word problems (math)
  if (Array.isArray(json.wordProblems)) {
    for (const it of json.wordProblems) {
      if (ensureAnyOf(it)) changed = true;
    }
  }

  // Short answers: add keyword rubric
  if (Array.isArray(json.shortanswer)) {
    for (const it of json.shortanswer) {
      if (ensureShortAnswerRubric(it)) changed = true;
    }
  }

  if (changed) {
    const pretty = JSON.stringify(json, null, 2) + '\n';
    await fsp.writeFile(file, pretty, 'utf8');
    console.log('Updated:', path.relative(ROOT, file));
  }
}

(async () => {
  if (!fs.existsSync(ROOT)) {
    console.error('Lessons directory not found:', ROOT);
    process.exit(1);
  }
  for await (const file of walk(ROOT)) {
    await processFile(file);
  }
  console.log('Leniency upgrade complete.');
})();
