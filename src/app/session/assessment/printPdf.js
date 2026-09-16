import jsPDF from 'jspdf'

export async function shareOrPreviewPdf(blob, fileName = 'document.pdf', previewWin = null) {
  try {
    const supportsFile = typeof File !== 'undefined'
    const file = supportsFile ? new File([blob], fileName, { type: 'application/pdf' }) : null
    if (file && navigator?.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: fileName })
      try { if (previewWin && !previewWin.closed) previewWin.close() } catch {}
      return
    }
  } catch {
    // Fall through to the browser PDF preview.
  }

  try {
    const url = URL.createObjectURL(blob)
    const win = previewWin && previewWin.document ? previewWin : null
    if (win) {
      try { win.addEventListener('beforeunload', () => URL.revokeObjectURL(url)) } catch {}
      win.location.href = url
    } else {
      window.location.href = url
      setTimeout(() => { try { URL.revokeObjectURL(url) } catch {} }, 10000)
    }
    return
  } catch {
    // Fall through to download.
  }

  try {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    setTimeout(() => {
      try { URL.revokeObjectURL(url) } catch {}
      try { document.body.removeChild(anchor) } catch {}
    }, 10000)
  } catch {
    // Nothing else to do.
  }
}

export async function createAssessmentPdf({
  items = [],
  label = 'worksheet',
  lessonTitle = 'Lesson',
  fileBase = 'lesson',
  previewWin = null,
} = {}) {
  const doc = new jsPDF()
  const pageHeight = doc.internal.pageSize.getHeight()
  const niceLabel = label.charAt(0).toUpperCase() + label.slice(1)

  const shrinkFIBBlanks = (value, answerLength = 0) => {
    if (!value) return value
    return value.replace(/_{4,}/g, (match) => {
      let targetSize = 12
      if (answerLength > 0) targetSize = Math.max(12, Math.min(60, answerLength * 2))
      else targetSize = Math.max(12, Math.round(match.length * 0.66))
      return '_'.repeat(targetSize)
    })
  }

  const renderLineText = (item) => {
    let base = String(item.prompt || item.question || item.Q || item.q || '')
    const questionType = String(item.type || '').toLowerCase()
    const isFIB = item.sourceType === 'fib' || /fill\s*in\s*the\s*blank|fillintheblank/.test(questionType)
    const isTF = item.sourceType === 'tf' || /^(true\s*\/\s*false|truefalse|tf)$/i.test(questionType)
    if (isFIB) {
      let answerLength = 0
      const answer = item.answer || item.expected || item.correct || item.key || ''
      if (Array.isArray(item.answers) && item.answers.length > 0) {
        answerLength = Math.max(...item.answers.map((entry) => String(entry || '').trim().length))
      } else if (answer) {
        answerLength = String(answer).trim().length
      }
      base = shrinkFIBBlanks(base, answerLength)
    }
    const trimmed = base.trimStart()
    if (isTF && !/^true\s*\/\s*false\s*:/i.test(trimmed) && !/^true\s*false\s*:/i.test(trimmed)) {
      base = `True/False: ${base}`
    }

    let choicesLine = null
    const options = Array.isArray(item?.options)
      ? item.options.filter(Boolean)
      : (Array.isArray(item?.choices) ? item.choices.filter(Boolean) : [])
    if (options.length) {
      const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
      const anyLabel = /^\s*\(?[A-Z]\)?\s*[\.\:\)\-]\s*/i
      choicesLine = options.map((option, index) => {
        const raw = String(option ?? '').trim()
        const cleaned = raw.replace(anyLabel, '').trim()
        const optionLabel = labels[index] || ''
        return `${optionLabel}.\u00A0${cleaned}`
      }).join('   ')
    }
    return { prompt: base, choicesLine }
  }

  const topMargin = 28
  const bottomMargin = 18
  const left = 14
  const maxWidth = 182
  const choiceIndent = 6
  const minBodyFont = 8
  const maxBodyFont = 18
  const minChoiceFont = 8
  const getLineHeight = (size) => Math.max(size * 0.5, 4.5)

  const measureContentHeight = (bodySize) => {
    const choiceSize = Math.max(minChoiceFont, Math.min(bodySize - 1, Math.round(bodySize * 0.92)))
    const promptLineHeight = getLineHeight(bodySize)
    const choiceLineHeight = getLineHeight(choiceSize)
    let height = 0

    doc.setFontSize(bodySize)
    items.forEach((item, index) => {
      const number = item.number || index + 1
      const { prompt, choicesLine } = renderLineText(item)
      const promptLines = doc.splitTextToSize(`${number}. ${prompt}`, maxWidth)
      height += promptLines.length * promptLineHeight
      if (choicesLine) {
        doc.setFontSize(choiceSize)
        const choiceLines = doc.splitTextToSize(choicesLine, maxWidth - choiceIndent)
        height += choiceLines.length * choiceLineHeight
        doc.setFontSize(bodySize)
      }
      const spacer = label === 'worksheet' ? Math.max(bodySize * 0.35, 3) : Math.max(bodySize * 0.7, 4)
      height += spacer
    })
    return height
  }

  const availableHeight = pageHeight - topMargin - bottomMargin
  let bodyFontSize = minBodyFont
  for (let size = maxBodyFont; size >= minBodyFont; size -= 0.5) {
    if (measureContentHeight(size) <= availableHeight) {
      bodyFontSize = size
      break
    }
  }

  const choiceFontSize = Math.max(minChoiceFont, Math.min(bodyFontSize - 1, Math.round(bodyFontSize * 0.92)))
  const promptLineHeight = getLineHeight(bodyFontSize)
  const choiceLineHeight = getLineHeight(choiceFontSize)
  const spacerSize = label === 'worksheet' ? Math.max(bodyFontSize * 0.35, 3) : Math.max(bodyFontSize * 0.7, 4)
  const bottomLimit = pageHeight - bottomMargin

  doc.setTextColor(0, 0, 0)
  const headerSize = Math.min(20, Math.max(12, bodyFontSize + 2))
  doc.setFontSize(headerSize)
  doc.text(`${String(lessonTitle || 'Lesson').trim()} ${niceLabel}`, 12, 14)
  doc.setDrawColor(180, 180, 180)
  doc.line(12, 18, 198, 18)

  let y = topMargin
  const drawParagraph = (text, fontSize, lineHeight, indent = 0) => {
    doc.setFontSize(fontSize)
    const lines = doc.splitTextToSize(text, maxWidth - indent)
    for (const line of lines) {
      if (y > bottomLimit) {
        doc.addPage()
        y = topMargin
      }
      doc.text(line, left + indent, y)
      y += lineHeight
    }
  }

  items.forEach((item, index) => {
    const number = item.number || index + 1
    const { prompt, choicesLine } = renderLineText(item)
    drawParagraph(`${number}. ${prompt}`, bodyFontSize, promptLineHeight, 0)
    if (choicesLine) drawParagraph(choicesLine, choiceFontSize, choiceLineHeight, choiceIndent)
    y += spacerSize
  })

  const safeFileBase = String(fileBase || 'lesson').replace(/\.json$/i, '')
  const fileName = `${safeFileBase}-${label}.pdf`
  const blob = doc.output('blob')
  await shareOrPreviewPdf(blob, fileName, previewWin)
  return { blob, fileName }
}
