'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import baseStyles from './KidsResort.module.css';
import worldStyles from './KidsResortWorld.module.css';
import anatomyStyles from './KidsResortAnatomy.module.css';

const styles = { ...worldStyles, ...anatomyStyles, ...baseStyles };

const PLACES = [
  {
    id: 'suite',
    name: 'Emily’s House',
    icon: '🛏️',
    x: 50,
    y: 82,
    role: 'Home Base',
    description: 'Your private resort house. Cook in the kitchen, check your closet, and see what you own.',
  },
  {
    id: 'lobby',
    name: 'Resort Lobby',
    icon: '🏨',
    x: 50,
    y: 48,
    role: 'Hotel Guest',
    description: 'The main hotel building, with the Palm Court restaurant for sit-down meals.',
  },
  {
    id: 'cafe',
    name: 'Sunshine Café',
    icon: '🥪',
    x: 16,
    y: 38,
    role: 'Café',
    description: 'Grab a casual bite or work a café shift serving other resort guests.',
  },
  {
    id: 'bank',
    name: 'Resort Bank',
    icon: '🏦',
    x: 82,
    y: 37,
    role: 'Banker',
    description: 'A future place to save Resort Bucks, plan budgets, and handle pretend banking.',
  },
  {
    id: 'market',
    name: 'Market Street',
    icon: '🛒',
    x: 81,
    y: 66,
    role: 'Shopping',
    description: 'Buy groceries and useful things, then bring them back to your house.',
  },
  {
    id: 'studio',
    name: 'Design Studio',
    icon: '👗',
    x: 19,
    y: 66,
    role: 'Character Design',
    description: 'Design Emily’s look with clothes, shoes, hair styles, and accessories.',
  },
];

const CAFE_RECIPES = [
  { id:'burger', name:'Sunshine Burger', icon:'🍔', price:6, ingredients:['bun','patty','lettuce','tomato'], formula:'🍔 = 🫓 + 🍖 + 🥬 + 🍅' },
  { id:'toastie', name:'Grilled Cheese', icon:'🥪', price:4, ingredients:['bread','cheese','tomato'], formula:'🥪 = 🍞 + 🧀 + 🍅' },
  { id:'taco', name:'Sunshine Taco', icon:'🌮', price:5, ingredients:['tortilla','taco-meat','cheese','lettuce'], formula:'🌮 = 🌮 + 🍖 + 🧀 + 🥬' },
  { id:'breakfast', name:'Cafe Breakfast', icon:'🍳', price:6, ingredients:['egg','bacon','toast'], formula:'🍳 = 🥚 + 🥓 + 🍞' },
];
const CAFE_INGREDIENTS={bun:{icon:'🫓',name:'Bun',source:'cabinet'},patty:{icon:'🍖',name:'Patty',source:'fridge',cook:6500},lettuce:{icon:'🥬',name:'Lettuce',source:'fridge'},tomato:{icon:'🍅',name:'Tomato',source:'fridge'},bread:{icon:'🍞',name:'Bread',source:'cabinet',cook:5500},cheese:{icon:'🧀',name:'Cheese',source:'fridge'},tortilla:{icon:'🌮',name:'Tortilla',source:'cabinet'},'taco-meat':{icon:'🍖',name:'Taco Meat',source:'fridge',cook:6000},egg:{icon:'🥚',name:'Egg',source:'fridge',cook:5000},bacon:{icon:'🥓',name:'Bacon',source:'fridge',cook:7000},toast:{icon:'🍞',name:'Toast',source:'cabinet'}};
const CAFE_GUESTS=['Maya','Noah','Avery','Leo','Zoe','Kai'];

const LOBBY_MENU = [
  { id: 'pasta', name: 'Garden Pasta', icon: '\u{1F35D}', price: 8 },
  { id: 'chicken', name: 'Herb Chicken Plate', icon: '\u{1F357}', price: 9 },
  { id: 'salmon', name: 'Lemon Salmon Dinner', icon: '\u{1F41F}', price: 10 },
  { id: 'ravioli', name: 'Vegetable Ravioli', icon: '\u{1F35D}', price: 8 },
  { id: 'breakfast', name: 'Palm Court Breakfast', icon: '\u{1F373}', price: 7 },
  { id: 'dessert', name: 'Berry Sundae', icon: '\u{1F368}', price: 5 },
];

const PALM_KITCHEN_INGREDIENTS = {
  pasta: { name: 'Pasta', icon: '\u{1F35D}', source: 'pantry', cook: 3200 },
  sauce: { name: 'Tomato Sauce', icon: '\u{1F345}', source: 'pantry' },
  herbs: { name: 'Fresh Herbs', icon: '\u{1F33F}', source: 'fridge' },
  chicken: { name: 'Chicken', icon: '\u{1F357}', source: 'fridge', cook: 4200 },
  potatoes: { name: 'Potatoes', icon: '\u{1F954}', source: 'pantry', cook: 3600 },
  salmon: { name: 'Salmon', icon: '\u{1F41F}', source: 'fridge', cook: 4200 },
  lemon: { name: 'Lemon', icon: '\u{1F34B}', source: 'fridge' },
  vegetables: { name: 'Vegetables', icon: '\u{1F966}', source: 'fridge' },
  ravioli: { name: 'Ravioli', icon: '\u{1F95F}', source: 'fridge', cook: 3200 },
  eggs: { name: 'Eggs', icon: '\u{1F373}', source: 'fridge', cook: 3000 },
  toast: { name: 'Toast', icon: '\u{1F35E}', source: 'pantry' },
  berries: { name: 'Berries', icon: '\u{1F353}', source: 'fridge' },
  cream: { name: 'Ice Cream', icon: '\u{1F368}', source: 'freezer' },
  wafer: { name: 'Wafer', icon: '\u{1F36A}', source: 'pantry' },
};

const PALM_KITCHEN_RECIPES = [
  { id: 'pasta', name: 'Garden Pasta', icon: '\u{1F35D}', ingredients: ['pasta', 'sauce', 'herbs'] },
  { id: 'chicken', name: 'Herb Chicken Plate', icon: '\u{1F357}', ingredients: ['chicken', 'potatoes', 'herbs'] },
  { id: 'salmon', name: 'Lemon Salmon Dinner', icon: '\u{1F41F}', ingredients: ['salmon', 'lemon', 'vegetables'] },
  { id: 'ravioli', name: 'Vegetable Ravioli', icon: '\u{1F95F}', ingredients: ['ravioli', 'sauce', 'vegetables'] },
  { id: 'breakfast', name: 'Palm Court Breakfast', icon: '\u{1F373}', ingredients: ['eggs', 'toast', 'berries'] },
  { id: 'dessert', name: 'Berry Sundae', icon: '\u{1F368}', ingredients: ['berries', 'cream', 'wafer'] },
];

const DINING_DRINKS = [
  { id: 'water', name: 'Ice Water', icon: '\u{1F4A7}' },
  { id: 'lemonade', name: 'Lemonade', icon: '\u{1F34B}' },
  { id: 'juice', name: 'Fruit Juice', icon: '\u{1F9C3}' },
];

const CUSTODIAN_TASKS = [
  { id: 'spill', name: 'Lobby Spill', icon: '\u{1F4A7}', tool: 'mop', hint: 'A mop works best on a spill.' },
  { id: 'crumbs', name: 'Crumbs on the Floor', icon: '\u{1F35E}', tool: 'broom', hint: 'Sweep dry crumbs with the broom.' },
  { id: 'glass', name: 'Fingerprints on Glass', icon: '\u{1FA9F}', tool: 'spray', hint: 'Use spray and a cloth on the glass.' },
  { id: 'trash', name: 'Full Waste Bin', icon: '\u{1F5D1}', tool: 'bag', hint: 'Use a fresh bag for the waste bin.' },
];

const CUSTODIAN_TOOLS = [
  { id: 'mop', name: 'Mop', icon: '\u{1F9F9}' },
  { id: 'broom', name: 'Broom', icon: '\u{1F9F9}' },
  { id: 'spray', name: 'Spray + Cloth', icon: '\u{1F9F4}' },
  { id: 'bag', name: 'Trash Bag', icon: '\u{1F6CD}' },
];

const CAFE_MENU = CAFE_RECIPES.map(({ id, name, icon, price }) => ({ id, name, icon, price }));

const MARKET_ITEMS = [
  { id: 'eggs', name: 'Eggs', icon: '\u{1F95A}', price: 3 },
  { id: 'milk', name: 'Milk', icon: '\u{1F95B}', price: 3 },
  { id: 'berries', name: 'Berries', icon: '\u{1FAD0}', price: 3 },
  { id: 'bread', name: 'Bread', icon: '\u{1F35E}', price: 2 },
  { id: 'cheese', name: 'Cheese', icon: '\u{1F9C0}', price: 3 },
  { id: 'apples', name: 'Apples', icon: '\u{1F34E}', price: 2 },
];

const RECIPES = [
  { id: 'berry-breakfast', name: 'Berry Breakfast', icon: '\u{1F95E}', ingredients: { eggs: 1, milk: 1, berries: 1 } },
  { id: 'grilled-cheese', name: 'Grilled Cheese', icon: '\u{1F96A}', ingredients: { bread: 1, cheese: 1 } },
  { id: 'fruit-bowl', name: 'Fruit Bowl', icon: '\u{1F963}', ingredients: { berries: 1, apples: 1 } },
];

const CHARACTER_OPTIONS = {
  gender: [
    { id: 'girl', name: 'Girl' },
    { id: 'boy', name: 'Boy' },
  ],
  eye: [
    { id: 'brown', name: 'Brown', color: '#74401f' },
    { id: 'hazel', name: 'Hazel', color: '#8b6b2f' },
    { id: 'green', name: 'Green', color: '#4f7e56' },
    { id: 'blue', name: 'Blue', color: '#467db6' },
    { id: 'gray', name: 'Gray', color: '#667785' },
  ],
  hair: [
    { id: 'brown', name: 'Brown', color: '#704126', dark: '#432518' },
    { id: 'black', name: 'Black', color: '#302923', dark: '#171412' },
    { id: 'blonde', name: 'Blonde', color: '#d6a84c', dark: '#9a6f2e' },
    { id: 'auburn', name: 'Auburn', color: '#9a4f32', dark: '#5f2b22' },
    { id: 'red', name: 'Red', color: '#b65a37', dark: '#743322' },
  ],
  skin: [
    { id: 'fair', name: 'Fair', color: '#f8d4bd', shadow: '#dea17c' },
    { id: 'warm', name: 'Warm', color: '#ffd0ad', shadow: '#ed9e70' },
    { id: 'tan', name: 'Tan', color: '#dca078', shadow: '#b87554' },
    { id: 'brown', name: 'Brown', color: '#a96f50', shadow: '#784b39' },
    { id: 'deep', name: 'Deep', color: '#704936', shadow: '#4b3025' },
  ],
  base: [
    { id: 'pink', name: 'Pink', color: '#ff4f9a' },
    { id: 'red', name: 'Red', color: '#db5656' },
    { id: 'orange', name: 'Orange', color: '#ed8a43' },
    { id: 'yellow', name: 'Yellow', color: '#e5b93e' },
    { id: 'green', name: 'Green', color: '#54b879' },
    { id: 'blue', name: 'Blue', color: '#438fd0' },
    { id: 'purple', name: 'Purple', color: '#8d66bd' },
  ],
};

const LOOK_OPTIONS = {
  shirt: [
    { id: 'tee', name: 'Classic Tee', swatch: '#ff4f9a', sleeve: 'short', price: 6 },
    { id: 'tank', name: 'Tank Top', swatch: '#f1be38', sleeve: 'none', price: 6 },
    { id: 'long-sleeve', name: 'Long Sleeve', swatch: '#43aee5', sleeve: 'long', price: 8 },
    { id: 'puff-sleeve', name: 'Puff Sleeve', swatch: '#54c79c', sleeve: 'puff', price: 8 },
  ],
  bottoms: [
    { id: 'straight', name: 'Straight Pants', swatch: '#3b78ba', leg: 'straight', price: 7 },
    { id: 'shorts', name: 'Shorts', swatch: '#334d78', leg: 'short', price: 6 },
    { id: 'wide-leg', name: 'Wide-Leg Pants', swatch: '#9a73c9', leg: 'wide', price: 8 },
    { id: 'flares', name: 'Flared Pants', swatch: '#dc6b63', leg: 'flare', price: 8 },
  ],
  shoes: [
    { id: 'sneakers', name: 'Sneakers', swatch: '#f05d9b', shoe: 'sneakers', price: 5 },
    { id: 'trainers', name: 'Trainers', swatch: '#f4f4f0', shoe: 'trainers', price: 5 },
    { id: 'high-tops', name: 'High-Tops', swatch: '#efc33f', shoe: 'high-tops', price: 7 },
    { id: 'slip-ons', name: 'Slip-Ons', swatch: '#448fcc', shoe: 'slip-ons', price: 5 },
  ],
  glasses: [
    { id: 'none', name: 'No Glasses', swatch: '#6f4b3e', price: 0 },
    { id: 'round', name: 'Round Glasses', swatch: '#6f4b3e', price: 4 },
    { id: 'square', name: 'Square Glasses', swatch: '#35516d', price: 4 },
    { id: 'cat-eye', name: 'Cat-Eye Glasses', swatch: '#a73e78', price: 5 },
    { id: 'sunglasses', name: 'Sunglasses', swatch: '#252c38', price: 5 },
  ],
  headwear: [
    { id: 'none', name: 'No Hat', swatch: '#ff4f9a', price: 0 },
    { id: 'cap', name: 'Baseball Cap', swatch: '#43aee5', price: 5 },
    { id: 'beanie', name: 'Beanie', swatch: '#9a73c9', price: 5 },
    { id: 'headband', name: 'Headband', swatch: '#54c79c', price: 4 },
    { id: 'bow', name: 'Hair Bow', swatch: '#ff4f9a', price: 4 },
  ],
  hair: [
    { id: 'waves', name: 'Loose Waves' },
    { id: 'ponytail', name: 'Ponytail' },
    { id: 'bun', name: 'High Bun' },
    { id: 'bob', name: 'Bob' },
    { id: 'curls', name: 'Curls' },
    { id: 'braids', name: 'Braids' },
    { id: 'pigtails', name: 'Pigtails' },
    { id: 'short', name: 'Short Cut' },
    { id: 'buzz', name: 'Buzz Cut' },
    { id: 'swoop', name: 'Side Swoop' },
    { id: 'mohawk', name: 'Mohawk' },
  ],
};

const CHARACTER_NAMES = [
  'Avery', 'Jordan', 'Mia', 'Leo', 'Nina', 'Kai', 'Zoe', 'Maya',
  'Eli', 'Sam', 'Riley', 'Noah', 'Lily', 'Max', 'Ruby', 'Theo',
];

const CHARACTER_COLOR_PALETTE = [
  '#ff4f9a', '#db5656', '#ed8a43', '#e5b93e', '#54b879',
  '#438fd0', '#8d66bd', '#43aee5', '#54c79c', '#334d78',
  '#9a73c9', '#dc6b63', '#252c38', '#f4f4f0',
];

const DEFAULT_FACE_BUILD = {
  height: 3,
  weight: 3,
  strength: 3,
  faceWidth: 3,
  faceHeight: 3,
  noseX: 3,
  noseY: 3,
  noseSize: 3,
  eyeSpacing: 3,
  eyeSize: 3,
  mouthWidth: 3,
  makeup: 'none',
  makeupColor: '#d85f83',
};

const DEFAULT_PERSONALITY = {
  friendliness: 3,
  confidence: 3,
  curiosity: 3,
  energy: 3,
  note: '',
};

const PERSONALITY_STATS = [
  ['friendliness', 'Friendliness'],
  ['confidence', 'Confidence'],
  ['curiosity', 'Curiosity'],
  ['energy', 'Energy'],
];

const FACE_SLIDERS = [
  ['faceWidth', 'Face width'],
  ['faceHeight', 'Face height'],
  ['noseX', 'Nose left / right'],
  ['noseY', 'Nose up / down'],
  ['noseSize', 'Nose size'],
  ['eyeSpacing', 'Eye spacing'],
  ['eyeSize', 'Eye size'],
  ['mouthWidth', 'Mouth width'],
];

function idlePhaseForName(name = '') {
  const source = String(name || 'guest');
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) % 997;
  }
  return `${-((hash % 61) / 10)}s`;
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomLevel() {
  return 1 + Math.floor(Math.random() * 5);
}

function randomSwatch() {
  return randomChoice(CHARACTER_COLOR_PALETTE);
}

function cloneFashionOption(option, randomColor = false) {
  return {
    ...option,
    swatch: randomColor && option.id !== 'none' ? randomSwatch() : option.swatch,
  };
}

function cloneLook(source) {
  return {
    ...source,
    shirt: { ...source.shirt },
    bottoms: { ...source.bottoms },
    shoes: { ...source.shoes },
    glasses: { ...source.glasses },
    headwear: { ...source.headwear },
    hair: { ...source.hair },
  };
}

function makeCafeAmbientPerson(variant) {
  const person = makeCharacterPerson('random');
  if (variant === 0) {
    return {
      ...person,
      name: 'Kai',
      character: {
        ...person.character,
        gender: 'boy', eye: 'blue', hair: 'black', skin: 'brown', base: 'blue',
        height: 4, weight: 2, strength: 3, makeup: 'none',
      },
      look: {
        shirt: { ...LOOK_OPTIONS.shirt[2], swatch: '#43aee5' },
        bottoms: { ...LOOK_OPTIONS.bottoms[1], swatch: '#334d78' },
        shoes: { ...LOOK_OPTIONS.shoes[2], swatch: '#efc33f' },
        glasses: { ...LOOK_OPTIONS.glasses[2], swatch: '#35516d' },
        headwear: { ...LOOK_OPTIONS.headwear[1], swatch: '#43aee5' },
        hair: { ...LOOK_OPTIONS.hair[8] },
      },
    };
  }
  return {
    ...person,
    name: 'Zoe',
    character: {
      ...person.character,
      gender: 'girl', eye: 'green', hair: 'auburn', skin: 'fair', base: 'purple',
      height: 2, weight: 4, strength: 2, makeup: 'freckles', makeupColor: '#a45e45',
    },
    look: {
      shirt: { ...LOOK_OPTIONS.shirt[3], swatch: '#54c79c' },
      bottoms: { ...LOOK_OPTIONS.bottoms[3], swatch: '#dc6b63' },
      shoes: { ...LOOK_OPTIONS.shoes[3], swatch: '#448fcc' },
      glasses: { ...LOOK_OPTIONS.glasses[3], swatch: '#a73e78' },
      headwear: { ...LOOK_OPTIONS.headwear[4], swatch: '#ff4f9a' },
      hair: { ...LOOK_OPTIONS.hair[5] },
    },
  };
}

function makeCharacterPerson(mode = 'random') {
  const random = mode === 'random' || mode === 'custom';
  const gender = random ? randomChoice(CHARACTER_OPTIONS.gender).id : 'girl';
  const eye = random ? randomChoice(CHARACTER_OPTIONS.eye).id : 'brown';
  const hair = random ? randomChoice(CHARACTER_OPTIONS.hair).id : 'brown';
  const skin = random ? randomChoice(CHARACTER_OPTIONS.skin).id : 'warm';
  const base = random ? randomChoice(CHARACTER_OPTIONS.base).id : 'pink';
  const hairStyle = random ? randomChoice(LOOK_OPTIONS.hair) : LOOK_OPTIONS.hair[0];

  return {
    id: 'person-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    name: random ? randomChoice(CHARACTER_NAMES) : 'New Friend',
    source: mode,
    character: {
      gender,
      eye,
      hair,
      skin,
      base,
      ...DEFAULT_FACE_BUILD,
      ...(random
        ? {
            height: randomLevel(),
            weight: randomLevel(),
            strength: randomLevel(),
            faceWidth: randomLevel(),
            faceHeight: randomLevel(),
            noseX: randomLevel(),
            noseY: randomLevel(),
            noseSize: randomLevel(),
            eyeSpacing: randomLevel(),
            eyeSize: randomLevel(),
            mouthWidth: randomLevel(),
            makeup: randomChoice(['none', 'blush', 'freckles', 'lashes', 'lip']),
            makeupColor: randomSwatch(),
          }
        : {}),
    },
    look: {
      shirt: cloneFashionOption(random ? randomChoice(LOOK_OPTIONS.shirt) : LOOK_OPTIONS.shirt[0], random),
      bottoms: cloneFashionOption(random ? randomChoice(LOOK_OPTIONS.bottoms) : LOOK_OPTIONS.bottoms[0], random),
      shoes: cloneFashionOption(random ? randomChoice(LOOK_OPTIONS.shoes) : LOOK_OPTIONS.shoes[0], random),
      glasses: cloneFashionOption(random ? randomChoice(LOOK_OPTIONS.glasses) : LOOK_OPTIONS.glasses[0], random),
      headwear: cloneFashionOption(random ? randomChoice(LOOK_OPTIONS.headwear) : LOOK_OPTIONS.headwear[0], random),
      hair: hairStyle,
    },
    personality: {
      ...DEFAULT_PERSONALITY,
      ...(random
        ? {
            friendliness: randomLevel(),
            confidence: randomLevel(),
            curiosity: randomLevel(),
            energy: randomLevel(),
          }
        : {}),
    },
    spawn: {
      x: 20 + Math.round(Math.random() * 60),
      y: 54 + Math.round(Math.random() * 25),
    },
  };
}

const FASHION_CATEGORIES = [
  { id: 'shirt', label: 'Tops' },
  { id: 'bottoms', label: 'Bottoms' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'glasses', label: 'Glasses & Sunglasses' },
  { id: 'headwear', label: 'Hats & Hair Accessories' },
];

function fashionKey(category, option) {
  if (!option) return '';
  const color = option.id === 'none' ? 'none' : (option.swatch || '').toLowerCase();
  return category + ':' + option.id + ':' + color;
}

const FASHION_CUSTOMERS = [
  { id: 'maya', pickiness: 'easygoing' },
  { id: 'leo', pickiness: 'particular' },
  { id: 'zoe', pickiness: 'picky' },
  { id: 'kai', pickiness: 'easygoing' },
  { id: 'nina', pickiness: 'picky' },
];

const FASHION_BASE_PAY = 3;
const FASHION_STAR_SCORE = 8;

const FASHION_FEELINGS = {
  maya: {
    label: 'playful and creative',
    request: 'I want to feel playful and creative, like my outfit matches my imagination.',
    targets: {
      shirt: { type: 'puff-sleeve', color: '#8d66bd' },
      bottoms: { type: 'shorts', color: '#dc6b63' },
      shoes: { type: 'high-tops', color: '#efc33f' },
      glasses: { type: 'round', color: '#8d66bd' },
      headwear: { type: 'bow', color: '#ff4f9a' },
    },
  },
  leo: {
    label: 'confident and comfortable',
    request: 'I want to feel confident and comfortable, like I can relax and still feel cool.',
    targets: {
      shirt: { type: 'tee', color: '#438fd0' },
      bottoms: { type: 'straight', color: '#334d78' },
      shoes: { type: 'high-tops', color: '#438fd0' },
      glasses: { type: 'square', color: '#35516d' },
      headwear: { type: 'cap', color: '#438fd0' },
    },
  },
  zoe: {
    label: 'stylish and dramatic',
    request: 'I want to feel stylish and dramatic, with a look that feels bold and expressive.',
    targets: {
      shirt: { type: 'long-sleeve', color: '#252c38' },
      bottoms: { type: 'flares', color: '#dc6b63' },
      shoes: { type: 'slip-ons', color: '#252c38' },
      glasses: { type: 'cat-eye', color: '#ff4f9a' },
      headwear: { type: 'headband', color: '#8d66bd' },
    },
  },
  kai: {
    label: 'comfortable and free',
    request: 'I want to feel comfortable and free, with a look that feels easy and a little unexpected.',
    targets: {
      shirt: { type: 'tank', color: '#54c79c' },
      bottoms: { type: 'wide-leg', color: '#9a73c9' },
      shoes: { type: 'slip-ons', color: '#448fcc' },
      glasses: { type: 'round', color: '#6f4b3e' },
      headwear: { type: 'beanie', color: '#54c79c' },
    },
  },
  nina: {
    label: 'cheerful and put-together',
    request: 'I want to feel cheerful and put-together, like today is a little bit special.',
    targets: {
      shirt: { type: 'puff-sleeve', color: '#f1be38' },
      bottoms: { type: 'shorts', color: '#ff4f9a' },
      shoes: { type: 'sneakers', color: '#f1be38' },
      glasses: { type: 'round', color: '#ff4f9a' },
      headwear: { type: 'bow', color: '#f1be38' },
    },
  },
};

function fashionFeeling(customer) {
  return FASHION_FEELINGS[customer.id] || FASHION_FEELINGS.maya;
}

function fashionColorThreshold(customer) {
  if (customer.pickiness === 'picky') return 58;
  if (customer.pickiness === 'particular') return 78;
  return 100;
}

function hexToRgb(hex) {
  const value = String(hex || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function colorDistance(first, second) {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  if (!a || !b) return Infinity;
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

function ingredientLabel(id) {
  return MARKET_ITEMS.find((item) => item.id === id)?.name ?? id;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function KidsResort({ libraryHref = null }) {
  const [placeId, setPlaceId] = useState('suite');
  const [selectedPlaceId, setSelectedPlaceId] = useState('suite');
  const [screen, setScreen] = useState('map');
  const [bucks, setBucks] = useState(20);
  const [badges, setBadges] = useState([]);
  const [inventory, setInventory] = useState({});
  const [meals, setMeals] = useState([]);
  const [message, setMessage] = useState('');
  const [position, setPosition] = useState({ x: 50, y: 82 });
  const [isWalking, setIsWalking] = useState(false);
  const [walkFrame, setWalkFrame] = useState(0);
  const [facing, setFacing] = useState('right');
  const [walkView, setWalkView] = useState('front');
  const [touchPlaceId, setTouchPlaceId] = useState(null);
  const [characterName, setCharacterName] = useState('Emily');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [character, setCharacter] = useState({
    gender: 'girl',
    eye: 'brown',
    hair: 'brown',
    skin: 'warm',
    base: 'pink',
    ...DEFAULT_FACE_BUILD,
  });
  const walkTokenRef = useRef(0);
  const mapPanelRef = useRef(null);
  const placeBuildingRefs = useRef({});
  const npcRoamRef = useRef({});
  const [buildingDepths, setBuildingDepths] = useState(() => (
    Object.fromEntries(PLACES.map((place) => [place.id, place.y]))
  ));
  const [look, setLook] = useState({
    shirt: LOOK_OPTIONS.shirt[0],
    bottoms: LOOK_OPTIONS.bottoms[0],
    shoes: LOOK_OPTIONS.shoes[0],
    glasses: LOOK_OPTIONS.glasses[0],
    headwear: LOOK_OPTIONS.headwear[0],
    hair: LOOK_OPTIONS.hair[0],
  });

  const [people, setPeople] = useState([]);
  const [studioAmbientPerson] = useState(() => makeCharacterPerson('random'));
  const [cafeAmbientPeople] = useState(() => [makeCafeAmbientPerson(0), makeCafeAmbientPerson(1)]);
  const [lobbyAmbientPeople] = useState(() => [makeCharacterPerson('random'), makeCharacterPerson('random')]);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [personEditorOpen, setPersonEditorOpen] = useState(false);
  const [personDraft, setPersonDraft] = useState(null);
  const [personEditorMode, setPersonEditorMode] = useState('edit');

  const [studioMessage, setStudioMessage] = useState('');
  const [studioCreations, setStudioCreations] = useState(0);
  const [studioCategory, setStudioCategory] = useState('shirt');
  const [studioWorkTool, setStudioWorkTool] = useState('fashion');
  const [studioCustomerIndex, setStudioCustomerIndex] = useState(0);
  const [studioCustomerPerson, setStudioCustomerPerson] = useState(null);
  const [studioCustomerDone, setStudioCustomerDone] = useState(false);
  const [studioTipResult, setStudioTipResult] = useState(null);
  const [studioBeautyDraft, setStudioBeautyDraft] = useState(null);
  const [artColor, setArtColor] = useState('#ff4f9a');
  const artCanvasRef = useRef(null);
  const artDrawingRef = useRef(false);
  const [studioDraftLook, setStudioDraftLook] = useState(null);
  const [ownedLooks, setOwnedLooks] = useState(() => new Set([
    fashionKey('shirt', LOOK_OPTIONS.shirt[0]),
    fashionKey('bottoms', LOOK_OPTIONS.bottoms[0]),
    fashionKey('shoes', LOOK_OPTIONS.shoes[0]),
    fashionKey('glasses', LOOK_OPTIONS.glasses[0]),
    fashionKey('headwear', LOOK_OPTIONS.headwear[0]),
  ]));

  const [cafeMessage, setCafeMessage] = useState('');
  const [cafeOrders, setCafeOrders] = useState([]);
  const [cafePlate, setCafePlate] = useState([]);
  const [cafeGrill, setCafeGrill] = useState([]);
  const [cafeStorage, setCafeStorage] = useState(null);
  const [cafeServed, setCafeServed] = useState(0);
  const [cafeNow, setCafeNow] = useState(Date.now());
  const [cafeFinished, setCafeFinished] = useState(false);

  const [palmKitchenActive, setPalmKitchenActive] = useState(false);
  const [palmKitchenServed, setPalmKitchenServed] = useState(0);
  const [palmKitchenPlate, setPalmKitchenPlate] = useState([]);
  const [palmKitchenStove, setPalmKitchenStove] = useState([]);
  const [palmKitchenStorage, setPalmKitchenStorage] = useState(null);
  const [palmKitchenNow, setPalmKitchenNow] = useState(Date.now());
  const [palmKitchenMessage, setPalmKitchenMessage] = useState('');
  const [palmKitchenFinished, setPalmKitchenFinished] = useState(false);

  const [diningMealId, setDiningMealId] = useState(null);
  const [diningDrinkId, setDiningDrinkId] = useState('water');
  const [diningBites, setDiningBites] = useState(0);
  const [diningAction, setDiningAction] = useState('');
  const [diningActionTick, setDiningActionTick] = useState(0);

  const [custodianTaskIndex, setCustodianTaskIndex] = useState(0);
  const [custodianTool, setCustodianTool] = useState(null);
  const [custodianCleaned, setCustodianCleaned] = useState(0);
  const [custodianFinished, setCustodianFinished] = useState(false);
  const [custodianMessage, setCustodianMessage] = useState('');

  const [poolAction, setPoolAction] = useState('');
  const [poolActionTick, setPoolActionTick] = useState(0);
  const [poolFun, setPoolFun] = useState(0);

  const selectedPlace = useMemo(
    () => PLACES.find((place) => place.id === selectedPlaceId) ?? PLACES[0],
    [selectedPlaceId],
  );

  const placeDisplayName = (place) =>
    place?.id === 'suite' ? `${characterName}’s House` : place?.name;

  const characterStyleFor = (appearance = character) => {
    const eyeChoice =
      CHARACTER_OPTIONS.eye.find((option) => option.id === appearance.eye) ??
      CHARACTER_OPTIONS.eye[0];
    const hairChoice =
      CHARACTER_OPTIONS.hair.find((option) => option.id === appearance.hair) ??
      CHARACTER_OPTIONS.hair[0];
    const skinChoice =
      CHARACTER_OPTIONS.skin.find((option) => option.id === appearance.skin) ??
      CHARACTER_OPTIONS.skin[0];
    const baseChoice =
      CHARACTER_OPTIONS.base.find((option) => option.id === appearance.base) ??
      CHARACTER_OPTIONS.base[0];

    const level = (value) => Math.max(1, Math.min(5, Number(value) || 3));
    const centered = (value) => level(value) - 3;

    return {
      '--character-eye': eyeChoice.color,
      '--character-hair': hairChoice.color,
      '--character-hair-dark': hairChoice.dark,
      '--character-skin': skinChoice.color,
      '--character-skin-shadow': skinChoice.shadow,
      '--character-base': baseChoice.color,
      '--character-height-scale': 1 + centered(appearance.height) * 0.055,
      '--character-weight-scale': 1 + centered(appearance.weight) * 0.075,
      '--character-strength-scale': 1 + centered(appearance.strength) * 0.09,
      '--character-face-width': 1 + centered(appearance.faceWidth) * 0.075,
      '--character-face-height': 1 + centered(appearance.faceHeight) * 0.07,
      '--character-nose-x': centered(appearance.noseX),
      '--character-nose-y': centered(appearance.noseY),
      '--character-nose-size': 1 + centered(appearance.noseSize) * 0.14,
      '--character-eye-spacing': centered(appearance.eyeSpacing),
      '--character-eye-size': 1 + centered(appearance.eyeSize) * 0.12,
      '--character-mouth-width': 1 + centered(appearance.mouthWidth) * 0.14,
      '--character-makeup': appearance.makeup || 'none',
      '--character-makeup-color': appearance.makeupColor || '#d85f83',
    };
  };

  const characterStyle = characterStyleFor(character);

  useEffect(() => {
    return () => {
      walkTokenRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (screen !== 'map' || people.length > 0) return undefined;

    const delay = 120000 + Math.round(Math.random() * 180000);
    const timer = window.setTimeout(() => {
      setPeople((items) => (
        items.length === 0
          ? [makeCharacterPerson('random')]
          : items
      ));
    }, delay);

    return () => window.clearTimeout(timer);
  }, [screen, people.length]);

  useEffect(() => {
    if (screen !== 'cafe-work' || cafeFinished) return undefined;
    const timer=window.setInterval(()=>setCafeNow(Date.now()),250);
    return ()=>window.clearInterval(timer);
  }, [screen,cafeFinished]);

  useEffect(() => {
    if (screen !== 'map') return undefined;

    const measureBuildingDepths = () => {
      const panel = mapPanelRef.current;
      if (!panel) return;

      const panelRect = panel.getBoundingClientRect();
      if (!panelRect.height) return;

      const nextDepths = {};
      PLACES.forEach((place) => {
        const building = placeBuildingRefs.current[place.id];
        if (!building) {
          nextDepths[place.id] = place.y;
          return;
        }

        const buildingRect = building.getBoundingClientRect();
        nextDepths[place.id] = Math.max(
          0,
          Math.min(100, ((buildingRect.bottom - panelRect.top) / panelRect.height) * 100),
        );
      });

      setBuildingDepths((current) => {
        const changed = PLACES.some((place) => (
          Math.abs((current[place.id] ?? place.y) - nextDepths[place.id]) > 0.02
        ));
        return changed ? nextDepths : current;
      });
    };

    const frame = window.requestAnimationFrame(measureBuildingDepths);
    const observer = typeof ResizeObserver === 'function'
      ? new ResizeObserver(measureBuildingDepths)
      : null;

    if (observer) {
      if (mapPanelRef.current) observer.observe(mapPanelRef.current);
      Object.values(placeBuildingRefs.current).forEach((building) => {
        if (building) observer.observe(building);
      });
    }

    window.addEventListener('resize', measureBuildingDepths);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', measureBuildingDepths);
    };
  }, [screen, selectedPlaceId]);

  useEffect(() => {
    if (screen !== 'map' || people.length === 0) return undefined;

    const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

    const chooseTarget = (person) => {
      const current = person.spawn ?? { x: 50, y: 65 };
      const angle = Math.random() * Math.PI * 2;
      const distance = 8 + Math.random() * 18;

      return {
        x: clamp(current.x + Math.cos(angle) * distance, 8, 92),
        y: clamp(current.y + Math.sin(angle) * distance * 0.7, 44, 90),
      };
    };

    const tick = () => {
      const now = performance.now();

      setPeople((items) => {
        let changed = false;
        const liveIds = new Set(items.map((person) => person.id));

        Object.keys(npcRoamRef.current).forEach((id) => {
          if (!liveIds.has(id)) delete npcRoamRef.current[id];
        });

        const nextItems = items.map((person) => {
          const current = person.spawn ?? { x: 50, y: 65 };
          let roam = npcRoamRef.current[person.id];

          if (!roam) {
            roam = {
              target: null,
              pauseUntil: now + 400 + Math.random() * 1800,
            };
            npcRoamRef.current[person.id] = roam;
          }

          if (now < roam.pauseUntil) {
            if (person.isRoaming) {
              changed = true;
              return { ...person, isRoaming: false };
            }
            return person;
          }

          if (!roam.target) {
            roam.target = chooseTarget(person);
          }

          const dx = roam.target.x - current.x;
          const dy = roam.target.y - current.y;
          const distance = Math.hypot(dx, dy);

          if (distance < 0.45) {
            roam.target = null;
            roam.pauseUntil = now + 700 + Math.random() * 2300;
            if (person.isRoaming) {
              changed = true;
              return { ...person, isRoaming: false };
            }
            return person;
          }

          const energy = Math.max(1, Math.min(5, Number(person.personality?.energy) || 3));
          const step = Math.min(distance, 0.17 + energy * 0.038);
          const nextX = current.x + (dx / distance) * step;
          const nextY = current.y + (dy / distance) * step;

          changed = true;
          return {
            ...person,
            isRoaming: true,
            walkDirection: Math.abs(dx) > Math.abs(dy)
              ? (dx < 0 ? 'left' : 'right')
              : (dy < 0 ? 'back' : 'front'),
            spawn: {
              x: nextX,
              y: nextY,
            },
          };
        });

        return changed ? nextItems : items;
      });
    };

    tick();
    const timer = window.setInterval(tick, 120);
    return () => window.clearInterval(timer);
  }, [screen, people.length]);

  useEffect(() => {
    if (screen !== 'cafe-work' || cafeFinished) return undefined;
    const delay = Math.max(11000, 19000 - cafeServed * 900);
    const maxOrders = cafeServed < 4 ? 2 : 3;
    const timer = window.setInterval(() => {
      setCafeOrders((items) =>
        items.length < maxOrders
          ? [...items, makeCafeOrder(cafeServed + items.length)]
          : items,
      );
    }, delay);
    return () => window.clearInterval(timer);
  }, [screen, cafeFinished, cafeServed]);

  const mapDepthRanks = useMemo(() => {
    const entries = [
      ...PLACES.map((place) => ({
        key: `place:${place.id}`,
        depth: buildingDepths[place.id] ?? place.y,
        building: true,
      })),
      ...people.map((person) => ({
        key: `person:${person.id}`,
        depth: person.spawn?.y ?? 60,
        building: false,
      })),
      {
        key: 'player',
        depth: position.y,
        building: false,
      },
    ];

    entries.sort((first, second) => {
      const depthDifference = first.depth - second.depth;
      if (Math.abs(depthDifference) > 0.001) return depthDifference;
      if (first.building === second.building) return first.key.localeCompare(second.key);
      return first.building ? 1 : -1;
    });

    return Object.fromEntries(entries.map((entry, index) => [entry.key, 5 + index]));
  }, [buildingDepths, people, position.y]);

  useEffect(() => {
    if (screen !== 'cafe-work') return;
    setCafeOrders((items) => items.filter((order) => cafeNow - order.born < 45000));
  }, [cafeNow, screen]);

  useEffect(() => {
    if (screen !== 'lobby-restaurant-work' || !palmKitchenActive || palmKitchenFinished) return undefined;
    const timer = window.setInterval(() => setPalmKitchenNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [screen, palmKitchenActive, palmKitchenFinished]);

  const travelTo = (nextPlace) => {
    if (!nextPlace || isWalking) return;

    setSelectedPlaceId(nextPlace.id);
    setMessage('');

    if (nextPlace.id === placeId) {
      return;
    }

    const placeById = (id) => PLACES.find((place) => place.id === id);
    const current = placeById(placeId);
    const lobby = placeById('lobby');
    const suite = placeById('suite');
    const studio = placeById('studio');
    const market = placeById('market');

    const suiteGateFor = (referencePlace) =>
      (referencePlace?.x ?? 50) <= 50 ? studio : market;

    let route;

    if (current.id === 'suite') {
      const gate = suiteGateFor(nextPlace);
      route =
        nextPlace.id === gate.id
          ? [gate]
          : nextPlace.id === 'lobby'
            ? [gate, lobby]
            : [gate, lobby, nextPlace];
    } else if (nextPlace.id === 'suite') {
      const gate = suiteGateFor(current);
      route =
        current.id === gate.id
          ? [suite]
          : current.id === 'lobby'
            ? [gate, suite]
            : [lobby, gate, suite];
    } else if (current.id === 'lobby') {
      route = [nextPlace];
    } else if (nextPlace.id === 'lobby') {
      route = [lobby];
    } else {
      route = [lobby, nextPlace];
    }

    const token = walkTokenRef.current + 1;
    walkTokenRef.current = token;
    setIsWalking(true);

    const walkLeg = (start, destination, routeIndex) => {
      if (walkTokenRef.current !== token) return;

      const dx = destination.x - start.x;
      const dy = destination.y - start.y;
      const horizontalTravel = Math.abs(dx) > Math.abs(dy);

      if (horizontalTravel) {
        setFacing(dx > 0 ? 'right' : 'left');
        setWalkView('side');
      } else {
        setWalkView('front');
      }

      const steps = 8;
      let step = 0;

      const timer = window.setInterval(() => {
        if (walkTokenRef.current !== token) {
          window.clearInterval(timer);
          return;
        }

        step += 1;
        const progress = step / steps;
        setWalkFrame((step - 1) % 6);
        setPosition({
          x: clamp(start.x + dx * progress, 4, 96),
          y: clamp(start.y + dy * progress, 7, 91),
        });

        if (step >= steps) {
          window.clearInterval(timer);
          setPosition({ x: destination.x, y: destination.y });
          setPlaceId(destination.id);
          setWalkFrame(0);

          const nextStop = route[routeIndex + 1];
          if (nextStop) {
            walkLeg(destination, nextStop, routeIndex + 1);
          } else {
            setIsWalking(false);
            setWalkView('front');
          }
        }
      }, 90);
    };

    walkLeg(position, route[0], 0);
  };

  const enterPlace = (place) => {
    if (!place || place.id !== placeId || isWalking) return;

    if (place.id === 'suite') {
      openScreen('suite');
    } else if (place.id === 'lobby') {
      openScreen('lobby');
    } else if (place.id === 'cafe') {
      openScreen('cafe');
    } else if (place.id === 'market') {
      openScreen('market');
    } else if (place.id === 'studio') {
      openScreen('studio');
    }
  };

  const handlePlaceClick = (place) => {
    setSelectedPlaceId(place.id);
    setMessage('');

    if (place.id === placeId) {
      enterPlace(place);
      return;
    }

    travelTo(place);
  };

  const handlePlaceTouch = (event, place) => {
    event.preventDefault();
    setSelectedPlaceId(place.id);
    setMessage('');

    if (touchPlaceId !== place.id) {
      setTouchPlaceId(place.id);
      return;
    }

    if (place.id === placeId) {
      enterPlace(place);
      return;
    }

    travelTo(place);
  };

  const openScreen = (nextScreen) => {
    setMessage('');
    setScreen(nextScreen);
  };

  const makeCafeOrder=(number,born=Date.now())=>({id:`${born}-${number}`,guest:CAFE_GUESTS[number%CAFE_GUESTS.length],recipeId:CAFE_RECIPES[number%CAFE_RECIPES.length].id,born});
  const startCafeShift=()=>{const now=Date.now();setCafeOrders([makeCafeOrder(0,now)]);setCafePlate([]);setCafeGrill([]);setCafeStorage(null);setCafeServed(0);setCafeMessage('First customer! Check the recipe wall, then build the order.');setCafeNow(now);setCafeFinished(false);setScreen('cafe-work');};
  const takeCafeIngredient=(id)=>{const item=CAFE_INGREDIENTS[id];if(!item)return;if(item.cook){if(cafeGrill.length>=3){setCafeMessage('The grill is full.');return;}setCafeGrill((items)=>[...items,{id:`${Date.now()}-${id}`,ingredientId:id,started:Date.now()}]);setCafeMessage(`${item.name} is cooking. Remember to come back for it!`);return;}setCafePlate((items)=>[...items,id]);setCafeMessage(`${item.name} added to the plate.`);};
  const pullFromGrill=(g)=>{const item=CAFE_INGREDIENTS[g.ingredientId],elapsed=Date.now()-g.started;if(elapsed<item.cook){setCafeMessage(`${item.name} isn't ready yet.`);return;}if(elapsed>item.cook+4500){setCafeGrill((items)=>items.filter((x)=>x.id!==g.id));setCafeMessage(`${item.name} burned! Start that part again.`);return;}setCafeGrill((items)=>items.filter((x)=>x.id!==g.id));setCafePlate((items)=>[...items,g.ingredientId]);setCafeMessage(`${item.name} is ready and on the plate.`);};
  const serveCafeOrder=(order)=>{const recipe=CAFE_RECIPES.find((x)=>x.id===order.recipeId);if([...recipe.ingredients].sort().join('|')!==[...cafePlate].sort().join('|')){setCafeMessage(`That plate isn't ${recipe.icon} yet. Check the recipe wall.`);return;}const served=cafeServed+1;setCafeOrders((items)=>items.filter((x)=>x.id!==order.id));setCafePlate([]);setCafeServed(served);setBucks((v)=>v+4);setCafeMessage(`${order.guest} loved it! +4 Resort Bucks`);if(served>=8){setCafeFinished(true);setBucks((v)=>v+8);setBadges((items)=>items.includes('Sunshine Cafe Shift')?items:[...items,'Sunshine Cafe Shift']);}};

  const palmKitchenRecipeFor = (served) => PALM_KITCHEN_RECIPES[served % PALM_KITCHEN_RECIPES.length];

  const startPalmKitchenShift = () => {
    setPalmKitchenActive(true);
    setPalmKitchenServed(0);
    setPalmKitchenPlate([]);
    setPalmKitchenStove([]);
    setPalmKitchenStorage(null);
    setPalmKitchenNow(Date.now());
    setPalmKitchenFinished(false);
    setPalmKitchenMessage('First dinner ticket is in. Build the plate, cook the hot ingredients, then send it through the pass.');
  };

  const takePalmKitchenIngredient = (id) => {
    const item = PALM_KITCHEN_INGREDIENTS[id];
    if (!item || !palmKitchenActive || palmKitchenFinished) return;
    if (item.cook) {
      if (palmKitchenStove.length >= 3) {
        setPalmKitchenMessage('The stove is full. Finish something before starting another hot ingredient.');
        return;
      }
      setPalmKitchenStove((items) => [...items, { id: `${Date.now()}-${id}`, ingredientId: id, started: Date.now() }]);
      setPalmKitchenMessage(`${item.name} is cooking. Watch for READY.`);
      return;
    }
    setPalmKitchenPlate((items) => [...items, id]);
    setPalmKitchenMessage(`${item.name} is on the plate.`);
  };

  const pullPalmKitchenStove = (itemOnStove) => {
    const item = PALM_KITCHEN_INGREDIENTS[itemOnStove.ingredientId];
    const elapsed = Date.now() - itemOnStove.started;
    if (elapsed < item.cook) {
      setPalmKitchenMessage(`${item.name} still needs a little more time.`);
      return;
    }
    if (elapsed > item.cook + 5500) {
      setPalmKitchenStove((items) => items.filter((entry) => entry.id !== itemOnStove.id));
      setPalmKitchenMessage(`${item.name} overcooked. Start that ingredient again.`);
      return;
    }
    setPalmKitchenStove((items) => items.filter((entry) => entry.id !== itemOnStove.id));
    setPalmKitchenPlate((items) => [...items, itemOnStove.ingredientId]);
    setPalmKitchenMessage(`${item.name} is ready and plated.`);
  };

  const servePalmKitchenOrder = () => {
    if (!palmKitchenActive || palmKitchenFinished) return;
    const recipe = palmKitchenRecipeFor(palmKitchenServed);
    const expected = [...recipe.ingredients].sort().join('|');
    const actual = [...palmKitchenPlate].sort().join('|');
    if (expected !== actual) {
      setPalmKitchenMessage(`That plate is not ${recipe.name} yet. Check the ticket and fix the plate.`);
      return;
    }
    const served = palmKitchenServed + 1;
    setPalmKitchenPlate([]);
    setPalmKitchenStorage(null);
    setPalmKitchenServed(served);
    setBucks((value) => value + 6);
    if (served >= 5) {
      setPalmKitchenFinished(true);
      setBucks((value) => value + 10);
      setBadges((items) => (items.includes('Palm Court Kitchen Shift') ? items : [...items, 'Palm Court Kitchen Shift']));
      setPalmKitchenMessage('Dinner rush complete! +10 Resort Buck shift bonus.');
      return;
    }
    const nextRecipe = palmKitchenRecipeFor(served);
    setPalmKitchenMessage(`${recipe.name} sent out! +6 Resort Bucks. Next ticket: ${nextRecipe.name}.`);
  };

  const orderPalmCourtMeal = (meal) => {
    if (diningMealId && diningBites < 3) {
      setMessage('Finish the meal already at the table before ordering another entree.');
      return;
    }
    if (bucks < meal.price) {
      setMessage(`You need ${meal.price} Resort Bucks for ${meal.name}.`);
      return;
    }
    setBucks((value) => value - meal.price);
    setDiningMealId(meal.id);
    setDiningBites(0);
    setDiningAction('order');
    setDiningActionTick((value) => value + 1);
    setMessage(`${meal.name} is on the table. Take three bites to enjoy the meal.`);
  };

  const takeDiningBite = () => {
    const meal = LOBBY_MENU.find((item) => item.id === diningMealId);
    if (!meal) {
      setMessage('Choose something from the dinner menu first.');
      return;
    }
    if (diningBites >= 3) {
      setMessage(`${meal.name} is finished. You can order something else if you want.`);
      return;
    }
    const bites = diningBites + 1;
    setDiningBites(bites);
    setDiningAction(bites >= 3 ? 'celebrate' : 'bite');
    setDiningActionTick((value) => value + 1);
    if (bites >= 3) {
      setMeals((items) => [...items, meal.name]);
      const foodBadge = `Tried ${meal.name}`;
      setBadges((items) => (items.includes(foodBadge) ? items : [...items, foodBadge]));
      setMessage(`${characterName} finished ${meal.name}. Food badge earned!`);
    } else {
      setMessage(`That was bite ${bites} of 3. ${meal.name} looks good!`);
    }
  };

  const sipDiningDrink = (drinkId) => {
    const drink = DINING_DRINKS.find((item) => item.id === drinkId) || DINING_DRINKS[0];
    setDiningDrinkId(drink.id);
    setDiningAction('sip');
    setDiningActionTick((value) => value + 1);
    setMessage(`${characterName} takes a sip of ${drink.name}.`);
  };

  const restartCustodianShift = () => {
    setCustodianTaskIndex(0);
    setCustodianTool(null);
    setCustodianCleaned(0);
    setCustodianFinished(false);
    setCustodianMessage('Choose a tool from the cleaning cart, then take care of the highlighted lobby job.');
  };

  const attemptCustodianTask = () => {
    if (custodianFinished) return;
    const task = CUSTODIAN_TASKS[custodianTaskIndex % CUSTODIAN_TASKS.length];
    if (!custodianTool) {
      setCustodianMessage('Choose a tool from the cart first.');
      return;
    }
    if (custodianTool !== task.tool) {
      setCustodianMessage(`That tool is not the best choice. ${task.hint}`);
      return;
    }
    const cleaned = custodianCleaned + 1;
    setCustodianCleaned(cleaned);
    setCustodianTool(null);
    setBucks((value) => value + 3);
    if (cleaned >= 6) {
      setCustodianFinished(true);
      setBucks((value) => value + 6);
      setBadges((items) => (items.includes('Resort Custodian Shift') ? items : [...items, 'Resort Custodian Shift']));
      setCustodianMessage('Lobby shift complete! +6 Resort Buck bonus and a Resort Custodian badge.');
      return;
    }
    setCustodianTaskIndex((value) => value + 1);
    const nextTask = CUSTODIAN_TASKS[(custodianTaskIndex + 1) % CUSTODIAN_TASKS.length];
    setCustodianMessage(`${task.name} finished! +3 Resort Bucks. Next: ${nextTask.name}.`);
  };

  const playPoolActivity = (activity) => {
    const labels = {
      float: 'Relaxing on the pool float',
      slide: 'Splashing down the pool slide',
      ball: 'Playing with the beach ball',
    };
    const nextFun = Math.min(6, poolFun + 1);
    setPoolAction(activity);
    setPoolActionTick((value) => value + 1);
    setPoolFun(nextFun);
    if (nextFun >= 4) {
      setBadges((items) => (items.includes('Indoor Pool Day') ? items : [...items, 'Indoor Pool Day']));
    }
    setMessage(`${labels[activity] || 'Pool fun'}! Fun meter: ${nextFun}/6${nextFun >= 4 ? ' - Pool Day badge earned!' : ''}`);
  };

  const buyMeal = (meal) => {
    if (bucks < meal.price) {
      setMessage(`You need ${meal.price} Resort Bucks for ${meal.name}.`);
      return;
    }
    setBucks((value) => value - meal.price);
    setMeals((items) => [...items, meal.name]);
    const foodBadge = `Tried ${meal.name}`;
    setBadges((items) => (items.includes(foodBadge) ? items : [...items, foodBadge]));
    setMessage(`${characterName} enjoyed ${meal.name}. ⭐ Food badge earned!`);
  };

  const buyMarketItem = (item) => {
    if (bucks < item.price) {
      setMessage(`You need ${item.price} Resort Bucks for ${item.name}.`);
      return;
    }
    setBucks((value) => value - item.price);
    setInventory((items) => ({
      ...items,
      [item.id]: (items[item.id] || 0) + 1,
    }));
    setMessage(`${item.name} went into your house pantry.`);
  };

  const canCook = (recipe) =>
    Object.entries(recipe.ingredients).every(([id, count]) => (inventory[id] || 0) >= count);

  const cookRecipe = (recipe) => {
    if (!canCook(recipe)) {
      const missing = Object.entries(recipe.ingredients)
        .filter(([id, count]) => (inventory[id] || 0) < count)
        .map(([id]) => ingredientLabel(id))
        .join(', ');
      setMessage(`You still need: ${missing}.`);
      return;
    }

    setInventory((items) => {
      const next = { ...items };
      Object.entries(recipe.ingredients).forEach(([id, count]) => {
        next[id] = Math.max(0, (next[id] || 0) - count);
      });
      return next;
    });
    setMeals((items) => [...items, recipe.name]);
    setMessage(`${characterName} cooked ${recipe.name} in her house kitchen!`);
    setBadges((items) => (items.includes('House Cook') ? items : [...items, 'House Cook']));
  };

  const chooseCharacterOption = (category, option) => {
    setCharacter((current) => ({ ...current, [category]: option.id }));

    if (category === 'base') {
      setLook((current) => ({
        ...current,
        shirt: {
          ...current.shirt,
          swatch: option.color,
        },
      }));
    }
  };

  const updateMainCharacterLevel = (key, value) => {
    setCharacter((current) => ({ ...current, [key]: Number(value) }));
  };

  const openPersonEditor = (person, mode = 'edit') => {
    setPersonEditorMode(mode);
    setPersonDraft({
      ...person,
      character: { ...person.character },
      look: {
        ...person.look,
        shirt: { ...person.look.shirt },
        bottoms: { ...person.look.bottoms },
        shoes: { ...person.look.shoes },
        glasses: { ...person.look.glasses },
        headwear: { ...person.look.headwear },
        hair: { ...person.look.hair },
      },
      personality: { ...person.personality },
      spawn: { ...person.spawn },
    });
    setPersonEditorOpen(true);
  };

  const createCustomPerson = () => {
    openPersonEditor(makeCharacterPerson('custom'), 'create');
  };

  const savePersonDraft = () => {
    if (!personDraft) return;
    if (personEditorMode === 'create') {
      setPeople((items) => [...items, personDraft]);
    } else {
      setPeople((items) => items.map((item) => (item.id === personDraft.id ? personDraft : item)));
    }
    setPersonEditorOpen(false);
    setPeopleOpen(true);
  };

  const updatePersonCharacter = (key, value) => {
    setPersonDraft((current) => current ? {
      ...current,
      character: { ...current.character, [key]: value },
    } : current);
  };

  const updatePersonLookType = (category, option) => {
    setPersonDraft((current) => {
      if (!current) return current;
      const currentItem = current.look[category];
      return {
        ...current,
        look: {
          ...current.look,
          [category]: {
            ...option,
            swatch: currentItem?.swatch || option.swatch,
          },
        },
      };
    });
  };

  const updatePersonLookColor = (category, swatch) => {
    setPersonDraft((current) => current ? {
      ...current,
      look: {
        ...current.look,
        [category]: { ...current.look[category], swatch },
      },
    } : current);
  };

  const updatePersonPersonality = (key, value) => {
    setPersonDraft((current) => current ? {
      ...current,
      personality: { ...current.personality, [key]: value },
    } : current);
  };

  const makeStudioCreation = (kind) => {
    const reward = 5;
    const label = kind === 'fashion' ? 'fashion design' : 'artwork';
    const badge = kind === 'fashion' ? 'Design Studio Fashion Star' : 'Design Studio Art Star';
    setStudioCreations((value) => value + 1);
    setBucks((value) => value + reward);
    setBadges((items) => (items.includes(badge) ? items : [...items, badge]));
    setStudioMessage('Your customer loves your ' + label + '! +' + reward + ' Resort Bucks · ⭐ badge earned');
  };

  const artPoint = (event) => {
    const canvas = artCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const beginArt = (event) => {
    const canvas = artCanvasRef.current;
    const point = artPoint(event);
    if (!canvas || !point) return;
    artDrawingRef.current = true;
    canvas.setPointerCapture?.(event.pointerId);
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = artColor;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const drawArt = (event) => {
    if (!artDrawingRef.current) return;
    const canvas = artCanvasRef.current;
    const point = artPoint(event);
    if (!canvas || !point) return;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const endArt = () => {
    artDrawingRef.current = false;
  };

  const clearArt = () => {
    const canvas = artCanvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setStudioMessage('Fresh canvas ready.');
  };

  const updateStudioType = (category, option) => {
    const base =
      studioDraftLook ||
      (screen === 'studio-work' && studioWorkTool === 'fashion'
        ? studioCustomerPerson?.look
        : look);
    if (!base) return;
    const current = base[category];
    const nextOption = {
      ...option,
      swatch: current?.swatch || option.swatch,
    };
    setStudioDraftLook({ ...base, [category]: nextOption });
    setStudioMessage('Trying on ' + nextOption.name + '.');
  };

  const updateStudioColor = (category, swatch) => {
    const base =
      studioDraftLook ||
      (screen === 'studio-work' && studioWorkTool === 'fashion'
        ? studioCustomerPerson?.look
        : look);
    if (!base) return;
    const current = base[category];
    if (!current || current.id === 'none') return;
    setStudioDraftLook({
      ...base,
      [category]: { ...current, swatch },
    });
    setStudioMessage('Color changed. Keep designing.');
  };

  const buyStudioLook = (category, option) => {
    const key = fashionKey(category, option);
    const owned = ownedLooks.has(key) || (option.price || 0) === 0;

    if (!owned && bucks < option.price) {
      setStudioMessage('You need ' + option.price + ' Resort Bucks for this ' + option.name + '.');
      return;
    }

    if (!owned) {
      setBucks((value) => value - option.price);
      setOwnedLooks((current) => {
        const next = new Set(current);
        next.add(key);
        return next;
      });
      setBadges((items) => (
        items.includes('Design Studio Personal Style Star')
          ? items
          : [...items, 'Design Studio Personal Style Star']
      ));
    }

    setLook((current) => ({ ...current, [category]: option }));
    setStudioDraftLook((current) => current ? { ...current, [category]: option } : current);
    setStudioMessage(
      owned
        ? option.name + ' is on!'
        : option.name + ' is yours and on! · ⭐ Personal Style badge earned'
    );
  };

  const prepareFashionCustomer = (index = studioCustomerIndex) => {
    const customer = FASHION_CUSTOMERS[index % FASHION_CUSTOMERS.length];
    const sourcePerson =
      people.length > 0
        ? people[index % people.length]
        : makeCharacterPerson('random');
    const person = {
      ...sourcePerson,
      look: cloneLook(sourcePerson.look),
    };

    setStudioCustomerIndex(index);
    setStudioCustomerPerson(person);
    setStudioCustomerDone(false);
    setStudioTipResult(null);
    setStudioCategory('shirt');
    setStudioDraftLook(cloneLook(person.look));
    return person;
  };

  const showFashionToCustomer = () => {
    const customer = FASHION_CUSTOMERS[studioCustomerIndex % FASHION_CUSTOMERS.length];
    const person = studioCustomerPerson;
    if (!person) return;

    const profile = fashionFeeling(customer);
    const draft = studioDraftLook || person.look;
    const colorThreshold = fashionColorThreshold(customer);

    const details = FASHION_CATEGORIES.map((category) => {
      const item = draft[category.id];
      const target = profile.targets[category.id];
      const typeMatch = item?.id === target.type;
      const colorMatch =
        item?.id !== 'none' &&
        colorDistance(item?.swatch, target.color) <= colorThreshold;
      const points = Number(typeMatch) + Number(colorMatch);
      return {
        id: category.id,
        label: category.label,
        typeMatch,
        colorMatch,
        points,
      };
    });

    const score = details.reduce((sum, detail) => sum + detail.points, 0);
    const tip = score;
    const totalPay = FASHION_BASE_PAY + tip;
    const earnedStar = score >= FASHION_STAR_SCORE;

    const opinion = 'Thanks for making this for me!';

    const completedLook = cloneLook(draft);
    setStudioCustomerPerson((current) => (
      current ? { ...current, look: cloneLook(completedLook) } : current
    ));
    setPeople((items) => items.map((itemPerson) => (
      itemPerson.id === person.id
        ? { ...itemPerson, look: cloneLook(completedLook) }
        : itemPerson
    )));

    setStudioCreations((value) => value + 1);
    setBucks((value) => value + totalPay);
    if (earnedStar) {
      setBadges((items) => (
        items.includes('Design Studio Fashion Star')
          ? items
          : [...items, 'Design Studio Fashion Star']
      ));
    }
    setStudioTipResult({
      tip,
      earnedStar,
    });
    setStudioCustomerDone(true);
    setStudioMessage(person.name + ': ' + opinion);
  };

  const nextFashionCustomer = () => {
    const nextIndex = (studioCustomerIndex + 1) % FASHION_CUSTOMERS.length;
    const nextPerson = prepareFashionCustomer(nextIndex);
    setStudioMessage(nextPerson.name + ' is ready for a fashion design.');
  };

  const beginBeautyWork = () => {
    const person = prepareFashionCustomer(studioCustomerIndex);
    setStudioMessage('');
    setStudioCustomerDone(false);
    setStudioBeautyDraft(null);
    setScreen('studio-beauty-work');
    return person;
  };

  const beginBeautyService = () => {
    setStudioMessage('');
    setStudioCustomerDone(false);
    setStudioBeautyDraft({
      character: { ...character },
      look: cloneLook(look),
    });
    setScreen('studio-beauty-shop');
  };

  const updateBeautyCustomerCharacter = (key, value) => {
    setStudioCustomerPerson((current) => current ? {
      ...current,
      character: { ...current.character, [key]: value },
    } : current);
  };

  const updateBeautyCustomerHair = (option) => {
    setStudioCustomerPerson((current) => current ? {
      ...current,
      look: { ...current.look, hair: option },
    } : current);
  };

  const finishBeautyWork = () => {
    if (!studioCustomerPerson) return;
    const finished = studioCustomerPerson;
    setPeople((items) => items.map((itemPerson) => (
      itemPerson.id === finished.id
        ? {
            ...itemPerson,
            character: { ...finished.character },
            look: cloneLook(finished.look),
          }
        : itemPerson
    )));
    setBucks((value) => value + 3);
    setStudioCustomerDone(true);
    setStudioMessage(finished.name + ': Thanks! I love getting a fresh look. +3 Resort Bucks');
  };

  const nextBeautyCustomer = () => {
    const nextIndex = (studioCustomerIndex + 1) % FASHION_CUSTOMERS.length;
    const nextPerson = prepareFashionCustomer(nextIndex);
    setStudioCustomerDone(false);
    setStudioMessage(nextPerson.name + ' is ready for a beauty appointment.');
  };

  const updateBeautyDraftCharacter = (key, value) => {
    setStudioBeautyDraft((current) => current ? {
      ...current,
      character: { ...current.character, [key]: value },
    } : current);
  };

  const updateBeautyDraftHair = (option) => {
    setStudioBeautyDraft((current) => current ? {
      ...current,
      look: { ...current.look, hair: option },
    } : current);
  };

  const finishBeautyService = () => {
    if (!studioBeautyDraft) return;
    if (bucks < 3) {
      setStudioMessage('You need 3 Resort Bucks for the beauty service.');
      return;
    }
    setBucks((value) => value - 3);
    setCharacter({ ...studioBeautyDraft.character });
    setLook(cloneLook(studioBeautyDraft.look));
    setStudioCustomerDone(true);
    setStudioMessage('Fresh look finished! -3 Resort Bucks');
  };

  const renderCharacter = (
    large = false,
    displayLook = look,
    displayCharacter = character,
    displayName = characterName,
    pose = 'standing',
  ) => (
    <div
      className={[styles.avatarFigure, large ? styles.avatarFigureLarge : ''].join(' ')}
      data-hair={displayLook.hair.id}
      data-gender={displayCharacter.gender}
      data-makeup={displayCharacter.makeup || 'none'}
      data-sleeve={displayLook.shirt.sleeve || 'short'}
      data-leg={displayLook.bottoms.leg || 'straight'}
      data-shoe={displayLook.shoes.shoe || 'sneakers'}
      data-glasses={displayLook.glasses?.id || 'none'}
      data-headwear={displayLook.headwear?.id || 'none'}
      data-pose={pose}
      style={{
        ...characterStyleFor(displayCharacter),
        '--character-idle-delay': idlePhaseForName(displayName),
        '--outfit-shirt': displayLook.shirt.swatch,
        '--outfit-bottoms': displayLook.bottoms.swatch,
        '--outfit-shoes': displayLook.shoes.swatch,
        '--outfit-glasses': displayLook.glasses?.swatch || '#6f4b3e',
        '--outfit-headwear': displayLook.headwear?.swatch || '#ff4f9a',
      }}
      aria-label={displayName + ' preview'}
    >
      <div className={styles.avatarHair} />
      <span className={styles.avatarHeadwear} aria-hidden="true" />
      <span className={[styles.avatarEar, styles.avatarEarLeft].join(' ')} />
      <span className={[styles.avatarEar, styles.avatarEarRight].join(' ')} />
      <div className={styles.avatarHead}>
        <span className={[styles.avatarBrow, styles.avatarBrowLeft].join(' ')} />
        <span className={[styles.avatarBrow, styles.avatarBrowRight].join(' ')} />
        <span className={[styles.avatarEye, styles.avatarEyeLeft].join(' ')} />
        <span className={[styles.avatarEye, styles.avatarEyeRight].join(' ')} />
        <span className={styles.avatarNose} />
        <span className={styles.avatarSmile} />
        <span className={styles.avatarMakeup} aria-hidden="true" />
      </div>
      <div className={styles.avatarHairFront} />
      <span className={styles.avatarGlasses} aria-hidden="true" />
      <div className={styles.avatarNeck} />
      <div className={styles.avatarBody} style={{ background: displayLook.shirt.swatch }} />
      <div className={styles.avatarPelvis} style={{ background: displayLook.bottoms.swatch }} />

      <div className={styles.avatarArmRigLeft}>
        <span className={styles.avatarUpperArm} />
        <span className={styles.avatarElbow} />
        <span className={styles.avatarForearm} />
        <span className={styles.avatarHand}>
          <i className={styles.avatarThumb} />
          <i className={styles.avatarFinger} />
          <i className={styles.avatarFinger} />
          <i className={styles.avatarFinger} />
        </span>
      </div>
      <div className={styles.avatarArmRigRight}>
        <span className={styles.avatarUpperArm} />
        <span className={styles.avatarElbow} />
        <span className={styles.avatarForearm} />
        <span className={styles.avatarHand}>
          <i className={styles.avatarThumb} />
          <i className={styles.avatarFinger} />
          <i className={styles.avatarFinger} />
          <i className={styles.avatarFinger} />
        </span>
      </div>

      <div className={styles.avatarLegRigLeft}>
        <span className={styles.avatarSkinLeg} />
        <span className={styles.avatarThigh} style={{ background: displayLook.bottoms.swatch }} />
        <span className={styles.avatarKnee} style={{ background: displayLook.bottoms.leg === 'short' ? 'var(--character-skin)' : displayLook.bottoms.swatch }} />
        <span className={styles.avatarShin} style={{ background: displayLook.bottoms.leg === 'short' ? 'var(--character-skin)' : displayLook.bottoms.swatch }} />
        <span className={styles.avatarShoe} style={{ background: displayLook.shoes.swatch }} />
      </div>
      <div className={styles.avatarLegRigRight}>
        <span className={styles.avatarSkinLeg} />
        <span className={styles.avatarThigh} style={{ background: displayLook.bottoms.swatch }} />
        <span className={styles.avatarKnee} style={{ background: displayLook.bottoms.leg === 'short' ? 'var(--character-skin)' : displayLook.bottoms.swatch }} />
        <span className={styles.avatarShin} style={{ background: displayLook.bottoms.leg === 'short' ? 'var(--character-skin)' : displayLook.bottoms.swatch }} />
        <span className={styles.avatarShoe} style={{ background: displayLook.shoes.swatch }} />
      </div>
    </div>
  );

  const renderStudioActor = (
    displayLook,
    displayCharacter,
    displayName,
    role = 'guest',
    bubble = '',
  ) => (
    <div className={styles.studioSceneActor} data-role={role}>
      <div className={styles.studioSceneActorFigure}>
        {renderCharacter(false, displayLook, displayCharacter, displayName)}
      </div>
      <span className={styles.studioSceneActorName}>{displayName}</span>
      {bubble && <span className={styles.studioSceneSpeech}>{bubble}</span>}
    </div>
  );

  const studioExperienceShell = (mode, title, subtitle, actors, body) => (
    <main className={[styles.gameShell, styles.studioModeGameShell].join(' ')}>
      <section className={[styles.topBar, styles.studioTopBar].join(' ')}>
        <button className={styles.backButton} type="button" onClick={() => setScreen('studio')}>
          ← Design Studio
        </button>
        <div className={styles.brand}>{title}</div>
        <div className={styles.wallet}>💵 {bucks} Resort Bucks</div>
      </section>

      <section className={styles.studioExperienceRoom} data-mode={mode}>
        <div className={styles.studioExperienceWallSign}>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <div className={styles.studioExperienceDecor} aria-hidden="true">
          <span className={styles.studioDecorOne} />
          <span className={styles.studioDecorTwo} />
          <span className={styles.studioDecorThree} />
        </div>
        <div className={styles.studioExperienceActors}>{actors}</div>
        <div className={styles.studioExperienceFloorLine} aria-hidden="true" />
        <div className={styles.studioExperienceWorkspace}>{body}</div>
      </section>
    </main>
  );

  const interiorShell = (title, icon, subtitle, body) => (
    <main className={styles.gameShell}>
      <section className={styles.topBar}>
        <button className={styles.backButton} type="button" onClick={() => setScreen('map')}>
          ← Resort Map
        </button>
        <div className={styles.brand}>Kids Resort</div>
        <div className={styles.wallet}>🪙 {bucks} Resort Bucks</div>
      </section>
      <section className={styles.interiorScene}>
        <header className={styles.interiorHeader}>
          <div className={styles.interiorIcon}>{icon}</div>
          <div>
            <div className={styles.eyebrow}>{subtitle}</div>
            <h1>{title}</h1>
          </div>
        </header>
        {body}
      </section>
    </main>
  );

  const playerView = isWalking ? walkView : 'front';

  if (screen === 'cafe') {
    return (
      <main className={[styles.gameShell, styles.cafeGameShell].join(' ')}>
        <section className={[styles.topBar, styles.cafeTopBar].join(' ')}>
          <button className={styles.backButton} type="button" onClick={() => setScreen('map')}>← Resort Map</button>
          <div className={styles.brand}>Kids Resort</div>
          <div className={styles.wallet}>🪙 {bucks} Resort Bucks</div>
        </section>
        <section className={styles.cafeInterior}>
          <div className={styles.cafeWallArt}><span>☀️</span><strong>Sunshine Café</strong><small>Good food. Bright days.</small></div>
          <div className={styles.cafeWindow} aria-hidden="true"><span className={styles.cafeSky} /><span className={styles.cafeSea} /><span className={styles.cafePalm}>🌴</span><span className={styles.cafeUmbrella}>⛱️</span></div>
          <div className={styles.cafePendantRow} aria-hidden="true"><span>💡</span><span>💡</span><span>💡</span></div>
          <div className={[styles.cafeSceneCharacter, styles.cafeWaitingCharacter].join(' ')} aria-label={`${characterName} waiting in the cafe`}>{renderCharacter(false)}</div>
          <div className={styles.cafeDining}>
            <div className={styles.cafeBooth}><span className={styles.cafePlant}>🪴</span><div className={styles.cafeBench} /><div className={styles.cafeTable}><span>🌼</span></div></div>
            <div className={styles.cafeTables}><div className={styles.cafeTableGroup}><span className={styles.cafeChair}>🪑</span><div className={styles.cafeSmallTable}><span>🍽️</span></div><span className={styles.cafeChair}>🪑</span></div><div className={styles.cafeTableGroup}><span className={styles.cafeChair}>🪑</span><div className={styles.cafeSmallTable}><span>🍽️</span></div><span className={styles.cafeChair}>🪑</span></div></div>
            <button className={styles.cafeModeButton} type="button" onClick={() => setScreen('cafe-food')}>🍽️ Eat Here</button>
          </div>
          <div className={styles.cafeCounter}>
            <div className={styles.counterShelf}><span>🥤</span><span>🧁</span><span>🍪</span><span>☕</span></div>
            <div className={styles.counterTop}>🧾　🔔　🥤</div>
            <div className={styles.counterFront}><span>SUNSHINE CAFÉ</span><i /><i /><i /></div>
            <button className={styles.cafeModeButton} type="button" onClick={startCafeShift}>🧑‍🍳 Start Shift</button>
          </div>
          <div className={styles.cafeFloorLine} aria-hidden="true" />
        </section>
      </main>
    );
  }

  if (screen === 'cafe-work') {
    const fridgeItems=Object.entries(CAFE_INGREDIENTS).filter(([,x])=>x.source==='fridge');
    const cabinetItems=Object.entries(CAFE_INGREDIENTS).filter(([,x])=>x.source==='cabinet');
    return <main className={styles.gameShell}><section className={styles.topBar}><button className={styles.backButton} type="button" onClick={()=>setScreen('cafe')}>← Café</button><div className={styles.brand}>Sunshine Café Shift</div><div className={styles.wallet}>🪙 {bucks} Resort Bucks</div></section><section className={styles.cafeWorkScene}><div className={styles.cafeWorkBackdrop} aria-hidden="true"><div className={styles.workWindow}><span>🌴</span><span>☀️</span></div><div className={styles.workWallSign}>SUNSHINE CAFÉ</div><div className={styles.workPendantRow}><span>💡</span><span>💡</span><span>💡</span></div><div className={styles.workServiceCounter}><span>🥤</span><span>🔔</span><span>🧁</span></div></div>
      <div className={[styles.cafeSceneCharacter, styles.cafeWorkCharacter].join(' ')} aria-label={`${characterName} working in the cafe kitchen`}>{renderCharacter(false)}</div>
      <aside className={styles.recipeWall}><h2>Recipe Wall</h2>{CAFE_RECIPES.map((r)=><div key={r.id} className={styles.wallRecipe}><strong>{r.name}</strong><span>{r.formula}</span></div>)}</aside>
      <section className={styles.orderRail}><b>Orders · {cafeServed}/8</b>{cafeOrders.map((o)=>{const r=CAFE_RECIPES.find((x)=>x.id===o.recipeId),age=cafeNow-o.born,mood=age<12000?'🙂':age<24000?'😐':age<35000?'☹️':'😡';return <button key={o.id} type="button" className={styles.orderTicket} onClick={()=>serveCafeOrder(o)}><span>{mood}</span><strong>{o.guest}</strong><span>{r.icon}</span><small>{Math.max(0,Math.ceil((45000-age)/1000))}s</small></button>})}</section>
      <section className={styles.kitchenStations}><button type="button" onClick={()=>setCafeStorage(cafeStorage==='fridge'?null:'fridge')}>🧊<strong>Refrigerator</strong></button><div className={styles.grillStation}><b>🔥 Grill</b><div>{cafeGrill.map((g)=>{const x=CAFE_INGREDIENTS[g.ingredientId],age=cafeNow-g.started,state=age<x.cook?'Cooking…':age<=x.cook+4500?'READY!':'BURNT';return <button key={g.id} type="button" data-state={state} onClick={()=>pullFromGrill(g)}><span>{x.icon}</span><strong>{state}</strong></button>})}</div></div><button type="button" onClick={()=>setCafeStorage(cafeStorage==='cabinet'?null:'cabinet')}>🥫<strong>Cabinet</strong></button></section>
      {cafeStorage&&<section className={styles.ingredientDrawer}>{(cafeStorage==='fridge'?fridgeItems:cabinetItems).map(([id,x])=><button key={id} type="button" onClick={()=>takeCafeIngredient(id)}><span>{x.icon}</span><small>{x.name}</small></button>)}</section>}
      <section className={styles.plateStation}><strong>🍽️ Plate</strong><div>{cafePlate.map((id,i)=><span key={`${id}-${i}`}>{CAFE_INGREDIENTS[id]?.icon}</span>)}</div><button type="button" onClick={()=>setCafePlate([])}>Clear</button></section><div className={styles.cafeFeedback}>{cafeMessage}</div>{cafeFinished&&<div className={styles.cafeWin}><div>⭐</div><h2>Shift complete!</h2><p>8 Resort Buck bonus earned.</p><button className={styles.primaryButton} type="button" onClick={()=>setScreen('cafe')}>Back to Café</button></div>}
    </section></main>;
  }

  if (screen === 'cafe-food') {
    const diningMeal = CAFE_MENU.find((item) => item.name === meals[meals.length - 1]);
    return (
      <main className={[styles.gameShell, styles.cafeGameShell].join(' ')}>
        <section className={[styles.topBar, styles.cafeTopBar].join(' ')}>
          <button className={styles.backButton} type="button" onClick={() => setScreen('cafe')}>← Café</button>
          <div className={styles.brand}>Sunshine Café Dining</div>
          <div className={styles.wallet}>🪙 {bucks} Resort Bucks</div>
        </section>
        <section className={styles.cafeDiningRoom}>
          <div className={styles.cafeDiningWallSign}><span>☀️</span><strong>Sunshine Dining</strong><small>Take a table and enjoy.</small></div>
          <div className={styles.cafeDiningWindow} aria-hidden="true"><span>🌴</span><span>⛱️</span></div>
          <div className={styles.cafeDiningLights} aria-hidden="true"><span>💡</span><span>💡</span><span>💡</span></div>
          <div className={[styles.cafeSceneCharacter, styles.cafeDiningCharacter].join(' ')} aria-label={`${characterName} in the dining room`}>{renderCharacter(false)}</div>
          <div className={[styles.cafeDiner, styles.cafeDinerOne].join(' ')}>
            <div className={styles.cafeDinerChair} aria-hidden="true" />
            <div className={styles.cafeDinerFigure}>{renderCharacter(false, cafeAmbientPeople[0].look, cafeAmbientPeople[0].character, cafeAmbientPeople[0].name, 'seated')}</div>
            <div className={styles.cafeDinerTable}><span>🥪</span><span>🥤</span></div>
          </div>
          <div className={[styles.cafeDiner, styles.cafeDinerTwo].join(' ')}>
            <div className={styles.cafeDinerChair} aria-hidden="true" />
            <div className={styles.cafeDinerFigure}>{renderCharacter(false, cafeAmbientPeople[1].look, cafeAmbientPeople[1].character, cafeAmbientPeople[1].name, 'seated')}</div>
            <div className={styles.cafeDinerTable}><span>🍔</span><span>🥤</span></div>
          </div>
          <div className={styles.cafeDiningMenu}>
            <strong>What would you like?</strong>
            <div>
              {CAFE_MENU.map((item) => (
                <button key={item.id} type="button" onClick={() => buyMeal(item)}>
                  <span>{item.icon}</span><b>{item.name}</b><small>{item.price} Bucks</small>
                </button>
              ))}
            </div>
          </div>
          <div className={styles.cafeDiningPlaceSetting} aria-hidden="true"><span>{diningMeal?.icon || '🍽️'}</span></div>
          <div className={styles.cafeDiningMessage} aria-live="polite">{message || `${characterName} is ready to eat.`}</div>
          <div className={styles.cafeDiningFloorLine} aria-hidden="true" />
        </section>
      </main>
    );
  }

  if (screen === 'lobby') {
    return (
      <main className={[styles.gameShell, styles.lobbyGameShell].join(' ')}>
        <section className={[styles.topBar, styles.lobbyTopBar].join(' ')}>
          <button className={styles.backButton} type="button" onClick={() => setScreen('map')}>← Resort Map</button>
          <div className={styles.brand}>Resort Lobby</div>
          <div className={styles.wallet}>🪙 {bucks} Resort Bucks</div>
        </section>
        <section className={styles.lobbyRoom}>
          <div className={styles.lobbyWallMark}><strong>KIDS RESORT</strong><span>Main Lobby</span></div>
          <button
            className={[styles.lobbyReception, styles.lobbyWorkDesk].join(' ')}
            type="button"
            onClick={() => openScreen('lobby-custodian')}
            aria-label="Start resort work from the front desk"
          >
            <span className={styles.lobbyReceptionBell} aria-hidden="true">🔔</span>
            <i aria-hidden="true" />
            <b>FRONT DESK</b>
            <em>Start Resort Work</em>
          </button>
          <div className={styles.lobbyPlant} aria-hidden="true">🌴</div>
          <div className={styles.lobbyFloorLine} aria-hidden="true" />

          <div className={styles.lobbyDoorRow} aria-label="Lobby destinations">
            <button className={styles.lobbyDoor} data-door="restaurant" type="button" onClick={() => openScreen('lobby-restaurant-dine')}>
              <span>PALM COURT</span>
              <strong>Restaurant</strong>
              <small>Dining Room</small>
            </button>
            <button className={styles.lobbyDoor} data-door="kitchen" type="button" onClick={() => openScreen('lobby-restaurant-work')}>
              <span>PALM COURT</span>
              <strong>Kitchen</strong>
              <small>Staff Entrance</small>
            </button>
            <button className={styles.lobbyDoor} data-door="pool" type="button" onClick={() => openScreen('lobby-pool')}>
              <span>KIDS RESORT</span>
              <strong>Indoor Pool</strong>
              <small>Pool Room</small>
            </button>
          </div>

          <div className={[styles.lobbyCharacter, styles.lobbyMainCharacter].join(' ')} aria-label={`${characterName} in the resort lobby`}>
            {renderCharacter(false)}
          </div>
          <div className={[styles.lobbyCharacter, styles.lobbyGuestCharacter].join(' ')} aria-label={`${lobbyAmbientPeople[0].name} in the resort lobby`}>
            {renderCharacter(false, lobbyAmbientPeople[0].look, lobbyAmbientPeople[0].character, lobbyAmbientPeople[0].name)}
          </div>
        </section>
      </main>
    );
  }

  if (screen === 'lobby-restaurant-work') {
    const kitchenRecipe = palmKitchenRecipeFor(palmKitchenServed);
    const kitchenStorageItems = palmKitchenStorage
      ? Object.entries(PALM_KITCHEN_INGREDIENTS).filter(([, item]) => item.source === palmKitchenStorage)
      : [];
    return (
      <main className={[styles.gameShell, styles.lobbyGameShell].join(' ')}>
        <section className={[styles.topBar, styles.lobbyTopBar].join(' ')}>
          <button className={styles.backButton} type="button" onClick={() => openScreen('lobby')}>← Lobby</button>
          <div className={styles.brand}>Palm Court · Kitchen</div>
          <div className={styles.wallet}>🪙 {bucks} Resort Bucks</div>
        </section>
        <section className={[styles.lobbyExperienceRoom, styles.palmCourtWorkRoom, styles.palmKitchenGame].join(' ')}>
          <div className={styles.palmCourtSign}><strong>PALM COURT</strong><span>Kitchen Shift</span></div>
          <div className={styles.palmCourtWindows} aria-hidden="true"><i /><i /><i /></div>
          <div className={styles.lobbyFloorLine} aria-hidden="true" />
          <div className={[styles.lobbyCharacter, styles.restaurantWorkerCharacter].join(' ')} aria-label={`${characterName} working in the Palm Court kitchen`}>{renderCharacter(false)}</div>
          <div className={[styles.lobbyCharacter, styles.restaurantGuestCharacter].join(' ')} aria-label={`${lobbyAmbientPeople[0].name} waiting for a Palm Court meal`}>{renderCharacter(false, lobbyAmbientPeople[0].look, lobbyAmbientPeople[0].character, lobbyAmbientPeople[0].name, 'seated')}</div>

          {!palmKitchenActive ? (
            <button className={styles.palmKitchenStart} type="button" onClick={startPalmKitchenShift}>
              <strong>Start Dinner Shift</strong>
              <span>Cook 5 plated meals for Palm Court guests.</span>
            </button>
          ) : (
            <>
              <aside className={styles.palmKitchenTicket}>
                <small>ORDER {Math.min(palmKitchenServed + 1, 5)} / 5</small>
                <strong>{kitchenRecipe.icon} {kitchenRecipe.name}</strong>
                <span>{kitchenRecipe.ingredients.map((id) => PALM_KITCHEN_INGREDIENTS[id].name).join(' + ')}</span>
              </aside>

              <div className={styles.palmKitchenStorageRow}>
                {[
                  ['fridge', 'Refrigerator'],
                  ['pantry', 'Pantry'],
                  ['freezer', 'Freezer'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    data-active={palmKitchenStorage === id}
                    onClick={() => setPalmKitchenStorage((value) => value === id ? null : id)}
                  >
                    <strong>{label}</strong>
                  </button>
                ))}
              </div>

              {palmKitchenStorage && (
                <div className={styles.palmKitchenIngredientShelf}>
                  {kitchenStorageItems.map(([id, item]) => (
                    <button key={id} type="button" onClick={() => takePalmKitchenIngredient(id)}>
                      <span>{item.icon}</span>
                      <small>{item.name}</small>
                    </button>
                  ))}
                </div>
              )}

              <div className={styles.palmKitchenStove}>
                <strong>Stove</strong>
                <div>
                  {palmKitchenStove.length === 0 && <small>Hot ingredients cook here.</small>}
                  {palmKitchenStove.map((entry) => {
                    const item = PALM_KITCHEN_INGREDIENTS[entry.ingredientId];
                    const age = palmKitchenNow - entry.started;
                    const state = age < item.cook ? 'Cooking' : age <= item.cook + 5500 ? 'READY' : 'Overcooked';
                    return (
                      <button key={entry.id} type="button" data-state={state} onClick={() => pullPalmKitchenStove(entry)}>
                        <span>{item.icon}</span>
                        <b>{state}</b>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={styles.palmKitchenPlate}>
                <strong>Plate</strong>
                <div>
                  {palmKitchenPlate.length === 0
                    ? <small>Build the ordered meal here.</small>
                    : palmKitchenPlate.map((id, index) => <span key={`${id}-${index}`}>{PALM_KITCHEN_INGREDIENTS[id]?.icon}</span>)}
                </div>
                <button type="button" onClick={() => setPalmKitchenPlate([])}>Clear Plate</button>
              </div>

              <button className={styles.palmKitchenPass} type="button" onClick={servePalmKitchenOrder}>
                <strong>Send Through Pass</strong>
                <small>Serve the completed plate</small>
              </button>
            </>
          )}

          <div className={styles.lobbySceneMessage} aria-live="polite">
            {palmKitchenMessage || 'Read the dinner ticket, gather ingredients, cook the hot items, and plate the order.'}
          </div>

          {palmKitchenFinished && (
            <div className={styles.lobbyGameComplete}>
              <strong>Kitchen Shift Complete!</strong>
              <span>5 dinner orders served · 40 Resort Bucks earned</span>
              <button type="button" onClick={startPalmKitchenShift}>Work Another Shift</button>
            </div>
          )}
        </section>
      </main>
    );
  }

  if (screen === 'lobby-restaurant-dine') {
    const diningMeal = LOBBY_MENU.find((item) => item.id === diningMealId) || null;
    const diningDrink = DINING_DRINKS.find((item) => item.id === diningDrinkId) || DINING_DRINKS[0];
    const diningMotionClass = diningAction === 'bite'
      ? styles.diningActionBite
      : diningAction === 'sip'
        ? styles.diningActionSip
        : diningAction === 'celebrate'
          ? styles.diningActionCelebrate
          : '';
    return (
      <main className={[styles.gameShell, styles.lobbyGameShell].join(' ')}>
        <section className={[styles.topBar, styles.lobbyTopBar].join(' ')}>
          <button className={styles.backButton} type="button" onClick={() => openScreen('lobby')}>← Lobby</button>
          <div className={styles.brand}>Palm Court · Dining</div>
          <div className={styles.wallet}>🪙 {bucks} Resort Bucks</div>
        </section>
        <section className={[styles.lobbyExperienceRoom, styles.palmCourtDiningRoom, styles.palmDiningGame].join(' ')}>
          <div className={styles.palmCourtSign}><strong>PALM COURT</strong><span>Dining Room</span></div>
          <div className={styles.palmCourtWindows} aria-hidden="true"><i /><i /><i /></div>
          <div className={styles.lobbyFloorLine} aria-hidden="true" />
          <div
            key={`dining-${diningActionTick}`}
            className={[styles.lobbyCharacter, styles.restaurantDiningCharacter, styles.diningPlayerCharacter, diningMotionClass].filter(Boolean).join(' ')}
            aria-label={`${characterName} dining in Palm Court`}
          >
            {renderCharacter(false, look, character, characterName, 'seated')}
          </div>
          <div className={[styles.lobbyCharacter, styles.restaurantDiningGuest].join(' ')} aria-label={`${lobbyAmbientPeople[1].name} dining in Palm Court`}>{renderCharacter(false, lobbyAmbientPeople[1].look, lobbyAmbientPeople[1].character, lobbyAmbientPeople[1].name, 'seated')}</div>
          <div className={styles.palmCourtDiningTable} aria-hidden="true">
            <span>{diningMeal?.icon || '🍽️'}</span>
            <i />
            <b />
          </div>

          <div className={styles.palmCourtMenuStand}>
            <strong>Dinner Menu</strong>
            <div>
              {LOBBY_MENU.map((item) => (
                <button key={item.id} type="button" onClick={() => orderPalmCourtMeal(item)}>
                  <span>{item.icon}</span>
                  <b>{item.name}</b>
                  <small>{item.price} Bucks</small>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.palmDiningControls}>
            <div className={styles.palmDiningCourse}>
              <strong>{diningMeal ? diningMeal.name : 'Choose an entree'}</strong>
              <span className={styles.palmDiningBites} aria-label={`${diningBites} of 3 bites`}>
                {[0, 1, 2].map((index) => <i key={index} data-done={index < diningBites} />)}
              </span>
              <button type="button" disabled={!diningMeal || diningBites >= 3} onClick={takeDiningBite}>
                {diningBites >= 3 ? 'Meal Finished' : 'Take a Bite'}
              </button>
            </div>
            <div className={styles.palmDiningDrinks}>
              <strong>Drink</strong>
              {DINING_DRINKS.map((drink) => (
                <button
                  key={drink.id}
                  type="button"
                  data-active={diningDrink.id === drink.id}
                  onClick={() => sipDiningDrink(drink.id)}
                >
                  <span>{drink.icon}</span>
                  <small>{drink.name}</small>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.lobbySceneMessage} aria-live="polite">
            {message || `${characterName} has a table at Palm Court. Order a meal, enjoy it, and choose a drink.`}
          </div>
        </section>
      </main>
    );
  }

  if (screen === 'lobby-custodian') {
    const custodianTask = CUSTODIAN_TASKS[custodianTaskIndex % CUSTODIAN_TASKS.length];
    return (
      <main className={[styles.gameShell, styles.lobbyGameShell].join(' ')}>
        <section className={[styles.topBar, styles.lobbyTopBar].join(' ')}>
          <button className={styles.backButton} type="button" onClick={() => openScreen('lobby')}>← Lobby</button>
          <div className={styles.brand}>Resort Custodian</div>
          <div className={styles.wallet}>🪙 {bucks} Resort Bucks</div>
        </section>
        <section className={[styles.lobbyExperienceRoom, styles.custodianRoom, styles.custodianGame].join(' ')}>
          <div className={styles.custodianWallSign}><strong>LOBBY CARE</strong><span>Resort Custodian · {custodianCleaned}/6 jobs</span></div>
          <div className={styles.custodianReception} aria-hidden="true"><span>FRONT DESK</span><i /></div>
          <div className={styles.lobbyFloorLine} aria-hidden="true" />
          <div className={[styles.lobbyCharacter, styles.custodianCharacter].join(' ')} aria-label={`${characterName} working as resort custodian`}>{renderCharacter(false)}</div>

          <div className={styles.custodianCartGame}>
            <strong>Cleaning Cart</strong>
            <div>
              {CUSTODIAN_TOOLS.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  data-active={custodianTool === tool.id}
                  onClick={() => {
                    setCustodianTool(tool.id);
                    setCustodianMessage(`${tool.name} selected. Now click the lobby job.`);
                  }}
                >
                  <span>{tool.icon}</span>
                  <small>{tool.name}</small>
                </button>
              ))}
            </div>
          </div>

          {!custodianFinished && (
            <button
              className={styles.custodianTaskObject}
              data-task={custodianTask.id}
              type="button"
              onClick={attemptCustodianTask}
            >
              <span>{custodianTask.icon}</span>
              <strong>{custodianTask.name}</strong>
              <small>Click after choosing the right tool</small>
            </button>
          )}

          <div className={styles.custodianShiftCard}>
            <strong>{custodianFinished ? 'Shift Complete' : 'Current Job'}</strong>
            <span>{custodianFinished ? '6 lobby jobs finished.' : custodianTask.name}</span>
            <small>{custodianFinished ? 'Great work keeping the resort ready for guests.' : custodianTask.hint}</small>
            {custodianFinished && <button type="button" onClick={restartCustodianShift}>Start Another Shift</button>}
          </div>

          <div className={styles.lobbySceneMessage} aria-live="polite">
            {custodianMessage || 'Choose a tool from the cart, then clean the highlighted lobby job. Each correct job earns 3 Resort Bucks.'}
          </div>
        </section>
      </main>
    );
  }

  if (screen === 'lobby-pool') {
    const poolMotionClass = poolAction === 'float'
      ? styles.poolActionFloat
      : poolAction === 'slide'
        ? styles.poolActionSlide
        : poolAction === 'ball'
          ? styles.poolActionBall
          : '';
    return (
      <main className={[styles.gameShell, styles.lobbyGameShell].join(' ')}>
        <section className={[styles.topBar, styles.lobbyTopBar].join(' ')}>
          <button className={styles.backButton} type="button" onClick={() => openScreen('lobby')}>← Lobby</button>
          <div className={styles.brand}>Indoor Pool</div>
          <div className={styles.wallet}>🪙 {bucks} Resort Bucks</div>
        </section>
        <section className={[styles.lobbyExperienceRoom, styles.poolRoom, styles.poolGame].join(' ')}>
          <div className={styles.poolWallSign}><strong>INDOOR POOL</strong><span>Swim · splash · play</span></div>
          <div className={styles.poolWindows} aria-hidden="true"><i /><i /><i /></div>
          <div className={styles.poolWater} aria-hidden="true"><i /><i /><i /></div>
          <div className={styles.poolDeckLine} aria-hidden="true" />
          <div
            key={`pool-${poolActionTick}`}
            className={[styles.lobbyCharacter, styles.poolCharacter, styles.poolPlayingCharacter, poolMotionClass].filter(Boolean).join(' ')}
            aria-label={`${characterName} playing at the indoor pool`}
          >
            {renderCharacter(false)}
          </div>

          <button className={[styles.poolPlayObject, styles.poolFloat].join(' ')} type="button" onClick={() => playPoolActivity('float')}>
            <span aria-hidden="true">{'\u{1F6DF}'}</span><strong>Pool Float</strong>
          </button>
          <button className={[styles.poolPlayObject, styles.poolSlide].join(' ')} type="button" onClick={() => playPoolActivity('slide')}>
            <span aria-hidden="true">{'\u{1F6DD}'}</span><strong>Pool Slide</strong>
          </button>
          <button className={[styles.poolPlayObject, styles.poolBall].join(' ')} type="button" onClick={() => playPoolActivity('ball')}>
            <span aria-hidden="true">{'\u{1F3D0}'}</span><strong>Beach Ball</strong>
          </button>

          <div className={styles.poolFunMeter}>
            <strong>Pool Fun</strong>
            <div>{[0, 1, 2, 3, 4, 5].map((index) => <i key={index} data-filled={index < poolFun} />)}</div>
            <small>{poolFun >= 4 ? 'Pool Day badge earned!' : 'Try the pool activities to fill the meter.'}</small>
          </div>

          <div className={styles.lobbySceneMessage} aria-live="polite">
            {message || 'Choose a pool object and watch Emily play. Try different activities to fill the fun meter.'}
          </div>
        </section>
      </main>
    );
  }

  if (screen === 'market') {
    return interiorShell(
      'Market Street',
      '\u{1F6D2}',
      'SHOP FOR YOUR HOUSE',
      <div className={styles.shopGrid}>
        {MARKET_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.shopCard}
            onClick={() => buyMarketItem(item)}
          >
            <span className={styles.shopIcon}>{item.icon}</span>
            <strong>{item.name}</strong>
            <span>{item.price} Resort Bucks - owned {inventory[item.id] || 0}</span>
          </button>
        ))}
        <div className={styles.fullMessage} aria-live="polite">
          {message || 'Groceries go straight to your house pantry.'}
        </div>
      </div>,
    );
  }

  if (screen === 'studio') {
    return (
      <main className={[styles.gameShell, styles.studioGameShell].join(' ')}>
        <section className={[styles.topBar, styles.studioTopBar].join(' ')}>
          <button className={styles.backButton} type="button" onClick={() => setScreen('map')}>
            ← Resort Map
          </button>
          <div className={styles.brand}>Design Studio</div>
          <div className={styles.wallet}>💵 {bucks} Resort Bucks</div>
        </section>

        <section className={styles.studioRoomInterior}>
          <div className={styles.studioRoomWallLogo}>
            <strong>DESIGN STUDIO</strong>
            <span>style · beauty · art</span>
          </div>
          <div className={styles.studioRoomShelf} aria-hidden="true">
            <span />
            <i />
            <b />
            <em />
          </div>
          <div className={styles.studioRoomFloorLine} aria-hidden="true" />

          <div className={styles.studioRoomPeople} aria-label="People in the Design Studio">
            {renderStudioActor(look, character, characterName, 'player')}
            {renderStudioActor(
              studioAmbientPerson.look,
              studioAmbientPerson.character,
              studioAmbientPerson.name,
              'guest',
            )}
          </div>

          <div className={styles.studioRoomStage}>
            <button
              className={styles.studioRoomStation}
              data-station="beauty-shop"
              type="button"
              onClick={beginBeautyService}
            >
              <span className={styles.studioVanityObject} aria-hidden="true">
                <i className={styles.studioVanityMirror} />
                <i className={styles.studioVanityTable} />
                <i className={styles.studioVanityStool} />
              </span>
              <strong>Beauty Bar</strong>
              <small>Get hair & makeup done</small>
            </button>

            <button
              className={styles.studioRoomStation}
              data-station="beauty-work"
              type="button"
              onClick={beginBeautyWork}
            >
              <span className={styles.studioSalonObject} aria-hidden="true">
                <i className={styles.studioSalonChair} />
                <i className={styles.studioSalonCart} />
              </span>
              <strong>Beauty Station</strong>
              <small>Work hair & makeup</small>
            </button>

            <button
              className={styles.studioRoomStation}
              data-station="art"
              type="button"
              onClick={() => {
                setStudioMessage('');
                setStudioWorkTool('art');
                setScreen('studio-work');
              }}
            >
              <span className={styles.studioArtObject} aria-hidden="true">
                <i className={styles.studioCanvas} />
                <i className={styles.studioEaselLeg} />
                <i className={styles.studioPaintTray} />
              </span>
              <strong>Art Easel</strong>
              <small>Take an art job</small>
            </button>

            <button
              className={styles.studioRoomStation}
              data-station="fashion-work"
              type="button"
              onClick={() => {
                setStudioMessage('');
                setStudioWorkTool('fashion');
                prepareFashionCustomer(studioCustomerIndex);
                setScreen('studio-work');
              }}
            >
              <span className={styles.studioSewingObject} aria-hidden="true">
                <i className={styles.studioMannequin} />
                <i className={styles.studioSewingTable} />
                <i className={styles.studioSewingMachine} />
              </span>
              <strong>Fashion Desk</strong>
              <small>Design for customers</small>
            </button>

            <button
              className={styles.studioRoomStation}
              data-station="fashion-shop"
              type="button"
              onClick={() => {
                setStudioMessage('');
                setStudioCategory('shirt');
                setStudioDraftLook(cloneLook(look));
                setScreen('studio-shop');
              }}
            >
              <span className={styles.studioRackObject} aria-hidden="true">
                <i className={styles.studioRackBar} />
                <i className={styles.studioRackClothes} />
                <i className={styles.studioRackBase} />
              </span>
              <strong>Fashion Rack</strong>
              <small>Shop & try on</small>
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (screen === 'studio-beauty-work') {
    const person = studioCustomerPerson;

    if (!person) {
      return studioExperienceShell(
        'beauty-work',
        'Beauty Station',
        'WORK HERE',
        <>
          {renderStudioActor(look, character, characterName, 'player')}
          {renderStudioActor(
            studioAmbientPerson.look,
            studioAmbientPerson.character,
            studioAmbientPerson.name,
            'customer',
            'I would love a fresh look.',
          )}
        </>,
        <button className={styles.primaryButton} type="button" onClick={beginBeautyWork}>
          Start Appointment
        </button>,
      );
    }

    return studioExperienceShell(
      'beauty-work',
      'Beauty Station',
      'WORK HERE',
      <>
        {renderStudioActor(look, character, characterName, 'player')}
        {renderStudioActor(
          person.look,
          person.character,
          person.name,
          'customer',
          studioCustomerDone ? 'Thank you!' : 'I would love a fresh look.',
        )}
      </>,
      <div className={styles.studioExperienceControls}>
        <div className={styles.beautyControlGroup}>
          <h3>Hair Style</h3>
          <div className={styles.creatorChoiceWrap}>
            {LOOK_OPTIONS.hair.map((option) => (
              <button
                key={option.id}
                type="button"
                className={styles.creatorTextChoice}
                data-selected={person.look.hair.id === option.id ? 'true' : 'false'}
                onClick={() => updateBeautyCustomerHair(option)}
              >
                {option.name}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.beautyControlGroup}>
          <h3>Hair Color</h3>
          <div className={styles.creatorSwatches}>
            {CHARACTER_OPTIONS.hair.map((option) => (
              <button
                key={option.id}
                type="button"
                className={styles.creatorSwatch}
                data-selected={person.character.hair === option.id ? 'true' : 'false'}
                style={{ '--swatch-color': option.color }}
                aria-label={option.name}
                title={option.name}
                onClick={() => updateBeautyCustomerCharacter('hair', option.id)}
              />
            ))}
          </div>
        </div>

        <div className={styles.beautyControlGroup}>
          <h3>Makeup & Face Details</h3>
          <div className={styles.creatorChoiceWrap}>
            {[
              ['none', 'None'],
              ['blush', 'Blush'],
              ['freckles', 'Freckles'],
              ['lashes', 'Lashes'],
              ['lip', 'Lip Color'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={styles.creatorTextChoice}
                data-selected={person.character.makeup === id ? 'true' : 'false'}
                onClick={() => updateBeautyCustomerCharacter('makeup', id)}
              >
                {label}
              </button>
            ))}
          </div>
          {person.character.makeup !== 'none' && (
            <label className={styles.creatorColorInput}>
              <span>Detail color</span>
              <input
                type="color"
                value={person.character.makeupColor}
                onChange={(event) => updateBeautyCustomerCharacter('makeupColor', event.target.value)}
              />
            </label>
          )}
        </div>

        <div className={styles.fashionActionRow}>
          {studioCustomerDone ? (
            <button type="button" onClick={nextBeautyCustomer}>Next Customer</button>
          ) : (
            <button type="button" onClick={finishBeautyWork}>Finish Service</button>
          )}
        </div>
        <p className={styles.customerOpinion}>{studioMessage}</p>
      </div>,
    );
  }

  if (screen === 'studio-beauty-shop') {
    const draft = studioBeautyDraft || { character, look };

    return studioExperienceShell(
      'beauty-shop',
      'Beauty Bar',
      'HAIR & MAKEUP',
      <>
        {renderStudioActor(
          draft.look,
          draft.character,
          characterName,
          'player',
          studioCustomerDone ? 'I love my new look!' : '',
        )}
      </>,
      <div className={styles.studioExperienceControls}>
        <div className={styles.beautyControlGroup}>
          <h3>Hair Style</h3>
          <div className={styles.creatorChoiceWrap}>
            {LOOK_OPTIONS.hair.map((option) => (
              <button
                key={option.id}
                type="button"
                className={styles.creatorTextChoice}
                data-selected={draft.look.hair.id === option.id ? 'true' : 'false'}
                onClick={() => updateBeautyDraftHair(option)}
              >
                {option.name}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.beautyControlGroup}>
          <h3>Hair Color</h3>
          <div className={styles.creatorSwatches}>
            {CHARACTER_OPTIONS.hair.map((option) => (
              <button
                key={option.id}
                type="button"
                className={styles.creatorSwatch}
                data-selected={draft.character.hair === option.id ? 'true' : 'false'}
                style={{ '--swatch-color': option.color }}
                aria-label={option.name}
                title={option.name}
                onClick={() => updateBeautyDraftCharacter('hair', option.id)}
              />
            ))}
          </div>
        </div>

        <div className={styles.beautyControlGroup}>
          <h3>Makeup & Face Details</h3>
          <div className={styles.creatorChoiceWrap}>
            {[
              ['none', 'None'],
              ['blush', 'Blush'],
              ['freckles', 'Freckles'],
              ['lashes', 'Lashes'],
              ['lip', 'Lip Color'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={styles.creatorTextChoice}
                data-selected={draft.character.makeup === id ? 'true' : 'false'}
                onClick={() => updateBeautyDraftCharacter('makeup', id)}
              >
                {label}
              </button>
            ))}
          </div>
          {draft.character.makeup !== 'none' && (
            <label className={styles.creatorColorInput}>
              <span>Detail color</span>
              <input
                type="color"
                value={draft.character.makeupColor}
                onChange={(event) => updateBeautyDraftCharacter('makeupColor', event.target.value)}
              />
            </label>
          )}
        </div>

        <div className={styles.fashionActionRow}>
          {studioCustomerDone ? (
            <button type="button" onClick={() => setScreen('studio')}>Done</button>
          ) : (
            <button type="button" onClick={finishBeautyService}>Finish Service · 3 Resort Bucks</button>
          )}
        </div>
        <p className={styles.customerOpinion}>{studioMessage}</p>
      </div>,
    );
  }

  if (screen === 'studio-work') {
    const customer = FASHION_CUSTOMERS[studioCustomerIndex % FASHION_CUSTOMERS.length];
    const customerPerson = studioCustomerPerson || studioAmbientPerson;
    const previewLook = studioDraftLook || customerPerson.look;
    const activeItem = previewLook[studioCategory] || LOOK_OPTIONS[studioCategory][0];
    const activeOptions = LOOK_OPTIONS[studioCategory];
    const activeLabel =
      FASHION_CATEGORIES.find((category) => category.id === studioCategory)?.label || 'Fashion';

    if (studioWorkTool === 'fashion') {
      return studioExperienceShell(
        'fashion-work',
        'Fashion Atelier',
        'DESIGN FOR CUSTOMERS',
        <>
          {renderStudioActor(look, character, characterName, 'player')}
          {renderStudioActor(
            previewLook,
            customerPerson.character,
            customerPerson.name,
            'customer',
            'I want to feel ' + fashionFeeling(customer).label + '.',
          )}
        </>,
        <div className={styles.studioExperienceControls}>
          <div className={styles.fashionCategoryTabs}>
            {FASHION_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                data-active={studioCategory === category.id ? 'true' : 'false'}
                onClick={() => setStudioCategory(category.id)}
              >
                {category.label}
              </button>
            ))}
          </div>

          <div className={styles.fashionEditorCard}>
            <div className={styles.fashionEditorHeading}>
              <div>
                <small>{activeLabel}</small>
                <h3>{activeItem.name}</h3>
              </div>
              {activeItem.id !== 'none' && (
                <label className={styles.fashionColorControl}>
                  Any color
                  <input
                    type="color"
                    value={activeItem.swatch || '#777777'}
                    onChange={(event) => updateStudioColor(studioCategory, event.target.value)}
                  />
                </label>
              )}
            </div>

            <div className={styles.fashionTypeGrid}>
              {activeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  data-selected={activeItem.id === option.id ? 'true' : 'false'}
                  onClick={() => updateStudioType(studioCategory, option)}
                >
                  <strong>{option.name}</strong>
                  <small>Design option</small>
                </button>
              ))}
            </div>

            <div className={styles.fashionActionRow}>
              {studioCustomerDone ? (
                <button type="button" onClick={nextFashionCustomer}>Next Customer</button>
              ) : (
                <button type="button" onClick={showFashionToCustomer}>Finish Outfit</button>
              )}
            </div>
          </div>

          <div className={styles.studioSceneMessage}>
            <strong>{customerPerson.name}</strong>
            <span>{fashionFeeling(customer).request}</span>
            {studioTipResult && (
              <b>
                Tip +{studioTipResult.tip} Resort Bucks
                {studioTipResult.earnedStar ? ' · Fashion Star earned' : ''}
              </b>
            )}
            <small>{studioMessage || 'Design the whole outfit, then finish it for the customer.'}</small>
          </div>
        </div>,
      );
    }

    return studioExperienceShell(
      'art-work',
      'Art Corner',
      'CREATE FOR CUSTOMERS',
      <>
        {renderStudioActor(look, character, characterName, 'player')}
        {renderStudioActor(
          studioAmbientPerson.look,
          studioAmbientPerson.character,
          studioAmbientPerson.name,
          'customer',
          'Make something creative for me.',
        )}
      </>,
      <div className={styles.studioExperienceControls}>
        <div className={[styles.artStudio, styles.studioExperienceArtStudio].join(' ')}>
          <canvas
            ref={artCanvasRef}
            className={[styles.artCanvas, styles.studioExperienceArtCanvas].join(' ')}
            width="720"
            height="420"
            onPointerDown={beginArt}
            onPointerMove={drawArt}
            onPointerUp={endArt}
            onPointerCancel={endArt}
            onPointerLeave={endArt}
            aria-label="Drawing canvas"
          />
          <div className={styles.artToolbar}>
            <label>
              Color
              <input
                type="color"
                value={artColor}
                onChange={(event) => setArtColor(event.target.value)}
              />
            </label>
            <button type="button" onClick={clearArt}>Clear</button>
            <button type="button" onClick={() => makeStudioCreation('art')}>
              Finish Artwork +5
            </button>
          </div>
        </div>
        <div className={styles.studioSceneMessage}>
          <strong>{studioAmbientPerson.name}</strong>
          <span>{studioMessage || 'Make your own creative idea for the customer.'}</span>
          <small>{studioCreations} creations made</small>
        </div>
      </div>,
    );
  }

  if (screen === 'studio-shop') {
    const previewLook = studioDraftLook || look;
    const activeItem = previewLook[studioCategory];
    const activeOptions = LOOK_OPTIONS[studioCategory];
    const activeKey = fashionKey(studioCategory, activeItem);
    const owned = ownedLooks.has(activeKey) || (activeItem?.price || 0) === 0;
    const worn = fashionKey(studioCategory, look[studioCategory]) === activeKey;
    const activeLabel =
      FASHION_CATEGORIES.find((category) => category.id === studioCategory)?.label || 'Fashion';
    const tryOnItems = FASHION_CATEGORIES
      .map((category) => ({
        ...category,
        item: previewLook[category.id],
        changed:
          fashionKey(category.id, previewLook[category.id]) !==
          fashionKey(category.id, look[category.id]),
      }))
      .filter((category) => category.changed);

    return studioExperienceShell(
      'fashion-shop',
      'Fashion Boutique',
      'SHOP & TRY ON',
      <>
        {renderStudioActor(
          previewLook,
          character,
          characterName,
          'player',
          tryOnItems.length > 0 ? 'How does this look?' : '',
        )}
      </>,
      <div className={styles.studioExperienceControls}>
        <div className={styles.fashionCategoryTabs}>
          {FASHION_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              data-active={studioCategory === category.id ? 'true' : 'false'}
              onClick={() => setStudioCategory(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>

        <div className={styles.fashionEditorCard}>
          <div className={styles.fashionEditorHeading}>
            <div>
              <small>{activeLabel}</small>
              <h3>{activeItem.name}</h3>
            </div>
            {activeItem.id !== 'none' && (
              <label className={styles.fashionColorControl}>
                Any color
                <input
                  type="color"
                  value={activeItem.swatch || '#777777'}
                  onChange={(event) => updateStudioColor(studioCategory, event.target.value)}
                />
              </label>
            )}
          </div>

          <div className={styles.fashionTypeGrid}>
            {activeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                data-selected={activeItem.id === option.id ? 'true' : 'false'}
                onClick={() => updateStudioType(studioCategory, option)}
              >
                <strong>{option.name}</strong>
                <small>{option.price === 0 ? 'Free' : option.price + ' Resort Bucks'}</small>
              </button>
            ))}
          </div>

          <div className={styles.fashionActionRow}>
            <button
              className={styles.primaryButton}
              type="button"
              disabled={worn}
              onClick={() => buyStudioLook(studioCategory, activeItem)}
            >
              {worn ? 'Wearing This' : owned ? 'Wear This' : 'Buy & Wear · ' + activeItem.price}
            </button>
          </div>
        </div>

        <div className={styles.tryOnTray}>
          <strong>Trying on together</strong>
          <div className={styles.tryOnTrayItems}>
            {tryOnItems.length > 0 ? (
              tryOnItems.map((category) => (
                <span key={category.id}>
                  <i style={{ background: category.item.swatch }} />
                  {category.item.name}
                </span>
              ))
            ) : (
              <span>Your current outfit</span>
            )}
          </div>
          {tryOnItems.length > 0 && (
            <button type="button" onClick={() => setStudioDraftLook(cloneLook(look))}>
              Reset try-on
            </button>
          )}
        </div>

        <div className={styles.fullMessage} aria-live="polite">
          {studioMessage || 'Choose a type and any color. Trying it on is free; keeping the custom design costs Resort Bucks.'}
        </div>
      </div>,
    );
  }

  if (screen === 'suite') {
    return interiorShell(
      `${characterName}'s House`,
      '\u{1F6CF}\u{FE0F}',
      'HOME BASE',
      <div className={styles.suiteLayout}>
        <section className={styles.roomCard}>
          <div className={styles.roomTitle}>Kitchen</div>
          <p>Cook with groceries you bought on Market Street.</p>
          <div className={styles.recipeList}>
            {RECIPES.map((recipe) => (
              <button
                key={recipe.id}
                type="button"
                className={styles.recipeButton}
                data-ready={canCook(recipe) ? 'true' : 'false'}
                onClick={() => cookRecipe(recipe)}
              >
                <span>{recipe.icon}</span>
                <span>
                  <strong>{recipe.name}</strong>
                  <small>{Object.keys(recipe.ingredients).map(ingredientLabel).join(' + ')}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.roomCard}>
          <div className={styles.roomTitle}>Closet</div>
          <div className={styles.closetPreview}>
            {renderCharacter(true)}
            <div>
              <strong>{look.shirt.name}</strong>
              <span>{look.bottoms.name}</span>
              <span>{look.shoes.name}</span>
              <span>{look.hair.name}</span>
              <span>{look.glasses.name}</span>
              <span>{look.headwear.name}</span>
            </div>
          </div>
          <button className={styles.secondaryButton} type="button" onClick={() => setScreen('studio')}>
            Go to Design Studio
          </button>
        </section>

        <section className={styles.roomCard}>
          <div className={styles.roomTitle}>Pantry & Storage</div>
          <div className={styles.inventoryList}>
            {MARKET_ITEMS.map((item) => (
              <span key={item.id}>{item.icon} {item.name}: {inventory[item.id] || 0}</span>
            ))}
          </div>
          <div className={styles.mealHistory}>
            <strong>Recent food</strong>
            <span>{meals.length ? meals.slice(-4).join(' - ') : 'Nothing yet'}</span>
          </div>
        </section>

        <div className={styles.fullMessage} aria-live="polite">
          {message || `This is ${characterName}'s private space at the resort.`}
        </div>
      </div>,
    );
  }

  return (
    <main className={[styles.gameShell, styles.mapGameShell].join(' ')}>
      <section className={[styles.topBar, styles.mapTopBar].join(' ')}>
        <div className={styles.mapBrandLine}>
          {libraryHref && (
            <a className={styles.libraryLink} href={libraryHref}>
              ← Game Library
            </a>
          )}
          <div className={styles.brand}>Kids Resort</div>
          <div className={styles.tagline}>A grown-up world made just for kids.</div>
        </div>
        <div className={styles.profileStrip}>
          <div className={styles.wallet}>🪙 {bucks} Resort Bucks</div>
          <div className={styles.badgeCount}>⭐ {badges.length} badges</div>
        </div>
      </section>

      <section className={[styles.playArea, styles.mapPlayArea].join(' ')}>
        <div className={styles.mapPanel} ref={mapPanelRef}>
          <div className={styles.mapSky}>
            <div className={styles.sun} />
            <div className={styles.cloudOne} />
            <div className={styles.cloudTwo} />
          </div>

          <div className={styles.mapInfo} aria-live="polite">
            <div className={styles.mapInfoRole}>{selectedPlace.role}</div>
            <div className={styles.mapInfoTitle}>{placeDisplayName(selectedPlace)}</div>
            <div className={styles.mapInfoDescription}>{selectedPlace.description.replace('Emily', characterName)}</div>
          </div>

          <div className={styles.horizonBack} />
          <div className={styles.horizonFront} />

          <div className={[styles.mapTree, styles.treeFarLeft].join(' ')} aria-hidden="true" />
          <div className={[styles.mapTree, styles.treeFarCenter].join(' ')} aria-hidden="true" />
          <div className={[styles.mapTree, styles.treeFarRight].join(' ')} aria-hidden="true" />
          <div className={[styles.mapTree, styles.treeMidLeft].join(' ')} aria-hidden="true" />
          <div className={[styles.mapTree, styles.treeMidRight].join(' ')} aria-hidden="true" />
          <div className={[styles.mapTree, styles.treeNearLeft].join(' ')} aria-hidden="true" />
          <div className={[styles.mapTree, styles.treeNearRight].join(' ')} aria-hidden="true" />

          {PLACES.map((place) => (
            <button
              key={place.id}
              type="button"
              className={[
                styles.place,
                selectedPlaceId === place.id ? styles.placeSelected : '',
                place.id === placeId ? styles.placeCurrent : '',
              ].join(' ')}
              style={{
                left: `${place.x}%`,
                top: `${place.y}%`,
                zIndex: mapDepthRanks[`place:${place.id}`] ?? 5,
                '--depth-scale':
                  place.id === 'suite'
                    ? 1.78
                    : place.id === 'studio' || place.id === 'market'
                      ? 1.45
                      : place.id === 'lobby'
                        ? 1.22
                        : place.id === 'cafe'
                          ? 0.97
                          : 0.95,
                '--label-offset':
                  place.id === 'suite'
                    ? '-32px'
                    : place.id === 'studio' || place.id === 'market'
                      ? '-8px'
                      : place.id === 'lobby'
                        ? '4px'
                        : '20px',
              }}
              data-label-open={touchPlaceId === place.id ? 'true' : 'false'}
              onClick={() => handlePlaceClick(place)}
              onTouchEnd={(event) => handlePlaceTouch(event, place)}
            >
              <span className={styles.placeLabel}>{placeDisplayName(place)}</span>
              {place.id === placeId && place.id !== 'bank' && !isWalking && (
                <span className={styles.placeEnterPrompt}>Enter</span>
              )}
              <span
                className={styles.placeBuilding}
                data-place={place.id}
                aria-hidden="true"
                ref={(node) => {
                  if (node) placeBuildingRefs.current[place.id] = node;
                  else delete placeBuildingRefs.current[place.id];
                }}
              >
                <span className={styles.buildingRoof} />
                <span className={styles.buildingUpper} />
                <span className={styles.buildingFacade} />
                <span className={[styles.buildingWindow, styles.buildingWindowLeft].join(' ')} />
                <span className={[styles.buildingWindow, styles.buildingWindowRight].join(' ')} />
                <span className={styles.buildingDoor} />
                <span className={styles.buildingAwning} />
                <span className={styles.buildingDetail} />
                <span className={styles.buildingSign}>
                  {place.id === 'suite'
                    ? characterName.toUpperCase()
                    : place.id === 'lobby'
                      ? 'RESORT'
                      : place.id === 'cafe'
                        ? 'SUNSHINE'
                        : place.id === 'bank'
                          ? 'BANK'
                          : place.id === 'market'
                            ? 'MARKET'
                            : 'STUDIO'}
                </span>
              </span>
            </button>
          ))}

          {people.map((person) => (
            <button
              key={person.id}
              type="button"
              className={styles.mapNpc}
              style={{
                left: person.spawn.x + '%',
                top: person.spawn.y + '%',
                zIndex: mapDepthRanks[`person:${person.id}`] ?? 12,
              }}
              data-moving={person.isRoaming ? 'true' : 'false'}
              data-direction={person.walkDirection || 'front'}
              onClick={() => {
                setPeopleOpen(true);
                openPersonEditor(person, 'edit');
              }}
              aria-label={'Edit ' + person.name}
            >
              <span className={styles.mapNpcFigure}>
                {renderCharacter(false, person.look, person.character, person.name)}
              </span>
              <span className={styles.mapNpcName}>{person.name}</span>
            </button>
          ))}

          <div
            className={[styles.player, styles.playerDetailed, isWalking ? styles.playerWalking : ''].join(' ')}
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              zIndex: mapDepthRanks.player ?? 12,
              '--player-depth-scale': (0.24 + position.y * 0.0043).toFixed(3),
              ...characterStyle,
              '--character-idle-delay': idlePhaseForName(characterName),
              '--outfit-shirt': look.shirt.swatch,
              '--outfit-bottoms': look.bottoms.swatch,
              '--outfit-shoes': look.shoes.swatch,
              '--outfit-glasses': look.glasses.swatch,
              '--outfit-headwear': look.headwear.swatch,
            }}
            data-frame={walkFrame}
            data-shirt={look.shirt.id}
            data-bottoms={look.bottoms.id}
            data-sleeve={look.shirt.sleeve || 'short'}
            data-leg={look.bottoms.leg || 'straight'}
            data-shoe={look.shoes.shoe || 'sneakers'}
            data-glasses={look.glasses.id}
            data-headwear={look.headwear.id}
            data-hair={look.hair.id}
            data-gender={character.gender}
            data-makeup={character.makeup || 'none'}
            data-facing={facing}
            data-view={isWalking ? walkView : 'front'}
            data-moving={isWalking ? 'true' : 'false'}
            aria-label={characterName}
          >
            <div className={styles.playerSprite} style={playerView === 'front' ? { transform: 'none' } : undefined}>
              <div className={[styles.playerHair, styles.playerHairDetail].join(' ')} style={playerView === 'front' ? { left: 7, top: 0, width: 48, height: 48, borderRadius: '50% 50% 45% 45%' } : undefined} />
              <span className={styles.playerHeadwear} aria-hidden="true" />
              <span className={[styles.playerEar, styles.playerEarLeft].join(' ')} />
              <span className={[styles.playerEar, styles.playerEarRight].join(' ')} />
              <div className={[styles.playerHead, styles.playerHeadDetail].join(' ')} style={playerView === 'front' ? { left: 16, top: 9, width: 31, height: 35, borderRadius: '48% 48% 45% 45%' } : undefined}>
                <span className={[styles.playerBrow, styles.playerBrowLeft].join(' ')} />
                <span className={[styles.playerBrow, styles.playerBrowRight].join(' ')} />
                <span className={[styles.playerEye, styles.playerEyeLeft].join(' ')} />
                <span className={[styles.playerEye, styles.playerEyeRight].join(' ')} />
                <span className={styles.playerNose} />
                <span className={styles.playerSmile} />
                <span className={styles.playerMakeup} aria-hidden="true" />
              </div>
              <div className={styles.playerHairFront} />
              <span className={styles.playerGlasses} aria-hidden="true" />
              <div className={styles.playerNeck} />
              <div className={[styles.playerBody, styles.playerBodyDetail].join(' ')} style={{ background: look.shirt.swatch }} />
              <div className={styles.playerPelvis} style={{ background: look.bottoms.swatch }} />

              <div className={styles.playerArmRigLeft} style={playerView === 'front' ? { left: 7, right: 'auto', top: 49, transform: 'none', scale: isWalking ? (walkFrame < 3 ? 1.08 : 0.92) : 1, opacity: 1 } : undefined}>
                <span className={styles.playerUpperArm} />
                <span className={styles.playerElbow} />
                <span className={styles.playerForearm} />
                <span className={styles.playerHand}>
                  <i className={styles.playerThumb} />
                  <i className={styles.playerFinger} />
                  <i className={styles.playerFinger} />
                  <i className={styles.playerFinger} />
                </span>
              </div>
              <div className={styles.playerArmRigRight} style={playerView === 'front' ? { right: 7, left: 'auto', top: 49, transform: 'none', scale: isWalking ? (walkFrame < 3 ? 0.92 : 1.08) : 1, opacity: 1 } : undefined}>
                <span className={styles.playerUpperArm} />
                <span className={styles.playerElbow} />
                <span className={styles.playerForearm} />
                <span className={styles.playerHand}>
                  <i className={styles.playerThumb} />
                  <i className={styles.playerFinger} />
                  <i className={styles.playerFinger} />
                  <i className={styles.playerFinger} />
                </span>
              </div>

              <div className={styles.playerLegRigLeft} style={playerView === 'front' ? { transform: isWalking && walkFrame < 3 ? 'translateY(-4px)' : 'none', scale: isWalking && walkFrame < 3 ? 1.05 : 0.95 } : undefined}>
                <span className={styles.playerSkinLeg} />
                <span className={styles.playerThigh} style={{ background: look.bottoms.swatch }} />
                <span className={styles.playerKnee} style={{ background: look.bottoms.leg === 'short' ? 'var(--character-skin)' : look.bottoms.swatch }} />
                <span className={styles.playerShin} style={{ background: look.bottoms.leg === 'short' ? 'var(--character-skin)' : look.bottoms.swatch }} />
                <span className={styles.playerShoe} style={{ background: look.shoes.swatch }} />
              </div>
              <div className={styles.playerLegRigRight} style={playerView === 'front' ? { transform: isWalking && walkFrame >= 3 ? 'translateY(-4px)' : 'none', scale: isWalking && walkFrame >= 3 ? 1.05 : 0.95 } : undefined}>
                <span className={styles.playerSkinLeg} />
                <span className={styles.playerThigh} style={{ background: look.bottoms.swatch }} />
                <span className={styles.playerKnee} style={{ background: look.bottoms.leg === 'short' ? 'var(--character-skin)' : look.bottoms.swatch }} />
                <span className={styles.playerShin} style={{ background: look.bottoms.leg === 'short' ? 'var(--character-skin)' : look.bottoms.swatch }} />
                <span className={styles.playerShoe} style={{ background: look.shoes.swatch }} />
              </div>
            </div>
          </div>

          <button
            type="button"
            className={[styles.mapCornerButton, styles.addCharacterButton].join(' ')}
            aria-label="Create character"
            title="Create character"
            onClick={() => {
              setPeopleOpen(false);
              createCustomPerson();
            }}
          >
            +
          </button>

          {peopleOpen && (
            <div className={styles.peoplePanel}>
              <div className={styles.peoplePanelHeader}>
                <div>
                  <strong>People</strong>
                  <span>Visitors and characters in this resort session.</span>
                </div>
                <button type="button" onClick={() => setPeopleOpen(false)}>×</button>
              </div>

              <div className={styles.peoplePanelActions}>
                <button type="button" onClick={createCustomPerson}>Create Character</button>
              </div>

              <div className={styles.peopleRoster}>
                {people.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    className={styles.peopleCard}
                    onClick={() => openPersonEditor(person, 'edit')}
                  >
                    <span className={styles.peopleCardPreview}>
                      {renderCharacter(false, person.look, person.character, person.name)}
                    </span>
                    <span>
                      <strong>{person.name}</strong>
                      <small>
                        {person.source === 'random' ? 'Random visitor' : 'Created character'}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {personEditorOpen && personDraft && (
            <div className={styles.personEditorBackdrop}>
              <section className={styles.personEditor} aria-label="Character builder">
                <header className={styles.personEditorHeader}>
                  <div>
                    <strong>
                      {personEditorMode === 'create' ? 'Create Character' : 'Customize ' + personDraft.name}
                    </strong>
                    <span>Everything here can be changed later.</span>
                  </div>
                  <button type="button" onClick={() => setPersonEditorOpen(false)}>×</button>
                </header>

                <div className={styles.personEditorBody}>
                  <aside className={styles.personEditorPreview}>
                    {renderCharacter(true, personDraft.look, personDraft.character, personDraft.name)}
                    <div className={styles.personEditorPreviewName}>{personDraft.name}</div>
                  </aside>

                  <div className={styles.personEditorControls}>
                    <div className={styles.personEditorSection}>
                      <h3>Identity</h3>
                      <label className={styles.personTextField}>
                        <span>Name</span>
                        <input
                          type="text"
                          maxLength={18}
                          value={personDraft.name}
                          onChange={(event) => setPersonDraft((current) => ({
                            ...current,
                            name: event.target.value || 'Friend',
                          }))}
                        />
                      </label>
                      <div className={styles.creatorChoiceWrap}>
                        {CHARACTER_OPTIONS.gender.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className={styles.creatorTextChoice}
                            data-selected={personDraft.character.gender === option.id ? 'true' : 'false'}
                            onClick={() => updatePersonCharacter('gender', option.id)}
                          >
                            {option.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.personEditorSection}>
                      <h3>Colors</h3>
                      {[
                        ['eye', 'Eyes'],
                        ['hair', 'Hair'],
                        ['skin', 'Skin'],
                        ['base', 'Favorite'],
                      ].map(([category, label]) => (
                        <div key={category} className={styles.personOptionRow}>
                          <span>{label}</span>
                          <div className={styles.creatorSwatches}>
                            {CHARACTER_OPTIONS[category].map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                className={styles.creatorSwatch}
                                data-selected={personDraft.character[category] === option.id ? 'true' : 'false'}
                                style={{ '--swatch-color': option.color }}
                                aria-label={option.name}
                                title={option.name}
                                onClick={() => updatePersonCharacter(category, option.id)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className={styles.personEditorSection}>
                      <h3>Hair</h3>
                      <div className={styles.creatorChoiceWrap}>
                        {LOOK_OPTIONS.hair.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className={styles.creatorTextChoice}
                            data-selected={personDraft.look.hair.id === option.id ? 'true' : 'false'}
                            onClick={() => setPersonDraft((current) => ({
                              ...current,
                              look: { ...current.look, hair: option },
                            }))}
                          >
                            {option.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.personEditorSection}>
                      <h3>Body</h3>
                      <div className={styles.creatorSliderStack}>
                        {[
                          ['height', 'Height'],
                          ['weight', 'Weight'],
                          ['strength', 'Strength'],
                        ].map(([key, label]) => (
                          <label key={key} className={styles.creatorSliderRow}>
                            <span>{label}</span>
                            <input
                              type="range"
                              min="1"
                              max="5"
                              step="1"
                              value={personDraft.character[key]}
                              onChange={(event) => updatePersonCharacter(key, Number(event.target.value))}
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className={styles.personEditorSection}>
                      <h3>Face Builder</h3>
                      <div className={styles.creatorSliderStack}>
                        {FACE_SLIDERS.map(([key, label]) => (
                          <label key={key} className={styles.creatorSliderRow}>
                            <span>{label}</span>
                            <input
                              type="range"
                              min="1"
                              max="5"
                              step="1"
                              value={personDraft.character[key]}
                              onChange={(event) => updatePersonCharacter(key, Number(event.target.value))}
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className={styles.personEditorSection}>
                      <h3>Face Details</h3>
                      <div className={styles.creatorChoiceWrap}>
                        {[
                          ['none', 'None'],
                          ['blush', 'Blush'],
                          ['freckles', 'Freckles'],
                          ['lashes', 'Lashes'],
                          ['lip', 'Lip color'],
                        ].map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            className={styles.creatorTextChoice}
                            data-selected={personDraft.character.makeup === id ? 'true' : 'false'}
                            onClick={() => updatePersonCharacter('makeup', id)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {personDraft.character.makeup !== 'none' && (
                        <label className={styles.creatorColorInput}>
                          <span>Detail color</span>
                          <input
                            type="color"
                            value={personDraft.character.makeupColor}
                            onChange={(event) => updatePersonCharacter('makeupColor', event.target.value)}
                          />
                        </label>
                      )}
                    </div>

                    <div className={styles.personEditorSection}>
                      <h3>Clothes & Accessories</h3>
                      {FASHION_CATEGORIES.map((category) => {
                        const item = personDraft.look[category.id];
                        return (
                          <div key={category.id} className={styles.personFashionRow}>
                            <div className={styles.personFashionHeading}>
                              <span>{category.label}</span>
                              {item.id !== 'none' && (
                                <input
                                  type="color"
                                  value={item.swatch}
                                  aria-label={category.label + ' color'}
                                  onChange={(event) => updatePersonLookColor(category.id, event.target.value)}
                                />
                              )}
                            </div>
                            <div className={styles.creatorChoiceWrap}>
                              {LOOK_OPTIONS[category.id].map((option) => (
                                <button
                                  key={option.id}
                                  type="button"
                                  className={styles.creatorTextChoice}
                                  data-selected={item.id === option.id ? 'true' : 'false'}
                                  onClick={() => updatePersonLookType(category.id, option)}
                                >
                                  {option.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className={styles.personEditorSection}>
                      <h3>Personality</h3>
                      <div className={styles.creatorSliderStack}>
                        {PERSONALITY_STATS.map(([key, label]) => (
                          <label key={key} className={styles.creatorSliderRow}>
                            <span>{label}</span>
                            <input
                              type="range"
                              min="1"
                              max="5"
                              step="1"
                              value={personDraft.personality[key]}
                              onChange={(event) => updatePersonPersonality(key, Number(event.target.value))}
                            />
                          </label>
                        ))}
                      </div>
                      <label className={styles.personTextField}>
                        <span>Personality note</span>
                        <textarea
                          rows="3"
                          maxLength={180}
                          value={personDraft.personality.note}
                          placeholder="Example: Loves dinosaurs, shy at first, very silly once comfortable."
                          onChange={(event) => updatePersonPersonality('note', event.target.value)}
                        />
                      </label>
                      <small className={styles.personalityFutureNote}>
                        These personality settings are stored for the future conversation system. AI dialogue is not connected yet.
                      </small>
                    </div>
                  </div>
                </div>

                <footer className={styles.personEditorFooter}>
                  {personEditorMode !== 'create' && (
                    <button
                      type="button"
                      className={styles.personDeleteButton}
                      onClick={() => {
                        setPeople((items) => items.filter((item) => item.id !== personDraft.id));
                        setPersonEditorOpen(false);
                      }}
                    >
                      Remove Character
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const fresh = makeCharacterPerson('random');
                      setPersonDraft((current) => ({
                        ...fresh,
                        id: current.id,
                        name: current.name,
                        source: current.source,
                        spawn: current.spawn,
                      }));
                    }}
                  >
                    Randomize
                  </button>
                  <button type="button" onClick={() => setPersonEditorOpen(false)}>Cancel</button>
                  <button type="button" className={styles.primaryButton} onClick={savePersonDraft}>
                    Save Character
                  </button>
                </footer>
              </section>
            </div>
          )}

          <div className={styles.settingsDock}>
            {settingsOpen && (
              <div className={styles.settingsPanel}>
                <div className={styles.creatorHeader}>
                  <strong>Character Creator</strong>
                  <span>Make this character yours.</span>
                </div>

                <div className={styles.creatorSection}>
                  <label htmlFor="kids-resort-character-name">Name</label>
                  <input
                    id="kids-resort-character-name"
                    type="text"
                    value={characterName}
                    maxLength={18}
                    onChange={(event) => setCharacterName(event.target.value || 'Emily')}
                  />
                </div>

                <div className={styles.creatorSection}>
                  <span className={styles.creatorLabel}>Gender</span>
                  <div className={styles.creatorChoiceRow}>
                    {CHARACTER_OPTIONS.gender.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={styles.creatorTextChoice}
                        data-selected={character.gender === option.id ? 'true' : 'false'}
                        onClick={() => chooseCharacterOption('gender', option)}
                      >
                        {option.name}
                      </button>
                    ))}
                  </div>
                </div>

                {[
                  ['eye', 'Eye color'],
                  ['hair', 'Hair color'],
                  ['skin', 'Skin color'],
                  ['base', 'Favorite color'],
                ].map(([category, label]) => (
                  <div key={category} className={styles.creatorSection}>
                    <span className={styles.creatorLabel}>{label}</span>
                    <div className={styles.creatorSwatches}>
                      {CHARACTER_OPTIONS[category].map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className={styles.creatorSwatch}
                          data-selected={character[category] === option.id ? 'true' : 'false'}
                          style={{ '--swatch-color': option.color }}
                          aria-label={option.name}
                          title={option.name}
                          onClick={() => chooseCharacterOption(category, option)}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                <div className={styles.creatorSection}>
                  <span className={styles.creatorLabel}>Hair style</span>
                  <div className={styles.creatorChoiceWrap}>
                    {LOOK_OPTIONS.hair.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={styles.creatorTextChoice}
                        data-selected={look.hair.id === option.id ? 'true' : 'false'}
                        onClick={() => setLook((current) => ({ ...current, hair: option }))}
                      >
                        {option.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.creatorSection}>
                  <span className={styles.creatorLabel}>Body</span>
                  <div className={styles.creatorSliderStack}>
                    {[
                      ['height', 'Height'],
                      ['weight', 'Weight'],
                      ['strength', 'Strength'],
                    ].map(([key, label]) => (
                      <label key={key} className={styles.creatorSliderRow}>
                        <span>{label}</span>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          step="1"
                          value={character[key]}
                          onChange={(event) => updateMainCharacterLevel(key, event.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className={styles.creatorSection}>
                  <span className={styles.creatorLabel}>Face builder</span>
                  <div className={styles.creatorSliderStack}>
                    {FACE_SLIDERS.map(([key, label]) => (
                      <label key={key} className={styles.creatorSliderRow}>
                        <span>{label}</span>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          step="1"
                          value={character[key]}
                          onChange={(event) => updateMainCharacterLevel(key, event.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className={styles.creatorSection}>
                  <span className={styles.creatorLabel}>Face details</span>
                  <div className={styles.creatorChoiceWrap}>
                    {[
                      ['none', 'None'],
                      ['blush', 'Blush'],
                      ['freckles', 'Freckles'],
                      ['lashes', 'Lashes'],
                      ['lip', 'Lip color'],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className={styles.creatorTextChoice}
                        data-selected={character.makeup === id ? 'true' : 'false'}
                        onClick={() => setCharacter((current) => ({ ...current, makeup: id }))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {character.makeup !== 'none' && (
                    <label className={styles.creatorColorInput}>
                      <span>Detail color</span>
                      <input
                        type="color"
                        value={character.makeupColor}
                        onChange={(event) => setCharacter((current) => ({
                          ...current,
                          makeupColor: event.target.value,
                        }))}
                      />
                    </label>
                  )}
                </div>
              </div>
            )}
            <button
              type="button"
              className={styles.mapCornerButton}
              aria-label="Options"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((open) => !open)}
            >
              ⚙
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
