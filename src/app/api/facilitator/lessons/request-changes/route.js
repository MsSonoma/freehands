import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function readUserAndTier(request){
  try {
    const auth = request.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return { user: null, plan_tier: 'free' }
    const { createClient } = await import('@supabase/supabase-js')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { user: null, plan_tier: 'free' }
    const admin = svc ? createClient(url, svc, { auth: { persistSession:false } }) : null
    let plan = 'free'
    if (admin) {
      const { data } = await admin.from('profiles').select('plan_tier').eq('id', user.id).maybeSingle()
      plan = (data?.plan_tier || 'free').toLowerCase()
    }
    return { user, plan_tier: plan }
  } catch {
    return { user: null, plan_tier: 'free' }
  }
}

function buildChangePrompt(existingLesson, changeRequest){
  const lessonText = JSON.stringify(existingLesson, null, 2)
  return `You are an education content editor. You have an existing lesson in JSON format. The user has requested changes to this lesson. Apply the requested changes while maintaining the structure and ensuring at least 10 questions in each question type (sample, truefalse, multiplechoice, fillintheblank, shortanswer).

Existing lesson:
${lessonText}

Change request:
${changeRequest}

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
  const { user, plan_tier } = await readUserAndTier(request)
  if (!user) return NextResponse.json({ error:'Unauthorized' }, { status: 401 })
  if (plan_tier !== 'premium') return NextResponse.json({ error:'Premium plan required' }, { status: 403 })
  let body
  try { body = await request.json() } catch { return NextResponse.json({ error:'Invalid body' }, { status: 400 }) }
  const { file, changeRequest } = body || {}
  if (!file || !changeRequest) return NextResponse.json({ error:'Missing file or changeRequest' }, { status: 400 })
  
  try {
    // Load existing lesson
    const root = path.join(process.cwd(), 'public', 'lessons', 'Facilitator Lessons')
    const full = path.join(root, file)
    
    if (!fs.existsSync(full)) {
      return NextResponse.json({ error:'Lesson file not found' }, { status: 404 })
    }
    
    const existingContent = fs.readFileSync(full, 'utf8')
    const existingLesson = JSON.parse(existingContent)
    
    // Check if this lesson is already approved
    const subj = (existingLesson.subject || '').toString().toLowerCase()
    const approvedPath = subj ? path.join(process.cwd(), 'public', 'lessons', subj, file) : null
    const wasApproved = approvedPath ? fs.existsSync(approvedPath) : false
    
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
    }
    
    // Save updated lesson
    fs.writeFileSync(full, JSON.stringify(updatedLesson, null, 2), 'utf8')
    
    return NextResponse.json({ ok:true, file, message:'Lesson updated successfully' })
  } catch (e) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
