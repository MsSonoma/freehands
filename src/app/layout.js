import HeaderBar from './HeaderBar';
import CookieBanner from '@/components/CookieBanner';

// Expose richer metadata so Next.js will emit proper <link rel="icon" ...> tags.
// We keep the existing favicon.ico (for legacy browsers) and add the branded png.
export const metadata = {
  title: 'Ms. Sonoma',
  description: 'Guided learning with a caring Facilitator.',
  icons: {
    icon: [
      // Put branded PNG first so most browsers prefer it for the tab icon.
      { url: '/ms-sonoma.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon.ico', sizes: 'any' } // fallback / legacy
    ],
    shortcut: [
      { url: '/ms-sonoma.png', type: 'image/png' }
    ],
    apple: [
      { url: '/ms-sonoma.png', type: 'image/png', sizes: '180x180' }
    ]
  }
}

/** @param {{ children: React.ReactNode }} props */
export default function RootLayout({ children }) {
  return (
    <html lang="en">
  <body style={{ margin:0, fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif', overflowY:'auto', scrollbarGutter:'stable' }}>
        <HeaderBar />

        {/* Page content with minimal top padding; header is sticky and occupies its own height */}
        <div
          style={{
            paddingTop: 4,
            maxWidth: 1200,
            margin: '0 auto',
            paddingLeft: 0,
            paddingRight: 0
          }}
        >
          {children}
        </div>
        <CookieBanner />
      </body>
    </html>
  )
}
