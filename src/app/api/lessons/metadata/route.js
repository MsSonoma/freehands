import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

// Fetch metadata for specific lessons by their keys
// POST body: { lessons: ["general/file1.json", "math/file2.json", "generated/file3.json" ...] }
export async function POST(request) {
  try {
    const { lessons } = await request.json();
    
    if (!Array.isArray(lessons) || lessons.length === 0) {
      return NextResponse.json([]);
    }
    
    const results = [];
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // SECURITY FIX: Get authenticated user for generated lessons
    let authenticatedUserId = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          const { data: { user }, error: authError } = await supabase.auth.getUser(token);
          if (!authError && user) {
            authenticatedUserId = user.id;
          }
        }
      } catch {
        // Failed to authenticate - will only be able to access public lessons
      }
    }

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

        // SECURITY: If subject is "generated", only load from authenticated user's folder
        if (subject === 'generated') {
          if (!authenticatedUserId || !supabaseUrl || !supabaseServiceKey) {
            // Skip generated lessons if not authenticated
            continue;
          }
          
          try {
            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('lessons')
              .download(`facilitator-lessons/${authenticatedUserId}/${filename}`);
            
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
            }
          } catch {
            // Error loading generated lesson - skip
          }
          continue;
        }

        // Try to load from filesystem (for built-in lessons only)
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
        
        // If not found, skip it
      } catch (err) {
        // Error loading lesson - skip
      }
    }

    return NextResponse.json(results);
  } catch (e) {
    // General error
    return NextResponse.json({ error: 'Failed to fetch lesson metadata', detail: e?.message || String(e) }, { status: 500 });
  }
}
