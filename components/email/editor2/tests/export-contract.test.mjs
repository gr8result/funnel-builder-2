import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULTS,
  collapseBlocksForExport,
  extractEmailSettings,
  normalizeBlocksForEditor,
  packBlocksForSave,
  stripEmailMetaBlocks,
} from "../blockModel.js";
import { exportFullHtml } from "../htmlExport.js";

test("saving preserves content and replaces settings metadata once", () => {
  const content = [{ id: "text-1", type: "text", props: { html: "<p>Saved content</p>" } }];
  const settings = { canvasWidth: 720, preheaderText: "Preview & details", outerBgColor: "#102030" };
  const saved = packBlocksForSave([
    { id: "old-settings", type: "__emailSettings", props: { canvasWidth: 420 } },
    ...content,
  ], settings);

  assert.equal(saved.filter((block) => block.type === "__emailSettings").length, 1);
  assert.deepEqual(stripEmailMetaBlocks(saved), content);
  assert.equal(extractEmailSettings(saved).canvasWidth, 720);
  assert.equal(extractEmailSettings(saved).preheaderText, settings.preheaderText);
  const html = exportFullHtml(saved, "Saved email", extractEmailSettings(saved));
  assert.match(html, /max-width:720px/);
  assert.match(html, /Preview &amp; details/);
  assert.match(html, /<p>Saved content<\/p>/);
  assert.doesNotMatch(html, /old-settings|__emailSettings/);
});

test("legacy grouped cards retain their content order and links through export", () => {
  const columns = [
    { title: "First card", text: "First body", linkHref: "https://example.test/first", imageSrc: "https://example.test/first.png" },
    { title: "Second card", text: "Second body", linkHref: "https://example.test/second", imageSrc: "https://example.test/second.png" },
  ];
  const blocks = [{ id: "legacy-grid", type: "grid", props: { columns, columnsPerRow: 2 } }];
  const editable = normalizeBlocksForEditor(blocks);
  assert.deepEqual(editable.map((block) => block.props.title), ["First card", "Second card"]);
  const collapsed = collapseBlocksForExport(editable);
  assert.equal(collapsed.length, 1);
  assert.deepEqual(collapsed[0].props.columns.map((column) => column.linkHref), columns.map((column) => column.linkHref));
  const html = exportFullHtml(editable);
  assert.ok(html.indexOf("First card") < html.indexOf("Second card"));
  assert.match(html, /https:\/\/example\.test\/first/);
  assert.match(html, /https:\/\/example\.test\/second/);
});

test("email export escapes document text and retains rich-text links", () => {
  const html = exportFullHtml([
    { id: "linked-text", type: "text", props: { html: '<p><a href="https://example.test/offer">Offer</a></p>' } },
  ], 'A <title> & "quote"', { preheaderText: "Preview <details> & more" });
  assert.match(html, /<title>A &lt;title&gt; &amp; &quot;quote&quot;<\/title>/);
  assert.match(html, /Preview &lt;details&gt; &amp; more/);
  assert.match(html, /href="https:\/\/example\.test\/offer"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
});

for (const [type, props] of Object.entries(DEFAULTS)) {
  test(`${type} exports at narrow and wide supported canvas widths`, () => {
    for (const canvasWidth of [420, 600, 900]) {
      const html = exportFullHtml([{ id: `block-${type}`, type, props }], "Contract fixture", { canvasWidth });
      assert.match(html, /^<!DOCTYPE html>/);
      assert.ok(html.includes(`max-width:${canvasWidth}px`));
      assert.doesNotMatch(html, /NaN|\bundefined\b/);
    }
  });
}
