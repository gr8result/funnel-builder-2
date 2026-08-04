import fs from "node:fs";
import path from "node:path";
import { loadDemonstrationProject, DEMO_PROJECT_CONTEXT } from "../demo/demoProject";
import { InMemoryProductSelectionCatalogueAdapter } from "../products/inMemoryProductSelectionCatalogueAdapter";
import { evaluateProductCompatibility, productMatchesFilters, requirementProductTags } from "../products/requirementProductMatching";
import { createProjectSelection, loadSelectionWorkspace, previewApplyTo, saveWorkspaceDraft } from "../services/selectionWorkspaceService";
import { selectionWorkspaceRepository } from "../repositories/selectionWorkspaceRepository";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function source(...parts: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

function req(workspace: Awaited<ReturnType<typeof loadSelectionWorkspace>>, areaName: string, title: string) {
  const area = workspace.templateStage.areaRegister.areas.find((item) => item.name === areaName);
  const requirement = workspace.requirements.find((item) => item.areaId === area?.id && item.title.toLowerCase().includes(title.toLowerCase()));
  assert(requirement, `${areaName} ${title} requirement should exist.`);
  return requirement;
}

export async function runProductPickerWorkflowTests(): Promise<void> {
  await loadDemonstrationProject({ approvalState: "pending", reset: true });
  const adapter = new InMemoryProductSelectionCatalogueAdapter("org_dev");
  let workspace = await loadSelectionWorkspace(DEMO_PROJECT_CONTEXT);

  const oven = req(workspace, "Kitchen", "Oven");
  assert(requirementProductTags(oven).includes("oven"), "Oven requirement should map to oven tag.");
  const ovenProducts = await adapter.searchCompatibleProducts(oven);
  assert(ovenProducts.length >= 2, "Oven requirement should return oven products.");
  assert(ovenProducts.every((product) => product.selectionVisibility === "client_selectable" || product.selectionVisibility === "builder_selectable"), "Selections picker should only return client/builder selectable products.");
  assert(ovenProducts.every((product) => product.compatibility.requirementTags?.includes("oven")), "Oven requirement should only return oven-tagged products.");
  assert(!ovenProducts.some((product) => product.compatibility.requirementTags?.includes("cooktop")), "Oven requirement should not return cooktops.");
  const filtered900 = ovenProducts.filter((product) => productMatchesFilters(product, { width: "900 mm" }));
  assert(filtered900.length >= 1 && filtered900.every((product) => product.compatibility.width === "900 mm"), "900 mm filter should return only 900 mm ovens.");
  assert(ovenProducts.filter((product) => product.tierId === "tier_premier").length >= 1, "Tier data should be present for picker filtering.");

  const basinMixer = req(workspace, "Ensuite", "Basin Mixer");
  const basinProducts = await adapter.searchCompatibleProducts(basinMixer);
  assert(basinProducts.some((product) => product.compatibility.requirementTags?.includes("basin-mixer")), "Basin Mixer should return basin mixer products.");
  assert(!basinProducts.some((product) => product.compatibility.requirementTags?.includes("shower-mixer")), "Shower mixers should be excluded from basin mixer choices.");
  const inactiveTile = await adapter.getProduct("demo_feature_tile_unavailable");
  assert(inactiveTile && !evaluateProductCompatibility(oven, inactiveTile).compatible, "Inactive/unavailable products should be incompatible.");
  const estimatingRate = await adapter.getProduct("estimating_concrete_slab_rate");
  assert(estimatingRate?.selectionVisibility === "estimating_only", "Demo catalogue should include an estimating-only regression product.");
  assert(!productMatchesFilters(estimatingRate, {}), "Estimating-only products should be excluded from default selections filtering.");

  const variantResult = await createProjectSelection(workspace, basinMixer.id, "demo_phoenix_vivid_basin_mixer", undefined, adapter);
  assert(!variantResult.ok, "Required variant should block selection until chosen.");
  const selectedBasin = await createProjectSelection(workspace, basinMixer.id, "demo_phoenix_vivid_basin_mixer", "demo_phoenix_basin_chrome", adapter);
  assert(selectedBasin.ok && selectedBasin.value, "One-click selection with variant should create a selection.");
  workspace = selectedBasin.value;
  const basinSelection = workspace.selections.find((selection) => selection.requirementId === basinMixer.id);
  assert(basinSelection?.value.productName === "Phoenix Vivid Slimline Basin Mixer", "Selected product display data should be frozen into the draft selection.");
  assert(workspace.locations.some((location) => location.requirementId === basinMixer.id && location.areaId === basinMixer.areaId), "Selection should create the correct room location.");
  assert((basinSelection?.variation?.amount ?? -999) === 0, "Included basin mixer should calculate no variation.");

  const saved = await saveWorkspaceDraft(workspace);
  assert(saved.ok && saved.value, "Selected product should save through workspace draft persistence.");
  const reloaded = await loadSelectionWorkspace(DEMO_PROJECT_CONTEXT, selectionWorkspaceRepository);
  assert(reloaded.selections.some((selection) => selection.requirementId === basinMixer.id && selection.value.variantId === "demo_phoenix_basin_chrome"), "Selected product should persist after reload.");

  const applyPreview = await previewApplyTo(reloaded, basinMixer.id, "every_compatible_requirement", [], adapter);
  assert(applyPreview.compatibleTargets.some((target) => target.projectAreaName === "Main Bathroom"), "Apply To should find compatible bathroom basin targets.");
  assert(applyPreview.compatibleTargets.some((target) => target.projectAreaName === "Powder Room"), "Apply To should find compatible powder room basin targets.");
  assert(applyPreview.incompatibleTargets.some((target) => target.requirementName.includes("Shower Mixer")), "Apply To should leave shower mixers incompatible.");

  const modalSource = source("src", "modules", "inclusions-selections", "components", "ProductSelectionModal.tsx");
  assert(modalSource.includes("role=\"dialog\"") && modalSource.includes("ProductSelectionModal"), "Product picker modal should render as a dialog.");
  assert(modalSource.includes("simplePickerControls") && modalSource.includes("All Brands") && modalSource.includes("Add To Selections"), "Modal should expose the simple visual picker controls and an Add To Selections button.");
  assert(!modalSource.includes("All suppliers") && !modalSource.includes("All tiers") && !modalSource.includes("Compare"), "Normal picker should not expose technical filter controls.");
  assert(!modalSource.includes("tierBadge") && !modalSource.includes("<dt>Tier</dt>"), "Normal picker should not expose tier metadata.");
  const workspacePage = source("pages", "inclusions-selections", "workspace.tsx");
  assert(workspacePage.includes("Prepare Selection Items") && workspacePage.includes("handleGenerateRequirements"), "Workspace should expose a user-facing preparation step when selections have not been created yet.");
  assert(workspacePage.includes('area.name.toLowerCase() === "kitchen"'), "Workspace should default to Kitchen when it is available.");
  assert(workspacePage.includes("selectionItemList") && workspacePage.includes("selectionItemRow") && workspacePage.includes("tileImage"), "Workspace should render a screen-first selection item list with thumbnails.");
  assert(workspacePage.includes("openProductPicker(row.requirement.id)") && workspacePage.includes("tileProduct"), "Clicking a selection item should open the product picker and selected products should render on the row.");
  assert(!workspacePage.includes("tierBadge"), "Normal workspace tiles should not expose tier terminology.");
  assert(workspacePage.includes("productModalBody") && workspacePage.includes("@media (max-width: 760px)"), "Modal should include desktop and mobile layout styles.");
  assert(modalSource.includes("ProductDetailView") && modalSource.includes("Back to Products") && modalSource.includes("Add To Selections"), "Product image/details flow should open a larger detail view.");
  assert(modalSource.includes('rel="noopener noreferrer"') && modalSource.includes("View Official Product Page"), "Supplier links should open exact stored URLs in a new tab.");
  assert(!modalSource.includes("builderCost"), "Client picker must not render builder cost fields.");
  const adapterSource = source("src", "modules", "inclusions-selections", "products", "inMemoryProductSelectionCatalogueAdapter.ts");
  assert(!adapterSource.includes("product.productUrl ??"), "Demo adapter must not fabricate guessed supplier URLs.");

  const csvValidation = source("lib", "product-library", "selectionsClassification.js");
  assert(csvValidation.includes("validateSelectionsProductCsvRecord") && csvValidation.includes("requirement_tags is required") && csvValidation.includes("category is required") && csvValidation.includes("selection_visibility must be one of"), "CSV validation should detect missing tags, categories and invalid selection visibility.");
  const clientProjectionSource = source("src", "modules", "inclusions-selections", "services", "selectionReviewService.ts");
  const clientProjection = clientProjectionSource.slice(clientProjectionSource.indexOf("export function buildClientVariationProjection"), clientProjectionSource.indexOf("export function buildBuilderInternalProjection"));
  assert(!clientProjection.includes("builderCost"), "Client-facing variation projection should exclude builder cost.");
}

runProductPickerWorkflowTests();
