export const dynamic = 'force-dynamic';
export default function Page() {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <h1>Terms of Service</h1>
      <p>Company: Ms. Sonoma, 1146 Honor Drive, Holiday, Florida, USA.</p>
      <p>Contact: outreach@mssonoma.com</p>
      <h2>Use of Service</h2>
      <p>Accounts must be created by adults. Learner accounts are managed by a parent or facilitator; children (as young as 4) do not sign up directly.</p>
      <h2>Plans and Limits</h2>
      <ul>
        <li>Free: limited usage; 1 learner; 1 device</li>
        <li>Free Trial: limited; includes up to 5 lifetime AI lesson generations</li>
        <li>Standard ($49/mo): up to 2 learners; lesson generation; advanced in-session features</li>
        <li>Pro ($69/mo): up to 5 learners; includes Mr. Mentor and Lesson Planner features</li>
        <li>Lifetime (legacy): grandfathered plan for existing customers (if applicable)</li>
      </ul>
      <h2>Billing and Cancellation</h2>
      <p>Monthly billing via Stripe. Upgrades are instant and cannot be canceled until the next period. Cancellations take effect at period end; no proration on cancel.</p>
      <h2>Acceptable Use</h2>
      <p>No abuse, scraping, or attempts to bypass device limits.</p>
      <h2>IP, Warranty, Liability</h2>
      <p>Provided &quot;AS IS&quot; without warranties; liability limited to amounts paid in the last 12 months.</p>
      <h2>Governing Law</h2>
      <p>Florida law; exclusive venue in Pasco County, Florida courts.</p>
      <h2>Changes</h2>
      <p>We may update these Terms; we&rsquo;ll post the updated date and material changes in‑app.</p>
    </main>
  );
}
