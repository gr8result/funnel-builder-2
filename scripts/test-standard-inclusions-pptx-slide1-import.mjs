import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { JSDOM } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(repoRoot, "components", "estimate-builder", "EstimateBuilderWorkbook.js");
const workbookSource = fs.readFileSync(sourcePath, "utf8");
const pptxPath = "C:\\Users\\grant\\Downloads\\Premier Inclusions Schedule.pptx";

function assertSourceIncludes(text, message) {
  assert.ok(workbookSource.includes(text), message);
}

assertSourceIncludes("createPptxSlideImportContext", "Importer must create slide/layout/master context");
assertSourceIncludes("pptxDrawableElementContexts", "Importer must recursively collect grouped elements");
assertSourceIncludes("pptxComposeGroupTransform", "Importer must compose group transforms");
assertSourceIncludes("pptxApplyGroupBox", "Importer must map child coordinates through group transforms");
assertSourceIncludes("pptxImageFillToDocumentObject", "Importer must turn blipFill shapes into image/logo blocks");
assertSourceIncludes("pptxThemeColor", "Importer must resolve theme colours");
assertSourceIncludes("pptxTextRuns", "Importer must preserve text run metadata");

if (!fs.existsSync(pptxPath)) {
  console.log("PowerPoint sample not found; source-code regression checks passed.");
  process.exit(0);
}

const zip = await JSZip.loadAsync(fs.readFileSync(pptxPath));
const parser = new (new JSDOM("").window.DOMParser)();

function localName(node) {
  return node?.localName || String(node?.nodeName || "").split(":").pop();
}

function descendants(node, name) {
  const result = [];
  const visit = (current) => {
    for (const child of Array.from(current?.childNodes || [])) {
      if (child.nodeType !== 1) continue;
      if (!name || localName(child) === name) result.push(child);
      visit(child);
    }
  };
  visit(node);
  return result;
}

function first(node, name) {
  return descendants(node, name)[0] || null;
}

function attr(node, name) {
  return Array.from(node?.attributes || []).find((item) => localName(item) === name)?.value || "";
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

async function xml(zipPath) {
  const text = await zip.file(zipPath)?.async("text");
  return text ? parser.parseFromString(text, "application/xml") : null;
}

async function rels(zipPath) {
  const relPath = `${zipPath.split("/").slice(0, -1).join("/")}/_rels/${zipPath.split("/").pop()}.rels`;
  const doc = await xml(relPath);
  const map = {};
  descendants(doc, "Relationship").forEach((rel) => {
    const id = rel.getAttribute("Id");
    map[id] = {
      id,
      type: rel.getAttribute("Type") || "",
      target: rel.getAttribute("Target") || "",
      path: normaliseZipPath(zipPath.split("/").slice(0, -1).join("/"), rel.getAttribute("Target") || ""),
    };
  });
  return map;
}

function xfrm(node) {
  const xf = first(node, "xfrm");
  const off = first(xf, "off");
  const ext = first(xf, "ext");
  const chOff = first(xf, "chOff");
  const chExt = first(xf, "chExt");
  return {
    x: Number(off?.getAttribute("x") || 0),
    y: Number(off?.getAttribute("y") || 0),
    cx: Number(ext?.getAttribute("cx") || 0),
    cy: Number(ext?.getAttribute("cy") || 0),
    chX: Number(chOff?.getAttribute("x") || 0),
    chY: Number(chOff?.getAttribute("y") || 0),
    chCx: Number(chExt?.getAttribute("cx") || 0),
    chCy: Number(chExt?.getAttribute("cy") || 0),
  };
}

function walk(node, rows = [], group = "") {
  for (const child of Array.from(node?.childNodes || [])) {
    if (child.nodeType !== 1) continue;
    const type = localName(child);
    if (!["grpSp", "pic", "sp", "cxnSp"].includes(type)) continue;
    const name = first(child, "cNvPr")?.getAttribute("name") || "";
    rows.push({
      type,
      name,
      group,
      xfrm: xfrm(child),
      hasBlipFill: Boolean(first(child, "blipFill")),
      blipRels: descendants(child, "blip").map((blip) => attr(blip, "embed") || attr(blip, "link")).filter(Boolean),
      text: descendants(child, "t").map((item) => item.textContent || "").join("").trim(),
    });
    if (type === "grpSp") walk(child, rows, name);
  }
  return rows;
}

const slidePath = "ppt/slides/slide1.xml";
const slideDoc = await xml(slidePath);
const slideRels = await rels(slidePath);
const layoutRel = Object.values(slideRels).find((rel) => /slideLayout$/i.test(rel.type));
const layoutPath = layoutRel?.path || "";
const layoutDoc = layoutPath ? await xml(layoutPath) : null;
const layoutRels = layoutPath ? await rels(layoutPath) : {};
const masterRel = Object.values(layoutRels).find((rel) => /slideMaster$/i.test(rel.type));
const masterPath = masterRel?.path || "";
const masterDoc = masterPath ? await xml(masterPath) : null;
const rows = [
  ...walk(first(slideDoc, "spTree")).map((row) => ({ ...row, source: "slide" })),
  ...walk(first(layoutDoc, "spTree")).map((row) => ({ ...row, source: "layout" })),
  ...walk(first(masterDoc, "spTree")).map((row) => ({ ...row, source: "master" })),
];

const mediaRels = rows.flatMap((row) => row.blipRels.map((relId) => ({ row, relId })));
const unresolved = mediaRels.filter(({ relId }) => {
  const rel = slideRels[relId] || layoutRels[relId] || {};
  return rel.path && !zip.file(rel.path);
});

assert.equal(first(await xml("ppt/presentation.xml"), "sldSz")?.getAttribute("cx"), "7556500");
assert.equal(first(await xml("ppt/presentation.xml"), "sldSz")?.getAttribute("cy"), "10693400");
assert.ok(rows.filter((row) => row.source === "slide").length >= 50, "Slide 1 source elements must be inspected");
assert.ok(rows.filter((row) => row.type === "grpSp").length >= 17, "Slide 1 must include heavy grouping");
assert.ok(rows.filter((row) => row.hasBlipFill).length >= 35, "Slide 1 must include image-filled shapes");
assert.equal(unresolved.length, 0, "Slide 1 media relationships should resolve");

console.log(JSON.stringify({
  slide1: {
    sourceElements: rows.length,
    directSlideElements: rows.filter((row) => row.source === "slide").length,
    groupCount: rows.filter((row) => row.type === "grpSp").length,
    imageFilledShapes: rows.filter((row) => row.hasBlipFill).length,
    textShapes: rows.filter((row) => row.text).length,
    unresolvedMedia: unresolved.length,
    layoutPath,
    masterPath,
  },
}, null, 2));
