import type { AreaTypeId, InclusionTierId, ProjectAreaId, ProjectScopedEntity, RequirementDefinitionId, RequirementId, TemplateId } from "../shared/ids";

export type RequirementCategory =
  | "flooring"
  | "wall_finish"
  | "fixture"
  | "fitting"
  | "appliance"
  | "hardware"
  | "electrical"
  | "plumbing"
  | "external_finish"
  | "allowance";

export type RequirementStatus = "draft" | "required" | "optional" | "obsolete" | "blocked_obsolete";
export type RequirementApplicability = "required" | "optional" | "conditional" | "not_applicable";

export type RequirementDefinition = {
  id: RequirementDefinitionId;
  category: RequirementCategory;
  subtype: string;
  title: string;
  description?: string;
  quantityMode: "per_area" | "per_item" | "allowance" | "manual";
  defaultQuantity: number;
  required: boolean;
  applicability?: RequirementApplicability;
  allowedAreaTypeIds?: AreaTypeId[];
  allowedTierIds?: InclusionTierId[];
};

export type ProjectRequirement = ProjectScopedEntity & {
  definitionId: RequirementDefinitionId;
  areaId: ProjectAreaId;
  templateId?: TemplateId;
  category: RequirementCategory;
  subtype: string;
  title: string;
  quantity: number;
  status: RequirementStatus;
  required: boolean;
  applicability?: RequirementApplicability;
  hasSelection?: boolean;
  hasApprovalHistory?: boolean;
  hasPricingData?: boolean;
  downstreamReference?: string;
  manualCustomisation?: boolean;
  displayOrder?: number;
};
