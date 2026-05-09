# Ms. Sonoma — Guiding Document (Dispatch Surface)

**App**: freehands (`mssonoma.com`)
**Phase**: Beta
**Last updated**: 2026-04-26

---

## What Ms. Sonoma Is

An AI-powered K-8 learning platform with certified educator oversight.

Core promise:
> "AI-powered personalized lessons with certified educator monitoring for K-8 students."

Target audience:
- Primary — Homeschool parents (need time back, want structured curriculum, worried about effectiveness)
- Secondary — Parents of struggling students (kids falling behind, need personalized attention)

---

## How It Works

1. **Facilitator** (parent, educator, co-op leader) creates an account, sets up learner profile.
2. **Lessons** are structured as turn-based sessions — Ms. Sonoma guides the student through Definitions → Examples → Comprehension.
3. **Mrs. Webb** handles the lesson state machine (`/session/webb`) via a Cohere-backed server at port 7720.
4. **Mr. Mentor** provides a session overlay guide.
5. **Facilitator hub** (`/facilitator`) gives adults a calendar, lesson planner, billing, and progress tracking.

---

## Brand Mandate

**Single value proposition** (use everywhere, no variations):
> "AI-powered personalized lessons with certified educator monitoring for K-8 students."

**Terminology**: "AI tutor with educator support" — NOT "caring Educator" vs "Facilitator"

**Voice**: Clear, trustworthy, parent-focused. Transparent about AI role.

**Proof requirements**: Every claim needs a testimonial, metric, or demo. Proof density is the primary growth lever.

---

## Strategic Intent (Beta Phase)

- Gather test data: lesson completion rates, subject popularity, student improvement metrics
- Build buzz: social proof via Paigr → Instagram/Facebook/TikTok for parent audiences
- Drive facilitator acquisition: Sales Trip routes targeting co-ops, tutoring centers, daycares, libraries
- Resolve brand clarity: unify messaging across `.com` and `.app` domains

---

## Known Drift Risks

| Risk | Description |
|---|---|
| Message inconsistency | `.com` and `.app` still carry different taglines |
| Proof vacuum | No captured testimonials or grade improvement data yet |
| Terminology drift | "Educator" vs "Facilitator" used inconsistently |
| AI trust gap | Parents skeptical of AI without clear educator oversight explanation |

---

## Dispatch Monitoring Targets

Dispatch should flag if:
- `beta_metrics.lessons_completed` stays at 0 for more than 2 weeks after facilitator onboarding
- `open_gaps` list grows without corresponding CRs filed
- Brand language in Paigr posts contradicts this guiding document
- Sales Trip profile targeting drifts from the facilitator-acquisition focus defined here
