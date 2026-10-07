import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  applyStylePatchToElement,
  replaceSelectionBlockTag,
  resolveSelectionBlockElement,
} from "../lib/website-builder/textSectionEditorDom.js";

function createEditorDom() {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="editable" class="wb-text-block" data-text-prop="text" contenteditable="true">
      <h3 id="h-instant">Instant SMS Marketing</h3>
      <p id="p-never">Never Miss Another Opportunity</p>
      <h3 id="h-powerful">Powerful SMS Features</h3>
      <p id="p-list">Use SMS to:</p>
      <h3 id="h-increase">Increase Response Rates</h3>
    </div>
    <div id="toolbar">toolbar</div>
  </body></html>`);

  global.window = dom.window;
  global.document = dom.window.document;
  global.Node = dom.window.Node;
  global.Element = dom.window.Element;
  return dom;
}

function selectCaretInside(element) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  return range;
}

function restoreSavedRange(savedRange) {
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(savedRange);
}

const dom = createEditorDom();
const editable = document.getElementById("editable");
const powerful = document.getElementById("h-powerful");
const increase = document.getElementById("h-increase");
const instant = document.getElementById("h-instant");

// 1) Selecting one heading and centering it does not center siblings.
selectCaretInside(powerful);
const selected1 = resolveSelectionBlockElement(editable, window.getSelection());
applyStylePatchToElement(selected1, { textAlign: "center" });
assert.equal(powerful.style.textAlign, "center", "Selected heading should be centered");
assert.equal(instant.style.textAlign, "", "Sibling heading must not be centered");
assert.equal(increase.style.textAlign, "", "Other heading must remain unchanged");

// 2) Selecting one heading and changing font size does not affect siblings.
selectCaretInside(powerful);
const selected2 = resolveSelectionBlockElement(editable, window.getSelection());
applyStylePatchToElement(selected2, { fontSize: "28px" });
assert.equal(powerful.style.fontSize, "28px", "Selected heading should receive new font size");
assert.equal(instant.style.fontSize, "", "Sibling font size must remain unchanged");

// 3) Heading hierarchy change persists.
selectCaretInside(increase);
const selected3 = resolveSelectionBlockElement(editable, window.getSelection());
const converted = replaceSelectionBlockTag(selected3, "h2");
assert.equal(converted.tagName, "H2", "Selected block should convert to H2");
assert.equal(converted.textContent, "Increase Response Rates", "Converted heading text should be retained");

// 4) Toolbar interaction does not lose active target.
selectCaretInside(powerful);
const savedRange = window.getSelection().getRangeAt(0).cloneRange();
document.getElementById("toolbar").focus?.();
restoreSavedRange(savedRange);
const selected4 = resolveSelectionBlockElement(editable, window.getSelection());
assert.equal(selected4?.id, "h-powerful", "Active text target should be restorable after toolbar interaction");

// 5) Different headings can have different formatting.
applyStylePatchToElement(powerful, { fontWeight: "700" });
applyStylePatchToElement(converted, { fontSize: "24px", textAlign: "center" });
assert.equal(powerful.style.fontWeight, "700", "First heading should keep bold styling");
assert.equal(converted.style.fontSize, "24px", "Second heading should keep its independent font size");
assert.equal(converted.style.textAlign, "center", "Second heading should keep its independent alignment");

// 6) Save/reload preserves formatting.
const savedHtml = editable.innerHTML;
const reloadDom = new JSDOM(`<!doctype html><html><body><div id="editable" class="wb-text-block" data-text-prop="text">${savedHtml}</div></body></html>`);
const reloadedEditable = reloadDom.window.document.getElementById("editable");
const reloadedPowerful = reloadedEditable.querySelector("#h-powerful");
const reloadedIncrease = reloadedEditable.querySelector("#h-increase") || reloadedEditable.querySelector("h2");
assert.equal(reloadedPowerful.style.textAlign, "center", "Reloaded heading alignment should persist");
assert.equal(reloadedPowerful.style.fontSize, "28px", "Reloaded heading font size should persist");
assert.equal(reloadedIncrease.tagName, "H2", "Reloaded hierarchy change should persist");

// 7) Preview renderer displays saved formatting.
assert.ok(savedHtml.includes("text-align: center"), "Saved HTML should contain centered heading style for preview renderer");
assert.ok(savedHtml.includes("font-size: 28px"), "Saved HTML should contain heading size style for preview renderer");

// 8) Live renderer displays saved formatting.
assert.ok(savedHtml.includes("<h2"), "Saved HTML should retain H2 hierarchy for live renderer");
assert.ok(savedHtml.includes("font-weight: 700"), "Saved HTML should retain bold formatting for live renderer");

console.log("website builder text section editor regression checks passed");

// Cleanup globals for other tests in the same Node process.
delete global.window;
delete global.document;
delete global.Node;
delete global.Element;
