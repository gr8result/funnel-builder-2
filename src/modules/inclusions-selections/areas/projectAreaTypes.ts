import type { AreaGroupId, AreaTypeId, ProjectAreaId, ProjectLevelId, ProjectScopedEntity } from "../shared/ids";

export type ProjectAreaStatus = "draft" | "active" | "archived";
export type ProjectAreaSource = "standard_area" | "quantity_generated" | "duplicated_area" | "custom_area";

export type ProjectArea = ProjectScopedEntity & {
  areaTypeId: AreaTypeId;
  groupId: AreaGroupId;
  name: string;
  parentAreaId?: ProjectAreaId;
  level: number;
  levelId?: ProjectLevelId;
  displayOrder: number;
  status: ProjectAreaStatus;
  notes?: string;
  source?: ProjectAreaSource;
  sourceAreaTypeId?: AreaTypeId;
  generatedOrdinal?: number;
  hasDownstreamLinks?: boolean;
};

export type ProjectAreaTreeNode = ProjectArea & {
  children: ProjectAreaTreeNode[];
};
