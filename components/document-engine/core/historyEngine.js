export function createHistory(initialState = null) {
  return {
    past: [],
    present: initialState,
    future: [],
  };
}

export function pushHistory(history, nextState) {
  const current = history || createHistory();
  if (current.present === nextState) return current;
  return {
    past: current.present === null || current.present === undefined
      ? current.past
      : [...current.past, current.present],
    present: nextState,
    future: [],
  };
}

export function undo(history) {
  const current = history || createHistory();
  if (!current.past.length) return current;
  const previous = current.past[current.past.length - 1];
  return {
    past: current.past.slice(0, -1),
    present: previous,
    future: current.present === null || current.present === undefined
      ? current.future
      : [current.present, ...current.future],
  };
}

export function redo(history) {
  const current = history || createHistory();
  if (!current.future.length) return current;
  const next = current.future[0];
  return {
    past: current.present === null || current.present === undefined
      ? current.past
      : [...current.past, current.present],
    present: next,
    future: current.future.slice(1),
  };
}

export function canUndo(history) {
  return Boolean(history?.past?.length);
}

export function canRedo(history) {
  return Boolean(history?.future?.length);
}
