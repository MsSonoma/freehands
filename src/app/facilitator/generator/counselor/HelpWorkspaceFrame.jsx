'use client'

import FacilitatorPage from '../../page'
import LessonLibraryPage from '../../lessons/page'
import LessonMakerPage from '../page'

const TABS = [
  { id: 'syllabus', label: 'Syllabus' },
  { id: 'lessons', label: 'Lesson Library' },
]

export default function HelpWorkspaceFrame({
  surface = 'syllabus',
  expanded = false,
  onSurfaceChange,
  onToggleExpanded,
  onOpenGuidance,
  workspaceHref = '/facilitator',
  onNavigate,
  conversationDockOpen = true,
  onToggleConversationDock,
}) {
  const isContextualGenerator = surface === 'generator'

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
      <header style={{
        flexShrink: 0,
        minHeight: 46,
        padding: '7px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: '1px solid #e2d9cd',
        background: '#fffdf8',
      }}>
        <nav aria-label="Help workspace" style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSurfaceChange?.(tab.id)}
              aria-pressed={surface === tab.id}
              style={{
                border: '1px solid ' + (surface === tab.id ? '#b85b45' : '#d8cec1'),
                borderRadius: 8,
                padding: '7px 10px',
                background: surface === tab.id ? '#fff1eb' : '#fff',
                color: surface === tab.id ? '#7b392b' : '#4d4741',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
          {isContextualGenerator && (
            <span style={{
              border: '1px solid #d8cec1',
              borderRadius: 8,
              padding: '7px 10px',
              background: '#f7f3ed',
              color: '#4d4741',
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}>
              Lesson Maker
            </span>
          )}
        </nav>

        <button
          type="button"
          onClick={onOpenGuidance}
          title="Open Plan details and Curriculum Guidance"
          style={{
            border: '1px solid #d8cec1',
            borderRadius: 8,
            padding: '7px 10px',
            background: '#fff',
            color: '#4d4741',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Guidance
        </button>
        {expanded && (
          <button
            type="button"
            onClick={onToggleConversationDock}
            aria-pressed={conversationDockOpen}
            title={conversationDockOpen ? 'Hide conversation dock' : 'Show conversation dock'}
            style={{
              border: '1px solid #d8cec1',
              borderRadius: 8,
              padding: '7px 10px',
              background: conversationDockOpen ? '#fff1eb' : '#fff',
              color: '#4d4741',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Conversation
          </button>
        )}
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-label={expanded ? 'Exit full workspace' : 'Expand workspace'}
          title={expanded ? 'Exit full workspace' : 'Expand workspace'}
          style={{
            width: 36,
            height: 34,
            display: 'grid',
            placeItems: 'center',
            border: '1px solid #d8cec1',
            borderRadius: 8,
            background: '#fff',
            color: '#4d4741',
            cursor: 'pointer',
            fontSize: 18,
          }}
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            {expanded ? (
              <>
                <path d="M2 6V2h4" />
                <path d="M14 10v4h-4" />
                <path d="M2 2l4 4" />
                <path d="M14 14l-4-4" />
              </>
            ) : (
              <>
                <path d="M6 2H2v4" />
                <path d="M10 14h4v-4" />
                <path d="M6 2L2 6" />
                <path d="M10 14l4-4" />
              </>
            )}
          </svg>
        </button>
      </header>

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
