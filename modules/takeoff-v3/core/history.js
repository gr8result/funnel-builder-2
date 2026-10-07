import { cloneGeometry } from "./geometry.js";

export function createHistory(initialGeometry) {
  return { past: [], present: cloneGeometry(initialGeometry), future: [] };
}

export function commitHistory(history, nextGeometry) {
  return {
    past: [...history.past, cloneGeometry(history.present)],
    present: cloneGeometry(nextGeometry),
    future: [],
  };
}

export function undoHistory(history) {
  if (!history.past.length) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: cloneGeometry(previous),
    future: [cloneGeometry(history.present), ...history.future],
  };
}

export function redoHistory(history) {
  if (!history.future.length) return history;
  const next = history.future[0];
  return {
    past: [...history.past, cloneGeometry(history.present)],
    present: cloneGeometry(next),
    future: history.future.slice(1),
  };
}
