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
  const list = getJokesForSubject(subject);
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
    return list[idx];
  } catch {
    return list[Math.floor(Math.random() * list.length)];
  }
}

/** @type {Record<'math'|'science'|'language arts'|'social studies', Joke[]>} */
export const jokesBySubject = {
  math: [
    { id:'math-01', subject:'math', lines:[
      'Why was seven so cool at school today',
      'Because it knew all the prime moves'
    ], pausesMs:[0, 700] },
    { id:'math-02', subject:'math', lines:[
      'I tried to catch some fog in algebra',
      'I mist the solution by one step'
    ], pausesMs:[0, 700] },
    { id:'math-03', subject:'math', lines:[
      'My calculator and I are very close',
      'We can count on each other always'
    ], pausesMs:[0, 650] },
    { id:'math-04', subject:'math', lines:[
      'Parallel lines have so much in common',
      'It is a shame they never meet'
    ], pausesMs:[0, 750] },
    { id:'math-05', subject:'math', lines:[
      'Why did the fraction love camping trips',
      'It enjoyed reducing under the stars'
    ], pausesMs:[0, 750] },
    { id:'math-06', subject:'math', lines:[
      'Why did the student sit near the angle',
      'It looked just right for learning'
    ], pausesMs:[0, 700] },
    { id:'math-07', subject:'math', lines:[
      'I told a circle a new secret',
      'It said that is pointless to hide'
    ], pausesMs:[0, 750] },
    { id:'math-08', subject:'math', lines:[
      'Why was the number line so calm',
      'It always knew where to stand'
    ], pausesMs:[0, 650] },
    { id:'math-09', subject:'math', lines:[
      'What did the triangle say at rehearsal',
      'Let us try a cute angle today'
    ], pausesMs:[0, 750] },
    { id:'math-10', subject:'math', lines:[
      'Why was zero great at friendships',
      'It never tried to be the one'
    ], pausesMs:[0, 700] },
    { id:'math-11', subject:'math', lines:[
      'Decimals threw a party last weekend',
      'Everyone had a point to make'
    ], pausesMs:[0, 700] },
    { id:'math-12', subject:'math', lines:[
      'Why did the graph bring a ladder',
      'It wanted to reach new axes'
    ], pausesMs:[0, 750] },
    { id:'math-13', subject:'math', lines:[
      'I asked the fraction for directions',
      'It said go half way then simplify'
    ], pausesMs:[0, 800] },
    { id:'math-14', subject:'math', lines:[
      'Why did the variable need a hug',
      'It felt unknown in every problem'
    ], pausesMs:[0, 750] },
    { id:'math-15', subject:'math', lines:[
      'Numbers went camping in the woods',
      'They found a natural log to sit'
    ], pausesMs:[0, 800] },
    { id:'math-16', subject:'math', lines:[
      'Why was the fraction always relaxed',
      'It could always take things down'
    ], pausesMs:[0, 750] },
    { id:'math-17', subject:'math', lines:[
      'The rectangle trained for a race today',
      'It wanted to go the long way'
    ], pausesMs:[0, 750] },
    { id:'math-18', subject:'math', lines:[
      'Why did the student love remainders',
      'They always left a little extra'
    ], pausesMs:[0, 700] },
    { id:'math-19', subject:'math', lines:[
      'I met a polygon with many stories',
      'It had a lot of sides to tell'
    ], pausesMs:[0, 800] },
    { id:'math-20', subject:'math', lines:[
      'Why are obtuse angles so friendly',
      'They are never too sharp with others'
    ], pausesMs:[0, 800] },
    { id:'math-21', subject:'math', lines:[
      'The ruler started a travel blog today',
      'It measures journeys one inch at once'
    ], pausesMs:[0, 800] },
    { id:'math-22', subject:'math', lines:[
      'Why do graphs make great storytellers',
      'They always have a clear plot'
    ], pausesMs:[0, 700] },
    { id:'math-23', subject:'math', lines:[
      'I asked nine if it felt odd',
      'It said sometimes but mostly fine'
    ], pausesMs:[0, 800] },
    { id:'math-24', subject:'math', lines:[
      'Why did two sit with eight today',
      'They both loved making tens together'
    ], pausesMs:[0, 800] },
    { id:'math-25', subject:'math', lines:[
      'The protractor opened a music studio',
      'It records the right angles daily'
    ], pausesMs:[0, 800] },
    { id:'math-26', subject:'math', lines:[
      'Why did the digit visit the bakery',
      'It wanted a fresh even dozen'
    ], pausesMs:[0, 800] },
    { id:'math-27', subject:'math', lines:[
      'I showed my homework to the function',
      'It said nice input and better output'
    ], pausesMs:[0, 850] },
    { id:'math-28', subject:'math', lines:[
      'Why was the circle always confident',
      'It went around issues with style'
    ], pausesMs:[0, 800] },
    { id:'math-29', subject:'math', lines:[
      'The integer joined a theater club',
      'It loved acting in whole roles'
    ], pausesMs:[0, 800] },
    { id:'math-30', subject:'math', lines:[
      'Why did the base thank the exponent',
      'Together they made things grow quickly'
    ], pausesMs:[0, 850] },
  ],
  science: [
    { id:'science-01', subject:'science', lines:[
      'Why did the atom bring a friend',
      'Everything is better with a bond'
    ], pausesMs:[0, 750] },
    { id:'science-02', subject:'science', lines:[
      'The photon packed super light for vacation',
      'It carried no extra baggage at all'
    ], pausesMs:[0, 800] },
    { id:'science-03', subject:'science', lines:[
      'Why did the plant love math class',
      'It heard there would be root problems'
    ], pausesMs:[0, 800] },
    { id:'science-04', subject:'science', lines:[
      'I asked the magnet for advice',
      'It said stay positive and attract good'
    ], pausesMs:[0, 850] },
    { id:'science-05', subject:'science', lines:[
      'Why did the comet ace geography',
      'It always followed the right path'
    ], pausesMs:[0, 750] },
    { id:'science-06', subject:'science', lines:[
      'The skeleton started a dance channel',
      'It had great moves and backbone'
    ], pausesMs:[0, 800] },
    { id:'science-07', subject:'science', lines:[
      'Why did the cell throw a party',
      'It wanted to divide the fun'
    ], pausesMs:[0, 750] },
    { id:'science-08', subject:'science', lines:[
      'The volcano wrote an honest journal',
      'It shared feelings in little eruptions'
    ], pausesMs:[0, 850] },
    { id:'science-09', subject:'science', lines:[
      'Why do astronauts always carry pencils',
      'They like to draw their own space'
    ], pausesMs:[0, 800] },
    { id:'science-10', subject:'science', lines:[
      'The robot told a heartfelt story',
      'It really came from the hard drive'
    ], pausesMs:[0, 850] },
    { id:'science-11', subject:'science', lines:[
      'Why did the frog join the choir',
      'It had perfect ribbit and range'
    ], pausesMs:[0, 800] },
    { id:'science-12', subject:'science', lines:[
      'I asked gravity for a small favor',
      'It said sorry I cannot let you down'
    ], pausesMs:[0, 900] },
    { id:'science-13', subject:'science', lines:[
      'The molecule tried stand up comedy',
      'It had good reactions every night'
    ], pausesMs:[0, 850] },
    { id:'science-14', subject:'science', lines:[
      'Why did the cloud take a selfie',
      'It was feeling very cumulus today'
    ], pausesMs:[0, 850] },
    { id:'science-15', subject:'science', lines:[
      'The dinosaur opened a tutoring center',
      'It specialized in prehistory homework help'
    ], pausesMs:[0, 900] },
    { id:'science-16', subject:'science', lines:[
      'Why did the seed write a letter',
      'It wanted to say let us grow'
    ], pausesMs:[0, 850] },
    { id:'science-17', subject:'science', lines:[
      'The battery shared its morning routine',
      'It starts charged and stays positive'
    ], pausesMs:[0, 900] },
    { id:'science-18', subject:'science', lines:[
      'Why did the star feel confident today',
      'It was really in its element'
    ], pausesMs:[0, 900] },
    { id:'science-19', subject:'science', lines:[
      'The microscope loves reading tiny mysteries',
      'It always zooms in on the clues'
    ], pausesMs:[0, 900] },
    { id:'science-20', subject:'science', lines:[
      'Why did the moon start a journal',
      'It wanted to reflect on its phases'
    ], pausesMs:[0, 900] },
    { id:'science-21', subject:'science', lines:[
      'The ocean told me a deep secret',
      'It said tide and seek with me'
    ], pausesMs:[0, 900] },
    { id:'science-22', subject:'science', lines:[
      'Why did the bee love group projects',
      'It always brought a great buzz'
    ], pausesMs:[0, 850] },
    { id:'science-23', subject:'science', lines:[
      'The magnet wrote a helpful handbook',
      'It covers attraction and gentle repulsion'
    ], pausesMs:[0, 950] },
    { id:'science-24', subject:'science', lines:[
      'Why do mountains never get bored',
      'They always find new peaks to reach'
    ], pausesMs:[0, 900] },
    { id:'science-25', subject:'science', lines:[
      'The thermometer started a podcast today',
      'It discusses degrees with warm guests'
    ], pausesMs:[0, 950] },
    { id:'science-26', subject:'science', lines:[
      'Why did the robot refuse a nap',
      'It was fully charged and ready'
    ], pausesMs:[0, 900] },
    { id:'science-27', subject:'science', lines:[
      'The geologist hosted a rock concert',
      'Everyone said it was very gneiss'
    ], pausesMs:[0, 950] },
    { id:'science-28', subject:'science', lines:[
      'Why did the wind get top grades',
      'It always had the best current events'
    ], pausesMs:[0, 950] },
    { id:'science-29', subject:'science', lines:[
      'The astronaut tried a new diet',
      'It was a little space between meals'
    ], pausesMs:[0, 950] },
    { id:'science-30', subject:'science', lines:[
      'Why did the lightning write short stories',
      'It preferred striking endings every time'
    ], pausesMs:[0, 950] },
  ],
  'language arts': [
    { id:'language-arts-01', subject:'language arts', lines:[
      'Why did the comma join the band',
      'It knew exactly when to pause'
    ], pausesMs:[0, 750] },
    { id:'language-arts-02', subject:'language arts', lines:[
      'The adjective started a kindness club',
      'It loved describing everyone with care'
    ], pausesMs:[0, 800] },
    { id:'language-arts-03', subject:'language arts', lines:[
      'Why did the book enjoy gym class',
      'It was great at doing splits'
    ], pausesMs:[0, 800] },
    { id:'language-arts-04', subject:'language arts', lines:[
      'I asked a pun for directions',
      'It said take the fun intended way'
    ], pausesMs:[0, 850] },
    { id:'language-arts-05', subject:'language arts', lines:[
      'Why did the poem bring a flashlight',
      'It wanted to find its meter'
    ], pausesMs:[0, 850] },
    { id:'language-arts-06', subject:'language arts', lines:[
      'The verb started a weekend dance party',
      'It loves action every single day'
    ], pausesMs:[0, 850] },
    { id:'language-arts-07', subject:'language arts', lines:[
      'Why did the essay carry an umbrella',
      'It expected a brainstorm later today'
    ], pausesMs:[0, 850] },
    { id:'language-arts-08', subject:'language arts', lines:[
      'The period kept a tidy schedule',
      'It always knew when to stop'
    ], pausesMs:[0, 800] },
    { id:'language-arts-09', subject:'language arts', lines:[
      'Why did the sentence visit the gym',
      'It wanted strong subjects and predicates'
    ], pausesMs:[0, 900] },
    { id:'language-arts-10', subject:'language arts', lines:[
      'The library taught me a quiet trick',
      'You can whisper while reading adventures'
    ], pausesMs:[0, 900] },
    { id:'language-arts-11', subject:'language arts', lines:[
      'Why did the poet wear headphones',
      'It was listening for perfect rhyme'
    ], pausesMs:[0, 900] },
    { id:'language-arts-12', subject:'language arts', lines:[
      'The thesaurus threw a helpful party',
      'Everyone felt welcomed and included'
    ], pausesMs:[0, 900] },
    { id:'language-arts-13', subject:'language arts', lines:[
      'Why did the draft take a nap',
      'It needed to rest before revision'
    ], pausesMs:[0, 900] },
    { id:'language-arts-14', subject:'language arts', lines:[
      'The narrator practiced for a play',
      'It worked on point of view'
    ], pausesMs:[0, 900] },
    { id:'language-arts-15', subject:'language arts', lines:[
      'Why did the paragraph bring snacks',
      'It needed supporting details to share'
    ], pausesMs:[0, 900] },
    { id:'language-arts-16', subject:'language arts', lines:[
      'The teacher praised a powerful hook',
      'It caught everyone right at once'
    ], pausesMs:[0, 950] },
    { id:'language-arts-17', subject:'language arts', lines:[
      'Why did the letter feel important',
      'It was uppercase for a reason'
    ], pausesMs:[0, 900] },
    { id:'language-arts-18', subject:'language arts', lines:[
      'The storyteller packed a map today',
      'It always plans a clear beginning'
    ], pausesMs:[0, 950] },
    { id:'language-arts-19', subject:'language arts', lines:[
      'Why did the dialogue wear name tags',
      'Everyone wanted to speak clearly'
    ], pausesMs:[0, 900] },
    { id:'language-arts-20', subject:'language arts', lines:[
      'The plot invited a twist to dinner',
      'It promised a surprising dessert'
    ], pausesMs:[0, 950] },
    { id:'language-arts-21', subject:'language arts', lines:[
      'Why did the reader bring a flashlight',
      'It was exploring a dark mystery'
    ], pausesMs:[0, 950] },
    { id:'language-arts-22', subject:'language arts', lines:[
      'The comma practiced mindful breathing today',
      'It takes gentle pauses for clarity'
    ], pausesMs:[0, 950] },
    { id:'language-arts-23', subject:'language arts', lines:[
      'Why did the report love headings',
      'They keep big ideas organized nicely'
    ], pausesMs:[0, 950] },
    { id:'language-arts-24', subject:'language arts', lines:[
      'The fable packed a wise message',
      'It traveled with a friendly animal'
    ], pausesMs:[0, 950] },
    { id:'language-arts-25', subject:'language arts', lines:[
      'Why did the script carry water',
      'It expected dramatic lines to deliver'
    ], pausesMs:[0, 950] },
    { id:'language-arts-26', subject:'language arts', lines:[
      'The question mark practiced good posture',
      'It stands tall when it wonders'
    ], pausesMs:[0, 950] },
    { id:'language-arts-27', subject:'language arts', lines:[
      'Why did the headline smile today',
      'It finally made perfect sense'
    ], pausesMs:[0, 950] },
    { id:'language-arts-28', subject:'language arts', lines:[
      'The essay brought a strong conclusion',
      'It waved goodbye with clear ideas'
    ], pausesMs:[0, 950] },
    { id:'language-arts-29', subject:'language arts', lines:[
      'Why did the author thank the editor',
      'Teamwork made the story shine'
    ], pausesMs:[0, 950] },
    { id:'language-arts-30', subject:'language arts', lines:[
      'The metaphor packed a tiny suitcase',
      'It carried big meaning inside'
    ], pausesMs:[0, 950] },
  ],
  'social studies': [
    { id:'social-01', subject:'social studies', lines:[
      'Why did the map join the choir',
      'It could really hold a note'
    ], pausesMs:[0, 750] },
    { id:'social-02', subject:'social studies', lines:[
      'The compass gave great life advice',
      'It said keep heading toward kindness'
    ], pausesMs:[0, 850] },
    { id:'social-03', subject:'social studies', lines:[
      'Why did the historian carry snacks',
      'They were always digging into sources'
    ], pausesMs:[0, 850] },
    { id:'social-04', subject:'social studies', lines:[
      'The globe told a travel story',
      'It had many spins and stops'
    ], pausesMs:[0, 850] },
    { id:'social-05', subject:'social studies', lines:[
      'Why did the atlas start a club',
      'It wanted everyone on the same page'
    ], pausesMs:[0, 900] },
    { id:'social-06', subject:'social studies', lines:[
      'The timeline set a steady rhythm',
      'Events marched by in good order'
    ], pausesMs:[0, 900] },
    { id:'social-07', subject:'social studies', lines:[
      'Why did the flag practice waves',
      'It loved greeting people with respect'
    ], pausesMs:[0, 900] },
    { id:'social-08', subject:'social studies', lines:[
      'The economist planted a tiny garden',
      'It learned about supply and growth'
    ], pausesMs:[0, 900] },
    { id:'social-09', subject:'social studies', lines:[
      'Why did the community bake extra bread',
      'They believed sharing makes stronger neighborhoods'
    ], pausesMs:[0, 950] },
    { id:'social-10', subject:'social studies', lines:[
      'The geographer sketched the school playground',
      'They labeled places and helpful paths'
    ], pausesMs:[0, 950] },
    { id:'social-11', subject:'social studies', lines:[
      'Why did the archaeologist carry a pencil',
      'They always draw careful conclusions'
    ], pausesMs:[0, 950] },
    { id:'social-12', subject:'social studies', lines:[
      'The mayor practiced listening this morning',
      'That is how decisions get better'
    ], pausesMs:[0, 950] },
    { id:'social-13', subject:'social studies', lines:[
      'Why did the map love libraries',
      'They are full of interesting directions'
    ], pausesMs:[0, 950] },
    { id:'social-14', subject:'social studies', lines:[
      'The treaty hosted a friendship picnic',
      'Everyone agreed to share the field'
    ], pausesMs:[0, 950] },
    { id:'social-15', subject:'social studies', lines:[
      'Why did the explorer carry a notebook',
      'They wanted to learn from every step'
    ], pausesMs:[0, 950] },
    { id:'social-16', subject:'social studies', lines:[
      'The budget packed a sensible lunch',
      'It balanced treats with healthy choices'
    ], pausesMs:[0, 950] },
    { id:'social-17', subject:'social studies', lines:[
      'Why did the landmark wear a smile',
      'Visitors brought stories from everywhere'
    ], pausesMs:[0, 950] },
    { id:'social-18', subject:'social studies', lines:[
      'The classroom drew a helpful map',
      'It showed ways to be kind'
    ], pausesMs:[0, 950] },
    { id:'social-19', subject:'social studies', lines:[
      'Why did the election love pencils',
      'They make clear and thoughtful choices'
    ], pausesMs:[0, 950] },
    { id:'social-20', subject:'social studies', lines:[
      'The museum practiced great storytelling',
      'Artifacts spoke softly about the past'
    ], pausesMs:[0, 950] },
    { id:'social-21', subject:'social studies', lines:[
      'Why did the compass visit art class',
      'It wanted to draw true north'
    ], pausesMs:[0, 950] },
    { id:'social-22', subject:'social studies', lines:[
      'The historian started a kindness timeline',
      'It marks brave and helpful moments'
    ], pausesMs:[0, 950] },
    { id:'social-23', subject:'social studies', lines:[
      'Why did the traveler carry extra maps',
      'Friends might need directions someday'
    ], pausesMs:[0, 950] },
    { id:'social-24', subject:'social studies', lines:[
      'The classroom globe learned new greetings',
      'It practiced hello in many languages'
    ], pausesMs:[0, 950] },
    { id:'social-25', subject:'social studies', lines:[
      'Why did the timeline enjoy music class',
      'Events line up with perfect rhythm'
    ], pausesMs:[0, 950] },
    { id:'social-26', subject:'social studies', lines:[
      'The census baked extra cookies today',
      'It counted neighbors for everyone'
    ], pausesMs:[0, 950] },
    { id:'social-27', subject:'social studies', lines:[
      'Why did the globe visit the gym',
      'It wanted to work on balance'
    ], pausesMs:[0, 950] },
    { id:'social-28', subject:'social studies', lines:[
      'The map key wrote helpful labels',
      'It explained symbols with clear words'
    ], pausesMs:[0, 950] },
    { id:'social-29', subject:'social studies', lines:[
      'Why did the constitution practice teamwork',
      'Many parts work better together'
    ], pausesMs:[0, 950] },
    { id:'social-30', subject:'social studies', lines:[
      'The community planted trees last weekend',
      'They all voted for more shade'
    ], pausesMs:[0, 950] },
  ],
};

export default jokesBySubject;
