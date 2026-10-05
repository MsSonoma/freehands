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
  { id: 'pasta', name: 'Garden Pasta', icon: '\u{1F35D}', price: 7 },
  { id: 'tacos', name: 'Resort Tacos', icon: '\u{1F32E}', price: 6 },
  { id: 'dessert', name: 'Berry Sundae', icon: '\u{1F368}', price: 5 },
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

function makeCharacterPerson(mode = 'random') {
  const random = mode === 'random';
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
  {
    id: 'maya',
    name: 'Maya',
    emoji: '😊',
    pickiness: 'easygoing',
    category: 'shirt',
    type: 'puff-sleeve',
    color: '#8d66bd',
    colorName: 'purple',
    reward: 5,
    request: 'I want a fun puff-sleeve top. Purple would be amazing.',
  },
  {
    id: 'leo',
    name: 'Leo',
    emoji: '😄',
    pickiness: 'particular',
    category: 'shoes',
    type: 'high-tops',
    color: '#438fd0',
    colorName: 'blue',
    reward: 6,
    request: 'I really want high-tops. Blue is my favorite.',
  },
  {
    id: 'zoe',
    name: 'Zoe',
    emoji: '🧐',
    pickiness: 'picky',
    category: 'glasses',
    type: 'cat-eye',
    color: '#ff4f9a',
    colorName: 'pink',
    reward: 7,
    request: 'Cat-eye glasses, and I want them pink. I know exactly what I like.',
  },
  {
    id: 'kai',
    name: 'Kai',
    emoji: '🙂',
    pickiness: 'easygoing',
    category: 'bottoms',
    type: 'wide-leg',
    color: '#54c79c',
    colorName: 'mint',
    reward: 5,
    request: 'Could you make me wide-leg pants? Mint sounds cool, but surprise me.',
  },
  {
    id: 'nina',
    name: 'Nina',
    emoji: '🤨',
    pickiness: 'picky',
    category: 'headwear',
    type: 'bow',
    color: '#f1be38',
    colorName: 'yellow',
    reward: 7,
    request: 'I want a yellow hair bow. Not a hat. A bow.',
  },
];

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
  const [look, setLook] = useState({
    shirt: LOOK_OPTIONS.shirt[0],
    bottoms: LOOK_OPTIONS.bottoms[0],
    shoes: LOOK_OPTIONS.shoes[0],
    glasses: LOOK_OPTIONS.glasses[0],
    headwear: LOOK_OPTIONS.headwear[0],
    hair: LOOK_OPTIONS.hair[0],
  });

  const [people, setPeople] = useState([]);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [personEditorOpen, setPersonEditorOpen] = useState(false);
  const [personDraft, setPersonDraft] = useState(null);
  const [personEditorMode, setPersonEditorMode] = useState('edit');
  const peopleSeededRef = useRef(false);

  const [studioMessage, setStudioMessage] = useState('');
  const [studioCreations, setStudioCreations] = useState(0);
  const [studioCategory, setStudioCategory] = useState('shirt');
  const [studioWorkTool, setStudioWorkTool] = useState('fashion');
  const [studioCustomerIndex, setStudioCustomerIndex] = useState(0);
  const [studioCustomerDone, setStudioCustomerDone] = useState(false);
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
    if (peopleSeededRef.current) return;
    peopleSeededRef.current = true;
    setPeople([makeCharacterPerson('random'), makeCharacterPerson('random')]);
  }, []);

  useEffect(() => {
    if (screen !== 'cafe-work' || cafeFinished) return undefined;
    const timer=window.setInterval(()=>setCafeNow(Date.now()),250);
    return ()=>window.clearInterval(timer);
  }, [screen,cafeFinished]);

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

  useEffect(() => {
    if (screen !== 'cafe-work') return;
    setCafeOrders((items) => items.filter((order) => cafeNow - order.born < 45000));
  }, [cafeNow, screen]);

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
      openScreen('lobby-food');
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

  const spawnRandomPerson = () => {
    const person = makeCharacterPerson('random');
    setPeople((items) => [...items, person]);
    setPeopleOpen(true);
    openPersonEditor(person, 'edit');
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
    const base = studioDraftLook || look;
    const current = base[category];
    const nextOption = {
      ...option,
      swatch: current?.swatch || option.swatch,
    };
    setStudioDraftLook({ ...base, [category]: nextOption });
    setStudioMessage('Trying on ' + nextOption.name + '.');
  };

  const updateStudioColor = (category, swatch) => {
    const base = studioDraftLook || look;
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

  const showFashionToCustomer = () => {
    const customer = FASHION_CUSTOMERS[studioCustomerIndex % FASHION_CUSTOMERS.length];
    const draft = studioDraftLook || look;
    const item = draft[customer.category];
    const wanted = LOOK_OPTIONS[customer.category].find((option) => option.id === customer.type);
    const typeMatch = item?.id === customer.type;
    const colorGap = colorDistance(item?.swatch, customer.color);
    const colorMatch = colorGap <= 72;
    const pickyColorMatch = colorGap <= 42;

    let accepted = true;
    if (customer.pickiness === 'particular') accepted = typeMatch || colorMatch;
    if (customer.pickiness === 'picky') accepted = typeMatch && pickyColorMatch;

    if (!accepted) {
      const typeNote = typeMatch ? '' : 'I really wanted ' + wanted.name + '. ';
      const colorNote = pickyColorMatch ? '' : 'I was hoping for ' + customer.colorName + '. ';
      setStudioMessage(customer.name + ': ' + typeNote + colorNote + 'Can we try again?');
      return;
    }

    let opinion = 'I love it!';
    if (typeMatch && colorMatch) {
      opinion = 'That is exactly what I pictured!';
    } else if (typeMatch) {
      opinion = 'The style is perfect. I did not expect that color, but I like it!';
    } else if (colorMatch) {
      opinion = 'That ' + customer.colorName + ' is great. The different style works for me!';
    } else {
      opinion = 'That is not what I pictured at all, but I really like what you made!';
    }

    setStudioCreations((value) => value + 1);
    setBucks((value) => value + customer.reward);
    setBadges((items) => (
      items.includes('Design Studio Fashion Star')
        ? items
        : [...items, 'Design Studio Fashion Star']
    ));
    setStudioCustomerDone(true);
    setStudioMessage(
      customer.name + ': ' + opinion + ' +' + customer.reward + ' Resort Bucks · ⭐ Fashion Star earned'
    );
  };

  const nextFashionCustomer = () => {
    const nextIndex = (studioCustomerIndex + 1) % FASHION_CUSTOMERS.length;
    const nextCustomer = FASHION_CUSTOMERS[nextIndex];
    setStudioCustomerIndex(nextIndex);
    setStudioCustomerDone(false);
    setStudioCategory(nextCustomer.category);
    setStudioDraftLook({ ...look });
    setStudioMessage(nextCustomer.name + ' has a new fashion request.');
  };

  const renderCharacter = (
    large = false,
    displayLook = look,
    displayCharacter = character,
    displayName = characterName,
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
      style={{
        ...characterStyleFor(displayCharacter),
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
      <aside className={styles.recipeWall}><h2>Recipe Wall</h2>{CAFE_RECIPES.map((r)=><div key={r.id} className={styles.wallRecipe}><strong>{r.name}</strong><span>{r.formula}</span></div>)}</aside>
      <section className={styles.orderRail}><b>Orders · {cafeServed}/8</b>{cafeOrders.map((o)=>{const r=CAFE_RECIPES.find((x)=>x.id===o.recipeId),age=cafeNow-o.born,mood=age<12000?'🙂':age<24000?'😐':age<35000?'☹️':'😡';return <button key={o.id} type="button" className={styles.orderTicket} onClick={()=>serveCafeOrder(o)}><span>{mood}</span><strong>{o.guest}</strong><span>{r.icon}</span><small>{Math.max(0,Math.ceil((45000-age)/1000))}s</small></button>})}</section>
      <section className={styles.kitchenStations}><button type="button" onClick={()=>setCafeStorage(cafeStorage==='fridge'?null:'fridge')}>🧊<strong>Refrigerator</strong></button><div className={styles.grillStation}><b>🔥 Grill</b><div>{cafeGrill.map((g)=>{const x=CAFE_INGREDIENTS[g.ingredientId],age=cafeNow-g.started,state=age<x.cook?'Cooking…':age<=x.cook+4500?'READY!':'BURNT';return <button key={g.id} type="button" data-state={state} onClick={()=>pullFromGrill(g)}><span>{x.icon}</span><strong>{state}</strong></button>})}</div></div><button type="button" onClick={()=>setCafeStorage(cafeStorage==='cabinet'?null:'cabinet')}>🥫<strong>Cabinet</strong></button></section>
      {cafeStorage&&<section className={styles.ingredientDrawer}>{(cafeStorage==='fridge'?fridgeItems:cabinetItems).map(([id,x])=><button key={id} type="button" onClick={()=>takeCafeIngredient(id)}><span>{x.icon}</span><small>{x.name}</small></button>)}</section>}
      <section className={styles.plateStation}><strong>🍽️ Plate</strong><div>{cafePlate.map((id,i)=><span key={`${id}-${i}`}>{CAFE_INGREDIENTS[id]?.icon}</span>)}</div><button type="button" onClick={()=>setCafePlate([])}>Clear</button></section><div className={styles.cafeFeedback}>{cafeMessage}</div>{cafeFinished&&<div className={styles.cafeWin}><div>⭐</div><h2>Shift complete!</h2><p>8 Resort Buck bonus earned.</p><button className={styles.primaryButton} type="button" onClick={()=>setScreen('cafe')}>Back to Café</button></div>}
    </section></main>;
  }

  if (screen === 'lobby-food' || screen === 'cafe-food') {
    const isLobby = screen === 'lobby-food';
    const menu = isLobby ? LOBBY_MENU : CAFE_MENU;
    return interiorShell(
      isLobby ? 'Palm Court' : 'Sunshine Cafe',
      isLobby ? '\u{1F37D}\u{FE0F}' : '\u{1F96A}',
      isLobby ? 'LOBBY RESTAURANT' : 'GRAB A BITE',
      <div className={styles.shopGrid}>
        {menu.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.shopCard}
            onClick={() => buyMeal(item)}
          >
            <span className={styles.shopIcon}>{item.icon}</span>
            <strong>{item.name}</strong>
            <span>{item.price} Resort Bucks</span>
          </button>
        ))}
        <div className={styles.fullMessage} aria-live="polite">
          {message || 'Choose something to eat.'}
        </div>
      </div>,
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
    return interiorShell(
      'Design Studio',
      '\u{1F457}',
      'CREATE OR SHOP',
      <div className={styles.studioChoiceGrid}>
        <button
          className={styles.studioChoiceCard}
          type="button"
          onClick={() => {
            const customer = FASHION_CUSTOMERS[studioCustomerIndex % FASHION_CUSTOMERS.length];
            setStudioMessage('');
            setStudioWorkTool('fashion');
            setStudioCustomerDone(false);
            setStudioCategory(customer.category);
            setStudioDraftLook({ ...look });
            setScreen('studio-work');
          }}
        >
          <span className={styles.studioChoiceIcon}>🎨</span>
          <strong>Work Here</strong>
          <span>Make art or design fashion for customers and earn Resort Bucks.</span>
        </button>
        <button
          className={styles.studioChoiceCard}
          type="button"
          onClick={() => {
            setStudioMessage('');
            setStudioCategory('shirt');
            setStudioDraftLook({ ...look });
            setScreen('studio-shop');
          }}
        >
          <span className={styles.studioChoiceIcon}>🛍️</span>
          <strong>Shop & Try On</strong>
          <span>Design custom pieces for yourself, try them on, and buy the ones you want.</span>
        </button>
      </div>,
    );
  }

  if (screen === 'studio-work') {
    const customer = FASHION_CUSTOMERS[studioCustomerIndex % FASHION_CUSTOMERS.length];
    const previewLook = studioDraftLook || look;
    const customerItem = previewLook[customer.category];
    const customerOptions = LOOK_OPTIONS[customer.category];
    const wanted = customerOptions.find((option) => option.id === customer.type);
    const customerCategoryLabel =
      FASHION_CATEGORIES.find((category) => category.id === customer.category)?.label || 'Fashion';

    return interiorShell(
      'Design Studio',
      '🎨',
      'WORK HERE',
      <div className={styles.studioWorkPage}>
        <div className={styles.studioToolTabs}>
          <button
            type="button"
            data-active={studioWorkTool === 'fashion'}
            onClick={() => {
              setStudioWorkTool('fashion');
              setStudioCategory(customer.category);
              setStudioDraftLook({ ...look });
              setStudioMessage('');
            }}
          >
            👗 Fashion Customers
          </button>
          <button
            type="button"
            data-active={studioWorkTool === 'art'}
            onClick={() => {
              setStudioWorkTool('art');
              setStudioMessage('');
            }}
          >
            🖌️ Art Commissions
          </button>
        </div>

        {studioWorkTool === 'fashion' ? (
          <div className={styles.studioFashionWorkLayout}>
            <section className={styles.characterStage}>
              {renderCharacter(true, previewLook)}
              <div className={styles.tryOnBadge}>CUSTOMER DESIGN</div>
            </section>

            <section className={styles.customizer}>
              <div className={styles.fashionEditorCard}>
                <div className={styles.fashionEditorHeading}>
                  <div>
                    <small>{customerCategoryLabel}</small>
                    <h3>{customerItem.name}</h3>
                  </div>
                  {customerItem.id !== 'none' && (
                    <label className={styles.fashionColorControl}>
                      Any color
                      <input
                        type="color"
                        value={customerItem.swatch || '#777777'}
                        onChange={(event) => updateStudioColor(customer.category, event.target.value)}
                      />
                    </label>
                  )}
                </div>

                <div className={styles.fashionTypeGrid}>
                  {customerOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      data-selected={customerItem.id === option.id ? 'true' : 'false'}
                      onClick={() => updateStudioType(customer.category, option)}
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
                    <button type="button" onClick={showFashionToCustomer}>Show Customer</button>
                  )}
                </div>
              </div>
            </section>

            <aside className={styles.studioCustomerCard}>
              <div className={styles.studioCustomerFace}>{customer.emoji}</div>
              <strong>{customer.name}</strong>
              <span className={styles.customerPickiness} data-level={customer.pickiness}>
                {customer.pickiness}
              </span>
              <p className={styles.customerRequest}>{customer.request}</p>
              <div className={styles.customerWantRow}>
                <span style={{ background: customer.color }} />
                <div>
                  <small>Hoping for</small>
                  <strong>{wanted.name} · {customer.colorName}</strong>
                </div>
              </div>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() => updateStudioColor(customer.category, customer.color)}
              >
                Use requested color
              </button>
              <div className={styles.studioCreationCount}>
                Pays {customer.reward} Resort Bucks if accepted
              </div>
              <p className={styles.customerOpinion}>
                {studioMessage || 'Design it, then show the customer what you made.'}
              </p>
            </aside>
          </div>
        ) : (
          <div className={styles.studioWorkLayout}>
            <section className={styles.studioWorkbench}>
              <div className={styles.artStudio}>
                <canvas
                  ref={artCanvasRef}
                  className={styles.artCanvas}
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
            </section>
            <aside className={styles.studioCustomerCard}>
              <div className={styles.studioCustomerFace}>😊</div>
              <strong>Art Customer</strong>
              <p>{studioMessage || 'For artwork, the customer is happy to see your own creative idea.'}</p>
              <div className={styles.studioCreationCount}>{studioCreations} creations made</div>
            </aside>
          </div>
        )}

        <button className={styles.secondaryButton} type="button" onClick={() => setScreen('studio')}>
          Studio Lobby
        </button>
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
    const activeLabel = FASHION_CATEGORIES.find((category) => category.id === studioCategory)?.label || 'Fashion';
    const tryOnItems = FASHION_CATEGORIES
      .map((category) => ({
        ...category,
        item: previewLook[category.id],
        changed:
          fashionKey(category.id, previewLook[category.id]) !==
          fashionKey(category.id, look[category.id]),
      }))
      .filter((category) => category.changed);

    return interiorShell(
      'Design Studio',
      '👗',
      'SHOP & TRY ON',
      <div className={styles.studioLayout}>
        <section className={styles.characterStage}>
          {renderCharacter(true, previewLook)}
          <div className={styles.lookSummary}>
            <strong>{characterName}</strong>
            <span>{previewLook.shirt.name} · {previewLook.bottoms.name}</span>
            <span>{previewLook.shoes.name}</span>
            <span>{previewLook.glasses.name} · {previewLook.headwear.name}</span>
          </div>
          <div className={styles.tryOnBadge}>LIVE TRY-ON</div>
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
              <button type="button" onClick={() => setStudioDraftLook({ ...look })}>
                Reset try-on
              </button>
            )}
          </div>
        </section>

        <section className={styles.customizer}>
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

          <div className={styles.fullMessage} aria-live="polite">
            {studioMessage || 'Choose a type and any color. Trying it on is free; keeping the custom design costs Resort Bucks.'}
          </div>
          <button className={styles.secondaryButton} type="button" onClick={() => { setStudioDraftLook(null); setScreen('studio'); }}>Studio Lobby</button>
        </section>
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
        <div className={styles.mapPanel}>
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
              <span className={styles.placeBuilding} data-place={place.id} aria-hidden="true">
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
              }}
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
              '--player-depth-scale': (0.24 + position.y * 0.0043).toFixed(3),
              ...characterStyle,
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
            aria-label="People"
            title="People"
            onClick={() => {
              setPeopleOpen(true);
              setPersonEditorOpen(false);
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
                <button type="button" onClick={spawnRandomPerson}>Random Visitor</button>
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
