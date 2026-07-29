import type { AreaTypeId, OrganisationId, ProductReferenceId, ProductVariantId, SupplierId } from "../shared/ids";
import type { RequirementCategory } from "../requirements/requirementTypes";
import type { Money } from "../shared/money";

export type ProductCompatibility = {
  category: RequirementCategory;
  subtype?: string;
  areaTypeIds?: AreaTypeId[];
  traits?: string[];
  internalExternal?: "internal" | "external" | "both";
};

export type ProductReference = {
  id: ProductReferenceId;
  organisationId: OrganisationId;
  catalogueProductId?: string;
  name: string;
  brand?: string;
  supplierId?: SupplierId;
  defaultVariantId?: ProductVariantId;
  unit: string;
  active: boolean;
  compatibility: ProductCompatibility;
  unitCost?: Money;
};

export type ProductVariantReference = {
  id: ProductVariantId;
  productReferenceId: ProductReferenceId;
  name: string;
  sku?: string;
  unitCost?: Money;
  active: boolean;
};
