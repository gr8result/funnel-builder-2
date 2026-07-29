import type { AreaGroupId, AreaTypeId, ProjectAreaId, ProjectScopedEntity } from "../shared/ids";

export type ProjectAreaStatus = "draft" | "active" | "archived";

export type ProjectArea = ProjectScopedEntity & {
  areaTypeId: AreaTypeId;
  groupId: AreaGroupId;
  name: string;
  parentAreaId?: ProjectAreaId;
  level: number;
  displayOrder: number;
  status: ProjectAreaStatus;
  notes?: string;
};

export type ProjectAreaTreeNode = ProjectArea & {
  children: ProjectAreaTreeNode[];
};
