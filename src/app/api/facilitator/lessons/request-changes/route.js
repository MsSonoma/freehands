import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60 // Extended timeout for OpenAI lesson editing

async function readUserAndTier(request){
  try {
    const auth = request.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return { user: null, plan_tier: 'free', supabase: null }
    const { createClient } = await import('@supabase/supabase-js')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { user: null, plan_tier: 'free', supabase: null }
    const admin = svc ? createClient(url, svc, { auth: { persistSession:false } }) : null
    let plan = 'free'
    if (admin) {
      const { data } = await admin.from('profiles').select('plan_tier').eq('id', user.id).maybeSingle()
      plan = (data?.plan_tier || 'free').toLowerCase()
    } else {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('plan_tier')
          .eq('id', user.id)
          .maybeSingle()
        if (!error && data?.plan_tier) {
          plan = data.plan_tier.toLowerCase()
        }
      } catch {
        // ignore
      }
    }
    return { user, plan_tier: plan, supabase: admin || supabase }
  } catch {
    return { user: null, plan_tier: 'free', supabase: null }
  }
}

function buildChangePrompt(existingLesson, changeRequest){
  const lessonText = JSON.stringify(existingLesson, null, 2)
  return `You are an education content editor. You have an existing lesson in JSON format. The user has requested changes to this lesson. Apply the requested changes while maintaining the structure and ensuring quality standards.

Existing lesson:
${lessonText}

Change request:
${changeRequest}

CRITICAL REQUIREMENTS - YOU MUST FOLLOW THESE EXACTLY:
1. Each question type (truefalse, multiplechoice, fillintheblank, shortanswer) needs at least 10 complete questions
2. For shortanswer and fillintheblank:
   - EVERY SINGLE QUESTION must have at least 3 items in the "expectedAny" array
   - Include the main answer, synonyms, alternative phrasings, and common variations
   - Example: ["photosynthesis", "making food", "food production", "creating energy from light"]
3. True/false questions must have complete question text (not blank)
4. Multiple choice must have exactly 4 distinct choices and a correct index (0-3)
5. Fill-in-the-blank questions must contain _____ placeholder

Return the updated lesson as valid JSON only. No markdown. No commentary. Keep all existing fields unless the change request specifically modifies them. Ensure kid-safe language and age-appropriate content.`
}

async function callModel(prompt){
  const key = process.env.OPENAI_API_KEY
  const url = 'https://api.openai.com/v1/chat/completions'
  if (!key) {
    throw new Error('OpenAI API key not configured')
  }
  const body = {
    model: process.env.SONOMA_OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o',
    messages: [
      { role:'system', content:'Return only valid JSON. No markdown. No commentary.' },
      { role:'user', content: prompt }
    ],
    temperature: 0.6,
  }
  const res = await fetch(url, { method:'POST', headers:{ 'Authorization':`Bearer ${key}`, 'Content-Type':'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`Model error ${res.status}`)
  const js = await res.json()
  const text = js?.choices?.[0]?.message?.content || '{}'
  try { return JSON.parse(text) } catch { throw new Error('Model returned invalid JSON') }
}

export async function POST(request){
  const { user, plan_tier, supabase } = await readUserAndTier(request)
  if (!user) return NextResponse.json({ error:'Unauthorized' }, { status: 401 })
  if (plan_tier !== 'premium') return NextResponse.json({ error:'Premium plan required' }, { status: 403 })
  if (!supabase) return NextResponse.json({ error:'Storage not configured' }, { status: 500 })
  
  let body
  try { body = await request.json() } catch { return NextResponse.json({ error:'Invalid body' }, { status: 400 }) }
  const { file, changeRequest, userId: requestUserId } = body || {}
  const userId = requestUserId || user.id
  if (!file || !changeRequest) return NextResponse.json({ error:'Missing file or changeRequest' }, { status: 400 })
  
  try {
    // Load existing lesson from Supabase Storage
    const storagePath = `facilitator-lessons/${userId}/${file}`
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('lessons')
      .download(storagePath)
    
    if (downloadError || !fileData) {
      return NextResponse.json({ error:'Lesson file not found' }, { status: 404 })
    }
    
    const existingContent = await fileData.text()
    const existingLesson = JSON.parse(existingContent)
    
    // Check if this lesson is already approved
    const wasApproved = existingLesson.approved === true
    
    // Generate updated lesson
    const prompt = buildChangePrompt(existingLesson, changeRequest)
    const updatedLesson = await callModel(prompt)
    
    // Preserve critical fields
    updatedLesson.id = updatedLesson.id || existingLesson.id
    updatedLesson.title = updatedLesson.title || existingLesson.title
    updatedLesson.grade = updatedLesson.grade || existingLesson.grade
    updatedLesson.difficulty = updatedLesson.difficulty || existingLesson.difficulty
    updatedLesson.subject = updatedLesson.subject || existingLesson.subject
    
    // Mark as needing update if it was previously approved
    if (wasApproved) {
      updatedLesson.needsUpdate = true
      updatedLesson.approved = false // Require re-approval
    }
    
    // Save updated lesson to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('lessons')
      .upload(storagePath, JSON.stringify(updatedLesson, null, 2), {
        contentType: 'application/json',
        upsert: true
      })
    
    if (uploadError) {
      return NextResponse.json({ error: 'Failed to save updated lesson' }, { status: 500 })
    }
    
    return NextResponse.json({ ok:true, file, message:'Lesson updated successfully' })
  } catch (e) {
    // General error
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
