import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(){
  try {
    const dir = path.join(process.cwd(), 'public', 'lessons', 'Facilitator Lessons')
    if (!fs.existsSync(dir)) return NextResponse.json([])
    const entries = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.json'))
    const out = []
    for (const file of entries) {
      try {
        const raw = fs.readFileSync(path.join(dir, file), 'utf8')
        const js = JSON.parse(raw)
        const subj = (js.subject || '').toString().toLowerCase()
        const approvedPath = subj ? path.join(process.cwd(), 'public', 'lessons', subj, file) : null
        const approved = approvedPath ? fs.existsSync(approvedPath) : false
        const needsUpdate = js.needsUpdate === true
        out.push({ file, title: js.title || file, grade: js.grade || null, difficulty: (js.difficulty || '').toLowerCase(), subject: subj || null, approved, needsUpdate })
      } catch {}
    }
    return NextResponse.json(out)
  } catch (e) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
