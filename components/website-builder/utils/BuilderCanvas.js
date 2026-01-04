// /components/website-builder/utils/BuilderCanvas.js
// FULL REPLACEMENT — drag/drop actually works (compat fixes)
// ✅ Sets BOTH "application/gr8builder" AND "text/plain" for compatibility
// ✅ Drop zones highlight on drag over
// ✅ Drag existing blocks from the preview area too (not just the list)

import { useState } from "react";
import BlockRenderer from "../blocks/BlockRenderer";

export default function BuilderCanvas({
  site,
  theme,
  canvasWidth,
  selectedId,
  onSelect,
  onRemoveSelected,
  resolveBlockBackground,
  onInsertNewBlockAt,
  onMoveBlockTo,
}) {
  const blocks = site?.blocks || [];
  const [overIndex, setOverIndex] = useState(null);

  function parseTransfer(e) {
    try {
      const raw = e.dataTransfer.getData("application/gr8builder");
      if (raw) return JSON.parse(raw);
    } catch {}
    // fallback: plain text URL from image drag
    try {
      const t = e.dataTransfer.getData("text/plain");
      if (t && /^https?:\/\//.test(t)) return { kind: "new_image", url: t };
      if (t && t.startsWith("data:image/")) return { kind: "new_image", url: t };
    } catch {}
    return null;
  }

  function onDragOverZone(index, e) {
    e.preventDefault();
    setOverIndex(index);
    e.dataTransfer.dropEffect = "move";
  }

  function onDragLeaveZone() {
    setOverIndex(null);
  }

  function dropAt(index, e) {
    e.preventDefault();
    setOverIndex(null);
    const payload = parseTransfer(e);
    if (!payload) return;

    if (payload.kind === "new" && payload.type) {
      onInsertNewBlockAt?.(payload.type, index);
      return;
    }
    if (payload.kind === "new_image" && payload.url) {
      onInsertNewBlockAt?.("image", index, {
        type: "image",
        caption: "Image",
        src: payload.url,
        fit: "cover",
        background: { mode: "transparent" },
      });
      return;
    }
    if (payload.kind === "move" && payload.id) {
      onMoveBlockTo?.(payload.id, index);
      return;
    }
  }

  function setMovePayload(id, e) {
    try {
      e.dataTransfer.setData("application/gr8builder", JSON.stringify({ kind: "move", id }));
      e.dataTransfer.setData("text/plain", `move:${id}`);
      e.dataTransfer.effectAllowed = "move";
    } catch {}
  }

  return (
    <div style={styles.panel}>
      <div style={styles.panelTitle}>Canvas (Landing width: {canvasWidth}px)</div>

      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        {blocks.map((b) => {
          const isSel = b.id === selectedId;
          return (
            <div
              key={b.id}
              style={{
                ...styles.row,
                borderColor: isSel ? "rgba(34,151,197,0.8)" : "rgba(255,255,255,0.12)",
              }}
            >
              <button style={styles.pick} onClick={() => onSelect?.(b.id)} title="Select">
                {b.type}
              </button>

              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div
                  draggable
                  onDragStart={(e) => setMovePayload(b.id, e)}
                  title="Drag to reorder"
                  style={styles.dragHandle}
                >
                  ⇅
                </div>

                <button
                  style={{ ...styles.iconBtn, ...styles.danger }}
                  onClick={() => isSel && onRemoveSelected?.()}
                  disabled={!isSel}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={styles.centerScroll}>
        <div style={{ width: canvasWidth, margin: "0 auto" }}>
          <div style={styles.canvasShell}>
            <div style={styles.canvasTop}>
              <div style={styles.canvasTitle}>{site?.brand?.siteName || "Site"}</div>
              <div style={styles.canvasSub}>Drag blocks/images into the drop zones</div>
            </div>

            <div style={{ padding: 18 }}>
              <DropZone
                index={0}
                active={overIndex === 0}
                onDragOver={(e) => onDragOverZone(0, e)}
                onDragLeave={onDragLeaveZone}
                onDrop={(e) => dropAt(0, e)}
              />

              {blocks.map((b, i) => {
                const bg = resolveBlockBackground?.(b.background, theme) || "transparent";
                const isSel = b.id === selectedId;

                return (
                  <div key={b.id} style={{ marginBottom: 12 }}>
                    <div
                      draggable
                      onDragStart={(e) => setMovePayload(b.id, e)}
                      onClick={() => onSelect?.(b.id)}
                      style={{
                        borderRadius: 16,
                        border: isSel
                          ? "2px solid rgba(34,151,197,0.75)"
                          : "1px solid rgba(255,255,255,0.08)",
                        overflow: "hidden",
                        cursor: "pointer",
                      }}
                      title="Click to edit • Drag to move"
                    >
                      <BlockRenderer block={b} theme={theme} resolvedBackground={bg} />
                    </div>

                    <DropZone
                      index={i + 1}
                      active={overIndex === i + 1}
                      onDragOver={(e) => onDragOverZone(i + 1, e)}
                      onDragLeave={onDragLeaveZone}
                      onDrop={(e) => dropAt(i + 1, e)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DropZone({ index, active, onDragOver, onDragLeave, onDrop }) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        ...styles.dropZone,
        border: active ? "2px dashed rgba(34,151,197,0.75)" : styles.dropZone.border,
        background: active ? "rgba(34,151,197,0.10)" : styles.dropZone.background,
      }}
      data-index={index}
      title="Drop here"
    >
      <div style={styles.dropLine} />
      <div style={styles.dropText}>Drop here</div>
      <div style={styles.dropLine} />
    </div>
  );
}

const styles = {
  panel: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 12,
    height: "calc(100vh - 140px)",
    minHeight: 520,
    display: "flex",
    flexDirection: "column",
  },
  panelTitle: { color: "white", fontWeight: 950, marginBottom: 10 },

  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.20)",
  },
  pick: {
    background: "transparent",
    border: "none",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
    textTransform: "capitalize",
  },

  dragHandle: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "white",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "grab",
    userSelect: "none",
  },

  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  },
  danger: { background: "rgba(244,63,94,0.18)", border: "1px solid rgba(244,63,94,0.35)" },

  centerScroll: { flex: 1, minHeight: 0, overflow: "auto", padding: 10 },

  canvasShell: {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.20)",
    overflow: "hidden",
  },
  canvasTop: {
    padding: 14,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  canvasTitle: { color: "white", fontWeight: 950, fontSize: 14 },
  canvasSub: { color: "rgba(255,255,255,0.65)", fontWeight: 850, fontSize: 12 },

  dropZone: {
    height: 34,
    borderRadius: 12,
    border: "1px dashed rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.03)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    margin: "10px 0",
  },
  dropLine: { height: 1, width: 90, background: "rgba(255,255,255,0.20)" },
  dropText: {
    color: "rgba(255,255,255,0.60)",
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
};
