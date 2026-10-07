import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const assignmentSource = readFileSync(new URL("../lib/builders/projectInclusionsAssignment.js", import.meta.url), "utf8");
const shapeStart = assignmentSource.indexOf("export function shapeProjectInclusionsDocument");
const shapeEnd = assignmentSource.indexOf("\nexport async function getAssignedProjectInclusions", shapeStart);
assert.ok(shapeStart >= 0 && shapeEnd > shapeStart, "shapeProjectInclusionsDocument source is present.");
const shapeProjectInclusionsDocument = new Function(
  `${assignmentSource.slice(shapeStart, shapeEnd).replace("export function", "function")}; return shapeProjectInclusionsDocument;`,
)();

const standard = shapeProjectInclusionsDocument({
  id: "doc-standard-v1",
  title: "Premier Inclusions Schedule",
  file_name: "Premier Inclusions Schedule.pdf",
  public_url: "https://example.test/premier-v1.pdf",
  storage_path: "assets/standard-inclusions/workspace/master/exports/v1.pdf",
  status: "active",
  created_at: "2026-08-12T01:00:00.000Z",
  metadata: {
    source: "project_inclusions_assignment",
    sourceType: "standard_inclusions",
    assignmentType: "standard",
    sourceMasterTemplateId: "master-template",
    sourceMasterVersion: 1,
    sourceMasterName: "Premier Inclusions Schedule",
    assignedAt: "2026-08-12T01:00:00.000Z",
    pageCount: 2,
    pageOrientation: ["portrait", "landscape"],
    pageRotation: [0, 90],
    pageSizes: [{ width: 595, height: 842 }, { width: 842, height: 595 }],
  },
});

assert.equal(standard.id, "doc-standard-v1");
assert.equal(standard.sourceMasterTemplateId, "master-template");
assert.equal(standard.sourceMasterVersion, 1);
assert.equal(standard.version, 1);
assert.equal(standard.assignedAt, "2026-08-12T01:00:00.000Z");
assert.equal(standard.projectSpecific, false);
assert.equal(standard.pages.length, 2);
assert.equal(standard.pages[1].orientation, "landscape");

const projectSpecific = shapeProjectInclusionsDocument({
  id: "doc-project-specific",
  title: "Project-Specific Inclusions",
  file_name: "project-a-inclusions.pdf",
  public_url: "https://example.test/project-a.pdf",
  status: "active",
  created_at: "2026-08-12T02:00:00.000Z",
  metadata: {
    source: "quote_proposal_builder",
    sourceType: "project_specific_inclusions",
    assignmentType: "project_specific",
    assignedAt: "2026-08-12T02:00:00.000Z",
    version: "project-specific",
    pageCount: 1,
  },
});

assert.equal(projectSpecific.projectSpecific, true);
assert.equal(projectSpecific.sourceType, "project_specific_inclusions");
assert.equal(projectSpecific.version, "project-specific");

const registrySource = readFileSync(new URL("../components/estimate-builder/project-estimate/ProjectEstimateRegistry.ts", import.meta.url), "utf8");
const orderMatch = registrySource.match(/PROJECT_ESTIMATE_EXPORT_ORDER[\s\S]*?=\s*\[([\s\S]*?)\];/);
assert.ok(orderMatch, "Project Estimate export order is defined.");
const order = Array.from(orderMatch[1].matchAll(/pageId:\s*"([^"]+)"|slotId:\s*"([^"]+)"/g)).map((match) => match[1] || match[2]);
assert.deepEqual(order, ["cover", "estimateSummary", "about", "inclusions", "plans", "pricingSummary", "importantEstimateNotice", "acceptance"]);

assert.ok(assignmentSource.includes('NO_ACTIVE_STANDARD_INCLUSIONS_MASTER_CODE = "NO_ACTIVE_STANDARD_INCLUSIONS_MASTER"'), "Missing-master error code is defined.");
assert.ok(assignmentSource.includes("error.code = NO_ACTIVE_STANDARD_INCLUSIONS_MASTER_CODE"), "Missing-master assignment error should carry a code.");
assert.ok(assignmentSource.includes("error.statusCode = 409"), "Missing-master assignment error should carry a conflict status.");

const apiSource = readFileSync(new URL("../pages/api/builders/project-inclusions.js", import.meta.url), "utf8");
assert.ok(apiSource.includes("NO_ACTIVE_STANDARD_INCLUSIONS_MASTER_CODE"), "Project inclusions API should expose missing master as a typed response.");
assert.ok(apiSource.includes("? 409"), "Missing active Standard Inclusions master should not be returned as a generic server error.");

const workbookSource = readFileSync(new URL("../components/estimate-builder/EstimateBuilderWorkbook.js", import.meta.url), "utf8");
assert.ok(workbookSource.includes('payload.code === "NO_ACTIVE_STANDARD_INCLUSIONS_MASTER"'), "Estimate Builder should handle missing Standard Inclusions master without throwing through the dev overlay.");
assert.ok(workbookSource.includes("Upload or export a Standard Inclusions master PDF before assigning it to this project."), "Estimate Builder should show actionable missing-master guidance.");

console.log("Project inclusions assignment contract passed.");
