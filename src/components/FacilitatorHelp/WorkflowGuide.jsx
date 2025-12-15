'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * WorkflowGuide - Step-by-step guide modal for complex multi-page workflows
 * 
 * Displays a help icon (📋) that shows workflow steps in a centered modal overlay when clicked.
 * User can dismiss permanently, stored in localStorage.
 * 
 * @param {string} workflowKey - Unique identifier for localStorage persistence
 * @param {string} title - Guide title
 * @param {Array<{step: string, description: string}>} steps - Array of workflow steps
 */
export default function WorkflowGuide({ workflowKey, title, steps }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleToggle = () => {
    console.log('WorkflowGuide toggle clicked, current isVisible:', isVisible);
    const newValue = !isVisible;
    console.log('WorkflowGuide setting isVisible to:', newValue);
    setIsVisible(newValue);
  };

  console.log('WorkflowGuide render - isMounted:', isMounted, 'isVisible:', isVisible, 'will show portal:', isMounted && isVisible);

  return (
    <>
      <button
        onClick={handleToggle}
        className="inline-flex items-center justify-center text-lg hover:scale-110 transition-transform"
        aria-label="Show workflow guide"
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
                maxWidth: '32rem',
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
              
              <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {steps.map((step, index) => (
                  <li key={index} style={{ display: 'flex', marginBottom: '12px' }}>
                    <span style={{
                      flexShrink: 0,
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: '#2563eb',
                      color: 'white',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '12px',
                      marginTop: '2px'
                    }}>
                      {index + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, color: '#111827', fontSize: '0.875rem' }}>{step.step}</div>
                      {step.description && (
                        <div style={{ fontSize: '0.875rem', color: '#4b5563', marginTop: '4px' }}>{step.description}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
