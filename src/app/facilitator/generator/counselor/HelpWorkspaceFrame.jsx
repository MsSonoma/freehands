'use client'

import FacilitatorPage from '../../page'
import LessonLibraryPage from '../../lessons/page'
import LessonMakerPage from '../page'


export default function HelpWorkspaceFrame({
  surface = 'syllabus',
  expanded = false,
  workspaceHref = '/facilitator',
  onNavigate,
}) {

  return (
    <section style={{
      width: '100%',
      height: '100%',
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      background: '#fffdf8',
      border: expanded ? 'none' : '1px solid #d8cec1',
      borderRadius: expanded ? 0 : 12,
      overflow: 'hidden',
      boxShadow: expanded ? 'none' : '0 4px 18px rgba(47,39,31,0.10)',
    }}>

      <div style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        overscrollBehavior: 'contain',
        background: '#f8f5f0',
      }}>
        {surface === 'syllabus' && <FacilitatorPage embeddedHref={workspaceHref} onNavigate={onNavigate} />}
        {surface === 'lessons' && <LessonLibraryPage onNavigate={onNavigate} />}
        {surface === 'generator' && <LessonMakerPage embeddedHref={workspaceHref} onNavigate={onNavigate} />}
      </div>
    </section>
  )
}
