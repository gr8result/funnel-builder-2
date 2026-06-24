import { INPUT_DATA_SHEET_TEMPLATE } from "./inputDataSheetTemplate.js";

export const V4_PAGES = [
  { key: "dataInput", label: "Data Input Sheet" },
  { key: "formulaSheet", label: "Formula Sheet" },
  { key: "calculatedQuantities", label: "Calculated Quantities" },
  { key: "quotation", label: "Quotation" },
  { key: "summary", label: "Summary" },
];

export const V4_DATA_SECTIONS = [
  section("inputDataSheet", "Data Input Sheet", INPUT_DATA_SHEET_TEMPLATE.rows.map(templateRow)),
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

function section(key, label, rows) { return { key, label, rows }; }
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
