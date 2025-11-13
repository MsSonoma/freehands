// Transcripts persistence helper
// - Stores an append-only ledger JSON per owner/learner/lesson in Supabase Storage
// - Rebuilds a consolidated transcript.pdf from the ledger on each append (upsert)
// - Safe to no-op when Supabase env/session/learner are unavailable

import { jsPDF } from 'jspdf';
import { getSupabaseClient, hasSupabaseEnv } from '@/app/lib/supabaseClient';

const BUCKET = 'transcripts';
const VROOT = 'v1';

const INVALID_LINE_PATTERNS = [
  /{"statusCode"\s*:\s*"400"\s*,\s*"error"\s*:\s*"InvalidJWT"/i,
  /"exp"\s*claim\s*timestamp\s*check\s*failed/i,
];

function sanitizeTranscriptLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === 'string') {
        const text = entry.replace(/\s+/g, ' ').trim();
        if (!text) return null;
        if (INVALID_LINE_PATTERNS.some((re) => re.test(text))) return null;
        return { role: 'assistant', text };
      }
      if (typeof entry === 'object') {
        const rawText = typeof entry.text === 'string' ? entry.text : '';
        const text = rawText.replace(/\s+/g, ' ').trim();
        if (!text) return null;
        if (INVALID_LINE_PATTERNS.some((re) => re.test(text))) return null;
        const role = entry.role === 'user' ? 'user' : 'assistant';
        return { role, text };
      }
      return null;
    })
    .filter(Boolean);
}

function sanitizeLedgerSegments(ledger) {
  if (!Array.isArray(ledger)) return [];
  const out = [];
  for (const seg of ledger) {
    const lines = sanitizeTranscriptLines(seg?.lines);
    if (!lines.length) continue;
    const startedAt = seg?.startedAt || seg?.completedAt || new Date().toISOString();
    const completedAt = seg?.completedAt ? seg.completedAt : undefined;
    const entry = { startedAt, lines };
    if (completedAt) entry.completedAt = completedAt;
    out.push(entry);
  }
  return out;
}

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

function renderTranscriptText({ lessonTitle, learnerName, learnerId, lessonId, segments }) {
  const lines = [];
  lines.push(`${lessonTitle} — Transcript`);
  const meta = [
    `Learner: ${learnerName || learnerId || 'Unknown'}`,
    `Lesson ID: ${lessonId}`,
  ];
  lines.push(...meta);
  lines.push('');
  (segments || []).forEach((seg, idx) => {
    const started = toLocalDateTime(seg?.startedAt || seg?.completedAt || Date.now());
    const completed = seg?.completedAt ? toLocalDateTime(seg.completedAt) : null;
    const header = completed ? `Session ${idx + 1} — ${started} to ${completed}` : `Session ${idx + 1} — ${started}`;
    lines.push(header);
    const segLines = Array.isArray(seg?.lines) ? seg.lines : [];
    segLines.forEach((ln) => {
      const role = (ln?.role || '').toLowerCase() === 'user' ? 'Learner' : 'Ms. Sonoma';
      const text = typeof ln?.text === 'string' ? ln.text : '';
      if (text) lines.push(`${role}: ${text}`);
    });
    lines.push('');
  });
  return lines.join('\n');
}

function escapeRtf(text = '') {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\r?\n/g, '\\par ');
}

function renderTranscriptRtf({ lessonTitle, learnerName, learnerId, lessonId, segments }) {
  const header = '{\\rtf1\\ansi\\deff0\n';
  const parts = [];
  parts.push(escapeRtf(`${lessonTitle} — Transcript`));
  parts.push('\\par ');
  parts.push(escapeRtf(`Learner: ${learnerName || learnerId || 'Unknown'}`));
  parts.push('\\par ');
  parts.push(escapeRtf(`Lesson ID: ${lessonId}`));
  parts.push('\\par \\par ');
  (segments || []).forEach((seg, idx) => {
    const started = toLocalDateTime(seg?.startedAt || seg?.completedAt || Date.now());
    const completed = seg?.completedAt ? toLocalDateTime(seg.completedAt) : null;
    const headerLine = completed ? `Session ${idx + 1} — ${started} to ${completed}` : `Session ${idx + 1} — ${started}`;
    parts.push(escapeRtf(headerLine));
    parts.push('\\par ');
    const segLines = Array.isArray(seg?.lines) ? seg.lines : [];
    segLines.forEach((ln) => {
      const role = (ln?.role || '').toLowerCase() === 'user' ? 'Learner' : 'Ms. Sonoma';
      const text = typeof ln?.text === 'string' ? ln.text : '';
      if (text) {
        parts.push(escapeRtf(`${role}: ${text}`));
        parts.push('\\par ');
      }
    });
    parts.push('\\par ');
  });
  const body = parts.join('');
  return `${header}${body}}`;
}

// Internal helper: load a JSON ledger at path (if exists)
async function loadLedger(store, path) {
  try {
    const dl = await store.download(path);
    if (dl.error) {
      // 404 is expected for new ledgers; other errors may indicate config issues
      if (dl.error.statusCode !== 404 && dl.error.statusCode !== '404') {
        console.warn(`[transcripts] Download error for ${path}:`, dl.error);
      }
      return [];
    }
    if (dl.data) {
      try { return JSON.parse(await dl.data.text()); } catch {}
    }
  } catch {}
  return [];
}

// Internal helper: write ledger and rebuild/upload PDF at a given lesson base path
async function writeLedgerAndArtifacts(store, { basePath, lessonTitle, learnerName, learnerId, lessonId, ledger }) {
  const ledgerPath = `${basePath}/ledger.json`;
  const pdfPath = `${basePath}/transcript.pdf`;
  const txtPath = `${basePath}/transcript.txt`;
  const rtfPath = `${basePath}/transcript.rtf`;
  const sanitizedLedger = sanitizeLedgerSegments(ledger);

  if (!sanitizedLedger.length) {
    try { await store.remove([ledgerPath, pdfPath, txtPath, rtfPath]); } catch {}
    return { removed: true };
  }

  const ledgerBlob = new Blob([JSON.stringify(sanitizedLedger)], { type: 'application/json' });

  const ledgerResult = await store.upload(ledgerPath, ledgerBlob, { upsert: true, contentType: 'application/json' });
  if (ledgerResult.error) {
    console.error('[transcripts] Storage upload failed. Bucket "transcripts" may not exist or RLS policies may not be configured. See docs/transcripts-storage.md', ledgerResult.error);
    throw new Error(`Storage upload failed: ${ledgerResult.error.message}`);
  }
  
  // PDF
  const pdfDoc = renderTranscriptPdf({ lessonTitle, learnerName, learnerId, lessonId, segments: sanitizedLedger });
  const pdfBlob = pdfDoc.output('blob');
  const pdfResult = await store.upload(pdfPath, pdfBlob, { upsert: true, contentType: 'application/pdf' });
  if (pdfResult.error) throw new Error(`PDF upload failed: ${pdfResult.error.message}`);
  
  // TXT
  const txt = renderTranscriptText({ lessonTitle, learnerName, learnerId, lessonId, segments: sanitizedLedger });
  const txtBlob = new Blob([txt], { type: 'text/plain' });
  const txtResult = await store.upload(txtPath, txtBlob, { upsert: true, contentType: 'text/plain; charset=utf-8' });
  if (txtResult.error) throw new Error(`TXT upload failed: ${txtResult.error.message}`);
  
  // Clean up legacy RTF file if it exists
  try { await store.remove([rtfPath]); } catch {}
  
  return { pdfPath, txtPath };
}

export async function appendTranscriptSegment({ learnerId, learnerName, lessonId, lessonTitle, segment, sessionId }) {
  try {
    if (!hasSupabaseEnv() || !learnerId || learnerId === 'demo') return { ok: false, reason: 'no-env-or-demo' };
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, reason: 'no-client' };
    const { data: { session } } = await supabase.auth.getSession();
    const ownerId = session?.user?.id;
    if (!ownerId) return { ok: false, reason: 'no-owner' };

    const store = supabase.storage.from(BUCKET);
    const baseLessonPath = `${VROOT}/${ownerId}/${learnerId}/${lessonId}`;
    const sessionBasePath = sessionId ? `${baseLessonPath}/sessions/${sessionId}` : null;
    const sanitizedSegment = {
      startedAt: segment?.startedAt || new Date().toISOString(),
      completedAt: segment?.completedAt || new Date().toISOString(),
      lines: sanitizeTranscriptLines(segment?.lines),
    };

    const cloneSegment = () => ({
      startedAt: sanitizedSegment.startedAt,
      completedAt: sanitizedSegment.completedAt,
      lines: sanitizedSegment.lines.map((ln) => ({ ...ln })),
    });

    // 1) Update per-session ledger/PDF when sessionId provided
    let lastSessionFile = null;
    if (sessionBasePath) {
      let sLedger = sanitizeLedgerSegments(await loadLedger(store, `${sessionBasePath}/ledger.json`));
      if (sanitizedSegment.lines.length) {
        sLedger.push(cloneSegment());
      }
      const sesOut = await writeLedgerAndArtifacts(store, {
        basePath: sessionBasePath, lessonTitle, learnerName, learnerId, lessonId, ledger: sLedger,
      });
      lastSessionFile = sesOut?.txtPath || sesOut?.pdfPath;
    }

    // 2) Always update consolidated per-lesson ledger/PDF for facilitator convenience
    let ledger = sanitizeLedgerSegments(await loadLedger(store, `${baseLessonPath}/ledger.json`));
    if (sanitizedSegment.lines.length) {
      ledger.push(cloneSegment());
    }
    const consolidatedOut = await writeLedgerAndArtifacts(store, {
      basePath: baseLessonPath, lessonTitle, learnerName, learnerId, lessonId, ledger,
    });
    const consolidatedFile = consolidatedOut?.txtPath || consolidatedOut?.pdfPath;
    return { ok: true, path: lastSessionFile || consolidatedFile };
  } catch (e) {
    // Storage errors are often due to missing bucket or RLS policies
    const isStorageError = e?.message?.includes('Storage') || e?.message?.includes('upload failed');
    if (isStorageError) {
      console.error('[transcripts] Storage configuration required. Please set up the "transcripts" bucket and RLS policies per docs/transcripts-storage.md', e);
    } else {
      console.warn('[transcripts] append failed', e);
    }
    return { ok: false, reason: 'error', error: e };
  }
}

// Live updater: upsert the current segment (by startedAt) instead of always pushing a new one.
// Use this to keep the ledger and PDF in sync during autosaves without creating many tiny segments.
export async function updateTranscriptLiveSegment({ learnerId, learnerName, lessonId, lessonTitle, startedAt, lines, sessionId }) {
  try {
    if (!hasSupabaseEnv() || !learnerId || learnerId === 'demo') return { ok: false, reason: 'no-env-or-demo' };
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, reason: 'no-client' };
    const { data: { session } } = await supabase.auth.getSession();
    const ownerId = session?.user?.id;
    if (!ownerId) return { ok: false, reason: 'no-owner' };
    const store = supabase.storage.from(BUCKET);

    const baseLessonPath = `${VROOT}/${ownerId}/${learnerId}/${lessonId}`;
    const sessionBasePath = sessionId ? `${baseLessonPath}/sessions/${sessionId}` : null;

    const nowIso = new Date().toISOString();
    const safeStarted = startedAt || nowIso;
    const safeLines = sanitizeTranscriptLines(lines);

    // Helper to upsert one ledger
    const upsertOne = async (basePath) => {
      let ledger = sanitizeLedgerSegments(await loadLedger(store, `${basePath}/ledger.json`));
      const idx = ledger.findIndex((seg) => seg?.startedAt === safeStarted);
      if (safeLines.length === 0) {
        if (idx !== -1) ledger.splice(idx, 1);
      } else if (idx !== -1) {
        ledger[idx] = { ...ledger[idx], completedAt: nowIso, lines: safeLines.map((ln) => ({ ...ln })) };
      } else {
        ledger.push({
          startedAt: safeStarted,
          completedAt: nowIso,
          lines: safeLines.map((ln) => ({ ...ln })),
        });
      }
      const out = await writeLedgerAndArtifacts(store, { basePath, lessonTitle, learnerName, learnerId, lessonId, ledger });
      return out?.txtPath || out?.pdfPath;
    };

    // Update per-session (if provided) and consolidated per-lesson
    let lastPdf = null;
    if (sessionBasePath) {
      lastPdf = await upsertOne(sessionBasePath);
    }
    const consolidatedPdf = await upsertOne(baseLessonPath);

    return { ok: true, path: lastPdf || consolidatedPdf };
  } catch (e) {
    const isStorageError = e?.message?.includes('Storage') || e?.message?.includes('upload failed');
    if (isStorageError) {
      console.error('[transcripts] Storage configuration required. Please set up the "transcripts" bucket and RLS policies per docs/transcripts-storage.md', e);
    } else {
      console.warn('[transcripts] live update failed', e);
    }
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
    const lessonBase = `${base}/${entry.name}`;
    // Top-level consolidated artifacts: prefer TXT, then RTF, fallback to PDF
    {
      // Try TXT first
      const txtPath = `${lessonBase}/transcript.txt`;
      const { data: signedTxt, error: errTxt } = await store.createSignedUrl(txtPath, 60 * 10);
      if (!errTxt && signedTxt?.signedUrl) {
        out.push({ lessonId: entry.name, path: txtPath, url: signedTxt.signedUrl, kind: 'txt' });
      } else {
        const rtfPath = `${lessonBase}/transcript.rtf`;
        const { data: signedRtf, error: errRtf } = await store.createSignedUrl(rtfPath, 60 * 10);
        if (!errRtf && signedRtf?.signedUrl) {
          out.push({ lessonId: entry.name, path: rtfPath, url: signedRtf.signedUrl, kind: 'rtf' });
        } else {
          const pdfPath = `${lessonBase}/transcript.pdf`;
          const { data: signedPdf, error: errPdf } = await store.createSignedUrl(pdfPath, 60 * 10);
          if (!errPdf && signedPdf?.signedUrl) {
            out.push({ lessonId: entry.name, path: pdfPath, url: signedPdf.signedUrl, kind: 'pdf' });
          }
        }
      }
    }
    // Per-session PDFs under sessions/<id>/transcript.pdf
    const { data: sessionsList } = await store.list(`${lessonBase}/sessions`, { limit: 100, offset: 0 });
    for (const ses of sessionsList || []) {
      if (!ses || typeof ses.name !== 'string') continue;
      // Prefer TXT, then RTF, fallback to PDF
      const stxt = `${lessonBase}/sessions/${ses.name}/transcript.txt`;
      const { data: stxtSigned, error: stxtErr } = await store.createSignedUrl(stxt, 60 * 10);
      if (!stxtErr && stxtSigned?.signedUrl) {
        out.push({ lessonId: `${entry.name} — ${ses.name}`, path: stxt, url: stxtSigned.signedUrl, kind: 'txt' });
      } else {
        const srtf = `${lessonBase}/sessions/${ses.name}/transcript.rtf`;
        const { data: srtfSigned, error: srtfErr } = await store.createSignedUrl(srtf, 60 * 10);
        if (!srtfErr && srtfSigned?.signedUrl) {
          out.push({ lessonId: `${entry.name} — ${ses.name}`, path: srtf, url: srtfSigned.signedUrl, kind: 'rtf' });
        } else {
          const spdf = `${lessonBase}/sessions/${ses.name}/transcript.pdf`;
          const { data: spdfSigned, error: spdfErr } = await store.createSignedUrl(spdf, 60 * 10);
          if (!spdfErr && spdfSigned?.signedUrl) {
            out.push({ lessonId: `${entry.name} — ${ses.name}`, path: spdf, url: spdfSigned.signedUrl, kind: 'pdf' });
          }
        }
      }
    }
  }
  return out.sort((a,b) => a.lessonId.localeCompare(b.lessonId));
}

export default {
  appendTranscriptSegment,
  updateTranscriptLiveSegment,
  listLearnerTranscriptPdfs,
};

export {
  sanitizeTranscriptLines,
  sanitizeLedgerSegments,
  writeLedgerAndArtifacts,
};
