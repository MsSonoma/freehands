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
  const workspaceDockRef = useRef(null);
  workspaceDockRef.current = workspaceDock;
  const panelRef = useRef(null);
  const activeRef = useRef(null);
  const dictationTargetRef = useRef(null);
  activeRef.current = active;
  const close = useCallback(() => {
    if (workspaceDockRef.current?.visible) workspaceDockRef.current.onHide?.();
    dictationTargetRef.current = null;
    setActive(null);
    setShift(false);
    setKeyboardHeight(0);
  }, []);
  const open = useCallback((config) => {
    if (!isTouchScreen() && !workspaceDockRef.current?.visible) return;
    setActive(config);
    setShift(false);
  }, []);
  useEffect(() => {
    if (!active && !workspaceDock?.visible) return;
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
  }, [active, close, workspaceDock?.visible]);

  useEffect(() => {
    if (!active && !workspaceDock?.visible) return;
    const panel = panelRef.current;
    if (!panel) return;
    const measure = () => setKeyboardHeight(Math.ceil(panel.getBoundingClientRect().height));
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(panel);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [active, workspaceDock?.visible]);

  useEffect(() => {
    if (!active && !workspaceDock?.visible) setKeyboardHeight(0);
  }, [active, workspaceDock?.visible]);

  // A route change may remove the input that previously owned the keyboard.
  useEffect(() => {
    if (!workspaceDock && active && !active.ref?.current?.isConnected) close();
  }, [workspaceDock, active, close]);

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
    if (key === "123") { setActive({ ...entry, layout: "number" }); return; }
    if (key === "Math") { setActive({ ...entry, layout: "math" }); return; }
    if (key === "More") { setActive({ ...entry, layout: "symbols" }); return; }
    if (key === "ABC") { setActive({ ...entry, layout: "text" }); return; }
    const el = entry.ref.current;
    if (!el || !el.isConnected || el.disabled || el.readOnly) { close(); return; }
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
  const workspaceVisible = Boolean(workspaceDock?.visible);
  const toggleWorkspaceDock = () => {
    if (workspaceVisible && workspacePortal?.contains(activeRef.current?.ref?.current)) setActive(null);
    workspaceDock?.onToggle?.();
  };
  const layout = active?.layout || (workspaceVisible ? "number" : "text");
  return (
    <KeyboardContext.Provider value={{ open, close, active, keyboardHeight, setWorkspaceDock, workspacePortal }}>
      {children}
      {(active || workspaceVisible) && (
        <div ref={panelRef} data-sonoma-keyboard role="group" aria-label="Sonoma on-screen keyboard" style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:10000, background:active?.theme?.background || (workspaceVisible ? "#1e293b" : "#e8e8eb"), color:active?.theme?.color || (workspaceVisible ? "#e2e8f0" : "#111827"), padding:"8px max(8px, env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left))", boxShadow:"0 -5px 24px #0003", touchAction:"manipulation", ...(workspaceVisible ? { display:"flex", flexDirection:"column", maxHeight:"min(86dvh, 720px)" } : {}) }}>
          <div style={{display:"flex", justifyContent:"space-between", maxWidth:740, margin:"0 auto 5px", alignItems:"center"}}>
            <span style={{fontSize:12,color:active?.theme?.color || (workspaceVisible ? "#e2e8f0" : "#374151"),fontWeight:700}}>{active?.theme?.label || workspaceDock?.label || "Sonoma Keyboard"}</span>
            <div style={{display:"inline-flex",alignItems:"center",gap:8}}>
              {workspaceDock && <button data-sonoma-keyboard-toggle type="button" onPointerDown={(event)=>event.preventDefault()} onClick={toggleWorkspaceDock} aria-expanded={workspaceVisible} aria-controls="sonoma-keyboard-workspace" style={{background:"#334155",color:"#fff",border:"1px solid #64748b",padding:"5px 9px",borderRadius:7,fontSize:12}}>{workspaceVisible ? "Hide my math" : "My math workspace"}</button>}
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
            {workspaceVisible && <div id="sonoma-keyboard-workspace" data-sonoma-keyboard-workspace className={dockStyles.workspace}><div ref={setWorkspacePortal} /></div>}
            <div className={workspaceVisible ? dockStyles.pad : undefined}>
              {workspaceVisible && !active && <div style={{fontSize:12,textAlign:"center",color:"#cbd5e1",padding:4}}>Tap a math box to use the number keys.</div>}
          {(rows[layout] || rows.text).map((row, rowIndex) => (
            <div key={rowIndex} style={{display:"flex", justifyContent:"center", gap:4, margin:"4px auto", maxWidth:740}}>
              {row.map((key) => (
                <button key={key} type="button" disabled={!active && key !== "Done"} onPointerDown={(e)=>e.preventDefault()} onClick={()=>press(key)}
                  aria-label={key === "Space" ? "Space" : key}
                  style={{flex:key==="Space"?5:1, minWidth:0, height:44, background:key==="Done"?(active?.theme?.accent || "#356e5a"):key==="Backspace"?"#cbd5e1":"white", color:key==="Done"?"white":"#111827", border:"1px solid #b4bbc4", borderRadius:6, fontSize: key.length>5?12:17, fontWeight:600}}>
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
