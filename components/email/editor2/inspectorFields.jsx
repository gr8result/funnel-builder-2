import { useState, useEffect, useRef } from "react";
import { COLOR_PRESETS } from "./editorOptions.js";
import { parseColorToRgb, rgbToHex, parseAlphaFromColor, composeOverlayColor } from "./colors.js";
import { clamp } from "./editorUtils.js";

export function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: "#056dff", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      {children}
    </div>
  );
}

export function InlineEditHint({ children }) {
  return (
    <div style={{ margin: "-2px 0 12px", fontSize: 16, fontWeight: 600, color: "#64748b", lineHeight: 1.5 }}>
      {children}
    </div>
  );
}

const INSPECTOR_INPUT_STYLE = {
  width: "100%",
  minHeight: 38,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "0 12px",
  fontSize: 16,
  fontWeight: 600,
  color: "#0f172a",
  background: "#ffffff",
  boxSizing: "border-box",
  colorScheme: "light",
  WebkitTextFillColor: "#0f172a",
};

const INSPECTOR_TEXTAREA_STYLE = {
  ...INSPECTOR_INPUT_STYLE,
  minHeight: 110,
  padding: "10px 12px",
  resize: "vertical",
  lineHeight: 1.5,
};

const INSPECTOR_SELECT_STYLE = {
  ...INSPECTOR_INPUT_STYLE,
  minHeight: 42,
  padding: "8px 12px",
  background: "#fffef7",
  border: "1px solid #d6b54c",
  cursor: "pointer",
  lineHeight: 1.3,
  whiteSpace: "normal",
};

export function TxtIn({ value, onChange, placeholder = "", type = "text", dark = false }) {
  return (
    <input
      type={type} value={value ?? ""} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ ...INSPECTOR_INPUT_STYLE, border: dark ? "1px solid #2563eb" : INSPECTOR_INPUT_STYLE.border, background: "#ffffff", color: "#0f172a", WebkitTextFillColor: "#0f172a" }}
    />
  );
}

function TxtArea({ value, onChange, rows = 5 }) {
  return (
    <textarea
      value={value ?? ""} onChange={e => onChange(e.target.value)} rows={rows}
      style={INSPECTOR_TEXTAREA_STYLE}
    />
  );
}

export function ColIn({ value, onChange, allowTransparent = false }) {
  const current = value || "#000000";
  const swatchValue = /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(String(current || "")) ? current : "#000000";
  const [matchedColors, setMatchedColors] = useState([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("email_matched_colors_v1") || "[]");
      setMatchedColors(Array.isArray(saved) ? saved.slice(0, 12) : []);
    } catch {
      setMatchedColors([]);
    }
  }, []);

  const rememberColor = (color) => {
    const nextColor = String(color || "").trim();
    if (!nextColor) return;
    const next = [nextColor, ...matchedColors.filter((entry) => String(entry).toLowerCase() !== nextColor.toLowerCase())].slice(0, 12);
    setMatchedColors(next);
    try {
      localStorage.setItem("email_matched_colors_v1", JSON.stringify(next));
    } catch {}
  };

  const applyColor = (color) => {
    onChange(color);
    rememberColor(color);
  };

  const matchColour = async () => {
    if (typeof window !== "undefined" && "EyeDropper" in window) {
      try {
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) applyColor(result.sRGBHex);
        return;
      } catch {}
    }

    const typed = window.prompt("Paste a colour value to match:", String(current || "#000000"));
    if (typed) applyColor(typed);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="color"
          value={swatchValue}
          onChange={e => applyColor(e.target.value)}
          style={{ width: 34, height: 34, border: "1px solid #cbd5e1", borderRadius: 6, padding: 2, cursor: "pointer", flexShrink: 0, background: "#fff" }}
        />
        <input
          type="text"
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          style={{ ...INSPECTOR_INPUT_STYLE, flex: 1 }}
        />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={matchColour}
          style={{ height: 32, padding: "0 10px", border: "1px solid #2563eb", borderRadius: 8, background: "#eff6ff", color: "#1d4ed8", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
        >
          🎯 Match Colour
        </button>
        {allowTransparent && (
          <button
            type="button"
            onClick={() => applyColor("transparent")}
            style={{ height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 8, background: "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)", color: "#334155", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
          >
            Transparent
          </button>
        )}
        <button
          type="button"
          onClick={() => rememberColor(current)}
          style={{ height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", color: "#334155", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
        >
          ★ Save Colour
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {COLOR_PRESETS.map((color) => {
          const isActive = String(current).toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              onClick={() => applyColor(color)}
              title={color}
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: isActive ? "3px solid #2563eb" : color === "#ffffff" ? "1px solid #94a3b8" : "1px solid rgba(15,23,42,0.18)",
                background: color,
                cursor: "pointer",
                boxShadow: isActive ? "0 0 0 2px rgba(37,99,235,0.18)" : "none",
                padding: 0,
              }}
            />
          );
        })}
      </div>
      {matchedColors.length > 0 && (
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Matched Colours</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {matchedColors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => applyColor(color)}
                title={color}
                style={{ height: 28, minWidth: 28, padding: "0 8px", borderRadius: 999, border: "1px solid rgba(15,23,42,0.14)", background: color, cursor: "pointer" }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SlideIn({ value, onChange, min = 0, max = 100, unit = "%" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <input className="email-editor-range" type="range" min={min} max={max} value={value ?? min} onChange={e => onChange(Number(e.target.value))} style={{ flex: 1 }} />
      <span style={{ minWidth: 44, fontSize: 16, fontWeight: 600, color: "#0f172a", textAlign: "right" }}>{value ?? min}{unit}</span>
    </div>
  );
}

export function OverlayColorField({ value, onChange }) {
  const rgb = parseColorToRgb(value) || { r: 15, g: 23, b: 42 };
  const hex = rgbToHex(rgb);
  const opacity = parseAlphaFromColor(value, 0.38);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <ColIn value={hex} onChange={(next) => onChange(composeOverlayColor(next, opacity))} allowTransparent />
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Opacity</div>
        <SlideIn value={Math.round(opacity * 100)} onChange={(next) => onChange(composeOverlayColor(hex, next / 100))} min={0} max={100} unit="%" />
      </div>
    </div>
  );
}

export function NumIn({ value, onChange, min = 0, max = 9999, unit = "px", step = 1 }) {
  const [draft, setDraft] = useState(String(value ?? ""));

  useEffect(() => {
    setDraft(String(value ?? ""));
  }, [value]);

  const commit = (raw) => {
    if (raw === "" || raw == null) {
      const safe = clamp(Number(min), min, max);
      setDraft(String(safe));
      onChange(safe);
      return;
    }
    const num = Number(raw);
    if (!Number.isFinite(num)) {
      setDraft(String(value ?? min));
      return;
    }
    const safe = clamp(num, min, max);
    setDraft(String(safe));
    onChange(safe);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        style={{ ...INSPECTOR_INPUT_STYLE, flex: 1 }}
      />
      <span style={{ minWidth: 34, fontSize: 16, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>{unit}</span>
    </div>
  );
}

export function SelIn({ value, onChange, options }) {
  const selected = options.find((opt) => String(opt.value) === String(value ?? "")) || options[0];
  const resolvedValue = String(selected?.value ?? "");

  return (
    <select
      className="email-editor-select"
      value={resolvedValue}
      onChange={e => onChange(e.target.value)}
      style={INSPECTOR_SELECT_STYLE}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} style={{ color: "#0f172a", background: "#fffef7", whiteSpace: "normal" }}>{opt.label}</option>
      ))}
    </select>
  );
}

export function ToolbarSelect({ label, value, onChange, options, width = 180, beforeAction }) {
  const selectRef = useRef(null);
  const selected = options.find((opt) => String(opt.value) === String(value ?? "")) || options[0];
  const resolvedValue = String(selected?.value ?? "");
  const selectedLabel = selected?.label || "";

  const openPicker = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    beforeAction?.();
    const control = selectRef.current;
    if (!control) return;
    control.focus?.();
    if (typeof control.showPicker === "function") {
      control.showPicker();
      return;
    }
    control.click?.();
  };

  return (
    <label data-direct-action="true" style={{ display: "flex", flexDirection: "column", gap: 4, width, minWidth: width, flexShrink: 0 }}>
      <span style={{ fontSize: 16, fontWeight: 600, color: "#854d0e", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <div style={{ position: "relative", width: "100%", height: 34 }}>
        <button
          type="button"
          onMouseDown={openPicker}
          data-direct-action="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            width: "100%",
            minHeight: 38,
            padding: "8px 34px 8px 10px",
            border: "1px solid #d6b54c",
            borderRadius: 10,
            background: "#fffef7",
            color: "#0f172a",
            fontSize: 16,
            fontWeight: 600,
            boxSizing: "border-box",
            cursor: "pointer",
            overflow: "hidden",
            whiteSpace: "normal",
            textOverflow: "ellipsis",
            lineHeight: 1.25,
            textAlign: "left",
          }}
        >
          {selectedLabel}
          <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "#854d0e" }}>▼</span>
        </button>
        <select
          ref={selectRef}
          className="email-editor-select"
          value={resolvedValue}
          aria-label={label}
          onChange={(e) => {
            const next = e.target.value;
            const run = () => onChange(next);
            if (typeof window !== "undefined") {
              window.requestAnimationFrame(run);
            } else {
              run();
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 1,
            height: 1,
            border: 0,
            padding: 0,
            margin: 0,
            background: "transparent",
            color: "transparent",
            fontSize: 16,
            fontWeight: 600,
            boxSizing: "border-box",
            cursor: "default",
            WebkitTextFillColor: "transparent",
            colorScheme: "light",
            opacity: 0,
            pointerEvents: "none",
            appearance: "none",
            WebkitAppearance: "none",
          }}
          tabIndex={-1}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ color: "#0f172a", background: "#fffef7" }}>{opt.label}</option>
          ))}
        </select>
      </div>
    </label>
  );
}

export function ToolbarColorDropdown({ label, value, onChange, matchedColors = [], standardColors = [], onRemember, allowTransparent = false, beforeAction }) {
  const current = String(value || (allowTransparent ? "transparent" : "#111827"));
  const quickColors = [...new Set([...(allowTransparent ? ["transparent"] : []), ...matchedColors, ...standardColors])].slice(0, 12);

  const applyColor = (color) => {
    beforeAction?.();
    const run = () => {
      onChange(color);
      onRemember?.(color);
    };
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(run);
    } else {
      run();
    }
  };

  return (
    <div data-direct-action="true" style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 168, flexShrink: 0 }}>
      <span style={{ fontSize: 16, fontWeight: 600, color: "#854d0e", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 34 }}>
        <span style={{ width: 18, height: 18, borderRadius: 999, border: "1px solid rgba(15,23,42,0.18)", background: current === "transparent" ? "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)" : current, flexShrink: 0 }} />
        <input
          type="color"
          value={current === "transparent" ? "#fff59d" : current}
          onChange={(e) => applyColor(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          style={{ width: 34, height: 34, border: "1px solid #d6b54c", borderRadius: 8, background: "#fffef7", padding: 2, cursor: "pointer" }}
        />
        {allowTransparent && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              applyColor("transparent");
            }}
            style={{ height: 34, padding: "0 10px", border: "1px solid #d6b54c", borderRadius: 8, background: "#fff", color: "#0f172a", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
          >
            No fill
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {quickColors.map((color) => {
          const active = String(current).toLowerCase() === String(color).toLowerCase();
          return (
            <button
              key={color}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                applyColor(color);
              }}
              title={color === "transparent" ? "No highlight" : color}
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                border: active ? "2px solid #0f172a" : "1px solid rgba(15,23,42,0.18)",
                background: color === "transparent" ? "linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 46%, #ef4444 54%, #ffffff 55%, #ffffff 100%)" : color,
                cursor: "pointer",
                padding: 0,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function ImgField({ label, value, onUpload, onClear, onEdit, onLibrary, onAiImage }) {
  const ref = useRef();
  const handlePress = (fn) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    fn?.();
  };

  return (
    <Field label={label}>
      {value && (
        <div style={{ marginBottom: 8 }}>
          <img src={value} alt="" style={{ maxWidth: "100%", height: "auto", borderRadius: 4, display: "block", marginBottom: 6 }} />
          <div style={{ display: "flex", gap: 8, marginBottom: 2 }}>
            <button type="button" onMouseDown={handlePress(onClear)} style={{ fontSize: 16, fontWeight: 600, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}>✕ Remove</button>
            {onEdit && (
              <button type="button" onMouseDown={handlePress(onEdit)} style={{ fontSize: 16, fontWeight: 600, color: "#6366f1", background: "none", border: "none", cursor: "pointer", padding: 0 }}>✏️ Crop / Remove BG</button>
            )}
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" onMouseDown={handlePress(() => ref.current?.click())}
          style={{ flex: 1, height: 36, border: "1px dashed #94a3b8", borderRadius: 6, background: "#f8fafc", color: "#475569", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
          {value ? "Replace" : "⬆ Upload"}
        </button>
        {onLibrary && (
          <button type="button" onMouseDown={handlePress(onLibrary)}
            style={{ height: 36, padding: "0 12px", border: "1px solid #6366f1", borderRadius: 6, background: "#eef2ff", color: "#4f46e5", fontSize: 16, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            🗂️ Library
          </button>
        )}
        {onAiImage && (
          <button type="button" onMouseDown={handlePress(onAiImage)}
            style={{ height: 36, padding: "0 12px", border: "1px solid #7c3aed", borderRadius: 6, background: "#ede9fe", color: "#7c3aed", fontSize: 16, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            ✨ AI
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onUpload(f); }} />
    </Field>
  );
}
