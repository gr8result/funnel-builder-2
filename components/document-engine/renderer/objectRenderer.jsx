import React from "react";
import { resolveDynamicText } from "../fields/workbookFieldResolver.js";

export function ObjectRenderer({ object, selected = false, workbook = null, onSelect }) {
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
    cursor: object.locked ? "default" : "move",
    outline: selected ? "2px solid #2563eb" : "none",
    ...baseObjectStyle(object),
  };

  return (
    <div data-document-object-id={object.id} style={style} onMouseDown={(event) => onSelect?.(object.id, event)}>
      {renderObjectContent(object, workbook)}
      {selected ? <ResizeHandles /> : null}
    </div>
  );
}

function renderObjectContent(object, workbook) {
  if (object.type === "text" || object.type === "dynamicField") {
    const text = resolveDynamicText(object.data?.text || "", workbook);
    return <div style={{ whiteSpace: "pre-wrap", width: "100%", height: "100%" }}>{text}</div>;
  }
  if (object.type === "image" || object.type === "logo") {
    return object.data?.imageRef ? (
      <img src={object.data.imageRef} alt={object.data.alt || ""} style={{ width: "100%", height: "100%", objectFit: object.style?.objectFit || "cover", borderRadius: object.style?.borderRadius || 0 }} />
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

function ResizeHandles() {
  const handleStyle = {
    position: "absolute",
    width: 10,
    height: 10,
    background: "#ffffff",
    border: "1px solid #2563eb",
  };
  return (
    <>
      <span style={{ ...handleStyle, left: -5, top: -5 }} />
      <span style={{ ...handleStyle, right: -5, top: -5 }} />
      <span style={{ ...handleStyle, left: -5, bottom: -5 }} />
      <span style={{ ...handleStyle, right: -5, bottom: -5 }} />
    </>
  );
}
