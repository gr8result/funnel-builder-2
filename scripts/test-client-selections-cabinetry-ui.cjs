const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { JSDOM } = require("jsdom");
const swc = require("next/dist/build/swc");
const rootPath = process.cwd();
const oldJs = Module._extensions[".js"];
function transpile(module, filename) {
  if (filename.includes("node_modules")) return oldJs(module, filename);
  const output = swc.transformSync(fs.readFileSync(filename, "utf8"), {
    filename,
    jsc: { parser: { syntax: "ecmascript", jsx: true, dynamicImport: true }, transform: { react: { runtime: "automatic", development: false } }, target: "es2020" },
    module: { type: "commonjs" }, sourceMaps: false,
  });
  module._compile(output.code, filename);
}
Module._extensions[".js"] = transpile;
Module._extensions[".jsx"] = transpile;
const dom = new JSDOM('<!doctype html><html><body><main id="root"></main></body></html>', { url: "http://localhost:3000/" });
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require("react");
const { createRoot } = require("react-dom/client");
const { act } = React;
const Workflow = require(path.join(rootPath, "components/product-library/cabinetry/CabinetryRoomWorkflow.jsx")).default;
const { defaultCabinetryRoom } = require(path.join(rootPath, "lib/builders/cabinetryRoomSelection.js"));
const { cabinetConfigurationGroups, productSnapshot } = require(path.join(rootPath, "components/product-library/cabinetry/cabinetryUi.js"));
const { getProductLibraryCabinetryBenchtopRecords } = require(path.join(rootPath, "lib/product-library/cabinetryCatalogueSelectors.js"));
const root = createRoot(document.getElementById("root"));
const errors = [], updates = [], saves = [];
let current = defaultCabinetryRoom("kitchen");
let rejectSave = true;
const originalError = console.error;
console.error = (...args) => { errors.push(args.map(String).join(" ")); originalError(...args); };
const props = () => ({ roomKey: "kitchen", roomLabel: "Kitchen", configuration: current, onUpdateConfiguration: (section, value) => { updates.push(section); current = { ...current, [section]: value }; render(); }, onSave: async (room) => { if (rejectSave) throw new Error("Injected save failure"); saves.push(room); return true; }, onCancel: () => {} });
function render() { root.render(React.createElement(Workflow, props())); }
function selectForLabel(label) { return [...document.querySelectorAll("label")].find((el) => [...el.childNodes].filter((node) => node.nodeType === 3).map((node) => node.textContent).join("").trim() === label)?.querySelector("select"); }
async function click(testId) { const element = document.querySelector(`[data-testid="${testId}"]`); assert.ok(element, `${testId} exists`); await act(async () => { element.click(); }); }
const checks = [];
async function check(name, run) { await run(); checks.push(name); console.log(`PASS ${name}`); }
(async () => {
  try {
    await act(async () => render());
    await check("Room-specific configuration offers complete vanity groups without Kitchen-only choices", () => {
      const bathroom = cabinetConfigurationGroups("bathroom").flatMap((group) => group.options).map(([key]) => key);
      for (const key of ["floorTwoDoorVanity", "floorOneDoorVanity", "floorFourDrawerVanity", "wallTwoDoorVanity", "wallOneDoorVanity", "wallThreeDrawerVanity", "wallTwoDrawerVanity", "towelDisplay", "tallLinenCupboard", "twoDoorShavingCabinet", "oneDoorShavingCabinet", "laminateBenchtop", "laminateMitredBenchtop", "stoneBenchtop", "stoneMitredBenchtop", "linenBulkhead"]) assert.ok(bathroom.includes(key), key);
      for (const key of ["islandCabinetry", "applianceCabinetry", "fridgePanels", "dishwasherPanels", "microwaveCabinetry", "rangehoodCabinetry"]) assert.equal(bathroom.includes(key), false, key);
      const laundry = cabinetConfigurationGroups("laundry").flatMap((group) => group.options).map(([key]) => key);
      for (const key of ["baseCabinets", "drawerUnits", "overheads", "tallLinenCupboard", "openShelves", "hangingRail", "benchtop", "endPanels", "bulkheads"]) assert.ok(laundry.includes(key), key);
    });
    await check("Configuration accepts asynchronous saved props without echoing updates", async () => {
      const checkbox = [...document.querySelectorAll("label")].find((el) => el.textContent.trim() === "Base cabinets")?.querySelector("input");
      assert.equal(checkbox.checked, false);
      await act(async () => { await Promise.resolve(); current = defaultCabinetryRoom("kitchen", { configuration: { components: { baseCabinets: true }, quantities: { baseCabinets: 7 } } }); render(); });
      assert.equal(checkbox.checked, true);
      assert.equal(document.querySelector('[aria-label="Base cabinets quantity"]').value, "7");
      assert.deepEqual(updates, []);
    });
    await check("Cabinet finish accepts a late saved product with stable identity", async () => {
      await click("cabinetry-next");
      assert.ok(document.querySelector('[data-testid="cabinetry-step-finish"]'));
      const finish = { id: "archived-finish", productId: "archived-product", productCode: "ARCHIVED-CODE", sku: "ARCHIVED-SKU", productName: "Retained colour", brand: "Polytec", finish: "Matt" };
      await act(async () => { await Promise.resolve(); current = { ...current, finish }; render(); });
      assert.equal(selectForLabel("Cabinet finish product").value, finish.productId);
      assert.ok(document.body.textContent.includes("Retained colour"));
      assert.deepEqual(updates, []);
    });
    await check("Workflow traverses every required stage and renders selected review groups without raw JSON", async () => {
      await act(async () => {
        current = { ...current, internals: { type: "standardWhite", exposedInteriors: true, exposedFinish: current.finish }, kickboard: { type: "matching" }, handles: { system: "handleless" }, benchtop: { material: "none", fabrication: {} }, hardware: { softCloseDoors: true, softCloseDrawers: true }, specialFeatures: { openShelving: true }, legacySelections: [{ retainedUnsupportedJson: { secretJsonMarker: "do-not-render-raw" } }] };
        render();
      });
      for (const stage of ["internals", "kickboard", "handles", "benchtop", "hardware", "specialFeatures", "review"]) { await click("cabinetry-next"); assert.ok(document.querySelector(`[data-testid="cabinetry-step-${stage}"]`), stage); }
      const text = document.querySelector('[data-testid="cabinetry-step-review"]').textContent;
      for (const label of ["Configuration", "Cabinet Finish", "Internals", "Kickboards", "Handles", "Benchtop", "Hardware", "Special Features"]) assert.ok(text.includes(label), label);
      assert.equal(text.includes("do-not-render-raw"), false);
      assert.equal(text.includes('"baseCabinets"'), false);
      assert.equal(document.querySelector("pre"), null);
    });
    await check("Failed Save Room remains on Review; retry passes the complete room to the parent", async () => {
      await click("cabinetry-save");
      assert.ok(document.querySelector('[data-testid="cabinetry-step-review"]'));
      assert.ok(document.body.textContent.includes("Injected save failure"));
      assert.equal(saves.length, 0);
      rejectSave = false;
      await click("cabinetry-save");
      assert.equal(saves.length, 1); assert.deepEqual(saves[0], current);
    });
    await check("Incomplete physical handles, exposed finishes, laminate brand and incompatible room options cannot silently save", async () => {
      const baseline = current;
      const handle = { ...baseline.finish, finishes: ["Chrome"], sizes: ["160 mm"] };
      const cases = [
        [{ internals: { ...baseline.internals, exposedFinish: null } }, "exposed interior finish"],
        [{ handles: { system: "barHandles", product: handle } }, "physical handle finish"],
        [{ handles: { system: "barHandles", product: handle, finish: "Chrome" } }, "physical handle size"],
        [{ benchtop: { material: "laminate", brand: "", product: null } }, "Polytec or Laminex"],
        [{ configuration: { components: { baseCabinets: true }, quantities: { baseCabinets: 1.5 } } }, "whole-number quantity"],
        [{ configuration: { components: { floorTwoDoorVanity: true }, quantities: {} } }, "do not apply to this room"],
      ];
      for (const [changes, expected] of cases) {
        await act(async () => { current = { ...baseline, ...changes }; render(); });
        await click("cabinetry-save");
        assert.ok(document.querySelector('[role="alert"]')?.textContent.includes(expected), expected);
        assert.equal(saves.length, 1, "Invalid review never calls parent persistence");
      }
      await act(async () => { current = baseline; render(); });
    });
    await check("Idle/rerender hydration does not trigger parent-child update loops", async () => {
      const before = updates.length;
      for (let n = 0; n < 20; n++) await act(async () => { current = { ...current }; render(); });
      assert.equal(updates.length, before);
      assert.equal(errors.filter((text) => /Maximum update depth|Too many re-renders|not wrapped in act/.test(text)).length, 0);
    });
    await check("Selected product snapshots exclude catalogue arrays and source objects", () => {
      const snapshot = productSnapshot({ id: "stable", productId: "stable-product", productCode: "stable-code", sku: "stable-sku", productName: "Selected", products: Array(500).fill({ raw: "bulk" }), sourceDocument: { unnecessary: true }, sizes: ["160 mm"], finishes: ["Black"] });
      for (const identity of ["id", "productId", "productCode", "sku"]) assert.ok(snapshot[identity]);
      assert.equal(snapshot.products, undefined); assert.equal(snapshot.sourceDocument, undefined);
      assert.deepEqual(snapshot.sizes, ["160 mm"]);
    });
    for (const brand of ["Polytec", "Laminex"]) await check(`${brand}: existing Benchtop picker selects real material variant and retains it on rehydration`, async () => {
      const navigate = async (index) => act(async () => { document.querySelectorAll('[aria-label="Cabinetry workflow stages"] button')[index].click(); });
      const choose = async (label, value) => act(async () => { const input = selectForLabel(label); assert.ok(input, label); input.value = value; input.dispatchEvent(new window.Event("change", { bubbles: true })); });
      await navigate(5);
      await choose("Benchtop material", "laminate");
      await choose("Benchtop brand", brand);
      const record = getProductLibraryCabinetryBenchtopRecords({ material: "laminate", brand })[0];
      await choose("Benchtop material product", record.productId);
      assert.equal(current.benchtop.product.variantId, undefined);
      await navigate(8);
      const before = saves.length;
      await click("cabinetry-save");
      assert.equal(saves.length, before);
      assert.ok(document.querySelector('[role="alert"]').textContent.includes("finish and sheet size"));
      await navigate(5);
      const variant = record.variants.at(-1);
      await choose("Material variant", variant.id);
      assert.equal(current.benchtop.product.productId, record.productId);
      assert.equal(current.benchtop.product.sku, variant.sku);
      assert.equal(current.benchtop.product.variants, undefined);
      await navigate(8);
      for (const text of [variant.sku, variant.finish, variant.size, "Laminate sheet thickness"]) assert.ok(document.body.textContent.includes(text), text);
      await click("cabinetry-save");
      assert.equal(saves.length, before + 1);
      await act(async () => { current = JSON.parse(JSON.stringify(saves.at(-1))); render(); });
      await navigate(5);
      assert.equal(selectForLabel("Benchtop material product").value, record.productId);
      assert.equal(selectForLabel("Material variant").value, variant.id);
    });
    console.log(`Cabinetry controlled DOM regression: ${checks.length} checks passed.`);
  } finally {
    await act(async () => root.unmount());
    console.error = originalError;
    dom.window.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
