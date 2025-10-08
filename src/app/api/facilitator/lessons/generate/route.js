import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60 // Extended timeout for OpenAI lesson generation

async function readUserAndTier(request){
  try {
    const auth = request.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return { user: null, plan_tier: 'free', token: null, supabase: null }
    const { createClient } = await import('@supabase/supabase-js')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { user: null, plan_tier: 'free', token: null, supabase: null }
    const admin = svc ? createClient(url, svc, { auth: { persistSession:false } }) : null
    let plan = 'free'
    if (admin) {
      const { data } = await admin.from('profiles').select('plan_tier').eq('id', user.id).maybeSingle()
      plan = (data?.plan_tier || 'free').toLowerCase()
    }
    return { user, plan_tier: plan, token, supabase: admin || supabase }
  } catch {
    return { user: null, plan_tier: 'free', token: null, supabase: null }
  }
}

function safeFileName(s){
  const base = (s || '').toString().trim().replace(/\s+/g,'_').replace(/[^A-Za-z0-9_\-]/g,'')
  return base.slice(0, 80) || 'lesson'
}

function buildPrompt({ title, subject, difficulty, grade, description, notes, vocab }){
  let vocabText = ''
  if (vocab && vocab.trim()) {
    vocabText = ` Use these vocabulary terms in the lesson: ${vocab.trim()}.`
  }
  let notesGuidance = ''
  if (notes && notes.trim()) {
    notesGuidance = ` Additional guidance for lesson creation: ${notes.trim()}.`
  }
  return `You are an education content generator. Create a JSON lesson with fields: id, title, grade, difficulty, blurb, vocab (array of {term, definition}), teachingNotes, sample (at least 10 Q&A), truefalse (at least 10), multiplechoice (at least 10), fillintheblank (at least 10), shortanswer (at least 10).

IMPORTANT: The teachingNotes field must contain practical, actionable guidance for facilitators teaching this lesson. Include: key teaching strategies, common student misconceptions to address, suggested activities or demonstrations, connections to real-world examples, and tips for differentiation. Make it 2-4 sentences of concrete, helpful advice.${notesGuidance}

Keep all content kid-safe and age-appropriate for ${grade} grade. Difficulty: ${difficulty}. Grade: ${grade}. Subject: ${subject}. Title: ${title}. Blurb: ${description}.${vocabText} Use concise, age-appropriate wording. Ensure each question type has at least 10 questions.`
}

async function callModel(prompt){
  // Use existing Ms. Sonoma OpenAI provider where available; fallback to a minimal stub
  const key = process.env.OPENAI_API_KEY
  const url = 'https://api.openai.com/v1/chat/completions'
  if (!key) {
    // Return a tiny stub to keep dev flows working
    return {
      id: 'Dev_Lesson', title: 'Dev Lesson', grade: '3rd', difficulty: 'Beginner',
      blurb: 'A development stub lesson.', vocab:[{term:'term',definition:'definition'}], 
      teachingNotes:'Use concrete examples and hands-on activities. Address common misconceptions. Connect to real-world scenarios.',
      sample:[{question:'What is 1+1?', expectedAny:['2']}], truefalse:[{question:'2 is even.', answer:true}],
      multiplechoice:[{question:'Pick 2', choices:['1','2','3','4'], correct:1}],
      fillintheblank:[{question:'__ is the result of 1+1.', expectedAny:['2']}],
      shortanswer:[{question:'Explain even numbers.', expectedAny:['divisible by 2']}] 
    }
  }
  const body = {
    model: process.env.SONOMA_OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role:'system', content:'Return only valid JSON. No markdown. No commentary.' },
      { role:'user', content: prompt }
    ],
    temperature: 0.6,
    timeout: 50000, // 50 second timeout for the API call itself
  }
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 55000) // 55 second hard limit
  
  try {
    const res = await fetch(url, { 
      method:'POST', 
      headers:{ 'Authorization':`Bearer ${key}`, 'Content-Type':'application/json' }, 
      body: JSON.stringify(body),
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    
    if (!res.ok) throw new Error(`Model error ${res.status}`)
    const js = await res.json()
    const text = js?.choices?.[0]?.message?.content || '{}'
    try { return JSON.parse(text) } catch { throw new Error('Model returned invalid JSON') }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      throw new Error('OpenAI request timeout - lesson generation took too long')
    }
    throw err
  }
}

export async function POST(request){
  const { user, plan_tier, supabase } = await readUserAndTier(request)
  if (!user) return NextResponse.json({ error:'Unauthorized' }, { status: 401 })
  if (plan_tier !== 'premium') return NextResponse.json({ error:'Premium plan required' }, { status: 403 })
  let body
  try { body = await request.json() } catch { return NextResponse.json({ error:'Invalid body' }, { status: 400 }) }
  const { title, subject, difficulty, grade, description, notes, vocab } = body || {}
  if (!title || !subject || !difficulty || !grade) return NextResponse.json({ error:'Missing fields' }, { status: 400 })
  
  try {
    const prompt = buildPrompt({ title, subject, difficulty, grade, description, notes, vocab })
    const lesson = await callModel(prompt)
  // Normalize core fields
    lesson.id = lesson.id || `${grade}_${title}_${difficulty}`.replace(/\s+/g,'_')
    lesson.title = lesson.title || title
    lesson.grade = lesson.grade || grade
    lesson.difficulty = lesson.difficulty || difficulty
  // Persist subject for downstream approval/publishing
    lesson.subject = (lesson.subject || subject || '').toString().toLowerCase()
    // Store the creator's userId for filtering
    lesson.userId = user.id
    
    const base = safeFileName(`${grade}_${lesson.title}_${difficulty}`)
    const file = `${base}.json`
    const lessonJson = JSON.stringify(lesson, null, 2)
    
    // Store in Supabase Storage in user's facilitator-lessons folder
    let storageUrl = null
    let storageError = null
    if (supabase) {
      try {
        const storagePath = `facilitator-lessons/${user.id}/${file}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('lessons')
          .upload(storagePath, lessonJson, {
            contentType: 'application/json',
            upsert: true
          })
        
        if (uploadError) {
          console.error('Storage upload error:', uploadError)
          storageError = uploadError.message || JSON.stringify(uploadError)
          // Don't fail the request - return lesson data for download
        } else {
          // Get public URL
          const { data: urlData } = supabase.storage
            .from('lessons')
            .getPublicUrl(storagePath)
          storageUrl = urlData?.publicUrl || null
        }
      } catch (err) {
        console.error('Storage error:', err)
        storageError = err.message || String(err)
      }
    } else {
      storageError = 'Supabase client not initialized'
    }
    
    return NextResponse.json({ 
      ok: true, 
      file, 
      lesson,
      storageUrl,
      storageError,
      path: storageUrl,
      userId: user.id // Return for debugging/confirmation
    })
  } catch (e) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
