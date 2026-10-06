import { ensureReadableColor } from "./colors.js";
import { useState, useEffect } from "react";
import { activeRichTextApi, textVariantStyle } from "./richTextCanvas.jsx";
import { ToolbarSelect, ToolbarColorDropdown } from "./inspectorFields.jsx";
import { TEXT_VARIANT_OPTIONS, FONT_FAMILY_OPTIONS, TEXT_SIZE_OPTIONS, TEXT_COLOR_OPTIONS, HIGHLIGHT_COLOR_OPTIONS } from "./editorOptions.js";

export function TextRibbon({ block, patch, patchCommon, compact = false }) {
  const props = block?.props || {};
  const isRichTextBlock = block?.type === "text";
  const linkField = block?.type === "footer"
    ? null
    : props.linkHref !== undefined
    ? "linkHref"
    : props.href !== undefined
      ? "href"
      : props.ctaHref !== undefined
        ? "ctaHref"
        : props.unsubscribeHref !== undefined
          ? "unsubscribeHref"
          : null;
  const textColorField = props.textColor !== undefined
    ? "textColor"
    : props.buttonTextColor !== undefined
      ? "buttonTextColor"
      : props.ctaTextColor !== undefined
        ? "ctaTextColor"
        : null;
  const alignField = props.align !== undefined ? "align" : null;

  const contrastBg = props.bgColor || props.sectionBgColor || props.blockBgColor || props.overlayBgColor || props.overlayShade || "#ffffff";
  const rawCurrentTextColor = /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(String(props[textColorField] || "")) ? props[textColorField] : "#111827";
  const currentTextColor = ensureReadableColor(rawCurrentTextColor, contrastBg, "#ffffff", "#111827");
  const currentHighlightColor = /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(String(props.highlightColor || "")) ? props.highlightColor : "#fff59d";
  const currentBlockStyle = String(props.variant || "body").toLowerCase();
  const [matchedColors, setMatchedColors] = useState([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("email_matched_colors_v1") || "[]");
      setMatchedColors(Array.isArray(saved) ? saved.slice(0, 12) : []);
    } catch {
      setMatchedColors([]);
    }
  }, []);

  const rememberMatchedColor = (color) => {
    const nextColor = String(color || "").trim();
    if (!nextColor || nextColor === "transparent") return;
    const next = [nextColor, ...matchedColors.filter((entry) => String(entry).toLowerCase() !== nextColor.toLowerCase())].slice(0, 12);
    setMatchedColors(next);
    try {
      localStorage.setItem("email_matched_colors_v1", JSON.stringify(next));
    } catch {}
  };

  const btnStyle = {
    height: 38,
    minWidth: 36,
    borderRadius: 10,
    border: "1px solid #d6b54c",
    background: "#fffef7",
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    padding: "0 10px",
    flexShrink: 0,
    whiteSpace: "nowrap",
    lineHeight: 1,
  };
  const selectStyle = {
    height: 38,
    borderRadius: 10,
    border: "1px solid #d6b54c",
    background: "#fffef7",
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 600,
    padding: "0 10px",
    flexShrink: 0,
  };
  const labelStyle = {
    fontSize: 16,
    fontWeight: 600,
    color: "#854d0e",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    flexShrink: 0,
  };
  const ensureActiveEditor = () => {
    if (activeRichTextApi?.focus) {
      activeRichTextApi.focus();
      return;
    }
    if (typeof document === "undefined" || !block?.id) return;
    const rawId = String(block.id || "");
    const safeId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(rawId) : rawId.replace(/"/g, '\\"');
    const editable = document.querySelector(`[data-block-id="${safeId}"] [data-inline-editor="true"], [data-block-id="${safeId}"] [contenteditable="true"]`);
    editable?.focus?.();
  };
  const press = (action) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    ensureActiveEditor();
    const run = () => action();
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(run);
    } else {
      run();
    }
  };

  const commitHtml = (html, extra = {}) => {
    if (isRichTextBlock && typeof html === "string") {
      patch({ ...extra, html });
    } else if (Object.keys(extra).length) {
      patch(extra);
    }
  };

  const exec = (command, value = null) => {
    const html = activeRichTextApi?.exec?.(command, value);
    commitHtml(html);
  };

  const applyStyle = (styles = {}, extra = {}) => {
    const html = activeRichTextApi?.applyStyle?.(styles);
    commitHtml(html, extra);
  };

  const toggleList = (ordered = false) => {
    const html = activeRichTextApi?.toggleList?.(ordered);
    commitHtml(html);
  };

  const openLink = () => {
    const url = window.prompt("Enter a link URL:", props[linkField] || "https://");
    if (!url) return;
    if (linkField) patch({ [linkField]: url });
    exec("createLink", url);
  };

  const clearLink = () => {
    if (linkField) patch({ [linkField]: "" });
    exec("unlink");
  };

  const applyAlign = (value) => {
    if (alignField) patch({ [alignField]: value });
    applyStyle({ display: "block", textAlign: value });
  };

  const applyTextColor = (value) => {
    if (textColorField) patch({ [textColorField]: value });
    rememberMatchedColor(value);
    applyStyle({ color: value });
  };

  const applyHighlightColor = (value) => {
    const next = value || "transparent";
    rememberMatchedColor(next);
    applyStyle({ backgroundColor: next }, { highlightColor: next });
  };

  const applyFontSize = (value) => {
    const size = Number(value) || 16;
    applyStyle({ fontSize: `${size}px` }, props.fontSize !== undefined ? { fontSize: size } : {});
  };

  const applyFontFamily = (value) => {
    applyStyle({ fontFamily: value }, props.fontFamily !== undefined ? { fontFamily: value } : {});
  };

  const applyBlockFormat = (value) => {
    const nextValue = String(value || "body").toLowerCase();
    const formatMap = {
      body: { tag: "p", variant: "body" },
      headline: { tag: "div", variant: "headline" },
      h1: { tag: "h1", variant: "h1" },
      h2: { tag: "h2", variant: "h2" },
      h3: { tag: "h3", variant: "h3" },
      small: { tag: "p", variant: "small" },
    };
    const nextFormat = formatMap[nextValue] || formatMap.body;
    exec("formatBlock", nextFormat.tag);
    applyStyle(textVariantStyle(nextFormat.variant, props.fontSize || 16), props.variant !== undefined ? { variant: nextFormat.variant } : {});
  };

  return (
    <div className="email-editor-toolbar-scroll" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "nowrap", width: "100%", overflowX: "auto", overflowY: "visible", whiteSpace: "nowrap", position: "relative", zIndex: 2 }}>
      <ToolbarSelect label="Style" value={currentBlockStyle} onChange={applyBlockFormat} options={TEXT_VARIANT_OPTIONS} width={154} beforeAction={ensureActiveEditor} />
      <ToolbarSelect label="Font" value={props.fontFamily || "Arial, Helvetica, sans-serif"} onChange={applyFontFamily} options={FONT_FAMILY_OPTIONS} width={220} beforeAction={ensureActiveEditor} />
      <ToolbarSelect label="Size" value={String(props.fontSize || 16)} onChange={applyFontSize} options={TEXT_SIZE_OPTIONS} width={104} beforeAction={ensureActiveEditor} />
      <button type="button" onMouseDown={press(() => exec("bold"))} style={btnStyle}>B</button>
      <button type="button" onMouseDown={press(() => exec("italic"))} style={btnStyle}>I</button>
      <button type="button" onMouseDown={press(() => exec("underline"))} style={btnStyle}>U</button>
      <button type="button" onMouseDown={press(() => applyAlign("left"))} style={btnStyle}>⟸</button>
      <button type="button" onMouseDown={press(() => applyAlign("center"))} style={btnStyle}>≡</button>
      <button type="button" onMouseDown={press(() => applyAlign("right"))} style={btnStyle}>⟹</button>
      <button type="button" onMouseDown={press(() => toggleList(false))} style={btnStyle}>• List</button>
      <button type="button" onMouseDown={press(() => toggleList(true))} style={btnStyle}>1. List</button>
      <button type="button" onMouseDown={press(() => openLink())} style={btnStyle}>🔗 Link</button>
      <button type="button" onMouseDown={press(() => clearLink())} style={btnStyle}>✕ Link</button>
      <button type="button" onMouseDown={press(() => exec("removeFormat"))} style={btnStyle}>Clear</button>
      <ToolbarColorDropdown label="Text" value={currentTextColor} onChange={applyTextColor} onRemember={rememberMatchedColor} matchedColors={matchedColors} standardColors={TEXT_COLOR_OPTIONS} beforeAction={ensureActiveEditor} />
      <ToolbarColorDropdown label="Highlight" value={currentHighlightColor} onChange={applyHighlightColor} onRemember={rememberMatchedColor} matchedColors={matchedColors} standardColors={HIGHLIGHT_COLOR_OPTIONS} allowTransparent beforeAction={ensureActiveEditor} />
    </div>
  );
}

export function FloatingTextToolbar({ visible, position, onDragStart, onClose, children }) {
  if (!visible) return null;

  return (
    <div
      data-email-text-toolbar="true"
      style={{
        position: "fixed",
        left: position?.x ?? 260,
        top: position?.y ?? 140,
        zIndex: 5000,
        width: "min(calc(100vw - 24px), 1200px)",
        padding: 0,
        borderRadius: 16,
        background: "rgba(254, 243, 199, 0.98)",
        border: "1px solid rgba(217, 119, 6, 0.45)",
        boxShadow: "0 18px 40px rgba(146, 64, 14, 0.20)",
        backdropFilter: "blur(10px)",
        overflow: "visible",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div onMouseDown={onDragStart} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "linear-gradient(180deg, #fef3c7 0%, #fde68a 100%)", borderBottom: "1px solid #f59e0b", cursor: "move", userSelect: "none" }}>
        <button
          type="button"
          onMouseDown={onDragStart}
          style={{
            height: 32,
            minWidth: 74,
            borderRadius: 9,
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#334155",
            fontSize: 16,
            fontWeight: 600,
            cursor: "move",
            padding: "0 12px",
            whiteSpace: "nowrap",
          }}
          title="Move toolbar"
        >
          ⋮⋮ Move
        </button>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Text Toolbar
        </div>
        <div style={{ marginLeft: "auto" }}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose?.();
            }}
            style={{
              height: 32,
              minWidth: 56,
              borderRadius: 9,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
              padding: "0 12px",
              whiteSpace: "nowrap",
            }}
          >
            Hide
          </button>
        </div>
      </div>
      <div className="email-editor-toolbar-scroll" style={{ padding: "12px 12px", overflowX: "auto", overflowY: "visible" }}>
        {children}
      </div>
    </div>
  );
}
