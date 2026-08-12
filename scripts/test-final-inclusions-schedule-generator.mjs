import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  buildProjectEstimateDocumentSequence,
  createFinalInclusionsDocumentVersion,
  createProjectInclusionsSnapshot,
  finalInclusionsPdfMergePlan,
  groupSnapshotSelections,
  isFinalInclusionsDocumentOutOfDate,
  normaliseProjectEstimateInclusionsDocument,
  renderFinalInclusionsScheduleHtml,
  renderProductCardHtml,
} from "../lib/builders/finalInclusionsSchedule.js";
import {
  FinalInclusionsPdfError,
  createLocalFinalInclusionsStorage,
  generateAndStoreFinalInclusionsPdf,
  mergeFinalInclusionsPdfBinaries,
  readPdfFile,
  renderDynamicFinalInclusionsPdf,
  validatePdfBytes,
} from "../lib/builders/finalInclusionsPdfExecution.js";

const project = {
  id: "project-1",
  workspace_id: "workspace-1",
  project_name: "Araluen Display",
  client_name: "Grant Client",
  site_address: "12 Sample Street",
  currency: "AUD",
  original_estimate_total: 650000,
};

const session = {
  id: "session-1",
  project_id: "project-1",
  snapshot_id: "estimate-1",
  session_name: "Approved Client Selections",
  status: "approved",
  original_estimate_total: 650000,
  private_upgrade_ceiling: 0,
};

const PRODUCT_IMAGES = {
  oven: productImage("Oven", "#0f766e"),
  cooktop: productImage("Cooktop", "#475569"),
  sink: productImage("Sink", "#527d8c"),
  tapware: productImage("Tapware", "#d6a23a"),
  brick: productImage("Bricks", "#a85032"),
  generic: productImage("Generic", "#6d5f9a"),
};

const selections = [
  {
    id: "sel-oven",
    session_id: "session-1",
    snapshot_id: "estimate-1",
    category: "Kitchen",
    subcategory: "Appliances",
    room: "Kitchen",
    selected_product_name: "Serie 6 Built-In Oven",
    selected_supplier_name: "Winning Appliances",
    selected_colour: "Stainless Steel",
    selected_finish: "Brushed",
    brand: "Bosch",
    model_number: "HBA534BS0A",
    image_url: PRODUCT_IMAGES.oven,
    included_allowance: 1200,
    client_selection_price: 1780,
    calculated_client_selection_price: 1780,
    variation_amount: 580,
    selection_status: "approved",
    is_active: true,
    metadata: { client_visible: true, selection_visibility: "client" },
    selected_details: {
      productName: "Serie 6 Built-In Oven",
      builderCost: 990,
      internalNotes: "hide this",
      colour: "Stainless Steel",
      primaryImage: PRODUCT_IMAGES.oven,
    },
    builder_cost: 990,
    markup_percent: 25,
    updated_at: "2026-08-12T01:00:00.000Z",
  },
  {
    id: "sel-cooktop",
    session_id: "session-1",
    snapshot_id: "estimate-1",
    category: "Kitchen",
    subcategory: "Appliances",
    room: "Kitchen",
    selected_product_name: "Gas Cooktop",
    selected_supplier_name: "Winning Appliances",
    selected_colour: "Black Glass",
    selected_finish: "Glass",
    brand: "Fisher & Paykel",
    model_number: "CG604",
    image_url: PRODUCT_IMAGES.cooktop,
    included_allowance: 0,
    client_selection_price: 0,
    variation_amount: 0,
    selection_status: "approved",
    is_active: true,
    updated_at: "2026-08-12T01:00:30.000Z",
  },
  {
    id: "sel-sink",
    session_id: "session-1",
    snapshot_id: "estimate-1",
    category: "Interior",
    subcategory: "Plumbing",
    room: "Bathroom",
    selected_product_name: "Undermount Basin",
    selected_supplier_name: "Reece",
    selected_colour: "White",
    selected_finish: "Gloss",
    brand: "Milli",
    model_number: "BASIN-01",
    image_url: PRODUCT_IMAGES.sink,
    included_allowance: 0,
    client_selection_price: 0,
    variation_amount: 0,
    selection_status: "approved",
    is_active: true,
    updated_at: "2026-08-12T01:00:40.000Z",
  },
  {
    id: "sel-tapware",
    session_id: "session-1",
    snapshot_id: "estimate-1",
    category: "Interior",
    subcategory: "Tapware",
    room: "Bathroom",
    selected_product_name: "Gooseneck Mixer",
    selected_supplier_name: "Reece",
    selected_colour: "Brushed Nickel",
    selected_finish: "Brushed",
    brand: "Phoenix",
    model_number: "MIX-02",
    image_url: PRODUCT_IMAGES.tapware,
    included_allowance: 0,
    client_selection_price: 0,
    variation_amount: 0,
    selection_status: "approved",
    is_active: true,
    updated_at: "2026-08-12T01:00:50.000Z",
  },
  {
    id: "sel-brick",
    session_id: "session-1",
    snapshot_id: "estimate-1",
    category: "Exterior",
    subcategory: "Brickwork",
    room: "Facade",
    product_name: "La Paloma Face Brick",
    selected_supplier_name: "Austral",
    brand: "Austral",
    model_number: "Miro",
    selected_finish: "Textured",
    image_url: PRODUCT_IMAGES.brick,
    included_allowance: 0,
    client_selection_price: 0,
    variation_amount: 0,
    selection_status: "approved",
    is_active: true,
    metadata: { client_selectable: true },
    selected_details: { clientPrice: 0, allowance: 0 },
    updated_at: "2026-08-12T01:01:00.000Z",
  },
  {
    id: "sel-generic-family",
    session_id: "session-1",
    snapshot_id: "estimate-1",
    category: "Interior",
    subcategory: "Hardware",
    room: "General",
    selected_product_name: "Approved Family Product",
    selected_supplier_name: "Approved Range",
    selected_finish: "To be confirmed",
    image_url: PRODUCT_IMAGES.generic,
    included_allowance: 0,
    client_selection_price: 0,
    variation_amount: 0,
    selection_status: "approved",
    is_active: true,
    updated_at: "2026-08-12T01:01:30.000Z",
  },
  {
    id: "sel-bedroom-one",
    session_id: "session-1",
    snapshot_id: "estimate-1",
    category: "Interior",
    subcategory: "Paint",
    room: "Bedroom 1",
    selected_product_name: "Low Sheen Interior Paint",
    selected_colour: "Lexicon Quarter",
    selected_finish: "Low Sheen",
    included_allowance: 300,
    client_selection_price: 260,
    variation_amount: -40,
    selection_status: "approved",
    is_active: true,
    updated_at: "2026-08-12T01:02:00.000Z",
  },
  {
    id: "sel-bedroom-two",
    session_id: "session-1",
    snapshot_id: "estimate-1",
    category: "Interior",
    subcategory: "Paint",
    room: "Bedroom 2",
    selected_product_name: "Low Sheen Interior Paint",
    selected_colour: "Natural White",
    selected_finish: "Low Sheen",
    included_allowance: 300,
    client_selection_price: 300,
    variation_amount: 0,
    selection_status: "approved",
    is_active: true,
    updated_at: "2026-08-12T01:03:00.000Z",
  },
  {
    id: "sel-internal",
    session_id: "session-1",
    snapshot_id: "estimate-1",
    category: "Margin Review",
    room: "Office",
    selected_product_name: "Internal Cost Adjustment",
    included_allowance: 0,
    client_selection_price: 0,
    variation_amount: 0,
    selection_status: "approved",
    is_active: true,
    metadata: { selection_visibility: "internal" },
    builder_cost: 1,
  },
  {
    id: "sel-replaced",
    session_id: "session-1",
    snapshot_id: "estimate-1",
    category: "Kitchen",
    room: "Kitchen",
    selected_product_name: "Old Oven",
    selection_status: "replaced",
    is_active: false,
  },
];

const snapshot = createProjectInclusionsSnapshot({
  project,
  workspaceId: "workspace-1",
  selections,
  session,
  estimateSnapshot: { id: "estimate-1", snapshot_number: 3, source_quote_number: "Q-1001", final_quote_total: 650000 },
  generatedBy: "test-user",
  createdAt: "2026-08-12T02:00:00.000Z",
  masterTemplate: { id: "premier-master", version: "2026.08", pageCount: 10 },
  masterPdfRef: { storagePath: "standard-inclusions/premier.pdf", pageCount: 10 },
  closingPdfRef: { storagePath: "standard-inclusions/approval.pdf", pageCount: 2 },
});

assert.equal(Object.isFrozen(snapshot), true, "snapshot root is immutable");
assert.equal(Object.isFrozen(snapshot.selections), true, "selection array is immutable");
assert.equal(snapshot.selections.length, 8, "internal and replaced rows are excluded");
assert.equal(snapshot.summary.productCount, 8, "client-facing product count is captured");
assert.equal(snapshot.summary.dynamicPageCount >= 8, true, "dynamic pages are deterministic");
assert.equal(snapshot.summary.totalPageCount, 10 + snapshot.summary.dynamicPageCount + 1, "master, dynamic and closing pages are counted by the snapshot model");
assert.equal(snapshot.summary.currentNetSelectionVariation, 540, "approved variation total uses existing selection values");
assert.equal(snapshot.selections.some((selection) => JSON.stringify(selection).includes("builderCost")), false, "internal selected_details fields are removed");
assert.equal(snapshot.selections.some((selection) => JSON.stringify(selection).includes("markup")), false, "internal cost fields are removed");

const groups = groupSnapshotSelections(snapshot);
assert.deepEqual(groups.map((group) => group.area), ["Exterior", "Interior", "Kitchen"], "areas are grouped deterministically");
assert.equal(groups.find((group) => group.area === "Interior").rooms.some((room) => room.room === "Bedrooms"), true, "bedrooms are collapsed into one room group");

const ovenCard = renderProductCardHtml(snapshot.selections.find((selection) => selection.id === "sel-oven"), { currency: "AUD" });
assert.match(ovenCard, /Serie 6 Built-In Oven/, "product card renders product name");
assert.match(ovenCard, /data:image\/svg\+xml/, "product card uses Product Library image URL");
assert.doesNotMatch(ovenCard, /builderCost|internalNotes|\$0\.00/, "product card hides internal and empty fields");

const html = renderFinalInclusionsScheduleHtml(snapshot);
assert.match(html, /Final Inclusions Schedule/, "HTML document has schedule title");
assert.match(html, /Grant Client/, "HTML document has client-facing project data");
assert.doesNotMatch(html, /undefined|null|Internal Cost Adjustment/, "HTML document collapses missing/internal values");

const documentV1 = createFinalInclusionsDocumentVersion({
  snapshot,
  previousDocuments: [],
  generatedAt: "2026-08-12T03:00:00.000Z",
});
assert.equal(documentV1.document_type, "selection", "existing project document type is reused");
assert.equal(documentV1.version, 1, "first generated document is version 1");
assert.equal(documentV1.metadata.finalInclusionsSchedule, true, "document metadata identifies final inclusions schedule");
assert.equal(documentV1.storagePath, "builder-projects/project-1/final-inclusions/estimate-1/final-inclusions-schedule-v1.pdf", "generated PDF path is deterministic");

const documentV2 = createFinalInclusionsDocumentVersion({
  snapshot,
  previousDocuments: [documentV1],
  generatedAt: "2026-08-12T03:05:00.000Z",
});
assert.equal(documentV2.version, 2, "regeneration creates the next document version");
assert.equal(isFinalInclusionsDocumentOutOfDate(documentV2, selections), false, "matching document is current");
assert.equal(isFinalInclusionsDocumentOutOfDate(documentV2, selections.map((selection) => selection.id === "sel-oven" ? { ...selection, variation_amount: 600 } : selection)), true, "changed selections mark the document out of date");

const estimateDocument = normaliseProjectEstimateInclusionsDocument(documentV2);
assert.equal(estimateDocument.sourceType, "final_inclusions_schedule", "Project Estimate document slot source is marked");
assert.equal(estimateDocument.fileName, "final-inclusions-schedule-v2.pdf", "Project Estimate receives the latest generated PDF reference");

const sequence = buildProjectEstimateDocumentSequence({
  introPages: ["cover", "summary"],
  finalInclusionsDocument: documentV2,
  plans: { fileName: "plans.pdf" },
  pricingPages: ["pricing"],
  acceptancePages: ["acceptance"],
});
assert.deepEqual(sequence.map((item) => item.slot), ["intro", "intro", "inclusions", "plans", "pricing", "acceptance"], "Project Estimate sequence inserts inclusions before plans and pricing");

const mergePlan = finalInclusionsPdfMergePlan({
  masterPdf: { storagePath: "standard-inclusions/premier.pdf" },
  dynamicPdf: { storagePath: documentV2.storagePath },
  closingPdf: { storagePath: "standard-inclusions/approval.pdf" },
});
assert.deepEqual(mergePlan.map((entry) => entry.type), ["master-pdf", "dynamic-pdf", "closing-pdf"], "PDF merge order is master, dynamic, closing");

const outputRoot = path.resolve("tmp/final-inclusions-schedule-test");
await mkdir(outputRoot, { recursive: true });
const masterPdfPath = path.join(outputRoot, "approved-premier-master-10-pages.pdf");
const closingPdfPath = path.join(outputRoot, "approved-closing-2-pages.pdf");
const masterPdfBytes = await createFixturePdf(masterPdfPath, {
  title: "Approved Premier Inclusions Master",
  pageCount: 10,
  color: rgb(0.06, 0.12, 0.18),
});
const closingPdfBytes = await createFixturePdf(closingPdfPath, {
  title: "Approved Final Inclusions Closing Pages",
  pageCount: 2,
  color: rgb(0.75, 0.55, 0.22),
});
const masterValidation = await validatePdfBytes(masterPdfBytes, { expectedPageCount: 10, label: "approved master" });
const closingValidation = await validatePdfBytes(closingPdfBytes, { expectedPageCount: 2, label: "approved closing" });
assert.equal(masterValidation.pages.every((page) => page.orientation === "portrait"), true, "master PDF dimensions and orientation are readable");
assert.equal(closingValidation.pages.every((page) => page.orientation === "portrait"), true, "closing PDF dimensions and orientation are readable");

const dynamicPdf = await renderDynamicFinalInclusionsPdf(snapshot);
assert.equal(dynamicPdf.validation.startsWithPdf, true, "dynamic PDF has valid PDF magic bytes");
assert.equal(dynamicPdf.warnings.length, 0, "product images render without warnings");

const mergedDirect = await mergeFinalInclusionsPdfBinaries({
  masterPdfBytes,
  dynamicPdfBytes: dynamicPdf.bytes,
  closingPdfBytes,
  expectedPageCounts: {
    master: 10,
    dynamic: dynamicPdf.validation.pageCount,
    closing: 2,
  },
});
assert.equal(mergedDirect.pageCounts.total, 10 + dynamicPdf.validation.pageCount + 2, "merged page count equals master + dynamic + closing");
assert.equal(mergedDirect.validation.startsWithPdf, true, "merged PDF has valid magic bytes");

const textContent = await extractPdfText(mergedDirect.bytes);
assert.match(textContent, /Final Inclusions Schedule/, "final PDF can be reopened and text read");
assert.match(textContent.replace(/\s+/g, " "), /\+\$540\.00/, "final PDF contains the exact +$540.00 variation");
assert.match(textContent, /Serie 6 Built-In Oven/, "final PDF contains the oven product");
assert.match(textContent, /Gas Cooktop/, "final PDF contains the cooktop product");
assert.match(textContent, /Undermount Basin/, "final PDF contains the sink product");
assert.match(textContent, /Gooseneck Mixer/, "final PDF contains the tapware product");
assert.match(textContent, /La Paloma Face Brick/, "final PDF contains the brick product");
assert.match(textContent, /Approved Family Product/, "final PDF contains the generic family product");

const storage = createLocalFinalInclusionsStorage({ rootDir: outputRoot });
const storedV1 = await generateAndStoreFinalInclusionsPdf({
  snapshot: {
    ...snapshot,
    masterPdfRef: { localPath: masterPdfPath, storagePath: masterPdfPath, pageCount: 10 },
    closingPdfRef: { localPath: closingPdfPath, storagePath: closingPdfPath, pageCount: 2 },
  },
  previousDocuments: [],
  masterPdfBytes,
  closingPdfBytes,
  storage,
  generatedAt: "2026-08-12T03:10:00.000Z",
});
assert.equal(storedV1.document.version, 1, "real v1 PDF is generated");
assert.equal(storedV1.document.metadata.masterPageCount, 10, "v1 records master page count");
assert.equal(storedV1.document.metadata.closingPageCount, 2, "v1 records closing page count");
assert.equal(storedV1.document.metadata.dynamicPageCount, dynamicPdf.validation.pageCount, "v1 records actual dynamic page count");
assert.equal(storedV1.document.metadata.pageCount, storedV1.merged.pageCounts.total, "v1 records final page count");
assert.equal(storedV1.projectEstimateDocument.sourceType, "final_inclusions_schedule", "Project Estimate receives a binary final schedule reference");
const v1File = await readPdfFile(storedV1.document.localPath, { expectedPageCount: storedV1.merged.pageCounts.total, label: "stored v1" });
assert.equal(v1File.validation.fileSizeBytes, storedV1.document.fileSizeBytes, "stored v1 file size is registered");

const changedSelections = selections.map((selection) => selection.id === "sel-oven" ? { ...selection, selected_colour: "Graphite", updated_at: "2026-08-12T04:00:00.000Z" } : selection);
assert.equal(isFinalInclusionsDocumentOutOfDate(storedV1.document, changedSelections), true, "stored v1 becomes outdated after selection snapshot changes");
const snapshotV2 = createProjectInclusionsSnapshot({
  project,
  workspaceId: "workspace-1",
  selections: changedSelections,
  session,
  estimateSnapshot: { id: "estimate-1", snapshot_number: 3, source_quote_number: "Q-1001", final_quote_total: 650000 },
  generatedBy: "test-user",
  createdAt: "2026-08-12T04:05:00.000Z",
  masterTemplate: { id: "premier-master", version: "2026.08", pageCount: 10 },
  masterPdfRef: { localPath: masterPdfPath, storagePath: masterPdfPath, pageCount: 10 },
  closingPdfRef: { localPath: closingPdfPath, storagePath: closingPdfPath, pageCount: 2 },
});
const storedV2 = await generateAndStoreFinalInclusionsPdf({
  snapshot: snapshotV2,
  previousDocuments: [storedV1.document],
  masterPdfBytes,
  closingPdfBytes,
  storage,
  generatedAt: "2026-08-12T04:10:00.000Z",
});
assert.equal(storedV2.document.version, 2, "real v2 PDF is generated");
assert.notEqual(storedV1.document.storagePath, storedV2.document.storagePath, "v1 and v2 storage filenames differ");
assert.notEqual(storedV1.document.id, storedV2.document.id, "v1 and v2 document records differ");
assert.notEqual(storedV1.document.metadata.selectionSnapshot.selectionFingerprint, storedV2.document.metadata.selectionSnapshot.selectionFingerprint, "v1 and v2 snapshots differ");
assert.equal((await readFile(storedV1.document.localPath)).length > 0, true, "v1 remains available after v2 generation");
assert.equal(storage.latestDocument().id, storedV2.document.id, "latest-version resolver returns v2");
assert.equal(normaliseProjectEstimateInclusionsDocument(storage.latestDocument()).storagePath, storedV2.document.storagePath, "Project Estimate resolves latest valid v2 PDF storage reference");

let rollbackError = null;
const failedStorage = createLocalFinalInclusionsStorage({ rootDir: path.join(outputRoot, "failed") });
try {
  await generateAndStoreFinalInclusionsPdf({
    snapshot,
    previousDocuments: [],
    masterPdfBytes,
    closingPdfBytes: null,
    storage: failedStorage,
  });
} catch (error) {
  rollbackError = error;
}
assert.equal(rollbackError instanceof FinalInclusionsPdfError, true, "missing closing PDF is a controlled generation failure");
assert.equal(failedStorage.documents.some((document) => document.status === "generated"), false, "failure does not leave a fake successful document record");

console.log("Final Inclusions Schedule generator checks passed.");
console.log(JSON.stringify({
  productCount: snapshot.summary.productCount,
  masterPdfPath,
  masterPageCount: masterValidation.pageCount,
  dynamicPageCount: dynamicPdf.validation.pageCount,
  closingPdfPath,
  closingPageCount: closingValidation.pageCount,
  finalPageCount: storedV2.merged.pageCounts.total,
  finalFileSize: storedV2.document.fileSizeBytes,
  variation: snapshot.summary.currentNetSelectionVariation,
  v1Path: storedV1.document.localPath,
  v2Path: storedV2.document.localPath,
  projectEstimateSlot: estimateDocument.sourceType,
}, null, 2));

function productImage(label, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><rect width="640" height="420" fill="#f8fafc"/><rect x="42" y="42" width="556" height="336" rx="18" fill="${color}"/><circle cx="494" cy="128" r="56" fill="#ffffff" opacity=".22"/><rect x="92" y="224" width="456" height="44" rx="10" fill="#ffffff" opacity=".28"/><text x="92" y="174" font-family="Arial, sans-serif" font-size="58" font-weight="800" fill="#ffffff">${label}</text><text x="92" y="320" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#ffffff" opacity=".82">Product Library</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function createFixturePdf(filePath, { title, pageCount, color }) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pageCount; index += 1) {
    const page = pdf.addPage([595.28, 841.89]);
    page.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: rgb(0.97, 0.98, 0.99) });
    page.drawRectangle({ x: 44, y: 92, width: 507, height: 658, borderColor: color, borderWidth: 2, color: rgb(1, 1, 1) });
    page.drawText(title, { x: 68, y: 702, size: 24, font, color });
    page.drawText(`Approved source page ${index + 1} of ${pageCount}`, { x: 68, y: 660, size: 13, font: bodyFont, color: rgb(0.25, 0.31, 0.38) });
    page.drawText("Verified fixture PDF for binary merge testing.", { x: 68, y: 632, size: 11, font: bodyFont, color: rgb(0.39, 0.45, 0.55) });
  }
  pdf.setTitle(title);
  pdf.setProducer("GR8 test fixture");
  const bytes = Buffer.from(await pdf.save());
  await writeFixture(filePath, bytes);
  return bytes;
}

async function writeFixture(filePath, bytes) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
}

async function extractPdfText(bytes) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const standardFontDataUrl = `${pathToFileURL(path.resolve("node_modules/pdfjs-dist/standard_fonts")).href}/`;
  const originalWarn = console.warn;
  console.warn = (...args) => {
    const message = String(args[0] || "");
    if (/Unable to load font data|standardFontDataUrl/.test(message)) return;
    originalWarn(...args);
  };
  try {
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes), disableWorker: true, standardFontDataUrl });
    const pdf = await loadingTask.promise;
    const chunks = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      chunks.push(content.items.map((item) => item.str).join(" "));
    }
    await loadingTask.destroy();
    return chunks.join("\n");
  } finally {
    console.warn = originalWarn;
  }
}
