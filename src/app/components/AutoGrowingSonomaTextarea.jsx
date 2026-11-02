'use client';

import { forwardRef, useCallback, useLayoutEffect, useRef } from 'react';
import { resizeSonomaAnswerField } from './sonomaAnswerField.mjs';

const AutoGrowingSonomaTextarea = forwardRef(function AutoGrowingSonomaTextarea(
  { value, onInput, onKeyDown, style, rows = 1, ...props }, forwardedRef,
) {
  const fieldRef = useRef(null);
  const assignRef = useCallback((node) => {
    fieldRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef]);

  useLayoutEffect(() => {
    resizeSonomaAnswerField(fieldRef.current);
  }, [value, rows]);

  return (
    <textarea
      {...props}
      ref={assignRef}
      rows={rows}
      value={value}
      onInput={(event) => {
        resizeSonomaAnswerField(event.currentTarget);
        onInput?.(event);
      }}
      onKeyDown={(event) => {
        // Enter still sends through the caller; Shift+Enter adds a deliberate newline.
        if (event.key === 'Enter' && !event.shiftKey) event.preventDefault();
        onKeyDown?.(event);
      }}
      style={{ ...style, minWidth: 0, boxSizing: 'border-box', overflowY: 'hidden', resize: 'none' }}
    />
  );
});

export default AutoGrowingSonomaTextarea;
