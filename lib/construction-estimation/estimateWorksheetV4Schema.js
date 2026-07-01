import { INPUT_DATA_SHEET_TEMPLATE } from "./inputDataSheetTemplate.js";

export const V4_PAGES = [
  { key: "dataInput", label: "Data Input Sheet" },
  { key: "formulaSheet", label: "Formula Sheet" },
  { key: "calculatedQuantities", label: "Calculated Quantities" },
  { key: "quotation", label: "Quotation" },
  { key: "summary", label: "Summary" },
];

export const SUBCONTRACTOR_QUOTE_CONTRACTORS = [
  "Concreter",
  "Plumber",
  "Electrician",
  "Steel Fabricator",
  "Frame & Truss",
  "Bricklayer",
  "Roofer",
  "Plasterer",
  "Carpenter",
  "Cabinet Maker",
  "Waterproofer",
  "Tiler",
  "Painter",
  "Flooring Installer",
  "Air Conditioning",
  "Landscaper",
  "Driveways",
  "Fencing",
  "Pool Builder",
  "Other Contractor",
];

export const SUBCONTRACTOR_QUOTE_DEDUCTIONS = {
  plumber: [
    { key: "underslabDrainage", label: "Underslab & Drainage", sourceRow: 30075 },
    { key: "roughIn", label: "Rough In", sourceRow: 30078 },
    { key: "hotWater", label: "Hot Water" },
    { key: "waterReticulation", label: "Water Reticulation" },
    { key: "sewer", label: "Sewer" },
  ],
  electrician: [
    { key: "temporaryPower", label: "Temporary Power" },
    { key: "roughIn", label: "Rough In", sourceRow: 30079 },
  ],
  painter: [
    { key: "renderPainting", label: "Render Painting" },
    { key: "externalPainting", label: "External Painting" },
  ],
  cabinetMaker: [
    { key: "wardrobes", label: "Wardrobes" },
  ],
};

export const V4_DATA_SECTIONS = [
  section("inputDataSheet", "Data Input Sheet", INPUT_DATA_SHEET_TEMPLATE.rows.map(templateRow)),
  section("subcontractorQuotes", "SUBCONTRACTOR QUOTES", SUBCONTRACTOR_QUOTE_CONTRACTORS.map(subcontractorRow), { type: "subcontractorQuotes" }),
];

export const V4_WINDOW_TYPES = [
  "Workbook item",
  "Fixed Window", "Sliding Window", "Awning Window", "Double Hung Window", "Casement Window", "Louvre Window",
  "Sliding Door", "Stacker Door", "Entry Door", "Internal Door",
  "Garage Door", "Cavity Slider",
];

export const V4_QUOTE_SECTIONS = [
  "Siteworks", "Slab", "Frame Stage Labour", "Lock-up Stage Labour",
  "Fix-out Stage Labour", "External Cladding", "Roofing", "Windows & Doors",
  "Linings", "Plumbing", "Electrical", "Kitchen & Appliances", "Bathrooms",
  "Flooring & Tiling", "Painting", "External Works", "PC Items", "Provisional Sums",
];

export const V4_REQUIRED_FIELDS = [
  ["walls", "lowerExternalWallsLm"],
  ["walls", "lowerInternalWallsLm"],
  ["walls", "lowerCeilingHeight"],
  ["areas", "lowerFloorAreaM2"],
];

function section(key, label, rows, extra = {}) { return { key, label, rows, ...extra }; }
function subcontractorRow(label) {
  return {
    key: subcontractorKey(label),
    label,
    sectionLabel: "SUBCONTRACTOR QUOTES",
    unit: "",
    defaultValue: "",
    userNote: "",
    calculated: false,
    subcontractorQuote: true,
  };
}
function subcontractorKey(label) {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    || "contractor";
}
function templateRow(row) {
  return {
    key: row.key,
    label: row.label,
    sectionLabel: row.section,
    unit: row.unit || "",
    options: row.options || null,
    heading: row.heading,
    subheading: Boolean(row.subheading),
    sourceRow: row.sourceRow,
    userNote: row.userNote || "",
    defaultValue: row.value ?? "",
    defaultFormula: row.formula || "",
    required: ["projectName", "projectAddress", "lowerFloorAreaM2", "lowerExternalWallsLm", "lowerInternalWallsLm", "lowerCeilingHeight"].includes(row.key),
    calculated: Boolean(row.calculated),
  };
}
