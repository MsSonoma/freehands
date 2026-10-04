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
      <KidsResort libraryHref="/play" />
    </main>
  );
}