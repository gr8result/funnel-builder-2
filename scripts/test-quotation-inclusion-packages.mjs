// Quotation V1 inclusion packages: Premier is the only and default package; Classic and Premium
// are not mapped in V1 and must not be presented as available.
// Run: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-quotation-inclusion-packages.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { createDefaultStandardInclusions, normaliseStandardInclusions, selectedStandardInclusionsPackage } from "../lib/builders/standardInclusions.js";
import { CURRENT_BUILDER_WORKSPACE_ID, currentBuilderScheduleSeeds } from "../lib/builders/currentBuilderSeed.js";

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log("PASS", name); };

check("default inclusions have exactly one package: Premier, marked default and selected", () => {
  for (const builder of ["local-builder", CURRENT_BUILDER_WORKSPACE_ID]) {
    const value = normaliseStandardInclusions({}, builder);
    assert.equal(value.packages.length, 1);
    assert.match(value.packages[0].name, /^Premier/);
    assert.equal(value.packages[0].is_default, true);
    assert.equal(selectedStandardInclusionsPackage(value).package?.id, value.packages[0].id);
  }
});

check("no Classic or Premium package exists in the shipped defaults", () => {
  const names = createDefaultStandardInclusions("local-builder").packages.map((p) => p.name);
  assert(!names.some((n) => /classic|premium/i.test(n)), names.join(", "));
});

check("another builder gets no invented package until it uploads its own schedule", () => {
  assert.deepEqual(createDefaultStandardInclusions("another-builder-workspace").packages, []);
});

check("Classic/Premium schedule seeds exist only for the original builder and are marked UNMAPPED", () => {
  const seeds = currentBuilderScheduleSeeds(CURRENT_BUILDER_WORKSPACE_ID);
  for (const name of ["Classic Inclusions", "Premium Inclusions"]) assert.equal(seeds.find((s) => s.name === name)?.metadata?.mappingStatus, "UNMAPPED");
  assert.deepEqual(currentBuilderScheduleSeeds("another-builder-workspace"), []);
});

check("the workspace card does not advertise Classic or Premium as available", () => {
  const source = fs.readFileSync("components/estimate-builder/EstimateBuilderWorkbook.js", "utf8");
  assert(!source.includes("Classic, Premier, Premium and custom inclusion templates."));
  assert(source.includes("Classic and Premium are not available yet."));
});

console.log(`\n${passed} checks passed`);
