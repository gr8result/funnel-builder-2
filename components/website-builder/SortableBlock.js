import { useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import BlockRenderer from "./blocks/BlockRenderer";

function isEditableTarget(el) {
  if (!el) return false;
  return !!(
    el.closest?.("[data-editable='true']") ||
    el.closest?.("[contenteditable='true']") ||
    el.closest?.("input, textarea, select, button, a, label")
  );
}

export default function SortableBlock({
  block,
  theme,
  selected,
  onSelect,
  onRemove,
  onDuplicate,
  onUpdateProps,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const style = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.75 : 1,
    }),
    [transform, transition, isDragging]
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        ...styles.shell,
        borderColor: selected
          ? "rgba(34,151,197,0.9)"
          : "rgba(255,255,255,0.10)",
        boxShadow: selected ? "0 0 0 2px rgba(34,151,197,0.35)" : "none",
      }}
      onMouseDown={(e) => {
        if (isEditableTarget(e.target)) return;
        onSelect();
      }}
    >
      <div style={styles.topRow}>
        <div style={styles.left}>
          <button
            type="button"
            style={styles.dragHandle}
            title="Drag to reorder"
            {...attributes}
            {...listeners}
            onMouseDown={(e) => e.stopPropagation()}
          >
            ⋮⋮
          </button>

          <div style={styles.badge}>{(block.preset || "block").toUpperCase()}</div>
        </div>

        <div style={styles.actions}>
          <button
            type="button"
            style={styles.smallBtn}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              onDuplicate();
            }}
          >
            Duplicate
          </button>

          <button
            type="button"
            style={{ ...styles.smallBtn, ...styles.danger }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              onRemove();
            }}
          >
            Delete
          </button>
        </div>
      </div>

      <div style={styles.body}>
        <BlockRenderer
          block={block}
          theme={theme}
          selected={selected}
          onUpdateProps={onUpdateProps}
        />
      </div>
    </div>
  );
}

const styles = {
  shell: {
    width: "100%",
    background: "rgba(0,0,0,0.18)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 14,
    overflow: "hidden",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 10px",
    background: "rgba(255,255,255,0.04)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  left: { display: "flex", gap: 10, alignItems: "center" },
  dragHandle: {
    width: 36,
    height: 28,
    borderRadius: 10,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "rgba(255,255,255,0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "grab",
    userSelect: "none",
    fontWeight: 900,
    letterSpacing: 2,
  },
  badge: {
    fontSize: 11,
    fontWeight: 900,
    color: "rgba(255,255,255,0.8)",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.22)",
    padding: "6px 10px",
    borderRadius: 999,
  },
  actions: { display: "flex", gap: 8 },
  smallBtn: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "white",
    padding: "8px 10px",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  danger: {
    background: "rgba(244,63,94,0.15)",
    border: "1px solid rgba(244,63,94,0.35)",
  },
  body: { padding: 12 },
};
