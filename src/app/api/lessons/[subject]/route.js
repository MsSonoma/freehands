import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Always read from disk on each request so newly added files appear without restart
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

// Enumerate lesson JSON files for a subject.
// For "generated" subject, fetch from Supabase Storage for the specified learner.
// For other subjects, read from public/lessons/{subject} directory.
// Returns minimal metadata for listing without loading entire question arrays.
export async function GET(request) {
  const debug = process.env.DEBUG_LESSONS === '1'
  const startedAt = Date.now()
  try {
    // Derive the subject segment from the URL
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const subject = decodeURIComponent(parts[parts.length - 1] || '').toLowerCase();
    if (!subject) return NextResponse.json({ error: 'Subject required' }, { status: 400 });

    if (debug) {
      // eslint-disable-next-line no-console
      console.log('[api/lessons]', 'GET', { subject })
    }
    
    // If subject is "generated", fetch ALL generated lessons from the current user's folder
    if (subject === 'generated') {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseServiceKey || !anonKey) {
        return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 })
      }
      
      // Get the current user from cookies
      const cookieStore = await cookies()
      
      const userClient = createServerClient(
        supabaseUrl,
        anonKey,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll()
            },
            setAll(cookiesToSet) {
              // Not needed for read-only operations
            },
          },
        }
      )
      
      const { data: { session }, error: sessionError } = await userClient.auth.getSession()
      
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      
      const userId = session.user.id
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // List all lessons in the user's generated-lessons folder
      const results = [];
      
      try {
        const { data: files, error: filesError } = await supabase.storage
          .from('lessons')
          .list(`facilitator-lessons/${userId}`, {
            limit: 1000,
            offset: 0,
          });
        
        if (filesError) {
          // Error listing files
          return NextResponse.json(results);
        }
        
        if (!files || files.length === 0) {
          return NextResponse.json(results)
        }
        
        // Filter for JSON files only (skip any folders)
        const jsonFiles = files.filter(f => f.name && f.name.toLowerCase().endsWith('.json') && f.id !== null);
        
        // Download and parse each file
        for (const file of jsonFiles) {
          try {
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('lessons')
              .download(`facilitator-lessons/${userId}/${file.name}`);
            
            if (downloadError || !fileData) {
              // Download error - skip file
              continue;
            }
            
            const text = await fileData.text();
            const lessonData = JSON.parse(text);
            
            results.push({
              file: file.name,
              id: lessonData.id || file.name,
              title: lessonData.title || file.name.replace(/\.json$/, '').split('_').join(' '),
              blurb: lessonData.blurb || '',
              difficulty: (lessonData.difficulty || '').toLowerCase(),
              grade: lessonData.grade != null ? String(lessonData.grade) : null,
              subject: lessonData.subject || 'unknown',
              approved: lessonData.approved || false,
              needsUpdate: lessonData.needsUpdate || false
            });
          } catch (err) {
            // Error processing file - skip
          }
        }
      } catch (err) {
        // Error in facilitator lessons fetch
      }
      
      return NextResponse.json(results);
    }
    
  // For non-facilitator subjects, read from filesystem as before
  // Map 'general' to the shared Facilitator Lessons folder on disk
  const subjectFolder = (subject === 'general') ? 'Facilitator Lessons' : subject;
    const lessonsDir = path.join(process.cwd(), 'public', 'lessons', subjectFolder);
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
    if (debug) {
      // eslint-disable-next-line no-console
      console.log('[api/lessons]', 'OK', { subject, count: results.length, ms: Date.now() - startedAt })
    }
    return NextResponse.json(results);
  } catch (e) {
    if (debug) {
      // eslint-disable-next-line no-console
      console.log('[api/lessons]', 'ERR', { ms: Date.now() - startedAt, message: e?.message || String(e) })
    }
    return NextResponse.json({ error: 'Failed to enumerate lessons', detail: e?.message || String(e) }, { status: 500 });
  }
}