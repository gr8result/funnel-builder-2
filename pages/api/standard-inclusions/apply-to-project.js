import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";
import { loadStandardInclusionsSchedule } from "../../../lib/standard-inclusions/pdfLibrary";
import { isInclusionsDraftApprovable } from "../../../lib/standard-inclusions/productProposal.mjs";
import { buildStandardInclusionsQuotationSeed } from "../../../lib/standard-inclusions/quotationSeed.mjs";
import { buildJobInclusionSnapshot } from "../../../lib/standard-inclusions/jobBaseline.mjs";

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }
  const scheduleId = String(req.body?.scheduleId || "").trim();
  const projectId = String(req.body?.projectId || "").trim();
  if (!scheduleId || !projectId) return res.status(400).json({ ok: false, error: "Schedule and project are required." });

  try {
    const { data: project, error: projectError } = await supabaseAdmin
      .from("builder_commercial_projects")
      .select("id,workspace_id,project_name,client_name,site_address,status")
      .eq("id", projectId)
      .eq("workspace_id", req.workspaceId)
      .maybeSingle();
    if (projectError) return res.status(503).json({ ok: false, error: "Project could not be verified in this workspace." });
    if (!project) return res.status(404).json({ ok: false, error: "Project not found in this workspace." });

    const schedule = await loadStandardInclusionsSchedule({ workspaceId: req.workspaceId, scheduleId });
    if (!schedule || schedule.status !== "active") return res.status(404).json({ ok: false, error: "Schedule not found in this workspace." });
    const workflowStatus = schedule.metadata?.workflowStatus || schedule.metadata?.inclusionsDraft?.status || "Draft";
    const draft = schedule.metadata?.inclusionsDraft || {};
    if (!["Approved", "Published"].includes(workflowStatus) || !isInclusionsDraftApprovable(draft)) {
      return res.status(409).json({ ok: false, error: "Only a fully reviewed and approved schedule can be applied to a project." });
    }
    if (!schedule.currentVersion) return res.status(409).json({ ok: false, error: "Publish a brochure PDF version before applying this schedule to a project." });

    const { data: existingDocuments, error: documentLookupError } = await supabaseAdmin
      .from("builder_project_documents")
      .select("id,title,metadata")
      .eq("workspace_id", req.workspaceId)
      .eq("project_id", projectId)
      .eq("document_type", "other")
      .eq("status", "active")
      .limit(100);
    if (documentLookupError) return res.status(503).json({ ok: false, error: "Existing project inclusions could not be checked." });
    const existingInclusions = (existingDocuments || []).filter((row) => {
      const metadata = row.metadata || {};
      return metadata.source === "project_inclusions_assignment"
        || ["standard_inclusions", "project_specific_inclusions", "modified_inclusions"].includes(String(metadata.sourceType || ""));
    });
    const sameVersion = existingInclusions.find((row) => row.metadata?.scheduleId === schedule.id && row.metadata?.scheduleVersionId === schedule.currentVersion.id);
    if (sameVersion) {
      // Repeated Apply clicks (or a retry after a lost response) never create a second document.
      return res.status(200).json({ ok: true, alreadyApplied: true, project, document: sameVersion, scheduleSnapshot: sameVersion.metadata?.standardScheduleSnapshot || null });
    }
    if (existingInclusions.length) {
      return res.status(409).json({
        ok: false,
        code: "PROJECT_INCLUSIONS_ALREADY_ASSIGNED",
        error: "This project already has active inclusions. No quotation or project document was changed.",
        existing: existingInclusions.map((row) => ({ id: row.id, title: row.title })),
      });
    }

    let jobInclusionSnapshot;
    try {
      jobInclusionSnapshot = buildJobInclusionSnapshot({ workspaceId: req.workspaceId, schedule });
    } catch (snapshotError) {
      return res.status(409).json({ ok: false, code: snapshotError.code || "SNAPSHOT_MISSING", error: snapshotError.message });
    }
    const publishedSnapshot = (schedule.metadata?.publishedSnapshots || []).find((snapshot) => snapshot.versionId === schedule.currentVersion.id);
    const approvedSnapshot = {
      schemaVersion: 1,
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      tierKey: schedule.tierKey || "",
      scheduleVersionId: schedule.currentVersion.id,
      scheduleVersion: schedule.currentVersion.versionNumber,
      sourceWorkspaceId: req.workspaceId,
      sourceFileName: schedule.currentVersion.originalFilename,
      branding: publishedSnapshot.branding || {},
      includedFields: publishedSnapshot.includedFields || {},
      categories: draft.categories || [],
      items: publishedSnapshot.items,
      jobInclusionSnapshot,
      approvedAt: schedule.updatedAt,
      attachedAt: new Date().toISOString(),
    };
    const quotationSeed = buildStandardInclusionsQuotationSeed(approvedSnapshot);
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("builder_project_documents")
      .insert({
        workspace_id: req.workspaceId,
        project_id: projectId,
        document_type: "other",
        title: `${schedule.name} — Approved Inclusions v${schedule.currentVersion.versionNumber}`,
        description: `Approved ${schedule.tierKey || "builder"} inclusions schedule.`,
        file_name: schedule.currentVersion.originalFilename || `${schedule.name}.pdf`,
        mime_type: "application/pdf",
        file_size_bytes: schedule.currentVersion.fileSize || null,
        storage_bucket: schedule.currentVersion.storageBucket,
        storage_path: `${schedule.currentVersion.storageBucket}:${schedule.currentVersion.storagePath}`,
        public_url: schedule.currentVersion.publicUrl,
        related_table: "standard_inclusions_schedules",
        related_record_id: schedule.id,
        status: "active",
        metadata: {
          source: "project_inclusions_assignment",
          sourceType: "standard_inclusions",
          assignmentType: "approved_schedule",
          projectId,
          scheduleId: schedule.id,
          scheduleVersionId: schedule.currentVersion.id,
          scheduleVersion: schedule.currentVersion.versionNumber,
          standardScheduleSnapshot: approvedSnapshot,
          quotationSeed,
          active: true,
          assignedAt: new Date().toISOString(),
        },
        uploaded_by: req.user.id,
        created_by: req.user.id,
        updated_by: req.user.id,
      })
      .select("id,title,project_id,workspace_id,status,metadata,created_at")
      .single();
    if (insertError?.code === "23505") {
      return res.status(409).json({ ok: false, code: "STANDARD_SCHEDULE_ALREADY_APPLIED", error: "This schedule is already attached to this project. No duplicate was created." });
    }
    if (insertError) throw insertError;
    return res.status(201).json({ ok: true, project, document: inserted, scheduleSnapshot: approvedSnapshot, quotationSeed });
  } catch (error) {
    console.error("Standard Inclusions project assignment failed:", error?.message || error);
    return res.status(500).json({ ok: false, error: error?.message || "Could not apply the approved schedule." });
  }
}

export default withWorkspace(handler, { roles: ["owner", "admin", "marketing"], authTimeoutMs: 8000 });
