import crypto from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { supabaseAdmin } from "../supabaseAdmin";

export const STANDARD_INCLUSIONS_SCHEDULES_TABLE = "standard_inclusions_schedules";
export const STANDARD_INCLUSIONS_VERSIONS_TABLE = "standard_inclusions_schedule_versions";
export const STANDARD_INCLUSIONS_BUCKET = "assets";

export function safeStandardInclusionsFileName(fileName = "standard-inclusions.pdf") {
  return String(fileName || "standard-inclusions.pdf")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.\-_]/g, "")
    .toLowerCase() || "standard-inclusions.pdf";
}

export function assertPdfBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 5) throw new Error("The selected file is not a valid PDF.");
  if (buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46 || buffer[4] !== 0x2d) {
    throw new Error("The selected file is not a valid PDF.");
  }
}

export async function readPdfVersionMetadata(buffer) {
  assertPdfBuffer(buffer);
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
      orientation: displayWidth >= displayHeight ? "landscape" : "portrait",
    };
  });
  return { pageCount: pages.length, pages };
}

export function shapeStandardInclusionsVersion(row = {}) {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    versionNumber: Number(row.version_number || 0),
    storageBucket: row.storage_bucket || STANDARD_INCLUSIONS_BUCKET,
    storagePath: row.storage_path || "",
    publicUrl: row.public_url || "",
    fileReference: `${row.storage_bucket || STANDARD_INCLUSIONS_BUCKET}:${row.storage_path || ""}`,
    originalFilename: row.original_filename || "",
    pageCount: Number(row.page_count || 0),
    fileSize: Number(row.file_size_bytes || 0),
    fileHash: row.file_hash || "",
    source: row.source || "pdf-upload",
    status: row.status || "active",
    createdAt: row.created_at || "",
    createdBy: row.created_by || "",
    metadata: row.metadata || {},
  };
}

export function shapeStandardInclusionsSchedule(row = {}, versions = []) {
  const shapedVersions = versions.map(shapeStandardInclusionsVersion)
    .sort((a, b) => Number(b.versionNumber || 0) - Number(a.versionNumber || 0));
  const currentVersion = shapedVersions.find((version) => version.id === row.current_version_id) || shapedVersions[0] || null;
  return {
    id: row.id,
    organisationId: row.workspace_id,
    workspaceId: row.workspace_id,
    name: row.name || "Standard Inclusions Schedule",
    description: row.description || "",
    tierKey: row.tier_key || "",
    displayOrder: Number(row.display_order || 0),
    status: row.status || "active",
    currentVersionId: row.current_version_id || "",
    currentVersion,
    versions: shapedVersions.map((version) => ({
      ...version,
      current: version.id === (row.current_version_id || currentVersion?.id),
    })),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    metadata: row.metadata || {},
  };
}

export async function listStandardInclusionsSchedules({ workspaceId, includeArchived = false }) {
  let schedulesQuery = supabaseAdmin
    .from(STANDARD_INCLUSIONS_SCHEDULES_TABLE)
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("display_order", { ascending: true })
    .order("updated_at", { ascending: false });
  if (!includeArchived) schedulesQuery = schedulesQuery.eq("status", "active");
  const { data: schedules, error: schedulesError } = await schedulesQuery;
  if (schedulesError) throw schedulesError;

  const scheduleIds = (schedules || []).map((schedule) => schedule.id);
  if (!scheduleIds.length) return [];
  const { data: versions, error: versionsError } = await supabaseAdmin
    .from(STANDARD_INCLUSIONS_VERSIONS_TABLE)
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("schedule_id", scheduleIds)
    .order("version_number", { ascending: false });
  if (versionsError) throw versionsError;

  const versionsBySchedule = (versions || []).reduce((groups, version) => {
    groups[version.schedule_id] = [...(groups[version.schedule_id] || []), version];
    return groups;
  }, {});
  return (schedules || []).map((schedule) => shapeStandardInclusionsSchedule(schedule, versionsBySchedule[schedule.id] || []));
}

export async function loadStandardInclusionsSchedule({ workspaceId, scheduleId }) {
  const { data: schedule, error } = await supabaseAdmin
    .from(STANDARD_INCLUSIONS_SCHEDULES_TABLE)
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", scheduleId)
    .maybeSingle();
  if (error) throw error;
  if (!schedule) return null;
  const { data: versions, error: versionsError } = await supabaseAdmin
    .from(STANDARD_INCLUSIONS_VERSIONS_TABLE)
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("schedule_id", scheduleId)
    .order("version_number", { ascending: false });
  if (versionsError) throw versionsError;
  return shapeStandardInclusionsSchedule(schedule, versions || []);
}

export async function createStandardInclusionsScheduleWithPdf({
  workspaceId,
  userId,
  name,
  description = "",
  tierKey = "",
  fileName,
  buffer,
  source = "pdf-upload",
}) {
  const pdfMetadata = await readPdfVersionMetadata(buffer);
  const now = new Date().toISOString();
  const scheduleName = String(name || fileName || "Standard Inclusions Schedule").replace(/\.pdf$/i, "").trim();
  const { data: schedule, error: scheduleError } = await supabaseAdmin
    .from(STANDARD_INCLUSIONS_SCHEDULES_TABLE)
    .insert({
      workspace_id: workspaceId,
      name: scheduleName || "Standard Inclusions Schedule",
      description,
      tier_key: tierKey,
      status: "active",
      created_by: userId,
      updated_by: userId,
      updated_at: now,
    })
    .select("*")
    .maybeSingle();
  if (scheduleError) throw scheduleError;

  const version = await createStandardInclusionsVersion({
    workspaceId,
    userId,
    schedule,
    versionNumber: 1,
    fileName,
    buffer,
    source,
    pdfMetadata,
  });
  const { data: updatedSchedule, error: updateError } = await supabaseAdmin
    .from(STANDARD_INCLUSIONS_SCHEDULES_TABLE)
    .update({ current_version_id: version.id, updated_at: now, updated_by: userId })
    .eq("id", schedule.id)
    .select("*")
    .maybeSingle();
  if (updateError) throw updateError;
  return shapeStandardInclusionsSchedule(updatedSchedule, [version.raw]);
}

export async function replaceStandardInclusionsSchedulePdf({ workspaceId, userId, scheduleId, fileName, buffer }) {
  const schedule = await loadStandardInclusionsSchedule({ workspaceId, scheduleId });
  if (!schedule || schedule.status !== "active") throw new Error("Standard Inclusions schedule not found.");
  const nextVersionNumber = Math.max(0, ...schedule.versions.map((version) => Number(version.versionNumber || 0))) + 1;
  const pdfMetadata = await readPdfVersionMetadata(buffer);
  const version = await createStandardInclusionsVersion({
    workspaceId,
    userId,
    schedule,
    versionNumber: nextVersionNumber,
    fileName,
    buffer,
    source: "pdf-replacement",
    pdfMetadata,
  });
  await setCurrentStandardInclusionsVersion({ workspaceId, userId, scheduleId, versionId: version.id });
  return loadStandardInclusionsSchedule({ workspaceId, scheduleId });
}

export async function restoreStandardInclusionsVersion({ workspaceId, userId, scheduleId, versionId }) {
  const schedule = await loadStandardInclusionsSchedule({ workspaceId, scheduleId });
  if (!schedule || schedule.status !== "active") throw new Error("Standard Inclusions schedule not found.");
  const sourceVersion = schedule.versions.find((version) => version.id === versionId);
  if (!sourceVersion) throw new Error("Version not found.");
  const { data, error } = await supabaseAdmin.storage.from(sourceVersion.storageBucket).download(sourceVersion.storagePath);
  if (error) throw error;
  const buffer = Buffer.from(await data.arrayBuffer());
  const nextVersionNumber = Math.max(0, ...schedule.versions.map((version) => Number(version.versionNumber || 0))) + 1;
  const version = await createStandardInclusionsVersion({
    workspaceId,
    userId,
    schedule,
    versionNumber: nextVersionNumber,
    fileName: sourceVersion.originalFilename || `version-${sourceVersion.versionNumber}.pdf`,
    buffer,
    source: "version-restore",
    pdfMetadata: sourceVersion.metadata?.pages ? { pageCount: sourceVersion.pageCount, pages: sourceVersion.metadata.pages } : null,
    extraMetadata: { restoredFromVersionId: sourceVersion.id, restoredFromVersionNumber: sourceVersion.versionNumber },
  });
  await setCurrentStandardInclusionsVersion({ workspaceId, userId, scheduleId, versionId: version.id });
  return loadStandardInclusionsSchedule({ workspaceId, scheduleId });
}

export async function archiveStandardInclusionsSchedule({ workspaceId, userId, scheduleId }) {
  const { data, error } = await supabaseAdmin
    .from(STANDARD_INCLUSIONS_SCHEDULES_TABLE)
    .update({ status: "archived", updated_by: userId, updated_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("id", scheduleId)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function setCurrentStandardInclusionsVersion({ workspaceId, userId, scheduleId, versionId }) {
  const { error } = await supabaseAdmin
    .from(STANDARD_INCLUSIONS_SCHEDULES_TABLE)
    .update({ current_version_id: versionId, updated_by: userId, updated_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("id", scheduleId);
  if (error) throw error;
}

async function createStandardInclusionsVersion({
  workspaceId,
  userId,
  schedule,
  versionNumber,
  fileName,
  buffer,
  source,
  pdfMetadata = null,
  extraMetadata = {},
}) {
  const metadata = pdfMetadata || await readPdfVersionMetadata(buffer);
  const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");
  const objectPath = `${userId}/standard-inclusions/${workspaceId}/${schedule.id}/versions/v${versionNumber}-${safeStandardInclusionsFileName(fileName)}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(STANDARD_INCLUSIONS_BUCKET)
    .upload(objectPath, buffer, { contentType: "application/pdf", upsert: false });
  if (uploadError) throw uploadError;
  const { data: urlData } = supabaseAdmin.storage.from(STANDARD_INCLUSIONS_BUCKET).getPublicUrl(objectPath);
  const { data, error } = await supabaseAdmin
    .from(STANDARD_INCLUSIONS_VERSIONS_TABLE)
    .insert({
      workspace_id: workspaceId,
      schedule_id: schedule.id,
      version_number: versionNumber,
      storage_bucket: STANDARD_INCLUSIONS_BUCKET,
      storage_path: objectPath,
      public_url: urlData?.publicUrl || "",
      original_filename: fileName || "standard-inclusions.pdf",
      page_count: metadata.pageCount,
      file_size_bytes: buffer.length,
      file_hash: fileHash,
      source,
      status: "active",
      metadata: {
        ...extraMetadata,
        pages: metadata.pages || [],
        pageOrder: (metadata.pages || []).map((page) => page.pageNumber),
        pageOrientation: (metadata.pages || []).map((page) => page.orientation),
        pageRotation: (metadata.pages || []).map((page) => page.rotation),
        pageSizes: (metadata.pages || []).map((page) => ({ width: page.width, height: page.height })),
      },
      created_by: userId,
    })
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return { ...shapeStandardInclusionsVersion(data), raw: data };
}
