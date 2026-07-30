import type { ProjectRequirement } from "../requirements/requirementTypes";
import { money } from "../shared/money";
import type { ProductReference, ProductVariantReference } from "./productReferenceTypes";
import type { ProductSearchFilters, ProductSelectionCatalogueAdapter, SupplierReference } from "./productSelectionCatalogueAdapter";
import { evaluateProductCompatibility, productMatchesFilters } from "./requirementProductMatching";

const suppliers: SupplierReference[] = [
  { id: "supplier_dev_finishes", organisationId: "org_dev", name: "Development Finishes Supplier" },
  { id: "supplier_dev_fixtures", organisationId: "org_dev", name: "Development Fixtures Supplier" },
  { id: "supplier_demo_reece", organisationId: "org_dev", name: "Demo Reece-style Fixtures" },
  { id: "supplier_demo_tile", organisationId: "org_dev", name: "Demo Tile and Stone Supplier" },
  { id: "supplier_demo_appliance", organisationId: "org_dev", name: "Demo Appliance Supplier" },
  { id: "supplier_demo_finishes", organisationId: "org_dev", name: "Demo Residential Finishes Supplier" },
];

const products: ProductReference[] = [
  { id: "product_dev_floor_covering", organisationId: "org_dev", name: "Development Floor Covering", brand: "DevSpec", supplierId: "supplier_dev_finishes", defaultVariantId: "variant_dev_floor_oak", unit: "m2", active: true, compatibility: { category: "flooring", internalExternal: "internal" }, builderCost: money(320), unitCost: money(450), priceSource: "catalogue", priceEffectiveDate: "2026-01-01", priceExpiresAt: "2027-01-01" },
  { id: "product_dev_internal_door_hardware", organisationId: "org_dev", name: "Development Internal Door Hardware", brand: "DevLock", supplierId: "supplier_dev_fixtures", defaultVariantId: "variant_dev_handle_brushed", unit: "set", active: true, compatibility: { category: "hardware", subtype: "door_hardware", internalExternal: "internal" }, builderCost: money(78), unitCost: money(120), priceSource: "catalogue", priceEffectiveDate: "2026-01-01", priceExpiresAt: "2027-01-01" },
  { id: "product_dev_basin_mixer", organisationId: "org_dev", name: "Development Basin Mixer", brand: "DevTap", supplierId: "supplier_dev_fixtures", defaultVariantId: "variant_dev_basin_chrome", unit: "each", active: true, compatibility: { category: "plumbing", subtype: "basin_mixer", internalExternal: "internal" }, builderCost: money(390), unitCost: money(590), priceSource: "catalogue", priceEffectiveDate: "2026-01-01", priceExpiresAt: "2027-01-01" },
  { id: "product_dev_kitchen_mixer", organisationId: "org_dev", name: "Development Kitchen Sink Mixer", brand: "DevTap", supplierId: "supplier_dev_fixtures", defaultVariantId: "variant_dev_kitchen_chrome", unit: "each", active: true, compatibility: { category: "plumbing", subtype: "sink_mixer", internalExternal: "internal" }, builderCost: money(430), unitCost: money(640), priceSource: "catalogue", priceEffectiveDate: "2026-01-01", priceExpiresAt: "2027-01-01" },
  { id: "product_dev_laundry_mixer", organisationId: "org_dev", name: "Development Laundry Mixer", brand: "DevTap", supplierId: "supplier_dev_fixtures", defaultVariantId: "variant_dev_laundry_chrome", unit: "each", active: true, compatibility: { category: "plumbing", subtype: "laundry_mixer", internalExternal: "internal" }, builderCost: money(250), unitCost: money(360), priceSource: "catalogue", priceEffectiveDate: "2026-01-01", priceExpiresAt: "2027-01-01" },
  { id: "product_dev_inactive_tile", organisationId: "org_dev", name: "Inactive Development Tile", brand: "DevTile", supplierId: "supplier_dev_finishes", unit: "m2", active: false, compatibility: { category: "flooring", subtype: "floor_tiles", internalExternal: "both" }, unitCost: money(70) },
  { id: "demo_phoenix_vivid_basin_mixer", organisationId: "org_dev", name: "Phoenix Vivid Slimline Basin Mixer", brand: "Phoenix", supplierId: "supplier_demo_reece", defaultVariantId: "demo_phoenix_basin_chrome", requiresVariant: true, unit: "each", active: true, compatibility: { category: "plumbing", subtype: "basin_mixer" }, builderCost: money(310), unitCost: money(450), priceSource: "Demonstration product and indicative price", imageUrl: "demo://tapware/basin-mixer" },
  { id: "demo_phoenix_vivid_shower_mixer", organisationId: "org_dev", name: "Phoenix Vivid Slimline Shower Mixer", brand: "Phoenix", supplierId: "supplier_demo_reece", defaultVariantId: "demo_phoenix_shower_chrome", unit: "each", active: true, compatibility: { category: "plumbing", subtype: "shower_mixer" }, builderCost: money(240), unitCost: money(390), priceSource: "Demonstration product and indicative price", imageUrl: "demo://tapware/shower-mixer" },
  { id: "demo_phoenix_vivid_sink_mixer", organisationId: "org_dev", name: "Phoenix Vivid Slimline Sink Mixer", brand: "Phoenix", supplierId: "supplier_demo_reece", defaultVariantId: "demo_phoenix_sink_chrome", unit: "each", active: true, compatibility: { category: "plumbing", subtype: "sink_mixer" }, builderCost: money(420), unitCost: money(590), priceSource: "Demonstration product and indicative price", imageUrl: "demo://tapware/sink-mixer" },
  { id: "demo_caesarstone_benchtop", organisationId: "org_dev", name: "Caesarstone 20 mm benchtop", brand: "Caesarstone", supplierId: "supplier_demo_tile", defaultVariantId: "demo_caesarstone_snowdrift", unit: "m2", active: true, compatibility: { category: "fixture", subtype: "benchtops" }, builderCost: money(690), unitCost: money(920), priceSource: "Demonstration product and indicative price", imageUrl: "demo://kitchen/stone" },
  { id: "demo_polytec_cabinetry", organisationId: "org_dev", name: "Polytec cabinetry", brand: "Polytec", supplierId: "supplier_demo_finishes", defaultVariantId: "demo_polytec_white_matt", unit: "m2", active: true, compatibility: { category: "fixture", subtype: "cabinetry" }, builderCost: money(520), unitCost: money(680), priceSource: "Demonstration product and indicative price", imageUrl: "demo://kitchen/cabinetry" },
  { id: "demo_smeg_900_oven", organisationId: "org_dev", name: "Smeg 900 mm oven", brand: "Smeg", supplierId: "supplier_demo_appliance", unit: "each", active: true, compatibility: { category: "appliance", subtype: "oven" }, builderCost: money(1420), unitCost: money(1890), priceSource: "Demonstration product and indicative price", imageUrl: "demo://appliance/oven" },
  { id: "demo_westinghouse_900_oven", organisationId: "org_dev", name: "Westinghouse 900 mm oven", brand: "Westinghouse", supplierId: "supplier_demo_appliance", unit: "each", active: true, compatibility: { category: "appliance", subtype: "oven" }, builderCost: money(890), unitCost: money(1250), priceSource: "Demonstration product and indicative price", imageUrl: "demo://appliance/oven" },
  { id: "demo_westinghouse_600_oven", organisationId: "org_dev", name: "Westinghouse 600 mm built-in oven", brand: "Westinghouse", supplierId: "supplier_demo_appliance", unit: "each", active: true, compatibility: { category: "appliance", subtype: "oven" }, builderCost: money(690), unitCost: money(980), priceSource: "Demonstration product and indicative price", imageUrl: "demo://appliance/oven-600" },
  { id: "demo_smeg_gas_cooktop", organisationId: "org_dev", name: "Smeg gas cooktop", brand: "Smeg", supplierId: "supplier_demo_appliance", unit: "each", active: true, compatibility: { category: "appliance", subtype: "cooktop" }, builderCost: money(860), unitCost: money(1180), priceSource: "Demonstration product and indicative price", imageUrl: "demo://appliance/cooktop" },
  { id: "demo_westinghouse_induction", organisationId: "org_dev", name: "Westinghouse induction cooktop", brand: "Westinghouse", supplierId: "supplier_demo_appliance", unit: "each", active: true, compatibility: { category: "appliance", subtype: "cooktop" }, builderCost: money(780), unitCost: money(980), priceSource: "Demonstration product and indicative price", imageUrl: "demo://appliance/cooktop" },
  { id: "demo_dishwasher", organisationId: "org_dev", name: "Stainless steel dishwasher option", brand: "Westinghouse", supplierId: "supplier_demo_appliance", unit: "each", active: true, compatibility: { category: "appliance", subtype: "dishwasher" }, builderCost: money(620), unitCost: money(890), priceSource: "Demonstration product and indicative price", imageUrl: "demo://appliance/dishwasher" },
  { id: "demo_rangehood", organisationId: "org_dev", name: "Canopy rangehood option", brand: "Smeg", supplierId: "supplier_demo_appliance", unit: "each", active: true, compatibility: { category: "appliance", subtype: "rangehood" }, builderCost: money(560), unitCost: money(820), priceSource: "Demonstration product and indicative price", imageUrl: "demo://appliance/rangehood" },
  { id: "demo_caroma_luna_basin", organisationId: "org_dev", name: "Caroma Luna basin", brand: "Caroma", supplierId: "supplier_demo_reece", unit: "each", active: true, compatibility: { category: "plumbing", subtype: "basin" }, builderCost: money(210), unitCost: money(320), priceSource: "Demonstration product and indicative price", imageUrl: "demo://bathroom/basin" },
  { id: "demo_caroma_luna_toilet", organisationId: "org_dev", name: "Caroma Luna toilet suite", brand: "Caroma", supplierId: "supplier_demo_reece", unit: "each", active: true, compatibility: { category: "plumbing", subtype: "toilet" }, builderCost: money(480), unitCost: money(690), priceSource: "Demonstration product and indicative price", imageUrl: "demo://bathroom/toilet" },
  { id: "demo_clark_bath", organisationId: "org_dev", name: "Clark freestanding bath", brand: "Clark", supplierId: "supplier_demo_reece", unit: "each", active: true, compatibility: { category: "plumbing", subtype: "bath" }, builderCost: money(780), unitCost: money(1150), priceSource: "Demonstration product and indicative price", imageUrl: "demo://bathroom/bath" },
  { id: "demo_shower_screen", organisationId: "org_dev", name: "Semi-frameless shower screen", brand: "Demo Glass", supplierId: "supplier_demo_finishes", unit: "each", active: true, compatibility: { category: "fixture", subtype: "shower_screen" }, builderCost: money(620), unitCost: money(890), priceSource: "Demonstration product and indicative price", imageUrl: "demo://bathroom/shower-screen" },
  { id: "demo_phoenix_shower_rail", organisationId: "org_dev", name: "Phoenix shower rail", brand: "Phoenix", supplierId: "supplier_demo_reece", unit: "each", active: true, compatibility: { category: "plumbing", subtype: "shower_outlet" }, builderCost: money(290), unitCost: money(430), priceSource: "Demonstration product and indicative price", imageUrl: "demo://tapware/shower-rail" },
  { id: "demo_porcelain_floor_tile", organisationId: "org_dev", name: "600 x 600 porcelain floor tile", brand: "Demo Tile Co", supplierId: "supplier_demo_tile", unit: "m2", active: true, compatibility: { category: "flooring", subtype: "floor_tiles" }, builderCost: money(48), unitCost: money(72), priceSource: "Demonstration product and indicative price", imageUrl: "demo://tiles/floor" },
  { id: "demo_bathroom_wall_tile", organisationId: "org_dev", name: "300 x 600 bathroom wall tile", brand: "Demo Tile Co", supplierId: "supplier_demo_tile", unit: "m2", active: true, compatibility: { category: "wall_finish", subtype: "wall_tiles" }, builderCost: money(42), unitCost: money(68), priceSource: "Demonstration product and indicative price", imageUrl: "demo://tiles/wall" },
  { id: "demo_feature_tile_unavailable", organisationId: "org_dev", name: "Feature tile option - discontinued sample", brand: "Demo Tile Co", supplierId: "supplier_demo_tile", unit: "m2", active: false, discontinued: true, compatibility: { category: "wall_finish", subtype: "splashback" }, builderCost: money(95), unitCost: money(140), priceSource: "Demonstration product and indicative price", imageUrl: "demo://tiles/feature" },
  { id: "demo_carpet", organisationId: "org_dev", name: "Solution-dyed nylon carpet", brand: "Demo Floors", supplierId: "supplier_demo_finishes", unit: "m2", active: true, compatibility: { category: "flooring", subtype: "floor_covering" }, builderCost: money(42), unitCost: money(68), priceSource: "Demonstration product and indicative price", imageUrl: "demo://flooring/carpet" },
  { id: "demo_hybrid_floor", organisationId: "org_dev", name: "Hybrid timber flooring", brand: "Demo Floors", supplierId: "supplier_demo_finishes", unit: "m2", active: true, compatibility: { category: "flooring", subtype: "floor_covering" }, builderCost: money(54), unitCost: money(84), priceSource: "Demonstration product and indicative price", imageUrl: "demo://flooring/hybrid" },
  { id: "demo_gainsborough_passage", organisationId: "org_dev", name: "Gainsborough passage set", brand: "Gainsborough", supplierId: "supplier_demo_finishes", unit: "set", active: true, compatibility: { category: "hardware", subtype: "door_hardware" }, builderCost: money(58), unitCost: money(95), priceSource: "Demonstration product and indicative price", imageUrl: "demo://hardware/passage" },
  { id: "demo_gainsborough_privacy", organisationId: "org_dev", name: "Gainsborough privacy set", brand: "Gainsborough", supplierId: "supplier_demo_finishes", unit: "set", active: true, compatibility: { category: "hardware", subtype: "door_hardware" }, builderCost: money(72), unitCost: money(125), priceSource: "Demonstration product and indicative price", imageUrl: "demo://hardware/privacy" },
  { id: "demo_gainsborough_entrance", organisationId: "org_dev", name: "Gainsborough entrance set", brand: "Gainsborough", supplierId: "supplier_demo_finishes", unit: "set", active: true, compatibility: { category: "hardware", subtype: "external_doors" }, builderCost: money(185), unitCost: money(290), priceSource: "Demonstration product and indicative price", imageUrl: "demo://hardware/entrance" },
  { id: "demo_colorbond_roof", organisationId: "org_dev", name: "Colorbond Custom Orb roof", brand: "Colorbond", supplierId: "supplier_demo_finishes", defaultVariantId: "demo_colorbond_surfmist", unit: "m2", active: true, compatibility: { category: "external_finish", subtype: "roof_material" }, builderCost: money(58), unitCost: money(82), priceSource: "Demonstration product and indicative price", imageUrl: "demo://external/colorbond" },
  { id: "demo_monier_roof_tile", organisationId: "org_dev", name: "Monier roof tile option", brand: "Monier", supplierId: "supplier_demo_finishes", unit: "m2", active: true, compatibility: { category: "external_finish", subtype: "roof_material" }, builderCost: money(62), unitCost: money(88), priceSource: "Demonstration product and indicative price", imageUrl: "demo://external/roof-tile" },
  { id: "demo_pgh_brick", organisationId: "org_dev", name: "PGH brick option", brand: "PGH", supplierId: "supplier_demo_finishes", unit: "m2", active: true, compatibility: { category: "external_finish", subtype: "brick_or_cladding" }, builderCost: money(78), unitCost: money(115), priceSource: "Demonstration product and indicative price", imageUrl: "demo://external/brick" },
  { id: "demo_external_cladding", organisationId: "org_dev", name: "Cladding option", brand: "James Hardie", supplierId: "supplier_demo_finishes", unit: "m2", active: true, compatibility: { category: "external_finish", subtype: "external_wall_finish" }, builderCost: money(92), unitCost: money(135), priceSource: "Demonstration product and indicative price", imageUrl: "demo://external/cladding" },
  { id: "demo_dulux_wall_paint", organisationId: "org_dev", name: "Dulux internal wall paint", brand: "Dulux", supplierId: "supplier_demo_finishes", unit: "m2", active: true, compatibility: { category: "wall_finish", subtype: "wall_paint" }, builderCost: money(8), unitCost: money(14), priceSource: "Demonstration product and indicative price", imageUrl: "demo://paint/walls" },
  { id: "demo_dulux_ceiling_paint", organisationId: "org_dev", name: "Dulux ceiling paint", brand: "Dulux", supplierId: "supplier_demo_finishes", unit: "m2", active: true, compatibility: { category: "wall_finish", subtype: "ceiling_paint" }, builderCost: money(7), unitCost: money(12), priceSource: "Demonstration product and indicative price", imageUrl: "demo://paint/ceiling" },
  { id: "demo_external_paint", organisationId: "org_dev", name: "External paint finish", brand: "Dulux", supplierId: "supplier_demo_finishes", unit: "m2", active: true, compatibility: { category: "external_finish", subtype: "external_paint" }, builderCost: money(12), unitCost: money(20), priceSource: "Demonstration product and indicative price", imageUrl: "demo://paint/external" },
  { id: "demo_single_shelf_rail", organisationId: "org_dev", name: "Single shelf and rail robe fitout", brand: "Demo Joinery", supplierId: "supplier_demo_finishes", unit: "each", active: true, compatibility: { category: "fitting", subtype: "robe_fitout" }, builderCost: money(180), unitCost: money(280), priceSource: "Demonstration product and indicative price", imageUrl: "demo://robes/shelf-rail" },
  { id: "demo_premier_robe", organisationId: "org_dev", name: "Premier robe fitout", brand: "Demo Joinery", supplierId: "supplier_demo_finishes", unit: "each", active: true, compatibility: { category: "fitting", subtype: "robe_fitout" }, builderCost: money(420), unitCost: money(690), priceSource: "Demonstration product and indicative price", imageUrl: "demo://robes/premier" },
  { id: "demo_premium_drawer_shelf", organisationId: "org_dev", name: "Premium drawer and shelf package", brand: "Demo Joinery", supplierId: "supplier_demo_finishes", unit: "each", active: true, compatibility: { category: "fitting", subtype: "walk_in_robe_fitout" }, builderCost: money(820), unitCost: money(1250), priceSource: "Demonstration product and indicative price", imageUrl: "demo://robes/premium" },
];

const variants: ProductVariantReference[] = [
  { id: "variant_dev_floor_oak", productReferenceId: "product_dev_floor_covering", name: "Natural Oak", sku: "DEV-FLOOR-OAK", active: true, unitCost: money(450) },
  { id: "variant_dev_floor_walnut", productReferenceId: "product_dev_floor_covering", name: "Walnut", sku: "DEV-FLOOR-WALNUT", active: true, unitCost: money(520) },
  { id: "variant_dev_handle_brushed", productReferenceId: "product_dev_internal_door_hardware", name: "Brushed Nickel", sku: "DEV-HANDLE-BN", active: true, unitCost: money(120) },
  { id: "variant_dev_basin_chrome", productReferenceId: "product_dev_basin_mixer", name: "Chrome", sku: "DEV-BASIN-CH", active: true, unitCost: money(590) },
  { id: "variant_dev_basin_matte_black", productReferenceId: "product_dev_basin_mixer", name: "Matte Black", sku: "DEV-BASIN-MB", active: true, unitCost: money(690) },
  { id: "variant_dev_kitchen_chrome", productReferenceId: "product_dev_kitchen_mixer", name: "Chrome Pull-Out", sku: "DEV-KITCHEN-CH", active: true, unitCost: money(640) },
  { id: "variant_dev_laundry_chrome", productReferenceId: "product_dev_laundry_mixer", name: "Chrome", sku: "DEV-LAUNDRY-CH", active: true, unitCost: money(360) },
  { id: "demo_phoenix_basin_chrome", productReferenceId: "demo_phoenix_vivid_basin_mixer", name: "Chrome", sku: "DEMO-PHO-BAS-CH", active: true, unitCost: money(450), colour: "Chrome" },
  { id: "demo_phoenix_basin_brushed_nickel", productReferenceId: "demo_phoenix_vivid_basin_mixer", name: "Brushed Nickel", sku: "DEMO-PHO-BAS-BN", active: true, unitCost: money(590), colour: "Brushed Nickel" },
  { id: "demo_phoenix_basin_matte_black", productReferenceId: "demo_phoenix_vivid_basin_mixer", name: "Matte Black", sku: "DEMO-PHO-BAS-MB", active: true, unitCost: money(620), colour: "Matte Black" },
  { id: "demo_phoenix_shower_chrome", productReferenceId: "demo_phoenix_vivid_shower_mixer", name: "Chrome", sku: "DEMO-PHO-SHM-CH", active: true, unitCost: money(390), colour: "Chrome" },
  { id: "demo_phoenix_sink_chrome", productReferenceId: "demo_phoenix_vivid_sink_mixer", name: "Chrome", sku: "DEMO-PHO-SINK-CH", active: true, unitCost: money(590), colour: "Chrome" },
  { id: "demo_caesarstone_snowdrift", productReferenceId: "demo_caesarstone_benchtop", name: "Snowdrift", sku: "DEMO-CS-SNOW", active: true, unitCost: money(920), colour: "Snowdrift" },
  { id: "demo_caesarstone_pure_white", productReferenceId: "demo_caesarstone_benchtop", name: "Pure White", sku: "DEMO-CS-WHITE", active: true, unitCost: money(880), colour: "Pure White" },
  { id: "demo_caesarstone_organic_white", productReferenceId: "demo_caesarstone_benchtop", name: "Organic White", sku: "DEMO-CS-ORG", active: true, unitCost: money(980), colour: "Organic White" },
  { id: "demo_polytec_white_matt", productReferenceId: "demo_polytec_cabinetry", name: "Classic White Matt", sku: "DEMO-POL-WM", active: true, unitCost: money(680), colour: "Classic White Matt" },
  { id: "demo_polytec_oak_ravine", productReferenceId: "demo_polytec_cabinetry", name: "Natural Oak Ravine", sku: "DEMO-POL-OAK", active: true, unitCost: money(740), colour: "Natural Oak Ravine" },
  { id: "demo_polytec_black_matt", productReferenceId: "demo_polytec_cabinetry", name: "Black Matt", sku: "DEMO-POL-BLK", active: true, unitCost: money(760), colour: "Black Matt" },
  { id: "demo_colorbond_surfmist", productReferenceId: "demo_colorbond_roof", name: "Surfmist", sku: "DEMO-CB-SURF", active: true, unitCost: money(82), colour: "Surfmist" },
  { id: "demo_colorbond_monument", productReferenceId: "demo_colorbond_roof", name: "Monument", sku: "DEMO-CB-MON", active: true, unitCost: money(84), colour: "Monument" },
  { id: "demo_colorbond_basalt", productReferenceId: "demo_colorbond_roof", name: "Basalt", sku: "DEMO-CB-BAS", active: true, unitCost: money(84), colour: "Basalt" },
  { id: "demo_colorbond_woodland_grey", productReferenceId: "demo_colorbond_roof", name: "Woodland Grey", sku: "DEMO-CB-WG", active: true, unitCost: money(86), colour: "Woodland Grey" },
];

function normalise(value = ""): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const subtypeTags: Record<string, string[]> = {
  oven: ["appliance", "oven", "built-in-oven"],
  cooktop: ["appliance", "cooktop"],
  rangehood: ["appliance", "rangehood"],
  dishwasher: ["appliance", "dishwasher"],
  basin_mixer: ["tapware", "basin-mixer", "wet-area", "bench-mounted"],
  shower_mixer: ["tapware", "shower-mixer", "wet-area", "wall-mounted"],
  sink_mixer: ["tapware", "sink-mixer", "kitchen-mixer"],
  laundry_mixer: ["tapware", "laundry-mixer"],
  basin: ["basin"],
  toilet: ["toilet"],
  bath: ["bath"],
  shower_screen: ["shower-screen"],
  shower_outlet: ["tapware", "shower-outlet", "wet-area"],
  floor_tiles: ["floor-tile"],
  wall_tiles: ["wall-tile"],
  splashback: ["splashback", "feature-tile"],
  floor_covering: ["carpet", "hybrid-flooring"],
  cabinetry: ["cabinetry"],
  benchtops: ["benchtop"],
  door_hardware: ["passage-hardware"],
  external_doors: ["entrance-hardware"],
  roof_material: ["roofing"],
  brick_or_cladding: ["brick", "cladding"],
  external_wall_finish: ["cladding", "external-paint"],
  wall_paint: ["internal-paint"],
  ceiling_paint: ["internal-paint"],
  robe_fitout: ["robe-fitout", "shelf-and-rail"],
  walk_in_robe_fitout: ["robe-fitout", "drawers", "shelving"],
};

function supplierName(supplierId?: string): string | undefined {
  return suppliers.find((supplier) => supplier.id === supplierId)?.name;
}

function classifyProduct(product: ProductReference): ProductReference {
  const subtype = product.compatibility.subtype ?? "";
  const isOven = subtype === "oven";
  const width = product.name.includes("600") ? "600 mm" : product.name.includes("900") ? "900 mm" : product.compatibility.width;
  return {
    ...product,
    productCode: product.productCode ?? product.id.replace(/^demo_/, "DEMO-").replace(/^product_dev_/, "DEV-").replace(/_/g, "-").toUpperCase(),
    supplierName: product.supplierName ?? supplierName(product.supplierId),
    supplierSku: product.supplierSku ?? product.id.replace(/_/g, "-").toUpperCase(),
    productUrl: product.productUrl ?? "https://example.com/demo-product",
    categoryName: product.categoryName ?? (product.compatibility.category === "appliance" ? "Kitchen Appliances" : product.compatibility.category),
    subcategoryName: product.subcategoryName ?? subtype.replace(/_/g, " "),
    productType: product.productType ?? (isOven ? "Built-in Oven" : subtype.replace(/_/g, " ")),
    range: product.range ?? (product.brand === "Phoenix" ? "Vivid Slimline" : undefined),
    description: product.description ?? "Demonstration product and indicative price. Pricing is not current supplier pricing.",
    tierId: product.tierId ?? (product.name.toLowerCase().includes("premium") ? "tier_premium" : "tier_premier"),
    allowance: product.allowance ?? product.unitCost,
    availabilityStatus: product.discontinued ? "discontinued" : product.active ? "available" : "unavailable",
    compatibility: {
      ...product.compatibility,
      requirementTags: product.compatibility.requirementTags ?? subtypeTags[subtype] ?? [subtype.replace(/_/g, "-")],
      width,
      size: product.compatibility.size ?? width,
      fuelType: product.compatibility.fuelType ?? (isOven ? "Electric" : product.name.toLowerCase().includes("gas") ? "Gas" : product.name.toLowerCase().includes("induction") ? "Induction" : undefined),
      installationType: product.compatibility.installationType ?? (isOven ? "Built-in" : undefined),
      wetAreaSuitable: product.compatibility.wetAreaSuitable ?? (["basin_mixer", "shower_mixer", "laundry_mixer", "bath_outlet", "shower_outlet"].includes(subtype) ? true : undefined),
    },
  };
}

const catalogueProducts = products.map(classifyProduct);

export class InMemoryProductSelectionCatalogueAdapter implements ProductSelectionCatalogueAdapter {
  private organisationId: string;

  constructor(organisationId = "org_dev") {
    this.organisationId = organisationId;
  }

  async searchCompatibleProducts(requirement: ProjectRequirement, filters: ProductSearchFilters = {}): Promise<ProductReference[]> {
    const search = normalise(filters.search);
    return catalogueProducts
      .filter((product) => product.organisationId === this.organisationId || product.organisationId === "org_dev")
      .filter((product) => evaluateProductCompatibility(requirement, product).compatible)
      .filter((product) => productMatchesFilters(product, filters))
      .filter((product) => !search || normalise([product.name, product.brand, product.id, product.compatibility.width, product.compatibility.fuelType].join(" ")).includes(search));
  }

  async getProduct(productReferenceId: string): Promise<ProductReference | null> {
    return catalogueProducts.find((product) => product.id === productReferenceId) ?? null;
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
