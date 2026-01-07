'use client'
import { useState, useEffect } from 'react'
import { getLearner } from '@/app/facilitator/learners/clientApi'

/**
 * Golden Key Counter Component
 * Displays the number of golden keys earned and allows selecting one for use.
 * 
 * Props:
 * - learnerId: The learner's ID to fetch their golden keys
 * - selected: Boolean indicating if a key is selected
 * - onToggle: Callback function when key is clicked
 */
export default function GoldenKeyCounter({ learnerId, selected, onToggle }) {
  const [keyCount, setKeyCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!learnerId) {
      setKeyCount(0)
      setLoading(false)
      return
    }

    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const learner = await getLearner(learnerId)
        if (mounted && learner) {
          setKeyCount(learner.golden_keys ?? 0)
        } else if (mounted) {
          setKeyCount(0)
        }
      } catch (err) {
        if (mounted) setKeyCount(0)
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => { mounted = false }
  }, [learnerId])

  // Always show the counter, but with different messaging based on key count
  if (!learnerId) return null

  const hasKeys = keyCount > 0

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      marginBottom: 16,
      padding: 12,
      background: selected ? '#fef3c7' : hasKeys ? '#f9fafb' : '#fafafa',
      border: `2px solid ${selected ? '#f59e0b' : hasKeys ? '#e5e7eb' : '#d1d5db'}`,
      borderRadius: 12,
      maxWidth: 480,
      margin: '0 auto 16px',
      opacity: hasKeys ? 1 : 0.7
    }}>
      <button
        onClick={hasKeys ? onToggle : undefined}
        style={{
          background: 'none',
          border: 'none',
          cursor: hasKeys ? 'pointer' : 'not-allowed',
          fontSize: 32,
          padding: 0,
          filter: selected ? 'none' : hasKeys ? 'grayscale(100%) opacity(0.5)' : 'grayscale(100%) opacity(0.3)',
          transition: 'filter 0.2s',
          lineHeight: 1
        }}
        title={hasKeys ? (selected ? 'Click to deselect Golden Key' : 'Click to use a Golden Key') : 'No keys available - complete a lesson on time to earn one!'}
        aria-label={hasKeys ? (selected ? 'Deselect Golden Key' : 'Select Golden Key') : 'No golden keys'}
        disabled={!hasKeys}
      >
        🔑
      </button>
      
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={{ 
          fontWeight: 600, 
          fontSize: 16,
          color: selected ? '#92400e' : hasKeys ? '#374151' : '#6b7280'
        }}>
          {selected ? 'Golden Key Selected!' : `Golden Keys: ${keyCount}`}
        </div>
        <div style={{ 
          fontSize: 14, 
          color: selected ? '#78350f' : hasKeys ? '#6b7280' : '#9ca3af',
          marginTop: 2
        }}>
          {selected 
            ? 'This adds bonus play time to your next lesson.'
            : hasKeys
              ? 'Click the key to add bonus play time to your next lesson.'
              : 'Complete a lesson within the time limit to earn golden keys!'
          }
        </div>
      </div>
    </div>
  )
}
