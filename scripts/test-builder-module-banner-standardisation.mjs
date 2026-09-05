import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bannerSource = read("components/project-workspace/ProjectCompactBanner.jsx");
const shellSource = read("components/estimate-builder/EstimateBuilderWorkbook.js");
const selectionsSource = read("pages/modules/builders/selections-book.js");
const standaloneSelectionsSource = read("pages/modules/builders/client-selections.js");
const cabinetrySource = read("lib/builders/cabinetryWorkflow.js");

assert.ok(bannerSource.includes("moduleTitle = \"\""), "shared banner accepts an explicit moduleTitle");
assert.ok(bannerSource.includes("moduleIcon = null"), "shared banner accepts an explicit moduleIcon");
assert.ok(bannerSource.includes("jobName = \"\""), "shared banner accepts active-job name separately");
assert.ok(bannerSource.includes("jobAddress = \"\""), "shared banner accepts active-job address separately");
assert.ok(bannerSource.includes("data-testid=\"builder-module-banner-title\""), "shared banner exposes a stable module title test id");
assert.ok(bannerSource.includes("data-testid=\"builder-module-banner-job\""), "shared banner exposes a stable job identity test id");
assert.ok(/fontSize:\s*"clamp\(36px,\s*3\.1vw,\s*48px\)"/.test(bannerSource), "desktop module title caps at exactly 48px");
assert.ok(/fontWeight:\s*600/.test(bannerSource), "module title weight is 600");
assert.ok(/address:\s*\{[^}]*fontSize:\s*15/s.test(bannerSource), "secondary job identity keeps smaller text");
assert.ok(bannerSource.includes("No job open"), "shared banner has explicit no-job copy");

assert.ok(shellSource.includes("moduleTitle={activeVisual.title}"), "Estimate Builder shell passes module title to shared banner");
assert.ok(shellSource.includes("moduleIcon={<ActivePageIcon size={48}"), "Estimate Builder shell passes proportional 48px module icon");
assert.ok(shellSource.includes("hasActiveJob={!openJobDetails.noJobOpen}"), "Estimate Builder shell uses validated active-job state");
assert.ok(shellSource.includes('jobName={openJobDetails.noJobOpen ? "" : openJobDetails.projectName}'), "job name is secondary and suppressed with no active job");
assert.ok(shellSource.includes('jobAddress={openJobDetails.noJobOpen ? "" : openJobDetails.projectAddress}'), "job address is secondary and suppressed with no active job");

const expectedModules = {
  dataInput: "Job Setup",
  aiPlanTakeoff: "AI Plan Takeoff",
  projectEstimate: "Project Estimate",
  clientSelections: "Client Selections",
  quotation: "Quotation Builder",
  gantt: "Gantt Chart",
  jobBoard: "Job Board",
  boq: "Bill of Quantities",
  supplierProcurement: "Supplier & Procurement",
  variations: "Variations",
  documentVault: "Document Vault",
  rfis: "RFIs & Reports",
  standardInclusions: "Standard Inclusions",
  productLibrary: "Product Library",
  estimatingCatalogue: "Estimating Catalogue",
  budgetVsActual: "Budget versus Actual",
  clientPortal: "Client Portal",
};

for (const [key, title] of Object.entries(expectedModules)) {
  const pattern = new RegExp(`${key}:\\s*\\{[\\s\\S]*?title:\\s*"${escapeRegExp(title)}"`);
  assert.ok(pattern.test(shellSource), `${key} maps to banner title ${title}`);
  const iconPattern = new RegExp(`${key}:\\s*\\{[\\s\\S]*?Icon:\\s*[A-Za-z0-9_]+`);
  assert.ok(iconPattern.test(shellSource), `${key} has a mapped banner icon`);
}

assert.ok(!selectionsSource.includes("<ProjectCompactBanner"), "embedded Client Selections relies on the platform banner without a duplicate inner banner");
assert.ok(standaloneSelectionsSource.includes('moduleTitle="Client Selections"'), "standalone Client Selections uses shared module title");
assert.ok(standaloneSelectionsSource.includes("moduleIcon={<Home size={48}"), "standalone Client Selections uses existing Home icon at banner scale");

assert.equal(shellSource.includes("Johnson 123"), false, "Estimate Builder shell has no Johnson fallback");
assert.equal(bannerSource.includes("Johnson 123"), false, "shared banner has no Johnson fallback");
assert.equal(selectionsSource.includes("Johnson 123"), false, "embedded selections has no Johnson fallback");
assert.equal(standaloneSelectionsSource.includes("Johnson 123"), false, "standalone selections has no Johnson fallback");
assert.ok(selectionsSource.includes("cabinetryWorkflow"), "Client Selections cabinetry workflow import remains present");
assert.ok(cabinetrySource.includes("CABINETRY_WORKFLOW_STAGES"), "Cabinetry workflow source remains readable");
assert.ok(shellSource.includes("<FileMenu"), "File menu remains mounted in banner actions");
assert.ok(shellSource.includes("<SaveProgress status={saveStatus} />"), "save status remains mounted in banner actions");

console.log("Builder module banner standardisation static checks passed.");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
