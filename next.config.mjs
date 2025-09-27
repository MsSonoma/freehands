/** @type {import('next').NextConfig} */
const nextConfig = {
  // Intentionally minimal config; rely on Next.js defaults for dev/prod.
  async headers() {
    // Relax CSP specifically for billing routes to support Stripe Elements/iframes/fonts.
    // Note: If another CSP is set upstream (proxy/CDN), the most restrictive policy applies.
    const isDev = process.env.NODE_ENV !== 'production';

    // Base policy shared by dev/prod
    let base = [
      "default-src 'self'",
      // Stripe JS and iframes. Allow inline scripts on billing routes in prod to support Next inline bootstrapping and Stripe embeds.
      "script-src 'self' 'unsafe-inline' https://js.stripe.com",
      // Stripe embeds/iframes
      "frame-src https://js.stripe.com https://hooks.stripe.com https://*.stripe.com https://m.stripe.network",
      // API calls to Stripe (add m.stripe.network used by telemetry)
      "connect-src 'self' https://api.stripe.com https://r.stripe.com https://m.stripe.network",
      // Images and styles used by Stripe iframes
      "img-src 'self' data: https://*.stripe.com",
      // Include Google Fonts CSS for any fonts used by the app or Stripe iframes
      "style-src 'self' 'unsafe-inline' https://*.stripe.com https://fonts.googleapis.com",
      // Allow data: fonts and Stripe/Google-hosted fonts inside iframes
      "font-src 'self' data: https://*.stripe.com https://m.stripe.network https://fonts.gstatic.com",
      // Sensible hardening
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ];

    if (isDev) {
      // Replace script-src with a dev-friendly variant allowing inline and eval
      base = base.map(d => d.startsWith('script-src ')
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com"
        : d
      ).map(d => d.startsWith('connect-src ')
        ? "connect-src 'self' ws: wss: https://api.stripe.com https://r.stripe.com"
        : d
      );
      // Permit workers from blob in dev
      base.push("worker-src 'self' blob:");
    }

  // Permit workers from blob in all envs for Stripe internals
  base.push("worker-src 'self' blob:");

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
