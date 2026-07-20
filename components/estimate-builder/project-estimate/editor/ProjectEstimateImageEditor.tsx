// @ts-nocheck
export default function ProjectEstimateImageEditor({ object, onReplace, onUpload, onMediaLibrary, onPatchStyle, onDelete, onRestoreDefault }: any) {
  if (!object || !["image", "logo"].includes(object.type)) return null;
  const style = object.style || {};
  return (
    <section style={styles.panel}>
      <button type="button" style={styles.primary} onClick={onReplace}>Replace Image</button>
      <button type="button" style={styles.button} onClick={onUpload}>Upload Image</button>
      <button type="button" style={styles.button} onClick={onMediaLibrary}>Media Library</button>
      <label style={styles.label}>Fit
        <select style={styles.input} value={style.objectFit || "cover"} onChange={(event) => onPatchStyle?.({ objectFit: event.target.value })}>
          <option value="cover">Fill</option>
          <option value="contain">Fit</option>
          <option value="fill">Stretch</option>
        </select>
      </label>
      <label style={styles.label}>Zoom
        <input type="number" style={styles.input} value={style.zoom || 100} onChange={(event) => onPatchStyle?.({ zoom: Number(event.target.value) || 100 })} />
      </label>
      <label style={styles.label}>Focal X
        <input type="number" style={styles.input} value={style.objectPositionX ?? 50} onChange={(event) => onPatchStyle?.({ objectPositionX: Number(event.target.value) || 50 })} />
      </label>
      <label style={styles.label}>Focal Y
        <input type="number" style={styles.input} value={style.objectPositionY ?? 50} onChange={(event) => onPatchStyle?.({ objectPositionY: Number(event.target.value) || 50 })} />
      </label>
      <button type="button" style={styles.button} onClick={onRestoreDefault}>Restore Default</button>
      <button type="button" style={styles.danger} onClick={onDelete}>Delete</button>
    </section>
  );
}

const styles = {
  panel: { display: "grid", gap: 8 },
  label: { display: "grid", gap: 4, fontSize: 12, fontWeight: 900, color: "#475569" },
  input: { height: 34, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0 8px", background: "#ffffff", color: "#0f172a" },
  primary: { height: 34, border: "1px solid #0369a1", background: "#0284c7", color: "#ffffff", borderRadius: 6, padding: "0 10px", fontWeight: 900, cursor: "pointer" },
  button: { height: 34, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f172a", borderRadius: 6, padding: "0 10px", fontWeight: 800, cursor: "pointer" },
  danger: { height: 34, border: "1px solid #fecaca", background: "#fff1f2", color: "#be123c", borderRadius: 6, padding: "0 10px", fontWeight: 800, cursor: "pointer" },
};
