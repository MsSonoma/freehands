import Link from 'next/link';
import { KidsResort } from '@/games/kids-resort';

export const metadata = {
  title: 'Kids Resort',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function KidsResortPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#fff9ee' }}>
      <div
        style={{
          padding: '10px 14px 0',
          background: '#fff9ee',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <Link
          href="/play"
          style={{
            display: 'inline-flex',
            minHeight: 40,
            alignItems: 'center',
            color: '#6a5f58',
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          ← Game Library
        </Link>
      </div>
      <KidsResort />
    </main>
  );
}
