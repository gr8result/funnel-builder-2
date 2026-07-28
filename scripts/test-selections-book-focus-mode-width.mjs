import assert from "node:assert/strict";
import fs from "node:fs";

// Static regression check for the Focus Mode width fix on
// pages/modules/builders/selections-book.js. A previous pass only hid the
// navigation panels while the worksheet itself stayed capped at a fixed
// max-width and centred, leaving large blank margins. These assertions pin
// down the actual constraints that were removed/overridden so a future edit
// can't silently reintroduce them without this test failing.
const source = fs.readFileSync(
  new URL("../pages/modules/builders/selections-book.js", import.meta.url),
  "utf8"
);

// --- The worksheet page itself must lose its width cap in Focus Mode ---
assert.match(source, /\.page\s*\{[^}]*width:\s*min\(1500px,\s*100%\)/, "normal mode may still cap the page at 1500px");
assert.match(source, /\.screen\.focusMode \.page\s*\{[^}]*max-width:\s*none/, "Focus Mode must remove the page's 1500px cap");
assert.match(source, /\.screen\.focusMode \.documentWrap\s*\{[^}]*justify-content:\s*stretch/, "Focus Mode must stop centring the document wrapper so the page can use full width");
assert.match(source, /\.screen\.focusMode \.topbar, \.screen\.focusMode \.alert\s*\{[^}]*max-width:\s*none/, "Focus Mode must remove the topbar/alert 1500px cap too");

// --- The details panel (About/Inclusions/Spec Summary/Room Image) must be independently collapsible and free its grid column when collapsed ---
assert.match(source, /detailsPanelCollapsed/, "a details-panel collapse state must exist");
assert.match(source, /\.contractPage\.detailsCollapsed\s*\{[^}]*grid-template-columns:\s*220px minmax\(0, 1fr\) 28px/, "collapsing the details panel must shrink its grid column to a slim toggle rail, not leave the 210px column reserved");
assert.match(source, /detailsExpandTab/, "a compact re-open control must exist when the details panel is collapsed");

// --- Focus Mode must default the details panel closed, matching sidebar/nav collapse behaviour, and restore prior state on exit ---
assert.match(source, /function enterFocusMode\(\)\s*\{[\s\S]*?setDetailsPanelCollapsed\(true\)[\s\S]*?\n  \}/, "entering Focus Mode must collapse the details panel by default");
assert.match(source, /function exitFocusMode\(\)\s*\{[\s\S]*?setDetailsPanelCollapsed\(prior \? prior\.detailsPanelCollapsed : false\)[\s\S]*?\n  \}/, "exiting Focus Mode must restore the details panel's prior state");

// --- The table itself must actually receive the released width, with Description/Product-Model as the largest columns ---
assert.match(source, /\.selectionTable\s*\{[^}]*table-layout:\s*fixed/, "the table must use table-layout: fixed so the colgroup widths are honoured");
assert.match(source, /\.selectionTableWrap\s*\{[^}]*width:\s*100%/, "the table wrapper must stretch to the worksheet's full width");

const colgroupMatch = source.match(/<colgroup>([\s\S]*?)<\/colgroup>/);
assert.ok(colgroupMatch, "the selection table must define explicit column widths via <colgroup>, not rely on browser auto-sizing");
const widths = [...colgroupMatch[1].matchAll(/width:\s*"(\d+)%"/g)].map((m) => Number(m[1]));
assert.equal(widths.length, 10, "the colgroup must define a width for all 10 table columns");
const total = widths.reduce((sum, w) => sum + w, 0);
assert.equal(total, 100, "column widths must sum to 100%");
const [itemW, descriptionW, brandW, productModelW] = widths;
assert.ok(descriptionW > itemW && descriptionW > brandW, "Description must be wider than Item/Brand");
assert.ok(productModelW > descriptionW, "Product / Model must be the single widest column");
assert.ok(descriptionW >= 15 && productModelW >= 15, "Description and Product / Model must receive substantial width, not a token increase");

console.log("Selections Book Focus Mode width regression tests passed.");
