import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { shapeProjectInclusionsDocument } from "../lib/builders/projectInclusionsAssignment.js";

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

console.log("Project inclusions assignment contract passed.");
