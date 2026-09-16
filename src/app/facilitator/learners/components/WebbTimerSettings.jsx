'use client'

function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#374151', cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={event => onChange?.(event.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

function NumberSetting({ label, value, onChange, min = 1, max = 60, disabled = false, suffix = 'minutes' }) {
  return (
    <label style={{ display: 'grid', gridTemplateColumns: '1fr minmax(92px, 120px)', alignItems: 'center', gap: 12, fontSize: 13, color: '#374151' }}>
      <span>{label}</span>
      <span>
        <input
          type="number"
          min={min}
          max={max}
          step="1"
          value={value}
          disabled={disabled}
          onChange={event => onChange?.(event.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, fontWeight: 700, textAlign: 'center', background: disabled ? '#f3f4f6' : '#fff' }}
        />
        <span style={{ display: 'block', textAlign: 'center', color: '#6b7280', fontSize: 10, marginTop: 2 }}>{suffix}</span>
      </span>
    </label>
  )
}

export default function WebbTimerSettings({ value, onChange }) {
  const settings = value || {}
  const patch = (next) => onChange?.({ ...settings, ...next })
  const responseOn = settings.responsePacingEnabled !== false
  const playOn = settings.playTimesEnabled !== false

  return (
    <section style={{ marginTop: 18, paddingTop: 16, borderTop: '2px solid #e5e7eb' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, color: '#0f766e', fontSize: 16 }}>Mrs. Webb timers</div>
        <p style={{ margin: '5px 0 0', color: '#6b7280', fontSize: 12, lineHeight: 1.45 }}>
          Mrs. Webb measures each learner response separately. Her response clock counts up and never fails a learner for running out of time.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 10, padding: 12, border: '1px solid #ccfbf1', background: '#f0fdfa', borderRadius: 10 }}>
        <Toggle
          checked={responseOn}
          onChange={checked => patch({ responsePacingEnabled: checked })}
          label="Response pacing reminders"
        />
        <NumberSetting
          label="Time between reminder levels"
          value={settings.reminderIntervalMin ?? 2}
          onChange={reminderIntervalMin => patch({ reminderIntervalMin })}
          min={1}
          max={30}
          disabled={!responseOn}
        />
        <p style={{ margin: 0, color: '#64748b', fontSize: 11, lineHeight: 1.45, opacity: responseOn ? 1 : 0.55 }}>
          Four increasingly direct reminders are spoken. If there is still no response after the fifth interval, Mrs. Webb silently creates one facilitator notification for that turn.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 10, padding: 12, marginTop: 12, border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 10 }}>
        <Toggle
          checked={playOn}
          onChange={checked => patch({ playTimesEnabled: checked })}
          label="Mrs. Webb play times"
        />
        <NumberSetting
          label="Base play time"
          value={settings.playTimeMin ?? 5}
          onChange={playTimeMin => patch({ playTimeMin })}
          min={1}
          max={60}
          disabled={!playOn}
        />
        <div style={{ display: 'grid', gap: 8, opacity: playOn ? 1 : 0.5 }}>
          <Toggle disabled={!playOn} checked={settings.researchMidpointEnabled !== false} onChange={checked => patch({ researchMidpointEnabled: checked })} label="Halfway through research objectives" />
          <Toggle disabled={!playOn} checked={settings.transitionEnabled !== false} onChange={checked => patch({ transitionEnabled: checked })} label="Between research and writing" />
          <Toggle disabled={!playOn} checked={settings.writingMidpointEnabled !== false} onChange={checked => patch({ writingMidpointEnabled: checked })} label="Halfway through essay writing" />
        </div>
        <p style={{ margin: 0, color: '#64748b', fontSize: 11, lineHeight: 1.45, opacity: playOn ? 1 : 0.55 }}>
          Enabled breaks open the same game collection used by Ms. Sonoma. An active Golden Key adds the learner's Golden Key bonus time to each Mrs. Webb play break.
        </p>
      </div>
    </section>
  )
}