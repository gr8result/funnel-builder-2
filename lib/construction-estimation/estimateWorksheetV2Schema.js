export const V2_WORKSHEET_SECTIONS = [
  section("projectBasics", "Project Basics", [
    text("jobName", "Job Name", true),
    text("clientName", "Client"),
    text("siteAddress", "Site Address", true),
    select("projectType", "Project Type", ["Single Storey Home", "Double Storey Home", "Triple Storey Home", "Duplex", "Townhouses", "Renovation / Extension", "Commercial"], true),
    number("storeys", "Storeys", "count"),
  ]),
  section("siteworks", "Siteworks", [
    select("siteSlope", "Site Slope", ["Flat Site", "Mild Slope", "Moderate Slope", "Steep Slope", "Heavy Cut & Fill"]),
    select("accessDifficulty", "Access Difficulty", ["Easy", "Moderate", "Restricted", "Difficult"]),
    number("cutFillM3", "Cut / Fill", "m3"),
    number("retainingWallLm", "Retaining Wall", "lm"),
    number("drivewayM2", "Driveway", "m2"),
    number("pathsM2", "Paths", "m2"),
    number("drainageLm", "Drainage", "lm"),
    number("landscapingM2", "Landscaping Allowance Area", "m2"),
  ]),
  section("areas", "Areas", [
    number("groundFloorM2", "Ground Floor", "m2", true),
    number("firstFloorM2", "First Floor", "m2"),
    number("secondFloorM2", "Second Floor", "m2"),
    number("garageM2", "Garage", "m2"),
    number("alfrescoM2", "Alfresco", "m2"),
    number("porchM2", "Porch", "m2"),
    number("balconyM2", "Balcony", "m2"),
    calc("totalFloorAreaM2", "Total Floor Area", "m2"),
  ]),
  section("exteriorWalls", "Exterior Walls", [
    number("externalWallLm", "External Wall Length", "lm"),
    number("wallHeightM", "Wall Height", "m"),
    select("wallSystem", "Primary Wall System", ["Brick Veneer", "Blockwork", "Hebel", "Lightweight Cladding", "Rendered Cladding", "Mixed"]),
    calc("grossExternalWallM2", "Gross External Wall Area", "m2"),
    calc("externalOpeningAreaM2", "Window/Door Deductions", "m2"),
    calc("netExternalWallM2", "Net External Wall Area", "m2"),
    number("brickVeneerM2", "Brick Veneer", "m2"),
    number("blockworkM2", "Blockwork", "m2"),
    number("hebelM2", "Hebel", "m2"),
    number("lightweightCladdingM2", "Lightweight Cladding", "m2"),
    number("renderM2", "Render", "m2"),
  ]),
  section("interiorWalls", "Interior Walls", [
    number("internalWallLm", "Internal Wall Length", "lm"),
    number("internalWallHeightM", "Internal Wall Height", "m"),
    select("frameType", "Frame Type", ["Timber", "Steel", "Masonry", "Mixed"]),
    calc("internalWallAreaM2", "Internal Wall Area", "m2"),
    number("bracingPanels", "Bracing Panels", "count"),
    number("structuralSteelTonnes", "Structural Steel", "t"),
  ]),
  section("slab", "Slab", [
    select("slabType", "Slab Type", ["Waffle Pod", "Raft Slab", "Conventional Slab", "Suspended Slab", "Split Level Slab"]),
    calc("slabAreaM2", "Slab / Floor Area", "m2"),
    number("edgeBeamLm", "Edge Beam", "lm"),
    number("concreteM3", "Concrete", "m3"),
    number("reinforcementM2", "Reinforcement", "m2"),
    number("wafflePodsM2", "Waffle Pods", "m2"),
    number("pieringCount", "Piering", "count"),
  ]),
  section("roof", "Roof", [
    number("roofPlanAreaM2", "Roof Plan Area", "m2"),
    number("roofPitchDegrees", "Roof Pitch", "degrees"),
    select("roofType", "Roof Type", ["Colorbond", "Concrete Tile", "Terracotta Tile", "Flat Roof", "Skillion Roof"]),
    calc("roofAreaM2", "Roof Area", "m2"),
    number("guttersLm", "Gutters", "lm"),
    number("fasciaLm", "Fascia", "lm"),
    number("downpipesCount", "Downpipes", "count"),
    calc("roofInsulationM2", "Roof Insulation", "m2"),
    calc("sarkingM2", "Sarking", "m2"),
  ]),
  section("linings", "Linings", [
    calc("plasterboardWallM2", "Plasterboard Walls", "m2"),
    calc("ceilingM2", "Ceilings", "m2"),
    calc("corniceLm", "Cornice", "lm"),
    calc("insulationM2", "Wall/Roof Insulation", "m2"),
    calc("internalPaintM2", "Internal Paint", "m2"),
    calc("externalPaintM2", "External Paint", "m2"),
  ]),
  section("fixout", "Fixout", [
    calc("skirtingLm", "Skirting", "lm"),
    calc("architraveLm", "Architraves", "lm"),
    number("internalDoorCount", "Internal Doors", "count"),
    number("wardrobes", "Wardrobes", "count"),
    number("cabinetryLm", "Cabinetry", "lm"),
    number("shelvingLm", "Shelving", "lm"),
  ]),
  section("plumbing", "Plumbing", [
    number("vanities", "Vanities", "count"),
    number("toilets", "Toilets", "count"),
    number("showers", "Showers", "count"),
    number("baths", "Baths", "count"),
    number("tapwareSets", "Tapware Sets", "count"),
    text("hotWaterSystem", "Hot Water System"),
  ]),
  section("electrical", "Electrical", [
    number("powerPoints", "Power Points", "count"),
    number("lights", "Lights", "count"),
    number("downlights", "Downlights", "count"),
    number("fans", "Fans", "count"),
    number("smokeAlarms", "Smoke Alarms", "count"),
    number("dataPoints", "Data Points", "count"),
    number("tvPoints", "TV Points", "count"),
    number("solarKw", "Solar", "kW"),
    number("batteryKwh", "Battery", "kWh"),
    checkbox("evCharger", "EV Charger"),
  ]),
  section("externalWorks", "External Works", [
    number("decksM2", "Decks", "m2"),
    number("patiosM2", "Patios", "m2"),
    number("fencingLm", "Fencing", "lm"),
    number("turfM2", "Turf", "m2"),
    number("gardenBedsM2", "Garden Beds", "m2"),
    checkbox("poolIncluded", "Pool"),
    number("shedM2", "Shed", "m2"),
  ]),
  section("allowances", "Allowances", [
    number("pcItemCount", "PC Items", "count"),
    number("provisionalSumCount", "Provisional Sums", "count"),
    text("clientSelections", "Client Selections"),
    text("supplierAllowances", "Supplier Allowances"),
    text("upgradeOptions", "Upgrade Options"),
  ]),
];

export const V2_REQUIRED_FIELDS = [
  ["projectBasics", "jobName"],
  ["projectBasics", "siteAddress"],
  ["areas", "groundFloorM2"],
];

export const WINDOW_DOOR_COLUMNS = [
  "itemName", "type", "quantity", "height", "width", "area", "totalArea",
  "sillLength", "headLength", "jambLength", "architraveLength", "notes",
];

function section(key, label, rows) { return { key, label, rows }; }
function text(key, label, required = false) { return { key, label, type: "text", required, unit: "" }; }
function number(key, label, unit, required = false) { return { key, label, type: "number", unit, required }; }
function checkbox(key, label) { return { key, label, type: "checkbox", unit: "" }; }
function select(key, label, options, required = false) { return { key, label, type: "select", options, required, unit: "" }; }
function calc(key, label, unit) { return { key, label, type: "calculated", unit, calculated: true }; }
