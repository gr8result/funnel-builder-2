import { useEffect, useMemo, useRef, useState } from "react";

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const GOLD = "#d29a37";
const NAVY = "#0b2545";
const WHITE = "#ffffff";

export default function PremierInclusionsCanvasEditor({ page, pageIndex = 0, readonly = false, onSavePage }) {
  const canvasElementRef = useRef(null);
  const fabricRef = useRef(null);
  const canvasRef = useRef(null);
  const uploadRef = useRef(null);
  const replaceTargetRef = useRef(null);
  const loadingPageIdRef = useRef("");
  const [selected, setSelected] = useState(null);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [status, setStatus] = useState("");

  const selectedSnapshot = useMemo(() => selected ? objectSnapshot(selected) : null, [selected, selectionVersion]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const mod = await import("fabric");
      if (cancelled) return;
      const fabric = mod.fabric || mod.default?.fabric || mod.default || mod;
      fabricRef.current = fabric;
      const canvas = new fabric.Canvas(canvasElementRef.current, {
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        backgroundColor: WHITE,
        preserveObjectStacking: true,
        selection: !readonly,
      });
      canvasRef.current = canvas;

      canvas.on("selection:created", (event) => {
        setSelected(event.selected?.[0] || null);
        setSelectionVersion((version) => version + 1);
      });
      canvas.on("selection:updated", (event) => {
        setSelected(event.selected?.[0] || null);
        setSelectionVersion((version) => version + 1);
      });
      canvas.on("selection:cleared", () => {
        setSelected(null);
        setSelectionVersion((version) => version + 1);
      });
      canvas.on("object:modified", () => refreshSelection(canvas));
      canvas.on("text:changed", () => refreshSelection(canvas));

      await loadPage(canvas, fabric, page);
    }

    init();
    return () => {
      cancelled = true;
      canvasRef.current?.dispose();
      canvasRef.current = null;
      fabricRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const fabric = fabricRef.current;
    if (!canvas || !fabric || !page?.id || loadingPageIdRef.current === page.id) return;
    loadPage(canvas, fabric, page);
  }, [page?.id, page?.canvasJson, pageIndex]);

  async function loadPage(canvas, fabric, nextPage) {
    if (!nextPage) return;
    loadingPageIdRef.current = nextPage.id;
    setSelected(null);
    canvas.clear();
    canvas.setBackgroundColor(WHITE, canvas.renderAll.bind(canvas));
    if (nextPage.canvasJson) {
      await new Promise((resolve) => {
        canvas.loadFromJSON(nextPage.canvasJson, () => {
          canvas.getObjects().forEach((object) => {
            object.set({
              selectable: !readonly,
              evented: !readonly,
            });
          });
          canvas.renderAll();
          resolve();
        });
      });
      setStatus("Editable Page 1 loaded.");
      return;
    }
    await buildEditablePage(canvas, fabric, Math.max(0, Number(pageIndex) || 0));
    setStatus(`Page ${Math.max(0, Number(pageIndex) || 0) + 1} rebuilt as editable objects. Select any item on the page.`);
    saveCanvas(`Editable Page ${Math.max(0, Number(pageIndex) || 0) + 1} template created.`);
  }

  function getCanvas() {
    return canvasRef.current;
  }

  function getFabric() {
    return fabricRef.current;
  }

  function refreshSelection(canvas = getCanvas()) {
    setSelected(canvas?.getActiveObject() || null);
    setSelectionVersion((version) => version + 1);
  }

  function setActiveObjectPatch(patch = {}) {
    const canvas = getCanvas();
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    object.set(patch);
    object.setCoords();
    canvas.requestRenderAll();
    refreshSelection(canvas);
  }

  function updateText(value) {
    const object = getCanvas()?.getActiveObject();
    if (!object || !isTextObject(object)) return;
    object.set("text", value);
    object.setCoords();
    getCanvas().requestRenderAll();
    refreshSelection(getCanvas());
  }

  function updateGeometry(key, rawValue) {
    const object = getCanvas()?.getActiveObject();
    if (!object) return;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    if (key === "width") object.set("scaleX", Math.max(1, value) / Math.max(1, object.width || 1));
    else if (key === "height") object.set("scaleY", Math.max(1, value) / Math.max(1, object.height || 1));
    else object.set(key, value);
    object.setCoords();
    getCanvas().requestRenderAll();
    refreshSelection(getCanvas());
  }

  function duplicateSelected() {
    const canvas = getCanvas();
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    object.clone((clone) => {
      clone.set({
        id: `page1-object-${Date.now()}`,
        left: (object.left || 0) + 18,
        top: (object.top || 0) + 18,
        selectable: !readonly,
        evented: !readonly,
      });
      canvas.add(clone);
      canvas.setActiveObject(clone);
      canvas.requestRenderAll();
      refreshSelection(canvas);
    }, ["id", "name", "role", "assetKind"]);
  }

  function deleteSelected() {
    const canvas = getCanvas();
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    canvas.remove(object);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    setSelected(null);
  }

  function addText() {
    const fabric = getFabric();
    const canvas = getCanvas();
    if (!fabric || !canvas) return;
    const text = new fabric.Textbox("New editable text", {
      id: `page1-text-${Date.now()}`,
      name: "New text box",
      role: "text",
      left: 80,
      top: 760,
      width: 360,
      fontFamily: "Arial",
      fontSize: 28,
      fontWeight: "700",
      fill: NAVY,
      textAlign: "left",
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.requestRenderAll();
    refreshSelection(canvas);
  }

  function addShape() {
    const fabric = getFabric();
    const canvas = getCanvas();
    if (!fabric || !canvas) return;
    const rect = new fabric.Rect({
      id: `page1-shape-${Date.now()}`,
      name: "New shape",
      role: "shape",
      left: 92,
      top: 840,
      width: 180,
      height: 64,
      fill: "rgba(210,154,55,0.18)",
      stroke: GOLD,
      strokeWidth: 2,
      rx: 8,
      ry: 8,
    });
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.requestRenderAll();
    refreshSelection(canvas);
  }

  function chooseReplacement(role = "image") {
    replaceTargetRef.current = role;
    uploadRef.current?.click();
  }

  async function handleImageUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type?.startsWith("image/")) return;
    const dataUrl = await readFileAsDataUrl(file);
    const role = replaceTargetRef.current || "image";
    replaceTargetRef.current = null;
    replaceSelectedImage(dataUrl, role);
  }

  function replaceSelectedImage(src, role = "image") {
    const fabric = getFabric();
    const canvas = getCanvas();
    const object = canvas?.getActiveObject();
    if (!fabric || !canvas) return;
    const target = object && isImageObject(object) ? object : findObjectByRole(canvas, role === "logo" ? "logo" : "heroImage");
    if (!target) return;
    fabric.Image.fromURL(src, (image) => {
      image.set({
        id: target.id || `page1-image-${Date.now()}`,
        name: target.name || (role === "logo" ? "Goodbuild logo" : "House image"),
        role: target.role || role,
        assetKind: role,
        left: target.left,
        top: target.top,
        angle: target.angle || 0,
        selectable: !readonly,
        evented: !readonly,
      });
      fitObjectToBox(image, scaledWidth(target), scaledHeight(target));
      const index = canvas.getObjects().indexOf(target);
      canvas.remove(target);
      canvas.insertAt(image, Math.max(0, index), false);
      canvas.setActiveObject(image);
      canvas.requestRenderAll();
      refreshSelection(canvas);
    }, { crossOrigin: "anonymous" });
  }

  function bringSelectedForward() {
    const canvas = getCanvas();
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    canvas.bringForward(object);
    canvas.requestRenderAll();
    refreshSelection(canvas);
  }

  function sendSelectedBackward() {
    const canvas = getCanvas();
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    canvas.sendBackwards(object);
    canvas.requestRenderAll();
    refreshSelection(canvas);
  }

  function saveCanvas(message = "Page saved.") {
    const canvas = getCanvas();
    if (!canvas || !page) return;
    const canvasJson = canvas.toJSON(["id", "name", "role", "assetKind"]);
    const renderedImage = canvas.toDataURL({ format: "jpeg", quality: 0.96, multiplier: 2 });
    onSavePage?.({
      ...page,
      canvasJson,
      renderedImage,
      backgroundImage: "",
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      editableTemplate: true,
      templateKind: `fabric-page-${Math.max(0, Number(pageIndex) || 0) + 1}`,
    });
    setStatus(message);
  }

  return (
    <div style={editorStyles.shell}>
      <div style={editorStyles.canvasWrap}>
        <canvas ref={canvasElementRef} width={PAGE_WIDTH} height={PAGE_HEIGHT} />
      </div>
      <aside style={editorStyles.panel}>
        <h3 style={editorStyles.panelTitle}>Editable Page {Math.max(0, Number(pageIndex) || 0) + 1}</h3>
        <p style={editorStyles.helpText}>Every item on this page is a real selectable object. The flattened PDF background is not used for the finished template.</p>
        <div style={editorStyles.buttonRow}>
          <button type="button" disabled={readonly} style={editorStyles.primaryButton} onClick={addText}>Add text</button>
          <button type="button" disabled={readonly} style={editorStyles.secondaryButton} onClick={addShape}>Add shape</button>
          <button type="button" disabled={readonly} style={editorStyles.secondaryButton} onClick={() => chooseReplacement("image")}>Replace image</button>
          <button type="button" disabled={readonly} style={editorStyles.secondaryButton} onClick={() => chooseReplacement("logo")}>Replace logo</button>
        </div>

        {selectedSnapshot ? (
          <div style={editorStyles.objectPanel}>
            <strong>{selectedSnapshot.name}</strong>
            {selectedSnapshot.type === "text" ? (
              <>
                <label style={editorStyles.field}>Edit text<textarea disabled={readonly} style={editorStyles.textarea} value={selectedSnapshot.text} onChange={(event) => updateText(event.target.value)} /></label>
                <label style={editorStyles.field}>Font size<input disabled={readonly} type="number" style={editorStyles.input} value={selectedSnapshot.fontSize} onChange={(event) => setActiveObjectPatch({ fontSize: Number(event.target.value) || 12 })} /></label>
                <label style={editorStyles.field}>Colour<input disabled={readonly} type="color" style={editorStyles.colorInput} value={selectedSnapshot.fill} onChange={(event) => setActiveObjectPatch({ fill: event.target.value })} /></label>
                <label style={editorStyles.field}>Alignment<select disabled={readonly} style={editorStyles.input} value={selectedSnapshot.textAlign} onChange={(event) => setActiveObjectPatch({ textAlign: event.target.value })}>
                  <option value="left">Left</option>
                  <option value="center">Centre</option>
                  <option value="right">Right</option>
                </select></label>
              </>
            ) : null}
            {selectedSnapshot.type === "image" ? (
              <button type="button" disabled={readonly} style={editorStyles.secondaryButton} onClick={() => chooseReplacement(selectedSnapshot.role === "logo" ? "logo" : "image")}>Replace selected image/logo</button>
            ) : null}
            {selectedSnapshot.type === "shape" ? (
              <>
                <label style={editorStyles.field}>Fill<input disabled={readonly} type="color" style={editorStyles.colorInput} value={selectedSnapshot.fill} onChange={(event) => setActiveObjectPatch({ fill: event.target.value })} /></label>
                <label style={editorStyles.field}>Line colour<input disabled={readonly} type="color" style={editorStyles.colorInput} value={selectedSnapshot.stroke} onChange={(event) => setActiveObjectPatch({ stroke: event.target.value })} /></label>
              </>
            ) : null}

            <div style={editorStyles.geometryGrid}>
              <NumberField label="X" value={selectedSnapshot.left} disabled={readonly} onChange={(value) => updateGeometry("left", value)} />
              <NumberField label="Y" value={selectedSnapshot.top} disabled={readonly} onChange={(value) => updateGeometry("top", value)} />
              <NumberField label="Width" value={selectedSnapshot.width} disabled={readonly} onChange={(value) => updateGeometry("width", value)} />
              <NumberField label="Height" value={selectedSnapshot.height} disabled={readonly} onChange={(value) => updateGeometry("height", value)} />
            </div>

            <div style={editorStyles.buttonRow}>
              <button type="button" disabled={readonly} style={editorStyles.secondaryButton} onClick={bringSelectedForward}>Bring forward</button>
              <button type="button" disabled={readonly} style={editorStyles.secondaryButton} onClick={sendSelectedBackward}>Send backward</button>
              <button type="button" disabled={readonly} style={editorStyles.secondaryButton} onClick={duplicateSelected}>Duplicate</button>
              <button type="button" disabled={readonly} style={editorStyles.dangerButton} onClick={deleteSelected}>Delete</button>
            </div>
          </div>
        ) : (
          <p style={editorStyles.helpText}>Select “Premier Inclusions Range”, the Goodbuild logo, phone number, house image, or any other object to edit it.</p>
        )}

        <button type="button" disabled={readonly} style={editorStyles.primaryButton} onClick={() => saveCanvas(`Editable Page ${Math.max(0, Number(pageIndex) || 0) + 1} saved.`)}>Save page</button>
        {status ? <p style={editorStyles.status}>{status}</p> : null}
        <input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: "none" }} onChange={handleImageUpload} />
      </aside>
    </div>
  );
}

export async function createEditablePremierPageRecord(page, pageIndex = 0) {
  if (page?.canvasJson && page?.renderedImage) return page;
  const mod = await import("fabric");
  const fabric = mod.fabric || mod.default?.fabric || mod.default || mod;
  const canvasElement = document.createElement("canvas");
  canvasElement.width = PAGE_WIDTH;
  canvasElement.height = PAGE_HEIGHT;
  const canvas = new fabric.Canvas(canvasElement, {
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    backgroundColor: WHITE,
    preserveObjectStacking: true,
  });
  await buildEditablePage(canvas, fabric, Math.max(0, Number(pageIndex) || 0));
  const canvasJson = canvas.toJSON(["id", "name", "role", "assetKind"]);
  const renderedImage = canvas.toDataURL({ format: "jpeg", quality: 0.96, multiplier: 2 });
  canvas.dispose();
  return {
    ...page,
    canvasJson,
    renderedImage,
    backgroundImage: "",
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    editableTemplate: true,
    templateKind: `fabric-page-${Math.max(0, Number(pageIndex) || 0) + 1}`,
  };
}

function NumberField({ label, value, disabled, onChange }) {
  return (
    <label style={editorStyles.field}>
      {label}
      <input disabled={disabled} type="number" style={editorStyles.input} value={Math.round(Number(value) || 0)} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

async function buildEditablePage(canvas, fabric, pageIndex) {
  if (pageIndex === 0) {
    await buildEditablePageOne(canvas, fabric);
    return;
  }
  if (pageIndex === 1) {
    await buildEditableConstructionPage(canvas, fabric, pageIndex);
    return;
  }
  if (pageIndex === 2) {
    await buildEditableLifestylePage(canvas, fabric, pageIndex);
    return;
  }
  if (pageIndex === 3) {
    await buildEditableSelectionsPage(canvas, fabric, pageIndex);
    return;
  }
  await buildEditableClosingPage(canvas, fabric, pageIndex);
}

async function buildEditablePageOne(canvas, fabric) {
  canvas.clear();
  canvas.setBackgroundColor(WHITE, canvas.renderAll.bind(canvas));

  await addImage(fabric, canvas, "/assets/builders/standard-inclusions-hero.jpg", {
    id: "page1-hero-image",
    name: "House image",
    role: "heroImage",
    assetKind: "image",
    left: 0,
    top: 0,
    width: PAGE_WIDTH,
    height: 690,
    crop: true,
  });

  canvas.add(new fabric.Rect({
    id: "page1-hero-fade",
    name: "Hero image soft overlay",
    role: "shape",
    left: 0,
    top: 0,
    width: PAGE_WIDTH,
    height: 690,
    fill: "rgba(255,255,255,0.22)",
    selectable: true,
  }));

  addTextbox(fabric, canvas, "Premier Inclusions Range", {
    id: "page1-title",
    name: "Premier Inclusions Range",
    left: 54,
    top: 230,
    width: 430,
    fontSize: 62,
    fontWeight: "800",
    fill: NAVY,
    lineHeight: 0.95,
  });
  addLine(fabric, canvas, 55, 356, 152, 356, GOLD, 5, "Gold title divider");
  addTextbox(fabric, canvas, "Premier Range\nInclusions Schedule", {
    id: "page1-subtitle",
    name: "Premier Range Inclusions Schedule",
    left: 56,
    top: 392,
    width: 330,
    fontSize: 26,
    fontWeight: "500",
    fill: NAVY,
    lineHeight: 1.2,
  });

  canvas.add(new fabric.Rect({
    id: "page1-feature-panel",
    name: "Feature strip panel",
    role: "shape",
    left: 0,
    top: 690,
    width: PAGE_WIDTH,
    height: 116,
    fill: NAVY,
  }));
  addFeature(fabric, canvas, "✓", "Quality Inclusions", "Carefully selected for performance, durability and style.", 76);
  addFeature(fabric, canvas, "⌂", "Everything You Need", "A complete range of inclusions to make building easy.", 318);
  addFeature(fabric, canvas, "$", "Great Value", "Inclusions that deliver exceptional value for your investment.", 566);

  addTextbox(fabric, canvas, "Built for life. Backed by quality.", {
    id: "page1-tagline",
    name: "Tagline",
    left: 54,
    top: 888,
    width: 460,
    fontSize: 34,
    fontFamily: "Georgia",
    fontStyle: "italic",
    fill: NAVY,
  });
  addLine(fabric, canvas, 54, 956, 500, 956, GOLD, 1.5, "Footer divider");
  addTextbox(fabric, canvas, "1300 1231 456", {
    id: "page1-phone",
    name: "Phone number",
    left: 88,
    top: 1008,
    width: 190,
    fontSize: 23,
    fontWeight: "700",
    fill: NAVY,
  });
  addTextbox(fabric, canvas, "goodbuild.com.au", {
    id: "page1-website",
    name: "Website",
    left: 314,
    top: 1008,
    width: 230,
    fontSize: 23,
    fontWeight: "700",
    fill: NAVY,
  });
  addTextbox(fabric, canvas, "☎", {
    id: "page1-phone-icon",
    name: "Phone icon",
    left: 54,
    top: 1004,
    width: 26,
    fontSize: 25,
    fontWeight: "700",
    fill: GOLD,
  });
  addTextbox(fabric, canvas, "|", {
    id: "page1-footer-separator",
    name: "Footer separator",
    left: 280,
    top: 1008,
    width: 18,
    fontSize: 25,
    fill: NAVY,
  });
  await addImage(fabric, canvas, "/assets/builders/goodbuild-logo.png", {
    id: "page1-goodbuild-logo",
    name: "Goodbuild logo",
    role: "logo",
    assetKind: "logo",
    left: 584,
    top: 928,
    width: 158,
    height: 124,
  });
  canvas.renderAll();
}

async function buildEditableConstructionPage(canvas, fabric, pageIndex) {
  canvas.clear();
  canvas.setBackgroundColor(WHITE, canvas.renderAll.bind(canvas));
  const prefix = pagePrefix(pageIndex);
  await addImage(fabric, canvas, "/assets/builders/standard-inclusions-construction-strip.png", imageOptions(prefix, "construction image strip", "heroImage", 0, 0, PAGE_WIDTH, 188, true));
  addTextbox(fabric, canvas, "Premier Inclusions Schedule", textOptions(prefix, "Premier Inclusions Schedule", 50, 230, 520, 34, "800", NAVY));
  addLine(fabric, canvas, 50, 286, 742, 286, GOLD, 1.5, `${prefix}-title-divider`);
  addFeatureStrip(fabric, canvas, prefix, 316);
  addSectionBlock(fabric, canvas, prefix, "Site Preparation & Foundations", [
    "Site cut allowance for up to 1 metre cross fall",
    "Engineer-designed concrete slab system to suit site conditions",
    "Termite treatment to slab penetrations and perimeter",
  ], 52, 470, 325);
  addSectionBlock(fabric, canvas, prefix, "Structural & External", [
    "70mm T2 treated timber wall framing",
    "T2 treated timber roof trusses designed to engineer's requirements",
    "Colorbond steel roofing with insulation blanket",
  ], 52, 642, 325);
  addSectionBlock(fabric, canvas, prefix, "Laundry", [
    "Choice of 20mm stone benchtops from the builder's standard range",
    "Stainless steel laundry tub",
    "Laminated cabinetry with soft-close hardware",
  ], 52, 790, 325);
  addSectionBlock(fabric, canvas, prefix, "Highlight Inclusions", [
    "20mm stone benchtops",
    "Polytec or Laminex cabinetry",
    "900mm stainless steel appliance package",
    "Quality floor coverings",
    "Dulux paint system",
  ], 430, 470, 310);
  addSectionBlock(fabric, canvas, prefix, "General Inclusions", [
    "Building approvals and standard certification",
    "Energy efficiency assessment",
    "Builder's internal and external clean",
    "Independent quality inspections during construction",
    "12-month maintenance period following handover",
  ], 430, 745, 310);
  addSectionBlock(fabric, canvas, prefix, "Driveway", [
    "Exposed aggregate driveway and paths allowance up to 60m2",
    "Colour selected from the builder's standard range",
  ], 430, 910, 310);
  addTextbox(fabric, canvas, "Quality by standard.\nPersonalised by choice.", textOptions(prefix, "Quality statement", 438, 1000, 205, 26, "500", NAVY, "Georgia", "italic"));
  await addImage(fabric, canvas, "/assets/builders/goodbuild-logo.png", imageOptions(prefix, "Goodbuild logo", "logo", 642, 976, 105, 82));
  addFooter(fabric, canvas, prefix);
  canvas.renderAll();
}

async function buildEditableLifestylePage(canvas, fabric, pageIndex) {
  canvas.clear();
  canvas.setBackgroundColor(WHITE, canvas.renderAll.bind(canvas));
  const prefix = pagePrefix(pageIndex);
  await addImage(fabric, canvas, "/assets/builders/standard-inclusions-family-kitchen.jpg", imageOptions(prefix, "Family kitchen image", "heroImage", 0, 0, PAGE_WIDTH, 490, true));
  canvas.add(new fabric.Path("M 0 420 C 160 520 280 510 398 470 C 544 420 640 420 794 470 L 794 1123 L 0 1123 Z", {
    id: `${prefix}-white-wave-panel`,
    name: "White wave content panel",
    role: "shape",
    fill: WHITE,
    selectable: true,
    evented: true,
  }));
  addTextbox(fabric, canvas, "PREMIER INCLUSIONS", textOptions(prefix, "Premier Inclusions heading", 56, 575, 320, 24, "800", GOLD));
  addTextbox(fabric, canvas, "Designed for\nthe way you live.", textOptions(prefix, "Designed for the way you live", 56, 625, 430, 56, "400", NAVY, "Georgia"));
  addLine(fabric, canvas, 56, 806, 152, 806, GOLD, 4, `${prefix}-gold-heading-line`);
  addTextbox(fabric, canvas, "Our Premier Inclusions provide the perfect balance of quality, style and value, forming the standard specification for every Project Estimate.\n\nDuring your Selections Process, you'll personalise your home by selecting colours, finishes and approved upgrades, with all final inclusions confirmed in your Formal Quotation before your Building Contract is prepared.", textOptions(prefix, "Premier inclusions body", 56, 850, 455, 20, "500", NAVY));
  addCallout(fabric, canvas, prefix, "QUALITY INCLUDED", "Carefully selected fixtures, fittings and finishes.", 545, 620, "Q");
  addCallout(fabric, canvas, prefix, "BUILT FOR LIVING", "Practical, stylish and made for everyday life.", 545, 740, "H");
  addCallout(fabric, canvas, prefix, "YOUR CHOICES", "Personalise your home with colours, finishes and upgrades.", 545, 860, "P");
  addCallout(fabric, canvas, prefix, "CONFIDENCE & CLARITY", "All selections documented in your Formal Quotation.", 545, 980, "D");
  addFooter(fabric, canvas, prefix);
  canvas.renderAll();
}

async function buildEditableSelectionsPage(canvas, fabric, pageIndex) {
  canvas.clear();
  canvas.setBackgroundColor(WHITE, canvas.renderAll.bind(canvas));
  const prefix = pagePrefix(pageIndex);
  await addImage(fabric, canvas, "/assets/builders/standard-inclusions-kitchen-black-white.webp", imageOptions(prefix, "Kitchen image", "heroImage", 0, 0, PAGE_WIDTH, PAGE_HEIGHT, true));
  canvas.add(new fabric.Path("M 488 -70 C 670 -38 815 98 850 260 C 900 486 736 612 530 578 C 372 552 296 438 318 280 C 340 116 356 -24 488 -70 Z", {
    id: `${prefix}-translucent-shape`,
    name: "Translucent text shape",
    role: "shape",
    fill: "rgba(255,255,255,0.72)",
    selectable: true,
    evented: true,
  }));
  addTextbox(fabric, canvas, "Creating homes you'll love coming home to.", textOptions(prefix, "Creating homes heading", 450, 110, 285, 32, "800", NAVY));
  addLine(fabric, canvas, 450, 222, 548, 222, GOLD, 4, `${prefix}-heading-line`);
  addTextbox(fabric, canvas, "The best homes are built around the people who live in them. Our Premier Inclusions provide a carefully selected range of quality fixtures, fittings and finishes, creating the perfect foundation before you personalise your home during the Selections Process.", textOptions(prefix, "Creating homes body", 450, 250, 285, 19, "600", NAVY));
  await addImage(fabric, canvas, "/assets/builders/goodbuild-logo.png", imageOptions(prefix, "Goodbuild logo", "logo", 612, 1000, 122, 76));
  canvas.renderAll();
}

async function buildEditableClosingPage(canvas, fabric, pageIndex) {
  canvas.clear();
  canvas.setBackgroundColor(WHITE, canvas.renderAll.bind(canvas));
  const prefix = pagePrefix(pageIndex);
  await addImage(fabric, canvas, "/assets/builders/standard-inclusions-family-kitchen.jpg", imageOptions(prefix, "Closing hero image", "heroImage", 0, 0, PAGE_WIDTH, 720, true));
  canvas.add(new fabric.Rect({
    id: `${prefix}-bottom-panel`,
    name: "Closing white panel",
    role: "shape",
    left: 0,
    top: 720,
    width: PAGE_WIDTH,
    height: 403,
    fill: WHITE,
  }));
  addTextbox(fabric, canvas, "PREMIER INCLUSIONS", textOptions(prefix, "Premier Inclusions closing heading", 56, 765, 360, 27, "800", GOLD));
  addTextbox(fabric, canvas, "Built on quality.\nPersonalised for your lifestyle.", textOptions(prefix, "Closing subheading", 56, 810, 470, 42, "700", NAVY, "Georgia"));
  addTextbox(fabric, canvas, "Every Project Estimate is prepared using our Premier Inclusions as the standard specification. During your Selections Process you'll personalise your home by confirming colours, finishes and products. Any approved upgrades or changes will be documented in your Formal Quotation before your Building Contract is prepared.", textOptions(prefix, "Closing paragraph", 56, 930, 455, 19, "500", NAVY));
  addTextbox(fabric, canvas, "Thank you for considering Goodbuild Quality Builders.\n\nWe look forward to helping you build a home you'll be proud to own.", textOptions(prefix, "Thank you message", 560, 825, 180, 19, "700", NAVY));
  await addImage(fabric, canvas, "/assets/builders/goodbuild-logo.png", imageOptions(prefix, "Goodbuild logo", "logo", 56, 1024, 145, 62));
  addTextbox(fabric, canvas, "1300 1231 456", textOptions(prefix, "Phone number", 308, 1054, 160, 18, "800", NAVY));
  addTextbox(fabric, canvas, "goodbuild.com.au", textOptions(prefix, "Website", 488, 1054, 180, 18, "800", NAVY));
  canvas.renderAll();
}

function addTextbox(fabric, canvas, text, options = {}) {
  canvas.add(new fabric.Textbox(text, {
    role: "text",
    fontFamily: "Arial",
    fontSize: 22,
    fontWeight: "600",
    fill: NAVY,
    textAlign: "left",
    editable: true,
    ...options,
  }));
}

function textOptions(prefix, name, left, top, width, fontSize, fontWeight = "600", fill = NAVY, fontFamily = "Arial", fontStyle = "normal") {
  return {
    id: `${prefix}-${slug(name)}`,
    name,
    left,
    top,
    width,
    fontSize,
    fontWeight,
    fill,
    fontFamily,
    fontStyle,
    lineHeight: 1.18,
  };
}

function imageOptions(prefix, name, role, left, top, width, height, crop = false) {
  return {
    id: `${prefix}-${slug(name)}`,
    name,
    role,
    assetKind: role === "logo" ? "logo" : "image",
    left,
    top,
    width,
    height,
    crop,
  };
}

function addLine(fabric, canvas, x1, y1, x2, y2, stroke, strokeWidth, name) {
  canvas.add(new fabric.Line([x1, y1, x2, y2], {
    id: `${slug(name)}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    role: "shape",
    stroke,
    strokeWidth,
  }));
}

function addFeatureStrip(fabric, canvas, prefix, top) {
  canvas.add(new fabric.Rect({
    id: `${prefix}-feature-strip`,
    name: "Feature strip panel",
    role: "shape",
    left: 0,
    top,
    width: PAGE_WIDTH,
    height: 104,
    fill: NAVY,
  }));
  addMiniFeature(fabric, canvas, prefix, "Quality Inclusions", "Carefully selected products and finishes designed for quality and value.", 58, top + 26, "Q");
  addMiniFeature(fabric, canvas, prefix, "Complete Specification", "Everything required to build a quality Premier home has been included.", 310, top + 26, "H");
  addMiniFeature(fabric, canvas, prefix, "Exceptional Value", "A balanced specification designed to deliver excellent value.", 560, top + 26, "$");
  addLine(fabric, canvas, 276, top + 22, 276, top + 82, GOLD, 1.5, `${prefix}-feature-divider-1`);
  addLine(fabric, canvas, 526, top + 22, 526, top + 82, GOLD, 1.5, `${prefix}-feature-divider-2`);
}

function addMiniFeature(fabric, canvas, prefix, title, text, left, top, icon) {
  canvas.add(new fabric.Circle({
    id: `${prefix}-${slug(title)}-circle`,
    name: `${title} circle`,
    role: "shape",
    left,
    top,
    radius: 24,
    fill: "transparent",
    stroke: GOLD,
    strokeWidth: 2,
  }));
  addTextbox(fabric, canvas, icon, textOptions(prefix, `${title} icon`, left + 10, top + 8, 28, 20, "800", GOLD));
  addTextbox(fabric, canvas, title, textOptions(prefix, title, left + 62, top + 2, 140, 15, "800", WHITE));
  addTextbox(fabric, canvas, text, textOptions(prefix, `${title} copy`, left + 62, top + 25, 150, 12, "600", WHITE));
}

function addSectionBlock(fabric, canvas, prefix, title, bullets, left, top, width) {
  addTextbox(fabric, canvas, title.toUpperCase(), textOptions(prefix, title, left, top, width, 20, "850", GOLD));
  addLine(fabric, canvas, left, top + 35, left + width, top + 35, GOLD, 1, `${prefix}-${slug(title)}-line`);
  const body = (bullets || []).map((bullet) => `- ${bullet}`).join("\n");
  addTextbox(fabric, canvas, body, textOptions(prefix, `${title} bullets`, left + 5, top + 48, width - 10, 14, "600", NAVY));
}

function addCallout(fabric, canvas, prefix, title, body, left, top, icon) {
  canvas.add(new fabric.Circle({
    id: `${prefix}-${slug(title)}-callout-circle`,
    name: `${title} icon circle`,
    role: "shape",
    left,
    top,
    radius: 23,
    fill: "transparent",
    stroke: GOLD,
    strokeWidth: 1.6,
  }));
  addTextbox(fabric, canvas, icon, textOptions(prefix, `${title} icon`, left + 11, top + 9, 26, 18, "800", GOLD));
  addTextbox(fabric, canvas, title, textOptions(prefix, title, left + 72, top + 2, 150, 14, "850", NAVY));
  addTextbox(fabric, canvas, body, textOptions(prefix, `${title} body`, left + 72, top + 24, 160, 14, "500", NAVY));
  addLine(fabric, canvas, left + 72, top + 84, left + 235, top + 84, GOLD, 1, `${prefix}-${slug(title)}-divider`);
}

function addFooter(fabric, canvas, prefix) {
  addLine(fabric, canvas, 50, 1072, 744, 1072, GOLD, 1.2, `${prefix}-footer-line`);
  addTextbox(fabric, canvas, "1300 1231 456", textOptions(prefix, "Phone number", 86, 1090, 175, 18, "800", NAVY));
  addTextbox(fabric, canvas, "goodbuild.com.au", textOptions(prefix, "Website", 320, 1090, 210, 18, "800", NAVY));
}

function addFeature(fabric, canvas, icon, title, text, left) {
  canvas.add(new fabric.Circle({
    id: `page1-${slug(title)}-icon-circle`,
    name: `${title} icon circle`,
    role: "shape",
    left,
    top: 728,
    radius: 26,
    fill: "transparent",
    stroke: GOLD,
    strokeWidth: 2,
  }));
  addTextbox(fabric, canvas, icon, {
    id: `page1-${slug(title)}-icon`,
    name: `${title} icon`,
    left: left + 14,
    top: 738,
    width: 30,
    fontSize: 26,
    fontWeight: "700",
    fill: GOLD,
    textAlign: "center",
  });
  addTextbox(fabric, canvas, title, {
    id: `page1-${slug(title)}-title`,
    name: title,
    left: left + 72,
    top: 724,
    width: 136,
    fontSize: 16,
    fontWeight: "800",
    fill: WHITE,
  });
  addTextbox(fabric, canvas, text, {
    id: `page1-${slug(title)}-copy`,
    name: `${title} copy`,
    left: left + 72,
    top: 748,
    width: 144,
    fontSize: 14,
    fontWeight: "500",
    fill: WHITE,
    lineHeight: 1.28,
  });
}

function addImage(fabric, canvas, src, options = {}) {
  return new Promise((resolve) => {
    fabric.Image.fromURL(src, (image) => {
      image.set({
        id: options.id,
        name: options.name,
        role: options.role || "image",
        assetKind: options.assetKind || "image",
        left: options.left || 0,
        top: options.top || 0,
        selectable: true,
        evented: true,
      });
      fitObjectToBox(image, options.width || 100, options.height || 100);
      if (options.crop) {
        image.set({
          scaleX: Math.max((options.width || 1) / Math.max(1, image.width || 1), (options.height || 1) / Math.max(1, image.height || 1)),
          scaleY: Math.max((options.width || 1) / Math.max(1, image.width || 1), (options.height || 1) / Math.max(1, image.height || 1)),
          clipPath: new fabric.Rect({
            left: options.left || 0,
            top: options.top || 0,
            width: options.width,
            height: options.height,
            absolutePositioned: true,
          }),
        });
      }
      canvas.add(image);
      resolve(image);
    }, { crossOrigin: "anonymous" });
  });
}

function fitObjectToBox(object, width, height) {
  object.set({
    scaleX: width / Math.max(1, object.width || 1),
    scaleY: height / Math.max(1, object.height || 1),
  });
}

function objectSnapshot(object) {
  const type = isTextObject(object) ? "text" : isImageObject(object) ? "image" : "shape";
  return {
    id: object.id || "",
    name: object.name || object.id || "Selected object",
    role: object.role || "",
    type,
    text: isTextObject(object) ? object.text || "" : "",
    fontSize: Math.round(Number(object.fontSize || 18)),
    fill: colorToHex(object.fill || NAVY),
    stroke: colorToHex(object.stroke || GOLD),
    textAlign: object.textAlign || "left",
    left: object.left || 0,
    top: object.top || 0,
    width: scaledWidth(object),
    height: scaledHeight(object),
  };
}

function isTextObject(object) {
  return ["textbox", "i-text", "text"].includes(object?.type);
}

function isImageObject(object) {
  return object?.type === "image";
}

function scaledWidth(object) {
  return Math.round((object?.width || 0) * (object?.scaleX || 1));
}

function scaledHeight(object) {
  return Math.round((object?.height || 0) * (object?.scaleY || 1));
}

function findObjectByRole(canvas, role) {
  return canvas.getObjects().find((object) => object.role === role);
}

function colorToHex(value) {
  if (typeof value !== "string" || !value.startsWith("#")) return NAVY;
  return value.slice(0, 7);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("File could not be read."));
    reader.readAsDataURL(file);
  });
}

function slug(input) {
  return String(input || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function pagePrefix(pageIndex) {
  return `page${Number(pageIndex || 0) + 1}`;
}

const editorStyles = {
  shell: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 14, alignItems: "start" },
  canvasWrap: { width: PAGE_WIDTH, maxWidth: "100%", overflow: "auto", background: "#e5e7eb", padding: 12, borderRadius: 12, border: "1px solid #cbd5e1" },
  panel: { position: "sticky", top: 90, display: "grid", gap: 10, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 12, padding: 12, maxHeight: "calc(100vh - 120px)", overflow: "auto" },
  panelTitle: { margin: 0, color: NAVY, fontSize: 22, lineHeight: 1.15 },
  helpText: { margin: 0, color: "#475569", fontSize: 13, lineHeight: 1.45, fontWeight: 700 },
  objectPanel: { display: "grid", gap: 9, border: "1px solid #dbeafe", background: "#f8fafc", borderRadius: 10, padding: 10 },
  field: { display: "grid", gap: 5, color: "#475569", fontSize: 12, fontWeight: 900, textTransform: "uppercase" },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #94a3b8", borderRadius: 7, padding: "8px 9px", color: "#0f172a", background: "#ffffff", fontSize: 14, fontWeight: 700 },
  textarea: { width: "100%", minHeight: 92, boxSizing: "border-box", border: "1px solid #94a3b8", borderRadius: 7, padding: "8px 9px", color: "#0f172a", background: "#ffffff", fontSize: 14, fontWeight: 650, fontFamily: "inherit", resize: "vertical", textTransform: "none" },
  colorInput: { width: "100%", height: 36, border: "1px solid #94a3b8", borderRadius: 7, background: "#ffffff" },
  geometryGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 },
  buttonRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  primaryButton: { border: "1px solid #0f766e", background: "#0f766e", color: "#ffffff", borderRadius: 8, padding: "9px 11px", fontWeight: 900, cursor: "pointer" },
  secondaryButton: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f172a", borderRadius: 8, padding: "9px 11px", fontWeight: 900, cursor: "pointer" },
  dangerButton: { border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 8, padding: "9px 11px", fontWeight: 900, cursor: "pointer" },
  status: { margin: 0, border: "1px solid #bae6fd", background: "#eff6ff", color: "#075985", borderRadius: 8, padding: "8px 10px", fontWeight: 800 },
};
