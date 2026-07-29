import type { ProjectArea } from "../areas/projectAreaTypes";
import type { ProjectRequirement } from "../requirements/requirementTypes";
import { makeScopedId } from "../shared/ids";
import type { AreaTemplate } from "./templateTypes";

export type RequirementGenerationInput = {
  area: ProjectArea;
  template: AreaTemplate;
  existingRequirements?: ProjectRequirement[];
};

export type RequirementGenerationResult = {
  requirements: ProjectRequirement[];
  obsoleteRequirements: ProjectRequirement[];
};

export function generateRequirementsForArea(input: RequirementGenerationInput): RequirementGenerationResult {
  const existing = input.existingRequirements ?? [];
  const definitionIds = new Set(input.template.requirementDefinitions.map((definition) => definition.id));
  const existingByDefinition = new Map(existing.map((requirement) => [requirement.definitionId, requirement]));
  const requirements = input.template.requirementDefinitions.map((definition) => {
    const current = existingByDefinition.get(definition.id);
    const status: ProjectRequirement["status"] = definition.required ? "required" : "optional";
    return {
      ...current,
      id: current?.id ?? makeScopedId("requirement", [input.area.projectId, input.area.id, definition.id]),
      organisationId: input.area.organisationId,
      projectId: input.area.projectId,
      definitionId: definition.id,
      areaId: input.area.id,
      templateId: input.template.id,
      category: definition.category,
      subtype: definition.subtype,
      title: definition.title,
      quantity: current?.quantity ?? definition.defaultQuantity,
      status,
      required: definition.required,
    } satisfies ProjectRequirement;
  });

  const obsoleteRequirements = existing
    .filter((requirement) => !definitionIds.has(requirement.definitionId))
    .map((requirement) => {
      const status: ProjectRequirement["status"] = requirement.status === "required" ? "blocked_obsolete" : "obsolete";
      return { ...requirement, status };
    });

  return { requirements, obsoleteRequirements };
}
