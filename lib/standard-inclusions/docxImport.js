import JSZip from "jszip";
import { createDocument } from "../../components/document-engine/core/documentState.js";
import { createA4Page } from "../../components/document-engine/core/pageEngine.js";
import { createObject } from "../../components/document-engine/core/objectEngine.js";

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const DEFAULT_MARGIN = { top: 72, right: 72, bottom: 72, left: 72 };
const EMU_PER_INCH = 914400;
const TWIPS_PER_INCH = 1440;
const CSS_PX_PER_INCH = 96;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const FIXED_LAYOUT_PAGE_TOLERANCE = 1;

const UNSUPPORTED_FEATURES = [
  { pattern: /<w:pict\b|<v:shape\b|<v:imagedata\b/i, warning: "Legacy Word drawing shapes were detected and may be omitted." },
  { pattern: /<w:object\b|<o:OLEObject\b/i, warning: "Embedded external objects are not editable in the Document Engine." },
  { pattern: /<w:smartTag\b|<w15:chartTrackingRefBased\b/i, warning: "Advanced Word features may be simplified." },
  { pattern: /<w:txbxContent\b/i, warning: "Text boxes require fixed-page import to preserve their position." },
];

export async function importDocxAsStandardDocumentPreview(file, {
  uploadAsset = null,
  onProgress = null,
} = {}) {
  const upload = uploadAsset || defaultUploadAsset;
  const bytes = await readFileBytes(file);
  const zip = await JSZip.loadAsync(bytes);
  const warnings = [];
  const fontSubstitutions = new Map();
  const unsupportedFeatures = [];

  const documentXmlText = await readZipText(zip, "word/document.xml");
  if (!documentXmlText) throw new Error("This DOCX does not contain word/document.xml.");
  UNSUPPORTED_FEATURES.forEach((feature) => {
    if (feature.pattern.test(documentXmlText)) {
      warnings.push(feature.warning);
      unsupportedFeatures.push(feature.warning);
    }
  });

  const documentXml = parseXml(documentXmlText);
  const appXml = parseXml(await readZipText(zip, "docProps/app.xml"));
  const styles = parseStyles(await readZipText(zip, "word/styles.xml"));
  const numbering = parseNumbering(await readZipText(zip, "word/numbering.xml"));
  const relationships = parseRelationships(await readZipText(zip, "word/_rels/document.xml.rels"));
  const headers = await parseHeaderFooterParts(zip, "header");
  const footers = await parseHeaderFooterParts(zip, "footer");
  const structure = inspectDocxStructure({ zip, documentXml, appXml, documentXmlText, headers, footers });
  const layoutMode = chooseDocxLayoutMode(structure);

  onProgress?.({ stage: "extracting" });
  const extracted = await extractDocumentFlow({
    zip,
    documentXml,
    styles,
    numbering,
    relationships,
    headers,
    footers,
    upload,
    onProgress,
    fontSubstitutions,
    warnings,
  });

  onProgress?.({ stage: layoutMode === "fixed-page" ? "fixed-layout" : "paginating" });
  const pages = layoutMode === "fixed-page"
    ? layoutDocxFixedPages({ flow: extracted, structure, warnings })
    : layoutDocxFlowPages(extracted);
  const validation = validateImportedPageCount(structure.sourcePageCount, pages.length, layoutMode, warnings);
  const timestamp = new Date().toISOString();
  const document = createDocument({
    id: `standard-inclusions-docx-${Date.now()}`,
    name: file.name.replace(/\.docx$/i, "") || "Imported Word Standard Inclusions",
    pages,
    activePageId: pages[0]?.id || null,
    metadata: {
      documentType: "standardInclusions",
      documentSource: "docx-import",
      layoutMode: layoutMode === "fixed-page" ? "docx-fixed-page" : "docx-flow",
      sourceFileName: file.name,
      importedAt: timestamp,
      lastSavedAt: timestamp,
      docxPageSettings: extracted.pageSettings || null,
      docxHeader: extracted.header || null,
      docxFooter: extracted.footer || null,
      docxStructure: structure,
      docxPageCountValidation: validation,
      warnings,
      unsupportedFeatures,
      fontSubstitutions: Array.from(fontSubstitutions.values()),
    },
  });

  return {
    source: "docx-import",
    fileName: file.name,
    document,
    pageCount: pages.length,
    sourcePageCount: structure.sourcePageCount,
    layoutMode,
    validation,
    paragraphCount: extracted.blocks.filter((block) => block.type === "paragraph" || block.type === "heading").length,
    tableCount: structure.tableCount,
    imageCount: structure.inlineImageCount + structure.floatingImageCount,
    fixedElementCount: pages.reduce((sum, page) => sum + (page.objects?.length || 0), 0),
    floatingImageCount: structure.floatingImageCount,
    inlineImageCount: structure.inlineImageCount,
    textBoxCount: structure.textBoxCount,
    anchoredObjectCount: structure.anchoredObjectCount,
    sectionCount: structure.sectionCount,
    explicitPageBreakCount: structure.explicitPageBreakCount,
    headerFooterCount: structure.headerFooterCount,
    warnings,
    unsupportedFeatures,
    fontSubstitutions: Array.from(fontSubstitutions.values()),
  };
}

export function relayoutDocxFlowDocument(document) {
  if (document?.metadata?.layoutMode !== "docx-flow") return document;
  const flowBlocks = [];
  const firstPage = Array.isArray(document.pages) ? document.pages[0] : null;
  const pageSettings = firstPage?.data?.docxPageSettings || document.metadata?.docxPageSettings || {};
  const header = firstPage?.data?.docxHeader || document.metadata?.docxHeader || null;
  const footer = firstPage?.data?.docxFooter || document.metadata?.docxFooter || null;
  const pages = Array.isArray(document.pages) ? document.pages : [];
  pages.forEach((page) => {
    (page.objects || [])
      .filter((object) => object.data?.docxFlowBlock && !object.data?.docxRepeated)
      .sort((a, b) => Number(a.data?.flowIndex || 0) - Number(b.data?.flowIndex || 0))
      .forEach((object) => flowBlocks.push(objectToFlowBlock(object)));
  });
  const laidOutPages = layoutDocxFlowPages({ blocks: flowBlocks, pageSettings, header, footer });
  return {
    ...document,
    pages: laidOutPages,
    activePageId: laidOutPages.find((page) => page.id === document.activePageId)?.id || laidOutPages[0]?.id || null,
  };
}

async function readFileBytes(file) {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

async function readZipText(zip, path) {
  const file = zip.file(path);
  return file ? file.async("text") : "";
}

function parseXml(xmlText = "") {
  if (!xmlText) return null;
  const Parser = globalThis.DOMParser;
  if (!Parser) throw new Error("DOCX XML parsing requires DOMParser in this environment.");
  const xml = new Parser().parseFromString(xmlText, "application/xml");
  const parserError = firstByLocalName(xml, "parsererror");
  if (parserError) throw new Error("The DOCX contains invalid XML.");
  return xml;
}

function childrenByLocalName(node, name) {
  return Array.from(node?.childNodes || []).filter((child) => child.nodeType === 1 && child.localName === name);
}

function firstByLocalName(node, name) {
  if (!node) return null;
  if (node.nodeType === 1 && node.localName === name) return node;
  const matches = node.getElementsByTagName?.("*") || [];
  return Array.from(matches).find((child) => child.localName === name) || null;
}

function descendantsByLocalName(node, name) {
  return Array.from(node?.getElementsByTagName?.("*") || []).filter((child) => child.localName === name);
}

function attr(node, localName) {
  if (!node?.attributes) return "";
  return Array.from(node.attributes).find((item) => item.localName === localName)?.value || "";
}

function hasAncestorLocalName(node, name) {
  let current = node?.parentNode || null;
  while (current) {
    if (current.nodeType === 1 && current.localName === name) return true;
    current = current.parentNode || null;
  }
  return false;
}

function inspectDocxStructure({ zip, documentXml, appXml, documentXmlText, headers, footers }) {
  const appPageCount = Number(firstByLocalName(appXml, "Pages")?.textContent || 0) || 0;
  const body = firstByLocalName(documentXml, "body");
  const explicitPageBreakCount = descendantsByLocalName(body, "br").filter((br) => attr(br, "type") === "page").length;
  const sectionCount = Math.max(1, descendantsByLocalName(body, "sectPr").length);
  const anchors = descendantsByLocalName(body, "anchor");
  const inlines = descendantsByLocalName(body, "inline");
  const textBoxes = descendantsByLocalName(body, "txbxContent");
  const vmlShapes = descendantsByLocalName(body, "shape");
  const groupedObjects = descendantsByLocalName(body, "grpSp").length + descendantsByLocalName(body, "group").length;
  const settings = sectionSettings(firstByLocalName(body, "sectPr"));
  const drawingPartCount = Object.keys(zip.files || {}).filter((path) => /^word\/drawings\//i.test(path)).length;
  const mediaCount = Object.keys(zip.files || {}).filter((path) => /^word\/media\//i.test(path)).length;
  return {
    sourcePageCount: appPageCount || explicitPageBreakCount + 1,
    appPageCount,
    explicitPageBreakCount,
    sectionCount,
    pageSettings: settings,
    margin: settings.margin,
    floatingImageCount: anchors.filter((anchor) => descendantsByLocalName(anchor, "blip").length).length,
    inlineImageCount: inlines.filter((inline) => descendantsByLocalName(inline, "blip").length).length,
    textBoxCount: textBoxes.length,
    anchoredObjectCount: anchors.length,
    tableCount: descendantsByLocalName(body, "tbl").length,
    headerFooterCount: (headers?.length || 0) + (footers?.length || 0),
    drawingPartCount,
    mediaCount,
    usesDrawingMl: /<w:drawing\b|<wp:anchor\b|<wp:inline\b|<a:/i.test(documentXmlText),
    usesVml: /<w:pict\b|<v:shape\b|<v:textbox\b|<v:imagedata\b/i.test(documentXmlText),
    usesShapes: vmlShapes.length > 0 || /<wps:wsp\b|<a:sp\b/i.test(documentXmlText),
    groupedObjectCount: groupedObjects,
  };
}

function chooseDocxLayoutMode(structure = {}) {
  return structure.anchoredObjectCount || structure.textBoxCount || structure.usesVml || structure.usesShapes || structure.groupedObjectCount
    ? "fixed-page"
    : "flow";
}

function validateImportedPageCount(sourcePageCount, importedPageCount, layoutMode, warnings) {
  const source = Number(sourcePageCount) || 0;
  const imported = Number(importedPageCount) || 0;
  const mismatch = Boolean(source && Math.abs(source - imported) > FIXED_LAYOUT_PAGE_TOLERANCE);
  const message = mismatch
    ? `The imported page count differs significantly from the source document. Source: ${source} pages. Imported: ${imported} pages.`
    : "";
  if (mismatch) warnings.push(message);
  return { sourcePageCount: source, importedPageCount: imported, layoutMode, mismatch, message };
}

function parseRelationships(xmlText = "") {
  if (!xmlText) return new Map();
  const xml = parseXml(xmlText);
  const map = new Map();
  descendantsByLocalName(xml, "Relationship").forEach((rel) => {
    map.set(attr(rel, "Id"), {
      id: attr(rel, "Id"),
      type: attr(rel, "Type"),
      target: attr(rel, "Target"),
    });
  });
  return map;
}

function parseStyles(xmlText = "") {
  if (!xmlText) return new Map();
  const xml = parseXml(xmlText);
  const styles = new Map();
  descendantsByLocalName(xml, "style").forEach((style) => {
    const id = attr(style, "styleId");
    if (!id) return;
    styles.set(id, {
      id,
      type: attr(style, "type"),
      name: attr(firstByLocalName(style, "name"), "val"),
      basedOn: attr(firstByLocalName(style, "basedOn"), "val"),
      pPr: parseParagraphProperties(firstByLocalName(style, "pPr")),
      rPr: parseRunProperties(firstByLocalName(style, "rPr")),
    });
  });
  return styles;
}

function parseNumbering(xmlText = "") {
  if (!xmlText) return new Map();
  const xml = parseXml(xmlText);
  const abstractLevels = new Map();
  descendantsByLocalName(xml, "abstractNum").forEach((abstractNum) => {
    const abstractId = attr(abstractNum, "abstractNumId");
    const levels = new Map();
    childrenByLocalName(abstractNum, "lvl").forEach((lvl) => {
      levels.set(attr(lvl, "ilvl") || "0", attr(firstByLocalName(lvl, "numFmt"), "val") || "bullet");
    });
    abstractLevels.set(abstractId, levels);
  });
  const nums = new Map();
  descendantsByLocalName(xml, "num").forEach((num) => {
    const numId = attr(num, "numId");
    const abstractId = attr(firstByLocalName(num, "abstractNumId"), "val");
    nums.set(numId, abstractLevels.get(abstractId) || new Map());
  });
  return nums;
}

async function parseHeaderFooterParts(zip, kind) {
  const result = [];
  const pattern = new RegExp(`^word/${kind}\\d+\\.xml$`, "i");
  const paths = Object.keys(zip.files).filter((path) => pattern.test(path)).sort();
  for (const path of paths) {
    const xml = parseXml(await readZipText(zip, path));
    const blocks = [];
    childrenByLocalName(xml.documentElement, "p").forEach((paragraph) => {
      const block = paragraphToFlowBlock(paragraph, new Map(), new Map(), null);
      if (block?.text) blocks.push(block);
    });
    result.push({ path, blocks });
  }
  return result;
}

async function extractDocumentFlow({ zip, documentXml, styles, numbering, relationships, headers, footers, upload, onProgress, fontSubstitutions, warnings }) {
  const body = firstByLocalName(documentXml, "body");
  const blocks = [];
  const fixedElements = [];
  let pageSettings = sectionSettings(firstByLocalName(body, "sectPr"));
  const header = headers[0] || null;
  const footer = footers[0] || null;
  let pageIndex = 0;

  for (const child of Array.from(body?.childNodes || [])) {
    if (child.nodeType !== 1) continue;
    if (child.localName === "p") {
      const paragraphFixedElements = await fixedElementsFromParagraph({
        zip,
        paragraph: child,
        relationships,
        upload,
        onProgress,
        warnings,
        pageIndex,
        styles,
        numbering,
        fontSubstitutions,
      });
      fixedElements.push(...paragraphFixedElements);
      const paragraphBlocks = await paragraphToBlocks({ zip, paragraph: child, styles, numbering, relationships, upload, onProgress, fontSubstitutions, warnings });
      blocks.push(...paragraphBlocks);
      pageIndex += paragraphBlocks.filter((block) => block.type === "pageBreak").length;
    } else if (child.localName === "tbl") {
      blocks.push(tableToFlowBlock(child, styles, numbering, fontSubstitutions));
    } else if (child.localName === "sectPr") {
      pageSettings = sectionSettings(child);
      blocks.push({ type: "sectionBreak", pageSettings });
      pageIndex += 1;
    }
  }
  return { blocks, fixedElements, pageSettings, header, footer };
}

async function fixedElementsFromParagraph({ zip, paragraph, relationships, upload, onProgress, warnings, pageIndex, styles, numbering, fontSubstitutions }) {
  const elements = [];
  const anchors = descendantsByLocalName(paragraph, "anchor");
  for (const anchor of anchors) {
    const rect = wordAnchorToPageRect(anchor);
    const base = {
      pageIndex,
      rect,
      wrapMode: anchorWrapMode(anchor),
      behindText: attr(anchor, "behindDoc") === "1",
      zIndex: Number(attr(anchor, "relativeHeight") || 0) || elements.length,
      rotation: drawingRotation(anchor),
    };
    const textBox = firstByLocalName(anchor, "txbxContent");
    if (textBox) {
      const paragraphs = childrenByLocalName(textBox, "p").map((p) => paragraphToFlowBlock(p, styles, numbering, fontSubstitutions, { includeTextBoxText: true })).filter((block) => block.text);
      elements.push({
        ...base,
        type: "textBox",
        paragraphs,
        text: paragraphs.map((block) => block.text).join("\n"),
        style: {
          ...(paragraphs[0]?.style || {}),
          backgroundColor: shapeFillColor(anchor) || "transparent",
          borderColor: shapeStrokeColor(anchor) || "transparent",
        },
      });
    }
    const blip = firstByLocalName(anchor, "blip");
    const embedId = attr(blip, "embed") || attr(blip, "link");
    const rel = relationships.get(embedId);
    if (rel?.target) {
      const imageRef = await uploadImageRelationship({ zip, rel, upload, onProgress, warnings });
      if (imageRef) {
        elements.push({
          ...base,
          type: "image",
          imageRef,
          alt: attr(firstByLocalName(anchor, "docPr"), "descr") || attr(firstByLocalName(anchor, "docPr"), "name") || rel.target,
          crop: imageCrop(firstByLocalName(anchor, "srcRect")),
        });
      }
    }
    if (!textBox && !rel?.target && (shapeFillColor(anchor) || shapeStrokeColor(anchor))) {
      elements.push({
        ...base,
        type: "shape",
        style: {
          backgroundColor: shapeFillColor(anchor) || "transparent",
          borderColor: shapeStrokeColor(anchor) || "transparent",
        },
      });
    }
  }
  descendantsByLocalName(paragraph, "shape").forEach((shape) => {
    const rect = vmlShapeRect(shape);
    const textBox = firstByLocalName(shape, "txbxContent");
    if (textBox) {
      const paragraphs = childrenByLocalName(textBox, "p").map((p) => paragraphToFlowBlock(p, styles, numbering, fontSubstitutions, { includeTextBoxText: true })).filter((block) => block.text);
      elements.push({
        type: "textBox",
        pageIndex,
        rect,
        zIndex: elements.length,
        paragraphs,
        text: paragraphs.map((block) => block.text).join("\n"),
        style: {
          ...(paragraphs[0]?.style || {}),
          backgroundColor: vmlColor(attr(shape, "fillcolor")) || "transparent",
          borderColor: vmlColor(attr(shape, "strokecolor")) || "transparent",
        },
      });
    }
  });
  return elements;
}

function layoutDocxFixedPages({ flow, structure, warnings }) {
  const settings = structure.pageSettings || flow.pageSettings || { width: A4_WIDTH, height: A4_HEIGHT, margin: DEFAULT_MARGIN };
  const sourcePageCount = Math.max(1, Number(structure.sourcePageCount || 0) || 1);
  const pages = Array.from({ length: sourcePageCount }, (_, index) => createA4Page({
    id: `standard-inclusions-docx-fixed-page-${Date.now()}-${index + 1}`,
    name: `DOCX Page ${index + 1}`,
    width: settings.width || A4_WIDTH,
    height: settings.height || A4_HEIGHT,
    objects: repeatedHeaderFooterObjects(flow, settings, settings.margin || DEFAULT_MARGIN, index + 1),
    data: {
      docxPageSettings: settings,
      docxHeader: flow.header || null,
      docxFooter: flow.footer || null,
      docxLayoutMode: "fixed-page",
      sourcePageIndex: index,
    },
  }));
  const pageObjects = pages.map((page) => [...(page.objects || [])]);
  const margin = { ...DEFAULT_MARGIN, ...(settings.margin || {}) };
  const contentWidth = Math.max(240, (settings.width || A4_WIDTH) - margin.left - margin.right);
  let pageIndex = 0;
  let y = margin.top;
  let flowIndex = 0;

  for (const block of flow.blocks || []) {
    if (block.type === "pageBreak" || block.type === "sectionBreak") {
      pageIndex = Math.min(sourcePageCount - 1, pageIndex + 1);
      y = margin.top;
      continue;
    }
    if (block.type === "spacer") {
      y += block.height || 10;
      continue;
    }
    const height = Math.min(Math.max(18, estimateBlockHeight(block, contentWidth)), Math.max(24, (settings.height || A4_HEIGHT) - margin.top - margin.bottom));
    if (y > margin.top && y + height > (settings.height || A4_HEIGHT) - margin.bottom && pageIndex < sourcePageCount - 1) {
      pageIndex += 1;
      y = margin.top;
    }
    const object = flowBlockToObject(block, {
      x: margin.left + (block.style?.indentLeft || 0),
      y: y + (block.style?.spacingBefore || 0),
      width: contentWidth - (block.style?.indentLeft || 0),
      height: Math.max(12, height - (block.style?.spacingBefore || 0) - (block.style?.spacingAfter || 0)),
      flowIndex,
    });
    if (object) {
      object.data = { ...(object.data || {}), docxFixedFlowBlock: true, sourcePageIndex: pageIndex };
      pageObjects[pageIndex].push(object);
    }
    y += height;
    flowIndex += 1;
  }

  for (const fixed of flow.fixedElements || []) {
    const targetPage = Math.max(0, Math.min(sourcePageCount - 1, Number(fixed.pageIndex || 0)));
    const object = fixedElementToObject(fixed, settings);
    if (object) pageObjects[targetPage].push(object);
  }

  return pages.map((page, index) => createA4Page({
    ...page,
    objects: pageObjects[index].sort((a, b) => Number(a.data?.docxZIndex ?? a.layer ?? 0) - Number(b.data?.docxZIndex ?? b.layer ?? 0)).map((object, layer) => ({ ...object, layer })),
  }));
}

async function paragraphToBlocks({ zip, paragraph, styles, numbering, relationships, upload, onProgress, fontSubstitutions, warnings }) {
  const paragraphBlock = paragraphToFlowBlock(paragraph, styles, numbering, fontSubstitutions);
  const blocks = [];
  const beforeText = [];
  const afterText = [];
  let afterBreak = false;
  let sawPageBreak = false;

  for (const run of childrenByLocalName(paragraph, "r")) {
    const runText = textFromRun(run);
    const pageBreak = descendantsByLocalName(run, "br").some((br) => attr(br, "type") === "page");
    const images = descendantsByLocalName(run, "blip");
    if (runText) (afterBreak ? afterText : beforeText).push(runText);
    for (const blip of images) {
      if (hasAncestorLocalName(blip, "anchor")) continue;
      const embedId = attr(blip, "embed") || attr(blip, "link");
      const rel = relationships.get(embedId);
      if (!rel?.target) continue;
      const image = await imageBlockFromRelationship({ zip, rel, run, upload, onProgress, warnings });
      if (image) blocks.push(image);
    }
    if (pageBreak) {
      sawPageBreak = true;
      afterBreak = true;
    }
  }

  if (sawPageBreak) {
    const firstText = beforeText.join("");
    if (firstText.trim()) blocks.unshift({ ...paragraphBlock, text: firstText, runs: [{ text: firstText, style: paragraphBlock.style }] });
    blocks.push({ type: "pageBreak" });
    const secondText = afterText.join("");
    if (secondText.trim()) blocks.push({ ...paragraphBlock, text: secondText, runs: [{ text: secondText, style: paragraphBlock.style }] });
    return blocks;
  }

  if (paragraphBlock.text) blocks.unshift(paragraphBlock);
  return blocks.length ? blocks : [{ type: "spacer", height: 10 }];
}

function paragraphToFlowBlock(paragraph, styles, numbering, fontSubstitutions, options = {}) {
  const pPr = parseParagraphProperties(firstByLocalName(paragraph, "pPr"));
  const styleId = pPr.styleId;
  const style = styles.get(styleId) || null;
  const runs = childrenByLocalName(paragraph, "r").map((run) => {
    const runStyle = {
      ...(style?.rPr || {}),
      ...parseRunProperties(firstByLocalName(run, "rPr")),
    };
    return { text: textFromRun(run, options), style: mapRunStyle(runStyle, fontSubstitutions) };
  }).filter((run) => run.text);
  const text = runs.map((run) => run.text).join("");
  const list = pPr.numId ? { numId: pPr.numId, level: pPr.numLevel || "0", format: numbering.get(pPr.numId)?.get(pPr.numLevel || "0") || "bullet" } : null;
  const isHeading = /^heading/i.test(style?.name || "") || /^Heading\d+$/i.test(styleId || "");
  const baseStyle = mapRunStyle({ ...(style?.rPr || {}), ...pPr.runStyle }, fontSubstitutions);
  return {
    type: isHeading ? "heading" : "paragraph",
    text,
    runs,
    style: {
      ...baseStyle,
      fontSize: baseStyle.fontSize || (isHeading ? 26 : 15),
      fontWeight: isHeading ? 800 : baseStyle.fontWeight || 400,
      textAlign: pPr.alignment || style?.pPr?.alignment || "left",
      lineHeight: pPr.lineHeight || style?.pPr?.lineHeight || 1.25,
      spacingBefore: pPr.spacingBefore ?? style?.pPr?.spacingBefore ?? (isHeading ? 18 : 4),
      spacingAfter: pPr.spacingAfter ?? style?.pPr?.spacingAfter ?? (isHeading ? 10 : 8),
      indentLeft: pPr.indentLeft || 0,
    },
    list,
  };
}

function textFromRun(run, options = {}) {
  return descendantsByLocalName(run, "t")
    .filter((node) => options.includeTextBoxText || !hasAncestorLocalName(node, "txbxContent"))
    .map((node) => node.textContent || "")
    .join("");
}

function parseParagraphProperties(pPr) {
  if (!pPr) return {};
  const spacing = firstByLocalName(pPr, "spacing");
  const ind = firstByLocalName(pPr, "ind");
  const numPr = firstByLocalName(pPr, "numPr");
  return {
    styleId: attr(firstByLocalName(pPr, "pStyle"), "val"),
    alignment: attr(firstByLocalName(pPr, "jc"), "val"),
    spacingBefore: twipsToPx(attr(spacing, "before")),
    spacingAfter: twipsToPx(attr(spacing, "after")),
    lineHeight: lineHeightFromSpacing(spacing),
    indentLeft: twipsToPx(attr(ind, "left")),
    numId: attr(firstByLocalName(numPr, "numId"), "val"),
    numLevel: attr(firstByLocalName(numPr, "ilvl"), "val"),
    runStyle: parseRunProperties(firstByLocalName(pPr, "rPr")),
  };
}

function parseRunProperties(rPr) {
  if (!rPr) return {};
  return {
    bold: Boolean(firstByLocalName(rPr, "b")),
    italic: Boolean(firstByLocalName(rPr, "i")),
    underline: Boolean(firstByLocalName(rPr, "u")),
    fontFamily: attr(firstByLocalName(rPr, "rFonts"), "ascii") || attr(firstByLocalName(rPr, "rFonts"), "hAnsi"),
    fontSize: halfPointsToPx(attr(firstByLocalName(rPr, "sz"), "val")),
    color: colorValue(attr(firstByLocalName(rPr, "color"), "val")),
    highlight: colorValue(attr(firstByLocalName(rPr, "highlight"), "val")),
  };
}

function mapRunStyle(style = {}, fontSubstitutions) {
  const fontFamily = mapFontFamily(style.fontFamily, fontSubstitutions);
  return {
    fontFamily,
    fontSize: style.fontSize || 15,
    fontWeight: style.bold ? 700 : 400,
    fontStyle: style.italic ? "italic" : "normal",
    textDecoration: style.underline ? "underline" : "none",
    color: style.color || "#111827",
    backgroundColor: style.highlight || "transparent",
  };
}

function mapFontFamily(font = "", fontSubstitutions) {
  const clean = String(font || "").trim();
  if (!clean) return "Inter, Arial, sans-serif";
  const supported = ["Arial", "Georgia", "Times New Roman", "Verdana", "Inter", "Montserrat", "Open Sans", "Roboto"];
  const match = supported.find((item) => item.toLowerCase() === clean.toLowerCase());
  const mapped = match || (/serif|times|georgia/i.test(clean) ? "Georgia, 'Times New Roman', serif" : "Inter, Arial, sans-serif");
  if (clean !== mapped && fontSubstitutions) {
    const key = `${clean}|${mapped}`;
    const existing = fontSubstitutions.get(key);
    if (existing) existing.count += 1;
    else fontSubstitutions.set(key, { originalFont: clean, substitutedFont: mapped, method: match ? "available" : "fallback", count: 1 });
  }
  return mapped;
}

function tableToFlowBlock(table, styles, numbering, fontSubstitutions) {
  const rows = childrenByLocalName(table, "tr").map((tr) => childrenByLocalName(tr, "tc").map((tc) => {
    const tcPr = firstByLocalName(tc, "tcPr");
    const shading = colorValue(attr(firstByLocalName(tcPr, "shd"), "fill"));
    const gridSpan = Number(attr(firstByLocalName(tcPr, "gridSpan"), "val") || 1) || 1;
    const text = childrenByLocalName(tc, "p")
      .map((p) => paragraphToFlowBlock(p, styles, numbering, fontSubstitutions).text)
      .filter(Boolean)
      .join("\n");
    return { text, colSpan: gridSpan, backgroundColor: shading || "transparent" };
  }));
  const columnCount = Math.max(1, ...rows.map((row) => row.reduce((sum, cell) => sum + (cell.colSpan || 1), 0)));
  return {
    type: "table",
    rows,
    columnCount,
    style: { borderColor: "#cbd5e1", textColor: "#111827", fontSize: 13, cellPadding: 8 },
  };
}

async function imageBlockFromRelationship({ zip, rel, run, upload, onProgress, warnings }) {
  const target = rel.target.replace(/^\/?word\//, "");
  const path = target.startsWith("media/") ? `word/${target}` : `word/${target}`;
  const file = zip.file(path);
  if (!file) return null;
  const bytes = await file.async("uint8array");
  if (bytes.length > MAX_IMAGE_BYTES) {
    warnings.push(`Image ${target} exceeds the per-image import limit and was skipped.`);
    return null;
  }
  const contentType = contentTypeForPath(path);
  onProgress?.({ stage: "uploading-image", path, byteLength: bytes.length });
  const imageRef = await upload(`data:${contentType};base64,${bytesToBase64(bytes)}`);
  const extent = firstByLocalName(run, "extent");
  const width = emuToPx(attr(extent, "cx")) || 320;
  const height = emuToPx(attr(extent, "cy")) || 180;
  return {
    type: "image",
    imageRef,
    alt: target,
    width,
    height,
    style: { objectFit: "contain" },
  };
}

async function uploadImageRelationship({ zip, rel, upload, onProgress, warnings }) {
  const target = rel.target.replace(/^\/?word\//, "");
  const path = target.startsWith("media/") ? `word/${target}` : `word/${target}`;
  const file = zip.file(path);
  if (!file) return "";
  const bytes = await file.async("uint8array");
  if (bytes.length > MAX_IMAGE_BYTES) {
    warnings.push(`Image ${target} exceeds the per-image import limit and was skipped.`);
    return "";
  }
  const contentType = contentTypeForPath(path);
  onProgress?.({ stage: "uploading-image", path, byteLength: bytes.length });
  return upload(`data:${contentType};base64,${bytesToBase64(bytes)}`);
}

function fixedElementToObject(element, settings) {
  const rect = normaliseRect(element.rect, settings);
  const shared = {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    rotation: element.rotation || 0,
    data: {
      docxFixedElement: true,
      docxZIndex: element.zIndex || 0,
      sourcePageIndex: element.pageIndex || 0,
      wrapMode: element.wrapMode || "",
      behindText: Boolean(element.behindText),
    },
  };
  if (element.type === "image") {
    return createObject("image", {
      ...shared,
      name: "DOCX anchored image",
      style: { objectFit: "cover" },
      data: { ...shared.data, imageRef: element.imageRef, alt: element.alt || "", crop: element.crop || null },
    });
  }
  if (element.type === "textBox") {
    return createObject("text", {
      ...shared,
      name: "DOCX text box",
      style: {
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: 14,
        lineHeight: 1.2,
        color: "#111827",
        padding: 8,
        ...(element.style || {}),
      },
      data: { ...shared.data, text: element.text || "", paragraphs: element.paragraphs || [], blockType: "textBox" },
    });
  }
  if (element.type === "shape") {
    return createObject("shape", {
      ...shared,
      name: "DOCX shape",
      style: {
        fill: element.style?.backgroundColor || "transparent",
        stroke: element.style?.borderColor || "transparent",
        strokeWidth: 1,
      },
    });
  }
  return null;
}

function normaliseRect(rect = {}, settings = {}) {
  const width = settings.width || A4_WIDTH;
  const height = settings.height || A4_HEIGHT;
  return {
    x: clamp(Number(rect.x) || 0, -width, width * 2),
    y: clamp(Number(rect.y) || 0, -height, height * 2),
    width: clamp(Number(rect.width) || 80, 1, width * 2),
    height: clamp(Number(rect.height) || 40, 1, height * 2),
  };
}

export function twipsToDocumentUnits(value) {
  return twipsToPx(value);
}

export function emuToDocumentUnits(value) {
  return emuToPx(value);
}

export function documentUnitsToTwips(value) {
  const number = Number(value);
  return Number.isFinite(number) ? (number / CSS_PX_PER_INCH) * TWIPS_PER_INCH : 0;
}

export function wordAnchorToPageRect(anchor) {
  const extent = firstByLocalName(anchor, "extent");
  const positionH = firstByLocalName(anchor, "positionH");
  const positionV = firstByLocalName(anchor, "positionV");
  const x = emuToDocumentUnits(firstByLocalName(positionH, "posOffset")?.textContent || 0);
  const y = emuToDocumentUnits(firstByLocalName(positionV, "posOffset")?.textContent || 0);
  return {
    x,
    y,
    width: emuToDocumentUnits(attr(extent, "cx")) || 120,
    height: emuToDocumentUnits(attr(extent, "cy")) || 80,
    relativeFromH: attr(positionH, "relativeFrom") || "page",
    relativeFromV: attr(positionV, "relativeFrom") || "page",
  };
}

function anchorWrapMode(anchor) {
  const wrap = childrenByLocalName(anchor, "wrapNone")[0]
    || childrenByLocalName(anchor, "wrapSquare")[0]
    || childrenByLocalName(anchor, "wrapTight")[0]
    || childrenByLocalName(anchor, "wrapThrough")[0]
    || childrenByLocalName(anchor, "wrapTopAndBottom")[0];
  return wrap?.localName || "";
}

function drawingRotation(node) {
  const xfrm = firstByLocalName(node, "xfrm");
  const raw = Number(attr(xfrm, "rot") || 0);
  return Number.isFinite(raw) ? raw / 60000 : 0;
}

function imageCrop(srcRect) {
  if (!srcRect) return null;
  return {
    left: Number(attr(srcRect, "l") || 0) || 0,
    top: Number(attr(srcRect, "t") || 0) || 0,
    right: Number(attr(srcRect, "r") || 0) || 0,
    bottom: Number(attr(srcRect, "b") || 0) || 0,
  };
}

function shapeFillColor(node) {
  return colorValue(attr(firstByLocalName(node, "solidFill"), "val"))
    || colorValue(attr(firstByLocalName(node, "srgbClr"), "val"))
    || "";
}

function shapeStrokeColor(node) {
  const ln = firstByLocalName(node, "ln");
  return colorValue(attr(firstByLocalName(ln, "srgbClr"), "val")) || "";
}

function vmlShapeRect(shape) {
  const style = String(attr(shape, "style") || "");
  const left = cssLengthToDocumentUnits((/left:([^;]+)/i.exec(style) || [])[1]);
  const top = cssLengthToDocumentUnits((/top:([^;]+)/i.exec(style) || [])[1]);
  const width = cssLengthToDocumentUnits((/width:([^;]+)/i.exec(style) || [])[1]) || 120;
  const height = cssLengthToDocumentUnits((/height:([^;]+)/i.exec(style) || [])[1]) || 80;
  return { x: left, y: top, width, height };
}

function cssLengthToDocumentUnits(value = "") {
  const clean = String(value || "").trim();
  const number = Number(clean.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(number)) return 0;
  if (/pt$/i.test(clean)) return (number / 72) * CSS_PX_PER_INCH;
  if (/in$/i.test(clean)) return number * CSS_PX_PER_INCH;
  if (/cm$/i.test(clean)) return (number / 2.54) * CSS_PX_PER_INCH;
  if (/mm$/i.test(clean)) return (number / 25.4) * CSS_PX_PER_INCH;
  return number;
}

function vmlColor(value = "") {
  const clean = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(clean)) return clean;
  return colorValue(clean.replace(/^#/, ""));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sectionSettings(sectPr) {
  const pgSz = firstByLocalName(sectPr, "pgSz");
  const pgMar = firstByLocalName(sectPr, "pgMar");
  const width = twipsToPx(attr(pgSz, "w")) || A4_WIDTH;
  const height = twipsToPx(attr(pgSz, "h")) || A4_HEIGHT;
  return {
    width: Math.round(width),
    height: Math.round(height),
    orientation: attr(pgSz, "orient") === "landscape" ? "landscape" : "portrait",
    margin: {
      top: twipsToPx(attr(pgMar, "top")) || DEFAULT_MARGIN.top,
      right: twipsToPx(attr(pgMar, "right")) || DEFAULT_MARGIN.right,
      bottom: twipsToPx(attr(pgMar, "bottom")) || DEFAULT_MARGIN.bottom,
      left: twipsToPx(attr(pgMar, "left")) || DEFAULT_MARGIN.left,
    },
  };
}

function layoutDocxFlowPages(flow) {
  const settings = flow.pageSettings || { width: A4_WIDTH, height: A4_HEIGHT, margin: DEFAULT_MARGIN };
  const margin = { ...DEFAULT_MARGIN, ...(settings.margin || {}) };
  const contentWidth = Math.max(240, (settings.width || A4_WIDTH) - margin.left - margin.right);
  const pages = [];
  let pageObjects = [];
  let y = margin.top;
  let flowIndex = 0;

  function pushPage() {
    const pageNumber = pages.length + 1;
    const repeated = repeatedHeaderFooterObjects(flow, settings, margin, pageNumber);
    pages.push(createA4Page({
      id: `standard-inclusions-docx-page-${Date.now()}-${pageNumber}`,
      name: `DOCX Page ${pageNumber}`,
      width: settings.width || A4_WIDTH,
      height: settings.height || A4_HEIGHT,
      objects: [...repeated, ...pageObjects],
      data: { docxPageSettings: settings, docxHeader: flow.header || null, docxFooter: flow.footer || null },
    }));
    pageObjects = [];
    y = margin.top;
  }

  for (const block of flow.blocks || []) {
    if (block.type === "pageBreak" || block.type === "sectionBreak") {
      pushPage();
      continue;
    }
    const height = estimateBlockHeight(block, contentWidth);
    if (y > margin.top && y + height > (settings.height || A4_HEIGHT) - margin.bottom) pushPage();
    const object = flowBlockToObject(block, {
      x: margin.left + (block.style?.indentLeft || 0),
      y: y + (block.style?.spacingBefore || 0),
      width: contentWidth - (block.style?.indentLeft || 0),
      height: Math.max(12, height - (block.style?.spacingBefore || 0) - (block.style?.spacingAfter || 0)),
      flowIndex,
    });
    if (object) pageObjects.push(object);
    y += height;
    flowIndex += 1;
  }
  if (pageObjects.length || !pages.length) pushPage();
  return pages;
}

function repeatedHeaderFooterObjects(flow, settings, margin, pageNumber) {
  const objects = [];
  const headerText = flow.header?.blocks?.map((block) => block.text).filter(Boolean).join("\n") || "";
  const footerText = flow.footer?.blocks?.map((block) => block.text).filter(Boolean).join("\n") || "";
  if (headerText) {
    objects.push(createObject("text", {
      name: "DOCX header",
      x: margin.left,
      y: Math.max(12, margin.top - 46),
      width: (settings.width || A4_WIDTH) - margin.left - margin.right,
      height: 34,
      locked: true,
      style: { fontFamily: "Inter, Arial, sans-serif", fontSize: 10, color: "#475569", lineHeight: 1.2 },
      data: { text: headerText, docxRepeated: true },
      layer: 0,
    }));
  }
  if (footerText) {
    objects.push(createObject("text", {
      name: "DOCX footer",
      x: margin.left,
      y: (settings.height || A4_HEIGHT) - margin.bottom + 12,
      width: (settings.width || A4_WIDTH) - margin.left - margin.right,
      height: 34,
      locked: true,
      style: { fontFamily: "Inter, Arial, sans-serif", fontSize: 10, color: "#475569", lineHeight: 1.2 },
      data: { text: footerText.replace(/\{\{page\}\}/gi, String(pageNumber)), docxRepeated: true },
      layer: 0,
    }));
  }
  return objects;
}

function flowBlockToObject(block, frame) {
  if (block.type === "paragraph" || block.type === "heading") {
    const prefix = block.list ? (block.list.format === "bullet" ? "- " : "1. ") : "";
    return createObject("text", {
      name: block.type === "heading" ? "DOCX heading" : "DOCX paragraph",
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      style: { ...(block.style || {}), lineHeight: block.style?.lineHeight || 1.25 },
      data: { text: `${prefix}${block.text || ""}`, runs: block.runs || [], docxFlowBlock: true, flowIndex: frame.flowIndex, blockType: block.type, list: block.list || null },
    });
  }
  if (block.type === "table") {
    return createObject("table", {
      name: "DOCX table",
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      style: block.style || {},
      data: { rows: block.rows || [], columnCount: block.columnCount || 1, docxFlowBlock: true, flowIndex: frame.flowIndex },
    });
  }
  if (block.type === "image") {
    const width = Math.min(frame.width, block.width || frame.width);
    const height = Math.max(40, (block.height || 180) * (width / Math.max(1, block.width || width)));
    return createObject("image", {
      name: "DOCX image",
      x: frame.x,
      y: frame.y,
      width,
      height: Math.min(frame.height, height),
      style: block.style || { objectFit: "contain" },
      data: { imageRef: block.imageRef, alt: block.alt || "", docxFlowBlock: true, flowIndex: frame.flowIndex },
    });
  }
  if (block.type === "spacer") {
    return createObject("spacer", {
      name: "DOCX spacer",
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      data: { docxFlowBlock: true, flowIndex: frame.flowIndex },
    });
  }
  return null;
}

function objectToFlowBlock(object) {
  if (object.type === "text") {
    return {
      type: object.data?.blockType === "heading" ? "heading" : "paragraph",
      text: object.data?.text || "",
      runs: object.data?.runs || [],
      style: object.style || {},
      list: object.data?.list || null,
    };
  }
  if (object.type === "table") {
    return { type: "table", rows: object.data?.rows || [], columnCount: object.data?.columnCount || 1, style: object.style || {} };
  }
  if (object.type === "image") {
    return { type: "image", imageRef: object.data?.imageRef, alt: object.data?.alt, width: object.width, height: object.height, style: object.style || {} };
  }
  return { type: "spacer", height: object.height || 10 };
}

function estimateBlockHeight(block, width) {
  if (block.type === "table") return Math.max(42, (block.rows?.length || 1) * 34 + 12);
  if (block.type === "image") {
    const imageWidth = Math.min(width, block.width || width);
    return Math.max(60, (block.height || 180) * (imageWidth / Math.max(1, block.width || imageWidth))) + 14;
  }
  if (block.type === "spacer") return block.height || 10;
  const style = block.style || {};
  const fontSize = Number(style.fontSize || 15);
  const lineHeight = Number(style.lineHeight || 1.25);
  const charsPerLine = Math.max(18, Math.floor(width / Math.max(7, fontSize * 0.52)));
  const lines = String(block.text || "").split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  return (style.spacingBefore || 0) + Math.max(fontSize * lineHeight, lines * fontSize * lineHeight) + (style.spacingAfter || 0);
}

function twipsToPx(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? (number / TWIPS_PER_INCH) * CSS_PX_PER_INCH : 0;
}

function halfPointsToPx(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? ((number / 2) / 72) * CSS_PX_PER_INCH : 0;
}

function emuToPx(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? (number / EMU_PER_INCH) * CSS_PX_PER_INCH : 0;
}

function lineHeightFromSpacing(spacing) {
  const line = Number(attr(spacing, "line"));
  if (!Number.isFinite(line) || line <= 0) return 0;
  return Math.max(1, Math.min(2.4, line / 240));
}

function colorValue(value = "") {
  const clean = String(value || "").trim();
  if (!clean || clean === "auto" || clean === "none") return "";
  if (/^[0-9a-f]{6}$/i.test(clean)) return `#${clean}`;
  const named = { yellow: "#fef08a", green: "#bbf7d0", cyan: "#a5f3fc", magenta: "#f0abfc", blue: "#bfdbfe", red: "#fecaca" };
  return named[clean.toLowerCase()] || "";
}

function contentTypeForPath(path = "") {
  if (/\.jpe?g$/i.test(path)) return "image/jpeg";
  if (/\.gif$/i.test(path)) return "image/gif";
  if (/\.webp$/i.test(path)) return "image/webp";
  if (/\.svg$/i.test(path)) return "image/svg+xml";
  return "image/png";
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function defaultUploadAsset(dataUrl) {
  if (!dataUrl) throw new Error("A DOCX image was empty and could not be uploaded.");
  throw new Error("Word document images require an authenticated upload session. Please sign in again, then re-import the Word document.");
}
