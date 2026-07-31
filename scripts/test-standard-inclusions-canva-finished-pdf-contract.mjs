import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const workbook = read("components/estimate-builder/EstimateBuilderWorkbook.js");
const standardInclusions = read("lib/builders/standardInclusions.js");
const canvaConnect = read("lib/standard-inclusions/canvaConnect.js");
const canvaExportRoute = read("pages/api/standard-inclusions/canva/export-pdf.js");
const canvaStatusRoute = read("pages/api/standard-inclusions/canva/status.js");
const canvaReturnRoute = read("pages/api/standard-inclusions/canva/return.js");
const canvaReturnPage = read("pages/standard-inclusions/canva-return.js");
const migration = read("supabase/migrations/20260801_standard_inclusions_canva_finished_pdf.sql");

assert(!workbook.includes("importPdfAsStandardDocumentPreview"), "Workbook must not import the PDF-to-editable-block converter");
assert(!workbook.includes("<PdfImportReview"), "Finished PDF workflow must not render the editable-block import review");
assert(workbook.includes("/api/standard-inclusions/finished-pdf/upload"), "Finished PDF upload must use the locked original-PDF endpoint");
assert(workbook.includes("Finished PDF - not editable inside Gr8 Result."), "Finished PDFs must be clearly labelled as not editable");
assert(workbook.includes("FinishedPdfLockedViewer"), "Finished PDFs must render in the locked PDF viewer");
assert(workbook.includes("activeCanvaDocument") && workbook.includes("STANDARD_INCLUSIONS_EDITOR_MODES.CANVA"), "Canva documents must be a separate active document type");
assert(workbook.includes("/api/standard-inclusions/canva/start"), "Connect Canva button must call the OAuth start endpoint");
assert(workbook.includes("/api/standard-inclusions/canva/designs"), "Choose Existing Canva Design must call a design listing endpoint");
assert(workbook.includes("/api/standard-inclusions/canva/export-pdf"), "Generate PDF must call the Canva export endpoint");
assert(!workbook.includes("Create from Canva Template"), "UI must not advertise Canva templates when it only supports existing design selection");
assert(workbook.includes("CanvaSetupDiagnosticsPanel"), "Development diagnostics panel must be visible for Canva setup failures");
assert(workbook.includes("Choose Existing Canva Design"), "UI must provide a truthful existing-design workflow");
assert(workbook.includes("Reconnect Canva"), "UI must provide reconnect state for missing scopes/expired connection");

const finishedSummaryStart = workbook.indexOf("function StandardScheduleActiveSummary");
const finishedSummaryEnd = workbook.indexOf("function FinishedPdfLockedViewer");
const summaryBlock = workbook.slice(finishedSummaryStart, finishedSummaryEnd);
assert(summaryBlock.includes("isFinishedPdf"), "Active summary must branch for finished PDFs");
assert(!/isFinishedPdf[\s\S]+Editable blocks:[\s\S]+isFinishedPdf/.test(summaryBlock), "Finished PDF branch must not show editable block counts");

assert(standardInclusions.includes('CANVA: "canva"'), "Standard Inclusions modes must include Canva");
assert(standardInclusions.includes("finishedPdfStorageKey"), "Standard Inclusions state must persist original finished PDF storage keys");
assert(standardInclusions.includes("canvaDesignId"), "Standard Inclusions state must persist Canva design IDs");

assert(canvaConnect.includes("code_challenge_method") && canvaConnect.includes("s256"), "Canva OAuth must use PKCE S256");
assert(canvaConnect.includes("/oauth/token"), "Canva token exchange/refresh must happen server-side");
assert(canvaConnect.includes("canvaEnvironmentStatus") && canvaConnect.includes("canvaDatabaseStatus"), "Canva helper must expose safe setup diagnostics");
assert(canvaExportRoute.includes('"/exports"') && canvaExportRoute.includes("storeCanvaExportedPdf"), "Canva export flow must use Canva exports API");
assert(canvaConnect.includes("storeCanvaExportedPdf"), "Canva exported PDFs must be downloaded and stored permanently");
assert(canvaStatusRoute.includes("missingScopes") && canvaStatusRoute.includes("databaseTables"), "Status route must report scopes and migration readiness");
assert(canvaReturnRoute.includes("connect/keys") && canvaReturnRoute.includes("crypto.verify"), "Return route must validate Canva correlation JWT against Canva keys");
assert(canvaReturnPage.includes("correlation_jwt") && canvaReturnPage.includes("/api/standard-inclusions/canva/return"), "Browser return page must forward Canva correlation JWT to backend validation");

for (const table of ["canva_templates", "standard_inclusions_documents", "standard_inclusions_versions", "canva_connections"]) {
  assert(migration.includes(table), `Migration must define or extend ${table}`);
}

console.log("Standard Inclusions Canva/finished-PDF contract passed.");
