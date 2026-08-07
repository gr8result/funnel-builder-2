import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path) => fs.existsSync(new URL(`../${path}`, import.meta.url));

const bridge = read("lib/standard-inclusions/canvaAppImport.js");
const startRoute = read("pages/api/standard-inclusions/canva-app/import/start.js");
const pagesRoute = read("pages/api/standard-inclusions/canva-app/import/pages.js");
const assetsRoute = read("pages/api/standard-inclusions/canva-app/import/assets.js");
const completeRoute = read("pages/api/standard-inclusions/canva-app/import/complete.js");
const appPackage = read("canva-apps/standard-inclusions-importer/package.json");
const app = read("canva-apps/standard-inclusions-importer/src/App.tsx");
const reader = read("canva-apps/standard-inclusions-importer/src/canvaDesignReader.ts");

assert(exists("canva-apps/standard-inclusions-importer/src/App.tsx"), "Private Canva App scaffold must exist");
assert(appPackage.includes('"@canva/design"'), "Canva App must use the Canva Design Editing SDK");
assert(appPackage.includes('"@canva/asset"'), "Canva App must declare Canva asset SDK support");
assert(app.includes("Send to Gr8 Result"), "Canva App panel must be named Send to Gr8 Result");
assert(app.includes("Analyse Design"), "Canva App must expose Analyse Design");
assert(app.includes("Import this design into Gr8 Result"), "Canva App must expose Import this design into Gr8 Result");
assert(reader.includes('openDesign({ type: "all_pages" }'), "Canva App must read all pages via Design Editing API");
assert(reader.includes("requestExport"), "Canva App must request rendered visual references for validation");
assert(reader.includes("applyRenderedPageAssets"), "Canva App must attach rendered page assets to the import manifest");
assert(reader.includes("readElementList") && reader.includes("children: readElementList"), "Canva App must recursively read grouped elements");
assert(reader.includes("richTextRuns"), "Canva App must extract rich text runs");
assert(app.includes("uploadRenderedPageAsset"), "Canva App must upload page-by-page rendered references before completing import");

assert(startRoute.includes("withWorkspace") && startRoute.includes('roles: ["owner", "admin"]'), "Import session creation must require an authenticated admin workspace user");
assert(bridge.includes("createCanvaAppImportSession"), "Bridge must create short-lived import sessions");
assert(bridge.includes("signImportToken") && bridge.includes("verifyImportToken"), "Bridge must use signed import-session tokens");
assert(pagesRoute.includes("attachCanvaAppManifest"), "Pages route must ingest the Canva manifest");
assert(assetsRoute.includes("attachCanvaAppAsset"), "Assets route must persist imported assets");
assert(completeRoute.includes("buildNativeDocumentFromCanvaManifest"), "Complete route must build native document-engine pages");
assert(bridge.includes("uploadStandardInclusionsAsset"), "Assets must be saved permanently in Gr8 Result storage");
assert(bridge.includes("createDocument") && bridge.includes("createA4Page") && bridge.includes("createObject"), "Bridge must reuse the native document engine");
assert(bridge.includes("documentSource: \"canva-app-native-import\""), "Imported documents must be marked as Canva App native imports");
assert(bridge.includes("sourceElementId") && bridge.includes("sourcePageId") && bridge.includes("importSessionId"), "Imported elements must retain Canva source diagnostics");
assert(bridge.includes("importedVisualElement"), "Unsupported elements must remain individual fallback objects, not page backgrounds");
assert(bridge.includes("canva-app-hybrid-rendered-page"), "Bridge must preserve the rendered Canva page as the high-fidelity visual base");
assert(bridge.includes("high-fidelity-rendered-page-with-editable-activation-overlays"), "Bridge must expose a practical rendered-page plus editable-overlay workflow");
assert(bridge.includes("canva-text-activation") && bridge.includes("canva-image-activation"), "Bridge must mark Canva overlays as hidden until edited");
assert(bridge.includes("Rendered Canva page reference is missing"), "Validation must reject imports without a rendered visual page reference");
assert(completeRoute.includes("validation.canPublish ? 200 : 422"), "Failed validation must prevent successful completion");

console.log("Standard Inclusions Canva App native import contract passed.");
