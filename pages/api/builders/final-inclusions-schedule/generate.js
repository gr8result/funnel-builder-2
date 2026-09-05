import { readFile } from "node:fs/promises";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../../lib/withWorkspace";
import { createProjectInclusionsSnapshot } from "../../../../lib/builders/finalInclusionsSchedule.js";
import {
  FinalInclusionsPdfError,
  generateAndStoreFinalInclusionsPdf,
  generateAndStoreStandaloneFinalInclusionsPdf,
  validatePdfBytes,
} from "../../../../lib/builders/finalInclusionsPdfExecution.js";

const BUCKET = "assets";
const SELECTION_COLUMNS = "id, session_id, snapshot_id, category, subcategory, room, title, description, allowance_amount, selected_product_name, selected_supplier_name, selected_colour, selected_finish, selected_details, status, selected_at, metadata, created_at, updated_at, brand, product_name, model_number, image_url, specification_url, finish, colour, included_allowance, client_selection_price, calculated_client_selection_price, variation_amount, selection_status, is_active, approved_at, approved_by_name";
const SESSION_COLUMNS = "id, workspace_id, project_id, snapshot_id, session_name, original_estimate_total, private_upgrade_ceiling, current_net_selection_variation, current_updated_estimate_total, warning_threshold_percent, selection_budget_status, status, metadata, created_at, updated_at";

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const workspaceId = req.workspaceId;
    const projectId = String(req.body?.projectId || "").trim();
    const sessionId = String(req.body?.sessionId || "").trim();
    const snapshotId = String(req.body?.snapshotId || "").trim();
    const documentStatus = req.body?.documentStatus || req.body?.status || "draft";
    if (!projectId) return res.status(400).json({ ok: false, error: "projectId is required" });

    const { data: project, error: projectError } = await supabaseAdmin
      .from("builder_commercial_projects")
      .select("id, workspace_id, project_name, client_name, site_address, status, currency, original_estimate_total, contract_total, updated_at, created_at")
      .eq("workspace_id", workspaceId)
      .eq("id", projectId)
      .single();
    if (projectError || !project) throw projectError || new Error("Project not found.");

    const sessionQuery = supabaseAdmin
      .from("builder_selection_sessions")
      .select(SESSION_COLUMNS)
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1);
    const { data: sessions, error: sessionError } = sessionId
      ? await supabaseAdmin.from("builder_selection_sessions").select(SESSION_COLUMNS).eq("workspace_id", workspaceId).eq("id", sessionId).limit(1)
      : await sessionQuery;
    if (sessionError) throw sessionError;
    const session = sessions?.[0] || null;

    const effectiveSnapshotId = snapshotId || session?.snapshot_id || "";
    const { data: estimateSnapshot, error: snapshotError } = effectiveSnapshotId
      ? await supabaseAdmin
        .from("builder_estimate_snapshots")
        .select("id, workspace_id, project_id, snapshot_number, snapshot_label, status, source_quote_number, final_quote_total, created_at")
        .eq("workspace_id", workspaceId)
        .eq("id", effectiveSnapshotId)
        .maybeSingle()
      : { data: null, error: null };
    if (snapshotError) throw snapshotError;

    let selectionQuery = supabaseAdmin
      .from("builder_client_selections")
      .select(SELECTION_COLUMNS)
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false });
    const immutableSelectionSnapshot = req.body?.immutableSelectionSnapshot === true || req.body?.issuedSnapshot === true;
    if (immutableSelectionSnapshot && session?.id) selectionQuery = selectionQuery.eq("session_id", session.id);
    else if (immutableSelectionSnapshot && effectiveSnapshotId) selectionQuery = selectionQuery.eq("snapshot_id", effectiveSnapshotId);
    const { data: selections, error: selectionError } = await selectionQuery;
    if (selectionError) throw selectionError;

    const { data: latestApproval, error: approvalError } = await supabaseAdmin
      .from("builder_quote_approvals")
      .select("id, approval_number, approval_type, status, signer_name, signer_email, signed_at, document_url, document_hash, metadata, created_at")
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId)
      .eq("status", "approved")
      .order("signed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (approvalError) throw approvalError;

    const previousDocuments = await listPreviousFinalSchedules({ workspaceId, projectId });
    const standaloneClientSelectionsSchedule = req.body?.standaloneClientSelectionsSchedule !== false;
    const masterRef = standaloneClientSelectionsSchedule ? null : (req.body?.masterPdfRef || configuredPdfRef("FINAL_INCLUSIONS_MASTER_PDF", "standard-inclusions/_master/premier-inclusions-schedule.pdf"));
    const closingRef = standaloneClientSelectionsSchedule ? null : (req.body?.closingPdfRef || configuredPdfRef("FINAL_INCLUSIONS_CLOSING_PDF", "standard-inclusions/_master/final-inclusions-closing.pdf"));
    const masterPdf = masterRef ? await loadPdfSource(masterRef, { label: "master" }) : null;
    const closingPdf = closingRef ? await loadPdfSource(closingRef, { label: "closing" }) : null;
    const projectDetails = req.body?.projectDetails || {};
    const snapshotProject = {
      ...project,
      project_name: projectDetails.projectName || project.project_name,
      client_name: projectDetails.clientName || project.client_name,
      site_address: projectDetails.siteAddress || project.site_address,
      job_number: projectDetails.jobNumber || project.job_number,
      builder_name: projectDetails.builderName || project.builder_name,
      builder_logo_url: projectDetails.builderLogo || project.builder_logo_url,
      metadata: {
        ...(project.metadata || {}),
        builderName: projectDetails.builderName || project.metadata?.builderName,
        builderLogo: projectDetails.builderLogo || project.metadata?.builderLogo,
        phone: projectDetails.builderPhone || project.metadata?.phone,
        email: projectDetails.builderEmail || project.metadata?.email,
        scheduleVersion: projectDetails.scheduleVersion || project.metadata?.scheduleVersion,
        scheduleStatus: projectDetails.scheduleStatus || project.metadata?.scheduleStatus,
        datePrepared: projectDetails.datePrepared || project.metadata?.datePrepared,
      },
    };
    if (!hasClientDocumentProjectBinding(snapshotProject)) {
      return res.status(422).json({
        ok: false,
        error: "The active project details could not be loaded. Reconnect the Johnson job before generating this schedule.",
        code: "PROJECT_BINDING_REQUIRED",
      });
    }
    const snapshot = createProjectInclusionsSnapshot({
      project: snapshotProject,
      workspaceId,
      selections: selections || [],
      session: session || { id: "", project_id: projectId, snapshot_id: effectiveSnapshotId, status: "ready" },
      estimateSnapshot: estimateSnapshot || { id: effectiveSnapshotId },
      generatedBy: req.user?.id || "",
      documentStatus,
      previousDocuments,
      builderProfile: req.body?.builderProfile || req.body?.builder || {},
      preparedBy: req.body?.preparedBy || req.user?.email || req.user?.id || "",
      reviewedBy: req.body?.reviewedBy || "",
      approval: {
        ...(req.body?.approval || {}),
        clientName: req.body?.approval?.clientName || latestApproval?.signer_name || project.client_name || "",
        approvedAt: req.body?.approval?.approvedAt || latestApproval?.signed_at || "",
        approvalMethod: req.body?.approval?.approvalMethod || latestApproval?.metadata?.uiApprovalType || latestApproval?.approval_type || "",
        documentUrl: req.body?.approval?.documentUrl || latestApproval?.document_url || "",
        documentHash: req.body?.approval?.documentHash || latestApproval?.document_hash || "",
      },
      contractReference: req.body?.contractReference || "",
      revisionReason: req.body?.revisionReason || "",
      masterTemplate: standaloneClientSelectionsSchedule
        ? { id: "client-selections-schedule", version: "standalone", pageCount: 0 }
        : { id: "premier-inclusions-master", version: masterRef.version || "approved-pdf", pageCount: masterPdf.validation.pageCount },
      masterPdfRef: masterPdf ? { ...masterRef, pageCount: masterPdf.validation.pageCount, pages: masterPdf.validation.pages } : null,
      closingPdfRef: closingPdf ? { ...closingRef, pageCount: closingPdf.validation.pageCount, pages: closingPdf.validation.pages } : null,
    });

    const storage = createSupabaseFinalInclusionsStorage({ workspaceId, userId: req.user?.id || "", previousDocuments });
    const result = standaloneClientSelectionsSchedule
      ? await generateAndStoreStandaloneFinalInclusionsPdf({
        snapshot,
        previousDocuments,
        storage,
        generatedAt: new Date().toISOString(),
      })
      : await generateAndStoreFinalInclusionsPdf({
        snapshot,
        previousDocuments,
        masterPdfBytes: masterPdf.bytes,
        closingPdfBytes: closingPdf.bytes,
        storage,
        generatedAt: new Date().toISOString(),
      });

    return res.status(200).json({
      ok: true,
      document: result.document,
      projectEstimateDocument: result.projectEstimateDocument,
      pageCounts: result.merged.pageCounts,
      readiness: snapshot.readiness,
      warnings: result.dynamic.warnings,
      validation: result.merged.validation,
    });
  } catch (error) {
    const status = error instanceof FinalInclusionsPdfError ? 422 : 500;
    console.error("[final-inclusions-schedule/generate]", error);
    return res.status(status).json({
      ok: false,
      error: "Final selections schedule could not be generated.",
      code: error?.code || "GENERATION_FAILED",
      details: error?.details || { reason: error?.message || String(error) },
    });
  }
}

export default withWorkspace(handler);

function cleanClientDocumentText(value = "") {
  const next = String(value || "").trim();
  if (!next) return "";
  if (/^(undefined|null|not entered|missing|estimator missing|builder missing|address missing)$/i.test(next)) return "";
  if (/current\s*\.gr8job/i.test(next)) return "";
  return next;
}

function hasClientDocumentProjectBinding(project = {}) {
  return Boolean(
    cleanClientDocumentText(project.project_name)
    && cleanClientDocumentText(project.client_name)
    && cleanClientDocumentText(project.site_address)
    && cleanClientDocumentText(project.job_number || project.metadata?.jobNumber)
    && cleanClientDocumentText(project.builder_name || project.metadata?.builderName)
    && cleanClientDocumentText(project.builder_logo_url || project.metadata?.builderLogo)
  );
}

function configuredPdfRef(prefix, fallbackPath) {
  const localPath = process.env[`${prefix}_LOCAL_PATH`] || "";
  const storagePath = process.env[`${prefix}_STORAGE_PATH`] || `assets:${fallbackPath}`;
  return localPath ? { localPath, storagePath, version: "local-approved" } : { storagePath, version: "storage-approved" };
}

async function loadPdfSource(ref = {}, { label } = {}) {
  let bytes;
  if (ref.bytes) bytes = Buffer.from(ref.bytes);
  else if (ref.localPath) bytes = await readFile(ref.localPath);
  else if (ref.storagePath || ref.storage_path) {
    const storage = parseStoragePath(ref.storagePath || ref.storage_path);
    const { data, error } = await supabaseAdmin.storage.from(storage.bucket).download(storage.path);
    if (error) throw new FinalInclusionsPdfError(label === "master" ? "MISSING_MASTER_PDF" : "MISSING_CLOSING_PDF", "Final selections schedule could not be generated.", { label, storagePath: `${storage.bucket}:${storage.path}`, reason: error.message });
    bytes = Buffer.from(await data.arrayBuffer());
  }
  if (!bytes) throw new FinalInclusionsPdfError(label === "master" ? "MISSING_MASTER_PDF" : "MISSING_CLOSING_PDF", "Final selections schedule could not be generated.", { label, reason: "No PDF source was configured." });
  const validation = await validatePdfBytes(bytes, { label, expectedPageCount: ref.pageCount });
  return { bytes, validation };
}

function parseStoragePath(value = "") {
  const raw = String(value || "");
  const index = raw.indexOf(":");
  if (index > 0) return { bucket: raw.slice(0, index), path: raw.slice(index + 1) };
  return { bucket: BUCKET, path: raw.replace(/^\/+/, "") };
}

async function listPreviousFinalSchedules({ workspaceId, projectId }) {
  const { data, error } = await supabaseAdmin
    .from("builder_project_documents")
    .select("id, title, file_name, storage_path, public_url, document_type, metadata, status, created_at")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .eq("document_type", "selection")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []).filter((row) => row.metadata?.finalInclusionsSchedule === true);
}

function createSupabaseFinalInclusionsStorage({ workspaceId, userId, previousDocuments = [] }) {
  return {
    async savePdf({ document, bytes }) {
      const objectPath = String(document.storagePath || document.storage_path || "").replace(/^assets:/, "");
      if (!objectPath) throw new Error("Storage path was empty.");
      const { error } = await supabaseAdmin.storage.from(BUCKET).upload(objectPath, bytes, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(objectPath);
      return {
        storageBucket: BUCKET,
        storage_bucket: BUCKET,
        storagePath: `${BUCKET}:${objectPath}`,
        storage_path: `${BUCKET}:${objectPath}`,
        publicUrl: data?.publicUrl || "",
        public_url: data?.publicUrl || "",
      };
    },
    async registerDocument(document) {
      const previousIds = previousDocuments
        .filter((row) => {
          const immutable = row.metadata?.immutable === true || row.status === "issued" || row.metadata?.documentStatus === "contract";
          return !immutable && (row.status === "generated" || row.status === "active" || row.status === "draft" || row.status === "for_approval" || row.status === "approved");
        })
        .map((row) => row.id)
        .filter(Boolean);
      if (previousIds.length) {
        const { error: updateError } = await supabaseAdmin
          .from("builder_project_documents")
          .update({ status: "archived", updated_at: new Date().toISOString() })
          .in("id", previousIds);
        if (updateError) throw updateError;
      }
      const { data, error } = await supabaseAdmin
        .from("builder_project_documents")
        .insert({
          workspace_id: workspaceId,
          project_id: document.projectId,
          snapshot_id: /^[0-9a-f-]{36}$/i.test(document.estimateId || "") ? document.estimateId : null,
          document_type: "selection",
          title: document.title,
          description: "Generated Inclusions and Selections Schedule.",
          file_name: document.fileName,
          mime_type: "application/pdf",
          file_size_bytes: document.fileSizeBytes,
          storage_bucket: BUCKET,
          storage_path: document.storagePath,
          public_url: document.publicUrl,
          status: "active",
          metadata: document.metadata,
          uploaded_by: userId || null,
          created_by: userId || null,
          updated_by: userId || null,
        })
        .select("id, created_at")
        .single();
      if (error) throw error;
      return { id: data?.id || document.id, created_at: data?.created_at };
    },
    async markFailed(document, error) {
      await supabaseAdmin.from("builder_project_documents").insert({
        workspace_id: workspaceId,
        project_id: document.projectId,
        document_type: "selection",
        title: document.title || "Final Inclusions Schedule",
        file_name: document.fileName || "final-inclusions-schedule.pdf",
        status: "failed",
        metadata: {
          ...(document.metadata || {}),
          finalInclusionsSchedule: true,
          status: "failed",
          failure: error?.message || String(error),
        },
        created_by: userId || null,
        updated_by: userId || null,
      });
    },
  };
}
