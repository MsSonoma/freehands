import { AI_MODEL } from '../aiModel.js'

export async function generateInstructionalForecastItems({ slots, context, fetchImpl = fetch } = {}) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('Instructional forecasting is not configured')
  const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Return only valid JSON. You propose instructional progression titles and concise descriptions. Do not create review, recovery, retention, assessment, schedule, date, subject, ownership, or permission decisions.' },
        { role: 'user', content: JSON.stringify({
          task: 'Return {"items":[{"title":"...","description":"..."}]} with exactly one item per server-owned slot, in the same order.',
          constraints: 'Each item must be a new instructional progression step. Do not duplicate Daily Follow-Up, Weekly Review, Mr. Slate recovery, retention, or mastery checks.',
          slots: slots.map((slot) => ({ subject: slot.subject })),
          syllabus: context.syllabus,
          evidence_summaries: context.evidence_summaries,
        }) },
      ],
    }),
  })
  if (!response.ok) throw new Error(`Instructional forecast model failed (${response.status})`)
  const payload = await response.json()
  const text = payload?.choices?.[0]?.message?.content
  let parsed
  try { parsed = JSON.parse(text || '{}') } catch { throw new Error('Instructional forecast model returned invalid JSON') }
  if (!Array.isArray(parsed.items)) throw new Error('Instructional forecast model returned no item list')
  return parsed.items
}
