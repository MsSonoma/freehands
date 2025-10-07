// Kid-friendly riddle catalog with simple timing metadata.
// Usage idea:
//   import { riddlesBySubject, renderRiddle } from '@/app/lib/riddles'
//   const riddle = riddlesBySubject.math[0]
//   const textToSend = renderRiddle(riddle) // lines joined with blank lines for pacing

/**
 * @typedef {Object} Riddle
 * @property {string} id
 * @property {('math'|'science'|'language arts'|'social studies')} subject
 * @property {string[]} lines
 * @property {number[]} pausesMs
 * @property {string} answer
 */

export function renderRiddle(riddle) {
  try { return Array.isArray(riddle?.lines) ? riddle.lines.join('\n\n') : ''; }
  catch { return ''; }
}

export function getRiddlesForSubject(subject) {
  return riddlesBySubject[subject] || [];
}

export function pickNextRiddle(subject) {
  console.log('[pickNextRiddle] Called with subject:', subject);
  const list = getRiddlesForSubject(subject);
  console.log('[pickNextRiddle] Got list with length:', list?.length);
  if (!list.length) return null;
  if (typeof window === 'undefined') return list[0];
  try {
    const key = `riddle_idx_${subject.replace(/\s+/g,'_')}`;
    let idx = Number.parseInt(localStorage.getItem(key) || '', 10);
    if (!Number.isFinite(idx) || idx < 0 || idx >= list.length) idx = Math.floor(Math.random() * list.length);
    else idx = (idx + 1) % list.length;
    localStorage.setItem(key, String(idx));
    const result = list[idx];
    console.log('[pickNextRiddle] Returning riddle:', result?.id);
    return result;
  } catch { return list[Math.floor(Math.random() * list.length)]; }
}

/** @type {Record<'math'|'science'|'language arts'|'social studies', Riddle[]>} */
export const riddlesBySubject = {
  math: [
    { id: 'math-01', subject: 'math', lines: ['I am an even number.', 'Remove one letter and I become odd.', 'What number am I?'], pausesMs:[400,400,0], answer: 'Seven -> remove s? Trick: Six (remove S = ix) - simpler: Six' },
    { id: 'math-02', subject: 'math', lines: ['I have keys but no locks,', 'I have space but no room.', 'You can enter but not go in.', 'What am I?'], pausesMs:[400,400,400,0], answer: 'A keyboard' },
    { id: 'math-03', subject: 'math', lines: ['I come in pairs and add up fast,', 'Two twos and two twos make a cast.', 'What am I?'], pausesMs:[400,400,0], answer: 'Four (2+2), simple counting riddle' },
    { id: 'math-04', subject: 'math', lines: ['I am a shape with four equal sides,', 'But I’m pushed, turned, and sometimes slide.', 'What am I?'], pausesMs:[400,400,0], answer: 'A square' },
    { id: 'math-05', subject: 'math', lines: ['If you multiply me by any number,', 'I stay the same.', 'What number am I?'], pausesMs:[400,400,0], answer: 'Zero' },
    { id: 'math-06', subject: 'math', lines: ['I am a three digit number.', 'My tens digit is five more than my ones.', 'My hundreds is eight less than my tens.', 'What number am I?'], pausesMs:[400,400,400,0], answer: '194' },
    { id: 'math-07', subject: 'math', lines: ['What number is odd, but if you take away one letter it becomes even?'], pausesMs:[0], answer: 'Seven (remove s = even)' },
    { id: 'math-08', subject: 'math', lines: ['We are a dozen minus two,', 'Together we make a dozen true.', 'Who are we?'], pausesMs:[400,400,0], answer: 'Ten (12 - 2)' },
    { id: 'math-09', subject: 'math', lines: ['What grows when you take away from it?'], pausesMs:[0], answer: 'A hole' },
    { id: 'math-10', subject: 'math', lines: ['I am a number between one and ten,', 'Double me and you still get less than twenty.', 'What am I?'], pausesMs:[400,400,0], answer: 'Eight' },
    { id: 'math-11', subject: 'math', lines: ['I can be divided but never move,', 'I have sides you might approve.', 'What am I?'], pausesMs:[400,400,0], answer: 'A pizza (slices)' },
    { id: 'math-12', subject: 'math', lines: ['I have no beginning, end, or sides,', 'Round and round a secret hides.', 'What am I?'], pausesMs:[400,400,0], answer: 'A circle' },
    { id: 'math-13', subject: 'math', lines: ['What is full of holes but still holds water?'], pausesMs:[0], answer: 'A sponge' },
    { id: 'math-14', subject: 'math', lines: ['Which month has 28 days?'], pausesMs:[0], answer: 'All of them' },
    { id: 'math-15', subject: 'math', lines: ['I add nothing but I make things whole.', 'What am I?'], pausesMs:[400,0], answer: 'Zero or 0 makes whole? Could be trick: zero' },
    { id: 'math-16', subject: 'math', lines: ['How many sides does a circle have?'], pausesMs:[0], answer: 'Two (inside and outside) — classic joke' },
    { id: 'math-17', subject: 'math', lines: ['What comes once in a minute, twice in a moment, but never in an hour?'], pausesMs:[0], answer: 'The letter M' },
    { id: 'math-18', subject: 'math', lines: ['I am an odd number.', 'Take away one letter and I become even.', 'What am I?'], pausesMs:[400,400,0], answer: 'Seven' },
    { id: 'math-19', subject: 'math', lines: ['Ten plus me equals me plus ten,', 'I am the same no matter when.', 'What number am I?'], pausesMs:[400,400,0], answer: 'Any number (commutative joke)' },
    { id: 'math-20', subject: 'math', lines: ['If you have me you want to share me,', 'If you share me you don’t have me.','What am I?'], pausesMs:[400,400,0], answer: 'A secret' },
  ],
  science: [
    { id: 'science-01', subject: 'science', lines: ['I can be cracked, made, told, and played.', 'What am I?'], pausesMs:[400,0], answer: 'A joke' },
    { id: 'science-02', subject: 'science', lines: ['I go up when rain comes down.', 'What am I?'], pausesMs:[400,0], answer: 'An umbrella (opens)' },
    { id: 'science-03', subject: 'science', lines: ['I’m not alive but I grow.', 'I don’t have lungs but need air.', 'I don’t have a mouth but water kills me.', 'What am I?'], pausesMs:[400,400,400,0], answer: 'Fire' },
    { id: 'science-04', subject: 'science', lines: ['What flies without wings and cries without eyes?'], pausesMs:[0], answer: 'A cloud' },
    { id: 'science-05', subject: 'science', lines: ['What gets wetter as it dries?'], pausesMs:[0], answer: 'A towel' },
    { id: 'science-06', subject: 'science', lines: ['I have teeth but cannot bite.', 'What am I?'], pausesMs:[400,0], answer: 'A comb' },
    { id: 'science-07', subject: 'science', lines: ['I follow you all day,', 'But disappear at night.', 'What am I?'], pausesMs:[400,400,0], answer: 'Your shadow' },
    { id: 'science-08', subject: 'science', lines: ['The more you take, the more you leave behind.', 'What am I?'], pausesMs:[400,0], answer: 'Footsteps' },
    { id: 'science-09', subject: 'science', lines: ['I can be cracked and I can be told.', 'I can be played and I can be bold.', 'What am I?'], pausesMs:[400,400,0], answer: 'A joke' },
    { id: 'science-10', subject: 'science', lines: ['What has a neck but no head?'], pausesMs:[0], answer: 'A bottle' },
    { id: 'science-11', subject: 'science', lines: ['What has hands but cannot clap?'], pausesMs:[0], answer: 'A clock' },
    { id: 'science-12', subject: 'science', lines: ['I travel the world but always stay in a corner.', 'What am I?'], pausesMs:[400,0], answer: 'A stamp' },
    { id: 'science-13', subject: 'science', lines: ['What can’t talk but will reply when spoken to?'], pausesMs:[0], answer: 'An echo' },
    { id: 'science-14', subject: 'science', lines: ['What can run but never walks?'], pausesMs:[0], answer: 'Water (a river)' },
    { id: 'science-15', subject: 'science', lines: ['I have cities but no houses,', 'Mountains but no trees,', 'Water but no fish.', 'What am I?'], pausesMs:[400,400,400,0], answer: 'A map' },
    { id: 'science-16', subject: 'science', lines: ['What gets bigger the more you take away?'], pausesMs:[0], answer: 'A hole' },
    { id: 'science-17', subject: 'science', lines: ['What goes up and never comes down?'], pausesMs:[0], answer: 'Your age' },
    { id: 'science-18', subject: 'science', lines: ['What has one eye but can’t see?'], pausesMs:[0], answer: 'A needle' },
    { id: 'science-19', subject: 'science', lines: ['I’m lighter than a feather but even the strongest can’t hold me more than a few minutes.', 'What am I?'], pausesMs:[400,0], answer: 'Your breath' },
    { id: 'science-20', subject: 'science', lines: ['What has keys but can’t open locks?'], pausesMs:[0], answer: 'A piano' },
  ],
  'language arts': [
    { id: 'lang-01', subject: 'language arts', lines: ['What word becomes shorter when you add two letters to it?'], pausesMs:[0], answer: 'Short' },
    { id: 'lang-02', subject: 'language arts', lines: ['What has many words but never speaks?'], pausesMs:[0], answer: 'A book' },
    { id: 'lang-03', subject: 'language arts', lines: ['What starts with P, ends with E, and has thousands of letters?'], pausesMs:[0], answer: 'Post office' },
    { id: 'lang-04', subject: 'language arts', lines: ['What word is spelled incorrectly in every dictionary?'], pausesMs:[0], answer: 'Incorrectly' },
    { id: 'lang-05', subject: 'language arts', lines: ['I speak without a mouth and hear without ears.', 'I have no body but I come alive with wind.', 'What am I?'], pausesMs:[400,400,0], answer: 'An echo' },
    { id: 'lang-06', subject: 'language arts', lines: ['What word contains 26 letters but only three syllables?'], pausesMs:[0], answer: 'Alphabet' },
    { id: 'lang-07', subject: 'language arts', lines: ['Which word looks the same upside down and backward?'], pausesMs:[0], answer: 'SWIMS' },
    { id: 'lang-08', subject: 'language arts', lines: ['What English word has three consecutive double letters?'], pausesMs:[0], answer: 'Bookkeeper' },
  { id: 'lang-09', subject: 'language arts', lines: ['I am the beginning of the end and the end of time and space.', 'What letter am I?'], pausesMs:[400,0], answer: 'The letter E' },
  { id: 'lang-10', subject: 'language arts', lines: ['Remove my first letter and I sound the same.', 'Remove my last letter and I still sound the same.', 'What word am I?'], pausesMs:[400,400,0], answer: 'Empty (MT)' },
  { id: 'lang-11', subject: 'language arts', lines: ['What can you hold in your right hand but never your left?'], pausesMs:[0], answer: 'Your left hand' },
    { id: 'lang-12', subject: 'language arts', lines: ['What has a head and a tail but no body?'], pausesMs:[0], answer: 'A coin' },
    { id: 'lang-13', subject: 'language arts', lines: ['What gets wetter the more it dries?'], pausesMs:[0], answer: 'A towel' },
    { id: 'lang-14', subject: 'language arts', lines: ['I am taken from a mine and shut up in a wooden case, from which I am never released, and yet I am used by almost every student.', 'What am I?'], pausesMs:[400,0], answer: 'Pencil lead' },
    { id: 'lang-15', subject: 'language arts', lines: ['What question can you never answer yes to?'], pausesMs:[0], answer: 'Are you asleep?' },
    { id: 'lang-16', subject: 'language arts', lines: ['What has many keys but can’t open doors?'], pausesMs:[0], answer: 'A piano' },
    { id: 'lang-17', subject: 'language arts', lines: ['What has a ring but no finger?'], pausesMs:[0], answer: 'A telephone' },
    { id: 'lang-18', subject: 'language arts', lines: ['What word becomes shorter when you add two letters to it?'], pausesMs:[0], answer: 'Short' },
    { id: 'lang-19', subject: 'language arts', lines: ['What is the longest word in the dictionary?'], pausesMs:[0], answer: 'Smiles (a mile between S and last letter)' },
    { id: 'lang-20', subject: 'language arts', lines: ['What has a book but never reads?'], pausesMs:[0], answer: 'A bookshelf' },
  ],
  'social studies': [
    { id: 'soc-01', subject: 'social studies', lines: ['What has 50 stars but isn’t in space?'], pausesMs:[0], answer: 'The American flag' },
    { id: 'soc-02', subject: 'social studies', lines: ['What has streets but no pavement, cities but no houses, and mountains but no trees?'], pausesMs:[0], answer: 'A map' },
    { id: 'soc-03', subject: 'social studies', lines: ['What has four eyes but cannot see?'], pausesMs:[0], answer: 'Mississippi' },
    { id: 'soc-04', subject: 'social studies', lines: ['What building has the most stories?'], pausesMs:[0], answer: 'The library' },
    { id: 'soc-05', subject: 'social studies', lines: ['I run through towns but never move. What am I?'], pausesMs:[0], answer: 'A road' },
    { id: 'soc-06', subject: 'social studies', lines: ['What room has no doors or windows?'], pausesMs:[0], answer: 'A mushroom' },
    { id: 'soc-07', subject: 'social studies', lines: ['What has a neck but no head?'], pausesMs:[0], answer: 'A bottle' },
    { id: 'soc-08', subject: 'social studies', lines: ['What has a bed but never sleeps and a mouth but never eats?'], pausesMs:[0], answer: 'A river' },
    { id: 'soc-09', subject: 'social studies', lines: ['What kind of band never plays music?'], pausesMs:[0], answer: 'A rubber band' },
    { id: 'soc-10', subject: 'social studies', lines: ['What has many teeth but cannot bite?'], pausesMs:[0], answer: 'A comb' },
    { id: 'soc-11', subject: 'social studies', lines: ['I have lakes with no water, mountains with no stone, and cities with no buildings. What am I?'], pausesMs:[0], answer: 'A map' },
    { id: 'soc-12', subject: 'social studies', lines: ['What has a bed but never sleeps?'], pausesMs:[0], answer: 'A river' },
    { id: 'soc-13', subject: 'social studies', lines: ['What is always coming but never arrives?'], pausesMs:[0], answer: 'Tomorrow' },
    { id: 'soc-14', subject: 'social studies', lines: ['What can fill a room but takes up no space?'], pausesMs:[0], answer: 'Light' },
    { id: 'soc-15', subject: 'social studies', lines: ['What travels the world but stays in one spot?'], pausesMs:[0], answer: 'A stamp' },
    { id: 'soc-16', subject: 'social studies', lines: ['I have a head and a tail but no body. What am I?'], pausesMs:[0], answer: 'A coin' },
    { id: 'soc-17', subject: 'social studies', lines: ['What has many keys but can’t open a single lock?'], pausesMs:[0], answer: 'A piano' },
    { id: 'soc-18', subject: 'social studies', lines: ['What is full of holes but still holds water?'], pausesMs:[0], answer: 'A sponge' },
    { id: 'soc-19', subject: 'social studies', lines: ['What can you catch but never throw?'], pausesMs:[0], answer: 'A cold' },
    { id: 'soc-20', subject: 'social studies', lines: ['I tell stories from the past and show things from far away,', 'I usually live in a building with quiet halls.', 'What am I?'], pausesMs:[400,400,0], answer: 'A museum' },
  ],
};

export default riddlesBySubject;
