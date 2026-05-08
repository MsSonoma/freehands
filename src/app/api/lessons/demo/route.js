import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export async function GET() {
  try {
    const dir = path.join(process.cwd(), 'public', 'lessons', 'demo')
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))

    const lessons = []
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(dir, file), 'utf8')
        const data = JSON.parse(raw)
        lessons.push({
          file,
          title: data.title || file.replace('.json', ''),
          subject: data.subject || 'general',
          grade: data.grade || '',
          difficulty: data.difficulty || '',
          blurb: data.blurb || '',
        })
      } catch {
        // skip unreadable file
      }
    }

    return NextResponse.json(lessons)
  } catch (err) {
    return NextResponse.json([], { status: 200 })
  }
}
