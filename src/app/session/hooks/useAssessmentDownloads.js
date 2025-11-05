/**
 * useAssessmentDownloads Hook
 * 
 * Handles PDF generation and download for:
 * - Worksheet PDFs (student-facing questions)
 * - Test PDFs (student-facing questions)
 * - Combined Facilitator Key (notes, vocab, worksheet + test answers in single page)
 * - Refresh/regenerate assessment sets
 * 
 * Dependencies: jsPDF for PDF generation, assessment storage, PIN validation
 */

import { useCallback } from 'react';

export function useAssessmentDownloads({
  // State
  lessonData,
  manifestInfo,
  lessonParam,
  subjectParam,
  generatedWorksheet,
  generatedTest,
  compPool,
  exercisePool,
  worksheetSourceFull,
  testSourceFull,
  
  // Setters
  setDownloadError,
  setGeneratedWorksheet,
  setGeneratedTest,
  setCurrentWorksheetIndex,
  setTestActiveIndex,
  setTestUserAnswers,
  
  // Refs
  worksheetIndexRef,
  
  // Functions
  ensurePinAllowed,
  showTipOverride,
  getAssessmentStorageKey,
  getSnapshotStorageKey,
  saveAssessments,
  clearAssessments,
  ensureExactCount,
  promptKey,
  createPdfForItems,
  shareOrPreviewPdf,
  ensureRuntimeTargets,
  // REMOVED: reserveSamples - deprecated zombie code
  reserveWords,
  jsPDF,
  
  // Constants
  WORKSHEET_TARGET,
  TEST_TARGET
}) {
  
  /**
   * Generate worksheet/test content synchronously if not already generated
   * Consolidates duplicate logic between handleDownloadWorksheet and handleDownloadTest
   */
  const generateAssessmentIfNeeded = useCallback((type = 'worksheet', target) => {
    if (!lessonData) return null;
    
    const shuffle = (arr) => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    let source = null;

    if (subjectParam === 'math') {
      // REMOVED: samples array - deprecated zombie code
      const words = Array.isArray(lessonData.wordProblems) ? lessonData.wordProblems.map(q => ({ ...q, sourceType: 'word' })) : [];
      const tf = Array.isArray(lessonData.truefalse) ? lessonData.truefalse.map(q => ({ ...q, sourceType: 'tf' })) : [];
      const mc = Array.isArray(lessonData.multiplechoice) ? lessonData.multiplechoice.map(q => ({ ...q, sourceType: 'mc' })) : [];
      const fib = Array.isArray(lessonData.fillintheblank) ? lessonData.fillintheblank.map(q => ({ ...q, sourceType: 'fib' })) : [];
      const sa = Array.isArray(lessonData.shortanswer) ? lessonData.shortanswer.map(q => ({ ...q, sourceType: 'short' })) : [];
      const cats = [...tf, ...mc, ...fib, ...sa];
      
      const desiredWp = Math.round(target * 0.3);
      const wpSel = shuffle(words).slice(0, Math.min(desiredWp, words.length));
      
      // For test type, add expected field mapping
      const wpMapped = type === 'test' 
        ? wpSel.map(q => ({ ...q, expected: q.expected ?? q.answer, sourceType: 'word' }))
        : wpSel;
      
      // Cap SA/FIB to 10% each in remainder from categories only
      const remainder = Math.max(0, target - wpMapped.length);
      const cap = Math.max(0, Math.floor(target * 0.10));
      const fromBase = shuffle(cats); // Use only categories, no samples
      const saArr = fromBase.filter(q => /short\s*answer|shortanswer/i.test(String(q?.type||'')) || String(q?.sourceType||'') === 'short');
      const fibArr = fromBase.filter(q => /fill\s*in\s*the\s*blank|fillintheblank/i.test(String(q?.type||'')) || String(q?.sourceType||'') === 'fib');
      const others = fromBase.filter(q => !saArr.includes(q) && !fibArr.includes(q));
      const saPick = saArr.slice(0, Math.min(cap, saArr.length));
      const fibPick = fibArr.slice(0, Math.min(cap, fibArr.length));
      const remaining = Math.max(0, remainder - saPick.length - fibPick.length);
      const otherPick = others.slice(0, remaining);
      const base = shuffle([...wpMapped, ...saPick, ...fibPick, ...otherPick]);
      const used = new Set(base.map(promptKey));
      const remBase = shuffle(cats).filter(q => !used.has(promptKey(q)));
      const remWords = shuffle(words).filter(q => !used.has(promptKey(q)));
      source = ensureExactCount(base, target, [remBase, remWords]);
    } else {
      // Non-math subjects
      const tf = Array.isArray(lessonData.truefalse) ? lessonData.truefalse.map(q => ({ ...q, sourceType: 'tf' })) : [];
      const mc = Array.isArray(lessonData.multiplechoice) ? lessonData.multiplechoice.map(q => ({ ...q, sourceType: 'mc' })) : [];
      const fib = Array.isArray(lessonData.fillintheblank) ? lessonData.fillintheblank.map(q => ({ ...q, sourceType: 'fib' })) : [];
      const sa = Array.isArray(lessonData.shortanswer) ? lessonData.shortanswer.map(q => ({ ...q, sourceType: 'short' })) : [];
      const maxShort = Math.floor(target * 0.3);
      const saPick = shuffle(sa).slice(0, Math.min(maxShort, sa.length));
      const others = shuffle([...tf, ...mc, ...fib]);
      const otherPick = others.slice(0, Math.max(0, target - saPick.length));
      
      if (saPick.length || otherPick.length) {
        const base = shuffle([...saPick, ...otherPick]);
        const used = new Set(base.map(promptKey));
        const remOthers = others.filter(q => !used.has(promptKey(q)));
        const remFib = fib.filter(q => !used.has(promptKey(q)));
        const remSa = sa.filter(q => !used.has(promptKey(q)));
        const legacyKey = type === 'worksheet' ? 'worksheet' : 'test';
        const legacy = Array.isArray(lessonData[legacyKey]) ? lessonData[legacyKey].filter(q => !used.has(promptKey(q))) : [];
        source = ensureExactCount(base, target, [shuffle(remOthers), shuffle(remFib), shuffle(remSa), shuffle(legacy)]);
      } else if (Array.isArray(lessonData[type]) && lessonData[type].length) {
        source = ensureExactCount(shuffle(lessonData[type]).slice(0, target), target, [shuffle(lessonData[type])]);
      }
    }
    
    return source;
  }, [lessonData, subjectParam, ensureExactCount, promptKey]);

  /**
   * Download worksheet PDF (student-facing questions)
   */
  const handleDownloadWorksheet = useCallback(async () => {
    const ok = await ensurePinAllowed('download');
    if (!ok) return;
    
    // Open a blank tab immediately to avoid popup blockers
    const previewWin = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
    try { showTipOverride('Tip: If nothing opens, allow pop-ups for this site.'); } catch {}
    setDownloadError("");
    
    let source = generatedWorksheet;
    
    // If not yet generated, build synchronously now to avoid state update race
    if (!source?.length && lessonData) {
      source = generateAssessmentIfNeeded('worksheet', WORKSHEET_TARGET);
      
      if (source?.length) {
        setGeneratedWorksheet(source);
        const key = getAssessmentStorageKey();
        if (key) {
          try { 
            const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none'; 
            saveAssessments(key, { 
              worksheet: source, 
              test: generatedTest || [], 
              comprehension: compPool || [], 
              exercise: exercisePool || [] 
            }, { learnerId: lid }); 
          } catch {}
        }
      }
    }
    
    if (!source?.length) {
      setDownloadError("Worksheet content is unavailable for this lesson.");
      return;
    }
    
    await createPdfForItems(source.map((q, i) => ({ ...q, number: i + 1 })), "worksheet", previewWin);
  }, [
    ensurePinAllowed, showTipOverride, setDownloadError, generatedWorksheet, lessonData,
    generateAssessmentIfNeeded, WORKSHEET_TARGET, setGeneratedWorksheet, getAssessmentStorageKey,
    saveAssessments, generatedTest, compPool, exercisePool, createPdfForItems
  ]);

  /**
   * Download test PDF (student-facing questions)
   */
  const handleDownloadTest = useCallback(async () => {
    const ok = await ensurePinAllowed('download');
    if (!ok) return;
    
    // Open a blank tab immediately to avoid popup blockers
    const previewWin = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
    try { showTipOverride('Tip: If nothing opens, allow pop-ups for this site.'); } catch {}
    setDownloadError("");
    
    let source = generatedTest;
    
    if (!source?.length && lessonData) {
      source = generateAssessmentIfNeeded('test', TEST_TARGET);
      
      if (source?.length) {
        setGeneratedTest(source);
        const key = getAssessmentStorageKey();
        if (key) {
          try { 
            const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none'; 
            saveAssessments(key, { 
              worksheet: generatedWorksheet || [], 
              test: source, 
              comprehension: compPool || [], 
              exercise: exercisePool || [] 
            }, { learnerId: lid }); 
          } catch {}
        }
      }
    }
    
    if (!source?.length) {
      setDownloadError("Test content is unavailable for this lesson.");
      return;
    }
    
    await createPdfForItems(source.map((q, i) => ({ ...q, number: i + 1 })), "test", previewWin);
  }, [
    ensurePinAllowed, showTipOverride, setDownloadError, generatedTest, lessonData,
    generateAssessmentIfNeeded, TEST_TARGET, setGeneratedTest, getAssessmentStorageKey,
    saveAssessments, generatedWorksheet, compPool, exercisePool, createPdfForItems
  ]);

  /**
   * Download combined answer key (worksheet + test) in a single PDF
   */
  const handleDownloadAnswers = useCallback(async () => {
    const ok = await ensurePinAllowed('download');
    if (!ok) return;
    
    const previewWin = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
    try { showTipOverride('Tip: If nothing opens, allow pop-ups for this site.'); } catch {}
    setDownloadError("");
    
    // Ensure we have generated sets or fallback to existing lesson arrays
    let ws = generatedWorksheet;
    let ts = generatedTest;
    
    if ((!ws || !ws.length || !ts || !ts.length) && lessonData) {
      // Attempt minimal synchronous generation ONLY if arrays empty and lessonData present
      try {
        if ((!ws || !ws.length) && (Array.isArray(lessonData.worksheet) && lessonData.worksheet.length)) {
          ws = lessonData.worksheet.slice(0, WORKSHEET_TARGET || 20).map((q, i) => ({ ...q, number: i + 1 }));
        }
        if ((!ts || !ts.length) && (Array.isArray(lessonData.test) && lessonData.test.length)) {
          ts = lessonData.test.slice(0, TEST_TARGET || 20).map((q, i) => ({ ...q, number: i + 1 }));
        }
      } catch {}
    }
    
    // If still nothing to show, surface error
    if ((!ws || !ws.length) && (!ts || !ts.length)) {
      setDownloadError('No worksheet or test content available for answers.');
      return;
    }
    
    const itemsWorksheet = Array.isArray(ws) ? ws.map((q, i) => ({ ...q, number: q.number || (i + 1) })) : [];
    const itemsTest = Array.isArray(ts) ? ts.map((q, i) => ({ ...q, number: q.number || (i + 1) })) : [];

    // Build PDF with both sections using same jsPDF instance
    try {
      const doc = new jsPDF();
      const lessonTitle = (lessonData?.title || manifestInfo.title || 'Lesson').trim();
      let y = 14;
      doc.setFontSize(18);
      doc.text(`${lessonTitle} Facilitator Key`, 14, y);
      y += 10;
      
      const normalFont = () => { try { doc.setFontSize(12); } catch {} };
      normalFont();

      const renderAnswerLine = (label, num, prompt, answer) => {
        const wrapWidth = 180;
        const header = `${label} ${num}. ${prompt}`.trim();
        const headerLines = doc.splitTextToSize(header, wrapWidth);
        headerLines.forEach(line => {
          if (y > 280) { doc.addPage(); y = 14; normalFont(); }
          doc.text(line, 14, y); y += 6;
        });
        const ansLines = doc.splitTextToSize(`Answer: ${answer}`, wrapWidth);
        ansLines.forEach(line => {
          if (y > 280) { doc.addPage(); y = 14; normalFont(); }
          doc.text(line, 20, y); y += 6;
        });
        y += 2;
      };

      const extractAnswer = (q) => {
        try {
          if (!q) return '—';
          // Possible fields: answer, expected, correct, key, solution, A, a; MC: correct option; TF: boolean
          if (Array.isArray(q.answers)) return q.answers.join(', ');
          if (Array.isArray(q.expected)) return q.expected.join(', ');
          if (Array.isArray(q.answer)) return q.answer.join(', ');
          const direct = q.expected || q.answer || q.solution || q.correct || q.key || q.A || q.a;
          if (typeof direct === 'string' && direct.trim()) return direct.trim();
          if (typeof direct === 'number') return String(direct);
          if (typeof q === 'object') {
            // Multiple choice pattern
            if (Array.isArray(q.choices)) {
              let idx = Number.isFinite(q.correctIndex) ? q.correctIndex : -1;
              if (idx < 0 && (q.expected || q.answer)) {
                const target = String(q.expected || q.answer).trim().toLowerCase();
                idx = q.choices.findIndex(c => String(c).trim().toLowerCase() === target);
              }
              if (idx >= 0 && idx < q.choices.length) {
                const letter = String.fromCharCode(65 + idx);
                const choiceText = String(q.choices[idx]).trim();
                return `${letter}) ${choiceText}`;
              }
            }
            if (Array.isArray(q.choices) && (typeof q.correct === 'string' || typeof q.correct === 'number')) {
              if (typeof q.correct === 'number') {
                const idx = q.correct;
                if (idx >= 0 && idx < q.choices.length) {
                  const letter = String.fromCharCode(65 + idx);
                  const choiceText = String(q.choices[idx]).trim();
                  return `${letter}) ${choiceText}`;
                }
              } else {
                const target = q.correct.trim().toLowerCase();
                const idx = q.choices.findIndex(c => String(c).trim().toLowerCase() === target);
                if (idx >= 0) {
                  const letter = String.fromCharCode(65 + idx);
                  return `${letter}) ${q.correct}`;
                }
                return q.correct;
              }
            }
            if (typeof q.isTrue === 'boolean') return q.isTrue ? 'True' : 'False';
            if (typeof q.trueFalse === 'boolean') return q.trueFalse ? 'True' : 'False';
          }
          return '—';
        } catch { return '—'; }
      };

      if (itemsWorksheet.length) {
        doc.setFontSize(16); doc.text('Worksheet Answers', 14, y); y += 8; normalFont();
        itemsWorksheet.forEach(q => {
          const prompt = (q.prompt || q.question || q.Q || q.q || q.text || '').toString().trim();
          renderAnswerLine('W', q.number, prompt, extractAnswer(q));
        });
        y += 4;
      }
      
      if (itemsTest.length) {
        if (y > 250) { doc.addPage(); y = 14; }
        doc.setFontSize(16); doc.text('Test Answers', 14, y); y += 8; normalFont();
        itemsTest.forEach(q => {
          const prompt = (q.prompt || q.question || q.Q || q.q || q.text || '').toString().trim();
          renderAnswerLine('T', q.number, prompt, extractAnswer(q));
        });
      }

      // Filename: use the lesson ID (filename without .json) to ensure stable, predictable naming
      const lessonIdForName = String(manifestInfo?.file || lessonParam || 'lesson').replace(/\.json$/i, '');
      const fileName = `${lessonIdForName}-key.pdf`;
      
      try {
        const blob = doc.output('blob');
        await shareOrPreviewPdf(blob, fileName, previewWin);
      } catch { doc.save(fileName); }
    } catch (e) {
      console.warn('[Session] Failed to build answers PDF', e);
      setDownloadError('Failed to generate answers PDF.');
    }
  }, [
    ensurePinAllowed, showTipOverride, setDownloadError, generatedWorksheet, generatedTest,
    lessonData, manifestInfo, lessonParam, WORKSHEET_TARGET, TEST_TARGET, jsPDF, shareOrPreviewPdf
  ]);

  /**
   * Download Facilitator Key (Lesson Notes, Vocab, Worksheet Q&A, Test Q&A) forced into one page when possible
   */
  const handleDownloadWorksheetTestCombined = useCallback(async () => {
    const ok = await ensurePinAllowed('facilitator-key');
    if (!ok) return;
    
    const previewWin = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
    try { showTipOverride('Tip: If nothing opens, allow pop-ups for this site.'); } catch {}
    setDownloadError('');
    
    // Use existing generated cached sets only (do not attempt regeneration here)
    const ws = Array.isArray(worksheetSourceFull) ? worksheetSourceFull : (Array.isArray(generatedWorksheet) ? generatedWorksheet : []);
    const ts = Array.isArray(testSourceFull) ? testSourceFull : (Array.isArray(generatedTest) ? generatedTest : []);
    
    if (!ws.length && !ts.length) { 
      setDownloadError('No worksheet or test content available. Refresh first.'); 
      return; 
    }
    
    try {
      const doc = new jsPDF();
      const lessonTitle = (lessonData?.title || manifestInfo.title || 'Lesson').trim();
      
      // Single page constraints; scale down font and, if needed, use two-column fallback for Q&A sections.
      const MAX_SIZE = 12;
      const MIN_SIZE = 5;
      const LINE_GAP = 1.0;
      const LEFT = 8;
      const TOP = 14;
      const BOTTOM_LIMIT = 285;
      const PAGE_WIDTH = 210;
      const PAGE_INNER_WIDTH = PAGE_WIDTH - (LEFT * 2);
      
      // Canonical answer derivation mirroring judging logic precedence
      const buildCanonicalAnswer = (q, debug = false) => {
        if (!q || typeof q !== 'object') return '—';
        const usedKeys = new Set();
        const parts = [];
        const push = (key, val) => {
          if (val == null) return;
          if (Array.isArray(val)) { val.forEach(v => push(key, v)); return; }
          const s = String(val).trim();
          if (!s) return;
          parts.push(s);
          if (key) usedKeys.add(key);
        };

        // Primary single-value style fields (first non-empty wins ordering prominence)
        const primaryOrder = ['expected','answer','expectedAnswer','expectedOutput','solution','key','correct'];
        for (const k of primaryOrder) { if (q[k] != null) push(k, q[k]); }

        // Acceptable / any-of variants
        if (Array.isArray(q.expectedAny) && q.expectedAny.length) push('expectedAny', q.expectedAny);
        if (Array.isArray(q.acceptableAnswers) && q.acceptableAnswers.length) push('acceptableAnswers', q.acceptableAnswers);
        if (Array.isArray(q.acceptable) && q.acceptable.length) push('acceptable', q.acceptable);
        if (Array.isArray(q.answers) && q.answers.length) push('answers', q.answers);

        // Multiple choice (derive letter + text if possible)
        if (Array.isArray(q.choices)) {
          let idx = Number.isFinite(q.correctIndex) ? q.correctIndex : -1;
          if (idx < 0 && Number.isFinite(q.correct)) {
            idx = q.correct;
          }
          if (idx < 0 && (q.expected || q.answer)) {
            const target = String(q.expected || q.answer).trim().toLowerCase();
            idx = q.choices.findIndex(c => String(c).trim().toLowerCase() === target);
          }
          if (idx >= 0 && idx < q.choices.length) {
            const letter = String.fromCharCode(65 + idx);
            const choiceText = String(q.choices[idx]).trim();
            push('mc', `${letter}) ${choiceText}`);
          }
        }

        // Boolean / True-False
        if (typeof q.isTrue === 'boolean') push('isTrue', q.isTrue ? 'True' : 'False');
        if (typeof q.trueFalse === 'boolean') push('trueFalse', q.trueFalse ? 'True' : 'False');

        // Numeric range style (min/max or expectedMin/expectedMax)
        const min = q.min ?? q.expectedMin;
        const max = q.max ?? q.expectedMax;
        if (Number.isFinite(min) && Number.isFinite(max)) {
          if (min === max) push('range', String(min)); else push('range', `${min}–${max}`);
        } else if (Number.isFinite(min)) { push('min', min); }
        if (Number.isFinite(max) && !Number.isFinite(min)) push('max', max);

        // Keywords / terms for short-answer
        if (Array.isArray(q.terms) && q.terms.length) push('terms', `terms: ${q.terms.join(', ')}`);
        if (Array.isArray(q.keywords) && q.keywords.length) push('keywords', `keywords: ${q.keywords.join(', ')}`);
        if (Number.isInteger(q.minKeywords) && q.minKeywords > 0) push('minKeywords', `min keywords: ${q.minKeywords}`);

        // Explanation (short only)
        if (typeof q.explanation === 'string') {
          const exp = q.explanation.trim();
          if (exp && exp.length <= 120) push('explanation', exp);
        }

        // Deduplicate preserving earliest occurrence precedence
        const seen = new Set();
        const ordered = [];
        for (const p of parts) { if (!seen.has(p)) { seen.add(p); ordered.push(p); } }
        if (!ordered.length) return '(no answer data)';
        const answer = ordered.join(' / ');
        if (debug && process.env.NODE_ENV !== 'production') {
          return `${answer}  [${Array.from(usedKeys).join(',')}]`;
        }
        return answer;
      };
      
      // Build content: Notes, Vocab, then Worksheet/Test Q&A with prompt and answer on the same line
      const debugAnswers = false;
      const notes = String(lessonData?.teachingNotes || lessonData?.teacherNotes || lessonData?.notes || '')
        .replace(/\s+/g, ' ').trim();
      const vocabArr = Array.isArray(lessonData?.vocab) ? lessonData.vocab : [];
      const vocabItems = vocabArr.map(v => {
        if (v && typeof v === 'object') {
          const term = String(v.term || v.word || '').trim();
          const def = String(v.definition || '').trim();
          return term && def ? `${term}: ${def}` : term || def || '';
        }
        return String(v || '').trim();
      }).filter(Boolean);

      // Build worksheet/test lines with prompt — answer (compact)
      const worksheetItems = ws.map((q,i)=>({
        prefix:'W',
        num:(q.number || i+1),
        prompt: String(q.prompt || q.question || q.text || '').trim(),
        ans: buildCanonicalAnswer(q, debugAnswers)
      }));
      const testItems = ts.map((q,i)=>({
        prefix:'T',
        num:(q.number || i+1),
        prompt: String(q.prompt || q.question || q.text || '').trim(),
        ans: buildCanonicalAnswer(q, debugAnswers)
      }));
      
      const buildQALine = (it) => {
        const p = it.prompt || '';
        const a = it.ans || '';
        return `${it.prefix}${it.num}. ${p} — ${a}`.replace(/\s+/g,' ').trim();
      };

      const measureTotalHeightSingle = (size) => {
        doc.setFontSize(size);
        const lineHeight = size * 0.352778;
        let y = TOP;
        // Title
        y += lineHeight;
        // Lesson Notes
        if (notes) {
          y += lineHeight;
          const lines = doc.splitTextToSize(notes, PAGE_INNER_WIDTH);
          const block = lines.length * lineHeight + LINE_GAP;
          if (y + block > BOTTOM_LIMIT) return false;
          y += block;
        }
        // Vocab
        if (vocabItems.length) {
          y += lineHeight;
          for (const vi of vocabItems) {
            const lines = doc.splitTextToSize(vi, PAGE_INNER_WIDTH);
            const block = lines.length * lineHeight + LINE_GAP * 0.8;
            if (y + block > BOTTOM_LIMIT) return false;
            y += block;
          }
        }
        // Worksheet heading + items
        if (worksheetItems.length) {
          y += lineHeight;
          for (const it of worksheetItems) {
            const lines = doc.splitTextToSize(buildQALine(it), PAGE_INNER_WIDTH);
            const blockHeight = lines.length * lineHeight + LINE_GAP;
            if (y + blockHeight > BOTTOM_LIMIT) return false;
            y += blockHeight;
          }
        }
        // Spacer + Test heading
        if (testItems.length) {
          y += lineHeight * 0.8;
          y += lineHeight;
          for (const it of testItems) {
            const lines = doc.splitTextToSize(buildQALine(it), PAGE_INNER_WIDTH);
            const blockHeight = lines.length * lineHeight + LINE_GAP;
            if (y + blockHeight > BOTTOM_LIMIT) return false;
            y += blockHeight;
          }
        }
        return true;
      };

      // Try single-column fit first
      let chosenFont = MAX_SIZE;
      let useTwoCols = false;
      for (let size = MAX_SIZE; size >= MIN_SIZE; size -= 1) {
        if (measureTotalHeightSingle(size)) { chosenFont = size; break; }
        if (size === MIN_SIZE) { useTwoCols = true; chosenFont = size; }
      }

      const lineHeight = chosenFont * 0.352778;
      let y = TOP;
      doc.setFontSize(chosenFont);
      
      // Title
      try { doc.setFont(undefined, 'bold'); } catch {}
      doc.text(`${lessonTitle} Facilitator Key`, LEFT, y);
      try { doc.setFont(undefined, 'normal'); } catch {}
      y += lineHeight;

      // Render Notes
      const renderParagraph = (heading, text) => {
        if (!text) return;
        try { doc.setFont(undefined, 'bold'); } catch {}
        doc.text(heading, LEFT, y); y += lineHeight;
        try { doc.setFont(undefined, 'normal'); } catch {}
        const lines = doc.splitTextToSize(text, PAGE_INNER_WIDTH);
        for (const ln of lines) { doc.text(ln, LEFT, y); y += lineHeight; }
        y += LINE_GAP;
      };
      renderParagraph('Lesson Notes', notes);

      // Render Vocab list (compact)
      if (vocabItems.length) {
        try { doc.setFont(undefined, 'bold'); } catch {}
        doc.text('Vocab', LEFT, y); y += lineHeight;
        try { doc.setFont(undefined, 'normal'); } catch {}
        for (const vi of vocabItems) {
          const lines = doc.splitTextToSize(vi, PAGE_INNER_WIDTH);
          for (const ln of lines) { doc.text(ln, LEFT, y); y += lineHeight; }
          y += LINE_GAP * 0.8;
        }
      }

      if (!useTwoCols) {
        // Single column Q&A
        const renderQASection = (title, items, { spacerTop=false } = {}) => {
          if (!items.length) return;
          if (spacerTop) y += lineHeight * 0.6;
          try { doc.setFont(undefined, 'bold'); } catch {}
          doc.text(title, LEFT, y); y += lineHeight;
          try { doc.setFont(undefined, 'normal'); } catch {}
          for (const it of items) {
            const lines = doc.splitTextToSize(buildQALine(it), PAGE_INNER_WIDTH);
            for (const ln of lines) { doc.text(ln, LEFT, y); y += lineHeight; if (y > BOTTOM_LIMIT) break; }
            y += LINE_GAP;
            if (y > BOTTOM_LIMIT) break;
          }
        };
        renderQASection('Worksheet', worksheetItems);
        renderQASection('Test', testItems, { spacerTop:true });
      } else {
        // Two-column fallback for Q&A only
        const GUTTER = 6;
        const colWidth = (PAGE_INNER_WIDTH - GUTTER) / 2;
        const startY = y;
        
        // Split worksheet and test into a single list and then divide roughly in half for columns
        const combined = [
          ... (worksheetItems.length ? [{ type:'heading', title:'Worksheet' }] : []),
          ...worksheetItems.map(it=>({ type:'item', it })),
          ... (testItems.length ? [{ type:'heading', title:'Test' }] : []),
          ...testItems.map(it=>({ type:'item', it }))
        ];
        
        const linesAll = combined.map(entry => entry.type === 'heading' ? `# ${entry.title}` : buildQALine(entry.it));
        const mid = Math.ceil(linesAll.length / 2);
        const leftEntries = combined.slice(0, mid);
        const rightEntries = combined.slice(mid);
        
        const renderEntries = (xLeft, entries) => {
          let yCol = startY;
          for (const e of entries) {
            if (e.type === 'heading') { 
              try { doc.setFont(undefined, 'bold'); } catch {}
              doc.text(e.title, xLeft, yCol); 
              yCol += lineHeight; 
              try { doc.setFont(undefined, 'normal'); } catch {}
              continue; 
            }
            const txt = buildQALine(e.it);
            const lines = doc.splitTextToSize(txt, colWidth);
            for (const ln of lines) { 
              doc.text(ln, xLeft, yCol); 
              yCol += lineHeight; 
              if (yCol > BOTTOM_LIMIT) return yCol; 
            }
            yCol += LINE_GAP;
            if (yCol > BOTTOM_LIMIT) return yCol;
          }
          return yCol;
        };
        
        const xLeft = LEFT;
        const xRight = LEFT + colWidth + GUTTER;
        const yEndLeft = renderEntries(xLeft, leftEntries);
        const yEndRight = renderEntries(xRight, rightEntries);
        y = Math.max(yEndLeft, yEndRight);
      }

      // Filename: use the lesson ID (filename without .json) to ensure stable, predictable naming
      const lessonIdForName = String(manifestInfo?.file || lessonParam || 'lesson').replace(/\.json$/i, '');
      const fileName = `${lessonIdForName}-key.pdf`;
      
      try {
        const blob = doc.output('blob');
        await shareOrPreviewPdf(blob, fileName, previewWin);
      } catch { doc.save(fileName); }
    } catch (e) {
      console.warn('[Session] Failed combined worksheet/test PDF', e);
      setDownloadError('Failed to generate combined worksheet/test PDF.');
    }
  }, [
    ensurePinAllowed, showTipOverride, setDownloadError, worksheetSourceFull, testSourceFull,
    generatedWorksheet, generatedTest, lessonData, manifestInfo, lessonParam, jsPDF, shareOrPreviewPdf
  ]);

  /**
   * Re-generate fresh randomized worksheet and test sets and reset session progress
   */
  const handleRefreshWorksheetAndTest = useCallback(async () => {
    const ok = await ensurePinAllowed('refresh');
    if (!ok) return;
    
    // Clear persisted sets for this lesson
    const key = getSnapshotStorageKey();
    if (key) { 
      try { 
        const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none'; 
        await clearAssessments(key, { learnerId: lid }); 
      } catch { /* ignore */ } 
    }
    
    // Reset current worksheet/test state
    setGeneratedWorksheet(null);
    setGeneratedTest(null);
    setCurrentWorksheetIndex(0);
    worksheetIndexRef.current = 0;
    setTestActiveIndex(0);
    setTestUserAnswers([]);
    
    // Re-run generation logic by reloading the lesson data block
    try {
      // Force re-evaluation of targets in case learner or runtime changed
      await ensureRuntimeTargets(true); // Force fresh reload
      
      // Force immediate regeneration using existing logic
      const data = lessonData;
      if (!data) return;
      
      const storageKey = getAssessmentStorageKey();
      
      const shuffle = (arr) => {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      };
      
      let gW = [];
      let gT = [];
      
      if (subjectParam === 'math') {
        // REMOVED: reserveSamples - deprecated zombie code
        const words = reserveWords(WORKSHEET_TARGET + TEST_TARGET);
        
        const takeMixed = (target, isTest) => {
          const desiredWp = Math.round(target * 0.3);
          const wpSel = (words || []).slice(0, desiredWp).map(q => ({ ...(isTest ? ({ ...q, expected: q.expected ?? q.answer }) : q), sourceType: 'word' }));
          const remainder = Math.max(0, target - wpSel.length);
          const cap = Math.max(0, Math.floor(target * 0.10));
          // REMOVED: fromSamples - use only categories, no sample array
          const sa = []; // Empty since we no longer use samples
          const fib = [];
          const others = [];
          const shuffleArr = (arr) => shuffle(arr);
          const saPick = shuffleArr(sa).slice(0, Math.min(cap, sa.length));
          const fibPick = shuffleArr(fib).slice(0, Math.min(cap, fib.length));
          const remaining = Math.max(0, remainder - saPick.length - fibPick.length);
          const otherPick = shuffleArr(others).slice(0, remaining);
          const baseSel = shuffleArr([...saPick, ...fibPick, ...otherPick]);
          const base = shuffleArr([...wpSel, ...baseSel]);
          if (base.length >= target) return base.slice(0, target);
          const usedKeys = new Set(base.map(promptKey));
          const remOthers = others.filter(q => !usedKeys.has(promptKey(q)));
          const remSa = sa.filter(q => !usedKeys.has(promptKey(q)));
          const remFib = fib.filter(q => !usedKeys.has(promptKey(q)));
          const remWords = (words || []).slice(desiredWp).filter(q => !usedKeys.has(promptKey(q)));
          return ensureExactCount(base, target, [shuffleArr(remOthers), shuffleArr(remSa), shuffleArr(remFib), shuffleArr(remWords)]);
        };
        
        gW = takeMixed(WORKSHEET_TARGET, false);
        gT = takeMixed(TEST_TARGET, true);
        setGeneratedWorksheet(gW);
        setGeneratedTest(gT);
      } else {
        const tf = Array.isArray(data.truefalse) ? data.truefalse.map(q => ({ ...q, sourceType: 'tf' })) : [];
        const mc = Array.isArray(data.multiplechoice) ? data.multiplechoice.map(q => ({ ...q, sourceType: 'mc' })) : [];
        const fib = Array.isArray(data.fillintheblank) ? data.fillintheblank.map(q => ({ ...q, sourceType: 'fib' })) : [];
        const sa = Array.isArray(data.shortanswer) ? data.shortanswer.map(q => ({ ...q, sourceType: 'short' })) : [];
        const anyCats = tf.length || mc.length || fib.length || sa.length;
        
        if (anyCats) {
          const gFromCats = (target) => {
            const capLocal = Math.max(0, Math.floor(target * 0.10));
            const saPick = shuffle(sa).slice(0, Math.min(capLocal, sa.length));
            const fibPick = shuffle(fib).slice(0, Math.min(capLocal, fib.length));
            const others = shuffle([...tf, ...mc]);
            const remaining = Math.max(0, target - saPick.length - fibPick.length);
            const otherPick = others.slice(0, remaining);
            const base = shuffle([...saPick, ...fibPick, ...otherPick]);
            if (base.length >= target) return base.slice(0, target);
            const usedKeys = new Set(base.map(promptKey));
            const remOthers = others.slice(remaining).filter(q => !usedKeys.has(promptKey(q)));
            const remFib = fib.filter(q => !usedKeys.has(promptKey(q)));
            const remSa = sa.filter(q => !usedKeys.has(promptKey(q)));
            const legacy = label => (Array.isArray(data[label]) ? data[label] : []).filter(q => !usedKeys.has(promptKey(q)));
            const legacyAll = [...legacy('worksheet'), ...legacy('test')];
            return ensureExactCount(base, target, [shuffle(remOthers), shuffle(remFib), shuffle(remSa), shuffle(legacyAll)]);
          };
          
          gW = gFromCats(WORKSHEET_TARGET);
          gT = gFromCats(TEST_TARGET);
          setGeneratedWorksheet(gW);
          setGeneratedTest(gT);
        } else {
          if (Array.isArray(data.worksheet) && data.worksheet.length) {
            setGeneratedWorksheet(ensureExactCount(shuffle(data.worksheet).slice(0, WORKSHEET_TARGET), WORKSHEET_TARGET, [shuffle(data.worksheet)]));
          }
          if (Array.isArray(data.test) && data.test.length) {
            setGeneratedTest(ensureExactCount(shuffle(data.test).slice(0, TEST_TARGET), TEST_TARGET, [shuffle(data.test)]));
          }
        }
      }
      
      if (storageKey) { 
        try { 
          const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none'; 
          await saveAssessments(storageKey, { 
            worksheet: gW, 
            test: gT, 
            comprehension: compPool || [], 
            exercise: exercisePool || [] 
          }, { learnerId: lid }); 
        } catch {} 
      }
    } catch {}
  }, [
    ensurePinAllowed, getSnapshotStorageKey, clearAssessments, setGeneratedWorksheet, setGeneratedTest,
    setCurrentWorksheetIndex, worksheetIndexRef, setTestActiveIndex, setTestUserAnswers,
    ensureRuntimeTargets, lessonData, getAssessmentStorageKey, subjectParam,
    // REMOVED: reserveSamples - deprecated zombie code
    reserveWords, WORKSHEET_TARGET, TEST_TARGET, promptKey, ensureExactCount, saveAssessments,
    compPool, exercisePool
  ]);

  return {
    handleDownloadWorksheet,
    handleDownloadTest,
    handleDownloadAnswers,
    handleDownloadWorksheetTestCombined,
    handleRefreshWorksheetAndTest
  };
}
