import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const helper = readFileSync("lib/standard-inclusions/pdfLibrary.js", "utf8");
const api = readFileSync("pages/api/standard-inclusions/pdf-library.js", "utf8");
const workbook = readFileSync("components/estimate-builder/EstimateBuilderWorkbook.js", "utf8");
const migration = readFileSync("supabase/migrations/20260812_standard_inclusions_pdf_library.sql", "utf8");

assert.match(migration, /create table if not exists public\.standard_inclusions_schedules/, "Schedule table migration is missing.");
assert.match(migration, /create table if not exists public\.standard_inclusions_schedule_versions/, "Version table migration is missing.");
assert.match(migration, /workspace_id uuid not null references public\.workspaces/, "Schedules and versions must be workspace scoped.");
assert.match(migration, /current_version_id uuid/, "Schedule current version pointer is missing.");
assert.match(migration, /unique \(schedule_id, version_number\)/, "Version numbers must be unique per schedule.");
assert.match(migration, /enable row level security/, "Organisation isolation RLS must be enabled.");
assert.match(migration, /workspace_members/, "RLS must isolate by workspace membership.");

assert.match(helper, /STANDARD_INCLUSIONS_BUCKET = "assets"/, "PDF library must reuse the existing assets bucket.");
assert.match(helper, /readPdfVersionMetadata/, "PDF version metadata reader is missing.");
assert.match(helper, /PDFDocument\.load/, "Server must read page count from the uploaded PDF.");
assert.match(helper, /createStandardInclusionsScheduleWithPdf/, "New schedule creation helper is missing.");
assert.match(helper, /replaceStandardInclusionsSchedulePdf/, "Replace helper is missing.");
assert.match(helper, /nextVersionNumber = Math\.max/, "Replace must create the next immutable version.");
assert.match(helper, /restoreStandardInclusionsVersion/, "Restore helper is missing.");
assert.match(helper, /source: "version-restore"/, "Restore must create a new version instead of overwriting history.");
assert.doesNotMatch(helper, /\.remove\(/, "PDF library must not remove historical version files.");
assert.match(helper, /\.eq\("workspace_id", workspaceId\)/, "Queries must be workspace isolated.");

assert.match(api, /withWorkspace\(handler\)/, "PDF library API must enforce workspace access.");
assert.match(api, /multipart\/form-data/, "PDF library API must accept real PDF uploads.");
assert.match(api, /action === "replace"/, "API replace action is missing.");
assert.match(api, /action === "restore"/, "API restore action is missing.");
assert.match(api, /action === "archive"/, "API archive action is missing.");

assert.match(workbook, /fetchStandardInclusionsPdfLibrary/, "Dashboard must reload saved schedules from the API.");
assert.match(workbook, /saveStandardInclusionsPdfLibraryUpload/, "Dashboard must save schedules through the persistent API.");
assert.match(workbook, /No Standard Inclusions schedules have been uploaded\./, "Empty library state is missing.");
assert.match(workbook, /Your Inclusions Schedules/, "Library heading is missing.");
assert.match(workbook, /Current Version:/, "Schedule cards must show current version.");
assert.match(workbook, /Replace PDF/, "Schedule cards must expose replace.");
assert.match(workbook, /Version History/, "Schedule cards must expose version history.");
assert.match(workbook, /Archive Schedule/, "Schedule cards must expose archive.");
assert.match(workbook, /standardPdfRecordToBytes/, "Preview must load persisted PDF bytes.");
assert.match(workbook, /record\.publicUrl/, "Preview/download must use persisted file references.");
assert.doesNotMatch(workbook, /localStorage\.setItem\([^)]*pdfMaster/s, "PDF library must not persist through localStorage.");

console.log("Standard Inclusions PDF library persistence contract passed.");
