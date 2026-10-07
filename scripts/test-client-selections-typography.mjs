// Client Selections typography guard: no readable text under 16px (lib/builders/clientSelectionsTypography.js).
// Scans CSS (font-size) and inline React styles (fontSize) in the Client Selections pages and
// product-library components; only the declared glyph/icon selectors may be smaller.
//
// Usage: node scripts/test-client-selections-typography.mjs
import fs from "node:fs";
import { CS_TYPE } from "../lib/builders/clientSelectionsTypography.js";

const CLIENT_SELECTIONS_MIN_FONT_PX = CS_TYPE.minimum;
// Icon glyphs (a status tick inside a small circle) may be sized to their container.
const CLIENT_SELECTIONS_ICON_SELECTORS = [".guidedStatusDot"];

const FILES = [
  "pages/modules/builders/selections-book.js",
  "pages/modules/builders/client-selections.js",
  ...fs.readdirSync("components/client-selections").filter((file) => /.jsx?$/.test(file)).map((file) => `components/client-selections/${file}`),
  ...fs.readdirSync("components/product-library").filter((file) => /\.jsx$/.test(file)).map((file) => `components/product-library/${file}`),
];
const failures = [];
for (const file of FILES) {
  fs.readFileSync(file, "utf8").split(/\r?\n/).forEach((line, index) => {
    if (CLIENT_SELECTIONS_ICON_SELECTORS.some((selector) => line.includes(selector))) return;
    for (const match of line.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px|font-size:\s*(\d*\.\d+)rem|fontSize:\s*["']?(\d+(?:\.\d+)?)(?:px)?["']?\s*[,}]/g)) {
      const px = match[1] ? Number(match[1]) : match[2] ? Number(match[2]) * 16 : Number(match[3]);
      if (px < CLIENT_SELECTIONS_MIN_FONT_PX) failures.push(`${file}:${index + 1} ${match[0]}`);
    }
  });
}
if (failures.length) {
  console.error(`Client Selections text below ${CLIENT_SELECTIONS_MIN_FONT_PX}px:\n${failures.join("\n")}`);
  process.exit(1);
}
console.log(`Client Selections typography passed: no readable text below ${CLIENT_SELECTIONS_MIN_FONT_PX}px in ${FILES.length} files.`);
