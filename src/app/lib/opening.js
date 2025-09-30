// Hardwired Opening generator: greetings, encouragements, and a simple next-step prompt
// Usage:
//   import { generateOpening } from '@/app/lib/opening'
//   const text = generateOpening({ name, lessonTitle, subject })


/** @typedef {'math'|'science'|'language arts'|'social studies'} Subject */

// Cycle through a list deterministically per key using localStorage; fallback to random on SSR
function pickCycled(key, list) {
  if (!Array.isArray(list) || list.length === 0) return ''
  try {
    if (typeof window === 'undefined') {
      return list[Math.floor(Math.random() * list.length)]
    }
    const storageKey = `opening_idx_${key}`
    let idx = Number.parseInt(localStorage.getItem(storageKey) || '', 10)
    if (!Number.isFinite(idx) || idx < 0 || idx >= list.length) {
      idx = Math.floor(Math.random() * list.length)
    } else {
      idx = (idx + 1) % list.length
    }
    localStorage.setItem(storageKey, String(idx))
    return list[idx]
  } catch {
    return list[Math.floor(Math.random() * list.length)]
  }
}

// 15 greetings that include the learner's name and the lesson title
/** @type {Array<(name:string, title:string)=>string>} */
export const greetings = [
  (n, t) => `Hello, ${n}. Today's lesson is ${t}.`,
  (n, t) => `Hi ${n}. We are learning ${t} today.`,
  (n, t) => `Hey ${n}. Today's focus is ${t}.`,
  (n, t) => `Welcome, ${n}. Our lesson is ${t}.`,
  (n, t) => `Good to see you, ${n}. Today is ${t}.`,
  (n, t) => `Hi there, ${n}. We will explore ${t}.`,
  (n, t) => `Hello ${n}. Get ready for ${t}.`,
  (n, t) => `Hey there, ${n}. Today's topic is ${t}.`,
  (n, t) => `Welcome back, ${n}. We are doing ${t}.`,
  (n, t) => `Hi ${n}. Our topic today is ${t}.`,
  (n, t) => `Hello ${n}. We will dive into ${t}.`,
  (n, t) => `Hey ${n}. The lesson today is ${t}.`,
  (n, t) => `Good day, ${n}. Our focus is ${t}.`,
  (n, t) => `Hi ${n}. Today we start ${t}.`,
  (n, t) => `Hello, ${n}. The plan today is ${t}.`,
]

// 20 short encouragement lines
export const encouragements = [
  "You're going to do amazing.",
  "We will have fun learning.",
  "You can do this with me.",
  "I believe in your hard work.",
  "Your thinking brain is ready.",
  "We will take it step by step.",
  "Small steps lead to big wins.",
  "Curious minds learn the most.",
  "We will make this feel easy.",
  "You're brave to try new things.",
  "We'll learn and laugh together.",
  "Mistakes help our brains grow.",
  "You have great questions already.",
  "We will practice and get stronger.",
  "Your effort matters the most.",
  "We will celebrate small victories.",
  "You are building real skills today.",
  "We will keep it clear and simple.",
  "I am excited to learn with you.",
  "You are ready for a great start.",
]

// 20 silly questions per subject
/** @type {Record<Subject,string[]>} */
export const sillyQuestionsBySubject = {
  math: [
    'If numbers could dance, which would moonwalk best?',
    'Would a triangle wear one hat or three hats?',
    'If zero had a pet, what would you name it?',
    'Which digit would make the silliest superhero?',
    'If fractions were pizza, what slice wins?',
    'Would a square prefer socks or shoes?',
    'If seven told a joke, who would laugh first?',
    'Which shape would be best at hide and seek?',
    'If addition made sounds, what would it be?',
    'Would a rectangle rather skateboard or surf?',
    'If lines were noodles, which is the longest?',
    'Which number would be the class clown?',
    'If decimals were sprinkles, which flavor wins?',
    'Would a circle like rollerblades or skis?',
    'If patterns were songs, what would you hum?',
    'Which symbol would host a game show?',
    'If graphs were pets, which would you adopt?',
    'Would a fraction prefer tea or hot cocoa?',
    'If angles told secrets, which is the sneakiest?',
    'Which shape would win a dance contest?',
  ],
  science: [
    'If atoms threw parties, who brings the snacks?',
    'Would a magnet enjoy a metal concert?',
    'If clouds wore shoes, what kind fit?',
    'Which planet tells the funniest jokes?',
    'If rocks could sing, which genre fits?',
    'Would a lava lamp enjoy volcano stories?',
    'If plants texted, what would roots say?',
    'Which animal would make a great teacher?',
    'If stars had nicknames, what is yours?',
    'Would a comet prefer sunglasses or a hat?',
    'If sound was a color, which would you pick?',
    'Which simple machine would win a race?',
    'If germs wore capes, what is their power?',
    'Would a fossil like museums or beaches more?',
    'If moon cheese was real, what topping wins?',
    'Which weather would make the best drummer?',
    'If a robot told jokes, what is joke one?',
    'Would a shadow like tag or hopscotch?',
    'If energy was a snack, what is tasty?',
    'Which habitat would you build a fort in?',
  ],
  'language arts': [
    'If words had wings, which word would fly?',
    'Would a comma prefer naps or races?',
    'If a book could giggle, which part laughs?',
    'Which character would you invite to lunch?',
    'If stories were sandwiches, what goes inside?',
    'Would a poem like sneakers or slippers?',
    'If adjectives sparkled, which would sparkle most?',
    'Which hero would borrow your best pencil?',
    'If plot twists were rollercoasters, which drop wins?',
    'Would a verb rather sprint or dance today?',
    'If a library whispered, what would it say?',
    'Which setting would make the coziest blanket?',
    'If similes were stickers, which would you pick?',
    'Would dialogue prefer chalk or markers?',
    'If a mystery had sprinkles, what color?',
    'Which narrator would host a birthday party?',
    'If a dictionary sang, which song is first?',
    'Would a fable like cookies or carrots?',
    'If a plot map was a ride, what name?',
    'Which fairy tale would text the most emojis?',
  ],
  'social studies': [
    'If maps could chat, what would they say?',
    'Would a timeline prefer sneakers or boots?',
    'If a city waved, what would it wave with?',
    'Which landmark would make the best mascot?',
    'If a community had a theme song, which?',
    'Would a compass enjoy hide and seek?',
    'If history told jokes, which era laughs?',
    'Which tradition would throw the silliest parade?',
    'If money giggled, what would it sound like?',
    'Would a river prefer a scarf or mittens?',
    'If a globe spun stories, which starts first?',
    'Which job would you give a superhero?',
    'If rules were stickers, which goes on top?',
    'Would a museum like dance music or jazz?',
    'If borders were chalk, what would you draw?',
    'Which leader would host a game night?',
    'If neighborhoods had pets, which would you choose?',
    'Would a festival prefer balloons or bubbles?',
    'If a vote had a hat, what color?',
    'Which map symbol would make the best pet?',
  ],
}

/**
 * Generate a hardwired Opening: greeting + encouragement + menu question.
 * - No joke and no silly question in the Opening itself.
 * - Final line invites the learner to choose the next action.
 * @param {{ name?: string, lessonTitle: string, subject: Subject }} opts
 */
export function generateOpening(opts) {
  const name = (opts?.name || '').trim() || 'friend'
  const title = (opts?.lessonTitle || '').trim() || 'our lesson'
  const subject = /** @type {Subject} */ (opts?.subject || 'math')

  const greetRaw = pickCycled('greet', greetings)
  const greeting = (typeof greetRaw === 'function' ? greetRaw(name, title) : (greetRaw || '')).trim()
  const encouragement = pickCycled('enc', encouragements)

  // Build final text without humor beats; keep paragraph pacing clean
  const closing = 'What would you like to do first?'
  const parts = [ `${greeting} ${encouragement}`.trim(), closing ]
  return parts.filter(Boolean)
    .map((p) => p.replace(/[ \t]{2,}/g, ' ').trim())
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default {
  greetings,
  encouragements,
  sillyQuestionsBySubject,
  generateOpening,
}
