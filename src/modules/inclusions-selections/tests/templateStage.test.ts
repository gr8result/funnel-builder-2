import fs from "node:fs";
import path from "node:path";
import { saveProjectAreaRegister, setAreaQuantity } from "../services/projectAreaRegisterService";
import {
  applyBuilderTemplate,
  archiveBuilderTemplate,
  assignAreaGroupTier,
  assignAreaTemplate,
  assignAreaTypeTier,
  assignProjectAreaTier,
  assignProjectTier,
  createCustomAreaTemplate,
  createCustomRequirementDefinition,
  duplicateBuilderTemplate,
  loadTemplateStage,
  previewRequirementGeneration,
  reconcileProjectRequirements,
  renameBuilderTemplate,
  resetTemplateOverride,
  saveBuilderTemplate,
  saveTemplateStage,
  validateTemplateStage,
} from "../services/templateStageService";
import { InMemoryTemplateStageRepository } from "../repositories/templateStageRepository";
import { STANDARD_AREA_TEMPLATES } from "../templates/standardAreaTemplates";
import type { ProjectRequirement } from "../requirements/requirementTypes";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function value<T>(result: { ok: boolean; value?: T; issues: unknown[] }, message: string): T {
  assert(result.ok && result.value, `${message}: ${JSON.stringify(result.issues)}`);
  return result.value;
}

function templateTitles(areaTypeId: string): string[] {
  const template = STANDARD_AREA_TEMPLATES.find((item) => item.areaTypeId === areaTypeId);
  assert(template, `${areaTypeId} should have a standard template.`);
  return template.requirementDefinitions.map((definition) => definition.title);
}

async function seedAreas() {
  const context = { organisationId: "org_stage_2", projectId: "project_stage_2", projectName: "Stage 2 Test" };
  let register = await import("../services/projectAreaRegisterService").then((module) => module.loadProjectAreaRegister(context));
  register = value(setAreaQuantity(register, "area_type_master_bedroom", 1), "master bedroom selectable");
  register = value(setAreaQuantity(register, "area_type_bedroom", 2), "bedrooms selectable");
  register = value(setAreaQuantity(register, "area_type_bathroom", 1), "bathroom selectable");
  register = value(setAreaQuantity(register, "area_type_ensuite", 1), "ensuite selectable");
  register = value(setAreaQuantity(register, "area_type_kitchen", 1), "kitchen selectable");
  register = value(setAreaQuantity(register, "area_type_external_living", 1), "alfresco selectable");
  value(await saveProjectAreaRegister(register), "area register should save");
  return context;
}

export async function runTemplateStageTests(): Promise<void> {
  const context = await seedAreas();
  const repository = new InMemoryTemplateStageRepository();
  let state = await loadTemplateStage(context, repository);
  assert(state.areaRegister.areas.length >= 7, "Stage 2 loads ProjectAreas created in Stage 1.");
  assert((await loadTemplateStage({ organisationId: "other_org", projectId: context.projectId }, repository)).areaRegister.areas.length === 0, "Cross-organisation areas are not loaded.");
  assert(!validateTemplateStage({ ...state, areaRegister: { ...state.areaRegister, areas: [] } }).ok, "No ProjectAreas blocks progression.");

  state = value(assignProjectTier(state, "tier_classic"), "Classic can be assigned project-wide.");
  state = value(assignProjectTier(state, "tier_premier"), "Premier can be assigned project-wide.");
  state = value(assignProjectTier(state, "tier_premium"), "Premium can be assigned project-wide.");
  state = value(assignProjectTier(state, "tier_custom"), "Custom can be assigned project-wide.");
  state = value(assignProjectTier(state, "tier_premier"), "Premier restored.");
  state = value(assignAreaGroupTier(state, "area_group_bedrooms", "tier_premier"), "Bedrooms can inherit Premier.");
  state = value(assignAreaGroupTier(state, "area_group_wet_areas", "tier_premium"), "Wet Areas can override to Premium.");
  state = value(assignAreaTypeTier(state, "area_type_bathroom", "tier_classic"), "AreaType override can be assigned.");
  const bathroom = state.areaRegister.areas.find((area) => area.areaTypeId === "area_type_bathroom");
  const ensuite = state.areaRegister.areas.find((area) => area.areaTypeId === "area_type_ensuite");
  const master = state.areaRegister.areas.find((area) => area.areaTypeId === "area_type_master_bedroom");
  assert(bathroom && ensuite && master, "Seeded bathroom, ensuite and master bedroom should exist.");
  state = value(assignAreaTemplate(state, { scope: "area_type", areaTypeId: "area_type_bathroom", templateId: "area_template_bathroom" }), "All Bathrooms can use a Bathroom template.");
  state = value(assignProjectAreaTier(state, ensuite.id, "tier_premium"), "Ensuite can override its tier.");
  state = value(assignAreaTemplate(state, { scope: "project_area", areaId: master.id, templateId: "area_template_master_bedroom" }), "Master Bedroom can use a different AreaTemplate.");
  const resetType = value(resetTemplateOverride(state, "area_type", "area_type_bathroom"), "Resetting AreaType restores inheritance.");
  assert(resetType.configuration.areaTypeOverrides.length === 0, "AreaType override reset should remove the override.");
  assert(resetType.areaRegister.areas.find((area) => area.id === master.id)?.name === master.name, "Stage 2 must not change ProjectArea names.");
  state = value(resetTemplateOverride(state, "project_area", master.id), "Individual reset restores inherited values.");

  let preview = previewRequirementGeneration(state);
  assert(preview.added.some((requirement) => requirement.category === "flooring"), "Bedroom template generates floor covering requirements.");
  assert(preview.added.some((requirement) => requirement.title === "Basin Mixer"), "Bathroom/Ensuite templates generate wet-area requirements.");
  assert(preview.added.some((requirement) => requirement.category === "appliance"), "Kitchen template generates appliance requirements.");
  const balconyTitles = templateTitles("area_type_balcony");
  assert(balconyTitles.includes("Balustrade") && balconyTitles.includes("Waterproofing"), "Balcony has its own balcony-specific template.");
  assert(!["House Numbers", "External Doors", "Brick or Cladding", "Windows"].some((title) => balconyTitles.includes(title)), "Balcony must not inherit exterior wall/door/house-number selections.");
  const drivewayTitles = templateTitles("area_type_driveway");
  assert(drivewayTitles.includes("Surface Type") && drivewayTitles.includes("Crossover") && drivewayTitles.includes("Expansion Joints"), "Driveway has driveway-specific concrete requirements.");
  assert(!["House Numbers", "External Doors", "Windows"].some((title) => drivewayTitles.includes(title)), "Driveway must not inherit exterior house/door/window selections.");
  const ensuiteTitles = templateTitles("area_type_ensuite");
  assert(["Floor Tile", "Wall Tile", "Feature Tile", "Waterproofing"].every((title) => ensuiteTitles.includes(title)), "Ensuite exposes wet-area tile and waterproofing requirements.");
  const masterBedroomTitles = templateTitles("area_type_master_bedroom");
  assert(["Carpet", "Hybrid Flooring", "Timber Flooring"].every((title) => masterBedroomTitles.includes(title)), "Master Bedroom exposes bedroom flooring choices.");
  state = value(reconcileProjectRequirements(state), "Requirements should generate.");
  const requirementIds = state.requirements.map((requirement) => requirement.id).join("|");
  state = value(reconcileProjectRequirements(state), "Repeated generation should not duplicate requirements.");
  assert(state.requirements.map((requirement) => requirement.id).join("|") === requirementIds, "Existing ProjectRequirement IDs remain stable.");

  const protectedRequirement: ProjectRequirement = { ...state.requirements[0], definitionId: "req_def_obsolete_protected", id: "requirement_obsolete_protected", hasSelection: true };
  state = { ...state, requirements: [...state.requirements, protectedRequirement] };
  preview = previewRequirementGeneration(state);
  assert(preview.protected.some((requirement) => requirement.id === protectedRequirement.id), "Protected obsolete requirements are retained.");
  const manualRequirement: ProjectRequirement = { ...state.requirements[0], id: "requirement_manual_custom", definitionId: "manual_custom", title: "Manual Custom", manualCustomisation: true };
  state = value(reconcileProjectRequirements({ ...state, requirements: [...state.requirements, manualRequirement] }), "Manual custom requirements should remain.");
  assert(state.requirements.some((requirement) => requirement.id === manualRequirement.id), "Manual custom requirement remains after reconcile.");

  state = value(createCustomAreaTemplate(state, ensuite.id, []), "Custom template mode can be assigned.");
  assert(!validateTemplateStage(state).ok, "Blank Custom area cannot progress.");
  const customDefinition = createCustomRequirementDefinition("Custom Niche", "fixture", 1);
  state = value(createCustomAreaTemplate(state, ensuite.id, [customDefinition]), "Organisation-scoped custom requirement can be created.");
  state = value(reconcileProjectRequirements(state), "Custom requirements can generate.");
  assert(state.templates.some((template) => template.organisationId === state.context.organisationId && template.requirementDefinitions.some((definition) => definition.title === "Custom Niche")), "Custom AreaTemplate should be saved in state.");

  const saved = await saveBuilderTemplate(state, "Premier Single-Storey", "Test saved builder template", repository);
  const renamed = await renameBuilderTemplate(saved, "Premier Single-Storey Updated", repository);
  assert(renamed.name.endsWith("Updated"), "Saved template can be renamed.");
  const duplicate = await duplicateBuilderTemplate(renamed, repository);
  assert(duplicate.id !== renamed.id, "Saved template can be duplicated.");
  await archiveBuilderTemplate(duplicate, repository);
  const reloadedWithTemplates = await loadTemplateStage(context, repository);
  assert(!reloadedWithTemplates.savedBuilderTemplates.some((template) => template.id === duplicate.id), "Archived template is not offered by default.");
  state = value(applyBuilderTemplate(state, renamed), "Saved template can be reapplied.");
  assert(!applyBuilderTemplate(state, { ...renamed, organisationId: "other_org" }).ok, "Saved template cannot leak between organisations.");

  state = value(reconcileProjectRequirements(state), "Generated requirements allow progression.");
  value(await saveTemplateStage(state, repository), "Template assignments save through repositories.");
  const reloaded = await loadTemplateStage(context, repository);
  assert(reloaded.configuration.projectDefault.tierId === state.configuration.projectDefault.tierId, "Assignments reload.");
  assert(reloaded.requirements.map((requirement) => requirement.id).join("|") === state.requirements.map((requirement) => requirement.id).join("|"), "ProjectRequirement IDs remain stable after reload.");

  const badTemplateState = { ...state, templates: [{ ...STANDARD_AREA_TEMPLATES[0], id: "bad_template", organisationId: "other_org" }], configuration: { ...state.configuration, areaOverrides: [{ scope: "project_area" as const, areaId: master.id, templateId: "bad_template" }] } };
  assert(!validateTemplateStage(badTemplateState).ok, "Cross-organisation template is rejected.");
  const emptyTemplateState = { ...state, templates: [{ ...STANDARD_AREA_TEMPLATES[0], id: "empty_template", requirementDefinitions: [] }], configuration: { ...state.configuration, areaOverrides: [{ scope: "project_area" as const, areaId: master.id, templateId: "empty_template" }] } };
  assert(!validateTemplateStage(emptyTemplateState).ok, "Empty template blocks progression.");

  const pageSource = fs.readFileSync(path.join(process.cwd(), "pages", "inclusions-selections", "templates.tsx"), "utf8");
  const workspaceSource = fs.readFileSync(path.join(process.cwd(), "pages", "inclusions-selections", "workspace.tsx"), "utf8");
  assert(pageSource.includes("Choose an Area"), "Stage 2 route should render the area navigator title.");
  assert(pageSource.includes("Select the area of the home you want to complete."), "Stage 2 should explain the area-first workflow.");
  assert(pageSource.includes("Exterior") && pageSource.includes("Interior"), "Stage 2 should start with Exterior and Interior choices.");
  assert(pageSource.includes("Bricks") && pageSource.includes("Cladding") && pageSource.includes("Driveway"), "Exterior should expose product-type tiles.");
  assert(pageSource.includes("Kitchen") && pageSource.includes("Bathrooms") && pageSource.includes("Bedrooms"), "Interior should expose room tiles.");
  assert(pageSource.includes("Oven") && pageSource.includes("Cooktop") && pageSource.includes("Dishwasher"), "Kitchen should expose product picker tiles.");
  assert(!pageSource.includes("Room Templates and Inclusion Tiers"), "Stage 2 should not expose the retired template page title.");
  assert(!pageSource.includes("Generate ProjectRequirements") && !pageSource.includes("Preview") && !pageSource.includes("Reset"), "Stage 2 should not show backend generation controls.");
  assert(pageSource.includes('currentStage="templates"'), "Stage 2 should remain connected to shared stage navigation.");
  assert(pageSource.includes('hrefForStage("workspace"'), "Valid stage reaches workspace through shared stage navigation.");
  assert(workspaceSource.includes("Inclusions and Selections Workspace"), "Workspace route should now be the Stage 3 workspace.");
  assert(workspaceSource.includes("Prepare Selection Items") && !workspaceSource.includes("Generate ProjectRequirements"), "Workspace fallback should use user-facing selection language.");
  assert(workspaceSource.includes("queryValue(router.query.productType)") && workspaceSource.includes("openProductPicker(matchingRow.requirement.id)"), "Stage 2 product-type choices should open the matching picker in Stage 3.");
  assert(pageSource.includes("@media (max-width: 560px)") && pageSource.includes("tileGrid"), "Responsive mobile tiles should be present.");
  assert(!pageSource.includes("ProductLibrary") && !pageSource.includes("Estimate Builder") && !pageSource.includes("selectionBudget"), "No product selection or Estimate Builder code is loaded.");
}

runTemplateStageTests();
