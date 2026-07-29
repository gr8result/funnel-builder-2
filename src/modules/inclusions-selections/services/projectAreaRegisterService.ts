import type { AreaGroup } from "../area-groups/areaGroupTypes";
import { STANDARD_AREA_GROUPS } from "../area-groups/standardAreaGroups";
import type { AreaType } from "../area-types/areaTypeTypes";
import { STANDARD_AREA_TYPES } from "../area-types/standardAreaTypes";
import { isRepeatableAreaType } from "../areas/areaChecklistCatalog";
import type { ProjectArea } from "../areas/projectAreaTypes";
import type { ProjectLevel } from "../levels/projectLevelTypes";
import { createStandardProjectLevels, makeProjectLevelId } from "../levels/standardProjectLevels";
import type { ProjectAreaRegister, ProjectAreaRegisterRepository, ProjectSelectionContext } from "../repositories/projectAreaRegisterRepository";
import { projectAreaRegisterRepository } from "../repositories/projectAreaRegisterRepository";
import type { AreaTypeId, ProjectAreaId, ProjectLevelId } from "../shared/ids";
import { makeScopedId } from "../shared/ids";
import type { DomainIssue, DomainResult } from "../validation/errors";
import { issue, ok } from "../validation/errors";

export type AreaRemovalPreview = {
  eligibleForRemoval: ProjectArea[];
  protectedFromRemoval: ProjectArea[];
};

export type AreaQuantityResult = DomainResult<ProjectAreaRegister> & {
  removalPreview: AreaRemovalPreview;
};

export type ProjectAreaRegisterSaveResult = DomainResult<ProjectAreaRegister>;

function blankRegister(context: ProjectSelectionContext): ProjectAreaRegister {
  return {
    ...context,
    levels: createStandardProjectLevels(context.organisationId, context.projectId),
    areas: [],
    customAreaTypes: [],
    selections: [],
    updatedAt: new Date().toISOString(),
  };
}

function clone(register: ProjectAreaRegister): ProjectAreaRegister {
  return structuredClone(register);
}

function fail<T>(code: string, message: string, path?: string): DomainResult<T> {
  return { ok: false, issues: [issue(code, message, path)] };
}

export function validateProjectContext(context: Partial<ProjectSelectionContext>): DomainResult<ProjectSelectionContext> {
  if (!context.organisationId || !context.projectId) {
    return fail("missing_project_context", "Open an existing project before creating selection areas.");
  }
  return ok(context as ProjectSelectionContext);
}

export async function loadProjectAreaRegister(
  context: ProjectSelectionContext,
  repository: ProjectAreaRegisterRepository = projectAreaRegisterRepository,
): Promise<ProjectAreaRegister> {
  const saved = await repository.load(context);
  if (saved) {
    return {
      ...blankRegister(context),
      ...saved,
      projectName: context.projectName ?? saved.projectName,
      clientName: context.clientName ?? saved.clientName,
      siteAddress: context.siteAddress ?? saved.siteAddress,
      jobNumber: context.jobNumber ?? saved.jobNumber,
    };
  }
  return blankRegister(context);
}

export async function saveProjectAreaRegister(
  register: ProjectAreaRegister,
  repository: ProjectAreaRegisterRepository = projectAreaRegisterRepository,
): Promise<ProjectAreaRegisterSaveResult> {
  const validation = validateProjectAreaRegister(register);
  if (!validation.ok) return validation;
  const saved = await repository.save(register);
  return ok(saved);
}

export function listRegisterAreaTypes(register: ProjectAreaRegister): AreaType[] {
  return [...STANDARD_AREA_TYPES, ...register.customAreaTypes];
}

export function listRegisterAreaGroups(): AreaGroup[] {
  return STANDARD_AREA_GROUPS;
}

export function findAreaType(register: ProjectAreaRegister, areaTypeId: AreaTypeId): AreaType | null {
  return listRegisterAreaTypes(register).find((type) => type.id === areaTypeId) ?? null;
}

function selectionQuantity(register: ProjectAreaRegister, areaTypeId: AreaTypeId): number {
  return register.selections.find((selection) => selection.areaTypeId === areaTypeId)?.quantity ?? 0;
}

function withSelection(register: ProjectAreaRegister, areaTypeId: AreaTypeId, quantity: number): ProjectAreaRegister {
  const selections = register.selections.filter((selection) => selection.areaTypeId !== areaTypeId);
  if (quantity > 0) selections.push({ areaTypeId, quantity });
  return { ...register, selections };
}

function defaultLevelIdForAreaType(register: ProjectAreaRegister, areaType: AreaType): ProjectLevelId {
  const targetCode = areaType.traits.includes("external") ? "external" : "ground-floor";
  return register.levels.find((level) => level.code === targetCode)?.id ?? register.levels[0]?.id ?? makeProjectLevelId(register.projectId, targetCode);
}

function levelOrder(register: ProjectAreaRegister, levelId?: ProjectLevelId): number {
  return register.levels.find((level) => level.id === levelId)?.displayOrder ?? 0;
}

function generatedName(areaType: AreaType, ordinal: number, quantity: number): string {
  if (quantity > 1 || isRepeatableAreaType(areaType.id)) return `${areaType.name} ${ordinal}`;
  return areaType.name;
}

function generatedAreaId(register: ProjectAreaRegister, areaType: AreaType, ordinal: number): ProjectAreaId {
  return makeScopedId("project_area", [register.organisationId, register.projectId, areaType.code, ordinal]);
}

function sortAreas(register: ProjectAreaRegister, areas: ProjectArea[]): ProjectArea[] {
  const types = listRegisterAreaTypes(register);
  return [...areas].sort((a, b) => {
    const levelDelta = levelOrder(register, a.levelId) - levelOrder(register, b.levelId);
    if (levelDelta) return levelDelta;
    const groupDelta = (STANDARD_AREA_GROUPS.find((group) => group.id === a.groupId)?.displayOrder ?? 0) - (STANDARD_AREA_GROUPS.find((group) => group.id === b.groupId)?.displayOrder ?? 0);
    if (groupDelta) return groupDelta;
    const typeDelta = (types.find((type) => type.id === a.areaTypeId)?.displayOrder ?? 0) - (types.find((type) => type.id === b.areaTypeId)?.displayOrder ?? 0);
    if (typeDelta) return typeDelta;
    return (a.generatedOrdinal ?? a.displayOrder) - (b.generatedOrdinal ?? b.displayOrder);
  }).map((area, index) => ({ ...area, displayOrder: index }));
}

export function previewAreaQuantityChange(register: ProjectAreaRegister, areaTypeId: AreaTypeId, quantity: number): AreaRemovalPreview {
  const desiredQuantity = Math.max(0, Math.floor(quantity));
  const currentQuantity = selectionQuantity(register, areaTypeId);
  if (desiredQuantity >= currentQuantity) return { eligibleForRemoval: [], protectedFromRemoval: [] };
  const generated = register.areas.filter((area) => area.sourceAreaTypeId === areaTypeId && area.generatedOrdinal && area.generatedOrdinal > desiredQuantity);
  const areaType = findAreaType(register, areaTypeId);
  const eligibleForRemoval: ProjectArea[] = [];
  const protectedFromRemoval: ProjectArea[] = [];
  generated.forEach((area) => {
    const expected = areaType ? generatedName(areaType, area.generatedOrdinal ?? 1, currentQuantity) : area.name;
    if (area.hasDownstreamLinks || area.name !== expected) protectedFromRemoval.push(area);
    else eligibleForRemoval.push(area);
  });
  return { eligibleForRemoval, protectedFromRemoval };
}

export function setAreaQuantity(register: ProjectAreaRegister, areaTypeId: AreaTypeId, quantity: number, confirmRemoval = false): AreaQuantityResult {
  const areaType = findAreaType(register, areaTypeId);
  if (!areaType || !areaType.active) {
    return { ...fail<ProjectAreaRegister>("unknown_area_type", "Choose an active area type."), removalPreview: { eligibleForRemoval: [], protectedFromRemoval: [] } };
  }
  const desiredQuantity = Math.max(0, Math.floor(quantity));
  const currentQuantity = selectionQuantity(register, areaTypeId);
  const removalPreview = previewAreaQuantityChange(register, areaTypeId, desiredQuantity);
  if (desiredQuantity < currentQuantity && !confirmRemoval && removalPreview.eligibleForRemoval.length > 0) {
    return { ...fail<ProjectAreaRegister>("confirm_area_removal", "Confirm which generated areas should be removed before lowering the quantity."), removalPreview };
  }

  const next = withSelection(clone(register), areaTypeId, desiredQuantity);
  let areas = next.areas.filter((area) => !removalPreview.eligibleForRemoval.some((candidate) => candidate.id === area.id));
  const existingByOrdinal = new Map<number, ProjectArea>();
  areas.forEach((area) => {
    if (area.sourceAreaTypeId === areaTypeId && area.generatedOrdinal) existingByOrdinal.set(area.generatedOrdinal, area);
  });

  for (let ordinal = 1; ordinal <= desiredQuantity; ordinal += 1) {
    if (existingByOrdinal.has(ordinal)) continue;
    const levelId = defaultLevelIdForAreaType(next, areaType);
    areas.push({
      id: generatedAreaId(next, areaType, ordinal),
      organisationId: next.organisationId,
      projectId: next.projectId,
      areaTypeId,
      groupId: areaType.groupId,
      name: generatedName(areaType, ordinal, desiredQuantity),
      level: levelOrder(next, levelId),
      levelId,
      displayOrder: areas.length,
      status: "draft",
      source: desiredQuantity > 1 || isRepeatableAreaType(areaTypeId) ? "quantity_generated" : "standard_area",
      sourceAreaTypeId: areaTypeId,
      generatedOrdinal: ordinal,
    });
  }

  return ok({ ...next, areas: sortAreas(next, areas) }) as AreaQuantityResult;
}

export function renameProjectArea(register: ProjectAreaRegister, areaId: ProjectAreaId, name: string): DomainResult<ProjectAreaRegister> {
  const trimmed = name.trim();
  if (!trimmed) return fail("empty_area_name", "Area name is required.");
  const next = clone(register);
  next.areas = next.areas.map((area) => (area.id === areaId ? { ...area, name: trimmed } : area));
  return ok(next);
}

export function assignProjectAreaLevel(register: ProjectAreaRegister, areaId: ProjectAreaId, levelId: ProjectLevelId): DomainResult<ProjectAreaRegister> {
  const level = register.levels.find((candidate) => candidate.id === levelId && candidate.active);
  if (!level) return fail("unknown_level", "Choose an active project level.");
  const next = clone(register);
  next.areas = next.areas.map((area) => (area.id === areaId ? { ...area, level: level.displayOrder, levelId } : area));
  return ok({ ...next, areas: sortAreas(next, next.areas) });
}

export function duplicateProjectArea(register: ProjectAreaRegister, areaId: ProjectAreaId): DomainResult<ProjectAreaRegister> {
  const source = register.areas.find((area) => area.id === areaId);
  if (!source) return fail("unknown_area", "Choose an existing area to duplicate.");
  const copyNumber = register.areas.filter((area) => area.sourceAreaTypeId === source.areaTypeId).length + 1;
  const duplicated: ProjectArea = {
    ...source,
    id: makeScopedId("project_area", [register.organisationId, register.projectId, source.areaTypeId, "copy", copyNumber]),
    name: `${source.name} Copy`,
    displayOrder: register.areas.length,
    source: "duplicated_area",
    generatedOrdinal: undefined,
  };
  return ok({ ...clone(register), areas: sortAreas(register, [...register.areas, duplicated]) });
}

export function deleteProjectArea(register: ProjectAreaRegister, areaId: ProjectAreaId): DomainResult<ProjectAreaRegister> {
  const area = register.areas.find((candidate) => candidate.id === areaId);
  if (!area) return fail("unknown_area", "Choose an existing area to remove.");
  if (area.hasDownstreamLinks) return fail("area_has_links", "This area is linked to later selections and cannot be removed here.");
  return ok({ ...clone(register), areas: register.areas.filter((candidate) => candidate.id !== areaId) });
}

export function createCustomProjectLevel(register: ProjectAreaRegister, name: string): DomainResult<ProjectAreaRegister> {
  const trimmed = name.trim();
  if (!trimmed) return fail("empty_level_name", "Level name is required.");
  const next = clone(register);
  const id = makeScopedId("project_level", [register.projectId, "custom", trimmed, register.levels.length + 1]);
  next.levels.push({ id, organisationId: register.organisationId, projectId: register.projectId, name: trimmed, code: id, displayOrder: next.levels.length, standard: false, active: true });
  return ok(next);
}

export function renameProjectLevel(register: ProjectAreaRegister, levelId: ProjectLevelId, name: string): DomainResult<ProjectAreaRegister> {
  const trimmed = name.trim();
  if (!trimmed) return fail("empty_level_name", "Level name is required.");
  const next = clone(register);
  next.levels = next.levels.map((level) => (level.id === levelId ? { ...level, name: trimmed } : level));
  return ok(next);
}

export function setProjectLevelActive(register: ProjectAreaRegister, levelId: ProjectLevelId, active: boolean): DomainResult<ProjectAreaRegister> {
  if (!active && register.areas.some((area) => area.levelId === levelId)) return fail("level_in_use", "Move areas off this level before hiding it.");
  const next = clone(register);
  next.levels = next.levels.map((level) => (level.id === levelId ? { ...level, active } : level));
  return ok(next);
}

export function createCustomProjectArea(register: ProjectAreaRegister, input: { name: string; groupId: string; levelId: string }): DomainResult<ProjectAreaRegister> {
  const name = input.name.trim();
  if (!name) return fail("empty_area_name", "Area name is required.");
  const group = STANDARD_AREA_GROUPS.find((candidate) => candidate.id === input.groupId && candidate.active);
  if (!group) return fail("unknown_area_group", "Choose an active area group.");
  const level = register.levels.find((candidate) => candidate.id === input.levelId && candidate.active);
  if (!level) return fail("unknown_level", "Choose an active project level.");
  const customType: AreaType = {
    id: makeScopedId("area_type", [register.organisationId, register.projectId, "custom", name]),
    organisationId: register.organisationId,
    groupId: group.id,
    code: makeScopedId("custom", [name]).toUpperCase(),
    name,
    traits: group.kind === "external" ? ["external"] : ["internal"],
    displayOrder: 900 + register.customAreaTypes.length,
    active: true,
  };
  const area: ProjectArea = {
    id: makeScopedId("project_area", [register.organisationId, register.projectId, "custom", name, register.areas.length + 1]),
    organisationId: register.organisationId,
    projectId: register.projectId,
    areaTypeId: customType.id,
    groupId: group.id,
    name,
    level: level.displayOrder,
    levelId: level.id,
    displayOrder: register.areas.length,
    status: "draft",
    source: "custom_area",
    sourceAreaTypeId: customType.id,
  };
  const next = clone(register);
  next.customAreaTypes.push(customType);
  next.areas = sortAreas(next, [...next.areas, area]);
  return ok(next);
}

export function validateProjectAreaRegister(register: ProjectAreaRegister): DomainResult<ProjectAreaRegister> {
  const issues: DomainIssue[] = [];
  const groups = STANDARD_AREA_GROUPS.filter((group) => group.active);
  const areaTypes = listRegisterAreaTypes(register);
  const activeLevels = register.levels.filter((level) => level.active);
  if (!register.organisationId || !register.projectId) issues.push(issue("missing_project_context", "Open an existing project before creating selection areas."));
  if (register.areas.length === 0) issues.push(issue("empty_area_register", "Select at least one project area."));

  const namesByLevel = new Map<string, Set<string>>();
  register.areas.forEach((area) => {
    const areaType = areaTypes.find((type) => type.id === area.areaTypeId);
    const group = groups.find((candidate) => candidate.id === area.groupId);
    const level = activeLevels.find((candidate) => candidate.id === area.levelId);
    if (!area.name.trim()) issues.push(issue("empty_area_name", "Every area needs a name.", area.id));
    if (!areaType || !areaType.active) issues.push(issue("unknown_area_type", `${area.name || "Area"} needs an active area type.`, area.id));
    if (areaType?.organisationId && areaType.organisationId !== register.organisationId) issues.push(issue("area_type_wrong_org", `${area.name} uses a custom area type from another organisation.`, area.id));
    if (!group) issues.push(issue("unknown_area_group", `${area.name || "Area"} needs an active area group.`, area.id));
    if (areaType && group && areaType.groupId !== group.id) issues.push(issue("group_mismatch", `${area.name} must stay in the ${group.name} group.`, area.id));
    if (!level) issues.push(issue("unknown_level", `${area.name || "Area"} needs an active project level.`, area.id));
    const levelKey = area.levelId ?? "missing";
    const names = namesByLevel.get(levelKey) ?? new Set<string>();
    const normalised = area.name.trim().toLowerCase();
    if (names.has(normalised)) issues.push(issue("duplicate_area_name", `${area.name} is already used on this project level.`, area.id));
    names.add(normalised);
    namesByLevel.set(levelKey, names);
  });

  return issues.length > 0 ? { ok: false, issues } : ok(register);
}

export function canContinueToTemplates(register: ProjectAreaRegister): DomainResult<ProjectAreaRegister> {
  return validateProjectAreaRegister(register);
}
