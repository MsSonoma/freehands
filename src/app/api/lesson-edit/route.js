import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * PUT /api/lesson-edit
 * Edit a lesson (facilitator or public lessons)
 * Body: { lessonKey, updates }
 * updates can include: title, blurb, teachingNotes, vocab, sample, truefalse, multiplechoice, shortanswer, fillintheblank
 */
export async function PUT(req) {
  try {
    // Authenticate user
    const auth = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    const supabase = createClient(url, anon, { 
      global: { headers: { Authorization: `Bearer ${token}` } }, 
      auth: { persistSession: false } 
    })
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { lessonKey, updates } = body

    if (!lessonKey || !updates) {
      return NextResponse.json({ error: 'Missing lessonKey or updates' }, { status: 400 })
    }

    const [subject, filename] = lessonKey.split('/')
    
    if (!subject || !filename) {
      return NextResponse.json({ error: 'Invalid lesson key format' }, { status: 400 })
    }

    // Handle generated/facilitator lessons (stored in Supabase)
    if (subject === 'generated' || subject === 'facilitator') {
      // Fetch existing lesson from Supabase
      const admin = svc ? createClient(url, svc, { auth: { persistSession: false } }) : null
      const storageClient = admin || supabase
      
      const storagePath = `facilitator-lessons/${user.id}/${filename}`
      
      const { data: fileData, error: downloadError } = await storageClient.storage
        .from('lessons')
        .download(storagePath)
      
      if (downloadError || !fileData) {
        return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
      }
      
      const text = await fileData.text()
      const lesson = JSON.parse(text)
      
      // Apply updates
      Object.keys(updates).forEach(key => {
        lesson[key] = updates[key]
      })
      
      // Upload updated lesson
      const lessonContent = JSON.stringify(lesson, null, 2)
      
      const { error: uploadError } = await storageClient.storage
        .from('lessons')
        .upload(storagePath, lessonContent, {
          contentType: 'application/json',
          upsert: true
        })
      
      if (uploadError) {
        return NextResponse.json({ error: `Failed to update: ${uploadError.message}` }, { status: 500 })
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'Generated lesson updated',
        lessonKey: lessonKey
      })
    }
    
    // Handle public/installed lessons (math, science, language arts, social studies, general)
    const normalizedSubject = subject.replace(/_/g, ' ')
    const filePath = path.join(process.cwd(), 'public', 'lessons', normalizedSubject, filename)
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Lesson file not found' }, { status: 404 })
    }
    
    // Read existing lesson
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const lesson = JSON.parse(fileContent)
    
    // Apply updates
    Object.keys(updates).forEach(key => {
      lesson[key] = updates[key]
    })
    
    // Write updated lesson back to file
    fs.writeFileSync(filePath, JSON.stringify(lesson, null, 2), 'utf8')
    
    return NextResponse.json({ 
      success: true, 
      message: 'Lesson updated',
      lessonKey: lessonKey
    })
    
  } catch (err) {
    console.error('[LESSON_EDIT] Error:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
