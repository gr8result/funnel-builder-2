import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ClipboardList, Upload } from "lucide-react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import {
  ALL_GUIDED_REQUIREMENTS,
  EXTERIOR_REQUIREMENTS,
  INTERIOR_REQUIREMENTS,
  KITCHEN_REQUIREMENTS,
  PRICE_STATES,
  areaTotals as guidedAreaTotals,
  guidedRequirementByKey,
  kitchenRequirementByKey,
  nextIncompleteRequirement,
  priceStateForProduct,
  productAllowance,
  productClientPrice,
  productsForRequirement,
  projectTotals as guidedProjectTotals,
  classifyApprovedSelectionRow,
  requirementImage,
  resolveSelectionImage,
  statusForRequirement,
  statusTone,
  variationFor,
} from "../../../lib/builders/clientSelectionWorkflow";
import { DEFAULT_BUILDER_TEMPLATE_BRAND } from "../../../lib/builders/defaultTemplateBrand";
import { supabase } from "../../../utils/supabase-client";
import {
  APPROVED_SELECTIONS_CSV_PATH,
  GENERIC_IMAGE_URLS,
  activeQldBrickMasterProducts,
  commitMasterProductImport,
  masterProductToClientSelectionProduct,
  parseMasterProductCatalogueImport,
  previewMasterProductImport,
  queryClientSelectableProducts,
} from "../../../lib/product-library/catalogueModel";
import {
  addBuilderProduct,
  disableProduct,
  enableProduct,
  getBuilderEnablementRefs,
  getMasterProducts,
  updateBuilderProductOverride,
} from "../../../lib/product-library/catalogueService";

const STATUS_OPTIONS = ["pending", "selected", "approved", "ordered"];
const EMBEDDED_SELECTIONS_BOOK_STORAGE_KEY = "gr8:embedded-selections-book";

const DEFAULT_ROOMS = [
  "External Walls",
  "Roof",
  "Windows",
  "Garage",
  "Kitchen",
  "Laundry",
  "Main Bathroom",
  "Ensuite",
  "Powder Room",
  "Bedroom 1",
  "Bedroom 2",
  "Bedroom 3",
  "Living",
  "Electrical",
  "Lighting",
  "Flooring",
  "Paint",
  "External",
];

const ROOM_TEMPLATES = {
  "External Walls": ["Brickwork", "External Cladding", "Wall Wrap", "External Feature Cladding", "External Paint"],
  External: ["External Colours", "Driveway Finish", "Pathways", "Letterbox", "Clothesline"],
  "Powder Room": ["Vanity", "Basin", "Tap", "Mirror", "Toilet", "Toilet Roll Holder", "Exhaust Fan", "Light", "Paint", "Floor Tile", "Wall Tile", "Skirting", "Door", "Door Handle"],
  "Main Bathroom": ["Vanity", "Basin", "Tap", "Mirror", "Toilet", "Toilet Roll Holder", "Shower Screen", "Shower Mixer", "Shower Outlet", "Bath", "Exhaust Fan", "Light", "Paint", "Floor Tile", "Wall Tile", "Skirting", "Door", "Door Handle"],
  Ensuite: ["Vanity", "Basin", "Tap", "Mirror", "Toilet", "Toilet Roll Holder", "Shower Screen", "Shower Mixer", "Shower Outlet", "Exhaust Fan", "Light", "Paint", "Floor Tile", "Wall Tile", "Skirting", "Door", "Door Handle"],
  Kitchen: ["Oven", "Cooktop", "Rangehood", "Dishwasher", "Microwave", "Sink", "Kitchen Tap", "Benchtop", "Splashback", "Cabinet Doors", "Cabinet Handles", "Pantry", "Lighting", "Flooring", "Paint"],
  Laundry: ["Laundry Tub", "Laundry Tap", "Benchtop", "Cabinet Doors", "Cabinet Handles", "Washing Machine Taps", "Floor Tile", "Wall Tile", "Paint", "Door", "Door Handle"],
  "Butler Pantry": ["Sink", "Tap", "Benchtop", "Splashback", "Cabinet Doors", "Cabinet Handles", "Shelving", "Lighting", "Flooring", "Paint"],
  "Outdoor Kitchen": ["BBQ", "Outdoor Sink", "Outdoor Tap", "Benchtop", "Cabinetry", "Splashback", "Lighting", "Flooring"],
  Roof: ["Roofing", "Gutters", "Fascia", "Downpipes", "Roof Insulation", "External Paint"],
  Windows: ["Windows", "Sliding Doors", "Entry Door", "Door Hardware", "Fly Screens"],
  Garage: ["Garage Door", "Garage Motor", "External Paint", "Driveway Finish"],
  "Bedroom 1": ["Carpet", "Wall Paint", "Wardrobe Doors", "Door", "Door Handle", "Lighting", "Power Points"],
  "Bedroom 2": ["Carpet", "Wall Paint", "Wardrobe Doors", "Door", "Door Handle", "Lighting", "Power Points"],
  "Bedroom 3": ["Carpet", "Wall Paint", "Wardrobe Doors", "Door", "Door Handle", "Lighting", "Power Points"],
  Living: ["Flooring", "Wall Paint", "Feature Paint", "Lighting", "Power Points", "Data Points", "Ceiling Fan"],
  Electrical: ["Switches", "Power Points", "Data Points", "Smoke Alarms", "Ceiling Fans", "Exhaust Fans"],
  Lighting: ["Downlights", "Pendant Lights", "Exterior Lights", "Feature Lights"],
  Flooring: ["Carpet", "Floor Tile", "Timber / Hybrid Flooring", "Skirting"],
  Paint: ["Wall Paint", "Ceiling Paint", "Trim Paint", "Feature Paint"],
};

const PRODUCT_IMAGE_URLS = {
  "site clearance": "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=700&q=80",
  "bulk earthworks": "https://images.unsplash.com/photo-1581094288338-2314dddb7ece?auto=format&fit=crop&w=700&q=80",
  "timber retaining wall": "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=700&q=80",
  "block retaining wall": "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=700&q=80",
  "temporary fencing": "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=700&q=80",
  "construction access": "https://images.unsplash.com/photo-1590496793929-36417d3117de?auto=format&fit=crop&w=700&q=80",
  "westinghouse 600mm oven": "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=700&q=80",
  "bosch serie 6 oven": "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=700&q=80",
  "westinghouse 600mm gas cooktop": "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=700&q=80",
  "bosch 600mm gas cooktop": "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=700&q=80",
  "westinghouse slideout rangehood": "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=700&q=80",
  "westinghouse dishwasher": "https://images.unsplash.com/photo-1626806819282-2c1dc01a5e0c?auto=format&fit=crop&w=700&q=80",
  "oliveri diaz sink": "https://images.unsplash.com/photo-1604709177225-055f99402ea3?auto=format&fit=crop&w=700&q=80",
  "phoenix vivid sink mixer": "https://images.unsplash.com/photo-1584622781564-1d987f7333c1?auto=format&fit=crop&w=700&q=80",
  "timberline wall hung vanity": "https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=700&q=80",
  "caroma cube basin": "https://images.unsplash.com/photo-1604709177225-055f99402ea3?auto=format&fit=crop&w=700&q=80",
  "caroma luna toilet": "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=700&q=80",
  "ceramic floor tile": "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=700&q=80",
  "ceramic wall tile": "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=700&q=80",
};

const PRODUCT_OPTION_LIBRARY = {
  "site clearance": [
    productOption("ABC Earthworks", "Site Clearance", "Standard vegetation removal", "Natural site finish", "ABC Earthworks", "Cleared building envelope, rubbish and debris removed from site.", 0, 0, "mid_range", "#6b7f3b"),
    productOption("ABC Earthworks", "Extended Site Clearance", "Heavy vegetation allowance", "Prepared pad", "ABC Earthworks", "Additional clearing allowance for heavier vegetation or difficult access.", 1200, 1200, "higher_end", "#4d6b37"),
  ],
  "bulk earthworks": [
    productOption("ABC Earthworks", "Bulk Earthworks", "Standard cut/fill allowance", "Compacted pad", "ABC Earthworks", "Cut and fill to achieve building platform as per engineering drawings.", 12500, 12500, "mid_range", "#c49354"),
    productOption("ABC Earthworks", "Detailed Earthworks", "Extended machine time", "Compacted pad", "ABC Earthworks", "Expanded allowance for complex site levels and additional machine time.", 18500, 18500, "higher_end", "#a97838"),
  ],
  "retaining walls": [
    productOption("Landscape Supply", "Timber Retaining Wall", "Treated pine up to 1.2m", "Natural", "Landscape Supply", "Timber retaining wall allowance where required by site levels.", 4800, 4800, "mid_range", "#8b6f4e"),
    productOption("Adbri Masonry", "Block Retaining Wall", "Concrete masonry", "Charcoal", "Landscape Supply", "Concrete masonry retaining wall allowance for upgraded finish.", 4800, 7200, "higher_end", "#77736b"),
  ],
  "temporary fencing & security": [
    productOption("SecureSite", "Temporary Fencing", "Construction fencing", "Galvanised", "SecureSite", "Temporary construction fencing for the duration of the build.", 1200, 1200, "mid_range", "#b7bec8"),
  ],
  "construction access": [
    productOption("ABC Earthworks", "Construction Access", "Gravel access point", "Compacted gravel", "ABC Earthworks", "Construction access point and site entry protection.", 900, 900, "mid_range", "#9a9487"),
  ],
  roofing: [],
  gutters: [
  ],
  oven: [
    productOption("Westinghouse", "Westinghouse 600mm Oven", "WVE6515SD", "Stainless steel", "Harvey Norman Commercial", "Westinghouse 600mm built-in electric oven.", 1200, 1200, "mid_range", "#d9dde1"),
    productOption("Bosch", "Bosch Serie 6 Oven", "HBA534BS0A", "Stainless steel", "Harvey Norman Commercial", "Bosch Serie 6 built-in oven with premium controls.", 1200, 1780, "higher_end", "#c8cdd2"),
    productOption("Smeg", "Smeg Classic Oven", "SFA6301TVX", "Stainless steel", "Harvey Norman Commercial", "Smeg classic built-in oven.", 1200, 2380, "luxury", "#b9bec4"),
  ],
  cooktop: [
    productOption("Westinghouse", "Westinghouse 600mm Gas Cooktop", "WHG644SC", "Stainless steel", "Harvey Norman Commercial", "Westinghouse 600mm stainless gas cooktop.", 850, 850, "mid_range", "#d5d9dd"),
    productOption("Bosch", "Bosch 600mm Gas Cooktop", "PCR6A5B90A", "Stainless steel", "Harvey Norman Commercial", "Bosch 600mm gas cooktop.", 850, 1270, "higher_end", "#c5cbd1"),
    productOption("Smeg", "Smeg 750mm Gas Cooktop", "PGA75", "Stainless steel", "Harvey Norman Commercial", "Smeg 750mm gas cooktop.", 850, 2030, "luxury", "#b4bbc2"),
  ],
  rangehood: [
    productOption("Westinghouse", "Westinghouse Slideout Rangehood", "WRR604SB", "Stainless steel", "Harvey Norman Commercial", "Westinghouse 600mm slideout rangehood.", 520, 520, "mid_range", "#d8dde2"),
    productOption("Bosch", "Bosch Canopy Rangehood", "DWP66BC50A", "Stainless steel", "Harvey Norman Commercial", "Bosch 600mm canopy rangehood.", 520, 980, "higher_end", "#c6ccd1"),
  ],
  dishwasher: [
    productOption("Westinghouse", "Westinghouse Dishwasher", "WSF6606XA", "Stainless steel", "Harvey Norman Commercial", "Westinghouse freestanding dishwasher.", 850, 850, "mid_range", "#d7dce1"),
    productOption("Bosch", "Bosch Serie 4 Dishwasher", "SMS4HTI01A", "Stainless steel", "Harvey Norman Commercial", "Bosch Serie 4 dishwasher.", 850, 1320, "higher_end", "#c4cbd2"),
  ],
  microwave: [
    productOption("Westinghouse", "Westinghouse Microwave", "WMF2302WA", "White", "Harvey Norman Commercial", "Westinghouse microwave allowance.", 280, 280, "mid_range", "#eceff2"),
    productOption("Bosch", "Bosch Built-in Microwave", "BFL523MS0A", "Stainless steel", "Harvey Norman Commercial", "Bosch built-in microwave.", 280, 890, "higher_end", "#cbd1d7"),
  ],
  sink: [
    productOption("Oliveri", "Oliveri Diaz Sink", "DZ153", "Stainless steel", "Reece", "Oliveri Diaz stainless steel inset sink.", 480, 480, "mid_range", "#c8c6bf"),
    productOption("Franke", "Franke Mythos Sink", "MYX210-50", "Stainless steel", "Reece", "Franke undermount stainless sink.", 480, 1120, "higher_end", "#b7b7b2"),
  ],
  "kitchen tap": [
    productOption("Phoenix", "Phoenix Vivid Sink Mixer", "VS733", "Chrome", "Reece", "Phoenix Vivid kitchen sink mixer.", 420, 420, "mid_range", "#c9cfd4"),
    productOption("Caroma", "Caroma Urbane II Sink Mixer", "99616C", "Brushed nickel", "Reece", "Caroma premium kitchen mixer.", 420, 760, "higher_end", "#b3b8bd"),
  ],
  vanity: [
    productOption("Timberline", "Timberline Wall Hung Vanity", "Silk 1200", "Polyurethane white", "Reece", "Wall hung vanity with soft close drawers.", 1320, 1320, "mid_range", "#e5e0d7"),
    productOption("Timberline", "Timberline Premium Vanity", "Aria 1200", "Prime oak", "Reece", "Premium wall hung vanity with stone top allowance.", 1320, 2450, "higher_end", "#d4c4aa"),
  ],
  basin: [
    productOption("Caroma", "Caroma Cube Basin", "Cube Above Counter", "White", "Reece", "Caroma ceramic above counter basin.", 350, 350, "mid_range", "#f4f1eb"),
    productOption("Caroma", "Caroma Luna Basin", "Luna Inset", "White", "Reece", "Caroma premium inset basin.", 350, 620, "higher_end", "#eee9e1"),
  ],
  tap: [
    productOption("Phoenix", "Phoenix Vivid Basin Mixer", "Vivid Slimline", "Chrome", "Reece", "Phoenix Vivid basin mixer.", 290, 290, "mid_range", "#ccd2d8"),
    productOption("Caroma", "Caroma Urbane II Mixer", "Urbane II", "Brushed nickel", "Reece", "Premium basin mixer.", 290, 580, "higher_end", "#b3b8bd"),
  ],
  toilet: [
    productOption("Caroma", "Caroma Luna Toilet Suite", "Luna Cleanflush", "White", "Reece", "Caroma Luna back to wall toilet suite.", 620, 620, "mid_range", "#f0eee8"),
    productOption("Caroma", "Caroma Urbane II Toilet", "Urbane II Cleanflush", "White", "Reece", "Premium back to wall toilet suite.", 620, 980, "higher_end", "#ebe8e0"),
  ],
  "floor tile": [
    productOption("National Tiles", "Ceramic Floor Tile", "Manhattan 600x600", "Light grey", "National Tiles", "Ceramic floor tile 600 x 600mm.", 45, 45, "mid_range", "#d8d2c8"),
    productOption("National Tiles", "Porcelain Floor Tile", "Stoneform 600x600", "Warm grey", "National Tiles", "Premium porcelain floor tile.", 45, 82, "higher_end", "#c7beb3"),
  ],
  "wall tile": [
    productOption("National Tiles", "Ceramic Wall Tile", "White Gloss Rectified", "White gloss", "National Tiles", "Ceramic wall tile 300 x 600mm.", 35, 35, "mid_range", "#f4f2ee"),
    productOption("National Tiles", "Feature Wall Tile", "Travertine Look", "Ivory", "National Tiles", "Feature wall tile allowance.", 35, 76, "higher_end", "#dfd1bd"),
  ],
  carpet: [
    productOption("Godfrey Hirst", "Godfrey Hirst Carpet", "Apollo", "Grey", "Flooring Supplier", "Mid range carpet allowance.", 0, 0, "mid_range", "#a7a9a6"),
    productOption("Godfrey Hirst", "Godfrey Hirst Premium Carpet", "Wool Blend", "Warm grey", "Flooring Supplier", "Premium carpet allowance.", 0, 1800, "higher_end", "#8f918c"),
  ],
  "wall paint": [
    productOption("Dulux", "Dulux Wash & Wear", "Low Sheen", "Natural White", "Dulux", "Dulux interior wall paint.", 0, 0, "mid_range", "#f3efe7"),
    productOption("Dulux", "Dulux Premium Interior", "Wash & Wear Plus", "Natural White", "Dulux", "Premium Dulux interior paint system.", 0, 650, "higher_end", "#eee7dc"),
  ],
};

const TEMPLATE_ROOM_MATCH = {
  roofing: "Roof",
  gutters: "Roof",
  fascia: "Roof",
  downpipes: "Roof",
  windows: "Windows",
  garage_doors: "Garage",
  insulation: "Roof",
  paint: "Paint",
  appliances: "Kitchen",
  tapware: "Main Bathroom",
  toilets: "Main Bathroom",
  vanities: "Main Bathroom",
  flooring: "Flooring",
  tiles: "Main Bathroom",
};

const COVER_BRAND_FALLBACK = {
  builderName: "Builder",
  tagline: "Luxury selections schedule",
  footerText: "",
};

const GUIDED_AREA_CARDS = [
  {
    key: "exterior",
    label: "Exterior",
    description: "External envelope, street-facing finishes and outdoor selections.",
    image: GENERIC_IMAGE_URLS.exterior,
  },
  {
    key: "interior",
    label: "Interior",
    description: "Kitchen, wet areas, bedrooms, living finishes and fixtures.",
    image: GENERIC_IMAGE_URLS.interior,
  },
];

const EXTERIOR_CATEGORY_CARDS = EXTERIOR_REQUIREMENTS.map((requirement) => ({
  key: requirement.requirementKey,
  label: requirement.label,
  image: requirementImage(requirement),
  requirementKey: requirement.requirementKey,
}));

const INTERIOR_CATEGORY_CARDS = [
  ["kitchen", "Kitchen", GENERIC_IMAGE_URLS.kitchen],
  ["bathroom", "Bathroom", GENERIC_IMAGE_URLS.bathroom],
  ["ensuite", "Ensuite", GENERIC_IMAGE_URLS.bathroom],
  ["laundry", "Laundry", GENERIC_IMAGE_URLS.laundry],
  ["bedrooms", "Bedrooms", GENERIC_IMAGE_URLS.bedrooms],
  ["living", "Living", GENERIC_IMAGE_URLS.living],
  ["garage-interior", "Garage Interior", GENERIC_IMAGE_URLS.garage],
  ["internal-doors", "Internal Doors", GENERIC_IMAGE_URLS.internalDoors, "internal-doors"],
].map(([key, label, image, requirementKey]) => ({ key, label, image, requirementKey }));

const REQUIREMENT_OPTION_KEY = {
  cabinetry: "cabinet doors",
  "cabinet-finish": "cabinet doors",
  handles: "cabinet handles",
  benchtop: "benchtop",
  splashback: "splashback",
  sink: "sink",
  "sink-mixer": "kitchen tap",
  oven: "oven",
  cooktop: "cooktop",
  rangehood: "rangehood",
  dishwasher: "dishwasher",
  microwave: "microwave",
  flooring: "flooring",
  lighting: "lighting",
  paint: "wall paint",
};

function today() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function money(value) {
  return Number(value || 0).toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
}

function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function text(value, fallback = "") {
  const next = value === null || value === undefined ? "" : String(value);
  return next.trim() || fallback;
}

function numberValue(value) {
  const numeric = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function clamp(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function titleCase(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normaliseKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function firstText(...values) {
  for (const value of values) {
    const next = text(value);
    if (next && !/^n\/?a$/i.test(next) && next !== "0") return next;
  }
  return "";
}

function getPathValue(source, path) {
  if (!source || !path) return "";
  return String(path).split(".").reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), source);
}

function collectWorkbookFields(source, fields = []) {
  if (!source || typeof source !== "object") return fields;
  if (Array.isArray(source)) {
    source.forEach((item) => collectWorkbookFields(item, fields));
    return fields;
  }

  const key = source.key || source.id || source.field || source.name;
  const label = source.label || source.title || source.item || source.description || source.name || source.key;
  const value = source.value ?? source.currentValue ?? source.inputValue ?? source.answer ?? source.text ?? source.defaultValue;
  if ((key || label) && value !== undefined && value !== null && typeof value !== "object") {
    fields.push({ key: normaliseKey(key), label: normaliseKey(label), rawLabel: label, value });
  }

  Object.entries(source).forEach(([entryKey, entryValue]) => {
    if (entryValue && typeof entryValue === "object") {
      collectWorkbookFields(entryValue, fields);
    } else if (entryValue !== undefined && entryValue !== null && typeof entryValue !== "object") {
      fields.push({ key: normaliseKey(entryKey), label: normaliseKey(entryKey), rawLabel: entryKey, value: entryValue });
    }
  });
  return fields;
}

function fieldByNames(fields, names = []) {
  const keys = names.map(normaliseKey);
  const exact = fields.find((field) => keys.includes(field.key) || keys.includes(field.label));
  if (exact) return text(exact.value);
  const partial = fields.find((field) => keys.some((key) => key && (field.key.includes(key) || field.label.includes(key))));
  return text(partial?.value);
}

function splitAddressParts(address = "") {
  const parts = String(address || "").split(",").map((part) => part.trim()).filter(Boolean);
  const tail = parts.slice(1).join(" ");
  const fallback = parts[parts.length - 1] || "";
  const stateSource = tail || fallback;
  const postcodeMatch = stateSource.match(/\b(\d{4})\b/);
  const stateMatch = stateSource.match(/\b(NSW|QLD|VIC|SA|WA|TAS|NT|ACT)\b/i);
  const suburb = parts.length >= 2
    ? parts[1].replace(/\b(NSW|QLD|VIC|SA|WA|TAS|NT|ACT)\b/ig, "").replace(/\b\d{4}\b/g, "").trim()
    : fallback.replace(/\b(NSW|QLD|VIC|SA|WA|TAS|NT|ACT)\b/ig, "").replace(/\b\d{4}\b/g, "").trim();
  return {
    line1: parts[0] || address,
    suburb,
    state: stateMatch?.[1]?.toUpperCase() || "",
    postcode: postcodeMatch?.[1] || "",
  };
}

function isDateLikeValue(value) {
  const next = String(value || "").trim();
  return /^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?$/.test(next) || /^\d{4}-\d{2}-\d{2}$/.test(next);
}

function workbookRowValue(workbook, key) {
  const sections = [
    workbook?.data?.inputDataSheet,
    workbook?.data?.project,
    workbook?.data?.projectDetails,
    workbook?.data?.jobDetails,
  ];
  for (const section of sections) {
    const value = section?.rows?.[key]?.value;
    if (text(value)) return text(value);
  }
  for (const section of Object.values(workbook?.data || {})) {
    const value = section?.rows?.[key]?.value;
    if (text(value)) return text(value);
  }
  return "";
}

function coverValue(value, invalidValues = []) {
  const next = text(value);
  if (!next) return "";
  const normalised = normaliseKey(next);
  if (invalidValues.map(normaliseKey).filter(Boolean).includes(normalised)) return "";
  if (/^(client name|site address|quote number|job number|project name)$/i.test(next)) return "";
  if (normalised === "2astreetsomplaceqld4557") return "";
  if (normalised.includes("assetsbuildersgoodbuildlogosvg")) return "";
  return next;
}

function coverBuilderName(value) {
  const next = coverValue(value);
  if (!next) return "";
  return next;
}

function missingCoverField(fieldName) {
  return "";
}

function coverDisplayValue(value, fieldName, invalidValues = []) {
  return coverValue(value, invalidValues) || missingCoverField(fieldName);
}

function coverBuilderDisplayName(value) {
  return coverBuilderName(value) || missingCoverField("builderName");
}

function coverTitleDisplay(value) {
  const next = coverValue(value);
  if (!next || normaliseKey(next) === "inclusionsselections") return "Inclusions & Selections Schedule";
  return next;
}

function getSelectionsBookProjectDetails(project = null, snapshot = null, quote = null, builderProfileOverride = null) {
  const workbook = snapshot?.workbook_snapshot || snapshot?.workbook_metadata?.workbook || snapshot?.workbook || {};
  const metadata = snapshot?.workbook_metadata || {};
  const projectMetadata = project?.metadata || project?.project_metadata || project?.profile || project?.project_profile || {};
  const builderProfile = builderProfileOverride || project?.builder_profile || project?.builderStandard || project?.builder_standard || metadata.builderProfile || metadata.builder_profile || {};
  const fields = collectWorkbookFields({ project, projectMetadata, builderProfile, workbook, metadata, snapshot });
  const projectName = firstText(
    workbookRowValue(workbook, "projectName"),
    fieldByNames(fields, ["projectName", "project name", "job name"]),
    metadata.projectName,
    project?.project_name,
    project?.name
  );
  const clientName = coverValue(firstText(
    workbookRowValue(workbook, "clientName"),
    fieldByNames(fields, ["clientName", "client name", "ownerName", "owner name", "customerName", "customer name", "prepared for"]),
    metadata.clientName,
    metadata.ownerName,
    project?.client_name,
    project?.client
  ), [projectName]);
  const siteAddress = firstText(
    getPathValue(workbook, "data.inputDataSheet.rows.projectAddress.value"),
    getPathValue(workbook, "data.projectDetails.rows.projectAddress.value"),
    getPathValue(workbook, "jobFileMeta.address"),
    workbookRowValue(workbook, "projectAddress"),
    workbookRowValue(workbook, "siteAddress"),
    workbookRowValue(workbook, "address"),
    fieldByNames(fields, ["siteAddress", "site address", "projectAddress", "project address", "address", "job address"]),
    metadata.projectAddress,
    metadata.siteAddress,
    project?.site_address,
    project?.job_address,
    project?.address
  );
  const parsedAddress = splitAddressParts(siteAddress);
  const suburb = firstText(fieldByNames(fields, ["suburb", "city", "town", "site suburb", "project suburb"]), metadata.suburb, parsedAddress.suburb);
  const state = firstText(fieldByNames(fields, ["state", "site state", "project state"]), metadata.state, parsedAddress.state);
  const postcode = firstText(fieldByNames(fields, ["postcode", "post code", "zip", "site postcode"]), metadata.postcode, parsedAddress.postcode);
  const siteAddressLine1 = firstText(fieldByNames(fields, ["address line 1", "site address line 1", "street address"]), metadata.siteAddressLine1, parsedAddress.line1, siteAddress);
  const jobNumberCandidates = [
    workbookRowValue(workbook, "jobNumber"),
    fieldByNames(fields, ["jobNumber", "job number"]),
    metadata.jobNumber,
    metadata.job_number,
    project?.job_number,
    project?.jobNumber,
    project?.source_workbook_job_id,
  ].filter((value) => text(value) && !isDateLikeValue(value));
  const jobNumber = firstText(...jobNumberCandidates);
  const quoteNumberCandidates = [
    fieldByNames(fields, ["quoteNumber", "quote number", "quotation number", "estimate number"]),
    workbookRowValue(workbook, "quoteNumber"),
    quote?.quoteNumber,
    metadata.quoteNumber,
    metadata.quote_number,
    snapshot?.source_quote_number,
    jobNumber,
  ].filter((value) => text(value) && !isDateLikeValue(value));
  const quoteNumber = firstText(...quoteNumberCandidates);
  const quoteDate = firstText(
    fieldByNames(fields, ["quoteDate", "quote date", "quotation date", "estimate date", "issue date"]),
    snapshot?.source_quote_date,
    metadata.quoteDate,
    metadata.issueDate,
    today()
  );
  const builderName = coverBuilderName(firstText(
    workbookRowValue(workbook, "builderName"),
    fieldByNames(fields, ["builderName", "builder name", "companyName", "company name", "businessName", "business name"]),
    metadata.builderName,
    metadata.companyName,
    projectMetadata.builderName,
    projectMetadata.companyName,
    builderProfile.builderName,
    builderProfile.companyName,
    project?.builder_name,
    project?.company_name
  ));
  const builderLogo = firstText(
    workbookRowValue(workbook, "builderLogo"),
    workbookRowValue(workbook, "logoUrl"),
    fieldByNames(fields, ["builderLogo", "builder logo", "logoUrl", "logo url", "companyLogo", "company logo", "businessLogo", "business logo"]),
    metadata.builderLogo,
    metadata.logoUrl,
    projectMetadata.builderLogo,
    projectMetadata.logoUrl,
    builderProfile.builderLogo,
    builderProfile.logoUrl,
    project?.builder_logo_url,
    project?.logo_url
  );
  const selectionStandard = firstText(
    fieldByNames(fields, ["selectionStandard", "selection standard", "builderStandard", "builder standard", "specificationName", "specification name", "selection level", "quality level"]),
    metadata.selectionStandard,
    metadata.builderStandard,
    metadata.specificationName,
    snapshot?.snapshot_label
  );
  const footerText = firstText(
    metadata.footerText,
    projectMetadata.footerText,
    builderProfile.footerText,
    [builderName, builderProfile.phone || projectMetadata.phone || metadata.phone, builderProfile.email || projectMetadata.email || metadata.email].filter(Boolean).join(" | ")
  );
  return {
    projectName,
    clientName,
    siteAddress,
    siteAddressLine1,
    suburb,
    state,
    postcode,
    siteSuburb: suburb,
    siteState: state,
    sitePostcode: postcode,
    suburbPostcode: [suburb, state, postcode].filter(Boolean).join(" "),
    fullSiteAddress: firstText(siteAddress, [siteAddressLine1, suburb, state, postcode].filter(Boolean).join(", ")),
    jobNumber,
    quoteNumber,
    quoteDate,
    estimatorName: firstText(
      workbookRowValue(workbook, "estimatorName"),
      fieldByNames(fields, ["estimatorName", "estimator name", "estimator", "sales consultant"]),
      quote?.estimatorName,
      metadata.estimatorName,
      projectMetadata.estimatorName
    ),
    builderName,
    builderLogo,
    builderLogoUrl: builderLogo,
    selectionStandard,
    datePrepared: quoteDate,
    tagline: firstText(fieldByNames(fields, ["tagline", "builder tagline", "company tagline"]), metadata.tagline, builderProfile.tagline, projectMetadata.tagline, COVER_BRAND_FALLBACK.tagline),
    footerText,
  };
}

function resolveProjectFields(project = null, snapshot = null) {
  return getSelectionsBookProjectDetails(project, snapshot);
}

function mergeProjectFields(primary = {}, secondary = {}) {
  const keys = new Set([...Object.keys(secondary || {}), ...Object.keys(primary || {})]);
  return Array.from(keys).reduce((merged, key) => {
    merged[key] = coverValue(primary?.[key]) || coverValue(secondary?.[key]) || "";
    return merged;
  }, {});
}

function embeddedSelectionsProject({ projectId = "", workbook = null, projectContext = {}, fileState = {} } = {}) {
  if (!workbook && !projectContext?.projectName && !fileState?.fileName) return null;
  const resolved = getSelectionsBookProjectDetails(null, {
    workbook_snapshot: workbook,
    workbook_metadata: workbook?.jobFileMeta || {},
  });
  const fileName = firstText(fileState?.fileName, fileState?.openedFileName, fileState?.sourceFileName, workbook?.openedFileName, workbook?.sourceFileName);
  const id = firstText(projectId, projectContext?.projectId, workbook?.registeredJobId, workbook?.id, fileName ? `embedded:${slug(fileName)}` : "embedded:current-job");
  const metadata = {
    ...(workbook?.jobFileMeta || {}),
    projectName: firstText(projectContext?.projectName, resolved.projectName),
    clientName: firstText(projectContext?.client, resolved.clientName),
    jobNumber: firstText(projectContext?.jobNumber, resolved.jobNumber),
    siteAddress: firstText(projectContext?.siteAddress, resolved.siteAddress),
    address: firstText(projectContext?.siteAddress, resolved.siteAddress),
    builderName: firstText(projectContext?.builder, resolved.builderName),
    estimatorName: firstText(projectContext?.estimator, resolved.estimatorName),
    currentFileName: fileName,
    sourceWorkbookFileName: fileName,
  };
  return {
    id,
    project_name: firstText(projectContext?.projectName, resolved.projectName, fileName, "Current Job"),
    client_name: metadata.clientName,
    job_number: metadata.jobNumber,
    site_address: metadata.siteAddress,
    address: metadata.address,
    builder_name: metadata.builderName,
    source_workbook_file_name: fileName,
    metadata,
    project_metadata: metadata,
  };
}

function embeddedSelectionsSnapshot({ snapshotId = "", workbook = null, projectContext = {}, fileState = {} } = {}) {
  if (!workbook) return null;
  const fileName = firstText(fileState?.fileName, workbook?.openedFileName, workbook?.sourceFileName);
  const id = firstText(snapshotId, fileName ? `embedded-snapshot:${slug(fileName)}` : "embedded-snapshot:current-job");
  return {
    id,
    snapshot_label: "Current .gr8job",
    snapshot_number: 1,
    workbook_snapshot: workbook,
    workbook_metadata: {
      ...(workbook?.jobFileMeta || {}),
      projectName: projectContext?.projectName || "",
      jobNumber: projectContext?.jobNumber || "",
      clientName: projectContext?.client || "",
      siteAddress: projectContext?.siteAddress || "",
      sourceWorkbookFileName: fileName,
    },
  };
}

function selectionBookFromEmbeddedWorkbook(workbook = null) {
  const candidates = [
    workbook?.selectionsBook,
    workbook?.clientSelectionsBook,
    workbook?.builderSelectionsBook,
    workbook?.selections?.book,
    workbook?.data?.selectionsBook,
    workbook?.data?.clientSelectionsBook,
  ];
  return candidates.find((candidate) => candidate?.documentType === "luxury_selections_book" || Array.isArray(candidate?.rooms)) || null;
}

function productOption(brand, productName, model, finish, supplier, description, allowance, selectedCost, priceBand, colour) {
  return {
    id: slug(`${brand}-${productName}-${model}`),
    brand,
    productName,
    model,
    finish,
    supplier,
    description,
    allowance,
    selectedCost,
    upgradeCost: numberValue(selectedCost) - numberValue(allowance),
    priceBand,
    imageUrl: imageForProduct(productName, colour),
    datasheetUrl: "",
    warrantyUrl: "",
    productUrl: "",
  };
}

function imageForProduct(productName, colour) {
  const lower = String(productName || "").toLowerCase();
  const match = Object.entries(PRODUCT_IMAGE_URLS).find(([key]) => lower.includes(key));
  if (match) return match[1];
  return placeholderImage(productName, colour);
}

function placeholderImage(label, colour = "#c99735") {
  const safeLabel = String(label || "Product").replace(/[<>&"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="280" viewBox="0 0 420 280"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${colour}"/><stop offset="1" stop-color="#f8fafc"/></linearGradient></defs><rect width="420" height="280" rx="18" fill="url(#g)"/><rect x="26" y="26" width="368" height="228" rx="14" fill="rgba(255,255,255,.72)" stroke="rgba(7,24,39,.18)"/><circle cx="96" cy="106" r="34" fill="rgba(7,24,39,.13)"/><path d="M55 218h310l-86-92-65 62-42-36z" fill="rgba(7,24,39,.16)"/><text x="210" y="78" text-anchor="middle" font-family="Arial" font-size="20" font-weight="800" fill="#071827">${safeLabel}</text><text x="210" y="244" text-anchor="middle" font-family="Arial" font-size="13" fill="#334155">Product image placeholder</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function optionsForItem(itemName, quality = "mid_range") {
  const lower = String(itemName || "").toLowerCase();
  const key = Object.keys(PRODUCT_OPTION_LIBRARY)
    .sort((a, b) => b.length - a.length)
    .find((entry) => lower.includes(entry));
  const fallbackOptions = [
    productOption("Builder Standard", `${itemName} Included Selection`, "Standard", "Builder selected", "Builder supplier", `${itemName} included builder standard selection.`, 0, 0, "mid_range", "#d8dee8"),
    productOption("Builder Standard", `${itemName} Upgraded Selection`, "Upgrade", "Client selected", "Builder supplier", `${itemName} upgraded client selection.`, 0, 450, "higher_end", "#c99735"),
  ];
  const libraryOptions = key ? PRODUCT_OPTION_LIBRARY[key] : null;
  const options = Array.isArray(libraryOptions) && libraryOptions.length ? libraryOptions : fallbackOptions;
  const targetBand = String(quality || "").includes("higher") ? "higher_end" : "mid_range";
  const preferred = options.find((option) => option.priceBand === targetBand) || options[0];
  return { options, preferred };
}

function rowFromOption(option, itemName, sortOrder, options = []) {
  return {
    id: uid("row"),
    sortOrder,
    item: itemName,
    category: itemName,
    productId: "",
    selectedOptionId: option.id,
    selectedProduct: option.productName,
    description: option.description,
    brand: option.brand,
    productModel: option.model,
    finishColour: option.finish,
    supplier: option.supplier,
    imageUrl: option.imageUrl,
    included: option.upgradeCost <= 0,
    status: option.upgradeCost <= 0 ? "approved" : "selected",
    allowanceAmount: numberValue(option.allowance),
    selectedCost: numberValue(option.selectedCost),
    upgradeCost: numberValue(option.upgradeCost),
    datasheetUrl: option.datasheetUrl,
    warrantyUrl: option.warrantyUrl,
    productUrl: option.productUrl,
    notes: "",
    options,
  };
}

export default function BuilderSelectionsBookPage({
  workspaceId: providedWorkspaceId = "",
  organisationId: providedOrganisationId = "",
  projectId: providedProjectId = "",
  estimateSnapshotId: providedEstimateSnapshotId = "",
  snapshotId: providedSnapshotId = "",
  workbook: embeddedWorkbook = null,
  projectContext = {},
  fileState = {},
  onEmbeddedMount = null,
  onEmbeddedBack = null,
} = {}) {
  const { workspaceId: activeWorkspaceId, loading: workspaceLoading } = useWorkspace();
  const workspaceId = providedWorkspaceId || providedOrganisationId || projectContext?.workspaceId || projectContext?.organisationId || activeWorkspaceId;
  const [projects, setProjects] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [templateItems, setTemplateItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [approvedCatalogueProducts, setApprovedCatalogueProducts] = useState([]);
  const [approvedCatalogueAudit, setApprovedCatalogueAudit] = useState(null);
  const [masterCatalogueProducts, setMasterCatalogueProducts] = useState([]);
  const [builderEnablements, setBuilderEnablements] = useState([]);
  const [brickImportModalOpen, setBrickImportModalOpen] = useState(false);
  const [brickImportPreview, setBrickImportPreview] = useState(null);
  const [brickImportResult, setBrickImportResult] = useState(null);
  const [brickEnablementSelection, setBrickEnablementSelection] = useState([]);
  const [categories, setCategories] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [bookId, setBookId] = useState("");
  const [book, setBook] = useState(() => createDocumentBook());
  const [coverDraft, setCoverDraft] = useState(() => createDocumentBook().cover);
  const [coverSettingsOpen, setCoverSettingsOpen] = useState(false);
  const [activePage, setActivePage] = useState("cover");
  const [activeRoomId, setActiveRoomId] = useState("");
  const [guidedScreen, setGuidedScreen] = useState("areas");
  const [guidedArea, setGuidedArea] = useState("");
  const [guidedRequirementKey, setGuidedRequirementKey] = useState("");
  const [guidedProductDetails, setGuidedProductDetails] = useState(null);
  const [guidedBrickStep, setGuidedBrickStep] = useState("suppliers");
  const [guidedBrickSupplier, setGuidedBrickSupplier] = useState("");
  const [guidedBrickRange, setGuidedBrickRange] = useState("");
  const [guidedRoofingMode, setGuidedRoofingMode] = useState("");
  const [guidedRoofingStep, setGuidedRoofingStep] = useState("landing");
  const [roofingConfiguration, setRoofingConfiguration] = useState({
    roofType: "",
    productSystem: "",
    profileProductCode: "",
    tileManufacturer: "",
    tileRange: "",
    tileProductCode: "",
    fasciaProductCode: "",
    gutterProductCode: "",
    downpipeProductCode: "",
    colour: "",
    finish: "",
  });
  const [viewMode, setViewMode] = useState("continuous");
  const [zoomMode, setZoomMode] = useState("fit-width");
  const [viewerPageWidth, setViewerPageWidth] = useState(0);
  const [viewerHeight, setViewerHeight] = useState(900);
  const [selectorRow, setSelectorRow] = useState(null);
  const [selectorSearch, setSelectorSearch] = useState("");
  const [selectorCategory, setSelectorCategory] = useState("all");
  const [imagePreview, setImagePreview] = useState(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomTemplate, setNewRoomTemplate] = useState("Powder Room");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const viewerRef = useRef(null);
  const pageRefs = useRef(new Map());
  const embeddedProject = useMemo(() => embeddedSelectionsProject({
    projectId: providedProjectId,
    workbook: embeddedWorkbook,
    projectContext,
    fileState,
  }), [providedProjectId, embeddedWorkbook, projectContext, fileState]);

  const selectedProject = useMemo(() => projects.find((project) => project.id === selectedProjectId) || embeddedProject || null, [projects, selectedProjectId, embeddedProject]);
  const selectedSnapshot = useMemo(() => snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) || embeddedSelectionsSnapshot({
    snapshotId: selectedSnapshotId || providedSnapshotId || providedEstimateSnapshotId,
    workbook: embeddedWorkbook,
    projectContext,
    fileState,
  }), [snapshots, selectedSnapshotId, providedSnapshotId, providedEstimateSnapshotId, embeddedWorkbook, projectContext, fileState]);
  const selectedTemplate = useMemo(() => templates.find((template) => template.id === selectedTemplateId) || null, [templates, selectedTemplateId]);
  const activeRoom = useMemo(() => book.rooms.find((room) => room.id === activeRoomId) || book.rooms[0] || null, [book.rooms, activeRoomId]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category.category_name])), [categories]);
  const manufacturerById = useMemo(() => new Map(manufacturers.map((manufacturer) => [manufacturer.id, manufacturer.manufacturer_name])), [manufacturers]);
  const supplierById = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier.supplier_name])), [suppliers]);
  const totals = useMemo(() => selectionTotals(book), [book]);
  const guidedSelections = useMemo(() => guidedSelectionsFromBook(book), [book]);
  const guidedSelectionMap = useMemo(() => guidedSelectedByRequirement(guidedSelections), [guidedSelections]);
  const applicableExteriorRequirements = useMemo(() => requirementsForGuidedArea("exterior", book), [book]);
  const guidedKitchenTotals = useMemo(() => guidedAreaTotals(KITCHEN_REQUIREMENTS, guidedSelectionMap), [guidedSelectionMap]);
  const guidedExteriorTotals = useMemo(() => guidedAreaTotals(applicableExteriorRequirements, guidedSelectionMap), [applicableExteriorRequirements, guidedSelectionMap]);
  const guidedInteriorTotals = useMemo(() => guidedAreaTotals(INTERIOR_REQUIREMENTS, guidedSelectionMap), [guidedSelectionMap]);
  const guidedRunningTotals = useMemo(() => guidedProjectTotals([guidedKitchenTotals, guidedExteriorTotals, guidedInteriorTotals]), [guidedKitchenTotals, guidedExteriorTotals, guidedInteriorTotals]);
  const guidedRequirement = useMemo(() => guidedRequirementByKey(guidedRequirementKey) || kitchenRequirementByKey("oven") || KITCHEN_REQUIREMENTS[0], [guidedRequirementKey]);
  const activeGuidedRequirements = useMemo(() => requirementsForGuidedArea(guidedRequirement.areaKey, book), [book, guidedRequirement.areaKey]);
  const guidedAreaTotalsForActive = useMemo(() => guidedAreaTotals(activeGuidedRequirements, guidedSelectionMap), [activeGuidedRequirements, guidedSelectionMap]);
  const projectRegion = useMemo(() => deriveAustralianRegion(selectedProject), [selectedProject]);
  const masterSelectionProducts = useMemo(() => queryClientSelectableProducts({
    organisationId: workspaceId || "",
    projectId: selectedProjectId || "",
    familyKey: guidedRequirement.familyKey,
    region: projectRegion,
    requirementKey: guidedRequirement.requirementKey,
    masterProducts: masterCatalogueProducts,
    builderProducts: builderEnablements,
    organisationProducts: [],
  }).map((product) => masterProductToClientSelectionProduct(product, { organisationId: workspaceId || "", requirement: guidedRequirement })), [builderEnablements, guidedRequirement, masterCatalogueProducts, projectRegion, selectedProjectId, workspaceId]);
  const brickMasterSelectionProducts = useMemo(() => {
    const brickRequirement = EXTERIOR_REQUIREMENTS.find((requirement) => requirement.requirementKey === "bricks");
    if (!brickRequirement) return [];
    return queryClientSelectableProducts({
      organisationId: workspaceId || "",
      projectId: selectedProjectId || "",
      familyKey: "bricks",
      region: projectRegion,
      requirementKey: "bricks",
      masterProducts: masterCatalogueProducts,
      builderProducts: builderEnablements,
      organisationProducts: [],
    }).map((product) => masterProductToClientSelectionProduct(product, { organisationId: workspaceId || "", requirement: brickRequirement }));
  }, [builderEnablements, masterCatalogueProducts, projectRegion, selectedProjectId, workspaceId]);
  const roofingMasterSelectionProducts = useMemo(() => {
    const roofingRequirement = EXTERIOR_REQUIREMENTS.find((requirement) => requirement.requirementKey === "roofing");
    if (!roofingRequirement) return [];
    return queryClientSelectableProducts({
      organisationId: workspaceId || "",
      projectId: selectedProjectId || "",
      familyKey: "roofing",
      region: projectRegion,
      requirementKey: "roofing",
      masterProducts: masterCatalogueProducts,
      builderProducts: builderEnablements,
      organisationProducts: [],
    }).map((product) => masterProductToClientSelectionProduct(product, { organisationId: workspaceId || "", requirement: roofingRequirement }));
  }, [builderEnablements, masterCatalogueProducts, projectRegion, selectedProjectId, workspaceId]);
  const clientSelectionCatalogueProducts = useMemo(() => {
    const byIdentity = new Map();
    [...approvedCatalogueProducts, ...brickMasterSelectionProducts, ...roofingMasterSelectionProducts, ...masterSelectionProducts].forEach((product) => {
      const key = product.productCode || product.sku || product.id || `${product.product_name || product.productName}-${byIdentity.size}`;
      byIdentity.set(key, product);
    });
    return Array.from(byIdentity.values());
  }, [approvedCatalogueProducts, brickMasterSelectionProducts, masterSelectionProducts, roofingMasterSelectionProducts]);
  const masterProductsForGuidedFamily = useMemo(() => masterCatalogueProducts.filter((product) => product.familyKey === guidedRequirement.familyKey && product.active !== false && !product.archived && !product.discontinued), [guidedRequirement.familyKey, masterCatalogueProducts]);
  const builderEnabledForGuidedFamily = useMemo(() => builderEnablements.filter((item) => item.organisationId === workspaceId && item.enabled !== false && item.active !== false && masterCatalogueProducts.some((product) => product.productCode === item.masterProductCode && product.familyKey === guidedRequirement.familyKey)), [builderEnablements, guidedRequirement.familyKey, masterCatalogueProducts, workspaceId]);
  const guidedProducts = useMemo(() => guidedProductsForRequirement(guidedRequirement, clientSelectionCatalogueProducts, {
    brickSupplier: guidedBrickSupplier,
    brickRange: guidedBrickRange,
  }), [guidedRequirement, clientSelectionCatalogueProducts, guidedBrickSupplier, guidedBrickRange]);
  const brickGuidedProducts = useMemo(() => {
    if (guidedRequirement.requirementKey !== "bricks") return guidedProducts;
    const directMasterProducts = guidedProductsForRequirement(guidedRequirement, brickMasterSelectionProducts, {
      brickSupplier: guidedBrickSupplier,
      brickRange: guidedBrickRange,
    });
    const byIdentity = new Map();
    [...guidedProducts, ...directMasterProducts].forEach((product) => {
      const key = product.productCode || product.sku || product.id || `${product.productName}-${byIdentity.size}`;
      byIdentity.set(key, product);
    });
    return Array.from(byIdentity.values());
  }, [brickMasterSelectionProducts, guidedBrickRange, guidedBrickSupplier, guidedProducts, guidedRequirement]);
  const roofingGuidedProducts = useMemo(() => {
    if (guidedRequirement.requirementKey !== "roofing") return guidedProducts;
    return guidedProductsForRequirement(guidedRequirement, roofingMasterSelectionProducts);
  }, [guidedProducts, guidedRequirement, roofingMasterSelectionProducts]);
  const hasCoverDraftChanges = useMemo(() => JSON.stringify(coverDraft || {}) !== JSON.stringify(book.cover || {}), [book.cover, coverDraft]);

  const selectorProducts = useMemo(() => {
    const term = selectorSearch.trim().toLowerCase();
    return products.filter((product) => {
      const matchCategory = selectorCategory === "all" || product.category_id === selectorCategory;
      const matchSearch = !term || [product.product_name, product.model, product.sku, product.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
      return product.active !== false && matchCategory && matchSearch;
    });
  }, [products, selectorSearch, selectorCategory]);
  const coverDebugFields = useMemo(() => {
    const projectResolved = getSelectionsBookProjectDetails(selectedProject, selectedSnapshot);
    const embeddedResolved = embeddedWorkbook ? getSelectionsBookProjectDetails(null, {
      workbook_snapshot: embeddedWorkbook,
      workbook_metadata: embeddedWorkbook?.jobFileMeta || {},
    }) : {};
    const resolved = mergeProjectFields(embeddedResolved, projectResolved);
    return {
      ...resolved,
      selectionStandard: resolved.selectionStandard || selectedTemplate?.template_name || selectedTemplate?.specification_name || selectedTemplate?.quality_level || "",
    };
  }, [embeddedWorkbook, selectedProject, selectedSnapshot, selectedTemplate]);
  const displayCover = useMemo(() => {
    const projectName = coverValue(coverDraft.projectName) || coverDebugFields.projectName || "";
    return {
      ...coverDraft,
      logoUrl: coverValue(coverDraft.logoUrl) || coverDebugFields.builderLogo || "",
      builderName: coverBuilderName(coverDraft.builderName) || coverDebugFields.builderName || "",
      tagline: coverValue(coverDraft.tagline) || coverDebugFields.tagline || COVER_BRAND_FALLBACK.tagline,
      projectName,
      clientName: coverValue(coverDraft.clientName, [projectName]) || coverDebugFields.clientName || "",
      siteAddress: coverValue(coverDraft.siteAddress) || coverDebugFields.siteAddress || "",
      suburbPostcode: coverValue(coverDraft.suburbPostcode) || coverDebugFields.suburbPostcode || "",
      quoteNumber: coverValue(coverDraft.quoteNumber) || coverDebugFields.quoteNumber || coverDebugFields.jobNumber || "",
      jobNumber: coverValue(coverDraft.jobNumber) || coverDebugFields.jobNumber || coverDebugFields.quoteNumber || "",
      issueDate: coverValue(coverDraft.issueDate) || coverDebugFields.quoteDate || today(),
      selectionStandard: coverValue(coverDraft.selectionStandard) || coverDebugFields.selectionStandard || "",
      footerText: coverValue(coverDraft.footerText) || coverDebugFields.footerText || "",
    };
  }, [coverDraft, coverDebugFields]);
  const projectInfoDisplay = useMemo(() => ({
    ...(book.projectInfo || {}),
    clientName: coverValue(book.projectInfo?.clientName) || coverDebugFields.clientName || "",
    siteAddress: coverValue(book.projectInfo?.siteAddress) || coverDebugFields.siteAddressLine1 || coverDebugFields.fullSiteAddress || "",
    fullSiteAddress: coverDebugFields.fullSiteAddress || coverValue(book.projectInfo?.siteAddress) || "",
    suburbPostcode: coverValue(book.projectInfo?.suburbPostcode) || coverDebugFields.suburbPostcode || "",
    estimatorName: coverValue(book.projectInfo?.estimatorName) || coverDebugFields.estimatorName || "",
    quoteNumber: coverValue(book.projectInfo?.quoteNumber) || coverDebugFields.quoteNumber || "",
    jobNumber: coverValue(book.projectInfo?.jobNumber) || coverDebugFields.jobNumber || coverDebugFields.quoteNumber || "",
    builderName: coverValue(book.projectInfo?.builderName) || coverDebugFields.builderName || "",
    issueDate: coverValue(book.projectInfo?.issueDate) || coverDebugFields.datePrepared || coverDebugFields.quoteDate || today(),
    selectionStandard: coverValue(book.projectInfo?.selectionStandard) || coverDebugFields.selectionStandard || "",
  }), [book.projectInfo, coverDebugFields]);

  useEffect(() => {
    onEmbeddedMount?.();
  }, [onEmbeddedMount]);

  useEffect(() => {
    if (!workspaceId) return;
    loadInitialData();
    loadApprovedClientSelectionCatalogue();
    loadMasterCatalogueState();
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || !selectedProjectId) {
      setSnapshots([]);
      setSelectedSnapshotId("");
      return;
    }
    loadSnapshots();
  }, [workspaceId, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || !selectedTemplateId) return;
    loadBook();
  }, [selectedProjectId, selectedSnapshotId, selectedTemplateId, templateItems.length]);

  useEffect(() => {
    setCoverDraft(book.cover);
  }, [book.cover]);

  async function loadApprovedClientSelectionCatalogue() {
    try {
      const response = await fetch(`/api/product-library/approved-client-selection-catalogue?workspaceId=${encodeURIComponent(workspaceId || "approved-template")}`);
      if (!response.ok) throw new Error("Approved catalogue API failed.");
      const payload = await response.json();
      setApprovedCatalogueProducts(Array.isArray(payload.products) ? payload.products : []);
      setApprovedCatalogueAudit(payload.audit || null);
    } catch (loadError) {
      console.error("[Client Selections] approved catalogue load error", loadError);
      setApprovedCatalogueProducts([]);
      setApprovedCatalogueAudit(null);
    }
  }

  // Master products come straight from the committed catalogue JSON on every
  // load. Browser state contributes builder overrides only, so no stored value
  // (stale, filtered, poisoned or absent) can reduce a family's master count.
  function loadMasterCatalogueState() {
    setMasterCatalogueProducts(getMasterProducts());
    setBuilderEnablements(getBuilderEnablementRefs(workspaceId || ""));
  }

  // Re-reads the builder layer after an override mutation. The master catalogue
  // is never written back - there is no persisted master copy any more.
  function refreshBuilderState() {
    setBuilderEnablements(getBuilderEnablementRefs(workspaceId || ""));
  }

  function embeddedBookStorageKey() {
    return `${EMBEDDED_SELECTIONS_BOOK_STORAGE_KEY}:${workspaceId || "workspace"}:${selectedProjectId || "current-project"}`;
  }

  function latestEmbeddedBookStorageKey() {
    return `${EMBEDDED_SELECTIONS_BOOK_STORAGE_KEY}:${workspaceId || "workspace"}:latest`;
  }

  function loadEmbeddedBookDraft() {
    if (typeof window === "undefined" || !workspaceId) return null;
    try {
      const latestPayload = JSON.parse(window.localStorage.getItem(latestEmbeddedBookStorageKey()) || "null");
      if (latestPayload?.book) return latestPayload.book;
      const payload = JSON.parse(window.localStorage.getItem(embeddedBookStorageKey()) || "null");
      if (payload?.book) return payload.book;
      const prefix = `${EMBEDDED_SELECTIONS_BOOK_STORAGE_KEY}:${workspaceId}:`;
      const fallbackKey = Object.keys(window.localStorage)
        .filter((key) => key.startsWith(prefix))
        .sort()
        .pop();
      if (!fallbackKey) return null;
      const fallbackPayload = JSON.parse(window.localStorage.getItem(fallbackKey) || "null");
      return fallbackPayload?.book || null;
    } catch {
      return null;
    }
  }

  function saveEmbeddedBookDraft(nextBook) {
    if (typeof window === "undefined" || !workspaceId || !nextBook) return;
    window.localStorage.setItem(embeddedBookStorageKey(), JSON.stringify({
      workspaceId,
      projectId: selectedProjectId || "",
      savedAt: new Date().toISOString(),
      book: nextBook,
    }));
    window.localStorage.setItem(latestEmbeddedBookStorageKey(), JSON.stringify({
      workspaceId,
      projectId: selectedProjectId || "",
      savedAt: new Date().toISOString(),
      book: nextBook,
    }));
  }

  async function loadInitialData() {
    setLoading(true);
    setError("");
    try {
      const [projectResult, templateResult, productResult, categoryResult, manufacturerResult, supplierResult] = await Promise.all([
        supabase
          .from("builder_commercial_projects")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("updated_at", { ascending: false }),
        supabase
          .from("builder_standard_specifications")
          .select("id, template_key, specification_name, description, price_band, is_platform_default")
          .eq("is_platform_default", true)
          .order("price_band", { ascending: true }),
        supabase
          .from("builder_products")
          .select("id, product_name, category_id, manufacturer_id, supplier_id, sku, model, description, price_band, standard_included, base_allowance, upgrade_cost, primary_image_url, datasheet_pdf_url, warranty_document_url, product_url, notes, active")
          .eq("workspace_id", workspaceId)
          .order("product_name", { ascending: true }),
        supabase.from("builder_product_categories").select("*").or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`).order("category_name"),
        supabase.from("builder_product_manufacturers").select("*").or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`).order("manufacturer_name"),
        supabase.from("builder_product_suppliers").select("*").or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`).order("supplier_name"),
      ]);

      if (projectResult.error) console.error("[Client Selections] missing project context", projectResult.error);
      const projectRows = projectResult.data || [];
      const mergedProjectRows = embeddedProject && !projectRows.some((project) => project.id === embeddedProject.id)
        ? [embeddedProject, ...projectRows]
        : projectRows;
      setProjects(mergedProjectRows);
      setSelectedProjectId((current) => mergedProjectRows.find((project) => project.id === current)?.id || (providedProjectId && mergedProjectRows.find((project) => project.id === providedProjectId)?.id) || embeddedProject?.id || mergedProjectRows[0]?.id || "");

      const templateRows = (templateResult.data || []).map((row) => ({
        id: row.id,
        template_key: row.template_key || row.price_band,
        template_name: row.specification_name,
        quality_level: row.price_band,
      }));
      const fallbackTemplates = [
        { id: "fallback-mid", template_key: "mid_range", template_name: "Mid Range Residential", quality_level: "mid_range" },
        { id: "fallback-higher", template_key: "higher_end", template_name: "Higher End Residential", quality_level: "higher_end" },
      ];
      setTemplates(templateRows.length ? templateRows : fallbackTemplates);
      setSelectedTemplateId((current) => {
        const rows = templateRows.length ? templateRows : fallbackTemplates;
        return rows.find((template) => template.id === current)?.id || rows.find((template) => String(template.template_key).includes("mid"))?.id || rows[0]?.id || "";
      });

      setProducts(productResult.data || []);
      setCategories(categoryResult.data || []);
      setManufacturers(manufacturerResult.data || []);
      setSuppliers(supplierResult.data || []);
      if (templateResult.error) setError("Standard specification templates are not available yet. Using built-in room templates.");
    } catch (loadError) {
      console.error("[Client Selections] parser or file-state error", loadError);
      if (embeddedProject) {
        setProjects([embeddedProject]);
        setSelectedProjectId(embeddedProject.id);
      }
      setTemplates([
        { id: "fallback-mid", template_key: "mid_range", template_name: "Mid Range Residential", quality_level: "mid_range" },
        { id: "fallback-higher", template_key: "higher_end", template_name: "Higher End Residential", quality_level: "higher_end" },
      ]);
      setSelectedTemplateId((current) => current || "fallback-mid");
      setError(loadError?.message || "Could not load selections data.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSnapshots() {
    try {
      const { data, error: loadError } = await supabase
        .from("builder_estimate_snapshots")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("project_id", selectedProjectId)
        .order("snapshot_number", { ascending: false });
      if (loadError) {
        console.error("[Client Selections] missing snapshot", loadError);
      }
      const embeddedSnapshot = embeddedSelectionsSnapshot({
        snapshotId: providedSnapshotId || providedEstimateSnapshotId,
        workbook: embeddedWorkbook,
        projectContext,
        fileState,
      });
      const rows = data || [];
      const mergedRows = embeddedSnapshot && !rows.some((snapshot) => snapshot.id === embeddedSnapshot.id)
        ? [embeddedSnapshot, ...rows]
        : rows;
      setSnapshots(mergedRows);
      setSelectedSnapshotId((current) => mergedRows.find((snapshot) => snapshot.id === current)?.id || embeddedSnapshot?.id || mergedRows[0]?.id || "");
    } catch (loadError) {
      console.error("[Client Selections] snapshot load error", loadError);
      const embeddedSnapshot = embeddedSelectionsSnapshot({
        snapshotId: providedSnapshotId || providedEstimateSnapshotId,
        workbook: embeddedWorkbook,
        projectContext,
        fileState,
      });
      setSnapshots(embeddedSnapshot ? [embeddedSnapshot] : []);
      setSelectedSnapshotId(embeddedSnapshot?.id || "");
    }
  }

  async function loadTemplateItems(templateId = selectedTemplateId) {
    if (!templateId || String(templateId).startsWith("fallback")) {
      const fallback = fallbackStandardItems(selectedTemplate?.quality_level || "mid_range");
      setTemplateItems(fallback);
      return fallback;
    }
    const { data, error: loadError } = await supabase
      .from("builder_standard_specification_items")
      .select("id, item_name, default_product_name, manufacturer_name, supplier_name, description, allowance_amount, price_band, sort_order, category_id, product_id, metadata")
      .eq("specification_id", templateId)
      .order("sort_order", { ascending: true });
    if (loadError) {
      const fallback = fallbackStandardItems(selectedTemplate?.quality_level || "mid_range");
      setTemplateItems(fallback);
      return fallback;
    }
    const rows = data?.length ? data : fallbackStandardItems(selectedTemplate?.quality_level || "mid_range");
    setTemplateItems(rows);
    return rows;
  }

  async function loadBook() {
    if (!workspaceId || !selectedProjectId || !selectedTemplateId) return;
    setLoading(true);
    setError("");
    const items = templateItems.length ? templateItems : await loadTemplateItems(selectedTemplateId);
    const embeddedDraft = loadEmbeddedBookDraft();
    if (embeddedDraft) {
      const next = normaliseDocumentBook(embeddedDraft, { project: selectedProject, snapshot: selectedSnapshot, template: selectedTemplate, templateItems: items, products, manufacturerById, supplierById, categoryById });
      setBookId(embeddedDraft.id || "");
      setBook(next);
      setActiveRoomId((current) => next.rooms.find((room) => room.id === current)?.id || next.rooms[0]?.id || "");
      setLoading(false);
      return;
    }
    const embeddedBook = selectionBookFromEmbeddedWorkbook(embeddedWorkbook);
    if (embeddedBook) {
      const next = normaliseDocumentBook(embeddedBook, { project: selectedProject, snapshot: selectedSnapshot, template: selectedTemplate, templateItems: items, products, manufacturerById, supplierById, categoryById });
      setBookId(embeddedBook.id || "");
      setBook(next);
      setActiveRoomId((current) => next.rooms.find((room) => room.id === current)?.id || next.rooms[0]?.id || "");
      setLoading(false);
      return;
    }
    try {
      const { data, error: loadError } = await supabase
        .from("builder_selection_books")
        .select("id, book_name, status, book_data, inclusion_template_id, updated_at")
        .eq("workspace_id", workspaceId)
        .eq("project_id", selectedProjectId)
        .eq("inclusion_template_id", selectedTemplateId)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (loadError) {
        console.error("[Client Selections] file-state error", loadError);
        setBookId("");
        const next = createDocumentBook({ project: selectedProject, snapshot: selectedSnapshot, template: selectedTemplate, templateItems: items, products, manufacturerById, supplierById, categoryById });
        setBook(next);
        setActiveRoomId(next.rooms[0]?.id || "");
        setLoading(false);
        return;
      }
      if (data?.[0]?.book_data) {
        const next = normaliseDocumentBook(data[0].book_data, { project: selectedProject, snapshot: selectedSnapshot, template: selectedTemplate, templateItems: items, products, manufacturerById, supplierById, categoryById });
        setBookId(data[0].id);
        setBook(next);
        setActiveRoomId((current) => next.rooms.find((room) => room.id === current)?.id || next.rooms[0]?.id || "");
      } else {
        const next = createDocumentBook({ project: selectedProject, snapshot: selectedSnapshot, template: selectedTemplate, templateItems: items, products, manufacturerById, supplierById, categoryById });
        setBookId("");
        setBook(next);
        setActiveRoomId(next.rooms[0]?.id || "");
      }
    } catch (loadError) {
      console.error("[Client Selections] parser or book load error", loadError);
      const next = createDocumentBook({ project: selectedProject, snapshot: selectedSnapshot, template: selectedTemplate, templateItems: items, products, manufacturerById, supplierById, categoryById });
      setBookId("");
      setBook(next);
      setActiveRoomId(next.rooms[0]?.id || "");
    }
    setLoading(false);
  }

  function updateCoverDraft(field, value) {
    setCoverDraft((current) => ({
      ...current,
      [field]: value,
      coverEdits: { ...(current.coverEdits || {}), [field]: true },
    }));
  }

  function resetCoverFromProjectData() {
    const resolved = getSelectionsBookProjectDetails(selectedProject, selectedSnapshot);
    const selectionStandard = resolved.selectionStandard || selectedTemplate?.template_name || selectedTemplate?.specification_name || selectedTemplate?.quality_level || "";
    setCoverDraft((current) => ({
      ...current,
      logoUrl: resolved.builderLogo || "",
      builderName: resolved.builderName || "",
      tagline: resolved.tagline || COVER_BRAND_FALLBACK.tagline,
      projectName: resolved.projectName || current.projectName || "",
      clientName: resolved.clientName || "",
      siteAddress: resolved.siteAddress || "",
      suburbPostcode: resolved.suburbPostcode || "",
      quoteNumber: resolved.quoteNumber || "",
      issueDate: resolved.quoteDate || today(),
      selectionStandard,
      subtitle: "Luxury Selections Schedule",
      title: "Inclusions & Selections Schedule",
      version: "1.0",
      footerText: resolved.footerText || "",
      coverEdits: {},
    }));
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Could not read logo file."));
      reader.readAsDataURL(file);
    });
  }

  async function changeBuilderLogo(file) {
    if (!file || !file.type?.startsWith("image/")) return;
    setError("");
    try {
      const logoUrl = await fileToDataUrl(file);
      updateCoverDraft("logoUrl", logoUrl);
      setBook((current) => ({
        ...current,
        cover: { ...current.cover, logoUrl, coverEdits: { ...(current.cover?.coverEdits || {}), logoUrl: true } },
        projectInfo: { ...(current.projectInfo || {}), builderLogoUrl: logoUrl },
        updatedAt: new Date().toISOString(),
      }));
      if (selectedProjectId) {
        const currentMetadata = selectedProject?.metadata || selectedProject?.project_metadata || {};
        await supabase
          .from("builder_commercial_projects")
          .update({
            metadata: { ...currentMetadata, builderLogo: logoUrl, logoUrl },
            builder_logo_url: logoUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("workspace_id", workspaceId)
          .eq("id", selectedProjectId);
      }
      setSuccess("Builder logo updated. Click Save Progress to store it with this selections book.");
    } catch (uploadError) {
      setError(uploadError?.message || "Could not update builder logo.");
    }
  }

  function updateProjectInfo(field, value) {
    setBook((current) => ({ ...current, projectInfo: { ...current.projectInfo, [field]: value }, updatedAt: new Date().toISOString() }));
  }

  function updateRoom(roomId, patch) {
    setBook((current) => ({
      ...current,
      rooms: current.rooms.map((room) => room.id === roomId ? { ...room, ...patch } : room),
      updatedAt: new Date().toISOString(),
    }));
  }

  function updateRow(roomId, rowId, patch) {
    setBook((current) => ({
      ...current,
      rooms: current.rooms.map((room) => room.id === roomId ? {
        ...room,
        rows: room.rows.map((row) => row.id === rowId ? { ...row, ...patch } : row),
      } : room),
      updatedAt: new Date().toISOString(),
    }));
  }

  function openSelector(roomId, rowId) {
    const room = book.rooms.find((item) => item.id === roomId);
    const row = room?.rows.find((item) => item.id === rowId);
    const categoryName = row?.category || row?.item || room?.name || "";
    const matchedCategory = categories.find((category) => String(category.category_name || "").toLowerCase().includes(String(categoryName).toLowerCase()));
    setSelectorCategory(matchedCategory?.id || "all");
    setSelectorSearch(row?.item || "");
    setSelectorRow({ roomId, rowId });
  }

  function selectProduct(product) {
    if (!selectorRow || !product) return;
    const manufacturer = manufacturerById.get(product.manufacturer_id) || "";
    const supplier = supplierById.get(product.supplier_id) || "";
    const selectedCost = numberValue(product.base_allowance || product.upgrade_cost);
    const allowance = numberValue(product.base_allowance);
    const selectedOption = productOption(
      manufacturer || "Product Library",
      product.product_name || "",
      product.model || product.sku || "",
      "",
      supplier,
      product.description || product.product_name || "",
      allowance,
      selectedCost,
      product.price_band || "custom",
      "#d8dee8"
    );
    selectedOption.id = product.id;
    selectedOption.imageUrl = product.primary_image_url || selectedOption.imageUrl;
    selectedOption.datasheetUrl = product.datasheet_pdf_url || "";
    selectedOption.warrantyUrl = product.warranty_document_url || "";
    selectedOption.productUrl = product.product_url || "";
    const currentRoom = book.rooms.find((room) => room.id === selectorRow.roomId);
    const currentRow = currentRoom?.rows.find((row) => row.id === selectorRow.rowId);
    const options = [selectedOption, ...(currentRow?.options || []).filter((option) => option.id !== selectedOption.id)];
    updateRow(selectorRow.roomId, selectorRow.rowId, {
      productId: product.id,
      selectedOptionId: product.id,
      selectedProduct: product.product_name || "",
      productModel: product.model || product.sku || "",
      brand: manufacturer || "",
      description: product.description || product.product_name || "",
      supplier,
      finishColour: "",
      imageUrl: product.primary_image_url || "",
      allowanceAmount: allowance,
      selectedCost,
      upgradeCost: selectedCost - allowance,
      datasheetUrl: product.datasheet_pdf_url || "",
      warrantyUrl: product.warranty_document_url || "",
      productUrl: product.product_url || "",
      included: product.standard_included !== false,
      status: "selected",
      options,
    });
    setSelectorRow(null);
  }

  function openGuidedArea(areaKey) {
    setGuidedArea(areaKey);
    setGuidedScreen(areaKey === "interior" ? "interior" : "exterior");
    setGuidedRequirementKey("");
    resetGuidedBrickFlow();
    resetGuidedRoofingFlow();
  }

  function openGuidedKitchen() {
    setGuidedArea("interior");
    setGuidedScreen("kitchen");
    setGuidedRequirementKey("");
    resetGuidedBrickFlow();
    resetGuidedRoofingFlow();
  }

  function openGuidedRequirement(requirementKey) {
    setGuidedArea("interior");
    setGuidedRequirementKey(requirementKey);
    setGuidedScreen("product");
    resetGuidedBrickFlow();
    resetGuidedRoofingFlow();
  }

  function openGuidedRequirementKey(requirementKey) {
    const next = guidedRequirementByKey(requirementKey);
    if (!next) return;
    setGuidedArea(next.areaKey === "exterior" ? "exterior" : "interior");
    setGuidedRequirementKey(next.requirementKey);
    setGuidedScreen("product");
    if (next.requirementKey !== "bricks") resetGuidedBrickFlow();
    if (next.requirementKey === "roofing") openGuidedRoofingLanding();
    else resetGuidedRoofingFlow();
  }

  function navigateToGuidedRequirement(requirement) {
    if (!requirement) {
      setGuidedScreen("complete");
      setGuidedRequirementKey("");
      setGuidedArea("");
      resetGuidedBrickFlow();
      resetGuidedRoofingFlow();
      return;
    }
    setGuidedArea(requirement.areaKey === "exterior" ? "exterior" : "interior");
    setGuidedRequirementKey(requirement.requirementKey);
    setGuidedScreen("product");
    if (requirement.requirementKey !== "bricks") resetGuidedBrickFlow();
    if (requirement.requirementKey === "roofing") openGuidedRoofingLanding();
    else resetGuidedRoofingFlow();
  }

  function autoAdvanceAfterGuidedCommit(committedRequirement, nextBook) {
    const nextRequirement = nextIncompleteGuidedRequirement(nextBook, committedRequirement);
    const completedSection = !nextRequirement || nextRequirement.areaKey !== committedRequirement.areaKey;
    const sectionLabel = committedRequirement.areaLabel || titleCase(committedRequirement.areaKey || "Section");
    setSuccess(`${committedRequirement.label} selected.`);
    window.setTimeout(() => {
      if (nextRequirement) {
        if (completedSection && committedRequirement.areaKey === "kitchen") {
          setSuccess("KITCHEN COMPLETE. Opening Interior.");
          setGuidedScreen("interior");
          setGuidedArea("interior");
          setGuidedRequirementKey("");
          resetGuidedBrickFlow();
          resetGuidedRoofingFlow();
          return;
        }
        if (completedSection && committedRequirement.areaKey === "exterior" && nextRequirement.areaKey === "interior") {
          setSuccess("EXTERIOR COMPLETE. Opening Interior.");
          setGuidedScreen("interior");
          setGuidedArea("interior");
          setGuidedRequirementKey("");
          resetGuidedBrickFlow();
          resetGuidedRoofingFlow();
          return;
        }
        setSuccess(completedSection ? `${sectionLabel} complete. Opening ${nextRequirement.label}.` : `Opening ${nextRequirement.label}.`);
        navigateToGuidedRequirement(nextRequirement);
      } else {
        setSuccess("Selections complete.");
        navigateToGuidedRequirement(null);
      }
    }, 450);
  }

  function commitGuidedRequirementPatch(requirement, patch) {
    let committedBook = null;
    setBook((current) => {
      const nextRoom = ensureGuidedRoom(current, requirement);
      const roomExists = current.rooms.some((room) => room.id === nextRoom.id);
      const nextRows = rowsWithGuidedRequirement(nextRoom.rows, requirement).map((item) => (
        item.guidedRequirementKey === requirement.requirementKey || rowMatchesRequirement(item, requirement)
          ? { ...item, guidedRequirementKey: requirement.requirementKey, ...patch }
          : item
      ));
      const updatedRoom = { ...nextRoom, rows: nextRows };
      committedBook = {
        ...current,
        rooms: roomExists
          ? current.rooms.map((room) => room.id === nextRoom.id ? updatedRoom : room)
          : [...current.rooms, updatedRoom],
        updatedAt: new Date().toISOString(),
      };
      saveEmbeddedBookDraft(committedBook);
      return committedBook;
    });
    window.setTimeout(() => {
      if (committedBook) autoAdvanceAfterGuidedCommit(requirement, committedBook);
    }, 0);
  }

  function resetGuidedBrickFlow() {
    setGuidedBrickStep("suppliers");
    setGuidedBrickSupplier("");
    setGuidedBrickRange("");
  }

  function resetGuidedRoofingFlow() {
    setGuidedRoofingMode("");
    setGuidedRoofingStep("landing");
    setRoofingConfiguration({
      roofType: "",
      productSystem: "",
      profileProductCode: "",
      tileManufacturer: "",
      tileRange: "",
      tileProductCode: "",
      fasciaProductCode: "",
      gutterProductCode: "",
      downpipeProductCode: "",
      colour: "",
      finish: "",
    });
  }

  function openGuidedRoofingLanding() {
    setGuidedRoofingMode("");
    setGuidedRoofingStep("landing");
  }

  function openBrickImportModal() {
    setBrickImportModalOpen(true);
    setBrickImportPreview(null);
    setBrickImportResult(null);
    setBrickEnablementSelection([]);
  }

  function handleBrickImportFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const format = file.name.toLowerCase().endsWith(".json") ? "json" : "csv";
        const records = parseMasterProductCatalogueImport(reader.result || "", { format }).map((record) => ({
          ...record,
          family_key: record.family_key || record.familyKey || "bricks",
          top_level_area: record.top_level_area || record.topLevelArea || "exterior",
        }));
        const preview = previewMasterProductImport(records, masterCatalogueProducts);
        setBrickImportPreview({ fileName: file.name, format, preview });
        setBrickImportResult(null);
        setBrickEnablementSelection([]);
      } catch (importError) {
        setError(importError?.message || "Invalid file format.");
      }
    };
    reader.onerror = () => setError("Could not read that catalogue file.");
    reader.readAsText(file);
  }

  function commitBrickImportPreview() {
    if (!brickImportPreview || !workspaceId) return;
    const result = commitMasterProductImport(brickImportPreview.preview, masterCatalogueProducts);
    // Imports append organisation-specific products. Static master records are
    // never rewritten, so an import can no longer replace a completed family.
    const masterCodes = new Set(masterCatalogueProducts.map((product) => product.productCode));
    [...result.created, ...result.updated].forEach((product) => {
      if (!product?.productCode || masterCodes.has(product.productCode)) return;
      try {
        addBuilderProduct(workspaceId, product);
      } catch (addError) {
        console.error("[Client Selections] import product rejected", addError);
      }
    });
    refreshBuilderState();
    const importedCodes = [...result.created, ...result.updated, ...result.skipped].map((product) => product.productCode).filter(Boolean);
    setBrickEnablementSelection(importedCodes);
    setBrickImportResult(result);
    setSuccess(`Import complete: ${result.created.length} created, ${result.updated.length} updated, ${result.skipped.length} unchanged.`);
  }

  function enableSelectedBrickProducts() {
    if (!workspaceId || !brickEnablementSelection.length) return;
    brickEnablementSelection.forEach((productCode) => {
      enableProduct(workspaceId, productCode);
    });
    refreshBuilderState();
    setBrickImportModalOpen(false);
    setGuidedBrickStep("suppliers");
    setGuidedBrickSupplier("");
    setGuidedBrickRange("");
    setSuccess(`${brickEnablementSelection.length} brick product${brickEnablementSelection.length === 1 ? "" : "s"} enabled for this builder.`);
  }

  function setBrickProductEnabled(productCode, enabled) {
    if (!workspaceId || !productCode) return;
    if (enabled) enableProduct(workspaceId, productCode);
    else disableProduct(workspaceId, productCode);
    refreshBuilderState();
  }

  function setBrickProductsEnabled(productCodes, enabled) {
    if (!workspaceId || !Array.isArray(productCodes)) return;
    productCodes.forEach((productCode) => {
      if (!productCode) return;
      if (enabled) enableProduct(workspaceId, productCode);
      else disableProduct(workspaceId, productCode);
    });
    refreshBuilderState();
  }

  function selectGuidedProduct(requirement, option) {
    if (!option) return;
    const entity = option.metadata?.productEntity || option;
    const allowance = numberValue(option.allowance ?? entity.allowance ?? requirement.defaultAllowance);
    const priceState = priceStateForGuidedOption(option);
    const selectedCost = priceState === PRICE_STATES.current ? numberValue(option.selectedCost) : null;
    const quantity = numberValue(requirement.defaultQuantity) || 1;
    const upgradeCost = priceState === PRICE_STATES.current
      ? variationFor({ selectedPrice: selectedCost, allowance, quantity })
      : null;
    const now = new Date().toISOString();
    const patch = {
      selectedOptionId: option.id,
      selectedProduct: option.productName,
      productModel: option.model,
      brand: option.brand,
      description: option.description,
      supplier: option.supplier,
      finishColour: option.finish,
      imageUrl: option.imageUrl || requirementImage(requirement),
      allowanceAmount: allowance,
      selectedCost,
      upgradeCost,
      included: priceState === PRICE_STATES.current && upgradeCost === 0,
      status: "selected",
      guidedSelection: {
        source: "guided_client_selections",
        projectId: selectedProjectId || selectedProject?.id || "",
        organisationId: workspaceId || "",
        area: requirement.areaKey,
        room: requirement.areaLabel,
        requirementKey: requirement.requirementKey,
        requirementLabel: requirement.label,
        familyKey: requirement.familyKey,
        linkedQuoteItemCode: entity.linkedQuoteItemCode || requirement.linkedQuoteItemCode || "",
        productId: option.productId || option.id || "",
        productCode: entity.productCode || option.productCode || option.sku || option.id,
        manufacturer: entity.manufacturer || "",
        brand: option.brand,
        supplier: option.supplier,
        range: option.range || "",
        productName: option.productName,
        model: option.model || "",
        selectedProduct: option.productName,
        colour: option.colour || "",
        finish: option.finish || "",
        size: option.size || "",
        profile: option.profile || "",
        texture: option.texture || "",
        configuration: option.configuration || option.roofType || "",
        variant: { model: option.model, colour: option.colour || "", finish: option.finish, size: option.size || "" },
        quantity,
        allowance,
        selectedPrice: selectedCost,
        priceStatus: priceState,
        variation: upgradeCost,
        variationPending: priceState !== PRICE_STATES.current,
        imageReference: option.imageUrl || requirementImage(requirement),
        officialProductURL: entity.officialProductURL || option.productUrl || "",
        priceState,
        selectedAt: now,
        updatedAt: now,
        selectionTimestamp: now,
      },
    };
    commitGuidedRequirementPatch(requirement, patch);
  }

  function selectGuidedRoofingConfiguration(requirement, configuration) {
    const fascia = roofingProfileByCode(guidedProducts, configuration.fasciaProductCode);
    const gutter = roofingProfileByCode(guidedProducts, configuration.gutterProductCode);
    const downpipe = roofingProfileByCode(guidedProducts, configuration.downpipeProductCode);
    if (!fascia || !gutter || !downpipe) {
      setError("Choose fascia, gutters and downpipes before saving the roofing package.");
      return;
    }
    const roofPackage = {
      fascia: {
        productCode: fascia.productCode || fascia.id,
        productName: fascia.productName,
        profile: fascia.profile || fascia.model || "",
        colour: fascia.colour || configuration.colour || "Match roof colour",
      },
      gutters: {
        productCode: gutter.productCode || gutter.id,
        productName: gutter.productName,
        profile: gutter.profile || gutter.model || "",
        colour: gutter.colour || configuration.colour || "Match roof colour",
      },
      downpipes: {
        productCode: downpipe.productCode || downpipe.id,
        productName: downpipe.productName,
        profile: downpipe.profile || downpipe.model || "",
        colour: downpipe.colour || configuration.colour || "Match roof colour",
      },
    };
    if (configuration?.roofType === "roof_tiles") {
      const tile = roofingProfileByCode(guidedProducts, configuration.tileProductCode);
      if (!tile) {
        setError("Choose a roof tile product before selecting.");
        return;
      }
      const entity = tile.metadata?.productEntity || tile;
      const allowance = numberValue(tile.allowance ?? entity.allowance ?? requirement.defaultAllowance);
      const selectedCost = priceStateForGuidedOption(tile) === PRICE_STATES.current ? numberValue(tile.selectedCost) : null;
      const priceState = priceStateForGuidedOption(tile) === PRICE_STATES.current ? PRICE_STATES.current : PRICE_STATES.quoteRequired;
      const quantity = numberValue(requirement.defaultQuantity) || 1;
      const variation = priceState === PRICE_STATES.current ? variationFor({ selectedPrice: selectedCost, allowance, quantity }) : null;
      const selectedProduct = `${tile.productName || `${tile.manufacturer} ${tile.range} ${tile.colour}`.trim()} / ${fascia.productName} / ${gutter.productName} / ${downpipe.productName}`;
      const now = new Date().toISOString();
      const guidedSelection = {
        source: "guided_client_selections",
        projectId: selectedProjectId || selectedProject?.id || "",
        organisationId: workspaceId || "",
        area: requirement.areaKey,
        room: requirement.areaLabel,
        requirementKey: requirement.requirementKey,
        requirementLabel: requirement.label,
        familyKey: "roofing",
        linkedQuoteItemCode: entity.linkedQuoteItemCode || requirement.linkedQuoteItemCode || "",
        productId: tile.productId || tile.id || "",
        productCode: entity.productCode || tile.productCode || tile.id,
        manufacturer: tile.manufacturer || entity.manufacturer || "",
        brand: tile.brand || entity.brand || tile.manufacturer || "",
        supplier: tile.supplier || entity.supplier || tile.manufacturer || "",
        range: tile.range || entity.range || "",
        model: tile.model || "",
        productName: selectedProduct,
        selectedProduct,
        roofType: "roof_tiles",
        material: tile.material || entity.material || "",
        collection: tile.collection || entity.collection || "",
        profile: tile.profile || entity.profile || "",
        colour: tile.colour || entity.colour || "",
        finish: tile.finish || entity.finish || "Manufacturer finish",
        roofingConfiguration: {
          roofType: "roof_tiles",
          tileManufacturer: tile.manufacturer || entity.manufacturer || "",
          tileRange: tile.range || entity.range || "",
          tileProductCode: entity.productCode || tile.productCode || tile.id,
          colour: tile.colour || entity.colour || "",
          finish: tile.finish || entity.finish || "Manufacturer finish",
          fasciaProductCode: roofPackage.fascia.productCode,
          gutterProductCode: roofPackage.gutters.productCode,
          downpipeProductCode: roofPackage.downpipes.productCode,
          roofPackage,
        },
        compatibility: {
          stateAvailability: entity.attributes?.stateAvailability || entity.regions || tile.regions || [],
          materialProfileRule: "Roof tile products are separate from metal roofing profiles.",
        },
        quantity,
        allowance,
        selectedPrice: selectedCost,
        variation,
        variationPending: priceState !== PRICE_STATES.current,
        priceStatus: priceState,
        priceState,
        configurationComplete: true,
        imageReference: tile.imageUrl || requirementImage(requirement),
        officialProductURL: entity.officialProductUrl || entity.officialProductURL || tile.productUrl || "",
        sourceUrls: [entity.officialProductUrl || entity.officialProductURL || tile.productUrl].filter(Boolean),
        selectedAt: now,
        updatedAt: now,
        selectionTimestamp: now,
      };
      const patch = {
        selectedOptionId: tile.id,
        selectedProduct,
        productModel: tile.model || "",
        brand: guidedSelection.brand,
        description: tile.description || "",
        supplier: guidedSelection.supplier,
        finishColour: [tile.colour, tile.finish, fascia.colour || "Match roof colour"].filter(Boolean).join(" / "),
        imageUrl: tile.imageUrl || requirementImage(requirement),
        allowanceAmount: allowance,
        selectedCost,
        upgradeCost: variation,
        included: variation === 0,
        status: "selected",
        guidedSelection,
      };
      commitGuidedRequirementPatch(requirement, patch);
      return;
    }
    const profile = roofingProfileByCode(guidedProducts, configuration.profileProductCode);
    const colour = roofingColourByName(profile, configuration.colour);
    const finish = roofingFinishForColour(colour, configuration.finish);
    if (!profile || !colour || !finish) {
      setError("Choose a compatible roof profile, colour and finish before selecting.");
      return;
    }
    const entity = profile.metadata?.productEntity || profile;
    const allowance = numberValue(profile.allowance ?? entity.allowance ?? requirement.defaultAllowance);
    const selectedCost = priceStateForGuidedOption(profile) === PRICE_STATES.current ? numberValue(profile.selectedCost) : null;
    const priceState = priceStateForGuidedOption(profile) === PRICE_STATES.current ? PRICE_STATES.current : PRICE_STATES.quoteRequired;
    const quantity = numberValue(requirement.defaultQuantity) || 1;
    const variation = priceState === PRICE_STATES.current ? variationFor({ selectedPrice: selectedCost, allowance, quantity }) : null;
    const selectedProduct = `${profile.profile || profile.productName} / ${colour.name} / ${finish.name} / ${fascia.productName} / ${gutter.productName} / ${downpipe.productName}`;
    const now = new Date().toISOString();
    const guidedSelection = {
      source: "guided_client_selections",
      projectId: selectedProjectId || selectedProject?.id || "",
      organisationId: workspaceId || "",
      area: requirement.areaKey,
      room: requirement.areaLabel,
      requirementKey: requirement.requirementKey,
      requirementLabel: requirement.label,
      familyKey: "roofing",
      linkedQuoteItemCode: entity.linkedQuoteItemCode || requirement.linkedQuoteItemCode || "",
      productId: profile.productId || profile.id || "",
      productCode: entity.productCode || profile.productCode || profile.id,
      manufacturer: profile.manufacturer || entity.manufacturer || "LYSAGHT",
      brand: profile.brand || entity.brand || "COLORBOND steel",
      supplier: profile.supplier || entity.supplier || "LYSAGHT",
      range: profile.range || entity.range || "",
      model: profile.model || "",
      productName: selectedProduct,
      selectedProduct,
      roofType: configuration.roofType,
      material: profile.material || entity.material || "COLORBOND steel",
      materialManufacturer: entity.attributes?.materialManufacturer || "BlueScope",
      productSystem: configuration.productSystem,
      profile: profile.profile || profile.productName,
      profileProductCode: configuration.profileProductCode,
      colour: colour.name,
      officialColourName: colour.officialName || colour.name,
      swatchHex: colour.hex,
      finish: finish.name,
      roofingConfiguration: {
        roofType: configuration.roofType,
        productSystem: configuration.productSystem,
        profileProductCode: configuration.profileProductCode,
        colour: colour.name,
        finish: finish.name,
        fasciaProductCode: roofPackage.fascia.productCode,
        gutterProductCode: roofPackage.gutters.productCode,
        downpipeProductCode: roofPackage.downpipes.productCode,
        roofPackage,
      },
      compatibility: {
        colourFinishRule: finish.name === "Matt" ? "Matt is only available for the six official COLORBOND Matt colours." : "Classic finish is available for the selected COLORBOND core colour.",
        materialProfileRule: "LYSAGHT roofing profiles in this catalogue are manufactured from COLORBOND steel.",
      },
      quantity,
      allowance,
      selectedPrice: selectedCost,
      variation,
      variationPending: priceState !== PRICE_STATES.current,
      priceStatus: priceState,
      priceState,
      configurationComplete: true,
      imageReference: profile.imageUrl || requirementImage(requirement),
      officialProductURL: entity.officialProductURL || profile.productUrl || "",
      sourceUrls: [entity.officialProductURL || profile.productUrl, "https://colorbond.com/colours"].filter(Boolean),
      selectedAt: now,
      updatedAt: now,
      selectionTimestamp: now,
    };
    const patch = {
      selectedOptionId: `${profile.id}-${slug(colour.name)}-${slug(finish.name)}`,
      selectedProduct,
      productModel: profile.model || profile.profile || "",
      brand: guidedSelection.brand,
      description: profile.description || "",
      supplier: guidedSelection.supplier,
      finishColour: `${colour.name} / ${finish.name}`,
      imageUrl: profile.imageUrl || requirementImage(requirement),
      allowanceAmount: allowance,
      selectedCost,
      upgradeCost: variation,
      included: variation === 0,
      status: "selected",
      guidedSelection,
    };
    commitGuidedRequirementPatch(requirement, patch);
  }

  function applyRowOption(roomId, rowId, optionId) {
    const room = book.rooms.find((item) => item.id === roomId);
    const row = room?.rows.find((item) => item.id === rowId);
    const option = row?.options?.find((item) => item.id === optionId);
    if (!option) return;
    updateRow(roomId, rowId, {
      selectedOptionId: option.id,
      selectedProduct: option.productName,
      productModel: option.model,
      brand: option.brand,
      description: option.description,
      supplier: option.supplier,
      finishColour: option.finish,
      imageUrl: option.imageUrl,
      allowanceAmount: numberValue(option.allowance),
      selectedCost: numberValue(option.selectedCost),
      upgradeCost: numberValue(option.upgradeCost),
      datasheetUrl: option.datasheetUrl || "",
      warrantyUrl: option.warrantyUrl || "",
      productUrl: option.productUrl || "",
      included: numberValue(option.upgradeCost) <= 0,
      status: numberValue(option.upgradeCost) <= 0 ? "approved" : "selected",
    });
  }

  function addRoom() {
    const name = text(newRoomName, newRoomTemplate);
    const rows = rowsForRoomTemplate(newRoomTemplate || name, selectedTemplate?.quality_level || "mid_range", {
      products,
      manufacturerById,
      supplierById,
      categoryById,
    });
    const room = { id: uid("room"), name, subtitle: "Selections schedule", completed: false, rows };
    setBook((current) => ({ ...current, rooms: [...current.rooms, room], updatedAt: new Date().toISOString() }));
    setActiveRoomId(room.id);
    setActivePage("room");
    setNewRoomName("");
  }

  function duplicateRoom(roomId) {
    const room = book.rooms.find((item) => item.id === roomId);
    if (!room) return;
    const copy = {
      ...room,
      id: uid("room"),
      name: `${room.name} Copy`,
      rows: room.rows.map((row) => ({ ...row, id: uid("row") })),
    };
    setBook((current) => ({ ...current, rooms: [...current.rooms, copy], updatedAt: new Date().toISOString() }));
    setActiveRoomId(copy.id);
  }

  function removeRoom(roomId) {
    if (book.rooms.length <= 1) return;
    if (!window.confirm("Remove this room page?")) return;
    setBook((current) => {
      const rooms = current.rooms.filter((room) => room.id !== roomId);
      return { ...current, rooms, updatedAt: new Date().toISOString() };
    });
    setActiveRoomId((current) => current === roomId ? book.rooms.find((room) => room.id !== roomId)?.id || "" : current);
  }

  async function saveBook(status = "in_progress") {
    const bookForSave = {
      ...book,
      cover: { ...book.cover, ...displayCover },
      projectInfo: { ...(book.projectInfo || {}), ...projectInfoDisplay },
      updatedAt: new Date().toISOString(),
    };
    saveEmbeddedBookDraft(bookForSave);
    if (!workspaceId || !selectedProjectId) {
      setBook(bookForSave);
      setCoverDraft(bookForSave.cover);
      setSuccess("Selections Book saved.");
      return "embedded-local";
    }
    setSaving(true);
    setError("");
    setSuccess("");
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || null;
    const payload = {
      workspace_id: workspaceId,
      project_id: selectedProjectId,
      estimate_snapshot_id: selectedSnapshotId || null,
      inclusion_template_id: selectedTemplateId || null,
      book_name: `${bookForSave.cover.projectName || selectedProject?.project_name || "Project"} Selections Book`,
      status,
      book_data: bookForSave,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };
    const query = bookId
      ? supabase.from("builder_selection_books").update(payload).eq("workspace_id", workspaceId).eq("id", bookId)
      : supabase.from("builder_selection_books").insert({ ...payload, created_by: userId });
    const { data, error: saveError } = await query.select("id, book_data").single();
    if (saveError) {
      if (String(selectedProjectId).startsWith("embedded:")) {
        setBook(bookForSave);
        setCoverDraft(bookForSave.cover);
        setSuccess("Selections Book saved.");
        setSaving(false);
        return "embedded-local";
      }
      setError(saveError.message || "Could not save the Selections Book.");
      setSaving(false);
      return null;
    }
    setBookId(data.id);
    setBook(data.book_data || bookForSave);
    setCoverDraft((data.book_data || bookForSave).cover);
    setSuccess("Selections Book saved.");
    setSaving(false);
    return data.id;
  }

  async function importToProject() {
    const savedBookId = bookId || await saveBook("ready_to_import");
    if (!savedBookId) return;
    setImporting(true);
    setError("");
    setSuccess("");
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || null;
    const rows = book.rooms.flatMap((room) => room.rows.map((row) => ({ room, row })));
    const { data: existingRows } = await supabase
      .from("builder_client_selections")
      .select("id, metadata")
      .eq("workspace_id", workspaceId)
      .eq("project_id", selectedProjectId);
    const existingByRow = new Map((existingRows || [])
      .filter((item) => item.metadata?.selection_book_id === savedBookId && item.metadata?.selection_book_row_id)
      .map((item) => [item.metadata.selection_book_row_id, item.id]));

    const inserts = [];
    const updates = [];
    rows.forEach(({ room, row }) => {
      const payload = selectionRecordPayload({
        workspaceId,
        projectId: selectedProjectId,
        snapshotId: selectedSnapshotId,
        bookId: savedBookId,
        templateId: selectedTemplateId,
        userId,
        room,
        row,
      });
      const existingId = existingByRow.get(row.id);
      if (existingId) updates.push({ id: existingId, payload });
      else inserts.push(payload);
    });

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from("builder_client_selections")
        .update({ ...update.payload, updated_by: userId, updated_at: new Date().toISOString() })
        .eq("workspace_id", workspaceId)
        .eq("id", update.id);
      if (updateError) {
        setError(updateError.message || "Could not update imported selection records.");
        setImporting(false);
        return;
      }
    }
    if (inserts.length) {
      const { error: insertError } = await supabase.from("builder_client_selections").insert(inserts);
      if (insertError) {
        setError(insertError.message || "Could not import selection records.");
        setImporting(false);
        return;
      }
    }
    await saveBook("imported");
    setSuccess(`Imported ${inserts.length} new and updated ${updates.length} selection records.`);
    setImporting(false);
  }

  const documentPages = useMemo(() => [
    { value: "cover", label: "Cover", type: "cover", pageNumber: 1 },
    { value: "project", label: "Project Info", type: "project", pageNumber: 2 },
    ...book.rooms.map((room, index) => ({ value: `room:${room.id}`, label: room.name, type: "room", room, pageNumber: index + 3 })),
  ], [book.rooms]);
  const sectionOptions = documentPages.map((page) => ({ value: page.value, label: page.label }));
  const activeSectionValue = activePage === "room" ? `room:${activeRoomId}` : activePage;
  const activePageIndex = Math.max(0, documentPages.findIndex((page) => page.value === activeSectionValue));
  const activeDocumentPage = documentPages[activePageIndex] || documentPages[0];
  const totalPageCount = documentPages.length;
  const zoomScale = zoomMode === "zoom-75" ? 0.75 : zoomMode === "zoom-125" ? 1.25 : zoomMode === "zoom-150" ? 1.5 : 1;
  const fitPageWidth = Math.max(320, Math.min(viewerPageWidth || 900, (viewerHeight - 190) * (297 / 210)));
  const pageDisplayWidth = zoomMode === "fit-page" ? fitPageWidth : Math.max(320, (viewerPageWidth || 900) * zoomScale);
  const measuredPageWidth = `${Math.round(pageDisplayWidth)}px`;
  const viewerStyle = { "--viewer-page-width": measuredPageWidth };

  useEffect(() => {
    if (!viewerRef.current || typeof ResizeObserver === "undefined") return undefined;
    const updateWidth = () => {
      const viewerWidth = viewerRef.current?.clientWidth || 0;
      const horizontalPadding = viewerWidth < 760 ? 24 : 48;
      setViewerPageWidth(Math.max(320, viewerWidth - horizontalPadding));
      setViewerHeight(window.innerHeight || 900);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(viewerRef.current);
    window.addEventListener("resize", updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  useEffect(() => {
    if (viewMode !== "continuous" || typeof IntersectionObserver === "undefined") return undefined;
    const ratios = new Map();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        ratios.set(entry.target.dataset.pageValue, entry.intersectionRatio);
      });
      const mostVisible = documentPages
        .map((page) => ({ page, ratio: ratios.get(page.value) || 0 }))
        .sort((a, b) => b.ratio - a.ratio)[0];
      if (!mostVisible?.page || mostVisible.ratio <= 0) return;
      if (mostVisible.page.type === "room") {
        setActivePage("room");
        setActiveRoomId(mostVisible.page.room?.id || "");
      } else {
        setActivePage(mostVisible.page.value);
      }
    }, {
      root: null,
      rootMargin: "-18% 0px -55% 0px",
      threshold: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9],
    });
    documentPages.forEach((page) => {
      const element = pageRefs.current.get(page.value);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [documentPages, viewMode]);

  function setPageFrameRef(value, element) {
    if (element) pageRefs.current.set(value, element);
    else pageRefs.current.delete(value);
  }

  function scrollPageIntoView(value) {
    if (viewMode !== "continuous") return;
    window.requestAnimationFrame(() => {
      pageRefs.current.get(value)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function openSection(value, options = {}) {
    if (value === "cover" || value === "project") {
      setActivePage(value);
      if (options.scroll !== false) scrollPageIntoView(value);
      return;
    }
    if (value.startsWith("room:")) {
      setActivePage("room");
      setActiveRoomId(value.replace("room:", ""));
      if (options.scroll !== false) scrollPageIntoView(value);
    }
  }

  function movePage(direction) {
    const nextIndex = clamp(activePageIndex + direction, 0, documentPages.length - 1, activePageIndex);
    openSection(documentPages[nextIndex]?.value || activeSectionValue);
  }

  function renderDocumentPage(page) {
    if (!page) return null;
    if (page.type === "cover") {
      return (
        <>
          <CoverPage cover={displayCover} onLogoChange={changeBuilderLogo} />
          {coverSettingsOpen && viewMode === "single" && (
            <CoverSettingsPanel
              cover={coverDraft}
              dirty={hasCoverDraftChanges}
              onChange={updateCoverDraft}
              onReset={() => setCoverDraft(book.cover)}
              onResetFromProject={resetCoverFromProjectData}
            />
          )}
        </>
      );
    }
    if (page.type === "project") return <ProjectInfoPage book={{ ...book, cover: displayCover }} details={projectInfoDisplay} onChange={updateProjectInfo} />;
    if (page.type === "room" && page.room) {
      return (
        <RoomPage
          room={page.room}
          rooms={book.rooms}
          activeRoomId={page.room.id}
          pageNumber={page.pageNumber}
          book={book}
          totals={totals}
          onOpenRoom={(roomId) => {
            setActivePage("room");
            setActiveRoomId(roomId);
          }}
          onRoomChange={(patch) => updateRoom(page.room.id, patch)}
          onRowChange={(rowId, patch) => updateRow(page.room.id, rowId, patch)}
          onApplyOption={(rowId, optionId) => applyRowOption(page.room.id, rowId, optionId)}
          onSelectProduct={(rowId) => openSelector(page.room.id, rowId)}
          onPreviewImage={setImagePreview}
          onDuplicate={() => duplicateRoom(page.room.id)}
          onRemove={() => removeRoom(page.room.id)}
        />
      );
    }
    return null;
  }

  return (
    <>
      <Head>
        <title>Selections Book | Builders Platform</title>
      </Head>
      <main className="screen">
        <section className="workspace">
          <header className="standardBanner">
            <button type="button" className="standardBack" onClick={() => handleGuidedBack({
              guidedScreen,
              guidedArea,
              guidedRequirement,
              guidedBrickStep,
              guidedRoofingMode,
              guidedRoofingStep,
              roofingConfiguration,
              setGuidedBrickStep,
              setGuidedBrickSupplier,
              setGuidedBrickRange,
              setGuidedRoofingMode,
              setGuidedRoofingStep,
              setRoofingConfiguration,
              setGuidedScreen,
              setGuidedArea,
              setGuidedRequirementKey,
              embedded: Boolean(embeddedWorkbook),
              onEmbeddedBack,
            })} aria-label="Back">
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
            <div className="standardIcon">
              <ClipboardList size={28} />
            </div>
            <div className="standardCopy">
              <h1>Inclusions & Selections</h1>
              <p>Project: {selectedProject?.project_name || book.cover.projectName || "Not selected"} · Current Section: {activePage === "room" ? activeRoom?.name : activePage === "project" ? "Project Info" : "Cover"}</p>
            </div>
            <div className="standardMeta">
              <span>Job Number: {displayCover.jobNumber || displayCover.quoteNumber || ""}</span>
              <span>{saving ? "Saving..." : success || "Changes saved when you press Save Progress"}</span>
              <div className="bannerActions">
                <button onClick={() => saveBook()} disabled={saving}>{saving ? "Saving..." : "Save Progress"}</button>
                <button onClick={importToProject} disabled={importing}>{importing ? "Importing..." : "Import to Project"}</button>
                <button type="button" onClick={() => setGuidedScreen(guidedScreen === "review" ? "areas" : "review")}>
                  {guidedScreen === "review" ? "Guided Selections" : "Review Schedule"}
                </button>
                {activePage === "cover" && (
                  <button type="button" onClick={() => setCoverSettingsOpen((current) => !current)}>
                    {coverSettingsOpen ? "Hide Cover Settings" : "Edit Cover Settings"}
                  </button>
                )}
              </div>
            </div>
          </header>

          {guidedScreen === "review" ? (
            <>
          <section className="scheduleControls" aria-label="Schedule navigation">
            <label>
              Project
              <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
                <option value="">Select project</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.project_name}</option>)}
              </select>
            </label>
            <label>
              Snapshot
              <select value={selectedSnapshotId} onChange={(event) => setSelectedSnapshotId(event.target.value)}>
                <option value="">No snapshot</option>
                {snapshots.map((snapshot) => <option key={snapshot.id} value={snapshot.id}>{snapshot.snapshot_label || `Snapshot ${snapshot.snapshot_number}`}</option>)}
              </select>
            </label>
            <label>
              Builder Standard
              <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
                {templates.map((template) => <option key={template.id} value={template.id}>{template.template_name}</option>)}
              </select>
            </label>
            <label className="sectionSelect">
              Section
              <select value={activeSectionValue} onChange={(event) => openSection(event.target.value)}>
                {sectionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="pageSelect">
              Page {activePageIndex + 1} of {totalPageCount}
              <select value={activeSectionValue} onChange={(event) => openSection(event.target.value)}>
                {documentPages.map((page) => <option key={page.value} value={page.value}>{page.pageNumber}. {page.label}</option>)}
              </select>
            </label>
            <label>
              View
              <select value={viewMode} onChange={(event) => setViewMode(event.target.value)}>
                <option value="single">Single Page</option>
                <option value="continuous">Continuous</option>
              </select>
            </label>
            <label>
              Zoom
              <select value={zoomMode} onChange={(event) => setZoomMode(event.target.value)}>
                <option value="fit-width">Fit Width</option>
                <option value="fit-page">Fit Page</option>
                <option value="zoom-75">75%</option>
                <option value="zoom-100">100%</option>
                <option value="zoom-125">125%</option>
                <option value="zoom-150">150%</option>
              </select>
            </label>
            <div className="sectionButtons">
              <button type="button" onClick={() => movePage(-1)} disabled={activePageIndex <= 0}>Previous</button>
              <button type="button" onClick={() => movePage(1)} disabled={activePageIndex >= totalPageCount - 1}>Next</button>
            </div>
          </section>

          {error && <div className="alert error">{error}</div>}
          {success && <div className="alert success">{success}</div>}

          <div
            ref={viewerRef}
            className={`documentViewer ${viewMode} ${zoomMode}`}
            data-view-mode={viewMode}
            data-zoom-mode={zoomMode}
            data-page-count={totalPageCount}
            data-fit-width={viewerPageWidth}
            style={viewerStyle}
          >
            <div className="documentPages">
              {viewMode === "continuous"
                ? documentPages.map((page) => (
                  <div
                    key={page.value}
                    id={`schedule-page-${slug(page.value)}`}
                    ref={(element) => setPageFrameRef(page.value, element)}
                    className="documentPageFrame"
                    data-page-value={page.value}
                    data-page-number={page.pageNumber}
                    data-page-title={page.label}
                  >
                    {renderDocumentPage(page)}
                  </div>
                ))
                : (
                  <div
                    id={`schedule-page-${slug(activeDocumentPage?.value)}`}
                    ref={(element) => setPageFrameRef(activeDocumentPage?.value, element)}
                    className="documentPageFrame"
                    data-page-value={activeDocumentPage?.value}
                    data-page-number={activeDocumentPage?.pageNumber}
                    data-page-title={activeDocumentPage?.label}
                  >
                    {renderDocumentPage(activeDocumentPage)}
                  </div>
                )}
            </div>
          </div>
            </>
          ) : (
            <GuidedSelectionsWorkflow
              screen={guidedScreen}
              area={guidedArea}
              requirement={guidedRequirement}
              requirements={activeGuidedRequirements}
              book={book}
              selections={guidedSelectionMap}
              areaTotals={guidedAreaTotalsForActive}
              runningTotals={guidedRunningTotals}
              products={guidedRequirement.requirementKey === "bricks" ? brickGuidedProducts : guidedRequirement.requirementKey === "roofing" ? roofingGuidedProducts : guidedProducts}
              masterProductCount={masterProductsForGuidedFamily.length}
              enabledProductCount={builderEnabledForGuidedFamily.length}
              brickStep={guidedBrickStep}
              brickSupplier={guidedBrickSupplier}
              brickRange={guidedBrickRange}
              roofingMode={guidedRoofingMode}
              roofingStep={guidedRoofingStep}
              roofingConfiguration={roofingConfiguration}
              onOpenArea={openGuidedArea}
              onOpenKitchen={openGuidedKitchen}
              onOpenRequirementKey={openGuidedRequirementKey}
              onOpenRequirement={openGuidedRequirement}
              onBrickStepChange={setGuidedBrickStep}
              onBrickSupplierChange={setGuidedBrickSupplier}
              onBrickRangeChange={setGuidedBrickRange}
              onRoofingModeChange={setGuidedRoofingMode}
              onRoofingStepChange={setGuidedRoofingStep}
              onRoofingConfigurationChange={setRoofingConfiguration}
              onSelectRoofingConfiguration={selectGuidedRoofingConfiguration}
              onSelectProduct={selectGuidedProduct}
              onViewDetails={(product) => setGuidedProductDetails(product)}
              onOpenImport={openBrickImportModal}
              onSaveProgress={() => saveBook()}
              onReviewSchedule={() => setGuidedScreen("review")}
            />
          )}
        </section>

        {selectorRow && (
          <ProductSelector
            products={selectorProducts}
            categories={categories}
            manufacturers={manufacturerById}
            suppliers={supplierById}
            category={selectorCategory}
            search={selectorSearch}
            onCategory={setSelectorCategory}
            onSearch={setSelectorSearch}
            onClose={() => setSelectorRow(null)}
            onSelect={selectProduct}
          />
        )}

        {imagePreview && (
          <div className="modalBackdrop" onClick={() => setImagePreview(null)}>
            <div className="imageModal" onClick={(event) => event.stopPropagation()}>
              <button onClick={() => setImagePreview(null)}>Close</button>
              <img src={imagePreview.url} alt={imagePreview.alt || "Selection image"} />
              <strong>{imagePreview.alt}</strong>
            </div>
          </div>
        )}

        {guidedProductDetails && (
          <GuidedProductDetailsModal
            requirement={guidedRequirement}
            product={guidedProductDetails}
            onClose={() => setGuidedProductDetails(null)}
            onSelect={() => {
              selectGuidedProduct(guidedRequirement, guidedProductDetails);
              setGuidedProductDetails(null);
            }}
          />
        )}
        {brickImportModalOpen && (
          <BrickCatalogueImportModal
            requirement={guidedRequirementByKey("bricks")}
            preview={brickImportPreview}
            result={brickImportResult}
            enablementSelection={brickEnablementSelection}
            onEnablementSelectionChange={setBrickEnablementSelection}
            masterProducts={activeQldBrickMasterProducts(masterCatalogueProducts)}
            builderEnablements={builderEnablements}
            organisationId={workspaceId || ""}
            onFile={handleBrickImportFile}
            onCommit={commitBrickImportPreview}
            onEnableSelected={enableSelectedBrickProducts}
            onSetProductEnabled={setBrickProductEnabled}
            onSetProductsEnabled={setBrickProductsEnabled}
            onClose={() => setBrickImportModalOpen(false)}
          />
        )}
      </main>

      <style jsx>{styles}</style>
    </>
  );
}

function GuidedSelectionsWorkflow({
  screen,
  area,
  requirement,
  requirements,
  book,
  selections,
  areaTotals,
  runningTotals,
  products,
  masterProductCount,
  enabledProductCount,
  brickStep,
  brickSupplier,
  brickRange,
  roofingMode,
  roofingStep,
  roofingConfiguration,
  onOpenArea,
  onOpenKitchen,
  onOpenRequirementKey,
  onOpenRequirement,
  onBrickStepChange,
  onBrickSupplierChange,
  onBrickRangeChange,
  onRoofingModeChange,
  onRoofingStepChange,
  onRoofingConfigurationChange,
  onSelectRoofingConfiguration,
  onSelectProduct,
  onViewDetails,
  onOpenImport,
  onSaveProgress,
  onReviewSchedule,
}) {
  if (screen === "complete") {
    const pendingPrices = pendingPriceSelections(selections);
    return (
      <section className="guidedShell" data-testid="guided-selections-complete">
        <GuidedBudgetDock totals={runningTotals} />
        <div className="guidedCompletionPanel">
          <span>Selections Complete</span>
          <strong>All required client selections have been committed.</strong>
          <div className="guidedTotals">
            <GuidedMiniTotal label="Completed Items" value={`${runningTotals.completed} / ${runningTotals.total}`} />
            <GuidedMiniTotal label="Allowance Total" value={money(runningTotals.allowance)} />
            <GuidedMiniTotal label="Selected Total" value={money(runningTotals.selected)} />
            <GuidedMiniTotal label={runningTotals.variation < 0 ? "Current Credit" : "Current Variation"} value={signedMoney(runningTotals.variation)} tone={runningTotals.variation > 0 ? "bad" : runningTotals.variation < 0 ? "good" : ""} />
          </div>
          <p>{pendingPrices.length ? `${pendingPrices.length} item${pendingPrices.length === 1 ? "" : "s"} selected with price pending.` : "No price-pending selections."}</p>
          <div className="guidedCompletionActions">
            <button type="button" onClick={onReviewSchedule}>Review Selections</button>
            <button type="button" onClick={onSaveProgress}>Save Progress</button>
            <button type="button" className="primary" onClick={onReviewSchedule}>Generate / Review Schedule</button>
          </div>
        </div>
      </section>
    );
  }

  if (screen === "areas") {
    return (
      <section className="guidedShell" data-testid="guided-client-selections-home">
        <GuidedBudgetDock totals={runningTotals} />
        <div className="guidedIntro">
          <span>Choose an Area</span>
          <strong>Start with the part of the home the client is selecting.</strong>
        </div>
        <div className="guidedAreaGrid">
          {GUIDED_AREA_CARDS.map((card) => (
            <button key={card.key} type="button" className="guidedImageCard" onClick={() => onOpenArea(card.key)}>
              <img src={card.image} alt={card.label} />
              <span>{card.label}</span>
              <small>{card.description}</small>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (screen === "exterior") {
    const applicableKeys = new Set(requirementsForGuidedArea("exterior", book).map((item) => item.requirementKey));
    const exteriorCards = EXTERIOR_CATEGORY_CARDS.filter((card) => !card.requirementKey || applicableKeys.has(card.requirementKey)).map((card) => {
      const selection = card.requirementKey ? selections.get(card.requirementKey) : null;
      return {
        ...card,
        selectedLabel: selection?.selected_product_name || selection?.selectedProduct || selection?.selected_product || "",
      };
    });
    return (
      <section className="guidedShell" data-testid="guided-exterior-categories">
        <GuidedBudgetDock totals={runningTotals} />
        <GuidedCardGrid title="Exterior" cards={exteriorCards} onOpen={(key) => {
          const card = exteriorCards.find((item) => item.key === key);
          if (card?.requirementKey) onOpenRequirementKey(card.requirementKey);
        }} />
      </section>
    );
  }

  if (screen === "interior") {
    return (
      <section className="guidedShell" data-testid="guided-interior-categories">
        <GuidedBudgetDock totals={runningTotals} />
        <GuidedCardGrid title="Interior" cards={INTERIOR_CATEGORY_CARDS} onOpen={(key) => {
          if (key === "kitchen") onOpenKitchen();
          const card = INTERIOR_CATEGORY_CARDS.find((item) => item.key === key);
          if (card?.requirementKey) onOpenRequirementKey(card.requirementKey);
        }} />
      </section>
    );
  }

  if (screen === "product") {
    if (requirement.requirementKey === "bricks") {
      return (
          <GuidedBrickWorkflow
            requirement={requirement}
            products={products}
            masterProductCount={masterProductCount}
            enabledProductCount={enabledProductCount}
          runningTotals={runningTotals}
          brickStep={brickStep}
          brickSupplier={brickSupplier}
          brickRange={brickRange}
          onBrickStepChange={onBrickStepChange}
          onBrickSupplierChange={onBrickSupplierChange}
          onBrickRangeChange={onBrickRangeChange}
          onSelectProduct={onSelectProduct}
          onViewDetails={onViewDetails}
          onOpenImport={onOpenImport}
        />
      );
    }
    if (requirement.requirementKey === "roofing") {
      return (
        <GuidedRoofingWorkflow
          requirement={requirement}
          products={products}
          masterProductCount={masterProductCount}
          enabledProductCount={enabledProductCount}
          runningTotals={runningTotals}
          roofingMode={roofingMode}
          roofingStep={roofingStep}
          roofingConfiguration={roofingConfiguration}
          onRoofingModeChange={onRoofingModeChange}
          onRoofingStepChange={onRoofingStepChange}
          onRoofingConfigurationChange={onRoofingConfigurationChange}
          onSelectRoofingConfiguration={onSelectRoofingConfiguration}
        />
      );
    }
    return (
      <section className="guidedShell" data-testid="guided-product-page">
        <GuidedBudgetDock totals={runningTotals} />
        <div className="guidedProductLayout">
          <aside className="guidedProgressMenu" data-testid="guided-left-progress-menu">
            <h2>{requirement.areaLabel}</h2>
            {requirements.map((item) => {
              const selection = selections.get(item.requirementKey);
              const status = statusForRequirement(item, selection);
              return (
                <button
                  key={item.requirementKey}
                  type="button"
                  className={`guidedProgressItem ${item.requirementKey === requirement.requirementKey ? "active" : ""}`}
                  onClick={() => onOpenRequirement(item.requirementKey)}
                >
                  <GuidedStatusDot status={status} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </aside>
          <main className="guidedProductPanel">
            <div className="guidedSectionHeader">
              <span>{requirement.areaLabel} / {requirement.label}</span>
              <strong>{products.length ? `${products.length} ${requirement.label} product option${products.length === 1 ? "" : "s"}` : `No products have been added for ${requirement.label}.`}</strong>
            </div>
            {products.length ? (
              <div className="guidedProductGrid">
                {products.map((product) => (
                  <GuidedProductCard key={product.id} requirement={requirement} product={product} onSelect={() => onSelectProduct(requirement, product)} onViewDetails={() => onViewDetails(product)} />
                ))}
              </div>
            ) : <GuidedEmptyCatalogue requirement={requirement} />}
          </main>
        </div>
      </section>
    );
  }

  return (
    <section className="guidedShell" data-testid="guided-kitchen-checklist">
      <GuidedBudgetDock totals={runningTotals} />
      <div className="guidedChecklistHeader">
        <div>
          <span>Kitchen</span>
          <strong>{areaTotals.completed} of {areaTotals.total} complete</strong>
        </div>
        <div className="guidedTotals">
          <GuidedMiniTotal label="Allowance Total" value={money(areaTotals.allowance)} />
          <GuidedMiniTotal label="Selected Total" value={money(areaTotals.selected)} />
          <GuidedMiniTotal label={areaTotals.variation < 0 ? "Current Credit" : "Current Variation"} value={signedMoney(areaTotals.variation)} tone={areaTotals.variation > 0 ? "bad" : areaTotals.variation < 0 ? "good" : ""} />
        </div>
      </div>
      <div className="guidedChecklistRows">
        {requirements.map((item) => (
          <GuidedRequirementRow
            key={item.requirementKey}
            requirement={item}
            selection={selections.get(item.requirementKey)}
            onOpen={() => onOpenRequirement(item.requirementKey)}
          />
        ))}
      </div>
    </section>
  );
}

function GuidedCardGrid({ title, cards, onOpen }) {
  return (
    <>
      <div className="guidedIntro">
        <span>{title}</span>
        <strong>Choose a selection category.</strong>
      </div>
      <div className="guidedCategoryGrid">
        {cards.map((card) => (
          <button key={card.key} type="button" className="guidedImageCard" onClick={() => onOpen(card.key)}>
            <img src={card.image} alt={card.label} />
            <span>{card.label}</span>
            {card.selectedLabel ? <small>Selected: {card.selectedLabel}</small> : null}
          </button>
        ))}
      </div>
    </>
  );
}

function GuidedBrickWorkflow({
  requirement,
  products,
  masterProductCount = 0,
  enabledProductCount = 0,
  runningTotals,
  brickStep,
  brickSupplier,
  brickRange,
  onBrickStepChange,
  onBrickSupplierChange,
  onBrickRangeChange,
  onSelectProduct,
  onViewDetails,
  onOpenImport,
}) {
  const suppliers = brickSupplierOptions(products);
  const ranges = brickRangeOptions(products, brickSupplier);
  const selectedProducts = brickProductsForStep(products, brickSupplier, brickRange, brickStep);
  const supplierLabel = brickSupplier || "All Bricks";
  const rangeLabel = brickRange || "All Ranges";

  return (
    <section className="guidedShell" data-testid="guided-bricks-workflow">
      <GuidedBudgetDock totals={runningTotals} />
      <div className="guidedProductLayout brickLayout">
        <aside className="guidedProgressMenu" data-testid="guided-bricks-hierarchy">
          <h2>Bricks</h2>
          <button type="button" className={`guidedProgressItem ${brickStep === "suppliers" ? "active" : ""}`} onClick={() => {
            onBrickStepChange("suppliers");
            onBrickSupplierChange("");
            onBrickRangeChange("");
          }}>
            <GuidedStatusDot status={brickSupplier ? "complete" : "not_started"} />
            <span>Supplier</span>
          </button>
          <button type="button" className={`guidedProgressItem ${brickStep === "ranges" ? "active" : ""}`} disabled={!brickSupplier && suppliers.length > 1} onClick={() => onBrickStepChange("ranges")}>
            <GuidedStatusDot status={brickRange ? "complete" : "not_started"} />
            <span>Range</span>
          </button>
          <button type="button" className={`guidedProgressItem ${brickStep === "products" ? "active" : ""}`} disabled={!selectedProducts.length} onClick={() => onBrickStepChange("products")}>
            <GuidedStatusDot status={selectedProducts.length ? "incomplete" : "not_started"} />
            <span>Actual Brick</span>
          </button>
        </aside>
        <main className="guidedProductPanel brickShowroom">
          <div className="guidedSectionHeader">
            <span>Exterior / Bricks</span>
            <strong>{brickHeaderForStep(brickStep)}</strong>
          </div>
          {!products.length ? (
            <GuidedBrickEmptyCatalogue
              message={masterProductCount && !enabledProductCount ? "No brick products are enabled for this builder." : "Brick catalogue awaiting product data"}
              masterProductCount={masterProductCount}
              onOpenImport={onOpenImport}
            />
          ) : brickStep === "suppliers" ? (
            <div className="guidedSupplierGrid" data-testid="guided-brick-supplier-grid">
              {suppliers.map((supplier) => (
                <button key={supplier.key} type="button" className="guidedSupplierCard" onClick={() => {
                  onBrickSupplierChange(supplier.key === "all" ? "" : supplier.label);
                  onBrickRangeChange("");
                  onBrickStepChange("ranges");
                }}>
                  <img src={supplier.image} alt="" />
                  <span>{supplier.label}</span>
                  <strong>{supplier.count} brick product{supplier.count === 1 ? "" : "s"}</strong>
                </button>
              ))}
            </div>
          ) : brickStep === "ranges" ? (
            <div className="guidedSupplierGrid" data-testid="guided-brick-range-grid">
              {ranges.length ? ranges.map((range) => (
                <button key={range.key} type="button" className="guidedSupplierCard" onClick={() => {
                  onBrickRangeChange(range.key === "all" ? "" : range.label);
                  onBrickStepChange("products");
                }}>
                  <img src={range.image} alt="" />
                  <span>{range.label}</span>
                  <strong>{range.count} actual brick{range.count === 1 ? "" : "s"}</strong>
                </button>
              )) : (
                <GuidedBrickEmptyCatalogue message={`No ranges have been imported for ${supplierLabel}.`} onOpenImport={onOpenImport} />
              )}
            </div>
          ) : selectedProducts.length ? (
            <>
              <div className="brickContextBar" data-testid="guided-brick-context">{supplierLabel} / {rangeLabel}</div>
              <div className="guidedProductGrid brickProductGrid" data-testid="guided-brick-product-grid">
                {selectedProducts.map((product) => (
                  <GuidedProductCard
                    key={product.id}
                    requirement={requirement}
                    product={product}
                    onSelect={() => onSelectProduct(requirement, product)}
                    onViewDetails={() => onViewDetails(product)}
                  />
                ))}
              </div>
            </>
          ) : (
            <GuidedBrickEmptyCatalogue message="No products have been added to this catalogue yet." onOpenImport={onOpenImport} />
          )}
        </main>
      </div>
    </section>
  );
}

function GuidedBrickEmptyCatalogue({ message = "Brick catalogue awaiting product data", masterProductCount = 0, onOpenImport = null }) {
  return (
    <div className="guidedEmptyCatalogue" data-testid="guided-brick-empty-catalogue">
      <strong>{message}</strong>
      <span>{masterProductCount ? "Master Catalogue has brick products, but this builder has not enabled them yet." : "No products have been added to this catalogue yet."}</span>
      <div>
        <button type="button" onClick={() => { window.location.href = "/modules/builders/product-library"; }}>Add Products</button>
        <button type="button" onClick={() => onOpenImport ? onOpenImport() : null}>Import Products</button>
        {masterProductCount ? <button type="button" onClick={() => onOpenImport ? onOpenImport() : null}>Manage Builder Catalogue</button> : null}
      </div>
    </div>
  );
}

function GuidedRoofingWorkflow({
  requirement,
  products,
  masterProductCount = 0,
  enabledProductCount = 0,
  runningTotals,
  roofingMode,
  roofingStep,
  roofingConfiguration,
  onRoofingModeChange,
  onRoofingStepChange,
  onRoofingConfigurationChange,
  onSelectRoofingConfiguration,
}) {
  const config = roofingConfiguration || {};
  const systems = roofingProductSystems(products, config.roofType);
  const profiles = roofingProfiles(products, config);
  const selectedProfile = roofingProfileByCode(products, config.profileProductCode);
  const tileManufacturers = roofingTileManufacturers(products);
  const tileRanges = roofingTileRanges(products, config.tileManufacturer);
  const tileProducts = roofingTileProducts(products, config);
  const selectedTile = roofingProfileByCode(products, config.tileProductCode);
  const fasciaProducts = roofingAccessoryProducts(products, "fascia");
  const gutterProducts = roofingAccessoryProducts(products, "gutters");
  const downpipeProducts = roofingAccessoryProducts(products, "downpipes");
  const selectedFascia = roofingAccessoryByCode(fasciaProducts, config.fasciaProductCode);
  const selectedGutter = roofingAccessoryByCode(gutterProducts, config.gutterProductCode);
  const selectedDownpipe = roofingAccessoryByCode(downpipeProducts, config.downpipeProductCode);
  const colours = roofingColoursForProfile(selectedProfile);
  const selectedColour = roofingColourByName(selectedProfile, config.colour);
  const finishes = roofingFinishesForColour(selectedColour);
  const selectedFinish = roofingFinishForColour(selectedColour, config.finish);
  const canSelect = Boolean(
    (config.roofType === "metal_roofing" && selectedProfile && selectedColour && selectedFinish)
    || (config.roofType === "roof_tiles" && selectedTile)
  );
  const selectedSystem = systems.find((system) => system.key === config.productSystem) || null;
  const selectedProfileImage = roofingProfileImage(selectedProfile, requirement);
  const selectedPriceState = priceStateForGuidedOption(selectedProfile);
  const selectedPrice = selectedPriceState === PRICE_STATES.current ? numberValue(selectedProfile?.selectedCost) : 0;
  const selectedAllowance = numberValue(selectedProfile?.allowance ?? requirement.defaultAllowance);
  const selectedVariation = selectedPriceState === PRICE_STATES.current ? variationFor({ selectedPrice, allowance: selectedAllowance, quantity: requirement.defaultQuantity || 1 }) : 0;
  const setConfig = (patch) => onRoofingConfigurationChange((current) => ({ ...(current || {}), ...patch }));
  const accessoriesComplete = Boolean(config.fasciaProductCode && config.gutterProductCode && config.downpipeProductCode);
  const colorbondComplete = Boolean(config.roofType === "metal_roofing" && config.profileProductCode && config.colour && config.finish);
  const roofTilesComplete = Boolean(config.roofType === "roof_tiles" && config.tileManufacturer && config.tileRange && config.tileProductCode && config.finish);
  const roofingCardStatus = (cardKey) => {
    if (cardKey === "fascia-gutter") {
      if (accessoriesComplete) return "Complete";
      if (config.fasciaProductCode || config.gutterProductCode || config.downpipeProductCode) return "In Progress";
      return "Not Started";
    }
    if (cardKey === "colorbond") {
      if (colorbondComplete) return "Complete";
      if (config.roofType === "metal_roofing" || config.profileProductCode || config.colour || config.finish) return "In Progress";
      return "Not Started";
    }
    if (roofTilesComplete) return "Complete";
    if (config.roofType === "roof_tiles" || config.tileManufacturer || config.tileRange || config.tileProductCode) return "In Progress";
    return "Not Started";
  };
  const roofingCardTone = (status) => status === "Complete" ? "complete" : status === "In Progress" ? "active" : "";
  const returnToRoofingHome = (nextConfig = config) => {
    const nextAccessoriesComplete = Boolean(nextConfig.fasciaProductCode && nextConfig.gutterProductCode && nextConfig.downpipeProductCode);
    const nextColorbondComplete = Boolean(nextConfig.roofType === "metal_roofing" && nextConfig.profileProductCode && nextConfig.colour && nextConfig.finish);
    const nextRoofTilesComplete = Boolean(nextConfig.roofType === "roof_tiles" && nextConfig.tileManufacturer && nextConfig.tileRange && nextConfig.tileProductCode && nextConfig.finish);
    if (nextAccessoriesComplete && (nextColorbondComplete || nextRoofTilesComplete)) {
      onSelectRoofingConfiguration(requirement, nextConfig);
      return;
    }
    onRoofingModeChange("");
    onRoofingStepChange("landing");
  };
  const roofingHomeCards = [
    {
      key: "fascia-gutter",
      label: "Fascia & Gutter",
      description: "Select fascia, gutters and downpipes for the roofing package.",
      image: FASCIA_GUTTER_VISUAL_URL,
      onOpen: () => {
        onRoofingModeChange("fascia-gutter");
        onRoofingStepChange("fascia");
      },
    },
    {
      key: "colorbond",
      label: "COLORBOND Roofing",
      description: "Choose the COLORBOND steel profile, colour and finish.",
      image: selectedProfileImage || roofingImageForProducts(products, requirement),
      onOpen: () => {
        onRoofingModeChange("colorbond");
        onRoofingConfigurationChange((current) => ({ ...(current || {}), roofType: "metal_roofing", tileManufacturer: "", tileRange: "", tileProductCode: "" }));
        onRoofingStepChange("profile");
      },
    },
    {
      key: "roof-tiles",
      label: "Roof Tiles",
      description: "Choose manufacturer, range, tile colour and finish.",
      image: selectedTile ? roofingProfileImage(selectedTile, requirement) : ROOF_TILE_VISUAL_URL,
      onOpen: () => {
        onRoofingModeChange("roof-tiles");
        onRoofingConfigurationChange((current) => ({ ...(current || {}), roofType: "roof_tiles", productSystem: "", profileProductCode: "", colour: "", finish: "" }));
        onRoofingStepChange("tileManufacturer");
      },
    },
  ];
  const progressSteps = roofingMode === "fascia-gutter"
    ? [
      ["fascia", "Fascia", config.fasciaProductCode],
      ["gutters", "Gutters", config.gutterProductCode],
      ["downpipes", "Downpipes", config.downpipeProductCode],
    ]
    : roofingMode === "roof-tiles"
      ? [
        ["tileManufacturer", "Manufacturer", config.tileManufacturer],
        ["tileRange", "Range", config.tileRange],
        ["tileProduct", "Tile / Colour", config.tileProductCode],
        ["tileFinish", "Finish", config.finish],
      ]
      : [
        ["profile", "Profile", config.profileProductCode],
        ["colour", "Colour", config.colour],
        ["finish", "Finish", config.finish],
      ];

  if (!roofingMode || roofingStep === "landing") {
    return (
      <section className="guidedShell" data-testid="guided-roofing-workflow" data-roofing-home-cards="fascia-gutter colorbond roof-tiles">
        <GuidedBudgetDock totals={runningTotals} />
        <main className="guidedProductPanel roofingShowroom" data-testid="roofing-package-home">
          <div className="guidedSectionHeader">
            <span>Exterior / Roofing</span>
            <strong>Choose a roofing package section.</strong>
            <em>Complete Fascia & Gutter, COLORBOND Roofing or Roof Tiles independently.</em>
          </div>
          <div className="roofingChoiceGrid roofingVisualGrid" data-testid="roofing-three-card-home">
            {roofingHomeCards.map((card) => {
              const status = roofingCardStatus(card.key);
              return (
                <button key={card.key} type="button" className={`roofingVisualCard ${roofingCardTone(status)}`} onClick={card.onOpen}>
                  <span className="roofingVisualImage" style={{ backgroundImage: `url(${card.image})` }} />
                  <span className="roofingCardBody">
                    <strong>{card.label}</strong>
                    <span>{card.description}</span>
                    <em>{status}</em>
                    <b>{status === "Not Started" ? "Start" : "Open"}</b>
                  </span>
                </button>
              );
            })}
          </div>
        </main>
      </section>
    );
  }

  return (
    <section className="guidedShell" data-testid="guided-roofing-workflow" data-roofing-package-steps={progressSteps.map(([step]) => step).join(" ")}>
      <GuidedBudgetDock totals={runningTotals} />
      <div className="guidedProductLayout roofingLayout">
        <aside className="guidedProgressMenu" data-testid="guided-roofing-hierarchy">
          <h2>Roofing</h2>
          {progressSteps.map(([step, label, value]) => (
            <button key={step} type="button" className={`guidedProgressItem ${roofingStep === step ? "active" : ""} ${value ? "complete" : ""}`} onClick={() => onRoofingStepChange(step)}>
              <GuidedStatusDot status={value ? "complete" : "not_started"} />
              <RoofingProgressThumb step={step} config={config} profile={selectedProfile} colour={selectedColour} finish={selectedFinish} products={products} requirement={requirement} />
              <span>{label}</span>
            </button>
          ))}
        </aside>
        <main className="guidedProductPanel roofingShowroom">
          <div className="guidedSectionHeader">
            <span>Exterior / Roofing</span>
            <strong>{roofingHeaderForStep(roofingStep)}</strong>
            <em>{roofingMode === "fascia-gutter" ? "Fascia, gutters and downpipes complete this section." : "Return to Roofing after completing this section."}</em>
          </div>

          {["fascia", "gutters", "downpipes"].includes(roofingStep) ? (
            <div className="roofingProfileGrid" data-testid={`roofing-accessory-${roofingStep}-step`}>
              {(roofingStep === "fascia" ? fasciaProducts : roofingStep === "gutters" ? gutterProducts : downpipeProducts).map((accessory) => {
                const isSelected = (
                  (roofingStep === "fascia" && config.fasciaProductCode === accessory.productCode) ||
                  (roofingStep === "gutters" && config.gutterProductCode === accessory.productCode) ||
                  (roofingStep === "downpipes" && config.downpipeProductCode === accessory.productCode)
                );
                return (
                  <button key={accessory.id || accessory.productCode} type="button" className={isSelected ? "selected" : ""} onClick={() => {
                    const nextConfig = {
                      ...config,
                      ...(roofingStep === "fascia" ? { fasciaProductCode: accessory.productCode } : {}),
                      ...(roofingStep === "gutters" ? { gutterProductCode: accessory.productCode } : {}),
                      ...(roofingStep === "downpipes" ? { downpipeProductCode: accessory.productCode } : {}),
                    };
                    onRoofingConfigurationChange(nextConfig);
                    if (roofingStep === "fascia") onRoofingStepChange("gutters");
                    if (roofingStep === "gutters") onRoofingStepChange("downpipes");
                    if (roofingStep === "downpipes") returnToRoofingHome(nextConfig);
                  }}>
                    <img src={roofingProfileImage(accessory, requirement)} alt={accessory.productName} />
                    <span className="roofingProfileBody">
                      <small>{roofingAccessoryLabel(roofingStep)} / {accessory.supplier || accessory.manufacturer}</small>
                      <strong>{accessory.productName}</strong>
                      <em>{accessory.profile || accessory.model || accessory.range}</em>
                      <b>{accessory.colour || config.colour || "Match roof colour"} / {accessory.finish || "COLORBOND steel"}</b>
                      <i>{isSelected ? "Selected" : roofingStep === "downpipes" ? "Complete Section" : "Select"}</i>
                    </span>
                  </button>
                );
              })}
              {!(roofingStep === "fascia" ? fasciaProducts : roofingStep === "gutters" ? gutterProducts : downpipeProducts).length ? (
                <GuidedRoofingEmptyCatalogue message={`${roofingAccessoryLabel(roofingStep)} catalogue awaiting product data`} masterProductCount={masterProductCount} />
              ) : null}
            </div>
          ) : config.roofType === "roof_tiles" ? (
            !tileManufacturers.length ? (
              <GuidedRoofingEmptyCatalogue message="Roof tile catalogue awaiting product data" masterProductCount={masterProductCount} />
            ) : roofingStep === "tileManufacturer" ? (
              <div className="roofingChoiceGrid roofingVisualGrid" data-testid="roofing-tile-manufacturer-step">
                {tileManufacturers.map((manufacturer) => (
                  <button key={manufacturer.key} type="button" className={`roofingVisualCard ${config.tileManufacturer === manufacturer.label ? "selected" : ""}`} onClick={() => {
                    setConfig({ tileManufacturer: manufacturer.label, tileRange: "", tileProductCode: "", colour: "", finish: "" });
                    onRoofingStepChange("tileRange");
                  }}>
                    <span className="roofingVisualImage" style={{ backgroundImage: `url(${manufacturer.image})` }} />
                    <span className="roofingCardBody">
                      <small>Roof Tiles</small>
                      <strong>{manufacturer.label}</strong>
                      <span>{manufacturer.count} QLD-compatible tile colour/product option{manufacturer.count === 1 ? "" : "s"}.</span>
                      <b>{config.tileManufacturer === manufacturer.label ? "Selected" : "Select"}</b>
                    </span>
                  </button>
                ))}
              </div>
            ) : roofingStep === "tileRange" ? (
              <div className="roofingProfileGrid" data-testid="roofing-tile-range-step">
                {tileRanges.map((range) => (
                  <button key={range.key} type="button" className={config.tileRange === range.label ? "selected" : ""} onClick={() => {
                    setConfig({ tileRange: range.label, tileProductCode: "", colour: "", finish: "" });
                    onRoofingStepChange("tileProduct");
                  }}>
                    <img src={range.image} alt={range.label} />
                    <span className="roofingProfileBody">
                      <small>{range.manufacturer}</small>
                      <strong>{range.label}</strong>
                      <em>{range.material} / {range.collection}</em>
                      <b>{range.count} colour/product option{range.count === 1 ? "" : "s"}</b>
                      <i>{config.tileRange === range.label ? "Selected" : "Select"}</i>
                    </span>
                  </button>
                ))}
              </div>
            ) : roofingStep === "tileFinish" ? (
              <div className="roofingSelectionSummary" data-testid="roofing-tile-finish-step">
                <img src={roofingProfileImage(selectedTile, requirement)} alt={selectedTile ? selectedTile.productName : "Selected roof tile"} />
                <div className="roofingSummaryDetails">
                  <strong>Roof Tile Selection</strong>
                  <dl>
                    <div><dt>Roof Type</dt><dd>Roof Tiles</dd></div>
                    <div><dt>Manufacturer</dt><dd>{selectedTile?.manufacturer || config.tileManufacturer || "Choose manufacturer"}</dd></div>
                    <div><dt>Range</dt><dd>{selectedTile?.range || config.tileRange || "Choose range"}</dd></div>
                    <div><dt>Colour</dt><dd>{selectedTile?.colour || config.colour || "Choose tile colour"}</dd></div>
                    <div><dt>Finish</dt><dd>{selectedTile?.finish || config.finish || "Manufacturer finish"}</dd></div>
                    <div><dt>Fascia</dt><dd>{selectedFascia?.productName || "Choose fascia"}</dd></div>
                    <div><dt>Gutters</dt><dd>{selectedGutter?.productName || "Choose gutters"}</dd></div>
                    <div><dt>Downpipes</dt><dd>{selectedDownpipe?.productName || "Choose downpipes"}</dd></div>
                  </dl>
                </div>
                <button type="button" className="primary" disabled={!canSelect} onClick={() => returnToRoofingHome(config)}>Complete Section</button>
              </div>
            ) : (
              <div className="roofingProfileGrid" data-testid="roofing-tile-product-step">
                {tileProducts.map((tile) => {
                  const priceState = priceStateForGuidedOption(tile);
                  const allowance = numberValue(tile.allowance ?? requirement.defaultAllowance);
                  const selectedPrice = priceState === PRICE_STATES.current ? numberValue(tile.selectedCost) : 0;
                  const variation = priceState === PRICE_STATES.current ? variationFor({ selectedPrice, allowance, quantity: requirement.defaultQuantity || 1 }) : 0;
                  return (
                    <button key={tile.id} type="button" className={config.tileProductCode === tile.productCode ? "selected" : ""} onClick={() => {
                      setConfig({ tileProductCode: tile.productCode, colour: tile.colour || "", finish: tile.finish || "Manufacturer finish" });
                      onRoofingStepChange("tileFinish");
                    }}>
                      <img src={roofingProfileImage(tile, requirement)} alt={tile.productName} />
                      <span className="roofingProfileBody">
                        <small>{tile.manufacturer} / {tile.range}</small>
                        <strong>{tile.colour || tile.productName}</strong>
                        <em>{tile.material} / {tile.profile || "Roof tile"}</em>
                        <b>{priceState === PRICE_STATES.current ? `${money(selectedPrice)} selected / ${signedMoney(variation)}` : "Price Pending / Builder Price Required"}</b>
                        <i>{config.tileProductCode === tile.productCode ? "Selected" : "Select"}</i>
                      </span>
                    </button>
                  );
                })}
              </div>
            )
          ) : !products.length ? (
            <GuidedRoofingEmptyCatalogue message={masterProductCount && !enabledProductCount ? "No roofing products are enabled for this builder." : "Metal roofing catalogue awaiting product data"} masterProductCount={masterProductCount} />
          ) : roofingStep === "productSystem" ? (
            <div className="roofingChoiceGrid roofingVisualGrid" data-testid="roofing-system-step">
              {systems.map((system) => (
                <button key={system.key} type="button" className={`roofingVisualCard ${config.productSystem === system.key ? "selected" : ""}`} onClick={() => {
                  setConfig({ productSystem: system.key, profileProductCode: "", colour: "", finish: "" });
                  onRoofingStepChange("profile");
                }}>
                  <span className="roofingVisualImage" style={{ backgroundImage: `url(${roofingSystemImage(products, system, requirement)})` }} />
                  <span className="roofingCardBody">
                    <small>{system.materialManufacturer} material</small>
                    <strong>{system.label}</strong>
                    <span>{system.material} with {system.profileCount} compatible LYSAGHT profile{system.profileCount === 1 ? "" : "s"}.</span>
                    <b>{config.productSystem === system.key ? "Selected" : "Select"}</b>
                  </span>
                </button>
              ))}
            </div>
          ) : roofingStep === "profile" ? (
            <div className="roofingProfileGrid" data-testid="roofing-profile-step">
              {profiles.map((profile) => (
                <button key={profile.id} type="button" className={config.profileProductCode === profile.productCode ? "selected" : ""} onClick={() => {
                  setConfig({ profileProductCode: profile.productCode, colour: "", finish: "" });
                  onRoofingStepChange("colour");
                }}>
                  <img src={roofingProfileImage(profile, requirement)} alt={profile.profile || profile.productName} />
                  <span className="roofingProfileBody">
                    <small>{profile.manufacturer || "LYSAGHT"}</small>
                    <strong>{profile.profile || profile.productName}</strong>
                    <em>{profile.description || "Residential COLORBOND steel roofing profile."}</em>
                    <b>{[profile.coverWidth, profile.ribHeight, profile.minimumRoofSlope].filter(Boolean).join(" / ")}</b>
                    <i>{config.profileProductCode === profile.productCode ? "Selected" : "Select"}</i>
                  </span>
                </button>
              ))}
            </div>
          ) : roofingStep === "colour" ? (
            <div className="roofingSwatchGrid" data-testid="roofing-colour-step">
              {colours.map((colour) => (
                <button key={colour.name} type="button" className={config.colour === colour.name ? "selected" : ""} onClick={() => {
                  const finish = colour.availableFinishes.includes(config.finish) ? config.finish : colour.availableFinishes[0];
                  setConfig({ colour: colour.name, finish });
                  onRoofingStepChange("finish");
                }}>
                  <span className="roofingSwatch" style={{ backgroundColor: colour.hex }}>{config.colour === colour.name ? "\u2713" : ""}</span>
                  <strong>{colour.name}</strong>
                  <em>{colour.availableFinishes.join(" / ")}</em>
                </button>
              ))}
            </div>
          ) : (
            <div className="roofingFinishPanel" data-testid="roofing-finish-step">
              <div className="roofingChoiceGrid">
                {finishes.map((finish) => (
                  <button key={finish.name} type="button" className={config.finish === finish.name ? "selected" : ""} onClick={() => setConfig({ finish: finish.name })}>
                    <span className={`roofingFinishSample ${slug(finish.name)}`} style={roofingFinishStyle(selectedColour, finish)} />
                    <strong>{finish.name}</strong>
                    <span>{finish.description}</span>
                  </button>
                ))}
              </div>
              <div className="roofingSelectionSummary">
                <img src={selectedProfileImage} alt={selectedProfile ? selectedProfile.profile || selectedProfile.productName : "Selected roofing"} />
                <div className="roofingSummaryDetails">
                  <strong>Roofing Selection</strong>
                  <dl>
                    <div><dt>Roof Type</dt><dd>{config.roofType === "metal_roofing" ? "Metal Roofing" : "Roof Tiles"}</dd></div>
                    <div><dt>System</dt><dd>{selectedSystem?.label || "Choose system"}</dd></div>
                    <div><dt>Profile</dt><dd>{selectedProfile ? selectedProfile.profile || selectedProfile.productName : "Choose profile"}</dd></div>
                    <div><dt>Colour</dt><dd><span className="roofingSummarySwatch" style={{ backgroundColor: selectedColour?.hex || "#d8dee8" }} />{selectedColour?.name || "Choose colour"}</dd></div>
                    <div><dt>Finish</dt><dd>{selectedFinish?.name || "Choose finish"}</dd></div>
                    <div><dt>Allowance</dt><dd>{money(selectedAllowance)}</dd></div>
                    <div><dt>Selected Price</dt><dd>{selectedPriceState === PRICE_STATES.current ? money(selectedProfile?.selectedCost) : PRICE_STATES.quoteRequired}</dd></div>
                    <div><dt>Variation</dt><dd>{selectedPriceState === PRICE_STATES.current ? signedMoney(selectedVariation) : "Pending"}</dd></div>
                  </dl>
                </div>
                <button type="button" className="primary" disabled={!canSelect} onClick={() => returnToRoofingHome(config)}>Complete Section</button>
              </div>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}

function GuidedRoofingEmptyCatalogue({ message = "Metal roofing catalogue awaiting product data", masterProductCount = 0 }) {
  return (
    <div className="guidedEmptyCatalogue" data-testid="guided-roofing-empty-catalogue">
      <strong>{message}</strong>
      <span>{masterProductCount ? "Master Catalogue has roofing products, but this builder has not enabled them yet." : "Import official roofing catalogue records before client selection."}</span>
      <div>
        <button type="button" onClick={() => { window.location.href = "/modules/builders/product-library?area=exterior&category=exterior-roofing&family=roofing"; }}>Manage Roofing Catalogue</button>
      </div>
    </div>
  );
}

function RoofingProgressThumb({ step, config, profile, colour, finish, products, requirement }) {
  if (step === "roofType" && config.roofType) {
    const image = roofingRoofTypeCards(products, requirement).find((card) => card.key === config.roofType)?.image || requirementImage(requirement);
    return <span className="roofingProgressThumb image" style={{ backgroundImage: `url(${image})` }} />;
  }
  if (step === "tileManufacturer" && config.tileManufacturer) {
    const image = roofingTileManufacturers(products).find((item) => item.label === config.tileManufacturer)?.image || requirementImage(requirement);
    return <span className="roofingProgressThumb image" style={{ backgroundImage: `url(${image})` }} />;
  }
  if (step === "tileRange" && config.tileRange) {
    const image = roofingTileRanges(products, config.tileManufacturer).find((item) => item.label === config.tileRange)?.image || requirementImage(requirement);
    return <span className="roofingProgressThumb image" style={{ backgroundImage: `url(${image})` }} />;
  }
  if (step === "tileProduct" && config.tileProductCode) {
    const tile = roofingProfileByCode(products, config.tileProductCode);
    return <span className="roofingProgressThumb image" style={{ backgroundImage: `url(${roofingProfileImage(tile, requirement)})` }} />;
  }
  if (step === "productSystem" && config.productSystem) {
    return <span className="roofingProgressThumb image" style={{ backgroundImage: `url(${roofingImageForProducts(products, requirement)})` }} />;
  }
  if (step === "profile" && profile) {
    return <span className="roofingProgressThumb image" style={{ backgroundImage: `url(${roofingProfileImage(profile, requirement)})` }} />;
  }
  if (step === "colour" && colour) {
    return <span className="roofingProgressThumb swatch" style={{ backgroundColor: colour.hex }} />;
  }
  if (step === "finish" && finish) {
    return <span className={`roofingProgressThumb finish ${slug(finish.name)}`} style={roofingFinishStyle(colour, finish)} />;
  }
  if (["fascia", "gutters", "downpipes"].includes(step)) {
    const productCode = step === "fascia" ? config.fasciaProductCode : step === "gutters" ? config.gutterProductCode : config.downpipeProductCode;
    const accessory = roofingAccessoryByCode(roofingAccessoryProducts(products, step), productCode);
    if (accessory) return <span className="roofingProgressThumb image" style={{ backgroundImage: `url(${roofingProfileImage(accessory, requirement)})` }} />;
  }
  return <span className="roofingProgressThumb empty" />;
}

function GuidedEmptyCatalogue({ requirement }) {
  return (
    <div className="guidedEmptyCatalogue" data-testid={`guided-empty-catalogue-${requirement.requirementKey}`}>
      <strong>No products have been added to this catalogue yet.</strong>
      <span>{requirement.label} will appear here once genuine catalogue records are imported.</span>
      <div>
        <button type="button" onClick={() => { window.location.href = "/modules/builders/product-library"; }}>Add Products</button>
        <button type="button" onClick={() => { window.location.href = "/modules/builders/product-library"; }}>Import Products</button>
      </div>
    </div>
  );
}

function GuidedRequirementRow({ requirement, selection, onOpen }) {
  const status = statusForRequirement(requirement, selection);
  const financials = guidedRequirementFinancials(requirement, selection);
  const productName = selection?.selected_product_name || "";
  const priceState = selection?.selected_details?.priceState || "";
  const selectedLabel = selection
    ? priceState && priceState !== PRICE_STATES.current
      ? `Selected ${priceState}`
      : `Selected ${money(financials.selectedPrice)}`
    : "Not selected";
  return (
    <article className={`guidedRequirementRow ${statusTone(status)}`} data-testid={`guided-requirement-${requirement.requirementKey}`}>
      <GuidedStatusDot status={status} />
      <img src={selection?.image_url || requirementImage(requirement)} alt="" />
      <div>
        <strong>{requirement.label}</strong>
        <span>{productName || "Not selected"}</span>
        {priceState && priceState !== PRICE_STATES.current ? <em>{priceState}</em> : null}
      </div>
      <div className="guidedRowMoney">
        <span>Allowance {money(financials.allowance)}</span>
        <span>{selectedLabel}</span>
        <b>{signedMoney(financials.variation)}</b>
      </div>
      <button type="button" onClick={onOpen}>{selection ? "Change" : "Select"}</button>
    </article>
  );
}

function GuidedProductCard({ requirement, product, onSelect, onViewDetails }) {
  const priceState = priceStateForGuidedOption(product);
  const selectedPrice = priceState === PRICE_STATES.current ? numberValue(product.selectedCost) : 0;
  const allowance = numberValue(product.allowance ?? requirement.defaultAllowance);
  const variation = priceState === PRICE_STATES.current ? variationFor({ selectedPrice, allowance, quantity: requirement.defaultQuantity || 1 }) : 0;
  const isBrick = requirement.requirementKey === "bricks";
  const finishLabel = displayCatalogueValue(product.finish) || "Finish to be confirmed";
  const brickFinishLabel = [product.colour, product.texture, product.finish].map(displayCatalogueValue).filter(Boolean).join(" / ") || "Brick colour and texture to be confirmed";
  return (
    <article className={`guidedProductCard ${isBrick ? "brickCard" : ""}`} data-testid={`guided-product-${slug(product.productName)}`} data-family-key={requirement.familyKey}>
      <img src={product.imageUrl || requirementImage(requirement)} alt={product.productName} />
      <div>
        <span>{product.brand || product.supplier}</span>
        <strong>{product.productName}</strong>
        <em>{isBrick ? product.range || "Range not recorded" : `Model ${product.model || "not recorded"}`}</em>
        <p>{isBrick ? brickFinishLabel : finishLabel}</p>
        {isBrick && product.dimensions ? <small>{displayCatalogueValue(product.dimensions)}</small> : null}
        {product.imageReviewRequired ? <small>Image review required</small> : null}
      </div>
      <div className="guidedProductMoney">
        <GuidedMiniTotal label="Price" value={priceState === PRICE_STATES.current ? money(selectedPrice) : priceState} tone={priceState === PRICE_STATES.current ? "" : "warn"} />
        <GuidedMiniTotal label="Allowance" value={money(allowance)} />
        <GuidedMiniTotal label={variation < 0 ? "Credit" : "Upgrade"} value={signedMoney(variation)} tone={variation > 0 ? "bad" : variation < 0 ? "good" : ""} />
      </div>
      <div className="guidedProductActions">
        <button type="button" onClick={onViewDetails}>View Details</button>
        <button type="button" disabled={!product.productUrl} onClick={() => product.productUrl && window.open(product.productUrl, "_blank", "noopener,noreferrer")}>View Product Website</button>
        <button type="button" className="primary" onClick={onSelect}>{isBrick ? "Select This Brick" : "Select"}</button>
      </div>
    </article>
  );
}

function GuidedProductDetailsModal({ requirement, product, onClose, onSelect }) {
  const priceState = priceStateForGuidedOption(product);
  const isBrick = requirement?.requirementKey === "bricks";
  const gallery = Array.from(new Set([product.imageUrl, ...(product.galleryImages || [])].filter(Boolean)));
  const dimensionsLabel = displayCatalogueValue(product.dimensions || product.size) || "To be confirmed";
  const textureLabel = displayCatalogueValue(product.texture) || "To be confirmed";
  const finishLabel = displayCatalogueValue(product.finish) || "To be confirmed";
  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div className="guidedDetailsModal" onClick={(event) => event.stopPropagation()} data-testid="guided-product-details">
        <button type="button" onClick={onClose}>{isBrick ? "Back to Bricks" : "Close"}</button>
        <img src={product.imageUrl} alt={product.productName} />
        {gallery.length > 1 ? (
          <div className="guidedDetailsGallery">
            {gallery.map((image) => <img key={image} src={image} alt="" />)}
          </div>
        ) : null}
        <span>{product.brand}</span>
        <h2>{product.productName}</h2>
        <p>{product.description}</p>
        <dl>
          <div><dt>Model</dt><dd>{product.model || "To be confirmed"}</dd></div>
          <div><dt>Range</dt><dd>{product.range || "To be confirmed"}</dd></div>
          <div><dt>Dimensions</dt><dd>{dimensionsLabel}</dd></div>
          <div><dt>Texture</dt><dd>{textureLabel}</dd></div>
          <div><dt>Colour / Finish</dt><dd>{finishLabel}</dd></div>
          <div><dt>Supplier</dt><dd>{product.supplier || "To be confirmed"}</dd></div>
          <div><dt>Price</dt><dd>{priceState === PRICE_STATES.current ? money(product.selectedCost) : priceState}</dd></div>
          <div><dt>Allowance</dt><dd>{money(product.allowance)}</dd></div>
        </dl>
        <div className="guidedProductActions">
          <button type="button" className="primary" onClick={onSelect}>{isBrick ? "Select This Brick" : "Select"}</button>
          <button type="button" disabled={!product.productUrl} onClick={() => product.productUrl && window.open(product.productUrl, "_blank", "noopener,noreferrer")}>View Official Product Page</button>
          <button type="button" disabled={!product.specificationUrl} onClick={() => product.specificationUrl && window.open(product.specificationUrl, "_blank", "noopener,noreferrer")}>Specification link</button>
        </div>
      </div>
    </div>
  );
}

function BrickCatalogueImportModal({
  requirement,
  preview,
  result,
  enablementSelection,
  masterProducts = [],
  builderEnablements = [],
  organisationId = "",
  onEnablementSelectionChange,
  onFile,
  onCommit,
  onEnableSelected,
  onSetProductEnabled,
  onSetProductsEnabled,
  onClose,
}) {
  const rows = preview?.preview?.rows || [];
  const errors = rows.reduce((total, row) => total + row.issues.filter((issue) => issue.severity === "error").length, 0);
  const warnings = rows.reduce((total, row) => total + row.issues.filter((issue) => issue.severity !== "error").length, 0);
  const regions = Array.from(new Set(rows.flatMap((row) => row.record.regions || []))).sort();
  const enableRows = result ? rows.filter((row) => row.valid).map((row) => row.record) : [];
  const suppliers = Array.from(new Set(enableRows.map((product) => product.supplier || product.manufacturer).filter(Boolean))).sort();
  const ranges = Array.from(new Set(enableRows.map((product) => product.range).filter(Boolean))).sort();
  const existingSuppliers = Array.from(new Set(masterProducts.map((product) => product.supplier || product.manufacturer).filter(Boolean))).sort();
  const existingRanges = Array.from(new Set(masterProducts.map((product) => product.range).filter(Boolean))).sort();
  const enabledCodes = new Set(builderEnablements.filter((item) => item.organisationId === organisationId && item.enabled !== false && item.active !== false).map((item) => item.masterProductCode));
  const selectedSet = new Set(enablementSelection);
  const setCodes = (codes) => onEnablementSelectionChange(Array.from(new Set(codes)));
  const setExistingCodes = (products, enabled) => onSetProductsEnabled?.(products.map((product) => product.productCode), enabled);
  return (
    <div className="modalBackdrop" data-testid="brick-import-modal" onClick={onClose}>
      <section className="brickImportModal" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>IMPORT PRODUCTS</span>
            <h2>{result ? "IMPORT COMPLETE" : preview ? "IMPORT PREVIEW" : "IMPORT PRODUCTS"}</h2>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </header>

        <div className="brickImportContext">
          <strong>Catalogue Type: Master Catalogue</strong>
          <span>Product Family: {requirement?.label || "Bricks"}</span>
          <span>Area: Exterior</span>
        </div>

        {!preview ? (
          <>
            <div className="brickEnablementPanel" data-testid="brick-builder-enablement">
              <h3>MANAGE BUILDER CATALOGUE</h3>
              <p>{enabledCodes.size} of {masterProducts.length} active QLD brick products are enabled for this builder.</p>
              <div className="brickEnablementActions">
                <button type="button" onClick={() => setExistingCodes(masterProducts, true)}>Enable all visible bricks</button>
                <button type="button" onClick={() => setExistingCodes(masterProducts, false)}>Disable all visible bricks</button>
                {existingSuppliers.map((supplier) => {
                  const supplierProducts = masterProducts.filter((product) => (product.supplier || product.manufacturer) === supplier);
                  return <button key={supplier} type="button" onClick={() => setExistingCodes(supplierProducts, true)}>Enable supplier: {supplier}</button>;
                })}
                {existingRanges.map((range) => {
                  const rangeProducts = masterProducts.filter((product) => product.range === range);
                  return <button key={range} type="button" onClick={() => setExistingCodes(rangeProducts, true)}>Enable range: {range}</button>;
                })}
              </div>
              <div className="brickEnablementList">
                {masterProducts.map((product) => (
                  <label key={product.productCode}>
                    <input type="checkbox" checked={enabledCodes.has(product.productCode)} onChange={(event) => onSetProductEnabled?.(product.productCode, event.target.checked)} />
                    <span>{product.productCode}</span>
                    <strong>{product.productName}</strong>
                    <em>{product.supplier || product.manufacturer} / {product.range || "No range"}</em>
                  </label>
                ))}
              </div>
            </div>
            <label className="brickFileDrop">
              <Upload size={22} />
              <strong>Import additional brick products</strong>
              <span>Accepted: .csv or .json</span>
              <input type="file" accept=".csv,text/csv,.json,application/json" onChange={(event) => {
                onFile(event.target.files?.[0]);
                event.target.value = "";
              }} />
            </label>
          </>
        ) : (
          <>
            <div className="brickPreviewStats">
              <span>File: {preview.fileName}</span>
              <span>Product Family: Bricks</span>
              <span>Total Products: {preview.preview.totalProducts}</span>
              <span>New: {preview.preview.newProducts}</span>
              <span>Updates: {preview.preview.changedProducts}</span>
              <span>Unchanged: {preview.preview.unchangedProducts}</span>
              <span>Warnings: {warnings}</span>
              <span>Errors: {errors}</span>
              <span>Missing Images: {preview.preview.missingImage}</span>
              <span>Missing Prices: {preview.preview.missingPrice}</span>
              <span>Missing Official URLs: {preview.preview.missingOfficialUrl}</span>
              <span>Regions: {regions.join(";") || "Not supplied"}</span>
            </div>
            <div className="brickPreviewTable">
              <div className="brickPreviewHead">
                <span>Product Code</span><span>Manufacturer</span><span>Brand</span><span>Range</span><span>Product</span><span>Colour</span><span>Image</span><span>Price</span><span>Region</span><span>Status</span>
              </div>
              {rows.map((row) => (
                <div key={`${row.rowNumber}-${row.productCode}`} className={row.valid ? "brickPreviewRow" : "brickPreviewRow invalid"}>
                  <span>{row.record.productCode}</span>
                  <span>{row.record.manufacturer}</span>
                  <span>{row.record.brand || "Not set"}</span>
                  <span>{row.record.range || "Not set"}</span>
                  <span>{row.record.productName}</span>
                  <span>{row.record.colour || "Not set"}</span>
                  <span>{row.record.imageStatus}</span>
                  <span>{priceStatusLabel(row.record.priceStatus)}</span>
                  <span>{(row.record.regions || []).join(";")}</span>
                  <span>{row.issues.length ? row.issues.map((issue) => `${issue.severity}: ${issue.field}`).join(", ") : row.action}</span>
                </div>
              ))}
            </div>
            {!result ? (
              <button type="button" className="primary" disabled={errors > 0} onClick={onCommit}>IMPORT PRODUCTS</button>
            ) : (
              <div className="brickEnablementPanel" data-testid="brick-builder-enablement">
                <h3>ADD PRODUCTS TO BUILDER CATALOGUE</h3>
                <p>Created: {result.created.length} Updated: {result.updated.length} Unchanged: {result.skipped.length} Warnings: {warnings}</p>
                <div className="brickEnablementActions">
                  <button type="button" onClick={() => setCodes(enableRows.map((product) => product.productCode))}>Select All</button>
                  <button type="button" onClick={() => setCodes([])}>Clear All</button>
                  {suppliers.map((supplier) => <button key={supplier} type="button" onClick={() => setCodes(enableRows.filter((product) => (product.supplier || product.manufacturer) === supplier).map((product) => product.productCode))}>Enable entire supplier: {supplier}</button>)}
                  {ranges.map((range) => <button key={range} type="button" onClick={() => setCodes(enableRows.filter((product) => product.range === range).map((product) => product.productCode))}>Enable range: {range}</button>)}
                </div>
                <div className="brickEnablementList">
                  {enableRows.map((product) => (
                    <label key={product.productCode}>
                      <input type="checkbox" checked={selectedSet.has(product.productCode)} onChange={(event) => {
                        setCodes(event.target.checked
                          ? [...enablementSelection, product.productCode]
                          : enablementSelection.filter((code) => code !== product.productCode));
                      }} />
                      <span>{product.productCode}</span>
                      <strong>{product.productName}</strong>
                      <em>{product.supplier || product.manufacturer} / {product.range || "No range"}</em>
                    </label>
                  ))}
                </div>
                <button type="button" className="primary" disabled={!enablementSelection.length} onClick={onEnableSelected}>Enable Selected Products</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function GuidedBudgetDock({ totals }) {
  return (
    <div className="guidedBudgetDock" data-testid="guided-running-budget">
      <div>
        <span>Selections Budget</span>
        <strong>{totals.completed} / {totals.total} completed</strong>
      </div>
      <GuidedMiniTotal label="Total Allowances" value={money(totals.allowance)} />
      <GuidedMiniTotal label="Selections To Date" value={money(totals.selected)} />
      <GuidedMiniTotal label="Current Variation" value={signedMoney(totals.variation)} tone={totals.variation > 0 ? "bad" : totals.variation < 0 ? "good" : ""} />
    </div>
  );
}

function GuidedMiniTotal({ label, value, tone = "" }) {
  return (
    <div className={`guidedMiniTotal ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function GuidedStatusDot({ status }) {
  return <span className={`guidedStatusDot ${statusTone(status)}`}>{status === "complete" ? "✓" : ""}</span>;
}

function CoverPage({ cover, onLogoChange }) {
  const overlayOpacity = clamp(Number(cover.overlayOpacity), 0, 0.9, 0.72);
  const backgroundImageUrl = text(cover.backgroundImageUrl);
  const builderName = coverBuilderDisplayName(cover.builderName);
  const tagline = cover.tagline || COVER_BRAND_FALLBACK.tagline;
  const clientName = coverDisplayValue(cover.clientName, "clientName", [cover.projectName]);
  const siteAddress = coverDisplayValue(cover.siteAddress, "address");
  const suburbPostcode = coverValue(cover.suburbPostcode) || "";
  const quoteNumber = coverDisplayValue(cover.quoteNumber, "jobNumber");
  const issueDate = coverValue(cover.issueDate) || today();
  const version = coverValue(cover.version) || "1.0";
  const projectName = coverValue(cover.projectName, [clientName]) || "";
  const selectionStandard = coverValue(cover.selectionStandard) || "";
  const pageStyle = {
    "--accent": cover.accentColor || DEFAULT_BUILDER_TEMPLATE_BRAND.accentColor,
    "--cover-text": cover.textColor || "#ffffff",
    "--overlay-opacity": overlayOpacity,
    backgroundImage: backgroundImageUrl
      ? `linear-gradient(180deg, rgba(2, 8, 23, ${Math.min(0.88, overlayOpacity + 0.08)}) 0%, rgba(2, 8, 23, ${overlayOpacity}) 48%, rgba(2,8,23,0.84) 100%), url(${backgroundImageUrl})`
      : `linear-gradient(180deg, rgba(2, 8, 23, ${overlayOpacity}) 0%, rgba(2,8,23,0.88) 100%)`,
  };
  return (
    <section className="page coverPage" style={pageStyle}>
      <div className="coverBrand">
        <LogoBox src={cover.logoUrl} builderName={builderName} onLogoChange={onLogoChange} />
        <div>
          <strong>{builderName}</strong>
          <span>{tagline}</span>
        </div>
      </div>
      <div className="coverTitle">
        {projectName ? <span className="coverProject">{projectName}</span> : null}
        <span className="kicker">{cover.subtitle || "Luxury Selections Schedule"}</span>
        <h1>{coverTitleDisplay(cover.title)}</h1>
        <strong className="coverClientName">{clientName}</strong>
        <span className="coverAddress">{siteAddress}</span>
        {suburbPostcode ? <span className="coverAddress coverSuburb">{suburbPostcode}</span> : null}
      </div>
      <div className="coverMeta">
        <CoverMeta label="Job Number" value={quoteNumber} />
        <CoverMeta label="Date" value={issueDate} />
        <CoverMeta label="Selection Level" value={selectionStandard || "Builder standard"} />
        <CoverMeta label="Version" value={version} />
      </div>
      <footer>
        <span>{cover.footerText || builderName}</span>
        <span>Page 1</span>
      </footer>
    </section>
  );
}

function LogoBox({ src, builderName, onLogoChange }) {
  const [failed, setFailed] = useState(false);
  const inputId = useMemo(() => uid("logo-input"), []);
  useEffect(() => setFailed(false), [src]);
  const name = builderName || DEFAULT_BUILDER_TEMPLATE_BRAND.name;
  const effectiveSrc = src || DEFAULT_BUILDER_TEMPLATE_BRAND.logoUrl || "";
  const content = !effectiveSrc || failed
    ? <div className="coverLogoFallback">{name}</div>
    : <div className="coverLogoBox"><img src={effectiveSrc} alt={name} onError={() => setFailed(true)} /></div>;
  if (!onLogoChange) return content;
  return (
    <label className="logoUploadTarget" title="Double-click to replace builder logo" onDoubleClick={(event) => {
      event.preventDefault();
      document.getElementById(inputId)?.click();
    }}>
      {content}
      <input
        id={inputId}
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          onLogoChange(file);
        }}
      />
    </label>
  );
}

function CoverMeta({ label, value }) {
  return (
    <div className="coverMetaItem">
      <strong>{label}: {value || "Not entered"}</strong>
    </div>
  );
}

function CoverSettingsPanel({ cover, dirty, onChange, onReset, onResetFromProject }) {
  return (
    <aside className="coverSettingsPanel">
      <header>
        <div>
          <span>Cover Settings</span>
          <strong>{dirty ? "Unsaved changes" : "Saved cover"}</strong>
        </div>
        <div className="coverSettingsActions">
          <button type="button" onClick={onReset} disabled={!dirty}>Reset Unsaved</button>
          <button type="button" onClick={onResetFromProject}>Reset Cover From Project Data</button>
        </div>
      </header>
      <label>
        Background image URL
        <input value={cover.backgroundImageUrl || ""} onChange={(event) => onChange("backgroundImageUrl", event.target.value)} />
      </label>
      <label>
        Logo URL
        <input value={cover.logoUrl || ""} onChange={(event) => onChange("logoUrl", event.target.value)} />
      </label>
      <div className="coverSettingsGrid">
        <label>
          Builder name
          <input value={cover.builderName || ""} onChange={(event) => onChange("builderName", event.target.value)} />
        </label>
        <label>
          Tagline
          <input value={cover.tagline || ""} onChange={(event) => onChange("tagline", event.target.value)} />
        </label>
      </div>
      <div className="coverSettingsGrid">
        <label>
          Client
          <input value={cover.clientName || ""} onChange={(event) => onChange("clientName", event.target.value)} />
        </label>
        <label>
          Quote number
          <input value={cover.quoteNumber || ""} onChange={(event) => onChange("quoteNumber", event.target.value)} />
        </label>
      </div>
      <label>
        Site address
        <input value={cover.siteAddress || ""} onChange={(event) => onChange("siteAddress", event.target.value)} />
      </label>
      <label>
        Suburb / state / postcode
        <input value={cover.suburbPostcode || ""} onChange={(event) => onChange("suburbPostcode", event.target.value)} />
      </label>
      <label>
        Schedule title
        <textarea value={cover.title || ""} onChange={(event) => onChange("title", event.target.value)} />
      </label>
      <div className="coverSettingsGrid">
        <label>
          Subtitle
          <input value={cover.subtitle || ""} onChange={(event) => onChange("subtitle", event.target.value)} />
        </label>
        <label>
          Selection level / builder standard
          <input value={cover.selectionStandard || ""} onChange={(event) => onChange("selectionStandard", event.target.value)} />
        </label>
      </div>
      <div className="coverSettingsGrid">
        <label>
          Issue date
          <input type="date" value={cover.issueDate || ""} onChange={(event) => onChange("issueDate", event.target.value)} />
        </label>
        <label>
          Version
          <input value={cover.version || ""} onChange={(event) => onChange("version", event.target.value)} />
        </label>
      </div>
      <label>
        Footer text
        <input value={cover.footerText || ""} onChange={(event) => onChange("footerText", event.target.value)} />
      </label>
      <div className="coverSettingsGrid">
        <label>
          Overlay opacity
          <input type="range" min="0" max="0.9" step="0.05" value={cover.overlayOpacity ?? "0.72"} onChange={(event) => onChange("overlayOpacity", event.target.value)} />
          <small>{cover.overlayOpacity ?? "0.72"}</small>
        </label>
        <label>
          Accent colour
          <input type="color" value={cover.accentColor || DEFAULT_BUILDER_TEMPLATE_BRAND.accentColor} onChange={(event) => onChange("accentColor", event.target.value)} />
        </label>
      </div>
      <label>
        Text colour
        <input type="color" value={cover.textColor || "#ffffff"} onChange={(event) => onChange("textColor", event.target.value)} />
      </label>
      <p>Cover changes are kept locally and saved only when Save Progress is clicked.</p>
    </aside>
  );
}

function ProjectInfoPage({ book, details, onChange }) {
  const info = details || book.projectInfo;
  return (
    <section className="page infoPage">
      <HeaderLogo book={book} title="Project Information" page={2} />
      <div className="projectInfoHero">
        <span>Selections package</span>
        <strong>{info.selectionStandard || missingCoverField("selectionStandard")}</strong>
      </div>
      <div className="infoGrid">
        <InfoField label="Client" value={info.clientName || missingCoverField("clientName")} onChange={(value) => onChange("clientName", value)} />
        <InfoField label="Full site address" multiline value={info.fullSiteAddress || info.siteAddress || missingCoverField("fullSiteAddress")} onChange={(value) => onChange("siteAddress", value)} />
        <InfoField label="Suburb / state / postcode" value={info.suburbPostcode || missingCoverField("suburbPostcode")} onChange={(value) => onChange("suburbPostcode", value)} />
        <InfoField label="Estimator" value={info.estimatorName || "Estimator missing"} onChange={(value) => onChange("estimatorName", value)} />
        <InfoField label="Quote number" value={info.quoteNumber || missingCoverField("quoteNumber")} onChange={(value) => onChange("quoteNumber", value)} />
        <InfoField label="Job number" value={info.jobNumber || missingCoverField("jobNumber")} onChange={(value) => onChange("jobNumber", value)} />
        <InfoField label="Builder / company" value={info.builderName || missingCoverField("builderName")} onChange={(value) => onChange("builderName", value)} />
        <InfoField label="Date prepared" type="date" value={info.issueDate || today()} onChange={(value) => onChange("issueDate", value)} />
      </div>
      <div className="aboutBox">
        <strong>About This Document</strong>
        <textarea value={info.aboutDocument} onChange={(event) => onChange("aboutDocument", event.target.value)} />
      </div>
      <h3>Revision History</h3>
      <table className="revisionTable">
        <thead><tr><th>Version</th><th>Date</th><th>Description</th></tr></thead>
        <tbody>{info.revisionHistory.map((row, index) => (
          <tr key={index}>
            <td><input value={row.version} onChange={(event) => onChange("revisionHistory", replaceAt(info.revisionHistory, index, { ...row, version: event.target.value }))} /></td>
            <td><input type="date" value={row.date} onChange={(event) => onChange("revisionHistory", replaceAt(info.revisionHistory, index, { ...row, date: event.target.value }))} /></td>
            <td><input value={row.description} onChange={(event) => onChange("revisionHistory", replaceAt(info.revisionHistory, index, { ...row, description: event.target.value }))} /></td>
          </tr>
        ))}</tbody>
      </table>
      <h3>Client Approval</h3>
      <div className="signatureGrid">
        <span>Client Signature</span><span>Date</span>
        <span>Builder Representative</span><span>Date</span>
      </div>
      <PageFooter book={book} page={2} />
    </section>
  );
}

function HeaderLogo({ book, title, page }) {
  const logo = book.cover.logoUrl || DEFAULT_BUILDER_TEMPLATE_BRAND.logoUrl;
  const builderName = book.cover.builderName || DEFAULT_BUILDER_TEMPLATE_BRAND.name;
  return (
    <header className="docHeader">
      {logo ? <img src={logo} alt={builderName} /> : <div className="docHeaderLogoFallback">{builderName}</div>}
      <div>
        <h2>{title}</h2>
        <span>Version {book.cover.version} | {book.cover.issueDate}</span>
      </div>
      <strong>Page {page}</strong>
    </header>
  );
}

function InfoField({ label, value, type = "text", multiline = false, onChange }) {
  return (
    <label className="infoField">
      <span>{label}</span>
      {multiline
        ? <textarea value={value || ""} onChange={(event) => onChange(event.target.value)} />
        : <input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} />}
    </label>
  );
}

function RoomPage({ room, rooms, activeRoomId, book, pageNumber, totals, onOpenRoom, onRoomChange, onRowChange, onApplyOption, onSelectProduct, onPreviewImage, onDuplicate, onRemove }) {
  const roomUpgrade = room.rows.reduce((sum, row) => sum + numberValue(row.upgradeCost), 0);
  return (
    <section className="page roomPage contractPage">
      <main className="roomSheet">
        <header className="roomHero">
          <div>
            <input className="roomName" value={room.name} onChange={(event) => onRoomChange({ name: event.target.value })} />
            <textarea value={room.subtitle || ""} onChange={(event) => onRoomChange({ subtitle: event.target.value })} />
          </div>
          <div className="specMark">
            <strong>{String(book.templateName || "Mid Range Specification").replace("Residential", "Specification")}</strong>
            <span>{String(book.templateName || "").toLowerCase().includes("higher") ? "Elevated finishes & premium detail" : "Comfort, Quality & Value"}</span>
          </div>
          <div className="builderLogoBox">
            <img src={book.cover.logoUrl} alt="Builder logo" />
            <b>{book.cover.builderName}</b>
          </div>
        </header>

      <div className="selectionTableWrap">
        <table className="selectionTable">
          <colgroup>
            <col className="colItem" />
            <col className="colDescription" />
            <col className="colBrand" />
            <col className="colProduct" />
            <col className="colFinish" />
            <col className="colSupplier" />
            <col className="colImage" />
            <col className="colIncluded" />
            <col className="colUpgrade" />
          </colgroup>
          <thead>
            <tr>
              <th>Item</th>
              <th>Description</th>
              <th>Brand</th>
              <th>Product / Model</th>
              <th>Finish / Colour</th>
              <th>Supplier</th>
              <th>Image</th>
              <th>Included</th>
              <th>Upgrade Options</th>
            </tr>
          </thead>
          <tbody>
            {room.rows.map((row) => (
              <tr key={row.id}>
                <td className="itemCell"><span className="itemIcon">{selectionIcon(row.item)}</span><input value={row.item} onChange={(event) => onRowChange(row.id, { item: event.target.value })} /></td>
                <td><textarea value={row.description} onChange={(event) => onRowChange(row.id, { description: event.target.value })} /></td>
                <td><input value={row.brand} onChange={(event) => onRowChange(row.id, { brand: event.target.value })} /></td>
                <td>
                  <div className="productChoice">
                    <select value={row.selectedOptionId || ""} onChange={(event) => onApplyOption(row.id, event.target.value)}>
                      {(row.options?.length ? row.options : []).map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.brand} - {option.productName} {option.upgradeCost > 0 ? `+${money(option.upgradeCost)}` : "Included"}
                        </option>
                      ))}
                      {!row.options?.length && <option value="">Select product</option>}
                    </select>
                    <button className="libraryButton" onClick={() => onSelectProduct(row.id)}>Product Library</button>
                    <strong>{row.productModel || row.selectedProduct}</strong>
                  </div>
                </td>
                <td><input value={row.finishColour} onChange={(event) => onRowChange(row.id, { finishColour: event.target.value })} /></td>
                <td><input value={row.supplier} onChange={(event) => onRowChange(row.id, { supplier: event.target.value })} /></td>
                <td>
                  {row.imageUrl ? (
                    <button className="thumbButton" onClick={() => onPreviewImage({ url: row.imageUrl, alt: row.selectedProduct || row.item })}>
                      <img src={row.imageUrl} alt={row.item} />
                    </button>
                  ) : <button className="thumbButton empty" onClick={() => onSelectProduct(row.id)}>Image</button>}
                </td>
                <td>
                  <button className={`includedTick ${row.included ? "yes" : "no"}`} onClick={() => onRowChange(row.id, { included: !row.included })}>
                    {row.included ? "✓" : "-"}
                  </button>
                </td>
                <td>
                  <div className="upgradeCell">
                    <select value={row.status} onChange={(event) => onRowChange(row.id, { status: event.target.value })}>
                      {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
                    </select>
                    <span>{money(row.upgradeCost)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="notesRow">
        <div><strong>Builder Notes</strong><textarea value={room.builderNotes || ""} onChange={(event) => onRoomChange({ builderNotes: event.target.value })} /></div>
        <div><strong>Client Notes</strong><textarea value={room.clientNotes || ""} onChange={(event) => onRoomChange({ clientNotes: event.target.value })} /></div>
        <div><strong>Room Upgrade Total</strong><span>{money(roomUpgrade)}</span></div>
      </div>
      </main>

      <footer className="contractFooter">
        <span>{book.cover.builderName} Pty Ltd</span>
        <span>{book.cover.footerText}</span>
        <strong>Page {pageNumber}</strong>
      </footer>
    </section>
  );
}

function isRoomLike(name) {
  return /kitchen|laundry|bath|ensuite|powder|bedroom|living|pantry/i.test(String(name || ""));
}

function aboutTextForRoom(name) {
  if (!isRoomLike(name)) {
    return `This ${String(name || "section").toLowerCase()} schedule records the included works, selected specification, supplier allowances and upgrade options for this part of the project.`;
  }
  return `This ${String(name || "room").toLowerCase()} includes quality fixtures, fittings, finishes and inclusions selected to provide a durable, modern and easy to maintain space for your home.`;
}

function selectionIcon(value) {
  const lower = String(value || "").toLowerCase();
  if (lower.includes("tile") || lower.includes("floor")) return "▦";
  if (lower.includes("tap") || lower.includes("outlet")) return "⌁";
  if (lower.includes("toilet")) return "▱";
  if (lower.includes("light") || lower.includes("fan")) return "✧";
  if (lower.includes("door")) return "▯";
  if (lower.includes("paint")) return "◒";
  if (lower.includes("roof")) return "⌂";
  return "◇";
}

function PageFooter({ book, page, total = "" }) {
  return (
    <footer className="pageFooter">
      <span>{book.cover.builderName} | {book.cover.footerText}</span>
      {total && <span>Selection adjustment {total}</span>}
      <strong>Page {page}</strong>
    </footer>
  );
}

function Metric({ label, value, tone = "" }) {
  return (
    <div className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProductSelector({ products, categories, manufacturers, suppliers, category, search, onCategory, onSearch, onClose, onSelect }) {
  return (
    <div className="modalBackdrop">
      <div className="productModal">
        <header>
          <div>
            <h2>Select Product</h2>
            <p>Search the Builder Product Library. Selecting a product updates the row automatically.</p>
          </div>
          <button onClick={onClose}>Close</button>
        </header>
        <div className="selectorFilters">
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search products..." />
          <select value={category} onChange={(event) => onCategory(event.target.value)}>
            <option value="all">All categories</option>
            {categories.map((item) => <option key={item.id} value={item.id}>{item.category_name}</option>)}
          </select>
        </div>
        <div className="productGrid">
          {products.map((product) => (
            <button key={product.id} className="modalProductCard" onClick={() => onSelect(product)}>
              <div className="modalProductImage">{product.primary_image_url ? <img src={product.primary_image_url} alt={product.product_name} /> : "No image"}</div>
              <strong>{product.product_name}</strong>
              <span>{manufacturers.get(product.manufacturer_id) || "No brand"} | {product.model || product.sku || "No model"}</span>
              <small>{suppliers.get(product.supplier_id) || "No supplier"}</small>
              <em>{money(product.base_allowance || product.upgrade_cost)}</em>
            </button>
          ))}
          {!products.length && <p className="emptyProducts">No matching products. Add products in the Product Library.</p>}
        </div>
      </div>
    </div>
  );
}

function createDocumentBook({ project = null, snapshot = null, template = null, templateItems = [], products = [], manufacturerById = new Map(), supplierById = new Map(), categoryById = new Map() } = {}) {
  const resolved = resolveProjectFields(project, snapshot);
  const quoteNumber = resolved.quoteNumber || "";
  const issueDate = resolved.quoteDate || today();
  const projectName = resolved.projectName || "";
  const clientName = resolved.clientName || "";
  const siteAddress = resolved.siteAddress || "";
  const quality = template?.quality_level || template?.price_band || template?.template_key || "mid_range";
  const selectionStandard = resolved.selectionStandard || template?.template_name || template?.specification_name || quality || "";
  return {
    version: 3,
    documentType: "luxury_selections_book",
    templateId: template?.id || "",
    templateName: template?.template_name || template?.specification_name || "",
    cover: {
      backgroundImageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=80",
      logoUrl: resolved.builderLogo || "",
      builderName: resolved.builderName || "",
      tagline: resolved.tagline || COVER_BRAND_FALLBACK.tagline,
      kicker: "Luxury",
      subtitle: "Luxury Selections Schedule",
      title: "Inclusions & Selections Schedule",
      projectName,
      clientName,
      siteAddress,
      suburbPostcode: resolved.suburbPostcode || "",
      quoteNumber,
      issueDate,
      selectionStandard,
      version: "1.0",
      accentColor: DEFAULT_BUILDER_TEMPLATE_BRAND.accentColor,
      textColor: "#ffffff",
      overlayOpacity: "0.72",
      footerText: resolved.footerText || "",
      coverEdits: {},
    },
    projectInfo: {
      clientName,
      builderName: resolved.builderName || "",
      siteAddress,
      suburbPostcode: resolved.suburbPostcode || "",
      scheduleVersion: "Version 1.0",
      issueDate,
      estimatorName: resolved.estimatorName || "",
      quoteNumber,
      revisionNumber: "1.0",
      aboutDocument: "This Inclusions & Selections Schedule forms part of the quotation and building documentation for this project. It records the products, finishes, fixtures, fittings, allowances and selections included within the contract at the time of issue. Any changes after approval may result in a variation to the contract price.",
      revisionHistory: [{ version: "1.0", date: issueDate, description: "Original issue" }],
    },
    rooms: createRooms({ templateItems, products, manufacturerById, supplierById, categoryById, quality }),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normaliseDocumentBook(value, context) {
  if (value?.documentType === "luxury_selections_book" && Array.isArray(value.rooms)) {
    const resolved = resolveProjectFields(context?.project, context?.snapshot);
    const quality = context?.template?.quality_level || context?.template?.price_band || context?.template?.template_key || "mid_range";
    const selectionStandard = resolved.selectionStandard || context?.template?.template_name || context?.template?.specification_name || quality || "";
    const rooms = DEFAULT_ROOMS.map((roomName) => {
      const existing = value.rooms.find((room) => room.name === roomName) || value.rooms.find((room) => slug(room.name) === slug(roomName));
      const templateRows = rowsForRoomTemplate(roomName, quality, context || {});
      const existingRows = Array.isArray(existing?.rows) ? existing.rows : [];
      const rows = templateRows.map((templateRow) => {
        const match = existingRows.find((row) => slug(row.item) === slug(templateRow.item));
        if (!match) return templateRow;
        const shouldUseTemplate = !match.selectedProduct && !match.imageUrl && (!match.options || !match.options.length);
        return shouldUseTemplate ? templateRow : {
          ...templateRow,
          ...match,
          options: match.options?.length ? match.options : templateRow.options,
          imageUrl: match.imageUrl || templateRow.imageUrl,
          selectedOptionId: match.selectedOptionId || templateRow.selectedOptionId,
        };
      });
      return {
        id: existing?.id || uid("room"),
        name: existing?.name || roomName,
        subtitle: existing?.subtitle || `${roomName} selections and inclusions`,
        completed: existing?.completed || false,
        builderNotes: existing?.builderNotes || "",
        clientNotes: existing?.clientNotes || "",
        about: existing?.about || "",
        imageUrl: existing?.imageUrl || "",
        rows,
      };
    });
    const coverEdits = value.cover?.coverEdits || {};
    const editedCoverValue = (field, invalidValues = []) => coverEdits[field] ? coverValue(value.cover?.[field], invalidValues) : "";
    return {
      ...value,
      version: 3,
      cover: {
        ...value.cover,
        logoUrl: editedCoverValue("logoUrl") || resolved.builderLogo || coverValue(value.cover?.logoUrl) || "",
        builderName: editedCoverValue("builderName") || resolved.builderName || coverBuilderName(value.cover?.builderName) || "",
        tagline: editedCoverValue("tagline") || resolved.tagline || coverValue(value.cover?.tagline) || COVER_BRAND_FALLBACK.tagline,
        projectName: resolved.projectName || value.cover?.projectName || "",
        clientName: editedCoverValue("clientName", [resolved.projectName]) || resolved.clientName || coverValue(value.cover?.clientName, [resolved.projectName]) || "",
        siteAddress: editedCoverValue("siteAddress") || resolved.siteAddress || coverValue(value.cover?.siteAddress) || "",
        suburbPostcode: resolved.suburbPostcode || coverValue(value.cover?.suburbPostcode) || "",
        quoteNumber: editedCoverValue("quoteNumber") || resolved.quoteNumber || coverValue(value.cover?.quoteNumber) || "",
        issueDate: editedCoverValue("issueDate") || resolved.quoteDate || coverValue(value.cover?.issueDate) || today(),
        selectionStandard: editedCoverValue("selectionStandard") || selectionStandard || coverValue(value.cover?.selectionStandard) || "",
        subtitle: editedCoverValue("subtitle") || "Luxury Selections Schedule",
        title: editedCoverValue("title") || coverValue(value.cover?.title) || "Inclusions & Selections Schedule",
        version: editedCoverValue("version") || coverValue(value.cover?.version) || "1.0",
        footerText: editedCoverValue("footerText") || resolved.footerText || coverValue(value.cover?.footerText) || "",
        textColor: editedCoverValue("textColor") || coverValue(value.cover?.textColor) || "#ffffff",
        coverEdits,
      },
      projectInfo: {
        ...value.projectInfo,
        clientName: resolved.clientName || value.projectInfo?.clientName || "",
        builderName: resolved.builderName || value.projectInfo?.builderName || "",
        siteAddress: resolved.siteAddress || value.projectInfo?.siteAddress || "",
        suburbPostcode: resolved.suburbPostcode || value.projectInfo?.suburbPostcode || "",
        issueDate: resolved.quoteDate || value.projectInfo?.issueDate || today(),
        estimatorName: resolved.estimatorName || value.projectInfo?.estimatorName || "",
        quoteNumber: resolved.quoteNumber || value.projectInfo?.quoteNumber || "",
        revisionNumber: value.projectInfo?.revisionNumber || "1.0",
        scheduleVersion: value.projectInfo?.scheduleVersion || "Version 1.0",
        aboutDocument: value.projectInfo?.aboutDocument || "This Inclusions & Selections Schedule forms part of the quotation and building documentation for this project. It records the products, finishes, fixtures, fittings, allowances and selections included within the contract at the time of issue. Any changes after approval may result in a variation to the contract price.",
        revisionHistory: Array.isArray(value.projectInfo?.revisionHistory) && value.projectInfo.revisionHistory.length
          ? value.projectInfo.revisionHistory
          : [{ version: "1.0", date: resolved.quoteDate || today(), description: "Original issue" }],
      },
      rooms,
      updatedAt: new Date().toISOString(),
    };
  }
  return createDocumentBook(context);
}

function createRooms({ templateItems = [], products = [], manufacturerById, supplierById, categoryById, quality }) {
  const rooms = DEFAULT_ROOMS.map((name) => ({
    id: uid("room"),
    name,
    subtitle: `${name} selections and inclusions`,
    completed: false,
    builderNotes: "",
    clientNotes: "",
    rows: rowsForRoomTemplate(name, quality, { products, manufacturerById, supplierById, categoryById }),
  }));
  templateItems.forEach((item) => {
    const roomName = TEMPLATE_ROOM_MATCH[categoryKeyFromItem(item)] || roomFromItemName(item.item_name || item.default_product_name);
    const room = rooms.find((entry) => entry.name === roomName) || rooms.find((entry) => entry.name === "External");
    if (!room) return;
    const row = rowFromSpecificationItem(item, { products, manufacturerById, supplierById, categoryById });
    const exists = room.rows.some((existing) => existing.item.toLowerCase() === row.item.toLowerCase());
    if (!exists) room.rows.push(row);
  });
  return rooms.filter((room) => room.rows.length || ["Kitchen", "Main Bathroom"].includes(room.name));
}

function rowsForRoomTemplate(roomName, quality, context) {
  const names = ROOM_TEMPLATES[roomName] || ROOM_TEMPLATES[roomName.replace(/\s+\d+$/, "")] || [roomName];
  return names.map((itemName, index) => {
    const product = findDefaultProduct(itemName, quality, context.products, context.categoryById);
    return rowFromProductOrName(product, itemName, index + 1, { ...context, quality });
  });
}

function rowFromProductOrName(product, itemName, sortOrder, { manufacturerById, supplierById, categoryById, quality = "mid_range" }) {
  const fallback = optionsForItem(itemName, quality);
  if (product) {
    const allowance = numberValue(product.base_allowance);
    const selected = numberValue(product.base_allowance || product.upgrade_cost);
    const libraryOption = productOption(
      manufacturerById.get(product.manufacturer_id) || "Product Library",
      product.product_name || itemName,
      product.model || product.sku || "",
      "",
      supplierById.get(product.supplier_id) || "",
      product.description || product.product_name || "",
      allowance,
      selected,
      product.price_band || quality,
      "#d8dee8"
    );
    libraryOption.id = product.id;
    libraryOption.imageUrl = product.primary_image_url || libraryOption.imageUrl;
    libraryOption.datasheetUrl = product.datasheet_pdf_url || "";
    libraryOption.warrantyUrl = product.warranty_document_url || "";
    libraryOption.productUrl = product.product_url || "";
    return {
      id: uid("row"),
      sortOrder,
      item: itemName,
      category: categoryById.get(product.category_id) || itemName,
      productId: product.id,
      selectedOptionId: product.id,
      selectedProduct: product.product_name || "",
      description: product.description || product.product_name || "",
      brand: manufacturerById.get(product.manufacturer_id) || "",
      productModel: product.model || product.sku || "",
      finishColour: "",
      supplier: supplierById.get(product.supplier_id) || "",
      imageUrl: product.primary_image_url || "",
      included: product.standard_included !== false,
      status: product.standard_included ? "approved" : "pending",
      allowanceAmount: allowance,
      selectedCost: selected,
      upgradeCost: selected - allowance,
      datasheetUrl: product.datasheet_pdf_url || "",
      warrantyUrl: product.warranty_document_url || "",
      productUrl: product.product_url || "",
      notes: product.notes || "",
      options: [libraryOption, ...fallback.options.filter((option) => option.id !== libraryOption.id)],
    };
  }
  return rowFromOption(fallback.preferred, itemName, sortOrder, fallback.options);
}

function rowFromSpecificationItem(item, context) {
  const product = item.product_id ? context.products.find((entry) => entry.id === item.product_id) : null;
  const base = rowFromProductOrName(product, item.item_name || item.default_product_name, item.sort_order || 1, context);
  return {
    ...base,
    selectedProduct: base.selectedProduct || item.default_product_name || "",
    description: item.description || base.description,
    brand: base.brand || item.manufacturer_name || "",
    supplier: base.supplier || item.supplier_name || "",
    allowanceAmount: numberValue(item.allowance_amount || base.allowanceAmount),
    selectedCost: numberValue(item.allowance_amount || base.selectedCost),
    upgradeCost: 0,
    status: "approved",
    included: item.included !== false,
  };
}

function findDefaultProduct(itemName, quality, products, categoryById) {
  const term = String(itemName || "").toLowerCase();
  const band = String(quality || "").includes("higher") ? "higher_end" : "mid_range";
  return products.find((product) => {
    const name = `${product.product_name || ""} ${product.description || ""} ${categoryById.get(product.category_id) || ""}`.toLowerCase();
    return product.standard_included && product.price_band === band && name.includes(term.split(" ")[0]);
  }) || null;
}

function categoryKeyFromItem(item) {
  return String(item?.metadata?.category_key || item?.category_key || item?.category || "").toLowerCase();
}

function roomFromItemName(name) {
  const lower = String(name || "").toLowerCase();
  if (lower.includes("roof") || lower.includes("gutter") || lower.includes("fascia")) return "Roof";
  if (lower.includes("window") || lower.includes("door")) return "Windows";
  if (lower.includes("garage")) return "Garage";
  if (lower.includes("appliance") || lower.includes("kitchen")) return "Kitchen";
  if (lower.includes("tile") || lower.includes("toilet") || lower.includes("vanity") || lower.includes("tap")) return "Main Bathroom";
  if (lower.includes("paint")) return "Paint";
  if (lower.includes("carpet") || lower.includes("floor")) return "Flooring";
  return "External";
}

function fallbackStandardItems(quality = "mid_range") {
  const higher = String(quality).includes("higher");
  const rows = higher
    ? [
        ["Roofing", "Roofing Configuration Required", "", "", "higher_end"],
        ["Gutters", "Guttering Selection Required", "", "", "higher_end"],
        ["Windows & Sliding Doors", "Bradnam's", "Bradnam's", "Bradnam's", "higher_end"],
        ["Garage Door", "B&D Premium", "B&D", "B&D", "higher_end"],
        ["Appliances", "Bosch", "Bosch", "Appliance supplier", "higher_end"],
        ["Tapware", "Caroma Premium", "Caroma", "Plumbing supplier", "higher_end"],
        ["Toilets", "Caroma Premium", "Caroma", "Plumbing supplier", "higher_end"],
        ["Vanities", "Timberline Premium", "Timberline", "Bathroom supplier", "higher_end"],
        ["Paint", "Dulux Premium", "Dulux", "Dulux", "higher_end"],
        ["Carpet", "Godfrey Hirst Premium", "Godfrey Hirst", "Flooring supplier", "higher_end"],
        ["Tiles", "National Tiles Premium Collection", "National Tiles", "National Tiles", "higher_end"],
      ]
    : [
        ["Roofing", "Roofing Configuration Required", "", "", "mid_range"],
        ["Gutters", "Guttering Selection Required", "", "", "mid_range"],
        ["Windows & Sliding Doors", "Dowell", "Dowell", "Dowell", "mid_range"],
        ["Garage Door", "B&D", "B&D", "B&D", "mid_range"],
        ["Appliances", "Westinghouse", "Westinghouse", "Appliance supplier", "mid_range"],
        ["Tapware", "Phoenix Vivid", "Phoenix", "Plumbing supplier", "mid_range"],
        ["Toilets", "Caroma Luna", "Caroma", "Plumbing supplier", "mid_range"],
        ["Vanities", "Timberline", "Timberline", "Bathroom supplier", "mid_range"],
        ["Paint", "Dulux Wash & Wear", "Dulux", "Dulux", "mid_range"],
        ["Carpet", "Godfrey Hirst", "Godfrey Hirst", "Flooring supplier", "mid_range"],
        ["Tiles", "National Tiles Standard Collection", "National Tiles", "National Tiles", "mid_range"],
      ];
  return rows.map(([item_name, default_product_name, manufacturer_name, supplier_name, price_band], index) => ({
    id: `fallback-${slug(item_name)}-${index}`,
    item_name,
    default_product_name,
    manufacturer_name,
    supplier_name,
    price_band,
    description: `${item_name}: ${default_product_name}`,
    allowance_amount: 0,
    sort_order: index + 1,
    metadata: {},
  }));
}

function selectionTotals(book) {
  const rows = book.rooms.flatMap((room) => room.rows || []);
  return rows.reduce((total, row) => ({
    items: total.items + 1,
    included: total.included + (row.included ? 1 : 0),
    allowance: total.allowance + numberValue(row.allowanceAmount),
    selected: total.selected + numberValue(row.selectedCost),
    upgrade: total.upgrade + numberValue(row.upgradeCost),
  }), { items: 0, included: 0, allowance: 0, selected: 0, upgrade: 0 });
}

function selectionRecordPayload({ workspaceId, projectId, snapshotId, bookId, templateId, userId, room, row }) {
  const guided = row.guidedSelection || {};
  const priceState = guided.priceState || guided.priceStatus || "";
  const variationPending = Boolean(guided.variationPending || (priceState && priceState !== PRICE_STATES.current));
  const selectedPrice = variationPending ? null : numberValue(guided.selectedPrice ?? row.selectedCost);
  const variation = variationPending ? null : numberValue(guided.variation ?? row.upgradeCost);
  const selectedDetails = {
    room: room.name,
    item: row.item,
    brand: row.brand,
    model: row.productModel,
    finishColour: row.finishColour,
    selectedCost: selectedPrice,
    upgradeCost: variation,
    imageUrl: row.imageUrl,
    datasheetUrl: row.datasheetUrl,
    warrantyUrl: row.warrantyUrl,
    productUrl: row.productUrl,
    ...guided,
    selectedPrice,
    variation,
    variationAmount: variation,
    variationPending,
    priceState,
    priceStatus: priceState,
  };
  return {
    workspace_id: workspaceId,
    project_id: projectId,
    snapshot_id: snapshotId || null,
    source_quote_row_id: guided.linkedQuoteItemCode || row.sourceQuoteRowId || null,
    category: guided.area || slug(room.name) || "other",
    subcategory: guided.requirementLabel || row.item || "",
    room: guided.room || room.name,
    title: `${room.name} - ${row.item}`,
    description: row.description || row.selectedProduct || row.item,
    allowance_amount: numberValue(row.allowanceAmount),
    selected_product_name: row.selectedProduct || "",
    selected_supplier_name: row.supplier || "",
    selected_supplier_id: null,
    selected_details: selectedDetails,
    status: row.status === "approved" || row.status === "selected" ? "approved" : "pending",
    selected_at: guided.selectedAt || guided.selectionTimestamp || new Date().toISOString(),
    notes: row.notes || "",
    metadata: {
      source: "luxury_selections_book",
      selection_book_id: bookId,
      selection_book_row_id: row.id,
      inclusion_template_id: templateId || null,
      uiStatus: row.status,
      area: guided.area,
      requirementKey: guided.requirementKey,
      familyKey: guided.familyKey,
      priceState,
      priceStatus: priceState,
      variationPending,
    },
    created_by: userId,
    updated_by: userId,
    brand: guided.brand || row.brand || "",
    product_name: guided.productName || row.selectedProduct || "",
    model_number: guided.model || row.productModel || "",
    image_url: guided.imageReference || row.imageUrl || "",
    specification_url: guided.specificationUrl || guided.specificationURL || row.datasheetUrl || "",
    finish: guided.finish || row.finishColour || "",
    colour: guided.colour || "",
    included_allowance: numberValue(guided.allowance ?? row.allowanceAmount),
    client_selection_price: selectedPrice,
    calculated_client_selection_price: selectedPrice,
    variation_amount: variation,
    selection_status: row.status === "selected" || row.status === "approved" ? "selected" : "not_selected",
    is_included_selection: !variationPending && variation === 0,
    is_active: true,
  };
}

function replaceAt(rows, index, next) {
  return rows.map((row, rowIndex) => rowIndex === index ? next : row);
}

function signedMoney(value) {
  const amount = numberValue(value);
  if (!amount) return money(0);
  return `${amount > 0 ? "+" : "-"}${money(Math.abs(amount))}`;
}

function guidedSelectionsFromBook(book) {
  return ALL_GUIDED_REQUIREMENTS.map((requirement) => {
    const room = ensureGuidedRoom(book, requirement);
    const row = rowForRequirement(room, requirement);
    if (!row?.selectedProduct && !row?.guidedSelection) return null;
    const guided = row.guidedSelection || {};
    const allowance = numberValue(guided.allowance ?? row.allowanceAmount ?? requirement.defaultAllowance);
    const priceState = guided.priceState || guided.priceStatus || (numberValue(guided.selectedPrice ?? row.selectedCost) > 0 ? PRICE_STATES.current : PRICE_STATES.pending);
    const hasCurrentPrice = priceState === PRICE_STATES.current;
    const selectedPrice = hasCurrentPrice ? numberValue(guided.selectedPrice ?? row.selectedCost) : null;
    const variation = hasCurrentPrice ? numberValue(guided.variation ?? row.upgradeCost) : null;
    const complete = Boolean(row.selectedProduct || guided.productName || guided.selectedProduct || guided.configurationComplete);
    return {
      id: row.id,
      category: requirement.areaKey,
      room: requirement.areaLabel,
      title: requirement.label,
      selected_product_name: row.selectedProduct,
      product_name: row.selectedProduct,
      model_number: row.productModel,
      brand: row.brand,
      selected_supplier_name: row.supplier,
      image_url: row.imageUrl,
      included_allowance: allowance,
      allowance_amount: allowance,
      client_selection_price: selectedPrice,
      variation_amount: hasCurrentPrice ? variation : null,
      selection_status: complete ? "selected" : "not_selected",
      status: complete ? "selected" : "pending",
      is_active: true,
      selected_details: {
        ...guided,
        area: requirement.areaKey,
        room: requirement.areaLabel,
        requirementKey: requirement.requirementKey,
        requirementLabel: requirement.label,
        familyKey: requirement.familyKey,
        quantity: numberValue(guided.quantity ?? requirement.defaultQuantity) || 1,
        allowance,
        selectedPrice,
        variationAmount: hasCurrentPrice ? variation : null,
        variationPending: !hasCurrentPrice,
        priceState,
        configurationComplete: Boolean(guided.configurationComplete),
      },
      metadata: {
        source: "guided_client_selections",
        area: requirement.areaKey,
        requirementKey: requirement.requirementKey,
        familyKey: requirement.familyKey,
        approvedCsv: APPROVED_SELECTIONS_CSV_PATH,
      },
    };
  }).filter(Boolean);
}

function guidedSelectedByRequirement(selections) {
  return new Map(selections.map((selection) => [selection.selected_details.requirementKey, selection]));
}

function nextIncompleteGuidedRequirement(book, currentRequirement = null) {
  const selections = guidedSelectedByRequirement(guidedSelectionsFromBook(book));
  return nextIncompleteRequirement(applicableGuidedRequirementsForBook(book), selections, currentRequirement);
}

function pendingPriceSelections(selectionMap = new Map()) {
  return ALL_GUIDED_REQUIREMENTS
    .map((requirement) => ({ requirement, selection: selectionMap.get(requirement.requirementKey) }))
    .filter(({ selection }) => selection?.selected_details?.variationPending);
}

function guidedRequirementFinancials(requirement, selection) {
  const allowance = numberValue(selection?.selected_details?.allowance ?? requirement.defaultAllowance);
  if (!selection) return { allowance, selectedPrice: 0, variation: 0 };
  return {
    allowance,
    selectedPrice: numberValue(selection.selected_details?.selectedPrice),
    variation: numberValue(selection.selected_details?.variationAmount),
  };
}

function guidedProductsForRequirement(requirement, catalogueProducts = [], filters = {}) {
  const approvedProducts = productsForRequirement(catalogueProducts, requirement)
    .filter((product) => {
      const entity = product.metadata?.productEntity || product;
      return (entity.rowClassification || product.rowClassification || product.metadata?.rowClassification || classifyApprovedSelectionRow(entity)) === "actual_product";
    });
  return approvedProducts
    .map((product, index) => guidedProductFromCatalogue(product, requirement, index))
    .filter((product) => {
      if (requirement?.requirementKey !== "bricks") return true;
      const supplierMatch = !filters.brickSupplier || product.supplier === filters.brickSupplier || product.brand === filters.brickSupplier;
      const rangeMatch = !filters.brickRange || product.range === filters.brickRange;
      return supplierMatch && rangeMatch;
    });
}

function guidedProductFromCatalogue(product, requirement, index = 0) {
  const entity = product.metadata?.productEntity || product;
  const priceState = priceStateForProduct(entity);
  const selectedCost = priceState === PRICE_STATES.current ? productClientPrice(entity) : 0;
  const attributes = entity.attributes || {};
  const galleryImages = normaliseGalleryImages(entity.galleryImages || entity.gallery_image_urls || product.galleryImages);
  const imageUrl = requirement?.requirementKey === "roofing"
    ? galleryImages[0] || resolveSelectionImage({ product, requirement })
    : resolveSelectionImage({ product, requirement });
  return {
    ...product,
    id: product.productId || product.id || `${requirement.requirementKey}-${slug(entity.productName || entity.model || String(index))}`,
    productName: entity.productName || product.product_name || "",
    brand: entity.brand || "",
    supplier: entity.supplier || "",
    model: entity.model || "",
    range: entity.range || "",
    manufacturer: entity.manufacturer || "",
    colour: displayCatalogueValue(entity.colour),
    texture: displayCatalogueValue(entity.texture || entity.metadata?.texture),
    dimensions: displayCatalogueValue(entity.dimensions || entity.size),
    finish: displayCatalogueValue(entity.finish || entity.colour),
    profile: displayCatalogueValue(entity.profile || attributes.profile),
    material: displayCatalogueValue(entity.material || attributes.material),
    roofType: attributes.roofType || entity.configuration || "",
    coverWidth: attributes.coverWidth || "",
    ribHeight: attributes.ribHeight || "",
    minimumRoofSlope: attributes.minimumRoofSlope || "",
    size: entity.size || sizeFromOption(entity),
    description: entity.description || "",
    allowance: productAllowance(entity, requirement),
    selectedCost,
    priceState,
    imageUrl,
    productUrl: entity.officialProductURL || entity.officialProductUrl || "",
    specificationUrl: entity.specificationURL || entity.specificationUrl || "",
    galleryImages,
    rowClassification: classifyApprovedSelectionRow(entity),
    imageReviewRequired: Boolean(entity.imageReviewRequired),
    metadata: {
      ...(product.metadata || {}),
      productEntity: entity,
    },
  };
}

function roofingHeaderForStep(step) {
  if (step === "tileFinish") return "Confirm roof tile finish";
  if (step === "downpipes") return "Choose downpipes";
  if (step === "gutters") return "Choose gutters";
  if (step === "fascia") return "Choose fascia";
  if (step === "tileProduct") return "Choose roof tile colour / product";
  if (step === "tileRange") return "Choose roof tile range";
  if (step === "tileManufacturer") return "Choose roof tile manufacturer";
  if (step === "finish") return "Choose finish";
  if (step === "colour") return "Choose COLORBOND steel colour";
  if (step === "profile") return "Choose LYSAGHT profile";
  if (step === "productSystem") return "Choose manufacturer and product system";
  return "Choose roof type";
}

function roofingProductSystems(products = [], roofType = "") {
  if (roofType && roofType !== "metal_roofing") return [];
  const systems = new Map();
  products.filter((product) => (product.roofType || "metal_roofing") === "metal_roofing").forEach((product) => {
    const entity = product.metadata?.productEntity || product;
    const material = product.material || entity.material || entity.attributes?.material || "COLORBOND steel";
    const manufacturer = product.manufacturer || entity.manufacturer || "LYSAGHT";
    const brand = product.brand || entity.brand || material;
    const key = slug(`${manufacturer}-${brand}-${material}`);
    const existing = systems.get(key) || {
      key,
      label: `${manufacturer} / ${brand}`,
      material,
      materialManufacturer: entity.attributes?.materialManufacturer || "BlueScope",
      profileCount: 0,
    };
    existing.profileCount += 1;
    systems.set(key, existing);
  });
  return Array.from(systems.values()).sort((left, right) => left.label.localeCompare(right.label));
}

const ROOF_TILE_VISUAL_URL = "https://celumcsrcomaublobs.blob.core.windows.net/celum/20195_Desktop_Original.jpg";
const FASCIA_GUTTER_VISUAL_URL = "/images/product-library/roofing/fascia-gutter.jpg";

function roofingRoofTypeCards(products = [], requirement = null) {
  const tileProducts = products.filter((product) => (product.roofType || product.configuration) === "roof_tiles");
  return [
    {
      key: "metal_roofing",
      label: "Metal Roofing",
      description: "Configure COLORBOND steel roofing using compatible LYSAGHT profiles and colours.",
      image: roofingImageForProducts(products, requirement),
      awaiting: false,
    },
    {
      key: "roof_tiles",
      label: "Roof Tiles",
      description: "Configure concrete and terracotta roof tiles from official manufacturer catalogues.",
      image: ROOF_TILE_VISUAL_URL,
      awaiting: !tileProducts.length,
    },
  ];
}

function roofingImageForProducts(products = [], requirement = null) {
  return requirementImage(requirement);
}

function roofingSystemImage(products = [], system = null, requirement = null) {
  return requirementImage(requirement);
}

function roofingProfileImage(profile = null, requirement = null) {
  return profile?.imageUrl || profile?.galleryImages?.[0] || requirementImage(requirement);
}

function roofingFinishStyle(colour = null, finish = null) {
  const hex = colour?.hex || "#d8dee8";
  if (finish?.name === "Matt") {
    return {
      background: `linear-gradient(135deg, ${hex}, rgba(15, 23, 42, .18)), repeating-linear-gradient(45deg, rgba(255,255,255,.12) 0 2px, rgba(15,23,42,.08) 2px 4px)`,
      backgroundBlendMode: "multiply",
    };
  }
  return { background: `linear-gradient(135deg, ${hex}, rgba(255,255,255,.38) 46%, ${hex})` };
}

function roofingProfiles(products = [], config = {}) {
  return products
    .filter((product) => (product.roofType || "metal_roofing") === (config.roofType || "metal_roofing"))
    .filter((product) => !config.productSystem || roofingProductSystems([product], config.roofType)[0]?.key === config.productSystem)
    .sort((left, right) => String(left.profile || left.productName).localeCompare(String(right.profile || right.productName)));
}

function qldCompatible(product = {}) {
  const entity = product.metadata?.productEntity || product;
  const regions = entity.regions || product.regions || [];
  return !Array.isArray(regions) || !regions.length || regions.includes("AU") || regions.includes("QLD");
}

function roofingTileProducts(products = [], config = {}) {
  return products
    .filter((product) => (product.roofType || product.configuration) === "roof_tiles")
    .filter(qldCompatible)
    .filter((product) => !config.tileManufacturer || product.manufacturer === config.tileManufacturer)
    .filter((product) => !config.tileRange || product.range === config.tileRange)
    .sort((left, right) => String(left.range || "").localeCompare(String(right.range || "")) || String(left.colour || left.productName).localeCompare(String(right.colour || right.productName)));
}

function roofingAccessoryProducts(products = [], packageStep = "") {
  return products
    .filter((product) => product.familyKey === "roofing")
    .filter(qldCompatible)
    .filter((product) => {
      const entity = product.metadata?.productEntity || product;
      const attributes = entity.attributes || product.attributes || {};
      return attributes.roofPackageStep === packageStep || product.configuration === packageStep;
    })
    .sort((left, right) => String(left.range || "").localeCompare(String(right.range || "")) || String(left.productName || "").localeCompare(String(right.productName || "")));
}

function roofingAccessoryByCode(products = [], productCode = "") {
  return products.find((product) => product.productCode === productCode || product.id === productCode) || null;
}

function roofingAccessoryLabel(step = "") {
  if (step === "fascia") return "Fascia";
  if (step === "gutters") return "Gutters";
  if (step === "downpipes") return "Downpipes";
  return "Roofing accessory";
}

function roofingTileManufacturers(products = []) {
  const cards = new Map();
  roofingTileProducts(products).forEach((product) => {
    const label = product.manufacturer || product.supplier || "Roof Tile Supplier";
    const existing = cards.get(label) || {
      key: slug(label),
      label,
      count: 0,
      image: roofingProfileImage(product, guidedRequirementByKey("roofing")),
    };
    existing.count += 1;
    if (!existing.image || existing.image === requirementImage(guidedRequirementByKey("roofing"))) existing.image = roofingProfileImage(product, guidedRequirementByKey("roofing"));
    cards.set(label, existing);
  });
  return Array.from(cards.values()).sort((left, right) => left.label.localeCompare(right.label));
}

function roofingTileRanges(products = [], manufacturer = "") {
  const cards = new Map();
  roofingTileProducts(products, { tileManufacturer: manufacturer }).forEach((product) => {
    const label = product.range || "Roof Tile Range";
    const existing = cards.get(label) || {
      key: slug(`${product.manufacturer}-${label}`),
      label,
      manufacturer: product.manufacturer || "",
      material: product.material || "",
      collection: product.collection || "",
      count: 0,
      image: roofingProfileImage(product, guidedRequirementByKey("roofing")),
    };
    existing.count += 1;
    if (!existing.image || existing.image === requirementImage(guidedRequirementByKey("roofing"))) existing.image = roofingProfileImage(product, guidedRequirementByKey("roofing"));
    cards.set(label, existing);
  });
  return Array.from(cards.values()).sort((left, right) => left.label.localeCompare(right.label));
}

function roofingProfileByCode(products = [], productCode = "") {
  return products.find((product) => product.productCode === productCode || product.id === productCode) || null;
}

function roofingColoursForProfile(profile = null) {
  const colours = profile?.metadata?.productEntity?.attributes?.colours || profile?.attributes?.colours || [];
  return Array.isArray(colours) ? colours.map((colour) => ({
    name: colour.name || colour.officialName,
    officialName: colour.officialName || colour.name,
    hex: colour.hex || colour.swatchHex || "#d8dee8",
    availableFinishes: Array.isArray(colour.availableFinishes) && colour.availableFinishes.length ? colour.availableFinishes : ["Classic"],
  })).filter((colour) => colour.name) : [];
}

function roofingColourByName(profile = null, colourName = "") {
  return roofingColoursForProfile(profile).find((colour) => colour.name === colourName) || null;
}

function roofingFinishesForColour(colour = null) {
  if (!colour) return [];
  return colour.availableFinishes.map((finish) => ({
    name: finish,
    description: finish === "Matt" ? "Official premium Matt finish for this COLORBOND colour." : "Classic COLORBOND steel finish.",
  }));
}

function roofingFinishForColour(colour = null, finishName = "") {
  return roofingFinishesForColour(colour).find((finish) => finish.name === finishName) || null;
}

function brickSupplierOptions(products = []) {
  if (!products.length) return [];
  const suppliers = Array.from(new Set(products.map((product) => product.supplier || product.brand).filter(Boolean))).sort();
  const cards = [{ key: "all", label: "All Bricks", count: products.length, image: requirementImage(guidedRequirementByKey("bricks")) }];
  suppliers.forEach((supplier) => {
    const supplierProducts = products.filter((product) => product.supplier === supplier || product.brand === supplier);
    cards.push({ key: supplier, label: supplier, count: supplierProducts.length, image: firstProductImage(supplierProducts) });
  });
  return cards;
}

function brickRangeOptions(products = [], supplier = "") {
  const supplierProducts = supplier ? products.filter((product) => product.supplier === supplier || product.brand === supplier) : products;
  if (!supplierProducts.length) return [];
  const ranges = Array.from(new Set(supplierProducts.map((product) => product.range).filter(Boolean))).sort();
  if (!ranges.length) return [{ key: "all", label: "All Ranges", count: supplierProducts.length, image: firstProductImage(supplierProducts) }];
  return [
    { key: "all", label: "All Ranges", count: supplierProducts.length, image: firstProductImage(supplierProducts) },
    ...ranges.map((range) => {
      const rangeProducts = supplierProducts.filter((product) => product.range === range);
      return { key: range, label: range, count: rangeProducts.length, image: firstProductImage(rangeProducts) };
    }),
  ];
}

function brickProductsForStep(products = [], supplier = "", range = "", step = "suppliers") {
  if (step !== "products") return [];
  return products.filter((product) => {
    const supplierMatch = !supplier || product.supplier === supplier || product.brand === supplier;
    const rangeMatch = !range || product.range === range;
    return supplierMatch && rangeMatch;
  });
}

function brickHeaderForStep(step) {
  if (step === "products") return "Choose an actual brick";
  if (step === "ranges") return "Choose a range";
  return "Choose a supplier";
}

function firstProductImage(products = []) {
  return products.find((product) => product.imageUrl)?.imageUrl || requirementImage(guidedRequirementByKey("bricks"));
}

function normaliseGalleryImages(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return String(value).split(/[|,\n]/).map((item) => item.trim()).filter(Boolean);
}

function displayCatalogueValue(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(displayCatalogueValue).filter(Boolean).join(" / ");
  if (typeof value === "object") {
    return Object.values(value).map(displayCatalogueValue).filter(Boolean).join(" x ");
  }
  return String(value);
}

function priceStatusLabel(status) {
  if (status === "price_pending") return "Price Pending";
  if (status === "quote_required") return "Quote Required";
  if (status === "allowance_only") return "Allowance Only";
  if (status === "not_applicable") return "Not Applicable";
  if (status === "expired") return "Expired";
  return status || "Price Pending";
}

function deriveAustralianRegion(project = {}) {
  const textValue = [
    project?.site_state,
    project?.state,
    project?.site_address,
    project?.address,
    project?.suburb_postcode,
    project?.postcode,
  ].filter(Boolean).join(" ").toUpperCase();
  const match = textValue.match(/\b(QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\b/);
  return match?.[1] || "";
}

function priceStateForGuidedOption(option) {
  if (option?.priceState) return option.priceState;
  if (numberValue(option?.selectedCost) > 0) return PRICE_STATES.current;
  if (numberValue(option?.allowance) > 0) return PRICE_STATES.allowanceOnly;
  return priceStateForProduct({ priceStatus: PRICE_STATES.pending });
}

function ensureKitchenRoom(book) {
  return book?.rooms?.find((room) => slug(room.name) === "kitchen") || { id: "missing-kitchen", name: "Kitchen", rows: [] };
}

function ensureGuidedRoom(book, requirement) {
  if (requirement?.areaKey === "kitchen") return ensureKitchenRoom(book);
  const roomName = requirement?.areaLabel || titleCase(requirement?.areaKey || "Selections");
  return book?.rooms?.find((room) => slug(room.name) === slug(roomName)) || { id: `guided-${slug(roomName)}`, name: roomName, rows: [] };
}

function applicableGuidedRequirementsForBook(book = null) {
  return [
    ...requirementsForGuidedArea("kitchen", book),
    ...requirementsForGuidedArea("exterior", book),
    ...requirementsForGuidedArea("interior", book),
  ];
}

function requirementsForGuidedArea(areaKey, book = null) {
  if (areaKey === "exterior") return EXTERIOR_REQUIREMENTS.filter((requirement) => requirementAppliesToBook(requirement, book));
  if (areaKey === "interior") return INTERIOR_REQUIREMENTS;
  if (areaKey === "kitchen") return KITCHEN_REQUIREMENTS;
  return ALL_GUIDED_REQUIREMENTS.filter((requirement) => requirement.areaKey === areaKey);
}

function requirementAppliesToBook(requirement, book = null) {
  if (!requirement?.optionalWhenProjectMissing) return true;
  const rooms = Array.isArray(book?.rooms) ? book.rooms : [];
  if (!rooms.length) return false;
  const rows = rooms.flatMap((room) => Array.isArray(room.rows) ? room.rows : []);
  if (rows.some((row) => row.guidedRequirementKey === requirement.requirementKey || rowMatchesRequirement(row, requirement))) return true;
  const aliases = [requirement.requirementKey, requirement.label, requirement.familyKey, ...(requirement.projectAliases || [])].map(slug).filter(Boolean);
  const textFields = [
    book?.projectInfo?.projectName,
    book?.projectInfo?.siteAddress,
    book?.cover?.projectName,
    book?.cover?.siteAddress,
    ...rooms.flatMap((room) => [
      room.name,
      ...(Array.isArray(room.rows) ? room.rows.flatMap((row) => [
        row.item,
        row.description,
        row.selectedProduct,
        row.productModel,
        row.finishColour,
        row.supplier,
        row.notes,
      ]) : []),
    ]),
  ].map(slug).filter(Boolean);
  return textFields.some((value) => aliases.some((alias) => value.includes(alias)));
}

function rowForRequirement(room, requirement) {
  return rowsWithGuidedRequirement(room?.rows || [], requirement).find((row) => row.guidedRequirementKey === requirement.requirementKey || rowMatchesRequirement(row, requirement));
}

function rowsWithGuidedRequirement(rows, requirement) {
  const hasMatch = rows.some((row) => row.guidedRequirementKey === requirement.requirementKey || rowMatchesRequirement(row, requirement));
  if (hasMatch) {
    return rows.map((row) => row.guidedRequirementKey || !rowMatchesRequirement(row, requirement) ? row : { ...row, guidedRequirementKey: requirement.requirementKey });
  }
  return [...rows, {
    id: uid("row"),
    item: requirement.label,
    guidedRequirementKey: requirement.requirementKey,
    description: "",
    brand: "",
    selectedProduct: "",
    productModel: "",
    finishColour: "",
    supplier: "",
    imageUrl: requirementImage(requirement),
    allowanceAmount: requirement.defaultAllowance,
    selectedCost: 0,
    upgradeCost: 0,
    included: false,
    status: "pending",
    options: guidedProductsForRequirement(requirement),
  }];
}

function rowMatchesRequirement(row, requirement) {
  const key = slug(row?.item || "");
  const dynamicAliases = [requirement.requirementKey, requirement.familyKey, ...(requirement.projectAliases || [])].map(slug).filter(Boolean);
  const aliases = {
    cabinetry: ["cabinetry"],
    "cabinet-finish": ["cabinet-finish", "cabinet-doors"],
    handles: ["handles", "cabinet-handles"],
    benchtop: ["benchtop"],
    splashback: ["splashback"],
    sink: ["sink"],
    "sink-mixer": ["sink-mixer", "kitchen-tap", "tap"],
    oven: ["oven"],
    cooktop: ["cooktop"],
    rangehood: ["rangehood"],
    dishwasher: ["dishwasher"],
    microwave: ["microwave"],
    flooring: ["flooring"],
    lighting: ["lighting"],
    paint: ["paint"],
    bricks: ["bricks", "brickwork"],
    roofing: ["roof", "roofing"],
    cladding: ["cladding", "external-cladding", "feature-cladding"],
    "gutters-fascia": ["gutters-fascia", "gutters", "gutter", "fascia", "downpipes", "downpipe"],
    balustrades: ["balustrades", "balustrade", "handrails", "handrail", "balcony-rail"],
    "external-lighting": ["external-lighting", "external-lights", "exterior-lighting", "exterior-lights", "outdoor-lighting", "outdoor-lights"],
    "exterior-paint": ["exterior-paint", "external-paint", "facade-paint"],
    driveway: ["driveway", "driveway-finish", "concrete-driveway", "exposed-aggregate", "pavers"],
    decking: ["decking", "deck", "timber-deck", "composite-deck"],
    pool: ["pool", "pool-finish", "pool-tile", "pool-coping", "coping", "waterline"],
    "retaining-walls": ["retaining-walls", "retaining-wall", "sleeper-wall", "block-wall"],
    landscaping: ["landscaping", "turf", "mulch", "garden-edging", "feature-gravel"],
    "garage-door": ["garage-door", "garage-doors"],
    "entry-door": ["entry-door", "entry-doors"],
    "internal-doors": ["internal-doors", "internal-door", "door"],
  };
  return [...dynamicAliases, ...(aliases[requirement.requirementKey] || [requirement.requirementKey])].includes(key);
}

function sizeFromOption(option) {
  const match = String(`${option?.productName || ""} ${option?.model || ""}`).match(/\b\d{3,4}mm\b/i);
  return match?.[0] || "";
}

function handleGuidedBack({
  guidedScreen,
  guidedArea,
  guidedRequirement,
  guidedBrickStep,
  guidedRoofingMode,
  guidedRoofingStep,
  roofingConfiguration,
  setGuidedBrickStep,
  setGuidedBrickSupplier,
  setGuidedBrickRange,
  setGuidedRoofingMode,
  setGuidedRoofingStep,
  setRoofingConfiguration,
  setGuidedScreen,
  setGuidedArea,
  setGuidedRequirementKey,
  embedded = false,
  onEmbeddedBack = null,
}) {
  if (guidedScreen === "product") {
    if (guidedRequirement?.requirementKey === "bricks") {
      if (guidedBrickStep === "products") {
        setGuidedBrickStep("ranges");
        return;
      }
      if (guidedBrickStep === "ranges") {
        setGuidedBrickStep("suppliers");
        setGuidedBrickRange("");
        return;
      }
      setGuidedBrickSupplier("");
      setGuidedBrickRange("");
      setGuidedScreen("exterior");
      setGuidedRequirementKey("");
      return;
    }
    if (guidedRequirement?.requirementKey === "roofing") {
      if (!guidedRoofingMode || guidedRoofingStep === "landing") {
        setGuidedRoofingMode("");
        setGuidedRoofingStep("landing");
        setGuidedScreen("exterior");
        setGuidedRequirementKey("");
        return;
      }
      if (guidedRoofingMode === "fascia-gutter") {
        if (guidedRoofingStep === "downpipes") {
          setGuidedRoofingStep("gutters");
          return;
        }
        if (guidedRoofingStep === "gutters") {
          setGuidedRoofingStep("fascia");
          return;
        }
        setGuidedRoofingMode("");
        setGuidedRoofingStep("landing");
        return;
      }
      if (guidedRoofingMode === "colorbond") {
        if (guidedRoofingStep === "finish") {
          setGuidedRoofingStep("colour");
          return;
        }
        if (guidedRoofingStep === "colour") {
          setGuidedRoofingStep("profile");
          return;
        }
        setGuidedRoofingMode("");
        setGuidedRoofingStep("landing");
        return;
      }
      if (guidedRoofingMode === "roof-tiles") {
        if (guidedRoofingStep === "tileFinish") {
          setGuidedRoofingStep("tileProduct");
          return;
        }
        if (guidedRoofingStep === "tileProduct") {
          setGuidedRoofingStep("tileRange");
          return;
        }
        if (guidedRoofingStep === "tileRange") {
          setGuidedRoofingStep("tileManufacturer");
          return;
        }
        setGuidedRoofingMode("");
        setGuidedRoofingStep("landing");
        return;
      }
      if (guidedRoofingStep === "tileFinish") {
        setGuidedRoofingStep("tileProduct");
        return;
      }
      if (guidedRoofingStep === "tileProduct") {
        setGuidedRoofingStep("tileRange");
        return;
      }
      if (guidedRoofingStep === "tileRange") {
        setGuidedRoofingStep("tileManufacturer");
        return;
      }
      if (guidedRoofingStep === "tileManufacturer") {
        setGuidedRoofingStep("roofType");
        return;
      }
      if (guidedRoofingStep === "finish") {
        setGuidedRoofingStep("colour");
        return;
      }
      if (guidedRoofingStep === "colour") {
        setGuidedRoofingStep("profile");
        return;
      }
      if (guidedRoofingStep === "profile") {
        setGuidedRoofingStep("productSystem");
        return;
      }
      if (guidedRoofingStep === "productSystem") {
        setGuidedRoofingStep("roofType");
        return;
      }
      if (guidedRoofingStep === "roofType") {
        setGuidedRoofingStep("downpipes");
        return;
      }
      if (guidedRoofingStep === "downpipes") {
        setGuidedRoofingStep("gutters");
        return;
      }
      if (guidedRoofingStep === "gutters") {
        setGuidedRoofingStep("fascia");
        return;
      }
      setGuidedRoofingMode("");
      setRoofingConfiguration({ roofType: "", productSystem: "", profileProductCode: "", tileManufacturer: "", tileRange: "", tileProductCode: "", fasciaProductCode: "", gutterProductCode: "", downpipeProductCode: "", colour: "", finish: "" });
      setGuidedScreen("exterior");
      setGuidedRequirementKey("");
      return;
    }
    if (guidedRequirement?.areaKey === "exterior" || guidedArea === "exterior") {
      setGuidedScreen("exterior");
    } else if (guidedRequirement?.areaKey === "kitchen" || guidedArea === "kitchen") {
      setGuidedScreen("kitchen");
    } else {
      setGuidedScreen("interior");
    }
    setGuidedRequirementKey("");
    return;
  }
  if (guidedScreen === "kitchen") {
    setGuidedScreen("interior");
    return;
  }
  if (guidedScreen === "interior" || guidedScreen === "exterior" || guidedScreen === "review") {
    setGuidedScreen("areas");
    setGuidedArea("");
    return;
  }
  if (embedded) {
    onEmbeddedBack?.();
    return;
  }
  window.history.back();
}

const styles = `
  .screen { min-height: 100vh; display: block; background: #f5f7fb; color: #07111f; font-family: Inter, Arial, sans-serif; }
  .sidebar { background: #071827; color: #e8edf3; padding: 16px; overflow: auto; max-height: 100vh; position: sticky; top: 0; }
  .brandStrip { display: grid; grid-template-columns: 54px 1fr; gap: 10px; align-items: center; margin-bottom: 18px; }
  .brandStrip img { width: 54px; height: 44px; object-fit: contain; background: white; border-radius: 6px; }
  .brandStrip span, .sidebar label { color: #9fb2c7; font-size: 12px; }
  .sidebar label { display: grid; gap: 6px; margin-bottom: 12px; font-weight: 700; }
  select, input, textarea { width: 100%; border: 1px solid #cbd5e1; border-radius: 4px; background: white; color: #0f172a; padding: 8px 9px; font: inherit; }
  .sidebar select, .sidebar input { background: #102235; color: white; border-color: #284258; }
  .pages { display: grid; gap: 6px; margin: 16px 0; }
  button { border: 0; border-radius: 4px; background: #071827; color: white; padding: 9px 11px; font-weight: 800; cursor: pointer; }
  button:hover { filter: brightness(1.08); }
  button:disabled { opacity: .55; cursor: not-allowed; }
  .pages button { text-align: left; background: #102235; }
  .pages button.active { background: #c99735; color: #071827; }
  .roomTools { display: grid; gap: 8px; padding-top: 14px; border-top: 1px solid #244057; }
  .workspace { min-width: 0; padding: 16px 18px 28px; overflow: auto; }
  .standardBanner { display: grid; grid-template-columns: auto 48px minmax(0, 1fr) minmax(300px, auto); gap: 14px; align-items: center; width: 100%; box-sizing: border-box; margin: 0 0 12px; border: 1px solid #d7deea; background: #ffffff; border-radius: 8px; padding: 14px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
  .standardBack { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 38px; border: 1px solid #cbd5e1; border-radius: 8px; background: #ffffff; color: #172033; cursor: pointer; font-weight: 800; padding: 9px 12px; }
  .standardIcon { display: grid; width: 48px; height: 48px; place-items: center; border-radius: 8px; background: #1f6feb; color: #ffffff; }
  .standardCopy h1 { margin: 0; font-size: 48px; line-height: 1; letter-spacing: 0; }
  .standardCopy p { margin: 6px 0 0; color: #58657a; font-size: 18px; }
  .standardMeta { display: grid; gap: 6px; justify-items: end; color: #64748b; font-size: 13px; font-weight: 700; }
  .bannerActions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
  .bannerActions button { background: #ffffff; color: #071827; border: 1px solid #cbd5e1; border-radius: 7px; padding: 8px 10px; font-weight: 850; cursor: pointer; }
  .bannerActions button:first-child { background: #071827; color: #ffffff; }
  .guidedShell { display: grid; gap: 14px; width: 100%; box-sizing: border-box; }
  .guidedBudgetDock { position: sticky; top: 0; z-index: 18; display: grid; grid-template-columns: minmax(170px, .9fr) repeat(3, minmax(160px, 1fr)); gap: 10px; align-items: stretch; border: 1px solid #d7deea; background: rgba(255,255,255,.96); border-radius: 8px; padding: 12px; box-shadow: 0 8px 24px rgba(15,23,42,.06); }
  .guidedBudgetDock > div:first-child { display: grid; gap: 4px; align-content: center; color: #475569; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .04em; }
  .guidedBudgetDock > div:first-child strong { color: #071827; font-size: 18px; letter-spacing: 0; text-transform: none; }
  .guidedMiniTotal { display: grid; gap: 4px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 11px; background: #f8fafc; min-width: 0; }
  .guidedMiniTotal span { color: #64748b; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .04em; }
  .guidedMiniTotal strong { color: #071827; font-size: 17px; font-weight: 950; }
  .guidedMiniTotal.bad { border-color: #fed7aa; background: #fff7ed; }
  .guidedMiniTotal.good { border-color: #bbf7d0; background: #f0fdf4; }
  .guidedMiniTotal.warn { border-color: #fde68a; background: #fffbeb; }
  .guidedIntro { display: grid; gap: 5px; border: 1px solid #d7deea; border-radius: 8px; background: #ffffff; padding: 18px; }
  .guidedIntro span, .guidedSectionHeader span, .guidedChecklistHeader span { color: #0f766e; font-size: 12px; font-weight: 950; text-transform: uppercase; letter-spacing: .08em; }
  .guidedIntro strong, .guidedSectionHeader strong, .guidedChecklistHeader strong { color: #071827; font-size: 26px; line-height: 1.1; font-weight: 950; }
  .guidedIntro em { color: #64748b; font-style: normal; font-size: 12px; font-weight: 750; }
  .guidedCompletionPanel { display: grid; gap: 14px; border: 1px solid #bbf7d0; border-radius: 8px; background: #f0fdf4; padding: 20px; }
  .guidedCompletionPanel > span { color: #15803d; font-size: 12px; font-weight: 950; text-transform: uppercase; letter-spacing: .08em; }
  .guidedCompletionPanel > strong { color: #071827; font-size: 28px; line-height: 1.1; font-weight: 950; }
  .guidedCompletionPanel p { margin: 0; color: #475569; font-weight: 800; }
  .guidedCompletionActions { display: flex; flex-wrap: wrap; gap: 8px; }
  .guidedCompletionActions button { border: 1px solid #cbd5e1; border-radius: 8px; background: #ffffff; color: #071827; font-weight: 900; }
  .guidedCompletionActions button.primary { border-color: #0f766e; background: #0f766e; color: #ffffff; }
  .guidedAreaGrid, .guidedCategoryGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
  .guidedImageCard { min-height: 220px; position: relative; overflow: hidden; display: grid; align-content: end; gap: 6px; border: 1px solid #d7deea; border-radius: 8px; padding: 16px; background: #071827; color: #ffffff; text-align: left; box-shadow: 0 12px 28px rgba(15,23,42,.12); }
  .guidedImageCard img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .78; }
  .guidedImageCard::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(7,24,39,.05), rgba(7,24,39,.82)); }
  .guidedImageCard span, .guidedImageCard small { position: relative; z-index: 1; }
  .guidedImageCard span { font-size: 28px; font-weight: 950; }
  .guidedImageCard small { color: #e2e8f0; font-size: 14px; font-weight: 750; }
  .guidedChecklistHeader { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; border: 1px solid #d7deea; border-radius: 8px; background: #ffffff; padding: 16px; }
  .guidedTotals { display: grid; grid-template-columns: repeat(3, minmax(140px, 1fr)); gap: 8px; min-width: 460px; }
  .guidedChecklistRows { display: grid; gap: 10px; }
  .guidedRequirementRow { display: grid; grid-template-columns: 28px 76px minmax(180px, 1fr) minmax(170px, .75fr) auto; gap: 12px; align-items: center; border: 1px solid #d7deea; border-radius: 8px; background: #ffffff; padding: 12px; }
  .guidedRequirementRow.green { border-color: #86efac; background: #f0fdf4; }
  .guidedRequirementRow.amber { border-color: #fde68a; background: #fffbeb; }
  .guidedRequirementRow.red { border-color: #fecaca; background: #fff1f2; }
  .guidedRequirementRow img { width: 76px; height: 58px; object-fit: cover; border-radius: 8px; background: #e2e8f0; }
  .guidedRequirementRow div:nth-child(3) { display: grid; gap: 4px; min-width: 0; }
  .guidedRequirementRow div:nth-child(3) strong { font-size: 17px; font-weight: 950; }
  .guidedRequirementRow div:nth-child(3) span { color: #475569; font-weight: 750; }
  .guidedRequirementRow div:nth-child(3) em { color: #92400e; font-style: normal; font-size: 12px; font-weight: 850; }
  .guidedRowMoney { display: grid; gap: 4px; color: #475569; font-size: 13px; font-weight: 800; }
  .guidedRowMoney b { color: #071827; font-size: 15px; }
  .guidedRequirementRow button { border-radius: 8px; background: #0f766e; color: #ffffff; }
  .guidedStatusDot { width: 24px; height: 24px; border: 2px solid #cbd5e1; border-radius: 999px; display: inline-grid; place-items: center; font-size: 13px; font-weight: 950; background: #f1f5f9; color: #64748b; }
  .guidedStatusDot.green { border-color: #22c55e; background: #dcfce7; color: #15803d; }
  .guidedStatusDot.amber { border-color: #f59e0b; background: #fef3c7; color: #92400e; }
  .guidedStatusDot.red { border-color: #ef4444; background: #fee2e2; color: #b91c1c; }
  .guidedProductLayout { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 14px; align-items: start; }
  .guidedProgressMenu { position: sticky; top: 92px; display: grid; gap: 6px; border: 1px solid #d7deea; background: #ffffff; border-radius: 8px; padding: 12px; }
  .guidedProgressMenu h2 { margin: 0 0 6px; font-size: 20px; font-weight: 950; }
  .guidedProgressItem { display: flex; align-items: center; gap: 9px; border: 1px solid transparent; border-radius: 8px; background: #ffffff; color: #071827; text-align: left; padding: 8px; font-weight: 850; }
  .guidedProgressItem.active { border-color: #bfdbfe; background: #eff6ff; color: #1d4ed8; }
  .guidedProgressItem:disabled { opacity: .55; cursor: not-allowed; }
  .guidedProductPanel { display: grid; gap: 12px; border: 1px solid #d7deea; background: #ffffff; border-radius: 8px; padding: 16px; }
  .guidedSectionHeader { display: grid; gap: 5px; }
  .guidedSupplierGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
  .guidedSupplierCard { display: grid; gap: 10px; text-align: left; border: 1px solid #d7deea; background: #ffffff; border-radius: 8px; padding: 0 0 14px; overflow: hidden; color: #071827; cursor: pointer; }
  .guidedSupplierCard img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; background: #e2e8f0; }
  .guidedSupplierCard span { padding: 0 14px; color: #071827; font-size: 20px; font-weight: 950; }
  .guidedSupplierCard strong { padding: 0 14px; color: #64748b; font-size: 13px; font-weight: 850; }
  .guidedEmptyCatalogue { display: grid; gap: 10px; align-content: center; justify-items: start; min-height: 260px; border: 1px dashed #cbd5e1; background: #f8fafc; border-radius: 8px; padding: 26px; }
  .guidedEmptyCatalogue strong { color: #071827; font-size: 24px; font-weight: 950; }
  .guidedEmptyCatalogue span { color: #475569; font-weight: 750; }
  .guidedEmptyCatalogue div { display: flex; gap: 8px; flex-wrap: wrap; }
  .guidedEmptyCatalogue button { width: auto; border: 1px solid #0f766e; background: #0f766e; color: #ffffff; border-radius: 8px; padding: 10px 13px; font-weight: 900; }
  .guidedEmptyCatalogue button + button { background: #ffffff; color: #0f766e; }
  .brickContextBar { border: 1px solid #d7deea; background: #f8fafc; border-radius: 8px; padding: 10px 12px; color: #334155; font-weight: 900; }
  .guidedProductGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 14px; }
  .brickProductGrid { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
  .guidedProductCard { display: grid; gap: 12px; border: 1px solid #d7deea; border-radius: 8px; overflow: hidden; background: #ffffff; }
  .guidedProductCard > img { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; background: #e2e8f0; }
  .guidedProductCard.brickCard > img { aspect-ratio: 4 / 3; }
  .guidedProductCard > div { padding: 0 13px; }
  .guidedProductCard span { color: #64748b; font-size: 13px; font-weight: 850; }
  .guidedProductCard strong { display: block; color: #071827; font-size: 18px; font-weight: 950; margin-top: 3px; }
  .guidedProductCard em { display: block; color: #475569; font-style: normal; font-size: 13px; font-weight: 800; margin-top: 3px; }
  .guidedProductCard p { margin: 8px 0 0; color: #334155; font-size: 14px; font-weight: 700; }
  .guidedProductMoney { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px; }
  .guidedProductActions { display: flex; gap: 8px; flex-wrap: wrap; padding: 0 13px 13px; }
  .guidedProductActions button { border-radius: 8px; background: #ffffff; color: #071827; border: 1px solid #cbd5e1; }
  .guidedProductActions button.primary { background: #0f766e; color: #ffffff; border-color: #0f766e; }
  .guidedProductActions button:disabled { opacity: 0.55; cursor: not-allowed; }
  .roofingLayout .guidedSectionHeader em { color: #64748b; font-style: normal; font-size: 12px; font-weight: 750; }
  .roofingLayout .guidedProgressItem.complete { border-color: #bbf7d0; background: #f0fdf4; color: #166534; }
  .roofingLayout .guidedProgressItem.active { border-color: #67e8f9; background: #ecfeff; color: #0e7490; }
  .roofingProgressThumb { flex: 0 0 34px; width: 34px; height: 28px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f1f5f9; background-size: cover; background-position: center; box-shadow: inset 0 0 0 1px rgba(255,255,255,.35); }
  .roofingProgressThumb.empty { background: linear-gradient(135deg, #f8fafc, #e2e8f0); }
  .roofingProgressThumb.finish { background-size: cover; }
  .roofingChoiceGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
  .roofingVisualGrid { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
  .roofingChoiceGrid button,
  .roofingProfileGrid button,
  .roofingSwatchGrid button { display: grid; gap: 10px; min-height: 132px; align-content: start; border: 1px solid #d7deea; border-radius: 8px; background: #ffffff; color: #071827; text-align: left; padding: 14px; cursor: pointer; overflow: hidden; }
  .roofingChoiceGrid button.selected,
  .roofingProfileGrid button.selected,
  .roofingSwatchGrid button.selected { border-color: #0f766e; box-shadow: 0 0 0 3px rgba(15, 118, 110, .18), inset 0 0 0 2px #0f766e; }
  .roofingChoiceGrid button.awaiting { border-style: dashed; background: #f8fafc; }
  .roofingChoiceGrid button strong,
  .roofingProfileGrid button strong,
  .roofingSwatchGrid button strong { font-size: 20px; line-height: 1.15; font-weight: 950; }
  .roofingChoiceGrid button span,
  .roofingProfileGrid button em,
  .roofingSwatchGrid button em { color: #475569; font-size: 13px; font-style: normal; font-weight: 750; }
  .roofingVisualCard { padding: 0 !important; gap: 0 !important; min-height: 0 !important; }
  .roofingVisualImage { display: block; width: 100%; aspect-ratio: 16 / 9; background: #e2e8f0; background-size: cover; background-position: center; }
  .roofingCardBody { display: grid; gap: 8px; padding: 14px; }
  .roofingCardBody span,
  .roofingProfileBody em,
  .roofingSummaryDetails dd { min-width: 0; white-space: normal; overflow-wrap: anywhere; }
  .roofingCardBody small { color: #64748b; font-size: 12px; font-weight: 900; text-transform: uppercase; }
  .roofingCardBody em { justify-self: start; border: 1px solid #fde68a; border-radius: 999px; background: #fffbeb; color: #92400e; padding: 5px 9px; font-style: normal; font-size: 12px; font-weight: 900; }
  .roofingCardBody b,
  .roofingProfileBody i { justify-self: start; border: 1px solid #0f766e; border-radius: 8px; background: #0f766e; color: #ffffff; padding: 8px 12px; font-style: normal; font-size: 13px; font-weight: 950; }
  .roofingProfileGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
  .roofingProfileGrid button { padding: 0; min-height: 0; }
  .roofingProfileGrid img { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; background: #f1f5f9; }
  .roofingProfileBody { display: grid; gap: 7px; padding: 14px; }
  .roofingProfileBody small { color: #64748b; font-size: 12px; font-weight: 900; text-transform: uppercase; }
  .roofingProfileBody b { color: #334155; font-size: 12px; font-weight: 850; }
  .roofingSwatchGrid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
  .roofingSwatchGrid button { min-height: 142px; padding: 10px; }
  .roofingSwatch { display: grid; place-items: center; width: 100%; height: 82px; border: 1px solid rgba(15,23,42,.18); border-radius: 8px; color: #ffffff; font-size: 24px; font-weight: 950; text-shadow: 0 1px 3px rgba(15,23,42,.55); box-shadow: inset 0 0 0 1px rgba(255,255,255,.38); }
  .roofingFinishPanel { display: grid; gap: 14px; }
  .roofingFinishPanel .roofingChoiceGrid { grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
  .roofingFinishSample { display: block; width: 100%; height: 92px; border: 1px solid rgba(15,23,42,.16); border-radius: 8px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.35); }
  .roofingSelectionSummary { display: grid; grid-template-columns: minmax(190px, .75fr) minmax(0, 1fr); gap: 16px; align-items: center; border: 1px solid #d7deea; border-radius: 8px; background: #f8fafc; padding: 14px; }
  .roofingSelectionSummary > img { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; border-radius: 8px; background: #e2e8f0; }
  .roofingSelectionSummary button { grid-column: 1 / -1; justify-self: start; align-self: end; white-space: normal; }
  .roofingSummaryDetails { display: grid; gap: 10px; min-width: 0; }
  .roofingSummaryDetails > strong { color: #071827; font-size: 22px; font-weight: 950; }
  .roofingSummaryDetails dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; }
  .roofingSummaryDetails dl div { border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff; padding: 9px; }
  .roofingSummaryDetails dt { color: #64748b; font-size: 11px; font-weight: 950; text-transform: uppercase; }
  .roofingSummaryDetails dd { display: flex; gap: 8px; align-items: center; min-height: 24px; margin: 4px 0 0; color: #071827; font-weight: 900; }
  .roofingSummarySwatch { flex: 0 0 36px; width: 36px; height: 24px; border: 1px solid rgba(15,23,42,.18); border-radius: 6px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.35); }
  .guidedDetailsModal { width: min(760px, 94vw); max-height: 90vh; overflow: auto; background: #ffffff; border-radius: 10px; padding: 18px; display: grid; gap: 12px; color: #071827; }
  .guidedDetailsModal > button { justify-self: end; border: 1px solid #cbd5e1; background: #ffffff; border-radius: 8px; padding: 8px 12px; font-weight: 850; }
  .guidedDetailsModal img { width: 100%; max-height: 360px; object-fit: cover; border-radius: 8px; background: #e2e8f0; }
  .guidedDetailsGallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
  .guidedDetailsGallery img { width: 100%; aspect-ratio: 1; max-height: none; object-fit: cover; border-radius: 6px; }
  .guidedDetailsModal h2 { margin: 0; font-size: 28px; line-height: 1.15; }
  .guidedDetailsModal p { margin: 0; color: #475569; font-weight: 700; }
  .guidedDetailsModal dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; }
  .guidedDetailsModal dl div { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
  .guidedDetailsModal dt { color: #64748b; font-size: 12px; font-weight: 900; text-transform: uppercase; }
  .guidedDetailsModal dd { margin: 4px 0 0; font-weight: 850; }
  .scheduleControls { position: sticky; top: 0; z-index: 20; width: 100%; box-sizing: border-box; margin: 0 0 12px; display: grid; grid-template-columns: minmax(160px, .9fr) minmax(140px, .7fr) minmax(170px, .8fr) minmax(190px, 1fr) minmax(170px, .8fr) minmax(130px, .6fr) minmax(130px, .6fr) auto; gap: 10px; align-items: end; border: 1px solid #d7deea; background: #ffffff; border-radius: 8px; padding: 12px; }
  .scheduleControls label { display: grid; gap: 5px; color: #475569; font-size: 11px; font-weight: 950; text-transform: uppercase; letter-spacing: .04em; }
  .scheduleControls select { width: 100%; min-width: 0; border: 1px solid #cbd5e1; border-radius: 7px; padding: 9px 10px; background: #ffffff; color: #071827; font-weight: 800; }
  .sectionButtons { display: flex; gap: 8px; }
  .sectionButtons button { min-height: 38px; border: 1px solid #cbd5e1; border-radius: 7px; background: #ffffff; color: #071827; font-weight: 850; padding: 8px 10px; cursor: pointer; }
  .topbar { display: flex; justify-content: space-between; gap: 18px; align-items: center; margin: 0 auto 14px; max-width: 1500px; }
  .topbar p { margin: 0; color: #64748b; font-size: 12px; font-weight: 800; text-transform: uppercase; }
  .topbar h1 { margin: 4px 0 0; font-size: 24px; }
  .actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .actions a { color: #0a2a43; font-weight: 800; }
  .actions button:last-child { background: #c99735; color: #071827; }
  .alert { padding: 10px 12px; border-radius: 6px; margin: 0 auto 12px; max-width: 1500px; font-weight: 700; }
  .alert.error { background: #fee2e2; color: #991b1b; }
  .alert.success { background: #dcfce7; color: #166534; }
  .documentWrap { display: grid; justify-content: stretch; justify-items: stretch; gap: 16px; width: 100%; }
  .documentViewer { --viewer-page-width: calc(100% - 48px); width: 100%; max-width: none; box-sizing: border-box; display: grid; justify-items: center; background: #eef2f7; border: 1px solid #d7deea; border-radius: 8px; padding: 24px; overflow: visible; }
  .documentViewer.fit-width { overflow-x: hidden; }
  .documentViewer.fit-page { overflow-x: hidden; }
  .documentViewer.zoom-75, .documentViewer.zoom-100, .documentViewer.zoom-125, .documentViewer.zoom-150 { overflow-x: auto; }
  .documentPages { width: 100%; display: grid; justify-items: center; gap: 32px; }
  .documentViewer.single .documentPages { gap: 0; }
  .documentPageFrame { width: var(--viewer-page-width); max-width: none; display: grid; justify-items: stretch; scroll-margin-top: 118px; }
  .page { width: 100%; min-height: 760px; background: #fff; box-shadow: 0 12px 34px rgba(15, 23, 42, .1); position: relative; overflow: hidden; box-sizing: border-box; }
  .page input, .page textarea, .page select { background: #fff !important; color: #071827 !important; border-color: #d8dee8 !important; box-shadow: none !important; }
  .page input:focus, .page textarea:focus, .page select:focus { outline: 2px solid rgba(201,151,53,.22); border-color: #d7a640 !important; }
  .coverPage { width: 100%; aspect-ratio: 297 / 210; height: auto; min-height: 0; box-sizing: border-box; background-size: cover; background-position: center; color: var(--cover-text); padding: clamp(24px, 3.2vw, 42px); display: grid; grid-template-rows: auto minmax(0, 1fr) auto auto; gap: clamp(8px, 1.4vw, 14px); }
  .coverBrand { display: flex; align-items: center; gap: 18px; max-width: 100%; min-width: 0; }
  .coverBrand strong { display: block; color: var(--cover-text); font-size: clamp(19px, 2.7vw, 28px); font-weight: 950; line-height: 1.04; margin: 0 0 5px; overflow-wrap: anywhere; }
  .coverBrand span { display: block; margin-top: 3px; color: var(--accent); letter-spacing: 1px; text-transform: none; font-size: clamp(11px, 1.5vw, 15px); font-weight: 850; }
  .coverLogoBox, .coverLogoFallback { width: clamp(104px, 15vw, 140px); height: clamp(62px, 9vw, 82px); box-sizing: border-box; display: grid; place-items: center; background: rgba(255,255,255,.96); border: 1px solid rgba(255,255,255,.78); border-radius: 8px; padding: 9px; color: #071827; overflow: hidden; flex: 0 0 auto; }
  .coverLogoBox img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .coverLogoFallback { text-align: center; font-size: 14px; line-height: 1.2; font-weight: 950; text-transform: uppercase; letter-spacing: .05em; }
  .logoUploadTarget { display: block; cursor: pointer; }
  .logoUploadTarget input { display: none; }
  .coverTitle { align-self: start; max-width: 820px; display: grid; gap: 7px; padding: clamp(18px, 4vw, 46px) 0 0; }
  .coverProject { color: rgba(255,255,255,.82); font-size: clamp(13px, 2vw, 17px); line-height: 1.3; font-weight: 850; text-transform: uppercase; letter-spacing: .08em; overflow-wrap: anywhere; }
  .coverClientName { display: block; color: var(--cover-text); font-size: clamp(21px, 3.2vw, 34px); line-height: 1.08; font-weight: 950; overflow-wrap: anywhere; margin-top: 4px; }
  .coverAddress { display: block; color: rgba(255,255,255,.9); font-size: clamp(13px, 1.9vw, 17px); line-height: 1.28; font-weight: 750; max-width: 100%; overflow-wrap: anywhere; }
  .coverSuburb { color: #f8d58a; font-weight: 850; }
  .coverTitle .kicker { color: var(--accent); font-size: clamp(16px, 2.2vw, 23px); font-weight: 950; text-transform: none; letter-spacing: .04em; }
  .coverTitle h1 { margin: 0; color: var(--cover-text); font-size: clamp(34px, 4.25vw, 52px); line-height: 1; font-weight: 950; text-transform: uppercase; white-space: normal; letter-spacing: 0; max-width: 820px; overflow-wrap: anywhere; }
  .coverMeta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px 16px; align-items: start; border-top: 1px solid rgba(248,213,138,.62); border-bottom: 1px solid rgba(248,213,138,.62); padding: 10px 0; }
  .coverMetaItem { min-width: 0; }
  .coverMetaItem span { display: block; color: rgba(255,255,255,.68); font-size: 10px; font-weight: 950; text-transform: uppercase; letter-spacing: .12em; margin-bottom: 5px; }
  .coverMetaItem strong { color: var(--cover-text); font-size: clamp(12px, 1.55vw, 15px); line-height: 1.2; font-weight: 900; overflow-wrap: anywhere; }
  .coverPage footer { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px; justify-content: space-between; align-items: center; border-top: 2px solid var(--accent); padding-top: 8px; margin-top: 0; min-width: 0; }
  .coverPage footer span:first-child { color: #f8d58a; font-style: normal; font-weight: 850; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .coverPage footer span:last-child { color: var(--cover-text); font-weight: 900; white-space: nowrap; }
  .coverDebugPanel { width: min(1123px, 100%); box-sizing: border-box; background: #0f172a; color: #e2e8f0; border: 1px solid #334155; border-radius: 8px; padding: 10px 12px; display: grid; gap: 8px; font-size: 11px; }
  .coverDebugPanel button { justify-self: start; background: #f8d58a; color: #071827; border: 0; border-radius: 5px; padding: 5px 8px; font-size: 11px; font-weight: 900; cursor: pointer; }
  .coverDebugPanel div { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px 14px; }
  .coverDebugPanel strong { grid-column: 1 / -1; color: #f8d58a; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
  .coverSettingsPanel { width: min(1500px, 100%); box-sizing: border-box; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; box-shadow: 0 14px 34px rgba(15, 23, 42, .12); padding: 16px; display: grid; gap: 12px; }
  .coverSettingsPanel header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .coverSettingsPanel header div { display: grid; gap: 3px; }
  .coverSettingsPanel header span { color: #64748b; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; }
  .coverSettingsPanel header strong { color: #071827; font-size: 20px; }
  .coverSettingsPanel header button { background: #e8edf3; color: #071827; }
  .coverSettingsActions { display: flex; gap: 8px; align-items: center; justify-content: flex-end; flex-wrap: wrap; }
  .coverSettingsPanel label { display: grid; gap: 6px; color: #334155; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .04em; }
  .coverSettingsPanel textarea { min-height: 96px; resize: vertical; text-transform: none; letter-spacing: 0; }
  .coverSettingsPanel small { color: #64748b; font-weight: 800; }
  .coverSettingsPanel p { margin: 0; color: #64748b; font-size: 13px; font-weight: 750; }
  .coverSettingsGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .infoPage { max-width: none; width: 100%; padding: 38px; display: grid; gap: 18px; }
  .docHeader { display: grid; grid-template-columns: 150px 1fr auto; gap: 18px; align-items: center; margin-bottom: 28px; }
  .docHeader img { width: 140px; height: 84px; object-fit: contain; }
  .docHeaderLogoFallback { width: 140px; height: 84px; display: grid; place-items: center; border: 1px solid #d8dee8; color: #071827; font-size: 11px; font-weight: 950; text-align: center; padding: 6px; box-sizing: border-box; }
  .docHeader h2 { margin: 0; font-size: 28px; text-transform: uppercase; color: #071827; }
  .docHeader span { color: #475569; font-size: 12px; }
  .projectInfoHero { display: grid; gap: 6px; background: #071827; color: #fff; padding: 18px 20px; border-left: 6px solid #c99735; }
  .projectInfoHero span { color: #f8d58a; font-size: 12px; font-weight: 950; text-transform: uppercase; letter-spacing: .08em; }
  .projectInfoHero strong { font-size: 24px; line-height: 1.15; overflow-wrap: anywhere; }
  .infoGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border: 1px solid #d9e0e8; margin-bottom: 8px; }
  .infoField { min-width: 0; display: grid; grid-template-columns: 132px minmax(0, 1fr); gap: 12px; align-items: start; padding: 13px; border-bottom: 1px solid #d9e0e8; }
  .infoField:nth-child(odd) { border-right: 1px solid #d9e0e8; }
  .infoField span { color: #071827; font-size: 11px; font-weight: 900; text-transform: uppercase; }
  .infoField input, .infoField textarea { width: 100%; box-sizing: border-box; border: 0 !important; background: #fff !important; font-weight: 800; line-height: 1.35; overflow-wrap: anywhere; resize: vertical; }
  .infoField textarea { min-height: 74px; }
  .aboutBox { background: #f8efe5; border-radius: 8px; padding: 16px; margin-bottom: 22px; }
  .aboutBox textarea { min-height: 116px; border: 0; background: transparent; resize: vertical; }
  .revisionTable { width: 100%; border-collapse: collapse; }
  .revisionTable th, .revisionTable td { border: 1px solid #dce3ea; padding: 8px; vertical-align: top; }
  .revisionTable th { background: #071827; color: white; font-size: 11px; text-transform: uppercase; }
  .signatureGrid { display: grid; grid-template-columns: 1fr 160px; gap: 18px; margin-top: 14px; }
  .signatureGrid span { border-bottom: 1px solid #94a3b8; padding: 12px 0; }
  .contractPage { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: 1fr 42px; min-height: 760px; background: #fff; }
  .documentSpine { grid-row: 1 / 3; background: linear-gradient(180deg, #071827 0%, #04111f 100%); color: white; padding: 22px; display: flex; flex-direction: column; gap: 18px; }
  .spineBrand { display: grid; gap: 4px; }
  .spineBrand img { width: 150px; height: 88px; object-fit: contain; background: rgba(255,255,255,.96); padding: 4px; }
  .spineBrand strong { font-size: 18px; letter-spacing: .04em; text-transform: uppercase; }
  .spineBrand span { color: #d7a640; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; }
  .spineTitle small { color: #d7a640; font-size: 20px; font-weight: 900; text-transform: uppercase; }
  .spineTitle h2 { margin: 4px 0 12px; font-size: 25px; line-height: 1.05; text-transform: uppercase; white-space: pre-line; }
  .spineTitle i { display: block; width: 70px; height: 2px; background: #d7a640; margin-bottom: 12px; }
  .spineTitle b { font-size: 13px; text-transform: uppercase; }
  .spineMeta { display: grid; gap: 5px; border-top: 1px solid rgba(215,166,64,.5); border-bottom: 1px solid rgba(215,166,64,.5); padding: 13px 0; }
  .spineMeta span { color: #d7a640; font-size: 10px; text-transform: uppercase; }
  .spineMeta strong { font-size: 12px; line-height: 1.35; margin-bottom: 5px; }
  .spineRooms { display: grid; gap: 2px; overflow: auto; min-height: 0; padding-right: 2px; }
  .spineRooms button { display: grid; grid-template-columns: 32px 1fr; align-items: center; gap: 4px; text-align: left; background: transparent; color: #f8fafc; padding: 6px 0; font-size: 12px; font-weight: 700; }
  .spineRooms button span { color: #d7a640; font-size: 15px; font-weight: 950; }
  .spineRooms button.active { background: linear-gradient(90deg, rgba(215,166,64,.95), rgba(215,166,64,.16)); color: white; padding-left: 6px; }
  .documentSpine em { color: #d7a640; font-family: Georgia, serif; margin-top: auto; font-size: 15px; }
  .roomSheet { min-width: 0; padding: 20px 22px 18px; }
  .roomHero { display: grid; grid-template-columns: minmax(420px, 1fr) 280px 112px; gap: 18px; align-items: start; border-bottom: 1px solid #dce3ea; padding-bottom: 14px; margin-bottom: 12px; }
  .roomName { border: 0; font-size: 33px; font-weight: 950; letter-spacing: .01em; text-transform: uppercase; padding: 0; line-height: 1; }
  .roomHero textarea { border: 0; min-height: 44px; color: #475569; resize: none; padding-left: 0; }
  .specMark { text-align: center; padding-top: 2px; }
  .specMark strong { display: block; font-size: 22px; text-transform: uppercase; color: #071827; }
  .specMark span { display: block; color: #d7a640; font-family: Georgia, serif; font-size: 21px; margin-top: 8px; }
  .builderLogoBox { background: #fff; color: #071827; display: grid; place-items: center; text-align: center; height: 92px; padding: 8px; border: 1px solid #e5c48b; }
  .builderLogoBox img { width: 96px; height: 62px; object-fit: contain; }
  .builderLogoBox b { display: none; }
  .roomTabs { display: grid; grid-template-columns: repeat(6, minmax(92px, auto)) 1fr auto auto; gap: 7px; align-items: center; margin: 12px 0; }
  .roomTabs button { background: white; border: 1px solid #d8dee8; color: #071827; min-height: 36px; }
  .roomTabs button.active { background: #071827; color: white; }
  .roomTabs button.ghost { border-style: dashed; color: #64748b; }
  .roomTabs button.danger { border-color: #ef4444; color: #dc2626; }
  .selectionTableWrap { overflow: auto; border: 1px solid #dce3ea; width: 100%; }
  .selectionTable { width: 100%; min-width: 1460px; table-layout: fixed; border-collapse: collapse; font-size: 13px; }
  .colItem { width: 12%; }
  .colDescription { width: 18%; }
  .colBrand { width: 10%; }
  .colProduct { width: 22%; }
  .colFinish { width: 12%; }
  .colSupplier { width: 10%; }
  .colImage { width: 8%; }
  .colIncluded { width: 6%; }
  .colUpgrade { width: 12%; }
  .selectionTable th { background: #071827; color: white; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; padding: 11px 9px; border-right: 1px solid rgba(255,255,255,.16); }
  .selectionTable td { border: 1px solid #e2e8f0; padding: 9px; vertical-align: middle; background: #fff; }
  .selectionTable tr:nth-child(even) td { background: #fbfcfe; }
  .selectionTable input, .selectionTable textarea { border: 0 !important; background: transparent !important; border-radius: 0; padding: 2px; font-size: 13px; color: #071827 !important; }
  .selectionTable textarea { min-height: 58px; resize: vertical; line-height: 1.45; }
  .itemCell { display: grid; grid-template-columns: 30px 1fr; gap: 7px; align-items: center; min-width: 0; font-weight: 900; }
  .itemIcon { width: 26px; height: 26px; display: grid; place-items: center; border: 1px solid #cbd5e1; color: #64748b; font-size: 16px; }
  .productChoice { display: grid; gap: 5px; min-width: 0; }
  .productChoice select { width: 100%; min-width: 0; border: 1px solid #e5c48b !important; background: #fffaf0 !important; font-size: 12px; font-weight: 800; padding: 7px 8px; color: #071827 !important; }
  .productChoice strong { font-size: 12px; color: #475569; font-weight: 800; line-height: 1.35; }
  .libraryButton { background: transparent; color: #071827; border: 1px dashed #cbd5e1; font-size: 11px; padding: 5px 7px; text-align: left; }
  .libraryButton:hover { border-color: #d7a640; background: #fffaf0; }
  .thumbButton { width: 84px; height: 70px; padding: 0; overflow: hidden; background: #f8fafc; color: #64748b; border: 1px solid #cbd5e1; }
  .thumbButton img { width: 100%; height: 100%; object-fit: contain; }
  .includedTick { width: 34px; height: 30px; display: grid; place-items: center; margin: 0 auto; border-radius: 50%; background: white; color: #16a34a; font-size: 19px; }
  .includedTick.no { color: #dc2626; }
  .upgradeCell { display: grid; gap: 5px; min-width: 92px; }
  .upgradeCell select { font-size: 10px; padding: 4px; background: #fff !important; color: #071827 !important; }
  .upgradeCell span { font-weight: 900; color: #0f5132; }
  .notesRow { display: grid; grid-template-columns: 1fr 1fr 170px; gap: 8px; margin-top: 12px; }
  .notesRow div { background: #fbf4ea; border-radius: 4px; padding: 10px; display: grid; gap: 6px; }
  .notesRow textarea { min-height: 54px; border: 0 !important; background: transparent !important; resize: vertical; padding: 0; color: #071827 !important; }
  .notesRow span { font-size: 22px; font-weight: 950; }
  .roomSidePanel { padding: 118px 14px 54px 0; display: grid; align-content: start; gap: 0; }
  .roomSidePanel section { border: 1px solid #e5c48b; border-bottom: 0; padding: 12px; background: #fff; }
  .roomSidePanel section:last-child { border-bottom: 1px solid #e5c48b; }
  .roomSidePanel h3 { margin: 0 0 9px; color: #071827; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  .roomSidePanel textarea { min-height: 92px; border: 0 !important; background: transparent !important; padding: 0; resize: vertical; font-size: 11px; line-height: 1.6; color: #071827 !important; }
  .roomSidePanel ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 7px; font-size: 11px; }
  .roomSidePanel li:before { content: "✓"; color: #16a34a; margin-right: 8px; }
  .roomSidePanel dl { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; margin: 0; font-size: 11px; }
  .roomSidePanel dt { color: #475569; }
  .roomSidePanel dd { margin: 0; font-weight: 700; }
  .roomImageButton { width: 100%; height: 184px; padding: 0; background: #f1f5f9; overflow: hidden; margin-bottom: 8px; }
  .roomImageButton img { width: 100%; height: 100%; object-fit: cover; }
  .contractFooter { grid-column: 1; background: #071827; color: white; display: grid; grid-template-columns: auto 1fr auto; gap: 18px; align-items: center; padding: 0 24px; font-size: 11px; }
  .contractFooter span:nth-child(2) { color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pageFooter { position: absolute; left: 34px; right: 34px; bottom: 18px; display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #071827; padding-top: 8px; color: #334155; font-size: 12px; }
  .modalBackdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(2, 6, 23, .72); display: grid; place-items: center; padding: 24px; }
  .brickImportModal { width: min(1120px, 96vw); max-height: 92vh; overflow: auto; background: #ffffff; border-radius: 10px; padding: 18px; display: grid; gap: 14px; color: #071827; }
  .brickImportModal header { display: flex; justify-content: space-between; align-items: start; gap: 12px; }
  .brickImportModal header span { color: #64748b; font-size: 12px; font-weight: 950; letter-spacing: .08em; }
  .brickImportModal h2, .brickImportModal h3 { margin: 0; letter-spacing: 0; }
  .brickImportModal header button { border: 1px solid #cbd5e1; background: #ffffff; color: #071827; border-radius: 8px; }
  .brickImportContext, .brickPreviewStats, .brickEnablementActions { display: flex; flex-wrap: wrap; gap: 8px; }
  .brickImportContext span, .brickImportContext strong, .brickPreviewStats span { border: 1px solid #d7deea; border-radius: 8px; background: #f8fafc; padding: 8px 10px; color: #475569; font-size: 12px; font-weight: 900; }
  .brickFileDrop { position: relative; display: grid; place-items: center; gap: 8px; min-height: 220px; border: 1px dashed #94a3b8; border-radius: 8px; background: #f8fafc; cursor: pointer; }
  .brickFileDrop input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .brickPreviewTable { display: grid; gap: 6px; overflow-x: auto; }
  .brickPreviewHead, .brickPreviewRow { display: grid; grid-template-columns: 130px 140px 120px 120px minmax(180px, 1fr) 100px 100px 110px 90px 150px; gap: 8px; min-width: 1260px; align-items: center; }
  .brickPreviewHead { color: #475569; font-size: 12px; font-weight: 950; text-transform: uppercase; }
  .brickPreviewRow { border: 1px solid #d7deea; border-radius: 8px; background: #ffffff; padding: 8px; font-size: 12px; }
  .brickPreviewRow.invalid { border-color: #fecaca; background: #fff1f2; }
  .brickEnablementPanel { display: grid; gap: 12px; border: 1px solid #d7deea; border-radius: 8px; background: #f8fafc; padding: 14px; }
  .brickEnablementActions button, .brickImportModal .primary { border: 1px solid #0f766e; background: #0f766e; color: #ffffff; border-radius: 8px; }
  .brickEnablementList { display: grid; gap: 8px; }
  .brickEnablementList label { display: grid; grid-template-columns: auto 120px minmax(180px, 1fr) minmax(180px, 1fr); gap: 8px; align-items: center; border: 1px solid #d7deea; border-radius: 8px; background: #ffffff; padding: 9px; }
  .brickEnablementList input { width: auto; }
  .brickEnablementList em { color: #64748b; font-style: normal; font-size: 12px; }
  .productModal { width: min(1100px, 94vw); max-height: 90vh; overflow: auto; background: white; border-radius: 10px; padding: 18px; color: #071827; }
  .productModal header { display: flex; justify-content: space-between; gap: 18px; align-items: start; margin-bottom: 14px; }
  .productModal h2 { margin: 0; }
  .selectorFilters { display: grid; grid-template-columns: 1fr 260px; gap: 10px; margin-bottom: 14px; }
  .productGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
  .modalProductCard { background: #fff; color: #071827; border: 1px solid #e2e8f0; text-align: left; display: grid; gap: 7px; }
  .modalProductImage { height: 120px; display: grid; place-items: center; background: #f1f5f9; color: #94a3b8; overflow: hidden; border-radius: 5px; }
  .modalProductImage img { width: 100%; height: 100%; object-fit: cover; }
  .modalProductCard span, .modalProductCard small { color: #64748b; }
  .modalProductCard em { color: #0f5132; font-weight: 900; font-style: normal; }
  .imageModal { background: white; border-radius: 10px; padding: 14px; display: grid; gap: 10px; max-width: 88vw; max-height: 90vh; }
  .imageModal img { max-width: 80vw; max-height: 74vh; object-fit: contain; }
  @page { size: A4 portrait; margin: 0; }
  @media (max-width: 1180px) {
    .roofingLayout { grid-template-columns: 1fr; }
    .roofingLayout .guidedProgressMenu { position: static; }
    .roofingSwatchGrid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .roofingSelectionSummary { grid-template-columns: 1fr; }
    .roofingSelectionSummary button { justify-self: start; }
  }
  @media (max-width: 980px) {
    .roofingVisualGrid,
    .roofingProfileGrid { grid-template-columns: 1fr; }
    .roofingSwatchGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .roofingSummaryDetails dl { grid-template-columns: 1fr; }
    .roofingVisualImage,
    .roofingProfileGrid img,
    .roofingSelectionSummary > img { aspect-ratio: 4 / 3; }
  }
  @media print {
    .screen { display: block; background: white; }
    .sidebar, .standardBanner, .scheduleControls, .alert, .coverSettingsPanel, .coverDebugPanel, .productModal, .modalBackdrop { display: none !important; }
    .workspace { padding: 0; overflow: visible; }
    .documentViewer, .documentPages, .documentPageFrame { display: block; width: auto; max-width: none; padding: 0; border: 0; background: white; }
    .page { box-shadow: none; page-break-after: always; break-after: page; }
    .coverPage { width: 297mm; height: 210mm; aspect-ratio: auto; padding: 14mm; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
  @media (max-width: 1380px) { .selectionTable { min-width: 1360px; } .scheduleControls { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  @media (max-width: 980px) { .standardBanner, .roomHero, .notesRow, .scheduleControls { grid-template-columns: 1fr; } .standardMeta { justify-items: start; } .bannerActions, .sectionButtons { justify-content: flex-start; } .standardCopy h1 { font-size: 36px; } .coverPage, .coverSettingsPanel, .coverDebugPanel { width: 100%; } .coverMeta, .coverSettingsGrid, .coverDebugPanel { grid-template-columns: 1fr; } .contractPage { grid-template-columns: 1fr; } .contractFooter { grid-column: 1; grid-row: auto; } .documentViewer { padding: 12px; } .selectionTable { min-width: 1120px; } }
`;
