"use client";

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { listLearnerTranscriptPdfs } from '@/app/lib/transcriptsClient';
import { getLearner } from '@/app/facilitator/learners/clientApi';

export default function LearnerTranscriptsPage({ params }) {
  // In Next.js 15 App Router, params is a Promise in client components.
  // Unwrap with React.use() to avoid deprecation warnings and future breakage.
  const { id: learnerId } = use(params);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [learnerName, setLearnerName] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [meta, list] = await Promise.all([
          learnerId ? getLearner(learnerId) : null,
          learnerId ? listLearnerTranscriptPdfs(learnerId) : [],
        ]);
        if (!mounted) return;
        setLearnerName(meta?.name || '');
        setItems(list);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load transcripts');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [learnerId]);

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <h1 style={{ margin: 0 }}>Transcripts{learnerName ? ` — ${learnerName}` : ''}</h1>
        <Link href="/facilitator/learners" style={{ textDecoration:'none', color:'#111', border:'1px solid #111', padding:'8px 12px', borderRadius:8 }}>Back to Learners</Link>
      </div>
      {loading ? (
        <p style={{ color:'#555', marginTop:16 }}>Loading…</p>
      ) : error ? (
        <p style={{ color:'#b00020', marginTop:16 }}>{error}</p>
      ) : (items?.length ? (
        <div style={{ marginTop:16, display:'grid', gap:12 }}>
          {items.map((it) => (
            <div key={it.path} style={{ border:'1px solid #eee', borderRadius:8, background:'#fff', padding:12, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
              <div>
                <div style={{ fontWeight:700 }}>Lesson: {it.lessonId}</div>
                <div style={{ color:'#555', fontSize:14 }}>{it.path.split('/').slice(-2).join('/')}</div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <a href={it.url} target="_blank" rel="noreferrer" style={{ padding:'8px 12px', border:'1px solid #111', borderRadius:8, background:'#111', color:'#fff', textDecoration:'none' }}>Open PDF</a>
                <a href={it.url} download style={{ padding:'8px 12px', border:'1px solid #111', borderRadius:8, background:'#fff', color:'#111', textDecoration:'none' }}>Download</a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color:'#555', marginTop:16 }}>No transcript PDFs yet.</p>
      ))}
    </main>
  );
}
