import { V3_DATA_SECTIONS, V3_QUOTATION_SECTIONS } from "./estimateWorksheetV3Schema.js";

export function createEstimateWorksheetV3Defaults(plannerAnswers = {}) {
  const sections = {};
  V3_DATA_SECTIONS.forEach((section) => {
    sections[section.key] = {
      collapsed: section.key !== "externalWalls",
      rows: Object.fromEntries(section.rows.map((row) => [row.key, {
        inputValue: defaultValue(row.key, plannerAnswers),
        builderOverrideQuantity: "",
        notes: "",
      }])),
    };
  });

  return {
    page: "dataInput",
    activeSection: "externalWalls",
    sections,
    windowsDoors: [
      opening("W01", "Fixed Window", 4, 1.5, 1.2),
      opening("W02", "Sliding Window", 2, 2.1, 1.8),
      opening("D01", "Sliding Door", 1, 2.4, 2.1),
      opening("ED01", "Entry Door", 1, 0.92, 2.04),
    ],
    quotation: Object.fromEntries(V3_QUOTATION_SECTIONS.map((section) => [section, {
      collapsed: false,
      rows: defaultQuotationRows(section),
    }])),
  };
}

function opening(code, type, quantity, width, height) {
  return { id: `${code}-${Date.now()}-${Math.random()}`, code, type, quantity, width, height, notes: "" };
}

function defaultValue(key, answers) {
  const map = {
    lowerExternalWallsLm: 64,
    upperExternalWallsLm: answers.projectType === "Double Storey Home" ? 54 : 0,
    lowerInternalWallsLm: 110,
    upperInternalWallsLm: answers.projectType === "Double Storey Home" ? 90 : 0,
    lowerCeilingHeight: 2.7,
    upperCeilingHeight: answers.projectType === "Double Storey Home" ? 2.55 : 0,
    lowerWallSystem: answers.groundExternalWall || answers.wallConstruction || "Brick Veneer",
    upperWallSystem: answers.firstExternalWall || "Lightweight Cladding",
    lowerFloorAreaM2: 220,
    upperFloorAreaM2: answers.projectType === "Double Storey Home" ? 140 : 0,
    garageAreaM2: 36,
    alfrescoAreaM2: 24,
    porchAreaM2: 6,
    balconyAreaM2: answers.additionalFeatures?.includes("Balconies") ? 14 : 0,
    slabType: answers.slabType || "Waffle Pod",
    concreteM3: 33.6,
    roofPlanAreaM2: 230,
    roofPitchDegrees: 22.5,
    roofType: answers.roofType || "Colorbond",
    internalDoors: 14,
    cabinetryLm: 10,
    vanities: 2,
    toilets: 2,
    showers: 2,
    baths: 1,
    powerPoints: 44,
    downlights: 44,
    fans: 4,
    siteSlope: answers.siteConditions || "Flat Site",
    accessDifficulty: answers.siteAccess || "Easy",
    cutFillM3: 12,
    retainingWallLm: answers.retainingWalls && answers.retainingWalls !== "None" ? 18 : 0,
    drivewayM2: 50,
    pathsM2: 20,
    decksM2: 0,
    fencingLm: 0,
    pcItems: 8,
    provisionalSums: 3,
  };
  return map[key] ?? "";
}

function defaultQuotationRows(section) {
  const templates = {
    Siteworks: [["Site establishment", "ITEM"], ["Cut/fill earthworks", "M3"], ["Drainage", "LM"]],
    Slab: [["Concrete slab", "M2"], ["Concrete supply", "M3"], ["Reinforcement", "M2"]],
    "Frame Stage Labour": [["Frame labour", "M2"], ["Structural steel install", "ITEM"]],
    "Lock-up Stage Labour": [["Line eaves", "LM"], ["Install wall insulation", "M2"], ["Install cladding", "M2"]],
    "Fix-out Stage Labour": [["Internal doors", "EACH"], ["Skirting", "LM"], ["Architraves", "LM"]],
    "External Cladding": [["Brickwork", "M2"], ["Upper cladding", "M2"], ["Render", "M2"]],
    Roofing: [["Roofing", "M2"], ["Gutters/fascia", "LM"], ["Downpipes", "EACH"]],
    "Windows & Doors": [["Windows and doors", "M2"], ["Reveals", "LM"], ["Sills", "LM"]],
    Linings: [["Plasterboard walls", "M2"], ["Ceilings", "M2"], ["Cornice", "LM"]],
    Plumbing: [["Plumbing fixtures", "EACH"], ["Hot water", "ITEM"]],
    Electrical: [["Power/light points", "EACH"], ["Fans", "EACH"], ["Smoke alarms", "EACH"]],
    "Kitchen & Appliances": [["Cabinetry", "LM"], ["Appliances", "ITEM"]],
    Bathrooms: [["Wet area fixtures", "EACH"], ["Waterproofing", "M2"]],
    "Flooring & Tiling": [["Floor finishes", "M2"], ["Wall tiles", "M2"]],
    Painting: [["Internal paint", "M2"], ["External paint", "M2"]],
    "External Works": [["Driveway", "M2"], ["Fencing", "LM"], ["Decks", "M2"]],
    "Allowances / PC / PS Items": [["PC items", "ITEM"], ["Provisional sums", "ITEM"]],
  };
  return (templates[section] || [["Allowance item", "ITEM"]]).map(([item, unit], index) => ({
    id: `${section}-${index}`,
    item,
    quantityKey: "",
    quantity: "",
    unit,
    rate: "",
    cost: "",
    notes: "",
  }));
}
