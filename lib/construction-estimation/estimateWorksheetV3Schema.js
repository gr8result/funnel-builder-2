export const V3_PAGES = [
  { key: "dataInput", label: "Data Input Sheet" },
  { key: "windowsDoors", label: "Windows & Doors" },
  { key: "quotation", label: "Quotation" },
  { key: "summary", label: "Summary" },
];

export const V3_DATA_SECTIONS = [
  section("externalWalls", "External Walls", [
    input("lowerExternalWallsLm", "Lower external walls", "LM", true),
    input("upperExternalWallsLm", "Upper external walls", "LM"),
    calc("totalExternalWallsLm", "Total external walls", "LM"),
    input("lowerCeilingHeight", "Lower ceiling height", "M", true),
    input("upperCeilingHeight", "Upper ceiling height", "M"),
    calc("lowerWallAreaM2", "Lower wall area", "M2"),
    calc("upperWallAreaM2", "Upper wall area", "M2"),
    calc("totalWallAreaM2", "Total wall area", "M2"),
    calc("windowDoorDeductionsM2", "Window/door deductions", "M2"),
    calc("netExternalWallAreaM2", "Net external wall area", "M2"),
    input("lowerWallSystem", "Lower wall system", "", false, ["Brick Veneer", "Blockwork", "Hebel", "Lightweight Cladding", "Rendered Cladding", "Mixed"]),
    input("upperWallSystem", "Upper wall system", "", false, ["Brick Veneer", "Blockwork", "Hebel", "Lightweight Cladding", "Rendered Cladding", "Mixed"]),
    calc("brickworkAreaM2", "Brickwork area", "M2"),
    calc("upperCladdingAreaM2", "Upper cladding area", "M2"),
  ]),
  section("internalWalls", "Internal Walls", [
    input("lowerInternalWallsLm", "Lower internal walls", "LM", true),
    input("upperInternalWallsLm", "Upper internal walls", "LM"),
    calc("totalInternalWallsLm", "Total internal walls", "LM"),
    calc("plasterboardWallAreaM2", "Plasterboard wall area", "M2"),
  ]),
  section("areas", "Areas", [
    input("lowerFloorAreaM2", "Lower floor area", "M2", true),
    input("upperFloorAreaM2", "Upper floor area", "M2"),
    input("garageAreaM2", "Garage area", "M2"),
    input("alfrescoAreaM2", "Alfresco area", "M2"),
    input("porchAreaM2", "Porch area", "M2"),
    input("balconyAreaM2", "Balcony area", "M2"),
    calc("totalFloorAreaM2", "Total floor/slab area", "M2"),
  ]),
  section("slabRoofLinings", "Slab, Roof & Linings", [
    input("slabType", "Slab type", "", false, ["Waffle Pod", "Raft Slab", "Conventional Slab", "Suspended Slab", "Split Level Slab"]),
    calc("slabAreaM2", "Slab area", "M2"),
    input("concreteM3", "Concrete", "M3"),
    input("roofPlanAreaM2", "Roof plan area", "M2"),
    input("roofPitchDegrees", "Roof pitch", "DEG"),
    input("roofType", "Roof type", "", false, ["Colorbond", "Concrete Tile", "Terracotta Tile", "Flat Roof", "Skillion Roof"]),
    calc("roofAreaM2", "Roof area", "M2"),
    calc("ceilingAreaM2", "Ceiling area", "M2"),
    calc("corniceLm", "Cornice", "LM"),
    calc("skirtingLm", "Skirting", "LM"),
    calc("architraveLm", "Architrave", "LM"),
    calc("revealLm", "Reveal", "LM"),
  ]),
  section("fixtures", "Fixout, Plumbing & Electrical", [
    input("internalDoors", "Internal doors", "EACH"),
    input("cabinetryLm", "Cabinetry", "LM"),
    input("vanities", "Vanities", "EACH"),
    input("toilets", "Toilets", "EACH"),
    input("showers", "Showers", "EACH"),
    input("baths", "Baths", "EACH"),
    input("powerPoints", "Power points", "EACH"),
    input("downlights", "Downlights", "EACH"),
    input("fans", "Fans", "EACH"),
  ]),
  section("siteExternalAllowances", "Siteworks, External Works & Allowances", [
    input("siteSlope", "Site slope", "", false, ["Flat Site", "Mild Slope", "Moderate Slope", "Steep Slope", "Heavy Cut & Fill"]),
    input("accessDifficulty", "Access difficulty", "", false, ["Easy", "Moderate", "Restricted", "Difficult"]),
    input("cutFillM3", "Cut/fill", "M3"),
    input("retainingWallLm", "Retaining", "LM"),
    input("drivewayM2", "Driveway", "M2"),
    input("pathsM2", "Paths", "M2"),
    input("decksM2", "Decks", "M2"),
    input("fencingLm", "Fencing", "LM"),
    input("pcItems", "PC items", "ITEM"),
    input("provisionalSums", "Provisional sums", "ITEM"),
  ]),
];

export const V3_WINDOW_DOOR_TYPES = [
  "Fixed Window", "Sliding Window", "Awning Window", "Louvre Window",
  "Sliding Door", "Stacker Door", "Entry Door", "Internal Door",
  "Garage Door", "Cavity Slider",
];

export const V3_QUOTATION_SECTIONS = [
  "Siteworks", "Slab", "Frame Stage Labour", "Lock-up Stage Labour",
  "Fix-out Stage Labour", "External Cladding", "Roofing", "Windows & Doors",
  "Linings", "Plumbing", "Electrical", "Kitchen & Appliances", "Bathrooms",
  "Flooring & Tiling", "Painting", "External Works", "Allowances / PC / PS Items",
];

export const V3_REQUIRED_FIELDS = [
  ["externalWalls", "lowerExternalWallsLm"],
  ["externalWalls", "lowerCeilingHeight"],
  ["internalWalls", "lowerInternalWallsLm"],
  ["areas", "lowerFloorAreaM2"],
];

function section(key, label, rows) {
  return { key, label, rows };
}

function input(key, label, unit, required = false, options = null) {
  return { key, label, unit, required, options, calculated: false };
}

function calc(key, label, unit) {
  return { key, label, unit, calculated: true };
}
