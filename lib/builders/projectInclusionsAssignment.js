import { PDFDocument } from "pdf-lib";
import crypto from "node:crypto";
import { supabaseAdmin } from "../supabaseAdmin";
import { STANDARD_INCLUSIONS_BUCKET, STANDARD_INCLUSIONS_TABLE, downloadStandardInclusionsAsset } from "../standard-inclusions/onlyoffice";

const ACTIVE_PROJECT_INCLUSIONS_SOURCE = "project_inclusions_assignment";
const QUOTE_PROPOSAL_SOURCE = "quote_proposal_builder";
const PROJECT_INCLUSIONS_TYPES = new Set(["standard_inclusions", "project_specific_inclusions", "modified_inclusions"]);

function isProjectInclusionsRow(row = {}) {
  const metadata = row.metadata || {};
  return metadata.source === ACTIVE_PROJECT_INCLUSIONS_SOURCE
    || (metadata.source === QUOTE_PROPOSAL_SOURCE && PROJECT_INCLUSIONS_TYPES.has(String(metadata.sourceType || "")));
}

function storagePathFor(path = "", bucket = STANDARD_INCLUSIONS_BUCKET) {
  const value = String(path || "");
  return value.includes(":") ? value : `${bucket}:${value}`;
}

function publicUrlFor(bucket, path) {
  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || "";
}

async function pdfPagesFromStoragePath(path) {
  const buffer = await downloadStandardInclusionsAsset(path);
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const pages = pdf.getPages().map((page, index) => {
    const { width, height } = page.getSize();
    const rotation = Number(page.getRotation?.().angle || 0);
    return {
      pageNumber: index + 1,
      order: index + 1,
      width,
      height,
      rotation,
      metadataRotation: rotation,
      orientation: width >= height ? "landscape" : "portrait",
    };
  });
  return { pages, buffer };
}

export async function loadActiveStandardInclusionsMasterForWorkspace(workspaceId) {
  if (!workspaceId) return null;
  const { data, error } = await supabaseAdmin
    .from(STANDARD_INCLUSIONS_TABLE)
    .select("*")
    .eq("tenant_id", String(workspaceId))
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.current_exported_pdf_asset_id) return null;
  return data;
}

export async function listActiveProjectInclusions({ workspaceId, projectId }) {
  if (!workspaceId || !projectId) return [];
  const { data, error } = await supabaseAdmin
    .from("builder_project_documents")
    .select("id, title, file_name, mime_type, file_size_bytes, storage_bucket, storage_path, public_url, status, metadata, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .eq("document_type", "other")
    .eq("status", "active")
    .limit(100);
  if (error) throw error;
  return (data || []).filter(isProjectInclusionsRow);
}

export async function deactivateActiveProjectInclusions({ workspaceId, projectId, keepId = "" }) {
  const rows = (await listActiveProjectInclusions({ workspaceId, projectId })).filter((row) => row.id !== keepId);
  const ids = rows.map((row) => row.id).filter(Boolean);
  if (!ids.length) return [];
  const { error } = await supabaseAdmin
    .from("builder_project_documents")
    .update({
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);
  if (error) throw error;
  return ids;
}

export function shapeProjectInclusionsDocument(row = {}) {
  const metadata = row.metadata || {};
  const pageCount = Number(metadata.pageCount || metadata.page_count || 1) || 1;
  const pageSizes = Array.isArray(metadata.pageSizes) ? metadata.pageSizes : [];
  const rotations = Array.isArray(metadata.pageRotation) ? metadata.pageRotation : [];
  const orientations = Array.isArray(metadata.pageOrientation) ? metadata.pageOrientation : [];
  return {
    id: row.id || "",
    title: row.title || row.file_name || "Premier Inclusions Schedule",
    fileName: row.file_name || row.title || "premier-inclusions-schedule.pdf",
    publicUrl: row.public_url || "",
    storagePath: row.storage_path || "",
    sourceType: metadata.sourceType || "standard_inclusions",
    status: row.status || "active",
    active: row.status !== "archived" && row.status !== "deleted" && metadata.active !== false,
    fileHash: metadata.fileHash || "",
    version: metadata.sourceMasterVersion || metadata.version || "",
    sourceMasterTemplateId: metadata.sourceMasterTemplateId || "",
    sourceMasterVersion: metadata.sourceMasterVersion || "",
    sourceMasterName: metadata.sourceMasterName || "Premier Inclusions Schedule",
    assignedAt: metadata.assignedAt || row.created_at || "",
    assignmentType: metadata.assignmentType || "standard",
    projectSpecific: metadata.assignmentType === "project_specific",
    projectId: metadata.projectId || "",
    estimateId: metadata.estimateId || "",
    pageCount,
    pages: Array.from({ length: pageCount }, (_, index) => ({
      pageNumber: index + 1,
      order: index + 1,
      width: Number(pageSizes[index]?.width || 595),
      height: Number(pageSizes[index]?.height || 842),
      rotation: Number(rotations[index] || 0),
      metadataRotation: Number(rotations[index] || 0),
      orientation: orientations[index] || "portrait",
    })),
  };
}

export async function getAssignedProjectInclusions({ workspaceId, projectId }) {
  const rows = await listActiveProjectInclusions({ workspaceId, projectId });
  if (!rows.length) return null;
  return shapeProjectInclusionsDocument(rows[0]);
}

export async function assignCurrentStandardInclusionsToProject({ workspaceId, projectId, userId, estimateId = "", force = false }) {
  if (!workspaceId || !projectId) throw new Error("workspaceId and projectId are required.");
  const existing = await listActiveProjectInclusions({ workspaceId, projectId });
  if (existing.length && !force) return shapeProjectInclusionsDocument(existing[0]);

  const master = await loadActiveStandardInclusionsMasterForWorkspace(workspaceId);
  if (!master) throw new Error("No active Standard Inclusions master PDF is available.");

  const pdfPath = master.current_exported_pdf_asset_id;
  const { pages, buffer } = await pdfPagesFromStoragePath(pdfPath);
  const now = new Date().toISOString();
  const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");
  const publicUrl = publicUrlFor(STANDARD_INCLUSIONS_BUCKET, pdfPath);
  const sourceMasterVersion = Number(master.version || 1) || 1;
  const sourceMasterName = String(master.source_file_name || "Premier Inclusions Schedule").replace(/\.pptx$/i, ".pdf");

  const { data: row, error } = await supabaseAdmin
    .from("builder_project_documents")
    .insert({
      workspace_id: workspaceId,
      project_id: projectId,
      snapshot_id: estimateId && /^[0-9a-f-]{36}$/i.test(estimateId) ? estimateId : null,
      document_type: "other",
      title: "Premier Inclusions Schedule",
      description: "Project-assigned Standard Inclusions PDF.",
      file_name: sourceMasterName,
      mime_type: "application/pdf",
      file_size_bytes: buffer.length,
      storage_bucket: STANDARD_INCLUSIONS_BUCKET,
      storage_path: storagePathFor(pdfPath),
      public_url: publicUrl,
      status: "active",
      metadata: {
        source: ACTIVE_PROJECT_INCLUSIONS_SOURCE,
        sourceType: "standard_inclusions",
        assignmentType: "standard",
        projectId,
        estimateId: estimateId || null,
        active: true,
        sourceMasterTemplateId: master.id,
        sourceMasterVersion,
        sourceMasterName: master.source_file_name || "Premier Inclusions Schedule",
        projectInclusionsDocumentId: null,
        assignedAt: now,
        fileHash,
        version: sourceMasterVersion,
        pageCount: pages.length,
        pageOrder: pages.map((page) => page.pageNumber),
        pageOrientation: pages.map((page) => page.orientation),
        pageRotation: pages.map((page) => page.rotation),
        pageSizes: pages.map((page) => ({ width: page.width, height: page.height })),
      },
      uploaded_by: userId || null,
      created_by: userId || null,
      updated_by: userId || null,
    })
    .select("id, title, file_name, mime_type, file_size_bytes, storage_bucket, storage_path, public_url, status, metadata, created_at, updated_at")
    .single();
  if (error) throw error;
  await deactivateActiveProjectInclusions({ workspaceId, projectId, keepId: row.id });
  return shapeProjectInclusionsDocument({
    ...row,
    metadata: { ...(row.metadata || {}), projectInclusionsDocumentId: row.id },
  });
}
