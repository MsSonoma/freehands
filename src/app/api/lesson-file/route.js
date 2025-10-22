import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Serve lesson JSON files from public/lessons
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
