import JSZip from "jszip";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../../lib/withWorkspace";
import {
  STANDARD_INCLUSIONS_BUCKET,
  createOnlyOfficeId,
  createStandardInclusionsOnlyOfficeDocument,
  editorModeForOnlyOfficeFileType,
} from "../../../../lib/standard-inclusions/onlyoffice";

// The browser uploads the PPTX/PDF bytes straight to Supabase Storage via a
// signed URL, so this handler only ever sees small JSON control messages
// (never the file body) and is safe under Vercel's serverless body limit.
export const config = {
  api: {
    bodyParser: { sizeLimit: "256kb" },
  },
};

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_UPLOAD_MB = Math.round(MAX_UPLOAD_BYTES / 1024 / 1024);

const ALLOWED_EXTENSIONS = {
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".pdf": "application/pdf",
};

function extensionOf(name = "") {
  const match = String(name || "").toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : "";
}

function fail(res, statusCode, code, message) {
  return res.status(statusCode).json({ ok: false, code, error: message });
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function deleteStorageObject(storagePath) {
  if (!storagePath) return;
  try {
    await supabaseAdmin.storage.from(STANDARD_INCLUSIONS_BUCKET).remove([storagePath]);
  } catch (error) {
    console.warn("[standard-inclusions/upload-pptx] Failed to remove rejected upload", storagePath, error?.message || error);
  }
}

function assertFileSignature(buffer, ext) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
    const error = new Error("The uploaded file is empty or incomplete.");
    error.statusCode = 422;
    error.code = "STANDARD_INCLUSIONS_FILE_INCOMPLETE";
    throw error;
  }
  if (ext === ".pdf") {
    if (buffer.slice(0, 5).toString("latin1") !== "%PDF-") {
      const error = new Error("The uploaded file is not a valid PDF.");
      error.statusCode = 422;
      error.code = "STANDARD_INCLUSIONS_PDF_SIGNATURE_INVALID";
      throw error;
    }
    return;
  }
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
    const error = new Error("The uploaded file is not a valid Office document package.");
    error.statusCode = 422;
    error.code = "STANDARD_INCLUSIONS_OFFICE_SIGNATURE_INVALID";
    throw error;
  }
}

async function assertOfficeContents(buffer, ext) {
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    const error = new Error("The uploaded Office file could not be read as a ZIP package.");
    error.statusCode = 422;
    error.code = "STANDARD_INCLUSIONS_OFFICE_CONTENTS_INVALID";
    throw error;
  }
  const requiredPart = ext === ".docx" ? "word/document.xml" : "ppt/presentation.xml";
  if (!zip.file(requiredPart)) {
    const error = new Error(ext === ".docx"
      ? "The uploaded file is a ZIP archive but not a Word document."
      : "The uploaded file is a ZIP archive but not a PowerPoint presentation.");
    error.statusCode = 422;
    error.code = ext === ".docx" ? "STANDARD_INCLUSIONS_DOCX_CONTENTS_INVALID" : "STANDARD_INCLUSIONS_PPTX_CONTENTS_INVALID";
    throw error;
  }
}

async function handleCreateSignedUpload(req, res) {
  const rawName = String(req.body?.name || "");
  const size = Number(req.body?.size || 0);
  const ext = extensionOf(rawName);
  const declaredType = String(req.body?.type || "").toLowerCase();

  if (!ALLOWED_EXTENSIONS[ext]) {
    return fail(res, 400, "STANDARD_INCLUSIONS_EXTENSION_INVALID", "Upload a .docx, .pptx, or .pdf file.");
  }
  if (declaredType && !declaredType.includes("octet-stream")) {
    const expected = ALLOWED_EXTENSIONS[ext];
    const looksLikeZip = [".docx", ".pptx"].includes(ext) && (
      declaredType.includes("zip") ||
      declaredType.includes("presentationml") ||
      declaredType.includes("wordprocessingml")
    );
    if (declaredType !== expected && !looksLikeZip && declaredType !== "application/pdf") {
      return fail(res, 400, "STANDARD_INCLUSIONS_MIME_MISMATCH", "The file type reported by your browser does not match a Word, PowerPoint, or PDF file.");
    }
  }
  if (!Number.isFinite(size) || size <= 0) {
    return fail(res, 400, "STANDARD_INCLUSIONS_SIZE_UNKNOWN", "Could not determine the file size.");
  }
  if (size > MAX_UPLOAD_BYTES) {
    return fail(res, 413, "STANDARD_INCLUSIONS_UPLOAD_LIMIT_EXCEEDED", `That file is too large. Please upload a file up to ${MAX_UPLOAD_MB} MB.`);
  }

  const tenantId = req.workspaceId;
  const documentId = createOnlyOfficeId("std-inclusions");
  const storagePath = `${req.user.id}/standard-inclusions/${tenantId}/${documentId}/active/v1${ext}`;

  const { data, error } = await supabaseAdmin.storage
    .from(STANDARD_INCLUSIONS_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: false });
  if (error) {
    console.error("[standard-inclusions/upload-pptx] createSignedUploadUrl failed", error);
    return fail(res, 500, "STANDARD_INCLUSIONS_SIGNED_URL_FAILED", error.message || "Could not start the upload.");
  }

  return res.status(200).json({
    ok: true,
    documentId,
    storagePath,
    signedUrl: data.signedUrl,
    token: data.token,
    maxBytes: MAX_UPLOAD_BYTES,
  });
}

async function handleCompleteSignedUpload(req, res) {
  const tenantId = req.workspaceId;
  const documentId = String(req.body?.documentId || "");
  const storagePath = String(req.body?.storagePath || "");
  const originalName = String(req.body?.name || "Standard Inclusions.pptx");
  const reportedSize = Number(req.body?.size || 0);

  const pathPattern = new RegExp(
    `^${escapeRegExp(req.user.id)}/standard-inclusions/${escapeRegExp(tenantId)}/${escapeRegExp(documentId)}/active/v1\\.(docx|pptx|pdf)$`
  );
  const match = documentId && storagePath ? storagePath.match(pathPattern) : null;
  if (!match) {
    return fail(res, 400, "STANDARD_INCLUSIONS_UPLOAD_PATH_INVALID", "This upload reference is invalid or expired. Please upload the file again.");
  }
  const ext = `.${match[1]}`;

  let buffer;
  try {
    const { data, error } = await supabaseAdmin.storage.from(STANDARD_INCLUSIONS_BUCKET).download(storagePath);
    if (error) throw error;
    buffer = Buffer.from(await data.arrayBuffer());
  } catch (error) {
    console.error("[standard-inclusions/upload-pptx] download failed", storagePath, error?.message || error);
    return fail(res, 400, "STANDARD_INCLUSIONS_UPLOAD_NOT_FOUND", "The uploaded file could not be found in storage. Please try uploading again.");
  }

  try {
    if (buffer.length > MAX_UPLOAD_BYTES) {
      const error = new Error(`That file is too large. Please upload a file up to ${MAX_UPLOAD_MB} MB.`);
      error.statusCode = 413;
      error.code = "STANDARD_INCLUSIONS_UPLOAD_LIMIT_EXCEEDED";
      throw error;
    }
    if (Number.isFinite(reportedSize) && reportedSize > 0 && buffer.length !== reportedSize) {
      const error = new Error("The stored file size does not match the uploaded file. Please try uploading again.");
      error.statusCode = 422;
      error.code = "STANDARD_INCLUSIONS_SIZE_MISMATCH";
      throw error;
    }
    assertFileSignature(buffer, ext);
    if (ext === ".docx" || ext === ".pptx") await assertOfficeContents(buffer, ext);
  } catch (error) {
    await deleteStorageObject(storagePath);
    return fail(res, error.statusCode || 422, error.code || "STANDARD_INCLUSIONS_VALIDATION_FAILED", error.message || "The uploaded file failed validation.");
  }

  try {
    const document = await createStandardInclusionsOnlyOfficeDocument({
      id: documentId,
      tenantId,
      ownerUserId: req.user.id,
      sourceFileName: originalName,
      officeStoragePath: storagePath,
      fileType: ext.slice(1),
      editorMode: editorModeForOnlyOfficeFileType(ext.slice(1)),
      sourceType: ext === ".pdf" ? "pdf-upload" : ext === ".docx" ? "docx-upload" : "pptx-upload",
      allowedEditorUserIds: [],
    });
    return res.status(200).json({ ok: true, document });
  } catch (error) {
    await deleteStorageObject(storagePath);
    const message = error?.message || "Standard Inclusions upload failed.";
    const missingTable = /standard_inclusions_documents|schema cache|does not exist|could not find/i.test(message);
    console.error("[standard-inclusions/upload-pptx] document creation failed", message);
    return res.status(missingTable ? 501 : 500).json({
      ok: false,
      error: missingTable
        ? "Standard Inclusions ONLYOFFICE storage is not deployed. Run the standard_inclusions_documents migration first."
        : message,
      code: missingTable ? "STANDARD_INCLUSIONS_STORAGE_NOT_DEPLOYED" : "STANDARD_INCLUSIONS_DB_INSERT_FAILED",
    });
  }
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const action = String(req.body?.action || "");
  try {
    if (action === "create-signed-upload") return await handleCreateSignedUpload(req, res);
    if (action === "complete-signed-upload") return await handleCompleteSignedUpload(req, res);
    return fail(res, 400, "STANDARD_INCLUSIONS_UNKNOWN_ACTION", "Unknown Standard Inclusions upload action.");
  } catch (error) {
    console.error("[standard-inclusions/upload-pptx] unhandled error", error);
    return res.status(error?.statusCode || 500).json({
      ok: false,
      error: error?.message || "Standard Inclusions upload failed.",
      code: error?.code || "STANDARD_INCLUSIONS_UPLOAD_FAILED",
    });
  }
}

export default withWorkspace(handler);
