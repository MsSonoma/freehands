'use client'

const buttonStyle = (active, disabled) => ({
  width: 46,
  height: 46,
  flex: '0 0 46px',
  border: '2px solid ' + (active ? '#3b82f6' : '#d1d5db'),
  borderRadius: 7,
  background: active ? '#dbeafe' : '#fff',
  color: '#374151',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.55 : 1,
  display: 'grid',
  placeItems: 'center',
  padding: 0,
  overflow: 'hidden',
})

function NavButton({ title, active = false, disabled = false, onClick, children }) {
  return <button type="button" aria-label={title} title={title} aria-pressed={active} disabled={disabled} onClick={onClick} style={buttonStyle(active, disabled)}>{children}</button>
}

export default function HelpBottomNav({ activeScreen, expanded, hasAccess, buttonVideoRef, onHome, onLessons, onSyllabus, onGuidance, onExpand }) {
  return <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
    <NavButton title="Help Home" active={activeScreen === 'mentor'} onClick={onHome}>
      <video ref={buttonVideoRef} loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}><source src="/media/ms-sonoma-3.mp4" type="video/mp4" /></video>
    </NavButton>
    <NavButton title="Lessons" active={activeScreen === 'lessons'} disabled={!hasAccess} onClick={onLessons}><span style={{ fontSize: 22 }}>&#128218;</span></NavButton>
    <NavButton title="Syllabus" active={activeScreen === 'syllabus'} onClick={onSyllabus}><span style={{ fontSize: 22 }}>&#128203;</span></NavButton>
    <NavButton title="Curriculum Guidance" onClick={onGuidance}><span style={{ fontSize: 22 }}>&#129517;</span></NavButton>
    <NavButton title={expanded ? 'Restore Help' : 'Expand Help'} active={expanded} onClick={onExpand}>
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {expanded ? <><path d="M3 8V3h5"/><path d="M19 14v5h-5"/><path d="M3 3l6 6"/><path d="M19 19l-6-6"/></> : <><path d="M8 3H3v5"/><path d="M14 19h5v-5"/><path d="M8 3L3 8"/><path d="M14 19l5-5"/></>}
      </svg>
    </NavButton>
  </div>
}
