import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { PDFDocument } from "pdf-lib";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const WORKSPACE_ID = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const USER_ID = "35ab846e-0764-498b-b1f8-7d2cf27d85a5";
const JOHNSON_PROJECT_ID = "896be24f-a7fb-4a8e-b652-495fdcaa7fe2";
const JOHNSON_ESTIMATE_PDF = "C:/Users/grant/Downloads/Bob & May Johnson - Project Estimate.pdf";
const PREMIER_INCLUSIONS_PDF = "C:/Users/grant/Downloads/Premier Inclusions Schedule.pdf";
const ASSETS_BUCKET = "assets";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !serviceKey) throw new Error("Missing Supabase URL/service role key.");

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function safeName(fileName = "document.pdf") {
  return String(fileName || "document.pdf")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.\-_]/g, "")
    .toLowerCase() || "document.pdf";
}

async function pdfMetadata(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46 || buffer[4] !== 0x2d) {
    throw new Error(`${filePath} is not a PDF.`);
  }
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const pages = pdf.getPages().map((page, index) => {
    const { width, height } = page.getSize();
    const rotation = Number(page.getRotation?.().angle || 0);
    const rotated = Math.abs(rotation % 180) === 90;
    const displayWidth = rotated ? height : width;
    const displayHeight = rotated ? width : height;
    return {
      pageNumber: index + 1,
      order: index + 1,
      width,
      height,
      rotation,
      metadataRotation: rotation,
      orientation: displayWidth >= displayHeight ? "landscape" : "portrait",
    };
  });
  return {
    filePath,
    fileName: path.basename(filePath),
    buffer,
    fileHash: crypto.createHash("sha256").update(buffer).digest("hex"),
    pageCount: pages.length,
    pages,
  };
}

async function uploadPermanentPdf(meta, objectPath) {
  const { error } = await supabase.storage
    .from(ASSETS_BUCKET)
    .upload(objectPath, meta.buffer, { contentType: "application/pdf", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(objectPath);
  return {
    storageBucket: ASSETS_BUCKET,
    objectPath,
    storagePath: `${ASSETS_BUCKET}:${objectPath}`,
    publicUrl: data?.publicUrl || "",
  };
}

function documentPayload(meta, uploaded, overrides = {}) {
  const now = new Date().toISOString();
  return {
    fileName: meta.fileName,
    title: overrides.title || meta.fileName,
    publicUrl: uploaded.publicUrl,
    storagePath: uploaded.storagePath,
    sourceType: overrides.sourceType || "project_estimate_pdf",
    status: overrides.status || "active",
    active: overrides.active !== false,
    fileHash: meta.fileHash,
    version: `${Date.now()}-${meta.fileHash.slice(0, 12)}`,
    pageCount: meta.pageCount,
    pages: meta.pages.map((page, index) => ({
      ...page,
      documentId: overrides.documentId || "",
      fileName: meta.fileName,
      publicUrl: uploaded.publicUrl,
      storagePath: uploaded.storagePath,
      sourceType: overrides.sourceType || "project_estimate_pdf",
      order: index + 1,
    })),
    uploadedAt: now,
    uploadedBy: USER_ID,
    projectId: JOHNSON_PROJECT_ID,
    estimateId: overrides.estimateId || "",
  };
}

async function findJohnsonProject() {
  const { data, error } = await supabase
    .from("builder_commercial_projects")
    .select("*")
    .eq("id", JOHNSON_PROJECT_ID)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Johnson project not found: ${JOHNSON_PROJECT_ID}`);
  return data;
}

async function latestSnapshotId() {
  const { data, error } = await supabase
    .from("builder_estimate_snapshots")
    .select("id")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("project_id", JOHNSON_PROJECT_ID)
    .order("snapshot_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

async function upsertActiveJohnsonEstimateDocument(meta, uploaded, snapshotId) {
  const { data: previousRows, error: previousError } = await supabase
    .from("builder_project_documents")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("project_id", JOHNSON_PROJECT_ID)
    .eq("status", "active")
    .or("metadata->>sourceType.eq.project_estimate_pdf,metadata->>uiDocumentType.eq.project_estimate,title.ilike.%Project Estimate%");
  if (previousError) throw previousError;

  const previousActiveRows = (previousRows || []).filter((row) => row.metadata?.fileHash !== meta.fileHash);
  const previousActiveIds = previousActiveRows.map((row) => row.id);
  if (previousActiveIds.length) {
    const { error } = await supabase
      .from("builder_project_documents")
      .update({
        status: "archived",
        updated_at: new Date().toISOString(),
        metadata: previousActiveRows[0].metadata
          ? { ...previousActiveRows[0].metadata, supersededByImport: "johnson-supplied-project-estimate-pdf" }
          : { supersededByImport: "johnson-supplied-project-estimate-pdf" },
      })
      .in("id", previousActiveIds);
    if (error) throw error;
  }

  const baseMetadata = {
    source: "project_estimate_import",
    sourceType: "project_estimate_pdf",
    uiDocumentType: "project_estimate",
    projectId: JOHNSON_PROJECT_ID,
    estimateId: snapshotId,
    assignedAt: new Date().toISOString(),
    active: true,
    fileHash: meta.fileHash,
    pageCount: meta.pageCount,
    pageOrder: meta.pages.map((page) => page.pageNumber),
    pageOrientation: meta.pages.map((page) => page.orientation),
    pageRotation: meta.pages.map((page) => page.rotation),
    pageSizes: meta.pages.map((page) => ({ width: page.width, height: page.height })),
    originalSourcePath: meta.filePath,
    supersededActiveDocumentIds: previousActiveIds,
  };

  const { data: existingByHash, error: existingError } = await supabase
    .from("builder_project_documents")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("project_id", JOHNSON_PROJECT_ID)
    .eq("metadata->>fileHash", meta.fileHash)
    .eq("metadata->>sourceType", "project_estimate_pdf")
    .maybeSingle();
  if (existingError) throw existingError;

  if (existingByHash?.id) {
    const { data, error } = await supabase
      .from("builder_project_documents")
      .update({
        snapshot_id: snapshotId,
        document_type: "quote",
        title: "Bob & May Johnson - Project Estimate",
        description: "Supplied 21-page Project Estimate PDF.",
        file_name: meta.fileName,
        mime_type: "application/pdf",
        file_size_bytes: meta.buffer.length,
        storage_bucket: ASSETS_BUCKET,
        storage_path: uploaded.storagePath,
        public_url: uploaded.publicUrl,
        status: "active",
        metadata: baseMetadata,
        uploaded_by: USER_ID,
        updated_by: USER_ID,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingByHash.id)
      .select("*")
      .single();
    if (error) throw error;
    return { row: data, previousActiveIds };
  }

  const { data, error } = await supabase
    .from("builder_project_documents")
    .insert({
      workspace_id: WORKSPACE_ID,
      project_id: JOHNSON_PROJECT_ID,
      snapshot_id: snapshotId,
      document_type: "quote",
      title: "Bob & May Johnson - Project Estimate",
      description: "Supplied 21-page Project Estimate PDF.",
      file_name: meta.fileName,
      mime_type: "application/pdf",
      file_size_bytes: meta.buffer.length,
      storage_bucket: ASSETS_BUCKET,
      storage_path: uploaded.storagePath,
      public_url: uploaded.publicUrl,
      status: "active",
      metadata: baseMetadata,
      uploaded_by: USER_ID,
      created_by: USER_ID,
      updated_by: USER_ID,
    })
    .select("*")
    .single();
  if (error) throw error;
  return { row: data, previousActiveIds };
}

async function ensureArchivedAssociationRecord(sourceDocument, label) {
  if (!sourceDocument?.storagePath && !sourceDocument?.publicUrl) return null;
  if (sourceDocument.sourceType === "project_estimate_pdf") return null;
  const storagePath = sourceDocument.storagePath || "";
  const { data: existing, error: existingError } = await supabase
    .from("builder_project_documents")
    .select("id")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("project_id", JOHNSON_PROJECT_ID)
    .eq("status", "archived")
    .eq("storage_path", storagePath)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("builder_project_documents")
    .insert({
      workspace_id: WORKSPACE_ID,
      project_id: JOHNSON_PROJECT_ID,
      document_type: sourceDocument.sourceType === "priced_plans" ? "general" : "other",
      title: `Superseded generic Johnson association - ${label}`,
      description: "Archived during supplied Johnson Project Estimate PDF import; storage object retained.",
      file_name: sourceDocument.fileName || sourceDocument.title || label,
      mime_type: "application/pdf",
      file_size_bytes: 0,
      storage_bucket: ASSETS_BUCKET,
      storage_path: storagePath,
      public_url: sourceDocument.publicUrl || "",
      status: "archived",
      metadata: {
        source: "project_estimate_import",
        sourceType: sourceDocument.sourceType || "",
        uiDocumentType: "superseded_generic_association",
        supersededReason: "Replaced by supplied Bob & May Johnson 21-page Project Estimate PDF.",
        supersededAt: new Date().toISOString(),
        originalImportedDocument: sourceDocument,
      },
      uploaded_by: USER_ID,
      created_by: USER_ID,
      updated_by: USER_ID,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function registerPremierMaster(meta, uploaded) {
  const { data: schedule, error: scheduleError } = await supabase
    .from("standard_inclusions_schedules")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .ilike("name", "%Premier%")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (scheduleError) throw scheduleError;

  let activeSchedule = schedule;
  if (!activeSchedule) {
    const { data, error } = await supabase
      .from("standard_inclusions_schedules")
      .insert({
        workspace_id: WORKSPACE_ID,
        name: "Premier Inclusions Schedule",
        description: "Authoritative Premier Inclusions master PDF.",
        tier_key: "premier",
        status: "active",
        metadata: { source: "johnson-import", originalSourcePath: meta.filePath },
        created_by: USER_ID,
        updated_by: USER_ID,
      })
      .select("*")
      .single();
    if (error) throw error;
    activeSchedule = data;
  }

  const { data: existingVersion, error: existingError } = await supabase
    .from("standard_inclusions_schedule_versions")
    .select("*")
    .eq("schedule_id", activeSchedule.id)
    .eq("file_hash", meta.fileHash)
    .maybeSingle();
  if (existingError) throw existingError;

  let version = existingVersion;
  if (!version) {
    const { data: latest, error: latestError } = await supabase
      .from("standard_inclusions_schedule_versions")
      .select("version_number")
      .eq("schedule_id", activeSchedule.id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw latestError;
    const versionNumber = Number(latest?.version_number || 0) + 1;
    const { data, error } = await supabase
      .from("standard_inclusions_schedule_versions")
      .insert({
        workspace_id: WORKSPACE_ID,
        schedule_id: activeSchedule.id,
        version_number: versionNumber,
        storage_bucket: ASSETS_BUCKET,
        storage_path: uploaded.objectPath,
        public_url: uploaded.publicUrl,
        original_filename: meta.fileName,
        page_count: meta.pageCount,
        file_size_bytes: meta.buffer.length,
        file_hash: meta.fileHash,
        source: "pdf-upload",
        status: "active",
        metadata: {
          source: "johnson-import",
          originalSourcePath: meta.filePath,
          pages: meta.pages,
          pageOrder: meta.pages.map((page) => page.pageNumber),
          pageOrientation: meta.pages.map((page) => page.orientation),
          pageRotation: meta.pages.map((page) => page.rotation),
          pageSizes: meta.pages.map((page) => ({ width: page.width, height: page.height })),
        },
        created_by: USER_ID,
      })
      .select("*")
      .single();
    if (error) throw error;
    version = data;
  }

  const { error: updateError } = await supabase
    .from("standard_inclusions_schedules")
    .update({
      name: "Premier Inclusions Schedule",
      description: "Authoritative Premier Inclusions master PDF.",
      tier_key: "premier",
      current_version_id: version.id,
      metadata: {
        ...(activeSchedule.metadata || {}),
        source: "johnson-import",
        originalSourcePath: meta.filePath,
        currentFileHash: meta.fileHash,
        currentPageCount: meta.pageCount,
      },
      updated_by: USER_ID,
      updated_at: new Date().toISOString(),
    })
    .eq("id", activeSchedule.id);
  if (updateError) throw updateError;

  return { scheduleId: activeSchedule.id, version };
}

async function updateProjectEstimateInstance(johnsonDocument, previousAssociations = []) {
  const { data: instance, error } = await supabase
    .from("project_estimate_instances")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("project_id", JOHNSON_PROJECT_ID)
    .maybeSingle();
  if (error) throw error;
  if (!instance?.id) throw new Error("Project Estimate instance not found for Johnson project.");

  const { data: existingPages, error: pagesError } = await supabase
    .from("project_estimate_instance_pages")
    .select("*")
    .eq("instance_id", instance.id)
    .order("page_order", { ascending: true });
  if (pagesError) throw pagesError;

  const oldImported = (existingPages || [])
    .map((page) => page.imported_document)
    .filter((document) => document?.storagePath || document?.publicUrl);
  const archivedAssociationIds = [];
  for (const [index, document] of oldImported.entries()) {
    const archivedId = await ensureArchivedAssociationRecord(document, document.fileName || `association-${index + 1}`);
    if (archivedId) archivedAssociationIds.push(archivedId);
  }

  const pageRows = johnsonDocument.pages.map((page, index) => ({
    instance_id: instance.id,
    page_key: `project-estimate-pdf-${index + 1}`,
    page_name: `Project Estimate ${index + 1}`,
    page_type: "importedPlanPdf",
    page_order: index,
    width: Math.round(Number(page.width) || 794),
    height: Math.round(Number(page.height) || 1123),
    orientation: page.orientation === "landscape" ? "landscape" : "portrait",
    background: {
      source: "builder-created",
      hiddenFromPdf: false,
      importedDocumentSlot: "projectEstimate",
    },
    imported_document: {
      ...page,
      documentId: johnsonDocument.id,
      fileName: johnsonDocument.fileName,
      title: johnsonDocument.title,
      publicUrl: johnsonDocument.publicUrl,
      storagePath: johnsonDocument.storagePath,
      sourceType: "project_estimate_pdf",
      pageCount: johnsonDocument.pageCount,
      fileHash: johnsonDocument.fileHash,
      version: johnsonDocument.version,
      projectId: JOHNSON_PROJECT_ID,
    },
    blocks: [],
  }));

  const { error: deleteError } = await supabase
    .from("project_estimate_instance_pages")
    .delete()
    .eq("instance_id", instance.id);
  if (deleteError) throw deleteError;

  const { data: insertedPages, error: insertError } = await supabase
    .from("project_estimate_instance_pages")
    .insert(pageRows)
    .select("*");
  if (insertError) throw insertError;

  const superseded = [
    ...previousAssociations,
    ...archivedAssociationIds.map((id) => ({ id, source: "instance_slot_archive" })),
  ];
  const { data: updatedInstance, error: updateError } = await supabase
    .from("project_estimate_instances")
    .update({
      page_order: pageRows.map((row) => row.page_key),
      settings: {
        ...(instance.settings || {}),
        activeProjectEstimateDocument: johnsonDocument,
        importedDocuments: {
          ...((instance.settings || {}).importedDocuments || {}),
          projectEstimate: johnsonDocument,
        },
        supersededImportedDocumentAssociations: superseded,
        lastJohnsonPdfImportAt: new Date().toISOString(),
      },
      status: "active",
    })
    .eq("id", instance.id)
    .select("*")
    .single();
  if (updateError) throw updateError;

  return { instance: updatedInstance, pages: insertedPages || [], archivedAssociationIds };
}

async function listSupersededJohnsonAssociations() {
  const { data, error } = await supabase
    .from("builder_project_documents")
    .select("id, title, file_name, storage_path, metadata")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("project_id", JOHNSON_PROJECT_ID)
    .eq("status", "archived")
    .eq("metadata->>uiDocumentType", "superseded_generic_association")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function main() {
  [JOHNSON_ESTIMATE_PDF, PREMIER_INCLUSIONS_PDF].forEach((filePath) => {
    if (!fs.existsSync(filePath)) throw new Error(`Attached file not found: ${filePath}`);
  });

  const project = await findJohnsonProject();
  const snapshotId = await latestSnapshotId();
  const johnsonMeta = await pdfMetadata(JOHNSON_ESTIMATE_PDF);
  const premierMeta = await pdfMetadata(PREMIER_INCLUSIONS_PDF);
  if (johnsonMeta.pageCount !== 21) throw new Error(`Johnson PDF page count mismatch: ${johnsonMeta.pageCount}`);
  if (premierMeta.pageCount !== 10) throw new Error(`Premier Inclusions PDF page count mismatch: ${premierMeta.pageCount}`);

  const johnsonUpload = await uploadPermanentPdf(
    johnsonMeta,
    `${USER_ID}/project-estimates/${WORKSPACE_ID}/${JOHNSON_PROJECT_ID}/${johnsonMeta.fileHash.slice(0, 16)}-${safeName(johnsonMeta.fileName)}`,
  );
  const premierUpload = await uploadPermanentPdf(
    premierMeta,
    `${USER_ID}/standard-inclusions/${WORKSPACE_ID}/premier-master/${premierMeta.fileHash.slice(0, 16)}-${safeName(premierMeta.fileName)}`,
  );

  const { row: johnsonRow, previousActiveIds } = await upsertActiveJohnsonEstimateDocument(johnsonMeta, johnsonUpload, snapshotId);
  const johnsonDocument = {
    ...documentPayload(johnsonMeta, johnsonUpload, {
      documentId: johnsonRow.id,
      title: "Bob & May Johnson - Project Estimate",
      sourceType: "project_estimate_pdf",
      estimateId: snapshotId || "",
    }),
    id: johnsonRow.id,
  };
  johnsonDocument.pages = johnsonDocument.pages.map((page) => ({ ...page, documentId: johnsonRow.id }));

  const premier = await registerPremierMaster(premierMeta, premierUpload);
  const instanceResult = await updateProjectEstimateInstance(
    johnsonDocument,
    previousActiveIds.map((id) => ({ id, source: "builder_project_documents" })),
  );
  const supersededAssociations = await listSupersededJohnsonAssociations();

  const result = {
    attachedFiles: {
      johnsonEstimatePdf: JOHNSON_ESTIMATE_PDF,
      premierInclusionsPdf: PREMIER_INCLUSIONS_PDF,
    },
    johnsonProjectId: project.id,
    workspaceId: WORKSPACE_ID,
    snapshotId,
    projectEstimateDocumentId: johnsonRow.id,
    projectEstimateStoragePath: johnsonUpload.storagePath,
    projectEstimatePublicUrl: johnsonUpload.publicUrl,
    projectEstimateHash: johnsonMeta.fileHash,
    projectEstimatePageCount: johnsonMeta.pageCount,
    premierInclusionsDocumentId: premier.version.id,
    premierInclusionsScheduleId: premier.scheduleId,
    premierInclusionsStoragePath: `${ASSETS_BUCKET}:${premier.version.storage_path}`,
    premierInclusionsPublicUrl: premier.version.public_url,
    premierInclusionsHash: premierMeta.fileHash,
    premierInclusionsPageCount: premierMeta.pageCount,
    projectEstimateInstanceId: instanceResult.instance.id,
    projectEstimateInstancePageCount: instanceResult.pages.length,
    previousIncorrectRecordsSuperseded: supersededAssociations.map((row) => ({
      id: row.id,
      fileName: row.file_name,
      title: row.title,
      storagePath: row.storage_path,
      originalSourceType: row.metadata?.sourceType || "",
    })),
  };

  const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "test-results", "johnson-pdf-import");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "import-result.json"), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
