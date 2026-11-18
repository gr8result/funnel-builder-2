// Benchtop fabrication choices per benchtop area (owner brief "COMPLETE BENCHTOP SELECTIONS", 17 Nov 2026).
//
// What the client chooses for each benchtop area, beside its surface:
//   thicknessMm        nominal finished thickness: 20, 40 or 60 mm (stone / porcelain / sintered only)
//   edgeConstruction   "full" (a slab of that thickness) or "mitred" (a mitred / built-up edge on a thinner slab)
//   vanity tops also:  vanityDepthMm (a product depth, e.g. 350 mm for a narrow wall-hung vanity),
//                      basinType and dropFrontMm (a stone drop-front / apron: 100, 150 or 200 mm)
// Stored on the AREA as `fabrication`, never on the surface: choosing the same stone for several
// benchtops, linking the island to the main benchtop, or applying Kitchen finishes to another room
// moves the surface only, so it never copies a thickness, an edge construction or a basin choice.
//
// Compatibility comes from the Product Library: a product's thicknessOptions list the slab thicknesses
// the supplier makes. A nominal thickness is offered full-thickness when that slab exists, and as a
// mitred / built-up edge when a thinner slab (12 mm or more) exists. A product with no thickness data
// offers every choice marked "builder_confirm", and the quotation carries a builder review for it - an
// unsupported specification is never approved silently. No lengths or quantities are asked here: edge
// lengths, cut-out positions and slab requirements are measured by the builder / approved takeoff.

import { stoneBenchtopProductById } from "./stoneBenchtopWorkflow.js";

export const BENCHTOP_THICKNESSES = [20, 40, 60];
export const EDGE_CONSTRUCTION_LABELS = { full: "Full-thickness slab", mitred: "Mitred / built-up edge" };
export const VANITY_BASIN_TYPES = ["Undermount", "Inset", "Semi-recessed", "Above-counter"];
export const VANITY_DROP_FRONTS = [100, 150, 200];
// Product depths a vanity benchtop is made to. 350 mm is a narrow wall-hung vanity only.
export const VANITY_DEPTHS = { wallMountedVanity: [350, 460, 500, 600], floorMountedVanity: [460, 500, 600] };
export const VANITY_TYPE_LABELS = { wallMountedVanity: "Wall-hung vanity", floorMountedVanity: "Floor-mounted (standard) vanity" };
export const COMPATIBILITY_SUPPORTED = "supported";
export const COMPATIBILITY_BUILDER_CONFIRM = "builder_confirm";

const text = (value) => String(value ?? "").trim();
const STONE_RANGE = /stone|porcelain|sintered|marble|solid_surface|granite|quartz/i;

export function isStoneSurface(surface) {
  if (!surface || typeof surface !== "object") return false;
  if (surface.materialChoice === "stone") return true;
  if (surface.materialChoice === "laminate") return false;
  return STONE_RANGE.test(`${surface.rangeKey || ""} ${surface.benchtopRangeKey || ""} ${surface.category || ""} ${surface.materialType || ""}`);
}

// Slab thicknesses (mm) the supplier makes for this surface, or null when the Product Library holds none.
export function slabThicknessesMm(surface) {
  if (!surface || typeof surface !== "object") return null;
  const listed = Array.isArray(surface.slabThicknessOptions) && surface.slabThicknessOptions.length ? surface.slabThicknessOptions
    : stoneBenchtopProductById(surface.productId || surface.id)?.thicknessOptions || [];
  const values = [...new Set(listed.map((value) => Number(String(value).match(/(\d+(?:\.\d+)?)\s*mm/i)?.[1])).filter((value) => value > 0))].sort((a, b) => a - b);
  return values.length ? values : null;
}

// The thickness / construction combinations this surface supports. [] for a surface that takes no
// nominal thickness choice (laminate). Each: { thicknessMm, constructions: [{ key, label, status, slabMm }] }.
export function benchtopThicknessOptions(surface) {
  if (!isStoneSurface(surface)) return [];
  const slabs = slabThicknessesMm(surface);
  return BENCHTOP_THICKNESSES.map((thicknessMm) => {
    if (!slabs) {
      return { thicknessMm, constructions: [
        { key: "full", label: EDGE_CONSTRUCTION_LABELS.full, status: COMPATIBILITY_BUILDER_CONFIRM, slabMm: null },
        ...(thicknessMm > 20 ? [{ key: "mitred", label: EDGE_CONSTRUCTION_LABELS.mitred, status: COMPATIBILITY_BUILDER_CONFIRM, slabMm: null }] : []),
      ] };
    }
    const constructions = [];
    if (slabs.includes(thicknessMm)) constructions.push({ key: "full", label: EDGE_CONSTRUCTION_LABELS.full, status: COMPATIBILITY_SUPPORTED, slabMm: thicknessMm });
    const thinner = slabs.filter((slab) => slab >= 12 && slab < thicknessMm);
    if (thinner.length) {
      const slabMm = Math.max(...thinner);
      constructions.push({ key: "mitred", label: `${EDGE_CONSTRUCTION_LABELS.mitred} from ${slabMm} mm slab`, status: COMPATIBILITY_SUPPORTED, slabMm });
    }
    return { thicknessMm, constructions };
  }).filter((option) => option.constructions.length);
}

export function vanityBasinOptions(surface) {
  // An undermount basin needs a solid stone top; a laminate top can take an inset or above-counter basin.
  return isStoneSurface(surface) || !surface ? VANITY_BASIN_TYPES : VANITY_BASIN_TYPES.filter((type) => type !== "Undermount");
}
export const vanityDepthOptions = (areaId = "") => VANITY_DEPTHS[areaId] || VANITY_DEPTHS.floorMountedVanity;
export const vanityDropFrontOptions = (surface) => (isStoneSurface(surface) ? VANITY_DROP_FRONTS : []);

const positive = (value) => (Number(value) > 0 ? Number(value) : "");

// The area's saved fabrication, cleaned: unknown values are dropped, never guessed.
export function benchtopFabrication(area = {}) {
  const saved = area?.fabrication && typeof area.fabrication === "object" ? area.fabrication : {};
  const thicknessMm = BENCHTOP_THICKNESSES.includes(Number(saved.thicknessMm)) ? Number(saved.thicknessMm) : "";
  const edgeConstruction = thicknessMm && EDGE_CONSTRUCTION_LABELS[saved.edgeConstruction] ? saved.edgeConstruction : "";
  return {
    thicknessMm,
    edgeConstruction,
    vanityDepthMm: positive(saved.vanityDepthMm),
    basinType: VANITY_BASIN_TYPES.includes(saved.basinType) ? saved.basinType : "",
    dropFrontMm: VANITY_DROP_FRONTS.includes(Number(saved.dropFrontMm)) ? Number(saved.dropFrontMm) : "",
    ...(Number(saved.edgeLengthMm) > 0 ? { edgeLengthMm: Number(saved.edgeLengthMm) } : {}),
    ...(saved.builderConfirmedAt ? { builderConfirmedAt: saved.builderConfirmedAt } : {}),
  };
}

// A changed thickness drops a construction that no longer applies; the first supported one is offered.
export function withThickness(area = {}, thicknessMm) {
  const current = benchtopFabrication(area);
  const option = benchtopThicknessOptions(area.surface).find((item) => item.thicknessMm === Number(thicknessMm));
  if (!option) return { ...current, thicknessMm: "", edgeConstruction: "" };
  const keep = option.constructions.find((item) => item.key === current.edgeConstruction);
  return { ...current, thicknessMm: option.thicknessMm, edgeConstruction: (keep || option.constructions[0]).key };
}

// The status of the chosen combination for the area's CURRENT surface.
export function thicknessCompatibility(area = {}) {
  const fabrication = benchtopFabrication(area);
  if (!fabrication.thicknessMm) return { status: "", construction: null };
  const option = benchtopThicknessOptions(area.surface).find((item) => item.thicknessMm === fabrication.thicknessMm);
  const construction = option?.constructions.find((item) => item.key === fabrication.edgeConstruction) || null;
  return { status: construction ? construction.status : "unsupported", construction };
}

const surfaceLabel = (surface) => [surface?.supplier, surface?.colourName || surface?.colour || surface?.productName || surface?.range].map(text).filter(Boolean).join(" ") || "this surface";

// Plain specification text, client-safe (no lengths): "40 mm · Mitred / built-up edge from 20 mm slab"
// and, for a vanity, "Wall-hung vanity · 350 mm deep · Semi-recessed basin · 150 mm drop-front".
// { client: true } (18 Nov 2026): what the client chose only - the finished thickness, not the
// fabricator's edge construction (full slab / mitred), which stays in the quotation.
export function benchtopSpecificationParts(area = {}, { vanityTarget = "", client = false } = {}) {
  const fabrication = benchtopFabrication(area);
  const { construction } = thicknessCompatibility(area);
  const parts = [];
  if (fabrication.thicknessMm) parts.push(`${fabrication.thicknessMm} mm`, client ? "" : construction?.label || EDGE_CONSTRUCTION_LABELS[fabrication.edgeConstruction] || "");
  const target = vanityTarget || (VANITY_DEPTHS[area.id] ? area.id : "");
  if (target) {
    parts.push(VANITY_TYPE_LABELS[target] || "");
    if (fabrication.vanityDepthMm) parts.push(`${fabrication.vanityDepthMm} mm deep`);
    if (fabrication.basinType) parts.push(`${fabrication.basinType} basin`);
    if (fabrication.dropFrontMm) parts.push(`${fabrication.dropFrontMm} mm stone drop-front`);
  }
  return parts.filter(Boolean);
}
export const benchtopSpecificationText = (area, options) => benchtopSpecificationParts(area, options).join(" · ");

// Builder / stone fabricator reviews the area's choices need. Each is a sentence naming the item.
export function benchtopFabricationReviews(area = {}, { room = "" } = {}) {
  const reviews = [];
  if (!area?.surface) return reviews;
  const fabrication = benchtopFabrication(area);
  const name = `${room ? `${room} ` : ""}${text(area.label) || "benchtop"}`;
  const surface = surfaceLabel(area.surface);
  const stone = isStoneSurface(area.surface);
  if (stone && !fabrication.thicknessMm) reviews.push(`${name}: thickness not selected - confirm 20, 40 or 60 mm with the client`);
  const compatibility = thicknessCompatibility(area);
  if (compatibility.status === COMPATIBILITY_BUILDER_CONFIRM) reviews.push(`${name}: confirm ${surface} is made as ${fabrication.thicknessMm} mm (${EDGE_CONSTRUCTION_LABELS[fabrication.edgeConstruction]}) - the Product Library has no thickness data for this product`);
  if (compatibility.status === "unsupported") reviews.push(`${name}: ${fabrication.thicknessMm} mm ${EDGE_CONSTRUCTION_LABELS[fabrication.edgeConstruction] || ""} is not listed for ${surface} - builder to confirm or change`.replace(/\s+-/, " -"));
  if (fabrication.basinType === "Semi-recessed") reviews.push(`${name}: semi-recessed basin projects beyond the vanity front - stone fabricator to review the basin cut-out${fabrication.dropFrontMm ? ` and the ${fabrication.dropFrontMm} mm drop-front` : ""}`);
  if (fabrication.vanityDepthMm === 350 && ["Undermount", "Inset", "Semi-recessed"].includes(fabrication.basinType)) reviews.push(`${name}: 350 mm deep top with a ${fabrication.basinType.toLowerCase()} basin - confirm the basin fits the narrow vanity`);
  if (fabrication.basinType === "Undermount" && !stone) reviews.push(`${name}: an undermount basin needs a stone top - ${surface} cannot take one`);
  if (fabrication.dropFrontMm && !stone) reviews.push(`${name}: a stone drop-front needs a stone top - ${surface} cannot take one`);
  return reviews;
}
