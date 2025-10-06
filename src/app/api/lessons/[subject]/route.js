import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Always read from disk on each request so newly added files appear without restart
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

// Enumerate lesson JSON files for a subject.
// For "facilitator" subject, fetch from Supabase Storage for the specified learner.
// For other subjects, read from public/lessons/{subject} directory.
// Returns minimal metadata for listing without loading entire question arrays.
export async function GET(request) {
  try {
    // Derive the subject segment from the URL
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const subject = decodeURIComponent(parts[parts.length - 1] || '').toLowerCase();
    if (!subject) return NextResponse.json({ error: 'Subject required' }, { status: 400 });
    
    // If subject is "facilitator", fetch ALL generated lessons from facilitator-lessons/ folder (flat structure)
    if (subject === 'facilitator') {
      console.log('[FACILITATOR] Fetching facilitator lessons...');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseServiceKey) {
        console.log('[FACILITATOR] Missing Supabase config');
        return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
      }
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // List all lessons directly in facilitator-lessons/ folder
      const results = [];
      
      try {
        const { data: files, error: filesError } = await supabase.storage
          .from('lessons')
          .list('facilitator-lessons', {
            limit: 1000,
            offset: 0,
          });
        
        console.log('[FACILITATOR] Items found:', files?.length || 0);
        
        if (filesError) {
          console.error('[FACILITATOR] Error listing files:', filesError);
          return NextResponse.json(results);
        }
        
        if (!files || files.length === 0) {
          console.log('[FACILITATOR] No files found in facilitator-lessons/');
          return NextResponse.json(results);
        }
        
        // Filter for JSON files only (skip any folders)
        const jsonFiles = files.filter(f => f.name && f.name.toLowerCase().endsWith('.json') && f.id !== null);
        console.log('[FACILITATOR] JSON files:', jsonFiles.length);
        
        // Download and parse each file
        for (const file of jsonFiles) {
          try {
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('lessons')
              .download(`facilitator-lessons/${file.name}`);
            
            if (downloadError || !fileData) {
              console.error('[FACILITATOR] Download error for', file.name, downloadError);
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
            console.error(`[FACILITATOR] Error processing ${file.name}:`, err);
          }
        }
      } catch (err) {
        console.error('[FACILITATOR] Error in facilitator lessons fetch:', err);
      }
      
      console.log('[FACILITATOR] Total lessons found:', results.length);
      return NextResponse.json(results);
    }
    
    // For non-facilitator subjects, read from filesystem as before
    const subjectFolder = subject;
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
    return NextResponse.json(results);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to enumerate lessons', detail: e?.message || String(e) }, { status: 500 });
  }
}