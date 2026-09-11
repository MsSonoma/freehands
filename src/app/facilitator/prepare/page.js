'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FACILITATOR_PREPARATION_STAGES } from '@/app/lib/facilitatorPreparation.mjs'
import { buildLessonGeneratorReviewHref, buildLessonWorkflowReturnHref, normalizeLessonWorkflowSource } from '@/app/lib/facilitatorLessonWorkflow.mjs'
import { clearPreparationSnapshot, readPreparationSnapshot } from './preparationSnapshot'

function generatorCompositionHref({ learnerId = '', need = '', proposal = null } = {}) {
  const spec = proposal?.generationSpec && typeof proposal.generationSpec === 'object' ? proposal.generationSpec : null
  const params = new URLSearchParams({ mode: spec ? 'detailed' : 'simple', source: 'library' })
  if (learnerId) params.set('learnerId', learnerId)
  if (need) params.set('need', need)
  if (spec) {
    for (const key of ['grade', 'difficulty', 'subject', 'title', 'description', 'notes', 'vocab']) {
      if (spec[key] != null && String(spec[key]).trim()) params.set(key, String(spec[key]))
    }
  }
  return `/facilitator/generator?${params.toString()}`
}

export default function LegacyPrepareCompatibilityPage() {
  const router = useRouter()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const snapshot = readPreparationSnapshot()
    const explicitLessonKey = params.get('lessonKey') || ''
    const explicitLearnerId = params.get('learnerId') || ''
    const stage = params.get('stage') || snapshot?.stage || ''
    const repeat = params.get('repeat') === '1'
    const explicitSource = params.get('source') || ''
    const occurrenceId = params.get('occurrenceId') || ''
    const plannedDate = params.get('plannedDate') || ''
    const expectedActiveRevisionId = params.get('expectedActiveRevisionId') || ''
    const lessonKey = explicitLessonKey || snapshot?.lessonIdentity?.lessonKey || ''
    const learnerId = explicitLearnerId || snapshot?.learnerId || snapshot?.intent?.learnerId || snapshot?.proposal?.learnerId || ''

    let target = '/facilitator/generator'
    if (lessonKey && !repeat && ![FACILITATOR_PREPARATION_STAGES.APPROVED, FACILITATOR_PREPARATION_STAGES.DELIVERY].includes(stage)) {
      const source = normalizeLessonWorkflowSource(explicitSource || (occurrenceId ? 'syllabus' : 'library'))
      target = buildLessonGeneratorReviewHref({ learnerId, lessonKey, source, plannedDate, occurrenceId, expectedActiveRevisionId })
    } else if (lessonKey && (repeat || [FACILITATOR_PREPARATION_STAGES.APPROVED, FACILITATOR_PREPARATION_STAGES.DELIVERY].includes(stage))) {
      const source = normalizeLessonWorkflowSource(explicitSource || 'syllabus')
      target = buildLessonWorkflowReturnHref({ source, learnerId, plannedDate, lessonKey, occurrenceId })
    } else if (snapshot && [FACILITATOR_PREPARATION_STAGES.NEED, FACILITATOR_PREPARATION_STAGES.PROPOSAL, FACILITATOR_PREPARATION_STAGES.GENERATING].includes(snapshot.stage)) {
      target = generatorCompositionHref({
        learnerId,
        need: snapshot?.intent?.need || '',
        proposal: snapshot?.proposal || null,
      })
    }

    clearPreparationSnapshot()
    router.replace(target)
  }, [router])

  return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>Opening the current lesson workflow...</p></main>
}
