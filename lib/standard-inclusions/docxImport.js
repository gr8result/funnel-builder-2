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

const UNSUPPORTED_FEATURES = [
  { pattern: /<w:pict\b|<v:shape\b|<v:imagedata\b/i, warning: "Legacy Word drawing shapes were detected and may be omitted." },
  { pattern: /<w:object\b|<o:OLEObject\b/i, warning: "Embedded external objects are not editable in the Document Engine." },
  { pattern: /<w:smartTag\b|<w15:chartTrackingRefBased\b/i, warning: "Advanced Word features may be simplified." },
  { pattern: /<w:txbxContent\b/i, warning: "Text boxes are imported as normal flow content where possible." },
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
  const styles = parseStyles(await readZipText(zip, "word/styles.xml"));
  const numbering = parseNumbering(await readZipText(zip, "word/numbering.xml"));
  const relationships = parseRelationships(await readZipText(zip, "word/_rels/document.xml.rels"));
  const headers = await parseHeaderFooterParts(zip, "header");
  const footers = await parseHeaderFooterParts(zip, "footer");

  onProgress?.({ stage: "extracting" });
  const flow = await extractDocumentFlow({
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

  onProgress?.({ stage: "paginating" });
  const pages = layoutDocxFlowPages(flow);
  const timestamp = new Date().toISOString();
  const document = createDocument({
    id: `standard-inclusions-docx-${Date.now()}`,
    name: file.name.replace(/\.docx$/i, "") || "Imported Word Standard Inclusions",
    pages,
    activePageId: pages[0]?.id || null,
    metadata: {
      documentType: "standardInclusions",
      documentSource: "docx-import",
      layoutMode: "docx-flow",
      sourceFileName: file.name,
      importedAt: timestamp,
      lastSavedAt: timestamp,
      docxPageSettings: flow.pageSettings || null,
      docxHeader: flow.header || null,
      docxFooter: flow.footer || null,
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
    paragraphCount: flow.blocks.filter((block) => block.type === "paragraph" || block.type === "heading").length,
    tableCount: flow.blocks.filter((block) => block.type === "table").length,
    imageCount: flow.blocks.filter((block) => block.type === "image").length,
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
  let pageSettings = sectionSettings(firstByLocalName(body, "sectPr"));
  const header = headers[0] || null;
  const footer = footers[0] || null;

  for (const child of Array.from(body?.childNodes || [])) {
    if (child.nodeType !== 1) continue;
    if (child.localName === "p") {
      const paragraphBlocks = await paragraphToBlocks({ zip, paragraph: child, styles, numbering, relationships, upload, onProgress, fontSubstitutions, warnings });
      blocks.push(...paragraphBlocks);
    } else if (child.localName === "tbl") {
      blocks.push(tableToFlowBlock(child, styles, numbering, fontSubstitutions));
    } else if (child.localName === "sectPr") {
      pageSettings = sectionSettings(child);
      blocks.push({ type: "sectionBreak", pageSettings });
    }
  }
  return { blocks, pageSettings, header, footer };
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

function paragraphToFlowBlock(paragraph, styles, numbering, fontSubstitutions) {
  const pPr = parseParagraphProperties(firstByLocalName(paragraph, "pPr"));
  const styleId = pPr.styleId;
  const style = styles.get(styleId) || null;
  const runs = childrenByLocalName(paragraph, "r").map((run) => {
    const runStyle = {
      ...(style?.rPr || {}),
      ...parseRunProperties(firstByLocalName(run, "rPr")),
    };
    return { text: textFromRun(run), style: mapRunStyle(runStyle, fontSubstitutions) };
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

function textFromRun(run) {
  return descendantsByLocalName(run, "t").map((node) => node.textContent || "").join("");
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
