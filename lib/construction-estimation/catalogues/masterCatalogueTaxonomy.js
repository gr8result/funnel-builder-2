export const MASTER_CATALOGUE_STAGES = [
  { id: "stage:preliminaries", label: "Preliminaries" },
  { id: "stage:base", label: "Base / Slab" },
  { id: "stage:frame", label: "Frame" },
  { id: "stage:lock-up", label: "Lock-up" },
  { id: "stage:fix-out", label: "Fix-out" },
  { id: "stage:external", label: "External Works" },
  { id: "stage:handover", label: "Handover" },
];

export const MASTER_CATALOGUE_CATEGORIES = [
  category("category:preliminaries", "stage:preliminaries", "Preliminaries"),
  category("category:statutory-fees", "stage:preliminaries", "Statutory Fees"),
  category("category:siteworks", "stage:base", "Siteworks"),
  category("category:slab", "stage:base", "Slab"),
  category("category:frame", "stage:frame", "Frame"),
  category("category:roofing", "stage:lock-up", "Roofing"),
  category("category:external-cladding", "stage:lock-up", "External Cladding"),
  category("category:windows-doors", "stage:lock-up", "Windows & Doors"),
  category("category:linings", "stage:fix-out", "Linings"),
  category("category:cabinetry", "stage:fix-out", "Cabinetry"),
  category("category:benchtops", "stage:fix-out", "Benchtops"),
  category("category:appliances", "stage:fix-out", "Appliances"),
  category("category:plumbing-fixtures", "stage:fix-out", "Plumbing Fixtures"),
  category("category:electrical", "stage:fix-out", "Electrical Fixtures"),
  category("category:flooring-tiling", "stage:fix-out", "Flooring & Tiling"),
  category("category:painting", "stage:fix-out", "Painting"),
  category("category:external-works", "stage:external", "External Works"),
  category("category:pc-items", "stage:fix-out", "PC Items"),
  category("category:provisional-sums", "stage:preliminaries", "Provisional Sums"),
];

export const MASTER_CATALOGUE_SUBCATEGORIES = [
  subcategory("subcategory:built-in-ovens", "category:appliances", "Built-in Ovens"),
  subcategory("subcategory:cooktops", "category:appliances", "Cooktops"),
  subcategory("subcategory:rangehoods", "category:appliances", "Rangehoods"),
  subcategory("subcategory:dishwashers", "category:appliances", "Dishwashers"),
  subcategory("subcategory:microwaves", "category:appliances", "Microwaves"),
  subcategory("subcategory:refrigerators", "category:appliances", "Refrigerators"),
  subcategory("subcategory:cabinet-units-components", "category:cabinetry", "Cabinet Units & Components"),
  subcategory("subcategory:cabinet-finishes", "category:cabinetry", "Cabinet Finishes"),
  subcategory("subcategory:handles", "category:cabinetry", "Handles"),
  subcategory("subcategory:drawer-systems", "category:cabinetry", "Drawer Systems"),
  subcategory("subcategory:shelving", "category:cabinetry", "Shelving"),
  subcategory("subcategory:laminate-benchtops", "category:benchtops", "Laminate"),
  subcategory("subcategory:mineral-surfaces", "category:benchtops", "Mineral Surfaces"),
  subcategory("subcategory:porcelain-benchtops", "category:benchtops", "Porcelain"),
  subcategory("subcategory:sintered-stone", "category:benchtops", "Sintered Stone"),
  subcategory("subcategory:kitchen-sinks", "category:plumbing-fixtures", "Kitchen Sinks"),
  subcategory("subcategory:sink-mixers", "category:plumbing-fixtures", "Sink Mixers"),
  subcategory("subcategory:basins", "category:plumbing-fixtures", "Basins"),
  subcategory("subcategory:basin-mixers", "category:plumbing-fixtures", "Basin Mixers"),
  subcategory("subcategory:toilets", "category:plumbing-fixtures", "Toilets"),
  subcategory("subcategory:baths", "category:plumbing-fixtures", "Baths"),
  subcategory("subcategory:showers", "category:plumbing-fixtures", "Showers"),
  subcategory("subcategory:light-fittings", "category:electrical", "Client-selected Light Fittings"),
  subcategory("subcategory:paint-products-colours", "category:painting", "Paint Products / Colours"),
  subcategory("subcategory:labour", "category:preliminaries", "Labour"),
  subcategory("subcategory:plant-hire", "category:siteworks", "Plant Hire"),
  subcategory("subcategory:construction-materials", "category:slab", "Construction Materials"),
  subcategory("subcategory:statutory-fees", "category:statutory-fees", "Statutory Fees"),
  subcategory("subcategory:services", "category:preliminaries", "Services"),
  subcategory("subcategory:allowances", "category:pc-items", "Allowances"),
];

export const MASTER_CATALOGUE_FAMILIES = [
  family("family:built-in-ovens", "subcategory:built-in-ovens", "ovens", true),
  family("family:cooktops", "subcategory:cooktops", "cooktops", true),
  family("family:rangehoods", "subcategory:rangehoods", "rangehoods", true),
  family("family:dishwashers", "subcategory:dishwashers", "dishwashers", true),
  family("family:microwaves", "subcategory:microwaves", "microwaves", true),
  family("family:refrigerators", "subcategory:refrigerators", "fridges", true),
  family("family:cabinetry", "subcategory:cabinet-units-components", "cabinetry", true),
  family("family:cabinet-finishes", "subcategory:cabinet-finishes", "cabinet-finish", true),
  family("family:handles", "subcategory:handles", "handles", true),
  family("family:stone-benchtops", "subcategory:mineral-surfaces", "stone-benchtops", true),
  family("family:kitchen-sinks", "subcategory:kitchen-sinks", "kitchen-sinks", true),
  family("family:kitchen-sink-mixers", "subcategory:sink-mixers", "kitchen-sink-mixers", true),
  family("family:client-selected-light-fittings", "subcategory:light-fittings", "lighting", true),
  family("family:paint-products-colours", "subcategory:paint-products-colours", "paint", true),
  family("family:labour", "subcategory:labour", "labour", false),
  family("family:plant-hire", "subcategory:plant-hire", "plant-hire", false),
  family("family:statutory-fees", "subcategory:statutory-fees", "statutory-fees", false),
  family("family:allowances", "subcategory:allowances", "allowances", false),
];

export function taxonomyNodeById(id) {
  return [
    ...MASTER_CATALOGUE_STAGES,
    ...MASTER_CATALOGUE_CATEGORIES,
    ...MASTER_CATALOGUE_SUBCATEGORIES,
    ...MASTER_CATALOGUE_FAMILIES,
  ].find((node) => node.id === id) || null;
}

export function familyByLegacyKey(legacyKey) {
  return MASTER_CATALOGUE_FAMILIES.find((familyItem) => familyItem.legacyFamilyKey === legacyKey) || null;
}

function category(id, stageId, label) {
  return { id, stageId, label };
}

function subcategory(id, categoryId, label) {
  return { id, categoryId, label };
}

function family(id, subcategoryId, legacyFamilyKey, clientSelectable) {
  return { id, subcategoryId, legacyFamilyKey, clientSelectable };
}

