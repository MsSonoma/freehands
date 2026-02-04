# Vercel Environment Variables Checklist

Set these in Vercel → Project → Settings → Environment Variables.
Add to both Preview and Production unless noted. Mark NEXT_PUBLIC_* as "Public".

Required (Supabase)
- NEXT_PUBLIC_SUPABASE_URL (Public)
- NEXT_PUBLIC_SUPABASE_ANON_KEY (Public)
- SUPABASE_SERVICE_ROLE_KEY

Required (Stripe)
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (Public)
- STRIPE_SECRET_KEY
- STRIPE_PRICE_STANDARD
- STRIPE_PRICE_PRO
- STRIPE_WEBHOOK_SECRET (after creating webhook)

AI Provider (choose one)
- SONOMA_PROVIDER = openai | anthropic
- If OpenAI:
  - OPENAI_API_KEY
  - (optional) SONOMA_OPENAI_MODEL or OPENAI_MODEL
- If Anthropic:
  - ANTHROPIC_API_KEY
  - (optional) ANTHROPIC_MODEL, ANTHROPIC_MODEL_FALLBACK, ANTHROPIC_VERSION

Google TTS
- Prefer GOOGLE_TTS_CREDENTIALS with full JSON content
- (Optional fallback) GOOGLE_APPLICATION_CREDENTIALS = google-tts-key.json

App
- APP_URL = https://your-domain

Admin endpoints (optional)
- ADMIN_API_ENABLED = false
- ADMIN_API_TOKEN (only if enabling admin endpoints)

Notes
- NEXT_PUBLIC_* are browser-exposed by design.
- Keep secrets out of git; use Vercel vars.
- After variables are set, trigger a redeploy.
