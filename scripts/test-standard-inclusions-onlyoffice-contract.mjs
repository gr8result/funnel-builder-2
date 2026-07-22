import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

const workbook = read("components/estimate-builder/EstimateBuilderWorkbook.js");
const onlyoffice = read("lib/standard-inclusions/onlyoffice.js");
const upload = read("pages/api/standard-inclusions/onlyoffice/upload-pptx.js");
const callback = read("pages/api/standard-inclusions/onlyoffice/callback.js");
const editor = read("components/standard-inclusions/OnlyOfficePresentationEditor.jsx");

const preparePowerPointImport = workbook.slice(
  workbook.indexOf("async function preparePowerPointImport"),
  workbook.indexOf("async function preparePdfImport"),
);

assert(workbook.includes("OnlyOfficePresentationEditor"), "Standard Inclusions renders the ONLYOFFICE presentation editor");
assert(preparePowerPointImport.includes("/api/standard-inclusions/onlyoffice/upload-pptx"), "PowerPoint upload posts to the ONLYOFFICE upload route");
assert(!preparePowerPointImport.includes("importPptxAsStandardDocumentPreview"), "PowerPoint upload no longer calls the custom XML-to-block importer");
assert(workbook.includes('source: "onlyoffice-pptx"'), "Workbook state records ONLYOFFICE PPTX source");
assert(workbook.includes("onlyOfficeDocumentId: document.id"), "Workbook stores the ONLYOFFICE document ID");
assert(onlyoffice.includes('documentType: "slide"'), "ONLYOFFICE config opens PPTX files as presentations");
assert(onlyoffice.includes("/web-apps/apps/api/documents/api.js"), "Editor config loads the official ONLYOFFICE Docs API script");
assert(upload.includes("createStandardInclusionsOnlyOfficeDocument"), "Upload route creates a persistent Standard Inclusions document record");
assert(callback.includes("if (![2, 6].includes(status))"), "Callback saves only ONLYOFFICE ready-to-save statuses");
assert(callback.includes("revision_history"), "Callback appends saved PPTX revisions");
assert(editor.includes("new DocsAPI.DocEditor"), "Client component mounts the native ONLYOFFICE editor");
assert(fs.existsSync(path.join(root, "supabase/migrations/20260720_standard_inclusions_onlyoffice.sql")), "Database migration for ONLYOFFICE document records exists");

if (process.exitCode) process.exit(process.exitCode);
