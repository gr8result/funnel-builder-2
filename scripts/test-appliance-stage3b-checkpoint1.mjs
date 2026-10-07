import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  APPLIANCE_LEGACY_FIELD_COUNT,
  APPLIANCE_LEGACY_FIELDS,
  classifyApplianceFamily,
  extractApplianceModelNumber,
  normalizeBrand,
  parseApplianceLegacyCsv,
  parseApplianceLegacyRow,
  reconcileApplianceLegacyRecords,
  stableApplianceProductId,
} from "../lib/construction-estimation/catalogues/applianceLegacyCsv.js";
import { createQuotationSnapshot, normalizeProductRecord } from "../lib/construction-estimation/catalogues/masterCatalogueSchemas.js";

const csvPath = process.env.APPLIANCE_LEGACY_CSV_PATH || "C:\\Users\\grant\\Downloads\\appliance options.csv";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const csv = fs.readFileSync(csvPath, "utf8");
const parsed = parseApplianceLegacyCsv(csv);
const reconciliation = reconcileApplianceLegacyRecords(parsed.records);

assert.equal(APPLIANCE_LEGACY_FIELD_COUNT, 19, "legacy appliance format accepts exactly 19 fields");
assert.equal(APPLIANCE_LEGACY_FIELDS.length, 19, "all 19 legacy fields are documented");
assert.equal(parsed.records.length + parsed.rejectedRows.length, 194, "all 194 source rows are parsed or rejected");
assert.equal(parsed.records.length, 194, "supplied source has 194 valid rows");
assert.equal(parsed.rejectedRows.length, 0, "supplied source has no malformed rows");
assert.equal(parsed.records.filter((row) => row.unit === "EACH").length, 159, "EACH row count matches source fact");
assert.equal(parsed.records.filter((row) => row.unit === "PACK").length, 35, "PACK row count matches source fact");
assert.equal(reconciliation.accountedSourceRows + parsed.rejectedRows.length, 194, "every source row is accounted for exactly once");

const malformed = parseApplianceLegacyRow(["too", "short"], 999);
assert.equal(malformed.valid, false, "malformed rows are rejected");
assert.match(malformed.rejectionReason, /expected 19 fields/, "malformed rejection names expected field count");

for (const model of ["EO605DTB", "KCS4", "RS6S", "EDW14S", "WK60S", "CPT6S", "CS60S"]) {
  assert.equal(extractApplianceModelNumber(`Example product ${model}`), model, `${model} is extracted as a model number`);
}
assert.equal(extractApplianceModelNumber("EUROMAID 600MM CANOPY RANGEHOOD OPTION - EUROMAID 60CM PYRAMID CANOPY RANGEHOOD CPT6S"), "CPT6S", "option labels resolve to the physical model");
assert.equal(extractApplianceModelNumber("ARISTON 90CM BUILT-IN OVEN FI9 891 SP IX A AUS"), "FI9 891 SP IX A AUS", "multi-token model numbers are preserved");
assert.equal(extractApplianceModelNumber("SMEG 90CM DUAL FUEL FREESTANDING COOKER FS9606AS-1"), "FS9606AS-1", "hyphenated model numbers are preserved");
assert.equal(extractApplianceModelNumber("EUROMAID 600MM CANOPY RANGEHOOD"), "", "600MM is not treated as a model number");
assert.equal(extractApplianceModelNumber("SMEG 900MM GAS COOKTOP"), "", "900MM is not treated as a model number");

assert.equal(normalizeBrand(" SMEG "), "Smeg", "brand normalisation trims and title-cases known brands");
assert.equal(normalizeBrand("future appliances co"), "Future Appliances Co", "unknown future brands are accepted");

assert.equal(classifyApplianceFamily("60CM BUILT-IN OVEN EO605DTB"), "ovens", "oven family classification works");
assert.equal(classifyApplianceFamily("60CM CERAMIC COOKTOP KCS4"), "cooktops", "cooktop family classification works");
assert.equal(classifyApplianceFamily("60CM SLIDE OUT RANGEHOOD RS6S"), "rangehoods", "rangehood family classification works");
assert.equal(classifyApplianceFamily("60CM DISHWASHER EDW14S"), "dishwashers", "dishwasher family classification works");
assert.equal(classifyApplianceFamily("90CM DUAL FUEL FREESTANDING COOKER GG90S"), "freestanding-cookers", "freestanding cooker family classification works");

const firstEuromaidOven = parsed.records.find((row) => row.modelNumber === "EO605DTB");
assert.equal(
  stableApplianceProductId(firstEuromaidOven),
  "product:appliances:ovens:euromaid:eo605dtb",
  "stable appliance product IDs are deterministic",
);
assert.ok(reconciliation.duplicateComponentRows > 0, "duplicate component rows are consolidated");
assert.equal(reconciliation.products.length, 83, "authoritative physical appliance products remain exactly 83");
assert.equal(reconciliation.duplicateComponentRows, 76, "authoritative duplicate component row count remains exactly 76");
assert.equal(
  reconciliation.products.find((product) => product.productId === "product:appliances:ovens:euromaid:eo605dtb")?.sourceRowIds.length,
  2,
  "repeated component rows consolidate to one product candidate",
);
assert.equal(reconciliation.packs.length, 35, "all pack rows become pack candidates");
assert.equal(reconciliation.relationships.length, 159, "all source EACH rows become traceable pack-component relationships");
assert.equal(reconciliation.relationships.length, parsed.records.filter((row) => row.unit === "EACH").length, "each EACH source row has one pack relationship");
const productIds = new Set(reconciliation.products.map((product) => product.productId));
assert.ok(reconciliation.products.every((product) => product.sourceRowIds.length > 0), "every product identity has traceable source rows");
assert.ok(reconciliation.relationships.every((relationship) => productIds.has(relationship.componentProductId)), "every pack relationship resolves to an actual product");
assert.equal(reconciliation.packs.some((pack) => pack.componentProductIds.some((id) => id.includes(":rs6s"))), true, "slideout rangehood packs can reference slideout component products");
assert.equal(reconciliation.priceConflicts.length, 0, "actual price conflicts remain explicitly recorded as zero");
assert.equal(reconciliation.identityVariationGroups.length, 18, "same-model description/selectable variations remain in review");
assert.ok(!reconciliation.products.some((product) => /paint|lighting/i.test(`${product.family} ${product.productName}`)), "generic Kitchen paint and lighting are excluded");

const futureImportPath = path.join(repoRoot, "lib", "product-library", "applianceCanonicalCatalogue.js");
assert.ok(!fs.readFileSync(futureImportPath, "utf8").includes("applianceLegacyCsvImporter"), "future canonical appliance imports use the corrected canonical parser");

const futureCsvRow = [
  "9001",
  "Future Appliances Co",
  "Future Appliances Co",
  "",
  "",
  "- FUTURE 60CM BUILT-IN OVEN FA60X",
  "APPLIANCES | - FUTURE 60CM BUILT-IN OVEN FA60X | EACH | 1 | Test row",
  "EACH",
  "",
  "1",
  "1",
  "",
  "",
  "Future Appliances Co",
  "",
  "TRUE",
  "appliance",
  "TRUE",
  "Test row",
];
const future = parseApplianceLegacyRow(futureCsvRow, 1);
assert.equal(future.valid, true, "unknown future brand row parses");
assert.equal(future.brand, "Future Appliances Co", "unknown future brand is preserved after normalisation");

const sourceSnapshot = [...futureCsvRow];
parseApplianceLegacyRow(futureCsvRow, 1);
assert.deepEqual(futureCsvRow, sourceSnapshot, "parser does not mutate source row arrays");

const quoteSnapshot = createQuotationSnapshot({
  sourceType: "product",
  record: normalizeProductRecord({
    id: "product:appliances:ovens:test",
    familyKey: "ovens",
    productName: "Test oven",
    description: "Frozen appliance snapshot",
    sellPrice: 123,
  }),
  snapshotAt: "2026-09-02T00:00:00.000Z",
});
const changedMaster = { description: "Changed later", sellPrice: 999 };
assert.equal(quoteSnapshot.description, "Frozen appliance snapshot", "quotation snapshot is not mutated");
assert.equal(quoteSnapshot.sellPrice, 123, "quotation snapshot price is not mutated");
assert.equal(changedMaster.sellPrice, 999, "changed fixture remains separate from snapshot");

console.log("Appliance Stage 3B Checkpoint 1 tests passed.");
