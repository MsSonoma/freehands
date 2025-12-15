'use client';

import { useState, useEffect } from 'react';

/**
 * InlineExplainer - Contextual help component with dismissible tooltip
 * 
 * Displays an info icon that shows help text when clicked. User can dismiss
 * permanently, stored in localStorage.
 * 
 * @param {string} helpKey - Unique identifier for localStorage persistence
 * @param {string} title - Bold heading for the help text
 * @param {string} children - Explanation text (can be JSX)
 * @param {string} placement - 'top' | 'bottom' | 'left' | 'right'
 */
export default function InlineExplainer({ helpKey, title, children, placement = 'bottom' }) {
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

  const placementStyles = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
    right: 'left-full ml-2'
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={handleToggle}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors"
        aria-label="Show help"
        type="button"
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      </button>

      {isVisible && (
        <div className={`absolute z-50 ${placementStyles[placement]} w-72 bg-white border border-blue-200 rounded-lg shadow-lg p-4`}>
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-semibold text-sm text-gray-900">{title}</h4>
            <button
              onClick={handleToggle}
              className="text-gray-400 hover:text-gray-600 ml-2"
              aria-label="Close"
              type="button"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <div className="text-sm text-gray-700 space-y-2">
            {children}
          </div>
          <button
            onClick={handleDismiss}
            className="mt-3 text-xs text-blue-600 hover:text-blue-800 underline"
            type="button"
          >
            Don't show again
          </button>
        </div>
      )}
    </div>
  );
}
