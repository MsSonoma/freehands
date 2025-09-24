import { Suspense } from 'react';
import ClientEmbeddedCheckout from './ClientEmbeddedCheckout.jsx';

export const dynamic = 'force-dynamic';

export default function EmbeddedCheckoutPage() {
  return (
    <Suspense fallback={
      <main style={{ padding: '0 24px 0', marginTop: 12 }}>
        <div style={{ width: '100%', maxWidth: 960, margin: '0 auto' }}>
          <h1 style={{ marginTop: 0, marginBottom: 8 }}>Loading checkout…</h1>
          <p style={{ color: '#666', marginTop: 0, marginBottom: 16 }}>Please wait a moment.</p>
        </div>
      </main>
    }>
      <ClientEmbeddedCheckout />
    </Suspense>
  );
}
