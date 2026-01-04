// /components/email/editor/useSelection.js
// FULL REPLACEMENT — selection helpers for contentEditable rich text

export function clamp(n, a, b) {
  const x = Number(n);
  if (Number.isNaN(x)) return a;
  return Math.max(a, Math.min(b, x));
}

export function getSelectionRange() {
  const sel = window.getSelection?.();
  if (!sel || sel.rangeCount === 0) return null;
  return sel.getRangeAt(0);
}

export function selectionInside(el) {
  try {
    const range = getSelectionRange();
    if (!range) return false;
    const node = range.commonAncestorContainer;
    return el && node && el.contains(node);
  } catch {
    return false;
  }
}

// execCommand still best for contentEditable basic formatting (bold/italic/lists/align)
export function cmd(command, value = null) {
  try {
    document.execCommand(command, false, value);
    return true;
  } catch {
    return false;
  }
}

export function wrapSelectionWithSpan(styleObj) {
  const range = getSelectionRange();
  if (!range || range.collapsed) return false;

  const span = document.createElement("span");
  Object.entries(styleObj || {}).forEach(([k, v]) => {
    try {
      span.style[k] = v;
    } catch {}
  });

  span.appendChild(range.extractContents());
  range.insertNode(span);

  // move caret to end
  try {
    const sel = window.getSelection();
    sel.removeAllRanges();
    const r = document.createRange();
    r.selectNodeContents(span);
    r.collapse(false);
    sel.addRange(r);
  } catch {}

  return true;
}

export function currentSelectedText() {
  try {
    const sel = window.getSelection?.();
    return String(sel?.toString() || "").trim();
  } catch {
    return "";
  }
}
