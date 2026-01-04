import { sectionStyle, editableStyle } from "./_blockStyles";

export default function FeaturesBlock({ block, theme, onUpdateProps }) {
  const p = block.props || {};
  const items = Array.isArray(p.items) ? p.items : [];

  return (
    <section style={sectionStyle(block, theme)}>
      <h2
        contentEditable
        suppressContentEditableWarning
        style={{
          ...editableStyle(theme),
          fontSize: 26,
          fontWeight: 950,
          margin: 0,
        }}
        onBlur={(e) => onUpdateProps({ heading: e.currentTarget.textContent || "" })}
      >
        {p.heading || ""}
      </h2>

      <div style={{ height: 14 }} />

      <div style={styles.grid}>
        {items.map((it, idx) => (
          <div key={idx} style={styles.card}>
            <div
              contentEditable
              suppressContentEditableWarning
              style={{
                ...editableStyle(theme),
                fontWeight: 950,
                fontSize: 16,
                marginBottom: 8,
              }}
              onBlur={(e) => {
                const next = structuredClone(items);
                next[idx].title = e.currentTarget.textContent || "";
                onUpdateProps({ items: next });
              }}
            >
              {it.title}
            </div>

            <div
              contentEditable
              suppressContentEditableWarning
              style={{
                ...editableStyle(theme),
                fontSize: 13,
                lineHeight: 1.6,
                color: theme?.mutedText || "rgba(255,255,255,0.75)",
              }}
              onBlur={(e) => {
                const next = structuredClone(items);
                next[idx].body = e.currentTarget.textContent || "";
                onUpdateProps({ items: next });
              }}
            >
              {it.body}
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 12 }} />

      <button
        style={styles.addBtn}
        onClick={() => {
          const next = structuredClone(items);
          next.push({ title: "New feature", body: "Describe it..." });
          onUpdateProps({ items: next });
        }}
      >
        + Add feature
      </button>
    </section>
  );
}

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  },
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 12,
  },
  addBtn: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "white",
    padding: "10px 12px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
};
