"use client";

import { useEffect, useState, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ensurePinAllowed } from '@/app/lib/pinGate';
import { getLearner } from '@/app/facilitator/learners/clientApi';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import EvidenceHistorySection from './EvidenceHistorySection';

const TEACHERS = [
  { key: 'sonoma', label: 'Ms. Sonoma', emoji: '👩🏻‍🦰', color: '#c7442e' },
  { key: 'webb',   label: 'Mrs. Webb',  emoji: '👩🏻‍🏫', color: '#0d9488' },
  { key: 'slate',  label: 'Mr. Slate',  emoji: '🤖',    color: '#6366f1' },
];

// ─── TXT Parser ─────────────────────────────────────────────────────────────
// Converts the raw .txt transcript into an array of typed entries for rendering.
function parseTxtTranscript(raw) {
  const lines = raw.split('\n');
  const out = [];
  let i = 0;

  const cur = () => (i < lines.length ? lines[i] : null);
  const skip = () => { i++; };

  // Skip leading blanks
  while (cur() !== null && !cur().trim()) skip();

  // Line 1: "Lesson Title — Transcript"
  if (cur() !== null) { out.push({ kind: 'title', text: cur().trim() }); skip(); }

  // Line 2: "Learner: Name"
  while (cur() !== null && !cur().trim()) skip();
  if (cur() !== null && cur().trim().startsWith('Learner:')) {
    out.push({ kind: 'learnerMeta', name: cur().trim().replace(/^Learner:\s*/, '') });
    skip();
  }

  // Remaining content
  while (cur() !== null) {
    const line = cur().trim();
    skip();
    if (!line || /^─+$/.test(line) || /^-{4,}$/.test(line)) continue;

    // "Session N  •  May 17, 2026  •  10:00 AM – 10:30 AM"
    if (/^Session \d+\s+[•·]/.test(line)) {
      out.push({ kind: 'sessionHeader', text: line }); continue;
    }

    // "[ Phase ]"
    if (/^\[\s*.+\s*\]$/.test(line)) {
      out.push({ kind: 'phase', text: line.replace(/^\[\s*/, '').replace(/\s*\]$/, '') }); continue;
    }

    // Date header for single-session: "May 17, 2026  •  10:00 AM"
    if (/^[A-Z][a-z]+ \d{1,2},\s*\d{4}/.test(line) && !/^Learner:/.test(line)) {
      out.push({ kind: 'dateHeader', text: line }); continue;
    }

    // Teacher line: "Ms. Sonoma: …" / "Mrs. Webb: …" / "Mr. Slate: …"
    const tMatch = line.match(/^(Ms\. Sonoma|Mrs\. Webb|Mr\. Slate):\s+([\s\S]*)/);
    if (tMatch) { out.push({ kind: 'teacher', speaker: tMatch[1], text: tMatch[2] }); continue; }

    // Learner line: "Learner: …"
    if (/^Learner:\s/.test(line)) {
      out.push({ kind: 'learner', text: line.replace(/^Learner:\s*/, '') }); continue;
    }
  }

  return out;
}

// ─── Transcript Viewer Overlay ───────────────────────────────────────────────
function TranscriptViewer({ item, learnerName, onClose }) {
  const teacherMeta = TEACHERS.find(t => t.key === item.teacher) || TEACHERS[0];
  const { color, label, emoji } = teacherMeta;
  const lightBg = color + '18';
  const borderColor = color + '30';

  const [entries, setEntries] = useState(null); // null = loading
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    if (item.kind !== 'txt') { setEntries([]); return; }
    let mounted = true;
    setEntries(null);
    setFetchError('');
    fetch(item.url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(text => { if (mounted) setEntries(parseTxtTranscript(text)); })
      .catch(e => { if (mounted) setFetchError(e.message || 'Failed to load'); });
    return () => { mounted = false; };
  }, [item.url, item.kind]);

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 720,
        maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>

        {/* ── Modal header ── */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.lessonId}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 5, flexWrap: 'wrap' }}>
              {learnerName && <span style={{ fontSize: 13, color: '#6b7280' }}>{learnerName}</span>}
              {learnerName && item.updatedAt && <span style={{ color: '#d1d5db', fontSize: 13 }}>·</span>}
              {item.updatedAt && (
                <span style={{ fontSize: 13, color: '#6b7280' }}>
                  {new Date(item.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              )}
              <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 9px', borderRadius: 99,
                background: color, color: '#fff', marginLeft: 2 }}>
                {emoji} {label}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <a href={item.url} download
              style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #d1d5db',
                background: '#f9fafb', color: '#374151', textDecoration: 'none',
                fontSize: 13, fontWeight: 500 }}>
              ↓ Download
            </a>
            <button onClick={onClose} aria-label="Close"
              style={{ width: 32, height: 32, border: 'none', borderRadius: 99,
                background: '#f3f4f6', cursor: 'pointer', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
              ✕
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 28px' }}>
          {entries === null && !fetchError ? (
            <div style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: '48px 0' }}>
              Loading transcript…
            </div>
          ) : fetchError ? (
            <div style={{ color: '#b00020', fontSize: 14, padding: '8px 0' }}>{fetchError}</div>
          ) : item.kind !== 'txt' ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#6b7280' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
              <div style={{ marginBottom: 10 }}>This transcript is a PDF file.</div>
              <a href={item.url} target="_blank" rel="noreferrer"
                style={{ color: color, fontWeight: 600, textDecoration: 'none' }}>
                Open PDF ↗
              </a>
            </div>
          ) : (
            <div>
              {(entries || []).map((entry, idx) => {
                if (entry.kind === 'title' || entry.kind === 'learnerMeta') return null;

                if (entry.kind === 'sessionHeader') return (
                  <div key={idx} style={{ margin: '24px 0 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ height: 1, flex: 1, background: '#e5e7eb' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af',
                      textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
                      {entry.text}
                    </span>
                    <div style={{ height: 1, flex: 1, background: '#e5e7eb' }} />
                  </div>
                );

                if (entry.kind === 'dateHeader') return (
                  <div key={idx} style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14, fontStyle: 'italic' }}>
                    {entry.text}
                  </div>
                );

                if (entry.kind === 'phase') return (
                  <div key={idx} style={{ margin: '16px 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
                      textTransform: 'uppercase', color: '#9ca3af',
                      padding: '2px 8px', border: '1px solid #e5e7eb', borderRadius: 4, background: '#f9fafb',
                      whiteSpace: 'nowrap' }}>
                      {entry.text}
                    </span>
                    <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
                  </div>
                );

                if (entry.kind === 'teacher') return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 99, background: color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, flexShrink: 0, marginTop: 2 }}>
                      {emoji}
                    </div>
                    <div style={{ maxWidth: '76%' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: color, marginBottom: 3 }}>
                        {entry.speaker}
                      </div>
                      <div style={{ background: lightBg, color: '#111', padding: '9px 13px',
                        borderRadius: '4px 14px 14px 14px', fontSize: 14, lineHeight: 1.55,
                        border: `1px solid ${borderColor}` }}>
                        {entry.text}
                      </div>
                    </div>
                  </div>
                );

                if (entry.kind === 'learner') return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                    <div style={{ maxWidth: '76%' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280',
                        marginBottom: 3, textAlign: 'right' }}>
                        Learner
                      </div>
                      <div style={{ background: '#f3f4f6', color: '#111', padding: '9px 13px',
                        borderRadius: '14px 4px 14px 14px', fontSize: 14, lineHeight: 1.55,
                        border: '1px solid #e5e7eb' }}>
                        {entry.text}
                      </div>
                    </div>
                  </div>
                );

                return null;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
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
  const [viewItem, setViewItem] = useState(null); // item being viewed in overlay
  const [evidenceEnabled, setEvidenceEnabled] = useState(true);
  const [evidenceReports, setEvidenceReports] = useState([]);
  const [evidenceLoading, setEvidenceLoading] = useState(true);
  const [evidenceError, setEvidenceError] = useState('');
  const [evidenceNextCursor, setEvidenceNextCursor] = useState(null);
  const [loadingMoreEvidence, setLoadingMoreEvidence] = useState(false);

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
        setEvidenceLoading(true);
        setEvidenceError('');
        const supabase = getSupabaseClient?.();
        const { data: { session } = {} } = supabase ? await supabase.auth.getSession() : {};
        const token = session?.access_token || '';
        const [meta, listResp, evidenceResult] = await Promise.all([
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
          fetch(`/api/facilitator/learners/${encodeURIComponent(learnerId)}/evidence?limit=10`, {
            cache: 'no-store',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }).then(async (r) => {
            const payload = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(payload?.error || `Status ${r.status}`);
            return { payload, error: null };
          }).catch((requestError) => ({ payload: null, error: requestError })),
        ]);
        if (!mounted) return;
        setLearnerName(meta?.name || '');
        setAllItems(Array.isArray(listResp?.items) ? listResp.items : []);
        const items = Array.isArray(listResp?.items) ? listResp.items : [];
        const firstWithData = TEACHERS.find(t => items.some(it => it.teacher === t.key));
        if (firstWithData) setActiveTab(firstWithData.key);
        if (evidenceResult?.error) {
          setEvidenceEnabled(true);
          setEvidenceReports([]);
          setEvidenceNextCursor(null);
          setEvidenceError(evidenceResult.error?.message || 'Failed to load learning evidence');
        } else {
          const evidencePayload = evidenceResult?.payload || {};
          setEvidenceEnabled(evidencePayload.enabled === true);
          setEvidenceReports(Array.isArray(evidencePayload.items) ? evidencePayload.items : []);
          setEvidenceNextCursor(evidencePayload?.pagination?.next_cursor || null);
        }
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load transcripts');
      } finally {
        if (mounted) {
          setLoading(false);
          setEvidenceLoading(false);
        }
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
        return dB - dA;
      });

  const handleView = useCallback(item => setViewItem(item), []);
  const handleCloseViewer = useCallback(() => setViewItem(null), []);

  const handleLoadMoreEvidence = useCallback(async () => {
    if (!evidenceNextCursor || loadingMoreEvidence) return;
    setLoadingMoreEvidence(true);
    setEvidenceError('');
    try {
      const supabase = getSupabaseClient?.();
      const { data: { session } = {} } = supabase ? await supabase.auth.getSession() : {};
      const token = session?.access_token || '';
      const response = await fetch(
        `/api/facilitator/learners/${encodeURIComponent(learnerId)}/evidence?limit=10&cursor=${encodeURIComponent(evidenceNextCursor)}`,
        {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Status ${response.status}`);
      const incoming = Array.isArray(payload.items) ? payload.items : [];
      setEvidenceReports((current) => {
        const seen = new Set(current.map((item) => String(item?.session?.id || '')));
        return [...current, ...incoming.filter((item) => !seen.has(String(item?.session?.id || '')))];
      });
      setEvidenceNextCursor(payload?.pagination?.next_cursor || null);
    } catch (requestError) {
      setEvidenceError(requestError?.message || 'Failed to load older learning evidence');
    } finally {
      setLoadingMoreEvidence(false);
    }
  }, [evidenceNextCursor, learnerId, loadingMoreEvidence]);

  const cardStyle = {
    border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff',
    padding: '12px 14px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: 12,
  };

  return (
    <>
      {/* Transcript viewer overlay */}
      {viewItem && (
        <TranscriptViewer
          item={viewItem}
          learnerName={learnerName}
          onClose={handleCloseViewer}
        />
      )}

      <main style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            Learning History{learnerName ? ` — ${learnerName}` : ''}
          </h1>
          <Link href="/facilitator/learners"
            style={{ textDecoration: 'none', color: '#111', border: '1px solid #111',
              padding: '8px 12px', borderRadius: 8, fontSize: 14 }}>
            ← Back to Learners
          </Link>
        </div>

        <EvidenceHistorySection
          enabled={evidenceEnabled}
          loading={evidenceLoading}
          error={evidenceError}
          reports={evidenceReports}
          transcripts={allItems}
          hasMore={!!evidenceNextCursor}
          loadingMore={loadingMoreEvidence}
          onLoadMore={handleLoadMoreEvidence}
          onOpenTranscript={handleView}
        />

        {loading ? (
          <p style={{ color: '#555' }}>Loading…</p>
        ) : error ? (
          <p style={{ color: '#b00020' }}>{error}</p>
        ) : (
          <>
            <div id="transcripts" style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Session transcripts</h2>
              <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
                Open the underlying session context where a transcript was saved.
              </p>
            </div>

            {/* Teacher tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {TEACHERS.map(t => {
                const count = allItems.filter(it => it.teacher === t.key).length;
                const isActive = activeTab === t.key;
                return (
                  <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                    padding: '8px 14px', border: `2px solid ${isActive ? t.color : '#e5e7eb'}`,
                    borderRadius: 8, background: isActive ? t.color : '#fff',
                    color: isActive ? '#fff' : '#374151', fontWeight: isActive ? 700 : 500,
                    fontSize: 14, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
                  }}>
                    <span>{t.emoji}</span>
                    <span>{t.label}</span>
                    {count > 0 && (
                      <span style={{ background: isActive ? 'rgba(255,255,255,0.3)' : t.color,
                        color: '#fff', borderRadius: 99, padding: '1px 7px',
                        fontSize: 12, fontWeight: 700 }}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Sort controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>Sort:</span>
              {[{ key: 'date', label: 'Newest first' }, { key: 'name', label: 'A → Z' }].map(opt => (
                <button key={opt.key} onClick={() => setSortOrder(opt.key)} style={{
                  padding: '4px 11px', border: `1.5px solid ${sortOrder === opt.key ? '#111' : '#d1d5db'}`,
                  borderRadius: 6, background: sortOrder === opt.key ? '#111' : '#fff',
                  color: sortOrder === opt.key ? '#fff' : '#374151',
                  fontSize: 13, fontWeight: sortOrder === opt.key ? 600 : 400, cursor: 'pointer',
                }}>{opt.label}</button>
              ))}
            </div>

            {/* Transcript list */}
            {sortedItemsForTab.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#6b7280',
                border: '1px dashed #e5e7eb', borderRadius: 8 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>
                  {TEACHERS.find(t => t.key === activeTab)?.emoji}
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No transcripts yet</div>
                <div style={{ fontSize: 14 }}>
                  Transcripts will appear here after {TEACHERS.find(t => t.key === activeTab)?.label} sessions are completed.
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {sortedItemsForTab.map((it, i) => (
                  <div key={it.path || i} style={cardStyle}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {it.lessonId || 'Lesson'}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                        {it.updatedAt && (
                          <span>{new Date(it.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                        )}
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 6px',
                          borderRadius: 4, background: '#f3f4f6', color: '#6b7280' }}>
                          {(it.kind || 'TXT').toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      {it.kind === 'txt' ? (
                        <button
                          onClick={() => handleView(it)}
                          style={{ padding: '7px 14px', border: 'none', borderRadius: 7,
                            background: '#111', color: '#fff', fontSize: 14, fontWeight: 600,
                            cursor: 'pointer' }}
                        >
                          View
                        </button>
                      ) : (
                        <a href={it.url} target="_blank" rel="noreferrer"
                          style={{ padding: '7px 14px', border: '1px solid #111', borderRadius: 7,
                            background: '#111', color: '#fff', textDecoration: 'none',
                            fontSize: 14, fontWeight: 600 }}>
                          Open
                        </a>
                      )}
                      <a href={it.url} download
                        style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 7,
                          background: '#fff', color: '#374151', textDecoration: 'none', fontSize: 14 }}>
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
    </>
  );
}
