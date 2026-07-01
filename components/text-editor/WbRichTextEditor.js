// WbRichTextEditor — a proper contentEditable rich text editor with a floating
// formatting toolbar, designed for the Website Builder text block.
//
// Architecture:
//   • The toolbar uses onMouseDown + e.preventDefault() so it NEVER steals
//     focus from the contentEditable — selection is always preserved.
//   • Inputs (font-size, color) that DO steal focus save the range first via
//     onMouseDown, so it can be restored before applying the command.
//   • document.execCommand handles bold/italic/underline/strikethrough/lists/
//     alignment/headings — all still widely supported and work reliably.
//   • Font-size uses a marker trick (fontSize "7") + span-replacement so
//     output is <span style="font-size: Xpx"> not old <font> tags.
//   • Color uses execCommand('foreColor') which outputs clean inline spans.
//   • Font-family uses execCommand('fontName') + <font face=""> cleanup.
//   • Changes are emitted via onChange on blur and after every command.
//   • The component intentionally does NOT use dangerouslySetInnerHTML after
//     mount — the DOM is managed directly to avoid cursor resets.
//
// Usage in Website Builder text block:
//   <WbRichTextEditor
//     html={props.text}
//     onChange={newHtml => onChangeBlock({ ...props, text: newHtml })}
//     blockStyle={{ fontSize, lineHeight, textAlign, color, fontFamily }}
//   />

import { useState, useRef, useEffect, useCallback, forwardRef } from "react";
import { FONT_REGISTRY, getFontStack } from "../../lib/text-editor/fontRegistry";

// ── execCommand wrappers ──────────────────────────────────────────────────────

function exec(cmd, val = null) {
  try { document.execCommand(cmd, false, val); } catch {}
}

function qState(cmd) {
  try { return document.queryCommandState(cmd); } catch { return false; }
}

function getAlignState() {
  if (qState("justifyCenter"))  return "center";
  if (qState("justifyRight"))   return "right";
  if (qState("justifyFull"))    return "justify";
  return "left";
}

// ── Selection save/restore ────────────────────────────────────────────────────

function saveSelection() {
  try {
    const sel = window.getSelection?.();
    if (!sel || !sel.rangeCount) return null;
    return sel.getRangeAt(0).cloneRange();
  } catch { return null; }
}

function restoreSelection(range) {
  if (!range) return;
  try {
    const sel = window.getSelection?.();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {}
}

// ── Replace legacy <font> tags with semantic spans ────────────────────────────

function replaceFontSizeTags(container, px) {
  if (!container) return;
  container.querySelectorAll("font[size='7']").forEach((f) => {
    const span = document.createElement("span");
    span.style.fontSize = `${px}px`;
    span.innerHTML = f.innerHTML;
    f.parentNode.replaceChild(span, f);
  });
}

function replaceFontFaceTags(container) {
  if (!container) return;
  container.querySelectorAll("font[face]").forEach((f) => {
    const family = f.getAttribute("face") || "";
    if (!family) return;
    const span = document.createElement("span");
    span.style.fontFamily = `${family}, sans-serif`;
    span.innerHTML = f.innerHTML;
    f.parentNode.replaceChild(span, f);
  });
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function WbRichTextEditor({ html, onChange, blockStyle = {}, placeholder = "Click to edit…" }) {
  const editorRef      = useRef(null);
  const savedRangeRef  = useRef(null);
  const lastHtmlRef    = useRef(html || "");
  const commitTimerRef = useRef(null);

  const [focused,  setFocused]  = useState(false);
  const [fmtState, setFmtState] = useState({
    bold: false, italic: false, underline: false, strikethrough: false,
    unorderedList: false, orderedList: false, align: "left",
  });

  // Set innerHTML only on first render or external (non-user) changes.
  // We track what we last emitted so we know what's "external" vs "internal".
  useEffect(() => {
    const dom = editorRef.current;
    if (!dom) return;
    const incoming = html || "";
    if (incoming !== lastHtmlRef.current && dom.innerHTML !== incoming) {
      dom.innerHTML = incoming;
      lastHtmlRef.current = incoming;
    }
  }, [html]);

  // ── Format state ────────────────────────────────────────────────────────────

  const refreshFmt = useCallback(() => {
    setFmtState({
      bold:          qState("bold"),
      italic:        qState("italic"),
      underline:     qState("underline"),
      strikethrough: qState("strikeThrough"),
      unorderedList: qState("insertUnorderedList"),
      orderedList:   qState("insertOrderedList"),
      align:         getAlignState(),
    });
  }, []);

  useEffect(() => {
    if (!focused) return;
    document.addEventListener("selectionchange", refreshFmt);
    return () => document.removeEventListener("selectionchange", refreshFmt);
  }, [focused, refreshFmt]);

  // ── Commit ──────────────────────────────────────────────────────────────────

  const commit = useCallback(() => {
    const dom = editorRef.current;
    if (!dom || typeof onChange !== "function") return;
    const next = dom.innerHTML;
    if (next !== lastHtmlRef.current) {
      lastHtmlRef.current = next;
      onChange(next);
    }
  }, [onChange]);

  const scheduleCommit = useCallback((delay = 0) => {
    clearTimeout(commitTimerRef.current);
    commitTimerRef.current = setTimeout(commit, delay);
  }, [commit]);

  // ── Formatting commands ─────────────────────────────────────────────────────

  // cmd = null means "no execCommand, just commit" (used after external DOM changes)
  const applyCmd = useCallback((cmd, val = null) => {
    if (cmd) exec(cmd, val);
    refreshFmt();
    scheduleCommit(0);
  }, [refreshFmt, scheduleCommit]);

  const applyFontSize = useCallback((px) => {
    if (!px || isNaN(px) || px < 1) return;
    editorRef.current?.focus();
    restoreSelection(savedRangeRef.current);
    exec("fontSize", "7");
    replaceFontSizeTags(editorRef.current, px);
    refreshFmt();
    scheduleCommit(0);
  }, [refreshFmt, scheduleCommit]);

  const applyColor = useCallback((color) => {
    editorRef.current?.focus();
    restoreSelection(savedRangeRef.current);
    exec("foreColor", color);
    refreshFmt();
    scheduleCommit(0);
  }, [refreshFmt, scheduleCommit]);

  const applyFontFamily = useCallback((family) => {
    editorRef.current?.focus();
    restoreSelection(savedRangeRef.current);
    exec("fontName", family);
    replaceFontFaceTags(editorRef.current);
    refreshFmt();
    scheduleCommit(0);
  }, [refreshFmt, scheduleCommit]);

  const applyFormatBlock = useCallback((tag) => {
    editorRef.current?.focus();
    restoreSelection(savedRangeRef.current);
    exec("formatBlock", tag);
    refreshFmt();
    scheduleCommit(0);
  }, [refreshFmt, scheduleCommit]);

  const saveCurrent = useCallback(() => {
    savedRangeRef.current = saveSelection();
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleFocus = useCallback(() => {
    setFocused(true);
    refreshFmt();
  }, [refreshFmt]);

  const handleBlur = useCallback((e) => {
    // Don't collapse if focus moved into our toolbar
    if (e.relatedTarget?.closest?.("[data-wb-richtoolbar]")) return;
    setFocused(false);
    commit();
  }, [commit]);

  const handleInput = useCallback(() => {
    refreshFmt();
    scheduleCommit(600);
  }, [refreshFmt, scheduleCommit]);

  const handleKeyUp = useCallback((e) => {
    refreshFmt();
    if (e.key === "Enter" || e.key === "Backspace" || e.key === "Delete") {
      scheduleCommit(100);
    }
  }, [refreshFmt, scheduleCommit]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* Floating toolbar — only visible while editor is focused */}
      {focused && (
        <WbRichTextToolbar
          state={fmtState}
          onCmd={applyCmd}
          onFontSize={applyFontSize}
          onColor={applyColor}
          onFontFamily={applyFontFamily}
          onFormatBlock={applyFormatBlock}
          onSaveRange={saveCurrent}
        />
      )}

      {/* Editable text area */}
      <div
        ref={editorRef}
        className="wb-text-block"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        style={{
          ...blockStyle,
          outline: "1px dashed rgba(14,165,233,0.4)",
          padding: "6px 8px",
          borderRadius: 8,
          minHeight: 40,
          cursor: "text",
          boxSizing: "border-box",
          width: "100%",
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onInput={handleInput}
        onMouseUp={refreshFmt}
        onKeyUp={handleKeyUp}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      />

      {/* Empty placeholder CSS */}
      <style>{`
        [data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: rgba(148,163,184,0.5);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

// ── Floating toolbar ──────────────────────────────────────────────────────────

function WbRichTextToolbar({
  state, onCmd, onFontSize, onColor, onFontFamily, onFormatBlock, onSaveRange,
}) {
  const [sizeInput, setSizeInput] = useState("");
  const [colorVal,  setColorVal]  = useState("#ffffff");
  const [fontFamilyOpen, setFontFamilyOpen] = useState(false);

  const prevDefault = (e) => e.preventDefault();

  return (
    <div
      data-wb-richtoolbar="true"
      contentEditable={false}
      style={TOOLBAR_WRAP}
      onMouseDown={prevDefault}
    >
      {/* ── Headings ── */}
      <select
        title="Text format"
        onMouseDown={(e) => { e.stopPropagation(); onSaveRange?.(); }}
        onChange={(e) => { onFormatBlock(e.target.value || "p"); e.target.value = ""; }}
        style={SELECT_STYLE}
        defaultValue=""
      >
        <option value="" disabled>Format</option>
        <option value="p">Paragraph</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
        <option value="h4">Heading 4</option>
        <option value="blockquote">Quote</option>
      </select>

      <Sep />

      {/* ── Font family ── */}
      <select
        title="Font family"
        onMouseDown={(e) => { e.stopPropagation(); onSaveRange?.(); }}
        onChange={(e) => { if (e.target.value) onFontFamily(e.target.value); e.target.value = ""; }}
        style={{ ...SELECT_STYLE, maxWidth: 120 }}
        defaultValue=""
      >
        <option value="" disabled>Font</option>
        {FONT_REGISTRY.map(f => (
          <option key={f.family} value={f.family}>{f.family}</option>
        ))}
      </select>

      <Sep />

      {/* ── Font size ── */}
      <input
        type="number"
        min={6}
        max={200}
        placeholder="px"
        title="Font size"
        style={{ ...NUM_INPUT_STYLE }}
        onMouseDown={(e) => { e.stopPropagation(); onSaveRange?.(); }}
        value={sizeInput}
        onChange={(e) => setSizeInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && sizeInput) { onFontSize(parseInt(sizeInput, 10)); setSizeInput(""); }
          if (e.key === "Escape")             { setSizeInput(""); e.target.blur(); }
        }}
        onBlur={() => { if (sizeInput) { onFontSize(parseInt(sizeInput, 10)); setSizeInput(""); } }}
      />

      <Sep />

      {/* ── Bold / Italic / Underline / Strike ── */}
      <Btn active={state.bold}          title="Bold (Ctrl+B)"       onMouseDown={(e) => { e.preventDefault(); onCmd("bold"); }}>           <b>B</b>      </Btn>
      <Btn active={state.italic}        title="Italic (Ctrl+I)"     onMouseDown={(e) => { e.preventDefault(); onCmd("italic"); }}>         <em>I</em>    </Btn>
      <Btn active={state.underline}     title="Underline (Ctrl+U)"  onMouseDown={(e) => { e.preventDefault(); onCmd("underline"); }}>      <u>U</u>      </Btn>
      <Btn active={state.strikethrough} title="Strikethrough"       onMouseDown={(e) => { e.preventDefault(); onCmd("strikeThrough"); }}>  <s>S</s>      </Btn>

      <Sep />

      {/* ── Text transforms via CSS (execCommand doesn't handle these natively) ── */}
      <Btn title="Uppercase"  onMouseDown={(e) => { e.preventDefault(); wrapSelectionStyle("text-transform", "uppercase"); setTimeout(() => onCmd(null), 0); }}>AA</Btn>
      <Btn title="Lowercase"  onMouseDown={(e) => { e.preventDefault(); wrapSelectionStyle("text-transform", "lowercase"); setTimeout(() => onCmd(null), 0); }}>aa</Btn>
      <Btn title="Capitalise" onMouseDown={(e) => { e.preventDefault(); wrapSelectionStyle("text-transform", "capitalize"); setTimeout(() => onCmd(null), 0); }}>Aa</Btn>

      <Sep />

      {/* ── Alignment ── */}
      <Btn active={state.align === "left"}    title="Align Left"    onMouseDown={(e) => { e.preventDefault(); onCmd("justifyLeft"); }}>   ⬅ </Btn>
      <Btn active={state.align === "center"}  title="Centre"        onMouseDown={(e) => { e.preventDefault(); onCmd("justifyCenter"); }}> ↔ </Btn>
      <Btn active={state.align === "right"}   title="Align Right"   onMouseDown={(e) => { e.preventDefault(); onCmd("justifyRight"); }}>  ➡ </Btn>
      <Btn active={state.align === "justify"} title="Justify"       onMouseDown={(e) => { e.preventDefault(); onCmd("justifyFull"); }}>   ☰ </Btn>

      <Sep />

      {/* ── Lists ── */}
      <Btn active={state.unorderedList} title="Bullet list"   onMouseDown={(e) => { e.preventDefault(); onCmd("insertUnorderedList"); }}> • </Btn>
      <Btn active={state.orderedList}   title="Numbered list" onMouseDown={(e) => { e.preventDefault(); onCmd("insertOrderedList"); }}>   1. </Btn>

      <Sep />

      {/* ── Text colour ── */}
      <label
        title="Text colour"
        onMouseDown={(e) => { e.stopPropagation(); onSaveRange?.(); }}
        style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "pointer", padding: "2px" }}
      >
        <span style={{ display: "block", width: 16, height: 16, borderRadius: 3, background: colorVal, border: "1.5px solid rgba(255,255,255,0.25)", pointerEvents: "none" }} />
        <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 2 }}>A</span>
        <input
          type="color"
          value={colorVal}
          style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%", border: "none", padding: 0 }}
          onChange={(e) => { setColorVal(e.target.value); onColor(e.target.value); }}
        />
      </label>

      <Sep />

      {/* ── Clear formatting ── */}
      <Btn title="Clear all formatting" onMouseDown={(e) => { e.preventDefault(); onCmd("removeFormat"); }}>
        <span style={{ fontSize: 10 }}>✕</span>
      </Btn>
    </div>
  );
}

// ── Wrap selected text in a span with a CSS property ─────────────────────────
// Used for text-transform (not in execCommand).

function wrapSelectionStyle(prop, value) {
  const sel = window.getSelection?.();
  if (!sel || !sel.rangeCount || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);

  try {
    const frag = range.extractContents();
    const span  = document.createElement("span");
    span.style[prop] = value;
    span.appendChild(frag);
    range.insertNode(span);
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.removeAllRanges();
    sel.addRange(newRange);
  } catch {
    // Cross-element selections can throw; ignore
  }
}

// ── UI primitives ─────────────────────────────────────────────────────────────

function Btn({ active, title, onMouseDown, children }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={onMouseDown}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        minWidth: 26, height: 26, padding: "0 4px",
        border: "none", borderRadius: 5, cursor: "pointer", fontSize: 13, lineHeight: 1,
        background: active ? "rgba(99,102,241,0.35)" : "transparent",
        color:      active ? "#a5b4fc" : "#cbd5e1",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span style={{ width: 1, height: 18, background: "rgba(148,163,184,0.18)", margin: "0 3px", flexShrink: 0, display: "inline-block" }} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const TOOLBAR_WRAP = {
  position: "absolute",
  bottom: "100%",
  left: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  flexWrap: "nowrap",
  gap: 1,
  padding: "4px 8px",
  marginBottom: 4,
  background: "#1e293b",
  border: "1px solid rgba(148,163,184,0.22)",
  borderRadius: 10,
  boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
  overflowX: "auto",
  maxWidth: "min(98vw, 900px)",
  userSelect: "none",
  whiteSpace: "nowrap",
};

const SELECT_STYLE = {
  height: 26, padding: "2px 4px",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: 5, color: "#e2e8f0", fontSize: 12,
  outline: "none", cursor: "pointer",
};

const NUM_INPUT_STYLE = {
  width: 48, height: 26, padding: "2px 4px",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: 5, color: "#e2e8f0", fontSize: 12,
  outline: "none", textAlign: "center",
};
