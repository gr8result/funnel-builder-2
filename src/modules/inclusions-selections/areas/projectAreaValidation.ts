import type { AreaGroup } from "../area-groups/areaGroupTypes";
import type { AreaType } from "../area-types/areaTypeTypes";
import type { ProjectArea } from "./projectAreaTypes";
import { issue, ok, type DomainResult } from "../validation/errors";

export function validateProjectAreas(
  areas: ProjectArea[],
  areaTypes: AreaType[],
  areaGroups: AreaGroup[],
): DomainResult<ProjectArea[]> {
  const issues = [];
  const typeIds = new Set(areaTypes.map((type) => type.id));
  const groupIds = new Set(areaGroups.map((group) => group.id));
  const namesByParent = new Map<string, Set<string>>();
  const ids = new Set(areas.map((area) => area.id));

  for (const area of areas) {
    if (!typeIds.has(area.areaTypeId)) issues.push(issue("UNKNOWN_AREA_TYPE", `Area "${area.name}" uses an unknown area type.`, `areas.${area.id}.areaTypeId`));
    if (!groupIds.has(area.groupId)) issues.push(issue("UNKNOWN_AREA_GROUP", `Area "${area.name}" uses an unknown area group.`, `areas.${area.id}.groupId`));
    if (area.parentAreaId && !ids.has(area.parentAreaId)) issues.push(issue("UNKNOWN_PARENT_AREA", `Area "${area.name}" references a missing parent.`, `areas.${area.id}.parentAreaId`));

    const parentKey = area.parentAreaId ?? "root";
    const normalizedName = area.name.trim().toLowerCase();
    const siblingNames = namesByParent.get(parentKey) ?? new Set<string>();
    if (siblingNames.has(normalizedName)) {
      issues.push(issue("DUPLICATE_SIBLING_AREA_NAME", `Area name "${area.name}" is duplicated at the same hierarchy level.`, `areas.${area.id}.name`));
    }
    siblingNames.add(normalizedName);
    namesByParent.set(parentKey, siblingNames);
  }

  return ok(areas, issues);
}
