import { PDFDocument } from "pdf-lib";
import formidable from "formidable";
import crypto from "crypto";
import { readFile } from "fs/promises";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const config = {
  api: { bodyParser: false },
};

const BUCKET = "assets";

function safeName(fileName = "document.pdf") {
  return String(fileName || "document.pdf")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.\-_]/g, "")
    .toLowerCase() || "document.pdf";
}

async function parseMultipartForm(req) {
  const form = formidable({
    multiples: false,
    keepExtensions: true,
    maxFileSize: 100 * 1024 * 1024,
    filter: (part) => part.name === "file" || part.mimetype === "application/pdf",
  });
  return new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) reject(error);
      else resolve({ fields, files });
    });
  });
}

function firstField(fields, key, fallback = "") {
  const value = fields?.[key];
  if (Array.isArray(value)) return value[0] == null ? fallback : String(value[0]);
  return value == null ? fallback : String(value);
}

function firstFile(files, key = "file") {
  const value = files?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function bearerToken(req) {
  const auth = String(req.headers.authorization || req.headers.Authorization || "").trim();
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

function pageOrientation(page) {
  const { width, height } = page.getSize();
  const rotation = Number(page.getRotation?.().angle || 0);
  const rotated = Math.abs(rotation % 180) === 90;
  const displayWidth = rotated ? height : width;
  const displayHeight = rotated ? width : height;
  return displayWidth >= displayHeight ? "landscape" : "portrait";
}

function bytesStartWithPdf(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length >= 5
    && buffer[0] === 0x25
    && buffer[1] === 0x50
    && buffer[2] === 0x44
    && buffer[3] === 0x46
    && buffer[4] === 0x2d;
}

function parseStoragePath(value = "") {
  const raw = String(value || "");
  const index = raw.indexOf(":");
  if (index <= 0) return null;
  return { bucket: raw.slice(0, index), path: raw.slice(index + 1) };
}

function isInclusionsSourceType(sourceType = "") {
  return ["standard_inclusions", "modified_inclusions"].includes(String(sourceType || ""));
}

function isQuoteProposalInclusionsRow(row = {}) {
  const metadata = row.metadata || {};
  return metadata.source === "quote_proposal_builder" && isInclusionsSourceType(metadata.sourceType);
}

async function listActiveProjectInclusions({ workspaceId, projectId }) {
  if (!workspaceId || !projectId) return [];
  const { data, error } = await supabaseAdmin
    .from("builder_project_documents")
    .select("id, storage_path, metadata, status")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .eq("document_type", "other")
    .eq("status", "active")
    .limit(100);
  if (error) throw error;
  return (data || []).filter(isQuoteProposalInclusionsRow);
}

async function deactivatePreviousInclusions({ workspaceId, projectId, keepId }) {
  const previousRows = (await listActiveProjectInclusions({ workspaceId, projectId }))
    .filter((row) => row.id !== keepId);
  if (!previousRows.length) return [];

  const previousIds = previousRows.map((row) => row.id).filter(Boolean);
  if (previousIds.length) {
    const { error } = await supabaseAdmin
      .from("builder_project_documents")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .in("id", previousIds);
    if (error) throw error;
  }

  const removalsByBucket = previousRows.reduce((groups, row) => {
    const storage = parseStoragePath(row.storage_path || "");
    if (!storage?.bucket || !storage.path) return groups;
    groups[storage.bucket] = [...(groups[storage.bucket] || []), storage.path];
    return groups;
  }, {});
  await Promise.all(Object.entries(removalsByBucket).map(([bucket, paths]) => (
    supabaseAdmin.storage.from(bucket).remove([...new Set(paths)]).catch(() => null)
  )));
  return previousIds;
}

function normaliseClientPages(pages) {
  if (!Array.isArray(pages) || !pages.length) return null;
  return pages.map((page, index) => {
    const width = Number(page.width || 595);
    const height = Number(page.height || 842);
    const rotation = Number(page.rotation || page.metadataRotation || 0);
    return {
      pageNumber: Number(page.pageNumber || index + 1),
      order: Number(page.order || index + 1),
      width,
      height,
      rotation,
      metadataRotation: rotation,
      orientation: page.orientation === "landscape" || page.orientation === "portrait"
        ? page.orientation
        : width >= height ? "landscape" : "portrait",
    };
  });
}

function parseClientPdfMetadata(rawMetadata) {
  try {
    if (!rawMetadata) return null;
    const parsed = JSON.parse(String(rawMetadata));
    return normaliseClientPages(parsed?.pages);
  } catch {
    return null;
  }
}

async function readPagesWithPdfLib(buffer) {
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  return pdf.getPages().map((page, index) => {
    const { width, height } = page.getSize();
    const rotation = Number(page.getRotation?.().angle || 0);
    return {
      pageNumber: index + 1,
      order: index + 1,
      width,
      height,
      rotation,
      metadataRotation: rotation,
      orientation: pageOrientation(page),
    };
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ ok: false, error: "Missing Bearer token" });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user?.id) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }

  try {
    const userId = authData.user.id;
    const requestType = String(req.headers["content-type"] || "");
    if (!requestType.includes("multipart/form-data")) {
      return res.status(415).json({ ok: false, error: "PDF uploads must use multipart/form-data." });
    }

    const { fields, files } = await parseMultipartForm(req);
    const uploadedFile = firstFile(files);
    if (!uploadedFile?.filepath) {
      return res.status(400).json({ ok: false, error: "No PDF file was received." });
    }

    const fileName = uploadedFile.originalFilename || "document.pdf";
    const mimeType = uploadedFile.mimetype || "application/pdf";
    const sourceType = firstField(fields, "sourceType", "proposal_pdf");
    const workspaceId = firstField(fields, "workspaceId").trim();
    const projectId = firstField(fields, "projectId").trim();
    const estimateId = firstField(fields, "estimateId").trim();
    const metadata = firstField(fields, "metadata");

    if (mimeType !== "application/pdf" && !/\.pdf$/i.test(fileName)) {
      return res.status(400).json({ ok: false, error: "The selected file is not a valid PDF" });
    }

    const buffer = await readFile(uploadedFile.filepath);
    if (!buffer.length) return res.status(400).json({ ok: false, error: "Empty PDF received." });
    if (!bytesStartWithPdf(buffer)) {
      return res.status(400).json({ ok: false, error: "The selected file is not a valid PDF" });
    }
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");
    const fileVersion = `${Date.now()}-${fileHash.slice(0, 12)}`;

    let pages = parseClientPdfMetadata(metadata);
    if (!pages) {
      try {
        pages = await readPagesWithPdfLib(buffer);
      } catch (error) {
        return res.status(422).json({
          ok: false,
          error: `PDF metadata could not be read: ${error?.message || "Failed to parse PDF document"}`,
        });
      }
    }

    if (!pages.length) {
      return res.status(422).json({ ok: false, error: "PDF metadata could not be read: no pages were found." });
    }

    const objectPath = `${userId}/proposal-documents/${Date.now()}-${safeName(fileName)}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(objectPath, buffer, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(objectPath);
    const publicUrl = urlData?.publicUrl || "";
    const storagePath = `${BUCKET}:${objectPath}`;

    let documentId = `pdf:${objectPath}`;
    if (workspaceId && projectId) {
      const { data: row } = await supabaseAdmin
        .from("builder_project_documents")
        .insert({
          workspace_id: workspaceId,
          project_id: projectId,
          snapshot_id: estimateId && /^[0-9a-f-]{36}$/i.test(estimateId) ? estimateId : null,
          document_type: sourceType === "priced_plans" ? "general" : "other",
          title: sourceType === "priced_plans" ? "Priced Plans" : "Inclusions Schedule",
          description: "Imported into quote proposal builder.",
          file_name: fileName,
          mime_type: "application/pdf",
          file_size_bytes: buffer.length,
          storage_bucket: BUCKET,
          storage_path: storagePath,
          public_url: publicUrl,
          status: "active",
          metadata: {
            source: "quote_proposal_builder",
            sourceType,
            projectId: projectId || null,
            estimateId: estimateId || null,
            active: true,
            fileHash,
            version: fileVersion,
            pageCount: pages.length,
            pageOrder: pages.map((page) => page.pageNumber),
            pageOrientation: pages.map((page) => page.orientation),
            pageRotation: pages.map((page) => page.rotation),
            pageSizes: pages.map((page) => ({ width: page.width, height: page.height })),
          },
          uploaded_by: userId,
          created_by: userId,
          updated_by: userId,
        })
        .select("id")
        .single();
      if (row?.id) documentId = row.id;
    }

    const deactivatedDocumentIds = isInclusionsSourceType(sourceType)
      ? await deactivatePreviousInclusions({ workspaceId, projectId, keepId: documentId })
      : [];

    return res.status(200).json({
      ok: true,
      document: {
        id: documentId,
        fileName,
        title: fileName,
        publicUrl,
        storagePath,
        pageCount: pages.length,
        pages,
        sourceType,
        status: "active",
        fileHash,
        version: fileVersion,
        projectId: projectId || null,
        estimateId: estimateId || null,
        active: true,
        deactivatedDocumentIds,
        uploadedAt: new Date().toISOString(),
        uploadedBy: userId,
      },
    });
  } catch (error) {
    console.error("[proposal-document-upload]", error);
    return res.status(500).json({ ok: false, error: error?.message || "PDF upload failed" });
  }
}
