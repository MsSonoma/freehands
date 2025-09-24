export const dynamic = 'force-dynamic';
export default function Page() {
  const rows = [
    { name: 'Stripe', purpose: 'Payments', region: 'US/EU' },
    { name: 'Supabase', purpose: 'Auth / DB / Storage', region: 'US/EU' },
    { name: 'Vercel', purpose: 'Hosting / CDN', region: 'Global' },
  ];
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <h1>Subprocessors</h1>
      <ul>
        {rows.map(r => <li key={r.name}><strong>{r.name}</strong>: {r.purpose} — {r.region}</li>)}
      </ul>
      <p>We update this list as our vendors change.</p>
    </main>
  );
}
