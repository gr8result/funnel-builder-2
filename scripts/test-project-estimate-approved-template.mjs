import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const registryPath = path.join(root, "components/estimate-builder/project-estimate/ProjectEstimateRegistry.ts");
const snapshotPath = path.join(root, "components/estimate-builder/project-estimate/approvedProjectEstimateTemplateSnapshot.ts");
const workbookPath = path.join(root, "components/estimate-builder/EstimateBuilderWorkbook.js");

const registry = fs.readFileSync(registryPath, "utf8");
const snapshot = fs.readFileSync(snapshotPath, "utf8");
const workbook = fs.readFileSync(workbookPath, "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const approvedOrder = [
  "cover",
  "estimateSummary",
  "about",
  "standardInclusions",
  "pricedPlans",
  "pricing",
  "termsNotes",
  "acceptance",
];

assert(registry.includes('APPROVED_PROJECT_ESTIMATE_TEMPLATE_ID = "approved-project-estimate"'), "Approved template ID changed.");
assert(registry.includes("APPROVED_PROJECT_ESTIMATE_TEMPLATE_VERSION = 1"), "Approved template version changed.");
assert(registry.includes("protected: true"), "Approved template is not marked protected.");

let previousIndex = -1;
for (const pageId of approvedOrder) {
  const pageToken = `pageId: "${pageId}"`;
  const placeholderToken = `placeholderPageId: "${pageId}"`;
  const pageIndex = registry.indexOf(pageToken);
  const placeholderIndex = registry.indexOf(placeholderToken);
  const index = pageIndex >= 0 && placeholderIndex >= 0
    ? Math.min(pageIndex, placeholderIndex)
    : Math.max(pageIndex, placeholderIndex);
  assert(index > previousIndex, `PDF/page order is missing or reordered around ${pageId}.`);
  previousIndex = index;
}

assert(registry.includes('slotId: "inclusions", placeholderPageId: "standardInclusions"'), "Inclusions slot rule is missing.");
assert(registry.includes('slotId: "plans", placeholderPageId: "pricedPlans"'), "Plans slot rule is missing.");
assert(registry.indexOf('placeholderPageId: "pricedPlans"') < registry.indexOf('pageId: "pricing"'), "Pricing must remain after plans.");
assert(registry.indexOf('pageId: "termsNotes"') < registry.indexOf('pageId: "acceptance"'), "Important Estimate Notice and Acceptance must remain last.");

assert(snapshot.includes("approvedProjectEstimateTemplateSnapshot"), "Source-controlled approved template snapshot is missing.");
assert(snapshot.includes("oldJobsMustNotReplaceMasterDefinitions: true"), "Snapshot does not record old-job protection.");
assert(workbook.includes("PROJECT_ESTIMATE_EXPORT_ORDER"), "Workbook export must use the approved export order.");
assert(workbook.includes("serializeProjectEstimatePageOverrides"), "Workbook must serialize page overrides for export.");

console.log("Approved Project Estimate template checks passed.");
