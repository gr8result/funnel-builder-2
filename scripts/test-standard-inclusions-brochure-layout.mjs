import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateMasterInclusionsSchedule } from "../lib/standard-inclusions/simpleScheduleGenerator.mjs";
import { approveConstructionSection, approvedPremierDefault, commonConstructionReviewItems, STANDARD_TIER_SETTINGS, scheduleGenerationBlockReason, scheduleApprovalIssues, mergeScheduleBranding } from "../lib/standard-inclusions/tierScheduleReview.mjs";
import { applyConstructionBaselineSpecifications, buildJobInclusionSnapshot } from "../lib/standard-inclusions/jobBaseline.mjs";
import { buildInclusionsBrochureDocument } from "../lib/standard-inclusions/brochureDesignPrototype.mjs";
import { PRODUCT_INCLUSION_ITEMS, RESIDENTIAL_INCLUSION_ITEMS } from "../lib/standard-inclusions/residentialInclusionStructure.mjs";

const master = JSON.parse(readFileSync("standard-inclusions/premier-inclusions-template.full.json", "utf8"));
const products = [
  { productId: "oven-900", productName: "900mm Oven", familyKey: "ovens", requirementKeys: ["ovens"], price: 1000, priceSource: "supplier", description: "Verified cooking specification. ".repeat(16) },
  { productId: "oven-600", productName: "600mm Oven", familyKey: "ovens", requirementKeys: ["ovens"], price: 450, priceSource: "supplier" },
  { productId: "fan", productName: "Ceiling Fan", familyKey: "ceiling-fans", requirementKeys: ["ceiling-fans"], price: 150, priceSource: "supplier" },
  { productId: "downlight", productName: "LED Downlight", familyKey: "lighting", requirementKeys: ["interior-lighting"], price: 30, priceSource: "supplier" },
  { productId: "flush-plate", productName: "Dual Flush Push Plate", familyKey: "toilets", requirementKeys: ["toilets"], price: 40, priceSource: "supplier" },
  { productId: "toilet-suite", productName: "Close Coupled Toilet Suite", familyKey: "toilets", requirementKeys: ["toilets"], price: 500, priceSource: "supplier" },
];
const generated = generateMasterInclusionsSchedule({ scheduleId: "layout-regression", tier: "Economy", priceLevel: "budget", products });
assert.equal(master.pages.length, 10);
const sourcePages = generated.document.pages.filter(page => page.id.startsWith("premier-inclusions-page-"));
assert.deepEqual(sourcePages.map(page => page.id), master.pages.map(page => page.id));
const normalize = text => String(text || "").replace(/\s+/g, " ").trim();
for (const source of master.pages.slice(4)) {
  const copy = sourcePages.find(page => page.id === source.id);
  const copyText = normalize(copy.objects.map(item => item.data?.text || "").join(" "));
  for (const object of source.objects.filter(object => object.type === "text" && object.y < 980)) {
    for (const line of object.data.text.split("\n")) assert.ok(copyText.includes(normalize(line.replace(/Premier/g, "Economy"))), `Preserve source wording: ${object.id}`);
  }
}
const contents = generated.document.pages.find(page => page.name === "Contents").objects.map(object => object.data?.text || "").join(" ");
for (const section of ["Site Preparation", "Structural & External", "Kitchen", "Bathroom", "Electrical", "Windows", "Plumbing", "Roofing", "Painting", "Flooring"]) assert.ok(contents.includes(section), section);
assert.equal(generated.items.find(item => item.requirementTitle === "Oven").product.productId, "oven-900");
assert.equal(generated.items.find(item => item.requirementTitle === "Ceiling fans").product.productId, "fan");
assert.equal(generated.items.find(item => item.requirementTitle === "LED downlights").product.productId, "downlight");
assert.equal(generated.items.find(item => item.requirementTitle === "Toilet suite").product.productId, "toilet-suite");
assert.ok(generated.gaps.some(gap => gap.requirementTitle === "Roof covering material"));
for (const page of generated.document.pages) {
  for (const object of page.objects.filter(object => object.type === "text")) {
    assert.ok(object.x >= 0 && object.x + object.width <= page.width, `${page.name}: ${object.name} horizontal overflow`);
    assert.ok(object.y >= 0 && object.y + object.height <= page.height, `${page.name}: ${object.name} vertical overflow`);
  }
}
assert.ok(!generated.document.pages[0].objects.some(object => String(object.data?.text || "").includes("Inclusions Inclusions")));
console.log("Full-master Economy brochure contents, specification compatibility and text bounds passed.");

const tierDocuments = Object.keys(STANDARD_TIER_SETTINGS).map(tier => generateMasterInclusionsSchedule({ scheduleId: `tier-${tier}`, tier, products }));
for (const result of tierDocuments) {
  assert.equal(result.items.length, 200);
  assert.ok(result.document.pages.some(page => page.id === result.document.activePageId), "A generated brochure must open on an existing page, not a removed reference page.");
  assert.equal(result.priceLevel, STANDARD_TIER_SETTINGS[result.tier].label === "Entry-level" ? "Budget" : STANDARD_TIER_SETTINGS[result.tier].label);
  assert.deepEqual(result.items.map(item => item.requirementTitle), tierDocuments[0].items.map(item => item.requirementTitle));
}
assert.equal(new Set(tierDocuments.map(result => result.document.pages[0].objects.find(object => object.type === "image").data.imageRef)).size, 3);
const review = approveConstructionSection({ items: [...commonConstructionReviewItems(), { id: "missing", category: "Kitchen", productRequired: true, reviewStatus: "needs_review" }] }, "Kitchen");
assert.equal(review.items.find(item => item.id === "missing").reviewStatus, "needs_review");
assert.equal(approvedPremierDefault([{ name: "Premier", metadata: { workflowStatus: "Published" }, currentVersion: { id: "v1" } }]), null);
const quotation = { quotation: { SLAB: { rows: [{ id: "slab-1", requirementKey: "foundations", quantity: 214, manualRate: "", customField: "retain" }] } } };
const snapshot = { descriptiveItems: [{ id: "construction-1", metadata: { requirementKey: "foundations", specification: "Builder-reviewed engineered slab" } }] };
const applied = applyConstructionBaselineSpecifications(quotation, snapshot);
assert.equal(applied.quotation.SLAB.rows[0].quantity, 214);
assert.equal(applied.quotation.SLAB.rows[0].customField, "retain");
assert.equal(applied.quotation.SLAB.rows[0].inclusionSpecification, "Builder-reviewed engineered slab");
assert.deepEqual(applyConstructionBaselineSpecifications(applied, snapshot), applied);
const protectedWorkbook = { quotation: { SLAB: { rows: [{ id: "slab-1", requirementKey: "foundations", quantity: 214, manualRate: 100 }] } } };
assert.deepEqual(applyConstructionBaselineSpecifications(protectedWorkbook, snapshot).quotation, protectedWorkbook.quotation);
console.log("Three-tier differentiation, review exceptions, safe Premier eligibility and construction quotation preservation passed.");
const pricedItem = { id: "approved-oven", reviewStatus: "approved", selectionSlotId: "oven", includedPriceBasis: "catalogue_unit_price", includedUnitPrice: 1100, product: { productId: "oven-approved", name: "Approved Oven", selectionSlotIds: ["oven"], gstIncluded: true, price: 1100 } };
const pricedSchedule = { id: "premier-approved", tierKey: "Premier", currentVersion: { id: "v1", versionNumber: 1 }, metadata: { publishedSnapshots: [{ versionId: "v1", items: [pricedItem] }] } };
assert.equal(buildJobInclusionSnapshot({ workspaceId: "workspace-test", schedule: pricedSchedule }).items[0].baselineUnitPrice, 1000);
const unknownTax = { ...pricedSchedule, metadata: { publishedSnapshots: [{ versionId: "v1", items: [{ ...pricedItem, product: { ...pricedItem.product, gstIncluded: null } }] }] } };
assert.equal(buildJobInclusionSnapshot({ workspaceId: "workspace-test", schedule: unknownTax }).items[0].baselineUnitPrice, null);
console.log("Explicit reviewed catalogue price basis converts recorded GST and rejects unknown tax treatment.");
const generationState = { authenticated: true, workspaceId: "workspace-test", schedule: { id: "draft", metadata: { workflowStatus: "Draft" } }, tier: "Premier" };
assert.equal(scheduleGenerationBlockReason({ ...generationState, products: [] }), "", "A catalogue gap cannot block complete construction draft generation.");
assert.match(scheduleGenerationBlockReason({ ...generationState, schedule: { metadata: { workflowStatus: "Approved" } } }), /protected/i);

const completeEditorialItems = RESIDENTIAL_INCLUSION_ITEMS.map((item) => ({
  id: item.key,
  category: item.section,
  group: item.group,
  requirementTitle: item.title,
  description: item.title,
  specification: `${item.title} included to the approved plans and retained construction specification.`,
  productRequired: item.productRequired,
  ...(item.productRequired ? {
    product: {
      productId: `test:${item.key}`,
      name: `${item.title} verified selection`,
      brand: "Verified Brand",
      model: item.key,
      specification: `${item.title} verified catalogue specification.`,
      image: "/images/catalogues/product-library/rooms/living-lounge-room.jpg",
      imageStatus: "verified_exact",
    },
  } : {}),
}));
const editorial = buildInclusionsBrochureDocument({
  items: completeEditorialItems,
  name: "Complete editorial regression",
  packageChoice: "Mid-range",
  designStyle: "Coastal",
});
assert.equal(completeEditorialItems.length, 200);
assert.equal(PRODUCT_INCLUSION_ITEMS.length, 92);
assert.equal(editorial.metadata.requiredItemCount, 200);
assert.equal(editorial.metadata.renderedItemCount, 200);
assert.equal(editorial.metadata.productRequirementCount, 92);
assert.equal(editorial.metadata.exactProductImageCount, 92);
assert.equal(editorial.metadata.visualIssues.length, 0);
assert.equal(editorial.metadata.approvalBlocked, false);
assert.equal(new Set(editorial.metadata.renderedItemIds).size, 200);
assert.deepEqual([...editorial.metadata.renderedItemIds].sort(), completeEditorialItems.map((item) => item.id).sort());
for (const page of editorial.pages) {
  assert.deepEqual(page.objects.map((object) => object.layer), page.objects.map((_, index) => index), `${page.name}: deterministic layers`);
  for (const object of page.objects) {
    assert.ok(object.x >= 0 && object.x + object.width <= page.width, `${page.name}: ${object.name} horizontal bounds`);
    assert.ok(object.y >= 0 && object.y + object.height <= page.height, `${page.name}: ${object.name} vertical bounds`);
  }
}
console.log(`Complete 200-item editorial brochure rendered once across ${editorial.pages.length} bounded, deterministically layered pages.`);
assert.match(scheduleGenerationBlockReason({ ...generationState, authenticated: false }), /Sign in/);
assert.deepEqual(mergeScheduleBranding({}, { businessName: "Verified Builder", phone: "123" }), { businessName: "Verified Builder", phone: "123" });
assert.equal(mergeScheduleBranding({ tagline: "Saved wording" }, { tagline: "", businessName: "Verified Builder" }).tagline, "Saved wording");
assert.match(scheduleApprovalIssues({ items: [] })[0], /Generate/);
assert.ok(scheduleApprovalIssues({ items: [{ id: "gap", category: "Roofing", requirementTitle: "Roof system", productRequired: true, reviewStatus: "needs_review" }] }).some(issue => issue.includes("Roofing / Roof system")));
const editorSource = readFileSync("pages/modules/builders/standard-inclusions/[scheduleId].js", "utf8");
assert.match(editorSource, /request\("\/api\/standard-inclusions\/generate-schedule"/, "The actual editor must use complete schedule generation, not AI-only proposals.");
assert.doesNotMatch(editorSource, /disabled=\{proposing \|\| !products.length\}/, "Product count must not disable draft generation.");
assert.match(editorSource, /generate-schedule", \{[\s\S]{0,900}?\}, (?:[4-9]\d{4}|1[0-8]\d{4})\)/, "Generation must have a recoverable client request deadline (45-180 s).");
assert.match(editorSource, /setBrochureOpen\(false\)/, "Generation must return to editable checklist review.");
console.log("Actual-editor complete generation routing, zero-product readiness, profile merge and actionable validation passed.");