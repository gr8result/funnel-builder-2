import type { ProjectRequirement } from "../requirements/requirementTypes";
import { money } from "../shared/money";
import type { ProductReference, ProductVariantReference } from "./productReferenceTypes";
import type { ProductSearchFilters, ProductSelectionCatalogueAdapter, SupplierReference } from "./productSelectionCatalogueAdapter";

const suppliers: SupplierReference[] = [
  { id: "supplier_dev_finishes", organisationId: "org_dev", name: "Development Finishes Supplier" },
  { id: "supplier_dev_fixtures", organisationId: "org_dev", name: "Development Fixtures Supplier" },
];

const products: ProductReference[] = [
  { id: "product_dev_floor_covering", organisationId: "org_dev", name: "Development Floor Covering", brand: "DevSpec", supplierId: "supplier_dev_finishes", defaultVariantId: "variant_dev_floor_oak", unit: "m2", active: true, compatibility: { category: "flooring", internalExternal: "internal" }, builderCost: money(320), unitCost: money(450), priceSource: "catalogue", priceEffectiveDate: "2026-01-01", priceExpiresAt: "2027-01-01" },
  { id: "product_dev_internal_door_hardware", organisationId: "org_dev", name: "Development Internal Door Hardware", brand: "DevLock", supplierId: "supplier_dev_fixtures", defaultVariantId: "variant_dev_handle_brushed", unit: "set", active: true, compatibility: { category: "hardware", subtype: "door_hardware", internalExternal: "internal" }, builderCost: money(78), unitCost: money(120), priceSource: "catalogue", priceEffectiveDate: "2026-01-01", priceExpiresAt: "2027-01-01" },
  { id: "product_dev_basin_mixer", organisationId: "org_dev", name: "Development Basin Mixer", brand: "DevTap", supplierId: "supplier_dev_fixtures", defaultVariantId: "variant_dev_basin_chrome", unit: "each", active: true, compatibility: { category: "plumbing", subtype: "basin_mixer", internalExternal: "internal" }, builderCost: money(390), unitCost: money(590), priceSource: "catalogue", priceEffectiveDate: "2026-01-01", priceExpiresAt: "2027-01-01" },
  { id: "product_dev_kitchen_mixer", organisationId: "org_dev", name: "Development Kitchen Sink Mixer", brand: "DevTap", supplierId: "supplier_dev_fixtures", defaultVariantId: "variant_dev_kitchen_chrome", unit: "each", active: true, compatibility: { category: "plumbing", subtype: "sink_mixer", internalExternal: "internal" }, builderCost: money(430), unitCost: money(640), priceSource: "catalogue", priceEffectiveDate: "2026-01-01", priceExpiresAt: "2027-01-01" },
  { id: "product_dev_laundry_mixer", organisationId: "org_dev", name: "Development Laundry Mixer", brand: "DevTap", supplierId: "supplier_dev_fixtures", defaultVariantId: "variant_dev_laundry_chrome", unit: "each", active: true, compatibility: { category: "plumbing", subtype: "laundry_mixer", internalExternal: "internal" }, builderCost: money(250), unitCost: money(360), priceSource: "catalogue", priceEffectiveDate: "2026-01-01", priceExpiresAt: "2027-01-01" },
  { id: "product_dev_inactive_tile", organisationId: "org_dev", name: "Inactive Development Tile", brand: "DevTile", supplierId: "supplier_dev_finishes", unit: "m2", active: false, compatibility: { category: "flooring", subtype: "floor_tiles", internalExternal: "both" }, unitCost: money(70) },
];

const variants: ProductVariantReference[] = [
  { id: "variant_dev_floor_oak", productReferenceId: "product_dev_floor_covering", name: "Natural Oak", sku: "DEV-FLOOR-OAK", active: true, unitCost: money(450) },
  { id: "variant_dev_floor_walnut", productReferenceId: "product_dev_floor_covering", name: "Walnut", sku: "DEV-FLOOR-WALNUT", active: true, unitCost: money(520) },
  { id: "variant_dev_handle_brushed", productReferenceId: "product_dev_internal_door_hardware", name: "Brushed Nickel", sku: "DEV-HANDLE-BN", active: true, unitCost: money(120) },
  { id: "variant_dev_basin_chrome", productReferenceId: "product_dev_basin_mixer", name: "Chrome", sku: "DEV-BASIN-CH", active: true, unitCost: money(590) },
  { id: "variant_dev_basin_matte_black", productReferenceId: "product_dev_basin_mixer", name: "Matte Black", sku: "DEV-BASIN-MB", active: true, unitCost: money(690) },
  { id: "variant_dev_kitchen_chrome", productReferenceId: "product_dev_kitchen_mixer", name: "Chrome Pull-Out", sku: "DEV-KITCHEN-CH", active: true, unitCost: money(640) },
  { id: "variant_dev_laundry_chrome", productReferenceId: "product_dev_laundry_mixer", name: "Chrome", sku: "DEV-LAUNDRY-CH", active: true, unitCost: money(360) },
];

function normalise(value = ""): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function compatible(requirement: ProjectRequirement, product: ProductReference): boolean {
  if (!product.active) return false;
  if (product.compatibility.category !== requirement.category) return false;
  if (product.compatibility.subtype && product.compatibility.subtype !== requirement.subtype) return false;
  return true;
}

export class InMemoryProductSelectionCatalogueAdapter implements ProductSelectionCatalogueAdapter {
  constructor(private organisationId = "org_dev") {}

  async searchCompatibleProducts(requirement: ProjectRequirement, filters: ProductSearchFilters = {}): Promise<ProductReference[]> {
    const search = normalise(filters.search);
    return products
      .filter((product) => product.organisationId === this.organisationId || product.organisationId === "org_dev")
      .filter((product) => compatible(requirement, product))
      .filter((product) => !filters.brand || product.brand === filters.brand)
      .filter((product) => !filters.supplierId || product.supplierId === filters.supplierId)
      .filter((product) => !search || normalise([product.name, product.brand, product.id].join(" ")).includes(search));
  }

  async getProduct(productReferenceId: string): Promise<ProductReference | null> {
    return products.find((product) => product.id === productReferenceId) ?? null;
  }

  async listVariants(productReferenceId: string): Promise<ProductVariantReference[]> {
    return variants.filter((variant) => variant.productReferenceId === productReferenceId);
  }

  async getVariant(productReferenceId: string, variantId: string): Promise<ProductVariantReference | null> {
    return variants.find((variant) => variant.productReferenceId === productReferenceId && variant.id === variantId) ?? null;
  }

  async getSupplier(supplierId: string): Promise<SupplierReference | null> {
    return suppliers.find((supplier) => supplier.id === supplierId) ?? null;
  }
}
