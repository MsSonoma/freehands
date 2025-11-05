import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

// Fetch metadata for specific lessons by their keys
// POST body: { lessons: ["general/file1.json", "math/file2.json", ...] }
export async function POST(request) {
  try {
    const { lessons } = await request.json();
    
    if (!Array.isArray(lessons) || lessons.length === 0) {
      return NextResponse.json([]);
    }

    console.log('[Metadata API] Fetching metadata for', lessons.length, 'specific lessons');
    
    const results = [];
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    for (const lessonKey of lessons) {
      try {
        // Parse the lesson key: "subject/filename.json" or just "filename.json"
        const parts = lessonKey.split('/');
        let subject, filename;
        
        if (parts.length > 1) {
          subject = parts[0];
          filename = parts[1];
        } else {
          subject = 'general';
          filename = parts[0];
        }

        // Try to load from filesystem (for built-in lessons)
        const subjectFolder = (subject === 'general') ? 'Facilitator Lessons' : subject;
        const lessonsDir = path.join(process.cwd(), 'public', 'lessons', subjectFolder);
        const filePath = path.join(lessonsDir, filename);
        
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(raw);
          results.push({
            file: filename,
            id: data.id || filename,
            title: data.title || filename.replace(/\.json$/, '').split('_').join(' '),
            blurb: data.blurb || '',
            difficulty: (data.difficulty || '').toLowerCase(),
            grade: data.grade != null ? String(data.grade) : null,
            subject: subject,
            lessonKey: lessonKey
          });
          continue;
        }

        // If not found in filesystem, try Supabase Storage (facilitator-created lessons)
        if (supabaseUrl && supabaseServiceKey) {
          try {
            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            
            // List all facilitator folders to find the lesson
            const { data: folders, error: foldersError } = await supabase.storage
              .from('lessons')
              .list('facilitator-lessons', { limit: 1000 });
            
            if (!foldersError && folders) {
              // Search each facilitator's folder for this lesson
              for (const folder of folders) {
                if (!folder.name) continue;
                
                try {
                  const { data: fileData, error: downloadError } = await supabase.storage
                    .from('lessons')
                    .download(`facilitator-lessons/${folder.name}/${filename}`);
                  
                  if (fileData && !downloadError) {
                    const text = await fileData.text();
                    const data = JSON.parse(text);
                    results.push({
                      file: filename,
                      id: data.id || filename,
                      title: data.title || filename.replace(/\.json$/, '').split('_').join(' '),
                      blurb: data.blurb || '',
                      difficulty: (data.difficulty || '').toLowerCase(),
                      grade: data.grade != null ? String(data.grade) : null,
                      subject: data.subject || subject,
                      lessonKey: lessonKey,
                      isGenerated: true
                    });
                    break; // Found it, stop searching
                  }
                } catch {}
              }
            }
          } catch (err) {
            console.error('[Metadata API] Error searching Supabase Storage:', err);
          }
        }
        
        // If still not found, log it
        if (!results.find(r => r.lessonKey === lessonKey)) {
          console.log('[Metadata API] Lesson not found in filesystem or storage:', lessonKey);
        }
      } catch (err) {
        console.error('[Metadata API] Error loading lesson:', lessonKey, err);
      }
    }

    console.log('[Metadata API] Returning', results.length, 'lesson metadata objects');
    return NextResponse.json(results);
  } catch (e) {
    console.error('[Metadata API] Error:', e);
    return NextResponse.json({ error: 'Failed to fetch lesson metadata', detail: e?.message || String(e) }, { status: 500 });
  }
}
