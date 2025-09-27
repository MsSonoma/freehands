#!/usr/bin/env node
import fetch from 'node-fetch';

const url = process.argv[2] || 'http://localhost:3001/billing/element/checkout';

try {
  const resp = await fetch(url, { headers: { 'User-Agent': 'CSP-Probe' } });
  const csp = resp.headers.get('content-security-policy');
  if (!csp) {
    console.log('NO_CSP_HEADER');
    process.exit(2);
  }
  console.log(csp);
  // Quick checks for visibility
  const hasSupabase = /connect-src[^;]*supabase\.(co|in)/.test(csp);
  const hasBlobFont = /font-src[^;]*blob:/.test(csp);
  if (!hasSupabase) {
    console.error('WARN: connect-src missing supabase.* domain');
  }
  if (!hasBlobFont) {
    console.error('WARN: font-src missing blob:');
  }
} catch (e) {
  console.error('ERROR fetching URL:', e.message || e);
  process.exit(1);
}
