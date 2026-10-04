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

const CAFE_ORDERS = [
  {
    guest: 'Maya',
    request: 'I would like something cold and fruity to drink.',
    answer: 'Berry Juice',
    choices: ['Berry Juice', 'Grilled Cheese', 'Apple Slices'],
  },
  {
    guest: 'Noah',
    request: 'Could I have a warm sandwich with cheese?',
    answer: 'Grilled Cheese',
    choices: ['Apple Slices', 'Berry Juice', 'Grilled Cheese'],
  },
  {
    guest: 'Avery',
    request: 'I want a crunchy fruit snack, please.',
    answer: 'Apple Slices',
    choices: ['Grilled Cheese', 'Apple Slices', 'Berry Juice'],
  },
];

const LOBBY_MENU = [
  { id: 'pasta', name: 'Garden Pasta', icon: '\u{1F35D}', price: 7 },
  { id: 'tacos', name: 'Resort Tacos', icon: '\u{1F32E}', price: 6 },
  { id: 'dessert', name: 'Berry Sundae', icon: '\u{1F368}', price: 5 },
];

const CAFE_MENU = [
  { id: 'toastie', name: 'Grilled Cheese', icon: '\u{1F96A}', price: 4 },
  { id: 'juice', name: 'Berry Juice', icon: '\u{1F9C3}', price: 3 },
  { id: 'apple-snack', name: 'Apple Slices', icon: '\u{1F34E}', price: 3 },
];

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
    { id: 'pink', name: 'Pink Tee', swatch: '#ff4f9a' },
    { id: 'sunshine', name: 'Sunshine Top', swatch: '#f1be38' },
    { id: 'ocean', name: 'Ocean Tee', swatch: '#43aee5' },
    { id: 'mint', name: 'Mint Top', swatch: '#54c79c' },
  ],
  bottoms: [
    { id: 'denim', name: 'Cuffed Jeans', swatch: '#3b78ba' },
    { id: 'navy', name: 'Navy Shorts', swatch: '#334d78' },
    { id: 'lavender', name: 'Lavender Skirt', swatch: '#9a73c9' },
    { id: 'coral', name: 'Coral Pants', swatch: '#dc6b63' },
  ],
  shoes: [
    { id: 'pink-sneakers', name: 'Pink Sneakers', swatch: '#f05d9b' },
    { id: 'white-trainers', name: 'White Trainers', swatch: '#f4f4f0' },
    { id: 'yellow-high-tops', name: 'Yellow High-Tops', swatch: '#efc33f' },
    { id: 'blue-slip-ons', name: 'Blue Slip-Ons', swatch: '#448fcc' },
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

export default function KidsResort() {
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

  const [orderIndex, setOrderIndex] = useState(0);
  const [cafeCorrect, setCafeCorrect] = useState(0);
  const [cafeMessage, setCafeMessage] = useState('');
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
      openScreen('cafe-work');
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
    if (nextScreen === 'cafe-work') {
      setOrderIndex(0);
      setCafeCorrect(0);
      setCafeMessage('');
      setCafeFinished(false);
    }
  };

  const answerCafeOrder = (choice) => {
    if (cafeFinished) return;

    const order = CAFE_ORDERS[orderIndex];
    if (!order) return;

    if (choice !== order.answer) {
      setCafeMessage('Not that one. Read the guest request again and try another choice.');
      return;
    }

    const nextCorrect = cafeCorrect + 1;
    const nextIndex = orderIndex + 1;
    setCafeCorrect(nextCorrect);
    setCafeMessage(`Nice work. ${order.guest}'s order is ready!`);

    if (nextIndex >= CAFE_ORDERS.length) {
      setCafeFinished(true);
      setBucks((value) => value + 12);
      setBadges((items) => (items.includes('Café Shift') ? items : [...items, 'Café Shift']));
      return;
    }

    window.setTimeout(() => {
      setOrderIndex(nextIndex);
      setCafeMessage('');
    }, 650);
  };

  const buyMeal = (meal) => {
    if (bucks < meal.price) {
      setMessage(`You need ${meal.price} Resort Bucks for ${meal.name}.`);
      return;
    }
    setBucks((value) => value - meal.price);
    setMeals((items) => [...items, meal.name]);
    setMessage(`${characterName} enjoyed ${meal.name}.`);
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

  const renderCharacter = (large = false) => (
    <div
      className={[styles.avatarFigure, large ? styles.avatarFigureLarge : ''].join(' ')}
      data-hair={look.hair.id}
      data-gender={character.gender}
      style={characterStyle}
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
      <div className={styles.avatarBody} style={{ background: look.shirt.swatch }} />
      <div className={styles.avatarPelvis} style={{ background: look.bottoms.swatch }} />

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
        <span className={styles.avatarThigh} style={{ background: look.bottoms.swatch }} />
        <span className={styles.avatarKnee} style={{ background: look.bottoms.swatch }} />
        <span className={styles.avatarShin} style={{ background: look.bottoms.swatch }} />
        <span className={styles.avatarShoe} style={{ background: look.shoes.swatch }} />
      </div>
      <div className={styles.avatarLegRigRight}>
        <span className={styles.avatarThigh} style={{ background: look.bottoms.swatch }} />
        <span className={styles.avatarKnee} style={{ background: look.bottoms.swatch }} />
        <span className={styles.avatarShin} style={{ background: look.bottoms.swatch }} />
        <span className={styles.avatarShoe} style={{ background: look.shoes.swatch }} />
      </div>
      {look.accessory.id !== 'none' && (
        <div className={styles.avatarAccessory} aria-hidden="true">{look.accessory.icon}</div>
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

  const currentOrder = CAFE_ORDERS[orderIndex];
  const playerView = isWalking ? walkView : 'front';

  if (screen === 'cafe-work') {
    return (
      <main className={styles.gameShell}>
        <section className={styles.topBar}>
          <button className={styles.backButton} type="button" onClick={() => setScreen('map')}>
            ← Resort Map
          </button>
          <div className={styles.brand}>Kids Resort</div>
          <div className={styles.wallet}>🪙 {bucks} Resort Bucks</div>
        </section>

        <section className={styles.cafeScene}>
          <div className={styles.cafeSign}>
            <span>🥪</span>
            <div>
              <div className={styles.eyebrow}>YOUR SHIFT</div>
              <h1>Sunshine Café</h1>
              <p>You are the café manager. Listen carefully, make the order, and keep the line moving.</p>
            </div>
          </div>

          {!cafeFinished && currentOrder ? (
            <div className={styles.orderBoard}>
              <div className={styles.guestCard}>
                <div className={styles.guestAvatar}>{currentOrder.guest.slice(0, 1)}</div>
                <div>
                  <div className={styles.guestName}>{currentOrder.guest}</div>
                  <p>“{currentOrder.request}”</p>
                </div>
              </div>

              <div className={styles.orderChoices}>
                {currentOrder.choices.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    className={styles.foodButton}
                    onClick={() => answerCafeOrder(choice)}
                  >
                    <span aria-hidden>{choice === 'Berry Juice' ? '🧃' : choice === 'Grilled Cheese' ? '🥪' : '🍎'}</span>
                    {choice}
                  </button>
                ))}
              </div>

              <div className={styles.shiftFooter}>
                <div>Orders ready: {cafeCorrect} / {CAFE_ORDERS.length}</div>
                <div className={styles.feedback}>{cafeMessage || 'Choose the item that matches the request.'}</div>
              </div>
            </div>
          ) : (
            <div className={styles.shiftComplete}>
              <div className={styles.bigBadge}>⭐</div>
              <div className={styles.eyebrow}>SHIFT COMPLETE</div>
              <h2>You ran the café!</h2>
              <p>You earned 12 Resort Bucks and the Café Shift badge.</p>
              <button className={styles.primaryButton} type="button" onClick={() => setScreen('map')}>
                Back to the Resort
              </button>
            </div>
          )}
        </section>
      </main>
    );
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
      `DESIGN ${characterName.toUpperCase()}`,
      <div className={styles.studioLayout}>
        <section className={styles.characterStage}>
          {renderCharacter(true)}
          <div className={styles.lookSummary}>
            <strong>{characterName}</strong>
            <span>{look.shirt.name} - {look.bottoms.name}</span>
            <span>{look.shoes.name} - {look.accessory.name}</span>
          </div>
        </section>

        <section className={styles.customizer}>
          {Object.entries(LOOK_OPTIONS).map(([category, options]) => (
            <div key={category} className={styles.optionGroup}>
              <h3>{category === 'bottoms' ? 'Bottoms' : category.charAt(0).toUpperCase() + category.slice(1)}</h3>
              <div className={styles.optionRow}>
                {options.map((option) => {
                  const selected = look[category].id === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={styles.lookOption}
                      data-selected={selected ? 'true' : 'false'}
                      onClick={() => chooseLook(category, option)}
                    >
                      {'swatch' in option ? (
                        <span className={styles.swatch} style={{ background: option.swatch }} />
                      ) : (
                        <span className={styles.optionIcon}>{option.icon}</span>
                      )}
                      <span>{option.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className={styles.fullMessage} aria-live="polite">
            {message || `Try combinations. You can change ${characterName} whenever you want.`}
          </div>
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
            }}
            data-frame={walkFrame}
            data-shirt={look.shirt.id}
            data-bottoms={look.bottoms.id}
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
                <span className={styles.playerKnee} style={{ background: look.bottoms.swatch }} />
                <span className={styles.playerShin} style={{ background: look.bottoms.swatch }} />
                <span className={styles.playerShoe} style={{ background: look.shoes.swatch }} />
              </div>
              <div className={styles.playerLegRigRight} style={playerView === 'front' ? { transform: isWalking && walkFrame >= 3 ? 'translateY(-4px)' : 'none', scale: isWalking && walkFrame >= 3 ? 1.05 : 0.95 } : undefined}>
                <span className={styles.playerThigh} style={{ background: look.bottoms.swatch }} />
                <span className={styles.playerKnee} style={{ background: look.bottoms.swatch }} />
                <span className={styles.playerShin} style={{ background: look.bottoms.swatch }} />
                <span className={styles.playerShoe} style={{ background: look.shoes.swatch }} />
              </div>
            </div>
            <div className={[styles.playerName, styles.playerNameDetail].join(' ')}>{characterName}</div>
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
