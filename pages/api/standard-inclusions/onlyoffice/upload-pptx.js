import formidable from "formidable";
import os from "node:os";
import { readFile, unlink } from "node:fs/promises";
import { withAuth } from "../../../../lib/withWorkspace";
import {
  createOnlyOfficeId,
  createStandardInclusionsOnlyOfficeDocument,
  uploadStandardInclusionsAsset,
} from "../../../../lib/standard-inclusions/onlyoffice";

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
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
      if (error) {
        const message = String(error?.message || "");
        const tooLarge = error?.code === "LIMIT_FILE_SIZE"
          || error?.code === "LIMIT_TOTAL_FILE_SIZE"
          || /maxFileSize|maxTotalFileSize|options\.max/i.test(message);
        if (tooLarge) {
          const sizeError = new Error("That PowerPoint file is too large. Please upload a .pptx up to 80 MB.");
          sizeError.statusCode = 413;
          reject(sizeError);
          return;
        }
        reject(error);
        return;
      }
      resolve({ fields, files });
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
    const contentLength = Number(req.headers["content-length"] || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_PPTX_BYTES + 1024 * 1024) {
      return res.status(413).json({ ok: false, error: "That PowerPoint file is too large. Please upload a .pptx up to 80 MB." });
    }

    const contentType = String(req.headers["content-type"] || "").toLowerCase();
    if (!contentType.includes("multipart/form-data")) {
      return res.status(400).json({ ok: false, error: "PowerPoint upload must be sent as multipart/form-data." });
    }

    const { fields, files } = await parseForm(req);
    const file = firstFile(files);
    const originalName = file?.originalFilename || file?.newFilename || "";
    if (!file || !/\.pptx$/i.test(originalName)) {
      return res.status(400).json({ ok: false, error: "Upload a .pptx presentation file." });
    }

    const tenantId = firstField(fields.tenantId, req.user.id);
    const documentId = createOnlyOfficeId("std-inclusions");
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
      sourceType: "pptx-upload",
      allowedEditorUserIds: [],
    });

    return res.status(200).json({ ok: true, document });
  } catch (error) {
    cleanupTempFile();
    const message = error?.message || "PowerPoint upload failed.";
    const missingTable = /standard_inclusions_documents|schema cache|does not exist|could not find/i.test(message);
    return res.status(missingTable ? 501 : 500).json({
      ok: false,
      error: missingTable
        ? "Standard Inclusions ONLYOFFICE storage is not deployed. Run the standard_inclusions_documents migration first."
        : message,
      code: missingTable ? "STANDARD_INCLUSIONS_STORAGE_NOT_DEPLOYED" : "STANDARD_INCLUSIONS_PPTX_UPLOAD_FAILED",
    });
  }
}

export default withAuth(handler);
