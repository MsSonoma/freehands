'use client';

const numberStyle = { width: '100%', boxSizing: 'border-box', padding: '7px 9px', border: '1px solid #94a3b8', borderRadius: 7, fontFamily: 'Roboto, sans-serif', fontWeight: 700 };
function NumberSetting({ label, value, onChange, min = 0, max = 99, unit = '' }) {
  return <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(76px,115px)', gap: 12, alignItems: 'center', fontSize: 13 }}>
    <span>{label}</span><span><input type="number" min={min} max={max} step="1" value={value} onChange={e => onChange(e.target.value)} style={numberStyle} />{unit && <small style={{ color: '#64748b' }}>{unit}</small>}</span>
  </label>;
}
export default function WorkTimerStyleSettings({ teacher, value, onChange }) {
  const settings = value || {};
  const isWebb = teacher === 'webb';
  const style = settings.style === 'countdown' || settings.style === 'countup'
    ? settings.style : (isWebb ? 'countup' : 'countdown');
  const patch = next => onChange?.({ ...settings, ...next });
  const label = isWebb ? 'Mrs. Webb' : 'Ms. Sonoma';
  return <section style={{ marginBottom: 16, padding: 14, border: '1px solid #cbd5e1', borderRadius: 10, background: '#f8fafc', fontFamily: 'Roboto, sans-serif', color: '#1f2937', display: 'grid', gap: 12 }}>
    <strong style={{ fontSize: 16 }}>{label} work timer style</strong>
    <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700 }}>Timer method
      <select value={style} onChange={e => patch({ style: e.target.value })} style={{ ...numberStyle, fontWeight: 600 }}>
        <option value="countdown">Count down: short response window</option>
        <option value="countup">Count up: time since the last response</option>
      </select>
    </label>
    {style === 'countup' ? <>
      <p style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}>The visible clock counts up from zero whenever the teacher presents a new sentence or the learner responds. Separate learner-response timing controls the four reminders and facilitator notification on the fifth interval. Each distinct escalated turn counts as one stall. Finishing with no more than the allowed stalls earns a Golden Key, when enabled.</p>
      <NumberSetting label="Maximum stalls allowed for Golden Key" value={settings.stallAllowance ?? 2} onChange={stallAllowance => patch({ stallAllowance })} min={0} max={99} />
      <NumberSetting label="Minutes between reminder levels" value={settings.reminderIntervalMin ?? 2} onChange={reminderIntervalMin => patch({ reminderIntervalMin })} min={1} max={30} />
    </> : isWebb ? <>
      <p style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}>The learner sees a short countdown that restarts with each response, not an intimidating whole-phase timer. Research and writing have separate reward budgets. Time spent actively responding counts against each budget; AI speech and play breaks do not. Both stages must finish within their limits for a Golden Key. Time never prevents mastery or lesson completion.</p>
      <NumberSetting label="Research work time" value={settings.researchWorkMin ?? 30} onChange={researchWorkMin => patch({ researchWorkMin })} min={1} max={240} unit="minutes" />
      <NumberSetting label="Writing work time" value={settings.writingWorkMin ?? 45} onChange={writingWorkMin => patch({ writingWorkMin })} min={1} max={240} unit="minutes" />
    </> : <p style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}>The learner sees a short countdown that restarts with each response. Behind the scenes, completing at least three work phases within their separate limits still earns a Golden Key. The visible clock never prevents learning from continuing.</p>}
    {style === 'countdown' && (
      <NumberSetting label="Short response countdown (minutes)" value={settings.reminderIntervalMin ?? 2} onChange={reminderIntervalMin => patch({ reminderIntervalMin })} min={1} max={30} />
    )}
    <small style={{ color: '#475569' }}>Changes to these settings take effect on the next lesson, not in a lesson already underway.</small>
  </section>;
}
