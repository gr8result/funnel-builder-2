import React, { useEffect, useRef } from "react";
import { resolveDynamicText } from "../fields/workbookFieldResolver.js";

export function ObjectRenderer({
  object,
  selected = false,
  workbook = null,
  editing = false,
  textEditing = false,
  onSelect,
  onResize,
  onTextEditStart,
  onTextCommit,
}) {
  const textEditRef = useRef(null);
  useEffect(() => {
    if (!textEditing || !textEditRef.current) return;
    const element = textEditRef.current;
    element.focus();
    const selection = window.getSelection?.();
    if (!selection) return;
    const range = window.document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }, [textEditing]);

  if (!object || object.visible === false) return null;
  const style = {
    position: "absolute",
    left: object.x,
    top: object.y,
    width: object.width,
    height: object.height,
    opacity: object.opacity,
    transform: `rotate(${object.rotation || 0}deg)`,
    transformOrigin: "center center",
    zIndex: object.layer,
    boxSizing: "border-box",
    cursor: editing && !object.locked ? "move" : "default",
    outline: editing && selected ? "2px solid #2563eb" : "none",
    ...baseObjectStyle(object),
  };

  return (
    <div
      data-document-object-id={object.id}
      data-document-object-name={object.name || object.type}
      data-document-object-type={object.type}
      style={style}
      onMouseDown={(event) => editing ? onSelect?.(object.id, event) : undefined}
      onDoubleClick={(event) => {
        if (!editing || object.locked || !["text", "dynamicField"].includes(object.type)) return;
        event.stopPropagation();
        onTextEditStart?.(object.id);
      }}
    >
      {editing && selected ? <ElementBadge object={object} /> : null}
      {renderObjectContent(object, workbook, { editing, textEditing, textEditRef, onTextCommit })}
      {editing && selected && !textEditing ? <ResizeHandles object={object} onResize={onResize} /> : null}
    </div>
  );
}

function renderObjectContent(object, workbook, editor = {}) {
  if (object.type === "text" || object.type === "dynamicField") {
    const text = resolveDynamicText(object.data?.text || "", workbook);
    const activationHidden = object.data?.overlayMode === "pptx-text-activation" && !object.data?.edited && !editor.textEditing;
    return (
      <div
        contentEditable={editor.editing && editor.textEditing && !object.locked}
        suppressContentEditableWarning
        spellCheck
        ref={editor.textEditRef}
        style={{
          whiteSpace: "pre-wrap",
          width: "100%",
          height: "100%",
          outline: "none",
          cursor: editor.editing ? "text" : "inherit",
          color: activationHidden ? "transparent" : "inherit",
          userSelect: activationHidden ? "none" : undefined,
        }}
        onMouseDown={(event) => {
          if (editor.textEditing) event.stopPropagation();
        }}
        onBlur={(event) => editor.onTextCommit?.(object.id, event.currentTarget.innerText)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          event.stopPropagation();
        }}
      >
        {text}
      </div>
    );
  }
  if (object.type === "image" || object.type === "logo") {
    const activationHidden = object.data?.overlayMode === "pptx-image-activation" && !object.data?.edited;
    return object.data?.imageRef ? (
      <img src={object.data.imageRef} alt={object.data.alt || ""} style={{ width: "100%", height: "100%", objectFit: object.style?.objectFit || "cover", borderRadius: object.style?.borderRadius || 0, opacity: activationHidden ? 0 : 1 }} />
    ) : (
      <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "#f3f4f6", color: "#6b7280" }}>Image</div>
    );
  }
  if (object.type === "divider") {
    return <div style={{ width: "100%", height: object.style?.thickness || object.height, background: object.style?.color || "#111827" }} />;
  }
  if (object.type === "table") {
    return <div style={{ width: "100%", height: "100%", border: `1px solid ${object.style?.borderColor || "#d1d5db"}` }}>Table</div>;
  }
  if (object.type === "signature") {
    return <div style={{ width: "100%", height: "100%", borderBottom: `1px solid ${object.style?.borderColor || "#111827"}`, display: "flex", alignItems: "flex-end" }}>{object.data?.label || "Signature"}</div>;
  }
  if (object.type === "qr") {
    return <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", border: "1px solid #d1d5db" }}>QR</div>;
  }
  if (object.type === "icon") {
    return <div style={{ fontSize: Math.min(object.width, object.height), lineHeight: 1 }}>□</div>;
  }
  return <div style={{ width: "100%", height: "100%" }} />;
}

function baseObjectStyle(object) {
  if (object.type === "text" || object.type === "dynamicField") {
    return {
      fontFamily: object.style?.fontFamily,
      fontSize: object.style?.fontSize,
      fontWeight: object.style?.fontWeight,
      color: object.style?.color,
      textAlign: object.style?.textAlign,
      lineHeight: object.style?.lineHeight,
      fontStyle: object.style?.fontStyle,
      textDecoration: object.style?.textDecoration,
      backgroundColor: object.style?.backgroundColor,
      letterSpacing: object.style?.letterSpacing,
      textTransform: object.style?.textTransform,
      padding: object.style?.padding,
    };
  }
  if (object.type === "shape") {
    return {
      background: object.style?.fill,
      border: `${object.style?.strokeWidth || 1}px solid ${object.style?.stroke || "#d1d5db"}`,
      borderRadius: object.style?.borderRadius || 0,
    };
  }
  return {};
}

function ElementBadge({ object }) {
  return (
    <span
      style={{
        position: "absolute",
        left: 0,
        top: -22,
        zIndex: 10,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        background: object.locked ? "#64748b" : "#2563eb",
        color: "#ffffff",
        borderRadius: 5,
        padding: "3px 6px",
        fontSize: 11,
        fontWeight: 800,
        lineHeight: 1.2,
        pointerEvents: "none",
      }}
    >
      {object.name || object.type}{object.locked ? " - locked" : ""}
    </span>
  );
}

function ResizeHandles({ object, onResize }) {
  const handleStyle = {
    position: "absolute",
    width: 10,
    height: 10,
    background: "#ffffff",
    border: "1px solid #2563eb",
    zIndex: 20,
  };
  const handle = (direction, extra) => (
    <span
      data-document-resize-handle={direction}
      style={{ ...handleStyle, ...extra, cursor: `${direction}-resize` }}
      onMouseDown={(event) => {
        event.stopPropagation();
        onResize?.(object.id, direction, event);
      }}
    />
  );
  return (
    <>
      {handle("nw", { left: -5, top: -5 })}
      {handle("n", { left: "50%", top: -5, transform: "translateX(-50%)" })}
      {handle("ne", { right: -5, top: -5 })}
      {handle("e", { right: -5, top: "50%", transform: "translateY(-50%)" })}
      {handle("se", { right: -5, bottom: -5 })}
      {handle("s", { left: "50%", bottom: -5, transform: "translateX(-50%)" })}
      {handle("sw", { left: -5, bottom: -5 })}
      {handle("w", { left: -5, top: "50%", transform: "translateY(-50%)" })}
    </>
  );
}
