import { useCallback, useEffect, useMemo, useState } from "react";
import { enforceNbspAfterMcLabels } from "../utils/textProcessing.js";

function CaptionPanel({ sentences, activeIndex, boxRef, scaleFactor = 1, compact = false, fullHeight = false, stackedHeight = null, phase, vocabTerms = [] }) {
  const [canScroll, setCanScroll] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  // Normalize incoming sentences (strings or { text, role }) to a consistent shape
  const items = useMemo(() => {
    if (!Array.isArray(sentences)) return [];
    return sentences.map((s) => (typeof s === 'string' ? { text: s } : (s && typeof s === 'object' ? s : { text: '' })));
  }, [sentences]);

  // Detect overflow & scroll position on the scroller (boxRef)
  const recomputeScrollState = useCallback(() => {
    if (!boxRef?.current) return;
    const el = boxRef.current;
    const overflow = el.scrollHeight > el.clientHeight + 4; // tolerance
    setCanScroll(overflow);
    setAtTop(el.scrollTop <= 4);
    setAtBottom(el.scrollTop >= el.scrollHeight - el.clientHeight - 4);
  }, [boxRef]);

  useEffect(() => { recomputeScrollState(); }, [items, stackedHeight, fullHeight, compact, recomputeScrollState]);

  useEffect(() => {
    if (!boxRef?.current) return;
    const el = boxRef.current;
    const handler = () => recomputeScrollState();
    el.addEventListener('scroll', handler, { passive: true });
    const resizeObs = new ResizeObserver(handler);
    resizeObs.observe(el);
    return () => { el.removeEventListener('scroll', handler); resizeObs.disconnect(); };
  }, [boxRef, recomputeScrollState]);

  // Auto-center active caption line
  useEffect(() => {
    if (!boxRef?.current) return;
    const activeEl = boxRef.current.querySelector(`[data-idx="${activeIndex}"]`);
    if (!activeEl) return;
    const container = boxRef.current;
    const marginTop = 8;
    const marginBottom = 24;
    const scale = Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1;
    const elementTop = activeEl.offsetTop - marginTop;
    const elementBottom = activeEl.offsetTop + activeEl.offsetHeight + marginBottom;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    const isLast = activeIndex >= (Array.isArray(items) ? items.length - 1 : -1);
    if (elementTop < viewTop || elementBottom > viewBottom) {
      const distance = Math.abs(elementTop - viewTop);
      const jumpThreshold = (container.clientHeight * 0.65) / scale;
      let target;
      if (isLast) target = maxScroll; else {
        const desiredOffset = Math.max(0, elementTop - (container.clientHeight * 0.2) / scale);
        target = Math.min(maxScroll, desiredOffset);
      }
      if (distance > jumpThreshold) container.scrollTop = target; else container.scrollTo({ top: target, behavior: 'smooth' });
      if (isLast) requestAnimationFrame(() => { container.scrollTop = maxScroll; });
    }
  }, [activeIndex, items, scaleFactor, boxRef]);

  const containerStyle = {
    width: '100%',
    boxSizing: 'border-box',
    background: '#ffffff',
    borderRadius: 14,
    position: 'relative',
    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
    display: 'flex',
    flexDirection: 'column',
    flex: fullHeight ? '1 1 auto' : undefined,
    maxHeight: fullHeight ? '100%' : (stackedHeight ? stackedHeight : (compact ? '14vh' : '18vh')),
    height: fullHeight ? '100%' : (stackedHeight ? stackedHeight : 'auto'),
  };

  const scrollerStyle = {
    flex: '1 1 auto',
    height: '100%',
    overflowY: 'auto',
    paddingTop: compact ? 6 : 12,
    paddingRight: 12,
    paddingBottom: compact ? 6 : 12,
    paddingLeft: 12,
    color: '#111111',
    fontSize: 'clamp(1.125rem, 2.4vw, 1.5rem)',
    lineHeight: 1.5,
  };

  return (
    <div data-ms-caption-panel-container style={containerStyle}>
      <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 10 }}>
        <button
          type="button"
          aria-label="Scroll up captions"
          disabled={atTop}
          onClick={() => { if (boxRef.current) boxRef.current.scrollBy({ top: -Math.max(80, boxRef.current.clientHeight * 0.4), behavior: 'smooth' }); }}
          style={{
            background: atTop ? '#d1d5db' : '#1f2937',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            width: 34,
            height: 34,
            fontSize: 'clamp(1rem, 1.8vw, 1.2rem)',
            lineHeight: '34px',
            cursor: atTop ? 'default' : 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
            opacity: atTop ? 0.6 : 1,
          }}
        >▲</button>
        <button
          type="button"
          aria-label="Scroll down captions"
          disabled={atBottom}
          onClick={() => { if (boxRef.current) boxRef.current.scrollBy({ top: Math.max(80, boxRef.current.clientHeight * 0.4), behavior: 'smooth' }); }}
          style={{
            background: atBottom ? '#d1d5db' : '#1f2937',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            width: 34,
            height: 34,
            fontSize: 'clamp(1rem, 1.8vw, 1.2rem)',
            lineHeight: '34px',
            cursor: atBottom ? 'default' : 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
            opacity: atBottom ? 0.6 : 1,
          }}
        >▼</button>
      </div>
      <div ref={boxRef} data-ms-caption-panel className="scrollbar-hidden" style={scrollerStyle} aria-live="polite">
        {Array.isArray(items) && items.length > 0 ? (
          <>
          {items.map((s, idx) => {
            const text = (s && typeof s.text === 'string') ? s.text : '';
            if (text === '\n') {
              return <div key={idx} data-idx={idx} style={{ height: 6 }} />;
            }
            const isActive = idx === activeIndex;
            const containerBase = { margin: '6px 0', transition: 'background-color 160ms ease, color 160ms ease' };
            const activeContainer = isActive ? { background: 'rgba(199,68,46,0.08)', borderRadius: 8, padding: '4px 6px' } : null;
            const textBase = { whiteSpace: 'pre-line' };
            const activeText = isActive ? { fontWeight: 700, color: '#111111' } : { fontWeight: 500 };
            // Style for learner-entered lines
            const userText = { color: '#c7442e', fontWeight: 600 };
            // If this line appears to contain multiple-choice choices, render stacked with nowrap pairs
            const mcMatch = text && /(\s|^)[A-F][\.)]\s+\S/.test(text) && (text.match(/[A-F][\.)]\s+\S/g) || []).length >= 2;
            let mcRender = null;
            if (mcMatch) {
              try {
                const m = text.match(/^(\d+\.\s*)?(.*?)(\s+[A-F][\.)]\s.*)$/);
                if (m) {
                  const [, num = '', stem = '', choiceChunk = ''] = m;
                  const tokens = choiceChunk.trim().split(/\s+(?=[A-F][\.)]\s)/);
                  mcRender = (
                    <div style={{ whiteSpace: 'normal' }}>
                      {(num || stem) ? <div>{num}{stem}</div> : null}
                      {tokens.map((t, i) => (
                        <div key={i} style={{ whiteSpace: 'nowrap' }}>{enforceNbspAfterMcLabels(t)}</div>
                      ))}
                    </div>
                  );
                }
              } catch {}
            }
            // Build highlighted parts when in Discussion and vocab terms exist; skip for user lines and MC renders
            let highlighted = null;
            try {
              if (!mcRender && s.role !== 'user' && (phase === 'discussion' || phase === 'teaching') && text) {
                const terms = Array.isArray(vocabTerms) ? vocabTerms.filter(Boolean).map(t => String(t).trim()).filter(Boolean) : [];
                if (terms.length) {
                  const esc = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  // Cross-compatible boundary emulation using prefix capture; allow simple plural/possessive
                  const core = terms.map(esc).sort((a,b)=>b.length-a.length).join('|');
                  const pattern = new RegExp(`(^|[^A-Za-z0-9])(${core})(?:'s|s)?(?![A-Za-z0-9])`, 'gi');
                  const parts = [];
                  let lastIndex = 0;
                  let m;
                  while ((m = pattern.exec(text)) !== null) {
                    const start = m.index;
                    const prefix = m[1] || '';
                    const coreTerm = m[2] || '';
                    const full = m[0] || '';
                    const suffix = full.slice(prefix.length + coreTerm.length);
                    // Add text before match
                    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
                    // Add prefix unbolded
                    if (prefix) parts.push(prefix);
                    // Bold the term plus any simple suffix
                    const boldKey = `b-${idx}-${start}`;
                    parts.push(<strong key={boldKey}>{coreTerm + suffix}</strong>);
                    lastIndex = start + full.length;
                  }
                  if (lastIndex > 0) {
                    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
                    highlighted = parts;
                  }
                }
              }
            } catch {}
            return (
              <div key={idx} data-idx={idx} style={{ ...containerBase, ...(activeContainer || {}) }} aria-current={isActive ? 'true' : undefined}>
                {s.role === 'user' ? (
                  <div style={{ ...textBase, ...userText }}>{text}</div>
                ) : mcRender ? (
                  <div style={{ ...textBase, ...activeText }}>{mcRender}</div>
                ) : (
                  <div style={{ ...textBase, ...activeText }}>{highlighted || text}</div>
                )}
              </div>
            );
          })}
          {/* Dynamic tail spacer to keep one blank line at the bottom without altering the transcript */}
          <div aria-hidden data-ms-caption-tail-spacer style={{ height: '1.5em' }} />
          </>
        ) : (
          <>
            <div style={{ color: '#6b7280' }}>No captions yet.</div>
            {/* Keep consistent tail spacing even when empty */}
            <div aria-hidden data-ms-caption-tail-spacer style={{ height: '1.5em' }} />
          </>
        )}
      </div>
    </div>
  );
}

export default CaptionPanel;
