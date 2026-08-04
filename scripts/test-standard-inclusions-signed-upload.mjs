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

const upload = read("pages/api/standard-inclusions/onlyoffice/upload-pptx.js");
const workbook = read("components/estimate-builder/EstimateBuilderWorkbook.js");

const preparePowerPointImport = workbook.slice(
  workbook.indexOf("async function preparePowerPointImport"),
  workbook.indexOf("async function preparePdfImport"),
);

// The whole point of this route: the raw file body must never pass through
// this Vercel serverless function, only small JSON control messages that
// reference a Supabase Storage signed upload.
assert(!upload.includes("formidable"), "Upload route no longer parses multipart form bodies with formidable");
assert(!/bodyParser:\s*false/.test(upload), "Upload route keeps the default JSON body parser instead of disabling it");
assert(upload.includes('bodyParser: { sizeLimit: "256kb" }'), "Upload route caps its JSON body size, since it should never carry file bytes");
assert(upload.includes("createSignedUploadUrl"), "Upload route issues a Supabase Storage signed upload URL");
assert(upload.includes('action === "create-signed-upload"'), "Upload route exposes a create-signed-upload action");
assert(upload.includes('action === "complete-signed-upload"'), "Upload route exposes a complete-signed-upload action");
assert(upload.includes(".storage.from(STANDARD_INCLUSIONS_BUCKET).download("), "Complete action downloads the uploaded object server-side for verification");
assert(upload.includes("assertFileSignature"), "Upload route verifies the file signature server-side");
assert(upload.includes("assertPptxContents"), "Upload route verifies PPTX zip contents server-side");
assert(upload.includes('".pdf"') && upload.includes('".pptx"'), "Upload route allows both .pptx and .pdf extensions");
assert(upload.includes("deleteStorageObject"), "Upload route deletes rejected uploads from storage");
assert(upload.includes("MAX_UPLOAD_BYTES = 100 * 1024 * 1024"), "Upload route defines a sensible maximum upload size");
assert(!upload.includes("createStandardInclusionsOnlyOfficeDocument({\n      id,"), "Upload route does not create a document record before validating the upload");

assert(preparePowerPointImport.includes('action: "create-signed-upload"'), "Client requests a signed upload before sending file bytes");
assert(preparePowerPointImport.includes("uploadFileToSignedUrlWithProgress"), "Client uploads directly to storage with progress reporting");
assert(preparePowerPointImport.includes('action: "complete-signed-upload"'), "Client confirms the upload once the direct storage PUT succeeds");
assert(!preparePowerPointImport.includes('formData.append("file"'), "Client no longer sends the raw file as a multipart body to the Next.js API route");

if (process.exitCode) process.exit(process.exitCode);
