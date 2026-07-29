import type { ProjectLevelId, ProjectScopedEntity } from "../shared/ids";

export type ProjectLevel = ProjectScopedEntity & {
  id: ProjectLevelId;
  name: string;
  code: string;
  displayOrder: number;
  standard: boolean;
  active: boolean;
};
