// 10 Nov 2026: Quotation Builder display grouping. CABINET MAKER (old template) shows inside CABINETRY,
// and DOOR JAMB MATERIALS shows under DOORS straight after DOOR JAMBS. Display only: every section is
// still shown exactly once and keeps its own rows. Uses the component's own grouping functions. Run:
//   node scripts/test-quotation-display-grouping.mjs [restored.gr8job]
import assert from "node:assert/strict";
import fs from "node:fs";
import JSZip from "jszip";

const root = new URL("../", import.meta.url);
const src = fs.readFileSync(new URL("components/estimate-builder/EstimateBuilderWorkbook.js", root), "utf8").replace(/\r\n/g, "\n");
const lib = fs.readFileSync(new URL("lib/construction-estimation/quoteTradeHierarchy.js", root), "utf8").replace(/^export /gm, "");

// Pull the grouping functions and constants out of the component (it is a React module, not importable here).
const want = /^(function (is\w+|quoteSectionBaseName|topLevelQuoteSections|ordered\w*|clientSelection\w+|cabinetryChildSections|builtInQuoteChildSectionsForParent|quoteChildSectionsForParent|applianceBrand\w*|quoteSectionListMemo|memoisedForSections)\(|const [A-Z_]*(SUBSECTIONS|SUBSECTION_ORDER|TRADE_PARENTS|BRANDS?|SECTION_NAMES) = |const (quoteSectionBaseNames|quoteSectionListMemos) = )/;
const lines = src.split("\n");
const picked = [];
for (let i = 0; i < lines.length; i++) {
  if (!want.test(lines[i])) continue;
  if (/^function is/.test(lines[i]) && !/Section|Subsection/.test(lines[i])) continue;
  let depth = 0, j = i, started = false;
  const buf = [];
  for (; j < lines.length; j++) {
    buf.push(lines[j]);
    const code = lines[j].replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "").replace(/\/(?![*/])(?:\\.|[^/\n])+\/[gimsuy]*/g, "");
    for (const c of code) { if ("{([".includes(c)) { depth++; started = true; } if ("})]".includes(c)) depth--; }
    if (started && depth <= 0 && /[;}\]]\s*$/.test(lines[j])) break;
    if (!started && /;\s*$/.test(lines[j])) break;
  }
  picked.push(buf.join("\n"));
  i = j;
}
const { topLevelQuoteSections, quoteChildSectionsForParent } = new Function(`${lib}\n${picked.join("\n\n")}\nreturn { topLevelQuoteSections, quoteChildSectionsForParent };`)();

function tree(order) {
  const top = topLevelQuoteSections(order);
  const shown = [];
  const children = {};
  top.forEach((section) => { shown.push(section); children[section] = quoteChildSectionsForParent(section, order); shown.push(...children[section]); });
  return { top, children, shown };
}

let passed = 0;
const check = async (name, fn) => { await fn(); passed += 1; console.log("PASS", name); };

const sample = ["DOORS (71)", "DOUBLE ENTRY DOORS (66)", "DOOR JAMBS (69)", "DOOR FURNITURE (72)", "CABINETRY", "CABINET MAKER", "BUTLERS PANTRY", "LAUNDRY", "BATHROOMS", "WARDROBES", "PAINTER (146)", "DOOR JAMB MATERIALS"];

await check("one cabinetry heading: CABINET MAKER and its rooms show inside CABINETRY", () => {
  const { top, children } = tree(sample);
  assert.ok(top.includes("CABINETRY") && !top.includes("CABINET MAKER"));
  assert.deepEqual(children.CABINETRY, ["CABINET MAKER", "BUTLERS PANTRY", "LAUNDRY", "BATHROOMS", "WARDROBES"]);
});

await check("DOOR JAMB MATERIALS shows under DOORS straight after DOOR JAMBS", () => {
  const { top, children } = tree(sample);
  assert.ok(!top.includes("DOOR JAMB MATERIALS"));
  assert.deepEqual(children["DOORS (71)"], ["DOUBLE ENTRY DOORS (66)", "DOOR JAMBS (69)", "DOOR JAMB MATERIALS", "DOOR FURNITURE (72)"]);
});

await check("every section is shown exactly once", () => {
  const { shown } = tree(sample);
  assert.deepEqual([...shown].sort(), [...sample].sort());
});

await check("without CABINETRY, CABINET MAKER stays a main heading with its rooms", () => {
  const order = sample.filter((s) => s !== "CABINETRY");
  const { top, children } = tree(order);
  assert.ok(top.includes("CABINET MAKER"));
  assert.deepEqual(children["CABINET MAKER"], ["BUTLERS PANTRY", "LAUNDRY", "BATHROOMS", "WARDROBES"]);
});

const restoredFile = process.argv[2];
if (restoredFile && fs.existsSync(restoredFile)) {
  const zip = await JSZip.loadAsync(fs.readFileSync(restoredFile));
  const workbook = JSON.parse(await zip.file("estimate.json").async("string")).workbook;
  await check("restored job: all sections shown once, 49 main headings", () => {
    const order = Object.keys(workbook.quotation);
    const { top, shown } = tree(order);
    assert.equal(shown.length, order.length);
    assert.deepEqual([...shown].sort(), [...order].sort());
    assert.equal(top.length, 49);
  });
}
console.log(`\n${passed} checks passed`);
