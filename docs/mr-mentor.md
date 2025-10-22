# Mr. Mentor - AI Counselor Feature

## Overview

Mr. Mentor is an AI-powered counselor designed to support homeschool facilitators and parents. Built on GPT-4o with a warm, caring male voice (Google TTS en-US-Neural2-D), Mr. Mentor provides therapeutic support, curriculum planning guidance, and goal-setting assistance.

## Purpose

Mr. Mentor helps facilitators:
- Process feelings and challenges around teaching
- Clarify educational goals and values
- Plan curriculum and create learning schedules
- Build confidence in teaching abilities
- Develop strategies for specific learning situations
- Balance academic expectations with family dynamics

## Key Features

### Learner-Specific Counseling
- **Learner Selection**: Choose which learner to discuss from dropdown menu
- **Automatic Context**: Mr. Mentor receives complete learner profile and progress data
- **Data-Informed Guidance**: References specific achievements, medals, and learning patterns
- **Personalized Questions**: Asks about individual learner needs based on their data
- **None Option**: General discussions without learner context available

#### Learner Transcript Includes:
- Basic profile (name, grade)
- Learning targets (comprehension, exercise, worksheet, test goals)
- Session timer settings
- Golden keys available
- Approved lessons count by subject
- **Facilitator notes on specific lessons** (added from facilitator/lessons page)
- Progress summary with medals (🥇🥈🥉) and scores
- Top 10 lessons per subject with performance percentages

### Therapeutic AI Counseling
- **Active Listening**: Reflects and validates facilitator experiences
- **Socratic Questioning**: Helps users discover their own solutions
- **Empathetic Responses**: Warm, non-judgmental support
- **Growth Mindset**: Encourages self-compassion and realistic expectations

### Curriculum Planning Support
- K-12 homeschool standards knowledge
- Age-appropriate topic suggestions
- Weekly, monthly, and yearly schedule creation
- Subject balancing (math, language arts, science, social studies, arts, PE)
- Learning style accommodation
- Realistic pacing recommendations

### Conversation Features
- **Provocative Questions**: Every response ends with 1-2 thought-provoking questions
- **Persistent History**: Conversations saved in localStorage for continuity
- **Export**: Download conversation transcripts as text files
- **New Sessions**: Clear history to start fresh topics

## Ethical Boundaries (Critical)

### What Mr. Mentor DOES
✅ Provide emotional support for teaching challenges
✅ Help with curriculum planning and educational strategies
✅ Facilitate goal setting and self-reflection
✅ Offer practical, actionable suggestions
✅ Encourage healthy perspective on parenting/teaching

### What Mr. Mentor DOES NOT Do
❌ Provide medical advice, diagnoses, or treatment
❌ Act as a licensed therapist
❌ Discuss medication or mental health diagnoses
❌ Replace professional counseling
❌ Handle crisis situations

### Crisis Redirection
If indicators of crisis appear (self-harm, abuse, severe depression), Mr. Mentor will:
1. Acknowledge the difficulty
2. Direct to immediate professional help (988 Suicide Prevention Lifeline)
3. Clarify that he's limited to educational planning support

## Technical Architecture

### API Route: `/api/counselor`
- **Model**: GPT-4o (configurable temperature: 0.8)
- **Max Tokens**: 1500
- **Voice**: en-US-Neural2-D (male, speaking rate 0.88)
- **State**: Stateless API - client sends full conversation history with each request
- **Caching**: TTS responses cached (up to 200 entries)

#### Conversation Flow (Stateless with Full Context)

Each API call is stateless but maintains conversational context:

```
REQUEST (Turn 1):
{
  message: "I'm feeling overwhelmed",
  history: []  // Empty on first message
}

API BUILDS:
[
  {role: 'system', content: MENTOR_SYSTEM_PROMPT},
  {role: 'user', content: "I'm feeling overwhelmed"}
]

RESPONSE (Turn 1):
{
  reply: "I hear you—that's normal. What matters most?",
  audio: "base64..."
}

---

REQUEST (Turn 2):
{
  message: "I want them to love learning",
  history: [
    {role: 'user', content: "I'm feeling overwhelmed"},
    {role: 'assistant', content: "I hear you—that's normal. What matters most?"}
  ]
}

API BUILDS:
[
  {role: 'system', content: MENTOR_SYSTEM_PROMPT},
  {role: 'user', content: "I'm feeling overwhelmed"},
  {role: 'assistant', content: "I hear you—that's normal. What matters most?"},
  {role: 'user', content: "I want them to love learning"}
]

RESPONSE (Turn 2):
{
  reply: "That's a beautiful goal. What does that look like?",
  audio: "base64..."
}
```

**Key Points:**
- Client maintains full conversation history in state
- Each request sends complete prior conversation
- API is stateless—no server-side session storage
- History grows with each turn, ensuring context continuity

### Learner Context Flow

When a learner is selected from the dropdown:

1. **Client fetches transcript** (`fetchLearnerTranscript`):
   - Queries `learners` table for full profile
   - Calls `getMedalsForLearner` for progress data
   - Builds formatted text transcript via `buildLearnerTranscript`

2. **Transcript included in API request**:
```javascript
{
  message: "How is Emma doing in math?",
  history: [...],
  learner_transcript: "LEARNER PROFILE:\nName: Emma\nGrade: 4\n..."
}
```

3. **API enhances system prompt**:
```javascript
systemPrompt += `

=== CURRENT LEARNER CONTEXT ===
The facilitator has selected a specific learner to discuss...
[Full transcript inserted here]
=== END LEARNER CONTEXT ===

Use this information to provide personalized, data-informed guidance...`
```

4. **Mr. Mentor responds with data-aware insights**:
   - References specific lesson scores
   - Notices patterns (e.g., strong in science, struggling in math)
   - Asks targeted questions about learner's unique situation

**Transcript Contents:**
- Basic profile, targets, timer settings
- Golden keys count
- Approved lessons breakdown by subject
- Medals summary (gold/silver/bronze counts)
- Top 10 lessons per subject with scores
- Limited to 10 lessons/subject to avoid overwhelming GPT context window

**Selection Behavior:**
- "None (general discussion)" → `learner_transcript: null` → standard counseling
- Learner selected → transcript included → data-informed counseling
- Transcript regenerates on every message (always current)

### System Prompt
Comprehensive therapeutic prompt covering:
- Counseling approach and techniques
- Curriculum planning expertise
- Response style guidelines
- Required ending questions
- Strict ethical boundaries
- Learner context integration (when provided)

### Client Component
- Session-like layout (video, captions, footer)
- No timeline or timer (unlike learner sessions)
- localStorage persistence for conversation continuity
- Mobile responsive (landscape side-by-side layout)
- Audio/video sync with mute controls

## Access Control

**Premium Only**: Mr. Mentor requires an active Premium subscription
- PIN verification on page load
- Tier check via Supabase profiles
- Graceful upgrade prompt for non-Premium users

**Future**: Per-use fee structure (to be implemented)

## User Interface

### Layout Components
1. **Header**: Back button, title, Export/New Session controls
2. **Video Panel**: Android counselor video with mute button
3. **Caption/Transcript Panel**: Full conversation history with role labels
4. **Input Footer**: Textarea with send button, Enter-to-send support

### Responsive Design
- **Portrait**: Stacked layout (video above, captions below, input at bottom)
- **Landscape**: Side-by-side (video left, captions right, input at bottom)
- Dynamic video height calculation (40-70% of viewport)

## Sample Conversation Flow

### Opening Message (Example)
**User**: "I'm feeling overwhelmed with planning my child's 5th grade curriculum. Where do I even start?"

**Mr. Mentor**: "I hear you—planning a full year of curriculum can feel like a mountain to climb. That sense of overwhelm is completely normal, and you're not alone in feeling it. Many parents find that breaking it down into smaller, manageable pieces makes it much less daunting.

Let's start by getting clear on what matters most to you. What are your top priorities for your child's learning this year? Is it building strong foundational skills, fostering curiosity, or something else? And how do you envision your child feeling about learning by the end of the year?"

### Curriculum Planning Request (Example)
**User**: "I need help creating a weekly schedule that balances all subjects."

**Mr. Mentor**: "That's a great goal—finding the right balance is key to a sustainable routine. A typical 5th grade week might include daily math and language arts (45-60 min each), alternating science and social studies (3 days each, 45 min), and built-in time for arts, PE, and reading.

But here's what really matters: what does your family's rhythm look like? Are you early morning learners or do you hit your stride mid-day? What subjects does your child naturally gravitate toward, and which ones need more support? When you picture your ideal school week, what does the flow feel like?"

## Testing Scenarios

Test Mr. Mentor with these conversation types:

1. **Frustration Expression**: Parent venting about teaching challenges
2. **Curriculum Planning**: Specific schedule or subject selection questions
3. **Goal Setting**: Long-term educational objectives discussion
4. **Overwhelm**: Multiple concerns expressed at once
5. **Crisis Indicators**: Should trigger redirection to professional help
6. **Learning Difficulties**: Student-specific challenges requiring accommodation

## Best Practices

### For Facilitators Using Mr. Mentor
- Be honest about challenges and feelings
- Provide context about your child's age/grade
- Share specific goals when asking for planning help
- Take notes on insights and action steps
- Export conversations for future reference

### For Development
- Monitor conversation quality via logs
- Refine system prompt based on real usage
- Test safety boundaries regularly
- Ensure TTS voice quality is consistent
- Validate localStorage persistence works across sessions

## Future Enhancements

Potential additions:
- **PDF Export**: Rich formatting with timestamps
- **Calendar Integration**: Export schedules to Google Calendar/iCal
- **Session Summaries**: AI-generated action items after each conversation
- **Suggested Topics**: Prompt cards for common facilitator concerns
- **Voice Input**: Microphone support for hands-free conversation
- **Usage Analytics**: Track conversation depth, common topics, satisfaction

## Files Changed

- `/src/app/api/counselor/route.js` - API endpoint
- `/src/app/facilitator/tools/counselor/page.js` - Next.js page wrapper
- `/src/app/facilitator/tools/counselor/CounselorClient.jsx` - Main component
- `/src/app/facilitator/tools/ClientTools.jsx` - Added navigation card
- `/docs/mr-mentor.md` - This documentation

## Related Documentation

- `.github/copilot-instructions.md` - Ms. Sonoma (child-facing) guidelines
- `AGENTS.md` - Repository-wide agent instructions
- `/docs/profanity-filter.md` - Content safety patterns
- `/src/app/session/page.js` - Learner session reference for audio/video sync

---

**Version**: 1.0  
**Date**: October 21, 2025  
**Status**: Initial Implementation
