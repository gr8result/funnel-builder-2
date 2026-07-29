import type { ProjectLevel } from "./projectLevelTypes";
import type { OrganisationId, ProjectId, ProjectLevelId } from "../shared/ids";
import { makeScopedId } from "../shared/ids";

export const STANDARD_PROJECT_LEVEL_DEFINITIONS = [
  { code: "ground-floor", name: "Ground Floor" },
  { code: "upper-floor", name: "Upper Floor" },
  { code: "lower-floor", name: "Lower Floor" },
  { code: "basement", name: "Basement" },
  { code: "external", name: "External" },
] as const;

export function makeProjectLevelId(projectId: ProjectId, code: string): ProjectLevelId {
  return makeScopedId("project_level", [projectId, code]);
}

export function createStandardProjectLevels(organisationId: OrganisationId, projectId: ProjectId): ProjectLevel[] {
  return STANDARD_PROJECT_LEVEL_DEFINITIONS.map((level, index) => ({
    id: makeProjectLevelId(projectId, level.code),
    organisationId,
    projectId,
    name: level.name,
    code: level.code,
    displayOrder: index,
    standard: true,
    active: true,
  }));
}
