import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const workbook = read("components/estimate-builder/EstimateBuilderWorkbook.js");
const finishedPdfUpload = read("pages/api/standard-inclusions/finished-pdf/upload.js");

assert(workbook.includes("findLatestRestorableStandardRevision"), "Deleted schedules must identify the latest restorable revision");
assert(workbook.includes("isRestorableStandardRevision"), "Restore buttons must validate revisions before enabling restore");
assert(workbook.includes("Your Standard Inclusions Schedule was deleted."), "Deleted/empty state must explain the recovery condition");
assert(workbook.includes("Restore Latest Version"), "Deleted/empty state must offer one-click latest restore");
assert(workbook.includes("No valid previous version was found."), "Deleted/empty state must clearly report when no valid revision exists");
assert(workbook.includes("No valid previous Standard Inclusions version is available to restore."), "Restore latest must report no-revision cases");

assert(workbook.includes("setStandardStatus(\"Restoring...\""), "Restore must show a restoring status");
assert(workbook.includes("Schedule restored successfully."), "Restore must show a success status");
assert(workbook.includes("Restore failed - view details."), "Restore failures must be visible");
assert(workbook.includes("hasActiveStandardSchedule(persisted)"), "Restore must validate the saved active schedule");
assert(workbook.includes("This previous version has no page data or stored PDF reference."), "Invalid revisions must not silently no-op");

assert(workbook.includes("Load Default Standard Inclusions Template"), "Empty state must provide the approved default template recovery action");
assert(workbook.includes("resolveBaseStandardInclusionsTemplate"), "Default recovery must use the approved base template resolver");
assert(workbook.includes("load-default-template"), "Default recovery must save a version-history action");
assert(workbook.includes("Default Standard Inclusions template loaded successfully."), "Default recovery must report success");
assert(!workbook.includes("Start a new blank Standard Inclusions Schedule?"), "Empty recovery must not rely on blank schedule creation");

assert(workbook.includes("await importPendingPdfNow(file)"), "Selecting a finished PDF must immediately upload it");
assert(workbook.includes("/api/standard-inclusions/finished-pdf/upload"), "Finished PDF must use the permanent upload endpoint");
assert(workbook.includes("finishedPdfPageCount: pageCount"), "Finished PDF upload must persist page count");
assert(workbook.includes("handleFinishedPdfPageCount"), "Finished PDF page count must survive refresh after preview rendering");
assert(workbook.includes("Missing original PDF. Upload the source PDF again."), "Missing finished-PDF storage must show a real recovery error");
assert(workbook.includes("Replace PDF") && workbook.includes("Export PDF") && workbook.includes("Delete Schedule"), "Finished PDF viewer must expose replace, download and delete");

assert(workbook.includes("Canva setup required"), "Canva must show setup-required state");
assert(workbook.includes("Connect and configure Canva before using Canva designs. You can still restore a previous version or attach a finished PDF now."), "Canva disabled state must explain non-Canva recovery options");
assert(workbook.includes("disabled={readonly || canvaSetupRequired}"), "Empty-state Canva action must be disabled when setup is incomplete");
assert(workbook.includes("const setupRequired = Boolean(!canvaStatus"), "Shared Canva actions must be disabled before setup status is ready");

assert(workbook.includes("Template name:") && workbook.includes("Number of pages:") && workbook.includes("Template status:"), "Header metadata labels must render separately with colons");
assert(workbook.includes("Template status: Active"), "Loaded header must show active status");
assert(workbook.includes("const templateName = isLoaded ?") && workbook.includes(": \"None\""), "Unloaded header must show template name None");
assert(workbook.includes("const status = isLoaded ? \"Active\" : \"Not loaded\""), "Unloaded header must show Not loaded status");

assert(finishedPdfUpload.includes("STANDARD_INCLUSIONS_MIGRATION_REQUIRED"), "Finished PDF upload must report migration failures as JSON");
assert(finishedPdfUpload.includes("versionInsert.error"), "Finished PDF upload must fail visibly if version-history insert fails");
assert(finishedPdfUpload.includes("PDF_TOO_LARGE") && finishedPdfUpload.includes("CORRUPT_PDF"), "Finished PDF upload must report invalid file failures");

console.log("Standard Inclusions recovery contract passed.");
