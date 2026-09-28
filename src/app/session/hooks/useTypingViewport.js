'use client'

import { useEffect, useRef, useState } from 'react'

export function isTouchLikeDevice(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return false
  try {
    if (Number(win.navigator?.maxTouchPoints || 0) > 0) return true
  } catch {}
  try {
    if (win.navigator?.userAgentData?.mobile === true) return true
  } catch {}
  try {
    const ua = String(win.navigator?.userAgent || '')
    if (/iPad|iPhone|iPod|Android/i.test(ua)) return true
  } catch {}
  try {
    if (win.matchMedia?.('(pointer: coarse)')?.matches) return true
  } catch {}
  return false
}

export function shouldAutoFocusTextInput(win = typeof window !== 'undefined' ? window : null) {
  return !isTouchLikeDevice(win)
}

export function isTextEntryElement(element) {
  if (!element || typeof element !== 'object') return false
  const tag = String(element.tagName || '').toUpperCase()
  if (tag === 'TEXTAREA') return !element.disabled && !element.readOnly
  if (tag === 'INPUT') {
    const type = String(element.type || 'text').toLowerCase()
    return !element.disabled && !element.readOnly && ![
      'button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit',
    ].includes(type)
  }
  return element.isContentEditable === true
}

export function measureTypingViewport(
  win = typeof window !== 'undefined' ? window : null,
  doc = typeof document !== 'undefined' ? document : null,
  { baselineHeight = 0 } = {},
) {
  if (!win) return {
    touchLike: false, textEntryFocused: false, keyboardVisible: false, typing: false,
    visualHeight: 0, visualWidth: 0, offsetTop: 0, offsetLeft: 0, keyboardInset: 0,
  }
  let vv = null
  try { vv = win.visualViewport || null } catch {}
  const visualHeight = Math.max(0, Math.round(Number(vv?.height || win.innerHeight || 0)))
  const visualWidth = Math.max(0, Math.round(Number(vv?.width || win.innerWidth || 0)))
  const offsetTop = Math.max(0, Math.round(Number(vv?.offsetTop || 0)))
  const offsetLeft = Math.max(0, Math.round(Number(vv?.offsetLeft || 0)))
  const layoutHeight = Math.max(0, Math.round(Number(win.innerHeight || visualHeight)))
  const liveInset = Math.max(0, layoutHeight - visualHeight - offsetTop)
  const baselineInset = baselineHeight > 0
    ? Math.max(0, Math.round(Number(baselineHeight)) - visualHeight - offsetTop)
    : 0
  const rawInset = Math.max(liveInset, baselineInset)
  const keyboardInset = rawInset >= 48 ? rawInset : 0
  const touchLike = isTouchLikeDevice(win)
  const textEntryFocused = isTextEntryElement(doc?.activeElement)
  const keyboardVisible = touchLike && textEntryFocused && keyboardInset > 0
  // iPad browsers do not always expose a useful keyboard geometry change.
  // Touch focus is therefore the reliable signal for switching lesson surfaces
  // into their compact typing layout; keyboardVisible remains geometry-only.
  const typing = touchLike && textEntryFocused
  return {
    touchLike,
    textEntryFocused,
    keyboardVisible,
    typing,
    visualHeight,
    visualWidth,
    offsetTop,
    offsetLeft,
    keyboardInset,
  }
}

export function releaseStaleTouchFocus(
  win = typeof window !== 'undefined' ? window : null,
  doc = typeof document !== 'undefined' ? document : null,
  target = null,
) {
  if (!win || !doc || !target) return false
  if (!isTouchLikeDevice(win) || !isTextEntryElement(target)) return false
  if (doc.activeElement !== target) return false
  try {
    if (!win.visualViewport) return false
  } catch {
    return false
  }
  const measured = measureTypingViewport(win, doc)
  if (measured.keyboardVisible) return false
  try {
    target.blur()
    return true
  } catch {
    return false
  }
}

export default function useTypingViewport({ preserveTouchFocus = false, blurDelayMs = 0 } = {}) {
  const baselineHeightRef = useRef(0)
  const measure = () => {
    const measured = measureTypingViewport(window, document, { baselineHeight: baselineHeightRef.current })
    if (!measured.textEntryFocused && measured.visualHeight > 0) {
      baselineHeightRef.current = Math.max(baselineHeightRef.current, measured.visualHeight)
    }
    return measured
  }
  const [state, setState] = useState(() => {
    const measured = measureTypingViewport()
    baselineHeightRef.current = measured.visualHeight || 0
    return measured
  })

  useEffect(() => {
    let frame = null
    let blurTimer = null
    const updateViewport = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = null
        setState(measure())
      })
    }
    const handleFocusIn = (event) => {
      if (blurTimer) {
        clearTimeout(blurTimer)
        blurTimer = null
      }
      const measured = measure()
      const textEntryFocused = isTextEntryElement(event.target)
      setState({
        ...measured,
        textEntryFocused,
        keyboardVisible: measured.touchLike && textEntryFocused && measured.keyboardInset > 0,
        typing: measured.touchLike && textEntryFocused,
      })
      updateViewport()
    }
    const handleFocusOut = () => {
      if (blurTimer) clearTimeout(blurTimer)
      blurTimer = setTimeout(() => {
        blurTimer = null
        setState(measure())
      }, Math.max(0, Number(blurDelayMs || 0)))
    }
    const handleTouchIntent = (event) => {
      if (event.type === 'pointerdown' && event.pointerType && !['touch', 'pen'].includes(event.pointerType)) return
      if (releaseStaleTouchFocus(window, document, event.target)) updateViewport()
    }
    const vv = window.visualViewport || null
    const touchIntentEvent = typeof window.PointerEvent === 'function' ? 'pointerdown' : 'touchstart'
    updateViewport()
    window.addEventListener('resize', updateViewport)
    window.addEventListener('orientationchange', updateViewport)
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)
    if (!preserveTouchFocus) document.addEventListener(touchIntentEvent, handleTouchIntent, true)
    vv?.addEventListener?.('resize', updateViewport)
    vv?.addEventListener?.('scroll', updateViewport)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      if (blurTimer) clearTimeout(blurTimer)
      window.removeEventListener('resize', updateViewport)
      window.removeEventListener('orientationchange', updateViewport)
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
      if (!preserveTouchFocus) document.removeEventListener(touchIntentEvent, handleTouchIntent, true)
      vv?.removeEventListener?.('resize', updateViewport)
      vv?.removeEventListener?.('scroll', updateViewport)
    }
  }, [blurDelayMs, preserveTouchFocus])

  return state
}
