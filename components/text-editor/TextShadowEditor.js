// TextShadowEditor — controls for text shadow, glow, and text outline/stroke.
//
// Props:
//   shadow   ShadowDef | null
//   glow     GlowDef   | null
//   outline  OutlineDef| null
//   onChange ({ shadow, glow, outline }) => void

import { useState } from "react";

const ROW = { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 };
const LABEL = { fontSize: 12, color: "#94a3b8", minWidth: 70 };
const NUM_INPUT = {
  width: 52, padding: "3px 6px", background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(148,163,184,0.2)", borderRadius: 6,
  color: "#e2e8f0", fontSize: 12, outline: "none", textAlign: "right",
};
const SECTION_TITLE = {
  fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
  textTransform: "uppercase", color: "#64748b",
  display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
};

const DEFAULT_SHADOW  = { x: 2,  y: 2,  blur: 4,  spread: 0, color: "rgba(0,0,0,0.5)" };
const DEFAULT_GLOW    = { color: "#a855f7", blur: 16, intensity: 1 };
const DEFAULT_OUTLINE = { width: 2, color: "#ffffff", blur: 0 };

export default function TextShadowEditor({ shadow, glow, outline, onChange }) {
  const emit = (patch) => {
    onChange?.({ shadow, glow, outline, ...patch });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Shadow ── */}
      <div>
        <div style={SECTION_TITLE}>
          <ToggleSwitch
            checked={!!shadow}
            onChange={on => emit({ shadow: on ? DEFAULT_SHADOW : null })}
          />
          Text Shadow
        </div>

        {shadow && (
          <div style={{ paddingLeft: 4 }}>
            <ShadowRow label="X offset" value={shadow.x}
              onChange={v => emit({ shadow: { ...shadow, x: v } })} min={-100} max={100} />
            <ShadowRow label="Y offset" value={shadow.y}
              onChange={v => emit({ shadow: { ...shadow, y: v } })} min={-100} max={100} />
            <ShadowRow label="Blur" value={shadow.blur}
              onChange={v => emit({ shadow: { ...shadow, blur: v } })} min={0} max={80} />
            <ShadowRow label="Spread" value={shadow.spread ?? 0}
              onChange={v => emit({ shadow: { ...shadow, spread: v } })} min={0} max={40} />
            <div style={ROW}>
              <span style={LABEL}>Colour</span>
              <input type="color"
                value={rgbaToHex(shadow.color || "rgba(0,0,0,0.5)")}
                onChange={e => emit({ shadow: { ...shadow, color: e.target.value } })}
                style={{ width: 32, height: 24, border: "none", borderRadius: 4, cursor: "pointer", padding: 0 }}
              />
              <input type="text" value={shadow.color}
                onChange={e => emit({ shadow: { ...shadow, color: e.target.value } })}
                style={{ ...NUM_INPUT, width: 120, textAlign: "left" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Glow ── */}
      <div>
        <div style={SECTION_TITLE}>
          <ToggleSwitch
            checked={!!glow}
            onChange={on => emit({ glow: on ? DEFAULT_GLOW : null })}
          />
          Text Glow
        </div>

        {glow && (
          <div style={{ paddingLeft: 4 }}>
            <div style={ROW}>
              <span style={LABEL}>Colour</span>
              <input type="color"
                value={glow.color || "#ffffff"}
                onChange={e => emit({ glow: { ...glow, color: e.target.value } })}
                style={{ width: 32, height: 24, border: "none", borderRadius: 4, cursor: "pointer", padding: 0 }}
              />
              <input type="text" value={glow.color}
                onChange={e => emit({ glow: { ...glow, color: e.target.value } })}
                style={{ ...NUM_INPUT, width: 100, textAlign: "left" }}
              />
            </div>
            <ShadowRow label="Blur radius" value={glow.blur}
              onChange={v => emit({ glow: { ...glow, blur: v } })} min={2} max={80} />
            <ShadowRow label="Intensity" value={glow.intensity ?? 1}
              onChange={v => emit({ glow: { ...glow, intensity: v } })} min={1} max={3} step={0.5} />
          </div>
        )}
      </div>

      {/* ── Outline / stroke ── */}
      <div>
        <div style={SECTION_TITLE}>
          <ToggleSwitch
            checked={!!outline}
            onChange={on => emit({ outline: on ? DEFAULT_OUTLINE : null })}
          />
          Text Outline
        </div>

        {outline && (
          <div style={{ paddingLeft: 4 }}>
            <ShadowRow label="Width" value={outline.width}
              onChange={v => emit({ outline: { ...outline, width: v } })} min={1} max={20} />
            <div style={ROW}>
              <span style={LABEL}>Colour</span>
              <input type="color"
                value={outline.color || "#ffffff"}
                onChange={e => emit({ outline: { ...outline, color: e.target.value } })}
                style={{ width: 32, height: 24, border: "none", borderRadius: 4, cursor: "pointer", padding: 0 }}
              />
              <input type="text" value={outline.color}
                onChange={e => emit({ outline: { ...outline, color: e.target.value } })}
                style={{ ...NUM_INPUT, width: 100, textAlign: "left" }}
              />
            </div>
            <ShadowRow label="Blur (soft)" value={outline.blur ?? 0}
              onChange={v => emit({ outline: { ...outline, blur: v } })} min={0} max={20} />
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              Blur = 0 is a solid stroke. Blur &gt; 0 gives a soft glow outline.
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

// ── Slider + number row ───────────────────────────────────────────────────────

function ShadowRow({ label, value, onChange, min = -100, max = 100, step = 1 }) {
  return (
    <div style={ROW}>
      <span style={LABEL}>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value ?? 0}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex: 1 }}
      />
      <input
        type="number" min={min} max={max} step={step}
        value={value ?? 0}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={NUM_INPUT}
      />
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 28, height: 16, borderRadius: 99, border: "none", cursor: "pointer", padding: 0,
        background: checked ? "#6366f1" : "rgba(148,163,184,0.3)",
        position: "relative", flexShrink: 0, transition: "background 0.2s",
      }}
    >
      <span style={{
        position: "absolute", top: 2, borderRadius: "50%",
        width: 12, height: 12, background: "#ffffff",
        left: checked ? 14 : 2,
        transition: "left 0.2s",
      }} />
    </button>
  );
}

// ── Colour utilities ──────────────────────────────────────────────────────────

function rgbaToHex(rgba) {
  if (!rgba) return "#000000";
  if (rgba.startsWith("#")) return rgba;
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return "#000000";
  const [, r, g, b] = match;
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function toHex(n) {
  return parseInt(n).toString(16).padStart(2, "0");
}
