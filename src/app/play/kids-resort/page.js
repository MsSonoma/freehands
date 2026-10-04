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
    <main style={{ minHeight: '100vh', background: '#fff9ee', position: 'relative' }}>
      <Link
        href="/play"
        className="kids-resort-library-link"
      >
        ← Game Library
      </Link>
      <KidsResort />
      <style>{`
        .kids-resort-library-link {
          position: absolute;
          z-index: 80;
          top: 9px;
          left: 132px;
          display: inline-flex;
          min-height: 34px;
          align-items: center;
          color: #6a5f58;
          text-decoration: none;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        @media (max-width: 640px) {
          .kids-resort-library-link {
            top: 8px;
            left: 112px;
            min-height: 32px;
            font-size: 11px;
          }
        }
      `}</style>
    </main>
  );
}