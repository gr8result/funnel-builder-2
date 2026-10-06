import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("pages/modules/builders/selections-book.js", "utf8");

// 1. Window Systems step removed from the workflow sequence.
assert.match(source, /const WINDOWS_WORKFLOW_STEPS = \["schedule", "supplier", "defaults", "windows", "review"\];/, "Window Systems must be removed from the step sequence");
assert.ok(!source.includes('function WindowSystemMappingStep'), "WindowSystemMappingStep component must be deleted, not merely unrendered");
assert.ok(!source.includes('data-testid="windows-system-mapping"'), "Window Systems screen markup must not exist anywhere in the file");
assert.ok(!source.includes('systems: "Window Systems"'), "Window Systems header mapping must be removed");
assert.ok(!/if \(step === "systems"\) return/.test(source), "windowStepStatus must not special-case the removed systems step");

// 2. Supplier selection goes straight to Project Defaults.
assert.ok(source.includes('go("defaults");'), "choosing a supplier must navigate straight to Project Defaults");
assert.ok(!source.includes('go("systems")'), "no navigation call may target the removed systems step");

// 3. Legacy/defensive step remap: a stray windowStep of "systems" can never become active or be
// requested via go(), even though windowStep itself is never actually persisted.
assert.ok(source.includes('windowStep === "systems" ? "defaults" : windowStep'), "a legacy/stale windowStep of systems must map to defaults");
assert.ok(source.includes('step === "systems" ? "defaults" : step'), "go() must defensively remap a systems request to defaults");

// 4. Useful supplier/system data preserved - WINDOW_SUPPLIER_LIBRARY systems maps still intact -
// and the dead-end "Requires selection" placeholder is gone in favour of a real supplier fallback.
["Bradnam's Aluminium Sliding Windows", "Dowell UrbanLine Sliding Windows", "Trend Synergy Sliding Windows"].forEach((name) => {
  assert.ok(source.includes(name), `verified supplier system data must be preserved: ${name}`);
});
assert.ok(!source.includes('{ name: "Requires selection", status: "Selection required", url: supplier.website }'), "the dead-end system placeholder must be replaced with a real supplier-derived fallback");
assert.ok(source.includes('window & door range'), "defaultSystemsByType must fall back to a real supplier-derived range label");

// 5. Trend image fixed to a verified, non-404 URL from Trend's own site.
assert.ok(!source.includes('image: "https://www.trendwindows.com.au/cdn/shop/files/Trend-Windows-Doors-Residential-Windows.jpg"'), "the broken Trend image URL must no longer be the active image field");
assert.ok(source.includes('image: "https://www.trendwindows.com.au/cdn/shop/files/5.website.jpg'), "Trend must use the verified working product image");

// 6. Supplier cards: per-supplier tint + larger titles.
["bradnams", "dowell", "trend"].forEach((key) => {
  assert.ok(source.includes(`[data-supplier-key="${key}"]`), `supplier card tint selector must exist for ${key}`);
});
assert.ok(source.includes("data-supplier-key={supplier.key}"), "each supplier button must carry its key for the tint selectors to target");
assert.ok(source.includes(".windowSupplierGrid button strong { font-size: 21px"), "supplier titles must be enlarged");

// 7. Individual Windows: Window Code (not internal id) is the primary visible identifier; Room/
// Location and Glass Type (canonical, distinct from the client-selected "Selected Glass" column)
// are read from canonical data, never fabricated.
assert.ok(source.includes("<th>Window Code</th><th>Room / Location</th><th>Glass Type</th>"), "Individual Windows must lead with Window Code, then Room/Location and Glass Type");
assert.ok(source.includes("<th>Selected Glass</th>"), "the client-selected glass column must remain distinct from the canonical Glass Type column");
assert.ok(!source.includes("<th>ID</th>"), "the raw internal ID column must no longer be a visible table header");
assert.ok(source.includes('td className="windowCodeCell"'), "Window Code must render as the primary identifier cell");
assert.ok(source.includes('row.location || row.room || "—"'), "Room/Location must show an honest placeholder, never a fabricated value, when not yet available");
assert.ok(!source.includes('row.location || "Unspecified"') && !/Room.*Location.*Unspecified/.test(source), "Room/Location must never fall back to a fabricated 'Unspecified' value");
assert.ok(source.includes("wetAreaGlassTypeWarning"), "a canonical-glass-type wet-area warning must be wired up, ready for when Takeoff exports it");
assert.ok(source.includes("OBSCURE_GLASS_TYPE_PATTERN"), "an obscure/privacy glass type pattern must exist for the canonical wet-area check");

console.log("Windows workflow system-step-removal tests passed.");
