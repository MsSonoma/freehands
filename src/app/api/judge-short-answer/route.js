/**
 * /api/judge-short-answer
 * 
 * Backend judgement for short-answer questions using Ms. Sonoma.
 * Applies normalized leniency rules consistently with copilot-instructions.md.
 * 
 * Input:
 * {
 *   question: string,
 *   learnerAnswer: string,
 *   expectedAnswer: string,
 *   expectedAny: string[] (optional, synonyms/acceptable answers),
 *   keywords: string[] (optional, required keywords for acceptance),
 *   minKeywords: number (optional, minimum keyword matches required)
 * }
 * 
 * Output:
 * {
 *   correct: boolean,
 *   feedback?: string (brief explanation for debugging)
 * }
 */

import { NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      question = '',
      learnerAnswer = '',
      expectedAnswer = '',
      expectedAny = [],
      keywords = [],
      minKeywords = 0,
    } = body;

    // Validate required inputs
    if (!question || !learnerAnswer) {
      return NextResponse.json(
        { error: 'Missing required fields: question and learnerAnswer' },
        { status: 400 }
      );
    }

    if (!OPENAI_API_KEY) {
      console.error('[judge-short-answer] OPENAI_API_KEY not configured');
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    // Build the judging instruction for Ms. Sonoma
    const acceptableList = expectedAny && expectedAny.length > 0
      ? expectedAny
      : [expectedAnswer];
    
    const acceptableText = acceptableList.join(' OR ');
    
    // Detect question type for appropriate leniency
    const isCreativeWriting = /change|rewrite|make.*descriptive|improve|replace/i.test(question);
    const isOpenEnded = /give|name|list|provide|suggest|example/i.test(question) && acceptableList.length > 1;
    const isFillInBlank = /_{3,}/.test(question); // Has ___ style blanks
    
    let judgingInstruction = [
      'Judge student answer with lenient grading.',
      'Normalize: lowercase, trim spaces, remove punctuation, map number words zero-twenty to digits.',
      'Ignore fillers and politeness. Accept synonyms, plural/tense variations, and different wording with same meaning.',
      `Question: "${question}"`,
      `Student answer: "${learnerAnswer}"`,
      `Acceptable: ${acceptableText}`,
    ];

    // If keywords are provided, use keyword-based acceptance
    if (keywords && keywords.length > 0) {
      const minK = typeof minKeywords === 'number' && minKeywords > 0
        ? minKeywords
        : Math.min(1, keywords.length);
      
      judgingInstruction.push(
        `Accept if answer contains ${minK}+ of these keywords (or synonyms): ${keywords.join(', ')}.`
      );
    } else if (isCreativeWriting) {
      // For creative writing, be very lenient - accept if the student improved the sentence
      judgingInstruction.push(
        'Creative writing: accept ANY improvement that adds description, vivid details, stronger verbs, or sensory language. Judge improvement, not exact wording.'
      );
    } else if (isFillInBlank) {
      // For fill-in-the-blank questions
      judgingInstruction.push(
        'Fill-in-blank: accept any answer from acceptable list, plus synonyms and grammatical variations (singular/plural, tense, articles) that fit the sentence.'
      );
    } else if (isOpenEnded) {
      // For open-ended "give/name" questions with multiple acceptable answers
      judgingInstruction.push(
        'Open-ended: student needs only ONE valid answer. Accept any from acceptable list or close synonyms that fit the question context.'
      );
    } else {
      // Use expected answer matching
      judgingInstruction.push(
        'Accept if answer matches acceptable list or captures the key meaning.'
      );
    }

    judgingInstruction.push(
      'Respond with ONLY "CORRECT" or "INCORRECT" on a single line. Do not add explanation or other text.'
    );

    const systemMessage = judgingInstruction.join(' ');

    // Call OpenAI API with Ms. Sonoma persona
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: systemMessage
          },
          {
            role: 'user',
            content: 'Judge the answer.'
          }
        ],
        temperature: 0.1, // Low temperature for consistent judgement
        max_tokens: 20,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('[judge-short-answer] OpenAI API error:', openaiResponse.status, errorText);
      return NextResponse.json(
        { error: 'OpenAI API request failed', details: errorText },
        { status: openaiResponse.status }
      );
    }

    const data = await openaiResponse.json();
    const judgement = (data?.choices?.[0]?.message?.content || '').trim().toUpperCase();

    const isCorrect = judgement.includes('CORRECT') && !judgement.includes('INCORRECT');

    return NextResponse.json({
      correct: isCorrect,
      feedback: judgement, // Include raw judgement for debugging
    });

  } catch (error) {
    console.error('[judge-short-answer] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// Optional: Support GET for health check
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: '/api/judge-short-answer' });
}
