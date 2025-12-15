'use client';

import { useState, useEffect } from 'react';

/**
 * WorkflowGuide - Step-by-step guide for complex multi-page workflows
 * 
 * Shows a collapsible workflow guide with numbered steps. Can be dismissed
 * permanently via localStorage.
 * 
 * @param {string} workflowKey - Unique identifier for localStorage persistence
 * @param {string} title - Guide title
 * @param {Array<{step: string, description: string}>} steps - Array of workflow steps
 * @param {boolean} defaultOpen - Whether guide is open by default
 */
export default function WorkflowGuide({ workflowKey, title, steps, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isDismissed, setIsDismissed] = useState(false);

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
    }
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-blue-100 transition-colors"
        type="button"
      >
        <div className="flex items-center">
          <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
          </svg>
          <span className="font-semibold text-gray-900">{title}</span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-600 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-4 pb-4">
          <ol className="space-y-3">
            {steps.map((step, index) => (
              <li key={index} className="flex">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-sm font-semibold flex items-center justify-center mr-3">
                  {index + 1}
                </span>
                <div className="flex-1 pt-0.5">
                  <div className="font-medium text-gray-900">{step.step}</div>
                  {step.description && (
                    <div className="text-sm text-gray-600 mt-1">{step.description}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <button
            onClick={handleDismiss}
            className="mt-4 text-sm text-blue-600 hover:text-blue-800 underline"
            type="button"
          >
            Don't show this guide again
          </button>
        </div>
      )}
    </div>
  );
}
