import { useEffect, useState } from "react";

const FONT_SIZES = [12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64, 72, 78, 86, 94, 128];

export default function TextEditSidePanel({ editor, selected }) {
  const [styles, setStyles] = useState({});

  useEffect(() => {
    if (!selected) return;
    const s = selected.getStyle ? selected.getStyle() : {};
    setStyles({
      fontSize: parseInt(s["font-size"]) || 18,
      fontWeight: s["font-weight"] || "400",
      color: s.color || "#000000",
      background: s["background-color"] || "transparent",
      lineHeight: parseFloat(s["line-height"]) || 1.4,
      textAlign: s["text-align"] || "left",
    });
  }, [selected]);

  const apply = (next) => {
    if (!selected) return;
    selected.addStyle(next);
    editor.trigger("change:canvas");
  };

  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <h3 style={{ fontSize: 22, marginBottom: 6 }}>Text settings</h3>

      {/* FONT SIZE */}
      <label>Font size</label>
      <select
        value={styles.fontSize}
        onChange={(e) => {
          const v = parseInt(e.target.value);
          setStyles({ ...styles, fontSize: v });
          apply({ "font-size": `${v}px` });
        }}
        style={select}
      >
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>{s}px</option>
        ))}
      </select>

      {/* FONT WEIGHT */}
      <label>Weight</label>
      <select
        value={styles.fontWeight}
        onChange={(e) => {
          const v = e.target.value;
          setStyles({ ...styles, fontWeight: v });
          apply({ "font-weight": v });
        }}
        style={select}
      >
        <option value="300">Light</option>
        <option value="400">Regular</option>
        <option value="600">Semi-bold</option>
        <option value="700">Bold</option>
      </select>

      {/* LINE HEIGHT */}
      <label>Line height</label>
      <input
        type="range"
        min="1"
        max="2.4"
        step="0.1"
        value={styles.lineHeight}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          setStyles({ ...styles, lineHeight: v });
          apply({ "line-height": v });
        }}
      />

      {/* ALIGNMENT */}
      <label>Alignment</label>
      <div style={{ display: "flex", gap: 8 }}>
        {["left", "center", "right"].map((a) => (
          <button
            key={a}
            onClick={() => apply({ "text-align": a })}
            style={pill(styles.textAlign === a)}
          >
            {a}
          </button>
        ))}
      </div>

      {/* COLORS */}
      <label>Text color</label>
      <input
        type="color"
        value={styles.color}
        onChange={(e) => {
          const v = e.target.value;
          setStyles({ ...styles, color: v });
          apply({ color: v });
        }}
      />

      <label>Background</label>
      <input
        type="color"
        value={styles.background}
        onChange={(e) => {
          const v = e.target.value;
          setStyles({ ...styles, background: v });
          apply({ "background-color": v });
        }}
      />
    </div>
  );
}

const select = {
  padding: "10px",
  borderRadius: 8,
  border: "1px solid #374151",
  background: "#020617",
  color: "#fff",
  fontSize: 16,
};

const pill = (active) => ({
  padding: "6px 12px",
  borderRadius: 999,
  border: active ? "none" : "1px solid #374151",
  background: active ? "#22c55e" : "#020617",
  color: active ? "#020617" : "#e5e7eb",
  cursor: "pointer",
});
