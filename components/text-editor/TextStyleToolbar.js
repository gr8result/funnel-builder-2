// TextStyleToolbar — compact floating toolbar for quick text formatting.
// Shows the most-used controls inline; opens the full panel for advanced options.
//
// Props:
//   style       TextStyle
//   onChange    (patch) => void
//   onOpenPanel () => void       — callback to open the full TextStylePanel
//   mode        "web" | "email" | "canvas"
//   position    "top" | "bottom"  — which side the toolbar floats

import { useState, useRef, useEffect } from "react";
import { getFontStack, FONT_REGISTRY }  from "../../lib/text-editor/fontRegistry";
import { getAvailableWeights }           from "../../lib/text-editor/fontRegistry";
import useFontLoader                     from "../../hooks/useFontLoader";

const FONT_SIZES = [10, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96];
const WEIGHTS    = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const ALIGNS     = [
  { value: "left",    icon: "≡", title: "Align left"    },
  { value: "center",  icon: "≡", title: "Align center"  },
  { value: "right",   icon: "≡", title: "Align right"   },
  { value: "justify", icon: "☰", title: "Justify"       },
];

const TOOLBAR_STYLE = {
  display: "inline-flex",
  alignItems: "center",
  gap: 2,
  padding: "4px 6px",
  background: "#1e293b",
  border: "1px solid rgba(148,163,184,0.2)",
  borderRadius: 10,
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
  flexWrap: "nowrap",
  overflowX: "auto",
  userSelect: "none",
};

const DIVIDER = { width: 1, height: 20, background: "rgba(148,163,184,0.15)", margin: "0 4px", flexShrink: 0 };

export default function TextStyleToolbar({ style: s = {}, onChange, onOpenPanel, mode = "web", position = "top" }) {
  useFontLoader(s.fontFamily);

  const patch = (p) => onChange?.(p);

  const isBold      = (s.fontWeight || 400) >= 700;
  const isItalic    = s.fontStyle === "italic";
  const isUnderline = s.textDecoration === "underline";
  const isStrike    = s.textDecoration === "line-through";

  const availableWeights = getAvailableWeights(s.fontFamily);

  return (
    <div style={TOOLBAR_STYLE} onMouseDown={e => e.preventDefault()}>

      {/* Font family — compact name dropdown */}
      <FontFamilyDropdown value={s.fontFamily} onChange={f => patch({ fontFamily: f })} />

      <div style={DIVIDER} />

      {/* Font size */}
      <FontSizeControl value={s.fontSize} onChange={v => patch({ fontSize: v })} />

      <div style={DIVIDER} />

      {/* Weight */}
      <select
        value={s.fontWeight || 400}
        onChange={e => patch({ fontWeight: Number(e.target.value) })}
        title="Font weight"
        style={selectStyle}
      >
        {(availableWeights.length ? availableWeights : WEIGHTS).map(w => (
          <option key={w} value={w}>{WEIGHT_LABELS[w] || w}</option>
        ))}
      </select>

      <div style={DIVIDER} />

      {/* Bold / Italic / Underline / Strikethrough */}
      <ToolBtn active={isBold}      title="Bold"          onClick={() => patch({ fontWeight: isBold ? 400 : 700 })} style={{ fontWeight: 700 }}>B</ToolBtn>
      <ToolBtn active={isItalic}    title="Italic"        onClick={() => patch({ fontStyle: isItalic ? "normal" : "italic" })} style={{ fontStyle: "italic" }}>I</ToolBtn>
      <ToolBtn active={isUnderline} title="Underline"     onClick={() => patch({ textDecoration: isUnderline ? "none" : "underline" })} style={{ textDecoration: "underline" }}>U</ToolBtn>
      <ToolBtn active={isStrike}    title="Strikethrough" onClick={() => patch({ textDecoration: isStrike ? "none" : "line-through" })} style={{ textDecoration: "line-through" }}>S</ToolBtn>

      <div style={DIVIDER} />

      {/* Text transform */}
      <ToolBtn active={s.textTransform === "uppercase"}  title="Uppercase"  onClick={() => patch({ textTransform: s.textTransform === "uppercase"  ? "none" : "uppercase"  })}>AA</ToolBtn>
      <ToolBtn active={s.textTransform === "lowercase"}  title="Lowercase"  onClick={() => patch({ textTransform: s.textTransform === "lowercase"  ? "none" : "lowercase"  })}>aa</ToolBtn>
      <ToolBtn active={s.textTransform === "capitalize"} title="Capitalise" onClick={() => patch({ textTransform: s.textTransform === "capitalize" ? "none" : "capitalize" })}>Aa</ToolBtn>

      <div style={DIVIDER} />

      {/* Alignment */}
      {ALIGNS.map(a => (
        <ToolBtn key={a.value} active={s.textAlign === a.value} title={a.title}
          onClick={() => patch({ textAlign: a.value })}
          style={{ fontSize: a.value === "justify" ? 11 : 14 }}>
          {a.value === "left"    && <AlignIcon type="left" />}
          {a.value === "center"  && <AlignIcon type="center" />}
          {a.value === "right"   && <AlignIcon type="right" />}
          {a.value === "justify" && <AlignIcon type="justify" />}
        </ToolBtn>
      ))}

      <div style={DIVIDER} />

      {/* Colour swatch */}
      <label title="Text colour" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
        <span style={{
          display: "block", width: 16, height: 16, borderRadius: 3,
          background: s.gradient
            ? "linear-gradient(135deg,#f093fb,#f5576c)"
            : (s.color || "#000"),
          border: "1.5px solid rgba(255,255,255,0.2)",
          position: "relative",
        }}>
          <input type="color" value={s.color || "#000000"}
            onChange={e => patch({ color: e.target.value, gradient: null })}
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%", border: "none", padding: 0 }}
          />
        </span>
      </label>

      {/* More / open full panel */}
      {onOpenPanel && (
        <>
          <div style={DIVIDER} />
          <ToolBtn onClick={onOpenPanel} title="Open text style panel" style={{ fontSize: 10, padding: "3px 6px", color: "#818cf8" }}>
            More ›
          </ToolBtn>
        </>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ToolBtn({ active, onClick, title, style: extraStyle = {}, children }) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" onClick={onClick} title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minWidth: 26, height: 26, padding: "0 4px",
        border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13,
        background: active ? "rgba(99,102,241,0.3)" : hover ? "rgba(255,255,255,0.08)" : "transparent",
        color: active ? "#a5b4fc" : "#cbd5e1",
        transition: "background 0.1s",
        flexShrink: 0,
        ...extraStyle,
      }}>
      {children}
    </button>
  );
}

// Compact font family selector (shows only selected font name, native select)
function FontFamilyDropdown({ value, onChange }) {
  return (
    <select
      value={value || "Manrope"}
      onChange={e => onChange(e.target.value)}
      title="Font family"
      style={{ ...selectStyle, maxWidth: 120, fontFamily: getFontStack(value) || "inherit" }}
    >
      {FONT_REGISTRY.map(f => (
        <option key={f.family} value={f.family} style={{ fontFamily: f.stack }}>
          {f.family}
        </option>
      ))}
    </select>
  );
}

// Font size control with increment buttons
function FontSizeControl({ value = 16, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
      <button type="button" onClick={() => onChange(Math.max(6, (value || 16) - 1))}
        style={{ ...miniBtn }}> − </button>
      <input type="number" value={value || 16} min={6} max={300}
        onChange={e => onChange(parseInt(e.target.value) || 16)}
        style={{ ...selectStyle, width: 42, textAlign: "center" }}
      />
      <button type="button" onClick={() => onChange(Math.min(300, (value || 16) + 1))}
        style={{ ...miniBtn }}> + </button>
    </div>
  );
}

// Alignment mini SVG icons
function AlignIcon({ type }) {
  const lines = {
    left:    [[0,3,10,3],[0,6,14,6],[0,9,8,9],[0,12,12,12]],
    center:  [[2,3,12,3],[0,6,14,6],[3,9,11,9],[1,12,13,12]],
    right:   [[4,3,14,3],[0,6,14,6],[6,9,14,9],[2,12,14,12]],
    justify: [[0,3,14,3],[0,6,14,6],[0,9,14,9],[0,12,14,12]],
  }[type] || [];
  return (
    <svg width="14" height="15" viewBox="0 0 14 15" fill="none">
      {lines.map(([x1,y1,x2,y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ))}
    </svg>
  );
}

// ── Shared mini styles ────────────────────────────────────────────────────────

const selectStyle = {
  padding: "3px 4px",
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(148,163,184,0.15)",
  borderRadius: 6,
  color: "#e2e8f0",
  fontSize: 12,
  outline: "none",
  cursor: "pointer",
  height: 26,
};

const miniBtn = {
  width: 18, height: 26, border: "none", borderRadius: 4,
  background: "rgba(255,255,255,0.06)", color: "#94a3b8",
  cursor: "pointer", fontSize: 12, padding: 0,
};

const WEIGHT_LABELS = {
  100: "Thin",
  200: "Extra Light",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semi Bold",
  700: "Bold",
  800: "Extra Bold",
  900: "Black",
};
