import HeaderBar from './HeaderBar';
import CookieBanner from '@/components/CookieBanner';

export const metadata = {
  title: 'Ms. Sonoma',
  description: 'Guided learning with a caring Facilitator.',
}

/** @param {{ children: React.ReactNode }} props */
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin:0, fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' }}>
        <HeaderBar />

        {/* Page content with minimal top padding; header is sticky and occupies its own height */}
        <div
          style={{
            paddingTop: 4,
            maxWidth: 1200,
            margin: '0 auto',
            paddingLeft: 16,
            paddingRight: 16,
            overflowX: 'hidden'
          }}
        >
          {children}
        </div>
        <CookieBanner />
      </body>
    </html>
  )
}
