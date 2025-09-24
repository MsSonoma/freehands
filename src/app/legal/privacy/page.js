export const dynamic = 'force-dynamic';
export default function Page() {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <h1>Privacy Policy</h1>
      <p>Ms. Sonoma (&quot;we&quot;). Contact: outreach@mssonoma.com</p>
      <h2>Data We Collect</h2>
      <ul>
        <li>Account and authentication data</li>
        <li>Payment tokens via Stripe (we do not store card numbers)</li>
        <li>Logs and basic analytics (none enabled currently)</li>
        <li>Learner content and progress</li>
      </ul>
      <h2>Use, Sharing, Retention</h2>
      <p>We use data to operate the service. Subprocessors: Stripe (payments), Supabase (auth/db/storage), Vercel (hosting/CDN). Retention: account life + 12 months; logs 90 days; backups 30 days.</p>
      <h2>Children’s Privacy</h2>
      <p>For learners as young as 4: accounts are managed by a parent/facilitator. We do not allow children to create accounts. Parents may request access or deletion via outreach@mssonoma.com.</p>
      <h2>Security</h2>
      <p>Encryption in transit/at rest; role‑based access; least privilege; incident response via outreach@mssonoma.com.</p>
      <h2>International Transfers</h2>
      <p>We use SCCs/DPA for EU/UK users where applicable.</p>
      <h2>Your Rights</h2>
      <p>Contact outreach@mssonoma.com for access, correction, deletion, or export requests.</p>
    </main>
  );
}
