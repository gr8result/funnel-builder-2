// Inclusions & Selections Schedule: three sections, continuous pages, every selection accounted for.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-selections-schedule-document.mjs
import assert from "node:assert/strict";
import { buildSelectionsSchedule, extractScheduleRows, paginateSchedule, structureSchedule, formatLocations, formatQuantity, text, rowUnits, SCHEDULE_PAGE_UNITS, SCHEDULE_STATUS } from "../lib/builders/selectionsScheduleDocument.js";

const results = {};
const check = (name, run) => { try { run(); results[name] = "PASS"; } catch (error) { results[name] = "FAIL"; console.error(`FAIL ${name}:`, String(error.message).slice(0, 900)); } };

let id = 0;
const guided = (requirementKey, fields = {}) => ({ id: `row-${++id}`, item: fields.requirementLabel || requirementKey, guidedRequirementKey: requirementKey, selectedProduct: fields.productName || "", guidedSelection: { requirementKey, ...fields } });
const template = (item, selectedProduct) => ({ id: `row-${++id}`, item, selectedProduct, brand: "Westinghouse", imageUrl: "https://images.unsplash.com/photo-1", allowanceAmount: 1200, selectedCost: 1200 });
const allocation = (lines) => ({ plumbingAllocation: { lines } });
const line = (productName, allocations, extra = {}) => ({ lineId: `line-${productName}`, productName, brand: "Caroma", supplier: "Harvey Norman Commercial", model: "4700300W", finish: "White", unit: "EACH", imageUrl: "/images/catalogues/plumbing/basin.jpg",
  quantity: allocations.reduce((total, item) => total + item.quantity, 0), allocations, unitPrice: 619, selectedTotal: 3095, allowanceTotal: 3250, variation: -155, ...extra });
const windows = (count, glass) => Array.from({ length: count }, (_, index) => ({ id: `${glass}-${index}`, windowCode: `W${index + 1}`, quantity: 1, system: { name: "Dowell window & door range" }, supplier: "Dowell Windows", frameColourName: "Monument", frameColourFinish: "Satin", frameColourHex: "#323233", glass, screen: "Standard insect screen", hardware: "Black handles" }));

const exterior = { area: "exterior" };
const rows = [
  // Template placeholders seeded into every job: never selections.
  template("Oven", "Westinghouse 600mm Oven"), template("Basin", "Caroma Cube Basin"), template("Roofing", "Roofing Included Selection"),
  guided("roofing", { ...exterior, requirementLabel: "Roofing", productName: "Fascia & gutter package", brand: "COLORBOND steel", roofingConfiguration: { profileProductCode: "ROOFING-LYSAGHT-CUSTOM-ORB-COLORBOND-STEEL", colour: "Basalt" },
    roofPackage: { fascia: { productName: "LYSAGHT NOVALINE Fascia Cover", colour: "Basalt" }, gutters: { productName: "LYSAGHT QUAD Gutter", colour: "Basalt" }, downpipes: { productName: "Iplex DN90 Downpipe", colour: "White" } } }),
  guided("cladding", { ...exterior, requirementLabel: "Cladding", productName: "James Hardie 180mm Linea Board", brand: "James Hardie", colour: "Builder selected exterior finish colour", finish: "Painted fibre cement", quantity: 1, imageReference: "/images/product-library/cladding.jpeg" }),
  guided("entry-door", { ...exterior, requirementLabel: "Entry Door", productName: "Corinthian Sunburst SUN GL", brand: "Corinthian Doors", size: "2040 x 1200 x 40", configuration: "Single door", finish: "Not specified by supplier", glazing: "Translucent",
    glassSelection: { name: "Translucent" }, door: { doorReference: "Entry Door", location: "Entry", quantity: 1 }, entryDoorFurniture: { productName: "Trilock Contemporary Lever Set", brand: "Gainsborough", imageUrl: "/images/furniture.webp" }, furnitureFinish: "Satin Chrome", imageReference: "https://cdn.corinthian.com.au/door.png" }),
  guided("windows", { ...exterior, requirementLabel: "Windows", productName: "Dowell project window schedule", brand: "Dowell", supplier: "Dowell Windows", windowWorkflow: { projectDefaults: {}, effectiveWindows: [...windows(24, "Clear"), ...windows(4, "Obscure privacy glass")] } }),
  guided("garage-door", { ...exterior, requirementLabel: "Garage Door", productName: "Smart Doors & Gates Mediterranean", brand: "Centurion", supplier: "Smart Doors & Gates", colour: "Cottage Green", finish: "COLORBOND steel", quantity: 1, unit: "each", allowance: 3000, selectedPrice: 3000 }),
  guided("external-lighting", { ...exterior, requirementLabel: "External Lighting", productName: "External Lighting Schedule", externalLightingSelection: { scheduleLines: [
    { scheduleLineId: "l1", productName: "Sentinel 2 Light Wall Bracket", brand: "Beacon Lighting", sku: "2303181", finish: "Black", quantity: 3, includedStatus: "upgrade", imageUrl: "https://assets.beacon.com/230318.jpg",
      locations: [{ lightingPointId: "EL01", roomOrExteriorArea: "Front entry, left side", quantity: 1 }, { lightingPointId: "EL02", roomOrExteriorArea: "Front entry, right side", quantity: 1 }, { lightingPointId: "EL03", roomOrExteriorArea: "Garage", quantity: 1 }] }] } }),
  guided("exterior-paint", { ...exterior, requirementLabel: "Exterior Colours", productName: "Exterior Colour Schedule", clientColourSchedule: [
    { areaId: "roof", areaName: "Roof", material: "COLORBOND roofing", finishType: "factory_finished", colourName: "Basalt", supplier: "COLORBOND" },
    { areaId: "fascia", areaName: "Fascia", material: "Painted metal/timber", finishType: "painted", colourName: "Basalt", supplier: "COLORBOND" },
    { areaId: "gutters", areaName: "Gutters", material: "COLORBOND steel", finishType: "factory_finished", colourName: "Basalt", supplier: "COLORBOND" },
    { areaId: "downpipes", areaName: "Downpipes", material: "COLORBOND steel", finishType: "factory_finished", colourName: "Basalt", supplier: "COLORBOND" },
    { areaId: "main-rendered-walls", areaName: "Main rendered walls", material: "Render", finishType: "painted", colourName: "Dune", supplier: "Dulux", swatch: "#b8ad9c" },
    { areaId: "eaves-soffits", areaName: "Eaves/soffits", material: "Fibre cement", finishType: "painted", colourName: "Surfmist", supplier: "Dulux" },
    { areaId: "garage-door-surround", areaName: "Garage door surround", material: "Painted trim", finishType: "painted", colourName: "Monument", supplier: "Dulux" },
    { areaId: "window-surrounds", areaName: "Window surrounds", material: "Painted trim", finishType: "painted", colourName: "Monument", supplier: "Dulux" }] }),
  guided("driveway", { ...exterior, requirementLabel: "Driveway", productName: "Exposed aggregate driveway finish", quantity: 60, drivewaySelection: { finish: "Exposed Aggregate", supplierName: "Boral Exposé", range: "Exposé", mixName: "Salt and Pepper", sampleImage: "https://www.boral.com.au/salt.png" } }),
  guided("balustrades", { ...exterior, requirementLabel: "Balustrades", productName: "Frameless glass balustrade", ...allocation([line("Frameless glass balustrade", [{ location: "Balcony", quantity: 11.5 }, { location: "Internal stairs", quantity: 3 }], { unit: "LM", brand: "Glass House AU", supplier: "Glass House AU", finish: "Clear anodised" })]) }),
  guided("oven", { requirementLabel: "Oven", productName: "Bosch Series 4 900mm Oven", brand: "Bosch", model: "VBC5540S0", quantity: 1, unit: "EACH", imageReference: "/images/catalogues/appliances/vbc5540s0.jpg" }),
  guided("bathroom-basin", { area: "plumbing-fixtures", requirementLabel: "Bathroom Basin", productName: "Riviere 530mm Above Counter Basin", ...allocation([line("Riviere 530mm Above Counter Basin", [{ location: "Main Bathroom", quantity: 1 }, { location: "Ensuite", quantity: 2 }, { location: "Powder Room", quantity: 1 }, { location: "BED 2 ENSUITE", quantity: 1 }])]) }),
  guided("shower-screen", { area: "shower-screens-mirrors", requirementLabel: "Shower Screens", productName: "Essential Framed Shower Screen", ...allocation(["Main Bathroom", "Ensuite", "Bed 2 Ensuite"].map((room, index) => line("Essential Framed Shower Screen", [{ location: room, quantity: 1 }], { lineId: `screen-${index}`, productCode: "SSM-ESSENTIAL", finish: "Bright Silver", configuration: { screenType: "Framed", glass: "Clear" } }))) }),
  guided("electrical-schedule", { area: "electrical-technology", requirementLabel: "Electrical Schedule", productName: "Electrical schedule", electricalSchedule: { rooms: [{ roomKey: "kitchen", room: "Kitchen", points: { "double-gpo": 6 }, status: "confirmed" }, { roomKey: "bedroom-1", room: "Bedroom 1", points: { "double-gpo": 4 }, status: "confirmed" }] } }),
  guided("interior-flooring", { area: "interior", requirementLabel: "Flooring", productName: "Flooring", flooringLines: [
    { lineId: "carpet", productName: "Highland Park Twilight", brand: "Godfrey Hirst", range: "Highland Park", colour: "Twilight", flooringTypeLabel: "Carpet", netAreaM2: 86.35, imageUrl: "/images/catalogues/flooring/carpet.webp", allowanceTotal: 5000, variation: 0,
      rooms: [{ name: "Bedroom 1" }, { name: "Bedroom 2" }, { name: "Media" }] }] }),
  guided("interior-paint", { area: "interior", requirementLabel: "Internal Paint Colours", productName: "Internal paint colours", paintScheme: { defaults: {
    walls: { manufacturer: "Dulux", colourName: "Hog Bristle", colourCode: "S14D1", hex: "#dcd0bb", finish: "Low Sheen" }, trims: { manufacturer: "Dulux", colourName: "Hog Bristle", colourCode: "S14D1", hex: "#dcd0bb", finish: "Semi Gloss" },
    ceilings: { manufacturer: "Dulux", colourName: "Ceiling White", finish: "Flat", standard: true } }, overrides: [{ location: "Media", surface: "walls", choice: { manufacturer: "Dulux", colourName: "Domino", colourCode: "PG1A8", hex: "#353337", finish: "Low Sheen" } }],
    featureWalls: [{ id: "f1", location: "Living", wall: "North wall", choice: { manufacturer: "Dulux", colourName: "Monument", colourCode: "C29", hex: "#404141", finish: "Low Sheen" } }] } }),
  guided("hot-water-system", { area: "hot-water", requirementLabel: "Hot Water System", productName: "Infinity 32", ...allocation([line("Infinity 32 LPG Water Heater", [{ location: "outside", quantity: 1 }], { brand: "Rinnai", variation: 250 })]) }),
  guided("bricks", { ...exterior, requirementLabel: "Bricks", productName: "PGH Smooth Brick", brand: "PGH", familyKey: "bricks" }),
];
const book = { rooms: [{ name: "Book", rows }] };
const schedule = buildSelectionsSchedule(book);
const byItem = (item, section) => schedule.rows.filter((row) => row.item === item && (!section || row.section === section));
const everyText = schedule.rows.flatMap((row) => Object.values(row).filter((value) => typeof value === "string")).join(" | ");

check("THREE SECTIONS ONLY, IN ORDER", () => {
  assert.deepEqual(schedule.sections.map((section) => [section.number, section.title]), [[1, "Exterior Selections"], [2, "Interior Selections"], [3, "Painting Schedule"]]);
  assert.deepEqual(schedule.sections[0].groups.map((group) => group.title), ["Exterior Envelope", "Entry Doors & Hardware", "Windows", "Garage Door", "External Lighting", "External Balustrades", "Driveway & Landscaping"]);
  // Interior follows the Client Selections order, with floor coverings last.
  assert.deepEqual(schedule.sections[1].groups.map((group) => group.title), ["Appliances", "Plumbing Fixtures & Tapware", "Shower Screens & Mirrors", "Electrical", "Hot Water Systems", "Flooring & Carpet"]);
  assert.deepEqual(schedule.sections[2].groups.map((group) => group.title), ["Exterior Painting", "Interior Painting - House Default", "Interior Painting - Feature Walls", "Interior Painting - Room Overrides"]);
  // Section ownership comes from the selection, never from where a page broke.
  assert.equal(byItem("Oven")[0].section, "interior"); assert.equal(byItem("Garage Door")[0].section, "exterior");
});
check("TEMPLATE PLACEHOLDERS ARE NOT SELECTIONS", () => {
  assert.equal(schedule.reconciliation.templatePlaceholders, 3);
  assert(!/Westinghouse|Caroma Cube|Included Selection/.test(everyText));
});
check("EXTERIOR ENVELOPE: PRODUCT ROWS CARRY THEIR FACTORY COLOUR ONCE", () => {
  const envelope = schedule.sections[0].groups[0].rows;
  assert.deepEqual(envelope.map((row) => [row.item, row.colourFinish]), [["Roof", "Basalt"], ["Fascia", "Basalt"], ["Gutters", "Basalt"], ["Downpipes", "White"], ["Cladding", "Painted fibre cement"], ["Bricks", ""]]);
  assert.equal(envelope[0].product, "Lysaght Custom Orb Colorbond Steel");
  // The four roof-line colour records are folded into those rows, not repeated as "Exterior Colours".
  assert.deepEqual(schedule.sources.filter((source) => source.requirementKey === "exterior-paint" && source.consolidated).map((source) => source.note), ["colour shown on the Roof row", "colour shown on the Fascia row", "colour shown on the Gutters row", "colour shown on the Downpipes row"]);
  assert(!schedule.rows.some((row) => /exterior colours/i.test(row.item)));
});
check("PAINT APPLIED ON SITE IS IN THE PAINTING SCHEDULE", () => {
  assert.deepEqual(schedule.sections[2].groups[0].rows.map((row) => [row.item, row.product]), [["Main rendered walls", "Dune"], ["Eaves/soffits", "Surfmist"], ["Garage door surround", "Monument"], ["Window surrounds", "Monument"]]);
  assert(!schedule.rows.some((row) => row.section === "exterior" && /surround|eaves|render/i.test(row.item)));
  // The garage door keeps its own factory colour; only its surround is paint.
  assert.equal(byItem("Garage Door", "exterior")[0].colourFinish, "Cottage Green / COLORBOND steel");
  assert.deepEqual(schedule.sections[2].groups[1].rows.map((row) => [row.item, row.product, row.modelCode, row.colourFinish, row.qtyLocation]),
    [["Main Walls", "Dulux Hog Bristle", "S14D1", "Low Sheen", "Throughout"], ["Trims & Internal Doors", "Dulux Hog Bristle", "S14D1", "Semi Gloss", "Throughout"], ["Ceilings", "Dulux Ceiling White", "", "Flat", "Throughout"]]);
  assert.equal(schedule.sections[2].groups[2].rows.length, 1); assert.equal(schedule.sections[2].groups[3].rows.length, 1);
});
check("WINDOWS ARE A SPECIFICATION, NOT A LIST OF WINDOWS", () => {
  const group = schedule.sections[0].groups.find((item) => item.key === "windows").rows;
  assert.deepEqual(group.map((row) => [row.item, row.qtyLocation, row.colourFinish]), [["Windows", "24 windows", "Frame: Monument, Satin"], ["Windows - Obscure privacy glass", "4 windows", "Frame: Monument, Satin"]]);
  assert.match(group[0].details, /Glass: Clear · Screens: Standard insect screen · Hardware: Black handles/);
  assert(!/\bW\d+\b/.test(group.map((row) => `${row.product} ${row.details}`).join(" ")), "no individual window numbers");
  assert.equal(schedule.sources.filter((source) => source.requirementKey === "windows").length, 28, "every window is accounted for in the reconciliation");
});
check("ENTRY DOOR AND GLASS ARE ONE ROW; HARDWARE THE NEXT", () => {
  const group = schedule.sections[0].groups.find((item) => item.key === "entry-doors").rows;
  assert.deepEqual(group.map((row) => row.item), ["Entry Door & Glass", "Entry Door Hardware"]);
  assert.equal(group[0].details, "2040 x 1200 x 40 · Single door · Glass: Translucent");
  assert.equal(group[0].colourFinish, "", "a supplier's 'Not specified' is not printed as a colour");
});
check("QUANTITIES AND LOCATIONS COME FROM THE SAVED ALLOCATIONS", () => {
  const [basin] = byItem("Bathroom Basin");
  assert.equal(basin.qtyLocation, "Qty 5 - Main Bathroom, Ensuite ×2, Powder Room, Bed 2 Ensuite");
  assert.equal(basin.imageUrl, "/images/catalogues/plumbing/basin.jpg");
  // Three screens of the same product and finish are one row with their three rooms.
  const [screen, ...more] = byItem("Shower Screens");
  assert.equal(more.length, 0); assert.equal(screen.qtyLocation, "Qty 3 - Main Bathroom, Ensuite, Bed 2 Ensuite");
  assert.equal(byItem("Balustrades")[0].qtyLocation, "Qty 14.5 lm - Balcony 11.5 lm, Internal stairs 3 lm");
  assert.equal(byItem("Wall Lights").length, 0); assert.equal(byItem("External Light")[0].qtyLocation, "Qty 3 - Front entry, left side, Front entry, right side, Garage");
  assert.equal(byItem("Driveway")[0].qtyLocation, "60m²");
  assert.equal(byItem("Electrical Point")[0].qtyLocation, "Qty 10 - Kitchen ×6, Bedroom 1 ×4");
  assert.equal(byItem("Carpet")[0].qtyLocation, "86.35m² - Bedroom 1, Bedroom 2, Media");
});
check("NO RAW OBJECTS, NO PRICING", () => {
  assert(!/\[object|undefined|null|NaN/.test(everyText), "no raw value reaches the document");
  assert(!/\$\s?\d|allowance|variation|supplier quote/i.test(everyText), "no pricing in a selections row");
  assert(schedule.rows.every((row) => Object.values(SCHEDULE_STATUS).includes(row.status)), "status is Included, Selected, Upgrade or TBC");
  assert.equal(byItem("External Light")[0].status, "Upgrade"); assert.equal(byItem("Ceilings")[0].status, "Included"); assert.equal(byItem("Hot Water System")[0].status, "Upgrade");
  // The formatters never print a structure.
  assert.equal(text({ lightingPointId: "EL01", roomOrExteriorArea: "Front entry" }), "Front entry"); assert.equal(text([{ name: "A" }, "B", null, { x: 1 }]), "A, B");
  assert.equal(formatLocations([{ location: "Ensuite", quantity: 2 }, { location: "Ensuite", quantity: 1 }, "Kitchen", { x: 1 }]), "Ensuite ×3, Kitchen");
  assert.equal(formatQuantity(1, "EACH"), "1"); assert.equal(formatQuantity(14.5, "LM"), "14.5 lm"); assert.equal(formatQuantity("", "m2"), "");
});
check("IMAGES WHERE THE PRODUCT HAS ONE, NO EMPTY IMAGE DATA", () => {
  for (const item of ["Oven", "Bathroom Basin", "Carpet", "External Light", "Entry Door & Glass", "Entry Door Hardware", "Driveway", "Cladding"]) assert(byItem(item)[0].imageUrl, `${item} shows its product image`);
  // A lookup supplies the image for a selection that only saved its product id.
  const tiles = buildSelectionsSchedule({ rooms: [{ rows: [guided("tiling-rooms", { area: "tiles-stone", requirementLabel: "Tiling", tilingProductTotals: [{ productId: "master-T1", productCode: "T1", productName: "White Gloss Tile", sku: "BELWP100", orderAreaM2: 6.8, rooms: [{ roomName: "Kitchen" }, { roomName: "LAUNDRY" }] }] })] }] },
    { productLookup: (productId) => (productId === "master-T1" ? { imageUrl: "/images/tiles/t1.webp", brand: "National Tiles" } : null) });
  assert.deepEqual([tiles.rows[0].imageUrl, tiles.rows[0].brandSupplier, tiles.rows[0].qtyLocation], ["/images/tiles/t1.webp", "National Tiles", "6.8m² - Kitchen, Laundry"]);
});
check("RECONCILIATION: EVERY SELECTION IS RENDERED OR CONSOLIDATED", () => {
  const rec = schedule.reconciliation;
  assert.equal(rec.ok, true, JSON.stringify({ missing: rec.missing, duplicated: rec.duplicated.map((row) => row.id), unrendered: rec.unrendered.length, sparse: rec.sparsePages }));
  assert.equal(rec.totalSelections, schedule.sources.length);
  assert.equal(rec.records.saved, rows.filter((row) => row.guidedSelection).length);
  assert.equal(rec.records.represented, rec.records.eligible);
  assert.equal(rec.records.missing.length, 0);
  assert.equal(rec.records.directlyRendered + rec.records.consolidatedOnly, rec.records.represented);
  assert.equal(rec.exterior.sources + rec.interior.sources + rec.painting.sources, rec.totalSelections);
  for (const key of ["exterior", "interior", "painting"]) assert.equal(rec[key].rendered + rec[key].consolidated, rec[key].sources);
  const ids = new Set(schedule.rows.map((row) => row.id));
  assert(schedule.sources.every((source) => ids.has(source.rowId)), "every source points at a printed row");
  // Every guided record in the book produced at least one source.
  const keys = new Set(schedule.sources.map((source) => source.requirementKey));
  for (const row of rows.filter((item) => item.guidedSelection)) assert(keys.has(row.guidedRequirementKey), `${row.guidedRequirementKey} is accounted for`);
  // A selection the project does not have is left out on purpose, and only then.
  const hidden = extractScheduleRows(book, { isHidden: (row) => row.guidedRequirementKey === "bricks" });
  assert(!hidden.rows.some((row) => row.item === "Bricks")); assert.equal(hidden.rows.length, schedule.rows.length - 1);
});

// --- Pagination: rows fill the page; a category never owns one. ---
const many = (count) => Array.from({ length: count }, (_, index) => guided(`towel-rail`, { area: "bathroom-accessories", requirementLabel: `Accessory ${index + 1}`, productName: `Accessory product ${index + 1}`, ...allocation([line(`Accessory product ${index + 1}`, [{ location: "Main Bathroom", quantity: 1 }], { lineId: `a-${index}`, productCode: `A-${index}` })]) }));
const long = buildSelectionsSchedule({ rooms: [{ rows: [...rows, ...many(60)] }] });
check("PAGES FILL BEFORE A NEW ONE STARTS", () => {
  assert(long.pages.length > 4);
  long.pages.slice(0, -1).forEach((page) => assert(page.fill >= 0.8, `page ${page.number} is ${Math.round(page.fill * 100)}% full`));
  assert.equal(long.reconciliation.sparsePages.length, 0);
  // Several categories share a page: the first page holds the envelope, doors, windows and more.
  const firstGroups = long.pages[0].blocks.filter((block) => block.type === "group").map((block) => block.title);
  assert(firstGroups.length >= 3 && firstGroups[0] === "Exterior Envelope", firstGroups.join(", "));
  for (const page of long.pages) assert(page.blocks.reduce((total, block) => total + (block.type === "row" ? rowUnits(block.row) : 0), 0) <= SCHEDULE_PAGE_UNITS, `page ${page.number} is not over capacity`);
  // No heading is stranded as the last line of a page.
  for (const page of long.pages) assert.equal(page.blocks.at(-1).type, "row");
});
check("CONTINUATION", () => {
  const pages = long.pages;
  assert.deepEqual(pages.map((page) => page.number), pages.map((_, index) => index + 1));
  const continued = pages.filter((page) => page.continued);
  assert(continued.length > 0 && continued.every((page) => page.blocks[0].type === "group" && page.blocks[0].continued !== undefined));
  // A group that runs over a page break is named again as continued; its section heading is not repeated.
  assert.equal(pages.flatMap((page) => page.blocks).filter((block) => block.type === "section").length, 3);
  assert(pages.some((page) => page.blocks[0].type === "group" && page.blocks[0].continued === true));
  // Each row is printed exactly once.
  const printed = pages.flatMap((page) => page.blocks.filter((block) => block.type === "row").map((block) => block.row.id));
  assert.equal(new Set(printed).size, printed.length); assert.equal(printed.length, long.rows.length);
  // Sections flow on: the next section starts on the page the last one ended on when there is room.
  const starts = Object.fromEntries(pages.flatMap((page) => page.blocks.filter((block) => block.type === "section").map((block) => [block.key, page.number])));
  assert(starts.interior <= pages.find((page) => page.blocks.some((block) => block.type === "row" && block.row.section === "exterior" && block.row === long.sections[0].groups.at(-1).rows.at(-1))).number + 1);
  assert.equal(paginateSchedule(structureSchedule([]), {}).length, 0);
});
check("A SHORT FINAL PAINTING PAGE BORROWS ROWS WITHOUT STRANDING THE PREVIOUS PAGE", () => {
  const makeRows = (section, group, count, swatch = "") => Array.from({ length: count }, (_, index) => ({ section, group, item: `Item ${index + 1}`, product: `Product ${index + 1}`, swatch }));
  const pages = paginateSchedule([
    { key: "interior", number: 2, title: "Interior Selections", groups: [{ key: "flooring", title: "Flooring & Carpet", rows: makeRows("interior", "flooring", 10) }] },
    { key: "painting", number: 3, title: "Painting Schedule", groups: [
      { key: "exterior-painting", title: "Exterior Painting", rows: makeRows("painting", "exterior-painting", 12, "#667788") },
    ] },
  ]);
  assert.equal(pages.length, 2);
  assert(pages.every((page) => page.fill >= 0.55), pages.map((page) => `${page.number}:${page.fill}`).join(", "));
  assert.deepEqual([pages[1].blocks[0].type, pages[1].blocks[0].key], ["section", "painting"]);
  assert.deepEqual([pages[1].blocks[1].key, pages[1].blocks[1].continued], ["exterior-painting", true]);
  assert.equal(pages.flatMap((page) => page.blocks.filter((block) => block.type === "row")).length, 22);
});

for (const [name, result] of Object.entries(results)) console.log(`${name}: ${result}`);
if (Object.values(results).includes("FAIL")) process.exit(1);
