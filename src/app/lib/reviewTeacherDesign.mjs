const SYSTEM_FONT = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const SLATE_FONT = '"ui-monospace","Cascadia Code","Source Code Pro",monospace'

const DESIGNS = Object.freeze({
  sonoma: Object.freeze({
    id: 'sonoma', layout: 'sonoma', fontFamily: SYSTEM_FONT,
    page: '#ffffff', content: '#ffffff', surface: '#ffffff', surfaceElev: '#ffffff',
    header: '#ffffff', headerText: '#111827', headerMuted: '#6b7280',
    accent: '#c7442e', accentContrast: '#ffffff', text: '#111827', muted: '#6b7280',
    border: '#e5e7eb', softBorder: '#f3f4f6', choice: '#ffffff', input: '#ffffff',
    videoBackground: '#000000', videoObjectFit: 'cover', videoObjectPosition: 'top center',
    videoRadius: 12, videoShadow: '0 2px 16px rgba(0,0,0,0.12)',
    cardRadius: 14, cardShadow: '0 4px 12px rgba(0,0,0,0.18)',
    labelLetterSpacing: 0.5, labelTransform: 'none',
    chromeButton: '#1f2937', chromeButtonText: '#ffffff',
    correct: '#16a34a', correctSoft: 'rgba(22,163,74,0.08)',
    wrong: '#dc2626', wrongSoft: 'rgba(220,38,38,0.07)',
    timeout: '#d97706', timeoutSoft: 'rgba(217,119,6,0.08)',
  }),
  webb: Object.freeze({
    id: 'webb', layout: 'webb', fontFamily: SYSTEM_FONT,
    page: '#f9fafb', content: '#f9fafb', surface: '#ffffff', surfaceElev: '#ffffff',
    header: '#0f766e', headerText: '#ffffff', headerMuted: 'rgba(255,255,255,0.82)',
    accent: '#0d9488', accentContrast: '#ffffff', text: '#111827', muted: '#6b7280',
    border: '#99f6e4', softBorder: '#e5e7eb', choice: '#ffffff', input: '#ffffff',
    videoBackground: '#000000', videoObjectFit: 'cover', videoObjectPosition: 'top center',
    videoRadius: 12, videoShadow: '0 2px 16px rgba(0,0,0,0.12)',
    cardRadius: 18, cardShadow: '0 1px 3px rgba(0,0,0,0.09)',
    labelLetterSpacing: 0.5, labelTransform: 'none',
    chromeButton: 'rgba(255,255,255,0.15)', chromeButtonText: '#ffffff',
    correct: '#0d9488', correctSoft: '#f0fdfa',
    wrong: '#dc2626', wrongSoft: '#fef2f2',
    timeout: '#d97706', timeoutSoft: '#fffbeb',
  }),
  slate: Object.freeze({
    id: 'slate', layout: 'slate', fontFamily: SLATE_FONT,
    page: '#0d1117', content: '#0d1117', surface: '#161b22', surfaceElev: '#1c2128',
    header: '#161b22', headerText: '#e6edf3', headerMuted: '#8b949e',
    accent: '#58a6ff', accentContrast: '#0d1117', text: '#e6edf3', muted: '#8b949e',
    border: '#30363d', softBorder: '#30363d', choice: '#1c2128', input: '#0d1117',
    videoBackground: 'transparent', videoObjectFit: 'contain', videoObjectPosition: 'center',
    videoRadius: 0, videoShadow: 'none', cardRadius: 12, cardShadow: 'none',
    labelLetterSpacing: 2, labelTransform: 'uppercase',
    chromeButton: '#161b22', chromeButtonText: '#8b949e',
    correct: '#3fb950', correctSoft: 'rgba(63,185,80,0.15)',
    wrong: '#f85149', wrongSoft: 'rgba(248,81,73,0.15)',
    timeout: '#d29922', timeoutSoft: 'rgba(210,153,34,0.15)',
  }),
})

export function reviewTeacherDesign(value) {
  const id = String(value || '').trim().toLowerCase()
  return DESIGNS[id] || DESIGNS.slate
}

export function reviewTeacherCssVariables(value) {
  const d = reviewTeacherDesign(value)
  return {
    '--review-font': d.fontFamily, '--review-bg': d.page, '--review-content': d.content,
    '--review-surface': d.surface, '--review-surface-elev': d.surfaceElev,
    '--review-header': d.header, '--review-header-text': d.headerText, '--review-header-muted': d.headerMuted,
    '--review-accent': d.accent, '--review-accent-contrast': d.accentContrast,
    '--review-text': d.text, '--review-muted': d.muted, '--review-border': d.border,
    '--review-soft-border': d.softBorder, '--review-choice': d.choice, '--review-input': d.input,
    '--review-correct': d.correct, '--review-correct-soft': d.correctSoft,
    '--review-wrong': d.wrong, '--review-wrong-soft': d.wrongSoft,
    '--review-timeout': d.timeout, '--review-timeout-soft': d.timeoutSoft,
  }
}
