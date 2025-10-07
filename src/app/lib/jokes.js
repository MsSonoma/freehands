// Kid-friendly joke catalog with simple timing metadata.
// Usage idea:
//   import { jokesBySubject, renderJoke } from '@/app/lib/jokes'
//   const joke = jokesBySubject.math[0]
//   const textToSend = renderJoke(joke) // lines joined with blank lines for pacing
//   // Optionally honor pausesMs between lines in your UI/TTS timing

/**
 * @typedef {Object} Joke
 * @property {string} id            Stable unique id per subject, e.g., 'math-01'
 * @property {('math'|'science'|'language arts'|'social studies')} subject
 * @property {string[]} lines       Consecutive short sentences (6–12 words each)
 * @property {number[]} pausesMs    Pause after each line (milliseconds), length matches lines
 */

/**
 * Join joke lines with blank lines to create a natural beat in text.
 * Consumers may still honor pausesMs for audio/video timing.
 * @param {Joke} joke
 */
export function renderJoke(joke) {
  try {
    return Array.isArray(joke?.lines) ? joke.lines.join('\n\n') : '';
  } catch { return '' }
}

/**
 * Get the array of jokes for a given subject.
 * @param {('math'|'science'|'language arts'|'social studies')} subject
 * @returns {Joke[]}
 */
export function getJokesForSubject(subject) {
  return jokesBySubject[subject] || [];
}

/**
 * Deterministic, non-repeating picker per subject using localStorage.
 * - Initializes with a random start index to avoid sync repetition across users.
 * - Advances by one each call and wraps around.
 * - Safe on SSR: returns first joke without persistence when window is undefined.
 * @param {('math'|'science'|'language arts'|'social studies')} subject
 * @returns {Joke | null}
 */
export function pickNextJoke(subject) {
  console.log('[pickNextJoke] Called with subject:', subject);
  const list = getJokesForSubject(subject);
  console.log('[pickNextJoke] Got list with length:', list?.length);
  if (!list.length) return null;
  if (typeof window === 'undefined') return list[0];
  try {
    const key = `joke_idx_${subject.replace(/\s+/g,'_')}`;
    let idx = Number.parseInt(localStorage.getItem(key) || '', 10);
    if (!Number.isFinite(idx) || idx < 0 || idx >= list.length) {
      // Randomize start to reduce repetition across devices
      idx = Math.floor(Math.random() * list.length);
    } else {
      // Advance to next
      idx = (idx + 1) % list.length;
    }
    localStorage.setItem(key, String(idx));
    const result = list[idx];
    console.log('[pickNextJoke] Returning joke:', result?.id);
    return result;
  } catch {
    return list[Math.floor(Math.random() * list.length)];
  }
}

/** @type {Record<'math'|'science'|'language arts'|'social studies', Joke[]>} */
export const jokesBySubject = {
  math: [
    { id: "math-01", subject: "math", lines: [
      "Why was six afraid of seven?",
      "Because seven eight nine!"
    ], pausesMs: [0, 900] },
    { id: "math-02", subject: "math", lines: [
      "What did zero say to eight?",
      "Nice belt!"
    ], pausesMs: [0, 900] },
    { id: "math-03", subject: "math", lines: [
      "Why did the quarter stay away from the nickel?",
      "It had more cents!"
    ], pausesMs: [0, 900] },
    { id: "math-04", subject: "math", lines: [
      "What do you call friends who love math?",
      "Alge-bros!"
    ], pausesMs: [0, 900] },
    { id: "math-05", subject: "math", lines: [
      "Why did the math book look so sad?",
      "It had too many problems!"
    ], pausesMs: [0, 900] },
    { id: "math-06", subject: "math", lines: [
      "What is a math teacher's favorite dessert?",
      "Pi!"
    ], pausesMs: [0, 900] },
    { id: "math-07", subject: "math", lines: [
      "Why did the two fours skip lunch?",
      "They already eight!"
    ], pausesMs: [0, 900] },
    { id: "math-08", subject: "math", lines: [
      "What did the triangle say to the circle?",
      "You're pointless!"
    ], pausesMs: [0, 900] },
    { id: "math-09", subject: "math", lines: [
      "Why was the equal sign so humble?",
      "It wasn't less than or greater than anyone else!"
    ], pausesMs: [0, 950] },
    { id: "math-10", subject: "math", lines: [
      "What do you call a number that can't sit still?",
      "A roamin' numeral!"
    ], pausesMs: [0, 900] },
    { id: "math-11", subject: "math", lines: [
      "Why did the student wear glasses in math class?",
      "To improve di-vision!"
    ], pausesMs: [0, 900] },
    { id: "math-12", subject: "math", lines: [
      "Why was the obtuse angle so upset?",
      "It was never right!"
    ], pausesMs: [0, 900] },
    { id: "math-13", subject: "math", lines: [
      "Why did the fraction skip soccer practice?",
      "It only made it halfway to the goal!"
    ], pausesMs: [0, 950] },
    { id: "math-14", subject: "math", lines: [
      "Why did the calculator look nervous?",
      "It felt like everyone was counting on it!"
    ], pausesMs: [0, 950] },
    { id: "math-15", subject: "math", lines: [
      "What do numbers eat for breakfast?",
      "Square waffles!"
    ], pausesMs: [0, 900] },
    { id: "math-16", subject: "math", lines: [
      "Why did the math student bring a broom?",
      "To sweep up the remainders!"
    ], pausesMs: [0, 950] },
    { id: "math-17", subject: "math", lines: [
      "Why do plants love math?",
      "They get to grow square roots!"
    ], pausesMs: [0, 950] },
    { id: "math-18", subject: "math", lines: [
      "Why was the number one feeling strange?",
      "It was just a little odd!"
    ], pausesMs: [0, 900] },
    { id: "math-19", subject: "math", lines: [
      "What do you call math homework that sings?",
      "An algo-rhythm!"
    ], pausesMs: [0, 950] },
    { id: "math-20", subject: "math", lines: [
      "Why was the fraction excited for vacation?",
      "It was time to simplify!"
    ], pausesMs: [0, 950] },
  ],
  science: [
    { id: "science-01", subject: "science", lines: [
      "Why can't you trust atoms?",
      "They make up everything!"
    ], pausesMs: [0, 900] },
    { id: "science-02", subject: "science", lines: [
      "What do you call a dinosaur that crashes his car?",
      "Tyrannosaurus wrecks!"
    ], pausesMs: [0, 900] },
    { id: "science-03", subject: "science", lines: [
      "Why did the cookie go to the doctor?",
      "It felt crumbly!"
    ], pausesMs: [0, 900] },
    { id: "science-04", subject: "science", lines: [
      "What do clouds wear under their raincoats?",
      "Thunderwear!"
    ], pausesMs: [0, 900] },
    { id: "science-05", subject: "science", lines: [
      "How do you organize a space party?",
      "You planet!"
    ], pausesMs: [0, 900] },
    { id: "science-06", subject: "science", lines: [
      "What did the volcano say to its friend?",
      "I lava you!"
    ], pausesMs: [0, 900] },
    { id: "science-07", subject: "science", lines: [
      "Why don't scientists trust stairs?",
      "They're always up to something!"
    ], pausesMs: [0, 900] },
    { id: "science-08", subject: "science", lines: [
      "What did one ocean say to the other?",
      "Nothing, they just waved!"
    ], pausesMs: [0, 900] },
    { id: "science-09", subject: "science", lines: [
      "Why did the sun go to school?",
      "To get brighter!"
    ], pausesMs: [0, 900] },
    { id: "science-10", subject: "science", lines: [
      "What's a tornado's favorite game?",
      "Twister!"
    ], pausesMs: [0, 900] },
    { id: "science-11", subject: "science", lines: [
      "How does the moon cut its hair?",
      "Eclipse it!"
    ], pausesMs: [0, 900] },
    { id: "science-12", subject: "science", lines: [
      "What do you call a dinosaur with bad eyesight?",
      "Do-you-think-he-saurus!"
    ], pausesMs: [0, 950] },
    { id: "science-13", subject: "science", lines: [
      "Why can't a flower ride a bike?",
      "It lost its petals!"
    ], pausesMs: [0, 900] },
    { id: "science-14", subject: "science", lines: [
      "What did Mars say to Saturn?",
      "Give me a ring sometime!"
    ], pausesMs: [0, 950] },
    { id: "science-15", subject: "science", lines: [
      "Why did the robot go on a diet?",
      "It had too many bytes!"
    ], pausesMs: [0, 950] },
    { id: "science-16", subject: "science", lines: [
      "What do you call an educated tube?",
      "A graduated cylinder!"
    ], pausesMs: [0, 950] },
    { id: "science-17", subject: "science", lines: [
      "Why did the germ cross the microscope slide?",
      "To get to the other slide!"
    ], pausesMs: [0, 950] },
    { id: "science-18", subject: "science", lines: [
      "What's a tree's favorite drink?",
      "Root beer!"
    ], pausesMs: [0, 900] },
    { id: "science-19", subject: "science", lines: [
      "Why did the skeleton go to the party alone?",
      "It had no body to go with!"
    ], pausesMs: [0, 950] },
    { id: "science-20", subject: "science", lines: [
      "Why did the robot sneeze?",
      "It caught a computer virus!"
    ], pausesMs: [0, 950] },
  ],
  'language arts': [
    { id: "language-arts-01", subject: "language arts", lines: [
      "Why did the book join the police?",
      "It wanted to go undercover!"
    ], pausesMs: [0, 900] },
    { id: "language-arts-02", subject: "language arts", lines: [
      "What's the longest word in the dictionary?",
      "Smiles, because there's a mile between the letters!"
    ], pausesMs: [0, 950] },
    { id: "language-arts-03", subject: "language arts", lines: [
      "Why was the letter A like a flower?",
      "Because a bee comes after it!"
    ], pausesMs: [0, 900] },
    { id: "language-arts-04", subject: "language arts", lines: [
      "What do you call a bear with no teeth?",
      "A gummy bear!"
    ], pausesMs: [0, 900] },
    { id: "language-arts-05", subject: "language arts", lines: [
      "Why did the scarecrow win an award?",
      "He was outstanding in his field!"
    ], pausesMs: [0, 900] },
    { id: "language-arts-06", subject: "language arts", lines: [
      "What building has the most stories?",
      "The library!"
    ], pausesMs: [0, 900] },
    { id: "language-arts-07", subject: "language arts", lines: [
      "Why can't your nose be twelve inches long?",
      "Because then it would be a foot!"
    ], pausesMs: [0, 900] },
    { id: "language-arts-08", subject: "language arts", lines: [
      "What do you call a dinosaur that loves books?",
      "A thesaurus!"
    ], pausesMs: [0, 900] },
    { id: "language-arts-09", subject: "language arts", lines: [
      "Why did the pencil go to bed?",
      "It was write-tired!"
    ], pausesMs: [0, 900] },
    { id: "language-arts-10", subject: "language arts", lines: [
      "What's a book's favorite food?",
      "Book-oni pizza!"
    ], pausesMs: [0, 900] },
    { id: "language-arts-11", subject: "language arts", lines: [
      "Why was the dictionary so confident?",
      "It knew the meaning of everything!"
    ], pausesMs: [0, 950] },
    { id: "language-arts-12", subject: "language arts", lines: [
      "What did the pen say to the pencil?",
      "You're looking sharp!"
    ], pausesMs: [0, 900] },
    { id: "language-arts-13", subject: "language arts", lines: [
      "Why did the comma break up with the apostrophe?",
      "It was too possessive!"
    ], pausesMs: [0, 950] },
    { id: "language-arts-14", subject: "language arts", lines: [
      "What's a writer's favorite snack?",
      "Synonym rolls!"
    ], pausesMs: [0, 950] },
    { id: "language-arts-15", subject: "language arts", lines: [
      "Why did the period get detention?",
      "It kept making everyone stop!"
    ], pausesMs: [0, 950] },
    { id: "language-arts-16", subject: "language arts", lines: [
      "Why did the sentence go to the gym?",
      "It wanted strong subjects and predicates!"
    ], pausesMs: [0, 950] },
    { id: "language-arts-17", subject: "language arts", lines: [
      "Why was the library so friendly?",
      "It always had room for more characters!"
    ], pausesMs: [0, 950] },
    { id: "language-arts-18", subject: "language arts", lines: [
      "Why don't books ever get cold?",
      "They wear book jackets!"
    ], pausesMs: [0, 950] },
    { id: "language-arts-19", subject: "language arts", lines: [
      "Why did the story go outside?",
      "It wanted a little plot twist!"
    ], pausesMs: [0, 950] },
    { id: "language-arts-20", subject: "language arts", lines: [
      "What do you call a scared piece of paper?",
      "A tear-able page!"
    ], pausesMs: [0, 950] },
  ],
  'social studies': [
    { id: "social-01", subject: "social studies", lines: [
      "Why did the knight buy extra armor?",
      "It was on sale!"
    ], pausesMs: [0, 900] },
    { id: "social-02", subject: "social studies", lines: [
      "What's a king's favorite weather?",
      "Reign!"
    ], pausesMs: [0, 900] },
    { id: "social-03", subject: "social studies", lines: [
      "Why were the early days of history called the Dark Ages?",
      "Because there were so many knights!"
    ], pausesMs: [0, 950] },
    { id: "social-04", subject: "social studies", lines: [
      "What do you call a medieval lamp?",
      "A knight light!"
    ], pausesMs: [0, 900] },
    { id: "social-05", subject: "social studies", lines: [
      "Why did the archaeologist's career end?",
      "It was in ruins!"
    ], pausesMs: [0, 950] },
    { id: "social-06", subject: "social studies", lines: [
      "What's a mummy's favorite kind of music?",
      "Wrap!"
    ], pausesMs: [0, 900] },
    { id: "social-07", subject: "social studies", lines: [
      "Why did the caveman paint on the walls?",
      "He couldn't find any paper!"
    ], pausesMs: [0, 900] },
    { id: "social-08", subject: "social studies", lines: [
      "What did the Egyptian say when he got lost?",
      "I want my mummy!"
    ], pausesMs: [0, 900] },
    { id: "social-09", subject: "social studies", lines: [
      "Why don't Vikings send emails?",
      "They prefer Norse code!"
    ], pausesMs: [0, 950] },
    { id: "social-10", subject: "social studies", lines: [
      "What's a pirate's favorite letter?",
      "You'd think it's R, but it's really the C!"
    ], pausesMs: [0, 950] },
    { id: "social-11", subject: "social studies", lines: [
      "Why did the explorer bring a notebook?",
      "To write down every adventure!"
    ], pausesMs: [0, 950] },
    { id: "social-12", subject: "social studies", lines: [
      "Why do statues always look serious?",
      "They can't crack a smile!"
    ], pausesMs: [0, 900] },
    { id: "social-13", subject: "social studies", lines: [
      "Why did the map get invited to the party?",
      "It always knew where the fun was!"
    ], pausesMs: [0, 950] },
    { id: "social-14", subject: "social studies", lines: [
      "Why did the historian bring a ladder?",
      "To visit the high points of the past!"
    ], pausesMs: [0, 950] },
    { id: "social-15", subject: "social studies", lines: [
      "Why was the landmark so popular?",
      "Everyone wanted a picture with it!"
    ], pausesMs: [0, 950] },
    { id: "social-16", subject: "social studies", lines: [
      "Why did the calendar visit the museum?",
      "It wanted to learn about dates!"
    ], pausesMs: [0, 950] },
    { id: "social-17", subject: "social studies", lines: [
      "Why did the election bring a pencil?",
      "To make a good point!"
    ], pausesMs: [0, 950] },
    { id: "social-18", subject: "social studies", lines: [
      "Why did the globe stay after school?",
      "It had world studies homework!"
    ], pausesMs: [0, 950] },
    { id: "social-19", subject: "social studies", lines: [
      "Why did the treasure map get so tired?",
      "It had too many X marks!"
    ], pausesMs: [0, 950] },
    { id: "social-20", subject: "social studies", lines: [
      "Why did the historian love jokes?",
      "They always had a great past!"
    ], pausesMs: [0, 950] },
  ],
};

export default jokesBySubject;
