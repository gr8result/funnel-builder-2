// TextStylePanel — full side-panel exposing every TextStyle property,
// grouped into collapsible sections.
//
// Props:
//   style          TextStyle
//   onChange       (patch) => void
//   mode           "web" | "email" | "canvas"
//   savedStyles    TextStyle[]         — from useSavedTextStyles
//   onSaveStyle    (name) => void
//   onApplyStyle   (style) => void
//   emailWarnings  Warning[]           — from emailInlineStyleAdapter
//   showPreview    boolean

import { useState } from "react";
import FontPicker         from "./FontPicker";
import TextColorPicker    from "./TextColorPicker";
import TextShadowEditor   from "./TextShadowEditor";
import TextStylePreview   from "./TextStylePreview";
import { getAvailableWeights } from "../../lib/text-editor/fontRegistry";
import { summariseWarnings }   from "../../lib/text-editor/adapters/emailInlineStyleAdapter";

// ── Section component ─────────────────────────────────────────────────────────

function Section({ title, icon, defaultOpen = true, badge, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: "1px solid rgba(148,163,184,0.1)" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          padding: "10px 14px", background: "transparent", border: "none",
          cursor: "pointer", color: "#e2e8f0", fontSize: 12, fontWeight: 600,
          letterSpacing: "0.04em",
        }}
      >
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ flex: 1, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 11 }}>{title}</span>
        {badge && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 9, background: "rgba(239,68,68,0.2)", color: "#fca5a5" }}>{badge}</span>}
        <span style={{ color: "#64748b", fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div style={{ padding: "0 14px 14px" }}>{children}</div>}
    </div>
  );
}

// ── Control primitives ────────────────────────────────────────────────────────

const ROW = { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 };
const LABEL = { fontSize: 12, color: "#94a3b8", minWidth: 90, flexShrink: 0 };
const INPUT = {
  flex: 1, padding: "5px 8px",
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: 7, color: "#e2e8f0", fontSize: 12, outline: "none",
};
const SELECT = { ...INPUT };
const NUM = { ...INPUT, maxWidth: 72, textAlign: "right" };
const RANGE_ROW = { ...ROW, alignItems: "center" };

function Row({ label, children }) {
  return <div style={ROW}><span style={LABEL}>{label}</span>{children}</div>;
}

function NumberSlider({ label, value, onChange, min, max, step = 1, unit = "" }) {
  return (
    <div style={RANGE_ROW}>
      <span style={LABEL}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value ?? 0}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex: 1 }} />
      <input type="number" min={min} max={max} step={step}
        value={value ?? 0}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{ ...NUM, maxWidth: 56 }}
      />
      {unit && <span style={{ fontSize: 11, color: "#64748b", minWidth: 18 }}>{unit}</span>}
    </div>
  );
}

function ToggleGroup({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {options.map(opt => (
        <button key={opt.value} type="button" title={opt.label}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1, padding: "4px 6px", border: "none", borderRadius: 6, cursor: "pointer",
            fontSize: opt.icon ? 14 : 11, fontWeight: 600,
            background: value === opt.value ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)",
            color:      value === opt.value ? "#a5b4fc" : "#94a3b8",
          }}>
          {opt.icon || opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function TextStylePanel({
  style: s = {},
  onChange,
  mode = "web",
  savedStyles = [],
  onSaveStyle,
  onApplyStyle,
  emailWarnings = [],
  showPreview = true,
}) {
  const [saveNameInput, setSaveNameInput] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  const patch = (p) => onChange?.(p);

  const availableWeights = getAvailableWeights(s.fontFamily);
  const warnSummary = summariseWarnings(emailWarnings);

  return (
    <div style={{
      background: "#111827", color: "#e2e8f0",
      display: "flex", flexDirection: "column",
      height: "100%", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ padding: "12px 14px 8px", borderBottom: "1px solid rgba(148,163,184,0.12)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>Text Style</span>
          <ModeChip mode={mode} warnCount={warnSummary.hasErrors ? emailWarnings.filter(w => w.severity === "error").length : 0} />
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>

        {/* Preview */}
        {showPreview && (
          <div style={{ padding: "10px 14px 0" }}>
            <TextStylePreview textStyle={s} mode={mode} />
          </div>
        )}

        {/* ── Typography ── */}
        <Section title="Typography" icon="Aa" defaultOpen={true}>
          <Row label="Font family">
            <FontPicker value={s.fontFamily} onChange={f => patch({ fontFamily: f })} />
          </Row>
          <Row label="Size">
            <input type="number" min={6} max={300} value={s.fontSize || 16}
              onChange={e => patch({ fontSize: parseInt(e.target.value) || 16 })}
              style={NUM}
            />
            <span style={{ color: "#64748b", fontSize: 11 }}>px</span>
          </Row>
          <Row label="Weight">
            <select value={s.fontWeight || 400}
              onChange={e => patch({ fontWeight: Number(e.target.value) })}
              style={SELECT}>
              {(availableWeights.length ? availableWeights : WEIGHTS_ALL).map(w => (
                <option key={w} value={w}>{WEIGHT_NAMES[w] || w}</option>
              ))}
            </select>
          </Row>
          <Row label="Style">
            <ToggleGroup
              value={s.fontStyle || "normal"}
              onChange={v => patch({ fontStyle: v })}
              options={[
                { value: "normal", label: "Normal" },
                { value: "italic", label: "Italic", icon: "𝐼" },
              ]}
            />
          </Row>
          <Row label="Transform">
            <ToggleGroup
              value={s.textTransform || "none"}
              onChange={v => patch({ textTransform: v })}
              options={[
                { value: "none",       label: "None" },
                { value: "uppercase",  label: "AA" },
                { value: "lowercase",  label: "aa" },
                { value: "capitalize", label: "Aa" },
              ]}
            />
          </Row>
          <Row label="Decoration">
            <ToggleGroup
              value={s.textDecoration || "none"}
              onChange={v => patch({ textDecoration: v })}
              options={[
                { value: "none",         label: "—",  icon: "✗" },
                { value: "underline",    label: "U",  icon: "U̲" },
                { value: "line-through", label: "S",  icon: "S̶" },
                { value: "overline",     label: "O̅" },
              ]}
            />
          </Row>
        </Section>

        {/* ── Colour ── */}
        <Section title="Colour" icon="🎨" defaultOpen={true}>
          <Row label="Text colour">
            <TextColorPicker
              color={s.color || "#000000"}
              gradient={s.gradient}
              onChange={({ color, gradient }) => patch({ color: color || s.color, gradient: gradient || null })}
              label="Text colour"
            />
          </Row>
          <NumberSlider label="Opacity" value={(s.opacity ?? 1) * 100}
            onChange={v => patch({ opacity: v / 100 })}
            min={0} max={100} step={1} unit="%" />
        </Section>

        {/* ── Spacing ── */}
        <Section title="Spacing" icon="↕" defaultOpen={false}>
          <NumberSlider label="Line height" value={s.lineHeight ?? 1.5}
            onChange={v => patch({ lineHeight: v })} min={0.5} max={4} step={0.05} />
          <NumberSlider label="Letter spacing" value={(s.letterSpacing || 0) * 100}
            onChange={v => patch({ letterSpacing: v / 100 })} min={-10} max={50} step={0.5} unit="em/100" />
          <NumberSlider label="Word spacing" value={s.wordSpacing || 0}
            onChange={v => patch({ wordSpacing: v })} min={0} max={40} step={0.5} unit="px" />
          <NumberSlider label="Paragraph gap" value={s.paragraphSpacing || 0}
            onChange={v => patch({ paragraphSpacing: v })} min={0} max={80} unit="px" />
        </Section>

        {/* ── Alignment ── */}
        <Section title="Alignment" icon="☰" defaultOpen={false}>
          <Row label="Horizontal">
            <ToggleGroup
              value={s.textAlign || "left"}
              onChange={v => patch({ textAlign: v })}
              options={[
                { value: "left",    icon: "⬅" },
                { value: "center",  icon: "↔" },
                { value: "right",   icon: "➡" },
                { value: "justify", icon: "☰" },
              ]}
            />
          </Row>
          {mode !== "email" && (
            <Row label="Vertical">
              <ToggleGroup
                value={s.verticalAlign || "top"}
                onChange={v => patch({ verticalAlign: v })}
                options={[
                  { value: "top",    label: "Top" },
                  { value: "middle", label: "Mid" },
                  { value: "bottom", label: "Bot" },
                ]}
              />
            </Row>
          )}
        </Section>

        {/* ── Background & Padding ── */}
        <Section title="Background" icon="▭" defaultOpen={false}>
          <Row label="Bg colour">
            <TextColorPicker
              color={s.background?.color || ""}
              gradient={null}
              onChange={({ color }) => patch({
                background: color ? { color, opacity: s.background?.opacity ?? 1 } : null
              })}
              label="Background"
            />
            {s.background && (
              <button type="button" onClick={() => patch({ background: null })}
                style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 11, padding: "2px 4px" }}>
                ✕
              </button>
            )}
          </Row>
          {s.background && (
            <NumberSlider label="Bg opacity" value={(s.background?.opacity ?? 1) * 100}
              onChange={v => patch({ background: { ...(s.background||{}), opacity: v / 100 } })}
              min={0} max={100} step={1} unit="%" />
          )}
          <Row label="Border radius">
            <input type="number" min={0} max={999} value={s.borderRadius || 0}
              onChange={e => patch({ borderRadius: parseInt(e.target.value) || 0 })}
              style={NUM} />
            <span style={{ color: "#64748b", fontSize: 11 }}>px</span>
          </Row>
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>Padding (px)</div>
            <PaddingControl value={s.padding} onChange={v => patch({ padding: v })} />
          </div>
        </Section>

        {/* ── Effects ── */}
        <Section title="Effects" icon="✨" defaultOpen={false}>
          <TextShadowEditor
            shadow={s.shadow}
            glow={s.glow}
            outline={s.outline}
            onChange={({ shadow, glow, outline }) => patch({ shadow, glow, outline })}
          />
        </Section>

        {/* ── Responsive (web only) ── */}
        {mode === "web" && (
          <Section title="Responsive" icon="📱" defaultOpen={false}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
              Override styles for smaller viewports.
            </div>
            <ResponsiveOverrideBlock
              label="Tablet (≤1024px)"
              value={s.responsive?.tablet}
              onChange={v => patch({ responsive: { ...(s.responsive||{}), tablet: v } })}
            />
            <ResponsiveOverrideBlock
              label="Mobile (≤640px)"
              value={s.responsive?.mobile}
              onChange={v => patch({ responsive: { ...(s.responsive||{}), mobile: v } })}
            />
          </Section>
        )}

        {/* ── Email warnings ── */}
        {mode === "email" && emailWarnings.length > 0 && (
          <Section title="Email Compatibility" icon="📧"
            defaultOpen={warnSummary.hasErrors}
            badge={warnSummary.hasErrors ? `${emailWarnings.filter(w=>w.severity==="error").length} issues` : undefined}>
            {emailWarnings.map((w, i) => (
              <div key={i} style={{
                display: "flex", gap: 6, marginBottom: 6, padding: "5px 8px",
                borderRadius: 7,
                background: w.severity === "error" ? "rgba(239,68,68,0.1)" :
                            w.severity === "warn"  ? "rgba(245,158,11,0.1)" : "rgba(14,165,233,0.07)",
                borderLeft: `2px solid ${w.severity === "error" ? "#ef4444" : w.severity === "warn" ? "#f59e0b" : "#0ea5e9"}`,
              }}>
                <span style={{ fontSize: 12, flexShrink: 0 }}>
                  {w.severity === "error" ? "❌" : w.severity === "warn" ? "⚠️" : "ℹ️"}
                </span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#cbd5e1" }}>{w.property}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>{w.message}</div>
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* ── Saved styles ── */}
        <Section title="Style Library" icon="📚" defaultOpen={false}>
          {/* Apply a saved style */}
          {savedStyles.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>Apply a preset</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {savedStyles.map(saved => (
                  <button key={saved._id} type="button"
                    onClick={() => onApplyStyle?.(saved)}
                    title={`Apply "${saved._name}"`}
                    style={{
                      padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(148,163,184,0.2)",
                      background: "rgba(255,255,255,0.05)", color: "#cbd5e1", fontSize: 11, cursor: "pointer",
                    }}>
                    {saved._name}
                    {saved._builtIn && <span style={{ marginLeft: 3, color: "#64748b", fontSize: 9 }}>●</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Save current style */}
          {!showSaveInput ? (
            <button type="button" onClick={() => setShowSaveInput(true)}
              style={{
                width: "100%", padding: "6px 10px", borderRadius: 7,
                border: "1px dashed rgba(148,163,184,0.25)",
                background: "transparent", color: "#64748b", fontSize: 12, cursor: "pointer",
              }}>
              + Save current style
            </button>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <input type="text" placeholder="Style name…" value={saveNameInput}
                onChange={e => setSaveNameInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && saveNameInput.trim()) {
                    onSaveStyle?.(saveNameInput.trim());
                    setSaveNameInput(""); setShowSaveInput(false);
                  }
                  if (e.key === "Escape") { setSaveNameInput(""); setShowSaveInput(false); }
                }}
                style={{ ...INPUT, flex: 1 }}
                autoFocus
              />
              <button type="button"
                onClick={() => {
                  if (saveNameInput.trim()) {
                    onSaveStyle?.(saveNameInput.trim());
                    setSaveNameInput(""); setShowSaveInput(false);
                  }
                }}
                style={{ padding: "4px 10px", borderRadius: 7, border: "none", background: "#6366f1", color: "#fff", fontSize: 12, cursor: "pointer" }}>
                Save
              </button>
            </div>
          )}
        </Section>

      </div>
    </div>
  );
}

// ── Padding control (4 sides) ─────────────────────────────────────────────────

function PaddingControl({ value, onChange }) {
  const p = value || { top: 0, right: 0, bottom: 0, left: 0 };
  const [linked, setLinked] = useState(true);

  const setAll = (v) => onChange({ top: v, right: v, bottom: v, left: v });
  const set = (side, v) => onChange({ ...p, [side]: v });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
      {["top","right","bottom","left"].map(side => (
        <div key={side} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, color: "#64748b", minWidth: 34 }}>{side}</span>
          <input type="number" min={0} max={200} value={p[side] || 0}
            onChange={e => {
              const v = parseInt(e.target.value) || 0;
              linked ? setAll(v) : set(side, v);
            }}
            style={{ ...NUM, maxWidth: 50 }}
          />
        </div>
      ))}
      <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 6 }}>
        <input type="checkbox" checked={linked} onChange={e => setLinked(e.target.checked)} id="pad-link" />
        <label htmlFor="pad-link" style={{ fontSize: 11, color: "#64748b", cursor: "pointer" }}>Link all sides</label>
      </div>
    </div>
  );
}

// ── Responsive override mini editor ──────────────────────────────────────────

function ResponsiveOverrideBlock({ label, value, onChange }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <button type="button"
          onClick={() => {
            if (value) { onChange(null); setExpanded(false); }
            else { onChange({ fontSize: null }); setExpanded(true); }
          }}
          style={{
            padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(148,163,184,0.2)",
            background: value ? "rgba(99,102,241,0.2)" : "transparent",
            color: value ? "#a5b4fc" : "#64748b", fontSize: 11, cursor: "pointer",
          }}>
          {value ? "✓ Active" : "Enable"}
        </button>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>{label}</span>
        {value && (
          <button type="button" onClick={() => setExpanded(e => !e)}
            style={{ marginLeft: "auto", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 10 }}>
            {expanded ? "▲" : "▼"}
          </button>
        )}
      </div>
      {value && expanded && (
        <div style={{ paddingLeft: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ ...LABEL, minWidth: 60 }}>Font size</span>
            <input type="number" min={6} max={200} value={value.fontSize || ""}
              placeholder="inherit"
              onChange={e => onChange({ ...value, fontSize: parseInt(e.target.value) || null })}
              style={{ ...NUM, maxWidth: 60 }} />
            <span style={{ color: "#64748b", fontSize: 11 }}>px</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ ...LABEL, minWidth: 60 }}>Align</span>
            <select value={value.textAlign || ""}
              onChange={e => onChange({ ...value, textAlign: e.target.value || null })}
              style={{ ...SELECT, maxWidth: 90 }}>
              <option value="">inherit</option>
              <option>left</option><option>center</option><option>right</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ ...LABEL, minWidth: 60 }}>Line height</span>
            <input type="number" min={0.5} max={4} step={0.1} value={value.lineHeight || ""}
              placeholder="inherit"
              onChange={e => onChange({ ...value, lineHeight: parseFloat(e.target.value) || null })}
              style={{ ...NUM, maxWidth: 60 }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WEIGHTS_ALL = [100,200,300,400,500,600,700,800,900];
const WEIGHT_NAMES = {
  100:"Thin", 200:"Extra Light", 300:"Light", 400:"Regular",
  500:"Medium", 600:"Semi Bold", 700:"Bold", 800:"Extra Bold", 900:"Black",
};

function ModeChip({ mode, warnCount }) {
  const META = {
    web:    { label: "Web",    bg: "rgba(14,165,233,0.15)",  color: "#38bdf8" },
    email:  { label: "Email",  bg: "rgba(245,158,11,0.15)",  color: "#fbbf24" },
    canvas: { label: "Canvas", bg: "rgba(168,85,247,0.15)",  color: "#c084fc" },
  };
  const m = META[mode] || META.web;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ padding: "2px 7px", borderRadius: 9, background: m.bg, color: m.color, fontSize: 10, fontWeight: 700 }}>
        {m.label}
      </span>
      {warnCount > 0 && (
        <span style={{ padding: "2px 6px", borderRadius: 9, background: "rgba(239,68,68,0.15)", color: "#fca5a5", fontSize: 10, fontWeight: 700 }}>
          {warnCount} ⚠
        </span>
      )}
    </div>
  );
}
