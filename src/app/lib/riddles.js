// Kid-friendly riddle catalog - Enhanced with subject-specific riddles
// Each subject has 40 riddles with single, clear answers

/**
 * @typedef {Object} Riddle
 * @property {string} id
 * @property {('math'|'science'|'language arts'|'social studies'|'general')} subject
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

/** @type {Record<'math'|'science'|'language arts'|'social studies'|'general', Riddle[]>} */
export const riddlesBySubject = {
  general: [
    // Generic riddles that work for any subject - moved from other categories
    { id: 'gen-01', subject: 'general', lines: ['What has keys but no locks,', 'I have space but no room.', 'You can enter but not go in.', 'What am I?'], pausesMs:[400,400,400,0], answer: 'keyboard' },
    { id: 'gen-02', subject: 'general', lines: ['What grows when you take away from it?'], pausesMs:[0], answer: 'hole' },
    { id: 'gen-03', subject: 'general', lines: ['What has a neck but no head?'], pausesMs:[0], answer: 'bottle' },
    { id: 'gen-04', subject: 'general', lines: ['What has hands but cannot clap?'], pausesMs:[0], answer: 'clock' },
    { id: 'gen-05', subject: 'general', lines: ['What gets wetter as it dries?'], pausesMs:[0], answer: 'towel' },
    { id: 'gen-06', subject: 'general', lines: ['What has teeth but cannot bite?'], pausesMs:[0], answer: 'comb' },
    { id: 'gen-07', subject: 'general', lines: ['The more you take, the more you leave behind.', 'What am I?'], pausesMs:[400,0], answer: 'footsteps' },
    { id: 'gen-08', subject: 'general', lines: ['I can be cracked, made, told, and played.', 'What am I?'], pausesMs:[400,0], answer: 'joke' },
    { id: 'gen-09', subject: 'general', lines: ['What cannot talk but will reply when spoken to?'], pausesMs:[0], answer: 'echo' },
    { id: 'gen-10', subject: 'general', lines: ['What goes up and never comes down?'], pausesMs:[0], answer: 'your age' },
    { id: 'gen-11', subject: 'general', lines: ['What has one eye but cannot see?'], pausesMs:[0], answer: 'needle' },
    { id: 'gen-12', subject: 'general', lines: ['I am lighter than a feather but even the strongest cannot hold me more than a few minutes.', 'What am I?'], pausesMs:[400,0], answer: 'breath' },
    { id: 'gen-13', subject: 'general', lines: ['What has keys but cannot open locks?'], pausesMs:[0], answer: 'piano' },
    { id: 'gen-14', subject: 'general', lines: ['What can you hold in your right hand but never your left?'], pausesMs:[0], answer: 'your left hand' },
    { id: 'gen-15', subject: 'general', lines: ['What has a head and a tail but no body?'], pausesMs:[0], answer: 'coin' },
    { id: 'gen-16', subject: 'general', lines: ['What question can you never answer yes to?'], pausesMs:[0], answer: 'are you asleep' },
    { id: 'gen-17', subject: 'general', lines: ['What has a ring but no finger?'], pausesMs:[0], answer: 'telephone' },
    { id: 'gen-18', subject: 'general', lines: ['What is always coming but never arrives?'], pausesMs:[0], answer: 'tomorrow' },
    { id: 'gen-19', subject: 'general', lines: ['What can fill a room but takes up no space?'], pausesMs:[0], answer: 'light' },
    { id: 'gen-20', subject: 'general', lines: ['What is full of holes but still holds water?'], pausesMs:[0], answer: 'sponge' },
    { id: 'gen-21', subject: 'general', lines: ['What can you catch but never throw?'], pausesMs:[0], answer: 'cold' },
    { id: 'gen-22', subject: 'general', lines: ['What kind of band never plays music?'], pausesMs:[0], answer: 'rubber band' },
    { id: 'gen-23', subject: 'general', lines: ['What building has the most stories?'], pausesMs:[0], answer: 'library' },
    { id: 'gen-24', subject: 'general', lines: ['What has many words but never speaks?'], pausesMs:[0], answer: 'book' },
    { id: 'gen-25', subject: 'general', lines: ['If you have me you want to share me,', 'If you share me you do not have me.','What am I?'], pausesMs:[400,400,0], answer: 'secret' },
    { id: 'gen-26', subject: 'general', lines: ['I go up when rain comes down.', 'What am I?'], pausesMs:[400,0], answer: 'umbrella' },
    { id: 'gen-27', subject: 'general', lines: ['What room has no doors or windows?'], pausesMs:[0], answer: 'mushroom' },
    { id: 'gen-28', subject: 'general', lines: ['Which month has 28 days?'], pausesMs:[0], answer: 'all of them' },
    { id: 'gen-29', subject: 'general', lines: ['I have cities but no houses,', 'Mountains but no trees,', 'Water but no fish.', 'What am I?'], pausesMs:[400,400,400,0], answer: 'map' },
    { id: 'gen-30', subject: 'general', lines: ['What has many keys but cannot open doors?'], pausesMs:[0], answer: 'piano' },
    { id: 'gen-31', subject: 'general', lines: ['What runs around the yard without moving?'], pausesMs:[0], answer: 'fence' },
    { id: 'gen-32', subject: 'general', lines: ['What gets broken without being held?'], pausesMs:[0], answer: 'promise' },
    { id: 'gen-33', subject: 'general', lines: ['What has a face but no eyes, hands but no arms?'], pausesMs:[0], answer: 'clock' },
    { id: 'gen-34', subject: 'general', lines: ['What can travel around the world while staying in a corner?'], pausesMs:[0], answer: 'stamp' },
    { id: 'gen-35', subject: 'general', lines: ['What has a bottom at the top?'], pausesMs:[0], answer: 'leg' },
    { id: 'gen-36', subject: 'general', lines: ['What tastes better than it smells?'], pausesMs:[0], answer: 'tongue' },
    { id: 'gen-37', subject: 'general', lines: ['What has four fingers and a thumb but is not alive?'], pausesMs:[0], answer: 'glove' },
    { id: 'gen-38', subject: 'general', lines: ['What comes down but never goes up?'], pausesMs:[0], answer: 'rain' },
    { id: 'gen-39', subject: 'general', lines: ['What has a spine but no bones?'], pausesMs:[0], answer: 'book' },
    { id: 'gen-40', subject: 'general', lines: ['What is so fragile that saying its name breaks it?'], pausesMs:[0], answer: 'silence' },
  ],
  math: [
    // Math-specific riddles only
    { id: 'math-01', subject: 'math', lines: ['I am an odd number.', 'Remove one letter and I become even.', 'What number am I?'], pausesMs:[400,400,0], answer: 'seven' },
    { id: 'math-02', subject: 'math', lines: ['I am a shape with four equal sides,', 'But I am pushed, turned, and sometimes slide.', 'What am I?'], pausesMs:[400,400,0], answer: 'square' },
    { id: 'math-03', subject: 'math', lines: ['If you multiply me by any number,', 'I stay the same.', 'What number am I?'], pausesMs:[400,400,0], answer: 'zero' },
    { id: 'math-04', subject: 'math', lines: ['I am a three digit number.', 'My tens digit is five more than my ones.', 'My hundreds is eight less than my tens.', 'What number am I?'], pausesMs:[400,400,400,0], answer: '194' },
    { id: 'math-05', subject: 'math', lines: ['I have no beginning, end, or sides,', 'Round and round a secret hides.', 'What am I?'], pausesMs:[400,400,0], answer: 'circle' },
    { id: 'math-06', subject: 'math', lines: ['What comes once in a minute, twice in a moment, but never in an hour?'], pausesMs:[0], answer: 'the letter m' },
    { id: 'math-07', subject: 'math', lines: ['How many sides does a circle have?'], pausesMs:[0], answer: 'two' },
    { id: 'math-08', subject: 'math', lines: ['I am the only even prime number.', 'What number am I?'], pausesMs:[400,0], answer: 'two' },
    { id: 'math-09', subject: 'math', lines: ['Add me to myself and I equal four.', 'Multiply me by myself and I still equal four.', 'What number am I?'], pausesMs:[400,400,0], answer: 'two' },
    { id: 'math-10', subject: 'math', lines: ['I have three sides and three corners.', 'My name sounds like a musical instrument.', 'What shape am I?'], pausesMs:[400,400,0], answer: 'triangle' },
    { id: 'math-11', subject: 'math', lines: ['I am greater than ten but less than twelve.', 'I am also one dozen minus one.', 'What number am I?'], pausesMs:[400,400,0], answer: 'eleven' },
    { id: 'math-12', subject: 'math', lines: ['When you add one to me I become one hundred.', 'What number am I?'], pausesMs:[400,0], answer: 'ninety nine' },
    { id: 'math-13', subject: 'math', lines: ['I am a number.', 'My digits add up to nine.', 'If you flip me upside down I become six.', 'What number am I?'], pausesMs:[400,400,400,0], answer: 'nine' },
    { id: 'math-14', subject: 'math', lines: ['Divide me in half and I am nothing.', 'What number am I?'], pausesMs:[400,0], answer: 'eight' },
    { id: 'math-15', subject: 'math', lines: ['I am the result of three times three.', 'What number am I?'], pausesMs:[400,0], answer: 'nine' },
    { id: 'math-16', subject: 'math', lines: ['I am a four sided shape with two long sides and two short sides.', 'What am I?'], pausesMs:[400,0], answer: 'rectangle' },
    { id: 'math-17', subject: 'math', lines: ['Take two from five and what do you get?'], pausesMs:[0], answer: 'three' },
    { id: 'math-18', subject: 'math', lines: ['I am less than ten and more than five.', 'I am an even number.', 'Half of me is three.', 'What number am I?'], pausesMs:[400,400,400,0], answer: 'six' },
    { id: 'math-19', subject: 'math', lines: ['How many cents are in a quarter?'], pausesMs:[0], answer: 'twenty five' },
    { id: 'math-20', subject: 'math', lines: ['If a triangle has three sides, how many sides does a pentagon have?'], pausesMs:[0], answer: 'five' },
    { id: 'math-21', subject: 'math', lines: ['I am the number of days in one week.', 'What number am I?'], pausesMs:[400,0], answer: 'seven' },
    { id: 'math-22', subject: 'math', lines: ['How many inches are in one foot?'], pausesMs:[0], answer: 'twelve' },
    { id: 'math-23', subject: 'math', lines: ['I am the number of wheels on a bicycle.', 'What number am I?'], pausesMs:[400,0], answer: 'two' },
    { id: 'math-24', subject: 'math', lines: ['What do you call a six sided shape?'], pausesMs:[0], answer: 'hexagon' },
    { id: 'math-25', subject: 'math', lines: ['How many degrees are in a right angle?'], pausesMs:[0], answer: 'ninety' },
    { id: 'math-26', subject: 'math', lines: ['I am one half of twenty.', 'What number am I?'], pausesMs:[400,0], answer: 'ten' },
    { id: 'math-27', subject: 'math', lines: ['How many minutes are in one hour?'], pausesMs:[0], answer: 'sixty' },
    { id: 'math-28', subject: 'math', lines: ['If you have four quarters, how many dollars do you have?'], pausesMs:[0], answer: 'one' },
    { id: 'math-29', subject: 'math', lines: ['I am the answer to eight minus three.', 'What number am I?'], pausesMs:[400,0], answer: 'five' },
    { id: 'math-30', subject: 'math', lines: ['How many zeros are in one thousand?'], pausesMs:[0], answer: 'three' },
    { id: 'math-31', subject: 'math', lines: ['I am a shape that looks like an egg.', 'What am I?'], pausesMs:[400,0], answer: 'oval' },
    { id: 'math-32', subject: 'math', lines: ['What is ten times ten?'], pausesMs:[0], answer: 'one hundred' },
    { id: 'math-33', subject: 'math', lines: ['How many months have exactly 30 days?'], pausesMs:[0], answer: 'four' },
    { id: 'math-34', subject: 'math', lines: ['I am the smallest two digit number.', 'What number am I?'], pausesMs:[400,0], answer: 'ten' },
    { id: 'math-35', subject: 'math', lines: ['If you count by fives, what comes after fifteen?'], pausesMs:[0], answer: 'twenty' },
    { id: 'math-36', subject: 'math', lines: ['How many dimes make one dollar?'], pausesMs:[0], answer: 'ten' },
    { id: 'math-37', subject: 'math', lines: ['I am double six.', 'What number am I?'], pausesMs:[400,0], answer: 'twelve' },
    { id: 'math-38', subject: 'math', lines: ['How many hours are in one full day?'], pausesMs:[0], answer: 'twenty four' },
    { id: 'math-39', subject: 'math', lines: ['I am the number of sides on a stop sign.', 'What number am I?'], pausesMs:[400,0], answer: 'eight' },
    { id: 'math-40', subject: 'math', lines: ['If you add five and five, what number do you get?'], pausesMs:[0], answer: 'ten' },
  ],
  science: [
    // Science-specific riddles only
    { id: 'sci-01', subject: 'science', lines: ['I am not alive but I grow.', 'I do not have lungs but need air.', 'I do not have a mouth but water kills me.', 'What am I?'], pausesMs:[400,400,400,0], answer: 'fire' },
    { id: 'sci-02', subject: 'science', lines: ['What flies without wings and cries without eyes?'], pausesMs:[0], answer: 'cloud' },
    { id: 'sci-03', subject: 'science', lines: ['I follow you all day,', 'But disappear at night.', 'What am I?'], pausesMs:[400,400,0], answer: 'shadow' },
    { id: 'sci-04', subject: 'science', lines: ['What can run but never walks?'], pausesMs:[0], answer: 'water' },
    { id: 'sci-05', subject: 'science', lines: ['I am yellow and I make everything bright.', 'I rise in the morning and set at night.', 'What am I?'], pausesMs:[400,400,0], answer: 'sun' },
    { id: 'sci-06', subject: 'science', lines: ['I am full of holes but I can hold lots of water.', 'What am I?'], pausesMs:[400,0], answer: 'sponge' },
    { id: 'sci-07', subject: 'science', lines: ['I am white and cold and fall from the sky.', 'When I melt I become water.', 'What am I?'], pausesMs:[400,400,0], answer: 'snow' },
    { id: 'sci-08', subject: 'science', lines: ['I can fly without wings.', 'I can cry without eyes.', 'Wherever I go, darkness follows me.', 'What am I?'], pausesMs:[400,400,400,0], answer: 'cloud' },
    { id: 'sci-09', subject: 'science', lines: ['I have roots that nobody sees.', 'I am taller than trees.', 'Up, up I go, yet I never grow.', 'What am I?'], pausesMs:[400,400,400,0], answer: 'mountain' },
    { id: 'sci-10', subject: 'science', lines: ['I am lighter than air but a million men cannot lift me.', 'What am I?'], pausesMs:[400,0], answer: 'bubble' },
    { id: 'sci-11', subject: 'science', lines: ['I make plants green and help them grow.', 'I happen when sunlight, water, and air mix just so.', 'What am I?'], pausesMs:[400,400,0], answer: 'photosynthesis' },
    { id: 'sci-12', subject: 'science', lines: ['I am the closest star to Earth.', 'What am I?'], pausesMs:[400,0], answer: 'sun' },
    { id: 'sci-13', subject: 'science', lines: ['I can be solid, liquid, or gas.', 'You drink me, swim in me, and see me as ice.', 'What am I?'], pausesMs:[400,400,0], answer: 'water' },
    { id: 'sci-14', subject: 'science', lines: ['I am a push or a pull.', 'I make things move or stay still.', 'What am I?'], pausesMs:[400,400,0], answer: 'force' },
    { id: 'sci-15', subject: 'science', lines: ['I am the center of our solar system.', 'Planets orbit around me.', 'What am I?'], pausesMs:[400,400,0], answer: 'sun' },
    { id: 'sci-16', subject: 'science', lines: ['I make a loud sound when I clap my hands together.', 'What kind of wave am I?'], pausesMs:[400,0], answer: 'sound wave' },
    { id: 'sci-17', subject: 'science', lines: ['I come from clouds and make puddles.', 'Plants need me to grow.', 'What am I?'], pausesMs:[400,400,0], answer: 'rain' },
    { id: 'sci-18', subject: 'science', lines: ['I have a core that is very hot.', 'I spin on my axis every day.', 'You live on me.', 'What am I?'], pausesMs:[400,400,400,0], answer: 'earth' },
    { id: 'sci-19', subject: 'science', lines: ['I am the gas you breathe in.', 'Plants make me during photosynthesis.', 'What am I?'], pausesMs:[400,400,0], answer: 'oxygen' },
    { id: 'sci-20', subject: 'science', lines: ['I am the path that electricity follows.', 'What am I?'], pausesMs:[400,0], answer: 'circuit' },
    { id: 'sci-21', subject: 'science', lines: ['I attract metals like iron.', 'I have a north pole and a south pole.', 'What am I?'], pausesMs:[400,400,0], answer: 'magnet' },
    { id: 'sci-22', subject: 'science', lines: ['I am the force that pulls everything down to Earth.', 'What am I?'], pausesMs:[400,0], answer: 'gravity' },
    { id: 'sci-23', subject: 'science', lines: ['I am made of tiny drops of water floating in the air.', 'I can be white or gray or even dark.', 'What am I?'], pausesMs:[400,400,0], answer: 'cloud' },
    { id: 'sci-24', subject: 'science', lines: ['I am the part of the plant that grows under the ground.', 'I suck up water and nutrients.', 'What am I?'], pausesMs:[400,400,0], answer: 'root' },
    { id: 'sci-25', subject: 'science', lines: ['I am a baby frog.', 'I live in water and have a tail.', 'What am I?'], pausesMs:[400,400,0], answer: 'tadpole' },
    { id: 'sci-26', subject: 'science', lines: ['I am an animal that eats only plants.', 'What do you call me?'], pausesMs:[400,0], answer: 'herbivore' },
    { id: 'sci-27', subject: 'science', lines: ['I am the hard outer covering of an insect.', 'What am I?'], pausesMs:[400,0], answer: 'exoskeleton' },
    { id: 'sci-28', subject: 'science', lines: ['I am the process when water turns into vapor.', 'What am I called?'], pausesMs:[400,0], answer: 'evaporation' },
    { id: 'sci-29', subject: 'science', lines: ['I am the organ that pumps blood through your body.', 'What am I?'], pausesMs:[400,0], answer: 'heart' },
    { id: 'sci-30', subject: 'science', lines: ['I am the biggest planet in our solar system.', 'What am I?'], pausesMs:[400,0], answer: 'jupiter' },
    { id: 'sci-31', subject: 'science', lines: ['I am a simple machine that is a ramp.', 'I help you lift heavy things.', 'What am I?'], pausesMs:[400,400,0], answer: 'inclined plane' },
    { id: 'sci-32', subject: 'science', lines: ['I am the gas plants breathe in and people breathe out.', 'What am I?'], pausesMs:[400,0], answer: 'carbon dioxide' },
    { id: 'sci-33', subject: 'science', lines: ['I am the energy you can see.', 'I travel in waves and can be many colors.', 'What am I?'], pausesMs:[400,400,0], answer: 'light' },
    { id: 'sci-34', subject: 'science', lines: ['I am a rock that comes from a volcano.', 'What am I called?'], pausesMs:[400,0], answer: 'lava' },
    { id: 'sci-35', subject: 'science', lines: ['I am the layer of gas that surrounds Earth.', 'What am I?'], pausesMs:[400,0], answer: 'atmosphere' },
    { id: 'sci-36', subject: 'science', lines: ['I am an animal that eats both plants and meat.', 'What do you call me?'], pausesMs:[400,0], answer: 'omnivore' },
    { id: 'sci-37', subject: 'science', lines: ['I am the smallest unit of life.', 'All living things are made of me.', 'What am I?'], pausesMs:[400,400,0], answer: 'cell' },
    { id: 'sci-38', subject: 'science', lines: ['I am the planet known as the Red Planet.', 'What am I?'], pausesMs:[400,0], answer: 'mars' },
    { id: 'sci-39', subject: 'science', lines: ['I am the tool you use to make things look bigger.', 'Scientists use me to see tiny things.', 'What am I?'], pausesMs:[400,400,0], answer: 'microscope' },
    { id: 'sci-40', subject: 'science', lines: ['I am the bone that protects your brain.', 'What am I?'], pausesMs:[400,0], answer: 'skull' },
  ],
  'language arts': [
    // Language arts specific riddles
    { id: 'lang-01', subject: 'language arts', lines: ['What word becomes shorter when you add two letters to it?'], pausesMs:[0], answer: 'short' },
    { id: 'lang-02', subject: 'language arts', lines: ['What starts with P, ends with E, and has thousands of letters?'], pausesMs:[0], answer: 'post office' },
    { id: 'lang-03', subject: 'language arts', lines: ['What word is spelled incorrectly in every dictionary?'], pausesMs:[0], answer: 'incorrectly' },
    { id: 'lang-04', subject: 'language arts', lines: ['What word contains 26 letters but only three syllables?'], pausesMs:[0], answer: 'alphabet' },
    { id: 'lang-05', subject: 'language arts', lines: ['Which word looks the same upside down and backward?'], pausesMs:[0], answer: 'swims' },
    { id: 'lang-06', subject: 'language arts', lines: ['What English word has three consecutive double letters?'], pausesMs:[0], answer: 'bookkeeper' },
    { id: 'lang-07', subject: 'language arts', lines: ['I am the beginning of the end and the end of time and space.', 'What letter am I?'], pausesMs:[400,0], answer: 'e' },
    { id: 'lang-08', subject: 'language arts', lines: ['Remove my first letter and I sound the same.', 'Remove my last letter and I still sound the same.', 'What word am I?'], pausesMs:[400,400,0], answer: 'empty' },
    { id: 'lang-09', subject: 'language arts', lines: ['I am taken from a mine and shut up in a wooden case.', 'Students use me to write.', 'What am I?'], pausesMs:[400,400,0], answer: 'pencil lead' },
    { id: 'lang-10', subject: 'language arts', lines: ['What is the longest word in the dictionary?'], pausesMs:[0], answer: 'smiles' },
    { id: 'lang-11', subject: 'language arts', lines: ['What five letter word becomes shorter when you add two letters?'], pausesMs:[0], answer: 'short' },
    { id: 'lang-12', subject: 'language arts', lines: ['I am a word of letters three.', 'Add two and fewer there will be.', 'What word am I?'], pausesMs:[400,400,0], answer: 'few' },
    { id: 'lang-13', subject: 'language arts', lines: ['What begins with T, ends with T, and has T in it?'], pausesMs:[0], answer: 'teapot' },
    { id: 'lang-14', subject: 'language arts', lines: ['What word starts with E and ends with E but only has one letter?'], pausesMs:[0], answer: 'envelope' },
    { id: 'lang-15', subject: 'language arts', lines: ['I am a word that is always spelled wrong.', 'What word am I?'], pausesMs:[400,0], answer: 'wrong' },
    { id: 'lang-16', subject: 'language arts', lines: ['What has words but never speaks?'], pausesMs:[0], answer: 'book' },
    { id: 'lang-17', subject: 'language arts', lines: ['What can be written but never read?'], pausesMs:[0], answer: 'music' },
    { id: 'lang-18', subject: 'language arts', lines: ['I have pages but I am not a book.', 'I have a spine but I am not a person.', 'What am I?'], pausesMs:[400,400,0], answer: 'notebook' },
    { id: 'lang-19', subject: 'language arts', lines: ['What type of word is a person, place, or thing?'], pausesMs:[0], answer: 'noun' },
    { id: 'lang-20', subject: 'language arts', lines: ['What type of word describes an action?'], pausesMs:[0], answer: 'verb' },
    { id: 'lang-21', subject: 'language arts', lines: ['What type of word describes a noun?'], pausesMs:[0], answer: 'adjective' },
    { id: 'lang-22', subject: 'language arts', lines: ['What mark do you put at the end of a question?'], pausesMs:[0], answer: 'question mark' },
    { id: 'lang-23', subject: 'language arts', lines: ['What mark shows strong feeling or excitement?'], pausesMs:[0], answer: 'exclamation point' },
    { id: 'lang-24', subject: 'language arts', lines: ['What do you call words that sound the same but are spelled differently?'], pausesMs:[0], answer: 'homophones' },
    { id: 'lang-25', subject: 'language arts', lines: ['I am a sentence that tells you something.', 'What type of sentence am I?'], pausesMs:[400,0], answer: 'statement' },
    { id: 'lang-26', subject: 'language arts', lines: ['What do you call the main idea of a story?'], pausesMs:[0], answer: 'theme' },
    { id: 'lang-27', subject: 'language arts', lines: ['I am a word that sounds like what it means, like buzz or hiss.', 'What am I called?'], pausesMs:[400,0], answer: 'onomatopoeia' },
    { id: 'lang-28', subject: 'language arts', lines: ['What do you call a word that is opposite of another word?'], pausesMs:[0], answer: 'antonym' },
    { id: 'lang-29', subject: 'language arts', lines: ['What do you call a word that means the same as another word?'], pausesMs:[0], answer: 'synonym' },
    { id: 'lang-30', subject: 'language arts', lines: ['What do you call the person who writes a book?'], pausesMs:[0], answer: 'author' },
    { id: 'lang-31', subject: 'language arts', lines: ['What do you call the name of a book?'], pausesMs:[0], answer: 'title' },
    { id: 'lang-32', subject: 'language arts', lines: ['What do you call the part at the beginning of a word like re or un?'], pausesMs:[0], answer: 'prefix' },
    { id: 'lang-33', subject: 'language arts', lines: ['What do you call the part at the end of a word like ing or ed?'], pausesMs:[0], answer: 'suffix' },
    { id: 'lang-34', subject: 'language arts', lines: ['What are the ABC letters called?'], pausesMs:[0], answer: 'alphabet' },
    { id: 'lang-35', subject: 'language arts', lines: ['What do you call a story that is make believe?'], pausesMs:[0], answer: 'fiction' },
    { id: 'lang-36', subject: 'language arts', lines: ['What do you call a story that is true?'], pausesMs:[0], answer: 'nonfiction' },
    { id: 'lang-37', subject: 'language arts', lines: ['What letters are A, E, I, O, and U?'], pausesMs:[0], answer: 'vowels' },
    { id: 'lang-38', subject: 'language arts', lines: ['What do you call two words pushed together like cannot or sunflower?'], pausesMs:[0], answer: 'compound word' },
    { id: 'lang-39', subject: 'language arts', lines: ['What do you call a short version of a word like Dr for Doctor?'], pausesMs:[0], answer: 'abbreviation' },
    { id: 'lang-40', subject: 'language arts', lines: ['What do you call the lesson or message of a story?'], pausesMs:[0], answer: 'moral' },
  ],
  'social studies': [
    // Social studies specific riddles
    { id: 'soc-01', subject: 'social studies', lines: ['What has 50 stars but is not in space?'], pausesMs:[0], answer: 'american flag' },
    { id: 'soc-02', subject: 'social studies', lines: ['What has four eyes but cannot see?'], pausesMs:[0], answer: 'mississippi' },
    { id: 'soc-03', subject: 'social studies', lines: ['I run through towns but never move.', 'What am I?'], pausesMs:[400,0], answer: 'road' },
    { id: 'soc-04', subject: 'social studies', lines: ['What has a bed but never sleeps and a mouth but never eats?'], pausesMs:[0], answer: 'river' },
    { id: 'soc-05', subject: 'social studies', lines: ['I tell stories from the past and show things from far away.', 'I usually live in a building with quiet halls.', 'What am I?'], pausesMs:[400,400,0], answer: 'museum' },
    { id: 'soc-06', subject: 'social studies', lines: ['I am the capital of the United States.', 'What city am I?'], pausesMs:[400,0], answer: 'washington' },
    { id: 'soc-07', subject: 'social studies', lines: ['I am the largest ocean on Earth.', 'What ocean am I?'], pausesMs:[400,0], answer: 'pacific' },
    { id: 'soc-08', subject: 'social studies', lines: ['I am the continent where kangaroos live.', 'What continent am I?'], pausesMs:[400,0], answer: 'australia' },
    { id: 'soc-09', subject: 'social studies', lines: ['I am the imaginary line that divides Earth into north and south.', 'What am I?'], pausesMs:[400,0], answer: 'equator' },
    { id: 'soc-10', subject: 'social studies', lines: ['I am the person who leads a city.', 'What am I called?'], pausesMs:[400,0], answer: 'mayor' },
    { id: 'soc-11', subject: 'social studies', lines: ['I am the person who leads a state.', 'What am I called?'], pausesMs:[400,0], answer: 'governor' },
    { id: 'soc-12', subject: 'social studies', lines: ['I am the person who leads the country.', 'What am I called?'], pausesMs:[400,0], answer: 'president' },
    { id: 'soc-13', subject: 'social studies', lines: ['I am the building where laws are made.', 'What am I?'], pausesMs:[400,0], answer: 'capitol' },
    { id: 'soc-14', subject: 'social studies', lines: ['I am the holiday when we celebrate our country becoming free.', 'What am I?'], pausesMs:[400,0], answer: 'independence day' },
    { id: 'soc-15', subject: 'social studies', lines: ['I am a symbol of freedom that stands in New York Harbor.', 'What am I?'], pausesMs:[400,0], answer: 'statue of liberty' },
    { id: 'soc-16', subject: 'social studies', lines: ['I am the continent where Egypt is located.', 'What continent am I?'], pausesMs:[400,0], answer: 'africa' },
    { id: 'soc-17', subject: 'social studies', lines: ['I am the biggest country by land size.', 'What country am I?'], pausesMs:[400,0], answer: 'russia' },
    { id: 'soc-18', subject: 'social studies', lines: ['I am the longest river in the world.', 'What river am I?'], pausesMs:[400,0], answer: 'nile' },
    { id: 'soc-19', subject: 'social studies', lines: ['I am the tall pointed monument in Washington DC.', 'What am I?'], pausesMs:[400,0], answer: 'washington monument' },
    { id: 'soc-20', subject: 'social studies', lines: ['I am the rules that our country follows.', 'What am I called?'], pausesMs:[400,0], answer: 'constitution' },
    { id: 'soc-21', subject: 'social studies', lines: ['I am what you call buying and selling goods.', 'What am I?'], pausesMs:[400,0], answer: 'trade' },
    { id: 'soc-22', subject: 'social studies', lines: ['I am a person who helps keep your neighborhood safe.', 'What am I?'], pausesMs:[400,0], answer: 'police officer' },
    { id: 'soc-23', subject: 'social studies', lines: ['I am a person who puts out fires.', 'What am I?'], pausesMs:[400,0], answer: 'firefighter' },
    { id: 'soc-24', subject: 'social studies', lines: ['I am a person who delivers your mail.', 'What am I?'], pausesMs:[400,0], answer: 'mail carrier' },
    { id: 'soc-25', subject: 'social studies', lines: ['I am the largest desert in the world.', 'What desert am I?'], pausesMs:[400,0], answer: 'sahara' },
    { id: 'soc-26', subject: 'social studies', lines: ['I am the mountain range in South America.', 'What am I?'], pausesMs:[400,0], answer: 'andes' },
    { id: 'soc-27', subject: 'social studies', lines: ['I am the first president of the United States.', 'Who am I?'], pausesMs:[400,0], answer: 'george washington' },
    { id: 'soc-28', subject: 'social studies', lines: ['I am the continent that is also a country.', 'What am I?'], pausesMs:[400,0], answer: 'australia' },
    { id: 'soc-29', subject: 'social studies', lines: ['I am the coldest continent on Earth.', 'What continent am I?'], pausesMs:[400,0], answer: 'antarctica' },
    { id: 'soc-30', subject: 'social studies', lines: ['I am the imaginary line that runs from north pole to south pole.', 'What am I called?'], pausesMs:[400,0], answer: 'prime meridian' },
    { id: 'soc-31', subject: 'social studies', lines: ['I am the holiday when we remember soldiers who served our country.', 'What am I?'], pausesMs:[400,0], answer: 'veterans day' },
    { id: 'soc-32', subject: 'social studies', lines: ['I am the place where people vote.', 'What am I called?'], pausesMs:[400,0], answer: 'polling place' },
    { id: 'soc-33', subject: 'social studies', lines: ['I am a paper that gives you freedom or rights.', 'What am I called?'], pausesMs:[400,0], answer: 'bill of rights' },
    { id: 'soc-34', subject: 'social studies', lines: ['I am the tallest mountain in the world.', 'What am I?'], pausesMs:[400,0], answer: 'mount everest' },
    { id: 'soc-35', subject: 'social studies', lines: ['I am the continent where China is located.', 'What continent am I?'], pausesMs:[400,0], answer: 'asia' },
    { id: 'soc-36', subject: 'social studies', lines: ['I am the person who discovered America in 1492.', 'Who am I?'], pausesMs:[400,0], answer: 'christopher columbus' },
    { id: 'soc-37', subject: 'social studies', lines: ['I am the sea between Europe and Africa.', 'What sea am I?'], pausesMs:[400,0], answer: 'mediterranean' },
    { id: 'soc-38', subject: 'social studies', lines: ['I am a person who leads a school.', 'What am I called?'], pausesMs:[400,0], answer: 'principal' },
    { id: 'soc-39', subject: 'social studies', lines: ['I am the famous wall in China.', 'What am I?'], pausesMs:[400,0], answer: 'great wall' },
    { id: 'soc-40', subject: 'social studies', lines: ['I am the building where the president lives.', 'What am I?'], pausesMs:[400,0], answer: 'white house' },
  ],
};

export default riddlesBySubject;
