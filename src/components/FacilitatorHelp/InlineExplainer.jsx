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
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (helpKey) {
      const dismissed = localStorage.getItem(`help-dismissed-${helpKey}`);
      setIsDismissed(dismissed === 'true');
    }
  }, [helpKey]);

  const handleDismiss = () => {
    if (helpKey) {
      localStorage.setItem(`help-dismissed-${helpKey}`, 'true');
      setIsDismissed(true);
      setIsVisible(false);
    }
  };

  const handleToggle = () => {
    setIsVisible(!isVisible);
  };

  if (isDismissed) {
    return null;
  }

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

      {isVisible && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-[9998]"
            onClick={handleToggle}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4">
            <div 
              className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <h4 className="font-semibold text-lg text-gray-900 pr-8">{title}</h4>
                <button
                  onClick={handleToggle}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl leading-none"
                  aria-label="Close"
                  type="button"
                >
                  ×
                </button>
              </div>
              <div className="text-sm text-gray-700 space-y-2">
                {children}
              </div>
              <button
                onClick={handleDismiss}
                className="mt-4 text-xs text-blue-600 hover:text-blue-800 underline"
                type="button"
              >
                Don&apos;t show again
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
