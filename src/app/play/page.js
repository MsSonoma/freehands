import Link from 'next/link';
import styles from './play.module.css';

export const metadata = {
  title: 'Game Library',
  description: 'A simple library of games from Ms. Sonoma.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

const GAMES = [
  {
    name: 'Kids Resort',
    href: '/play/kids-resort',
    status: 'Prototype',
    description: 'A safe pretend-grown-up world where kids can explore jobs, choices, money, and everyday adult roles.',
    icon: '🏨',
  },
];

export default function GameLibraryPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.siteLink} href="https://mssonoma.com">
          ← Ms. Sonoma
        </a>
        <h1>Game Library</h1>
        <p>Choose a game.</p>
      </header>

      <section className={styles.grid} aria-label="Games">
        {GAMES.map((game) => (
          <Link key={game.href} href={game.href} className={styles.card}>
            <div className={styles.icon} aria-hidden="true">{game.icon}</div>
            <div className={styles.cardBody}>
              <div className={styles.cardTopline}>
                <h2>{game.name}</h2>
                <span className={styles.status}>{game.status}</span>
              </div>
              <p>{game.description}</p>
              <span className={styles.playLabel}>Play →</span>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
