'use client'
import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier } from '@/app/lib/entitlements'

/**
 * useAccessControl - Hook for checking authentication and tier access
 * 
 * @param {Object} options
 * @param {string} options.requiredAuth - 'none' | 'any' | 'required' (default: 'none')
 * @param {string} options.requiredFeature - Feature key from entitlements (e.g., 'facilitatorTools')
 * @param {string} options.minimumTier - Minimum tier required (e.g., 'premium')
 * @returns {Object} { loading, isAuthenticated, tier, hasAccess, gateType }
 */
export function useAccessControl({
  requiredAuth = 'none',  // 'none' | 'any' | 'required'
  requiredFeature = null,
  minimumTier = null
} = {}) {
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [tier, setTier] = useState('free')
  const [hasAccess, setHasAccess] = useState(false)
  const [gateType, setGateType] = useState(null) // null | 'auth' | 'tier'

  useEffect(() => {
    let cancelled = false
    
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        const uid = session?.user?.id

        if (!cancelled) {
          setIsAuthenticated(!!uid)
        }

        if (uid) {
          // User is authenticated, check tier
          const { data } = await supabase
            .from('profiles')
            .select('plan_tier')
            .eq('id', uid)
            .maybeSingle()
          
          const userTier = (data?.plan_tier || 'free').toLowerCase()
          if (!cancelled) setTier(userTier)

          // Check feature access
          if (requiredFeature) {
            const ent = featuresForTier(userTier)
            const featureAccess = ent[requiredFeature]
            if (!cancelled) {
              setHasAccess(!!featureAccess)
              setGateType(featureAccess ? null : 'tier')
            }
          } else if (minimumTier) {
            const tierRank = { free: 0, basic: 1, plus: 2, premium: 3, lifetime: 4 }
            const userRank = tierRank[userTier] || 0
            const minRank = tierRank[minimumTier] || 0
            const tierAccess = userRank >= minRank
            if (!cancelled) {
              setHasAccess(tierAccess)
              setGateType(tierAccess ? null : 'tier')
            }
          } else {
            // No specific tier requirement, just authenticated
            if (!cancelled) {
              setHasAccess(true)
              setGateType(null)
            }
          }
        } else {
          // User not authenticated
          if (!cancelled) {
            setTier('free')
            if (requiredAuth === 'none') {
              // No auth required, allow access
              setHasAccess(true)
              setGateType(null)
            } else {
              // Auth required
              setHasAccess(false)
              setGateType('auth')
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          setIsAuthenticated(false)
          setTier('free')
          setHasAccess(requiredAuth === 'none')
          setGateType(requiredAuth === 'none' ? null : 'auth')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [requiredAuth, requiredFeature, minimumTier])

  return {
    loading,
    isAuthenticated,
    tier,
    hasAccess,
    gateType
  }
}
