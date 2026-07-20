// @ts-nocheck
import ProjectEstimateImageEditor from "./ProjectEstimateImageEditor";

export default function ProjectEstimatePropertiesPanel({
  object,
  onPatchFrame,
  onPatchStyle,
  onDuplicate,
  onDelete,
  onToggleLock,
  onToggleHide,
  onReplaceImage,
  onUploadImage,
  onOpenMediaLibrary,
  onRestoreDefaultImage,
}: any) {
  if (!object) return <div style={styles.empty}>Select an element on the page to edit it.</div>;
  const isImage = ["image", "logo"].includes(object.type);
  return (
    <div style={styles.stack}>
      <h3 style={styles.heading}>{object.sourceBlock?.content?.editorLabel || object.id}</h3>
      <div style={styles.grid}>
        <NumberField label="X" value={object.x} onCommit={(value) => onPatchFrame?.({ x: value })} />
        <NumberField label="Y" value={object.y} onCommit={(value) => onPatchFrame?.({ y: value })} />
        <NumberField label="W" value={object.width} onCommit={(value) => onPatchFrame?.({ width: value })} />
        <NumberField label="H" value={object.height} onCommit={(value) => onPatchFrame?.({ height: value })} />
        <NumberField label="Rotate" value={object.rotation || 0} onCommit={(value) => onPatchStyle?.({ rotation: value })} />
        <NumberField label="Opacity" value={object.style?.opacity ?? 1} step="0.05" onCommit={(value) => onPatchStyle?.({ opacity: value })} />
        <NumberField label="Radius" value={object.style?.borderRadius || 0} onCommit={(value) => onPatchStyle?.({ borderRadius: value })} />
        <NumberField label="Padding" value={object.style?.padding || 0} onCommit={(value) => onPatchStyle?.({ padding: value })} />
      </div>
      {object.type === "linkedField" ? (
        <label style={styles.label}>Linked field
          <input style={styles.input} value={object.linkedField || ""} readOnly />
        </label>
      ) : null}
      {isImage ? (
        <ProjectEstimateImageEditor
          object={object}
          onReplace={onReplaceImage}
          onUpload={onUploadImage}
          onMediaLibrary={onOpenMediaLibrary}
          onPatchStyle={onPatchStyle}
          onDelete={onDelete}
          onRestoreDefault={onRestoreDefaultImage}
        />
      ) : null}
      <div style={styles.actions}>
        <button type="button" style={styles.button} onClick={onDuplicate}>Duplicate</button>
        <button type="button" style={styles.button} onClick={onToggleLock}>{object.locked ? "Unlock" : "Lock"}</button>
        <button type="button" style={styles.button} onClick={onToggleHide}>{object.hidden ? "Show" : "Hide"}</button>
        <button type="button" style={styles.danger} onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

function NumberField({ label, value, step = "1", onCommit }: any) {
  return (
    <label style={styles.label}>{label}
      <input
        type="number"
        step={step}
        style={styles.input}
        defaultValue={Number(value || 0)}
        onBlur={(event) => onCommit?.(Number(event.currentTarget.value) || 0)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </label>
  );
}

const styles = {
  stack: { display: "grid", gap: 12 },
  empty: { padding: 14, color: "#64748b", fontWeight: 800 },
  heading: { margin: 0, fontSize: 15, color: "#0f172a" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  label: { display: "grid", gap: 4, fontSize: 12, fontWeight: 900, color: "#475569" },
  input: { height: 34, border: "1px solid #cbd5e1", borderRadius: 6, padding: "0 8px", background: "#ffffff", color: "#0f172a" },
  actions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  button: { height: 34, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f172a", borderRadius: 6, padding: "0 8px", fontWeight: 800, cursor: "pointer" },
  danger: { height: 34, border: "1px solid #fecaca", background: "#fff1f2", color: "#be123c", borderRadius: 6, padding: "0 8px", fontWeight: 800, cursor: "pointer" },
};
