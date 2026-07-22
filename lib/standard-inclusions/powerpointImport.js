import JSZip from "jszip";
import { createDocument } from "../../components/document-engine/core/documentState.js";
import { createA4Page } from "../../components/document-engine/core/pageEngine.js";
import { createObject } from "../../components/document-engine/core/objectEngine.js";

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;

export async function importPptxAsStandardDocumentPreview(file, options = {}) {
  const zip = await JSZip.loadAsync(await readPowerPointBuffer(file));
  const parser = await createXmlParser();
  const presentationXml = await zip.file("ppt/presentation.xml")?.async("text");
  if (!presentationXml) throw new Error("PowerPoint file is incomplete: ppt/presentation.xml was not received.");
  const presentationDoc = parser.parseFromString(presentationXml, "application/xml");
  const presentationRels = await readPptxRelationships(zip, "ppt/_rels/presentation.xml.rels", parser);
  const slideSize = pptxSlideSize(presentationDoc);
  const slidePaths = pptxSlidePaths(zip, presentationDoc, presentationRels);
  if (!slidePaths.length) throw new Error("No slides found in the PowerPoint file.");

  const pages = [];
  const warnings = [];
  let editableTextCount = 0;
  let fixedVisualCount = 0;
  const renderedSlideImages = Array.isArray(options.renderedSlideImages) ? options.renderedSlideImages : [];
  const hybridBaseAvailable = renderedSlideImages.length > 0;
  const missingFonts = new Set();
  for (let index = 0; index < slidePaths.length; index += 1) {
    const slidePath = slidePaths[index];
    const slideXml = await zip.file(slidePath)?.async("text");
    if (!slideXml) {
      warnings.push(`Slide ${index + 1}: slide XML was missing and was skipped.`);
      continue;
    }
    const slideDoc = parser.parseFromString(slideXml, "application/xml");
    const rels = await readPptxRelationships(zip, pptxSlideRelPath(slidePath), parser);
    const context = await createPptxSlideImportContext({ zip, parser, slideDoc, slidePath, rels, slideSize });
    const { objects, warningCount, fonts } = hybridBaseAvailable
      ? await pptxSlideToEditableOverlayObjects({ zip, context, pageNumber: index + 1 })
      : await pptxSlideToDocumentObjects({ zip, context, pageNumber: index + 1 });
    (fonts || []).forEach((font) => {
      if (font && !pptxFontAvailable(font)) missingFonts.add(font);
    });
    editableTextCount += objects.filter((object) => object.type === "text").length;
    fixedVisualCount += hybridBaseAvailable ? 1 : objects.filter((object) => object.data?.fixedVisual === true).length;
    if (!hybridBaseAvailable && warningCount) warnings.push(`Slide ${index + 1}: ${warningCount} unsupported element${warningCount === 1 ? "" : "s"} could not be converted to native blocks.`);
    pages.push(createA4Page({
      id: `standard-inclusions-pptx-page-${Date.now()}-${index + 1}`,
      name: `Slide ${index + 1}`,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      background: { color: "#ffffff", imageRef: renderedSlideImages[index] || null },
      objects,
    }));
  }

  if (hybridBaseAvailable && renderedSlideImages.length !== pages.length) {
    warnings.push(`Rendered slide base count mismatch: ${renderedSlideImages.length}/${pages.length} slide images were available.`);
  }
  if (!hybridBaseAvailable) {
    warnings.push("High-fidelity slide rendering was not available; this preview used the legacy object conversion and may not visually match the PowerPoint.");
  }
  if (missingFonts.size) {
    warnings.push(`Missing PowerPoint font${missingFonts.size === 1 ? "" : "s"} detected: ${Array.from(missingFonts).sort().join(", ")}. Install these fonts on the render server/browser to avoid substitution.`);
  }

  if (options.expectedSlideCount && pages.length !== options.expectedSlideCount) {
    throw new Error(`PowerPoint import incomplete: ${pages.length}/${options.expectedSlideCount} slides were imported.`);
  }

  const timestamp = new Date().toISOString();
  const fileName = file?.name || options.fileName || "Imported PowerPoint Standard Inclusions.pptx";
  const documentBuilder = createDocument({
    id: `standard-inclusions-pptx-${Date.now()}`,
    name: fileName.replace(/\.pptx$/i, "") || "Imported PowerPoint Standard Inclusions",
    pages,
    activePageId: pages[0]?.id || null,
    metadata: {
      documentType: "standardInclusions",
      documentSource: "pptx-import",
      sourceFileName: fileName,
      sourceType: "powerpoint",
      importedAt: timestamp,
      lastSavedAt: timestamp,
      nativeImport: true,
      importMode: hybridBaseAvailable ? "pptx-hybrid-rendered-base" : "pptx-object-conversion",
      editableSource: "pptx",
      visualBaseSource: hybridBaseAvailable ? "onlyoffice-rendered-slide-image" : "native-object-conversion",
      pageCoordinateSystem: { width: PAGE_WIDTH, height: PAGE_HEIGHT, unit: "px" },
      slideSizeEmu: slideSize,
      missingFonts: Array.from(missingFonts).sort(),
    },
  });
  return { source: "pptx-import", fileName, document: documentBuilder, pageCount: pages.length, editableTextCount, fixedVisualCount, warnings };
}

async function readPowerPointBuffer(file) {
  if (file?.arrayBuffer) return file.arrayBuffer();
  if (file instanceof ArrayBuffer) return file;
  if (ArrayBuffer.isView(file)) return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  throw new Error("PowerPoint file could not be read.");
}

async function createXmlParser() {
  if (typeof DOMParser !== "undefined") return new DOMParser();
  throw new Error("PowerPoint import requires DOMParser. Run it in the browser or provide a DOMParser test shim.");
}

async function createPptxSlideImportContext({ zip, parser, slideDoc, slidePath, rels, slideSize }) {
  const layoutRel = Object.values(rels || {}).find((rel) => /slideLayout$/i.test(rel.type || ""));
  const layoutPath = layoutRel?.target ? normaliseZipPath(slidePath.split("/").slice(0, -1).join("/"), layoutRel.target) : "";
  const layoutDoc = layoutPath ? parser.parseFromString(await zip.file(layoutPath)?.async("text") || "", "application/xml") : null;
  const layoutRels = layoutPath ? await readPptxRelationships(zip, pptxSlideRelPath(layoutPath), parser) : {};
  const masterRel = Object.values(layoutRels || {}).find((rel) => /slideMaster$/i.test(rel.type || ""));
  const masterPath = masterRel?.target ? normaliseZipPath(layoutPath.split("/").slice(0, -1).join("/"), masterRel.target) : "";
  const masterDoc = masterPath ? parser.parseFromString(await zip.file(masterPath)?.async("text") || "", "application/xml") : null;
  const masterRels = masterPath ? await readPptxRelationships(zip, pptxSlideRelPath(masterPath), parser) : {};
  const themeRel = Object.values(masterRels || {}).find((rel) => /theme$/i.test(rel.type || ""));
  const themePath = themeRel?.target ? normaliseZipPath(masterPath.split("/").slice(0, -1).join("/"), themeRel.target) : "";
  const themeDoc = themePath ? parser.parseFromString(await zip.file(themePath)?.async("text") || "", "application/xml") : null;
  return { slideDoc, slidePath, rels, layoutDoc, layoutPath, layoutRels, masterDoc, masterPath, masterRels, themeDoc, themePath, slideSize };
}

async function pptxSlideToDocumentObjects({ zip, context, pageNumber }) {
  const elementContexts = [
    ...pptxDrawableElementContexts(context.masterDoc, context.masterPath, context.masterRels, context, { inherited: true, sourceLayer: "master" }),
    ...pptxDrawableElementContexts(context.layoutDoc, context.layoutPath, context.layoutRels, context, { inherited: true, sourceLayer: "layout" }),
    ...pptxDrawableElementContexts(context.slideDoc, context.slidePath, context.rels, context, { inherited: false, sourceLayer: "slide" }),
  ];
  const objects = [];
  let warningCount = 0;
  for (const item of elementContexts) {
    const name = localName(item.element);
    if (name === "pic") {
      const object = await pptxPictureToDocumentObject({ zip, ...item, pageNumber });
      if (object) objects.push(object);
      else warningCount += 1;
    } else if (name === "sp") {
      objects.push(...await pptxShapeToDocumentObjects({ zip, ...item, pageNumber }));
    } else if (name === "cxnSp") {
      objects.push(pptxLineToDocumentObject({ ...item, pageNumber }));
    } else {
      warningCount += 1;
    }
  }
  return { objects: objects.map((object, layer) => ({ ...object, layer })), warningCount };
}

async function pptxSlideToEditableOverlayObjects({ zip, context, pageNumber }) {
  const elementContexts = [
    ...pptxDrawableElementContexts(context.masterDoc, context.masterPath, context.masterRels, context, { inherited: true, sourceLayer: "master" }),
    ...pptxDrawableElementContexts(context.layoutDoc, context.layoutPath, context.layoutRels, context, { inherited: true, sourceLayer: "layout" }),
    ...pptxDrawableElementContexts(context.slideDoc, context.slidePath, context.rels, context, { inherited: false, sourceLayer: "slide" }),
  ];
  const objects = [];
  const fonts = new Set();
  for (const item of elementContexts) {
    const name = localName(item.element);
    if (name === "sp") {
      const text = pptxText(item.element);
      pptxTextRuns(item.element, item.themeDoc).forEach((run) => {
        if (run.fontFamily) fonts.add(run.fontFamily);
      });
      if (text && pptxIsEditableText(item.element, text)) {
        const style = pptxTextStyle(item.element, item.box, item.themeDoc);
        if (style.fontFamily) fonts.add(style.fontFamily);
        objects.push(createObject("text", {
          name: pptxElementName(item.element) || `Editable PowerPoint text ${pageNumber}`,
          x: item.box.left,
          y: item.box.top,
          width: Math.max(20, item.box.width),
          height: Math.max(12, item.box.height),
          rotation: item.box.rotation,
          opacity: item.box.opacity,
          style,
          data: {
            text,
            sourceLayer: item.sourceLayer,
            groupPath: item.groupPath,
            zOrder: item.zOrder,
            sourceXmlPath: item.sourcePath,
            runs: pptxTextRuns(item.element, item.themeDoc),
            overlayMode: "pptx-text-activation",
            editableSource: "pptx",
            duplicateSuppression: "hidden-until-edited",
          },
        }));
      }
      const imageFill = await pptxImageFillToDocumentObject({ zip, ...item });
      if (imageFill && pptxIsReplaceableImageObject(imageFill)) {
        objects.push(pptxActivationImageObject(imageFill));
      }
    } else if (name === "pic") {
      const object = await pptxPictureToDocumentObject({ zip, ...item, pageNumber });
      if (object && pptxIsReplaceableImageObject(object)) {
        objects.push(pptxActivationImageObject(object));
      }
    }
  }
  return { objects: objects.map((object, layer) => ({ ...object, layer })), warningCount: 0, fonts: Array.from(fonts) };
}

async function pptxShapeToDocumentObjects({ zip, element, box, rels, sourcePath, themeDoc, sourceLayer, groupPath, zOrder }) {
  const text = pptxText(element);
  const imageFill = await pptxImageFillToDocumentObject({ zip, element, box, rels, sourcePath, sourceLayer, groupPath, zOrder });
  const fill = pptxShapeFill(element, themeDoc) || "transparent";
  const stroke = pptxLineColor(element, themeDoc) || "transparent";
  const name = pptxElementName(element) || (text ? "PowerPoint text" : "PowerPoint shape");
  const objects = [];
  if (imageFill) {
    objects.push(imageFill);
  } else if ((fill !== "transparent" || stroke !== "transparent") && !pptxIsTextOnlyShape(element)) {
    objects.push(createObject("shape", {
      name: text ? `${name} panel` : name,
      x: box.left,
      y: box.top,
      width: Math.max(1, box.width),
      height: Math.max(1, box.height),
      rotation: box.rotation,
      opacity: box.opacity,
      style: { fill, stroke, strokeWidth: stroke === "transparent" ? 0 : 1.5, borderRadius: 0 },
      data: { sourceLayer, groupPath, zOrder, sourceXmlPath: sourcePath },
    }));
  }
  if (text) {
    objects.push(createObject("text", {
      name,
      x: box.left,
      y: box.top,
      width: Math.max(20, box.width),
      height: Math.max(12, box.height),
      rotation: box.rotation,
      opacity: box.opacity,
      style: pptxTextStyle(element, box, themeDoc),
      data: { text, sourceLayer, groupPath, zOrder, sourceXmlPath: sourcePath, runs: pptxTextRuns(element, themeDoc) },
    }));
  }
  return objects;
}

async function pptxPictureToDocumentObject({ zip, element, box, sourcePath, rels, sourceLayer, groupPath, zOrder }) {
  const blip = firstByLocalName(element, "blip");
  const embedId = attrByLocalName(blip, "embed") || attrByLocalName(blip, "link");
  const target = rels?.[embedId]?.target;
  if (!target) return null;
  const mediaPath = normaliseZipPath(sourcePath.split("/").slice(0, -1).join("/"), target);
  const media = zip.file(mediaPath);
  if (!media) return null;
  const ext = mediaPath.split(".").pop()?.toLowerCase() || "png";
  const objectType = /logo/i.test(pptxElementName(element)) ? "logo" : "image";
  return createObject(objectType, {
    name: pptxElementName(element) || "PowerPoint image",
    x: box.left,
    y: box.top,
    width: Math.max(1, box.width),
    height: Math.max(1, box.height),
    rotation: box.rotation,
    opacity: box.opacity,
    style: { objectFit: objectType === "logo" ? "contain" : "cover" },
    data: {
      imageRef: `data:${pptxMimeType(ext)};base64,${await media.async("base64")}`,
      alt: pptxElementName(element) || "PowerPoint image",
      relationshipId: embedId,
      mediaPath,
      sourceLayer,
      groupPath,
      zOrder,
      sourceXmlPath: sourcePath,
      crop: pptxImageCrop(element),
    },
  });
}

function pptxLineToDocumentObject({ element, box, themeDoc, sourcePath, sourceLayer, groupPath, zOrder, pageNumber }) {
  const stroke = pptxLineColor(element, themeDoc) || "#d29a37";
  return createObject("shape", {
    name: pptxElementName(element) || `PowerPoint line ${pageNumber}`,
    x: box.left,
    y: box.top,
    width: Math.max(1, Math.abs(box.width)),
    height: Math.max(1, Math.abs(box.height) || 2),
    rotation: box.rotation,
    opacity: box.opacity,
    style: { fill: stroke, stroke, strokeWidth: 0, borderRadius: 0 },
    data: { sourceLayer, groupPath, zOrder, sourceXmlPath: sourcePath },
  });
}

function pptxDrawableElementContexts(doc, sourcePath, rels, context, options = {}) {
  const spTree = firstByLocalName(doc, "spTree");
  if (!spTree || !sourcePath) return [];
  const rootTransform = pptxIdentityGroupTransform(context.slideSize);
  const rows = [];
  let zOrder = 0;
  const walk = (parent, groupTransform, groupPath = "") => {
    Array.from(parent?.childNodes || []).forEach((element) => {
      if (element.nodeType !== 1) return;
      const name = localName(element);
      if (!["grpSp", "pic", "sp", "cxnSp"].includes(name)) return;
      const elementName = pptxElementName(element);
      const nextGroupPath = groupPath ? `${groupPath} / ${elementName || name}` : (elementName || name);
      if (name === "grpSp") {
        walk(element, pptxComposeGroupTransform(groupTransform, pptxGroupTransform(element)), nextGroupPath);
        return;
      }
      if (options.inherited && pptxIsPlaceholder(element)) return;
      rows.push({
        element,
        box: pptxElementBox(element, context.slideSize, groupTransform),
        sourcePath,
        rels,
        slideSize: context.slideSize,
        themeDoc: context.themeDoc,
        sourceLayer: options.sourceLayer || "slide",
        groupPath,
        inherited: Boolean(options.inherited),
        zOrder: zOrder += 1,
      });
    });
  };
  walk(spTree, rootTransform);
  return rows;
}

function pptxIdentityGroupTransform(slideSize) {
  return {
    x: 0,
    y: 0,
    cx: Number(slideSize?.cx || 1),
    cy: Number(slideSize?.cy || 1),
    chX: 0,
    chY: 0,
    chCx: Number(slideSize?.cx || 1),
    chCy: Number(slideSize?.cy || 1),
    rotation: 0,
    flipH: false,
    flipV: false,
  };
}

function pptxGroupTransform(element) {
  const xfrm = firstByLocalName(element, "xfrm");
  const off = firstByLocalName(xfrm, "off");
  const ext = firstByLocalName(xfrm, "ext");
  const chOff = firstByLocalName(xfrm, "chOff");
  const chExt = firstByLocalName(xfrm, "chExt");
  return {
    x: Number(off?.getAttribute("x")) || 0,
    y: Number(off?.getAttribute("y")) || 0,
    cx: Number(ext?.getAttribute("cx")) || 0,
    cy: Number(ext?.getAttribute("cy")) || 0,
    chX: Number(chOff?.getAttribute("x")) || 0,
    chY: Number(chOff?.getAttribute("y")) || 0,
    chCx: Number(chExt?.getAttribute("cx")) || 0,
    chCy: Number(chExt?.getAttribute("cy")) || 0,
    rotation: pptxRotationDegrees(xfrm),
    flipH: xfrm?.getAttribute("flipH") === "1",
    flipV: xfrm?.getAttribute("flipV") === "1",
  };
}

function pptxComposeGroupTransform(parent, child) {
  const parentScaleX = Number(parent.cx || 0) / Math.max(1, Number(parent.chCx || parent.cx || 1));
  const parentScaleY = Number(parent.cy || 0) / Math.max(1, Number(parent.chCy || parent.cy || 1));
  return {
    x: Number(parent.x || 0) + (Number(child.x || 0) - Number(parent.chX || 0)) * parentScaleX,
    y: Number(parent.y || 0) + (Number(child.y || 0) - Number(parent.chY || 0)) * parentScaleY,
    cx: Number(child.cx || 0) * parentScaleX,
    cy: Number(child.cy || 0) * parentScaleY,
    chX: Number(child.chX || 0),
    chY: Number(child.chY || 0),
    chCx: Number(child.chCx || child.cx || 1),
    chCy: Number(child.chCy || child.cy || 1),
    rotation: (Number(parent.rotation || 0) + Number(child.rotation || 0)) % 360,
    flipH: Boolean(parent.flipH) !== Boolean(child.flipH),
    flipV: Boolean(parent.flipV) !== Boolean(child.flipV),
  };
}

function pptxRotationDegrees(xfrm) {
  return (Number(xfrm?.getAttribute("rot") || 0) / 60000) || 0;
}

function pptxApplyGroupBox(local, groupTransform, slideSize) {
  const scaleX = Number(groupTransform.cx || 0) / Math.max(1, Number(groupTransform.chCx || slideSize.cx || 1));
  const scaleY = Number(groupTransform.cy || 0) / Math.max(1, Number(groupTransform.chCy || slideSize.cy || 1));
  let x = Number(groupTransform.x || 0) + (Number(local.x || 0) - Number(groupTransform.chX || 0)) * scaleX;
  let y = Number(groupTransform.y || 0) + (Number(local.y || 0) - Number(groupTransform.chY || 0)) * scaleY;
  const cx = Number(local.cx || 0) * scaleX;
  const cy = Number(local.cy || 0) * scaleY;
  if (groupTransform.flipH) x = Number(groupTransform.x || 0) + Number(groupTransform.cx || 0) - (x - Number(groupTransform.x || 0)) - cx;
  if (groupTransform.flipV) y = Number(groupTransform.y || 0) + Number(groupTransform.cy || 0) - (y - Number(groupTransform.y || 0)) - cy;
  return { x, y, cx, cy };
}

function pptxElementBox(element, slideSize, groupTransform = pptxIdentityGroupTransform(slideSize)) {
  const xfrm = firstByLocalName(element, "xfrm");
  const off = firstByLocalName(xfrm, "off");
  const ext = firstByLocalName(xfrm, "ext");
  const x = Number(off?.getAttribute("x")) || 0;
  const y = Number(off?.getAttribute("y")) || 0;
  const cx = Number(ext?.getAttribute("cx")) || 0;
  const cy = Number(ext?.getAttribute("cy")) || 0;
  const absolute = pptxApplyGroupBox({ x, y, cx, cy }, groupTransform, slideSize);
  return {
    sourceX: x,
    sourceY: y,
    sourceCx: cx,
    sourceCy: cy,
    absoluteX: absolute.x,
    absoluteY: absolute.y,
    absoluteCx: absolute.cx,
    absoluteCy: absolute.cy,
    left: (absolute.x / slideSize.cx) * PAGE_WIDTH,
    top: (absolute.y / slideSize.cy) * PAGE_HEIGHT,
    width: (absolute.cx / slideSize.cx) * PAGE_WIDTH,
    height: (absolute.cy / slideSize.cy) * PAGE_HEIGHT,
    rotation: (pptxRotationDegrees(xfrm) + Number(groupTransform.rotation || 0)) % 360,
    opacity: pptxElementOpacity(element),
  };
}

async function readPptxRelationships(zip, relPath, parser) {
  const relXml = await zip.file(relPath)?.async("text");
  if (!relXml) return {};
  const relDoc = parser.parseFromString(relXml, "application/xml");
  const rels = {};
  Array.from(relDoc.getElementsByTagName("Relationship")).forEach((rel) => {
    const id = rel.getAttribute("Id");
    if (!id) return;
    rels[id] = {
      target: rel.getAttribute("Target") || "",
      type: rel.getAttribute("Type") || "",
    };
  });
  return rels;
}

function pptxSlideSize(presentationDoc) {
  const size = firstByLocalName(presentationDoc, "sldSz");
  return {
    cx: Number(size?.getAttribute("cx")) || 9144000,
    cy: Number(size?.getAttribute("cy")) || 12801600,
  };
}

function pptxSlidePaths(zip, presentationDoc, presentationRels) {
  const slideIds = Array.from(firstByLocalName(presentationDoc, "sldIdLst")?.childNodes || [])
    .filter((node) => node.nodeType === 1 && localName(node) === "sldId");
  const ordered = slideIds
    .map((slideId) => presentationRels[attrByLocalName(slideId, "id")]?.target)
    .filter(Boolean)
    .map((target) => normaliseZipPath("ppt", target));
  if (ordered.length) return ordered;
  return Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)\.xml/i)?.[1] || 0) - Number(b.match(/slide(\d+)\.xml/i)?.[1] || 0));
}

function pptxSlideRelPath(slidePath) {
  const parts = slidePath.split("/");
  const fileName = parts.pop();
  return `${parts.join("/")}/_rels/${fileName}.rels`;
}

function pptxText(element) {
  const paragraphs = descendantsByLocalName(element, "p")
    .map((paragraph) => descendantsByLocalName(paragraph, "t").map((node) => node.textContent || "").join(""))
    .filter((text) => text.trim());
  return paragraphs.join("\n").trim();
}

function pptxTextRuns(element, themeDoc = null) {
  return descendantsByLocalName(element, "r")
    .map((run) => {
      const rPr = firstByLocalName(run, "rPr");
      const text = descendantsByLocalName(run, "t").map((node) => node.textContent || "").join("");
      return {
        text,
        fontFamily: pptxFontFamily(run) || pptxFontFamily(element) || "Arial",
        fontSize: pptxFontSize(run, 18),
        bold: pptxIsBold(run),
        italic: rPr?.getAttribute("i") === "1",
        color: pptxSolidFill(rPr, themeDoc) || pptxTextColor(element, themeDoc) || "#0f172a",
      };
    })
    .filter((run) => run.text);
}

function pptxTextStyle(element, box, themeDoc = null) {
  return {
    fontFamily: pptxFontFamily(element) || "Arial",
    fontSize: pptxFontSize(element, box.height),
    fontWeight: pptxIsBold(element) ? "800" : "600",
    fontStyle: firstByLocalName(element, "rPr")?.getAttribute("i") === "1" ? "italic" : "normal",
    color: pptxTextColor(element, themeDoc) || "#0f172a",
    textAlign: pptxTextAlign(element),
    lineHeight: pptxLineHeight(element),
  };
}

function pptxIsEditableText(element, text = "") {
  const value = String(text || "").trim();
  if (!value) return false;
  const name = pptxElementName(element).toLowerCase();
  if (/page\s*number|slide\s*number|footer|copyright|decorative/i.test(name)) return false;
  return true;
}

function pptxIsReplaceableImageObject(object) {
  const name = `${object?.name || ""} ${object?.data?.alt || ""} ${object?.data?.groupPath || ""}`.toLowerCase();
  if (/logo|brand|icon|arrow|check|tick|facebook|instagram|linkedin|youtube|footer|divider|line|background|texture|pattern/.test(name)) return false;
  const area = Number(object?.width || 0) * Number(object?.height || 0);
  return area >= 9000;
}

function pptxActivationImageObject(object) {
  return {
    ...object,
    data: {
      ...(object.data || {}),
      overlayMode: "pptx-image-activation",
      editableSource: "pptx",
      duplicateSuppression: "hidden-until-edited",
      sourceImageRef: object.data?.imageRef || "",
    },
  };
}

function pptxFontAvailable(fontFamily) {
  const font = String(fontFamily || "").trim();
  if (!font || /^(\+mj|\+mn|theme|body|headings)$/i.test(font)) return true;
  if (typeof document === "undefined" || !document.fonts?.check) return true;
  try {
    return document.fonts.check(`12px "${font}"`);
  } catch {
    return true;
  }
}

function pptxFontSize(element, fallbackHeight = 30) {
  const rPr = firstByLocalName(element, "rPr");
  const sz = Number(rPr?.getAttribute("sz"));
  if (Number.isFinite(sz) && sz > 0) return Math.max(5, Math.round((sz / 100) * 1.333));
  return Math.max(9, Math.min(64, Math.round(fallbackHeight / 1.8)));
}

function pptxFontFamily(element) {
  return firstByLocalName(element, "latin")?.getAttribute("typeface") || "";
}

function pptxIsBold(element) {
  return firstByLocalName(element, "rPr")?.getAttribute("b") === "1";
}

function pptxTextAlign(element) {
  const algn = firstByLocalName(element, "pPr")?.getAttribute("algn") || "l";
  if (algn === "ctr" || algn === "center") return "center";
  if (algn === "r" || algn === "right") return "right";
  return "left";
}

function pptxLineHeight(element) {
  const lnSpc = firstByLocalName(firstByLocalName(element, "pPr"), "lnSpc");
  const pct = Number(firstByLocalName(lnSpc, "spcPct")?.getAttribute("val"));
  if (Number.isFinite(pct) && pct > 0) return Math.max(0.7, Math.min(2.2, pct / 100000));
  return 1.12;
}

function pptxTextColor(element, themeDoc = null) {
  return pptxSolidFill(firstByLocalName(element, "rPr"), themeDoc) || "#0f172a";
}

function childByLocalName(node, name) {
  return Array.from(node?.childNodes || []).find((child) => child.nodeType === 1 && localName(child) === name) || null;
}

function pptxSolidFill(element, themeDoc = null) {
  const solid = childByLocalName(element, "solidFill");
  if (!solid) return "";
  const srgbNode = childByLocalName(solid, "srgbClr");
  const srgb = srgbNode?.getAttribute("val");
  if (srgb) return pptxApplyColourTransforms(`#${srgb}`, srgbNode);
  const schemeNode = childByLocalName(solid, "schemeClr");
  const scheme = schemeNode?.getAttribute("val");
  return pptxApplyColourTransforms(pptxSchemeColor(scheme, themeDoc), schemeNode);
}

function pptxShapeFill(element, themeDoc = null) {
  return pptxSolidFill(firstByLocalName(element, "spPr"), themeDoc);
}

function pptxLineColor(element, themeDoc = null) {
  return pptxSolidFill(firstByLocalName(firstByLocalName(element, "spPr"), "ln"), themeDoc);
}

function pptxSchemeColor(value = "", themeDoc = null) {
  const themeColor = pptxThemeColor(value, themeDoc);
  if (themeColor) return themeColor;
  const map = {
    tx1: "#0f172a",
    tx2: "#334155",
    bg1: "#ffffff",
    bg2: "#f8fafc",
    accent1: "#0b2545",
    accent2: "#d29a37",
    accent3: "#166534",
  };
  return map[value] || "";
}

function pptxThemeColor(value = "", themeDoc = null) {
  if (!value || !themeDoc) return "";
  const clrScheme = firstByLocalName(themeDoc, "clrScheme");
  const node = Array.from(clrScheme?.childNodes || []).find((child) => child.nodeType === 1 && localName(child) === value);
  const srgb = firstByLocalName(node, "srgbClr")?.getAttribute("val");
  if (srgb) return `#${srgb}`;
  const sys = firstByLocalName(node, "sysClr")?.getAttribute("lastClr");
  return sys ? `#${sys}` : "";
}

function pptxApplyColourTransforms(color, node) {
  if (!color) return "";
  const alpha = Number(firstByLocalName(node, "alpha")?.getAttribute("val"));
  if (Number.isFinite(alpha) && alpha >= 0 && alpha < 100000) return pptxHexToRgba(color, alpha / 100000);
  const tint = Number(firstByLocalName(node, "tint")?.getAttribute("val"));
  const shade = Number(firstByLocalName(node, "shade")?.getAttribute("val"));
  if (Number.isFinite(tint) && tint > 0) return pptxMixColor(color, "#ffffff", tint / 100000);
  if (Number.isFinite(shade) && shade > 0) return pptxMixColor(color, "#000000", 1 - shade / 100000);
  return color;
}

function pptxMixColor(color, target, amount) {
  const source = pptxHexRgb(color);
  const dest = pptxHexRgb(target);
  if (!source || !dest) return color;
  const mix = (a, b) => Math.round(a + (b - a) * Math.max(0, Math.min(1, amount)));
  return `#${[mix(source.r, dest.r), mix(source.g, dest.g), mix(source.b, dest.b)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function pptxHexRgb(color) {
  const hex = String(color || "").replace("#", "").slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
}

function pptxHexToRgba(color, alpha) {
  const rgb = pptxHexRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

async function pptxImageFillToDocumentObject({ zip, element, box, rels, sourcePath, sourceLayer, groupPath, zOrder }) {
  const blipFill = firstByLocalName(element, "blipFill");
  const blip = firstByLocalName(blipFill, "blip");
  const embedId = attrByLocalName(blip, "embed") || attrByLocalName(blip, "link");
  const target = rels?.[embedId]?.target;
  if (!embedId || !target) return null;
  const mediaPath = normaliseZipPath(sourcePath.split("/").slice(0, -1).join("/"), target);
  const media = zip.file(mediaPath);
  if (!media) return null;
  const ext = mediaPath.split(".").pop()?.toLowerCase() || "png";
  const objectType = /logo|brand/i.test(pptxElementName(element)) ? "logo" : "image";
  return createObject(objectType, {
    name: pptxElementName(element) || "PowerPoint image fill",
    x: box.left,
    y: box.top,
    width: Math.max(1, box.width),
    height: Math.max(1, box.height),
    rotation: box.rotation,
    opacity: box.opacity,
    style: { objectFit: objectType === "logo" ? "contain" : "cover" },
    data: {
      imageRef: `data:${pptxMimeType(ext)};base64,${await media.async("base64")}`,
      alt: pptxElementName(element) || "PowerPoint image fill",
      relationshipId: embedId,
      mediaPath,
      crop: pptxImageCrop(element),
      sourceLayer,
      groupPath,
      zOrder,
      sourceXmlPath: sourcePath,
      imageFill: true,
    },
  });
}

function pptxImageCrop(element) {
  const srcRect = firstByLocalName(firstByLocalName(element, "blipFill"), "srcRect");
  if (!srcRect) return null;
  return {
    left: Number(srcRect.getAttribute("l") || 0) / 100000,
    top: Number(srcRect.getAttribute("t") || 0) / 100000,
    right: Number(srcRect.getAttribute("r") || 0) / 100000,
    bottom: Number(srcRect.getAttribute("b") || 0) / 100000,
  };
}

function pptxElementOpacity(element) {
  const alpha = Number(firstByLocalName(element, "alpha")?.getAttribute("val"));
  if (Number.isFinite(alpha) && alpha >= 0) return Math.max(0, Math.min(1, alpha / 100000));
  return 1;
}

function pptxIsPlaceholder(element) {
  return Boolean(firstByLocalName(element, "ph"));
}

function pptxIsTextOnlyShape(element) {
  return Boolean(pptxText(element)) && !firstByLocalName(element, "solidFill") && !firstByLocalName(element, "blipFill") && !pptxLineColor(element);
}

function pptxElementName(element) {
  return firstByLocalName(element, "cNvPr")?.getAttribute("name") || "";
}

function pptxMimeType(ext) {
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "svg") return "image/svg+xml";
  return "image/png";
}

function normaliseZipPath(baseDir, target = "") {
  const raw = target.startsWith("/") ? target.slice(1) : `${baseDir}/${target}`;
  const parts = [];
  raw.split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") parts.pop();
    else parts.push(part);
  });
  return parts.join("/");
}

function localName(node) {
  return node?.localName || String(node?.nodeName || "").split(":").pop();
}

function firstByLocalName(node, name) {
  if (!node) return null;
  return descendantsByLocalName(node, name)[0] || null;
}

function descendantsByLocalName(node, name) {
  if (!node) return [];
  const matches = [];
  const visit = (current) => {
    Array.from(current?.childNodes || []).forEach((child) => {
      if (child.nodeType === 1) {
        if (localName(child) === name) matches.push(child);
        visit(child);
      }
    });
  };
  visit(node);
  return matches;
}

function attrByLocalName(node, name) {
  if (!node?.attributes) return "";
  const attr = Array.from(node.attributes).find((item) => localName(item) === name);
  return attr?.value || "";
}
