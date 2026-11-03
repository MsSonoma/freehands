'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { requestFacilitatorPinException } from '@/app/lib/pinGate';

/** Shared facilitator authority surface. Never returns a decision before PIN verification. */
export default function FacilitatorOverrideModal({
  open = false, onClose, teacher = 'Ms. Sonoma', targetType = 'objective',
  targets = [], selectedIndex = 0, onOutcome, onRegenerate,
  allowSourceRevision = false, onSourceRevision, busy = false,
}) {
  const pinRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [authorized, setAuthorized] = useState(false);
  const [index, setIndex] = useState(selectedIndex);
  const [action, setAction] = useState('outcome');
  const [feedback, setFeedback] = useState('');
  const [scope, setScope] = useState('instance');
  const [proposal, setProposal] = useState(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [sourceReceipt, setSourceReceipt] = useState(null);
  const [correctedStatus, setCorrectedStatus] = useState('correct');
  useEffect(() => {
    if (!open) { pinRef.current = null; setAuthorized(false); setProposal(null); setFeedback(''); setScope('instance'); setAction(targetType === 'question' ? 'regenerate' : (targetType === 'result' ? 'grade' : 'outcome')); setCorrectedStatus('correct'); setError(''); setSourceReceipt(null); }
    else { setIndex(selectedIndex); setProposal(null); setAction(targetType === 'question' ? 'regenerate' : (targetType === 'result' ? 'grade' : 'outcome')); setCorrectedStatus('correct'); setFeedback(''); setScope('instance'); setError(''); setSourceReceipt(null); }
  }, [open, selectedIndex, targetType]);
  useEffect(() => {
    if (!open || authorized) return;
    let cancelled = false;
    (async () => {
      const pin = await requestFacilitatorPinException({
        title: 'Facilitator Override',
        message: 'Verify your Facilitator PIN to view and change the selected material.',
      });
      if (cancelled) return;
      if (pin) { pinRef.current = pin; setAuthorized(true); }
      else onCloseRef.current?.();
    })();
    return () => { cancelled = true; };
  }, [open, authorized]);
  if (!open || typeof document === 'undefined') return null;
  const rows = Array.isArray(targets) ? targets : [];
  const selected = rows[index] || null;
  const text = String(selected?.text || selected?.question || selected?.description || '');
  const alreadyDone = selected?.completed === true;
  const canGenerate = typeof onRegenerate === 'function';
  const submit = async () => {
    if (!authorized || working || busy || !selected) return;
    setError('');
    if ((action === 'regenerate' || action === 'grade') && feedback.trim().length < 8) {
      setError('Explain what went wrong so the new material can correct it.'); return;
    }
    setWorking(true);
    try {
      if (action === 'grade') {
        if (typeof onOutcome !== 'function') throw new Error('Result corrections are unavailable.');
        const result = await onOutcome(index, selected, { correctedStatus, feedback: feedback.trim(), pin: pinRef.current });
        if (result === false) throw new Error('The facilitator result correction could not be saved.');
        onClose?.();
      } else if (action === 'outcome') {
        if (alreadyDone) throw new Error('This objective has already been fulfilled.');
        if (typeof onOutcome !== 'function') throw new Error('Outcome overrides are unavailable for this target.');
        const result = await onOutcome(index, selected);
        if (result === false) throw new Error('The facilitator decision could not be saved.');
        onClose?.();
      } else if (!proposal) {
        if (!canGenerate) throw new Error('This teacher does not yet have a safe regeneration adapter.');
        const result = await onRegenerate({ index, target: selected, feedback: feedback.trim(), scope, pin: pinRef.current });
        if (!result?.text && !result?.question) throw new Error('No valid replacement was returned.');
        setProposal(result);
      } else {
        const apply = scope === 'source' ? onSourceRevision : onRegenerate;
        if (typeof apply !== 'function') throw new Error('Source revision is not supported for this material.');
        const result = await apply({ index, target: selected, feedback: feedback.trim(), scope, proposal, commit: true, pin: pinRef.current });
        if (result === false) throw new Error('The change was not saved.');
        if (scope === 'source' && result?.newDraft?.lessonKey) {
          setSourceReceipt(result);
        } else {
          onClose?.();
        }
      }
    } catch (e) { setError(e?.message || 'The override could not be completed.'); }
    finally { setWorking(false); }
  };
  const button = { border: 0, borderRadius: 8, minHeight: 42, padding: '9px 14px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' };
  return createPortal(
    <div role="presentation" onPointerDown={(e) => e.stopPropagation()} style={{ position: 'fixed', inset: 0, zIndex: 30000, background: 'rgba(8,15,29,.68)', display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', placeItems: 'center', boxSizing: 'border-box', padding: 14, overflowX: 'hidden' }}>
      <section role="dialog" aria-modal="true" aria-label="Facilitator Override" style={{ background: '#fff', color: '#1f2937', boxSizing: 'border-box', width: '100%', maxWidth: 560, minWidth: 0, maxHeight: '90dvh', overflowY: 'auto', overflowX: 'hidden', overflowWrap: 'anywhere', borderRadius: 16, padding: 22, boxShadow: '0 18px 50px rgba(0,0,0,.28)', fontFamily: 'Roboto, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, minWidth: 0 }}>
          <div style={{ minWidth: 0, flex: '1 1 auto' }}><strong style={{ fontSize: 19 }}>Facilitator Override</strong><div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{teacher} · {targetType === 'objective' ? 'Learning objectives' : targetType === 'result' ? 'Completed test result' : 'Question'}</div></div>
          <button type="button" onClick={onClose} aria-label="Close facilitator override" style={{ ...button, background: '#f1f5f9' }}>Close</button>
        </div>
        {!authorized ? <p>Waiting for facilitator verification…</p> : <>
          {rows.length > 1 && <div style={{ margin: '16px 0', display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 6, minWidth: 0, maxWidth: '100%' }}>
            <label htmlFor="override-target" style={{ fontWeight: 700, fontSize: 13 }}>Choose {targetType === 'objective' ? 'objective' : 'question'}</label>
            <select id="override-target" value={index} onChange={(e) => { setIndex(Number(e.target.value)); setProposal(null); }} style={{ boxSizing: 'border-box', width: '100%', maxWidth: '100%', minWidth: 0, textOverflow: 'ellipsis', overflow: 'hidden', padding: 10, borderRadius: 8, border: '1px solid #94a3b8', background: '#fff', color: '#111827' }}>
              {rows.map((row, i) => {
                const full = String(row.text || row.question || row.description || `Goal ${i + 1}`);
                const short = full.length > 34 ? `${full.slice(0, 31)}...` : full;
                return <option value={i} key={row.id || i} title={full}>{row.completed ? 'Done: ' : ''}{short}</option>;
              })}
            </select>
          </div>}
          <div style={{ background: '#f1f5f9', padding: 14, borderRadius: 10, marginTop: 14, whiteSpace: 'pre-wrap' }}>{text || 'No material available'}</div>
          {selected?.source === 'facilitator' && <p style={{ fontSize: 12, color: '#475569' }}>Already fulfilled by facilitator.</p>}
          <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
            {targetType === 'result' && <label><input type="radio" checked={action === 'grade'} onChange={() => { setAction('grade'); setProposal(null); }} /> Correct the recorded grading decision</label>}
            {targetType === 'objective' && <label><input type="radio" checked={action === 'outcome'} onChange={() => { setAction('outcome'); setProposal(null); }} /> Mark fulfilled by facilitator</label>}
            {canGenerate && <label><input type="radio" checked={action === 'regenerate'} onChange={() => { setAction('regenerate'); setProposal(null); }} /> Regenerate {targetType === 'objective' ? 'objective' : 'question'}</label>}
          </div>
          {action === 'grade' && <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            <label htmlFor="override-result-grade" style={{ fontWeight: 700 }}>Facilitator judgment</label>
            <select id="override-result-grade" value={correctedStatus} onChange={(event) => setCorrectedStatus(event.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #94a3b8', background: '#fff', color: '#111827' }}>
              <option value="correct">Correct (1 point)</option><option value="partial">Partial (half point)</option><option value="incorrect">Not credited (0 points)</option>
            </select>
            <label htmlFor="override-result-reason" style={{ fontWeight: 700 }}>Why does the grade need correcting? (required)</label>
            <textarea id="override-result-reason" rows={4} value={feedback} onChange={event => setFeedback(event.target.value)} placeholder="Explain the evidence behind this decision." style={{ boxSizing: 'border-box', width: '100%', border: '1px solid #94a3b8', borderRadius: 8, padding: 10, font: 'inherit', background: '#fff', color: '#111827' }}/>
            <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>The original independent-test evidence stays unchanged. Your review is recorded separately.</p>
          </div>}
          {action === 'regenerate' && <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            <label htmlFor="override-feedback" style={{ fontWeight: 700 }}>What went wrong? (required)</label>
            <textarea id="override-feedback" rows={4} value={feedback} onChange={(e) => { setFeedback(e.target.value); setProposal(null); }} placeholder="Explain the confusing, unfair, inaccurate or unsuitable part." style={{ boxSizing: 'border-box', width: '100%', border: '1px solid #94a3b8', borderRadius: 8, padding: 10, font: 'inherit', color: '#111827', background: '#fff' }}/>
            <label><input type="radio" checked={scope === 'instance'} onChange={() => { setScope('instance'); setProposal(null); }} /> Change this lesson instance only</label>
            {allowSourceRevision && <label><input type="radio" checked={scope === 'source'} onChange={() => { setScope('source'); setProposal(null); }} /> Create a new source lesson revision</label>}
            {!allowSourceRevision && <div style={{ fontSize: 12, color: '#64748b' }}>Original lesson revision is unavailable until a verified, versioned source write is supported. The current lesson remains editable only through an instance adapter.</div>}
            {proposal && <div style={{ border: '1px solid #94a3b8', padding: 12, borderRadius: 8 }}><strong>Proposed replacement, not yet applied</strong><p>{proposal.text || proposal.question}</p>{proposal.expectedAny?.length > 0 && <p style={{ fontSize: 12 }}>Facilitator answer guide: {proposal.expectedAny.join('; ')}</p>}</div>}
          </div>}
          {sourceReceipt && <div role="status" style={{ padding: 12, border: '1px solid #94a3b8', borderRadius: 10, marginTop: 12 }}>
            <strong>New lesson draft saved and verified.</strong>
            <p>Version: {sourceReceipt.newDraft.lessonKey}</p>
            <p>Approve and assign this new draft in the facilitator lesson library before future learners use it. The historical lesson file remains unchanged.</p>
            <p>{sourceReceipt.instanceApplied ? 'The current question was also replaced.' : 'The current lesson instance has not been changed.'}</p>
          </div>}
          {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
            <button type="button" style={{ ...button, background: '#e2e8f0' }} onClick={onClose}>Cancel</button>
            <button type="button" disabled={!sourceReceipt && (!selected || !authorized || busy || working || (action === 'outcome' && alreadyDone) || (action === 'regenerate' && !canGenerate))} onClick={() => sourceReceipt ? onClose?.() : void submit()} style={{ ...button, background: '#9f3a2b', color: '#fff', opacity: busy || working ? 0.6 : 1 }}>
              {sourceReceipt ? 'Close' : working ? 'Working…' : action === 'outcome' ? 'Confirm fulfillment' : action === 'grade' ? 'Save facilitator correction' : proposal ? (scope === 'source' ? 'Create new lesson version' : 'Approve replacement') : 'Generate preview'}
            </button>
          </div>
        </>}
      </section>
    </div>, document.body,
  );
}
