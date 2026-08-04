import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normalizeAccordionHeading } from "../lib/website-builder/accordionHeadingText.js";

const white = normalizeAccordionHeading('<span style="font-size: 16px; color: rgb(255, 255, 255);">AI Campaign Builder</span>');
assert.equal(white.text, "AI Campaign Builder", "Legacy span title should render visible text only.");
assert.equal(white.style.fontSize, "16px", "Legacy span font size should be preserved.");
assert.equal(white.style.color, "rgb(255, 255, 255)", "White title colour should be preserved.");

const gold = normalizeAccordionHeading('<span style="font-size: 16px; color: rgb(255, 192, 0);">Step 2 — Content Generated</span>');
assert.equal(gold.text, "Step 2 — Content Generated", "Gold legacy span title should render visible text only.");
assert.equal(gold.style.color, "rgb(255, 192, 0)", "Gold title colour should be preserved.");

const plain = normalizeAccordionHeading("Step 1 — Choose Your Campaign", { color: "#ffffff", fontSize: "16px" });
assert.equal(plain.text, "Step 1 — Choose Your Campaign", "Plain-text accordion titles should still work.");
assert.equal(plain.style.color, "#ffffff", "Plain-text titles should keep fallback colour.");

const malicious = normalizeAccordionHeading('<span onclick="alert(1)" style="color: rgb(255, 192, 0); font-size: 16px;">Step 3 — Review and Edit</span><script>alert(1)</script>');
assert.equal(malicious.text, "Step 3 — Review and Edit", "Malicious script content should be removed from headings.");
assert.equal(malicious.text.includes("alert"), false, "Script text should not appear in heading text.");
assert.equal(malicious.style.color, "rgb(255, 192, 0)", "Safe inline colour should survive malicious attributes.");

const encoded = normalizeAccordionHeading("&amp;lt;span style=&amp;quot;font-size: 16px; color: rgb(255, 192, 0);&amp;quot;&amp;gt;Step 4 — Schedule and Publish&amp;lt;/span&amp;gt;");
assert.equal(encoded.text, "Step 4 — Schedule and Publish", "Repeatedly encoded legacy strings should normalise to visible heading text.");
assert.equal(encoded.style.color, "rgb(255, 192, 0)", "Repeatedly encoded style values should be preserved when safe.");

const renderer = fs.readFileSync(path.join(process.cwd(), "components/website-builder/website-renderer/wbBlockComponents.js"), "utf8");
assert.match(renderer, /normalizeAccordionHeading\(panel\.eyebrow \|\| \(editor \? "Category label" : ""\)/, "Preview/live open accordion heading must use the shared heading normalizer.");
assert.match(renderer, /normalizeAccordionHeading\(panel\.eyebrow \|\| panel\.heading \|\| `Panel \$\{idx \+ 1\}`/, "Preview/live stacked accordion labels must use the shared heading normalizer.");
assert.doesNotMatch(renderer, /<span style=\{\{[^}]*\}\}>\s*\{panel\.eyebrow \|\| panel\.heading \|\| `Panel \$\{idx \+ 1\}`\}\s*<\/span>/, "Live accordion labels must not render raw panel.eyebrow strings directly.");

console.log("Website accordion heading normalization checks passed.");
