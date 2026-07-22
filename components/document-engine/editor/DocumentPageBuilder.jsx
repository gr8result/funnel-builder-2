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
  const [mode, setMode] = useState("preview");
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [textEditingObjectId, setTextEditingObjectId] = useState("");
  const dragRef = useRef(null);
  const imageUploadRef = useRef(null);
  const exportPagesRef = useRef(null);
  const activePage = getActivePage(draft);
  const selectedObjectId = draft.selection?.lastSelectedObjectId || "";
  const selectedObject = activePage?.objects?.find((object) => object.id === selectedObjectId) || null;

  useEffect(() => {
    setDraft(hydrateDocument(document));
    setMode("preview");
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
          object.id === drag.objectId ? drag.type === "resize"
            ? resizeDraggedObject(drag.object, drag.direction, deltaX, deltaY, page)
            : keepObjectOnPage(moveObject(drag.object, deltaX, deltaY, { snap: false }), page)
            : object
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

  useEffect(() => {
    function handleKeyDown(event) {
      if (mode !== "edit" || readonly || !selectedObject || textEditingObjectId) return;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      updateActivePage((page) => updateObjectOnPage(page, selectedObject.id, (object) => keepObjectOnPage(moveObject(object, dx, dy, { snap: false }), page)), "Selected object moved.");
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, readonly, selectedObject, textEditingObjectId, draft]);

  function commitDocument(nextDocument, options = {}) {
    const next = hydrateDocument(nextDocument);
    setDraft(next);
    onChange?.(serializeDocument(next));
    if (!options.silent) onStatus?.("Document page builder updated.");
  }

  function selectPage(pageId) {
    setTextEditingObjectId("");
    commitDocument({ ...setActivePage(draft, pageId), selection: clearSelection() }, { silent: true });
  }

  function selectAndDragObject(objectId, event) {
    if (mode !== "edit") return;
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

  function startResizeObject(objectId, direction, event) {
    if (mode !== "edit") return;
    const page = getActivePage(draft);
    const object = page?.objects?.find((item) => item.id === objectId);
    if (!object || object.locked || readonly) return;
    dragRef.current = {
      type: "resize",
      direction,
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

  function duplicatePage() {
    if (!activePage) return;
    const page = createA4Page({
      ...activePage,
      id: `page_${Date.now().toString(36)}`,
      name: `${activePage.name || "Page"} Copy`,
      objects: activePage.objects.map((object, index) => duplicateObject(object, {
        id: `${object.id}-copy-${Date.now().toString(36)}-${index}`,
        x: object.x,
        y: object.y,
      })),
    });
    const activeIndex = draft.pages.findIndex((item) => item.id === activePage.id);
    const pages = [...draft.pages];
    pages.splice(activeIndex + 1, 0, page);
    commitDocument({ ...draft, pages, activePageId: page.id, selection: clearSelection() });
    onStatus?.("Page duplicated.");
  }

  function deletePage() {
    if (!activePage || draft.pages.length <= 1) return;
    const activeIndex = draft.pages.findIndex((item) => item.id === activePage.id);
    const pages = draft.pages.filter((page) => page.id !== activePage.id);
    commitDocument({
      ...draft,
      pages,
      activePageId: pages[Math.max(0, activeIndex - 1)]?.id || pages[0]?.id || null,
      selection: clearSelection(),
    });
    onStatus?.("Page deleted.");
  }

  function movePage(direction) {
    if (!activePage) return;
    const index = draft.pages.findIndex((page) => page.id === activePage.id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= draft.pages.length) return;
    const pages = [...draft.pages];
    const [page] = pages.splice(index, 1);
    pages.splice(nextIndex, 0, page);
    commitDocument({ ...draft, pages, activePageId: page.id, selection: clearSelection() });
    onStatus?.("Page order updated.");
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

  function commitTextEdit(objectId, text) {
    if (!objectId) return;
    updateActivePage((page) => updateObjectOnPage(page, objectId, (object) => ({
      ...object,
      data: { ...object.data, text, edited: true },
    })), "Text updated.");
    setTextEditingObjectId("");
  }

  function patchSelectedTextStyle(stylePatch, message = "Text formatting updated.") {
    if (!selectedObject || !["text", "dynamicField"].includes(selectedObject.type)) return;
    updateActivePage((page) => updateObjectOnPage(page, selectedObject.id, (object) => ({
      ...object,
      style: { ...object.style, ...stylePatch },
      data: { ...object.data, edited: object.data?.overlayMode === "pptx-text-activation" ? true : object.data?.edited },
    })), message);
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

  async function exportPdf() {
    try {
      const [{ PDFDocument }, html2canvasModule] = await Promise.all([
        import("pdf-lib"),
        import("html2canvas"),
      ]);
      const html2canvas = html2canvasModule.default || html2canvasModule;
      const pdf = await PDFDocument.create();
      const pageNodes = Array.from(exportPagesRef.current?.querySelectorAll?.("[data-document-page-id]") || []);
      if (!pageNodes.length) throw new Error("No document pages were available for PDF export.");
      for (const node of pageNodes) {
        const canvas = await html2canvas(node, { backgroundColor: "#ffffff", scale: 2, useCORS: true, logging: false });
        const image = await pdf.embedPng(canvas.toDataURL("image/png"));
        const pdfPage = pdf.addPage([595.28, 841.89]);
        pdfPage.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
      }
      const bytes = await pdf.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `${draft.name || "Premier Inclusions Schedule"}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      onStatus?.("PDF exported.");
    } catch (error) {
      console.error("Native document PDF export failed", error);
      onStatus?.(error?.message || "PDF export failed.");
    }
  }

  function replaceSelectedImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedObject || !["image", "logo"].includes(selectedObject.type)) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateSelectedObject({ data: { imageRef: reader.result, alt: file.name, edited: true } });
      onStatus?.("Image replaced.");
    };
    reader.readAsDataURL(file);
  }

  return (
    <div style={mode === "edit" ? styles.shell : styles.previewShell}>
      <aside style={styles.pageList}>
        <strong>Pages</strong>
        {draft.pages.map((page, index) => (
          <button key={page.id} type="button" style={{ ...styles.pageButton, ...(page.id === draft.activePageId ? styles.pageButtonActive : {}) }} onClick={() => selectPage(page.id)}>
            <span>{index + 1}. {page.name}</span>
            <small>{page.objects.length} editable block{page.objects.length === 1 ? "" : "s"}</small>
          </button>
        ))}
        {mode === "edit" ? (
          <>
            <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={addPage}>Add Page</button>
            <button type="button" disabled={readonly || !activePage} style={styles.secondaryButton} onClick={duplicatePage}>Duplicate Page</button>
            <button type="button" disabled={readonly || !activePage || draft.pages.length <= 1} style={styles.dangerButton} onClick={deletePage}>Delete Page</button>
            <button type="button" disabled={readonly || draft.pages.findIndex((page) => page.id === draft.activePageId) <= 0} style={styles.secondaryButton} onClick={() => movePage(-1)}>Move Up</button>
            <button type="button" disabled={readonly || draft.pages.findIndex((page) => page.id === draft.activePageId) >= draft.pages.length - 1} style={styles.secondaryButton} onClick={() => movePage(1)}>Move Down</button>
          </>
        ) : null}
      </aside>

      <main style={styles.workspace}>
        <div style={styles.toolbar}>
          <button
            type="button"
            style={mode === "edit" ? styles.primaryButton : styles.secondaryButton}
            onClick={() => {
              setTextEditingObjectId("");
              commitDocument({ ...draft, selection: clearSelection() }, { silent: true });
              setMode(mode === "edit" ? "preview" : "edit");
            }}
          >
            {mode === "edit" ? "Done Editing" : "Edit Page"}
          </button>
          {mode === "edit" ? (
            <>
              <div style={styles.addGroup}>
                <strong>Add Element</strong>
                {["text", "image", "logo", "shape", "divider", "table", "signature", "icon"].map((type) => (
                  <button key={type} type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => addBlock(type)}>
                    {typeLabel(type)}
                  </button>
                ))}
              </div>
              <TextFormattingToolbar object={selectedObject} readonly={readonly} onPatchStyle={patchSelectedTextStyle} onPatchText={(text) => commitTextEdit(selectedObject?.id, text)} />
            </>
          ) : null}
          <button type="button" disabled={readonly} style={styles.primaryButton} onClick={saveDocument}>Save</button>
          <button type="button" style={styles.secondaryButton} onClick={() => setPdfPreviewOpen(true)}>Preview</button>
          <button type="button" style={styles.primaryButton} onClick={exportPdf}>Export PDF</button>
        </div>
        <div
          style={styles.canvasWrap}
          onMouseDown={() => {
            if (mode !== "edit") return;
            setTextEditingObjectId("");
            commitDocument({ ...draft, selection: clearSelection() }, { silent: true });
          }}
        >
          <PageRenderer
            page={activePage}
            workbook={workbook}
            selection={mode === "edit" ? draft.selection : clearSelection()}
            editing={mode === "edit"}
            textEditingObjectId={textEditingObjectId}
            onSelectObject={selectAndDragObject}
            onResizeObject={startResizeObject}
            onTextEditStart={(objectId) => {
              commitDocument({ ...draft, selection: selectObject(draft.selection, objectId) }, { silent: true });
              setTextEditingObjectId(objectId);
            }}
            onTextCommit={commitTextEdit}
          />
        </div>
      </main>

      {mode === "edit" ? <aside style={styles.properties}>
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
            onReplaceImage={() => imageUploadRef.current?.click()}
          />
        ) : (
          <p style={styles.helpText}>Select a block on the page to edit text, images, sizing, colour, alignment, layer order and position.</p>
        )}
      </aside> : null}
      <input ref={imageUploadRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: "none" }} onChange={replaceSelectedImage} />
      {pdfPreviewOpen ? (
        <div style={styles.previewOverlay} onMouseDown={() => setPdfPreviewOpen(false)}>
          <div style={styles.previewDialog} onMouseDown={(event) => event.stopPropagation()}>
            <div style={styles.previewHeader}>
              <strong>{draft.name}</strong>
              <button type="button" style={styles.secondaryButton} onClick={() => setPdfPreviewOpen(false)}>Close</button>
            </div>
            <div style={styles.previewPages}>
              {draft.pages.map((page) => <PageRenderer key={`preview-${page.id}`} page={page} workbook={workbook} />)}
            </div>
          </div>
        </div>
      ) : null}
      <div ref={exportPagesRef} style={styles.exportPages} aria-hidden="true">
        {draft.pages.map((page) => <PageRenderer key={`export-${page.id}`} page={page} workbook={workbook} exportMode />)}
      </div>
    </div>
  );
}

function TextFormattingToolbar({ object, readonly, onPatchStyle, onPatchText }) {
  if (!object || !["text", "dynamicField"].includes(object.type)) return null;
  const style = object.style || {};
  return (
    <div style={styles.formatToolbar}>
      <select disabled={readonly} style={styles.toolbarInput} value={style.fontFamily || "Arial"} onChange={(event) => onPatchStyle({ fontFamily: event.target.value })}>
        {["Arial", "Georgia", "Times New Roman", "Verdana", "Inter", "Montserrat"].map((font) => <option key={font} value={font}>{font}</option>)}
      </select>
      <input disabled={readonly} type="number" min="6" max="120" style={styles.toolbarNumber} value={style.fontSize || 16} onChange={(event) => onPatchStyle({ fontSize: Number(event.target.value) || 16 })} />
      <button type="button" disabled={readonly} style={styles.iconButton} onClick={() => onPatchStyle({ fontWeight: String(style.fontWeight || "400") === "700" ? "400" : "700" })}>B</button>
      <button type="button" disabled={readonly} style={styles.iconButton} onClick={() => onPatchStyle({ fontStyle: style.fontStyle === "italic" ? "normal" : "italic" })}>I</button>
      <button type="button" disabled={readonly} style={styles.iconButton} onClick={() => onPatchStyle({ textDecoration: style.textDecoration === "underline" ? "none" : "underline" })}>U</button>
      <select disabled={readonly} style={styles.toolbarInput} value={style.fontWeight || "400"} onChange={(event) => onPatchStyle({ fontWeight: event.target.value })}>
        {["300", "400", "500", "600", "700", "800", "900"].map((weight) => <option key={weight} value={weight}>{weight}</option>)}
      </select>
      <input disabled={readonly} type="color" title="Text colour" style={styles.toolbarColor} value={safeHex(style.color, "#0b2545")} onChange={(event) => onPatchStyle({ color: event.target.value })} />
      <input disabled={readonly} type="color" title="Highlight" style={styles.toolbarColor} value={safeHex(style.backgroundColor, "#ffffff")} onChange={(event) => onPatchStyle({ backgroundColor: event.target.value })} />
      {["left", "center", "right"].map((align) => <button key={align} type="button" disabled={readonly} style={styles.iconButton} onClick={() => onPatchStyle({ textAlign: align })}>{align[0].toUpperCase()}</button>)}
      <label style={styles.compactLabel}>LH<input disabled={readonly} type="number" step="0.1" min="0.8" max="3" style={styles.toolbarNumber} value={style.lineHeight || 1.2} onChange={(event) => onPatchStyle({ lineHeight: Number(event.target.value) || 1.2 })} /></label>
      <label style={styles.compactLabel}>LS<input disabled={readonly} type="number" step="0.1" style={styles.toolbarNumber} value={Number.parseFloat(style.letterSpacing) || 0} onChange={(event) => onPatchStyle({ letterSpacing: `${Number(event.target.value) || 0}px` })} /></label>
      <button type="button" disabled={readonly} style={styles.iconButton} onClick={() => onPatchStyle({ textTransform: style.textTransform === "uppercase" ? "none" : "uppercase" })}>AA</button>
      <button type="button" disabled={readonly} style={styles.iconButton} onClick={() => onPatchText(String(object.data?.text || "").split("\n").map((line) => line.startsWith("- ") ? line.slice(2) : `- ${line}`).join("\n"))}>-</button>
      <button type="button" disabled={readonly} style={styles.iconButton} onClick={() => onPatchText(String(object.data?.text || "").split("\n").map((line, index) => line.replace(/^\d+\.\s*/, "") ? `${index + 1}. ${line.replace(/^\d+\.\s*/, "")}` : line).join("\n"))}>1.</button>
      <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={() => onPatchStyle({ fontFamily: "Arial", fontSize: 16, fontWeight: "400", fontStyle: "normal", textDecoration: "none", color: "#0b2545", backgroundColor: "transparent", textAlign: "left", lineHeight: 1.2, letterSpacing: "0px", textTransform: "none" })}>Clear</button>
    </div>
  );
}

function ObjectProperties({ object, readonly, onPatch, onGeometry, onDuplicate, onDelete, onLayer, onReplaceImage }) {
  return (
    <div style={styles.objectPanel}>
      <strong>{object.name || typeLabel(object.type)}</strong>
      {(object.type === "text" || object.type === "dynamicField") ? (
        <>
          <label style={styles.field}>Text<textarea disabled={readonly} style={styles.textarea} value={object.data?.text || ""} onChange={(event) => onPatch({ data: { text: event.target.value, edited: true } })} /></label>
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
          <button type="button" disabled={readonly} style={styles.secondaryButton} onClick={onReplaceImage}>Replace Image</button>
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
  if (type === "divider") {
    return createObject("divider", {
      name: "Divider",
      x: 120,
      y: 220,
      width: 320,
      height: 4,
      style: { color: "#0b2545", thickness: 4 },
    });
  }
  if (type === "signature") {
    return createObject("signature", {
      name: "Signature field",
      x: 90,
      y: 760,
      width: 260,
      height: 58,
      style: { borderColor: "#0b2545" },
      data: { label: "Signature" },
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

function keepObjectOnPage(object, page) {
  const maxX = Math.max(0, Number(page?.width) - object.width);
  const maxY = Math.max(0, Number(page?.height) - object.height);
  return {
    ...object,
    x: Math.min(Math.max(0, object.x), maxX),
    y: Math.min(Math.max(0, object.y), maxY),
  };
}

function resizeDraggedObject(object, direction, deltaX, deltaY, page) {
  const start = { ...object };
  let x = start.x;
  let y = start.y;
  let width = start.width;
  let height = start.height;
  if (direction.includes("e")) width = start.width + deltaX;
  if (direction.includes("s")) height = start.height + deltaY;
  if (direction.includes("w")) {
    width = start.width - deltaX;
    x = start.x + deltaX;
  }
  if (direction.includes("n")) {
    height = start.height - deltaY;
    y = start.y + deltaY;
  }
  const minWidth = 16;
  const minHeight = 16;
  if (width < minWidth) {
    if (direction.includes("w")) x -= minWidth - width;
    width = minWidth;
  }
  if (height < minHeight) {
    if (direction.includes("n")) y -= minHeight - height;
    height = minHeight;
  }
  const next = resizeObject({ ...start, x, y }, width, height, { snap: false, minWidth, minHeight });
  return keepObjectOnPage(next, page);
}

function typeLabel(type = "") {
  return type === "dynamicField" ? "Dynamic Field" : `${String(type || "Block").charAt(0).toUpperCase()}${String(type || "Block").slice(1)}`;
}

function safeHex(value, fallback) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

const styles = {
  shell: { display: "grid", gridTemplateColumns: "220px minmax(0, 1fr) 320px", gap: 14, alignItems: "start" },
  previewShell: { display: "grid", gridTemplateColumns: "220px minmax(0, 1fr)", gap: 14, alignItems: "start" },
  pageList: { position: "sticky", top: 90, display: "grid", gap: 8, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 12, padding: 10, maxHeight: "calc(100vh - 120px)", overflow: "auto" },
  pageButton: { width: "100%", border: "1px solid #d1fae5", background: "#f8fafc", color: "#0f172a", borderRadius: 8, padding: "9px 10px", display: "grid", gap: 3, textAlign: "left", fontWeight: 900, cursor: "pointer" },
  pageButtonActive: { background: "#166534", color: "#ffffff", borderColor: "#166534" },
  workspace: { display: "grid", gap: 12, minWidth: 0 },
  toolbar: { display: "flex", flexWrap: "wrap", gap: 8, border: "1px solid #bbf7d0", background: "#f0fdf4", borderRadius: 12, padding: 10 },
  addGroup: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, borderLeft: "1px solid #bbf7d0", paddingLeft: 8, color: "#14532d", fontSize: 12, fontWeight: 950 },
  formatToolbar: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 8, padding: 6 },
  toolbarInput: { height: 34, border: "1px solid #94a3b8", borderRadius: 6, background: "#ffffff", color: "#0f172a", fontSize: 12, fontWeight: 800, padding: "0 7px" },
  toolbarNumber: { width: 58, height: 34, boxSizing: "border-box", border: "1px solid #94a3b8", borderRadius: 6, background: "#ffffff", color: "#0f172a", fontSize: 12, fontWeight: 800, padding: "0 6px" },
  toolbarColor: { width: 34, height: 34, border: "1px solid #94a3b8", borderRadius: 6, background: "#ffffff", padding: 2 },
  iconButton: { minWidth: 34, height: 34, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f172a", borderRadius: 6, padding: "0 8px", fontSize: 12, fontWeight: 950, cursor: "pointer" },
  compactLabel: { display: "inline-flex", alignItems: "center", gap: 4, color: "#475569", fontSize: 11, fontWeight: 950 },
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
  previewOverlay: { position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,23,42,0.55)", display: "grid", placeItems: "center", padding: 20 },
  previewDialog: { width: "min(980px, 96vw)", maxHeight: "92vh", overflow: "auto", background: "#f8fafc", borderRadius: 12, border: "1px solid #cbd5e1", padding: 14, display: "grid", gap: 12 },
  previewHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  previewPages: { display: "grid", gap: 18, justifyItems: "center" },
  exportPages: { position: "fixed", left: -10000, top: 0, width: 794, display: "grid", gap: 0, pointerEvents: "none", opacity: 1 },
};
