export const GENERIC_CATEGORY_IMAGES = {
  Exterior: "/assets/builders/standard-inclusions-construction-strip.png",
  Interior: "/assets/builders/standard-inclusions-premier-living.jpg",
  Kitchen: "/assets/builders/standard-inclusions-premier-kitchen.jpg",
  "Bathroom & Ensuite": "/standard-inclusions/assets/image19.jpeg",
  Laundry: "/standard-inclusions/assets/image46.jpeg",
  Bedrooms: "/standard-inclusions/assets/image47.jpeg",
  "Living Areas": "/assets/builders/standard-inclusions-family-kitchen.jpg",
  Garage: "/standard-inclusions/assets/image48.jpeg",
  "Outdoor Areas": "/assets/builders/standard-inclusions-hero.jpg",
  Pool: "/standard-inclusions/assets/image55.jpeg",
  "Stone Benchtops": "/assets/builders/standard-inclusions-premier-kitchen.webp",
  "Metal Roofing": "/standard-inclusions/assets/image45.jpeg",
  Bricks: "/standard-inclusions/assets/image49.jpeg",
  "Internal Doors": "/standard-inclusions/assets/image50.png",
};

export const PRODUCT_LIBRARY_CATEGORY_HIERARCHY = [
  { topLevelArea: "Exterior", category: "Roofing", sourceSections: ["ROOFING MATERIALS"], families: ["Metal Roofing", "Tiled Roofing"] },
  { topLevelArea: "Exterior", category: "Entry Doors", sourceSections: ["ENTRY DOORS"], families: ["Entry Doors"] },
  { topLevelArea: "Exterior", category: "Entry Door Hardware", sourceSections: ["ENTRY DOOR FURNITURE"], families: ["Entry Door Hardware"] },
  { topLevelArea: "Exterior", category: "Garage Doors", sourceSections: ["GARAGE DOORS"], families: ["Garage Doors"], secondaryAreas: ["Garage"] },
  { topLevelArea: "Exterior", category: "Bricks", sourceSections: ["FACE BRICKWORK"], families: ["Bricks"] },
  { topLevelArea: "Exterior", category: "Cladding", sourceSections: ["EXTERNAL CLADDING"], families: ["External Cladding"] },
  { topLevelArea: "Interior", category: "Fix Out", subcategories: ["Internal Doors", "Door Hardware", "Skirting", "Architraves", "Robes"], sourceSections: ["FIX OUT"], families: ["Standard Internal Doors", "Premium Internal Doors"] },
  { topLevelArea: "Kitchen", category: "Cabinetry", subcategories: ["Benchtops", "Cabinet Finishes", "Handles"], sourceSections: ["CABINETRY"], families: ["Stone Benchtops", "Cabinet Finishes"] },
  { topLevelArea: "Kitchen", category: "Appliances", subcategories: ["Ovens", "Cooktops", "Rangehoods", "Dishwashers", "Microwaves"], sourceSections: ["APPLIANCES"], families: ["Kitchen Appliances"] },
  { topLevelArea: "Bathroom & Ensuite", category: "Plumbing Fittings & Tapware", subcategories: ["Toilets", "Basins", "Baths", "Tapware", "Mixers", "Showers", "Accessories"], sourceSections: ["PLUMBING FITTINGS & TAPWEAR"], families: ["Tapware", "Sanitaryware"] },
  { topLevelArea: "Interior", category: "Floorcoverings", subcategories: ["Carpet", "Hybrid Flooring", "Timber Flooring", "Vinyl", "Tiles"], sourceSections: ["FLOORCOVERINGS"], families: ["Floorcoverings"], secondaryAreas: ["Bedrooms", "Living Areas"] },
];

export const PRODUCT_FAMILY_TEMPLATES = [
  {
    id: "family_stone_benchtops",
    productFamily: "Stone Benchtops",
    topLevelArea: "Kitchen",
    category: "Cabinetry",
    subcategory: "Benchtops",
    linkedQuotationItemCodes: ["SEL-KIT-BENCH-20-STANDARD", "SEL-KIT-BENCH-20-PREMIUM", "SEL-KIT-BENCH-40-STANDARD", "SEL-KIT-BENCH-40-PREMIUM"],
    requiredAttributes: ["supplier", "brand", "collection/range", "colour", "pattern", "finish", "thickness", "edge profile", "slab size", "price tier", "image/swatch", "official product link"],
    allowedVariantTypes: ["range", "colour", "finish", "thickness", "edge_profile", "slab_size"],
    quantityRule: "Use quotation item unit and room/location quantity; slab and edge measurements remain builder-entered catalogue data.",
    supplierOptionalInStandardTemplate: true,
  },
  {
    id: "family_metal_roofing",
    productFamily: "Metal Roofing",
    topLevelArea: "Exterior",
    category: "Roofing",
    subcategory: "Metal Roof",
    linkedQuotationItemCodes: ["SEL-EXT-ROOF-METAL"],
    requiredAttributes: ["supplier", "brand", "material", "profile", "range", "colour", "finish", "thickness", "image/swatch", "official link"],
    allowedVariantTypes: ["profile", "range", "colour", "finish", "thickness"],
    quantityRule: "Use roof area or quoted item quantity from the quotation item template.",
    supplierOptionalInStandardTemplate: true,
  },
  {
    id: "family_bricks",
    productFamily: "Bricks",
    topLevelArea: "Exterior",
    category: "Bricks",
    subcategory: "Face Brickwork",
    linkedQuotationItemCodes: ["SEL-EXT-BRICK", "SEL-EXT-BRICK-PREMIER", "SEL-EXT-BRICK-PREMIUM"],
    requiredAttributes: ["supplier", "brand", "collection/range", "brick name", "colour", "texture", "format", "pack or thousand price", "image", "official link"],
    allowedVariantTypes: ["brand", "range", "product", "colour", "texture", "format"],
    quantityRule: "Use wall area or thousand/pack quantity according to the linked quotation item.",
    supplierOptionalInStandardTemplate: true,
  },
  {
    id: "family_internal_doors",
    productFamily: "Internal Doors",
    topLevelArea: "Interior",
    category: "Fix Out",
    subcategory: "Internal Doors",
    linkedQuotationItemCodes: ["SEL-INT-DOOR-STANDARD", "SEL-INT-DOOR-PREMIUM"],
    requiredAttributes: ["supplier", "brand", "range", "door design", "construction type", "width", "height", "thickness", "finish", "glazing option", "fire rating", "acoustic rating", "image", "price", "official link"],
    allowedVariantTypes: ["range", "door_design", "size", "finish", "glazing_option", "fire_rating", "acoustic_rating"],
    quantityRule: "Use number of doors by room/location. Door sizes are product variants, not platform structure.",
    supplierOptionalInStandardTemplate: true,
    sourceEvidence: ["HUME BUILDERS RANGE DOORS AS PER PLANS", "HUME PREMIUM DOORS AS PER PLANS"],
  },
];

export const SUPPLIER_CATALOGUE_IMPORT_FIELDS = [
  "product_code",
  "linked_quote_item_code",
  "supplier_name",
  "brand",
  "range",
  "product_name",
  "model",
  "category",
  "subcategory",
  "product_family",
  "colour",
  "finish",
  "size",
  "width",
  "height",
  "depth",
  "variant_name",
  "primary_image",
  "gallery_images",
  "official_product_url",
  "specification_url",
  "rrp",
  "builder_cost",
  "client_price",
  "currency",
  "gst_treatment",
  "price_effective_date",
  "active",
  "discontinued",
];

export function validateSupplierCatalogueImportRow(row, approvedCodes = new Set()) {
  const errors = [];
  const productCode = String(row.product_code || "").trim();
  const linkedCode = String(row.linked_quote_item_code || "").trim();
  if (!productCode) errors.push("product_code is required");
  if (!linkedCode) errors.push("linked_quote_item_code is required");
  if (linkedCode && approvedCodes.size && !approvedCodes.has(linkedCode)) errors.push("linked_quote_item_code must match an approved selection item");
  if (!String(row.product_family || "").trim()) errors.push("product_family is required");
  if (!String(row.product_name || "").trim()) errors.push("product_name is required");
  if (row.official_product_url && !/^https?:\/\//i.test(String(row.official_product_url))) errors.push("official_product_url must be a valid http(s) URL");
  return { ok: errors.length === 0, errors };
}

export const GENERIC_DEMONSTRATION_OPTIONS = [
  { productFamily: "Stone Benchtops", label: "Demonstration Product - Generic Stone Range", variants: ["White", "Light Grey", "Dark Grey"] },
  { productFamily: "Metal Roofing", label: "Demonstration Product - Generic Metal Roof", variants: ["Light", "Mid-tone", "Dark"] },
  { productFamily: "Bricks", label: "Demonstration Product - Generic Brick Range", variants: ["Light", "Red/Brown", "Charcoal"] },
  { productFamily: "Internal Doors", label: "Demonstration Product - Generic Internal Door", variants: ["Flush Panel", "Moulded Panel", "Glazed"] },
];

export function productLibraryRecordShape() {
  return {
    identity: ["productId", "productCode", "organisationId", "linkedQuotationItemCode"],
    classification: ["topLevelArea", "category", "subcategory", "productFamily", "tags", "compatibleAreaTypes"],
    productData: ["productName", "supplier", "brand", "range", "model", "description", "colour", "finish", "size", "dimensions", "variants"],
    media: ["primaryImage", "thumbnail", "galleryImages", "colourSwatches", "imageAltText", "imageSource"],
    links: ["officialProductURL", "specificationURL", "warrantyURL", "supplierURL"],
    pricing: ["RRP", "builderCost", "clientPrice", "allowance", "upgradePrice", "currency", "GST treatment", "priceSource", "effectiveDate", "priceStatus"],
    status: ["active", "discontinued", "archived", "unavailable", "imageReviewRequired", "priceReviewRequired"],
  };
}
