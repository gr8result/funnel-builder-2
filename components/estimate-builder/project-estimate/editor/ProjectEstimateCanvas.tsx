// @ts-nocheck
import { useEffect, useMemo, useRef } from "react";
import ProjectEstimatePackPage from "../ProjectEstimatePackPage";
import { objectFrame, pageObjectsFromBlocks } from "./projectEstimateObjectModel";

export default function ProjectEstimateCanvas({
  page,
  theme,
  linkedFields,
  Brochure,
  editMode,
  selectedId,
  editingId,
  onSelect,
  onEdit,
  onCommitText,
  onPatchFrame,
  onReplaceImage,
  onObjects,
}: any) {
  const dragRef = useRef<any>(null);
  const objects = useMemo(() => pageObjectsFromBlocks(page), [page]);
  const selected = objects.find((object: any) => object.id === selectedId) || null;
  const blockById = useMemo(() => Object.fromEntries((page.blocks || []).map((block: any) => [block.id, block])), [page.blocks]);

  useEffect(() => {
    onObjects?.(objects);
  }, [objects, onObjects]);

  useEffect(() => {
    function move(event: PointerEvent | MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      event.preventDefault();
      const dx = Number((event as any).clientX || 0) - drag.startX;
      const dy = Number((event as any).clientY || 0) - drag.startY;
      const next = drag.kind === "move"
        ? { ...drag.frame, x: drag.frame.x + dx, y: drag.frame.y + dy }
        : resizeFrame(drag.frame, drag.handle, dx, dy);
      onPatchFrame?.(drag.id, clampFrame(next));
    }
    function up() {
      dragRef.current = null;
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [onPatchFrame]);

  const bridge = {
    editMode,
    selectedBlockId: selectedId,
    editingBlockId: editingId,
    pageId: page.page_type || page.id,
    blockById,
    onSelectBlock: onSelect,
    onEditBlock: onEdit,
    onTextCommit: onCommitText,
    onReplaceImage: (block: any) => onReplaceImage?.(block),
  };

  return (
    <div
      data-project-estimate-editor-frame={page?.page_type || page?.id || ""}
      style={styles.frame}
      onMouseDown={() => editMode && onSelect?.("")}
    >
      <ProjectEstimatePackPage
        page={page}
        theme={theme}
        linkedFields={linkedFields}
        Brochure={Brochure}
        editing={editMode}
        selectedBlockId={selectedId}
        editingBlockId={editingId}
        onSelectBlock={onSelect}
        onEditBlock={onEdit}
        onTextCommit={onCommitText}
        onReplaceImage={onReplaceImage}
        hiddenBlockIds={(page.blocks || []).filter((block: any) => block.design?.hidden).map((block: any) => block.id)}
      />
      {editMode && selected && editingId !== selected.id ? (
        <SelectionBox
          object={selected}
          onStartMove={(event: any) => {
            if (selected.locked) return;
            event.stopPropagation();
            dragRef.current = {
              kind: "move",
              id: selected.id,
              startX: event.clientX,
              startY: event.clientY,
              frame: objectFrame(selected.sourceBlock),
            };
          }}
          onStartResize={(handle: string, event: any) => {
            if (selected.locked) return;
            event.stopPropagation();
            dragRef.current = {
              kind: "resize",
              id: selected.id,
              handle,
              startX: event.clientX,
              startY: event.clientY,
              frame: objectFrame(selected.sourceBlock),
            };
          }}
          onDoubleClick={(event: any) => {
            event.stopPropagation();
            if (["text", "richText", "linkedField"].includes(selected.type)) onEdit?.(selected.id);
            if (["image", "logo"].includes(selected.type)) onReplaceImage?.(selected.sourceBlock);
          }}
        />
      ) : null}
    </div>
  );
}

function SelectionBox({ object, onStartMove, onStartResize, onDoubleClick }: any) {
  const frame = { x: object.x, y: object.y, width: object.width, height: object.height };
  return (
    <div
      data-project-estimate-selection={object.id}
      style={{ ...styles.selection, left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
      onMouseDown={onStartMove}
      onDoubleClick={onDoubleClick}
    >
      {["nw", "ne", "se", "sw", "n", "e", "s", "w"].map((handle) => (
        <span
          key={handle}
          style={{ ...styles.handle, ...handleStyle(handle) }}
          onMouseDown={(event) => onStartResize(handle, event)}
        />
      ))}
    </div>
  );
}

function resizeFrame(frame: any, handle: string, dx: number, dy: number) {
  const next = { ...frame };
  if (handle.includes("e")) next.width += dx;
  if (handle.includes("s")) next.height += dy;
  if (handle.includes("w")) {
    next.x += dx;
    next.width -= dx;
  }
  if (handle.includes("n")) {
    next.y += dy;
    next.height -= dy;
  }
  return next;
}

function clampFrame(frame: any) {
  const width = Math.max(24, Math.min(794, Number(frame.width || 24)));
  const height = Math.max(18, Math.min(1123, Number(frame.height || 18)));
  return {
    x: Math.max(0, Math.min(794 - width, Number(frame.x || 0))),
    y: Math.max(0, Math.min(1123 - height, Number(frame.y || 0))),
    width,
    height,
  };
}

function handleStyle(handle: string) {
  const base: any = {};
  if (handle.includes("n")) base.top = -5;
  if (handle.includes("s")) base.bottom = -5;
  if (handle.includes("w")) base.left = -5;
  if (handle.includes("e")) base.right = -5;
  if (handle === "n" || handle === "s") {
    base.left = "50%";
    base.transform = "translateX(-50%)";
    base.cursor = "ns-resize";
  }
  if (handle === "e" || handle === "w") {
    base.top = "50%";
    base.transform = "translateY(-50%)";
    base.cursor = "ew-resize";
  }
  if (["nw", "se"].includes(handle)) base.cursor = "nwse-resize";
  if (["ne", "sw"].includes(handle)) base.cursor = "nesw-resize";
  return base;
}

const styles = {
  frame: { position: "relative", width: 794, minHeight: 1123, flex: "0 0 auto" },
  selection: { position: "absolute", zIndex: 60, border: "1px solid #38bdf8", boxSizing: "border-box", cursor: "move", background: "rgba(56,189,248,0.01)" },
  handle: { position: "absolute", width: 9, height: 9, border: "1px solid #0369a1", background: "#ffffff", borderRadius: 9, boxShadow: "0 1px 4px rgba(15,23,42,0.25)" },
};
