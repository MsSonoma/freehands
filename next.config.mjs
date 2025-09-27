/** @type {import('next').NextConfig} */
const nextConfig = {
  // Intentionally minimal config; rely on Next.js defaults for dev/prod.
  async headers() {
    // Relax CSP specifically for billing routes to support Stripe Elements/iframes/fonts.
    // Note: If another CSP is set upstream (proxy/CDN), the most restrictive policy applies.
    const isDev = process.env.NODE_ENV !== 'production';
    // Supabase origin (if configured)
    let supabaseOrigin = null;
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (url) {
        supabaseOrigin = new URL(url).origin;
      }
    } catch {}

    // Base policy shared by dev/prod
    let base = [
      "default-src 'self'",
      // Stripe JS and iframes. Allow inline scripts on billing routes in prod to support Next inline bootstrapping and Stripe embeds.
      "script-src 'self' 'unsafe-inline' https://js.stripe.com",
      // Stripe embeds/iframes
      "frame-src https://js.stripe.com https://hooks.stripe.com https://*.stripe.com https://m.stripe.network",
      // API calls to Stripe and Supabase (add m.stripe.network used by telemetry)
      // connect-src is assembled below to include dev ws/wss and Supabase origins
      // Images and styles used by Stripe iframes
      "img-src 'self' data: https://*.stripe.com",
      // Include Google Fonts CSS for any fonts used by the app or Stripe iframes
      "style-src 'self' 'unsafe-inline' https://*.stripe.com https://fonts.googleapis.com",
  // Allow data:/blob: fonts and Stripe/Google-hosted fonts inside iframes
  "font-src 'self' data: blob: https://*.stripe.com https://m.stripe.network https://fonts.gstatic.com",
      // Sensible hardening
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ];

    // Build connect-src allowing Stripe + Supabase
    const connectSrc = [
      "'self'",
      'https://api.stripe.com',
      'https://r.stripe.com',
      'https://m.stripe.network',
      'https://*.supabase.co',
      'https://*.supabase.in'
    ];
    if (supabaseOrigin) connectSrc.push(supabaseOrigin);

    if (isDev) {
      // Replace script-src with a dev-friendly variant allowing inline and eval
      base = base.map(d => d.startsWith('script-src ')
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com"
        : d
      );
      // Allow websockets in dev (Next HMR and any realtime)
      connectSrc.unshift('ws:', 'wss:');
    }

  // Permit workers from blob in all envs for Stripe internals (add once)
  if (!base.some(d => d.startsWith('worker-src '))) {
    base.push("worker-src 'self' blob:");
  }

  // Finally add the assembled connect-src
  base.push(`connect-src ${connectSrc.join(' ')}`);

  const csp = base.join('; ');

    return [
      {
        source: '/billing/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp }
        ]
      }
    ];
  }
};

export default nextConfig;
