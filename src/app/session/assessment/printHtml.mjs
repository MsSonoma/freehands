// Print from a same-origin HTML window so the browser opens its print dialog
// without forcing the learner to find a downloaded PDF.
const htmlEscape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]))

const questionText = (item) => String(item.prompt || item.question || item.Q || item.q || '').trim()

function questionChoices(item) {
  const choices = Array.isArray(item.options) ? item.options : (Array.isArray(item.choices) ? item.choices : [])
  return choices.filter((choice) => choice != null && choice !== '').map((choice) => {
    if (choice && typeof choice === 'object') return String(choice.text || choice.label || choice.value || choice.letter || '')
    return String(choice)
  })
}

export function buildAssessmentPrintHtml({ items = [], label = 'test', lessonTitle = 'Lesson' } = {}) {
  const niceLabel = String(label || 'test').trim().replace(/^./, (letter) => letter.toUpperCase())
  const title = `${String(lessonTitle || 'Lesson').trim()} ${niceLabel}`
  const body = items.map((item, index) => {
    const number = Number(item.number) > 0 ? Number(item.number) : index + 1
    const isTrueFalse = item.sourceType === 'tf' || /^(true\s*\/\s*false|truefalse|tf)$/i.test(String(item.type || ''))
    const base = questionText(item)
    const question = isTrueFalse && !/^true\s*(?:\/\s*false|false)\s*:/i.test(base)
      ? `True/False: ${base}`
      : base
    const choices = questionChoices(item)
    const options = choices.length
      ? `<ol class="choices" type="A">${choices.map((choice) => `<li>${htmlEscape(choice.replace(/^\s*\(?[A-Z]\)?\s*[.:)\-]\s*/i, ''))}</li>`).join('')}</ol>`
      : ''
    return `<li class="question" value="${number}"><div class="prompt">${htmlEscape(question)}</div>${options}</li>`
  }).join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${htmlEscape(title)}</title>
<style>
  @page { size: auto; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { background: white; color: #111; font-family: Arial, sans-serif; margin: 0 auto; max-width: 850px; padding: 24px; }
  .print-controls { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; padding: 12px; background: #f2f4f7; border-radius: 7px; }
  .print-controls button { color: white; background: #243247; border: 0; border-radius: 5px; padding: 10px 18px; font-size: 16px; cursor: pointer; }
  .print-controls span { font-size: 13px; }
  h1 { font-size: 21px; font-weight: 700; margin: 0 0 24px; padding-bottom: 8px; border-bottom: 1px solid #aaa; }
  .questions { margin: 0; padding-left: 25px; font-size: 13pt; line-height: 1.45; }
  .question { margin-bottom: 22px; break-inside: avoid; page-break-inside: avoid; padding-left: 4px; }
  .prompt { white-space: pre-wrap; overflow-wrap: anywhere; }
  .choices { margin: 7px 0 0; padding-left: 28px; list-style-type: upper-alpha; }
  .choices li { margin-bottom: 3px; }
  @media print {
    body { padding: 0; max-width: none; }
    .print-controls { display: none !important; }
    h1 { margin-bottom: 18px; }
  }
</style>
</head>
<body>
<div class="print-controls"><button id="print-assessment" type="button">Print ${htmlEscape(niceLabel)}</button><span>If the print dialog did not open, select Print ${htmlEscape(niceLabel)} here.</span></div>
<main><h1>${htmlEscape(title)}</h1><ol class="questions">${body}</ol></main>
</body>
</html>`
}

export function printAssessmentWindow({ previewWin, items = [], label = 'test', lessonTitle = 'Lesson' } = {}) {
  if (!previewWin || previewWin.closed) throw new Error('Allow the print window to open, then select Print Test.')
  const doc = previewWin.document
  doc.open()
  doc.write(buildAssessmentPrintHtml({ items, label, lessonTitle }))
  doc.close()
  const print = () => { previewWin.focus(); previewWin.print() }
  // The print button remains usable if a browser blocks automatic print dialogs.
  doc.getElementById('print-assessment')?.addEventListener('click', print)
  // Some browsers suppress programmatic printing; keep the manual button available.
  const tryAutoPrint = () => { try { print() } catch { /* Browser requires a direct user click. */ } }
  if (doc.readyState === 'complete') tryAutoPrint()
  else previewWin.addEventListener('load', tryAutoPrint, { once: true })
}
