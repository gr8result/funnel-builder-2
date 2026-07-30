import fs from "node:fs";
import path from "node:path";
import type { ProjectAreaRegister } from "../repositories/projectAreaRegisterRepository";
import { InMemoryProjectAreaRegisterRepository } from "../repositories/projectAreaRegisterRepository";
import {
  assignProjectAreaLevel,
  canContinueToTemplates,
  createCustomProjectArea,
  createCustomProjectLevel,
  deleteProjectArea,
  duplicateProjectArea,
  loadProjectAreaRegister,
  renameProjectArea,
  saveProjectAreaRegister,
  setAreaQuantity,
  validateProjectAreaRegister,
  validateProjectContext,
} from "../services/projectAreaRegisterService";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function value<T>(result: { ok: boolean; value?: T; issues: unknown[] }, message: string): T {
  assert(result.ok && result.value, `${message}: ${JSON.stringify(result.issues)}`);
  return result.value;
}

async function baseRegister(repository = new InMemoryProjectAreaRegisterRepository()): Promise<ProjectAreaRegister> {
  return loadProjectAreaRegister({ organisationId: "org_areas", projectId: "project_areas", projectName: "Stage One Test" }, repository);
}

export async function runCreateAreasStageTests(): Promise<void> {
  assert(!validateProjectContext({ organisationId: "org_only" }).ok, "Project context requires a project id.");

  const repository = new InMemoryProjectAreaRegisterRepository();
  let register = await baseRegister(repository);
  assert(register.levels.some((level) => level.name === "Ground Floor"), "Standard project levels should be created.");
  assert(register.levels.some((level) => level.name === "External"), "External level should be available.");
  assert(!canContinueToTemplates(register).ok, "Cannot continue before at least one area is selected.");

  register = value(setAreaQuantity(register, "area_type_master_bedroom", 1), "Master bedroom should be selectable");
  register = value(setAreaQuantity(register, "area_type_bedroom", 4), "Bedroom quantity should generate rooms");
  register = value(setAreaQuantity(register, "area_type_bathroom", 2), "Bathroom quantity should generate rooms");
  assert(register.areas.filter((area) => area.areaTypeId === "area_type_bedroom").length === 4, "Bedroom quantity should create four bedroom areas.");
  const bedroomIds = register.areas.filter((area) => area.areaTypeId === "area_type_bedroom").map((area) => area.id);
  register = value(setAreaQuantity(register, "area_type_bedroom", 5), "Increasing bedroom quantity should preserve existing areas");
  assert(bedroomIds.every((id) => register.areas.some((area) => area.id === id)), "Increasing quantity should not regenerate existing area ids.");

  const bedroomOne = register.areas.find((area) => area.areaTypeId === "area_type_bedroom" && area.generatedOrdinal === 1);
  assert(bedroomOne, "Generated Bedroom 1 should exist.");
  register = value(renameProjectArea(register, bedroomOne.id, "Guest Suite"), "Generated area names should be editable.");
  const removal = setAreaQuantity(register, "area_type_bedroom", 2);
  assert(!removal.ok && removal.removalPreview.eligibleForRemoval.length === 3, "Lowering quantity should preview generated removals before applying.");
  register = value(setAreaQuantity(register, "area_type_bedroom", 2, true), "Confirmed lower quantity should remove eligible generated rooms.");
  assert(register.areas.some((area) => area.name === "Guest Suite"), "Customised generated area should remain when lowering quantity.");

  const upper = register.levels.find((level) => level.code === "upper-floor");
  assert(upper, "Upper floor level should exist.");
  register = value(createCustomProjectLevel(register, "Mezzanine"), "Custom levels should be addable.");
  const guestSuite = register.areas.find((area) => area.name === "Guest Suite");
  assert(guestSuite, "Guest Suite should still exist.");
  register = value(assignProjectAreaLevel(register, guestSuite.id, upper.id), "Areas should be assignable to stable level ids.");
  const sameName = register.areas.find((area) => area.areaTypeId === "area_type_bathroom");
  assert(sameName, "A bathroom should exist for duplicate-name checks.");
  register = value(renameProjectArea(register, sameName.id, "Guest Suite"), "Same area name should be allowed on a different level.");
  assert(validateProjectAreaRegister(register).ok, "Duplicate area names should be allowed across different levels.");

  const secondBathroom = register.areas.find((area) => area.areaTypeId === "area_type_bathroom" && area.id !== sameName.id);
  assert(secondBathroom, "A second bathroom should exist.");
  register = value(renameProjectArea(register, secondBathroom.id, "Guest Suite"), "Duplicate same-level setup should be editable.");
  assert(!validateProjectAreaRegister(register).ok, "Duplicate area names on the same level should be invalid.");
  register = value(renameProjectArea(register, secondBathroom.id, "Main Bathroom"), "Duplicate should be fixable.");

  register = value(duplicateProjectArea(register, secondBathroom.id), "Areas should be duplicable.");
  assert(register.areas.some((area) => area.name === "Main Bathroom Copy"), "Duplicated area should have its own permanent id and name.");
  const duplicate = register.areas.find((area) => area.name === "Main Bathroom Copy");
  assert(duplicate, "Duplicate should exist.");
  register = value(deleteProjectArea(register, duplicate.id), "Unlinked duplicated areas should be safely removable.");

  register = value(createCustomProjectArea(register, { name: "Mud Room", groupId: "area_group_custom", levelId: upper.id }), "Custom areas should be addable.");
  assert(register.customAreaTypes.some((type) => type.name === "Mud Room" && type.organisationId === register.organisationId), "Custom area type should be organisation-scoped.");
  const badOrg: ProjectAreaRegister = {
    ...register,
    customAreaTypes: [{ ...register.customAreaTypes[0], id: "area_type_bad_org", organisationId: "other_org" }],
    areas: [{ ...register.areas[0], areaTypeId: "area_type_bad_org", sourceAreaTypeId: "area_type_bad_org" }],
  };
  assert(!validateProjectAreaRegister(badOrg).ok, "Custom area types from another organisation should be rejected.");

  const saved = value(await saveProjectAreaRegister(register, repository), "Valid register should save.");
  const reloaded = await loadProjectAreaRegister({ organisationId: saved.organisationId, projectId: saved.projectId }, repository);
  assert(reloaded.areas.map((area) => area.id).join("|") === saved.areas.map((area) => area.id).join("|"), "Reload should preserve area ids and stored image-free URLs are not involved in this stage.");
  const wrongOrg = await loadProjectAreaRegister({ organisationId: "other_org", projectId: saved.projectId }, repository);
  assert(wrongOrg.areas.length === 0, "In-memory repository should not leak registers across organisations.");
  assert(canContinueToTemplates(saved).ok, "Valid saved area register can continue to templates.");

  const pageSource = fs.readFileSync(path.join(process.cwd(), "pages", "inclusions-selections", "areas.tsx"), "utf8");
  const registerSource = fs.readFileSync(path.join(process.cwd(), "src", "modules", "inclusions-selections", "components", "GeneratedAreaRegister.tsx"), "utf8");
  assert(pageSource.includes('hrefForStage("templates"'), "Continue action should route to the templates stage through shared stage navigation.");
  assert(pageSource.includes("PROJECT_REQUIRED_MESSAGE"), "Missing project context should use the shared friendly blocking state.");
  assert(pageSource.includes("@media (max-width: 760px)") && registerSource.includes("areaCard"), "The register should include a responsive mobile card view.");
  assert(!pageSource.includes("lib/builders/selectionBudget") && !pageSource.includes("ProductLibrary") && !pageSource.includes("Estimate Builder"), "Create Areas page should stay isolated from retired selections, Product Library and Estimate Builder imports.");
}

runCreateAreasStageTests();
