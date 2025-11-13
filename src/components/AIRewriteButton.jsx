'use client'

/**
 * AIRewriteButton - Reusable button for AI text rewriting
 * Can be used anywhere text needs AI enhancement
 */
export default function AIRewriteButton({ 
  text,
  onRewrite,
  disabled = false,
  loading = false,
  size = 'small',
  style = {}
}) {
  const sizes = {
    small: {
      padding: '4px 12px',
      fontSize: 12
    },
    medium: {
      padding: '6px 16px',
      fontSize: 13
    },
    large: {
      padding: '8px 20px',
      fontSize: 14
    }
  }

  const sizeStyle = sizes[size] || sizes.small
  const isDisabled = disabled || loading || !text?.trim()

  return (
    <button
      onClick={onRewrite}
      disabled={isDisabled}
      style={{
        background: loading ? '#9ca3af' : '#8b5cf6',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        fontWeight: 600,
        opacity: isDisabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        ...sizeStyle,
        ...style
      }}
    >
      {loading ? '✨ Rewriting...' : '✨ Rewrite with AI'}
    </button>
  )
}
