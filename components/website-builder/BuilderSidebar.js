import { PRESETS } from "./builderPresets";

export default function BuilderSidebar({ onAdd }) {
  return (
    <aside style={styles.aside}>
      <div style={styles.header}>
        <div style={styles.title}>Blocks</div>
        <div style={styles.sub}>Click to add</div>
      </div>

      <div style={styles.list}>
        {PRESETS.map((p) => (
          <button key={p.key} style={styles.blockBtn} onClick={() => onAdd(p.key)}>
            <div style={styles.blockLabel}>{p.label}</div>
            <div style={styles.blockHint}>Add</div>
          </button>
        ))}
      </div>

      <div style={styles.note}>
        Tip: Drag blocks in the canvas to reorder. Click a block to edit on the
        right.
      </div>
    </aside>
  );
}

const styles = {
  aside: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    overflow: "hidden",
    minHeight: "78vh",
  },
  header: {
    padding: 12,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(0,0,0,0.12)",
  },
  title: { color: "white", fontWeight: 900, fontSize: 16 },
  sub: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 },
  list: { padding: 10, display: "grid", gap: 8 },
  blockBtn: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "white",
    padding: "12px 12px",
    borderRadius: 12,
    cursor: "pointer",
  },
  blockLabel: { fontSize: 14, fontWeight: 800 },
  blockHint: {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.8,
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.18)",
  },
  note: {
    padding: 12,
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
};
