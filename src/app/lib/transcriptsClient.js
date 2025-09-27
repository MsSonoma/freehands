// Transcripts persistence helper
// - Stores an append-only ledger JSON per owner/learner/lesson in Supabase Storage
// - Rebuilds a consolidated transcript.pdf from the ledger on each append (upsert)
// - Safe to no-op when Supabase env/session/learner are unavailable

import { jsPDF } from 'jspdf';
import { getSupabaseClient, hasSupabaseEnv } from '@/app/lib/supabaseClient';

const BUCKET = 'transcripts';
const VROOT = 'v1';

function pad2(n) { return String(n).padStart(2, '0'); }
function toLocalDateTime(ts) {
  try {
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = pad2(d.getMonth() + 1);
    const dd = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const mi = pad2(d.getMinutes());
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  } catch { return String(ts); }
}

function wrapLines(doc, text, maxWidth) {
  // jsPDF splitTextToSize wraps reasonably
  try { return doc.splitTextToSize(text, maxWidth); } catch { return [text]; }
}

function renderTranscriptPdf({ lessonTitle, learnerName, learnerId, lessonId, segments }) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' }); // 612x792
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 54; // 3/4 inch
  const maxW = pageW - margin * 2;

  const addHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(`${lessonTitle} — Transcript`, margin, margin);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const meta = [
      `Learner: ${learnerName || learnerId || 'Unknown'}`,
      `Lesson ID: ${lessonId}`,
    ];
    let y = margin + 20;
    meta.forEach(line => { doc.text(line, margin, y); y += 16; });
    return y + 8;
  };

  let y = addHeader();

  const addLine = (text, style = 'normal', color = '#000000') => {
    doc.setFont('helvetica', style);
    doc.setTextColor(color);
    const lines = wrapLines(doc, text, maxW);
    const height = lines.length * 14 + 6;
    if (y + height > pageH - margin) {
      doc.addPage();
      y = addHeader();
    }
    lines.forEach((ln) => { doc.text(ln, margin, y); y += 14; });
    y += 6;
  };

  (segments || []).forEach((seg, idx) => {
    const started = toLocalDateTime(seg?.startedAt || seg?.completedAt || Date.now());
    const completed = seg?.completedAt ? toLocalDateTime(seg.completedAt) : null;
    const label = completed ? `Session ${idx + 1} — ${started} to ${completed}` : `Session ${idx + 1} — ${started}`;
    addLine(label, 'bold');
    const lines = Array.isArray(seg?.lines) ? seg.lines : [];
    lines.forEach((ln) => {
      const role = (ln?.role || '').toLowerCase() === 'user' ? 'Learner' : 'Ms. Sonoma';
      const color = role === 'Learner' ? '#c7442e' : '#000000';
      const text = typeof ln?.text === 'string' ? ln.text : '';
      if (!text) return;
      addLine(`${role}: ${text}`, role === 'Learner' ? 'bold' : 'normal', color);
    });
    y += 10; // extra space between sessions
  });

  doc.setTextColor('#000000');
  return doc;
}

export async function appendTranscriptSegment({ learnerId, learnerName, lessonId, lessonTitle, segment }) {
  try {
    if (!hasSupabaseEnv() || !learnerId || learnerId === 'demo') return { ok: false, reason: 'no-env-or-demo' };
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, reason: 'no-client' };
    const { data: { session } } = await supabase.auth.getSession();
    const ownerId = session?.user?.id;
    if (!ownerId) return { ok: false, reason: 'no-owner' };

    const ledgerPath = `${VROOT}/${ownerId}/${learnerId}/${lessonId}/ledger.json`;
    const pdfPath = `${VROOT}/${ownerId}/${learnerId}/${lessonId}/transcript.pdf`;
    const store = supabase.storage.from(BUCKET);

    // Load prior ledger if exists
    let ledger = [];
    const dl = await store.download(ledgerPath);
    if (!dl.error && dl.data) {
      try { ledger = JSON.parse(await dl.data.text()); } catch {}
    }

    ledger.push({
      startedAt: segment?.startedAt || new Date().toISOString(),
      completedAt: segment?.completedAt || new Date().toISOString(),
      lines: Array.isArray(segment?.lines) ? segment.lines : [],
    });

    // Save ledger back (append-only semantics)
    const ledgerBlob = new Blob([JSON.stringify(ledger)], { type: 'application/json' });
    await store.upload(ledgerPath, ledgerBlob, { upsert: true, contentType: 'application/json' });

    // Rebuild PDF from ledger and upload
    const pdfDoc = renderTranscriptPdf({ lessonTitle, learnerName, learnerId, lessonId, segments: ledger });
    const pdfBlob = pdfDoc.output('blob');
    await store.upload(pdfPath, pdfBlob, { upsert: true, contentType: 'application/pdf' });

    return { ok: true, path: pdfPath };
  } catch (e) {
    console.warn('[transcripts] append failed', e);
    return { ok: false, reason: 'error', error: e };
  }
}

export async function listLearnerTranscriptPdfs(learnerId) {
  if (!hasSupabaseEnv()) return [];
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data: { session } } = await supabase.auth.getSession();
  const ownerId = session?.user?.id;
  if (!ownerId) return [];
  const store = supabase.storage.from(BUCKET);
  // List lesson folders
  const base = `${VROOT}/${ownerId}/${learnerId}`;
  const { data: lessons, error } = await store.list(base, { limit: 100, offset: 0 });
  if (error) return [];
  const out = [];
  for (const entry of lessons || []) {
    if (!entry || entry.name === undefined) continue;
    const path = `${base}/${entry.name}/transcript.pdf`;
    // Check existence by trying to create a short signed URL
    const { data: signed, error: sErr } = await store.createSignedUrl(path, 60 * 10);
    if (!sErr && signed?.signedUrl) {
      out.push({ lessonId: entry.name, path, url: signed.signedUrl });
    }
  }
  return out.sort((a,b) => a.lessonId.localeCompare(b.lessonId));
}

export default {
  appendTranscriptSegment,
  listLearnerTranscriptPdfs,
};
