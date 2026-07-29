import type { ProjectScopedEntity, RequirementId, ProductReferenceId, ProductVariantId, InclusionTierId } from "../shared/ids";
import type { Money } from "../shared/money";

export type SelectionSourceLevel = "builder_default" | "project_default" | "area_group" | "area" | "requirement_override";

export type SelectionValue = {
  productReferenceId?: ProductReferenceId;
  variantId?: ProductVariantId;
  allowance?: Money;
  note?: string;
  tierId?: InclusionTierId;
  customSelectionId?: string;
  customSelectionName?: string;
  customSelectionCategory?: string;
  description?: string;
  brand?: string;
  model?: string;
  colour?: string;
  supplierId?: string;
  supplierSku?: string;
  clientPrice?: Money;
  unit?: string;
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
  selectionStatus?: "not_started" | "in_progress" | "complete" | "needs_attention" | "not_applicable";
  quantity?: number;
  unit?: string;
  allowance?: Money;
  selectedPrice?: Money;
  variation?: Money;
  gst?: Money;
  notes?: SelectionNote[];
  attachmentRefs?: SelectionAttachmentReference[];
  notApplicableReason?: string;
  inheritedFrom?: string;
  protected?: boolean;
};

export type SelectionNote = {
  id: string;
  kind: "internal" | "client_visible" | "supplier" | "installation" | "override_reason" | "not_applicable_reason";
  text: string;
  createdAt: string;
};

export type SelectionAttachmentReference = {
  id: string;
  kind: "product_image" | "specification_pdf" | "colour_sample" | "supplier_quote" | "drawing" | "manual_selection_image";
  label: string;
  url?: string;
};

export type EffectiveSelection = {
  requirementId: RequirementId;
  value?: SelectionValue;
  inheritedFrom?: SelectionDefault;
  override?: ProjectSelection;
  sourceLevel?: SelectionSourceLevel | "direct";
};
