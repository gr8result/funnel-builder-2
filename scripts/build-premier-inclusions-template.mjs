import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const PPTX_PATH = "C:\\Users\\grant\\Downloads\\Premier Inclusions Schedule.pptx";
const ROOT = process.cwd();
const TEMPLATE_DIR = path.join(ROOT, "standard-inclusions");
const PAGES_DIR = path.join(TEMPLATE_DIR, "pages");
const ASSETS_DIR = path.join(TEMPLATE_DIR, "assets");
const PUBLIC_ASSETS_DIR = path.join(ROOT, "public", "standard-inclusions", "assets");
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;

const NS = {
  presentation: "http://schemas.openxmlformats.org/presentationml/2006/main",
  drawing: "http://schemas.openxmlformats.org/drawingml/2006/main",
  relationships: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
};

const localName = (node) => String(node?.localName || node?.nodeName || "").split(":").pop();
const children = (node) => Array.from(node?.childNodes || []).filter((child) => child.nodeType === 1);
const firstChild = (node, name) => children(node).find((child) => localName(child) === name) || null;
const descendants = (node, name) => {
  const found = [];
  function walk(current) {
    children(current).forEach((child) => {
      if (localName(child) === name) found.push(child);
      walk(child);
    });
  }
  walk(node);
  return found;
};
const first = (node, name) => descendants(node, name)[0] || null;
const attr = (node, name) => {
  if (!node?.attributes) return "";
  for (const item of Array.from(node.attributes)) {
    if (localName(item) === name) return item.value;
  }
  return "";
};
const attrExact = (node, name) => {
  if (!node?.attributes) return "";
  return Array.from(node.attributes).find((item) => item.name === name)?.value || "";
};
const textValue = (node) => {
  const paragraphs = descendants(node, "p")
    .map((paragraph) => descendants(paragraph, "t").map((item) => item.textContent || "").join("").trim())
    .filter(Boolean);
  if (paragraphs.length) return paragraphs.join("\n");
  return descendants(node, "t").map((item) => item.textContent || "").join("").trim();
};
const asNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const safeId = (value) => String(value || "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

await fs.mkdir(PAGES_DIR, { recursive: true });
await fs.mkdir(ASSETS_DIR, { recursive: true });
await fs.mkdir(PUBLIC_ASSETS_DIR, { recursive: true });

const { DOMParser } = await import("@xmldom/xmldom").catch(async () => {
  const jsdom = await import("jsdom");
  return { DOMParser: new jsdom.JSDOM().window.DOMParser };
});

const zip = await JSZip.loadAsync(await fs.readFile(PPTX_PATH));
const parser = new DOMParser();
const presentationXml = await zip.file("ppt/presentation.xml")?.async("text");
if (!presentationXml) throw new Error("Missing ppt/presentation.xml");
const presentation = parser.parseFromString(presentationXml, "application/xml");
const slideSizeNode = first(presentation, "sldSz");
const slideWidth = asNumber(attr(slideSizeNode, "cx"), 7556500);
const slideHeight = asNumber(attr(slideSizeNode, "cy"), 10693400);
const scale = {
  x: PAGE_WIDTH / slideWidth,
  y: PAGE_HEIGHT / slideHeight,
};

const presentationRels = await readRelationships("ppt/_rels/presentation.xml.rels");
const slideIdNodes = descendants(presentation, "sldId");
const slidePaths = slideIdNodes
  .map((node) => presentationRels[attrExact(node, "r:id") || attr(node, "id")]?.target)
  .filter(Boolean)
  .map((target) => normaliseZipPath("ppt", target));

const pages = [];
const copiedAssets = new Set();

for (let index = 0; index < slidePaths.length; index += 1) {
  const slidePath = slidePaths[index];
  const slideXml = await zip.file(slidePath)?.async("text");
  if (!slideXml) continue;
  const slide = parser.parseFromString(slideXml, "application/xml");
  const rels = await readRelationships(slideRelPath(slidePath));
  const spTree = first(slide, "spTree");
  const objects = [];
  await collectObjects({
    node: spTree,
    slidePath,
    rels,
    objects,
    transform: identityTransform(),
    copiedAssets,
    pageNumber: index + 1,
  });
  const page = {
    id: `premier-inclusions-page-${String(index + 1).padStart(2, "0")}`,
    name: `Page ${String(index + 1).padStart(2, "0")}`,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    unit: "px",
    background: { color: "#ffffff", imageRef: null },
    objects: objects
      .filter((object) => object.width > 0 && object.height > 0)
      .map((object, layer) => ({ ...object, layer })),
  };
  const pageFile = `page-${String(index + 1).padStart(2, "0")}.json`;
  await fs.writeFile(path.join(PAGES_DIR, pageFile), `${JSON.stringify(page, null, 2)}\n`);
  pages.push({ ...page, file: `pages/${pageFile}` });
  console.log(`Page ${index + 1}: ${page.objects.length} native blocks`);
}

const document = {
  id: "premier-inclusions-master-template",
  schemaVersion: 1,
  name: "Premier Inclusions Schedule",
  activePageId: pages[0]?.id || null,
  metadata: {
    documentType: "standardInclusions",
    documentSource: "native-master-template",
    sourceFileName: path.basename(PPTX_PATH),
    sourcePath: PPTX_PATH,
    slideWidth,
    slideHeight,
    pageCount: pages.length,
    generatedAt: new Date().toISOString(),
    immutableMaster: true,
  },
  pages: pages.map(({ file, ...page }) => page),
};

const manifest = {
  ...document,
  pages: pages.map((page) => ({
    id: page.id,
    name: page.name,
    file: page.file,
    objectCount: page.objects.length,
  })),
};

await fs.writeFile(path.join(TEMPLATE_DIR, "premier-inclusions-template.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await fs.writeFile(path.join(TEMPLATE_DIR, "premier-inclusions-template.full.json"), `${JSON.stringify(document, null, 2)}\n`);
console.log(`Wrote ${pages.length} native Premier Inclusions pages.`);

async function collectObjects({ node, slidePath, rels, objects, transform, copiedAssets, pageNumber }) {
  for (const child of children(node)) {
    const kind = localName(child);
    if (kind === "nvGrpSpPr" || kind === "grpSpPr" || kind === "nvSpPr" || kind === "nvPicPr") continue;
    if (kind === "grpSp") {
      const groupTransform = composeTransform(transform, readGroupTransform(child));
      await collectObjects({ node: child, slidePath, rels, objects, transform: groupTransform, copiedAssets, pageNumber });
      continue;
    }
    if (kind === "sp") {
      objects.push(...await shapeObjects(child, slidePath, rels, transform, copiedAssets, pageNumber, objects.length));
      continue;
    }
    if (kind === "pic") {
      const object = await pictureObject(child, slidePath, rels, transform, copiedAssets, pageNumber, objects.length);
      if (object) objects.push(object);
    }
  }
}

async function shapeObjects(node, slidePath, rels, transform, copiedAssets, pageNumber, index) {
  if (first(node, "blip")) {
    const object = await pictureObject(node, slidePath, rels, transform, copiedAssets, pageNumber, index);
    return object ? [object] : [];
  }
  const box = mapBox(readBox(node), transform);
  const text = textValue(node);
  const spPr = firstChild(node, "spPr");
  const fill = solidFill(spPr) || "";
  const stroke = lineColor(spPr) || "";
  const rotation = readRotation(node);
  const name = shapeName(node) || (text ? "Text" : "Shape");
  const objects = [];

  if ((fill && fill !== "transparent") || stroke) {
    objects.push({
      id: `p${pageNumber}-shape-${index}`,
      name: `${name} shape`,
      type: "shape",
      x: px(box.x, "x"),
      y: px(box.y, "y"),
      width: px(box.width, "x"),
      height: px(box.height, "y"),
      rotation,
      locked: false,
      visible: true,
      opacity: opacity(node),
      style: {
        fill: fill || "transparent",
        stroke: stroke || "transparent",
        strokeWidth: stroke ? 1 : 0,
        borderRadius: 0,
      },
      data: {},
    });
  }

  if (text) {
    const run = first(node, "rPr") || first(node, "defRPr");
    objects.push({
      id: `p${pageNumber}-text-${index}`,
      name,
      type: "text",
      x: px(box.x, "x"),
      y: px(box.y, "y"),
      width: Math.max(12, px(box.width, "x")),
      height: Math.max(12, px(box.height, "y")),
      rotation,
      locked: false,
      visible: true,
      opacity: opacity(node),
      style: {
        fontFamily: fontFamily(node) || "Aptos",
        fontSize: fontSize(run, box.height),
        fontWeight: attr(run, "b") === "1" ? "800" : "600",
        color: solidFill(run) || "#0f172a",
        lineHeight: 1.12,
        textAlign: textAlign(node),
      },
      data: { text },
    });
  }

  return objects;
}

async function pictureObject(node, slidePath, rels, transform, copiedAssets, pageNumber, index) {
  const box = mapBox(readBox(node), transform);
  const blip = first(node, "blip");
  const relId = attr(blip, "embed") || attr(blip, "link");
  const target = rels[relId]?.target;
  if (!target) return null;
  const mediaPath = normaliseZipPath(path.posix.dirname(slidePath), target);
  const media = zip.file(mediaPath);
  if (!media) return null;
  const ext = path.posix.extname(mediaPath) || ".png";
  const name = `${safeId(path.posix.basename(mediaPath, ext))}${ext.toLowerCase()}`;
  const assetPath = path.join(ASSETS_DIR, name);
  const publicAssetPath = path.join(PUBLIC_ASSETS_DIR, name);
  if (!copiedAssets.has(name)) {
    const buffer = await media.async("nodebuffer");
    await fs.writeFile(assetPath, buffer);
    await fs.writeFile(publicAssetPath, buffer);
    copiedAssets.add(name);
  }
  const objectName = shapeName(node) || "Image";
  const isLogo = /logo|goodbuild/i.test(objectName) || px(box.width, "x") < 190 && px(box.height, "y") < 140;
  return {
    id: `p${pageNumber}-${isLogo ? "logo" : "image"}-${index}`,
    name: objectName,
    type: isLogo ? "logo" : "image",
    x: px(box.x, "x"),
    y: px(box.y, "y"),
    width: Math.max(1, px(box.width, "x")),
    height: Math.max(1, px(box.height, "y")),
    rotation: readRotation(node),
    locked: false,
    visible: true,
    opacity: opacity(node),
    style: { objectFit: "cover", borderRadius: 0 },
    data: {
      imageRef: `/standard-inclusions/assets/${name}`,
      assetPath: `standard-inclusions/assets/${name}`,
      alt: objectName,
    },
  };
}

function readBox(node) {
  const xfrm = first(node, "xfrm");
  const off = first(xfrm, "off");
  const ext = first(xfrm, "ext");
  return {
    x: asNumber(attr(off, "x")),
    y: asNumber(attr(off, "y")),
    width: asNumber(attr(ext, "cx")),
    height: asNumber(attr(ext, "cy")),
  };
}

function readGroupTransform(node) {
  const xfrm = first(first(node, "grpSpPr"), "xfrm");
  const off = first(xfrm, "off");
  const ext = first(xfrm, "ext");
  const chOff = first(xfrm, "chOff");
  const chExt = first(xfrm, "chExt");
  const childWidth = asNumber(attr(chExt, "cx"), asNumber(attr(ext, "cx"), 1)) || 1;
  const childHeight = asNumber(attr(chExt, "cy"), asNumber(attr(ext, "cy"), 1)) || 1;
  return {
    x: asNumber(attr(off, "x")),
    y: asNumber(attr(off, "y")),
    width: asNumber(attr(ext, "cx"), childWidth),
    height: asNumber(attr(ext, "cy"), childHeight),
    childX: asNumber(attr(chOff, "x")),
    childY: asNumber(attr(chOff, "y")),
    childWidth,
    childHeight,
  };
}

function identityTransform() {
  return {
    x: 0,
    y: 0,
    width: slideWidth,
    height: slideHeight,
    childX: 0,
    childY: 0,
    childWidth: slideWidth,
    childHeight: slideHeight,
  };
}

function composeTransform(parent, child) {
  const mapped = mapBox({ x: child.x, y: child.y, width: child.width, height: child.height }, parent);
  return {
    x: mapped.x,
    y: mapped.y,
    width: mapped.width,
    height: mapped.height,
    childX: child.childX,
    childY: child.childY,
    childWidth: child.childWidth,
    childHeight: child.childHeight,
  };
}

function mapBox(box, transform) {
  const sx = transform.width / (transform.childWidth || 1);
  const sy = transform.height / (transform.childHeight || 1);
  return {
    x: transform.x + (box.x - transform.childX) * sx,
    y: transform.y + (box.y - transform.childY) * sy,
    width: box.width * sx,
    height: box.height * sy,
  };
}

function px(value, axis) {
  return Math.round((Number(value) || 0) * scale[axis] * 100) / 100;
}

function readRotation(node) {
  return Math.round((asNumber(attr(first(node, "xfrm"), "rot")) / 60000) * 100) / 100;
}

function shapeName(node) {
  return attr(first(node, "cNvPr"), "name") || "";
}

function solidFill(node) {
  const fill = firstChild(node, "solidFill");
  const srgb = firstChild(fill, "srgbClr");
  if (srgb) return `#${attr(srgb, "val")}`;
  const scheme = firstChild(fill, "schemeClr");
  if (scheme) return themeColor(attr(scheme, "val"));
  return "";
}

function lineColor(node) {
  const ln = firstChild(node, "ln");
  return solidFill(ln);
}

function opacity(node) {
  const alpha = firstChild(firstChild(node, "solidFill"), "alpha");
  if (!alpha) return 1;
  const value = asNumber(attr(alpha, "val"), 100000);
  return Math.max(0, Math.min(1, value / 100000));
}

function themeColor(value) {
  const colors = {
    bg1: "#ffffff",
    tx1: "#000000",
    bg2: "#f7f3ec",
    tx2: "#1f2937",
    accent1: "#0b2545",
    accent2: "#c89d4a",
    accent3: "#d29a37",
    accent4: "#475569",
    accent5: "#f8fafc",
    accent6: "#166534",
    dk1: "#000000",
    lt1: "#ffffff",
  };
  return colors[value] || "#0f172a";
}

function fontFamily(node) {
  const latin = first(node, "latin");
  return attr(latin, "typeface") || "";
}

function fontSize(run, height) {
  const value = asNumber(attr(run, "sz"));
  if (value) return Math.max(6, Math.round(value / 100));
  return Math.max(8, Math.min(42, Math.round(px(height, "y") / 3.4)));
}

function textAlign(node) {
  const algn = attr(first(node, "pPr"), "algn");
  if (algn === "ctr") return "center";
  if (algn === "r") return "right";
  return "left";
}

async function readRelationships(relPath) {
  const xml = await zip.file(relPath)?.async("text");
  if (!xml) return {};
  const doc = parser.parseFromString(xml, "application/xml");
  const result = {};
  descendants(doc, "Relationship").forEach((rel) => {
    result[attr(rel, "Id")] = {
      target: attr(rel, "Target"),
      type: attr(rel, "Type"),
    };
  });
  return result;
}

function slideRelPath(slidePath) {
  return `${path.posix.dirname(slidePath)}/_rels/${path.posix.basename(slidePath)}.rels`;
}

function normaliseZipPath(base, target) {
  if (target.startsWith("/")) return target.slice(1);
  return path.posix.normalize(path.posix.join(base, target));
}
