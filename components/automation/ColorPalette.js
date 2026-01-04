// components/automation/ColorPalette.js
export default function ColorPalette({ value, onChange }) {
  const COLORS = [
    "#22c55e", // green
    "#3b82f6", // blue
    "#ef4444", // red
    "#eab308", // yellow
    "#a855f7", // purple
    "#6b7280", // grey/brown
    "#000000", // black
    "#ffffff"  // white
  ];

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
      {COLORS.map((c) => (
        <div
          key={c}
          onClick={() => onChange(c)}
          style={{
            width: 34,
            height: 34,
            borderRadius: 6,
            background: c,
            border: value === c ? "3px solid #fff" : "2px solid #334155",
            cursor: "pointer",
            boxShadow: value === c ? `0 0 10px ${c}` : "none"
          }}
        />
      ))}
    </div>
  );
}
