'use client';

export default function HelpReplaySentence({ text, onReplay, theme = 'study' }) {
  const sentence = String(text || '').trim();
  if (!sentence) return null;
  return (
    <button
      type="button"
      aria-label={`Hear again: ${sentence}`}
      title="Tap to hear Ms. Sonoma say this sentence again"
      onClick={() => onReplay?.(sentence)}
      style={{ appearance: 'none', display: 'inline', padding: '1px 3px', margin: '1px 1px',
        border: 'none', borderRadius: 4, background: 'transparent', color: 'inherit',
        font: 'inherit', textAlign: 'left', lineHeight: 'inherit', cursor: 'pointer',
        textDecoration: 'underline', textDecorationStyle: 'dotted',
        textDecorationColor: theme === 'ask' ? '#2563eb' : '#d97706', textUnderlineOffset: 3 }}
    >{sentence}</button>
  );
}
