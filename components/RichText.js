// /components/RichText.js
// Tiny contenteditable with basic formatting (no external libs)

import { useEffect, useRef } from 'react';

export default function RichText({ value = '', onChange, placeholder = 'Type...' }) {
  const ref = useRef(null);
  const savedRange = useRef(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || '';
    }
  }, [value]);

  // ── Selection helpers ─────────────────────────────────────────────────────

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  }

  // Focus the editor then restore the saved range.
  // Returns true only when there is actual text selected (not just a cursor).
  function restoreSelection() {
    if (!savedRange.current) return false;
    const sel = window.getSelection();
    if (!sel) return false;
    if (ref.current) ref.current.focus();
    sel.removeAllRanges();
    sel.addRange(savedRange.current);
    return !savedRange.current.collapsed;
  }

  // ── Bold / italic / underline / alignment / block format ─────────────────

  function exec(cmd, arg) {
    restoreSelection();
    try { document.execCommand('styleWithCSS', false, true); } catch (_) {}
    document.execCommand(cmd, false, arg);
    if (ref.current) onChange && onChange(ref.current.innerHTML);
  }

  // ── Font size ─────────────────────────────────────────────────────────────
  // Strategy: execCommand('fontSize', '7') uses the browser's own range-splitting
  // logic to handle any selection shape. We then swap each <font size="7"> for
  // <span style="font-size: Xpx">, preserving any colour already on the element.

  function applyFontSize(px) {
    if (!px || !restoreSelection()) return;
    try { document.execCommand('styleWithCSS', false, false); } catch (_) {}
    document.execCommand('fontSize', false, '7');
    if (!ref.current) return;
    ref.current.querySelectorAll('font[size="7"]').forEach((font) => {
      const span = document.createElement('span');
      span.style.fontSize = px + 'px';
      if (font.color) span.style.color = font.color; // carry over any colour
      while (font.firstChild) span.appendChild(font.firstChild);
      font.parentNode.replaceChild(span, font);
    });
    onChange && onChange(ref.current.innerHTML);
  }

  // ── Colour ────────────────────────────────────────────────────────────────
  // styleWithCSS=true makes foreColor emit <span style="color:…"> instead of
  // <font color="…">, so it nests cleanly with font-size spans.

  function applyColor(color) {
    if (!restoreSelection()) return;
    try { document.execCommand('styleWithCSS', false, true); } catch (_) {}
    document.execCommand('foreColor', false, color);
    if (ref.current) onChange && onChange(ref.current.innerHTML);
  }

  function applyHierarchy(tag) {
    const normalizedTag = String(tag || 'p').toLowerCase();
    exec('formatBlock', normalizedTag === 'p' ? 'p' : `<${normalizedTag}>`);
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); applyHierarchy('p'); }} style={tb}>P</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); applyHierarchy('h1'); }} style={tb}>H1</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); applyHierarchy('h2'); }} style={tb}>H2</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); applyHierarchy('h3'); }} style={tb}>H3</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('bold'); }} style={tb}><b>B</b></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('italic'); }} style={tb}><i>I</i></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('underline'); }} style={tb}><u>U</u></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('justifyLeft'); }} style={tb}>⟸</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('justifyCenter'); }} style={tb}>⇔</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('justifyRight'); }} style={tb}>⟹</button>

        {/* Font size — save selection on mousedown, BEFORE the dropdown steals focus */}
        <select
          onMouseDown={saveSelection}
          onChange={(e) => { if (e.target.value) applyFontSize(Number(e.target.value)); }}
          defaultValue=""
          style={sel}
        >
          <option value="" disabled>Size</option>
          <option value="12">12</option>
          <option value="14">14</option>
          <option value="16">16</option>
          <option value="18">18</option>
          <option value="20">20</option>
          <option value="24">24</option>
          <option value="28">28</option>
          <option value="32">32</option>
          <option value="40">40</option>
          <option value="48">48</option>
        </select>

        {/* Colour — save selection on mousedown, BEFORE the OS picker dialog opens */}
        <input
          type="color"
          onMouseDown={saveSelection}
          onChange={(e) => applyColor(e.target.value)}
          title="Text colour"
          style={{ cursor: 'pointer', borderRadius: 4, height: 30 }}
        />
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange && onChange(e.currentTarget.innerHTML)}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        style={rt}
        data-placeholder={placeholder}
      />
    </div>
  );
}

const tb = {
  background: '#1f2937',
  color: '#eaeaea',
  border: '1px solid #2a3242',
  borderRadius: 6,
  padding: '4px 8px',
  cursor: 'pointer',
};
const sel = { background: '#141821', color: '#eaeaea', border: '1px solid #2a3242', borderRadius: 6 };
const rt = {
  minHeight: 90,
  padding: 10,
  border: '1px solid #2a3242',
  borderRadius: 6,
  background: '#141821',
  color: '#eaeaea',
  outline: 'none',
};
