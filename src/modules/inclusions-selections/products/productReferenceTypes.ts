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
  model?: string;
  colour?: string;
  description?: string;
  imageUrl?: string;
  productCode?: string;
  supplierId?: SupplierId;
  defaultVariantId?: ProductVariantId;
  unit: string;
  active: boolean;
  discontinued?: boolean;
  priceEffectiveDate?: string;
  priceExpiresAt?: string;
  priceSource?: string;
  builderCost?: Money;
  compatibility: ProductCompatibility;
  unitCost?: Money;
};

export type ProductVariantReference = {
  id: ProductVariantId;
  productReferenceId: ProductReferenceId;
  name: string;
  sku?: string;
  description?: string;
  colour?: string;
  finish?: string;
  unitCost?: Money;
  builderCost?: Money;
  priceEffectiveDate?: string;
  priceExpiresAt?: string;
  active: boolean;
};
