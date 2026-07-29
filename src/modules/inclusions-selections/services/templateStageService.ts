import { STANDARD_AREA_GROUPS } from "../area-groups/standardAreaGroups";
import { STANDARD_AREA_TYPES } from "../area-types/standardAreaTypes";
import type { ProjectArea } from "../areas/projectAreaTypes";
import { loadProjectAreaRegister } from "../services/projectAreaRegisterService";
import { STANDARD_REQUIREMENT_CATEGORIES } from "../requirements/standardRequirementCategories";
import type { ProjectRequirement, RequirementDefinition } from "../requirements/requirementTypes";
import type { ProjectAreaRegister, ProjectSelectionContext } from "../repositories/projectAreaRegisterRepository";
import { projectAreaRegisterRepository } from "../repositories/projectAreaRegisterRepository";
import type { TemplateStageRepository } from "../repositories/templateStageRepository";
import { templateStageRepository } from "../repositories/templateStageRepository";
import { makeScopedId } from "../shared/ids";
import { STANDARD_AREA_TEMPLATES, findStandardAreaTemplateForAreaType } from "../templates/standardAreaTemplates";
import type { AreaTemplate } from "../templates/templateTypes";
import { generateRequirementsForArea } from "../templates/templateGenerationService";
import type { SavedBuilderTemplate } from "../templates/savedBuilderTemplateTypes";
import type { EffectiveTemplateAssignment, TemplateAssignment, TemplateStageConfiguration } from "../templates/templateAssignmentTypes";
import { STANDARD_INCLUSION_TIERS } from "../tiers/standardInclusionTiers";
import type { DomainIssue, DomainResult } from "../validation/errors";
import { issue, ok } from "../validation/errors";

export type RequirementReconciliationAction = "add" | "keep" | "update" | "obsolete" | "removable" | "protected" | "conflict";

export type RequirementPreviewItem = {
  requirement: ProjectRequirement;
  action: RequirementReconciliationAction;
  sourceTemplateName: string;
  existingStatus: string;
};

export type RequirementReconciliationResult = {
  added: ProjectRequirement[];
  unchanged: ProjectRequirement[];
  updated: ProjectRequirement[];
  obsolete: ProjectRequirement[];
  removable: ProjectRequirement[];
  protected: ProjectRequirement[];
  conflicts: ProjectRequirement[];
  preview: RequirementPreviewItem[];
};

export type TemplateStageState = {
  context: ProjectSelectionContext;
  areaRegister: ProjectAreaRegister;
  configuration: TemplateStageConfiguration;
  requirements: ProjectRequirement[];
  templates: AreaTemplate[];
  savedBuilderTemplates: SavedBuilderTemplate[];
};

function fail<T>(code: string, message: string, path?: string): DomainResult<T> {
  return { ok: false, issues: [issue(code, message, path)] };
}

function blankConfiguration(context: ProjectSelectionContext): TemplateStageConfiguration {
  return {
    id: makeScopedId("template_stage", [context.organisationId, context.projectId]),
    organisationId: context.organisationId,
    projectId: context.projectId,
    projectDefault: { scope: "project", tierId: "tier_premier", mode: "standard" },
    groupOverrides: [],
    areaTypeOverrides: [],
    areaOverrides: [],
    updatedAt: new Date().toISOString(),
  };
}

function customTemplate(area: ProjectArea, definitions: RequirementDefinition[] = []): AreaTemplate {
  return {
    id: makeScopedId("area_template", [area.organisationId, area.projectId, "custom", area.id]),
    organisationId: area.organisationId,
    areaTypeId: area.areaTypeId,
    name: `${area.name} Custom Template`,
    version: 1,
    active: true,
    requirementDefinitions: definitions,
  };
}

export function listAvailableTemplates(state: Pick<TemplateStageState, "templates">, areaTypeId?: string): AreaTemplate[] {
  return state.templates.filter((template) => template.active && (!areaTypeId || template.areaTypeId === areaTypeId));
}

export async function loadTemplateStage(
  context: ProjectSelectionContext,
  repository: TemplateStageRepository = templateStageRepository,
): Promise<TemplateStageState> {
  const areaRegister = await loadProjectAreaRegister(context, projectAreaRegisterRepository);
  const configuration = await repository.loadConfiguration(context) ?? blankConfiguration(context);
  const requirements = await repository.listRequirements(context);
  const savedBuilderTemplates = (await repository.listSavedBuilderTemplates({ organisationId: context.organisationId })).filter((template) => template.status === "active");
  return {
    context,
    areaRegister,
    configuration,
    requirements,
    templates: [...STANDARD_AREA_TEMPLATES],
    savedBuilderTemplates,
  };
}

function matchingOverride(overrides: TemplateAssignment[], predicate: (assignment: TemplateAssignment) => boolean): TemplateAssignment | null {
  return overrides.find(predicate) ?? null;
}

export function resolveEffectiveTemplateAssignment(state: TemplateStageState, area: ProjectArea): EffectiveTemplateAssignment {
  const configuration = state.configuration;
  const projectDefault = configuration.projectDefault;
  const group = matchingOverride(configuration.groupOverrides, (assignment) => assignment.groupId === area.groupId);
  const type = matchingOverride(configuration.areaTypeOverrides, (assignment) => assignment.areaTypeId === area.areaTypeId);
  const individual = matchingOverride(configuration.areaOverrides, (assignment) => assignment.areaId === area.id);
  const selected = individual ?? type ?? group ?? projectDefault;
  const templateId = selected.templateId ?? findStandardAreaTemplateForAreaType(area.areaTypeId)?.id;
  const tierId = selected.tierId ?? type?.tierId ?? group?.tierId ?? projectDefault.tierId;
  const mode = selected.mode ?? "standard";
  const source = individual ? "project_area" : type ? "area_type" : group ? "area_group" : projectDefault ? "project" : "missing";
  const sourceLabel = mode === "custom"
    ? "Custom Template"
    : source === "project_area"
      ? `Overridden for ${area.name}`
      : source === "area_type"
        ? `Inherited from ${STANDARD_AREA_TYPES.find((areaType) => areaType.id === area.areaTypeId)?.name ?? "Area Type"} Area Type`
        : source === "area_group"
          ? `Inherited from ${STANDARD_AREA_GROUPS.find((areaGroup) => areaGroup.id === area.groupId)?.name ?? "Area Group"}`
          : `Inherited from ${STANDARD_INCLUSION_TIERS.find((tier) => tier.id === tierId)?.name ?? "Project Default"}`;
  return { areaId: area.id, areaTypeId: area.areaTypeId, groupId: area.groupId, templateId, tierId, mode, source, sourceLabel };
}

function withAssignment(configuration: TemplateStageConfiguration, assignment: TemplateAssignment): TemplateStageConfiguration {
  const next = structuredClone(configuration);
  if (assignment.scope === "project") next.projectDefault = { ...next.projectDefault, ...assignment };
  if (assignment.scope === "area_group") next.groupOverrides = [...next.groupOverrides.filter((item) => item.groupId !== assignment.groupId), assignment];
  if (assignment.scope === "area_type") next.areaTypeOverrides = [...next.areaTypeOverrides.filter((item) => item.areaTypeId !== assignment.areaTypeId), assignment];
  if (assignment.scope === "project_area") next.areaOverrides = [...next.areaOverrides.filter((item) => item.areaId !== assignment.areaId), assignment];
  return next;
}

export function assignProjectTier(state: TemplateStageState, tierId: string): DomainResult<TemplateStageState> {
  if (!STANDARD_INCLUSION_TIERS.some((tier) => tier.id === tierId && tier.active)) return fail("unknown_tier", "Choose an active inclusion tier.");
  return ok({ ...state, configuration: withAssignment(state.configuration, { scope: "project", tierId, mode: tierId === "tier_custom" ? "custom" : "standard" }) });
}

export function assignAreaGroupTier(state: TemplateStageState, groupId: string, tierId: string): DomainResult<TemplateStageState> {
  return ok({ ...state, configuration: withAssignment(state.configuration, { scope: "area_group", groupId, tierId, mode: tierId === "tier_custom" ? "custom" : "standard" }) });
}

export function assignAreaTypeTier(state: TemplateStageState, areaTypeId: string, tierId: string): DomainResult<TemplateStageState> {
  return ok({ ...state, configuration: withAssignment(state.configuration, { scope: "area_type", areaTypeId, tierId, mode: tierId === "tier_custom" ? "custom" : "standard" }) });
}

export function assignProjectAreaTier(state: TemplateStageState, areaId: string, tierId: string): DomainResult<TemplateStageState> {
  const area = state.areaRegister.areas.find((candidate) => candidate.id === areaId);
  if (!area) return fail("unknown_area", "Choose an existing project area.");
  return ok({ ...state, configuration: withAssignment(state.configuration, { scope: "project_area", areaId, tierId, mode: tierId === "tier_custom" ? "custom" : "standard" }) });
}

export function assignAreaTemplate(state: TemplateStageState, scope: TemplateAssignment): DomainResult<TemplateStageState> {
  if (scope.templateId && !state.templates.some((template) => template.id === scope.templateId && template.active)) return fail("unknown_template", "Choose an active area template.");
  return ok({ ...state, configuration: withAssignment(state.configuration, { ...scope, mode: scope.mode ?? "standard" }) });
}

export function resetTemplateOverride(state: TemplateStageState, scope: TemplateAssignment["scope"], id?: string): DomainResult<TemplateStageState> {
  const next = structuredClone(state.configuration);
  if (scope === "project") next.projectDefault = blankConfiguration(state.context).projectDefault;
  if (scope === "area_group") next.groupOverrides = next.groupOverrides.filter((item) => item.groupId !== id);
  if (scope === "area_type") next.areaTypeOverrides = next.areaTypeOverrides.filter((item) => item.areaTypeId !== id);
  if (scope === "project_area") next.areaOverrides = next.areaOverrides.filter((item) => item.areaId !== id);
  return ok({ ...state, configuration: next });
}

function requirementProtected(requirement: ProjectRequirement): boolean {
  return Boolean(requirement.hasSelection || requirement.hasApprovalHistory || requirement.hasPricingData || requirement.downstreamReference || requirement.manualCustomisation);
}

function templateForArea(state: TemplateStageState, area: ProjectArea): AreaTemplate | null {
  const effective = resolveEffectiveTemplateAssignment(state, area);
  if (effective.mode === "custom") return state.templates.find((template) => template.id === effective.templateId) ?? customTemplate(area);
  return state.templates.find((template) => template.id === effective.templateId) ?? findStandardAreaTemplateForAreaType(area.areaTypeId);
}

function reconcileAreaRequirements(state: TemplateStageState, area: ProjectArea): RequirementReconciliationResult {
  const template = templateForArea(state, area);
  const existing = state.requirements.filter((requirement) => requirement.areaId === area.id);
  const empty: RequirementReconciliationResult = { added: [], unchanged: [], updated: [], obsolete: [], removable: [], protected: [], conflicts: [], preview: [] };
  if (!template) return empty;
  const generated = generateRequirementsForArea({ area, template, existingRequirements: existing });
  const existingByDefinition = new Map(existing.map((requirement) => [requirement.definitionId, requirement]));
  generated.requirements.forEach((requirement) => {
    const current = existingByDefinition.get(requirement.definitionId);
    if (!current) {
      empty.added.push(requirement);
      empty.preview.push({ requirement, action: "add", sourceTemplateName: template.name, existingStatus: "none" });
    } else if (current.title !== requirement.title || current.category !== requirement.category || current.applicability !== requirement.applicability) {
      empty.updated.push(requirement);
      empty.preview.push({ requirement, action: "update", sourceTemplateName: template.name, existingStatus: current.status });
    } else {
      empty.unchanged.push(requirement);
      empty.preview.push({ requirement, action: "keep", sourceTemplateName: template.name, existingStatus: current.status });
    }
  });
  generated.obsoleteRequirements.forEach((requirement) => {
    empty.obsolete.push(requirement);
    if (requirementProtected(requirement)) {
      empty.protected.push({ ...requirement, status: "blocked_obsolete" });
      empty.preview.push({ requirement, action: "protected", sourceTemplateName: template.name, existingStatus: requirement.status });
    } else if (requirement.manualCustomisation) {
      empty.unchanged.push(requirement);
      empty.preview.push({ requirement, action: "keep", sourceTemplateName: template.name, existingStatus: requirement.status });
    } else {
      empty.removable.push(requirement);
      empty.preview.push({ requirement, action: "removable", sourceTemplateName: template.name, existingStatus: requirement.status });
    }
  });
  return empty;
}

export function previewRequirementGeneration(state: TemplateStageState, scope: "project" | "area_group" | "area_type" | "project_area" = "project", id?: string): RequirementReconciliationResult {
  const areas = state.areaRegister.areas.filter((area) => {
    if (scope === "area_group") return area.groupId === id;
    if (scope === "area_type") return area.areaTypeId === id;
    if (scope === "project_area") return area.id === id;
    return true;
  });
  return areas.map((area) => reconcileAreaRequirements(state, area)).reduce((combined, result) => ({
    added: [...combined.added, ...result.added],
    unchanged: [...combined.unchanged, ...result.unchanged],
    updated: [...combined.updated, ...result.updated],
    obsolete: [...combined.obsolete, ...result.obsolete],
    removable: [...combined.removable, ...result.removable],
    protected: [...combined.protected, ...result.protected],
    conflicts: [...combined.conflicts, ...result.conflicts],
    preview: [...combined.preview, ...result.preview],
  }), { added: [], unchanged: [], updated: [], obsolete: [], removable: [], protected: [], conflicts: [], preview: [] } as RequirementReconciliationResult);
}

export function reconcileProjectRequirements(state: TemplateStageState, removeObsolete = false): DomainResult<TemplateStageState> {
  const preview = previewRequirementGeneration(state);
  if (preview.conflicts.length > 0) return fail("reconciliation_conflicts", "Resolve requirement conflicts before generating requirements.");
  const protectedIds = new Set(preview.protected.map((requirement) => requirement.id));
  const removableIds = new Set(removeObsolete ? preview.removable.map((requirement) => requirement.id) : []);
  const generated = [...preview.unchanged, ...preview.updated, ...preview.added, ...preview.protected];
  const manual = state.requirements.filter((requirement) => requirement.manualCustomisation && !generated.some((item) => item.id === requirement.id));
  const nextRequirements = [...generated, ...manual, ...state.requirements.filter((requirement) => protectedIds.has(requirement.id) && !generated.some((item) => item.id === requirement.id))]
    .filter((requirement) => !removableIds.has(requirement.id))
    .map((requirement, index) => ({ ...requirement, displayOrder: requirement.displayOrder ?? index }));
  return ok({ ...state, requirements: nextRequirements });
}

export function createCustomAreaTemplate(state: TemplateStageState, areaId: string, definitions: RequirementDefinition[], name?: string): DomainResult<TemplateStageState> {
  const area = state.areaRegister.areas.find((candidate) => candidate.id === areaId);
  if (!area) return fail("unknown_area", "Choose an existing project area.");
  const template = { ...customTemplate(area, definitions), name: name?.trim() || `${area.name} Custom Template` };
  const next = { ...state, templates: [...state.templates.filter((candidate) => candidate.id !== template.id), template] };
  return assignAreaTemplate(next, { scope: "project_area", areaId, templateId: template.id, mode: "custom" });
}

export function createCustomRequirementDefinition(title: string, category: string, order: number): RequirementDefinition {
  const known = STANDARD_REQUIREMENT_CATEGORIES.some((candidate) => candidate.id === category);
  return {
    id: makeScopedId("req_def", ["custom", title, order]),
    title: title.trim(),
    category: (known ? category : "allowance") as RequirementDefinition["category"],
    subtype: makeScopedId("subtype", [title]),
    quantityMode: "per_area",
    defaultQuantity: 1,
    required: true,
    applicability: "required",
  };
}

export function saveBuilderTemplate(state: TemplateStageState, name: string, description = "", repository: TemplateStageRepository = templateStageRepository): Promise<SavedBuilderTemplate> {
  const template: SavedBuilderTemplate = {
    id: makeScopedId("builder_template", [state.context.organisationId, name, Date.now()]),
    organisationId: state.context.organisationId,
    name: name.trim(),
    description,
    includedAreaTypeIds: [...new Set(state.areaRegister.areas.map((area) => area.areaTypeId))],
    defaultAreaTemplateIds: state.templates.map((template) => ({ areaTypeId: template.areaTypeId, templateId: template.id })),
    defaultTierId: state.configuration.projectDefault.tierId ?? "tier_premier",
    groupOverrides: state.configuration.groupOverrides.filter((override) => Boolean(override.groupId)) as SavedBuilderTemplate["groupOverrides"],
    areaTypeOverrides: state.configuration.areaTypeOverrides.filter((override) => Boolean(override.areaTypeId)) as SavedBuilderTemplate["areaTypeOverrides"],
    areaOverrideRules: [],
    status: "active",
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return repository.saveBuilderTemplate(template);
}

export function applyBuilderTemplate(state: TemplateStageState, savedTemplate: SavedBuilderTemplate): DomainResult<TemplateStageState> {
  if (savedTemplate.organisationId !== state.context.organisationId) return fail("saved_template_wrong_org", "This saved builder template belongs to another organisation.");
  if (savedTemplate.status !== "active") return fail("saved_template_archived", "Archived builder templates cannot be applied by default.");
  return ok({
    ...state,
    configuration: {
      ...state.configuration,
      projectDefault: { scope: "project", tierId: savedTemplate.defaultTierId, mode: "saved_builder_template" },
      groupOverrides: savedTemplate.groupOverrides,
      areaTypeOverrides: savedTemplate.areaTypeOverrides,
      savedBuilderTemplateId: savedTemplate.id,
    },
  });
}

export async function duplicateBuilderTemplate(template: SavedBuilderTemplate, repository: TemplateStageRepository = templateStageRepository): Promise<SavedBuilderTemplate> {
  return repository.saveBuilderTemplate({ ...structuredClone(template), id: makeScopedId("builder_template", [template.organisationId, template.name, "copy", Date.now()]), name: `${template.name} Copy`, version: template.version + 1, status: "active", updatedAt: new Date().toISOString() });
}

export async function renameBuilderTemplate(template: SavedBuilderTemplate, name: string, repository: TemplateStageRepository = templateStageRepository): Promise<SavedBuilderTemplate> {
  return repository.saveBuilderTemplate({ ...structuredClone(template), name: name.trim(), updatedAt: new Date().toISOString() });
}

export async function archiveBuilderTemplate(template: SavedBuilderTemplate, repository: TemplateStageRepository = templateStageRepository): Promise<SavedBuilderTemplate> {
  return repository.saveBuilderTemplate({ ...structuredClone(template), status: "archived", updatedAt: new Date().toISOString() });
}

export function requirementCategorySummary(requirements: ProjectRequirement[]): Array<{ category: string; count: number }> {
  const counts = new Map<string, number>();
  requirements.forEach((requirement) => counts.set(requirement.category, (counts.get(requirement.category) ?? 0) + 1));
  return [...counts.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => a.category.localeCompare(b.category));
}

export function validateTemplateStage(state: TemplateStageState): DomainResult<TemplateStageState> {
  const issues: DomainIssue[] = [];
  if (!state.context.organisationId || !state.context.projectId) issues.push(issue("missing_project_context", "Open an existing project before configuring templates."));
  if (state.areaRegister.areas.length === 0) issues.push(issue("no_project_areas", "Create project areas before assigning room templates."));
  const generatedAreaIds = new Set(state.requirements.map((requirement) => requirement.areaId));
  state.areaRegister.areas.forEach((area) => {
    const effective = resolveEffectiveTemplateAssignment(state, area);
    const template = templateForArea(state, area);
    if (!template && effective.mode !== "custom") issues.push(issue("missing_template", `${area.name} needs an active AreaTemplate.`, area.id));
    if (template && template.organisationId && template.organisationId !== state.context.organisationId) issues.push(issue("template_wrong_org", `${template.name} belongs to another organisation.`, area.id));
    if (template && !template.active) issues.push(issue("inactive_template", `${template.name} is archived or inactive.`, area.id));
    if (template && template.requirementDefinitions.length === 0) issues.push(issue(effective.mode === "custom" ? "custom_template_empty" : "empty_template", `${area.name} has an empty template.`, area.id));
    if (!generatedAreaIds.has(area.id)) issues.push(issue("requirements_not_generated", `${area.name} requirements have not been generated.`, area.id));
    const keys = new Set<string>();
    template?.requirementDefinitions.forEach((definition) => {
      const key = `${definition.category}:${definition.subtype}`;
      if (keys.has(key)) issues.push(issue("duplicate_template_requirement", `${template.name} contains duplicate ${definition.title} requirements.`, template.id));
      keys.add(key);
      if (!definition.category) issues.push(issue("missing_requirement_category", `${definition.title} needs a category.`, definition.id));
    });
  });
  const preview = previewRequirementGeneration(state);
  if (preview.conflicts.length > 0) issues.push(issue("unresolved_reconciliation_conflicts", "Resolve requirement reconciliation conflicts before continuing."));
  return issues.length ? { ok: false, issues } : ok(state);
}

export async function saveTemplateStage(state: TemplateStageState, repository: TemplateStageRepository = templateStageRepository): Promise<DomainResult<TemplateStageState>> {
  const savedConfiguration = await repository.saveConfiguration(state.configuration);
  const savedRequirements = await repository.saveRequirements(state.context, state.requirements);
  return ok({ ...state, configuration: savedConfiguration, requirements: savedRequirements });
}
