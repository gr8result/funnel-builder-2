// Verification harness for the catalogue service (Part B acceptance).
// Run: node --import ./scripts/register-json-loader.mjs scripts/test-catalogue-service.mjs
import * as svc from "../lib/product-library/catalogueService.js";

const ORG = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
let pass = 0;
let fail = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
  ok ? pass++ : fail++;
}

function checkThrows(label, fn) {
  try {
    fn();
    console.log(`  FAIL  ${label} (expected a throw, none raised)`);
    fail++;
  } catch (e) {
    const ok = e instanceof svc.CatalogueProtectionError;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : ` (threw ${e.name}, want CatalogueProtectionError)`}`);
    ok ? pass++ : fail++;
  }
}

// Fresh in-memory storage per scenario.
function freshStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  svc.setCatalogueStorage({
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  });
  svc.resetLegacyMigrationFlag();
  return map;
}

const sel = (fam) => svc.getClientSelectableProducts(ORG, fam).length;
const mas = (fam) => svc.getProductsForFamily(fam).length;
const ROOFING_MASTER_COUNT = 184;

console.log("\n=== B4: master counts are immutable base data ===");
freshStorage();
check("bricks master", mas("bricks"), 147);
check("cladding master", mas("cladding"), 10);
check("roofing master", mas("roofing"), ROOFING_MASTER_COUNT);

console.log("\n=== B1: bricks supplier split ===");
const bricks = svc.getProductsForFamily("bricks");
const brandOf = (p) => `${p.manufacturer} ${p.brand} ${p.supplier} ${p.range}`.toUpperCase();
check("PGH bricks", bricks.filter((p) => brandOf(p).includes("PGH")).length, 75);
check("Austral bricks", bricks.filter((p) => brandOf(p).includes("AUSTRAL")).length, 72);

console.log("\n=== B8: absence of builder state means enabled (no seeding required) ===");
freshStorage();
check("bricks selectable", sel("bricks"), 147);
check("cladding selectable", sel("cladding"), 10);
check("roofing selectable", sel("roofing"), ROOFING_MASTER_COUNT);

console.log("\n=== B6: localStorage can NEVER replace the master catalogue ===");
// Legacy key stuffed with every product flagged inactive/archived - the exact
// payload shape that previously emptied all three families.
const poisoned = JSON.stringify(
  svc.getMasterProducts().map((p) => ({ ...p, active: false, archived: true, discontinued: true })),
);
freshStorage({ "gr8:master-product-catalogue": poisoned });
check("bricks master survives poison", mas("bricks"), 147);
check("cladding master survives poison", mas("cladding"), 10);
check("roofing master survives poison", mas("roofing"), ROOFING_MASTER_COUNT);
check("bricks selectable survives poison", sel("bricks"), 147);
check("cladding selectable survives poison", sel("cladding"), 10);
check("roofing selectable survives poison", sel("roofing"), ROOFING_MASTER_COUNT);

freshStorage({ "gr8:master-product-catalogue": JSON.stringify([]) });
check("empty legacy master key harmless", sel("bricks"), 147);
freshStorage({ "gr8:master-product-catalogue": "{{ not json" });
check("corrupt legacy master key harmless", sel("bricks"), 147);

console.log("\n=== B8: disable hides from client selections but keeps master ===");
freshStorage();
const firstBrick = svc.getProductsForFamily("bricks")[0].productCode;
svc.disableProduct(ORG, firstBrick);
check("bricks selectable after 1 disable", sel("bricks"), 146);
check("bricks MASTER after 1 disable", mas("bricks"), 147);
svc.enableProduct(ORG, firstBrick);
check("bricks selectable after re-enable", sel("bricks"), 147);

console.log("\n=== B5: overrides are per-organisation and do not leak ===");
freshStorage();
svc.disableProduct("other-org-1234", svc.getProductsForFamily("bricks")[0].productCode);
check("our org unaffected by other org disable", sel("bricks"), 147);
check("other org sees its own disable", svc.getClientSelectableProducts("other-org-1234", "bricks").length, 146);

console.log("\n=== B18: family isolation ===");
freshStorage();
svc.disableProduct(ORG, svc.getProductsForFamily("cladding")[0].productCode);
check("edit cladding -> bricks still 147", sel("bricks"), 147);
check("edit cladding -> roofing still full catalogue", sel("roofing"), ROOFING_MASTER_COUNT);
check("edit cladding -> cladding now 9", sel("cladding"), 9);

freshStorage();
svc.disableProduct(ORG, svc.getProductsForFamily("roofing")[0].productCode);
check("edit roofing -> bricks still 147", sel("bricks"), 147);
check("edit roofing -> cladding still 10", sel("cladding"), 10);

freshStorage();
for (const p of svc.getProductsForFamily("ovens")) svc.disableProduct(ORG, p.productCode);
check("edit kitchen -> bricks still 147", sel("bricks"), 147);
check("edit kitchen -> cladding still 10", sel("cladding"), 10);
check("edit kitchen -> roofing still full catalogue", sel("roofing"), ROOFING_MASTER_COUNT);

console.log("\n=== B7: custom builder products append, never overwrite ===");
freshStorage();
svc.addBuilderProduct(ORG, {
  familyKey: "cladding",
  manufacturer: "Test Supplier",
  range: "Test Range",
  productName: "Custom Cladding Board",
  product_code: "CUSTOM-CLAD-001",
});
check("cladding selectable = 10 master + 1 custom", sel("cladding"), 11);
check("cladding MASTER unchanged", mas("cladding"), 10);
check("add cladding -> bricks unchanged", sel("bricks"), 147);
check("add cladding -> roofing unchanged", sel("roofing"), ROOFING_MASTER_COUNT);
checkThrows("cannot redefine a master product as custom", () =>
  svc.addBuilderProduct(ORG, { ...svc.getProductsForFamily("bricks")[0] }),
);

console.log("\n=== B17: destructive write protection ===");
freshStorage();
checkThrows("bricks 147 -> 0 blocked", () => svc.assertNonDestructiveFamilyWrite("bricks", 0));
checkThrows("cladding 10 -> 0 blocked", () => svc.assertNonDestructiveFamilyWrite("cladding", 0));
checkThrows("roofing 3 -> 0 blocked", () => svc.assertNonDestructiveFamilyWrite("roofing", 0));
checkThrows("bricks 147 -> 5 bulk replace blocked", () => svc.assertNonDestructiveFamilyWrite("bricks", 5));
check("bricks 147 -> 147 allowed (individual edits)", svc.assertNonDestructiveFamilyWrite("bricks", 147), true);
check("bricks 147 -> 148 allowed (additions)", svc.assertNonDestructiveFamilyWrite("bricks", 148), true);

console.log("\n=== B16: completed families report LOCKED ===");
check("bricks status", svc.familyStatus("bricks"), "LOCKED");
check("cladding status", svc.familyStatus("cladding"), "LOCKED");
check("roofing status", svc.familyStatus("roofing"), "LOCKED");

console.log("\n=== migration: legacy disables preserved, masking fields dropped ===");
const legacyEnable = JSON.stringify([
  { organisationId: ORG, masterProductCode: svc.getProductsForFamily("cladding")[0].productCode, enabled: false },
]);
freshStorage({ "gr8:master-product-catalogue": poisoned, "gr8:builder-product-enablement": legacyEnable });
check("legacy explicit disable honoured", sel("cladding"), 9);
check("legacy active:false masking ignored", sel("bricks"), 147);

console.log("\n=== B15: Product Library and Client Selections share one source ===");
freshStorage();
// Product Library renders getBuilderProducts(); Client Selections renders
// getClientSelectableProducts(). With no overrides the two must agree exactly.
for (const fam of ["bricks", "cladding", "roofing"]) {
  const lib = svc.getBuilderProducts(ORG, fam).length;
  const cli = svc.getClientSelectableProducts(ORG, fam).length;
  check(`${fam}: Product Library count`, lib, { bricks: 147, cladding: 10, roofing: ROOFING_MASTER_COUNT }[fam]);
  check(`${fam}: library === selections`, lib, cli);
}
// A disable moves both in step: library still lists it, selections hides it.
const clad0 = svc.getProductsForFamily("cladding")[0].productCode;
svc.disableProduct(ORG, clad0);
check("cladding: library still lists disabled product", svc.getBuilderProducts(ORG, "cladding").length, 10);
check("cladding: selections hides disabled product", svc.getClientSelectableProducts(ORG, "cladding").length, 9);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
