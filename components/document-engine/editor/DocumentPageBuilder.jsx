import React, { useEffect, useMemo, useRef, useState } from "react";
import { createDocument, getActivePage, hydrateDocument, serializeDocument, setActivePage, updatePage } from "../core/documentState.js";
import { addObjectToPage, createA4Page, duplicateObjectOnPage, removeObjectFromPage, updateObjectOnPage } from "../core/pageEngine.js";
import { bringForward, sendBackward } from "../core/layerEngine.js";
import { createObject, duplicateObject, moveObject, resizeObject } from "../core/objectEngine.js";
import { clearSelection, selectObject } from "../core/selectionEngine.js";
import { PageRenderer } from "../renderer/pageRenderer.jsx";

const DEFAULT_IMAGE = "/assets/builders/standard-inclusions-hero.jpg";
const DEFAULT_LOGO = "/assets/builders/goodbuild-logo.png";

export default function DocumentPageBuilder({ document, workbook = null, readonly = false, onChange, onStatus }) {
  const [draft, setDraft] = useState(() => hydrateDocument(document));
  const dragRef = useRef(null);
  const activePage = getActivePage(draft);
  const selectedObjectId = draft.selection?.lastSelectedObjectId || "";
  const selectedObject = activePage?.objects?.find((object) => object.id === selectedObjectId) || null;

  useEffect(() => {
    setDraft(hydrateDocument(document));
  }, [document?.id]);

  useEffect(() => {
    function move(event) {
      const drag = dragRef.current;
      if (!drag || readonly) return;
      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      commitDocument(updatePage(draft, drag.pageId, (page) => ({
        ...page,
        objects: page.objects.map((object) => (
          object.id === drag.objectId ? moveObject(drag.object, deltaX, deltaY, { snap: false }) : object
        )),
      })), { silent: true });
    }
    function stop() {
      dragRef.current = null;
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    };
  }, [draft, readonly]);

  function commitDocument(nextDocument, options = {}) {
    const next = hydrateDocument(nextDocument);
    setDraft(next);
    onChange?.(serializeDocument(next));
    if (!options.silent) onStatus?.("Document page builder updated.");
  }

  function selectPage(pageId) {
    commitDocument({ ...setActivePage(draft, pageId), selection: clearSelection() }, { silent: true });
  }

  function selectAndDragObject(objectId, event) {
    event.stopPropagation();
    const page = getActivePage(draft);
    const object = page?.objects?.find((item) => item.id === objectId);
    commitDocument({ ...draft, selection: selectObject(draft.selection, objectId, { multi: event.shiftKey }) }, { silent: true });
    if (!object || object.locked || readonly) return;
    dragRef.current = {
      pageId: page.id,
      objectId,
      object,
      startX: event.clientX,
      startY: event.clientY,
    };
  }

  function updateActivePage(updater, message = "Page updated.") {
    if (!activePage) return;
    const next = updatePage(draft, activePage.id, updater);
    commitDocument(next);
    onStatus?.(message);
  }

  function addPage() {
    const page = createA4Page({ name: `Page ${draft.pages.length + 1}` });
    commitDocument({
      ...draft,
      pages: [...draft.pages, page],
      activePageId: page.id,
      selection: clearSelection(),
    });
  }

  function addBlock(type) {
    const object = createBlockObject(type);
    updateActivePage((page) => addObjectToPage(page, object), `${typeLabel(type)} block added.`);
  }

  function updateSelectedObject(patch) {
    if (!selectedObject) return;
    updateActivePage((page) => updateObjectOnPage(page, selectedObject.id, (object) => ({
      ...object,
      ...patch,
      style: { ...object.style, ...(patch.style || {}) },
      data: { ...object.data, ...(patch.data || {}) },
    })), "Selected object updated.");
  }

  function updateSelectedGeometry(key, value) {
    if (!selectedObject) return;
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    if (key === "width" || key === "height") {
      const next = resizeObject(selectedObject, key === "width" ? number : selectedObject.width, key === "height" ? number : selectedObject.height, { snap: false });
      updateSelectedObject(next);
      return;
    }
    updateSelectedObject({ [key]: number });
  }

  function duplicateSelected() {
    if (!selectedObject) return;
    updateActivePage((page) => duplicateObjectOnPage(page, selectedObject.id, duplicateObject), "Object duplicated.");
  }

  function deleteSelected() {
    if (!selectedObject) return;
    const next = updatePage(draft, activePage.id, (page) => removeObjectFromPage(page, selectedObject.id));
    commitDocument({ ...next, selection: clearSelection() });
    onStatus?.("Object deleted.");
  }

  function layerSelected(direction) {
    if (!selectedObject) return;
    updateActivePage((page) => ({
      ...page,
      objects: direction > 0 ? bringForward(page.objects, selectedObject.id) : sendBackward(page.objects, selectedObject.id),
    }), "Object layer updated.");
  }

  function saveDocument() {
    onChange?.(serializeDocument(draft));
    onStatus?.("Document saved.");
  }

  return (
    <div style={styles.shell}>
      <aside style={styles.pageList}>
        <strong>Pages</strong>
        {draft.pages.map((page, index) => (
          <button key={page.id} type="button" style={{ ...styles.pageButton, ...(page.id === draft.activePageId ? styles.pageButtonActive : {}) }} onClick={() => selectPage(page.id)}>
            <span>{index + 1}. {page.name}</span>
            <small>{page.objects.length} editable block{page.objects.length === 1 ? "" : "s"}</small>
          </button>
        ))}
        <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={addPage}>Add Page</button>
      </aside>

      <main style={styles.workspace}>
        <div style={styles.toolbar}>
          {["text", "image", "logo", "shape", "table", "icon"].map((type) => (
            <button key={type} type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => addBlock(type)}>
              Add {typeLabel(type)}
            </button>
          ))}
          <button type="button" disabled={readonly} style={styles.primaryButton} onClick={saveDocument}>Save Document</button>
        </div>
        <div style={styles.canvasWrap} onMouseDown={() => commitDocument({ ...draft, selection: clearSelection() }, { silent: true })}>
          <PageRenderer page={activePage} workbook={workbook} selection={draft.selection} onSelectObject={selectAndDragObject} />
        </div>
      </main>

      <aside style={styles.properties}>
        <h3 style={styles.panelTitle}>Page Builder</h3>
        {selectedObject ? (
          <ObjectProperties
            object={selectedObject}
            readonly={readonly}
            onPatch={updateSelectedObject}
            onGeometry={updateSelectedGeometry}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
            onLayer={layerSelected}
          />
        ) : (
          <p style={styles.helpText}>Select a block on the page to edit text, images, sizing, colour, alignment, layer order and position.</p>
        )}
      </aside>
    </div>
  );
}

function ObjectProperties({ object, readonly, onPatch, onGeometry, onDuplicate, onDelete, onLayer }) {
  return (
    <div style={styles.objectPanel}>
      <strong>{object.name || typeLabel(object.type)}</strong>
      {(object.type === "text" || object.type === "dynamicField") ? (
        <>
          <label style={styles.field}>Text<textarea disabled={readonly} style={styles.textarea} value={object.data?.text || ""} onChange={(event) => onPatch({ data: { text: event.target.value } })} /></label>
          <label style={styles.field}>Font size<input disabled={readonly} type="number" style={styles.input} value={object.style?.fontSize || 16} onChange={(event) => onPatch({ style: { fontSize: Number(event.target.value) || 16 } })} /></label>
          <label style={styles.field}>Colour<input disabled={readonly} type="color" style={styles.color} value={safeHex(object.style?.color, "#0b2545")} onChange={(event) => onPatch({ style: { color: event.target.value } })} /></label>
          <label style={styles.field}>Alignment<select disabled={readonly} style={styles.input} value={object.style?.textAlign || "left"} onChange={(event) => onPatch({ style: { textAlign: event.target.value } })}>
            <option value="left">Left</option>
            <option value="center">Centre</option>
            <option value="right">Right</option>
          </select></label>
        </>
      ) : null}
      {(object.type === "image" || object.type === "logo") ? (
        <>
          <label style={styles.field}>Image / logo URL<input disabled={readonly} style={styles.input} value={object.data?.imageRef || ""} onChange={(event) => onPatch({ data: { imageRef: event.target.value } })} /></label>
          <label style={styles.field}>Fit<select disabled={readonly} style={styles.input} value={object.style?.objectFit || "cover"} onChange={(event) => onPatch({ style: { objectFit: event.target.value } })}>
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
          </select></label>
        </>
      ) : null}
      {object.type === "shape" ? (
        <>
          <label style={styles.field}>Fill<input disabled={readonly} type="color" style={styles.color} value={safeHex(object.style?.fill, "#ffffff")} onChange={(event) => onPatch({ style: { fill: event.target.value } })} /></label>
          <label style={styles.field}>Border<input disabled={readonly} type="color" style={styles.color} value={safeHex(object.style?.stroke, "#d1d5db")} onChange={(event) => onPatch({ style: { stroke: event.target.value, strokeWidth: object.style?.strokeWidth || 1 } })} /></label>
        </>
      ) : null}
      <div style={styles.geometryGrid}>
        {["x", "y", "width", "height"].map((key) => (
          <label key={key} style={styles.field}>{key.toUpperCase()}<input disabled={readonly} type="number" style={styles.input} value={Math.round(Number(object[key]) || 0)} onChange={(event) => onGeometry(key, event.target.value)} /></label>
        ))}
      </div>
      <div style={styles.buttonRow}>
        <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => onLayer(1)}>Bring Forward</button>
        <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => onLayer(-1)}>Send Backward</button>
        <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={onDuplicate}>Duplicate</button>
        <button type="button" disabled={readonly} style={styles.dangerButton} onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

function createBlockObject(type) {
  if (type === "text") {
    return createObject("text", {
      name: "Text block",
      x: 90,
      y: 120,
      width: 280,
      height: 80,
      style: { fontFamily: "Arial", fontSize: 24, fontWeight: "700", color: "#0b2545", lineHeight: 1.2, textAlign: "left" },
      data: { text: "New text block" },
    });
  }
  if (type === "image" || type === "logo") {
    return createObject(type, {
      name: type === "logo" ? "Logo" : "Image",
      x: 100,
      y: 180,
      width: type === "logo" ? 160 : 260,
      height: type === "logo" ? 90 : 170,
      style: { objectFit: type === "logo" ? "contain" : "cover" },
      data: { imageRef: type === "logo" ? DEFAULT_LOGO : DEFAULT_IMAGE },
    });
  }
  if (type === "table") {
    return createObject("table", {
      name: "Table",
      x: 80,
      y: 180,
      width: 520,
      height: 180,
      style: { borderColor: "#d1d5db" },
      data: { rows: [["Item", "Value"], ["", ""]] },
    });
  }
  if (type === "icon") {
    return createObject("icon", {
      name: "Icon",
      x: 90,
      y: 140,
      width: 48,
      height: 48,
      style: { color: "#d29a37" },
      data: { icon: "square" },
    });
  }
  return createObject("shape", {
    name: "Shape",
    x: 90,
    y: 140,
    width: 220,
    height: 90,
    style: { fill: "#f8fafc", stroke: "#d29a37", strokeWidth: 1, borderRadius: 8 },
  });
}

function typeLabel(type = "") {
  return type === "dynamicField" ? "Dynamic Field" : `${String(type || "Block").charAt(0).toUpperCase()}${String(type || "Block").slice(1)}`;
}

function safeHex(value, fallback) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

const styles = {
  shell: { display: "grid", gridTemplateColumns: "220px minmax(0, 1fr) 320px", gap: 14, alignItems: "start" },
  pageList: { position: "sticky", top: 90, display: "grid", gap: 8, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 12, padding: 10, maxHeight: "calc(100vh - 120px)", overflow: "auto" },
  pageButton: { width: "100%", border: "1px solid #d1fae5", background: "#f8fafc", color: "#0f172a", borderRadius: 8, padding: "9px 10px", display: "grid", gap: 3, textAlign: "left", fontWeight: 900, cursor: "pointer" },
  pageButtonActive: { background: "#166534", color: "#ffffff", borderColor: "#166534" },
  workspace: { display: "grid", gap: 12, minWidth: 0 },
  toolbar: { display: "flex", flexWrap: "wrap", gap: 8, border: "1px solid #bbf7d0", background: "#f0fdf4", borderRadius: 12, padding: 10 },
  canvasWrap: { overflow: "auto", border: "1px solid #cbd5e1", background: "#e5e7eb", borderRadius: 14, padding: 18, display: "grid", justifyItems: "center", minHeight: 760 },
  properties: { position: "sticky", top: 90, display: "grid", gap: 10, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 12, padding: 12, maxHeight: "calc(100vh - 120px)", overflow: "auto" },
  panelTitle: { margin: 0, color: "#0b2545", fontSize: 22, lineHeight: 1.15 },
  helpText: { margin: 0, color: "#475569", fontSize: 13, lineHeight: 1.45, fontWeight: 700 },
  objectPanel: { display: "grid", gap: 9 },
  field: { display: "grid", gap: 5, color: "#475569", fontSize: 12, fontWeight: 900, textTransform: "uppercase" },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #94a3b8", borderRadius: 7, padding: "8px 9px", color: "#0f172a", background: "#ffffff", fontSize: 14, fontWeight: 700 },
  textarea: { width: "100%", minHeight: 92, boxSizing: "border-box", border: "1px solid #94a3b8", borderRadius: 7, padding: "8px 9px", color: "#0f172a", background: "#ffffff", fontSize: 14, fontWeight: 650, fontFamily: "inherit", resize: "vertical", textTransform: "none" },
  color: { width: "100%", height: 36, border: "1px solid #94a3b8", borderRadius: 7, background: "#ffffff" },
  geometryGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 },
  buttonRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  primaryButton: { border: "1px solid #0f766e", background: "#0f766e", color: "#ffffff", borderRadius: 8, padding: "9px 11px", fontWeight: 900, cursor: "pointer" },
  secondaryButton: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f172a", borderRadius: 8, padding: "9px 11px", fontWeight: 900, cursor: "pointer" },
  dangerButton: { border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 8, padding: "9px 11px", fontWeight: 900, cursor: "pointer" },
};
