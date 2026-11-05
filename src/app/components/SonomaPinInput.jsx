'use client';

import { useCallback, useEffect, useRef } from 'react';
import { shouldUseSonomaKeyboard, useSonomaKeyboard } from './SonomaKeyboard';

const pinTheme = {
  label: 'Facilitator PIN Keyboard',
  background: '#f8e9e5',
  color: '#722b21',
  accent: '#c7442e',
};

export default function SonomaPinInput({
  value = '',
  onValueChange,
  onFocus,
  onPointerDown,
  maxLength = 8,
  type = 'password',
  ...props
}) {
  const inputRef = useRef(null);
  const lastFieldRef = useRef(null);
  const keyboard = useSonomaKeyboard();
  const limit = Math.max(1, Math.min(10, Number(maxLength) || 8));
  const update = useCallback((next) => {
    onValueChange?.(String(next || '').replace(/\D/g, '').slice(0, limit));
  }, [onValueChange, limit]);
  const openPinKeyboard = useCallback((event) => {
    if (!shouldUseSonomaKeyboard() || event.currentTarget.disabled) return;
    const field = event.currentTarget;
    lastFieldRef.current = field;
    keyboard.open({
      ref: { current: field },
      onChange: update,
      layout: 'pin',
      theme: pinTheme,
    });
  }, [keyboard.open, update]);

  useEffect(() => () => keyboard.closeForInput(lastFieldRef.current), [keyboard.closeForInput]);

  return (
    <input
      {...props}
      ref={inputRef}
      data-sonoma-input
      data-sonoma-pin
      type={type}
      inputMode="none"
      pattern="[0-9]*"
      maxLength={limit}
      value={value}
      onChange={(event) => update(event.target.value)}
      onPointerDown={(event) => {
        openPinKeyboard(event);
        onPointerDown?.(event);
      }}
      onFocus={(event) => {
        openPinKeyboard(event);
        onFocus?.(event);
      }}
    />
  );
}
