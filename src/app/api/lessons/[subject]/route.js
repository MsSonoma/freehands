import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Always read from disk on each request so newly added files appear without restart
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

// Enumerate lesson JSON files for a subject by reading the public/lessons/{subject} directory.
// Returns minimal metadata for listing without loading entire question arrays.
export async function GET(request) {
  try {
    // Derive the subject segment from the URL to avoid accessing params synchronously
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const subject = decodeURIComponent(parts[parts.length - 1] || '').toLowerCase();
    if (!subject) return NextResponse.json({ error: 'Subject required' }, { status: 400 });
    const lessonsDir = path.join(process.cwd(), 'public', 'lessons', subject);
    if (!fs.existsSync(lessonsDir)) return NextResponse.json([]); // no lessons yet
    const entries = fs.readdirSync(lessonsDir).filter(f => f.toLowerCase().endsWith('.json'));
    const results = [];
    for (const file of entries) {
      try {
        const full = path.join(lessonsDir, file);
        const raw = fs.readFileSync(full, 'utf8');
        const data = JSON.parse(raw);
        results.push({
          file,
            id: data.id || file,
            // Avoid String.prototype.replaceAll for widest compatibility
            title: data.title || file.replace(/\.json$/, '').split('_').join(' '),
            blurb: data.blurb || '',
            difficulty: (data.difficulty || '').toLowerCase(),
            grade: data.grade != null ? String(data.grade) : null
        });
      } catch {
        // skip unreadable file
      }
    }
    return NextResponse.json(results);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to enumerate lessons', detail: e?.message || String(e) }, { status: 500 });
  }
}