// Transcripts persistence helper
// - Stores an append-only ledger JSON per owner/learner/lesson in Supabase Storage
// - Rebuilds a consolidated transcript.pdf from the ledger on each append (upsert)
// - Safe to no-op when Supabase env/session/learner are unavailable

import { jsPDF } from 'jspdf';
import { getSupabaseClient, hasSupabaseEnv } from '@/app/lib/supabaseClient';

const BUCKET = 'transcripts';
const VROOT = 'v1';

const TEACHER_NAMES = {
  sonoma: 'Ms. Sonoma',
  webb: 'Mrs. Webb',
  slate: 'Mr. Slate',
};

export function getTeacherDisplayName(teacher) {
  return TEACHER_NAMES[teacher] || 'Ms. Sonoma';
}

// Returns the base lesson path in storage. Webb and Slate use a teacher sub-folder;
// Sonoma (and legacy entries) use the flat v1/{owner}/{learner}/{lesson} path.
function getLessonBasePath(ownerId, learnerId, teacher, lessonId) {
  const t = teacher && teacher !== 'sonoma' ? teacher : null;
  return t
    ? `${VROOT}/${ownerId}/${learnerId}/${t}/${lessonId}`
    : `${VROOT}/${ownerId}/${learnerId}/${lessonId}`;
}

const INVALID_LINE_PATTERNS = [
  /{"statusCode"\s*:\s*"400"\s*,\s*"error"\s*:\s*"InvalidJWT"/i,
  /"exp"\s*claim\s*timestamp\s*check\s*failed/i,
];

// Mirror the same pre-processing applied in the TTS API routes so transcript text
// matches what is actually spoken rather than the raw lesson JSON.
function _normalizeFractionsForSpeech(text) {
  if (!text) return text;
  const ordinals = {
    2: ['half', 'halves'], 3: ['third', 'thirds'], 4: ['fourth', 'fourths'],
    5: ['fifth', 'fifths'], 6: ['sixth', 'sixths'], 7: ['seventh', 'sevenths'],
    8: ['eighth', 'eighths'], 9: ['ninth', 'ninths'], 10: ['tenth', 'tenths'],
    12: ['twelfth', 'twelfths'], 16: ['sixteenth', 'sixteenths'], 100: ['hundredth', 'hundredths'],
  };
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  return String(text).replace(/\b(\d{1,2})\/(\d{1,3})\b/g, (match, ns, ds) => {
    const n = parseInt(ns, 10), d = parseInt(ds, 10);
    if (n >= d || !ordinals[d]) return match;
    const nWord = n <= 20 ? ones[n] : ns;
    return `${nWord} ${n === 1 ? ordinals[d][0] : ordinals[d][1]}`;
  });
}

function _stripForTranscript(rawText) {
  return String(rawText)
    // Normalize typographic apostrophes/quotes to ASCII (mirrors TTS route)
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    // Strip emoji and stray symbols
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{2300}-\u{23FF}]/gu, '')
    .replace(/[\u{2B00}-\u{2BFF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/\u{20E3}/gu, '')
    // Strip markdown formatting (* _ `)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    // Convert numeric fractions to spoken form
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeTranscriptText(text) {
  return _normalizeFractionsForSpeech(_stripForTranscript(text));
}

function sanitizeTranscriptLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === 'string') {
        const text = normalizeTranscriptText(entry.replace(/\s+/g, ' ').trim());
        if (!text) return null;
        if (INVALID_LINE_PATTERNS.some((re) => re.test(text))) return null;
        return { role: 'assistant', text };
      }
      if (typeof entry === 'object') {
        const rawText = typeof entry.text === 'string' ? entry.text : '';
        const text = normalizeTranscriptText(rawText.replace(/\s+/g, ' ').trim());
        if (!text) return null;
        if (INVALID_LINE_PATTERNS.some((re) => re.test(text))) return null;
        const role = entry.role === 'user' ? 'user' : 'assistant';
        const phase = typeof entry.phase === 'string' && entry.phase ? entry.phase : undefined;
        return { role, text, ...(phase ? { phase } : {}) };
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

function formatPhaseLabel(phase) {
  if (!phase) return null;
  const NAMES = {
    discussion: 'Discussion', teaching: 'Teaching', exercise: 'Exercise',
    test: 'Test', opening: 'Opening', closing: 'Closing',
    comprehension: 'Comprehension', worksheet: 'Worksheet', overview: 'Overview',
  };
  return NAMES[String(phase).toLowerCase()] || String(phase).charAt(0).toUpperCase() + String(phase).slice(1);
}

function pad2(n) { return String(n).padStart(2, '0'); }
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function toLocalDateTime(ts) {
  try {
    const d = new Date(ts);
    const month = MONTHS[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();
    const hh = d.getHours();
    const mi = pad2(d.getMinutes());
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h = hh % 12 || 12;
    return `${month} ${day}, ${year} – ${h}:${mi} ${ampm}`;
  } catch { return String(ts); }
}
function toLocalDate(ts) {
  try {
    const d = new Date(ts);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  } catch { return String(ts); }
}
function toLocalTime(ts) {
  try {
    const d = new Date(ts);
    const hh = d.getHours();
    const mi = pad2(d.getMinutes());
    const ampm = hh >= 12 ? 'PM' : 'AM';
    return `${hh % 12 || 12}:${mi} ${ampm}`;
  } catch { return String(ts); }
}

function wrapLines(doc, text, maxWidth) {
  // jsPDF splitTextToSize wraps reasonably
  try { return doc.splitTextToSize(text, maxWidth); } catch { return [text]; }
}

function renderTranscriptPdf({ lessonTitle, learnerName, learnerId, lessonId, segments, teacherDisplayName = 'Ms. Sonoma' }) {
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
    let y = margin + 20;
    doc.text(`Learner: ${learnerName || learnerId || 'Unknown'}`, margin, y); y += 16;
    return y + 8;
  };

  let y = addHeader();

  const addLine = (text, style = 'normal', color = '#000000', extraSpaceAfter = 0) => {
    doc.setFont('helvetica', style);
    doc.setTextColor(color);
    const lines = wrapLines(doc, text, maxW);
    const height = lines.length * 14 + 6 + extraSpaceAfter;
    if (y + height > pageH - margin) {
      doc.addPage();
      y = addHeader();
    }
    lines.forEach((ln) => { doc.text(ln, margin, y); y += 14; });
    y += 6 + extraSpaceAfter;
  };

  const multiSeg = (segments || []).length > 1;

  (segments || []).forEach((seg, idx) => {
    const ts = seg?.startedAt || seg?.completedAt || Date.now();
    const dateStr = toLocalDate(ts);
    const startTime = toLocalTime(ts);
    const endTime = seg?.completedAt ? toLocalTime(seg.completedAt) : null;
    if (multiSeg) {
      if (idx > 0) y += 10;
      const label = endTime ? `Session ${idx + 1}  •  ${dateStr}  •  ${startTime} – ${endTime}` : `Session ${idx + 1}  •  ${dateStr}  •  ${startTime}`;
      addLine(label, 'bold', '#374151', 4);
    } else {
      const label = endTime ? `${dateStr}  •  ${startTime} – ${endTime}` : `${dateStr}  •  ${startTime}`;
      addLine(label, 'normal', '#6b7280', 4);
    }
    const lines = Array.isArray(seg?.lines) ? seg.lines : [];
    let currentPhaseLabel = null;
    let prevRole = null;
    lines.forEach((ln) => {
      const phaseLabel = formatPhaseLabel(ln?.phase);
      if (phaseLabel && phaseLabel !== currentPhaseLabel) {
        currentPhaseLabel = phaseLabel;
        y += 6;
        addLine(`[ ${phaseLabel} ]`, 'bold', '#555555', 4);
        prevRole = null;
      }
      const role = (ln?.role || '').toLowerCase() === 'user' ? 'Learner' : teacherDisplayName;
      const color = role === 'Learner' ? '#c7442e' : '#111111';
      const text = typeof ln?.text === 'string' ? ln.text : '';
      if (!text) return;
      if (prevRole && prevRole !== role) y += 4;
      addLine(`${role}: ${text}`, role === 'Learner' ? 'bold' : 'normal', color);
      prevRole = role;
    });
  });

  doc.setTextColor('#000000');
  return doc;
}

function renderTranscriptText({ lessonTitle, learnerName, learnerId, lessonId, segments, teacherDisplayName = 'Ms. Sonoma' }) {
  const lines = [];
  lines.push(`${lessonTitle} — Transcript`);
  lines.push(`Learner: ${learnerName || learnerId || 'Unknown'}`);
  lines.push('');
  const multiSeg = (segments || []).length > 1;
  (segments || []).forEach((seg, idx) => {
    const ts = seg?.startedAt || seg?.completedAt || Date.now();
    const dateStr = toLocalDate(ts);
    const startTime = toLocalTime(ts);
    const endTime = seg?.completedAt ? toLocalTime(seg.completedAt) : null;
    if (multiSeg) {
      if (idx > 0) lines.push('');
      const header = endTime
        ? `Session ${idx + 1}  •  ${dateStr}  •  ${startTime} – ${endTime}`
        : `Session ${idx + 1}  •  ${dateStr}  •  ${startTime}`;
      lines.push(header);
      lines.push('─'.repeat(header.length));
    } else {
      const header = endTime ? `${dateStr}  •  ${startTime} – ${endTime}` : `${dateStr}  •  ${startTime}`;
      lines.push(header);
    }
    lines.push('');
    const segLines = Array.isArray(seg?.lines) ? seg.lines : [];
    let currentPhaseLabel = null;
    let prevRole = null;
    segLines.forEach((ln) => {
      const phaseLabel = formatPhaseLabel(ln?.phase);
      if (phaseLabel && phaseLabel !== currentPhaseLabel) {
        currentPhaseLabel = phaseLabel;
        if (prevRole) lines.push('');
        lines.push(`[ ${phaseLabel} ]`);
        lines.push('');
        prevRole = null;
      }
      const role = (ln?.role || '').toLowerCase() === 'user' ? 'Learner' : teacherDisplayName;
      const text = typeof ln?.text === 'string' ? ln.text : '';
      if (!text) return;
      if (prevRole && prevRole !== role) lines.push('');
      lines.push(`${role}: ${text}`);
      prevRole = role;
    });
    if (multiSeg) lines.push('');
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
        // Download error (not 404)
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
async function writeLedgerAndArtifacts(store, { basePath, lessonTitle, learnerName, learnerId, lessonId, ledger, teacherDisplayName = 'Ms. Sonoma' }) {
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
    // Storage upload failed - check bucket/RLS configuration
    throw new Error(`Storage upload failed: ${ledgerResult.error.message}`);
  }
  
  // PDF
  const pdfDoc = renderTranscriptPdf({ lessonTitle, learnerName, learnerId, lessonId, segments: sanitizedLedger, teacherDisplayName });
  const pdfBlob = pdfDoc.output('blob');
  const pdfResult = await store.upload(pdfPath, pdfBlob, { upsert: true, contentType: 'application/pdf' });
  if (pdfResult.error) throw new Error(`PDF upload failed: ${pdfResult.error.message}`);
  
  // TXT
  const txt = renderTranscriptText({ lessonTitle, learnerName, learnerId, lessonId, segments: sanitizedLedger, teacherDisplayName });
  const txtBlob = new Blob([txt], { type: 'text/plain' });
  const txtResult = await store.upload(txtPath, txtBlob, { upsert: true, contentType: 'text/plain; charset=utf-8' });
  if (txtResult.error) throw new Error(`TXT upload failed: ${txtResult.error.message}`);
  
  // Clean up legacy RTF file if it exists
  try { await store.remove([rtfPath]); } catch {}
  
  return { pdfPath, txtPath };
}

export async function appendTranscriptSegment({ learnerId, learnerName, lessonId, lessonTitle, segment, sessionId, teacher }) {
  try {
    if (!hasSupabaseEnv() || !learnerId || learnerId === 'demo') return { ok: false, reason: 'no-env-or-demo' };
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, reason: 'no-client' };
    const { data: { session } } = await supabase.auth.getSession();
    const ownerId = session?.user?.id;
    if (!ownerId) return { ok: false, reason: 'no-owner' };

    const store = supabase.storage.from(BUCKET);
    const teacherDisplayName = getTeacherDisplayName(teacher);
    const baseLessonPath = getLessonBasePath(ownerId, learnerId, teacher, lessonId);
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
        const sExistIdx = sLedger.findIndex((s) => s?.startedAt === sanitizedSegment.startedAt);
        if (sExistIdx !== -1) { sLedger[sExistIdx] = cloneSegment(); } else { sLedger.push(cloneSegment()); }
      }
      const sesOut = await writeLedgerAndArtifacts(store, {
        basePath: sessionBasePath, lessonTitle, learnerName, learnerId, lessonId, ledger: sLedger, teacherDisplayName,
      });
      lastSessionFile = sesOut?.txtPath || sesOut?.pdfPath;
    }

    // 2) Always update consolidated per-lesson ledger/PDF for facilitator convenience
    let ledger = sanitizeLedgerSegments(await loadLedger(store, `${baseLessonPath}/ledger.json`));
    if (sanitizedSegment.lines.length) {
      // Upsert by startedAt so autosave + sessionComplete don't create duplicate segments
      const existIdx = ledger.findIndex((s) => s?.startedAt === sanitizedSegment.startedAt);
      if (existIdx !== -1) { ledger[existIdx] = cloneSegment(); } else { ledger.push(cloneSegment()); }
    }
    const consolidatedOut = await writeLedgerAndArtifacts(store, {
      basePath: baseLessonPath, lessonTitle, learnerName, learnerId, lessonId, ledger, teacherDisplayName,
    });
    const consolidatedFile = consolidatedOut?.txtPath || consolidatedOut?.pdfPath;
    return { ok: true, path: lastSessionFile || consolidatedFile };
  } catch (e) {
    console.error('[Transcripts] appendTranscriptSegment failed:', e?.message || e);
    return { ok: false, reason: 'error', error: e };
  }
}

// Live updater: upsert the current segment (by startedAt) instead of always pushing a new one.
// Use this to keep the ledger and PDF in sync during autosaves without creating many tiny segments.
export async function updateTranscriptLiveSegment({ learnerId, learnerName, lessonId, lessonTitle, startedAt, lines, sessionId, teacher }) {
  try {
    if (!hasSupabaseEnv() || !learnerId || learnerId === 'demo') return { ok: false, reason: 'no-env-or-demo' };
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, reason: 'no-client' };
    const { data: { session } } = await supabase.auth.getSession();
    const ownerId = session?.user?.id;
    if (!ownerId) return { ok: false, reason: 'no-owner' };
    const store = supabase.storage.from(BUCKET);

    const teacherDisplayName = getTeacherDisplayName(teacher);
    const baseLessonPath = getLessonBasePath(ownerId, learnerId, teacher, lessonId);
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
      const out = await writeLedgerAndArtifacts(store, { basePath, lessonTitle, learnerName, learnerId, lessonId, ledger, teacherDisplayName });
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
    console.error('[Transcripts] updateTranscriptLiveSegment failed:', e?.message || e);
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
  getTeacherDisplayName,
};

export {
  sanitizeTranscriptLines,
  sanitizeLedgerSegments,
  writeLedgerAndArtifacts,
};
