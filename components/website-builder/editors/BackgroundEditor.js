// /components/websiteBuilder/editors/BackgroundEditor.js
// FULL FILE — REQUIRED (fixes module-not-found)

import { useMemo } from "react";

export default function BackgroundEditor({ value, onChange }) {
  const bg = value || { mode: "transparent" };

  const canShowColor = bg.mode === "solid";
  const canShowGradient = bg.mode === "gradient";

  const presetGradients = useMemo(
    () => [
      "linear-gradient(135deg, rgba(34,151,197,0.22), rgba(0,0,0,0.15))",
      "linear-gradient(135deg, rgba(250,204,21,0.18), rgba(0,0,0,0.18))",
      "linear-gradient(135deg, rgba(244,63,94,0.16), rgba(0,0,0,0.20))",
      "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(0,0,0,0.22))",
    ],
    []
  );

  return (
    <div style={styles.card}>
      <div style={styles.title}>Background</div>

      <div style={styles.row}>
        <button
          style={pill(bg.mode === "transparent")}
          onClick={() => onChange({ mode: "transparent" })}
        >
          Transparent
        </button>
        <button
          style={pill(bg.mode === "theme")}
          onClick={() => onChange({ mode: "theme" })}
        >
          Theme
        </button>
        <button
          style={pill(bg.mode === "solid")}
          onClick={() => onChange({ mode: "solid", color: bg.color || "rgba(255,255,255,0.04)" })}
        >
          Solid
        </button>
        <button
          style={pill(bg.mode === "gradient")}
          onClick={() => onChange({ mode: "gradient", gradient: bg.gradient || presetGradients[0] })}
        >
          Gradient
        </button>
      </div>

      {canShowColor ? (
        <>
          <div style={styles.label}>CSS color</div>
          <input
            style={styles.input}
            value={bg.color || ""}
            onChange={(e) => onChange({ mode: "solid", color: e.target.value })}
            placeholder="e.g. rgba(255,255,255,0.04) or #111827"
          />
        </>
      ) : null}

      {canShowGradient ? (
        <>
          <div style={styles.label}>Gradient</div>
          <select
            style={styles.input}
            value={bg.gradient || presetGradients[0]}
            onChange={(e) => onChange({ mode: "gradient", gradient: e.target.value })}
          >
            {presetGradients.map((g) => (
              <option key={g} value={g}>
                {g.slice(0, 38)}…
              </option>
            ))}
          </select>

          <div style={styles.label}>Custom gradient</div>
          <input
            style={styles.input}
            value={bg.gradient || ""}
            onChange={(e) => onChange({ mode: "gradient", gradient: e.target.value })}
            placeholder="linear-gradient(...)"
          />
        </>
      ) : null}
    </div>
  );
}

function pill(active) {
  return {
    ...styles.pill,
    borderColor: active ? "rgba(34,151,197,0.75)" : "rgba(255,255,255,0.14)",
    background: active ? "rgba(34,151,197,0.18)" : "rgba(255,255,255,0.06)",
  };
}

const styles = {
  card: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.18)",
  },
  title: { color: "white", fontWeight: 950, marginBottom: 10, fontSize: 14 },
  row: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  pill: {
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    color: "white",
    fontWeight: 850,
    cursor: "pointer",
  },
  label: {
    display: "block",
    marginTop: 10,
    marginBottom: 6,
    color: "rgba(255,255,255,0.75)",
    fontWeight: 800,
    fontSize: 13,
  },
  input: {
    width: "100%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    color: "white",
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
  },
};
