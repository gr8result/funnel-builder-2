// @ts-nocheck
export default function ProjectEstimateToolbar({
  editMode,
  selectedObject,
  addOpen,
  onToggleAdd,
  onAdd,
  onUndo,
  onRedo,
  onAlign,
  onArrange,
  onLock,
  onDelete,
  onDone,
  onReplaceImage,
  onImageFit,
  onResetImage,
}: any) {
  const isImage = selectedObject && ["image", "logo"].includes(selectedObject.type);
  return (
    <div style={styles.toolbar}>
      <div style={styles.group}>
        <button type="button" style={styles.button} onClick={onToggleAdd}>Add</button>
        {addOpen ? <AddMenu onAdd={onAdd} /> : null}
        <button type="button" style={styles.button} onClick={onUndo}>Undo</button>
        <button type="button" style={styles.button} onClick={onRedo}>Redo</button>
      </div>
      <div style={styles.group}>
        <button type="button" style={styles.button} disabled={!selectedObject} onClick={() => onAlign?.("left")}>Align</button>
        <button type="button" style={styles.button} disabled={!selectedObject} onClick={() => onArrange?.("front")}>Arrange</button>
        <button type="button" style={styles.button} disabled={!selectedObject} onClick={onLock}>Lock</button>
        <button type="button" style={styles.danger} disabled={!selectedObject} onClick={onDelete}>Delete</button>
      </div>
      {isImage ? (
        <div style={styles.group}>
          <button type="button" style={styles.button} onClick={onReplaceImage}>Replace</button>
          <button type="button" style={styles.button} onClick={() => onImageFit?.("crop")}>Crop</button>
          <button type="button" style={styles.button} onClick={() => onImageFit?.("contain")}>Fit</button>
          <button type="button" style={styles.button} onClick={() => onImageFit?.("cover")}>Fill</button>
          <button type="button" style={styles.button} onClick={onResetImage}>Reset</button>
        </div>
      ) : null}
      <button type="button" style={editMode ? styles.primary : styles.button} onClick={onDone}>{editMode ? "Done" : "Edit Page"}</button>
    </div>
  );
}

function AddMenu({ onAdd }: any) {
  const items = [
    ["heading", "Heading"],
    ["text", "Paragraph"],
    ["text_box", "Text box"],
    ["image", "Image"],
    ["logo", "Logo"],
    ["shape", "Shape"],
    ["divider", "Divider"],
    ["quote_field", "Linked job field"],
    ["signature", "Signature"],
    ["spacer", "Spacer"],
    ["container", "Container"],
    ["blank_page", "Blank page"],
  ];
  return (
    <div style={styles.addMenu}>
      {items.map(([type, label]) => (
        <button key={type} type="button" style={styles.addItem} onClick={() => onAdd?.(type)}>{label}</button>
      ))}
    </div>
  );
}

const styles = {
  toolbar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 10, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 8, position: "relative", flexWrap: "wrap" },
  group: { display: "flex", alignItems: "center", gap: 6, position: "relative" },
  button: { height: 34, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f172a", borderRadius: 6, padding: "0 10px", fontWeight: 800, cursor: "pointer" },
  primary: { height: 34, border: "1px solid #0369a1", background: "#0284c7", color: "#ffffff", borderRadius: 6, padding: "0 12px", fontWeight: 900, cursor: "pointer" },
  danger: { height: 34, border: "1px solid #fecaca", background: "#fff1f2", color: "#be123c", borderRadius: 6, padding: "0 10px", fontWeight: 800, cursor: "pointer" },
  addMenu: { position: "absolute", top: 40, left: 0, zIndex: 100, width: 210, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 8, padding: 6, boxShadow: "0 20px 45px rgba(15,23,42,0.18)" },
  addItem: { display: "block", width: "100%", border: 0, background: "transparent", textAlign: "left", padding: "8px 10px", borderRadius: 6, color: "#0f172a", fontWeight: 800, cursor: "pointer" },
};
