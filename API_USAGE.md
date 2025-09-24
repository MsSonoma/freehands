# Ms. Sonoma API Usage & Integration

## Macro Objective
- All session logic and personality for Ms. Sonoma is driven by a single, continuous OpenAI API call.
- The API call uses only instructions and innertext to control Ms. Sonoma.
- No hardcoded personality or logic in JS; all responses come from the API.

## Backend API Route
- Location: `src/app/api/sonoma.js`
- Method: `POST`
- Request Body:
  ```json
  {
    "instructions": "<string>",
    "innertext": "<string>",
    "session": { /* session state object */ }
  }
  ```
- Response:
  ```json
  {
    "reply": "<Ms. Sonoma's response>"
  }
  ```
- The backend composes a prompt from instructions, innertext, and session, and sends it to OpenAI. The response is returned as `reply`.

## Frontend Integration
- Location: `src/app/session/page.js`
- For each session phase, the frontend sends instructions and innertext to `/api/sonoma`.
- Example usage:
  ```js
  await fetch('/api/sonoma', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instructions, innertext, session })
  })
  ```
- The response is displayed as Ms. Sonoma's transcript. No hardcoded logic or personality is present in JS.

## Session Phases & Instructions
- Each phase sends a specific instruction string, innertext (user input), and session state.
- Example instructions:
  - Greeting: "Say learner’s name and a hello phrase then name the lesson."
  - Encourage: "Say a positive and reassuring statement."
  - Joke: "Funny joke related to the subject."
  - ...etc (see Macro Objective for full list)

## Continuous Conversation
- The API call is continuous and not broken into multiple calls per phase.
- All cues, transitions, and Sonoma-Validated Truth logic are handled by the API response.

## No Hardcoded Personality
- Ms. Sonoma's responses are never hardcoded in JS.
- All conversation, cues, and transitions are scaffolded by instructions and innertext sent to the API.

## Updating Macro Objective
- Always refer to `src/app/Macro Objective` before making changes.
- Never solve problems microscopically at the expense of the macro objective.

---

This document ensures all development aligns with the atomic vision for Ms. Sonoma and the macro objectives. For any changes, update this documentation and the Macro Objective file.

## Verbose logging (see entire instructions/innertext)

The API route logs the incoming `instructions`, `innertext`, the composed user payload, and the system prompt. By default, in production these are truncated to 600 characters to keep logs concise. You can control truncation via the environment variable `SONOMA_LOG_PREVIEW_MAX`:

- `full`, `off`, `none`, or `0` — no truncation (logs full content)
- Any positive integer (e.g., `2000`) — truncate after that many characters
- Default behavior: unlimited in development; 600 chars in production

On Windows PowerShell, you can set it per-process when starting the dev server:

```powershell
$env:SONOMA_LOG_PREVIEW_MAX = 'full'; npm run dev
```

Or for a one-off build run:

```powershell
$env:SONOMA_LOG_PREVIEW_MAX = '2000'; npm run build
```

If using a `.env.local` file, add:

```
SONOMA_LOG_PREVIEW_MAX=full
```

Note: Very large logs can be noisy; prefer a high numeric limit instead of `full` when possible.