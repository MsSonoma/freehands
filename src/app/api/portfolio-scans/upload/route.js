import { NextResponse } from 'next/server'
import { buildScansBasePath, createServiceClient, getBucketName, getUserFromAuthHeader, guessContentType, safeKind } from '../lib'

export const dynamic = 'force-dynamic'

/**
 * POST /api/portfolio-scans/upload
 * Multipart form-data:
 * - learnerId
 * - lessonKey
 * - kind: worksheet|test|other
 * - files: one or more File entries (either 'file' or 'files')
 */
export async function POST(req) {
  try {
    const user = await getUserFromAuthHeader(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const form = await req.formData()
    const learnerId = String(form.get('learnerId') || '').trim()
    const lessonKey = String(form.get('lessonKey') || '').trim()
    const kind = safeKind(form.get('kind') || 'other')

    const fileEntries = []
    const one = form.get('file')
    if (one && typeof one === 'object') fileEntries.push(one)
    const many = form.getAll('files')
    for (const f of many) {
      if (f && typeof f === 'object') fileEntries.push(f)
    }

    const files = fileEntries.filter(f => typeof f?.arrayBuffer === 'function')

    if (!learnerId || !lessonKey) {
      return NextResponse.json({ error: 'Missing learnerId or lessonKey' }, { status: 400 })
    }
    if (!files.length) {
      return NextResponse.json({ error: 'Missing files' }, { status: 400 })
    }

    const svc = createServiceClient()
    if (!svc) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })

    // Ownership check (fail closed)
    const { data: learnerRow, error: learnerErr } = await svc
      .from('learners')
      .select('id, facilitator_id, owner_id, user_id')
      .eq('id', learnerId)
      .maybeSingle()

    if (learnerErr) return NextResponse.json({ error: learnerErr.message }, { status: 500 })
    const owner = learnerRow?.facilitator_id || learnerRow?.owner_id || learnerRow?.user_id
    if (!owner || owner !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const base = buildScansBasePath({ userId: user.id, learnerId, lessonKey })
    if (!base) return NextResponse.json({ error: 'Invalid lessonKey' }, { status: 400 })

    const bucket = getBucketName()
    const prefix = `${base}/${kind}`

    const uploaded = []

    for (const file of files) {
      const originalName = String(file.name || 'upload')
      const ext = originalName.includes('.') ? `.${originalName.split('.').pop()}` : ''
      const nonce = (typeof crypto !== 'undefined' && crypto?.randomUUID)
        ? crypto.randomUUID()
        : `${Math.random().toString(16).slice(2)}_${Date.now()}`

      const name = `${Date.now()}_${nonce}${ext}`
      const path = `${prefix}/${name}`
      const buf = Buffer.from(await file.arrayBuffer())

      const contentType = guessContentType(originalName, file.type)

      const { error: upErr } = await svc.storage.from(bucket).upload(path, buf, {
        contentType,
        upsert: false
      })

      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 })
      }

      const { data: signed, error: signErr } = await svc.storage.from(bucket).createSignedUrl(path, 60 * 60)
      if (signErr) {
        uploaded.push({ name, path, kind, url: null })
        continue
      }

      uploaded.push({ name, path, kind, url: signed?.signedUrl || null })
    }

    return NextResponse.json({ uploaded })
  } catch (err) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
