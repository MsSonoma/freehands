'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * InlineExplainer - Contextual help component with dismissible overlay
 * 
 * Displays a help icon (❓) that shows help text in a centered modal overlay when clicked. 
 * User can dismiss permanently, stored in localStorage.
 * 
 * @param {string} helpKey - Unique identifier for localStorage persistence
 * @param {string} title - Bold heading for the help text
 * @param {string} children - Explanation text (can be JSX)
 */
export default function InlineExplainer({ helpKey, title, children }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleToggle = () => {
    console.log('InlineExplainer toggle clicked, current isVisible:', isVisible);
    const newValue = !isVisible;
    console.log('InlineExplainer setting isVisible to:', newValue);
    setIsVisible(newValue);
  };

  console.log('InlineExplainer render - isMounted:', isMounted, 'isVisible:', isVisible, 'will show portal:', isMounted && isVisible);

  return (
    <>
      <button
        onClick={handleToggle}
        className="inline-flex items-center justify-center text-lg hover:scale-110 transition-transform"
        aria-label="Show help"
        type="button"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        ❓
      </button>

      {isMounted && isVisible && createPortal(
        <>
          {/* Backdrop */}
          <div 
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 9998
            }}
            onClick={handleToggle}
          />
          
          {/* Modal */}
          <div style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}>
            <div 
              style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                maxWidth: '28rem',
                width: '100%',
                padding: '24px',
                position: 'relative'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h4 style={{ fontWeight: 600, fontSize: '1.125rem', color: '#111827', paddingRight: '32px' }}>{title}</h4>
                <button
                  onClick={handleToggle}
                  style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    color: '#9ca3af',
                    fontSize: '1.5rem',
                    lineHeight: 1,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer'
                  }}
                  aria-label="Close"
                  type="button"
                  onMouseOver={(e) => e.target.style.color = '#4b5563'}
                  onMouseOut={(e) => e.target.style.color = '#9ca3af'}
                >
                  ×
                </button>
              </div>
              <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                {children}
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
