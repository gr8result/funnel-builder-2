import assert from "node:assert/strict";
import fs from "node:fs";
import { EXTERIOR_COLOUR_AREAS, EXTERIOR_COLOUR_PALETTE } from "../lib/builders/clientSelectionWorkflow.js";

// A painted fascia ("Painted metal/timber") was rejected for every ordinary paint
// and COLORBOND colour because the rule searched the material name for "timber".
// Only a genuinely stained finish may restrict the palette.
const source = fs.readFileSync("pages/modules/builders/selections-book.js", "utf8");
const start = source.indexOf("function exteriorAreaColourCompatible(");
assert.ok(start > -1, "Could not locate exteriorAreaColourCompatible");
const body = source.slice(start, source.indexOf("\nfunction ", start + 1));
const compatible = new Function(`${body}; return exteriorAreaColourCompatible;`)();

const areaBy = (id) => EXTERIOR_COLOUR_AREAS.find((area) => area.areaId === id);
const colourBy = (name) => EXTERIOR_COLOUR_PALETTE.find((colour) => colour.colourName === name);

const fascia = areaBy("fascia");
const downpipes = areaBy("downpipes");
const timberPosts = areaBy("timber-posts");
const entryDoor = areaBy("entry-door-painted");
assert.equal(fascia.finishType, "painted", "Fascia is a painted area");
assert.match(fascia.material, /timber/i, "Fascia's material label mentions timber");
assert.equal(timberPosts.finishType, "stained", "Timber posts are a stained area");

const dune = colourBy("Dune");
const monument = colourBy("Monument");
assert.ok(dune && monument, "The palette must offer COLORBOND Dune and Monument");

// The reported bug: fascia must accept the same colours as its neighbouring roofline areas.
assert.equal(compatible(fascia, dune), true, "A painted fascia must accept COLORBOND Dune");
assert.equal(compatible(fascia, monument), true, "A painted fascia must accept COLORBOND Monument");
assert.equal(compatible(downpipes, dune), true, "Downpipes must still accept COLORBOND Dune");
assert.equal(compatible(entryDoor, dune), true, "A painted timber door must accept a paint colour");
console.log("PASS painted areas whose material mentions timber accept ordinary colours.");

// The rule still does its real job for genuinely stained timber.
assert.equal(compatible(timberPosts, dune), false, "Stained timber must reject a plain steel colour");
const stain = EXTERIOR_COLOUR_PALETTE.find((colour) => /stain/i.test(`${colour.range} ${colour.colourName} ${colour.supplier}`));
assert.ok(stain, "The palette must offer a timber stain");
assert.equal(compatible(timberPosts, stain), true, `Stained timber must accept ${stain.colourName}`);
console.log(`PASS stained timber still rejects steel colours and accepts ${stain.colourName}.`);

// Unrelated guards must survive.
assert.equal(compatible({ ...fascia, finishType: "not_painted" }, dune), false, "A not-painted area stays incompatible");
assert.equal(compatible(fascia, {}), true, "An empty colour is treated as compatible");
console.log("PASS not-painted areas and empty colours behave as before.");

// Every painted area in the catalogue must accept at least one standard colour.
const standard = EXTERIOR_COLOUR_PALETTE.filter((colour) => !/stain/i.test(`${colour.range} ${colour.colourName}`));
for (const area of EXTERIOR_COLOUR_AREAS.filter((item) => item.finishType === "painted")) {
  assert.ok(standard.some((colour) => compatible(area, colour)), `${area.areaName} must accept at least one standard colour`);
}
console.log("PASS every painted area accepts at least one standard palette colour.");
