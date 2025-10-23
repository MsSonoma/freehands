'use client'
import { useRouter } from 'next/navigation'

/**
 * GatedOverlay - Universal access control overlay
 * 
 * Shows appropriate messaging and CTAs based on user state:
 * - Not logged in: Prompt to sign in/up
 * - Logged in but insufficient tier: Prompt to upgrade
 * 
 * @param {Object} props
 * @param {boolean} props.show - Whether to show the overlay
 * @param {Function} props.onClose - Optional close handler (if not provided, uses router.back())
 * @param {string} props.gateType - 'auth' (requires login) or 'tier' (requires upgrade)
 * @param {string} props.feature - Feature name (e.g., "Mr. Mentor", "Lesson Calendar")
 * @param {string} props.emoji - Emoji to display at top
 * @param {string} props.description - Feature description
 * @param {string[]} props.benefits - Array of benefit strings
 * @param {string} props.currentTier - Current user tier (for tier gates)
 * @param {string} props.requiredTier - Required tier (for tier gates)
 */
export default function GatedOverlay({
  show = false,
  onClose,
  gateType = 'auth', // 'auth' | 'tier'
  feature = 'This Feature',
  emoji = '🔒',
  description,
  benefits = [],
  currentTier = 'free',
  requiredTier = 'premium'
}) {
  const router = useRouter()

  if (!show) return null

  const isAuthGate = gateType === 'auth'
  const isTierGate = gateType === 'tier'

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 20
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '32px 24px',
        maxWidth: 500,
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{emoji}</div>
        
        <h2 style={{ 
          margin: '0 0 16px 0', 
          fontSize: 24, 
          fontWeight: 700,
          color: '#111'
        }}>
          {isAuthGate ? `Sign In to Access ${feature}` : `Unlock ${feature}`}
        </h2>
        
        <p style={{ 
          color: '#555', 
          fontSize: 16, 
          lineHeight: 1.6,
          marginBottom: 24
        }}>
          {description || (
            isAuthGate 
              ? `Create a free account to access ${feature} and track your progress.`
              : `Get access to ${feature}. Available exclusively to ${requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)} subscribers.`
          )}
        </p>
        
        {benefits && benefits.length > 0 && (
          <div style={{ 
            background: '#f9fafb', 
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
            textAlign: 'left'
          }}>
            <p style={{ fontWeight: 600, marginBottom: 12, color: '#111' }}>
              {isAuthGate ? 'What You Get:' : 'What You Get:'}
            </p>
            <ul style={{ 
              margin: 0, 
              paddingLeft: 20, 
              fontSize: 14,
              lineHeight: 2,
              color: '#374151'
            }}>
              {benefits.map((benefit, idx) => (
                <li key={idx}>{benefit}</li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {isAuthGate ? (
            <>
              <a
                href="/auth/signup"
                style={{
                  display: 'inline-block',
                  padding: '12px 32px',
                  background: '#2563eb',
                  color: '#fff',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 16,
                  textDecoration: 'none',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                Sign Up Free
              </a>
              <a
                href="/auth/login"
                style={{
                  display: 'inline-block',
                  padding: '12px 24px',
                  background: 'transparent',
                  color: '#2563eb',
                  border: '1px solid #2563eb',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 16,
                  textDecoration: 'none'
                }}
              >
                Sign In
              </a>
            </>
          ) : (
            <>
              <a
                href="/facilitator/plan"
                style={{
                  display: 'inline-block',
                  padding: '12px 32px',
                  background: '#2563eb',
                  color: '#fff',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 16,
                  textDecoration: 'none',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                Upgrade to {requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)}
              </a>
            </>
          )}
          <button
            onClick={() => onClose ? onClose() : router.back()}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              color: '#6b7280',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer'
            }}
          >
            {onClose ? 'Close' : 'Go Back'}
          </button>
        </div>
      </div>
    </div>
  )
}
