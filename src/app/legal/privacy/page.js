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
        <li>Saved facilitator Help conversations and related learner context used for continuity</li>
      </ul>

      <h2>How We Use and Share Data</h2>
      <p>
        We use data to operate Ms. Sonoma, provide learning and conversation continuity,
        secure the service, and support requested features. Service providers used to
        operate Ms. Sonoma include Stripe for payments, Supabase for authentication,
        database and storage, Vercel for hosting, OpenAI for AI response processing,
        and Google Cloud for speech processing. Saved Help memory is scoped by the
        application to the authenticated facilitator account and is not exposed to other
        customer accounts.
      </p>

      <h2>Retention</h2>
      <p>
        Retention: account life + 12 months; logs 90 days; backups 30 days. Saved Help
        conversations can be deleted from the conversation library. Account-level access,
        correction, deletion, or export requests may be sent to outreach@mssonoma.com.
      </p>

      <h2>Children&apos;s Privacy</h2>
      <p>
        For learners as young as 4, accounts are managed by a parent/facilitator. We do
        not allow children to create accounts. Parents or facilitators may request access
        or deletion via outreach@mssonoma.com.
      </p>

      <h2>Security</h2>
      <p>
        Encryption in transit/at rest; role-based access; least privilege; incident response
        via outreach@mssonoma.com.
      </p>

      <h2>International Transfers</h2>
      <p>We use SCCs/DPA for EU/UK users where applicable.</p>

      <h2>Your Rights</h2>
      <p>Contact outreach@mssonoma.com for access, correction, deletion, or export requests.</p>
    </main>
  );
}
