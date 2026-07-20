// @ts-nocheck
import { useRef } from "react";
import GlobalTextEditor from "../../../text-editor/GlobalTextEditor";

export default function ProjectEstimateTextEditor({ object, onStyleChange, onUndo, onRedo }: any) {
  const fontSizeRef = useRef<HTMLInputElement | null>(null);
  const colorRef = useRef<HTMLInputElement | null>(null);
  if (!object || !["text", "richText", "linkedField"].includes(object.type)) return null;
  const applyBridgeStyle = () => {
    onStyleChange?.({
      ...(object.style || {}),
      fontSize: Number(fontSizeRef.current?.value || object.style?.fontSize || 18),
      color: colorRef.current?.value || object.style?.color || "#0f172a",
    });
  };
  return (
    <div data-project-estimate-text-toolbar="true" style={styles.shell}>
      <GlobalTextEditor
        mode="web"
        surface="toolbar"
        value={normaliseStyle(object.style || {})}
        onChange={(nextStyle: any) => onStyleChange?.(nextStyle)}
      />
      <input
        data-project-estimate-style-font-size="true"
        type="number"
        ref={fontSizeRef}
        defaultValue={Number(object.style?.fontSize || 18)}
        onChange={(event) => onStyleChange?.({ ...(object.style || {}), fontSize: Number(event.target.value) || 18 })}
        onInput={(event) => onStyleChange?.({ ...(object.style || {}), fontSize: Number(event.currentTarget.value) || 18 })}
        style={styles.number}
        title="Font size"
      />
      <input
        data-project-estimate-style-color="true"
        type="color"
        ref={colorRef}
        defaultValue={object.style?.color || "#0f172a"}
        onChange={(event) => onStyleChange?.({ ...(object.style || {}), color: event.target.value })}
        onInput={(event) => onStyleChange?.({ ...(object.style || {}), color: event.currentTarget.value })}
        style={styles.color}
        title="Text colour"
      />
      <button type="button" data-project-estimate-apply-text-style="true" style={styles.button} onClick={applyBridgeStyle}>Apply</button>
      <button type="button" style={styles.button} onClick={onUndo}>Undo</button>
      <button type="button" style={styles.button} onClick={onRedo}>Redo</button>
    </div>
  );
}

function normaliseStyle(style: any = {}) {
  return {
    fontFamily: style.fontFamily || "Manrope",
    fontSize: Number(style.fontSize || 18),
    fontWeight: Number(style.fontWeight || 400),
    fontStyle: style.fontStyle || "normal",
    textDecoration: style.textDecoration || "none",
    color: style.color || "#0f172a",
    backgroundColor: style.backgroundColor || "transparent",
    textAlign: style.textAlign || "left",
    lineHeight: Number(style.lineHeight || 1.3),
    letterSpacing: style.letterSpacing ?? 0,
  };
}

const styles = {
  shell: {
    position: "sticky",
    top: 0,
    zIndex: 80,
    display: "flex",
    gap: 6,
    alignItems: "center",
    padding: 6,
    border: "1px solid #cbd5e1",
    background: "#0f172a",
    borderRadius: 8,
    boxShadow: "0 18px 38px rgba(15,23,42,0.22)",
  },
  button: {
    height: 30,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "#e2e8f0",
    borderRadius: 6,
    padding: "0 8px",
    fontWeight: 800,
    cursor: "pointer",
  },
  number: {
    width: 54,
    height: 30,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "#e2e8f0",
    borderRadius: 6,
    padding: "0 6px",
    fontWeight: 800,
  },
  color: {
    width: 34,
    height: 30,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    borderRadius: 6,
    padding: 2,
  },
};
