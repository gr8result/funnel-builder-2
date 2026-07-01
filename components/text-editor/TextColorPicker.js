// TextColorPicker — solid colour + gradient text picker with recently-used swatches.
//
// Props:
//   color       string           — current solid colour (#hex / rgb)
//   gradient    GradientDef|null — current gradient (see TextStyleSchema)
//   onChange    ({ color, gradient }) => void
//   label       string           — e.g. "Text Colour"

import { useState, useRef, useEffect, useCallback } from "react";
import { getRecentColors, addRecentColor } from "../../hooks/useSavedTextStyles";
import { buildGradientCss } from "../../lib/text-editor/adapters/webHtmlAdapter";

const PRESETS = [
  "#ffffff", "#f8fafc", "#e2e8f0", "#94a3b8", "#64748b", "#334155", "#1e293b", "#0f172a",
  "#fef2f2", "#fee2e2", "#fca5a5", "#ef4444", "#dc2626", "#991b1b",
  "#fff7ed", "#fed7aa", "#fdba74", "#f97316", "#ea580c",
  "#fefce8", "#fef08a", "#fde047", "#eab308", "#ca8a04",
  "#f0fdf4", "#bbf7d0", "#86efac", "#22c55e", "#16a34a",
  "#ecfdf5", "#a7f3d0", "#6ee7b7", "#10b981", "#059669",
  "#f0f9ff", "#bae6fd", "#7dd3fc", "#0ea5e9", "#0284c7",
  "#eff6ff", "#bfdbfe", "#93c5fd", "#3b82f6", "#2563eb",
  "#f5f3ff", "#ddd6fe", "#c4b5fd", "#a855f7", "#7c3aed",
  "#fdf2f8", "#fbcfe8", "#f9a8d4", "#ec4899", "#db2777",
];

const GRADIENT_PRESETS = [
  { stops: [{ color: "#667eea", position: 0 }, { color: "#764ba2", position: 100 }], angle: 135, type: "linear" },
  { stops: [{ color: "#f093fb", position: 0 }, { color: "#f5576c", position: 100 }], angle: 135, type: "linear" },
  { stops: [{ color: "#4facfe", position: 0 }, { color: "#00f2fe", position: 100 }], angle: 135, type: "linear" },
  { stops: [{ color: "#43e97b", position: 0 }, { color: "#38f9d7", position: 100 }], angle: 135, type: "linear" },
  { stops: [{ color: "#fa709a", position: 0 }, { color: "#fee140", position: 100 }], angle: 135, type: "linear" },
  { stops: [{ color: "#a18cd1", position: 0 }, { color: "#fbc2eb", position: 100 }], angle: 135, type: "linear" },
  { stops: [{ color: "#ffecd2", position: 0 }, { color: "#fcb69f", position: 100 }], angle: 135, type: "linear" },
  { stops: [{ color: "#ff9a9e", position: 0 }, { color: "#fecfef", position: 50 }, { color: "#feada6", position: 100 }], angle: 90, type: "linear" },
  { stops: [{ color: "#a1c4fd", position: 0 }, { color: "#c2e9fb", position: 100 }], angle: 135, type: "linear" },
  { stops: [{ color: "#fd7043", position: 0 }, { color: "#ffd600", position: 100 }], angle: 135, type: "linear" },
  { stops: [{ color: "#00c9ff", position: 0 }, { color: "#92fe9d", position: 100 }], angle: 135, type: "linear" },
  { stops: [{ color: "#fc466b", position: 0 }, { color: "#3f5efb", position: 100 }], angle: 135, type: "linear" },
];

export default function TextColorPicker({ color = "#000000", gradient = null, onChange, label = "Colour" }) {
  const [tab,       setTab]      = useState(gradient ? "gradient" : "solid");
  const [open,      setOpen]     = useState(false);
  const [localHex,  setLocalHex] = useState(color || "#000000");
  const [localGrad, setLocalGrad]= useState(gradient || GRADIENT_PRESETS[0]);
  const [recentColors, setRecentColors] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => { setRecentColors(getRecentColors()); }, [open]);
  useEffect(() => { setLocalHex(color || "#000000"); }, [color]);
  useEffect(() => { if (gradient) setLocalGrad(gradient); }, [gradient]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (!containerRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const emitSolid = useCallback((hex) => {
    const clean = hex.trim();
    setLocalHex(clean);
    addRecentColor(clean);
    setRecentColors(getRecentColors());
    onChange?.({ color: clean, gradient: null });
  }, [onChange]);

  const emitGradient = useCallback((grad) => {
    setLocalGrad(grad);
    onChange?.({ color: null, gradient: grad });
  }, [onChange]);

  // Preview swatch
  const previewBg = tab === "gradient" && gradient
    ? buildGradientCss(gradient) || color
    : color;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={label}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 8px",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(148,163,184,0.2)",
          borderRadius: 8,
          cursor: "pointer",
          color: "#e2e8f0",
          fontSize: 12,
        }}
      >
        <span style={{
          width: 18, height: 18, borderRadius: 4, border: "1.5px solid rgba(255,255,255,0.15)",
          background: previewBg || "#000",
          display: "block", flexShrink: 0,
        }} />
        <span>{label}</span>
        <span style={{ color: "#64748b", fontSize: 10 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, zIndex: 9999, marginTop: 4,
          background: "#1e293b", border: "1px solid rgba(148,163,184,0.2)",
          borderRadius: 12, boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
          width: 248, padding: 12,
        }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {["solid", "gradient"].map(t => (
              <button key={t} type="button" onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: "4px 0", borderRadius: 6, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600,
                  background: tab === t ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.05)",
                  color:      tab === t ? "#a5b4fc" : "#94a3b8",
                }}>
                {t === "solid" ? "Solid" : "Gradient"}
              </button>
            ))}
          </div>

          {tab === "solid" && (
            <>
              {/* Native colour input */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                <input
                  type="color"
                  value={localHex.startsWith("#") ? localHex : "#000000"}
                  onChange={e => emitSolid(e.target.value)}
                  style={{ width: 36, height: 28, border: "none", borderRadius: 4, cursor: "pointer", padding: 0 }}
                />
                <input
                  type="text"
                  value={localHex}
                  onChange={e => setLocalHex(e.target.value)}
                  onBlur={e => { if (/^#[0-9a-fA-F]{3,8}$/.test(e.target.value)) emitSolid(e.target.value); }}
                  onKeyDown={e => { if (e.key === "Enter") emitSolid(localHex); }}
                  placeholder="#000000"
                  style={{
                    flex: 1, padding: "4px 8px", background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(148,163,184,0.2)", borderRadius: 6,
                    color: "#e2e8f0", fontSize: 12, outline: "none",
                  }}
                />
              </div>

              {/* Recent colours */}
              {recentColors.length > 0 && (
                <>
                  <div style={SECTION_LABEL}>Recent</div>
                  <SwatchGrid colors={recentColors} selected={color} onSelect={emitSolid} />
                </>
              )}

              {/* Presets */}
              <div style={SECTION_LABEL}>Palette</div>
              <SwatchGrid colors={PRESETS} selected={color} onSelect={emitSolid} />
            </>
          )}

          {tab === "gradient" && (
            <>
              <div style={SECTION_LABEL}>Gradient presets</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
                {GRADIENT_PRESETS.map((g, i) => {
                  const css = buildGradientCss(g);
                  const isSelected = gradient && JSON.stringify(gradient.stops) === JSON.stringify(g.stops);
                  return (
                    <button
                      key={i} type="button" onClick={() => emitGradient(g)}
                      style={{
                        width: 28, height: 28, borderRadius: 6, border: isSelected ? "2px solid #a5b4fc" : "1.5px solid rgba(255,255,255,0.1)",
                        background: css, cursor: "pointer", padding: 0,
                      }}
                    />
                  );
                })}
              </div>

              {/* Custom gradient — angle */}
              {localGrad && (
                <div style={{ marginTop: 10 }}>
                  <div style={SECTION_LABEL}>Angle: {localGrad.angle || 135}°</div>
                  <input
                    type="range" min={0} max={360} step={5}
                    value={localGrad.angle || 135}
                    onChange={e => emitGradient({ ...localGrad, angle: Number(e.target.value) })}
                    style={{ width: "100%" }}
                  />

                  {/* Stop colours */}
                  <div style={SECTION_LABEL}>Colour stops</div>
                  {(localGrad.stops || []).map((stop, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                      <input
                        type="color" value={stop.color}
                        onChange={e => {
                          const nextStops = localGrad.stops.map((s, si) =>
                            si === i ? { ...s, color: e.target.value } : s
                          );
                          emitGradient({ ...localGrad, stops: nextStops });
                        }}
                        style={{ width: 28, height: 22, border: "none", borderRadius: 4, padding: 0 }}
                      />
                      <input
                        type="range" min={0} max={100} step={1}
                        value={stop.position ?? 0}
                        onChange={e => {
                          const nextStops = localGrad.stops.map((s, si) =>
                            si === i ? { ...s, position: Number(e.target.value) } : s
                          );
                          emitGradient({ ...localGrad, stops: nextStops });
                        }}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: 10, color: "#64748b", minWidth: 28 }}>{stop.position ?? 0}%</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Swatch grid ───────────────────────────────────────────────────────────────

function SwatchGrid({ colors, selected, onSelect }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 3, marginBottom: 8 }}>
      {colors.map(c => (
        <button
          key={c} type="button" onClick={() => onSelect(c)} title={c}
          style={{
            width: 22, height: 22, borderRadius: 4, border: c === selected ? "2px solid #a5b4fc" : "1.5px solid rgba(255,255,255,0.1)",
            background: c, cursor: "pointer", padding: 0,
          }}
        />
      ))}
    </div>
  );
}

const SECTION_LABEL = {
  fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
  textTransform: "uppercase", color: "#64748b", marginBottom: 4, marginTop: 2,
};
