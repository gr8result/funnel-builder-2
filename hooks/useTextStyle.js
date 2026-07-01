// useTextStyle — manages TextStyle state with a bounded undo/redo history.
//
// Usage:
//   const { style, set, patch, undo, redo, canUndo, canRedo, reset } =
//     useTextStyle(initialStyle);
//
//   patch({ fontSize: 24 })  // merge a partial update
//   set(newStyle)            // replace entire style
//   undo()                   // revert last change
//   redo()                   // reapply last undone change

import { useState, useCallback, useRef } from "react";
import { createTextStyle, mergeTextStyle } from "../lib/text-editor/TextStyleSchema";

const MAX_HISTORY = 50;

export default function useTextStyle(initial = {}) {
  const initialStyle = createTextStyle(initial);

  // history[cursor] is the current state
  const [history, setHistory] = useState([initialStyle]);
  const [cursor,  setCursor]  = useState(0);

  const currentStyle = history[cursor];

  // Push a new entry; truncate any forward history
  const push = useCallback((nextStyle) => {
    setHistory(prev => {
      const base = prev.slice(0, cursor + 1);
      const next = [...base, nextStyle].slice(-MAX_HISTORY);
      return next;
    });
    setCursor(prev => {
      const newLen = Math.min(prev + 1, MAX_HISTORY - 1);
      return newLen;
    });
  }, [cursor]);

  // Replace the entire TextStyle
  const set = useCallback((next) => {
    push(createTextStyle(next));
  }, [push]);

  // Merge a partial patch into the current TextStyle
  const patch = useCallback((partialPatch) => {
    push(mergeTextStyle(currentStyle, partialPatch));
  }, [currentStyle, push]);

  // Undo
  const canUndo = cursor > 0;
  const undo = useCallback(() => {
    if (!canUndo) return;
    setCursor(c => c - 1);
  }, [canUndo]);

  // Redo
  const canRedo = cursor < history.length - 1;
  const redo = useCallback(() => {
    if (!canRedo) return;
    setCursor(c => c + 1);
  }, [canRedo, history.length]);

  // Reset to initial
  const reset = useCallback(() => {
    const fresh = createTextStyle(initial);
    setHistory([fresh]);
    setCursor(0);
  }, []);

  return {
    style:    currentStyle,
    set,
    patch,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    historyLength: history.length,
    cursor,
  };
}
