// @ts-nocheck
export default function ProjectEstimateLayersPanel({ objects = [], selectedId, onSelect, onReorder, onToggleLock, onToggleHide }: any) {
  const visible = objects.filter((object: any) => !object.hidden).sort((a: any, b: any) => Number(b.zIndex || 0) - Number(a.zIndex || 0));
  return (
    <div style={styles.stack}>
      {visible.length ? visible.map((object: any) => (
        <div key={object.id} style={{ ...styles.row, ...(selectedId === object.id ? styles.active : {}) }}>
          <span style={styles.handle}>::</span>
          <button type="button" style={styles.name} onClick={() => onSelect?.(object.id)}>{object.sourceBlock?.content?.editorLabel || object.id}</button>
          <button type="button" title="Move up" style={styles.icon} onClick={() => onReorder?.(object.id, 1)}>Up</button>
          <button type="button" title="Visible" style={styles.icon} onClick={() => onToggleHide?.(object.id)}>{object.hidden ? "Show" : "Hide"}</button>
          <button type="button" title="Lock" style={styles.icon} onClick={() => onToggleLock?.(object.id)}>{object.locked ? "Unlock" : "Lock"}</button>
        </div>
      )) : <div style={styles.empty}>No visible elements.</div>}
    </div>
  );
}

const styles = {
  stack: { display: "grid", gap: 6 },
  row: { display: "grid", gridTemplateColumns: "18px 1fr auto auto auto", gap: 6, alignItems: "center", border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 6, padding: 6 },
  active: { borderColor: "#38bdf8", background: "#f0f9ff" },
  handle: { color: "#94a3b8", fontWeight: 900, fontSize: 11 },
  name: { border: 0, background: "transparent", textAlign: "left", color: "#0f172a", fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" },
  icon: { height: 26, border: "1px solid #cbd5e1", background: "#f8fafc", borderRadius: 5, color: "#334155", fontSize: 11, fontWeight: 800, cursor: "pointer" },
  empty: { padding: 12, color: "#64748b", fontWeight: 800 },
};
