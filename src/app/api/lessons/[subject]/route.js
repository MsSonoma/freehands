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
    
    // If subject is "facilitator", fetch from Supabase Storage subject folders
    // These are the approved lessons that have been copied from facilitator-lessons/{userId}/ to {subject}/
    if (subject === 'facilitator') {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
      }
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // List all approved lessons from all subject folders in Supabase Storage
      const results = [];
      const subjects = ['math', 'science', 'language arts', 'social studies'];
      
      for (const subj of subjects) {
        try {
          const { data: files, error } = await supabase.storage
            .from('lessons')
            .list(subj, {
              limit: 1000,
              offset: 0,
            });
          
          if (error) {
            console.error(`Error listing ${subj} lessons:`, error);
            continue;
          }
          
          if (!files || files.length === 0) continue;
          
          // Filter for JSON files only
          const jsonFiles = files.filter(f => f.name.toLowerCase().endsWith('.json'));
          
          // Download and parse each file
          for (const file of jsonFiles) {
            try {
              const { data: fileData, error: downloadError } = await supabase.storage
                .from('lessons')
                .download(`${subj}/${file.name}`);
              
              if (downloadError || !fileData) continue;
              
              const text = await fileData.text();
              const lessonData = JSON.parse(text);
              
              results.push({
                file: file.name,
                id: lessonData.id || file.name,
                title: lessonData.title || file.name.replace(/\.json$/, '').split('_').join(' '),
                blurb: lessonData.blurb || '',
                difficulty: (lessonData.difficulty || '').toLowerCase(),
                grade: lessonData.grade != null ? String(lessonData.grade) : null,
                subject: subj // Include subject for facilitator view
              });
            } catch (err) {
              console.error(`Error processing ${subj}/${file.name}:`, err);
            }
          }
        } catch (err) {
          console.error(`Error fetching ${subj} lessons:`, err);
        }
      }
      
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