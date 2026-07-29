import type { ProjectScopedEntity, RequirementId, ProductReferenceId, ProductVariantId, InclusionTierId } from "../shared/ids";
import type { Money } from "../shared/money";

export type SelectionSourceLevel = "builder_default" | "project_default" | "area_group" | "area" | "requirement_override";

export type SelectionValue = {
  productReferenceId?: ProductReferenceId;
  variantId?: ProductVariantId;
  allowance?: Money;
  note?: string;
  tierId?: InclusionTierId;
};

export type SelectionDefault = {
  id: string;
  organisationId: string;
  projectId?: string;
  sourceLevel: SelectionSourceLevel;
  sourceId: string;
  category: string;
  subtype: string;
  value: SelectionValue;
  createdAt: string;
};

export type ProjectSelection = ProjectScopedEntity & {
  requirementId: RequirementId;
  value: SelectionValue;
  source: "client" | "builder" | "system";
  status: "draft" | "submitted" | "approved" | "rejected" | "locked";
  revision: number;
};

export type EffectiveSelection = {
  requirementId: RequirementId;
  value?: SelectionValue;
  inheritedFrom?: SelectionDefault;
  override?: ProjectSelection;
  sourceLevel?: SelectionSourceLevel | "direct";
};
