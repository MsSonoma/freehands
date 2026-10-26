"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { isTouchLikeDevice } from "../session/hooks/useTypingViewport";
import WebbDictationButton from "../session/webb/WebbDictationButton";
import { insertDictationAtSelection } from "./sonomaDictationInsertion.mjs";

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
  const panelRef = useRef(null);
  const activeRef = useRef(null);
  const dictationTargetRef = useRef(null);
  activeRef.current = active;
  const close = useCallback(() => { dictationTargetRef.current = null; setActive(null); setShift(false); setKeyboardHeight(0); }, []);
  const open = useCallback((config) => {
    if (!isTouchScreen()) return;
    setActive(config);
    setShift(false);
  }, []);
  useEffect(() => {
    if (!active) return;
    const onPointerDown = (event) => {
      if (event.target.closest?.("[data-sonoma-keyboard]")) return;
      if (event.target.closest?.("[data-sonoma-input]")) return;
      close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
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
  const layout = active?.layout || "text";
  return (
    <KeyboardContext.Provider value={{ open, close, active, keyboardHeight }}>
      {children}
      {active && (
        <div ref={panelRef} data-sonoma-keyboard role="group" aria-label="Sonoma on-screen keyboard" style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:10000, background:active?.theme?.background || "#e8e8eb", color:active?.theme?.color || "#111827", padding:"8px max(8px, env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left))", boxShadow:"0 -5px 24px #0003", touchAction:"manipulation" }}>
          <div style={{display:"flex", justifyContent:"space-between", maxWidth:740, margin:"0 auto 5px", alignItems:"center"}}>
            <span style={{fontSize:12,color:active?.theme?.color || "#374151",fontWeight:700}}>{active?.theme?.label || "Sonoma Keyboard"}</span>
            <div style={{display:"inline-flex",alignItems:"center",gap:8}}>
              <span onPointerDown={(event) => event.preventDefault()}>
                <WebbDictationButton
                  onBeforeRecord={prepareDictation}
                  onTranscript={applyDictation}
                />
              </span>
              <button type="button" onPointerDown={(e)=>e.preventDefault()} onClick={close} aria-label="Close keyboard" style={{padding:"5px 12px",borderRadius:7}}>Close</button>
            </div>
          </div>
          {(rows[layout] || rows.text).map((row, rowIndex) => (
            <div key={rowIndex} style={{display:"flex", justifyContent:"center", gap:4, margin:"4px auto", maxWidth:740}}>
              {row.map((key) => (
                <button key={key} type="button" onPointerDown={(e)=>e.preventDefault()} onClick={()=>press(key)}
                  aria-label={key === "Space" ? "Space" : key}
                  style={{flex:key==="Space"?5:1, minWidth:0, height:44, background:key==="Done"?(active?.theme?.accent || "#356e5a"):key==="Backspace"?"#cbd5e1":"white", color:key==="Done"?"white":"#111827", border:"1px solid #b4bbc4", borderRadius:6, fontSize: key.length>5?12:17, fontWeight:600}}>
                  {key==="Shift"?(shift?"⇧":"↑"):key==="Backspace"?"⌫":key==="Space"?"space":key}
                </button>
              ))}
            </div>
          ))}
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
