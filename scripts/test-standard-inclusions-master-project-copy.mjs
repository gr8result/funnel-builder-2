import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createProjectInclusionsCopy,
  createStandardInclusionsMaster,
  replaceFirstImage,
  replaceFirstText,
  resetProjectCopyFromCurrentMaster,
  restoreStandardInclusionsMasterVersion,
  saveProjectInclusionsCopy,
  saveStandardInclusionsMasterVersion,
} from "../lib/standard-inclusions/masterProjectStore.js";

const repoRoot = process.cwd();
const sourcePath = path.join(repoRoot, "standard-inclusions", "premier-inclusions-template.full.json");
const sourceDocument = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

function documentText(document) {
  return JSON.stringify(document?.pages || []);
}

assert.equal(sourceDocument.pages.length, 10, "Real Premier Inclusions schedule must have 10 pages.");

let master = createStandardInclusionsMaster(sourceDocument, {
  organisationId: "qa-builder",
  templateId: "standard-master-test",
  templateName: "Premier Inclusions Schedule",
  source: "Premier Inclusions Schedule.pdf",
  now: "2026-08-11T00:00:00.000Z",
});

assert.equal(master.isMaster, true, "Master must be explicitly marked.");
assert.equal(master.status, "ACTIVE MASTER");
assert.equal(master.pageCount, 10, "Active master retrieval must preserve page count.");
assert.equal(master.version, 1, "Initial master version must be 1.");
assert.equal(master.versions.length, 1, "Initial master persistence must create version history.");

const projectA = createProjectInclusionsCopy(master, {
  projectId: "project-a",
  projectName: "TEST PROJECT A",
  now: "2026-08-11T00:01:00.000Z",
});
assert.equal(projectA.sourceMasterTemplateId, master.templateId);
assert.equal(projectA.sourceMasterVersion, 1);
assert.notEqual(projectA.pages, master.pages, "Project copy pages must be deep copied.");

let editedA = replaceFirstText(projectA.document, "Premier Inclusions", "PROJECT A SMEG INCLUSIONS");
editedA = replaceFirstText(editedA, "Premier range.", "Project A paragraph changed.");
editedA = replaceFirstImage(editedA, "data:image/png;base64,project-a-image");
const savedProjectA = saveProjectInclusionsCopy(projectA, editedA, { now: "2026-08-11T00:02:00.000Z" });

assert(documentText(savedProjectA.document).includes("PROJECT A SMEG INCLUSIONS"), "Project text edit must persist to project copy.");
assert(documentText(savedProjectA.document).includes("Project A paragraph changed."), "Project paragraph edit must persist to project copy.");
assert(documentText(savedProjectA.document).includes("project-a-image"), "Project image replacement must persist to project copy.");
assert(!documentText(master.document).includes("PROJECT A SMEG INCLUSIONS"), "Project edit must not mutate master heading.");
assert(!documentText(master.document).includes("project-a-image"), "Project image replacement must not mutate master image.");

const editedMasterDocument = replaceFirstText(master.document, "Premier Inclusions", "MASTER BOSCH INCLUSIONS");
master = saveStandardInclusionsMasterVersion(master, editedMasterDocument, {
  source: "master-editor",
  change: "Changed master heading",
  now: "2026-08-11T00:03:00.000Z",
});
assert.equal(master.version, 2, "Master edit must create a new version.");
assert.equal(master.versions.length, 2, "Master version history must retain prior version.");
assert(documentText(master.document).includes("MASTER BOSCH INCLUSIONS"), "Master edit must persist to current master.");
assert(!documentText(savedProjectA.document).includes("MASTER BOSCH INCLUSIONS"), "Master edit must not mutate existing Project A.");
assert(documentText(savedProjectA.document).includes("PROJECT A SMEG INCLUSIONS"), "Project A must keep its independent edit.");

const projectB = createProjectInclusionsCopy(master, {
  projectId: "project-b",
  projectName: "TEST PROJECT B",
  now: "2026-08-11T00:04:00.000Z",
});
assert.equal(projectB.sourceMasterVersion, 2, "New project must receive current master version.");
assert(documentText(projectB.document).includes("MASTER BOSCH INCLUSIONS"), "Project B must receive latest master content.");

assert.throws(() => resetProjectCopyFromCurrentMaster(savedProjectA, master), /explicit confirmation/i, "Reset From Current Master must require explicit confirmation.");
const resetA = resetProjectCopyFromCurrentMaster(savedProjectA, master, { confirmed: true, now: "2026-08-11T00:05:00.000Z" });
assert(documentText(resetA.document).includes("MASTER BOSCH INCLUSIONS"), "Confirmed reset must replace project copy from current master.");

master = restoreStandardInclusionsMasterVersion(master, 1, { now: "2026-08-11T00:06:00.000Z" });
assert.equal(master.version, 3, "Restoring an old version must create a new current version.");
assert.equal(master.versions.length, 3, "Restore must not destroy version history.");
assert(!documentText(master.document).includes("MASTER BOSCH INCLUSIONS"), "Restored master should use earlier version content.");
assert(documentText(savedProjectA.document).includes("PROJECT A SMEG INCLUSIONS"), "Restore must not mutate Project A.");
assert(documentText(projectB.document).includes("MASTER BOSCH INCLUSIONS"), "Restore must not mutate Project B.");

const projectC = createProjectInclusionsCopy(master, {
  projectId: "project-c",
  projectName: "TEST PROJECT C",
  now: "2026-08-11T00:07:00.000Z",
});
assert.equal(projectC.sourceMasterVersion, 3, "Future project must receive restored/current master version.");
assert(!documentText(projectC.document).includes("MASTER BOSCH INCLUSIONS"), "Project C must receive restored master content.");

console.log("Standard Inclusions master/project-copy isolation tests passed.");
