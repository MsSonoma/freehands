"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { isTouchLikeDevice } from "../session/hooks/useTypingViewport";
import WebbDictationButton from "../session/webb/WebbDictationButton";
import { insertDictationAtSelection } from "./sonomaDictationInsertion.mjs";
import { isTranscriptTapGesture } from "./sonomaTranscriptGesture.mjs";
import dockStyles from "./SonomaKeyboardDock.module.css";

const KeyboardContext = createContext(null);
const rows = {
  text: ["qwertyuiop".split(""), "asdfghjkl".split(""), ["Shift", ..."zxcvbnm", "Backspace"], ["123", "Math", "More", ",", "Space", ".", "?", "←", "→", "Done"]],
  number: [["1","2","3"], ["4","5","6"], ["7","8","9"], ["-","0","."], ["ABC","Math","More","←","→","Backspace","Done"]],
  math: [["7","8","9","÷","/"], ["4","5","6","×","*"], ["1","2","3","+","−"], ["0",".","=","(",")"], ["ABC","More","←","→","Backspace","Done"]],
  symbols: [["!","@","#","$","%","^","&"], ["_","~",":",";","\u0027","\u0022","?"], ["[","]","{","}","<",">","|"], ["\\","°","±","√","π","²","³"], ["ABC","Math","123","Space","←","→","Backspace","Done"]],
};

function isTouchScreen() {
  return isTouchLikeDevice();
}

export function SonomaKeyboardProvider({ children }) {
  const [active, setActive] = useState(null);
  const [shift, setShift] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [workspaceDock, setWorkspaceDock] = useState(null);
  const [workspacePortal, setWorkspacePortal] = useState(null);
  const lastOutsideInputRef = useRef(null);

  const panelRef = useRef(null);
  const activeRef = useRef(null);
  const dictationTargetRef = useRef(null);
  activeRef.current = active;
  const close = useCallback(() => {
    lastOutsideInputRef.current = null;
    dictationTargetRef.current = null;
    setActive(null);
    setShift(false);
    setKeyboardHeight(0);
  }, []);
  const open = useCallback((config) => {
    if (!isTouchScreen() && !(workspaceDock && config?.layout === "math")) return;
    const field = config?.ref?.current;
    if (field?.isConnected && !panelRef.current?.contains(field)) lastOutsideInputRef.current = config;
    setActive(config);
    setShift(false);
  }, [workspaceDock]);
  useEffect(() => {
    if (!active) return;
    let pendingTranscriptPointer = null;
    const onPointerDown = (event) => {
      // A second finger means the first touch is not a tap.
      if (pendingTranscriptPointer) pendingTranscriptPointer.dragged = true;
      if (event.target.closest?.("[data-sonoma-keyboard], [data-sonoma-input], [data-sonoma-keyboard-toggle]")) return;
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

  // A route change may remove the input that previously owned the keyboard.
  useEffect(() => {
    if (!workspaceDock && active && !active.ref?.current?.isConnected) close();
  }, [workspaceDock, active, close]);

  // Open the Math keyboard tab even when a test question has no answer field.
  const showMathTab = useCallback((theme) => {
    if (!isTouchScreen() && !workspaceDock) return;
    setActive((current) => current?.ref?.current?.isConnected
      ? { ...current, layout: "math" }
      : { ref: { current: null }, onChange: () => {}, layout: "math", theme });
    setShift(false);
  }, [workspaceDock]);

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
    if (key === "Done") { close(); return; }
    if (key === "Shift") { setShift((v) => !v); return; }
    const nextLayout = { "123": "number", "Math": "math", "More": "symbols", "ABC": "text" }[key];
    if (nextLayout) {
      const leavingWorkspace = nextLayout !== "math" && workspacePortal?.contains(entry.ref?.current);
      const outside = lastOutsideInputRef.current;
      const target = leavingWorkspace && outside?.ref?.current?.isConnected ? outside :
        leavingWorkspace ? { ref: { current: null }, onChange: () => {}, theme: entry.theme } : entry;
      setActive({ ...target, layout: nextLayout });
      return;
    }
    const el = entry.ref.current;
    if (!el || !el.isConnected || el.disabled || el.readOnly) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    let nextStart = start;
    let nextEnd = end;
    let insertion = key === "Space" ? " " : key;
    if (key === "←" || key === "→") {
      const offset = key === "←" ? -1 : 1;
      const position = Math.max(0, Math.min(el.value.length, (key === "←" ? start : end) + offset));
      el.setSelectionRange(position, position);
      return;
    }
    if (key === "Backspace") {
      nextStart = start === end ? Math.max(0, start - 1) : start;
      insertion = "";
    } else if (shift && insertion.length === 1 && /[a-z]/.test(insertion)) {
      insertion = insertion.toUpperCase();
    }
    const updated = el.value.slice(0, nextStart) + insertion + el.value.slice(nextEnd);
    entry.onChange(updated);
    // React's controlled update commits before restoring cursor selection.
    requestAnimationFrame(() => {
      if (entry.ref.current !== el || !el.isConnected) return;
      const pos = nextStart + insertion.length;
      try { el.setSelectionRange(pos, pos); } catch {}
    });
    if (shift) setShift(false);
  };
  const layout = active?.layout || "text";
  const workspaceVisible = Boolean(active && workspaceDock && layout === "math");
  return (
    <KeyboardContext.Provider value={{ open, close, showMathTab, active, keyboardHeight, setWorkspaceDock, workspacePortal }}>
      {children}
      {active && (
        <div ref={panelRef} data-sonoma-keyboard role="group" aria-label="Sonoma on-screen keyboard" style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:10000, background:active?.theme?.background || (workspaceVisible ? "#1e293b" : "#e8e8eb"), color:active?.theme?.color || (workspaceVisible ? "#e2e8f0" : "#111827"), padding:"8px max(8px, env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left))", boxShadow:"0 -5px 24px #0003", touchAction:"manipulation" }}>
          <div style={{display:"flex", justifyContent:"space-between", maxWidth:740, margin:"0 auto 5px", alignItems:"center"}}>
            <span style={{fontSize:12,color:active?.theme?.color || (workspaceVisible ? "#e2e8f0" : "#374151"),fontWeight:700}}>{active?.theme?.label || workspaceDock?.label || "Sonoma Keyboard"}</span>
            <div style={{display:"inline-flex",alignItems:"center",gap:8}}>

              <span style={{display: active ? undefined : "none"}} onPointerDown={(event) => event.preventDefault()}>
                <WebbDictationButton
                  onBeforeRecord={prepareDictation}
                  onTranscript={applyDictation}
                />
              </span>
              <button type="button" onPointerDown={(e)=>e.preventDefault()} onClick={close} aria-label="Close keyboard" style={{padding:"5px 12px",borderRadius:7}}>Close</button>
            </div>
          </div>
          <div className={workspaceVisible ? dockStyles.layout : undefined}>
            {workspaceVisible && <div id="sonoma-keyboard-workspace" data-sonoma-keyboard-workspace className={dockStyles.workspace}><div ref={setWorkspacePortal} className={dockStyles.workspaceScroll} /></div>}
            <div className={workspaceVisible ? dockStyles.pad : undefined}>

          {(rows[layout] || rows.text).map((row, rowIndex) => (
            <div key={rowIndex} style={{display:"flex", justifyContent:"center", gap:4, margin:"4px auto", maxWidth:740, minWidth: workspaceVisible ? 280 : undefined}}>
              {row.map((key) => (
                <button key={key} type="button" disabled={!active?.ref?.current?.isConnected && !["ABC", "Math", "More", "123", "Done"].includes(key)} onPointerDown={(e)=>e.preventDefault()} onClick={()=>press(key)}
                  aria-label={key === "Space" ? "Space" : key}
                  style={{flex:key==="Space"?5:1, minWidth:workspaceVisible ? 34 : 0, height:44, background:key==="Done"?(active?.theme?.accent || "#356e5a"):key==="Backspace"?"#cbd5e1":"white", color:key==="Done"?"white":"#111827", border:"1px solid #b4bbc4", borderRadius:6, fontSize: key.length>5?12:17, fontWeight:600}}>
                  {key==="Shift"?(shift?"⇧":"↑"):key==="Backspace"?"⌫":key==="Space"?"space":key}
                </button>
              ))}
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
