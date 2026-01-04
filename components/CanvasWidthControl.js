export default function CanvasWidthControl({ width, setWidth }) {
  const presets = [680, 800, 920, 1040, 1200];

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span style={{ fontWeight: 700 }}>Canvas Width:</span>

      <select
        value={width}
        onChange={(e) => setWidth(Number(e.target.value))}
        style={{ padding: "6px 10px", fontSize: 16 }}
      >
        {presets.map((w) => (
          <option key={w} value={w}>
            {w}px
          </option>
        ))}
        <option value={width}>Custom</option>
      </select>

      <input
        type="number"
        value={width}
        onChange={(e) => setWidth(Number(e.target.value))}
        style={{ width: 80, padding: "6px", fontSize: 16 }}
      />
    </div>
  );
}
