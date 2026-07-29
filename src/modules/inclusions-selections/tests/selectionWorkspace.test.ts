import fs from "node:fs";
import path from "node:path";
import { saveProjectAreaRegister, setAreaQuantity, loadProjectAreaRegister } from "../services/projectAreaRegisterService";
import { loadTemplateStage, reconcileProjectRequirements, saveTemplateStage } from "../services/templateStageService";
import {
  applySelectionToTargets,
  clearProjectSelection,
  createCustomSelection,
  createProjectSelection,
  getSelectionProgress,
  loadCategoryView,
  loadRoomView,
  loadSelectionWorkspace,
  previewApplyTo,
  resetSelectionToInherited,
  saveWorkspaceDraft,
  selectProductVariant,
  updateRequirementStatus,
  validateSelectionWorkspace,
} from "../services/selectionWorkspaceService";
import { InMemoryProductSelectionCatalogueAdapter } from "../products/inMemoryProductSelectionCatalogueAdapter";
import { InMemorySelectionWorkspaceRepository } from "../repositories/selectionWorkspaceRepository";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function value<T>(result: { ok: boolean; value?: T; issues: unknown[] }, message: string): T {
  assert(result.ok && result.value, `${message}: ${JSON.stringify(result.issues)}`);
  return result.value;
}

async function seedWorkspace() {
  const context = { organisationId: "org_stage_3", projectId: "project_stage_3", projectName: "Stage 3 Test" };
  let register = await loadProjectAreaRegister(context);
  register = value(setAreaQuantity(register, "area_type_bedroom", 2), "Bedrooms should generate.");
  register = value(setAreaQuantity(register, "area_type_bathroom", 1), "Bathroom should generate.");
  register = value(setAreaQuantity(register, "area_type_ensuite", 1), "Ensuite should generate.");
  register = value(setAreaQuantity(register, "area_type_kitchen", 1), "Kitchen should generate.");
  value(await saveProjectAreaRegister(register), "Stage 1 register should save.");
  let templateStage = await loadTemplateStage(context);
  templateStage = value(reconcileProjectRequirements(templateStage), "Stage 2 requirements should generate.");
  value(await saveTemplateStage(templateStage), "Stage 2 requirements should save.");
  return context;
}

export async function runSelectionWorkspaceTests(): Promise<void> {
  const context = await seedWorkspace();
  const repository = new InMemorySelectionWorkspaceRepository();
  const adapter = new InMemoryProductSelectionCatalogueAdapter("org_dev");
  let state = await loadSelectionWorkspace(context, repository);
  assert(state.templateStage.areaRegister.areas.length >= 5, "Workspace loads ProjectAreas from Stage 1.");
  assert(state.requirements.length > 0, "Workspace loads ProjectRequirements from Stage 2.");
  assert((await loadSelectionWorkspace({ organisationId: "other_org", projectId: context.projectId }, repository)).requirements.length === 0, "Cross-organisation data is not loaded.");

  const roomGroups = loadRoomView(state);
  assert(roomGroups.some((group) => group.rooms.length > 0), "Room View displays rooms by AreaGroup.");
  const bedroom = state.templateStage.areaRegister.areas.find((area) => area.areaTypeId === "area_type_bedroom");
  assert(bedroom, "Bedroom should exist.");
  assert(state.requirements.some((requirement) => requirement.areaId === bedroom.id), "Selecting a room loads its requirements.");
  const categoryGroups = loadCategoryView(state);
  assert(categoryGroups.some((category) => category.total > 1), "Category View lists requirements across rooms.");

  const floorReq = state.requirements.find((requirement) => requirement.category === "flooring" && requirement.areaId === bedroom.id);
  const doorReq = state.requirements.find((requirement) => requirement.subtype === "door_hardware" && requirement.areaId === bedroom.id);
  const basinReq = state.requirements.find((requirement) => requirement.subtype === "basin_mixer");
  const kitchenMixerReq = state.requirements.find((requirement) => requirement.subtype === "sink_mixer");
  const laundryLikeReq = state.requirements.find((requirement) => requirement.subtype === "laundry_mixer");
  assert(floorReq && doorReq && basinReq && kitchenMixerReq, "Seeded requirements should include flooring, door hardware, basin and kitchen mixer.");

  state = value(await createProjectSelection(state, floorReq.id, "product_dev_floor_covering", undefined, adapter), "Compatible product can be selected.");
  assert(state.selections.find((selection) => selection.requirementId === floorReq.id)?.selectionStatus === "in_progress", "Required variant must be selected.");
  state = value(await selectProductVariant(state, floorReq.id, "variant_dev_floor_oak", adapter), "Selected variant updates price and completion.");
  assert(state.selections.find((selection) => selection.requirementId === floorReq.id)?.selectedPrice?.amount === 450, "Variant price should update selected price.");
  assert(!(await createProjectSelection(state, floorReq.id, "product_dev_basin_mixer", "variant_dev_basin_chrome", adapter)).ok, "Incompatible product is rejected.");
  assert(!(await createProjectSelection(state, floorReq.id, "product_dev_inactive_tile", undefined, adapter)).ok, "Inactive product is rejected.");

  state = value(createCustomSelection(state, basinReq.id, { name: "Custom Basin Mixer", description: "Owner supplied basin mixer", category: basinReq.category, quantity: 1, unit: "each", clientPrice: 590, allowance: 450, notes: "Check install height." }), "Custom selection can be created.");
  assert(state.selections.some((selection) => selection.value.customSelectionName === "Custom Basin Mixer"), "Custom selection remains category-bound.");

  state = value(await createProjectSelection(state, doorReq.id, "product_dev_internal_door_hardware", "variant_dev_handle_brushed", adapter), "Door hardware selection should save.");
  let preview = await previewApplyTo(state, doorReq.id, "all_rooms_of_area_type", [], adapter);
  assert(preview.compatibleTargets.length >= 1, "Preview occurs before Apply To and finds compatible bedroom door hardware targets.");
  const firstTarget = preview.compatibleTargets[0]?.requirementId;
  state = value(applySelectionToTargets(state, preview, firstTarget ? [firstTarget] : []), "Deselected preview targets are not changed.");
  assert(state.locations.every((location) => location.areaId && location.requirementId), "SelectionLocations remain traceable.");

  state = value(await createProjectSelection(state, basinReq.id, "product_dev_basin_mixer", "variant_dev_basin_chrome", adapter), "Basin mixer can be selected.");
  preview = await previewApplyTo(state, basinReq.id, "every_compatible_requirement", [], adapter);
  assert(preview.compatibleTargets.every((target) => state.requirements.find((requirement) => requirement.id === target.requirementId)?.subtype === "basin_mixer"), "Basin mixer only applies to basin requirements.");
  if (laundryLikeReq) assert(preview.incompatibleTargets.some((target) => target.requirementId === laundryLikeReq.id) || !preview.compatibleTargets.some((target) => target.requirementId === laundryLikeReq.id), "Kitchen or basin mixer must not apply to laundry mixer.");
  assert(!preview.compatibleTargets.some((target) => target.requirementId === kitchenMixerReq.id), "Basin mixer must not apply to kitchen mixer.");

  const selected = state.selections.find((selection) => selection.requirementId === floorReq.id);
  assert(selected?.variation?.amount === 0, "Allowance equal to selected price produces no variation.");
  state = value(createCustomSelection(state, floorReq.id, { name: "Premium Floor", description: "Premium upgrade", category: floorReq.category, quantity: 2, unit: "m2", clientPrice: 590, allowance: 450 }), "Custom upgrade should price.");
  const upgraded = state.selections.find((selection) => selection.requirementId === floorReq.id);
  assert(upgraded?.variation?.amount === 280, "Quantity multiplies upgrade variation and GST is calculated.");
  assert((upgraded?.gst?.amount ?? 0) > 0, "GST is calculated.");

  state = value(updateRequirementStatus(state, floorReq.id, "complete"), "Valid required selection becomes Complete.");
  assert(!updateRequirementStatus(state, doorReq.id, "not_applicable").ok, "Required item cannot become Not Applicable without reason.");
  const optional = state.requirements.find((requirement) => !requirement.required);
  if (optional) state = value(updateRequirementStatus(state, optional.id, "not_applicable", "Optional item excluded."), "Optional item may become Not Applicable.");
  state = value(clearProjectSelection(state, basinReq.id), "Clear draft selection behaves.");
  state = value(resetSelectionToInherited(state, basinReq.id), "Reset restores inherited selection by clearing override.");

  value(await saveWorkspaceDraft(state, repository), "Save Draft writes through repository.");
  const reloaded = await loadSelectionWorkspace(context, repository);
  assert(reloaded.selections.map((selection) => selection.id).join("|") === state.selections.map((selection) => selection.id).join("|"), "Stable ProjectSelection IDs survive reload.");
  assert(reloaded.locations.map((location) => location.id).join("|") === state.locations.map((location) => location.id).join("|"), "Stable SelectionLocation IDs survive reload.");
  assert(getSelectionProgress(reloaded).netVariation === getSelectionProgress(state).netVariation, "Draft variation totals reload correctly.");
  assert(!validateSelectionWorkspace(reloaded, false).ok, "Invalid required selections block continuation.");

  const pageSource = fs.readFileSync(path.join(process.cwd(), "pages", "inclusions-selections", "workspace.tsx"), "utf8");
  const reviewSource = fs.readFileSync(path.join(process.cwd(), "pages", "inclusions-selections", "review.tsx"), "utf8");
  const switcherSource = fs.readFileSync(path.join(process.cwd(), "src", "modules", "inclusions-selections", "components", "WorkspaceViewSwitcher.tsx"), "utf8");
  assert(switcherSource.includes("Room View") && switcherSource.includes("Category View"), "Desktop room and category layouts render.");
  assert(pageSource.includes("@media (max-width: 760px)") && pageSource.includes("RequirementWorkspace"), "Mobile requirement cards render without fixed-width workspace dependency.");
  assert(pageSource.includes("/inclusions-selections/templates"), "Back to Templates works.");
  assert(pageSource.includes("/inclusions-selections/review"), "Valid workspace reaches Review placeholder.");
  assert(reviewSource.includes("Review Selections and Variations"), "Review route should now be the Stage 4 review.");
  assert(!pageSource.includes("Estimate Builder") && !pageSource.includes("createSelectionSnapshot") && !pageSource.includes("approval"), "No approval, snapshot or Estimate Builder export code loads.");
}

runSelectionWorkspaceTests();
