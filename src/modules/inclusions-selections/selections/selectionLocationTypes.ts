import type { ProjectScopedEntity, RequirementId, ProjectAreaId, SelectionId } from "../shared/ids";

export type SelectionLocation = ProjectScopedEntity & {
  selectionId: SelectionId;
  requirementId: RequirementId;
  areaId: ProjectAreaId;
  label: string;
  quantity: number;
  pricingQuantity: number;
  unit: string;
};
