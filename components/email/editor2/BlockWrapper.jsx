import { useState, useCallback } from "react";
import { CANVAS } from "./canvasRenderers.jsx";
import { resolveBlockRadius, defaultBlockRadius } from "./blockModel.js";
import { ToolBtn } from "./editorControls.jsx";

export function BlockWrapper({ block, isSelected, isFirst, isLast, onClick, onTextFocus, onUp, onDown, onDelete, onDuplicate, onSave, uploadForBlock, onDragStart, onDragEnd, onPatch }) {
  const [hov, setHov] = useState(false);
  const Renderer = CANVAS[block.type];
  const showBar = hov || isSelected;
  const blockRadius = resolveBlockRadius(block.props || {}, defaultBlockRadius(block.type));

  const getInteractiveTarget = (target) => {
    if (!(target instanceof Element)) return null;
    return target.closest('[contenteditable="true"], [data-inline-editor="true"], [data-direct-action="true"], button, input, textarea, select, a');
  };

  // onImg: called by canvas renderers when user clicks an img placeholder
  // field: the prop key to set, idx: optional column/item index
  const onImg = useCallback((field, idx = null) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    document.body.appendChild(input);
    input.onchange = e => {
      const f = e.target.files?.[0];
      if (f) uploadForBlock(f, field, idx);
      input.remove();
    };
    input.click();
  }, [uploadForBlock]);

  return (
    <div
      data-block-id={block.id}
      draggable={!isSelected}
      onDragStart={e => {
        if (getInteractiveTarget(e.target)) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onMouseDownCapture={(e) => {
        const interactive = getInteractiveTarget(e.target);
        if (interactive?.matches?.('[contenteditable="true"], [data-inline-editor="true"]')) {
          onTextFocus?.();
          return;
        }
        if (!isSelected && !interactive) onClick?.();
      }}
      onFocusCapture={(e) => {
        const editable = e.target instanceof Element
          ? e.target.closest('[contenteditable="true"], [data-inline-editor="true"]')
          : null;
        if (editable) {
          onTextFocus?.();
        }
      }}
      onClick={(e) => {
        if (getInteractiveTarget(e.target)) return;
        onClick?.();
      }}
      title="Drag to reposition this block"
      style={{
        position: "relative",
        marginBottom: 6,
        borderRadius: Math.max(blockRadius, 8),
        cursor: isSelected ? "default" : "grab",
        outline: isSelected
          ? "2.5px solid #2563eb"
          : hov ? "1.5px solid #94a3b8" : "1.5px solid transparent",
        outlineOffset: 2,
        transition: "outline-color 0.1s",
      }}
    >
      {/* Hover/selected toolbar */}
      {showBar && (
        <div
          style={{
            position: "absolute", top: -34, right: 8,
            display: "flex", gap: 2,
            background: "#1e293b", borderRadius: 6, padding: "3px 4px",
            zIndex: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
          }}
        >
          {!isFirst && <ToolBtn onClick={onUp} title="Move up">↑</ToolBtn>}
          {!isLast && <ToolBtn onClick={onDown} title="Move down">↓</ToolBtn>}
          <ToolBtn onClick={onDuplicate} title="Duplicate">⧉</ToolBtn>
          <ToolBtn onClick={onSave} title="Save block for reuse">⭐</ToolBtn>
          <ToolBtn onClick={onDelete} title="Delete" danger>✕</ToolBtn>
        </div>
      )}

      {/* Block content — allow direct one-click editing while still selecting the block */}
      <div style={{ pointerEvents: "auto", borderRadius: blockRadius, overflow: "hidden" }}>
        {Renderer
          ? <Renderer props={block.props} onImg={onImg} onPatch={onPatch} isSelected={isSelected} />
          : <div style={{ padding: 16, background: "#fef2f2", color: "#ef4444", borderRadius: 6 }}>Unknown block: {block.type}</div>
        }
      </div>
    </div>
  );
}
