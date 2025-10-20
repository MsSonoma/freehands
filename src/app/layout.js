import HeaderBar from './HeaderBar';
import CookieBanner from '@/components/CookieBanner';
import FacilitatorSectionTracker from '@/components/FacilitatorSectionTracker';

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
        <FacilitatorSectionTracker />

        {/* Page content with minimal top padding; header is sticky and occupies its own height.
            Remove global maxWidth so routes can opt-in to width caps themselves (e.g., Home).
            This enables full-bleed width for `/session` video/captions. */}
        <div
          style={{
            paddingTop: 4,
            width: '100%',
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
