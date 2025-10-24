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
      "Why does zero always stay calm?",
      "Because it has nothing to worry about."
    ], pausesMs: [0, 900] },
    { id: "math-02", subject: "math", lines: [
      "What did zero say to eight?",
      "Nice belt!"
    ], pausesMs: [0, 900] },
    { id: "math-03", subject: "math", lines: [
      "Why does one hundred feel important?",
      "It carries the whole place value system."
    ], pausesMs: [0, 950] },
    { id: "math-04", subject: "math", lines: [
      "Why do fractions make good friends?",
      "They always find common ground."
    ], pausesMs: [0, 900] },
    { id: "math-05", subject: "math", lines: [
      "Why does multiplication bring numbers together?",
      "It helps them grow stronger as groups."
    ], pausesMs: [0, 950] },
    { id: "math-06", subject: "math", lines: [
      "What is a math teacher's favorite dessert?",
      "Pi!"
    ], pausesMs: [0, 900] },
    { id: "math-07", subject: "math", lines: [
      "Why did the two fours skip lunch?",
      "They already eight!"
    ], pausesMs: [0, 900] },
    { id: "math-08", subject: "math", lines: [
      "Why do triangles make steady structures?",
      "They have three strong sides to lean on."
    ], pausesMs: [0, 950] },
    { id: "math-09", subject: "math", lines: [
      "Why was the equal sign so humble?",
      "It kept everything balanced."
    ], pausesMs: [0, 900] },
    { id: "math-10", subject: "math", lines: [
      "What do you call a number that can't sit still?",
      "A roamin' numeral!"
    ], pausesMs: [0, 900] },
    { id: "math-11", subject: "math", lines: [
      "Why did the student wear glasses in math class?",
      "To improve di-vision!"
    ], pausesMs: [0, 900] },
    { id: "math-12", subject: "math", lines: [
      "Why does an obtuse angle feel so relaxed?",
      "Because it's always over ninety degrees."
    ], pausesMs: [0, 950] },
    { id: "math-13", subject: "math", lines: [
      "Why do decimals always know their place?",
      "They follow the point carefully."
    ], pausesMs: [0, 900] },
    { id: "math-14", subject: "math", lines: [
      "Why does ten feel confident?",
      "It knows how to carry itself."
    ], pausesMs: [0, 900] },
    { id: "math-15", subject: "math", lines: [
      "What do numbers eat for breakfast?",
      "Square waffles!"
    ], pausesMs: [0, 900] },
    { id: "math-16", subject: "math", lines: [
      "Why do even numbers stay so calm?",
      "They always split things evenly."
    ], pausesMs: [0, 900] },
    { id: "math-17", subject: "math", lines: [
      "Why do plants love math?",
      "They get to grow square roots!"
    ], pausesMs: [0, 950] },
    { id: "math-18", subject: "math", lines: [
      "Why does the number one stand alone?",
      "It's comfortable being the starting point."
    ], pausesMs: [0, 950] },
    { id: "math-19", subject: "math", lines: [
      "Why do circles feel complete?",
      "They have no beginning or end."
    ], pausesMs: [0, 900] },
    { id: "math-20", subject: "math", lines: [
      "Why do fractions love simplifying?",
      "It helps them see clearly."
    ], pausesMs: [0, 900] },
    { id: "math-21", subject: "math", lines: [
      "Why do parallel lines never meet?",
      "They respect each other's space."
    ], pausesMs: [0, 900] },
    { id: "math-22", subject: "math", lines: [
      "Why does division share everything?",
      "It believes in fair distribution."
    ], pausesMs: [0, 950] },
    { id: "math-23", subject: "math", lines: [
      "Why do right angles feel just right?",
      "They're perfectly balanced at ninety degrees."
    ], pausesMs: [0, 950] },
    { id: "math-24", subject: "math", lines: [
      "Why does subtraction take its time?",
      "It works through each step carefully."
    ], pausesMs: [0, 950] },
    { id: "math-25", subject: "math", lines: [
      "Why do squares feel stable?",
      "All their sides are equal and steady."
    ], pausesMs: [0, 950] },
    { id: "math-26", subject: "math", lines: [
      "Why does addition bring things together?",
      "It builds on what's already there."
    ], pausesMs: [0, 950] },
    { id: "math-27", subject: "math", lines: [
      "Why do percentages feel complete?",
      "They show the whole picture in parts."
    ], pausesMs: [0, 950] },
    { id: "math-28", subject: "math", lines: [
      "Why does the number five stay centered?",
      "It's right in the middle of one through ten."
    ], pausesMs: [0, 950] },
    { id: "math-29", subject: "math", lines: [
      "Why do odd numbers stand out?",
      "They're comfortable being unique."
    ], pausesMs: [0, 900] },
    { id: "math-30", subject: "math", lines: [
      "Why does rounding help us?",
      "It makes numbers easier to work with."
    ], pausesMs: [0, 950] },
    { id: "math-31", subject: "math", lines: [
      "Why do prime numbers stay independent?",
      "They only divide by themselves and one."
    ], pausesMs: [0, 950] },
    { id: "math-32", subject: "math", lines: [
      "Why does the number fifty feel halfway?",
      "It's the midpoint to one hundred."
    ], pausesMs: [0, 950] },
    { id: "math-33", subject: "math", lines: [
      "Why do rectangles feel organized?",
      "Their opposite sides always match."
    ], pausesMs: [0, 950] },
    { id: "math-34", subject: "math", lines: [
      "Why does measurement matter?",
      "It shows us how things compare."
    ], pausesMs: [0, 900] },
    { id: "math-35", subject: "math", lines: [
      "Why do factors work together?",
      "They build numbers through multiplication."
    ], pausesMs: [0, 950] },
    { id: "math-36", subject: "math", lines: [
      "Why does symmetry feel balanced?",
      "Both sides mirror each other perfectly."
    ], pausesMs: [0, 950] },
    { id: "math-37", subject: "math", lines: [
      "Why does doubling speed things up?",
      "It multiplies by two in one step."
    ], pausesMs: [0, 950] },
    { id: "math-38", subject: "math", lines: [
      "Why do angles fit together?",
      "They share vertices and work as a system."
    ], pausesMs: [0, 950] },
    { id: "math-39", subject: "math", lines: [
      "Why does estimation help us?",
      "It gives us a quick sense of size."
    ], pausesMs: [0, 950] },
    { id: "math-40", subject: "math", lines: [
      "Why do coordinates show location?",
      "They mark exact positions on a grid."
    ], pausesMs: [0, 950] },
    { id: "math-41", subject: "math", lines: [
      "Why does the number twelve feel complete?",
      "It divides evenly so many ways."
    ], pausesMs: [0, 950] },
    { id: "math-42", subject: "math", lines: [
      "Why do patterns help us learn?",
      "They show us what comes next."
    ], pausesMs: [0, 900] },
    { id: "math-43", subject: "math", lines: [
      "Why does halving split things evenly?",
      "It creates two equal parts."
    ], pausesMs: [0, 900] },
    { id: "math-44", subject: "math", lines: [
      "Why do perpendicular lines meet cleanly?",
      "They form perfect right angles."
    ], pausesMs: [0, 950] },
    { id: "math-45", subject: "math", lines: [
      "Why does regrouping help addition?",
      "It organizes values by place."
    ], pausesMs: [0, 950] },
    { id: "math-46", subject: "math", lines: [
      "Why do multiples follow patterns?",
      "They repeat in steady intervals."
    ], pausesMs: [0, 950] },
    { id: "math-47", subject: "math", lines: [
      "Why does area measure space?",
      "It shows how much surface something covers."
    ], pausesMs: [0, 950] },
    { id: "math-48", subject: "math", lines: [
      "Why do number lines help us?",
      "They show how numbers connect in order."
    ], pausesMs: [0, 950] },
    { id: "math-49", subject: "math", lines: [
      "Why does the number twenty feel round?",
      "It's two groups of ten."
    ], pausesMs: [0, 900] },
    { id: "math-50", subject: "math", lines: [
      "Why do denominators anchor fractions?",
      "They show how many parts make the whole."
    ], pausesMs: [0, 950] },
    { id: "math-51", subject: "math", lines: [
      "Why does borrowing help subtraction?",
      "It moves value from one place to another."
    ], pausesMs: [0, 950] },
    { id: "math-52", subject: "math", lines: [
      "Why do arrays organize multiplication?",
      "They show rows and columns clearly."
    ], pausesMs: [0, 950] },
    { id: "math-53", subject: "math", lines: [
      "Why does perimeter go around?",
      "It measures the edge of a shape."
    ], pausesMs: [0, 950] },
    { id: "math-54", subject: "math", lines: [
      "Why do graphs show relationships?",
      "They turn numbers into pictures."
    ], pausesMs: [0, 900] },
    { id: "math-55", subject: "math", lines: [
      "Why does the number three feel strong?",
      "It forms the base of triangles."
    ], pausesMs: [0, 900] },
    { id: "math-56", subject: "math", lines: [
      "Why do negative numbers go below zero?",
      "They show what's less than nothing."
    ], pausesMs: [0, 950] },
    { id: "math-57", subject: "math", lines: [
      "Why does comparing help us decide?",
      "It shows which is greater or less."
    ], pausesMs: [0, 950] },
    { id: "math-58", subject: "math", lines: [
      "Why do ratios show relationships?",
      "They compare two quantities directly."
    ], pausesMs: [0, 950] },
    { id: "math-59", subject: "math", lines: [
      "Why does volume measure inside?",
      "It shows how much space something holds."
    ], pausesMs: [0, 950] },
    { id: "math-60", subject: "math", lines: [
      "Why do equations balance perfectly?",
      "Both sides hold equal value."
    ], pausesMs: [0, 900] },
  ],
  science: [
    { id: "science-01", subject: "science", lines: [
      "Why can't you trust atoms?",
      "They make up everything!"
    ], pausesMs: [0, 900] },
    { id: "science-02", subject: "science", lines: [
      "Why do plants stay so grounded?",
      "They have deep roots in the earth."
    ], pausesMs: [0, 950] },
    { id: "science-03", subject: "science", lines: [
      "Why does water flow so smoothly?",
      "It knows how to stay fluid."
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
      "Why do scientists love patterns?",
      "They help make sense of the world."
    ], pausesMs: [0, 950] },
    { id: "science-08", subject: "science", lines: [
      "What did one ocean say to the other?",
      "Nothing, they just waved!"
    ], pausesMs: [0, 900] },
    { id: "science-09", subject: "science", lines: [
      "Why does the sun always shine?",
      "It's the center of attention."
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
      "Why do rocks stay so calm?",
      "They take millions of years to change."
    ], pausesMs: [0, 950] },
    { id: "science-13", subject: "science", lines: [
      "Why do bees work together?",
      "They understand the power of teamwork."
    ], pausesMs: [0, 950] },
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
      "Why do magnets stay connected?",
      "They're attracted to each other."
    ], pausesMs: [0, 900] },
    { id: "science-18", subject: "science", lines: [
      "What's a tree's favorite drink?",
      "Root beer!"
    ], pausesMs: [0, 900] },
    { id: "science-19", subject: "science", lines: [
      "Why does gravity keep us grounded?",
      "It pulls everything together steadily."
    ], pausesMs: [0, 950] },
    { id: "science-20", subject: "science", lines: [
      "Why do stars twinkle?",
      "They're winking at each other across space."
    ], pausesMs: [0, 950] },
    { id: "science-21", subject: "science", lines: [
      "Why do ecosystems stay balanced?",
      "Every part depends on the others."
    ], pausesMs: [0, 950] },
    { id: "science-22", subject: "science", lines: [
      "Why does photosynthesis happen?",
      "Plants turn sunlight into food steadily."
    ], pausesMs: [0, 950] },
    { id: "science-23", subject: "science", lines: [
      "Why do cells work together?",
      "They build living things one step at a time."
    ], pausesMs: [0, 950] },
    { id: "science-24", subject: "science", lines: [
      "Why does evaporation happen slowly?",
      "Water molecules leave one by one."
    ], pausesMs: [0, 950] },
    { id: "science-25", subject: "science", lines: [
      "Why do seasons change?",
      "Earth tilts as it orbits the sun."
    ], pausesMs: [0, 900] },
    { id: "science-26", subject: "science", lines: [
      "Why do fossils tell stories?",
      "They preserve life from long ago."
    ], pausesMs: [0, 950] },
    { id: "science-27", subject: "science", lines: [
      "Why does condensation form drops?",
      "Water vapor cools and gathers together."
    ], pausesMs: [0, 950] },
    { id: "science-28", subject: "science", lines: [
      "Why do animals adapt?",
      "They change to fit their environment."
    ], pausesMs: [0, 950] },
    { id: "science-29", subject: "science", lines: [
      "Why does friction slow things down?",
      "Surfaces rub against each other."
    ], pausesMs: [0, 950] },
    { id: "science-30", subject: "science", lines: [
      "Why do metamorphic rocks change?",
      "Heat and pressure reshape them over time."
    ], pausesMs: [0, 950] },
    { id: "science-31", subject: "science", lines: [
      "Why does the water cycle continue?",
      "Water moves between earth, sky, and sea."
    ], pausesMs: [0, 950] },
    { id: "science-32", subject: "science", lines: [
      "Why do food chains connect?",
      "Energy flows from one living thing to another."
    ], pausesMs: [0, 950] },
    { id: "science-33", subject: "science", lines: [
      "Why does air pressure change?",
      "Molecules push differently at different heights."
    ], pausesMs: [0, 950] },
    { id: "science-34", subject: "science", lines: [
      "Why do shadows follow us?",
      "Light can't pass through solid objects."
    ], pausesMs: [0, 950] },
    { id: "science-35", subject: "science", lines: [
      "Why do volcanoes erupt?",
      "Pressure builds until magma finds a way out."
    ], pausesMs: [0, 950] },
    { id: "science-36", subject: "science", lines: [
      "Why do bones stay strong?",
      "They're made of minerals and living cells."
    ], pausesMs: [0, 950] },
    { id: "science-37", subject: "science", lines: [
      "Why does sound travel?",
      "Vibrations move through air as waves."
    ], pausesMs: [0, 950] },
    { id: "science-38", subject: "science", lines: [
      "Why do seeds sprout?",
      "They hold everything needed to start growing."
    ], pausesMs: [0, 950] },
    { id: "science-39", subject: "science", lines: [
      "Why does weathering break rocks?",
      "Wind and water wear them down slowly."
    ], pausesMs: [0, 950] },
    { id: "science-40", subject: "science", lines: [
      "Why do lungs breathe steadily?",
      "They bring in oxygen and release carbon dioxide."
    ], pausesMs: [0, 950] },
    { id: "science-41", subject: "science", lines: [
      "Why do planets orbit?",
      "Gravity keeps them moving around the sun."
    ], pausesMs: [0, 950] },
    { id: "science-42", subject: "science", lines: [
      "Why does ice float?",
      "It's less dense than liquid water."
    ], pausesMs: [0, 900] },
    { id: "science-43", subject: "science", lines: [
      "Why do muscles work in pairs?",
      "One pulls while the other relaxes."
    ], pausesMs: [0, 950] },
    { id: "science-44", subject: "science", lines: [
      "Why does electricity flow?",
      "Electrons move through conductors steadily."
    ], pausesMs: [0, 950] },
    { id: "science-45", subject: "science", lines: [
      "Why do habitats support life?",
      "They provide food, water, and shelter."
    ], pausesMs: [0, 950] },
    { id: "science-46", subject: "science", lines: [
      "Why does the heart pump?",
      "It moves blood through the body constantly."
    ], pausesMs: [0, 950] },
    { id: "science-47", subject: "science", lines: [
      "Why do earthquakes shake?",
      "Tectonic plates shift and release energy."
    ], pausesMs: [0, 950] },
    { id: "science-48", subject: "science", lines: [
      "Why does decomposition happen?",
      "Organisms break down matter into nutrients."
    ], pausesMs: [0, 950] },
    { id: "science-49", subject: "science", lines: [
      "Why do clouds form shapes?",
      "Wind and temperature shape water droplets."
    ], pausesMs: [0, 950] },
    { id: "science-50", subject: "science", lines: [
      "Why does digestion take time?",
      "Food breaks down step by step."
    ], pausesMs: [0, 900] },
    { id: "science-51", subject: "science", lines: [
      "Why do circuits complete loops?",
      "Electricity needs a path to flow."
    ], pausesMs: [0, 950] },
    { id: "science-52", subject: "science", lines: [
      "Why does erosion change landscapes?",
      "Moving water carries soil away gradually."
    ], pausesMs: [0, 950] },
    { id: "science-53", subject: "science", lines: [
      "Why do stems transport water?",
      "They move it from roots to leaves."
    ], pausesMs: [0, 950] },
    { id: "science-54", subject: "science", lines: [
      "Why does matter change states?",
      "Temperature adds or removes energy."
    ], pausesMs: [0, 950] },
    { id: "science-55", subject: "science", lines: [
      "Why do predators hunt?",
      "They need energy to survive."
    ], pausesMs: [0, 900] },
    { id: "science-56", subject: "science", lines: [
      "Why does the brain coordinate?",
      "It sends signals through the nervous system."
    ], pausesMs: [0, 950] },
    { id: "science-57", subject: "science", lines: [
      "Why do magnets have poles?",
      "Opposite ends attract and like ends repel."
    ], pausesMs: [0, 950] },
    { id: "science-58", subject: "science", lines: [
      "Why does sediment layer?",
      "Particles settle in the order they fall."
    ], pausesMs: [0, 950] },
    { id: "science-59", subject: "science", lines: [
      "Why do insects metamorphose?",
      "They transform to match each life stage."
    ], pausesMs: [0, 950] },
    { id: "science-60", subject: "science", lines: [
      "Why does momentum keep things moving?",
      "Objects in motion tend to stay in motion."
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
      "Why do sentences need structure?",
      "So ideas can stand together clearly."
    ], pausesMs: [0, 950] },
    { id: "language-arts-05", subject: "language arts", lines: [
      "Why do paragraphs stay organized?",
      "They group related thoughts together."
    ], pausesMs: [0, 950] },
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
      "Why do words work together?",
      "They build meaning one step at a time."
    ], pausesMs: [0, 950] },
    { id: "language-arts-11", subject: "language arts", lines: [
      "Why do good readers take their time?",
      "They let the story unfold naturally."
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
      "Why do periods end sentences?",
      "They give thoughts a clear stopping point."
    ], pausesMs: [0, 950] },
    { id: "language-arts-16", subject: "language arts", lines: [
      "Why do subjects and verbs work together?",
      "They need each other to make sense."
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
      "Why do good stories take their time?",
      "They let the plot develop steadily."
    ], pausesMs: [0, 950] },
    { id: "language-arts-20", subject: "language arts", lines: [
      "Why do writers revise carefully?",
      "They want each word to carry meaning."
    ], pausesMs: [0, 950] },
    { id: "language-arts-21", subject: "language arts", lines: [
      "Why do adjectives describe?",
      "They paint pictures with words."
    ], pausesMs: [0, 900] },
    { id: "language-arts-22", subject: "language arts", lines: [
      "Why do verbs show action?",
      "They tell us what's happening."
    ], pausesMs: [0, 900] },
    { id: "language-arts-23", subject: "language arts", lines: [
      "Why do nouns name things?",
      "They give us words for everything around us."
    ], pausesMs: [0, 950] },
    { id: "language-arts-24", subject: "language arts", lines: [
      "Why do metaphors compare?",
      "They connect ideas in creative ways."
    ], pausesMs: [0, 950] },
    { id: "language-arts-25", subject: "language arts", lines: [
      "Why does punctuation guide us?",
      "It shows where to pause and how to read."
    ], pausesMs: [0, 950] },
    { id: "language-arts-26", subject: "language arts", lines: [
      "Why do authors choose words carefully?",
      "Each word shapes the reader's experience."
    ], pausesMs: [0, 950] },
    { id: "language-arts-27", subject: "language arts", lines: [
      "Why do capital letters start sentences?",
      "They signal a new thought is beginning."
    ], pausesMs: [0, 950] },
    { id: "language-arts-28", subject: "language arts", lines: [
      "Why do pronouns replace nouns?",
      "They keep sentences from repeating."
    ], pausesMs: [0, 950] },
    { id: "language-arts-29", subject: "language arts", lines: [
      "Why does dialogue bring characters alive?",
      "We hear their voices and personalities."
    ], pausesMs: [0, 950] },
    { id: "language-arts-30", subject: "language arts", lines: [
      "Why do adverbs modify verbs?",
      "They show how actions happen."
    ], pausesMs: [0, 900] },
    { id: "language-arts-31", subject: "language arts", lines: [
      "Why does spelling matter?",
      "It helps everyone understand the same word."
    ], pausesMs: [0, 950] },
    { id: "language-arts-32", subject: "language arts", lines: [
      "Why do prefixes change meaning?",
      "They add new ideas to the start of words."
    ], pausesMs: [0, 950] },
    { id: "language-arts-33", subject: "language arts", lines: [
      "Why do suffixes build words?",
      "They change form and function at the end."
    ], pausesMs: [0, 950] },
    { id: "language-arts-34", subject: "language arts", lines: [
      "Why do similes use like or as?",
      "They make comparisons clear."
    ], pausesMs: [0, 900] },
    { id: "language-arts-35", subject: "language arts", lines: [
      "Why does rhyme create rhythm?",
      "Similar sounds connect and flow together."
    ], pausesMs: [0, 950] },
    { id: "language-arts-36", subject: "language arts", lines: [
      "Why do quotation marks show speech?",
      "They tell us someone is talking."
    ], pausesMs: [0, 950] },
    { id: "language-arts-37", subject: "language arts", lines: [
      "Why does alliteration sound smooth?",
      "Repeating sounds create a steady beat."
    ], pausesMs: [0, 950] },
    { id: "language-arts-38", subject: "language arts", lines: [
      "Why do compound words join?",
      "Two words create one new meaning."
    ], pausesMs: [0, 900] },
    { id: "language-arts-39", subject: "language arts", lines: [
      "Why does context give clues?",
      "Surrounding words help us understand."
    ], pausesMs: [0, 950] },
    { id: "language-arts-40", subject: "language arts", lines: [
      "Why do synonyms offer choices?",
      "Different words can mean the same thing."
    ], pausesMs: [0, 950] },
    { id: "language-arts-41", subject: "language arts", lines: [
      "Why do antonyms show contrast?",
      "Opposite words highlight differences."
    ], pausesMs: [0, 950] },
    { id: "language-arts-42", subject: "language arts", lines: [
      "Why does tone affect meaning?",
      "It shows the author's attitude clearly."
    ], pausesMs: [0, 950] },
    { id: "language-arts-43", subject: "language arts", lines: [
      "Why do exclamation points add energy?",
      "They show strong feelings."
    ], pausesMs: [0, 900] },
    { id: "language-arts-44", subject: "language arts", lines: [
      "Why does foreshadowing build suspense?",
      "It hints at what's coming next."
    ], pausesMs: [0, 950] },
    { id: "language-arts-45", subject: "language arts", lines: [
      "Why do transitional words connect ideas?",
      "They guide readers from thought to thought."
    ], pausesMs: [0, 950] },
    { id: "language-arts-46", subject: "language arts", lines: [
      "Why does imagery paint pictures?",
      "Descriptive language helps us see and feel."
    ], pausesMs: [0, 950] },
    { id: "language-arts-47", subject: "language arts", lines: [
      "Why do homophones sound alike?",
      "Different words can share the same sound."
    ], pausesMs: [0, 950] },
    { id: "language-arts-48", subject: "language arts", lines: [
      "Why does voice make writing unique?",
      "Each author has their own style."
    ], pausesMs: [0, 950] },
    { id: "language-arts-49", subject: "language arts", lines: [
      "Why do question marks signal inquiry?",
      "They show we're asking something."
    ], pausesMs: [0, 900] },
    { id: "language-arts-50", subject: "language arts", lines: [
      "Why does personification bring objects alive?",
      "It gives human traits to non-human things."
    ], pausesMs: [0, 950] },
    { id: "language-arts-51", subject: "language arts", lines: [
      "Why do conjunctions join?",
      "They connect words, phrases, and clauses."
    ], pausesMs: [0, 950] },
    { id: "language-arts-52", subject: "language arts", lines: [
      "Why does repetition emphasize?",
      "Saying something twice makes it stronger."
    ], pausesMs: [0, 950] },
    { id: "language-arts-53", subject: "language arts", lines: [
      "Why do roots give word meaning?",
      "They hold the core idea inside."
    ], pausesMs: [0, 900] },
    { id: "language-arts-54", subject: "language arts", lines: [
      "Why does setting establish mood?",
      "Time and place shape how we feel."
    ], pausesMs: [0, 950] },
    { id: "language-arts-55", subject: "language arts", lines: [
      "Why do contractions shorten?",
      "They combine words for quicker speech."
    ], pausesMs: [0, 950] },
    { id: "language-arts-56", subject: "language arts", lines: [
      "Why does chronological order help?",
      "It shows events in the order they happened."
    ], pausesMs: [0, 950] },
    { id: "language-arts-57", subject: "language arts", lines: [
      "Why do main ideas anchor paragraphs?",
      "They give focus to all the details."
    ], pausesMs: [0, 950] },
    { id: "language-arts-58", subject: "language arts", lines: [
      "Why does inference let us read deeper?",
      "We figure out what's not directly stated."
    ], pausesMs: [0, 950] },
    { id: "language-arts-59", subject: "language arts", lines: [
      "Why do prepositions show position?",
      "They tell us where things are."
    ], pausesMs: [0, 900] },
    { id: "language-arts-60", subject: "language arts", lines: [
      "Why does editing polish writing?",
      "It removes errors and sharpens meaning."
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
      "Why do communities work together?",
      "They understand the strength of cooperation."
    ], pausesMs: [0, 950] },
    { id: "social-05", subject: "social studies", lines: [
      "Why do maps help us understand the world?",
      "They show us how everything connects."
    ], pausesMs: [0, 950] },
    { id: "social-06", subject: "social studies", lines: [
      "What's a mummy's favorite kind of music?",
      "Wrap!"
    ], pausesMs: [0, 900] },
    { id: "social-07", subject: "social studies", lines: [
      "Why do historians study the past?",
      "It helps us understand today more clearly."
    ], pausesMs: [0, 950] },
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
      "Why do explorers keep moving forward?",
      "They're curious about what's next."
    ], pausesMs: [0, 950] },
    { id: "social-12", subject: "social studies", lines: [
      "Why do statues always look serious?",
      "They can't crack a smile!"
    ], pausesMs: [0, 900] },
    { id: "social-13", subject: "social studies", lines: [
      "Why do governments have rules?",
      "They help everyone know what to expect."
    ], pausesMs: [0, 950] },
    { id: "social-14", subject: "social studies", lines: [
      "Why do cultures share stories?",
      "They pass wisdom from one generation to the next."
    ], pausesMs: [0, 950] },
    { id: "social-15", subject: "social studies", lines: [
      "Why was the landmark so popular?",
      "Everyone wanted a picture with it!"
    ], pausesMs: [0, 950] },
    { id: "social-16", subject: "social studies", lines: [
      "Why do calendars help us stay organized?",
      "They show us how time flows steadily."
    ], pausesMs: [0, 950] },
    { id: "social-17", subject: "social studies", lines: [
      "Why do elections matter?",
      "They let everyone's voice be heard."
    ], pausesMs: [0, 900] },
    { id: "social-18", subject: "social studies", lines: [
      "Why does learning geography help us?",
      "It shows us where we fit in the world."
    ], pausesMs: [0, 950] },
    { id: "social-19", subject: "social studies", lines: [
      "Why do timelines help us understand history?",
      "They show how events connect over time."
    ], pausesMs: [0, 950] },
    { id: "social-20", subject: "social studies", lines: [
      "Why do good citizens care for their community?",
      "They understand we're all connected."
    ], pausesMs: [0, 950] },
    { id: "social-21", subject: "social studies", lines: [
      "Why do treaties bring peace?",
      "Agreements prevent future conflicts."
    ], pausesMs: [0, 900] },
    { id: "social-22", subject: "social studies", lines: [
      "Why do immigrants bring culture?",
      "They share traditions from their homeland."
    ], pausesMs: [0, 950] },
    { id: "social-23", subject: "social studies", lines: [
      "Why do timelines show order?",
      "They arrange events in sequence."
    ], pausesMs: [0, 900] },
    { id: "social-24", subject: "social studies", lines: [
      "Why does trade connect countries?",
      "Exchanging goods benefits everyone."
    ], pausesMs: [0, 950] },
    { id: "social-25", subject: "social studies", lines: [
      "Why do national parks preserve nature?",
      "They protect land for future generations."
    ], pausesMs: [0, 950] },
    { id: "social-26", subject: "social studies", lines: [
      "Why does supply and demand set prices?",
      "Available goods and buyers create balance."
    ], pausesMs: [0, 950] },
    { id: "social-27", subject: "social studies", lines: [
      "Why do monuments honor memory?",
      "They remind us of important events and people."
    ], pausesMs: [0, 950] },
    { id: "social-28", subject: "social studies", lines: [
      "Why does currency simplify trade?",
      "Money replaces bartering items."
    ], pausesMs: [0, 900] },
    { id: "social-29", subject: "social studies", lines: [
      "Why do explorers map territories?",
      "They show others what they discovered."
    ], pausesMs: [0, 950] },
    { id: "social-30", subject: "social studies", lines: [
      "Why do taxes fund services?",
      "Collected money pays for community needs."
    ], pausesMs: [0, 950] },
    { id: "social-31", subject: "social studies", lines: [
      "Why does geography shape culture?",
      "Land and climate influence how we live."
    ], pausesMs: [0, 950] },
    { id: "social-32", subject: "social studies", lines: [
      "Why do amendments update laws?",
      "They reflect changing needs and values."
    ], pausesMs: [0, 950] },
    { id: "social-33", subject: "social studies", lines: [
      "Why does urban planning organize cities?",
      "It arranges spaces for people to live and work."
    ], pausesMs: [0, 950] },
    { id: "social-34", subject: "social studies", lines: [
      "Why do primary sources matter?",
      "They give firsthand accounts of history."
    ], pausesMs: [0, 950] },
    { id: "social-35", subject: "social studies", lines: [
      "Why does infrastructure support communities?",
      "Roads, bridges, and utilities connect us."
    ], pausesMs: [0, 950] },
    { id: "social-36", subject: "social studies", lines: [
      "Why do traditions pass down?",
      "Families share customs through generations."
    ], pausesMs: [0, 950] },
    { id: "social-37", subject: "social studies", lines: [
      "Why does the legislative branch write laws?",
      "Representatives create rules for everyone."
    ], pausesMs: [0, 950] },
    { id: "social-38", subject: "social studies", lines: [
      "Why do borders define nations?",
      "They mark where one country ends and another begins."
    ], pausesMs: [0, 950] },
    { id: "social-39", subject: "social studies", lines: [
      "Why does the judicial branch interpret laws?",
      "Courts decide what laws mean."
    ], pausesMs: [0, 900] },
    { id: "social-40", subject: "social studies", lines: [
      "Why do historians analyze evidence?",
      "They piece together stories from the past."
    ], pausesMs: [0, 950] },
    { id: "social-41", subject: "social studies", lines: [
      "Why does census count population?",
      "Numbers help plan resources and representation."
    ], pausesMs: [0, 950] },
    { id: "social-42", subject: "social studies", lines: [
      "Why do symbols represent nations?",
      "They unify people under shared meaning."
    ], pausesMs: [0, 950] },
    { id: "social-43", subject: "social studies", lines: [
      "Why does latitude measure distance?",
      "Lines show how far north or south you are."
    ], pausesMs: [0, 950] },
    { id: "social-44", subject: "social studies", lines: [
      "Why does longitude measure position?",
      "Lines show how far east or west you are."
    ], pausesMs: [0, 950] },
    { id: "social-45", subject: "social studies", lines: [
      "Why do checks and balances limit power?",
      "Each branch watches the others."
    ], pausesMs: [0, 950] },
    { id: "social-46", subject: "social studies", lines: [
      "Why does migration change populations?",
      "People move to find better opportunities."
    ], pausesMs: [0, 950] },
    { id: "social-47", subject: "social studies", lines: [
      "Why does federalism divide authority?",
      "States and national government share control."
    ], pausesMs: [0, 950] },
    { id: "social-48", subject: "social studies", lines: [
      "Why do climate zones vary?",
      "Distance from the equator changes temperature."
    ], pausesMs: [0, 950] },
    { id: "social-49", subject: "social studies", lines: [
      "Why does the executive branch enforce laws?",
      "The president makes sure rules are followed."
    ], pausesMs: [0, 950] },
    { id: "social-50", subject: "social studies", lines: [
      "Why do revolutions spark change?",
      "People fight for new systems and rights."
    ], pausesMs: [0, 950] },
    { id: "social-51", subject: "social studies", lines: [
      "Why does archaeology uncover history?",
      "Digging reveals artifacts from the past."
    ], pausesMs: [0, 950] },
    { id: "social-52", subject: "social studies", lines: [
      "Why do resources drive economies?",
      "Materials and labor create products."
    ], pausesMs: [0, 950] },
    { id: "social-53", subject: "social studies", lines: [
      "Why does citizenship carry duties?",
      "Rights come with responsibilities."
    ], pausesMs: [0, 900] },
    { id: "social-54", subject: "social studies", lines: [
      "Why do legends preserve stories?",
      "Tales pass wisdom through generations."
    ], pausesMs: [0, 950] },
    { id: "social-55", subject: "social studies", lines: [
      "Why does scale help maps?",
      "It shows distance in real terms."
    ], pausesMs: [0, 900] },
    { id: "social-56", subject: "social studies", lines: [
      "Why does sovereignty define independence?",
      "Nations govern themselves freely."
    ], pausesMs: [0, 950] },
    { id: "social-57", subject: "social studies", lines: [
      "Why do constitutions limit government?",
      "They protect individual freedoms."
    ], pausesMs: [0, 950] },
    { id: "social-58", subject: "social studies", lines: [
      "Why does conflict shape borders?",
      "Wars and agreements redraw maps."
    ], pausesMs: [0, 950] },
    { id: "social-59", subject: "social studies", lines: [
      "Why does protest express opinion?",
      "People gather to voice disagreement."
    ], pausesMs: [0, 950] },
    { id: "social-60", subject: "social studies", lines: [
      "Why does interdependence connect nations?",
      "Countries rely on each other for needs."
    ], pausesMs: [0, 950] },
  ],
};

export default jokesBySubject;
