import assert from "node:assert/strict";
import {
  mergeMasterJobModuleSection,
  normaliseMasterJobFile,
  readJob,
  writeJob,
} from "../lib/jobFile.ts";

class MemoryJobFileHandle {
  constructor(name) {
    this.name = name;
    this.bytes = new TextEncoder().encode(JSON.stringify({ workbook: { jobFileMeta: { jobName: "Initial" } } })).buffer;
  }

  async getFile() {
    return new File([this.bytes], this.name, { type: "application/zip" });
  }

  async createWritable() {
    return {
      write: async (blob) => {
        this.bytes = await blob.arrayBuffer();
      },
      close: async () => {},
    };
  }
}

const baseJob = normaliseMasterJobFile({
  jobName: "Round Trip Master Job",
  clientName: "Fixture Client",
  jobNumber: "RT-0309",
  address: "8 Roundtrip Street, Testville",
  "job-details": { projectId: "round-trip-master-job", builder: "Fixture Builder" },
  estimate: { projectEstimate: { pages: [{ id: "estimate-page", marker: "estimate-survives" }] } },
  takeoff: { aiPlanTakeoffJob: { plan: { pages: [{ id: "plan-page", marker: "uploaded-plan-survives" }] }, completedAreas: [{ id: "area-1" }] } },
  "client-selections": {
    clientSelectionsBook: {
      rooms: [{ id: "kitchen", marker: "selections-survive" }],
      selections: {
        cabinetry: { schemaVersion: 2, marker: "cabinetry-survives" },
        appliances: { brand: "Fixture Brand", marker: "appliances-survive" },
      },
    },
  },
  quotation: { rows: [{ id: "quote-row", marker: "quotation-survives" }] },
  boq: { items: [{ id: "boq-row", marker: "boq-survives" }] },
  procurement: { items: [{ id: "po-row", marker: "procurement-survives" }] },
  variations: { items: [{ id: "variation-row", marker: "variation-survives" }] },
  "project-documents": { documents: [{ id: "document-row", marker: "documents-survive" }] },
});

let afterSelections = mergeMasterJobModuleSection(baseJob, "clientSelections", {
  clientSelectionsBook: {
    ...baseJob["client-selections"].clientSelectionsBook,
    rooms: [...baseJob["client-selections"].clientSelectionsBook.rooms, { id: "bathroom", marker: "new-selection-save" }],
  },
}, { expectedJobId: "round-trip-master-job", updatedAt: "2026-09-03T01:00:00.000Z" });

let afterTakeoff = mergeMasterJobModuleSection(afterSelections, "takeoff", {
  aiPlanTakeoffJob: {
    ...afterSelections.takeoff.aiPlanTakeoffJob,
    completedAreas: [...afterSelections.takeoff.aiPlanTakeoffJob.completedAreas, { id: "area-2", marker: "new-takeoff-save" }],
  },
}, { expectedJobId: "round-trip-master-job", updatedAt: "2026-09-03T02:00:00.000Z" });

let afterEstimate = mergeMasterJobModuleSection(afterTakeoff, "estimate", {
  projectEstimate: {
    pages: [...afterTakeoff.estimate.projectEstimate.pages, { id: "estimate-page-2", marker: "new-estimate-save" }],
  },
}, { expectedJobId: "round-trip-master-job", updatedAt: "2026-09-03T03:00:00.000Z" });

let afterQuotation = mergeMasterJobModuleSection(afterEstimate, "quotation", {
  rows: [...afterEstimate.quotation.rows, { id: "quote-row-2", marker: "new-quotation-save" }],
}, { expectedJobId: "round-trip-master-job", updatedAt: "2026-09-03T04:00:00.000Z" });

const handle = new MemoryJobFileHandle("Round Trip Master Job.gr8job");
const saved = await writeJob(handle, afterQuotation);
assert.equal(saved.ok, true, "master job writes successfully");
assert.equal(saved.fileName, "Round Trip Master Job.gr8job", "Save writes the same master filename");

const reopened = await readJob(handle);
const json = JSON.stringify(reopened);

for (const marker of [
  "Fixture Client",
  "8 Roundtrip Street",
  "uploaded-plan-survives",
  "new-takeoff-save",
  "selections-survive",
  "new-selection-save",
  "cabinetry-survives",
  "appliances-survive",
  "estimate-survives",
  "new-estimate-save",
  "quotation-survives",
  "new-quotation-save",
  "boq-survives",
  "procurement-survives",
  "variation-survives",
  "documents-survive",
]) {
  assert.ok(json.includes(marker), `round-trip preserved ${marker}`);
}

assert.throws(
  () => mergeMasterJobModuleSection(reopened, "clientSelections", { marker: "wrong-job" }, { expectedJobId: "different-job-id" }),
  /different job ID/,
  "files with different job IDs cannot be silently merged"
);

console.log("Shared master job-file runtime round-trip passed.");
