'use client';

export default function VocabularyPanel({ entries = [], onStudy, onClose }) {
  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #d1d5db', borderRadius: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
        <div>
          <div style={{ fontWeight: 900, color: '#111827', fontSize: 18 }}>Words</div>
          <div style={{ color: '#6b7280', fontSize: 13 }}>Lesson vocabulary stays available while you learn.</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close Words" style={{ border: 'none', borderRadius: 8, background: '#374151', color: '#fff', padding: '7px 10px', fontWeight: 800, cursor: 'pointer' }}>X</button>
      </div>
      <div style={{ overflowY: 'auto', padding: 12, flex: 1 }}>
        {entries.length ? entries.map((entry, index) => (
          <div key={`${entry.term}-${index}`} style={{ padding: '10px 0', borderBottom: index === entries.length - 1 ? 'none' : '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 850, color: '#111827', fontSize: 17 }}>{entry.term}</div>
                <div style={{ color: entry.definition ? '#4b5563' : '#9ca3af', marginTop: 3, lineHeight: 1.4 }}>{entry.definition || 'No lesson definition was provided.'}</div>
              </div>
              <button
                type="button"
                onClick={() => onStudy?.({ type: 'vocabulary', text: entry.term, term: entry.term, definition: entry.definition || '' })}
                aria-label={`Study ${entry.term} with Ms. Sonoma`}
                title="Study this word"
                style={{ border: '1px solid #d97706', background: '#fffbeb', color: '#92400e', borderRadius: 8, minHeight: 34, padding: '6px 10px', cursor: 'pointer', fontWeight: 800 }}
              >
                {'\u{1F91A}'} Study
              </button>
            </div>
          </div>
        )) : <div style={{ color: '#6b7280' }}>No lesson vocabulary was provided.</div>}
      </div>
    </div>
  );
}
