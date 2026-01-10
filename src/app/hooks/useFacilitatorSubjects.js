'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import {
  CORE_SUBJECTS,
  GENERATED_SUBJECT,
  mergeSubjectNames,
  sortSubjectsForDropdown,
} from '@/app/lib/subjects'

export function useFacilitatorSubjects(options = {}) {
  const { includeGenerated = false } = options || {}

  const [customSubjects, setCustomSubjects] = useState([])
  const [loadingCustomSubjects, setLoadingCustomSubjects] = useState(false)

  const refreshCustomSubjects = useCallback(async () => {
    setLoadingCustomSubjects(true)
    try {
      const supabase = getSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const token = session?.access_token
      if (!token) {
        setCustomSubjects([])
        return
      }

      const res = await fetch('/api/custom-subjects', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        setCustomSubjects([])
        return
      }

      const data = await res.json().catch(() => null)
      const subjects = Array.isArray(data?.subjects) ? data.subjects : []
      setCustomSubjects(subjects)
    } catch {
      setCustomSubjects([])
    } finally {
      setLoadingCustomSubjects(false)
    }
  }, [])

  useEffect(() => {
    refreshCustomSubjects()
  }, [refreshCustomSubjects])

  const customSubjectNames = useMemo(() => {
    return (customSubjects || []).map((s) => s?.name).filter(Boolean)
  }, [customSubjects])

  const subjectNames = useMemo(() => {
    const merged = mergeSubjectNames(CORE_SUBJECTS, customSubjectNames, { includeGenerated })
    return sortSubjectsForDropdown(merged, CORE_SUBJECTS)
  }, [customSubjectNames, includeGenerated])

  const subjectsWithoutGenerated = useMemo(() => {
    return subjectNames.filter((s) => String(s).toLowerCase() !== GENERATED_SUBJECT)
  }, [subjectNames])

  return {
    coreSubjects: CORE_SUBJECTS,
    customSubjects,
    customSubjectNames,
    subjectNames,
    subjectsWithoutGenerated,
    loadingCustomSubjects,
    refreshCustomSubjects,
  }
}
