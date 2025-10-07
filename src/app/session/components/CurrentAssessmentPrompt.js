import { useEffect, useState } from "react";
import { enforceNbspAfterMcLabels } from "../utils/textProcessing.js";

function CurrentAssessmentPrompt({ phase, subPhase, testActiveIndex, testList }) {
  // We will attempt to read window.__MS_CAPTIONS if exposed else fallback to scanning caption container.
  const [prompt, setPrompt] = useState('');
  useEffect(() => {
    const extract = () => {
      // Prefer authoritative local data for TEST overlay so numbering/choices are reliable
      try {
        if (phase === 'test' && subPhase === 'test-active' && Array.isArray(testList) && typeof testActiveIndex === 'number') {
          const idx = Math.max(0, Math.min(testList.length - 1, testActiveIndex));
          const q = testList[idx];
          if (q) {
            const number = `${idx + 1}. `;
            const stem = (q.prompt || q.question || q.text || '').toString().trim();
            const rawChoices = Array.isArray(q.choices) && q.choices.length ? q.choices : (Array.isArray(q.options) ? q.options : []);
            if (rawChoices && rawChoices.length) {
              const letters = ['A','B','C','D','E','F'];
              const parts = rawChoices.slice(0, 6).map((c, i) => `${letters[i]})\u00A0${String(c)}`);
              // Return structured payload so renderer can stack lines and keep pairs together
              return { number, stem, parts };
            }
            return { number, stem, parts: [] };
          }
        }
      } catch {}
      try {
        // Direct global if maintained
        if (window.__MS_CAPTION_SENTENCES && Array.isArray(window.__MS_CAPTION_SENTENCES)) {
          // For test, avoid using captions: handled above via local data.
          if (phase === 'worksheet' && subPhase === 'worksheet-active') {
            return window.__MS_CAPTION_SENTENCES[window.__MS_CAPTION_SENTENCES.length - 1] || '';
          }
        }
        // Fallback: query caption panel paragraphs
        const panel = document.querySelector('[data-ms-caption-panel]');
        if (panel) {
          const parts = Array.from(panel.querySelectorAll('p')).map(p => p.textContent.trim()).filter(Boolean);
          // For test, avoid using captions: handled above via local data.
          if (phase === 'worksheet' && subPhase === 'worksheet-active') return parts[parts.length - 1] || '';
        }
      } catch {}
      return '';
    };
    setPrompt(extract());
    const id = setInterval(() => setPrompt(extract()), 400); // lightweight poll to keep in sync
    return () => clearInterval(id);
  }, [phase, subPhase]);
  if (!prompt) return null;
  // If structured payload, render stacked with nowrap options
  if (typeof prompt === 'object' && prompt && 'number' in prompt) {
    const { number, stem, parts } = prompt;
    const children = [<span key="stem">{number}{stem}</span>];
    if (parts && parts.length) {
      parts.forEach((t, i) => {
        children.push(<br key={`br-${i}`} />);
        children.push(<span key={`opt-${i}`} style={{ whiteSpace: 'nowrap' }}>{enforceNbspAfterMcLabels(t)}</span>);
      });
    }
    return <span>{children}</span>;
  }
  // Fallback: plain string
  return <span>{String(prompt)}</span>;
}

export default CurrentAssessmentPrompt;
