// API route for Fill-in-Fun template generation
// Generates a fun story template with word type placeholders
// Uses the cheaper gpt-4o-mini model for cost efficiency

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = 'gpt-4o-mini'

function createCallId() {
  return `fill-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

async function callOpenAI(instruction, apiKey) {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'user',
          content: instruction,
        },
      ],
      temperature: 0.9, // Higher temperature for more creative/fun results
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const reply = data.choices?.[0]?.message?.content?.trim() || ''
  return reply
}

export async function POST(req) {
  const callId = createCallId()
  const logPrefix = `[Fill-in-Fun API][${callId}]`
  
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error(`${logPrefix} OPENAI_API_KEY is not configured`)
      return NextResponse.json({ error: 'Fill-in-Fun is unavailable.' }, { status: 500 })
    }

    const body = await req.json()
    const subject = body.subject || 'general'
    const lessonTitle = body.lessonTitle || ''
    
    console.log(`${logPrefix} Generating Fill-in-Fun template for subject: ${subject}`)

    // Construct instruction for GPT to generate a Fill-in-Fun template
    const instruction = [
      'Generate a short, fun story (4-5 sentences) with specific words replaced by placeholders.',
      'The story should be age-appropriate for kids ages 6-12.',
      lessonTitle ? `Make it loosely related to the lesson topic: "${lessonTitle}".` : '',
      subject !== 'general' ? `Make it loosely related to ${subject}.` : '',
      '',
      'IMPORTANT: Write a complete, coherent story FIRST, then replace only 6-8 strategic words with placeholders.',
      'The story should make sense and be funny when the placeholders are filled in with random words.',
      'DO NOT make every important word a placeholder - keep most of the story intact.',
      '',
      'CRITICAL: You must respond with ONLY valid JSON. No other text before or after.',
      'The JSON must have this exact structure:',
      '{',
      '  "template": "One sunny morning, a {adjective1} scientist named Dr. {noun1} discovered that {noun2} could {verb1}. This was {adjective2} news! Everyone in town started to {verb2} {adverb1} whenever they saw one.",',
      '  "words": [',
      '    {"type": "adjective", "label": "adjective1", "prompt": "an adjective (describing word)"},',
      '    {"type": "noun", "label": "noun1", "prompt": "a person\'s name"},',
      '    {"type": "noun", "label": "noun2", "prompt": "a plural noun (more than one thing)"},',
      '    {"type": "verb", "label": "verb1", "prompt": "a verb (action word)"},',
      '    {"type": "adjective", "label": "adjective2", "prompt": "an adjective (describing word)"},',
      '    {"type": "verb", "label": "verb2", "prompt": "a verb (action word)"},',
      '    {"type": "adverb", "label": "adverb1", "prompt": "an adverb (describes how, like quickly or loudly)"}',
      '  ]',
      '}',
      '',
      'Rules:',
      '- Write a complete story with a clear beginning, middle, and end',
      '- The story should be 4-5 sentences long and make sense on its own',
      '- Replace only 6-8 carefully chosen words with placeholders for comedic effect',
      '- Keep proper nouns, most verbs, and the story structure intact',
      '- Each placeholder must be in the format {label} where label matches a word object',
      '- Include a mix of nouns, verbs, adjectives, and adverbs as replacements',
      '- Number duplicate types (noun1, noun2, adjective1, adjective2, etc.)',
      '- Each word object must have: type (noun/verb/adjective/adverb), label (matches template), and prompt (what to ask the child)',
      '- Make prompts kid-friendly, specific, and clear (e.g., "a person\'s name" instead of just "a noun")',
      '- The story should be funny when silly words are substituted',
      '- Return ONLY the JSON, nothing else'
    ].filter(Boolean).join('\n')

    console.log(`${logPrefix} Calling OpenAI...`)
    const reply = await callOpenAI(instruction, apiKey)
    console.log(`${logPrefix} Got response: ${reply.substring(0, 200)}...`)

    // Parse the JSON response
    let parsed
    try {
      // Try to extract JSON if GPT added any extra text
      const jsonMatch = reply.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        parsed = JSON.parse(reply)
      }
    } catch (parseError) {
      console.error(`${logPrefix} Failed to parse GPT response as JSON:`, parseError)
      console.error(`${logPrefix} Raw response:`, reply)
      return NextResponse.json({ 
        error: 'Failed to generate Fill-in-Fun template. Please try again.' 
      }, { status: 500 })
    }

    // Validate the structure
    if (!parsed.template || !Array.isArray(parsed.words) || parsed.words.length === 0) {
      console.error(`${logPrefix} Invalid template structure:`, parsed)
      return NextResponse.json({ 
        error: 'Invalid Fill-in-Fun template. Please try again.' 
      }, { status: 500 })
    }

    console.log(`${logPrefix} Successfully generated template with ${parsed.words.length} words`)
    return NextResponse.json(parsed, { status: 200 })

  } catch (error) {
    console.error(`${logPrefix} Error:`, error)
    return NextResponse.json({ 
      error: 'Failed to generate Fill-in-Fun template.' 
    }, { status: 500 })
  }
}
