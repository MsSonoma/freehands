'use client'

const buttonStyle = (active, disabled) => ({ flex:'1 1 0', minWidth:0, maxWidth:112, height:54, border:'1px solid ' + (active ? '#b85b45' : '#d1d5db'), borderRadius:8, background:active ? '#fff1eb' : '#fff', color:disabled ? '#9ca3af' : '#374151', opacity:disabled ? .58 : 1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, cursor:disabled ? 'not-allowed' : 'pointer' })

function B({ label, active, disabled, onClick, children, title }) {
  return <button type="button" aria-pressed={active} disabled={disabled} onClick={onClick} title={title || label} style={buttonStyle(active, disabled)}><span aria-hidden="true" style={{height:26,fontSize:21,lineHeight:1,display:'grid',placeItems:'center'}}>{children}</span><span style={{fontSize:10,fontWeight:700,lineHeight:1.1}}>{label}</span></button>
}

export default function HelpBottomNav({ activeScreen, expanded, hasAccess, buttonVideoRef, onHome, onLessons, onSyllabus, onGuidance, onExpand }) {
  return <nav aria-label="Help navigation" style={{display:'flex',justifyContent:'center',gap:5,width:'100%'}}>
    <B label="Home" active={activeScreen==='mentor'} onClick={onHome}><span style={{width:26,height:26,borderRadius:'50%',overflow:'hidden',background:'#000'}}><video ref={buttonVideoRef} loop muted playsInline style={{width:'100%',height:'100%',objectFit:'cover'}}><source src="/media/ms-sonoma-3.mp4" type="video/mp4" /></video></span></B>
    <B label="Lessons" active={activeScreen==='lessons'} disabled={!hasAccess} onClick={onLessons}>&#128218;</B>
    <B label="Syllabus" active={activeScreen==='syllabus'} onClick={onSyllabus}>&#128203;</B>
    <B label="Guidance" onClick={onGuidance}>&#129517;</B>
    <B label={expanded?'Restore':'Expand'} active={expanded} onClick={onExpand} title={expanded?'Restore Help':'Expand Help'}><span style={{fontSize:18}}>{expanded?'◢◤':'◤◢'}</span></B>
  </nav>
}
