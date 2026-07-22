import { JSDOM } from "jsdom";

export const config = {
  api: {
    bodyParser: false,
    responseLimit: "100mb",
  },
};

const MAX_PPTX_BYTES = 80 * 1024 * 1024;

function uploadFailure(stage, message, statusCode = 400, details = {}) {
  const error = new Error(message);
  error.stage = stage;
  error.code = stage;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function logUpload(stage, details = {}) {
  console.info("[standard-inclusions/import-powerpoint]", stage, details);
}

function multipartBoundary(contentType) {
  const match = String(contentType || "").match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return (match?.[1] || match?.[2] || "").trim();
}

function parseContentDisposition(value = "") {
  const result = {};
  String(value || "").split(";").forEach((part) => {
    const [rawKey, ...rawValue] = part.trim().split("=");
    const key = rawKey.trim().toLowerCase();
    if (!key) return;
    result[key] = rawValue.join("=").trim().replace(/^"|"$/g, "");
  });
  return result;
}

function readRequestBody(req, diagnostics) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("aborted", () => {
      diagnostics.aborted = true;
      reject(uploadFailure("UPLOAD_REQUEST_ABORTED", "PowerPoint upload request was aborted before the body completed.", 400, diagnostics));
    });
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_PPTX_BYTES + 1024 * 1024) {
        reject(uploadFailure("UPLOAD_LIMIT_EXCEEDED", "PowerPoint upload exceeds the 80 MB limit.", 413, { ...diagnostics, receivedBodyBytes: total }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      diagnostics.receivedBodyBytes = total;
      resolve(Buffer.concat(chunks, total));
    });
    req.on("error", (error) => {
      reject(uploadFailure("UPLOAD_REQUEST_ABORTED", error?.message || "PowerPoint upload request stream failed.", 400, diagnostics));
    });
  });
}

function parseMultipartBuffer(body, boundary, diagnostics) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const headerEndBuffer = Buffer.from("\r\n\r\n");
  const nextBoundaryBuffer = Buffer.from(`\r\n--${boundary}`);
  const fields = {};
  let file = null;
  let cursor = body.indexOf(boundaryBuffer);
  if (cursor < 0) {
    throw uploadFailure("MULTIPART_BOUNDARY_MISSING", "Multipart boundary was not found in the request body.", 400, diagnostics);
  }

  while (cursor >= 0) {
    cursor += boundaryBuffer.length;
    if (body[cursor] === 45 && body[cursor + 1] === 45) break;
    if (body[cursor] === 13 && body[cursor + 1] === 10) cursor += 2;

    const headerEnd = body.indexOf(headerEndBuffer, cursor);
    if (headerEnd < 0) {
      throw uploadFailure("BODY_ALREADY_CONSUMED", "Multipart part headers were incomplete.", 400, diagnostics);
    }
    const headersText = body.slice(cursor, headerEnd).toString("utf8");
    const headers = {};
    headersText.split(/\r\n/).forEach((line) => {
      const index = line.indexOf(":");
      if (index > -1) headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
    });
    const disposition = parseContentDisposition(headers["content-disposition"] || "");
    const dataStart = headerEnd + headerEndBuffer.length;
    const nextBoundary = body.indexOf(nextBoundaryBuffer, dataStart);
    if (nextBoundary < 0) {
      throw uploadFailure("UPLOAD_REQUEST_ABORTED", "Multipart file data ended before the closing boundary.", 400, diagnostics);
    }
    const data = body.slice(dataStart, nextBoundary);
    if (disposition.name === "file") {
      file = {
        originalFilename: disposition.filename || "upload.pptx",
        mimetype: headers["content-type"] || "",
        buffer: data,
        size: data.length,
      };
    } else if (disposition.name) {
      fields[disposition.name] = data.toString("utf8");
    }
    cursor = nextBoundary + 2;
    if (body.indexOf(boundaryBuffer, cursor) !== cursor) {
      cursor = body.indexOf(boundaryBuffer, cursor);
    }
  }

  return { fields, file };
}

async function parseMultipart(req) {
  const contentType = String(req.headers["content-type"] || "");
  const contentLength = Number(req.headers["content-length"] || 0);
  const boundary = multipartBoundary(contentType);
  const diagnostics = {
    contentType,
    contentLength,
    aborted: Boolean(req.aborted),
    parserCompleted: false,
    tempFilePath: "(memory)",
    originalFilename: "",
    receivedBytes: 0,
    receivedBodyBytes: 0,
    reportedBrowserFileSize: 0,
  };

  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    throw uploadFailure("MULTIPART_BOUNDARY_MISSING", "PowerPoint upload must use multipart/form-data.", 415, diagnostics);
  }
  if (!boundary) {
    throw uploadFailure("MULTIPART_BOUNDARY_MISSING", "Multipart boundary is missing from the upload request.", 400, diagnostics);
  }
  if (Number.isFinite(contentLength) && contentLength > MAX_PPTX_BYTES + 1024 * 1024) {
    throw uploadFailure("UPLOAD_LIMIT_EXCEEDED", "PowerPoint upload exceeds the 80 MB limit.", 413, diagnostics);
  }

  logUpload("REQUEST_BODY_READ_START", diagnostics);
  const body = await readRequestBody(req, diagnostics);
  if (Number.isFinite(contentLength) && contentLength > 0 && body.length !== contentLength) {
    throw uploadFailure("FILE_SIZE_MISMATCH", "Request body byte count does not match Content-Length.", 400, { ...diagnostics, bufferBytes: body.length });
  }
  logUpload("REQUEST_BODY_READ_COMPLETE", { ...diagnostics, bufferBytes: body.length });
  const { fields, file } = parseMultipartBuffer(body, boundary, diagnostics);
  diagnostics.parserCompleted = true;
  diagnostics.originalFilename = file?.originalFilename || "";
  diagnostics.receivedBytes = Number(file?.size || 0);
  diagnostics.reportedBrowserFileSize = Number(fields?.browserFileSize || file?.size || 0);
  logUpload("MULTIPART_PARSE_COMPLETE", diagnostics);
  return { fields, file, diagnostics };
}

function assertPptxSignature(buffer, diagnostics) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    throw uploadFailure("TEMP_FILE_INCOMPLETE", "Uploaded PowerPoint temporary file is empty or incomplete.", 400, diagnostics);
  }
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
    throw uploadFailure("PPTX_ZIP_SIGNATURE_INVALID", "Uploaded file is not a valid PPTX ZIP package.", 422, diagnostics);
  }
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" });
  }

  try {
    const { file, diagnostics } = await parseMultipart(req);
    if (!file?.buffer) {
      throw uploadFailure("TEMP_FILE_INCOMPLETE", "No PowerPoint file was received.", 400, diagnostics);
    }
    if (!/\.pptx$/i.test(diagnostics.originalFilename)) {
      throw uploadFailure("PPTX_EXTENSION_INVALID", "Upload a .pptx presentation file.", 400, diagnostics);
    }

    const buffer = file.buffer;
    const finalDiagnostics = { ...diagnostics, bufferBytes: buffer.length };
    if (buffer.length !== diagnostics.receivedBytes) {
      throw uploadFailure("TEMP_FILE_INCOMPLETE", "PowerPoint temporary file byte count does not match parser byte count.", 400, finalDiagnostics);
    }
    if (diagnostics.reportedBrowserFileSize && buffer.length !== diagnostics.reportedBrowserFileSize) {
      throw uploadFailure("FILE_SIZE_MISMATCH", "PowerPoint upload byte count does not match the browser file size.", 400, finalDiagnostics);
    }
    assertPptxSignature(buffer, finalDiagnostics);
    logUpload("PPTX_BUFFER_READY", finalDiagnostics);

    if (typeof globalThis.DOMParser === "undefined") {
      globalThis.DOMParser = new JSDOM("").window.DOMParser;
    }
    const { importPptxAsStandardDocumentPreview } = await import("../../../lib/standard-inclusions/powerpointImport.js");
    const imported = await importPptxAsStandardDocumentPreview({
      name: diagnostics.originalFilename,
      arrayBuffer: async () => buffer,
    }, { expectedSlideCount: 10 });
    logUpload("POWERPOINT_IMPORT_COMPLETE", {
      ...finalDiagnostics,
      pageCount: imported.pageCount,
      editableTextCount: imported.editableTextCount,
    });
    return res.status(200).json({
      ok: true,
      code: "POWERPOINT_UPLOAD_COMPLETE",
      diagnostics: finalDiagnostics,
      import: imported,
    });
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    console.error("[standard-inclusions/import-powerpoint]", error?.code || "POWERPOINT_UPLOAD_FAILED", error?.details || {}, error?.message || error);
    return res.status(statusCode).json({
      ok: false,
      code: error?.code || "POWERPOINT_UPLOAD_FAILED",
      stage: error?.stage || "POWERPOINT_UPLOAD_FAILED",
      error: error?.message || "PowerPoint upload failed.",
      diagnostics: error?.details || {},
    });
  }
}

export default handler;
