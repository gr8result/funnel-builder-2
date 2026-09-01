import {
  DOCUMENT_CATEGORY_LABELS,
  SELECTION_STATUS_LABELS,
  VARIATION_STATUS_LABELS,
} from "./clientPortalData";
import {
  authorizePortalRequest,
  formatDate,
  getAuthenticatedUser,
  getPortalClients,
  getPortalSettings,
  getProject,
  recordPortalAudit,
  supabaseAdmin,
  toMoney,
} from "./serverShared";

function boolMeta(value, keys) {
  const metadata = value?.metadata || value?.source_metadata || {};
  return keys.some((key) => metadata?.[key] === true || value?.[key] === true);
}

function notHiddenMeta(value, keys) {
  const metadata = value?.metadata || value?.source_metadata || {};
  return keys.every((key) => metadata?.[key] !== false);
}

function mapDocument(document) {
  const metadata = document.metadata || {};
  return {
    id: document.id,
    name: document.title || document.file_name || "Untitled document",
    category: DOCUMENT_CATEGORY_LABELS[document.client_category || metadata.clientCategory || document.document_type] || "Other Shared Documents",
    version: document.client_version || metadata.version || metadata.clientVersion || "Current",
    issuedDate: formatDate(document.client_published_at || metadata.issuedDate || document.created_at),
    status: document.client_status || metadata.clientStatus || document.status || "active",
    viewUrl: document.public_url || "",
    downloadUrl: document.client_download_allowed === false ? "" : metadata.downloadUrl || document.public_url || "",
    requiresApproval: document.requires_client_approval === true || metadata.requiresClientApproval === true,
    requiresSignature: document.requires_client_signature === true || metadata.requiresClientSignature === true,
  };
}

function mapSelection(selection) {
  const metadata = selection.metadata || {};
  const rawStatus = selection.selection_status || selection.status || "pending";
  return {
    id: selection.id,
    category: selection.category || selection.subcategory || "Selection",
    selectedProduct: selection.product_name || selection.selected_product_name || metadata.productName || "Not selected",
    supplier: selection.supplier || metadata.supplier || "",
    colourFinish: selection.colour || selection.finish || metadata.colour || metadata.finish || "",
    imageUrl: selection.image_url || metadata.imageUrl || "",
    quantity: metadata.quantity || "",
    status: selection.client_status || metadata.clientStatus || SELECTION_STATUS_LABELS[rawStatus] || rawStatus,
    dueDate: formatDate(selection.required_by || metadata.dueDate),
    clientNotes: metadata.clientNotes || "",
    builderNotes: metadata.clientVisibleBuilderNotes || "",
    editable: metadata.clientOpen === true && !["approved", "locked"].includes(String(rawStatus).toLowerCase()),
  };
}

function mapVariation(variation, itemsByVariationId, currency) {
  const metadata = variation.metadata || {};
  const rawStatus = variation.status || "submitted";
  return {
    id: variation.id,
    number: variation.variation_number || "",
    title: variation.title || "Variation",
    description: metadata.clientDescription || variation.reason || "",
    dateIssued: formatDate(variation.submitted_at || variation.created_at),
    priceIncludingGst: toMoney(variation.total, currency),
    timeImpact: metadata.clientTimeImpact || metadata.timeImpact || "No time impact recorded",
    status: variation.client_status || metadata.clientStatus || VARIATION_STATUS_LABELS[rawStatus] || rawStatus,
    responseDeadline: formatDate(metadata.clientResponseDeadline),
    supportingItems: (itemsByVariationId.get(variation.id) || []).map((item) => ({
      id: item.id,
      description: item.metadata?.clientDescription || item.description,
    })),
  };
}

function mapApproval(approval, currency) {
  const metadata = approval.metadata || {};
  return {
    id: approval.id,
    item: approval.approval_number || metadata.title || "Approval required",
    type: approval.approval_type || "other",
    dateIssued: formatDate(approval.created_at),
    dueDate: formatDate(metadata.clientDueDate),
    status: metadata.clientStatus || approval.status || "pending",
    amount: toMoney(approval.approved_amount, currency),
    viewUrl: approval.document_url || "",
  };
}

function mapProgress(tasks = []) {
  return tasks
    .filter((task) => boolMeta(task, ["clientVisible", "client_visible", "clientPublished"]))
    .map((task) => ({
      id: task.id,
      title: task.name || task.task_name || "Project update",
      stage: task.phase || task.status || "",
      status: task.status || "",
      progress: Number(task.progress_percent || 0),
      expectedDate: formatDate(task.client_expected_date || task.metadata?.expectedDate || task.updated_at),
      update: task.client_update || task.metadata?.clientUpdate || "",
    }));
}

export default async function clientPortalProjectHandler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const auth = await getAuthenticatedUser(req);
  if (auth.error) return res.status(auth.status).json({ ok: false, error: auth.error });

  const projectId = String(req.query.projectId || "").trim();
  const requestedWorkspaceId = String(req.query.workspace_id || "").trim();
  const requestedMode = String(req.query.mode || "client").trim();
  if (!projectId) return res.status(400).json({ ok: false, error: "projectId is required" });

  const { project, error: projectError } = await getProject(projectId);

  if (projectError) return res.status(500).json({ ok: false, error: projectError.message || "Could not load project." });
  if (!project) return res.status(404).json({ ok: false, error: "Project not found." });

  const access = await authorizePortalRequest({ project, user: auth.user, requestedWorkspaceId, requestedMode });
  if (!access.allowed) return res.status(access.status).json({ ok: false, error: access.error });
  if (access.access === "client") {
    const now = new Date().toISOString();
    if (access.client?.id) {
      await supabaseAdmin
        .from("client_portal_clients")
        .update({ last_login_at: now })
        .eq("id", access.client.id);
    }
    await supabaseAdmin
      .from("client_portal_settings")
      .update({ last_client_login_at: now })
      .eq("workspace_id", project.workspace_id)
      .eq("project_id", project.id);
    await recordPortalAudit({
      workspaceId: project.workspace_id,
      projectId: project.id,
      userId: auth.user.id,
      userRole: "client",
      action: "client_login",
    });
  }

  const [{ settings }, { clients }] = await Promise.all([
    getPortalSettings(project.workspace_id, project.id),
    getPortalClients(project.workspace_id, project.id),
  ]);

  const [documentsResult, selectionsResult, variationsResult, variationItemsResult, quoteApprovalsResult, portalApprovalsResult, progressResult, messagesResult] = await Promise.all([
    supabaseAdmin
      .from("builder_project_documents")
      .select("id, document_type, title, description, file_name, public_url, status, metadata, client_visible, client_category, client_version, client_published_at, requires_client_approval, requires_client_signature, client_download_allowed, client_status, created_at")
      .eq("workspace_id", project.workspace_id)
      .eq("project_id", project.id)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("builder_client_selections")
      .select("id, category, subcategory, supplier, product_name, selected_product_name, colour, finish, image_url, required_by, status, selection_status, client_visible, client_status, metadata, created_at")
      .eq("workspace_id", project.workspace_id)
      .eq("project_id", project.id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("builder_variations")
      .select("id, variation_number, title, reason, status, total, submitted_at, approved_at, client_visible, client_status, requires_client_approval, metadata, created_at")
      .eq("workspace_id", project.workspace_id)
      .eq("project_id", project.id)
      .neq("status", "draft")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("builder_variation_items")
      .select("id, variation_id, description, status, metadata")
      .eq("workspace_id", project.workspace_id)
      .eq("project_id", project.id)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("builder_quote_approvals")
      .select("id, approval_number, approval_type, status, approved_amount, document_url, metadata, created_at")
      .eq("workspace_id", project.workspace_id)
      .eq("project_id", project.id)
      .neq("status", "void")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("client_portal_approvals")
      .select("id, item_title, approval_type, date_issued, due_date, status, view_url, allow_reject, requires_signature, response_comment, response_name, responded_at, metadata, created_at")
      .eq("workspace_id", project.workspace_id)
      .eq("project_id", project.id)
      .neq("status", "superseded")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("gantt_tasks")
      .select("id, name, phase, status, progress_percent, client_visible, client_update, client_expected_date, updated_at")
      .eq("project_id", project.id)
      .order("updated_at", { ascending: false }),
    supabaseAdmin
      .from("client_portal_messages")
      .select("id, parent_message_id, sender_user_id, sender_name, sender_role, body, attachments, read_by, created_at")
      .eq("workspace_id", project.workspace_id)
      .eq("project_id", project.id)
      .eq("status", "sent")
      .order("created_at", { ascending: true }),
  ]);

  const errors = [documentsResult, selectionsResult, variationsResult, variationItemsResult, quoteApprovalsResult, portalApprovalsResult, progressResult, messagesResult]
    .map((result) => result.error)
    .filter(Boolean);
  if (errors.length) return res.status(500).json({ ok: false, error: errors[0].message || "Could not load portal data." });

  const visibleDocuments = (documentsResult.data || [])
    .filter((document) => boolMeta(document, ["clientVisible", "client_visible", "visibleInClientPortal"]))
    .map(mapDocument);
  const visibleSelections = (selectionsResult.data || [])
    .filter((selection) => boolMeta(selection, ["clientVisible", "client_visible", "clientPublished"]))
    .map(mapSelection);
  const visibleVariations = (variationsResult.data || [])
    .filter((variation) => boolMeta(variation, ["clientVisible", "client_visible", "clientPublished"]) && notHiddenMeta(variation, ["internalOnly"]))
    .map((variation) => {
      const itemsByVariationId = new Map();
      (variationItemsResult.data || [])
        .filter((item) => item.variation_id === variation.id && notHiddenMeta(item, ["internalOnly"]))
        .forEach((item) => {
          const rows = itemsByVariationId.get(item.variation_id) || [];
          rows.push(item);
          itemsByVariationId.set(item.variation_id, rows);
        });
      return mapVariation(variation, itemsByVariationId, project.currency || "AUD");
    });
  const visibleQuoteApprovals = (quoteApprovalsResult.data || [])
    .filter((approval) => boolMeta(approval, ["clientVisible", "client_visible", "requiresClientApproval"]))
    .map((approval) => mapApproval(approval, project.currency || "AUD"));
  const visiblePortalApprovals = (portalApprovalsResult.data || []).map((approval) => ({
    id: approval.id,
    item: approval.item_title,
    type: approval.approval_type,
    dateIssued: formatDate(approval.date_issued || approval.created_at),
    dueDate: formatDate(approval.due_date),
    status: approval.status,
    amount: "",
    viewUrl: approval.view_url || "",
    allowReject: approval.allow_reject !== false,
    requiresSignature: approval.requires_signature === true,
    responseComment: approval.response_comment || "",
    responseName: approval.response_name || "",
    respondedAt: formatDate(approval.responded_at),
  }));

  const portalSettings = settings || {};
  const visibility = portalSettings.visibility || {};
  const enabledSections = portalSettings.enabled_sections || {};
  const projectMetadata = project.source_metadata || {};
  return res.status(200).json({
    ok: true,
    mode: access.mode,
    access: access.access,
    project: {
      id: project.id,
      workspaceId: project.workspace_id,
      name: project.project_name || "Project",
      number: project.source_quote_number || projectMetadata.projectNumber || projectMetadata.project_number || "",
      clientName: project.client_name || clients?.[0]?.client_name || "Client",
      clientEmail: access.access === "builder" ? project.client_email || "" : "",
      address: project.site_address || "",
      status: project.status || "",
      stage: visibility.currentStage === false ? "" : portalSettings.content?.currentStage || projectMetadata.currentStage || "Not yet provided.",
      commencementDate: visibility.commencementDate ? formatDate(portalSettings.content?.commencementDate || projectMetadata.commencementDate) : "",
      estimatedCompletionDate: visibility.completionDate ? formatDate(portalSettings.content?.estimatedCompletionDate || projectMetadata.estimatedCompletionDate) : "",
      supervisor: visibility.supervisorDetails ? portalSettings.content?.supervisor || projectMetadata.siteSupervisor || "" : "",
      builderContact: visibility.supervisorDetails ? portalSettings.content?.builderContact || projectMetadata.builderContact || "" : "",
      showProgressPercentage: visibility.progressPercentage !== false,
      showUpcomingMilestones: visibility.upcomingMilestones === true,
      showContractValue: visibility.contractValue === true,
      contractValue: visibility.contractValue ? toMoney(project.contract_total, project.currency || "AUD") : "",
      updatedAt: formatDate(project.updated_at),
    },
    builder: {
      companyName: portalSettings.branding?.builderName || projectMetadata.builderName || "Builder",
      logoUrl: portalSettings.branding?.logoUrl || projectMetadata.builderLogoUrl || "",
      accentColor: portalSettings.branding?.accentColor || "#0f766e",
    },
    settings: {
      id: portalSettings.id || "",
      portalEnabled: portalSettings.portal_enabled === true,
      accessSuspended: portalSettings.access_suspended === true,
      status: portalSettings.status || "not_set_up",
      enabledSections,
      visibility,
      lastInvitationSentAt: formatDate(portalSettings.last_invitation_sent_at),
      lastClientLoginAt: formatDate(portalSettings.last_client_login_at),
    },
    clients: (clients || []).map((client) => ({
      id: client.id,
      name: client.client_name,
      email: access.access === "builder" ? client.client_email : "",
      status: client.status,
      lastInvitationSentAt: formatDate(client.last_invitation_sent_at),
      lastLoginAt: formatDate(client.last_login_at),
    })),
    documents: enabledSections.documents === false ? [] : visibleDocuments,
    selections: enabledSections.selections === false ? [] : visibleSelections,
    variations: enabledSections.variations === false ? [] : visibleVariations,
    approvals: enabledSections.approvals === false ? [] : [...visiblePortalApprovals, ...visibleQuoteApprovals],
    progress: enabledSections.progress === false ? [] : mapProgress(progressResult.data || []),
    messages: enabledSections.messages === false ? [] : (messagesResult.data || []).map((message) => ({
      id: message.id,
      parentId: message.parent_message_id || "",
      senderName: message.sender_name || "Unknown",
      senderRole: message.sender_role || "client",
      body: message.body || "",
      attachments: Array.isArray(message.attachments) ? message.attachments : [],
      createdAt: formatDate(message.created_at),
      unread: !message.read_by?.[auth.user.id],
    })),
  });
}
