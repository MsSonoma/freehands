"use client";
// Route-level error boundary for the App Router.
// This must be a Client Component and should NOT include <html>/<body>.
export default function Error({ error, reset }) {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' }}>
      <h2>Something went wrong</h2>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#f3f4f6', padding: 12, borderRadius: 8, overflowX: 'auto' }}>
        {String(error?.message || error || 'Unknown error')}
      </pre>
      <button
        onClick={() => reset?.()}
        style={{ marginTop: 12, padding: '8px 12px', border: '1px solid #111', borderRadius: 8, background: '#111', color: '#fff' }}
      >
        Try again
      </button>
    </div>
  );
}
