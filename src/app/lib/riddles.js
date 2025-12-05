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
  const list = getRiddlesForSubject(subject);
  if (!list.length) return null;
  if (typeof window === 'undefined') return list[0];
  try {
    const key = `riddle_idx_${subject.replace(/\s+/g,'_')}`;
    let idx = Number.parseInt(localStorage.getItem(key) || '', 10);
    if (!Number.isFinite(idx) || idx < 0 || idx >= list.length) idx = Math.floor(Math.random() * list.length);
    else idx = (idx + 1) % list.length;
    localStorage.setItem(key, String(idx));
    const result = list[idx];
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
    // Math riddles with wordplay, puns, and lateral thinking
    { id: 'math-01', subject: 'math', lines: ['I am an odd number.', 'Remove one letter and I become even.', 'What number am I?'], pausesMs:[400,400,0], answer: 'seven' },
    { id: 'math-02', subject: 'math', lines: ['I am a shape with four equal sides,', 'But I am pushed, turned, and sometimes slide.', 'What am I?'], pausesMs:[400,400,0], answer: 'square' },
    { id: 'math-03', subject: 'math', lines: ['If you multiply me by any number,', 'I stay the same.', 'What number am I?'], pausesMs:[400,400,0], answer: 'zero' },
    { id: 'math-04', subject: 'math', lines: ['I am a three digit number.', 'My tens digit is five more than my ones.', 'My hundreds is eight less than my tens.', 'What number am I?'], pausesMs:[400,400,400,0], answer: '194' },
    { id: 'math-05', subject: 'math', lines: ['I have no beginning, end, or sides,', 'Round and round a secret hides.', 'What am I?'], pausesMs:[400,400,0], answer: 'circle' },
    { id: 'math-06', subject: 'math', lines: ['What comes once in a minute, twice in a moment, but never in an hour?'], pausesMs:[0], answer: 'the letter m' },
    { id: 'math-07', subject: 'math', lines: ['I am round like a wheel but flat as can be.', 'I have two sides you can touch - inside and out.', 'How many sides do I have?'], pausesMs:[400,400,0], answer: 'two' },
    { id: 'math-08', subject: 'math', lines: ['I am special among all primes,', 'The only one who is not odd.', 'What number am I?'], pausesMs:[400,400,0], answer: 'two' },
    { id: 'math-09', subject: 'math', lines: ['Add me to myself and I equal four.', 'Multiply me by myself and I still equal four.', 'What number am I?'], pausesMs:[400,400,0], answer: 'two' },
    { id: 'math-10', subject: 'math', lines: ['I have three sides and three corners.', 'My name sounds like a musical instrument.', 'What shape am I?'], pausesMs:[400,400,0], answer: 'triangle' },
    { id: 'math-11', subject: 'math', lines: ['I stand between a perfect ten and a dozen donuts.', 'If you say my name twice, it sounds like a football cheer.', 'What number am I?'], pausesMs:[400,400,0], answer: 'eleven' },
    { id: 'math-12', subject: 'math', lines: ['When you add one to me I become one hundred.', 'What number am I?'], pausesMs:[400,0], answer: 'ninety nine' },
    { id: 'math-13', subject: 'math', lines: ['Turn me upside down and I look like a six.', 'But I am three more than that trick.', 'What number am I?'], pausesMs:[400,400,0], answer: 'nine' },
    { id: 'math-14', subject: 'math', lines: ['Cut me in half sideways and I am nothing.', 'What number am I?'], pausesMs:[400,0], answer: 'eight' },
    { id: 'math-15', subject: 'math', lines: ['I am what you get when three is friends with three.', 'They multiply their friendship and create me.', 'What number am I?'], pausesMs:[400,400,0], answer: 'nine' },
    { id: 'math-16', subject: 'math', lines: ['I look like a door or a window frame.', 'Two sides are long and two are short, but all my corners are the same.', 'What shape am I?'], pausesMs:[400,400,0], answer: 'rectangle' },
    { id: 'math-17', subject: 'math', lines: ['Five little ducks went out one day.', 'Two waddled away.', 'How many stayed?'], pausesMs:[400,400,0], answer: 'three' },
    { id: 'math-18', subject: 'math', lines: ['I am less than ten and more than five.', 'I am an even number.', 'Half of me is three.', 'What number am I?'], pausesMs:[400,400,400,0], answer: 'six' },
    { id: 'math-19', subject: 'math', lines: ['I am a coin that is one fourth of a dollar.', 'But I hold much more inside - count them all!', 'How many pennies hide in me?'], pausesMs:[400,400,0], answer: 'twenty five' },
    { id: 'math-20', subject: 'math', lines: ['A triangle has three, a square has four.', 'The Pentagon building in Washington has one more.', 'How many sides?'], pausesMs:[400,400,0], answer: 'five' },
    { id: 'math-21', subject: 'math', lines: ['I count the days from Monday through Sunday.', 'Rest on my last day - it is funday!', 'What number am I?'], pausesMs:[400,400,0], answer: 'seven' },
    { id: 'math-22', subject: 'math', lines: ['A dozen tiny brothers stand in a line.', 'Together they make one foot every time.', 'How many inches am I?'], pausesMs:[400,400,0], answer: 'twelve' },
    { id: 'math-23', subject: 'math', lines: ['A bicycle needs me to roll down the street.', 'I come in a pair, one for each spinning feat.', 'How many wheels?'], pausesMs:[400,400,0], answer: 'two' },
    { id: 'math-24', subject: 'math', lines: ['I have six sides like the cells where bees store honey.', 'My name sounds like a spell or something funny.', 'What shape am I?'], pausesMs:[400,400,0], answer: 'hexagon' },
    { id: 'math-25', subject: 'math', lines: ['I am the corner of a square, standing up so tall.', 'Measure my angle perfect for a wall.', 'How many degrees?'], pausesMs:[400,400,0], answer: 'ninety' },
    { id: 'math-26', subject: 'math', lines: ['Twenty had a split right down the middle.', 'Half went this way, half went that way.', 'What number stayed on one side?'], pausesMs:[400,400,0], answer: 'ten' },
    { id: 'math-27', subject: 'math', lines: ['Tick tock, tick tock, the clock hand spins around.', 'Count every tick until an hour is found.', 'How many minutes?'], pausesMs:[400,400,0], answer: 'sixty' },
    { id: 'math-28', subject: 'math', lines: ['Four brothers sit together in my hand.', 'When they join up, one dollar they command.', 'How many dollars from four quarters?'], pausesMs:[400,400,0], answer: 'one' },
    { id: 'math-29', subject: 'math', lines: ['Eight friends were playing, then three went home to rest.', 'How many stayed to play and do their best?'], pausesMs:[400,400,0], answer: 'five' },
    { id: 'math-30', subject: 'math', lines: ['One thousand is a mighty number, big and round.', 'Count the zeros wearing halos on thatound.', 'How many zeros?'], pausesMs:[400,400,0], answer: 'three' },
    { id: 'math-31', subject: 'math', lines: ['I am a shape that looks like an egg ready to hatch.', 'Round but stretched, no corners to catch.', 'What am I?'], pausesMs:[400,400,0], answer: 'oval' },
    { id: 'math-32', subject: 'math', lines: ['Ten friends each brought ten more to play.', 'Count them all - how many came that day?'], pausesMs:[400,400,0], answer: 'one hundred' },
    { id: 'math-33', subject: 'math', lines: ['Some months are long with thirty-one days to spend.', 'But how many months have exactly thirty from start to end?'], pausesMs:[400,400,0], answer: 'four' },
    { id: 'math-34', subject: 'math', lines: ['I am the smallest number with two digits to show.', 'Start with one, add zero, and watch me grow.', 'What number am I?'], pausesMs:[400,400,0], answer: 'ten' },
    { id: 'math-35', subject: 'math', lines: ['Count by fives: five, ten, fifteen, and then...', 'What number comes next to count again?'], pausesMs:[400,400,0], answer: 'twenty' },
    { id: 'math-36', subject: 'math', lines: ['Dimes are thin and silver, stacked up so fine.', 'How many make a dollar when they stand in line?'], pausesMs:[400,400,0], answer: 'ten' },
    { id: 'math-37', subject: 'math', lines: ['Six looked in the mirror and saw a friend.', 'Together they make me from end to end.', 'What number am I?'], pausesMs:[400,400,0], answer: 'twelve' },
    { id: 'math-38', subject: 'math', lines: ['Morning, noon, and night - the sun goes round.', 'How many hours until a full day is found?'], pausesMs:[400,400,0], answer: 'twenty four' },
    { id: 'math-39', subject: 'math', lines: ['A stop sign says halt with its bright red face.', 'Count its sides - each angle in place.', 'How many sides?'], pausesMs:[400,400,0], answer: 'eight' },
    { id: 'math-40', subject: 'math', lines: ['Five little fingers on this hand here.', 'Five on the other hand so dear.', 'Put them together - what number appears?'], pausesMs:[400,400,0], answer: 'ten' },
  ],
  science: [
    // Science riddles with metaphors, wordplay, and wonder
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
    { id: 'sci-12', subject: 'science', lines: ['I am a star you can see in daytime.', 'I am so bright I hide all the others.', 'What am I?'], pausesMs:[400,400,0], answer: 'sun' },
    { id: 'sci-13', subject: 'science', lines: ['I can be solid, liquid, or gas.', 'You drink me, swim in me, and see me as ice.', 'What am I?'], pausesMs:[400,400,0], answer: 'water' },
    { id: 'sci-14', subject: 'science', lines: ['I am a push or a pull.', 'I make things move or stay still.', 'What am I?'], pausesMs:[400,400,0], answer: 'force' },
    { id: 'sci-15', subject: 'science', lines: ['I dance in the middle while everyone spins around me.', 'Eight planets call me their leader.', 'What am I?'], pausesMs:[400,400,0], answer: 'sun' },
    { id: 'sci-16', subject: 'science', lines: ['I travel through the air when you shout or clap.', 'You cannot see me but your ears catch me.', 'What am I?'], pausesMs:[400,400,0], answer: 'sound wave' },
    { id: 'sci-17', subject: 'science', lines: ['I come from clouds and make puddles.', 'Plants need me to grow.', 'What am I?'], pausesMs:[400,400,0], answer: 'rain' },
    { id: 'sci-18', subject: 'science', lines: ['I spin like a top every single day.', 'I wear blue and green and you call me home.', 'What am I?'], pausesMs:[400,400,0], answer: 'earth' },
    { id: 'sci-19', subject: 'science', lines: ['Plants make me when they eat sunlight.', 'You need me every second but cannot see me.', 'What gas am I?'], pausesMs:[400,400,0], answer: 'oxygen' },
    { id: 'sci-20', subject: 'science', lines: ['I am the path electricity takes on its journey.', 'Break me and the lights go out.', 'What am I?'], pausesMs:[400,400,0], answer: 'circuit' },
    { id: 'sci-21', subject: 'science', lines: ['I attract metals like iron.', 'I have a north pole and a south pole.', 'What am I?'], pausesMs:[400,400,0], answer: 'magnet' },
    { id: 'sci-22', subject: 'science', lines: ['I pull everything down but you cannot see me.', 'I keep your feet on the ground.', 'What force am I?'], pausesMs:[400,400,0], answer: 'gravity' },
    { id: 'sci-23', subject: 'science', lines: ['I am made of tiny drops of water floating in the air.', 'I can be white or gray or even dark.', 'What am I?'], pausesMs:[400,400,0], answer: 'cloud' },
    { id: 'sci-24', subject: 'science', lines: ['I live underground where it is dark.', 'I drink water and feed the plant above.', 'What plant part am I?'], pausesMs:[400,400,0], answer: 'root' },
    { id: 'sci-25', subject: 'science', lines: ['I swim with a tail but I am not a fish.', 'Soon I will lose my tail and hop on land.', 'What am I?'], pausesMs:[400,400,0], answer: 'tadpole' },
    { id: 'sci-26', subject: 'science', lines: ['I munch on leaves and grass all day.', 'I never eat meat, only plants my way.', 'What do you call me?'], pausesMs:[400,400,0], answer: 'herbivore' },
    { id: 'sci-27', subject: 'science', lines: ['I wear my skeleton on the outside like armor.', 'Insects like me keep their bones where you can see them.', 'What am I called?'], pausesMs:[400,400,0], answer: 'exoskeleton' },
    { id: 'sci-28', subject: 'science', lines: ['Water gets so hot it floats away into the air.', 'You cannot see it leave, but puddles disappear.', 'What process am I?'], pausesMs:[400,400,0], answer: 'evaporation' },
    { id: 'sci-29', subject: 'science', lines: ['I have four rooms but no doors.', 'I beat all day long like a drum.', 'What organ am I?'], pausesMs:[400,400,0], answer: 'heart' },
    { id: 'sci-30', subject: 'science', lines: ['I am a giant planet with a big red spot.', 'I am bigger than all my brothers combined.', 'What planet am I?'], pausesMs:[400,400,0], answer: 'jupiter' },
    { id: 'sci-31', subject: 'science', lines: ['I am a ramp that helps you push heavy loads.', 'Slanted and simple, I make work easier.', 'What machine am I?'], pausesMs:[400,400,0], answer: 'inclined plane' },
    { id: 'sci-32', subject: 'science', lines: ['Plants breathe me in and you breathe me out.', 'I help plants make food in their leaves.', 'What gas am I?'], pausesMs:[400,400,0], answer: 'carbon dioxide' },
    { id: 'sci-33', subject: 'science', lines: ['I travel in waves faster than anything.', 'I can be red, blue, yellow, or green.', 'What am I?'], pausesMs:[400,400,0], answer: 'light' },
    { id: 'sci-34', subject: 'science', lines: ['I am liquid rock that flows from a volcano.', 'When I cool down I become solid and hard.', 'What am I?'], pausesMs:[400,400,0], answer: 'lava' },
    { id: 'sci-35', subject: 'science', lines: ['I am a blanket of air wrapped around the Earth.', 'I protect you and give you air to breathe.', 'What am I?'], pausesMs:[400,400,0], answer: 'atmosphere' },
    { id: 'sci-36', subject: 'science', lines: ['I eat pizza and salad too.', 'Plants or meat, I am not picky like you.', 'What do you call me?'], pausesMs:[400,400,0], answer: 'omnivore' },
    { id: 'sci-37', subject: 'science', lines: ['I am so tiny you need a microscope to see.', 'I am the building block of every living thing.', 'What am I?'], pausesMs:[400,400,0], answer: 'cell' },
    { id: 'sci-38', subject: 'science', lines: ['I am a planet covered in rusty red dust.', 'People call me the Red Planet.', 'What am I?'], pausesMs:[400,400,0], answer: 'mars' },
    { id: 'sci-39', subject: 'science', lines: ['I make tiny things look huge.', 'Scientists use me to peek at cells and germs.', 'What tool am I?'], pausesMs:[400,400,0], answer: 'microscope' },
    { id: 'sci-40', subject: 'science', lines: ['I am hard as a helmet and protect your brain.', 'I am made of bone and shaped like a bowl.', 'What am I?'], pausesMs:[400,400,0], answer: 'skull' },
  ],
  'language arts': [
    // Language arts riddles with wordplay, spelling tricks, and grammar humor
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
    { id: 'lang-19', subject: 'language arts', lines: ['I name people, places, and things all around.', 'Without me, sentences make no sound.', 'What part of speech am I?'], pausesMs:[400,400,0], answer: 'noun' },
    { id: 'lang-20', subject: 'language arts', lines: ['I am a word that likes to DO things.', 'Run, jump, and think are my friends.', 'What part of speech am I?'], pausesMs:[400,400,0], answer: 'verb' },
    { id: 'lang-21', subject: 'language arts', lines: ['I dress up nouns to make them fancy.', 'Big, small, red, or blue - I tell you how.', 'What part of speech am I?'], pausesMs:[400,400,0], answer: 'adjective' },
    { id: 'lang-22', subject: 'language arts', lines: ['I am a curious little hook that curls at the end.', 'I show up when you want to know something.', 'What punctuation mark am I?'], pausesMs:[400,400,0], answer: 'question mark' },
    { id: 'lang-23', subject: 'language arts', lines: ['I am a loud mark that shouts with excitement!', 'I show strong feelings like WOW!', 'What punctuation mark am I?'], pausesMs:[400,400,0], answer: 'exclamation point' },
    { id: 'lang-24', subject: 'language arts', lines: ['We sound the same but we are spelled differently.', 'Like two, too, and to - we confuse everyone!', 'What are we called?'], pausesMs:[400,400,0], answer: 'homophones' },
    { id: 'lang-25', subject: 'language arts', lines: ['I am a sentence that tells you something true.', 'I end with a period, calm and plain.', 'What type of sentence am I?'], pausesMs:[400,400,0], answer: 'statement' },
    { id: 'lang-26', subject: 'language arts', lines: ['I am the big idea hiding in a story.', 'The lesson or message you take home.', 'What am I called?'], pausesMs:[400,400,0], answer: 'theme' },
    { id: 'lang-27', subject: 'language arts', lines: ['I am a word that sounds like what I mean.', 'Buzz, hiss, and boom are my family.', 'What am I called?'], pausesMs:[400,400,0], answer: 'onomatopoeia' },
    { id: 'lang-28', subject: 'language arts', lines: ['I am a word that means the opposite of another.', 'Hot and cold, up and down - we are opposites.', 'What am I called?'], pausesMs:[400,400,0], answer: 'antonym' },
    { id: 'lang-29', subject: 'language arts', lines: ['I am a word that means the same as another.', 'Happy and glad, big and large - we match!', 'What am I called?'], pausesMs:[400,400,0], answer: 'synonym' },
    { id: 'lang-30', subject: 'language arts', lines: ['I create the stories you love to read.', 'I write the words on every page.', 'What do you call me?'], pausesMs:[400,400,0], answer: 'author' },
    { id: 'lang-31', subject: 'language arts', lines: ['I am the name at the top of a book.', 'I tell you what the story is about.', 'What am I called?'], pausesMs:[400,400,0], answer: 'title' },
    { id: 'lang-32', subject: 'language arts', lines: ['I come before a word like re or un.', 'I change the meaning right at the front.', 'What am I called?'], pausesMs:[400,400,0], answer: 'prefix' },
    { id: 'lang-33', subject: 'language arts', lines: ['I come after a word like ing or ed.', 'I change the meaning at the end.', 'What am I called?'], pausesMs:[400,400,0], answer: 'suffix' },
    { id: 'lang-34', subject: 'language arts', lines: ['A, B, C - I am all 26 letters in a row.', 'What am I called?'], pausesMs:[400,0], answer: 'alphabet' },
    { id: 'lang-35', subject: 'language arts', lines: ['I am a story that never happened but you can still learn from me.', 'Dragons and magic are my friends.', 'What am I called?'], pausesMs:[400,400,0], answer: 'fiction' },
    { id: 'lang-36', subject: 'language arts', lines: ['I am a story about real things that actually happened.', 'Facts and truth are my best friends.', 'What am I called?'], pausesMs:[400,400,0], answer: 'nonfiction' },
    { id: 'lang-37', subject: 'language arts', lines: ['We are five special letters: A, E, I, O, and U.', 'We sing in every word you say.', 'What are we called?'], pausesMs:[400,400,0], answer: 'vowels' },
    { id: 'lang-38', subject: 'language arts', lines: ['Two words hold hands and become one.', 'Like sunflower or butterfly - we stick together!', 'What am I called?'], pausesMs:[400,400,0], answer: 'compound word' },
    { id: 'lang-39', subject: 'language arts', lines: ['I am a short version of a longer word.', 'Like Dr for Doctor or Mr for Mister.', 'What am I called?'], pausesMs:[400,400,0], answer: 'abbreviation' },
    { id: 'lang-40', subject: 'language arts', lines: ['I am the lesson a story teaches you.', 'Like be kind or work hard - I help you grow.', 'What am I called?'], pausesMs:[400,400,0], answer: 'moral' },
  ],
  'social studies': [
    // Social studies riddles with geography puns, historical wordplay, and civic metaphors
    { id: 'soc-01', subject: 'social studies', lines: ['What has 50 stars but is not in space?'], pausesMs:[0], answer: 'american flag' },
    { id: 'soc-02', subject: 'social studies', lines: ['What has four eyes but cannot see?'], pausesMs:[0], answer: 'mississippi' },
    { id: 'soc-03', subject: 'social studies', lines: ['I run through towns but never move.', 'What am I?'], pausesMs:[400,0], answer: 'road' },
    { id: 'soc-04', subject: 'social studies', lines: ['What has a bed but never sleeps and a mouth but never eats?'], pausesMs:[0], answer: 'river' },
    { id: 'soc-05', subject: 'social studies', lines: ['I tell stories from the past and show things from far away.', 'I usually live in a building with quiet halls.', 'What am I?'], pausesMs:[400,400,0], answer: 'museum' },
    { id: 'soc-06', subject: 'social studies', lines: ['I am a city named after the first president.', 'Laws are made where I stand but I am not where he lived.', 'What city am I?'], pausesMs:[400,400,0], answer: 'washington' },
    { id: 'soc-07', subject: 'social studies', lines: ['I am the biggest ocean, peaceful by name.', 'I touch Asia, America, and everything between.', 'What ocean am I?'], pausesMs:[400,400,0], answer: 'pacific' },
    { id: 'soc-08', subject: 'social studies', lines: ['I am a continent and also a country.', 'Kangaroos hop across my land.', 'What am I?'], pausesMs:[400,400,0], answer: 'australia' },
    { id: 'soc-09', subject: 'social studies', lines: ['I am a line around the Earth like a belt on its belly.', 'I divide the world in half - north and south.', 'What am I?'], pausesMs:[400,400,0], answer: 'equator' },
    { id: 'soc-10', subject: 'social studies', lines: ['I lead a city and help it run smoothly.', 'I work at city hall but I am not the president.', 'What am I called?'], pausesMs:[400,400,0], answer: 'mayor' },
    { id: 'soc-11', subject: 'social studies', lines: ['I lead a state, bigger than a city.', 'I work in the state capitol building.', 'What am I called?'], pausesMs:[400,400,0], answer: 'governor' },
    { id: 'soc-12', subject: 'social studies', lines: ['I lead the whole country from the White House.', 'I am the commander in chief.', 'What am I called?'], pausesMs:[400,400,0], answer: 'president' },
    { id: 'soc-13', subject: 'social studies', lines: ['I am a building where laws are born.', 'I have a dome on top and politicians inside.', 'What am I?'], pausesMs:[400,400,0], answer: 'capitol' },
    { id: 'soc-14', subject: 'social studies', lines: ['I am celebrated on the fourth of July.', 'Fireworks light the sky as we remember freedom.', 'What holiday am I?'], pausesMs:[400,400,0], answer: 'independence day' },
    { id: 'soc-15', subject: 'social studies', lines: ['I stand in New York Harbor with a torch held high.', 'I welcome people to America and represent freedom.', 'What am I?'], pausesMs:[400,400,0], answer: 'statue of liberty' },
    { id: 'soc-16', subject: 'social studies', lines: ['I am a continent where pyramids stand tall.', 'Lions roam my grasslands and deserts.', 'What continent am I?'], pausesMs:[400,400,0], answer: 'africa' },
    { id: 'soc-17', subject: 'social studies', lines: ['I am the biggest country by land, stretching far and wide.', 'I am so large I have eleven time zones!', 'What country am I?'], pausesMs:[400,400,0], answer: 'russia' },
    { id: 'soc-18', subject: 'social studies', lines: ['I am a river so long I am famous worldwide.', 'I flow through Egypt to the Mediterranean Sea.', 'What river am I?'], pausesMs:[400,400,0], answer: 'nile' },
    { id: 'soc-19', subject: 'social studies', lines: ['I am a tall monument that points to the sky.', 'I honor the first president in Washington DC.', 'What am I?'], pausesMs:[400,400,0], answer: 'washington monument' },
    { id: 'soc-20', subject: 'social studies', lines: ['I am the rules our country follows every day.', 'I was written long ago to protect your rights.', 'What am I called?'], pausesMs:[400,400,0], answer: 'constitution' },
    { id: 'soc-21', subject: 'social studies', lines: ['I happen when you give me this and I give you that.', 'Countries do it, kids do it at lunch!', 'What am I?'], pausesMs:[400,400,0], answer: 'trade' },
    { id: 'soc-22', subject: 'social studies', lines: ['I wear a badge and help keep you safe.', 'I patrol the streets and enforce the law.', 'What am I?'], pausesMs:[400,400,0], answer: 'police officer' },
    { id: 'soc-23', subject: 'social studies', lines: ['I wear a helmet and ride a big red truck.', 'I put out fires and rescue people.', 'What am I?'], pausesMs:[400,400,0], answer: 'firefighter' },
    { id: 'soc-24', subject: 'social studies', lines: ['I bring letters and packages to your door.', 'Rain or shine, I deliver the mail.', 'What am I?'], pausesMs:[400,400,0], answer: 'mail carrier' },
    { id: 'soc-25', subject: 'social studies', lines: ['I am a desert covered in golden sand.', 'I stretch across Africa, hot and grand.', 'What desert am I?'], pausesMs:[400,400,0], answer: 'sahara' },
    { id: 'soc-26', subject: 'social studies', lines: ['I am mountains in South America, tall and steep.', 'I run along the western edge like a spine.', 'What am I?'], pausesMs:[400,400,0], answer: 'andes' },
    { id: 'soc-27', subject: 'social studies', lines: ['I was the first president, brave and true.', 'My face is on the dollar and the quarter too.', 'Who am I?'], pausesMs:[400,400,0], answer: 'george washington' },
    { id: 'soc-28', subject: 'social studies', lines: ['I am a continent that is also a country.', 'Down under is what people call me.', 'What am I?'], pausesMs:[400,400,0], answer: 'australia' },
    { id: 'soc-29', subject: 'social studies', lines: ['I am the coldest continent, covered in ice.', 'Penguins live on me but people do not.', 'What continent am I?'], pausesMs:[400,400,0], answer: 'antarctica' },
    { id: 'soc-30', subject: 'social studies', lines: ['I am a line running from north pole to south.', 'I divide the Earth into east and west halves.', 'What am I called?'], pausesMs:[400,400,0], answer: 'prime meridian' },
    { id: 'soc-31', subject: 'social studies', lines: ['I am a holiday when we honor soldiers.', 'We thank those who served our country with courage.', 'What holiday am I?'], pausesMs:[400,400,0], answer: 'veterans day' },
    { id: 'soc-32', subject: 'social studies', lines: ['I am the place where people cast their votes.', 'Democracy happens inside my walls.', 'What am I called?'], pausesMs:[400,400,0], answer: 'polling place' },
    { id: 'soc-33', subject: 'social studies', lines: ['I am a list of freedoms you are born with.', 'The first ten amendments protect your rights.', 'What am I called?'], pausesMs:[400,400,0], answer: 'bill of rights' },
    { id: 'soc-34', subject: 'social studies', lines: ['I am the tallest mountain, touching the sky.', 'Climbers come from everywhere to reach my peak.', 'What am I?'], pausesMs:[400,400,0], answer: 'mount everest' },
    { id: 'soc-35', subject: 'social studies', lines: ['I am the biggest continent by land and people.', 'China and India both call me home.', 'What continent am I?'], pausesMs:[400,400,0], answer: 'asia' },
    { id: 'soc-36', subject: 'social studies', lines: ['I sailed the ocean blue in fourteen ninety-two.', 'I reached America but thought it was India.', 'Who am I?'], pausesMs:[400,400,0], answer: 'christopher columbus' },
    { id: 'soc-37', subject: 'social studies', lines: ['I am a sea between two continents.', 'Europe and Africa both touch my shores.', 'What sea am I?'], pausesMs:[400,400,0], answer: 'mediterranean' },
    { id: 'soc-38', subject: 'social studies', lines: ['I lead a school and help it run each day.', 'Teachers and students both know my name.', 'What am I called?'], pausesMs:[400,400,0], answer: 'principal' },
    { id: 'soc-39', subject: 'social studies', lines: ['I stretch across China for thousands of miles.', 'I was built long ago to protect the land.', 'What am I?'], pausesMs:[400,400,0], answer: 'great wall' },
    { id: 'soc-40', subject: 'social studies', lines: ['I am a house that is painted white.', 'The president lives and works inside me.', 'What am I?'], pausesMs:[400,400,0], answer: 'white house' },
  ],
};

export default riddlesBySubject;
