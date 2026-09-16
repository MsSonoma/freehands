'use client';

export default function StudyPanel({
  state = {},
  input = '',
  setInput,
  busy = false,
  error = '',
  onSubmit,
  onQuickAction,
  onClose,
  inputRef,
}) {
  const data = state?.data || state || {};
  const target = data.target || {};
  const history = Array.isArray(data.history) ? data.history : [];
  const targetLabel = target.type === 'vocabulary' ? (target.term || target.text || 'this word') : (target.text || 'this part');
  const buttonBase = {
    border: 'none',
    borderRadius: 10,
    padding: '9px 12px',
    fontWeight: 800,
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.6 : 1,
  };

  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', background: '#fffaf0', border: '1px solid #f59e0b', borderRadius: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #fde68a', background: '#fffbeb' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#92400e', fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Study this</div>
            <div style={{ color: '#111827', fontWeight: 750, marginTop: 4, whiteSpace: 'pre-wrap' }}>{targetLabel}</div>
            {target.type === 'vocabulary' && target.definition ? (
              <div style={{ color: '#4b5563', fontSize: 14, marginTop: 4 }}>{target.definition}</div>
            ) : null}
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Back to lesson" title="Back to lesson" style={{ ...buttonBase, padding: '6px 10px', background: '#374151', color: '#fff' }}>X</button>
        </div>
      </div>

      <div style={{ flex: '1 1 auto', minHeight: 100, overflowY: 'auto', padding: 12 }}>
        {history.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: 14, padding: '8px 2px' }}>Tell Ms. Sonoma what is not making sense, or use one of the buttons below.</div>
        ) : history.map((turn, index) => (
          <div key={`${turn.role || 'turn'}-${index}`} style={{ marginBottom: 9, display: 'flex', justifyContent: turn.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '88%', padding: '8px 10px', borderRadius: 10, background: turn.role === 'user' ? '#fee2e2' : '#fff', border: turn.role === 'user' ? '1px solid #fecaca' : '1px solid #e5e7eb', color: '#111827', whiteSpace: 'pre-wrap' }}>
              <strong style={{ color: turn.role === 'user' ? '#991b1b' : '#92400e' }}>{turn.role === 'user' ? 'You' : 'Ms. Sonoma'}:</strong>{' '}{turn.content || turn.text || ''}
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid #fde68a', padding: 12, background: '#fffbeb' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 9 }}>
          <button type="button" disabled={busy} onClick={() => onQuickAction?.('reframe')} style={{ ...buttonBase, background: '#2563eb', color: '#fff' }}>Explain it another way</button>
          <button type="button" disabled={busy} onClick={() => onQuickAction?.('deepen')} style={{ ...buttonBase, background: '#c7442e', color: '#fff' }}>I still don't understand</button>
          <button type="button" disabled={busy} onClick={() => onQuickAction?.('understood')} style={{ ...buttonBase, background: '#059669', color: '#fff' }}>That makes sense now</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(event) => setInput?.(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && input.trim() && !busy) {
                event.preventDefault();
                onSubmit?.();
              }
            }}
            disabled={busy}
            placeholder="Or tell Ms. Sonoma what's confusing you..."
            style={{ flex: 1, minWidth: 0, border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 12px', fontSize: 16, background: '#fff' }}
          />
          <button type="button" disabled={busy || !input.trim()} onClick={onSubmit} style={{ ...buttonBase, background: '#111827', color: '#fff' }}>Send</button>
          <button type="button" disabled={busy} onClick={onClose} style={{ ...buttonBase, background: '#374151', color: '#fff' }}>Back to lesson</button>
        </div>
        {error ? <div role="status" style={{ color: '#b91c1c', fontWeight: 700, marginTop: 7 }}>{error}</div> : null}
      </div>
    </div>
  );
}
