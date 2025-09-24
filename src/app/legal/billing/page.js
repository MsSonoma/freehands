export const dynamic = 'force-dynamic';
export default function Page() {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <h1>Subscription & Billing Terms</h1>
      <ul>
        <li>Monthly billing via Stripe (USD). Regional taxes may apply.</li>
        <li>Upgrades: instant; cannot be canceled until the next period; next period begins on your normal cycle date.</li>
        <li>Cancellations: take effect at period end; no proration.</li>
        <li>Apple Pay/Google Pay supported.</li>
      </ul>
    </main>
  );
}
