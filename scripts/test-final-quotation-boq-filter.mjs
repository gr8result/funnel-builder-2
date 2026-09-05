import assert from "node:assert/strict";
import fs from "node:fs";
import {
  quotationSectionsForFinalBoq,
  quoteLineTotal,
  quoteQuantity,
  shouldIncludeQuoteRowInFinalBoq,
} from "../lib/construction-estimation/finalQuotationBoq.js";

const quotation = {
  "Concrete Slab": {
    displayName: "Concrete Slab",
    rows: [
      { id: "quote-used", item: "Concrete slab", qty: 145, unit: "m2", finalRateUsed: "$120.00", cost: "$17,400.00" },
      { id: "quote-zero", item: "Unused waffle pod option", qty: 0, unit: "m2", finalRateUsed: "$90.00" },
      { id: "quote-hidden", item: "Hidden catalogue row", qty: 12, unit: "m", finalRateUsed: "$20.00", hiddenQuoteRow: true },
      { id: "quote-excluded", item: "Excluded alternative", qty: 5, unit: "each", finalRateUsed: "$100.00", active: false },
      { id: "quote-template", item: "Template allowance placeholder", lineType: "Template row", qty: 1, unit: "item", finalRateUsed: "$1.00" },
      { id: "quote-subtotal", item: "Subtotal Concrete Slab", qty: 1, unit: "item", finalRateUsed: "$17400.00" },
    ],
  },
  "Joinery": {
    displayName: "Joinery",
    rows: [
      { id: "Joinery-custom-123", item: "Estimator-added robe fitout", quantity: 2, unit: "each", manualRate: "$950.00", sourceOfRate: "manual" },
      { id: "quote-unselected-option", item: "Premium robe upgrade", qty: 1, unit: "each", manualRate: "$1500.00", optionSelected: false },
    ],
  },
  "Unused Catalogue Section": {
    displayName: "Unused Catalogue Section",
    rows: [
      { id: "catalogue-only", item: "Catalogue item not used", qty: "", unit: "each", excelRate: "$10.00" },
    ],
  },
};

const sections = quotationSectionsForFinalBoq(quotation);
const rows = sections.flatMap((section) => section.rows);
assert.deepEqual(sections.map((section) => section.sectionKey), ["Concrete Slab", "Joinery"]);
assert.deepEqual(rows.map((row) => row.id), ["quote-used", "Joinery-custom-123"]);
assert.equal(quoteQuantity(rows[0]), 145);
assert.equal(quoteLineTotal(rows[1]), 1900);

for (const row of rows) {
  assert.equal(shouldIncludeQuoteRowInFinalBoq(row), true, `${row.id} should be included`);
}

const excludedIds = quotation["Concrete Slab"].rows.slice(1).concat(quotation.Joinery.rows[1], quotation["Unused Catalogue Section"].rows[0]);
for (const row of excludedIds) {
  assert.equal(shouldIncludeQuoteRowInFinalBoq(row), false, `${row.id} should be excluded`);
}

const syncApi = fs.readFileSync(new URL("../pages/api/builders/sync-commercial-snapshot.js", import.meta.url), "utf8");
assert.ok(syncApi.includes("quotationSectionsForFinalBoq"), "commercial BOQ snapshots must be generated from filtered final quotation sections");
assert.ok(syncApi.includes('source: "final_quotation_builder"'), "BOQ rows should retain their final quotation source marker");
assert.ok(!syncApi.includes("Object.entries(plainObject(calculated.quotation)).forEach"), "snapshot sync must not import every quotation/catalogue row into BOQ");

console.log("Final quotation BOQ filter tests passed.");
