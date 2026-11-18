// Entry Doors > Review & Confirm (defect 2026-11-12): "Confirm complete door selection" did nothing.
// - a missing choice made the save return silently; now it is listed;
// - the button now waits for the job save and shows Saving / Not saved (with the reason) / moves on;
// - the furniture finish is never filled in with the first option (Review showed Bright Chrome while
//   the saved schedule said Satin Chrome); a difference from the saved finish must be chosen.
//   node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-entry-door-confirmation.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { entryDoorMissingChoices, furnitureFinishAfterProductChange } from "../lib/builders/entryDoorFurnitureSelection.js";

// Missing choices are named in step order.
assert.deepEqual(entryDoorMissingChoices({}), []);
assert.deepEqual(entryDoorMissingChoices({ furnitureFinish: true, finish: true }), ["Colour / Finish", "Door furniture finish"]);

// Picking furniture keeps the chosen finish when offered; one finish needs no choice; otherwise empty.
const trilock = { productCode: "EDF-GAINSBOROUGH-8951CONSC", finishOptions: ["Bright Chrome", "Satin Chrome", "Matt Black"] };
assert.equal(furnitureFinishAfterProductChange(trilock, "Satin Chrome"), "Satin Chrome", "the client's Satin Chrome is kept, not replaced by Bright Chrome");
assert.equal(furnitureFinishAfterProductChange(trilock, "satin chrome"), "Satin Chrome");
assert.equal(furnitureFinishAfterProductChange(trilock, ""), "", "no silent first option");
assert.equal(furnitureFinishAfterProductChange(trilock, "Polished Brass"), "", "a finish the product does not offer is not carried over");
assert.equal(furnitureFinishAfterProductChange({ finishOptions: ["Satin Stainless"] }, ""), "Satin Stainless");

// The page wiring (source contract; the real-browser run is a separate acceptance step).
const page = fs.readFileSync("pages/modules/builders/selections-book.js", "utf8");
assert.ok(!page.includes("entryDoorFurnitureFinish || furnitureFinishes[0]"), "Review never shows the first finish as if chosen");
assert.ok(!page.includes("onEntryDoorFurnitureFinishChange(item.finishOptions?.[0]||'')"), "picking furniture does not reset the finish to the first option");
assert.match(page, /onClick=\{confirmDoorSelection\}/, "Confirm runs the awaited save");
assert.match(page, /data-testid="entry-door-confirm-error"/, "a failed or incomplete confirm is shown next to the button");
assert.match(page, /data-testid="entry-door-review-finish-differs"/, "a finish different from the saved one must be chosen");
assert.match(page, /return commitGuidedRequirementPatch\(requirement, patch, \{ autoAdvance: false, persist: true, successMessage: `Door \$\{option\.door\.doorReference\} saved\.`/, "the entry-door save returns its result");
assert.match(page, /if \(missing\.length\) return Promise\.resolve\(\{ ok: false, missing \}\)/, "missing choices are returned, not swallowed");
assert.ok(!/if \(\(requiredSizes\.length && !nextSize\)[^\n]*\) return;/.test(page), "the old silent return is gone");
console.log("PASS entry-door confirm: missing choices listed, save awaited with visible result, no substituted furniture finish");
