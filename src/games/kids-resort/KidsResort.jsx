'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './KidsResort.module.css';

const PLACES = [
  {
    id: 'lobby',
    name: 'Resort Lobby',
    icon: '🏨',
    x: 50,
    y: 82,
    role: 'Guest',
    description: 'Your home base. Check your Resort Bucks, badges, and decide where to go next.',
  },
  {
    id: 'cafe',
    name: 'Sunshine Café',
    icon: '🥪',
    x: 18,
    y: 24,
    role: 'Café Manager',
    description: 'Read each guest order, choose the right item, and run a friendly lunch shift.',
    playable: true,
  },
  {
    id: 'bank',
    name: 'Resort Bank',
    icon: '🏦',
    x: 78,
    y: 23,
    role: 'Banker',
    description: 'Practice deposits, budgets, and saving with pretend Resort Bucks.',
  },
  {
    id: 'market',
    name: 'Market Street',
    icon: '🛒',
    x: 79,
    y: 62,
    role: 'Shop Manager',
    description: 'Stock shelves, price items, make change, and help pretend customers.',
  },
  {
    id: 'studio',
    name: 'Design Studio',
    icon: '🎨',
    x: 21,
    y: 63,
    role: 'Designer',
    description: 'Take a client brief and build posters, rooms, outfits, and signs.',
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function KidsResort() {
  const [placeId, setPlaceId] = useState('lobby');
  const [selectedPlaceId, setSelectedPlaceId] = useState('cafe');
  const [screen, setScreen] = useState('map');
  const [bucks, setBucks] = useState(20);
  const [badges, setBadges] = useState([]);
  const [position, setPosition] = useState({ x: 50, y: 82 });
  const [isWalking, setIsWalking] = useState(false);
  const [walkFrame, setWalkFrame] = useState(0);
  const walkTokenRef = useRef(0);

  const [orderIndex, setOrderIndex] = useState(0);
  const [cafeCorrect, setCafeCorrect] = useState(0);
  const [cafeMessage, setCafeMessage] = useState('');
  const [cafeFinished, setCafeFinished] = useState(false);

  const selectedPlace = useMemo(
    () => PLACES.find((place) => place.id === selectedPlaceId) ?? PLACES[0],
    [selectedPlaceId],
  );

  const currentPlace = useMemo(
    () => PLACES.find((place) => place.id === placeId) ?? PLACES[0],
    [placeId],
  );

  useEffect(() => {
    return () => {
      walkTokenRef.current += 1;
    };
  }, []);

  const travelTo = (nextPlace) => {
    if (!nextPlace || isWalking) return;

    setSelectedPlaceId(nextPlace.id);

    if (nextPlace.id === placeId) {
      return;
    }

    const token = walkTokenRef.current + 1;
    walkTokenRef.current = token;

    const start = position;
    const steps = 8;
    let step = 0;
    setIsWalking(true);

    const timer = window.setInterval(() => {
      if (walkTokenRef.current !== token) {
        window.clearInterval(timer);
        return;
      }

      step += 1;
      const progress = step / steps;
      setWalkFrame((step - 1) % 6);
      setPosition({
        x: clamp(start.x + (nextPlace.x - start.x) * progress, 4, 96),
        y: clamp(start.y + (nextPlace.y - start.y) * progress, 7, 91),
      });

      if (step >= steps) {
        window.clearInterval(timer);
        setPosition({ x: nextPlace.x, y: nextPlace.y });
        setPlaceId(nextPlace.id);
        setWalkFrame(0);
        setIsWalking(false);
      }
    }, 90);
  };

  const openCurrentPlace = () => {
    if (currentPlace.id === 'cafe') {
      setScreen('cafe');
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

  const currentOrder = CAFE_ORDERS[orderIndex];

  if (screen === 'cafe') {
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

  return (
    <main className={styles.gameShell}>
      <section className={styles.topBar}>
        <div>
          <div className={styles.brand}>Kids Resort</div>
          <div className={styles.tagline}>A grown-up world made just for kids.</div>
        </div>
        <div className={styles.profileStrip}>
          <div className={styles.wallet}>🪙 {bucks} Resort Bucks</div>
          <div className={styles.badgeCount}>⭐ {badges.length} badges</div>
        </div>
      </section>

      <section className={styles.introCard}>
        <div>
          <div className={styles.eyebrow}>WELCOME, EMILY</div>
          <h1>Today, you run the resort.</h1>
          <p>
            Try grown-up jobs, make choices, earn pretend money, and explore. Everything here is make-believe,
            so you can experiment without real-world stakes.
          </p>
        </div>
        <div className={styles.emilyPortrait} aria-label="Emily character placeholder">
          <div className={styles.emilyHair} />
          <div className={styles.emilyFace}>
            <span className={styles.eye} />
            <span className={styles.eye} />
            <span className={styles.smile} />
          </div>
          <div className={styles.emilyShirt}>EMILY</div>
        </div>
      </section>

      <section className={styles.playArea}>
        <div className={styles.mapPanel}>
          <div className={styles.mapSky}>
            <div className={styles.sun} />
            <div className={styles.cloudOne} />
            <div className={styles.cloudTwo} />
          </div>
          <div className={styles.pathLoop} />

          {PLACES.map((place) => (
            <button
              key={place.id}
              type="button"
              className={[
                styles.place,
                selectedPlaceId === place.id ? styles.placeSelected : '',
                place.id === placeId ? styles.placeCurrent : '',
              ].join(' ')}
              style={{ left: `${place.x}%`, top: `${place.y}%` }}
              onClick={() => travelTo(place)}
            >
              <span className={styles.placeIcon}>{place.icon}</span>
              <span>{place.name}</span>
            </button>
          ))}

          <div
            className={[styles.player, isWalking ? styles.playerWalking : ''].join(' ')}
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
            data-frame={walkFrame}
            aria-label="Emily"
          >
            <div className={styles.playerHair} />
            <div className={styles.playerHead} />
            <div className={styles.playerBody} />
            <div className={styles.playerLegLeft} />
            <div className={styles.playerLegRight} />
            <div className={styles.playerName}>Emily</div>
          </div>
        </div>

        <aside className={styles.placePanel}>
          <div className={styles.placeHeroIcon}>{selectedPlace.icon}</div>
          <div className={styles.eyebrow}>{selectedPlace.role}</div>
          <h2>{selectedPlace.name}</h2>
          <p>{selectedPlace.description}</p>

          {selectedPlace.id === placeId ? (
            selectedPlace.playable ? (
              <button className={styles.primaryButton} type="button" onClick={openCurrentPlace}>
                Start My Shift
              </button>
            ) : selectedPlace.id === 'lobby' ? (
              <div className={styles.softNote}>Pick a destination on the map to start exploring.</div>
            ) : (
              <div className={styles.softNote}>This destination is ready for a future Kids Resort activity.</div>
            )
          ) : (
            <button
              className={styles.primaryButton}
              type="button"
              disabled={isWalking}
              onClick={() => travelTo(selectedPlace)}
            >
              {isWalking ? 'Walking…' : `Walk to ${selectedPlace.name}`}
            </button>
          )}

          <div className={styles.placeStatus}>
            <span>Current location</span>
            <strong>{currentPlace.name}</strong>
          </div>
        </aside>
      </section>
    </main>
  );
}
