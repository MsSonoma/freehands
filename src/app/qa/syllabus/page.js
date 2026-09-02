import { notFound } from 'next/navigation'
import SyllabusQaHarness from './SyllabusQaHarness'
import { isSyllabusQaEnabled } from '@/app/lib/syllabus/qaGuard.mjs'

export const dynamic = 'force-dynamic'

export default function SyllabusQaPage() {
  if (!isSyllabusQaEnabled(process.env)) notFound()
  return <SyllabusQaHarness />
}
