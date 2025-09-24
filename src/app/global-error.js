"use client";
// Global error boundary for the entire app tree.
export default function GlobalError({ error, reset }) {
  return (
    <html>
      <body style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' }}>
        <h2>App Error</h2>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#f3f4f6', padding: 12, borderRadius: 8, overflowX: 'auto' }}>
          {String(error?.message || error || 'Unknown error')}
        </pre>
        <button
          onClick={() => reset?.()}
          style={{ marginTop: 12, padding: '8px 12px', border: '1px solid #111', borderRadius: 8, background: '#111', color: '#fff' }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
