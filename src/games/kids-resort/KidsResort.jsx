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
    { id: 'pink', name: 'Pink Tee', swatch: '#ff4f9a', sleeve: 'short', price: 0 },
    { id: 'sunshine', name: 'Sunshine Tank', swatch: '#f1be38', sleeve: 'none', price: 6 },
    { id: 'ocean', name: 'Ocean Long Sleeve', swatch: '#43aee5', sleeve: 'long', price: 8 },
    { id: 'mint', name: 'Mint Puff Sleeve', swatch: '#54c79c', sleeve: 'puff', price: 8 },
  ],
  bottoms: [
    { id: 'denim', name: 'Cuffed Jeans', swatch: '#3b78ba', leg: 'straight', price: 0 },
    { id: 'navy', name: 'Navy Shorts', swatch: '#334d78', leg: 'short', price: 6 },
    { id: 'lavender', name: 'Lavender Wide Legs', swatch: '#9a73c9', leg: 'wide', price: 8 },
    { id: 'coral', name: 'Coral Flares', swatch: '#dc6b63', leg: 'flare', price: 8 },
  ],
  shoes: [
    { id: 'pink-sneakers', name: 'Pink Sneakers', swatch: '#f05d9b', price: 0 },
    { id: 'white-trainers', name: 'White Trainers', swatch: '#f4f4f0', price: 5 },
    { id: 'yellow-high-tops', name: 'Yellow High-Tops', swatch: '#efc33f', price: 7 },
    { id: 'blue-slip-ons', name: 'Blue Slip-Ons', swatch: '#448fcc', price: 5 },
  ],
  hair: [
    { id: 'waves', name: 'Loose Waves', icon: '~' },
    { id: 'ponytail', name: 'Ponytail', icon: '\u{1F380}' },
    { id: 'bun', name: 'High Bun', icon: '\u{1F7E4}' },
  ],
  accessory: [
    { id: 'none', name: 'No Accessory', icon: '\u{2728}' },
    { id: 'sunglasses', name: 'Sunglasses', icon: '\u{1F60E}' },
    { id: 'headband', name: 'Headband', icon: '\u{1F380}' },
    { id: 'backpack', name: 'Mini Backpack', icon: '\u{1F392}' },
    { id: 'necklace', name: 'Necklace', icon: '\u{1F4FF}' },
  ],
};

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
  });
  const walkTokenRef = useRef(0);
  const [look, setLook] = useState({
    shirt: LOOK_OPTIONS.shirt[0],
    bottoms: LOOK_OPTIONS.bottoms[0],
    shoes: LOOK_OPTIONS.shoes[0],
    hair: LOOK_OPTIONS.hair[0],
    accessory: LOOK_OPTIONS.accessory[0],
  });

  const [studioMessage, setStudioMessage] = useState('');
  const [studioCreations, setStudioCreations] = useState(0);
  const [studioTool, setStudioTool] = useState('art');
  const [artColor, setArtColor] = useState('#ff4f9a');
  const artCanvasRef = useRef(null);
  const artDrawingRef = useRef(false);
  const [fashionDraft, setFashionDraft] = useState({
    shirt: '#7ec8f5',
    bottoms: '#8c73c7',
    sleeve: 'short',
    leg: 'straight',
  });
  const [studioTryLook, setStudioTryLook] = useState(null);
  const [ownedLooks, setOwnedLooks] = useState(() => new Set([
    'shirt:pink',
    'bottoms:denim',
    'shoes:pink-sneakers',
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

  const eyeChoice = CHARACTER_OPTIONS.eye.find((option) => option.id === character.eye) ?? CHARACTER_OPTIONS.eye[0];
  const hairChoice = CHARACTER_OPTIONS.hair.find((option) => option.id === character.hair) ?? CHARACTER_OPTIONS.hair[0];
  const skinChoice = CHARACTER_OPTIONS.skin.find((option) => option.id === character.skin) ?? CHARACTER_OPTIONS.skin[0];
  const baseChoice = CHARACTER_OPTIONS.base.find((option) => option.id === character.base) ?? CHARACTER_OPTIONS.base[0];

  const characterStyle = {
    '--character-eye': eyeChoice.color,
    '--character-hair': hairChoice.color,
    '--character-hair-dark': hairChoice.dark,
    '--character-skin': skinChoice.color,
    '--character-skin-shadow': skinChoice.shadow,
    '--character-base': baseChoice.color,
  };

  useEffect(() => {
    return () => {
      walkTokenRef.current += 1;
    };
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
          id: `base-${option.id}`,
          name: `${option.name} Top`,
          swatch: option.color,
        },
      }));
    }
  };

  const chooseLook = (category, option) => {
    setLook((current) => ({ ...current, [category]: option }));
    setMessage(`${option.name} selected.`);
  };

  const makeStudioCreation = (kind) => {
    const reward = 5;
    const label = kind === 'fashion' ? 'fashion design' : 'artwork';
    setStudioCreations((value) => value + 1);
    setBucks((value) => value + reward);
    setStudioMessage('Your customer loves your ' + label + '! +' + reward + ' Resort Bucks');
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

  const tryStudioLook = (category, option) => {
    setStudioTryLook({ ...look, [category]: option });
    setStudioMessage('Trying on ' + option.name + '.');
  };

  const buyStudioLook = (category, option) => {
    const key = category + ':' + option.id;
    if (ownedLooks.has(key)) {
      setLook((current) => ({ ...current, [category]: option }));
      setStudioTryLook(null);
      setStudioMessage(option.name + ' is already yours.');
      return;
    }
    if (bucks < option.price) {
      setStudioMessage('You need ' + option.price + ' Resort Bucks for ' + option.name + '.');
      return;
    }
    setBucks((value) => value - option.price);
    setOwnedLooks((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
    setLook((current) => ({ ...current, [category]: option }));
    setStudioTryLook(null);
    setStudioMessage(option.name + ' is yours!');
  };

  const renderCharacter = (large = false, displayLook = look) => (
    <div
      className={[styles.avatarFigure, large ? styles.avatarFigureLarge : ''].join(' ')}
      data-hair={displayLook.hair.id}
      data-gender={character.gender}
      data-sleeve={displayLook.shirt.sleeve || 'short'}
      data-leg={displayLook.bottoms.leg || 'straight'}
      style={{
        ...characterStyle,
        '--outfit-shirt': displayLook.shirt.swatch,
        '--outfit-bottoms': displayLook.bottoms.swatch,
      }}
      aria-label={characterName + ' preview'}
    >
      <div className={styles.avatarHair} />
      <span className={[styles.avatarEar, styles.avatarEarLeft].join(' ')} />
      <span className={[styles.avatarEar, styles.avatarEarRight].join(' ')} />
      <div className={styles.avatarHead}>
        <span className={[styles.avatarBrow, styles.avatarBrowLeft].join(' ')} />
        <span className={[styles.avatarBrow, styles.avatarBrowRight].join(' ')} />
        <span className={[styles.avatarEye, styles.avatarEyeLeft].join(' ')} />
        <span className={[styles.avatarEye, styles.avatarEyeRight].join(' ')} />
        <span className={styles.avatarNose} />
        <span className={styles.avatarSmile} />
      </div>
      <div className={styles.avatarHairFront} />
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
        <span className={styles.avatarThigh} style={{ background: displayLook.bottoms.swatch }} />
        <span className={styles.avatarKnee} style={{ background: displayLook.bottoms.leg === 'short' ? 'var(--character-skin)' : displayLook.bottoms.swatch }} />
        <span className={styles.avatarShin} style={{ background: displayLook.bottoms.leg === 'short' ? 'var(--character-skin)' : displayLook.bottoms.swatch }} />
        <span className={styles.avatarShoe} style={{ background: displayLook.shoes.swatch }} />
      </div>
      <div className={styles.avatarLegRigRight}>
        <span className={styles.avatarThigh} style={{ background: displayLook.bottoms.swatch }} />
        <span className={styles.avatarKnee} style={{ background: displayLook.bottoms.leg === 'short' ? 'var(--character-skin)' : displayLook.bottoms.swatch }} />
        <span className={styles.avatarShin} style={{ background: displayLook.bottoms.leg === 'short' ? 'var(--character-skin)' : displayLook.bottoms.swatch }} />
        <span className={styles.avatarShoe} style={{ background: displayLook.shoes.swatch }} />
      </div>
      {displayLook.accessory.id !== 'none' && (
        <div className={styles.avatarAccessory} aria-hidden="true">{displayLook.accessory.icon}</div>
      )}
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
        <button className={styles.studioChoiceCard} type="button" onClick={() => { setStudioMessage(''); setScreen('studio-work'); }}>
          <span className={styles.studioChoiceIcon}>🎨</span>
          <strong>Work Here</strong>
          <span>Make art or design fashion. Creativity is the job.</span>
        </button>
        <button className={styles.studioChoiceCard} type="button" onClick={() => { setStudioMessage(''); setStudioTryLook(null); setScreen('studio-shop'); }}>
          <span className={styles.studioChoiceIcon}>🛍️</span>
          <strong>Shop & Try On</strong>
          <span>Try clothes on, buy favorites, and wear them around the resort.</span>
        </button>
      </div>,
    );
  }

  if (screen === 'studio-work') {
    const fashionLook = {
      ...look,
      shirt: { ...look.shirt, name: 'My Design Top', swatch: fashionDraft.shirt, sleeve: fashionDraft.sleeve },
      bottoms: { ...look.bottoms, name: 'My Design Bottoms', swatch: fashionDraft.bottoms, leg: fashionDraft.leg },
    };
    return interiorShell(
      'Design Studio',
      '🎨',
      'CREATIVE WORK',
      <div className={styles.studioWorkLayout}>
        <section className={styles.studioWorkbench}>
          <div className={styles.studioToolTabs}>
            <button type="button" data-active={studioTool === 'art'} onClick={() => setStudioTool('art')}>🖌️ Art Studio</button>
            <button type="button" data-active={studioTool === 'fashion'} onClick={() => setStudioTool('fashion')}>✂️ Fashion Desk</button>
          </div>

          {studioTool === 'art' ? (
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
                <label>Color <input type="color" value={artColor} onChange={(event) => setArtColor(event.target.value)} /></label>
                <button type="button" onClick={clearArt}>Clear</button>
                <button type="button" onClick={() => makeStudioCreation('art')}>Finish Artwork +5</button>
              </div>
            </div>
          ) : (
            <div className={styles.fashionDesk}>
              <div className={styles.fashionPreview}>{renderCharacter(true, fashionLook)}</div>
              <div className={styles.fashionControls}>
                <label>Top color <input type="color" value={fashionDraft.shirt} onChange={(event) => setFashionDraft((draft) => ({ ...draft, shirt: event.target.value }))} /></label>
                <label>Bottom color <input type="color" value={fashionDraft.bottoms} onChange={(event) => setFashionDraft((draft) => ({ ...draft, bottoms: event.target.value }))} /></label>
                <label>Sleeves
                  <select value={fashionDraft.sleeve} onChange={(event) => setFashionDraft((draft) => ({ ...draft, sleeve: event.target.value }))}>
                    <option value="none">Tank</option>
                    <option value="short">Short</option>
                    <option value="puff">Puff</option>
                    <option value="long">Long</option>
                  </select>
                </label>
                <label>Pant legs
                  <select value={fashionDraft.leg} onChange={(event) => setFashionDraft((draft) => ({ ...draft, leg: event.target.value }))}>
                    <option value="straight">Straight</option>
                    <option value="short">Shorts</option>
                    <option value="wide">Wide</option>
                    <option value="flare">Flare</option>
                  </select>
                </label>
                <button type="button" onClick={() => makeStudioCreation('fashion')}>Finish Fashion Design +5</button>
              </div>
            </div>
          )}
        </section>
        <aside className={styles.studioCustomerCard}>
          <div className={styles.studioCustomerFace}>😊</div>
          <strong>Happy Customer</strong>
          <p>{studioMessage || 'Make whatever you want. Your customer is excited to see it.'}</p>
          <div className={styles.studioCreationCount}>{studioCreations} creations made</div>
          <button className={styles.secondaryButton} type="button" onClick={() => setScreen('studio')}>Studio Lobby</button>
        </aside>
      </div>,
    );
  }

  if (screen === 'studio-shop') {
    const previewLook = studioTryLook || look;
    const shopCategories = ['shirt', 'bottoms', 'shoes'];
    return interiorShell(
      'Design Studio',
      '🛍️',
      'CLOTHING SHOP',
      <div className={styles.studioLayout}>
        <section className={styles.characterStage}>
          {renderCharacter(true, previewLook)}
          <div className={styles.lookSummary}>
            <strong>{characterName}</strong>
            <span>{previewLook.shirt.name} - {previewLook.bottoms.name}</span>
            <span>{previewLook.shoes.name}</span>
          </div>
          {studioTryLook && <div className={styles.tryOnBadge}>TRYING ON</div>}
        </section>

        <section className={styles.customizer}>
          {shopCategories.map((category) => (
            <div key={category} className={styles.optionGroup}>
              <h3>{category === 'bottoms' ? 'Bottoms' : category.charAt(0).toUpperCase() + category.slice(1)}</h3>
              <div className={styles.studioShopGrid}>
                {LOOK_OPTIONS[category].map((option) => {
                  const key = category + ':' + option.id;
                  const owned = ownedLooks.has(key);
                  const worn = look[category].id === option.id;
                  return (
                    <div key={option.id} className={styles.studioShopItem} data-owned={owned ? 'true' : 'false'}>
                      <span className={styles.swatch} style={{ background: option.swatch }} />
                      <strong>{option.name}</strong>
                      <small>{owned ? 'Owned' : option.price + ' Resort Bucks'}</small>
                      <div>
                        <button type="button" onClick={() => tryStudioLook(category, option)}>Try On</button>
                        <button type="button" disabled={worn} onClick={() => buyStudioLook(category, option)}>
                          {worn ? 'Wearing' : owned ? 'Wear' : 'Buy'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className={styles.fullMessage} aria-live="polite">
            {studioMessage || 'Try anything on before you buy it.'}
          </div>
          <button className={styles.secondaryButton} type="button" onClick={() => { setStudioTryLook(null); setScreen('studio'); }}>Studio Lobby</button>
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
              <span>{look.accessory.name}</span>
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

          <div
            className={[styles.player, styles.playerDetailed, isWalking ? styles.playerWalking : ''].join(' ')}
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              '--player-depth-scale': (0.24 + position.y * 0.0043).toFixed(3),
              ...characterStyle,
              '--outfit-shirt': look.shirt.swatch,
              '--outfit-bottoms': look.bottoms.swatch,
            }}
            data-frame={walkFrame}
            data-shirt={look.shirt.id}
            data-bottoms={look.bottoms.id}
            data-sleeve={look.shirt.sleeve || 'short'}
            data-leg={look.bottoms.leg || 'straight'}
            data-hair={look.hair.id}
            data-gender={character.gender}
            data-facing={facing}
            data-view={isWalking ? walkView : 'front'}
            data-moving={isWalking ? 'true' : 'false'}
            aria-label={characterName}
          >
            <div className={styles.playerSprite} style={playerView === 'front' ? { transform: 'none' } : undefined}>
              <div className={[styles.playerHair, styles.playerHairDetail].join(' ')} style={playerView === 'front' ? { left: 7, top: 0, width: 48, height: 48, borderRadius: '50% 50% 45% 45%' } : undefined} />
              <span className={[styles.playerEar, styles.playerEarLeft].join(' ')} />
              <span className={[styles.playerEar, styles.playerEarRight].join(' ')} />
              <div className={[styles.playerHead, styles.playerHeadDetail].join(' ')} style={playerView === 'front' ? { left: 16, top: 9, width: 31, height: 35, borderRadius: '48% 48% 45% 45%' } : undefined}>
                <span className={[styles.playerBrow, styles.playerBrowLeft].join(' ')} />
                <span className={[styles.playerBrow, styles.playerBrowRight].join(' ')} />
                <span className={[styles.playerEye, styles.playerEyeLeft].join(' ')} />
                <span className={[styles.playerEye, styles.playerEyeRight].join(' ')} />
                <span className={styles.playerNose} />
                <span className={styles.playerSmile} />
              </div>
              <div className={styles.playerHairFront} />
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
                <span className={styles.playerThigh} style={{ background: look.bottoms.swatch }} />
                <span className={styles.playerKnee} style={{ background: look.bottoms.leg === 'short' ? 'var(--character-skin)' : look.bottoms.swatch }} />
                <span className={styles.playerShin} style={{ background: look.bottoms.leg === 'short' ? 'var(--character-skin)' : look.bottoms.swatch }} />
                <span className={styles.playerShoe} style={{ background: look.shoes.swatch }} />
              </div>
              <div className={styles.playerLegRigRight} style={playerView === 'front' ? { transform: isWalking && walkFrame >= 3 ? 'translateY(-4px)' : 'none', scale: isWalking && walkFrame >= 3 ? 1.05 : 0.95 } : undefined}>
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
            aria-label="Add another character"
            title="Add another character later"
            disabled
          >
            +
          </button>

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
