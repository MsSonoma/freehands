# Content Safety

## How It Works

Ms. Sonoma content safety uses a 7-layer defense strategy to prevent inappropriate content from reaching children:

### Layer 1: Input Validation & Sanitization
- Profanity filter checks learner input before LLM calls
- Located: `src/app/session/utils/profanityFilter.js`
- Whole-word matching, case-insensitive
- Kid-friendly rejection messages ("Let's use kind words")
- Returns: `{ allowed, message, filtered }`

### Layer 2: LLM-Based Content Moderation
- OpenAI Moderation API checks input before main LLM
- Located: `/api/sonoma/route.js`
- If flagged: returns safe fallback response
- Prevents prompt injection and inappropriate requests

### Layer 3: System Instructions Hardening
- SAFETY RULE (ABSOLUTE) directives prepended to all prompts
- Only allows responses about lesson topic, vocab, teaching content
- Rejects violence, weapons, drugs, alcohol, sexuality, profanity, politics, religion

### Layer 4: Output Validation
- Scans LLM responses before sending to frontend
- Runs reply through moderation check
- Returns safe fallback if flagged
- Logs flagged attempts for review

### Layer 5: Feature-Specific Constraints
- **Ask**: 3 questions per lesson limit, only about vocab
- **Poem**: Template-based with fill-in-blank, predefined safe lists
- **Story**: Template-based with dropdown choices, no freeform generation
- Reject banned keywords, template-based responses for FAQ

### Layer 6: Rate Limiting & Monitoring
- Detect and block abuse patterns
- Database tracking of flagged attempts
- Middleware enforcement

### Layer 7: Human Review
- Flagged content logged for review
- Continuous improvement of filters

## Key Files

- `src/app/session/utils/profanityFilter.js` - Profanity detection, word list
- `src/app/api/sonoma/route.js` - Moderation API integration
- Session page instruction builders - Safety directives

## What NOT To Do

- Never remove profanity filter checks before LLM calls
- Never skip output validation (scan responses before frontend)
- Never allow freeform story/poem generation without templates
- Never relax SAFETY RULE directives in prompts
- Never disable moderation API checks

## Template-Based Features

### Poem Feature (Template Mode)
- Pre-written templates: Acrostic, Haiku, Rhyming Couplet
- User selects vocab term from dropdown
- User selects template from list
- System substitutes vocab term into template
- No LLM call for poem generation

### Story Feature (Choice-Based)
- Dropdown choices for characters, settings, plots
- Predefined safe lists only
- Limited LLM for narrative generation with strict guardrails
- Maximum story length: 5 exchanges

## AI Rewrite Safety
- Located: `src/app/api/ai/rewrite-text/route.js`
- Purpose-specific prompts: visual-aid-description, generation-prompt, general
- Kid-friendly language (ages 6-12) for visual-aid-description
- Warm and encouraging tone enforcement
- Context-aware rewrites with lesson title
