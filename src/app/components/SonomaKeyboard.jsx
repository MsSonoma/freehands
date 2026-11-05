"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { isTouchLikeDevice } from "../session/hooks/useTypingViewport";
import WebbDictationButton from "../session/webb/WebbDictationButton";
import { insertDictationAtSelection } from "./sonomaDictationInsertion.mjs";
import { isTranscriptTapGesture } from "./sonomaTranscriptGesture.mjs";
import dockStyles from "./SonomaKeyboardDock.module.css";
import { isSonomaSubmitTarget } from "./sonomaAnswerField.mjs";
import { insertSlateMathResult } from "../lib/slateMathDraft.mjs";
import {
  SPACE_TRACKPAD_HOLD_MS,
  isShortSpaceTap,
  trackpadCaretFromDrag,
} from "./sonomaSpaceTrackpad.mjs";

const KeyboardContext = createContext(null);
const rows = {
  text: ["qwertyuiop".split(""), "asdfghjkl".split(""), ["Shift", ..."zxcvbnm", "Backspace"], ["123", "Math", "More", ",", "Space", ".", "?", "←", "→"]],
  number: [["1","2","3"], ["4","5","6"], ["7","8","9"], ["-","0","."], ["ABC","Math","More","←","→","Backspace"]],
  // PIN entry has only digits and editing. Never offer dictation or other tabs.
  pin: [["1","2","3"], ["4","5","6"], ["7","8","9"], ["←","0","→"], ["Backspace"]],
  math: [["7","8","9","÷","/"], ["4","5","6","×","*"], ["1","2","3","+","−"], ["0",".","=","(",")"], ["ABC","More","←","→","Backspace"]],
  symbols: [["!","@","#","$","%","^","&"], ["_","~",":",";","\u0027","\u0022","?"], ["[","]","{","}","<",">","|"], ["\\","°","±","√","π","²","³"], ["ABC","Math","123","Space","←","→","Backspace"]],
};

function isTouchScreen() {
  return isTouchLikeDevice();
}

// Estimate visible wrapped lines while avoiding native selection/caret APIs
// that can summon an iOS keyboard. Explicit newlines remain exact.
function trackpadFieldMetrics(field) {
  if (field?.tagName !== "TEXTAREA" || field.wrap === "off") {
    return { wrapColumns: 0, lineStepPx: 24 };
  }
  const style = window.getComputedStyle(field);
  const fontSize = parseFloat(style.fontSize) || 16;
  const lineHeight = parseFloat(style.lineHeight);
  const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  const width = Math.max(0, field.clientWidth - padding);
  const letterSpacing = parseFloat(style.letterSpacing) || 0;
  const averageCharWidth = Math.max(4, fontSize * 0.55 + letterSpacing);
  return {
    wrapColumns: width > 0 ? Math.max(1, Math.floor(width / averageCharWidth)) : 0,
    lineStepPx: Number.isFinite(lineHeight) ? Math.max(12, lineHeight) : Math.max(20, fontSize * 1.4),
  };
}

export function SonomaKeyboardProvider({ children }) {
  const pathname = usePathname();
  const lastPathnameRef = useRef(pathname);
  const [active, setActive] = useState(null);
  const [shift, setShift] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [workspaceDock, setWorkspaceDock] = useState(null);
  const [workspacePortal, setWorkspacePortal] = useState(null);
  const lastOutsideInputRef = useRef(null);
  const lastKeyboardEntryRef = useRef(null);

  const panelRef = useRef(null);
  const activeRef = useRef(null);
  const dictationTargetRef = useRef(null);
  const spaceGestureRef = useRef(null);
  const suppressSpaceClickRef = useRef(false);
  const [spaceTrackpadActive, setSpaceTrackpadActive] = useState(false);
  activeRef.current = active;

  const cancelSpaceGesture = useCallback(() => {
    const gesture = spaceGestureRef.current;
    spaceGestureRef.current = null;
    if (gesture?.holdTimer) window.clearTimeout(gesture.holdTimer);
    if (gesture?.button?.hasPointerCapture?.(gesture.pointerId)) {
      try { gesture.button.releasePointerCapture(gesture.pointerId); } catch {}
    }
    if (gesture?.mode === "trackpad") setSpaceTrackpadActive(false);
  }, []);

  useEffect(() => () => {
    const gesture = spaceGestureRef.current;
    if (gesture?.holdTimer) window.clearTimeout(gesture.holdTimer);
    spaceGestureRef.current = null;
  }, []);

  const close = useCallback(() => {
    cancelSpaceGesture();
    // Never retain a PIN's sensitive getValue callback as the last keyboard entry.
    lastKeyboardEntryRef.current = activeRef.current?.layout === "pin" ? null : activeRef.current;
    lastOutsideInputRef.current = null;
    dictationTargetRef.current = null;
    setActive(null);
    setShift(false);
    setKeyboardHeight(0);
  }, [cancelSpaceGesture]);
  useEffect(() => {
    if (lastPathnameRef.current === pathname) return;
    lastPathnameRef.current = pathname;
    lastKeyboardEntryRef.current = null;
    close();
  }, [pathname, close]);

  const closeForInput = useCallback((field) => {
    if (field && activeRef.current?.ref?.current === field) close();
  }, [close]);

  const open = useCallback((config) => {
    cancelSpaceGesture();
    // Desktop inputs open the keyboard only after an explicit keyboard toggle,
    // or for the existing Math workspace; touch behavior stays automatic.
    if (!isTouchScreen() && !activeRef.current && !(workspaceDock && config?.layout === "math")) return;
    const field = config?.ref?.current;
    if (config?.layout === "pin") lastOutsideInputRef.current = null;
    else if (field?.isConnected && !panelRef.current?.contains(field)) lastOutsideInputRef.current = config;
    setActive({ ...config, theme: config?.theme || activeRef.current?.theme });
    setShift(false);
  }, [workspaceDock, cancelSpaceGesture]);
  // The PIN gate is a DOM dialog, not a React component. It requests this
  // application-owned keyboard through an event without exposing the PIN.
  useEffect(() => {
    const onOpen = (event) => open(event.detail);
    const onClose = (event) => closeForInput(event.detail?.field);
    window.addEventListener("ms:sonoma-keyboard:open", onOpen);
    window.addEventListener("ms:sonoma-keyboard:close", onClose);
    return () => {
      window.removeEventListener("ms:sonoma-keyboard:open", onOpen);
      window.removeEventListener("ms:sonoma-keyboard:close", onClose);
    };
  }, [open, closeForInput]);
  useEffect(() => {
    if (!active) return;
    let pendingTranscriptPointer = null;
    const onPointerDown = (event) => {
      // A second finger means the first touch is not a tap.
      if (pendingTranscriptPointer) pendingTranscriptPointer.dragged = true;
      if (event.target.closest?.("[data-sonoma-keyboard], [data-sonoma-input], [data-sonoma-keyboard-toggle]")) return;
      // Keep Send alive through its click instead of dismissing on pointer-down.
      if (isSonomaSubmitTarget(event.target)) return;
      // Caption scroll arrows must work without dismissing the keyboard.
      if (event.target.closest?.("[data-sonoma-transcript-scroll]")) return;
      const transcript = event.target.closest?.("[data-sonoma-transcript]");
      if (transcript) {
        if (pendingTranscriptPointer) return;
        pendingTranscriptPointer = {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          scrollTop: transcript.scrollTop,
          transcript,
          dragged: false,
        };
        return;
      }
      pendingTranscriptPointer = null;
      close();
    };
    const onPointerMove = (event) => {
      const pending = pendingTranscriptPointer;
      if (pending?.pointerId !== event.pointerId) return;
      if (!isTranscriptTapGesture(pending, event, pending.transcript.scrollTop)) pending.dragged = true;
    };
    const onPointerUp = (event) => {
      const pending = pendingTranscriptPointer;
      if (pending?.pointerId !== event.pointerId) return;
      pendingTranscriptPointer = null;
      if (event.target.closest?.("[data-sonoma-transcript-scroll]")) return;
      if (isTranscriptTapGesture(pending, event, pending.transcript.scrollTop)) close();
    };
    const onPointerCancel = (event) => {
      if (pendingTranscriptPointer?.pointerId === event.pointerId) pendingTranscriptPointer = null;
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerCancel);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [active, close]);

  useEffect(() => {
    if (!active) return;
    const panel = panelRef.current;
    if (!panel) return;
    const measure = () => setKeyboardHeight(Math.ceil(panel.getBoundingClientRect().height));
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(panel);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [active]);

  useEffect(() => {
    if (!active) setKeyboardHeight(0);
  }, [active]);
  useEffect(() => {
    document.documentElement.style.setProperty("--sonoma-keyboard-height", `${keyboardHeight}px`);
    return () => { document.documentElement.style.removeProperty("--sonoma-keyboard-height"); };
  }, [keyboardHeight]);

  // A route change may remove the input that previously owned the keyboard.
  useEffect(() => {
    if (!workspaceDock && active?.ref?.current && !active.ref.current.isConnected) close();
  }, [workspaceDock, active, close]);

  // Manual keyboard toggle is independent of the selected tab. Reopen on the
  // previous tab and restore a connected input, if one is still available.
  const toggleKeyboard = useCallback((theme, preferredEntry) => {
    cancelSpaceGesture();
    if (activeRef.current && (!preferredEntry || activeRef.current.ref?.current === preferredEntry.ref?.current)) { close(); return; }
    // An explicit toggle can open the shared keyboard on desktop or touch.
    const last = lastKeyboardEntryRef.current;
    const previous = last?.theme?.label && last.theme.label !== theme?.label ? null : last;
    const field = previous?.ref?.current;
    const usable = field?.isConnected && !field.disabled && !field.readOnly;
    const preferredField = preferredEntry?.ref?.current;
    const preferredUsable = preferredField?.isConnected && !preferredField.disabled && !preferredField.readOnly;
    const entry = preferredUsable
      ? { ...preferredEntry, theme }
      : usable
        ? { ...previous, theme }
        : { ref: { current: null }, onChange: () => {}, layout: previous?.layout || "text", theme };
    if (entry.ref?.current?.isConnected && !panelRef.current?.contains(entry.ref.current)) {
      lastOutsideInputRef.current = entry;
    }
    setActive(entry);
    setShift(false);
  }, [close, workspaceDock, cancelSpaceGesture]);

  // Transfer only the learner-entered result to the most recently selected
  // answer field. Workspace inputs inside the keyboard are never targets.
  const insertMathResult = useCallback((result) => {
    const entry = lastOutsideInputRef.current;
    const field = entry?.ref?.current;
    if (entry?.layout === "pin" || !field?.isConnected || field.disabled || field.readOnly || panelRef.current?.contains(field)) return false;
    const next = insertSlateMathResult(field.value, result);
    if (next === field.value) return false;
    entry.onChange?.(next);
    return true;
  }, []);

  // Reuse the existing STT recorder; keep the input and insertion point from the moment dictation begins.
  const prepareDictation = useCallback(() => {
    const entry = activeRef.current;
    const field = entry?.ref?.current;
    dictationTargetRef.current = field?.isConnected && !field.disabled && !field.readOnly
      ? {
          field,
          entry,
          start: field.selectionStart ?? field.value.length,
          end: field.selectionEnd ?? field.value.length,
        }
      : null;
  }, []);

  const applyDictation = useCallback((transcript) => {
    const target = dictationTargetRef.current;
    dictationTargetRef.current = null;
    const field = target?.field;
    const entry = activeRef.current;
    // A delayed transcription must never land in a different input or a departed lesson.
    if (!field?.isConnected || field.disabled || field.readOnly ||
        entry?.ref?.current !== field || entry?.onChange !== target.entry.onChange) return;
    const result = insertDictationAtSelection(field.value, target.start, target.end, transcript);
    if (!result.changed) return;
    entry.onChange(result.value);
    requestAnimationFrame(() => {
      if (!field.isConnected || activeRef.current?.ref?.current !== field) return;
      try { field.setSelectionRange(result.caret, result.caret); } catch {}
    });
  }, []);

  const press = (key) => {
    const entry = activeRef.current;
    if (!entry) return;
    if (key === "Shift") { setShift((v) => !v); return; }
    const nextLayout = { "123": "number", "Math": "math", "More": "symbols", "ABC": "text" }[key];
    if (nextLayout) {
      cancelSpaceGesture();
      const leavingWorkspace = nextLayout !== "math" && workspacePortal?.contains(entry.ref?.current);
      const outside = lastOutsideInputRef.current;
      const target = leavingWorkspace && outside?.ref?.current?.isConnected ? outside :
        leavingWorkspace ? { ref: { current: null }, onChange: () => {}, theme: entry.theme } : entry;
      setActive({ ...target, layout: nextLayout });
      return;
    }
    const el = entry.ref.current;
    if (!el || !el.isConnected || el.disabled || el.readOnly) return;
    const source = typeof entry.getValue === "function" ? String(entry.getValue() || "") : el.value;
    const start = el.selectionStart ?? source.length;
    const end = el.selectionEnd ?? start;
    let nextStart = start;
    let nextEnd = end;
    let insertion = key === "Space" ? " " : key;
    if (key === "←" || key === "→") {
      const offset = key === "←" ? -1 : 1;
      const position = Math.max(0, Math.min(source.length, (key === "←" ? start : end) + offset));
      el.setSelectionRange(position, position);
      return;
    }
    if (key === "Backspace") {
      nextStart = start === end ? Math.max(0, start - 1) : start;
      insertion = "";
    } else if (shift && insertion.length === 1 && /[a-z]/.test(insertion)) {
      insertion = insertion.toUpperCase();
    }
    let updated = source.slice(0, nextStart) + insertion + source.slice(nextEnd);
    if (layout === "pin") updated = updated.replace(/\D/g, "").slice(0, el.maxLength > 0 ? el.maxLength : 10);
    entry.onChange(updated);
    // React's controlled update commits before restoring cursor selection.
    requestAnimationFrame(() => {
      if (entry.ref.current !== el || !el.isConnected) return;
      const pos = nextStart + insertion.length;
      try { el.setSelectionRange(pos, pos); } catch {}
    });
    if (shift) setShift(false);
  };

  // Touch-and-hold on Space acts like a small trackpad. A normal tap still
  // takes the existing click path and inserts exactly one space.
  const handleSpacePointerDown = (event) => {
    event.preventDefault(); // Leave focus in the learner's input, not the key.
    cancelSpaceGesture();
    suppressSpaceClickRef.current = false;
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    const entry = activeRef.current;
    const field = entry?.ref?.current;
    if (entry?.layout === "pin" || !field?.isConnected || field.disabled || field.readOnly ||
        typeof field.setSelectionRange !== "function") return;
    const gesture = {
      pointerId: event.pointerId,
      button: event.currentTarget,
      field,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      mode: "pending",
      holdTimer: null,
    };
    spaceGestureRef.current = gesture;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
    gesture.holdTimer = window.setTimeout(() => {
      if (spaceGestureRef.current !== gesture) return;
      if (!field.isConnected || field.disabled || field.readOnly ||
          activeRef.current?.ref?.current !== field) {
        cancelSpaceGesture();
        return;
      }
      const startCaret = typeof field.selectionEnd === "number" ? field.selectionEnd : field.value.length;
      Object.assign(gesture, {
        mode: "trackpad",
        initialCaret: startCaret,
        text: field.value,
        anchorX: gesture.lastX,
        anchorY: gesture.lastY,
        ...trackpadFieldMetrics(field),
      });
      try { field.setSelectionRange(startCaret, startCaret); } catch { cancelSpaceGesture(); return; }
      setSpaceTrackpadActive(true);
    }, SPACE_TRACKPAD_HOLD_MS);
  };

  const handleSpacePointerMove = (event) => {
    const gesture = spaceGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
    if (gesture.mode !== "trackpad") return;
    event.preventDefault();
    const field = gesture.field;
    if (!field.isConnected || field.disabled || field.readOnly ||
        activeRef.current?.ref?.current !== field) {
      suppressSpaceClickRef.current = true;
      cancelSpaceGesture();
      return;
    }
    const caret = trackpadCaretFromDrag({
      value: gesture.text,
      startCaret: gesture.initialCaret,
      deltaX: event.clientX - gesture.anchorX,
      deltaY: event.clientY - gesture.anchorY,
      wrapColumns: gesture.wrapColumns,
      lineStepPx: gesture.lineStepPx,
    });
    try { field.setSelectionRange(caret, caret); } catch { cancelSpaceGesture(); }
  };

  const handleSpacePointerUp = (event) => {
    const gesture = spaceGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const shouldInsertSpace = gesture.mode !== "trackpad" &&
      isShortSpaceTap(gesture.startX, gesture.startY, event.clientX, event.clientY);
    // Insert directly on release for reliable iOS taps, then suppress the
    // synthetic click that follows so a tap never produces two spaces.
    suppressSpaceClickRef.current = true;
    cancelSpaceGesture();
    if (shouldInsertSpace) press("Space");
  };

  const handleSpacePointerCancel = (event) => {
    const gesture = spaceGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    suppressSpaceClickRef.current = true;
    cancelSpaceGesture();
  };

  const handleSpaceClick = (event) => {
    // Pointer clicks after a hold or cancelled drag must not insert text.
    // A keyboard/assistive-technology click (detail=0) remains a normal space.
    if (event.detail !== 0 && suppressSpaceClickRef.current) {
      suppressSpaceClickRef.current = false;
      return;
    }
    suppressSpaceClickRef.current = false;
    press("Space");
  };

  const layout = active?.layout || "text";
  const workspaceVisible = Boolean(active && workspaceDock && layout === "math");
  const mathResultField = lastOutsideInputRef.current?.ref?.current;
  const canUseMathResult = Boolean(lastOutsideInputRef.current?.layout !== "pin" && mathResultField?.isConnected && !mathResultField.disabled &&
    !mathResultField.readOnly && !panelRef.current?.contains(mathResultField));
  return (
    <KeyboardContext.Provider value={{ open, close, toggleKeyboard, insertMathResult, canUseMathResult, active, keyboardHeight, setWorkspaceDock, workspacePortal, closeForInput }}>
      {children}
      {active && (
        <div ref={panelRef} data-sonoma-keyboard role="group" aria-label="Sonoma on-screen keyboard" style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:2147483646, background:active?.theme?.background || (workspaceVisible ? "#1e293b" : "#e8e8eb"), color:active?.theme?.color || (workspaceVisible ? "#e2e8f0" : "#111827"), padding:"8px max(8px, env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left))", boxShadow:"0 -5px 24px #0003", touchAction:"manipulation" }}>
          <div className={workspaceVisible ? dockStyles.layout : undefined}>
            {workspaceVisible && <div id="sonoma-keyboard-workspace" data-sonoma-keyboard-workspace className={dockStyles.workspace}><div ref={setWorkspacePortal} className={dockStyles.workspaceScroll} /></div>}
            <div className={workspaceVisible ? dockStyles.pad : undefined}>

          {(rows[layout] || rows.text).map((row, rowIndex) => (
            <div key={rowIndex} style={{display:"flex", justifyContent:"center", gap:4, margin:"4px auto", maxWidth:740, minWidth: workspaceVisible ? 280 : undefined}}>
              {row.map((key) => (
                <button key={key} type="button" disabled={!active?.ref?.current?.isConnected && !["ABC", "Math", "More", "123"].includes(key)}
                  onPointerDown={key === "Space" ? handleSpacePointerDown : (event) => event.preventDefault()}
                  onPointerMove={key === "Space" ? handleSpacePointerMove : undefined}
                  onPointerUp={key === "Space" ? handleSpacePointerUp : undefined}
                  onPointerCancel={key === "Space" ? handleSpacePointerCancel : undefined}
                  onLostPointerCapture={key === "Space" ? handleSpacePointerCancel : undefined}
                  onContextMenu={key === "Space" ? (event) => event.preventDefault() : undefined}
                  onClick={key === "Space" ? handleSpaceClick : () => press(key)}
                  aria-label={key === "Space" ? "Space. Hold and drag to move cursor" : key}
                  title={key === "Space" ? "Hold and drag to move cursor" : undefined}
                  style={{flex:key==="Space"?5:1, minWidth:workspaceVisible ? 34 : 0, height:44, background:key==="Space"&&spaceTrackpadActive?"#dbe7f3":key==="Backspace"?"#cbd5e1":"white", color:"#111827", border:"1px solid #b4bbc4", borderRadius:6, fontSize: key.length>5?12:17, fontWeight:600, ...(key === "Space" ? { touchAction:"none", userSelect:"none", WebkitUserSelect:"none", WebkitTouchCallout:"none" } : {})}}>
                  {key==="Shift"?(shift?"⇧":"↑"):key==="Backspace"?"⌫":key==="Space"?(spaceTrackpadActive?"move cursor":"space"):key}
                </button>
              ))}
              {layout !== "pin" && rowIndex === (rows[layout] || rows.text).length - 1 && (
                <span style={{display:"inline-flex", flex:"0 0 44px", height:44, alignItems:"center", justifyContent:"center", minWidth:0}} onPointerDown={(event) => event.preventDefault()}>
                  <WebbDictationButton onBeforeRecord={prepareDictation} onTranscript={applyDictation} />
                </span>
              )}
            </div>
          ))}
            </div>
          </div>
        </div>
      )}
    </KeyboardContext.Provider>
  );
}
export function useSonomaKeyboard() {
  const value = useContext(KeyboardContext);
  if (!value) throw new Error("SonomaKeyboardProvider missing");
  return value;
}
export function shouldUseSonomaKeyboard() { return isTouchScreen(); }
