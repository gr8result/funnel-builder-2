import React from "react";
import { sortObjectsByLayer } from "../core/layerEngine.js";
import { ObjectRenderer } from "./objectRenderer.jsx";

export function PageRenderer({
  page,
  workbook = null,
  selection = null,
  editing = false,
  textEditingObjectId = "",
  onSelectObject,
  onResizeObject,
  onTextEditStart,
  onTextCommit,
  exportMode = false,
}) {
  if (!page) return null;
  const selectedIds = selection?.selectedObjectIds || [];
  return (
    <div
      data-document-page-id={page.id}
      style={{
        position: "relative",
        width: page.width,
        height: page.height,
        backgroundColor: page.background?.color || "#ffffff",
        backgroundImage: page.background?.imageRef ? `url(${page.background.imageRef})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        boxShadow: exportMode ? "none" : "0 12px 32px rgba(15, 23, 42, 0.18)",
        overflow: "hidden",
      }}
    >
      {sortObjectsByLayer(page.objects).map((object) => (
        <ObjectRenderer
          key={object.id}
          object={object}
          workbook={workbook}
          selected={selectedIds.includes(object.id)}
          editing={editing}
          textEditing={textEditingObjectId === object.id}
          onSelect={onSelectObject}
          onResize={onResizeObject}
          onTextEditStart={onTextEditStart}
          onTextCommit={onTextCommit}
        />
      ))}
    </div>
  );
}
