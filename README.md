This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Lessons utilities

- Rebalance multiple-choice correct answers across lesson JSONs to avoid bias towards a specific letter:

	PowerShell:

	```powershell
	npm run lessons:balance-mc
	```

	This will reorder choices and update the `expected` letter per question while preserving content.

## Ms. Sonoma LLM provider and prompt mode

You can switch providers and prompt verbosity without code changes using environment variables (see `.env.local`):

- SONOMA_PROVIDER=anthropic | openai (default auto-chooses `anthropic` if ANTHROPIC_API_KEY is set)
- SONOMA_MODEL=claude-4.1-opus (Preview) or any Anthropic model id
- ANTHROPIC_MODEL=claude-3.5-sonnet (fallback)
- SONOMA_OPENAI_MODEL=gpt-4o (fallback when provider=openai)
- SONOMA_PROMPT_MODE=compact | full (compact reduces tokens; full is more verbose)

Revert strategy:
- Set SONOMA_PROVIDER=openai to force OpenAI
- Unset SONOMA_PROMPT_MODE or set to `full` to restore the original, longer prompt
- Remove ANTHROPIC_API_KEY to disable Anthropic entirely
