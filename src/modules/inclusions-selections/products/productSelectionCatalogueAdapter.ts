import type { ProjectRequirement } from "../requirements/requirementTypes";
import type { ProductReference, ProductVariantReference } from "./productReferenceTypes";

export type ProductSearchFilters = {
  search?: string;
  category?: string;
  subtype?: string;
  brand?: string;
  supplierId?: string;
  tierId?: string;
  internalExternal?: "internal" | "external" | "both";
};

export type SupplierReference = {
  id: string;
  organisationId: string;
  name: string;
};

export type ProductSelectionCatalogueAdapter = {
  searchCompatibleProducts(requirement: ProjectRequirement, filters?: ProductSearchFilters): Promise<ProductReference[]>;
  getProduct(productReferenceId: string): Promise<ProductReference | null>;
  listVariants(productReferenceId: string): Promise<ProductVariantReference[]>;
  getVariant(productReferenceId: string, variantId: string): Promise<ProductVariantReference | null>;
  getSupplier(supplierId: string): Promise<SupplierReference | null>;
};
