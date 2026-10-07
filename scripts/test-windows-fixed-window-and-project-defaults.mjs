import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("pages/modules/builders/selections-book.js", "utf8");

// 1. Project Defaults: three visually distinct, coloured sections with larger headings.
["glass", "screen", "hardware"].forEach((section) => {
  assert.ok(source.includes(`windowDefaultSection--${section}`), `a distinct section class must exist for ${section}`);
});
assert.ok(source.includes(".windowDefaultSection--glass { background: #eff6ff"), "Glass section must have a distinct light-blue tint");
assert.ok(source.includes(".windowDefaultSection--screen { background: #f0fdf4"), "Screen section must have a distinct light-green tint");
assert.ok(source.includes(".windowDefaultSection--hardware { background: #fff7ed"), "Hardware section must have a distinct light-warm tint");
assert.ok(source.includes(".windowDefaultSection h3 { margin: 0 0 12px; font-size: 19px"), "section headings must be enlarged");
assert.ok(source.includes('<section className="windowDefaultSection windowDefaultSection--glass">'), "Default glass must be wrapped in its own tinted section");
assert.ok(source.includes('<section className="windowDefaultSection windowDefaultSection--screen">'), "Default screen must be wrapped in its own tinted section");
assert.ok(source.includes('<section className="windowDefaultSection windowDefaultSection--hardware">'), "Default hardware must be wrapped in its own tinted section");

// 2. The bottom bulk-apply/by-level/by-room/by-type control area is gone; defaults apply
// automatically, and a plain Continue replaces the old "Apply Project Defaults" button.
["Apply Project Defaults to All Compatible Windows", "Apply to Selected Windows", "Apply Level", "Apply Room", "Apply Type", "Choose level", "Choose room", "Choose type", "windowApplyControls", "applyColourToWindows", "applyDefaults"].forEach((text) => {
  assert.ok(!source.includes(text), `surplus Project Defaults bulk-apply UI must be fully removed: "${text}"`);
});
assert.ok(source.includes('<button type="button" className="primary" onClick={continueToWindows}>Continue to Individual Windows</button>'), "a plain Continue button must replace the removed Apply button");
assert.ok(source.includes("continueToWindows"), "continuing must not itself be required to make defaults take effect - it only validates and advances");

// 3. Fixed-window compatibility rule: screen/hardware resolve to N/A, ahead of override and
// project default, sourced from the real canonical opening style (never array position).
assert.ok(source.includes('const FIXED_WINDOW_NOT_APPLICABLE = "Not applicable - fixed window";'), "a shared fixed-window N/A constant must exist");
assert.ok(source.includes("const screenApplicable = !item.isFixed;"), "screenApplicable must be driven by the real canonical isFixed flag");
assert.ok(source.includes("const screen = item.isFixed ? FIXED_WINDOW_NOT_APPLICABLE"), "a fixed window's screen must resolve to N/A ahead of any override/default");
assert.ok(source.includes("const hardware = item.isFixed ? FIXED_WINDOW_NOT_APPLICABLE"), "a fixed window's hardware must resolve to N/A ahead of any override/default");

// 4. Documented/canonical Glass Type precedence: individual override > canonical Takeoff > project
// default - distinct from the client-selected supplier glass product (`glass`).
assert.ok(source.includes("const documentedGlassType = override.glassName ? selectedGlassClass : (item.glassType || selectedGlassClass || \"\");"), "documentedGlassType must follow override -> canonical Takeoff -> project default precedence");
assert.ok(source.includes("wetAreaGlassTypeWarning: Boolean(isWetArea && documentedGlassType"), "the wet-area warning must be based on the precedence-aware documented glass type");

// 5. Individual Windows / Review: raw internal id removed as a visible column everywhere; Window
// Code and Type/Style (the real canonical opening style) take its place.
assert.ok(!source.includes("<th>ID</th>") && !source.includes("<th>Window ID</th>"), "no visible table may show the raw internal id as a column");
assert.ok(source.includes("<th>Window Code</th><th>Room / Location</th><th>Glass Type</th><th>Type / Style</th>"), "Individual Windows must show Window Code, Room/Location, Glass Type, Type/Style");
assert.ok(source.includes("<th>Window Code</th><th>Room / Location</th><th>Floor</th><th>Elevation</th><th>Type / Style</th>"), "Review must show Window Code (not raw id), Room/Location, and Type/Style");
assert.ok(source.includes("{row.openingStyle || row.type}"), "the visible Type/Style cell must prefer the real canonical opening style");

console.log("Windows fixed-window and Project Defaults tests passed.");
