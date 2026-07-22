import { PDFDocument } from "pdf-lib";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "5mb",
    },
  },
};

const A4_PORTRAIT = { width: 595.28, height: 841.89 };
const A4_LANDSCAPE = { width: 841.89, height: 595.28 };
function bearerToken(req) {
  const auth = String(req.headers.authorization || req.headers.Authorization || "").trim();
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

function sendJson(res, statusCode, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(statusCode).json({
    success: false,
    ok: false,
    ...payload,
  });
}

async function readRawRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function parseJsonRequestBody(req) {
  const contentType = String(req.headers["content-type"] || "");
  console.info("[proposal-document-export] body parsing start", {
    contentType,
    hasReqBody: req.body !== undefined,
    hasRequestJson: typeof req.json === "function",
  });

  if (req.body !== undefined) {
    if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
      return { ok: true, body: req.body, rawBody: "", source: "req.body" };
    }
    return {
      ok: false,
      statusCode: 400,
      error: "Request body must be a JSON object.",
      field: "request body",
    };
  }

  if (typeof req.json === "function") {
    try {
      console.info("[proposal-document-export] request.json() start");
      const parsed = await req.json();
      console.info("[proposal-document-export] request.json() success", {
        keys: parsed && typeof parsed === "object" ? Object.keys(parsed) : [],
      });
      return { ok: true, body: parsed, rawBody: "", source: "request.json()" };
    } catch (error) {
      console.error("[proposal-document-export] request.json() failed", serializeError(error));
      return {
        ok: false,
        statusCode: 400,
        error: "Request JSON parsing failed in request.json().",
        details: error?.message || String(error),
        stack: error?.stack || "",
        field: "request body",
      };
    }
  }

  const rawBody = await readRawRequestBody(req);
  console.info("[proposal-document-export] raw body read", {
    contentType,
    byteLength: Buffer.byteLength(rawBody),
    preview: rawBody.slice(0, 300),
  });

  if (!rawBody.trim()) {
    return {
      ok: false,
      statusCode: 400,
      error: "Request body is empty.",
      details: "Expected a JSON object containing documentType, estimateId, jobId, templateId, templateVersion, pageOrder, pageOverrides, linkedFieldOverrides, and importedDocumentReferences.",
      field: "request body",
      rawBodyPreview: rawBody,
    };
  }

  try {
    console.info("[proposal-document-export] JSON.parse() start");
    const parsed = JSON.parse(rawBody);
    console.info("[proposal-document-export] JSON.parse() success", {
      keys: parsed && typeof parsed === "object" ? Object.keys(parsed) : [],
    });
    return { ok: true, body: parsed, rawBody, source: "JSON.parse()" };
  } catch (error) {
    console.error("[proposal-document-export] JSON.parse() failed", {
      error: serializeError(error),
      contentType,
      byteLength: Buffer.byteLength(rawBody),
      preview: rawBody.slice(0, 1000),
    });
    return {
      ok: false,
      statusCode: 400,
      error: "Request body is not valid JSON.",
      details: error?.message || String(error),
      stack: error?.stack || "",
      field: "request body",
      contentType,
      rawBodyPreview: rawBody.slice(0, 1000),
    };
  }
}

function isInclusionsSourceType(sourceType = "") {
  return ["standard_inclusions", "modified_inclusions"].includes(String(sourceType || ""));
}

function isQuoteProposalInclusionsRow(row = {}) {
  const metadata = row.metadata || {};
  return metadata.source === "quote_proposal_builder" && isInclusionsSourceType(metadata.sourceType);
}

function activeInclusionsCandidates(importedDocuments = {}) {
  const candidates = [];
  if (importedDocuments?.inclusions && typeof importedDocuments.inclusions === "object") {
    candidates.push(importedDocuments.inclusions);
  }
  Object.entries(importedDocuments || {}).forEach(([key, value]) => {
    if (key === "inclusions" || !/inclusion/i.test(key)) return;
    if (value && typeof value === "object" && (value.publicUrl || value.public_url || value.storagePath || value.storage_path)) {
      candidates.push(value);
    }
  });
  return candidates.filter((document) => document.active !== false && !["inactive", "removed"].includes(String(document.status || "")));
}

async function listActiveProjectInclusions({ workspaceId, projectId }) {
  if (!workspaceId || !projectId) return [];
  const { data, error } = await supabaseAdmin
    .from("builder_project_documents")
    .select("id, file_name, storage_path, public_url, metadata, status")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .eq("document_type", "other")
    .eq("status", "active")
    .limit(100);
  if (error) throw error;
  return (data || []).filter(isQuoteProposalInclusionsRow);
}

async function verifyActiveInclusionsForExport({ importedDocuments, workspaceId, projectId }) {
  const candidates = activeInclusionsCandidates(importedDocuments);
  if (candidates.length > 1) {
    throw new Error("More than one active inclusions schedule exists in the export payload. Remove the old schedule before exporting.");
  }
  const payloadDocument = candidates[0] || null;
  const dbRows = await listActiveProjectInclusions({ workspaceId, projectId });
  if (dbRows.length > 1) {
    throw new Error("More than one active inclusions schedule exists for this project. Remove the old schedule before exporting.");
  }
  if (dbRows.length === 1 && !payloadDocument) {
    throw new Error(`An active inclusions schedule exists in the project database but is not selected in this estimate pack: ${dbRows[0].file_name || dbRows[0].id}. Remove it completely or select the correct schedule before exporting.`);
  }
  if (dbRows.length === 1 && payloadDocument?.id && dbRows[0].id !== payloadDocument.id) {
    throw new Error(`The export payload inclusions schedule does not match the active project schedule. Active: ${dbRows[0].file_name || dbRows[0].id}`);
  }
  const activeDocument = payloadDocument || null;
  console.info("[proposal-document-export] active inclusions", {
    fileName: activeDocument?.fileName || activeDocument?.file_name || "",
    publicUrl: activeDocument?.publicUrl || activeDocument?.public_url || "",
    storagePath: activeDocument?.storagePath || activeDocument?.storage_path || "",
    version: activeDocument?.version || activeDocument?.fileVersion || "",
    fileHash: activeDocument?.fileHash || activeDocument?.file_hash || "",
    pageCount: activeDocument?.pageCount || activeDocument?.page_count || 0,
    projectId,
    legacyInclusionsSourceFound: Object.keys(importedDocuments || {}).some((key) => key !== "inclusions" && /inclusion/i.test(key)),
  });
  return activeDocument;
}

function parseRenderedPageImage(imageData = "") {
  const match = String(imageData || "").match(/^data:(image\/png|image\/jpeg|image\/jpg);base64,(.+)$/);
  if (!match) throw new Error("Invalid rendered page image.");
  const mimeType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  return { mimeType, bytes: Buffer.from(match[2], "base64") };
}

function safePdfFilename(value = "estimate-pack.pdf") {
  const name = String(value || "estimate-pack.pdf").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "estimate-pack.pdf";
  return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
}

function serializeError(error) {
  return {
    name: error?.name || "Error",
    message: error?.message || String(error),
    stack: error?.stack || "",
    code: error?.code || "",
    cause: error?.cause ? serializeError(error.cause) : null,
  };
}

function collectImportedPdfDiagnostics(importedDocuments = {}) {
  const documents = [];
  Object.entries(importedDocuments || {}).forEach(([key, document]) => {
    if (!document || typeof document !== "object") return;
    const pages = Array.isArray(document.pages) ? document.pages : [];
    documents.push({
      key,
      id: document.id || "",
      fileName: document.fileName || document.file_name || document.title || "",
      publicUrl: document.publicUrl || document.public_url || document.url || "",
      storagePath: document.storagePath || document.storage_path || "",
      sourceType: document.sourceType || document.source_type || "",
      pageCount: Number(document.pageCount || document.page_count || pages.length || 0) || 0,
      pages: pages.map((page, index) => ({
        pageNumber: Number(page.pageNumber || index + 1),
        order: Number(page.order || index + 1),
        fileName: page.fileName || document.fileName || document.file_name || "",
        publicUrl: page.publicUrl || document.publicUrl || document.public_url || "",
        storagePath: page.storagePath || document.storagePath || document.storage_path || "",
      })),
    });
  });
  return documents;
}

function validateExportPayload(body = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      statusCode: 400,
      error: "Request JSON must be an object.",
      details: `Received ${Array.isArray(body) ? "array" : typeof body}.`,
      field: "body",
    };
  }
  const bodyJson = JSON.stringify(body);
  if (/data:(image|application)\//i.test(bodyJson) || /;base64,/i.test(bodyJson) || body.renderedPages) {
    return {
      ok: false,
      statusCode: 400,
      error: "Export payload must not include rendered pages, embedded images, PDFs, or Base64 data.",
      details: "Send only template/page metadata and stable document references.",
      field: "renderedPages",
    };
  }
  if (body.documentType !== "project-estimate") {
    return {
      ok: false,
      statusCode: 400,
      error: "Invalid export payload field: documentType must be project-estimate.",
      field: "documentType",
    };
  }
  if (!Array.isArray(body.pageOrder)) {
    return {
      ok: false,
      statusCode: 400,
      error: "Invalid export payload field: pageOrder must be an array.",
      field: "pageOrder",
    };
  }
  if (body.importedDocumentReferences !== undefined && (body.importedDocumentReferences === null || typeof body.importedDocumentReferences !== "object" || Array.isArray(body.importedDocumentReferences))) {
    return {
      ok: false,
      statusCode: 400,
      error: "Invalid export payload field: importedDocumentReferences must be an object when provided.",
      field: "importedDocumentReferences",
    };
  }
  return { ok: true };
}

function requestDiagnostics(req, body = {}) {
  const importedDocuments = body?.importedDocumentReferences && typeof body.importedDocumentReferences === "object" ? body.importedDocumentReferences : {};
  return {
    method: req.method,
    url: req.url,
    contentType: String(req.headers["content-type"] || ""),
    accept: String(req.headers.accept || ""),
    contentLength: String(req.headers["content-length"] || ""),
    uploadedInclusionsSchedule: importedDocuments.inclusions || null,
    uploadedPlans: importedDocuments.pricedPlans || null,
    uploadedPdfPaths: collectImportedPdfDiagnostics(importedDocuments),
    pageCount: Array.isArray(body?.pageOrder) ? body.pageOrder.length : 0,
  };
}

function pageFailureLabel(renderedPage = {}, fallbackIndex = 0) {
  const file = renderedPage.sourceFile || renderedPage.sourcePath || `rendered page ${fallbackIndex + 1}`;
  const page = renderedPage.sourcePageNumber ? ` page ${renderedPage.sourcePageNumber}` : "";
  return `${file}${page}`;
}

async function appendRenderedPageImage({ outputPdf, renderedPage }) {
  const canvas = renderedPage.orientation === "landscape" ? A4_LANDSCAPE : A4_PORTRAIT;
  const page = outputPdf.addPage([canvas.width, canvas.height]);
  const { mimeType, bytes } = parseRenderedPageImage(renderedPage.imageData);
  const image = mimeType === "image/png" ? await outputPdf.embedPng(bytes) : await outputPdf.embedJpg(bytes);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed", details: `Received ${req.method}; expected POST.` });
  }

  let parsedBody = {};
  try {
    console.info("[proposal-document-export] incoming request", {
      method: req.method,
      url: req.url,
      contentType: String(req.headers["content-type"] || ""),
      accept: String(req.headers.accept || ""),
      contentLength: String(req.headers["content-length"] || ""),
    });

    const parseResult = await parseJsonRequestBody(req);
    if (!parseResult.ok) {
      console.error("[proposal-document-export] body parsing failed", parseResult);
      return sendJson(res, parseResult.statusCode || 400, parseResult);
    }

    const body = parseResult.body;
    parsedBody = body;
    console.info("[proposal-document-export] parsed request body", {
      source: parseResult.source,
      keys: body && typeof body === "object" ? Object.keys(body) : [],
      fileName: body?.fileName || "",
      name: body?.name || "",
      workspaceId: body?.workspaceId || "",
      projectId: body?.projectId || "",
      estimateId: body?.estimateId || "",
      pageCount: Array.isArray(body?.pageOrder) ? body.pageOrder.length : 0,
      importedDocumentKeys: body?.importedDocumentReferences && typeof body.importedDocumentReferences === "object" ? Object.keys(body.importedDocumentReferences) : [],
    });

    const validation = validateExportPayload(body);
    console.info("[proposal-document-export] payload validation", validation);
    if (!validation.ok) {
      return sendJson(res, validation.statusCode || 400, {
        ...validation,
        request: requestDiagnostics(req, body),
      });
    }

    const importedDocuments = body.importedDocumentReferences || {};
    const workspaceId = String(body.workspaceId || "").trim();
    const projectId = String(body.projectId || "").trim();
    const uploadedPdfPaths = collectImportedPdfDiagnostics(importedDocuments);
    console.info("[proposal-document-export] export request", {
      workspaceId,
      projectId,
      estimateId: body.estimateId || "",
      pageOrder: body.pageOrder || [],
      uploadedPdfPaths,
      pageCount: Array.isArray(body.pageOrder) ? body.pageOrder.length : 0,
    });

    const token = bearerToken(req);
    if (token) {
      const { error } = await supabaseAdmin.auth.getUser(token);
      if (error) {
        return sendJson(res, 401, {
          error: "Invalid token",
          details: error.message || "Supabase rejected the bearer token.",
          request: requestDiagnostics(req, body),
        });
      }
    }

    await verifyActiveInclusionsForExport({ importedDocuments, workspaceId, projectId });
    console.info("[proposal-document-export] small metadata payload accepted", {
      documentType: body.documentType,
      templateId: body.templateId,
      templateVersion: body.templateVersion,
      pageCount: body.pageOrder?.length || 0,
    });
    return sendJson(res, 200, {
      success: true,
      ok: true,
      accepted: true,
      documentType: body.documentType,
      pageCount: body.pageOrder?.length || 0,
    });
  } catch (error) {
    const serialized = serializeError(error);
    const body = parsedBody && typeof parsedBody === "object" ? parsedBody : {};
    const renderedPages = Array.isArray(body.renderedPages) ? body.renderedPages : [];
    const importedDocuments = body.importedDocuments || {};
    const uploadedPdfPaths = collectImportedPdfDiagnostics(importedDocuments);
    const outputPath = `download:${safePdfFilename(body.fileName || body.name || "estimate-pack.pdf")}`;
    const responseBody = {
      ok: false,
      error: "PDF export could not be completed.",
      uploadedPdfPaths,
      pageCount: renderedPages.length,
      outputPath,
      details: {
        workspaceId: body.workspaceId || "",
        projectId: body.projectId || "",
        estimateId: body.estimateId || "",
        renderedPages: renderedPages.map((page, index) => ({
          pageIndex: index + 1,
          pageType: page.pageType || "",
          sourceFile: page.sourceFile || "",
          sourcePath: page.sourcePath || "",
          sourcePageNumber: page.sourcePageNumber || "",
          orientation: page.orientation || "",
          imageDataLength: String(page.imageData || "").length,
        })),
      },
    };
    console.error("[proposal-document-export] exception stack", serialized.stack || serialized.message);
    console.error("[proposal-document-export] merge error", responseBody.mergeError);
    console.error("[proposal-document-export] pdf-lib error", responseBody.pdfLibError);
    console.error("[proposal-document-export] uploaded PDF paths", uploadedPdfPaths);
    console.error("[proposal-document-export] page count", responseBody.pageCount);
    console.error("[proposal-document-export] output path", outputPath);
    console.error("[proposal-document-export] response body", responseBody);
    return sendJson(res, 500, responseBody);
  }
}
