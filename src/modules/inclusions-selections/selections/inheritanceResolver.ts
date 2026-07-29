import type { ProjectRequirement } from "../requirements/requirementTypes";
import type { EffectiveSelection, ProjectSelection, SelectionDefault, SelectionSourceLevel } from "./selectionTypes";

const PRECEDENCE: Record<SelectionSourceLevel, number> = {
  builder_default: 10,
  project_default: 20,
  area_group: 30,
  area: 40,
  requirement_override: 50,
};

export function resolveEffectiveSelection(
  requirement: ProjectRequirement,
  defaults: SelectionDefault[],
  override?: ProjectSelection,
): EffectiveSelection {
  if (override) {
    return { requirementId: requirement.id, value: override.value, override, sourceLevel: "direct" };
  }

  const matchingDefaults = defaults
    .filter((selectionDefault) => selectionDefault.category === requirement.category && selectionDefault.subtype === requirement.subtype)
    .sort((a, b) => PRECEDENCE[b.sourceLevel] - PRECEDENCE[a.sourceLevel]);
  const inheritedFrom = matchingDefaults[0];

  return {
    requirementId: requirement.id,
    value: inheritedFrom?.value,
    inheritedFrom,
    sourceLevel: inheritedFrom?.sourceLevel,
  };
}

export function resetSelectionOverride(requirement: ProjectRequirement, defaults: SelectionDefault[]): EffectiveSelection {
  return resolveEffectiveSelection(requirement, defaults);
}
