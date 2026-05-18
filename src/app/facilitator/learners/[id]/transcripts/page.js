"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ensurePinAllowed } from '@/app/lib/pinGate';
import { getLearner } from '@/app/facilitator/learners/clientApi';
import { getSupabaseClient, hasSupabaseEnv } from '@/app/lib/supabaseClient';

const TEACHERS = [
  { key: 'sonoma', label: 'Ms. Sonoma', emoji: '👩‍🏫', color: '#c7442e' },
  { key: 'webb',   label: 'Mrs. Webb',  emoji: '📚',    color: '#0d9488' },
  { key: 'slate',  label: 'Mr. Slate',  emoji: '🤖',    color: '#6366f1' },
];

export default function LearnerTranscriptsPage({ params }) {
  const { id: learnerId } = use(params);
  const router = useRouter();
  const [pinChecked, setPinChecked] = useState(false);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [learnerName, setLearnerName] = useState('');
  const [activeTab, setActiveTab] = useState('sonoma');
  const [sortOrder, setSortOrder] = useState('date'); // 'date' | 'name'

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const allowed = await ensurePinAllowed('facilitator-page');
        if (!allowed) { router.push('/'); return; }
        if (!cancelled) setPinChecked(true);
      } catch {
        if (!cancelled) setPinChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (!pinChecked || !learnerId) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const supabase = getSupabaseClient?.();
        const { data: { session } = {} } = supabase ? await supabase.auth.getSession() : {};
        const token = session?.access_token || '';
        const [meta, listResp] = await Promise.all([
          getLearner(learnerId),
          fetch(`/api/facilitator/learners/${encodeURIComponent(learnerId)}/transcripts`, {
            cache: 'no-store',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }).then(async (r) => {
            if (!r.ok) {
              const msg = (await r.json().catch(() => ({})))?.error || `Status ${r.status}`;
              throw new Error(msg);
            }
            return r.json();
          }),
        ]);
        if (!mounted) return;
        setLearnerName(meta?.name || '');
        setAllItems(Array.isArray(listResp?.items) ? listResp.items : []);
        // Auto-select the first teacher tab that has entries
        const items = Array.isArray(listResp?.items) ? listResp.items : [];
        const firstWithData = TEACHERS.find(t => items.some(it => it.teacher === t.key));
        if (firstWithData) setActiveTab(firstWithData.key);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load transcripts');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [pinChecked, learnerId]);

  const itemsForTab = allItems.filter(it => it.teacher === activeTab);
  const sortedItemsForTab = sortOrder === 'name'
    ? itemsForTab.slice().sort((a, b) => (a.lessonId || '').localeCompare(b.lessonId || ''))
    : itemsForTab.slice().sort((a, b) => {
        const dA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return dB - dA; // newest first
      });

  const cardStyle = {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    background: '#fff',
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  };

  return (
    <main style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          Transcripts{learnerName ? ` — ${learnerName}` : ''}
        </h1>
        <Link href="/facilitator/learners" style={{ textDecoration: 'none', color: '#111', border: '1px solid #111', padding: '8px 12px', borderRadius: 8, fontSize: 14 }}>
          ← Back to Learners
        </Link>
      </div>

      {loading ? (
        <p style={{ color: '#555' }}>Loading…</p>
      ) : error ? (
        <p style={{ color: '#b00020' }}>{error}</p>
      ) : (
        <>
          {/* Teacher tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {TEACHERS.map(t => {
              const count = allItems.filter(it => it.teacher === t.key).length;
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    padding: '8px 14px',
                    border: `2px solid ${isActive ? t.color : '#e5e7eb'}`,
                    borderRadius: 8,
                    background: isActive ? t.color : '#fff',
                    color: isActive ? '#fff' : '#374151',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s',
                  }}
                >
                  <span>{t.emoji}</span>
                  <span>{t.label}</span>
                  {count > 0 && (
                    <span style={{
                      background: isActive ? 'rgba(255,255,255,0.3)' : t.color,
                      color: isActive ? '#fff' : '#fff',
                      borderRadius: 99,
                      padding: '1px 7px',
                      fontSize: 12,
                      fontWeight: 700,
                    }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sort controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Sort:</span>
            {[{ key: 'date', label: 'Newest first' }, { key: 'name', label: 'A → Z' }].map(opt => (
              <button
                key={opt.key}
                onClick={() => setSortOrder(opt.key)}
                style={{
                  padding: '4px 11px',
                  border: `1.5px solid ${sortOrder === opt.key ? '#111' : '#d1d5db'}`,
                  borderRadius: 6,
                  background: sortOrder === opt.key ? '#111' : '#fff',
                  color: sortOrder === opt.key ? '#fff' : '#374151',
                  fontSize: 13,
                  fontWeight: sortOrder === opt.key ? 600 : 400,
                  cursor: 'pointer',
                }}
              >{opt.label}</button>
            ))}
          </div>

          {/* Transcript list for selected teacher */}
          {sortedItemsForTab.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#6b7280', border: '1px dashed #e5e7eb', borderRadius: 8 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{TEACHERS.find(t => t.key === activeTab)?.emoji}</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No transcripts yet</div>
              <div style={{ fontSize: 14 }}>Transcripts will appear here after {TEACHERS.find(t => t.key === activeTab)?.label} sessions are completed.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {sortedItemsForTab.map((it, i) => (
                <div key={it.path || i} style={cardStyle}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.lessonId || 'Lesson'}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                      {it.updatedAt ? (
                        <span>{new Date(it.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                      ) : null}
                      <span>{it.kind ? it.kind.toUpperCase() : 'TXT'}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <a
                      href={it.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ padding: '7px 12px', border: '1px solid #111', borderRadius: 7, background: '#111', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}
                    >
                      Open
                    </a>
                    <a
                      href={it.url}
                      download
                      style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 7, background: '#fff', color: '#374151', textDecoration: 'none', fontSize: 14 }}
                    >
                      Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

