import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
};

const TABLES = {
  projects: "builder_commercial_projects",
  snapshots: "builder_estimate_snapshots",
  sections: "builder_boq_sections",
  items: "builder_boq_items",
  procurement: "builder_procurement_items",
};

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const workspaceId = req.workspaceId;
    const body = req.body || {};
    const workbook = plainObject(body.workbook);
    const calculated = plainObject(body.calculated || body.calculatedWorkbookResult || body.preview);
    const projectInput = plainObject(body.project || body.projectMetadata || body.job || body.jobMetadata);

    if (!Object.keys(workbook).length) {
      return res.status(400).json({ ok: false, error: "workbook is required" });
    }
    const quotation = plainObject(calculated.quotation);
    if (!Object.keys(calculated).length || !Object.keys(quotation).length) {
      return res.status(400).json({ ok: false, error: "calculated workbook result with quotation is required" });
    }

    const project = await createOrUpdateCommercialProject({
      workspaceId,
      userId: req.user.id,
      projectInput,
      workbook,
      calculated,
      requestedProjectId: firstText(body.commercial_project_id, body.commercialProjectId, body.project_id),
    });

    const snapshot = await createEstimateSnapshot({
      workspaceId,
      userId: req.user.id,
      projectId: project.id,
      projectInput,
      workbook,
      calculated,
    });

    const sectionRows = buildBoqSectionRows({
      workspaceId,
      userId: req.user.id,
      projectId: project.id,
      snapshotId: snapshot.id,
      calculated,
    });

    const sectionMap = await insertBoqSections(sectionRows);

    const boqRows = buildBoqItemRows({
      workspaceId,
      userId: req.user.id,
      projectId: project.id,
      snapshotId: snapshot.id,
      calculated,
      sectionMap,
    });

    const insertedBoqItems = await insertRows(TABLES.items, boqRows);
    const boqItemMap = new Map(
      (insertedBoqItems || [])
        .filter((row) => row.source_quote_row_id)
        .map((row) => [row.source_quote_row_id, row.id])
    );

    const procurementRows = buildProcurementRows({
      workspaceId,
      userId: req.user.id,
      projectId: project.id,
      snapshotId: snapshot.id,
      workbook,
      boqItemMap,
    });

    const insertedProcurementItems = await insertRows(TABLES.procurement, procurementRows);

    return res.status(200).json({
      ok: true,
      project_id: project.id,
      snapshot_id: snapshot.id,
      counts: {
        boq_sections: sectionRows.length,
        boq_items: boqRows.length,
        procurement_items: procurementRows.length,
      },
      data: {
        project,
        snapshot,
        boq_sections: sectionRows.length,
        boq_items: insertedBoqItems?.length || 0,
        procurement_items: insertedProcurementItems?.length || 0,
      },
    });
  } catch (error) {
    console.error("[builders/sync-commercial-snapshot]", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Could not sync commercial snapshot",
    });
  }
}

export default withWorkspace(handler);

async function createOrUpdateCommercialProject({
  workspaceId,
  userId,
  projectInput,
  workbook,
  calculated,
  requestedProjectId,
}) {
  const summary = plainObject(calculated.summary);
  const source = projectSourceFields(projectInput, workbook);
  const now = new Date().toISOString();
  const payload = {
    workspace_id: workspaceId,
    existing_project_id: uuidOrNull(projectInput.existing_project_id || projectInput.existingProjectId),
    existing_project_table: firstText(projectInput.existing_project_table, projectInput.existingProjectTable) || "projects",
    source_workbook_job_id: source.source_workbook_job_id,
    source_workbook_file_name: source.source_workbook_file_name,
    source_registered_job_id: source.source_registered_job_id,
    source_quote_number: source.source_quote_number,
    project_name: source.project_name,
    client_name: source.client_name,
    client_email: source.client_email,
    client_phone: source.client_phone,
    site_address: source.site_address,
    status: allowed(projectInput.status, ["draft", "active", "on_hold", "completed", "cancelled", "archived"]) || "active",
    original_estimate_total: moneyNumber(summary.finalQuoteTotal),
    contract_total: moneyNumber(summary.finalQuoteTotal),
    currency: firstText(projectInput.currency, workbook.currency) || "AUD",
    source_metadata: stripLargeFields({
      project: projectInput,
      workbook: {
        id: workbook.id,
        jobFileMeta: workbook.jobFileMeta,
        registeredJob: workbook.registeredJob,
        openedFileName: workbook.openedFileName,
        sourceFileName: workbook.sourceFileName,
        templateKey: workbook.templateKey,
        templateName: workbook.templateName,
        savedAt: workbook.savedAt,
      },
    }),
    notes: firstText(projectInput.notes, workbook.jobFileMeta?.notes),
    updated_by: userId,
    updated_at: now,
  };

  const existing = await findExistingProject(workspaceId, requestedProjectId, payload);
  if (existing?.id) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.projects)
      .update(payload)
      .eq("workspace_id", workspaceId)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(`Could not update commercial project: ${error.message}`);
    return data;
  }

  const { data, error } = await supabaseAdmin
    .from(TABLES.projects)
    .insert({ ...payload, created_by: userId })
    .select("*")
    .single();
  if (error) throw new Error(`Could not create commercial project: ${error.message}`);
  return data;
}

async function findExistingProject(workspaceId, requestedProjectId, payload) {
  if (requestedProjectId) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.projects)
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("id", requestedProjectId)
      .maybeSingle();
    if (error) throw new Error(`Could not find commercial project: ${error.message}`);
    if (data) return data;
  }

  if (payload.existing_project_id) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.projects)
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("existing_project_table", payload.existing_project_table || "projects")
      .eq("existing_project_id", payload.existing_project_id)
      .maybeSingle();
    if (error) throw new Error(`Could not find project by existing project id: ${error.message}`);
    if (data) return data;
  }

  if (payload.source_registered_job_id) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.projects)
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("source_registered_job_id", payload.source_registered_job_id)
      .maybeSingle();
    if (error) throw new Error(`Could not find project by registered job id: ${error.message}`);
    if (data) return data;
  }

  if (payload.source_workbook_job_id) {
    const { data, error } = await supabaseAdmin
      .from(TABLES.projects)
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("source_workbook_job_id", payload.source_workbook_job_id)
      .maybeSingle();
    if (error) throw new Error(`Could not find project by workbook job id: ${error.message}`);
    if (data) return data;
  }

  return null;
}

async function createEstimateSnapshot({ workspaceId, userId, projectId, projectInput, workbook, calculated }) {
  const summary = plainObject(calculated.summary);
  const source = projectSourceFields(projectInput, workbook);
  const snapshotNumber = await nextSnapshotNumber(workspaceId, projectId);
  const payload = {
    workspace_id: workspaceId,
    project_id: projectId,
    snapshot_number: snapshotNumber,
    snapshot_label: firstText(projectInput.snapshot_label, projectInput.snapshotLabel) || `Snapshot ${snapshotNumber}`,
    status: "current",
    source_workbook_job_id: source.source_workbook_job_id,
    source_workbook_file_name: source.source_workbook_file_name,
    source_registered_job_id: source.source_registered_job_id,
    source_quote_number: source.source_quote_number,
    source_quote_date: dateOrNull(workbook.clientPage?.quoteDate || projectInput.quoteDate),
    source_quote_version: firstText(projectInput.quoteVersion, workbook.quoteVersion),
    source_template_key: firstText(workbook.templateKey, projectInput.templateKey),
    source_template_name: firstText(workbook.templateName, projectInput.templateName),
    summary,
    workbook_metadata: stripLargeFields({
      jobFileMeta: workbook.jobFileMeta,
      registeredJob: workbook.registeredJob,
      openedFileName: workbook.openedFileName,
      sourceFileName: workbook.sourceFileName,
      savedAt: workbook.savedAt,
      templateKey: workbook.templateKey,
      templateName: workbook.templateName,
      clientPage: workbook.clientPage,
    }),
    workbook_snapshot: workbook,
    base_line_item_subtotal: moneyNumber(summary.baseLineItemSubtotal ?? summary.subtotalBeforeMargin),
    preliminaries_total: moneyNumber(summary.preliminaryCostsAmount),
    overheads_total: moneyNumber(summary.overheadsAmount),
    margin_total: moneyNumber(summary.marginAmount),
    profit_total: moneyNumber(summary.profitAmount),
    gst_total: moneyNumber(summary.gst),
    fees_total: moneyNumber(summary.qbsaRegistration) + moneyNumber(summary.qLeaveFees),
    sales_commission_total: moneyNumber(summary.salesCommissionAmount),
    final_quote_total: moneyNumber(summary.finalQuoteTotal),
    created_by: userId,
  };

  await supabaseAdmin
    .from(TABLES.snapshots)
    .update({ status: "superseded" })
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .eq("status", "current");

  const { data, error } = await supabaseAdmin
    .from(TABLES.snapshots)
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new Error(`Could not create estimate snapshot: ${error.message}`);
  return data;
}

async function nextSnapshotNumber(workspaceId, projectId) {
  const { data, error } = await supabaseAdmin
    .from(TABLES.snapshots)
    .select("snapshot_number")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("snapshot_number", { ascending: false })
    .limit(1);
  if (error) throw new Error(`Could not load snapshot number: ${error.message}`);
  return Number(data?.[0]?.snapshot_number || 0) + 1;
}

function buildBoqSectionRows({ workspaceId, userId, projectId, snapshotId, calculated }) {
  return Object.entries(plainObject(calculated.quotation)).map(([sectionKey, section], index) => ({
    workspace_id: workspaceId,
    project_id: projectId,
    snapshot_id: snapshotId,
    source_section_key: sectionKey,
    source_section_name: firstText(section.displayName, section.name, sectionKey),
    display_name: firstText(section.displayName, section.name, sectionKey),
    section_number: firstText(section.sectionNumber, section.number) || String(index + 1),
    sort_order: index,
    subtotal: moneyNumber(section.subtotal),
    status: "active",
    metadata: stripLargeFields({
      collapsed: section.collapsed,
      columns: section.columns,
      workbookSummaryValue: section.workbookSummaryValue,
    }),
    created_by: userId,
  }));
}

async function insertBoqSections(sectionRows) {
  const inserted = await insertRows(TABLES.sections, sectionRows);
  return new Map((inserted || []).map((row) => [row.source_section_key, row.id]));
}

function buildBoqItemRows({ workspaceId, userId, projectId, snapshotId, calculated, sectionMap }) {
  const rows = [];
  Object.entries(plainObject(calculated.quotation)).forEach(([sectionKey, section], sectionIndex) => {
    const sectionId = sectionMap.get(sectionKey) || null;
    (Array.isArray(section.rows) ? section.rows : []).forEach((row, rowIndex) => {
      const sourceQuoteRowId = firstText(row.id, row.quoteRowId, row.sourceRow, row.excelRow);
      rows.push({
        workspace_id: workspaceId,
        project_id: projectId,
        snapshot_id: snapshotId,
        section_id: sectionId,
        source_quote_row_id: sourceQuoteRowId,
        source_excel_row: textOrNull(row.excelRow ?? row.sourceRow),
        source_section_key: sectionKey,
        source_section_name: firstText(row.section, section.displayName, sectionKey),
        item_name: firstText(row.item, row.description, row.values?.[0]) || "Untitled line item",
        description: firstText(row.description, row.item, row.values?.[0]),
        quantity: decimalNumber(row.qty ?? row.quantity ?? row.importedQuantity),
        unit: textOrNull(row.unit),
        unit_rate: decimalNumber(row.finalRateUsed ?? row.manualRate ?? row.supplierQuote ?? row.quotedSupplierRate ?? row.supplierCatalogueRate ?? row.excelRate),
        line_total: moneyNumber(row.cost ?? row.importedCost),
        rate_source: textOrNull(row.sourceOfRate),
        line_type: textOrNull(row.lineType),
        sort_order: sectionIndex * 10000 + rowIndex,
        status: boqItemStatus(row),
        source_row: stripLargeFields(row),
        metadata: stripLargeFields({
          quantityKey: row.quantityKey,
          autoQuantity: row.autoQuantity,
          quoteRequired: row.quoteRequired,
          feeType: row.feeType,
          inactiveReason: row.inactiveReason,
          notes: row.notes,
          formulas: row.formulas,
        }),
        created_by: userId,
      });
    });
  });
  return rows;
}

function buildProcurementRows({ workspaceId, userId, projectId, snapshotId, workbook, boqItemMap }) {
  const items = Array.isArray(workbook.procurement?.items) ? workbook.procurement.items : [];
  return items.map((item) => {
    const sourceQuoteRowId = firstText(item.quoteRowId, item.source_quote_row_id, item.linkedQuoteRowId);
    return {
      workspace_id: workspaceId,
      project_id: projectId,
      snapshot_id: snapshotId,
      boq_item_id: sourceQuoteRowId ? boqItemMap.get(sourceQuoteRowId) || null : null,
      source_quote_row_id: sourceQuoteRowId,
      source_procurement_item_id: firstText(item.id, item.procurementItemId),
      item_name: firstText(item.itemDescription, item.description, item.item_name) || "Untitled procurement item",
      description: firstText(item.description, item.itemDescription),
      section_name: firstText(item.sectionName, item.section),
      procurement_category: firstText(item.procurementCategory, item.category),
      quantity: decimalNumber(item.qty ?? item.quantity),
      unit: textOrNull(item.unit),
      estimated_rate: decimalNumber(item.estimatedRate),
      estimated_total: moneyNumber(item.estimatedTotal),
      required_by: dateOrNull(item.requiredByDate),
      order_by: dateOrNull(item.orderByDate),
      order_status: normaliseStatus(firstText(item.orderStatus), "not_started"),
      delivery_status: normaliseStatus(firstText(item.deliveryStatus), "not_required_yet"),
      status: item.removedFromQuote ? "removed_from_quote" : "active",
      source_item: stripLargeFields(item),
      metadata: stripLargeFields({
        supplier: item.supplier,
        supplierQuoteNumber: item.supplierQuoteNumber,
        assignedPurchasingOfficer: item.assignedPurchasingOfficer,
        notes: item.notes,
      }),
      created_by: userId,
      updated_by: userId,
    };
  });
}

async function insertRows(table, rows) {
  if (!rows.length) return [];
  const { data, error } = await supabaseAdmin.from(table).insert(rows).select("*");
  if (error) throw new Error(`Could not insert ${table}: ${error.message}`);
  return data || [];
}

function projectSourceFields(projectInput, workbook) {
  const meta = plainObject(workbook.jobFileMeta);
  const registered = plainObject(workbook.registeredJob);
  const clientPage = plainObject(workbook.clientPage);
  return {
    source_workbook_job_id: firstText(projectInput.source_workbook_job_id, projectInput.sourceWorkbookJobId, workbook.id, workbook.jobId, meta.jobNumber),
    source_workbook_file_name: firstText(projectInput.source_workbook_file_name, projectInput.sourceWorkbookFileName, workbook.openedFileName, workbook.sourceFileName),
    source_registered_job_id: firstText(projectInput.source_registered_job_id, projectInput.sourceRegisteredJobId, registered.jobId, workbook.registeredJobId),
    source_quote_number: firstText(projectInput.source_quote_number, projectInput.quoteNumber, clientPage.quoteNumber, meta.jobNumber),
    project_name: firstText(projectInput.project_name, projectInput.projectName, projectInput.jobName, meta.jobName, registered.jobName, workbook.projectName, workbookDataValue(workbook, "projectName")) || "Estimate Builder Project",
    client_name: firstText(projectInput.client_name, projectInput.clientName, meta.clientName, registered.clientName, clientPage.clientName, workbookDataValue(workbook, "clientName"), workbookDataValue(workbook, "customerName")),
    client_email: firstText(projectInput.client_email, projectInput.clientEmail, registered.clientEmail),
    client_phone: firstText(projectInput.client_phone, projectInput.clientPhone, registered.clientPhone),
    site_address: firstText(projectInput.site_address, projectInput.siteAddress, projectInput.address, meta.address, registered.siteAddress, clientPage.projectAddress, workbookDataValue(workbook, "siteAddress"), workbookDataValue(workbook, "address")),
  };
}

function workbookDataValue(workbook, key) {
  for (const section of Object.values(plainObject(workbook.data))) {
    const value = section?.rows?.[key]?.value;
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function boqItemStatus(row) {
  if (row.active === false || row.lineType === "Excluded item") return "excluded";
  if (row.quoteRequired || row.lineType === "Quote required") return "quote_required";
  return "active";
}

function allowed(value, values) {
  const text = String(value || "").trim();
  return values.includes(text) ? text : "";
}

function normaliseStatus(value, fallback) {
  const text = String(value || fallback || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return text || fallback;
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stripLargeFields(value) {
  if (!value || typeof value !== "object") return {};
  return JSON.parse(JSON.stringify(value, (_key, item) => {
    if (typeof item === "string" && item.length > 250000) return `${item.slice(0, 250000)}...`;
    return item;
  }));
}

function firstText(...values) {
  for (const value of values) {
    const text = textOrNull(value);
    if (text) return text;
  }
  return "";
}

function textOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function uuidOrNull(value) {
  const text = textOrNull(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text || "") ? text : null;
}

function decimalNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").replace(/[$,\s]/g, "");
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function moneyNumber(value) {
  return Math.round(decimalNumber(value) * 100) / 100;
}

function dateOrNull(value) {
  const text = textOrNull(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}
