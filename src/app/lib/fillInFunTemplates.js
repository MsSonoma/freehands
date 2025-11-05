// 20 pre-built Fill-in-Fun templates
// Each template has a story with placeholders and a list of words to collect
// Templates are chosen randomly (no AI generation needed)

export const FILL_IN_FUN_TEMPLATES = [
  {
    template: "Once upon a time, there was a {adjective1} {animal1} who loved to {verb1}. One day, it found a {adjective2} {object1} in the forest. The {animal1} decided to {verb2} with it all the way to {place1}!",
    words: [
      { type: "adjective", label: "adjective1", prompt: "an adjective (describing word, like silly or tiny)" },
      { type: "noun", label: "animal1", prompt: "an animal" },
      { type: "verb", label: "verb1", prompt: "a verb (action word, like dance or sing)" },
      { type: "adjective", label: "adjective2", prompt: "an adjective (describing word)" },
      { type: "noun", label: "object1", prompt: "an object or thing" },
      { type: "verb", label: "verb2", prompt: "a verb (action word)" },
      { type: "noun", label: "place1", prompt: "a place" }
    ]
  },
  {
    template: "In a {adjective1} kitchen, Chef {name1} was making a special recipe. First, mix {number1} cups of {food1}. Then {verb1} it {adverb1} until it turns {color1}. Finally, sprinkle some {food2} on top and serve it to the {adjective2} guests!",
    words: [
      { type: "adjective", label: "adjective1", prompt: "an adjective (describing word)" },
      { type: "noun", label: "name1", prompt: "a person's name" },
      { type: "number", label: "number1", prompt: "a number" },
      { type: "noun", label: "food1", prompt: "a food (plural, like cookies or carrots)" },
      { type: "verb", label: "verb1", prompt: "a verb (action word)" },
      { type: "adverb", label: "adverb1", prompt: "an adverb (describes how, like quickly or gently)" },
      { type: "adjective", label: "color1", prompt: "a color" },
      { type: "noun", label: "food2", prompt: "a food" },
      { type: "adjective", label: "adjective2", prompt: "an adjective (describing word)" }
    ]
  },
  {
    template: "Professor {name1} discovered that when you {verb1} a {noun1} with a {noun2}, it creates a {adjective1} {noun3}! The entire class started to {verb2} {adverb1}. This was the most {adjective2} experiment ever!",
    words: [
      { type: "noun", label: "name1", prompt: "a person's name" },
      { type: "verb", label: "verb1", prompt: "a verb (action word)" },
      { type: "noun", label: "noun1", prompt: "a thing" },
      { type: "noun", label: "noun2", prompt: "another thing" },
      { type: "adjective", label: "adjective1", prompt: "an adjective (describing word)" },
      { type: "noun", label: "noun3", prompt: "a thing (plural)" },
      { type: "verb", label: "verb2", prompt: "a verb (action word)" },
      { type: "adverb", label: "adverb1", prompt: "an adverb (describes how, like loudly or slowly)" },
      { type: "adjective", label: "adjective2", prompt: "an adjective (describing word)" }
    ]
  },
  {
    template: "Every morning, the {adjective1} bus driver would {verb1} down the street singing about {noun1}. All the {noun2} on the bus would {verb2} along. It made the trip to {place1} much more {adjective2}!",
    words: [
      { type: "adjective", label: "adjective1", prompt: "an adjective (describing word)" },
      { type: "verb", label: "verb1", prompt: "a verb (action word)" },
      { type: "noun", label: "noun1", prompt: "a thing (plural)" },
      { type: "noun", label: "noun2", prompt: "people or animals (plural)" },
      { type: "verb", label: "verb2", prompt: "a verb (action word)" },
      { type: "noun", label: "place1", prompt: "a place" },
      { type: "adjective", label: "adjective2", prompt: "an adjective (describing word)" }
    ]
  },
  {
    template: "Deep in the ocean, a {adjective1} {animal1} named Captain {name1} was searching for the legendary {noun1}. After swimming through {number1} miles of {adjective2} water, the captain finally found it hidden inside a giant {noun2}!",
    words: [
      { type: "adjective", label: "adjective1", prompt: "an adjective (describing word)" },
      { type: "noun", label: "animal1", prompt: "a sea creature" },
      { type: "noun", label: "name1", prompt: "a person's name" },
      { type: "noun", label: "noun1", prompt: "a treasure or object" },
      { type: "number", label: "number1", prompt: "a number" },
      { type: "adjective", label: "adjective2", prompt: "an adjective (describing word)" },
      { type: "noun", label: "noun2", prompt: "a thing" }
    ]
  },
  {
    template: "At the {adjective1} talent show, {name1} performed an amazing trick. First, they made a {noun1} {verb1} across the stage. Then they pulled {number1} {noun2} out of a hat! Everyone {verb2} {adverb1} and gave them a {adjective2} standing ovation!",
    words: [
      { type: "adjective", label: "adjective1", prompt: "an adjective (describing word)" },
      { type: "noun", label: "name1", prompt: "a person's name" },
      { type: "noun", label: "noun1", prompt: "a thing" },
      { type: "verb", label: "verb1", prompt: "a verb (action word)" },
      { type: "number", label: "number1", prompt: "a number" },
      { type: "noun", label: "noun2", prompt: "things (plural)" },
      { type: "verb", label: "verb2", prompt: "a verb (action word, like clapped or cheered)" },
      { type: "adverb", label: "adverb1", prompt: "an adverb (describes how)" },
      { type: "adjective", label: "adjective2", prompt: "an adjective (describing word)" }
    ]
  },
  {
    template: "The {adjective1} astronaut flew to Planet {name1} in a {adjective2} spaceship. There they met aliens who could {verb1} and communicate by {verb2}. The aliens gave them {number1} {noun1} as a souvenir before they {verb3} home!",
    words: [
      { type: "adjective", label: "adjective1", prompt: "an adjective (describing word)" },
      { type: "noun", label: "name1", prompt: "a made-up planet name" },
      { type: "adjective", label: "adjective2", prompt: "an adjective (describing word)" },
      { type: "verb", label: "verb1", prompt: "a verb (action word)" },
      { type: "verb", label: "verb2", prompt: "a verb ending in -ing" },
      { type: "number", label: "number1", prompt: "a number" },
      { type: "noun", label: "noun1", prompt: "things (plural)" },
      { type: "verb", label: "verb3", prompt: "a verb (action word, like flew or zoomed)" }
    ]
  },
  {
    template: "In the town of {place1}, there was a {adjective1} library where books could {verb1}. The librarian, Ms. {name1}, would {verb2} {adverb1} whenever someone checked out a {adjective2} {noun1}. The most popular book was about {noun2}!",
    words: [
      { type: "noun", label: "place1", prompt: "a town or city name" },
      { type: "adjective", label: "adjective1", prompt: "an adjective (describing word)" },
      { type: "verb", label: "verb1", prompt: "a verb (action word)" },
      { type: "noun", label: "name1", prompt: "a person's name" },
      { type: "verb", label: "verb2", prompt: "a verb (action word)" },
      { type: "adverb", label: "adverb1", prompt: "an adverb (describes how)" },
      { type: "adjective", label: "adjective2", prompt: "an adjective (describing word)" },
      { type: "noun", label: "noun1", prompt: "a type of book or story" },
      { type: "noun", label: "noun2", prompt: "a topic (plural)" }
    ]
  },
  {
    template: "Every {dayOfWeek1}, the {adjective1} mailman delivers {noun1} to the neighborhood. One day, he accidentally delivered a package full of {noun2} to {name1}'s house! Now everyone in town wants to {verb1} with them!",
    words: [
      { type: "noun", label: "dayOfWeek1", prompt: "a day of the week" },
      { type: "adjective", label: "adjective1", prompt: "an adjective (describing word)" },
      { type: "noun", label: "noun1", prompt: "things (plural)" },
      { type: "noun", label: "noun2", prompt: "silly things (plural)" },
      { type: "noun", label: "name1", prompt: "a person's name" },
      { type: "verb", label: "verb1", prompt: "a verb (action word)" }
    ]
  },
  {
    template: "At the {adjective1} zoo, a {animal1} escaped and started {verb1} through the gift shop! Zookeeper {name1} tried to catch it with a {noun1}, but the {animal1} was too {adjective2}. Finally, they lured it back with {number1} {food1}!",
    words: [
      { type: "adjective", label: "adjective1", prompt: "an adjective (describing word)" },
      { type: "noun", label: "animal1", prompt: "an animal" },
      { type: "verb", label: "verb1", prompt: "a verb ending in -ing" },
      { type: "noun", label: "name1", prompt: "a person's name" },
      { type: "noun", label: "noun1", prompt: "a tool or object" },
      { type: "adjective", label: "adjective2", prompt: "an adjective (describing word, like fast or sneaky)" },
      { type: "number", label: "number1", prompt: "a number" },
      { type: "noun", label: "food1", prompt: "a food (plural)" }
    ]
  },
  {
    template: "The {adjective1} detective, Inspector {name1}, was investigating the case of the missing {noun1}. After {verb1} {adverb1} through {number1} clues, they discovered that a {adjective2} {animal1} had hidden it in the {place1}!",
    words: [
      { type: "adjective", label: "adjective1", prompt: "an adjective (describing word)" },
      { type: "noun", label: "name1", prompt: "a person's name" },
      { type: "noun", label: "noun1", prompt: "a valuable object (plural)" },
      { type: "verb", label: "verb1", prompt: "a verb ending in -ing" },
      { type: "adverb", label: "adverb1", prompt: "an adverb (describes how)" },
      { type: "number", label: "number1", prompt: "a number" },
      { type: "adjective", label: "adjective2", prompt: "an adjective (describing word)" },
      { type: "noun", label: "animal1", prompt: "an animal" },
      { type: "noun", label: "place1", prompt: "a place" }
    ]
  },
  {
    template: "During art class, the students learned to paint {adjective1} {noun1}. {name1} accidentally spilled {color1} paint on the {noun2}, so the teacher said they could {verb1} it into the masterpiece! Now it hangs {adverb1} in the school hallway!",
    words: [
      { type: "adjective", label: "adjective1", prompt: "an adjective (describing word)" },
      { type: "noun", label: "noun1", prompt: "things (plural)" },
      { type: "noun", label: "name1", prompt: "a person's name" },
      { type: "adjective", label: "color1", prompt: "a color" },
      { type: "noun", label: "noun2", prompt: "a thing" },
      { type: "verb", label: "verb1", prompt: "a verb (action word)" },
      { type: "adverb", label: "adverb1", prompt: "an adverb (describes how, like proudly)" }
    ]
  },
  {
    template: "The {adjective1} wizard of {place1} could turn {noun1} into {noun2} with just a {verb1} of their wand! One day, they accidentally turned {name1}'s {noun3} into a {adjective2} {animal1}. It took {number1} spells to fix it!",
    words: [
      { type: "adjective", label: "adjective1", prompt: "an adjective (describing word)" },
      { type: "noun", label: "place1", prompt: "a magical place name" },
      { type: "noun", label: "noun1", prompt: "things (plural)" },
      { type: "noun", label: "noun2", prompt: "different things (plural)" },
      { type: "verb", label: "verb1", prompt: "a verb (action word, like wave or flick)" },
      { type: "noun", label: "name1", prompt: "a person's name" },
      { type: "noun", label: "noun3", prompt: "a thing" },
      { type: "adjective", label: "adjective2", prompt: "an adjective (describing word)" },
      { type: "noun", label: "animal1", prompt: "an animal" },
      { type: "number", label: "number1", prompt: "a number" }
    ]
  },
  {
    template: "At the {adjective1} carnival, you could win {noun1} by {verb1} at the {noun2} booth. {name1} won {number1} prizes and decided to {verb2} them {adverb1} to everyone in line. What a {adjective2} day!",
    words: [
      { type: "adjective", label: "adjective1", prompt: "an adjective (describing word)" },
      { type: "noun", label: "noun1", prompt: "prizes (plural)" },
      { type: "verb", label: "verb1", prompt: "a verb ending in -ing" },
      { type: "noun", label: "noun2", prompt: "a game or activity" },
      { type: "noun", label: "name1", prompt: "a person's name" },
      { type: "number", label: "number1", prompt: "a number" },
      { type: "verb", label: "verb2", prompt: "a verb (action word, like give or toss)" },
      { type: "adverb", label: "adverb1", prompt: "an adverb (describes how)" },
      { type: "adjective", label: "adjective2", prompt: "an adjective (describing word)" }
    ]
  },
  {
    template: "The {adjective1} robot named {name1} was programmed to {verb1} every morning at {timeOfDay1}. But one day, its circuits got mixed up and it started {verb2} {adverb1} instead! The inventor had to reprogram it using {number1} {noun1}!",
    words: [
      { type: "adjective", label: "adjective1", prompt: "an adjective (describing word)" },
      { type: "noun", label: "name1", prompt: "a robot name" },
      { type: "verb", label: "verb1", prompt: "a verb (action word)" },
      { type: "noun", label: "timeOfDay1", prompt: "a time (like 3 o'clock or midnight)" },
      { type: "verb", label: "verb2", prompt: "a verb ending in -ing" },
      { type: "adverb", label: "adverb1", prompt: "an adverb (describes how)" },
      { type: "number", label: "number1", prompt: "a number" },
      { type: "noun", label: "noun1", prompt: "computer parts or tools (plural)" }
    ]
  },
  {
    template: "In the {adjective1} forest, there lived a {animal1} who could speak {number1} languages. One day, it taught all the other animals how to {verb1}. Soon the whole forest was {verb2} {adverb1} together! Even the {adjective2} trees joined in!",
    words: [
      { type: "adjective", label: "adjective1", prompt: "an adjective (describing word)" },
      { type: "noun", label: "animal1", prompt: "an animal" },
      { type: "number", label: "number1", prompt: "a number" },
      { type: "verb", label: "verb1", prompt: "a verb (action word)" },
      { type: "verb", label: "verb2", prompt: "a verb ending in -ing" },
      { type: "adverb", label: "adverb1", prompt: "an adverb (describes how)" },
      { type: "adjective", label: "adjective2", prompt: "an adjective (describing word)" }
    ]
  },
  {
    template: "Captain {name1} sailed the {adjective1} seas looking for adventure. One stormy night, they found an island made entirely of {noun1}! The crew decided to {verb1} there and built a {adjective2} fort using {noun2} and {noun3}!",
    words: [
      { type: "noun", label: "name1", prompt: "a person's name" },
      { type: "adjective", label: "adjective1", prompt: "an adjective (describing word)" },
      { type: "noun", label: "noun1", prompt: "a material (plural, like pillows or cookies)" },
      { type: "verb", label: "verb1", prompt: "a verb (action word, like stay or camp)" },
      { type: "adjective", label: "adjective2", prompt: "an adjective (describing word)" },
      { type: "noun", label: "noun2", prompt: "building materials (plural)" },
      { type: "noun", label: "noun3", prompt: "more materials (plural)" }
    ]
  },
  {
    template: "The {adjective1} museum got a new exhibit about {noun1}. When {name1} touched the {adjective2} display, it suddenly started to {verb1}! The security guard had to {verb2} {adverb1} to stop it before it {verb3} out the door!",
    words: [
      { type: "adjective", label: "adjective1", prompt: "an adjective (describing word)" },
      { type: "noun", label: "noun1", prompt: "a topic (plural)" },
      { type: "noun", label: "name1", prompt: "a person's name" },
      { type: "adjective", label: "adjective2", prompt: "an adjective (describing word)" },
      { type: "verb", label: "verb1", prompt: "a verb (action word)" },
      { type: "verb", label: "verb2", prompt: "a verb (action word, like run or dash)" },
      { type: "adverb", label: "adverb1", prompt: "an adverb (describes how)" },
      { type: "verb", label: "verb3", prompt: "a verb (past tense, like escaped or bounced)" }
    ]
  },
  {
    template: "At the {adjective1} pet store, all the animals had special talents. The {animal1} could {verb1}, the {animal2} could {verb2} {adverb1}, and the tiny {animal3} could even {verb3}! {name1} wanted to adopt them all!",
    words: [
      { type: "adjective", label: "adjective1", prompt: "an adjective (describing word)" },
      { type: "noun", label: "animal1", prompt: "an animal (plural)" },
      { type: "verb", label: "verb1", prompt: "a verb (action word)" },
      { type: "noun", label: "animal2", prompt: "another animal (plural)" },
      { type: "verb", label: "verb2", prompt: "a verb (action word)" },
      { type: "adverb", label: "adverb1", prompt: "an adverb (describes how)" },
      { type: "noun", label: "animal3", prompt: "a small animal (plural)" },
      { type: "verb", label: "verb3", prompt: "a verb (action word)" },
      { type: "noun", label: "name1", prompt: "a person's name" }
    ]
  },
  {
    template: "The town's annual {noun1} festival was the {adjective1} event of the year! This year's theme was {noun2}, so everyone dressed up and brought their favorite {noun3}. The mayor, {name1}, gave a speech about how to {verb1} {adverb1} with joy!",
    words: [
      { type: "noun", label: "noun1", prompt: "a celebration topic" },
      { type: "adjective", label: "adjective1", prompt: "an adjective (describing word, like biggest or silliest)" },
      { type: "noun", label: "noun2", prompt: "a theme or topic (plural)" },
      { type: "noun", label: "noun3", prompt: "things people bring (plural)" },
      { type: "noun", label: "name1", prompt: "a person's name" },
      { type: "verb", label: "verb1", prompt: "a verb (action word, like celebrate or dance)" },
      { type: "adverb", label: "adverb1", prompt: "an adverb (describes how)" }
    ]
  }
];

/**
 * Get a random fill-in-fun template
 * @returns {Object} A template object with template string and words array
 */
export function getRandomTemplate() {
  const index = Math.floor(Math.random() * FILL_IN_FUN_TEMPLATES.length);
  // Return a deep copy to avoid mutations
  return JSON.parse(JSON.stringify(FILL_IN_FUN_TEMPLATES[index]));
}

export default {
  FILL_IN_FUN_TEMPLATES,
  getRandomTemplate
};
