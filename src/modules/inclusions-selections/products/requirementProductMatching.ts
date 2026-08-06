import { STANDARD_AREA_TYPES } from "../area-types/standardAreaTypes";
import type { ProjectArea } from "../areas/projectAreaTypes";
import type { ProjectRequirement } from "../requirements/requirementTypes";
import type { ProductReference, ProductVariantReference } from "./productReferenceTypes";
import type { ProductSearchFilters } from "./productSelectionCatalogueAdapter";
import { normalizeProductTags } from "./productTagTaxonomy";
import { isProductVisibleInSelections, normalizeSelectionVisibility } from "./selectionVisibility";

export type RequirementProductCompatibility = {
  compatible: boolean;
  reasons: string[];
  tierMatch: boolean;
  priceStatus: "confirmed" | "price_missing" | "supplier_quote_required" | "unavailable_product";
  matchingVariants: ProductVariantReference[];
};

const SUBTYPE_TAGS: Record<string, string[]> = {
  oven: ["appliance", "oven"],
  cooktop: ["appliance", "cooktop"],
  rangehood: ["appliance", "rangehood"],
  dishwasher: ["appliance", "dishwasher"],
  basin_mixer: ["tapware", "basin-mixer"],
  shower_mixer: ["tapware", "shower-mixer"],
  sink_mixer: ["tapware", "sink-mixer", "kitchen-mixer"],
  laundry_mixer: ["tapware", "laundry-mixer"],
  bath_outlet: ["tapware", "bath-outlet"],
  shower_outlet: ["tapware", "shower-outlet"],
  basin: ["basin"],
  toilet: ["toilet"],
  bath: ["bath"],
  shower_screen: ["shower-screen"],
  vanity: ["vanity"],
  floor_tiles: ["floor-tile"],
  wall_tiles: ["wall-tile"],
  splashback: ["splashback"],
  floor_covering: ["carpet", "hybrid-flooring"],
  cabinetry: ["cabinetry"],
  benchtops: ["benchtop"],
  internal_doors: ["internal-door"],
  door_hardware: ["passage-hardware"],
  external_doors: ["entrance-hardware"],
  garage_door: ["garage-door"],
  roof_material: ["roofing"],
  brick_or_cladding: ["brick", "cladding"],
  external_wall_finish: ["cladding", "external-paint"],
  wall_paint: ["internal-paint"],
  ceiling_paint: ["internal-paint"],
  robe_fitout: ["robe-fitout"],
  walk_in_robe_fitout: ["robe-fitout", "drawers", "shelving"],
};

function titleTags(requirement: ProjectRequirement): string[] {
  const title = requirement.title.toLowerCase();
  const tags: string[] = [];
  if (title.includes("oven")) tags.push("appliance", "oven");
  if (title.includes("cooktop")) tags.push("appliance", "cooktop");
  if (title.includes("rangehood")) tags.push("appliance", "rangehood");
  if (title.includes("dishwasher")) tags.push("appliance", "dishwasher");
  if (title.includes("basin mixer")) tags.push("tapware", "basin-mixer");
  if (title.includes("shower mixer")) tags.push("tapware", "shower-mixer");
  if (title.includes("sink mixer")) tags.push("tapware", "sink-mixer");
  if (title.includes("laundry mixer")) tags.push("tapware", "laundry-mixer");
  if (title.includes("garage door")) tags.push("garage-door");
  if (title.includes("internal door") || title.includes("door leaf") || title.includes("door as per plan")) tags.push("internal-door");
  if (title.includes("door hardware")) tags.push("passage-hardware");
  return tags;
}

export function requirementProductTags(requirement: ProjectRequirement): string[] {
  return normalizeProductTags([
    ...(SUBTYPE_TAGS[requirement.subtype] ?? []),
    ...titleTags(requirement),
    requirement.subtype.replace(/_/g, "-"),
  ]);
}

function productTags(product: ProductReference): string[] {
  return normalizeProductTags([
    ...(product.compatibility.requirementTags ?? []),
    product.compatibility.subtype?.replace(/_/g, "-"),
    product.categoryName,
    product.subcategoryName,
    product.productType,
  ]);
}

export function productMatchesFilters(product: ProductReference, filters: ProductSearchFilters = {}): boolean {
  const text = [product.name, product.brand, product.range, product.model, product.colour, product.finish, product.supplierName, product.supplierSku, product.productCode, product.description, product.compatibility.width, product.compatibility.fuelType].filter(Boolean).join(" ").toLowerCase();
  const search = filters.search?.trim().toLowerCase();
  if (search && !text.includes(search)) return false;
  if (filters.brand && product.brand !== filters.brand) return false;
  if (filters.supplierId && product.supplierId !== filters.supplierId) return false;
  if (filters.tierId && product.tierId !== filters.tierId) return false;
  if (filters.width && product.compatibility.width !== filters.width) return false;
  if (filters.size && product.compatibility.size !== filters.size) return false;
  if (filters.colour && product.colour !== filters.colour) return false;
  if (filters.finish && product.finish !== filters.finish) return false;
  if (filters.fuelType && product.compatibility.fuelType !== filters.fuelType) return false;
  if (filters.installationType && product.compatibility.installationType !== filters.installationType) return false;
  if (filters.availabilityStatus && (product.availabilityStatus ?? "available") !== filters.availabilityStatus) return false;
  if (filters.selectionVisibility && normalizeSelectionVisibility(product) !== filters.selectionVisibility) return false;
  if (!filters.includeInactive && !isProductVisibleInSelections(product)) return false;
  if (!filters.includeInactive && !product.active) return false;
  return true;
}

export function evaluateProductCompatibility(requirement: ProjectRequirement, product: ProductReference, variants: ProductVariantReference[] = [], area?: ProjectArea, tierId?: string): RequirementProductCompatibility {
  const reasons: string[] = [];
  if (!isProductVisibleInSelections(product)) reasons.push("Product is not visible in the selections catalogue.");
  if (!product.active) reasons.push("Product is inactive.");
  if (product.discontinued || product.availabilityStatus === "discontinued") reasons.push("Product is discontinued.");
  if (product.compatibility.category !== requirement.category) reasons.push("Product category does not match this selection item.");
  if (product.compatibility.subtype && product.compatibility.subtype !== requirement.subtype) reasons.push("Product subtype does not match this selection item.");

  const requiredTags = requirementProductTags(requirement);
  const tags = productTags(product);
  const explicitTags = normalizeProductTags([
    ...(product.compatibility.requirementTags ?? []),
    product.compatibility.subtype?.replace(/_/g, "-"),
    product.subcategoryName,
    product.productType,
  ]);
  const missingTags = requiredTags.filter((tag) => !tags.includes(tag));
  if (explicitTags.length && missingTags.length) reasons.push(`Missing required tags: ${missingTags.join(", ")}.`);

  const compatibleAreaTypeIds = product.compatibility.compatibleAreaTypeIds ?? product.compatibility.areaTypeIds;
  if (compatibleAreaTypeIds?.length && area && !compatibleAreaTypeIds.includes(area.areaTypeId)) {
    reasons.push(`Not tagged for ${area.name}.`);
  }
  const areaType = area ? STANDARD_AREA_TYPES.find((item) => item.id === area.areaTypeId) : null;
  if (areaType && product.compatibility.internalExternal === "internal" && !areaType.traits.includes("internal")) reasons.push("Internal product cannot be used externally.");
  if (areaType && product.compatibility.internalExternal === "external" && !areaType.traits.includes("external")) reasons.push("External product cannot be used internally.");
  if (requiredTags.includes("wet-area") && product.compatibility.wetAreaSuitable === false) reasons.push("Product is not wet-area suitable.");

  const tierMatch = !tierId || !product.tierId || product.tierId === tierId || product.tierId === "tier_optional_upgrade";
  const priceStatus = !product.active || product.discontinued
    ? "unavailable_product"
    : product.availabilityStatus === "supplier_quote_required"
      ? "supplier_quote_required"
      : product.unitCost
        ? "confirmed"
        : "price_missing";

  return { compatible: reasons.length === 0, reasons, tierMatch, priceStatus, matchingVariants: variants.filter((variant) => variant.active) };
}
