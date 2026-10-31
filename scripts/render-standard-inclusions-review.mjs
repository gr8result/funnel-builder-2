import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire, register } from "node:module";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import puppeteer from "puppeteer";
import { getEffectiveProductCatalogue } from "../lib/product-library/catalogueService.js";
import { generateMasterInclusionsSchedule } from "../lib/standard-inclusions/simpleScheduleGenerator.mjs";

const require = createRequire(import.meta.url);
register(`data:text/javascript,${encodeURIComponent(`
  import { readFile } from 'node:fs/promises';
  let typescript;
  export async function initialize(data) { typescript = (await import(data.typescript)).default; }
  export async function load(url, context, nextLoad) {
    if (!url.endsWith('.jsx')) return nextLoad(url, context);
    const source = await readFile(new URL(url), 'utf8');
    return { format: 'module', shortCircuit: true, source: typescript.transpileModule(source, { compilerOptions: { jsx: typescript.JsxEmit.React, module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 } }).outputText };
  }
`)}`, { data: { typescript: pathToFileURL(require.resolve("typescript")).href } });

const { PageRenderer } = await import("../components/document-engine/renderer/pageRenderer.jsx");
const tier = process.argv.includes("--tier") ? process.argv[process.argv.indexOf("--tier") + 1] : "Economy";
if (!["Economy", "Classic", "Premier", "Premium"].includes(tier)) throw new Error("Unknown review tier.");
const scheduleId = process.argv.includes("--schedule-id") ? process.argv[process.argv.indexOf("--schedule-id") + 1] : "";
const directory = path.resolve(`artifacts/test-results/standard-inclusions-${tier.toLowerCase()}-review`);
const pdfName = `${tier}-review.pdf`;
await mkdir(directory, { recursive: true });
const workspaceId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
let branding = {};
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const { handler } = await import("../pages/api/standard-inclusions/branding.js");
  await handler({ method: "GET", workspaceId, user: {} }, {
    setHeader() {}, status() { return this; }, json(payload) {
      if (!payload.ok) throw new Error(payload.error || "Saved builder branding could not be loaded.");
      branding = payload.branding;
    },
  });
}
let generated;
if (scheduleId) {
  const { loadStandardInclusionsSchedule } = await import("../lib/standard-inclusions/pdfLibrary.js");
  const schedule = await loadStandardInclusionsSchedule({ workspaceId, scheduleId });
  if (!schedule || schedule.tierKey !== tier || !schedule.metadata?.brochureDocument) throw new Error("Saved tier review document not found in this workspace.");
  generated = { document: schedule.metadata.brochureDocument, items: schedule.metadata.inclusionsDraft.items, gaps: schedule.metadata.inclusionsDraft.gapDetails };
} else generated = generateMasterInclusionsSchedule({ scheduleId: `${tier.toLowerCase()}-review-artifact`, tier, products: getEffectiveProductCatalogue({ organisationId: workspaceId }).products, branding });
await writeFile(path.join(directory, "document.json"), JSON.stringify(generated.document));
const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:794px 1123px;margin:0}body{margin:0;font-family:Arial}.sheet{break-after:page;width:794px;height:1123px;overflow:hidden}.sheet:last-child{break-after:auto}*{box-sizing:border-box}</style></head><body>${generated.document.pages.map(page => `<section class="sheet">${renderToStaticMarkup(React.createElement(PageRenderer, { page, exportMode: true }))}</section>`).join("")}</body></html>`;
let embeddedHtml = html;
const assetDirectory = path.join(directory, "assets");
await mkdir(assetDirectory, { recursive: true });
for (const source of new Set([...html.matchAll(/src="([^"]+)"/g)].map(match => match[1]))) {
  if (source.startsWith("data:")) continue;
  const cachePath = path.join(assetDirectory, createHash("sha256").update(source).digest("hex"));
  let bytes;
  let type = "image/png";
  if (source.startsWith("/")) {
    bytes = await readFile(path.resolve("public", `.${source}`));
    type = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" }[path.extname(source)] || type;
  } else {
    try { bytes = await readFile(cachePath); }
    catch {
      const response = await fetch(source.replaceAll("&amp;", "&"), { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`Review image unavailable: ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(cachePath, bytes);
    }
  }
  embeddedHtml = embeddedHtml.replaceAll(`src="${source}"`, `src="data:${type};base64,${bytes.toString("base64")}"`);
}
const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 1200 });
  await page.setContent(embeddedHtml, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
  });
  const images = await page.evaluate(() => [...document.images].map(image => ({ src: image.src.slice(0, 100), loaded: image.complete && image.naturalWidth > 0 })));
  if (images.some(image => !image.loaded)) throw new Error("At least one PDF image failed to decode; do not accept this render.");
  const textProblems = await page.evaluate(() => {
    const problems = [];
    for (const sheet of document.querySelectorAll("[data-document-page-id]")) {
      const texts = [...sheet.querySelectorAll('[data-document-object-type="text"]')];
      for (const text of texts) {
        const content = text.querySelector("div");
        if (content && content.scrollHeight > content.clientHeight + 2) problems.push({ page: sheet.dataset.documentPageId, object: text.dataset.documentObjectName, problem: "text-overflow" });
      }
      for (let index = 0; index < texts.length; index += 1) for (const other of texts.slice(index + 1)) {
        const first = texts[index].getBoundingClientRect();
        const second = other.getBoundingClientRect();
        if (Math.min(first.right, second.right) - Math.max(first.left, second.left) > 10 && Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > 2) problems.push({ page: sheet.dataset.documentPageId, object: texts[index].dataset.documentObjectName, other: other.dataset.documentObjectName, problem: "text-collision" });
      }
    }
    return problems;
  });
  if (textProblems.length) throw new Error(`Rendered text requires correction: ${JSON.stringify(textProblems)}`);
  await page.pdf({ path: path.join(directory, pdfName), printBackground: true, preferCSSPageSize: true });
  await writeFile(path.join(directory, "evidence.json"), JSON.stringify({ pageCount: generated.document.pages.length, matched: generated.items.filter(item => item.product).length, gaps: generated.gaps, images, textProblems, note: "Production PageRenderer visual review. Does not replace authenticated browser workflow acceptance." }, null, 2));
  console.log(JSON.stringify({ directory, pages: generated.document.pages.length, matches: generated.items.filter(item => item.product).length, failedImages: images.filter(image => !image.loaded).length }));
} finally { await browser.close(); }

const canvas = await import("@napi-rs/canvas");
globalThis.DOMMatrix = canvas.DOMMatrix;
globalThis.ImageData = canvas.ImageData;
globalThis.Path2D = canvas.Path2D;
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
const loadingTask = getDocument({ data: new Uint8Array(await readFile(path.join(directory, pdfName))), useSystemFonts: true });
const pdf = await loadingTask.promise;
for (let number = 1; number <= pdf.numPages; number += 1) {
  const page = await pdf.getPage(number);
  const viewport = page.getViewport({ scale: 1.2 });
  const image = canvas.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvasContext: image.getContext("2d"), viewport }).promise;
  await writeFile(path.join(directory, `page-${String(number).padStart(2, "0")}.png`), image.toBuffer("image/png"));
}
await loadingTask.destroy();
console.log("Exported PDF rasterized page by page for visual inspection.");