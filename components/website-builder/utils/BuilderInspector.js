// /components/website-builder/utils/BuilderInspector.js
// FULL REPLACEMENT — right panel opens the correct editor module
// ✅ Image -> ImageEditor
// ✅ Everything else -> TextEditor (your existing editor handles hero/text/features/cta/footer inputs)
// ✅ BackgroundEditor always shown when a block is selected

import TextEditor from "../editors/TextEditor";
import ImageEditor from "../editors/ImageEditor";
import BackgroundEditor from "../editors/BackgroundEditor";

export default function BuilderInspector({ site, setSite, selected, updateSelected }) {
  return (
    <div style={styles.panel}>
      <div style={styles.panelTitle}>Inspector</div>

      <label style={styles.label}>Site name</label>
      <input
        style={styles.input}
        value={site?.brand?.siteName || ""}
        onChange={(e) => setSite({ ...site, brand: { ...(site.brand || {}), siteName: e.target.value } })}
      />

      <label style={styles.label}>Brand name</label>
      <input
        style={styles.input}
        value={site?.brand?.brandName || ""}
        onChange={(e) => setSite({ ...site, brand: { ...(site.brand || {}), brandName: e.target.value } })}
      />

      {!selected ? (
        <div style={styles.muted}>Select a block to edit.</div>
      ) : (
        <>
          {selected.type === "image" ? (
            <ImageEditor block={selected} onChange={updateSelected} />
          ) : (
            <TextEditor block={selected} onChange={updateSelected} />
          )}

          <BackgroundEditor
            value={selected.background}
            onChange={(bg) => updateSelected({ background: bg })}
          />
        </>
      )}
    </div>
  );
}

const styles = {
  panel: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 12,
  },
  panelTitle: { color: "white", fontWeight: 950, marginBottom: 10 },

  label: { display: "block", marginTop: 10, marginBottom: 6, color: "rgba(255,255,255,0.75)", fontWeight: 800, fontSize: 14 },
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
  muted: { marginTop: 10, color: "rgba(255,255,255,0.65)", fontWeight: 800 },
};
