// /components/websiteBuilder/editors/ImageEditor.js
// FULL FILE — REQUIRED (fixes module-not-found)

import { useRef } from "react";

export default function ImageEditor({ block, onChange }) {
  const fileRef = useRef(null);

  return (
    <div style={styles.card}>
      <div style={styles.title}>Image</div>

      <label style={styles.label}>Caption</label>
      <input
        style={styles.input}
        value={block.caption || ""}
        onChange={(e) => onChange({ caption: e.target.value })}
      />

      <label style={styles.label}>Image URL</label>
      <input
        style={styles.input}
        value={block.src || ""}
        onChange={(e) => onChange({ src: e.target.value })}
        placeholder="https://..."
      />

      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button
          style={styles.btn}
          onClick={() => fileRef.current?.click()}
        >
          Upload (local preview)
        </button>

        <button
          style={{ ...styles.btn, ...styles.danger }}
          onClick={() => onChange({ src: "" })}
        >
          Clear
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const url = URL.createObjectURL(f);
          onChange({ src: url });
        }}
      />

      <label style={styles.label}>Fit</label>
      <select
        style={styles.input}
        value={block.fit || "cover"}
        onChange={(e) => onChange({ fit: e.target.value })}
      >
        <option value="cover">Cover</option>
        <option value="contain">Contain</option>
      </select>

      <div style={{ marginTop: 12 }}>
        <div style={styles.previewBox}>
          {block.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.src}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: block.fit || "cover",
              }}
            />
          ) : (
            <div style={styles.previewEmpty}>No image yet</div>
          )}
        </div>
      </div>
    </div>
  );
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
  btn: {
    flex: 1,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: "10px 12px",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  },
  danger: {
    background: "rgba(244,63,94,0.18)",
    border: "1px solid rgba(244,63,94,0.35)",
  },
  previewBox: {
    width: "100%",
    height: 260,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.22)",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  previewEmpty: { color: "rgba(255,255,255,0.6)", fontWeight: 850 },
};
