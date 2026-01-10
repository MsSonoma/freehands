# Homepage

**Status:** Canonical
**Created:** 2026-01-10
**Purpose:** Define what the landing page communicates and which outbound links it must include.

## How It Works

The homepage is the app landing page at `/`.

It uses a centered hero layout with:
- Ms. Sonoma hero image
- Primary CTAs: Learn, Facilitator
- Supporting links:
  - About page (AI safety/How it works)
  - External site link to learn more about Ms. Sonoma

### External Website Link

The homepage includes an external link to `https://mssonoma.com` with copy that explicitly tells users to learn about Ms. Sonoma there.

## What NOT To Do

- Do not remove the external `mssonoma.com` link without replacing it with an equivalent learn-more path.
- Do not add device- or storage-related claims to homepage copy.
- Do not add placeholder or environment-specific URLs.

## Key Files

- `src/app/page.js`
- `src/app/home-hero.module.css`
