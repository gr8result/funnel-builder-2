import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "../../../hooks/useWorkspace";
import { DEFAULT_BUILDER_TEMPLATE_BRAND } from "../../../lib/builders/defaultTemplateBrand";
import { supabase } from "../../../utils/supabase-client";

const STATUS_OPTIONS = ["pending", "selected", "approved", "ordered"];

const DEFAULT_ROOMS = [
  "Site Works",
  "Concrete",
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
  "Site Works": ["Site Clearance", "Bulk Earthworks", "Retaining Walls", "Temporary Fencing & Security", "Construction Access"],
  Concrete: ["Concrete Slab", "Footings", "Termite Treatment", "Waterproof Membrane", "Concrete Finish"],
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
  "colorbond corrugated": "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=700&q=80",
  "premium colorbond": "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=700&q=80",
  "monier horizon": "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=700&q=80",
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
  roofing: [
    productOption("Colorbond", "Colorbond Corrugated", "Classic corrugated profile", "Monument", "Roofing Supplier", "Colorbond corrugated roof sheeting with standard colour selection.", 0, 0, "mid_range", "#2d3742"),
    productOption("Colorbond", "Premium Colorbond Profile", "Architectural standing seam", "Monument", "Roofing Supplier", "Premium architectural roof profile with elevated finish.", 0, 4200, "higher_end", "#17202b"),
    productOption("Monier", "Monier Horizon Roof Tile", "Concrete roof tile", "Monument", "Roofing Supplier", "Monier Horizon concrete roof tile with selected colour finish.", 0, 2800, "mid_range", "#5b5b59"),
  ],
  gutters: [
    productOption("Colorbond", "Colorbond Quad Gutter", "Quad profile", "Monument", "Roofing Supplier", "Colorbond quad gutter system.", 0, 0, "mid_range", "#313945"),
    productOption("Colorbond", "Premium Colorbond Gutter", "Squareline profile", "Monument", "Roofing Supplier", "Premium squareline gutter profile.", 0, 950, "higher_end", "#202935"),
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
  return `Missing field: ${fieldName}`;
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
  const options = key ? PRODUCT_OPTION_LIBRARY[key] : [
    productOption("Builder Standard", `${itemName} Included Selection`, "Standard", "Builder selected", "Builder supplier", `${itemName} included builder standard selection.`, 0, 0, "mid_range", "#d8dee8"),
    productOption("Builder Standard", `${itemName} Upgraded Selection`, "Upgrade", "Client selected", "Builder supplier", `${itemName} upgraded client selection.`, 0, 450, "higher_end", "#c99735"),
  ];
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

export default function BuilderSelectionsBookPage({ workspaceId: providedWorkspaceId = "", workbook: embeddedWorkbook = null } = {}) {
  const { workspaceId: activeWorkspaceId, loading: workspaceLoading } = useWorkspace();
  const workspaceId = providedWorkspaceId || activeWorkspaceId;
  const [projects, setProjects] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [templateItems, setTemplateItems] = useState([]);
  const [products, setProducts] = useState([]);
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
  const [debugOpen, setDebugOpen] = useState(true);

  const selectedProject = useMemo(() => projects.find((project) => project.id === selectedProjectId) || null, [projects, selectedProjectId]);
  const selectedSnapshot = useMemo(() => snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) || null, [snapshots, selectedSnapshotId]);
  const selectedTemplate = useMemo(() => templates.find((template) => template.id === selectedTemplateId) || null, [templates, selectedTemplateId]);
  const activeRoom = useMemo(() => book.rooms.find((room) => room.id === activeRoomId) || book.rooms[0] || null, [book.rooms, activeRoomId]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category.category_name])), [categories]);
  const manufacturerById = useMemo(() => new Map(manufacturers.map((manufacturer) => [manufacturer.id, manufacturer.manufacturer_name])), [manufacturers]);
  const supplierById = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier.supplier_name])), [suppliers]);
  const totals = useMemo(() => selectionTotals(book), [book]);
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
    if (!workspaceId) return;
    loadInitialData();
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

  useEffect(() => {
    if (!selectedProject && !selectedSnapshot) return;
    console.info("[Client Selections Cover fields]", {
      clientName: coverDebugFields.clientName,
      jobNumber: coverDebugFields.quoteNumber,
      siteAddress: coverDebugFields.siteAddress,
      builderName: coverDebugFields.builderName,
      builderLogo: coverDebugFields.builderLogo,
      selectionStandard: coverDebugFields.selectionStandard,
    });
  }, [selectedProject, selectedSnapshot, coverDebugFields]);

  async function loadInitialData() {
    setLoading(true);
    setError("");
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

    if (projectResult.error) setError(projectResult.error.message || "Could not load projects.");
    const projectRows = projectResult.data || [];
    setProjects(projectRows);
    setSelectedProjectId((current) => projectRows.find((project) => project.id === current)?.id || projectRows[0]?.id || "");

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
    setLoading(false);
  }

  async function loadSnapshots() {
    const { data, error: loadError } = await supabase
      .from("builder_estimate_snapshots")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("project_id", selectedProjectId)
      .order("snapshot_number", { ascending: false });
    if (loadError) {
      setError(loadError.message || "Could not load estimate snapshots.");
      setSnapshots([]);
      return;
    }
    const rows = data || [];
    setSnapshots(rows);
    setSelectedSnapshotId((current) => rows.find((snapshot) => snapshot.id === current)?.id || rows[0]?.id || "");
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
    const { data, error: loadError } = await supabase
      .from("builder_selection_books")
      .select("id, book_name, status, book_data, inclusion_template_id, updated_at")
      .eq("workspace_id", workspaceId)
      .eq("project_id", selectedProjectId)
      .eq("inclusion_template_id", selectedTemplateId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (loadError) {
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
    if (!workspaceId || !selectedProjectId) {
      setError("Choose a commercial project before saving.");
      return null;
    }
    const bookForSave = {
      ...book,
      cover: { ...book.cover, ...displayCover },
      projectInfo: { ...(book.projectInfo || {}), ...projectInfoDisplay },
      updatedAt: new Date().toISOString(),
    };
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

  return (
    <>
      <Head>
        <title>Selections Book | Builders Platform</title>
      </Head>
      <main className="screen">
        <aside className="sidebar">
          <div className="brandStrip">
            <img src={displayCover.logoUrl || DEFAULT_BUILDER_TEMPLATE_BRAND.logoUrl} alt={displayCover.builderName || DEFAULT_BUILDER_TEMPLATE_BRAND.name} />
            <div>
              <strong>{displayCover.builderName || DEFAULT_BUILDER_TEMPLATE_BRAND.name}</strong>
              <span>Selections Book</span>
            </div>
          </div>
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

          <nav className="pages">
            <button className={activePage === "cover" ? "active" : ""} onClick={() => setActivePage("cover")}>1 Cover</button>
            <button className={activePage === "project" ? "active" : ""} onClick={() => setActivePage("project")}>2 Project Info</button>
            {book.rooms.map((room, index) => (
              <button
                key={room.id}
                className={activePage === "room" && activeRoomId === room.id ? "active" : ""}
                onClick={() => {
                  setActivePage("room");
                  setActiveRoomId(room.id);
                }}
              >
                {index + 3} {room.name}
              </button>
            ))}
          </nav>

          <div className="roomTools">
            <input value={newRoomName} onChange={(event) => setNewRoomName(event.target.value)} placeholder="New room name" />
            <select value={newRoomTemplate} onChange={(event) => setNewRoomTemplate(event.target.value)}>
              {Object.keys(ROOM_TEMPLATES).map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <button onClick={addRoom}>Add New Room</button>
          </div>
        </aside>

        <section className="workspace">
          <header className="topbar">
            <div>
              <p>{workspaceLoading || loading ? "Loading..." : "Luxury Selections Schedule Builder"}</p>
              <h1>{book.cover.projectName || "Inclusions & Selections Schedule"}</h1>
            </div>
            <div className="actions">
              <Link href="/modules/builders/client-selections">Open Imported Records</Link>
              {activePage === "cover" && (
                <button type="button" onClick={() => setCoverSettingsOpen((current) => !current)}>
                  {coverSettingsOpen ? "Hide Cover Settings" : "Edit Cover Settings"}
                </button>
              )}
              <button onClick={() => saveBook()} disabled={saving}>{saving ? "Saving..." : "Save Progress"}</button>
              <button onClick={importToProject} disabled={importing}>{importing ? "Importing..." : "Import to Project"}</button>
            </div>
          </header>

          {error && <div className="alert error">{error}</div>}
          {success && <div className="alert success">{success}</div>}

          <div className="documentWrap">
            {activePage === "cover" && (
              <>
                <SelectionsBookDebugPanel
                  open={debugOpen}
                  onToggle={() => setDebugOpen((current) => !current)}
                  fields={{
                    renderingFilePath: "pages/modules/builders/selections-book.js -> CoverPage / ProjectInfoPage / LogoBox",
                    selectedProject: selectedProjectId ? `${selectedProjectId} / ${selectedProject?.project_name || selectedProject?.name || ""}` : "",
                    selectedSnapshot: selectedSnapshotId ? `${selectedSnapshotId} / ${selectedSnapshot?.snapshot_label || selectedSnapshot?.snapshot_number || ""}` : "",
                    clientName: coverValue(displayCover.clientName, [displayCover.projectName]),
                    fullSiteAddress: coverDebugFields.fullSiteAddress || coverValue(displayCover.siteAddress),
                    estimatorName: coverDebugFields.estimatorName,
                    quoteNumber: coverDebugFields.quoteNumber,
                    jobNumber: coverDebugFields.jobNumber || coverValue(displayCover.jobNumber),
                    builderLogoUrl: coverValue(displayCover.logoUrl),
                  }}
                />
                <CoverPage cover={displayCover} onLogoChange={changeBuilderLogo} />
                {coverSettingsOpen && (
                  <CoverSettingsPanel
                    cover={coverDraft}
                    dirty={hasCoverDraftChanges}
                    onChange={updateCoverDraft}
                    onReset={() => setCoverDraft(book.cover)}
                    onResetFromProject={resetCoverFromProjectData}
                  />
                )}
              </>
            )}
            {activePage === "project" && (
              <>
                <SelectionsBookDebugPanel
                  open={debugOpen}
                  onToggle={() => setDebugOpen((current) => !current)}
                  fields={{
                    renderingFilePath: "pages/modules/builders/selections-book.js -> ProjectInfoPage",
                    selectedProject: selectedProjectId ? `${selectedProjectId} / ${selectedProject?.project_name || selectedProject?.name || ""}` : "",
                    selectedSnapshot: selectedSnapshotId ? `${selectedSnapshotId} / ${selectedSnapshot?.snapshot_label || selectedSnapshot?.snapshot_number || ""}` : "",
                    clientName: projectInfoDisplay.clientName,
                    fullSiteAddress: projectInfoDisplay.fullSiteAddress,
                    estimatorName: projectInfoDisplay.estimatorName,
                    quoteNumber: projectInfoDisplay.quoteNumber,
                    jobNumber: projectInfoDisplay.jobNumber,
                    builderLogoUrl: coverValue(displayCover.logoUrl),
                  }}
                />
                <ProjectInfoPage book={{ ...book, cover: displayCover }} details={projectInfoDisplay} onChange={updateProjectInfo} />
              </>
            )}
            {activePage === "room" && activeRoom && (
              <RoomPage
                room={activeRoom}
                rooms={book.rooms}
                activeRoomId={activeRoom.id}
                pageNumber={book.rooms.findIndex((room) => room.id === activeRoom.id) + 3}
                book={book}
                totals={totals}
                onOpenRoom={(roomId) => {
                  setActivePage("room");
                  setActiveRoomId(roomId);
                }}
                onRoomChange={(patch) => updateRoom(activeRoom.id, patch)}
                onRowChange={(rowId, patch) => updateRow(activeRoom.id, rowId, patch)}
                onApplyOption={(rowId, optionId) => applyRowOption(activeRoom.id, rowId, optionId)}
                onSelectProduct={(rowId) => openSelector(activeRoom.id, rowId)}
                onPreviewImage={setImagePreview}
                onDuplicate={() => duplicateRoom(activeRoom.id)}
                onRemove={() => removeRoom(activeRoom.id)}
              />
            )}
          </div>
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
      </main>

      <style jsx>{styles}</style>
    </>
  );
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

function SelectionsBookDebugPanel({ fields, open, onToggle }) {
  return (
    <div className="coverDebugPanel">
      <button type="button" onClick={onToggle}>{open ? "Hide" : "Show"} selections book debug</button>
      {open ? (
        <div>
          <strong>Selections book render debug</strong>
          <span>active rendering file/component: {fields.renderingFilePath}</span>
          <span>selected project: {fields.selectedProject || missingCoverField("selectedProject")}</span>
          <span>selected snapshot: {fields.selectedSnapshot || missingCoverField("selectedSnapshot")}</span>
          <span>clientName value: {fields.clientName || missingCoverField("clientName")}</span>
          <span>fullSiteAddress value: {fields.fullSiteAddress || missingCoverField("fullSiteAddress")}</span>
          <span>estimatorName value: {fields.estimatorName || "Estimator missing"}</span>
          <span>quoteNumber value: {fields.quoteNumber || missingCoverField("quoteNumber")}</span>
          <span>jobNumber value: {fields.jobNumber || missingCoverField("jobNumber")}</span>
          <span>builderLogoUrl value: {fields.builderLogoUrl || missingCoverField("builderLogoUrl")}</span>
        </div>
      ) : null}
    </div>
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
  const roomImage = room.imageUrl || room.rows.find((row) => row.imageUrl)?.imageUrl || book.cover.backgroundImageUrl;
  const roomInclusions = room.rows.filter((row) => row.included).slice(0, 5);
  const roomLabel = isRoomLike(room.name) ? "Room" : "Section";
  return (
    <section className="page roomPage contractPage">
      <aside className="documentSpine">
        <div className="spineBrand">
          <img src={book.cover.logoUrl} alt={book.cover.builderName} />
          <strong>{book.cover.builderName}</strong>
          <span>{book.cover.tagline}</span>
        </div>
        <div className="spineTitle">
          <small>{book.cover.kicker}</small>
          <h2>{book.cover.title}</h2>
          <i />
          <b>{book.cover.projectName || "Project Selections"}</b>
        </div>
        <div className="spineMeta">
          <span>Client</span>
          <strong>{book.cover.clientName || "Client details pending"}</strong>
          <span>Site Address</span>
          <strong>{book.cover.siteAddress || "Address pending"}</strong>
          <span>Job Number</span>
          <strong>{book.cover.quoteNumber || "Not entered"}</strong>
          <span>Issue Date</span>
          <strong>{book.cover.issueDate || today()}</strong>
          <span>Version</span>
          <strong>{book.cover.version}</strong>
        </div>
        <nav className="spineRooms">
          {rooms.slice(0, 19).map((item, index) => (
            <button key={item.id} className={item.id === activeRoomId ? "active" : ""} onClick={() => onOpenRoom(item.id)}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {item.name}
            </button>
          ))}
        </nav>
        <em>{book.cover.footerText?.split("|")?.[0] || "Building dreams. Creating lifestyles."}</em>
      </aside>

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

        <div className="roomTabs">
          {rooms.slice(0, 6).map((item) => (
            <button key={item.id} className={item.id === activeRoomId ? "active" : ""} onClick={() => onOpenRoom(item.id)}>
              {item.name}
            </button>
          ))}
          <button className="ghost" type="button">+ Add New Room</button>
          <span />
          <button type="button" onClick={onDuplicate}>Duplicate Room</button>
          <button type="button" className="danger" onClick={onRemove}>Remove Room</button>
        </div>

      <div className="selectionTableWrap">
        <table className="selectionTable">
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

      <aside className="roomSidePanel">
        <section>
          <h3>About This {roomLabel}</h3>
          <textarea value={room.about || aboutTextForRoom(room.name)} onChange={(event) => onRoomChange({ about: event.target.value })} />
        </section>
        <section>
          <h3>Inclusions</h3>
          <ul>
            {roomInclusions.map((row) => <li key={row.id}>{row.selectedProduct || row.item}</li>)}
          </ul>
        </section>
        <section>
          <h3>Specification Summary</h3>
          <dl>
            <dt>Style</dt><dd>{String(book.templateName || "").includes("Higher") ? "Premium" : "Modern"}</dd>
            <dt>Colour Palette</dt><dd>Neutral</dd>
            <dt>Overall Finish</dt><dd>{room.rows.find((row) => row.finishColour)?.finishColour || "Chrome / selected finishes"}</dd>
            <dt>Adjustment</dt><dd>{money(roomUpgrade)}</dd>
          </dl>
        </section>
        <section>
          <h3>Room Image</h3>
          <button className="roomImageButton" onClick={() => onPreviewImage({ url: roomImage, alt: room.name })}>
            <img src={roomImage} alt={room.name} />
          </button>
          <input value={room.imageUrl || ""} onChange={(event) => onRoomChange({ imageUrl: event.target.value })} placeholder="Room image URL" />
        </section>
      </aside>

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
  return rooms.filter((room) => room.rows.length || ["Site Works", "Kitchen", "Main Bathroom"].includes(room.name));
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
        ["Roofing", "Premium Colorbond Profile", "Colorbond", "Colorbond", "higher_end"],
        ["Gutters", "Premium Colorbond", "Colorbond", "Colorbond", "higher_end"],
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
        ["Roofing", "Colorbond Corrugated", "Colorbond", "Colorbond", "mid_range"],
        ["Gutters", "Colorbond Quad", "Colorbond", "Colorbond", "mid_range"],
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
  return {
    workspace_id: workspaceId,
    project_id: projectId,
    snapshot_id: snapshotId || null,
    source_quote_row_id: row.sourceQuoteRowId || null,
    category: slug(room.name) || "other",
    title: `${room.name} - ${row.item}`,
    description: row.description || row.selectedProduct || row.item,
    allowance_amount: numberValue(row.allowanceAmount),
    selected_product_name: row.selectedProduct || "",
    selected_supplier_name: row.supplier || "",
    selected_supplier_id: null,
    selected_details: {
      room: room.name,
      item: row.item,
      brand: row.brand,
      model: row.productModel,
      finishColour: row.finishColour,
      selectedCost: numberValue(row.selectedCost),
      upgradeCost: numberValue(row.upgradeCost),
      imageUrl: row.imageUrl,
      datasheetUrl: row.datasheetUrl,
      warrantyUrl: row.warrantyUrl,
      productUrl: row.productUrl,
    },
    status: row.status === "approved" ? "approved" : "pending",
    selected_at: new Date().toISOString(),
    notes: row.notes || "",
    metadata: {
      source: "luxury_selections_book",
      selection_book_id: bookId,
      selection_book_row_id: row.id,
      inclusion_template_id: templateId || null,
      uiStatus: row.status,
    },
    created_by: userId,
    updated_by: userId,
  };
}

function replaceAt(rows, index, next) {
  return rows.map((row, rowIndex) => rowIndex === index ? next : row);
}

const styles = `
  .screen { min-height: 100vh; display: grid; grid-template-columns: 260px minmax(0, 1fr); background: #e8edf3; color: #07111f; font-family: Inter, Arial, sans-serif; }
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
  .topbar { display: flex; justify-content: space-between; gap: 18px; align-items: center; margin: 0 auto 14px; max-width: 1500px; }
  .topbar p { margin: 0; color: #64748b; font-size: 12px; font-weight: 800; text-transform: uppercase; }
  .topbar h1 { margin: 4px 0 0; font-size: 24px; }
  .actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .actions a { color: #0a2a43; font-weight: 800; }
  .actions button:last-child { background: #c99735; color: #071827; }
  .alert { padding: 10px 12px; border-radius: 6px; margin: 0 auto 12px; max-width: 1500px; font-weight: 700; }
  .alert.error { background: #fee2e2; color: #991b1b; }
  .alert.success { background: #dcfce7; color: #166534; }
  .documentWrap { display: grid; justify-content: center; justify-items: center; gap: 16px; }
  .page { width: min(1500px, 100%); min-height: 920px; background: #fff; box-shadow: 0 20px 60px rgba(15, 23, 42, .18); position: relative; overflow: hidden; }
  .page input, .page textarea, .page select { background: #fff !important; color: #071827 !important; border-color: #d8dee8 !important; box-shadow: none !important; }
  .page input:focus, .page textarea:focus, .page select:focus { outline: 2px solid rgba(201,151,53,.22); border-color: #d7a640 !important; }
  .coverPage { width: min(1123px, 100%); max-width: 1123px; aspect-ratio: 297 / 210; height: auto; min-height: 0; box-sizing: border-box; background-size: cover; background-position: center; color: var(--cover-text); padding: clamp(24px, 3.2vw, 42px); display: grid; grid-template-rows: auto minmax(0, 1fr) auto auto; gap: clamp(8px, 1.4vw, 14px); }
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
  .infoPage { max-width: 1180px; width: min(1180px, 100%); padding: 38px; display: grid; gap: 18px; }
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
  .contractPage { display: grid; grid-template-columns: 220px minmax(760px, 1fr) 210px; grid-template-rows: 1fr 42px; min-height: 940px; background: #fff; }
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
  .roomSheet { min-width: 0; padding: 24px 16px 18px 28px; }
  .roomHero { display: grid; grid-template-columns: minmax(320px, 1fr) 330px 112px; gap: 18px; align-items: start; border-bottom: 1px solid #dce3ea; padding-bottom: 14px; }
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
  .selectionTableWrap { overflow: auto; border: 1px solid #dce3ea; }
  .selectionTable { width: 100%; min-width: 980px; border-collapse: collapse; font-size: 11px; }
  .selectionTable th { background: #071827; color: white; font-size: 10px; letter-spacing: .04em; text-transform: uppercase; padding: 9px 7px; border-right: 1px solid rgba(255,255,255,.16); }
  .selectionTable td { border: 1px solid #e2e8f0; padding: 6px; vertical-align: middle; background: #fff; }
  .selectionTable tr:nth-child(even) td { background: #fbfcfe; }
  .selectionTable input, .selectionTable textarea { border: 0 !important; background: transparent !important; border-radius: 0; padding: 2px; font-size: 11px; color: #071827 !important; }
  .selectionTable textarea { min-height: 42px; resize: vertical; line-height: 1.35; }
  .itemCell { display: grid; grid-template-columns: 30px 1fr; gap: 7px; align-items: center; min-width: 145px; font-weight: 900; }
  .itemIcon { width: 26px; height: 26px; display: grid; place-items: center; border: 1px solid #cbd5e1; color: #64748b; font-size: 16px; }
  .productChoice { display: grid; gap: 4px; min-width: 180px; }
  .productChoice select { border: 1px solid #e5c48b !important; background: #fffaf0 !important; font-size: 10px; font-weight: 800; padding: 5px 7px; color: #071827 !important; }
  .productChoice strong { font-size: 10px; color: #475569; font-weight: 800; }
  .libraryButton { background: transparent; color: #071827; border: 1px dashed #cbd5e1; font-size: 10px; padding: 4px 6px; text-align: left; }
  .libraryButton:hover { border-color: #d7a640; background: #fffaf0; }
  .thumbButton { width: 110px; height: 58px; padding: 0; overflow: hidden; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; }
  .thumbButton img { width: 100%; height: 100%; object-fit: cover; }
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
  .contractFooter { grid-column: 2 / 4; background: #071827; color: white; display: grid; grid-template-columns: auto 1fr auto; gap: 18px; align-items: center; padding: 0 24px; font-size: 11px; }
  .contractFooter span:nth-child(2) { color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pageFooter { position: absolute; left: 34px; right: 34px; bottom: 18px; display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #071827; padding-top: 8px; color: #334155; font-size: 12px; }
  .modalBackdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(2, 6, 23, .72); display: grid; place-items: center; padding: 24px; }
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
  @media print {
    .screen { display: block; background: white; }
    .sidebar, .topbar, .alert, .coverSettingsPanel, .coverDebugPanel, .productModal, .modalBackdrop { display: none !important; }
    .workspace { padding: 0; overflow: visible; }
    .documentWrap { display: block; }
    .page { box-shadow: none; page-break-after: always; break-after: page; }
    .coverPage { width: 297mm; height: 210mm; aspect-ratio: auto; padding: 14mm; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
  @media (max-width: 1380px) { .contractPage { grid-template-columns: 200px minmax(720px, 1fr) 190px; } .roomTabs { grid-template-columns: repeat(4, minmax(92px, auto)) 1fr auto auto; } .roomTabs button:nth-child(n+5):nth-child(-n+6) { display: none; } }
  @media (max-width: 980px) { .screen { grid-template-columns: 1fr; } .sidebar { position: static; max-height: none; } .coverPage, .coverSettingsPanel, .coverDebugPanel { width: 100%; } .coverMeta, .coverSettingsGrid, .coverDebugPanel { grid-template-columns: 1fr; } .contractPage { grid-template-columns: 1fr; } .documentSpine, .roomSidePanel, .contractFooter { grid-column: 1; grid-row: auto; } .roomHero, .roomTabs, .notesRow { grid-template-columns: 1fr; } }
`;
