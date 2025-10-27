import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Serve lesson JSON files from public/lessons or Supabase storage (generated)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const lessonKey = searchParams.get('key')
    
    if (!lessonKey) {
      return NextResponse.json({ error: 'Missing lesson key' }, { status: 400 })
    }
    
    // Split into subject and filename
    const [subject, filename] = lessonKey.split('/')
    
    if (!subject || !filename) {
      return NextResponse.json({ error: 'Invalid lesson key format' }, { status: 400 })
    }
    
    // Handle generated lessons from Supabase storage
    if (subject === 'generated') {
      // Authenticate using Bearer token (same pattern as lesson-edit)
      const auth = request.headers.get('authorization') || ''
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
      
      if (!token) {
        console.log('[LESSON_FILE] No authorization token')
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
        console.log('[LESSON_FILE] No user found from token')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      
      console.log('[LESSON_FILE] Authenticated user:', user.id)
      
      // Use service role client for storage access
      const storageClient = svc ? createClient(url, svc, { auth: { persistSession: false } }) : supabase
      
      const filePath = `facilitator-lessons/${user.id}/${filename}`
      
      console.log('[LESSON_FILE] Downloading from storage:', { bucket: 'lessons', filePath })
      
      const { data, error } = await storageClient.storage
        .from('lessons')
        .download(filePath)
      
      if (error) {
        console.error('[LESSON_FILE] Supabase storage error:', error)
        return NextResponse.json({ error: 'Lesson file not found' }, { status: 404 })
      }
      
      const text = await data.text()
      const lessonData = JSON.parse(text)
      
      return NextResponse.json(lessonData)
    }
    
    // Handle public lessons from filesystem
    // Normalize subject name: replace underscores with spaces to handle both formats
    const normalizedSubject = subject.replace(/_/g, ' ')
    
    // Build file path
    const filePath = path.join(process.cwd(), 'public', 'lessons', normalizedSubject, filename)
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Lesson file not found' }, { status: 404 })
    }
    
    // Read and parse the file
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const lessonData = JSON.parse(fileContent)
    
    return NextResponse.json(lessonData)
  } catch (err) {
    console.error('[LESSON_FILE] Error:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
