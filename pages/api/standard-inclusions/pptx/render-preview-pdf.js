import formidable from "formidable";
import os from "node:os";
import { readFile, unlink } from "node:fs/promises";
import { withAuth } from "../../../../lib/withWorkspace";
import {
  appBaseUrl,
  createOnlyOfficeAccessKey,
  createOnlyOfficeId,
  createStandardInclusionsOnlyOfficeDocument,
  onlyOfficeDocumentKey,
  onlyOfficeDocumentServerUrl,
  signOnlyOfficeJwt,
  uploadStandardInclusionsAsset,
} from "../../../../lib/standard-inclusions/onlyoffice";

export const config = {
  api: {
    bodyParser: false,
    responseLimit: "100mb",
  },
};

const MAX_PPTX_BYTES = 80 * 1024 * 1024;

function parseForm(req) {
  const form = formidable({
    multiples: false,
    keepExtensions: true,
    uploadDir: os.tmpdir(),
    maxFileSize: MAX_PPTX_BYTES,
    maxTotalFileSize: MAX_PPTX_BYTES,
    allowEmptyFiles: false,
    minFileSize: 1,
  });
  return new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) reject(error);
      else resolve({ fields, files });
    });
  });
}

function firstField(value, fallback = "") {
  return Array.isArray(value) ? String(value[0] || fallback) : String(value || fallback);
}

function firstFile(files) {
  const file = files?.file || files?.pptx || files?.presentation;
  return Array.isArray(file) ? file[0] : file;
}

async function convertPptxDocumentToPdf({ document, req }) {
  const documentServerUrl = onlyOfficeDocumentServerUrl();
  if (!documentServerUrl) {
    const error = new Error("ONLYOFFICE_DOCUMENT_SERVER_URL is not configured, so high-fidelity PowerPoint slide rendering cannot run.");
    error.statusCode = 501;
    error.code = "ONLYOFFICE_DOCUMENT_SERVER_MISSING";
    throw error;
  }
  const baseUrl = appBaseUrl(req);
  if (!baseUrl) throw new Error("APP_URL is required so ONLYOFFICE can fetch the PowerPoint source.");
  const version = Number(document.version || 1);
  const accessKey = createOnlyOfficeAccessKey(document.id, document.current_pptx_asset_id, version);
  const requestBody = {
    async: false,
    filetype: "pptx",
    key: `${onlyOfficeDocumentKey(document)}-hybrid-preview-pdf`,
    outputtype: "pdf",
    title: document.source_file_name || "Standard Inclusions.pptx",
    url: `${baseUrl}/api/standard-inclusions/onlyoffice/file?documentId=${encodeURIComponent(document.id)}&accessKey=${accessKey}`,
  };
  const token = signOnlyOfficeJwt(requestBody);
  const response = await fetch(`${documentServerUrl}/converter?shardkey=${encodeURIComponent(requestBody.key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(token ? { token } : requestBody),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    throw new Error(payload?.message || `ONLYOFFICE PowerPoint rendering failed (${payload?.error || response.status}).`);
  }
  const pdfUrl = String(payload?.fileUrl || payload?.url || "").trim();
  if (!pdfUrl) throw new Error("ONLYOFFICE conversion did not return a rendered PDF URL.");
  const pdfResponse = await fetch(pdfUrl);
  if (!pdfResponse.ok) throw new Error(`Could not download rendered PowerPoint PDF (${pdfResponse.status}).`);
  return Buffer.from(await pdfResponse.arrayBuffer());
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  let tempFilePath = "";
  const cleanupTempFile = () => {
    if (tempFilePath) {
      unlink(tempFilePath).catch(() => {});
      tempFilePath = "";
    }
  };

  try {
    const { fields, files } = await parseForm(req);
    const file = firstFile(files);
    const originalName = file?.originalFilename || file?.newFilename || "";
    if (!file || !/\.pptx$/i.test(originalName)) {
      return res.status(400).json({ ok: false, error: "Upload a .pptx presentation file." });
    }

    const tenantId = firstField(fields.tenantId, req.user.id);
    const documentId = createOnlyOfficeId("std-inclusions-hybrid");
    const storagePath = `${req.user.id}/standard-inclusions/${tenantId}/${documentId}/active/v1.pptx`;
    tempFilePath = file.filepath || "";
    const body = await readFile(file.filepath);
    cleanupTempFile();
    await uploadStandardInclusionsAsset(
      storagePath,
      body,
      file.mimetype || "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      false,
    );

    const document = await createStandardInclusionsOnlyOfficeDocument({
      id: documentId,
      tenantId,
      ownerUserId: req.user.id,
      sourceFileName: originalName,
      pptxStoragePath: storagePath,
      sourceType: "pptx-hybrid-import-source",
      allowedEditorUserIds: [],
    });
    const pdfBuffer = await convertPptxDocumentToPdf({ document, req });
    return res.status(200).json({
      ok: true,
      documentId: document.id,
      sourceFileName: originalName,
      pptxAssetId: storagePath,
      pdfDataUrl: `data:application/pdf;base64,${pdfBuffer.toString("base64")}`,
      renderSource: "onlyoffice",
    });
  } catch (error) {
    cleanupTempFile();
    return res.status(error?.statusCode || 500).json({
      ok: false,
      error: error?.message || "PowerPoint slide rendering failed.",
      code: error?.code || "STANDARD_INCLUSIONS_PPTX_RENDER_FAILED",
    });
  }
}

export default withAuth(handler);
