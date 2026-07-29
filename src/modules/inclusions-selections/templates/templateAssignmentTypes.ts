import type { AreaGroupId, AreaTypeId, InclusionTierId, ProjectAreaId, ProjectScopedEntity, TemplateId } from "../shared/ids";

export type TemplateAssignmentScope = "project" | "area_group" | "area_type" | "project_area";
export type TemplateMode = "standard" | "custom" | "saved_builder_template";
export type TemplateStageStatus = "ready" | "inherited" | "missing_template" | "custom_template_empty" | "needs_reconciliation" | "protected_retained";

export type TemplateAssignment = {
  scope: TemplateAssignmentScope;
  groupId?: AreaGroupId;
  areaTypeId?: AreaTypeId;
  areaId?: ProjectAreaId;
  templateId?: TemplateId;
  tierId?: InclusionTierId;
  mode?: TemplateMode;
};

export type TemplateStageConfiguration = ProjectScopedEntity & {
  projectDefault: TemplateAssignment;
  groupOverrides: TemplateAssignment[];
  areaTypeOverrides: TemplateAssignment[];
  areaOverrides: TemplateAssignment[];
  savedBuilderTemplateId?: string;
  updatedAt: string;
};

export type EffectiveTemplateAssignment = {
  areaId: ProjectAreaId;
  areaTypeId: AreaTypeId;
  groupId: AreaGroupId;
  templateId?: TemplateId;
  tierId?: InclusionTierId;
  mode: TemplateMode;
  source: "project" | "area_group" | "area_type" | "project_area" | "missing";
  sourceLabel: string;
};
