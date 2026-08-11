import assert from "node:assert/strict";
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
    image_url: "https://product-library.example/oven.jpg",
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
      primaryImage: "https://product-library.example/oven.jpg",
    },
    builder_cost: 990,
    markup_percent: 25,
    updated_at: "2026-08-12T01:00:00.000Z",
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
});

assert.equal(Object.isFrozen(snapshot), true, "snapshot root is immutable");
assert.equal(Object.isFrozen(snapshot.selections), true, "selection array is immutable");
assert.equal(snapshot.selections.length, 4, "internal and replaced rows are excluded");
assert.equal(snapshot.summary.productCount, 4, "client-facing product count is captured");
assert.equal(snapshot.summary.dynamicPageCount, 8, "dynamic pages are deterministic");
assert.equal(snapshot.summary.totalPageCount, 19, "master, dynamic and closing pages are counted");
assert.equal(snapshot.summary.currentNetSelectionVariation, 540, "approved variation total uses existing selection values");
assert.equal(snapshot.selections.some((selection) => JSON.stringify(selection).includes("builderCost")), false, "internal selected_details fields are removed");
assert.equal(snapshot.selections.some((selection) => JSON.stringify(selection).includes("markup")), false, "internal cost fields are removed");

const groups = groupSnapshotSelections(snapshot);
assert.deepEqual(groups.map((group) => group.area), ["Exterior", "Interior", "Kitchen"], "areas are grouped deterministically");
assert.equal(groups.find((group) => group.area === "Interior").rooms[0].room, "Bedrooms", "bedrooms are collapsed into one room group");

const ovenCard = renderProductCardHtml(snapshot.selections.find((selection) => selection.id === "sel-oven"), { currency: "AUD" });
assert.match(ovenCard, /Serie 6 Built-In Oven/, "product card renders product name");
assert.match(ovenCard, /product-library\.example\/oven\.jpg/, "product card uses Product Library image URL");
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

console.log("Final Inclusions Schedule generator checks passed.");
console.log(JSON.stringify({
  productCount: snapshot.summary.productCount,
  dynamicPageCount: snapshot.summary.dynamicPageCount,
  variation: snapshot.summary.currentNetSelectionVariation,
  generatedPdfPath: documentV2.storagePath,
  projectEstimateSlot: estimateDocument.sourceType,
}, null, 2));
