import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  EXTERIOR_COLOUR_AREAS,
  EXTERIOR_COLOUR_FAMILIES,
  EXTERIOR_COLOUR_PALETTE,
  EXTERIOR_REQUIREMENTS,
  exteriorColourAreaStatus,
  exteriorColourMatchesFamily,
  exteriorColourScheduleWorkflowProduct,
  normaliseExteriorColourArea,
} from "../lib/builders/clientSelectionWorkflow.js";
import { renderProductCardHtml, sanitiseClientSelection } from "../lib/builders/finalInclusionsSchedule.js";
import { buildSelectionsSchedule } from "../lib/builders/selectionsScheduleDocument.js";

const requirement = EXTERIOR_REQUIREMENTS.find((item) => item.requirementKey === "exterior-paint");
assert.equal(requirement.label, "Exterior Colours");

const colourByName = (name) => EXTERIOR_COLOUR_PALETTE.find((colour) => colour.colourName === name);
const areaById = (id) => EXTERIOR_COLOUR_AREAS.find((area) => area.areaId === id);
assert.ok(EXTERIOR_COLOUR_FAMILIES.includes("Greens"));
const greenColours = EXTERIOR_COLOUR_PALETTE.filter((colour) => exteriorColourMatchesFamily(colour, "Greens"));
assert.ok(greenColours.length >= 4, "Greens family should expose the real exterior green catalogue records");
assert.ok(greenColours.some((colour) => colour.colourName === "Pale Eucalypt"));
assert.ok(greenColours.some((colour) => colour.colourName === "Mangrove"));
assert.ok(EXTERIOR_COLOUR_PALETTE.some((colour) => colour.colourName === "Surfmist" && colour.paletteSources.includes("builder-standard")));

const areas = [
  normaliseExteriorColourArea({ ...areaById("main-rendered-walls"), colourSelection: colourByName("Dieskau") }),
  normaliseExteriorColourArea({ ...areaById("secondary-rendered-walls"), applicable: true, colourSelection: colourByName("Colorbond Monument") }),
  normaliseExteriorColourArea({ ...areaById("eaves-soffits"), colourSelection: colourByName("Lexicon Quarter"), defaultStatus: "applied trim colour" }),
  normaliseExteriorColourArea({ ...areaById("window-surrounds"), colourSelection: colourByName("Lexicon Quarter"), defaultStatus: "applied trim colour" }),
  normaliseExteriorColourArea({ ...areaById("timber-posts"), colourSelection: colourByName("Natural stain") }),
  normaliseExteriorColourArea({ ...areaById("roof"), applicable: true, colourSelection: colourByName("Monument"), confirmationStatus: "factory_finished", source: "Roofing", colourSource: "roofing-selection" }),
  normaliseExteriorColourArea({ ...areaById("gutters"), colourSelection: colourByName("Monument"), confirmationStatus: "factory_finished", source: "Roofing", colourSource: "roofing-selection", linkedComponentId: "roof" }),
];

const product = exteriorColourScheduleWorkflowProduct(areas, requirement, { projectId: "demo-project" });
assert.equal(product.productName, "Exterior Colour Schedule");
assert.equal(product.exteriorColourSelection.summary.applicableAreas, 7);
assert.equal(product.exteriorColourSelection.summary.selectedAreas, 7);
assert.equal(product.exteriorColourSelection.summary.uniqueColours, 5);
assert.equal(product.exteriorColourSelection.summary.complete, true);

const mainRender = product.exteriorColourSelection.areas.find((area) => area.areaId === "main-rendered-walls");
const featureRender = product.exteriorColourSelection.areas.find((area) => area.areaId === "secondary-rendered-walls");
const eaves = product.exteriorColourSelection.areas.find((area) => area.areaId === "eaves-soffits");
const surrounds = product.exteriorColourSelection.areas.find((area) => area.areaId === "window-surrounds");
const timber = product.exteriorColourSelection.areas.find((area) => area.areaId === "timber-posts");
const roof = product.exteriorColourSelection.areas.find((area) => area.areaId === "roof");
const gutters = product.exteriorColourSelection.areas.find((area) => area.areaId === "gutters");

assert.equal(mainRender.colourSelection.colourName, "Dieskau");
assert.equal(featureRender.colourSelection.colourName, "Colorbond Monument");
assert.equal(eaves.colourSelection.colourName, "Lexicon Quarter");
assert.equal(surrounds.colourSelection.colourName, "Lexicon Quarter");
assert.equal(timber.finishType, "stained");
assert.equal(roof.colourSource, "roofing-selection");
assert.equal(exteriorColourAreaStatus(roof), "linked_roofing");
assert.equal(gutters.confirmationStatus, "factory_finished");
assert.equal(exteriorColourAreaStatus(gutters), "linked_roofing");
assert.match(mainRender.coatingSpecification.topcoat, /Weathershield Low Sheen/);
assert.match(surrounds.coatingSpecification.topcoat, /Weathershield Semi Gloss/);
assert.match(timber.coatingSpecification.topcoat, /timber stain|clear finish/i);
assert.match(gutters.coatingSpecification.topcoat, /factory-finished/i);

const selection = sanitiseClientSelection({
  category: "exterior",
  subcategory: "Exterior Colours",
  room: "Exterior",
  selected_product_name: "Exterior Colour Schedule",
  selected_details: {
    exteriorColourSelection: product.exteriorColourSelection,
    clientColourSchedule: product.clientColourSchedule,
    painterTradeSchedule: product.painterTradeSchedule,
    technicalCoatingRecords: product.technicalCoatingRecords,
    priceStatus: "Allowance Only",
  },
});
assert.equal(selection.exteriorColourSelection.areas.length, 7);
assert.equal(selection.exteriorColourSelection.masterColourSchedule.length, 7);
assert.equal(selection.clientColourSchedule.length, 7);
assert.equal(selection.painterTradeSchedule.length, 7);
assert.equal(selection.exteriorColourSelection.masterColourSchedule[0].componentId.includes("demo-project"), true);
assert.equal(selection.exteriorColourSelection.masterColourSchedule.some((component) => component.colourSource === "roofing-selection"), true);

const html = renderProductCardHtml(selection);
assert.match(html, /Exterior Colour Schedule/);
assert.match(html, /Dieskau/);
assert.match(html, /Lexicon Quarter/);
assert.doesNotMatch(html, /Painter's \/ Trade Coating Schedule|Dulux Weathershield Low Sheen|Dulux Weathershield Semi Gloss/, "paint-system details do not leak into the client's selected-colour product row");

const scheduleSelection = { id: "exterior-colours", guidedRequirementKey: "exterior-paint", selectedProduct: selection.productName, guidedSelection: {
  requirementKey: "exterior-paint", area: "exterior", requirementLabel: "Exterior Colours", productName: selection.productName,
  clientColourSchedule: selection.clientColourSchedule, exteriorColourSelection: selection.exteriorColourSelection,
} };
const schedule = buildSelectionsSchedule({ rooms: [{ name: "Project", rows: [
  { id: "roofing", guidedRequirementKey: "roofing", selectedProduct: "COLORBOND Roof", guidedSelection: { requirementKey: "roofing", area: "exterior", requirementLabel: "Roofing", productName: "COLORBOND Roof", roofingConfiguration: { profileName: "Custom Orb", colour: "Monument" }, roofPackage: { fascia: { productName: "COLORBOND Fascia", colour: "Monument" }, gutters: { productName: "COLORBOND Gutters", colour: "Monument" } } } },
  scheduleSelection,
  { id: "oven", guidedRequirementKey: "oven", selectedProduct: "Bosch Series 4 Oven", guidedSelection: { requirementKey: "oven", requirementLabel: "Oven", productName: "Bosch Series 4 Oven" } },
  { id: "interior-paint", guidedRequirementKey: "interior-paint", selectedProduct: "Internal paint colours", guidedSelection: { requirementKey: "interior-paint", area: "interior", requirementLabel: "Internal Paint Colours", productName: "Internal paint colours", paintScheme: { defaults: { walls: { manufacturer: "Dulux", colourName: "Natural White", finish: "Low Sheen" } } } } },
] }] });
assert.deepEqual(schedule.sections.map((section) => section.title), ["Exterior Selections", "Interior Selections", "Painting Schedule"]);
const paintedItems = schedule.sections.find((section) => section.key === "painting").groups.flatMap((group) => group.rows).map((row) => row.item);
assert(paintedItems.includes("Window surrounds"));
assert(paintedItems.includes("Eaves/soffits"));
assert(!schedule.sections.find((section) => section.key === "exterior").groups.flatMap((group) => group.rows).some((row) => /surround|eaves|render/i.test(row.item)), "site-painted surfaces belong to Painting Schedule");
assert(schedule.sections.find((section) => section.key === "exterior").groups.flatMap((group) => group.rows).some((row) => row.item === "Roof" && /Monument/.test(row.colourFinish)), "factory roof colour stays with Exterior Selections");

const embeddedSource = fs.readFileSync(path.resolve("pages/modules/builders/selections-book.js"), "utf8");
assert.match(embeddedSource, /GuidedExteriorColourWorkflow/);
assert.doesNotMatch(embeddedSource, /Dulux Weathershield Low Sheen[\s\S]{0,120}productOption/);
assert.doesNotMatch(embeddedSource, /Dulux Weathershield Semi Gloss[\s\S]{0,120}productOption/);

console.log("Exterior Colours workflow regression passed.", product.exteriorColourSelection.summary);
