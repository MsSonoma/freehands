'use client'
import { useAccessControl } from '@/app/hooks/useAccessControl'
import GatedOverlay from '@/app/components/GatedOverlay'
import ClientManage from './ClientManage.jsx';

export default function ManagePage() {
  const { loading: authLoading, isAuthenticated, gateType } = useAccessControl({ requiredAuth: true })

  if (authLoading) {
    return <main style={{ padding: 24 }}><p>Loading…</p></main>
  }

  return (
    <>
    <main style={{ padding: 24, display:'flex', justifyContent:'center', opacity: !isAuthenticated ? 0.5 : 1, pointerEvents: !isAuthenticated ? 'none' : 'auto' }}>
      <div style={{ width: '100%', maxWidth: 960 }}>
        <ClientManage />
      </div>
    </main>
    
    <GatedOverlay
      show={!isAuthenticated}
      gateType={gateType}
      feature="Subscription Management"
      emoji="⚙️"
      description="Sign in to manage your subscription, update payment methods, and view billing history."
      benefits={[
        'Update your payment method and billing information',
        'View your subscription status and next billing date',
        'Download invoices and payment receipts',
        'Cancel or modify your subscription'
      ]}
    />
    </>
  );
}
