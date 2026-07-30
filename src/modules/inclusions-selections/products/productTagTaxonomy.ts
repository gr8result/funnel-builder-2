export const PRODUCT_TAG_TAXONOMY = {
  kitchenAppliances: [
    "appliance",
    "oven",
    "built-in-oven",
    "freestanding-oven",
    "cooktop",
    "gas-cooktop",
    "electric-cooktop",
    "induction-cooktop",
    "rangehood",
    "dishwasher",
    "microwave",
    "refrigerator",
    "600mm",
    "900mm",
  ],
  tapware: [
    "tapware",
    "basin-mixer",
    "shower-mixer",
    "sink-mixer",
    "kitchen-mixer",
    "laundry-mixer",
    "bath-mixer",
    "bath-outlet",
    "shower-outlet",
    "wall-mounted",
    "bench-mounted",
    "wet-area",
  ],
  bathrooms: [
    "basin",
    "toilet",
    "bath",
    "shower-screen",
    "vanity",
    "mirror",
    "bathroom-accessory",
    "towel-rail",
    "toilet-roll-holder",
    "robe-hook",
    "shelf",
  ],
  doorsAndHardware: [
    "internal-door",
    "external-door",
    "entry-door",
    "garage-door",
    "passage-hardware",
    "privacy-hardware",
    "entrance-hardware",
    "cavity-slider",
    "hinged-door",
  ],
  finishes: [
    "floor-tile",
    "wall-tile",
    "feature-tile",
    "carpet",
    "hybrid-flooring",
    "timber-flooring",
    "internal-paint",
    "external-paint",
    "cabinetry",
    "benchtop",
    "splashback",
  ],
  external: [
    "roofing",
    "colorbond-roofing",
    "roof-tile",
    "brick",
    "cladding",
    "gutter",
    "fascia",
    "downpipe",
    "garage-door",
  ],
  robeFitouts: [
    "robe-fitout",
    "shelf-and-rail",
    "double-hanging",
    "drawers",
    "shelving",
  ],
} as const;

export type ProductRequirementTag = typeof PRODUCT_TAG_TAXONOMY[keyof typeof PRODUCT_TAG_TAXONOMY][number];

export const ALL_PRODUCT_REQUIREMENT_TAGS = Object.values(PRODUCT_TAG_TAXONOMY).flat();

export function normalizeProductTag(value: string): string {
  return value.trim().toLowerCase().replace(/&/g, "and").replace(/[_\s]+/g, "-").replace(/[^a-z0-9-]+/g, "").replace(/--+/g, "-");
}

export function normalizeProductTags(values: Array<string | undefined | null> = []): string[] {
  return [...new Set(values.map((value) => normalizeProductTag(String(value ?? ""))).filter(Boolean))];
}

export function isKnownProductRequirementTag(value: string): boolean {
  return ALL_PRODUCT_REQUIREMENT_TAGS.includes(normalizeProductTag(value) as ProductRequirementTag);
}
