import "./test-job-file-disk-save-roundtrip.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import JSZip from "jszip";
import { readJob } from "../lib/jobFile.ts";

const source = "test-results/job-file-disk-save-roundtrip/Save Roundtrip Test.gr8job";
const bytes = await fs.readFile(source);
const zip = await JSZip.loadAsync(bytes);
const estimate = JSON.parse(await zip.file("estimate.json").async("string"));
estimate.unverifiedChange = "This must fail read-back verification";
zip.file("estimate.json", JSON.stringify(estimate));
const corrupt = await zip.generateAsync({ type: "nodebuffer" });
await assert.rejects(() => readJob(new File([corrupt], "corrupt.gr8job")), /checksum/);
assert.deepEqual(await fs.readFile(source), bytes, "The valid computer file was not modified");
console.log("PASS computer job file rejects a changed section with a mismatched checksum; valid file retained.");
