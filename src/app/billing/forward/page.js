import { Suspense } from 'react';
import ClientForward from './ClientForward.jsx';

export const dynamic = 'force-dynamic';

export default function BillingForwardPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ marginTop: 0, marginBottom: 8 }}>Preparing redirect…</h1>
          <p style={{ color: '#666', marginTop: 0 }}>Please wait a moment.</p>
        </div>
      </main>
    }>
      <ClientForward />
    </Suspense>
  );
}
