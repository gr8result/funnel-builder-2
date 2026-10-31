import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isInclusionsDraftApprovable, validateProductProposals, constrainProposalCatalogue, rankCatalogueCandidatesForCategories, limitProposalBudget, normalizeCatalogueProduct } from "../lib/standard-inclusions/productProposal.mjs";
import { buildStandardInclusionsQuotationSeed } from "../lib/standard-inclusions/quotationSeed.mjs";
import { JOB_APPLICATION_STATUS, buildJobInclusionSnapshot, planJobInclusionApplication, applyStandardInclusionsToWorkbook } from "../lib/standard-inclusions/jobBaseline.mjs";
import { standardInclusionUpgradeProposals, priceStandardInclusionUpgrade, standardInclusionUpgradeDraftId, planUpgradeVariationTransition, planUpgradeClientResponse } from "../lib/standard-inclusions/upgradeVariation.mjs";
import { standardInclusionClientSelectionPatches, mergeStandardInclusionClientSelectionBook, standardInclusionRequirementKey, standardInclusionSelectionSlot } from "../lib/standard-inclusions/clientSelectionBaseline.mjs";

const helper = readFileSync("lib/standard-inclusions/pdfLibrary.js", "utf8");
const api = readFileSync("pages/api/standard-inclusions/pdf-library.js", "utf8");
const libraryPage = readFileSync("pages/modules/builders/standard-inclusions.js", "utf8");
const sideNav = readFileSync("components/SideNav.js", "utf8");
const estimateBuilderRoute = readFileSync("pages/modules/estimate-builder/index.js", "utf8");
const setupPage = readFileSync("pages/modules/builders/standard-inclusions/[scheduleId].js", "utf8");
const brandingApi = readFileSync("pages/api/standard-inclusions/branding.js", "utf8");
const brandingAssetApi = readFileSync("pages/api/standard-inclusions/branding-asset.js", "utf8");
const proposalApi = readFileSync("pages/api/standard-inclusions/propose-products.js", "utf8");
const documentEditor = readFileSync("components/document-engine/editor/DocumentPageBuilder.jsx", "utf8");
assert.match(documentEditor, /await onSave\(snapshot\)/, "The visual editor Save must await durable persistence of its exact text/image snapshot.");
assert.match(setupPage, /onSave=\{saveBrochure\}/, "Visual editor Save must be connected to schedule persistence.");
assert.match(setupPage, /saveDraft\(draft.status, documentSnapshot\)/, "Save must use the current editor snapshot instead of stale parent state.");
assert.match(setupPage, /brochureDocument: documentSnapshot \|\| null/, "All edited document pages must be included in schedule metadata.");
assert.match(setupPage, /function downloadGeneratedPdf\(\)/, "Exported PDF bytes must have a download action.");
assert.match(setupPage, /link.download = generatedPdf.fileName/, "Download must preserve the exported PDF filename.");
assert.match(setupPage, /Edit selections/, "Generated products and review gaps must remain accessible outside the visual editor.");
const projectAssignmentApi = readFileSync("pages/api/standard-inclusions/apply-to-project.js", "utf8");
const projectShape = readFileSync("lib/builders/projectInclusionsAssignment.js", "utf8");
const upgradeApi = readFileSync("pages/api/standard-inclusions/upgrade-variation.js", "utf8");
const portalApprovals = readFileSync("client-portal/serverApprovals.js", "utf8");
assert.match(upgradeApi, /withWorkspace\(handler, \{ roles: \['owner', 'admin'\], authTimeoutMs: 8000 \}\)/, 'Upgrade builder review/issue requires authorised financial workspace roles and fails closed on Auth timeout.');
assert.match(upgradeApi, /ignoreDuplicates: true/, 'Issuing must preserve an existing client approval decision.');
assert.match(portalApprovals, /\.in\("status", \["awaiting_client", "viewed"\]\)/, 'Concurrent client responses cannot overwrite an already answered approval.');

const candidate = { productId: "workspace-product-1", productName: "Verified tap", category: "Tapware", brand: "Example", allowance: 250 };
const canonicalProduct = normalizeCatalogueProduct({ productId: "catalogue-oven-1", productName: "Catalogued Oven", familyKey: "ovens", categoryKey: "kitchen-appliances", brand: "Verified Brand", clientPrice: 990, gstIncluded: true, primaryImageUrl: "/oven.jpg", attributes: { selectionFacets: { finishes: ["Stainless", "Black"] } } });
assert.equal(canonicalProduct.productId, "catalogue-oven-1");
assert.equal(canonicalProduct.name, "Catalogued Oven");
assert.equal(canonicalProduct.familyKey, "ovens");
assert.equal(canonicalProduct.price, 990);
assert.equal(canonicalProduct.gstIncluded, true);
assert.deepEqual(canonicalProduct.availableOptions, { finishes: ["Stainless", "Black"] });
assert.equal(normalizeCatalogueProduct({ productId: "screen-1", productName: "Screen", specification: { glass: "Clear", hardware: ["Chrome", "Black"] } }).specification, "glass: Clear; hardware: Chrome, Black");
const rankedCatalogue = rankCatalogueCandidatesForCategories([
	{ productId: "oven-real", name: "Built-in Oven", familyKey: "ovens", category: "Kitchen Appliances", price: 900, active: true },
	{ productId: "sink-real", name: "Kitchen Sink", familyKey: "kitchen-sinks", category: "Kitchen Sinks", price: 300, active: true },
	{ productId: "unrelated-real", name: "Roof Tile", familyKey: "tiles", category: "Roofing", price: 80, active: true },
], ["Kitchen appliances and tapware"], { perCategory: 5, totalLimit: 10 });
assert.deepEqual(rankedCatalogue.map(product => product.productId), ["oven-real", "sink-real"], "AI shortlist must follow real category matches and never admit unrelated products.");
const misclassifiedCatalogue = [
	{ productId: "brick-roof", familyKey: "bricks", name: "Austral Face Brick" },
	{ productId: "tile-siteworks", familyKey: "tiles", name: "Decorative Wall Tile" },
	{ productId: "laundry-walls", familyKey: "laundry-cabinetry", name: "Laundry Tub and Cabinet" },
	{ productId: "external-door-internal", familyKey: "entry-doors", name: "External Entrance Door" },
	{ productId: "fan-technology", familyKey: "ceiling-fans", name: "Ceiling Fan" },
];
for (const [product, category] of [
	[misclassifiedCatalogue[0], "Roofing"],
	[misclassifiedCatalogue[1], "Siteworks"],
	[misclassifiedCatalogue[2], "Walls & Ceilings"],
	[misclassifiedCatalogue[3], "Internal Doors"],
	[misclassifiedCatalogue[4], "Technology / Communications"],
]) {
	assert.equal(rankCatalogueCandidatesForCategories([product], [category]).length, 0, `${product.productId} must not be eligible for ${category}.`);
}
assert.equal(rankCatalogueCandidatesForCategories([{ productId: "roof-system", familyKey: "roofing" }], ["Roofing"]).length, 1, "A catalogue-classified roof system remains eligible for roofing.");
assert.equal(rankCatalogueCandidatesForCategories([{ productId: "internal-door", familyKey: "internal-doors" }], ["Internal Doors"]).length, 1, "An internal door family remains eligible for internal doors.");
assert.equal(rankCatalogueCandidatesForCategories([{ productId: "laundry-tile", familyKey: "tiles" }], ["Laundry Tiles"]).length, 1, "Tiles are eligible only for a tile-specific requirement.");
assert.equal(rankCatalogueCandidatesForCategories([{ productId: "tile-bad-slot", familyKey: "tiles", selectionSlotIds: ["external_door_handle"] }], ["Wall Tiles"]).length, 0, "A conflicting canonical selection slot invalidates an otherwise matching family.");
for (const [category, product] of [
	["External walls and cladding", { productId: "wall-brick", familyKey: "bricks", requirementKeys: ["bricks"] }],
	["Roofing", { productId: "roofing-system", familyKey: "roofing", requirementKeys: ["roofing"] }],
	["Internal doors and door furniture", { productId: "internal-door-item", familyKey: "internal-doors", requirementKeys: ["internal-doors"] }],
	["Kitchen appliances and tapware", { productId: "catalogue-oven", familyKey: "ovens", requirementKeys: ["ovens"] }],
	["Kitchen cabinetry and benchtops", { productId: "catalogue-benchtop", familyKey: "stone-benchtops" }],
]) {
	assert.equal(rankCatalogueCandidatesForCategories([product], [category]).length, 1, `${product.familyKey} must map to the construction category ${category}.`);
}
for (const category of ["Site works and preliminary items", "Internal walls and ceilings", "Technology and communications", "Building approvals", "Slab and frame"]) {
	assert.equal(rankCatalogueCandidatesForCategories([{ productId: "unrelated-tile", familyKey: "tiles" }], [category]).length, 0, `${category} must not receive an unrelated retail product.`);
}
const crossCategoryValidation = validateProductProposals({
	categories: ["Roofing"],
	products: misclassifiedCatalogue,
	proposals: [{ category: "Roofing", productId: "brick-roof" }],
	eligibleProductIdsByCategory: { Roofing: [] },
});
assert.equal(crossCategoryValidation.proposals.length, 0, "AI cannot bypass deterministic category eligibility with an otherwise valid catalogue ID.");
assert.deepEqual(crossCategoryValidation.gaps, ["Roofing"]);
const economyProducts = [100, 200, 300, 400, 500, 600].map(price => ({ productId: `oven-${price}`, name: `Oven ${price}`, category: "Ovens", active: true, allowance: price }));
assert.deepEqual(constrainProposalCatalogue(economyProducts, { qualityLevel: "Economy", maxUnitAllowance: 250 }).map(product => product.productId), ["oven-100"]);
assert.equal(constrainProposalCatalogue(economyProducts, { specifications: "pyrolytic" }).length, 0, "Specifications cannot be invented to make a match.");
const budgeted = limitProposalBudget({ proposals: economyProducts.slice(0, 2).map(product => ({ category: product.productId, product })), gaps: [] }, 150);
assert.equal(budgeted.proposals.length, 1);
assert.deepEqual(budgeted.gaps, ["oven-200"]);
const proposalValidation = validateProductProposals({
	categories: ["Tapware", "Laundry"],
	products: [candidate],
	proposals: [
		{ category: "Tapware", productId: "workspace-product-1" },
		{ category: "Tapware", productId: "invented-product" },
		{ category: "Kitchen", productId: "workspace-product-1" },
	],
});
assert.equal(proposalValidation.proposals.length, 1, "AI may only select a real candidate for a requested category.");
assert.deepEqual(proposalValidation.proposals[0].product, { ...candidate, name: candidate.productName }, "proposal snapshots retain catalogue facts and add only the display-name alias.");
assert.deepEqual(proposalValidation.gaps, ["Laundry"], "categories without a real candidate remain flagged.");
assert.equal(isInclusionsDraftApprovable({ categories: ["Tapware"], gaps: [], items: [{ category: "Tapware", reviewStatus: "needs_review" }] }), false, "unreviewed AI suggestions cannot be approved.");
assert.equal(isInclusionsDraftApprovable({ categories: ["Tapware", "Laundry"], excludedCategories: ["Laundry"], gaps: [], items: [{ category: "Tapware", reviewStatus: "approved" }] }), true, "explicitly excluded categories do not block approval.");
const quotationSeed = buildStandardInclusionsQuotationSeed({
	scheduleId: "schedule-1", scheduleVersionId: "version-4", scheduleVersion: 4,
	scheduleName: "Premier", sourceWorkspaceId: "workspace-1",
	items: [
		{ id: "item-1", category: "Tapware", reviewStatus: "approved", quantity: "2", unit: "each", allowanceOverride: "", product: { productId: "product-1", name: "Verified tap", allowance: 125, currency: "AUD" } },
		{ id: "item-2", category: "Roofing", reviewStatus: "rejected", product: { productId: "product-2", name: "Rejected roof" } },
	],
});
assert.equal(quotationSeed.lines.length, 1, "only approved items enter the quotation seed.");
assert.equal(quotationSeed.lines[0].lineId, "standard-inclusion:schedule-1:version-4:item-1", "quotation line identity is stable by schedule version and item.");
assert.equal(quotationSeed.lines[0].quantity, 2);
assert.equal(quotationSeed.lines[0].allowance, 125);
const publishedSchedule = {
	id: "schedule-1", name: "Premier", tierKey: "Premier", currentVersion: { id: "version-4", versionNumber: 4 },
	metadata: { publishedSnapshots: [{ versionId: "version-4", publishedAt: "2026-10-16T00:00:00Z", items: [{ id: "item-1", category: "Kitchen", reviewStatus: "approved", selectionSlotId: "kitchen_sink", quantity: "1", allowanceOverride: "", product: { productId: "product-1", name: "Sink", allowance: 200, gstIncluded: true, selectionSlotIds: ["kitchen_sink"] } }] }] },
};
const jobBaseline = buildJobInclusionSnapshot({ workspaceId: "workspace-1", schedule: publishedSchedule });
const preloadSnapshot = { ...jobBaseline, items: [{ ...jobBaseline.items[0], metadata: { ...jobBaseline.items[0].metadata, productSnapshot: { productId: "product-1", name: "Included sink", brand: "Verified Brand", description: "Included description", specification: "Stainless steel", image: "/sink.jpg", finish: "Brushed", attributes: { selectionFacets: { colours: ["Brushed", "Black"] } } } } }] };
const preloadPatches = standardInclusionClientSelectionPatches(preloadSnapshot, { resolveRequirement: key => key === "sink" ? { requirementKey: "sink", label: "Kitchen Sink", familyKey: "sinks", defaultAllowance: 650, defaultQuantity: 1 } : null, quotation: { KITCHEN: { rows: [{ id: "sink", selectionSlotId: "kitchen_sink", quantity: 2 }] } } });
assert.equal(standardInclusionRequirementKey("kitchen_sink"), "sink");
assert.equal(standardInclusionSelectionSlot("sink"), "kitchen_sink");
assert.equal(preloadPatches.length, 1);
assert.equal(preloadPatches[0].patch.guidedSelection.allowance, 181.82);
assert.equal(preloadPatches[0].patch.guidedSelection.quantity, 2, "Selections use the real quotation/job quantity when it exists.");
assert.equal(preloadPatches[0].patch.guidedSelection.specification, "Stainless steel");
assert.deepEqual(preloadPatches[0].patch.guidedSelection.availableOptions, { colours: ["Brushed", "Black"] });
const patchBook = (book, requirement, patch) => ({ ...book, rooms: [{ id: "kitchen", name: "Kitchen", rows: [...(book.rooms?.[0]?.rows || []), { guidedRequirementKey: requirement.requirementKey, ...patch }] }] });
const firstPreload = mergeStandardInclusionClientSelectionBook({ rooms: [] }, preloadPatches, patchBook);
assert.deepEqual(firstPreload.inserted, ["sink"]);
const repeatedPreload = mergeStandardInclusionClientSelectionBook(firstPreload.book, preloadPatches, patchBook);
assert.equal(repeatedPreload.inserted.length, 0, "Refreshing the same schedule must not duplicate preloaded products.");
const confirmedBook = { rooms: [{ id: "kitchen", name: "Kitchen", rows: [{ guidedRequirementKey: "sink", selectedOptionId: "client-upgrade", guidedSelection: { requirementKey: "sink", productId: "client-upgrade" } }] }] };
assert.equal(mergeStandardInclusionClientSelectionBook(confirmedBook, preloadPatches, patchBook).book, confirmedBook, "A confirmed client upgrade is never replaced by re-applying its baseline.");
const foundation = { workspace_id: "workspace-1", configurations: [{ workspace_id: "workspace-1", selection_slot_id: "kitchen_sink", enabled: true }], mappings: [{ workspace_id: "workspace-1", selection_slot_id: "kitchen_sink", template_id: "template-1", status: "MAPPED", quote_section_id: "kitchen", quote_row_id: "sink" }] };
const baselineWorkbook = { workspace_id: "workspace-1", templateKey: "template-1", quotation: { KITCHEN: { id: "kitchen", rows: [{ id: "sink", quantity: 2, quantityKey: "job.kitchenSinkCount", manualRate: "" }] } } };
const appliedBaseline = applyStandardInclusionsToWorkbook(baselineWorkbook, jobBaseline, foundation).workbook;
assert.equal(appliedBaseline.quotation.KITCHEN.rows[0].activeProductId, "product-1", "Applying a published schedule must actually populate the existing quotation row.");
assert.equal(appliedBaseline.quotation.KITCHEN.rows[0].activeUnitPrice, 181.82);
assert.equal(appliedBaseline.quotation.KITCHEN.rows[0].quantity, 2, "Job Setup/takeoff quantities must survive baseline application.");
assert.equal(appliedBaseline.quotation.KITCHEN.rows[0].quantityKey, "job.kitchenSinkCount");
assert.equal(appliedBaseline.jobInclusionSnapshot.items[0].baselineProductId, "product-1", "Client Selections must receive the same saved structured baseline.");
const upgradeWorkbook = { ...appliedBaseline, clientSelectionsBook: { rooms: [{ rows: [{ guidedSelection: { selectionSlotId: "kitchen_sink", productId: "upgrade-1", productName: "Replacement sink" } }] }] } };
const upgradeProducts = [{ productId: "upgrade-1", productName: "Replacement sink", clientPrice: 330, gstIncluded: true, priceStatus: "current" }];
const upgrade = standardInclusionUpgradeProposals(upgradeWorkbook, upgradeProducts)[0];
assert.equal(upgrade.status, "READY");
assert.equal(upgrade.differenceExGst, 236.36, "Upgrade cost is the current catalogue price less the pinned inclusion credit, times the job quantity.");
assert.equal(upgradeWorkbook.quotation.KITCHEN.rows[0].activeProductId, "product-1", "Preparing an upgrade must not change the approved quotation.");
assert.equal(standardInclusionUpgradeProposals(upgradeWorkbook, [])[0].status, "PRICE_REQUIRED", "Missing current catalogue prices cannot become zero-cost variations.");
const quotedUpgrade = priceStandardInclusionUpgrade(upgradeWorkbook, upgrade, current => {
	const subtotal = current.quotation.KITCHEN.rows[0].activeUnitPrice * 2 * 1.2;
	return { summary: { finalQuoteTotal: Math.round(subtotal * 1.1 * 100) / 100, gst: Math.round(subtotal * 0.1 * 100) / 100, gstPercent: 10, marginPercent: 20 } };
});
assert.equal(quotedUpgrade.total, 312, "Upgrade pricing delegates margin and tax to the supplied existing quotation calculator.");
assert.equal(quotedUpgrade.gst, 28.36);
const upgradeIdInput = { workspaceId: 'workspace-1', projectId: 'project-1', snapshotId: 'snapshot-1', upgrade };
assert.equal(await standardInclusionUpgradeDraftId(upgradeIdInput), await standardInclusionUpgradeDraftId(upgradeIdInput), 'Repeated saves must use the same primary identity across browser tabs.');
const draftVariation = { status: 'draft', metadata: { source: 'standard_inclusion_upgrade' } };
assert.throws(() => planUpgradeVariationTransition(draftVariation, 'issue', { userId: 'builder', now: 'now' }), /approval is required/);
const reviewed = { ...draftVariation, ...planUpgradeVariationTransition(draftVariation, 'approve', { userId: 'builder', now: 'now' }) };
assert.equal(reviewed.status, 'draft', 'Builder review cannot become client contract acceptance.');
const issuedVariation = planUpgradeVariationTransition(reviewed, 'issue', { userId: 'builder', now: 'now' });
assert.equal(issuedVariation.status, 'submitted');
assert.equal(issuedVariation.metadata.paymentStatus, 'outstanding');
assert.notEqual(issuedVariation.status, 'approved');
const clientAccepted = planUpgradeClientResponse({ ...reviewed, ...issuedVariation }, 'approved', { now: 'accepted-now', clientName: 'Test Client', clientEmail: 'client@example.test' });
assert.equal(clientAccepted.status, 'approved');
assert.equal(clientAccepted.metadata.quoteTreatment, 'separate_variation', 'Acceptance adds only the upgrade delta instead of changing and charging the baseline twice.');
assert.equal(clientAccepted.metadata.paymentStatus, 'outstanding', 'Client acceptance never implies payment.');
assert.equal(planUpgradeClientResponse({ ...reviewed, ...issuedVariation }, 'rejected', { now: 'now' }).status, 'rejected');
assert.equal(planUpgradeClientResponse({ ...reviewed, ...issuedVariation }, 'rejected', { now: 'now' }).metadata.paymentStatus, 'not_required');
assert.throws(() => planUpgradeClientResponse(draftVariation, 'approved', { now: 'now' }), /not been issued/);
assert.equal(applyStandardInclusionsToWorkbook(appliedBaseline, jobBaseline, foundation).workbook, appliedBaseline, "Repeated application must not add or reprice rows.");
const manualWorkbook = { ...baselineWorkbook, quotation: { KITCHEN: { id: "kitchen", rows: [{ id: "sink", quantity: 3, manualRate: 725 }] } } };
assert.equal(applyStandardInclusionsToWorkbook(manualWorkbook, jobBaseline, foundation).workbook.quotation.KITCHEN.rows[0].manualRate, 725, "Approved manual rates must be retained.");
assert.equal(jobBaseline.items[0].baselineUnitPrice, 181.82, "recorded GST-inclusive allowance is normalized for the existing baseline engine.");
assert.equal(planJobInclusionApplication({}, jobBaseline).status, JOB_APPLICATION_STATUS.NEW);
assert.equal(planJobInclusionApplication({ jobInclusionSnapshot: jobBaseline }, jobBaseline).status, JOB_APPLICATION_STATUS.ALREADY_APPLIED);
assert.equal(planJobInclusionApplication({ jobInclusionSnapshot: jobBaseline }, { ...jobBaseline, schedule: { ...jobBaseline.schedule, scheduleVersionId: "version-5" } }).status, JOB_APPLICATION_STATUS.CONFLICT);
const workbook = readFileSync("components/estimate-builder/EstimateBuilderWorkbook.js", "utf8");
const selectionHost = readFileSync("pages/modules/builders/selections-book.js", "utf8");
const baselineControl = readFileSync("components/estimate-builder/SelectionBaselineControl.jsx", "utf8");
const migration = readFileSync("supabase/migrations/20260812000000_standard_inclusions_pdf_library.sql", "utf8");
const projectAssignmentMigration = readFileSync("supabase/migrations/20261017000100_standard_inclusions_project_assignment_unique.sql", "utf8");

assert.match(migration, /create table if not exists public\.standard_inclusions_schedules/, "Schedule table migration is missing.");
assert.match(migration, /create table if not exists public\.standard_inclusions_schedule_versions/, "Version table migration is missing.");
assert.match(migration, /workspace_id uuid not null references public\.workspaces/, "Schedules and versions must be workspace scoped.");
assert.match(migration, /current_version_id uuid/, "Schedule current version pointer is missing.");
assert.match(migration, /unique \(schedule_id, version_number\)/, "Version numbers must be unique per schedule.");
assert.match(migration, /enable row level security/, "Organisation isolation RLS must be enabled.");
assert.match(migration, /workspace_members/, "RLS must isolate by workspace membership.");

assert.match(helper, /STANDARD_INCLUSIONS_BUCKET = "assets"/, "PDF library must reuse the existing assets bucket.");
assert.match(helper, /readPdfVersionMetadata/, "PDF version metadata reader is missing.");
assert.match(helper, /PDFDocument\.load/, "Server must read page count from the uploaded PDF.");
assert.match(helper, /createStandardInclusionsScheduleWithPdf/, "New schedule creation helper is missing.");
assert.match(helper, /replaceStandardInclusionsSchedulePdf/, "Replace helper is missing.");
assert.match(helper, /nextVersionNumber = Math\.max/, "Replace must create the next immutable version.");
assert.match(helper, /restoreStandardInclusionsVersion/, "Restore helper is missing.");
assert.match(helper, /updateStandardInclusionsSchedule/, "Schedule metadata update helper is missing.");
assert.match(helper, /duplicateStandardInclusionsSchedule/, "Schedule duplicate helper is missing.");
assert.match(helper, /downloadStandardInclusionsSchedulePdf/, "Workspace-scoped PDF download helper is missing.");
assert.match(helper, /source: "version-restore"/, "Restore must create a new version instead of overwriting history.");
assert.doesNotMatch(helper, /\.remove\(/, "PDF library must not remove historical version files.");
assert.match(helper, /\.eq\("workspace_id", workspaceId\)/, "Queries must be workspace isolated.");

assert.match(api, /withWorkspace\(handler, \{ authTimeoutMs: 8000 \}\)/, "PDF library API must enforce workspace access and fail closed on stalled auth verification.");
assert.match(api, /const body = await parseJsonBody\(req\)/, "Draft creation must parse JSON when the framework body parser is disabled.");
assert.match(api, /loadStandardInclusionsSchedule\(\{ workspaceId, scheduleId \}\)/, "Reopening must load the requested schedule in the authorised workspace, not the first schedule.");
assert.match(api, /multipart\/form-data/, "PDF library API must accept real PDF uploads.");
assert.match(api, /action === "replace"/, "API replace action is missing.");
assert.match(api, /action === "restore"/, "API restore action is missing.");
assert.match(api, /action === "archive"/, "API archive action is missing.");
assert.match(api, /action === "duplicate"/, "API duplicate action is missing.");
assert.match(api, /action === "update"/, "API metadata update action is missing.");
assert.match(api, /req\.query\?\.download/, "Authenticated PDF download route is missing.");

assert.match(libraryPage, /pdfjs-dist\/legacy\/build\/pdf\.mjs/, "Library must render actual PDF covers.");
assert.match(libraryPage, /standard-inclusions\/pdf-library/, "Library must use the existing PDF persistence API.");
assert.match(libraryPage, /Authorization: `Bearer \$\{token\}`/, "Library PDF reads must use the authenticated workspace session.");
assert.match(libraryPage, /"x-workspace-id": workspaceId/, "Library PDF reads must be scoped to the active workspace.");
const requestErrorSource = libraryPage.match(/function libraryRequestError\(response, payload, fallback\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(requestErrorSource, "Library request errors must distinguish authentication from workspace access.");
const requestError = new Function(`${requestErrorSource}; return libraryRequestError;`)();
assert.match(requestError({ status: 401 }, { error: "Unauthorized: invalid token" }, "Failed"), /session.*Sign in again.*retry/, "A rejected session must show authentication and retry guidance.");
assert.match(requestError({ status: 403 }, {}, "Failed"), /access.*workspace.*retry/, "Workspace rejection must not be described as a signed-out session.");
assert.equal(requestError({ status: 500 }, { error: "Storage unavailable" }, "Failed"), "Storage unavailable");
assert.match(libraryPage, /!loading && !error && schedules.length === 0/, "Failed requests must never show the empty-library state.");
assert.match(libraryPage, /error && <div role="alert" className="stateError"/, "A failed request must render an error state instead of reporting zero schedules.");
assert.match(libraryPage, /Retry library/, "Failed list requests must offer a retry.");
assert.match(libraryPage, /Retry cover/, "Failed cover requests must offer a retry.");
assert.match(libraryPage, /Preview/, "Library must expose brochure preview.");
assert.match(libraryPage, /Duplicate/, "Library must expose schedule duplication.");
assert.match(libraryPage, /Versions/, "Library must expose version history.");
assert.match(libraryPage, /Download/, "Library must expose PDF download.");
assert.match(libraryPage, /onClick=\{openCreate\}/, "Library must retain its create-schedule control.");
assert.match(libraryPage, /onClick=\{openImport\}/, "Library must retain its reference-PDF import control.");
assert.match(libraryPage, /onSubmit=\{submitSchedule\}/, "Schedule save/import form handler must remain connected.");
assert.match(libraryPage, /onClick=\{\(\) => setPreview/, "Library preview action must remain connected.");
assert.doesNotMatch(sideNav, /\/modules\/builders\/standard-inclusions/, "Standard Inclusions must not appear as a duplicate global sidebar item.");
assert.match(estimateBuilderRoute, /getServerSideProps/, "Project Workspace Standard Inclusions route must be handled before mounting the workbook.");
assert.match(estimateBuilderRoute, /context\.query\?\.page === "standardInclusions"/, "Project Workspace Standard Inclusions query must be matched explicitly.");
assert.match(estimateBuilderRoute, /destination: "\/modules\/builders\/standard-inclusions"/, "Project Workspace must redirect to the canonical Standard Inclusions builder.");
assert.match(setupPage, /Business Profile/, "Schedule setup must identify the existing business profile source.");
assert.match(setupPage, /availableOptions: entity\.attributes\?\.selectionFacets/, "Published product snapshots must preserve real catalogue colour/finish options.");
assert.match(setupPage, /brochureBranding/, "Brochure-specific branding must be persisted per schedule.");
assert.match(setupPage, /export async function getServerSideProps\(context\)/, "The dynamic schedule editor route must be registered server-side.");
assert.match(setupPage, /initialScheduleId/, "The dynamic schedule ID must be available before editor hydration.");
assert.match(setupPage, /workspace-product-library/, "Product proposals must retain workspace product snapshots.");
assert.match(setupPage, /reviewStatus === "approved"/, "Only reviewed products may enter the brochure snapshot.");
assert.match(setupPage, /createPremierInclusionsDocument/, "Brochure design must reuse the existing GoodBuild layout template.");
assert.match(setupPage, /onPdfGenerated={receiveGeneratedPdf}/, "Generated PDF bytes must be available for versioned publishing.");
assert.match(brandingApi, /business_profile_vaults/, "Branding must be imported from the existing Business Profile Vault.");
assert.match(brandingAssetApi, /standard-inclusions\/\$\{req\.workspaceId\}/, "Logo uploads must remain in workspace-specific storage paths.");
assert.match(proposalApi, /createBuilderCatalogueRepository/, "AI proposals must use the existing builder Product Library repository.");
assert.match(proposalApi, /validateProductProposals/, "AI-returned product IDs must be checked against the workspace candidate set.");
assert.match(proposalApi, /eligibleProductIdsByCategory/, "AI output must be revalidated against the deterministic category whitelist.");
assert.match(proposalApi, /gapDetails/, "Unpriced, unclassified, or unselected construction requirements must return explicit builder-review gap reasons.");
assert.match(documentEditor, /onPdfGenerated/, "Document editor must expose the optional generated-PDF callback.");
assert.match(projectAssignmentApi, /Only a fully reviewed and approved schedule/, "Unapproved schedules must not be applied to jobs.");
assert.match(projectAssignmentApi, /PROJECT_INCLUSIONS_ALREADY_ASSIGNED/, "Existing project inclusions must not be overwritten silently.");
assert.match(projectAssignmentApi, /standardScheduleSnapshot/, "Project assignment must preserve structured schedule data.");
assert.match(projectAssignmentApi, /buildStandardInclusionsQuotationSeed/, "Project assignment must prepare the shared quotation seed contract.");
assert.match(projectAssignmentApi, /existingInclusions\.length/, "Existing active inclusions must cause a conflict rather than replacement.");
assert.match(projectAssignmentApi, /related_table: "standard_inclusions_schedules"/, "Project assignment must use the idempotent schedule reference key.");
assert.match(projectAssignmentApi, /STANDARD_SCHEDULE_ALREADY_APPLIED/, "Concurrent duplicate assignments must return a conflict.");
assert.match(projectShape, /standardScheduleSnapshot: metadata\.standardScheduleSnapshot/, "The project-inclusions read API must expose the saved structured snapshot.");
assert.match(projectShape, /quotationSeed: metadata\.quotationSeed/, "The existing Project Inclusions response must expose the structured quotation seed.");
assert.match(projectAssignmentMigration, /create unique index if not exists builder_project_documents_standard_schedule_assignment_uidx/, "Concurrent assignment uniqueness migration is missing.");

assert.match(workbook, /fetchStandardInclusionsPdfLibrary/, "Dashboard must reload saved schedules from the API.");
assert.match(selectionHost, /standardInclusionClientSelectionPatches/, "Client Selections must preload the applied published job baseline.");
assert.match(baselineControl, /api\/builders\/project-inclusions\?projectId=/, "The workbook baseline control must resolve the schedule assigned to the active job.");
assert.match(workbook, /saveStandardInclusionsPdfLibraryUpload/, "Dashboard must save schedules through the persistent API.");
assert.match(workbook, /No Standard Inclusions schedules have been uploaded\./, "Empty library state is missing.");
assert.match(workbook, /Your Inclusions Schedules/, "Library heading is missing.");
assert.match(workbook, /Current Version:/, "Schedule cards must show current version.");
assert.match(workbook, /Replace PDF/, "Schedule cards must expose replace.");
assert.match(workbook, /Version History/, "Schedule cards must expose version history.");
assert.match(workbook, /Archive Schedule/, "Schedule cards must expose archive.");
assert.match(workbook, /standardPdfRecordToBytes/, "Preview must load persisted PDF bytes.");
assert.match(workbook, /record\.publicUrl/, "Preview/download must use persisted file references.");
assert.doesNotMatch(workbook, /localStorage\.setItem\([^)]*pdfMaster/s, "PDF library must not persist through localStorage.");

console.log("Standard Inclusions PDF library persistence contract passed.");
