// API route for Fill-in-Fun template generation
// Returns a random template from a pre-built library of 20 fun stories
// No AI generation needed - all front-end with instant response

import { NextResponse } from 'next/server'
import { getRandomTemplate } from '@/app/lib/fillInFunTemplates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function createCallId() {
  return `fill-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export async function POST(req) {
  const callId = createCallId()
  const logPrefix = `[Fill-in-Fun API][${callId}]`
  
  try {
    const body = await req.json()
    const subject = body.subject || 'general'
    const lessonTitle = body.lessonTitle || ''

    // Get a random template from the library
    const template = getRandomTemplate()
    
    return NextResponse.json(template, { status: 200 })

  } catch (error) {
    // General error
    return NextResponse.json({ 
      error: 'Failed to get Fill-in-Fun template.' 
    }, { status: 500 })
  }
}
