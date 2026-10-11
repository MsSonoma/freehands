const SMALL_NUMBERS = Object.freeze({
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
})

const TENS = Object.freeze({
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
})

const DENOMINATORS = Object.freeze({
  half: 2, halves: 2,
  third: 3, thirds: 3,
  quarter: 4, quarters: 4, fourth: 4, fourths: 4,
  fifth: 5, fifths: 5,
  sixth: 6, sixths: 6,
  seventh: 7, sevenths: 7,
  eighth: 8, eighths: 8,
  ninth: 9, ninths: 9,
  tenth: 10, tenths: 10,
  eleventh: 11, elevenths: 11,
  twelfth: 12, twelfths: 12,
  thirteenth: 13, thirteenths: 13,
  fourteenth: 14, fourteenths: 14,
  fifteenth: 15, fifteenths: 15,
  sixteenth: 16, sixteenths: 16,
  seventeenth: 17, seventeenths: 17,
  eighteenth: 18, eighteenths: 18,
  nineteenth: 19, nineteenths: 19,
  twentieth: 20, twentieths: 20,
  hundredth: 100, hundredths: 100,
  thousandth: 1000, thousandths: 1000,
})

function normalizeWords(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[−–—]/g, '-')
    .replace(/,/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
}

function parseCardinalWords(value) {
  const text = normalizeWords(value).replace(/^an?\s+/, '')
  if (!text) return null
  const tokens = text.split(' ').filter((token) => token !== 'and')
  let total = 0
  let current = 0
  let saw = false

  for (const token of tokens) {
    if (Object.prototype.hasOwnProperty.call(SMALL_NUMBERS, token)) {
      current += SMALL_NUMBERS[token]
      saw = true
      continue
    }
    if (Object.prototype.hasOwnProperty.call(TENS, token)) {
      current += TENS[token]
      saw = true
      continue
    }
    if (token === 'hundred') {
      current = (current || 1) * 100
      saw = true
      continue
    }
    if (token === 'thousand') {
      total += (current || 1) * 1000
      current = 0
      saw = true
      continue
    }
    return null
  }

  return saw ? total + current : null
}

function parseDecimalWords(value) {
  const text = normalizeWords(value)
  const match = text.match(/^(.+?)\s+point\s+(.+)$/)
  if (!match) return null
  const whole = parseCardinalWords(match[1])
  if (whole == null) return null
  const digitWords = match[2].split(' ')
  const digits = []
  for (const word of digitWords) {
    if (!Object.prototype.hasOwnProperty.call(SMALL_NUMBERS, word) || SMALL_NUMBERS[word] > 9) return null
    digits.push(String(SMALL_NUMBERS[word]))
  }
  if (!digits.length) return null
  return Number(`${whole}.${digits.join('')}`)
}

function parseFractionWords(value) {
  const text = normalizeWords(value)
  const tokens = text.split(' ')
  if (tokens.length < 1) return null
  const denominatorWord = tokens[tokens.length - 1]
  const denominator = DENOMINATORS[denominatorWord]
  if (!denominator) return null
  const numeratorWords = tokens.slice(0, -1).join(' ') || 'one'
  const numerator = parseCardinalWords(numeratorWords)
  if (numerator == null) return null
  return { value: numerator / denominator, representation: 'fraction', numerator, denominator }
}

function parsePercentWords(value) {
  const text = normalizeWords(value)
  const match = text.match(/^(.+?)\s+percent(?:age)?$/)
  if (!match) return null
  const amount = parseDecimalWords(match[1]) ?? parseCardinalWords(match[1])
  if (amount == null) return null
  return { value: amount / 100, representation: 'percent' }
}

export function parseSlateMathAnswer(value) {
  const text = normalizeWords(value)
  if (!text) return null

  const percentSymbol = text.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*%$/)
  if (percentSymbol) {
    return { value: Number(percentSymbol[1]) / 100, representation: 'percent' }
  }

  const percentWords = parsePercentWords(text)
  if (percentWords) return percentWords

  const mixedFraction = text.match(/^([+-]?\d+)\s+(\d+)\s*\/\s*(\d+)$/)
  if (mixedFraction) {
    const whole = Number(mixedFraction[1])
    const numerator = Number(mixedFraction[2])
    const denominator = Number(mixedFraction[3])
    if (!denominator) return null
    const sign = whole < 0 ? -1 : 1
    return {
      value: whole + sign * (numerator / denominator),
      representation: 'fraction',
      numerator: Math.abs(whole) * denominator + numerator,
      denominator,
    }
  }

  const fraction = text.match(/^([+-]?\d+)\s*\/\s*([+-]?\d+)$/)
  if (fraction) {
    const numerator = Number(fraction[1])
    const denominator = Number(fraction[2])
    if (!denominator) return null
    return { value: numerator / denominator, representation: 'fraction', numerator, denominator }
  }

  const fractionWords = parseFractionWords(text)
  if (fractionWords) return fractionWords

  if (/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) {
    return {
      value: Number(text),
      representation: text.includes('.') ? 'decimal' : 'integer',
    }
  }

  const decimalWords = parseDecimalWords(text)
  if (decimalWords != null) return { value: decimalWords, representation: 'decimal' }

  const cardinalWords = parseCardinalWords(text)
  if (cardinalWords != null) return { value: cardinalWords, representation: 'integer' }

  return null
}

function requiredRepresentation(question) {
  const text = normalizeWords(question)
  if (!text) return null
  if (/\b(percent|percentage)\b/.test(text) && /\b(write|express|convert|answer|give|as|in)\b/.test(text)) return 'percent'
  if (/\bdecimal\b/.test(text) && /\b(write|express|convert|answer|give|as|in)\b/.test(text)) return 'decimal'
  if (/\bfraction\b/.test(text) && /\b(write|express|convert|answer|give|as|in)\b/.test(text)) return 'fraction'
  return null
}

function representationSatisfies(actual, required) {
  if (!required) return true
  if (required === 'fraction') return actual === 'fraction'
  if (required === 'percent') return actual === 'percent'
  if (required === 'decimal') return actual === 'decimal' || actual === 'integer'
  return true
}

export function slateMathAnswersEquivalent(learnerAnswer, expectedAnswers, { question = '' } = {}) {
  const learner = parseSlateMathAnswer(learnerAnswer)
  if (!learner || !Number.isFinite(learner.value)) return false

  const required = requiredRepresentation(question)
  if (!representationSatisfies(learner.representation, required)) return false

  const candidates = Array.isArray(expectedAnswers) ? expectedAnswers : [expectedAnswers]
  for (const candidate of candidates) {
    const expected = parseSlateMathAnswer(candidate)
    if (!expected || !Number.isFinite(expected.value)) continue
    const scale = Math.max(1, Math.abs(learner.value), Math.abs(expected.value))
    if (Math.abs(learner.value - expected.value) <= Number.EPSILON * 32 * scale) return true
  }
  return false
}
