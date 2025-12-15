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
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (workflowKey) {
      const dismissed = localStorage.getItem(`workflow-dismissed-${workflowKey}`);
      setIsDismissed(dismissed === 'true');
    }
  }, [workflowKey]);

  const handleDismiss = () => {
    if (workflowKey) {
      localStorage.setItem(`workflow-dismissed-${workflowKey}`, 'true');
      setIsDismissed(true);
      setIsVisible(false);
    }
  };

  const handleToggle = () => {
    console.log('WorkflowGuide toggle clicked, current isVisible:', isVisible);
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
            className="fixed inset-0 bg-black bg-opacity-50 z-[9998]"
            onClick={handleToggle}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4">
            <div 
              className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-6 relative"
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
              
              <ol className="space-y-3">
                {steps.map((step, index) => (
                  <li key={index} className="flex">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-sm font-semibold flex items-center justify-center mr-3 mt-0.5">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm">{step.step}</div>
                      {step.description && (
                        <div className="text-sm text-gray-600 mt-1">{step.description}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              
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
