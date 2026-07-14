import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";

const PROGRAMME_STAGES = [
  "Pre-Construction",
  "Site Establishment",
  "Earthworks",
  "Slab / Footings",
  "Frame",
  "Roof",
  "Windows & External Doors",
  "External Cladding / Brickwork",
  "Rough-In",
  "Insulation",
  "Plasterboard",
  "Waterproofing",
  "Internal Fit-Off",
  "Painting",
  "Flooring",
  "Joinery",
  "Appliances",
  "Practical Completion",
  "Handover",
];

const JOB_BOARD_TASKS = [
  { key: "quote_accepted", label: "Quote Accepted" },
  { key: "contracts", label: "Contracts Signed" },
  { key: "contract_deposit", label: "Contract Deposit" },
  { key: "site_prep", label: "Site Prep" },
  { key: "foundation", label: "Foundation / Slab" },
  { key: "frame", label: "Frame" },
  { key: "roofing", label: "Roofing" },
  { key: "windows_doors", label: "Windows & Doors" },
  { key: "rough_plumbing", label: "Rough Plumbing" },
  { key: "rough_electrical", label: "Rough Electrical" },
  { key: "gyprock", label: "Gyprock / Plaster" },
  { key: "fitout", label: "Fit-Out" },
  { key: "prac_completion", label: "Practical Completion" },
  { key: "handover", label: "Handover" },
];

async function handler(req, res) {
  try {
    if (req.method === "GET") return await handlePreflight(req, res);
    if (req.method === "POST") return await handleConvert(req, res);
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    console.error("[builders/convert-to-live-project]", error);
    return res.status(500).json({ ok: false, error: error?.message || "Conversion failed." });
  }
}

export default withWorkspace(handler);

async function handlePreflight(req, res) {
  const workspaceId = req.workspaceId;
  const commercialProjectId = text(req.query.commercial_project_id || req.query.project_id);
  const snapshotId = text(req.query.estimate_snapshot_id || req.query.snapshot_id);
  if (!commercialProjectId || !snapshotId) {
    return res.status(400).json({ ok: false, error: "commercial_project_id and estimate_snapshot_id are required." });
  }

  const source = await loadCommercialSource({ workspaceId, commercialProjectId, snapshotId });
  const duplicate = await findDuplicateConversion({
    userId: req.user.id,
    commercialProjectId,
    snapshotId,
    clientName: source.project.client_name,
    siteAddress: source.project.site_address,
  });

  return res.status(200).json({
    ok: true,
    preflight: buildPreflight(source, duplicate),
  });
}

async function handleConvert(req, res) {
  const workspaceId = req.workspaceId;
  const body = req.body || {};
  const commercialProjectId = text(body.commercial_project_id || body.commercialProjectId || body.project_id);
  const snapshotId = text(body.estimate_snapshot_id || body.estimateSnapshotId || body.snapshot_id);
  const allowDuplicate = Boolean(body.allow_duplicate || body.allowDuplicate);
  if (!commercialProjectId || !snapshotId) {
    return res.status(400).json({ ok: false, error: "commercial_project_id and estimate_snapshot_id are required." });
  }

  const source = await loadCommercialSource({ workspaceId, commercialProjectId, snapshotId });
  const duplicate = await findDuplicateConversion({
    userId: req.user.id,
    commercialProjectId,
    snapshotId,
    clientName: source.project.client_name,
    siteAddress: source.project.site_address,
  });

  if (duplicate && !allowDuplicate) {
    return res.status(409).json({
      ok: false,
      duplicate: true,
      error: "This accepted snapshot already appears to have a live project. Enable 'Create another live project version' to continue.",
      existing: duplicate,
      preflight: buildPreflight(source, duplicate),
    });
  }

  const conversionKey = conversionMarker(commercialProjectId, snapshotId);
  const metadata = {
    conversion_key: conversionKey,
    workspace_id: workspaceId,
    commercial_project_id: commercialProjectId,
    estimate_snapshot_id: snapshotId,
    converted_at: new Date().toISOString(),
    source: "builder_convert_to_live_project",
  };

  const created = {};
  const warnings = [];
  const project = await createOperationalProject({ userId: req.user.id, source, metadata, allowDuplicate, warnings });
  created.project_id = project?.id || null;

  const board = await getOrCreateJobBoard({ userId: req.user.id, warnings });
  created.job_board_board_id = board?.id || null;
  const jobBoardJob = await createJobBoardJob({ userId: req.user.id, board, project, source, metadata, warnings });
  created.job_board_job_id = jobBoardJob?.id || null;
  await seedJobBoardTasks({ jobBoardJob, source, warnings });

  const projectTasks = await seedProjectTasks({ project, source, warnings });
  created.project_task_ids = projectTasks.map((row) => row.id).filter(Boolean);

  const productionJob = await createProductionJob({ userId: req.user.id, project, source, metadata, warnings });
  created.production_job_id = productionJob?.id || null;
  const productionSteps = await seedProductionSteps({ productionJob, warnings });
  created.production_step_ids = productionSteps.map((row) => row.id).filter(Boolean);

  const ganttTasks = await seedGanttTasks({ userId: req.user.id, project, source, metadata, warnings });
  created.gantt_task_ids = ganttTasks.map((row) => row.id).filter(Boolean);

  return res.status(200).json({
    ok: true,
    ids: {
      ...created,
      workspace_id: workspaceId,
      commercial_project_id: commercialProjectId,
      estimate_snapshot_id: snapshotId,
    },
    warnings,
    preflight: buildPreflight(source, { id: project?.id }),
  });
}

async function loadCommercialSource({ workspaceId, commercialProjectId, snapshotId }) {
  const [projectResult, snapshotResult, boqResult, procurementResult, variationResult, variationItemsResult, selectionResult] = await Promise.all([
    supabaseAdmin
      .from("builder_commercial_projects")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("id", commercialProjectId)
      .single(),
    supabaseAdmin
      .from("builder_estimate_snapshots")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("id", snapshotId)
      .eq("project_id", commercialProjectId)
      .single(),
    supabaseAdmin
      .from("builder_boq_items")
      .select("id, section_name, description, quantity, unit, cost_total, sell_total, source_quote_row_id")
      .eq("workspace_id", workspaceId)
      .eq("project_id", commercialProjectId)
      .eq("snapshot_id", snapshotId),
    supabaseAdmin
      .from("builder_procurement_items")
      .select("id, description, supplier_name, required_by, order_by, status, source_quote_row_id")
      .eq("workspace_id", workspaceId)
      .eq("project_id", commercialProjectId)
      .eq("snapshot_id", snapshotId),
    supabaseAdmin
      .from("builder_variations")
      .select("id, status, title, variation_number")
      .eq("workspace_id", workspaceId)
      .eq("project_id", commercialProjectId)
      .eq("snapshot_id", snapshotId),
    supabaseAdmin
      .from("builder_variation_items")
      .select("id, variation_id, line_total, cost_total, status")
      .eq("workspace_id", workspaceId)
      .eq("project_id", commercialProjectId)
      .eq("snapshot_id", snapshotId),
    supabaseAdmin
      .from("builder_client_selections")
      .select("id, title, category, status")
      .eq("workspace_id", workspaceId)
      .eq("project_id", commercialProjectId)
      .eq("snapshot_id", snapshotId),
  ]);

  if (projectResult.error) throw new Error(projectResult.error.message || "Commercial project not found.");
  if (snapshotResult.error) throw new Error(snapshotResult.error.message || "Estimate snapshot not found.");
  const variations = variationResult.data || [];
  const approvedVariationIds = new Set(variations.filter((row) => row.status === "approved").map((row) => row.id));
  const approvedVariationTotal = (variationItemsResult.data || [])
    .filter((row) => approvedVariationIds.has(row.variation_id) && row.status !== "cancelled")
    .reduce((sum, row) => sum + number(row.line_total || row.cost_total), 0);

  return {
    project: projectResult.data,
    snapshot: snapshotResult.data,
    boqItems: boqResult.data || [],
    procurementItems: procurementResult.data || [],
    variations,
    approvedVariationTotal,
    selections: selectionResult.data || [],
  };
}

function buildPreflight(source, duplicate) {
  const estimateTotal = number(
    source.snapshot.final_quote_total ||
    source.snapshot.total_sell ||
    source.snapshot.total ||
    source.snapshot.metadata?.finalQuoteTotal
  );
  const warnings = [];
  if (source.snapshot.status && !["accepted", "approved", "signed"].includes(String(source.snapshot.status).toLowerCase())) {
    warnings.push(`Selected snapshot status is '${source.snapshot.status}', not accepted.`);
  }
  if (!source.boqItems.length) warnings.push("No BOQ items found for this snapshot.");
  if (!source.procurementItems.length) warnings.push("No procurement items found for this snapshot.");
  if (!source.selections.length) warnings.push("No client selections found for this snapshot.");
  if (duplicate) warnings.push("A live project may already exist for this commercial project and snapshot.");

  return {
    project_name: source.project.project_name || "Untitled Project",
    client: source.project.client_name || "",
    site_address: source.project.site_address || "",
    estimate_total: estimateTotal,
    approved_variations: source.approvedVariationTotal,
    revised_contract_value: estimateTotal + source.approvedVariationTotal,
    boq_item_count: source.boqItems.length,
    procurement_item_count: source.procurementItems.length,
    selection_count: source.selections.length,
    existing_conversion: duplicate || null,
    warnings,
    will_create: [
      "Project Hub record",
      "Job Board job",
      "Gantt/production programme",
      "Commercial dashboard links",
      "Procurement schedule links",
      "Draft work orders / production tasks where supported",
    ],
  };
}

async function createOperationalProject({ userId, source, metadata, allowDuplicate, warnings }) {
  const estimateTotal = number(source.snapshot.final_quote_total || source.snapshot.total_sell || source.snapshot.total);
  const payload = {
    user_id: userId,
    client_name: source.project.client_name || source.project.project_name || "Client",
    job_address: source.project.site_address || "",
    job_type: "New Build",
    contract_value: estimateTotal + source.approvedVariationTotal,
    notes: liveProjectNotes(source, metadata),
    current_phase: "prelims",
    status: "active",
  };
  if (!allowDuplicate) {
    const existing = await findDuplicateConversion({
      userId,
      commercialProjectId: metadata.commercial_project_id,
      snapshotId: metadata.estimate_snapshot_id,
      clientName: payload.client_name,
      siteAddress: payload.job_address,
    });
    if (existing?.id) {
      const updated = await safeUpdate("projects", existing.id, payload, warnings, "Project Hub record");
      return updated || existing;
    }
  }
  return await safeInsert("projects", payload, warnings, "Project Hub record");
}

async function getOrCreateJobBoard({ userId, warnings }) {
  const { data: existing } = await supabaseAdmin
    .from("job_board_boards")
    .select("*")
    .eq("user_id", userId)
    .eq("name", "Live Projects")
    .maybeSingle();
  if (existing) return existing;
  return await safeInsert("job_board_boards", {
    user_id: userId,
    name: "Live Projects",
    task_list: JOB_BOARD_TASKS,
    sort_order: 0,
  }, warnings, "Job Board board");
}

async function createJobBoardJob({ userId, board, project, source, metadata, warnings }) {
  return await safeInsert("job_board_jobs", {
    name: source.project.project_name || source.project.client_name || "Live Project",
    client: source.project.client_name || "",
    address: source.project.site_address || "",
    notes: liveProjectNotes(source, metadata),
    user_id: userId,
    sort_order: 0,
    board_id: board?.id || null,
  }, warnings, "Job Board job");
}

async function seedJobBoardTasks({ jobBoardJob, source, warnings }) {
  if (!jobBoardJob?.id) return [];
  const useful = stageTasksFromSource(source).slice(0, 12);
  const rows = useful.map((stage) => ({
    job_id: jobBoardJob.id,
    task_key: stage.key,
    note_blue: stage.label,
    status: "todo",
    card_order: "todo",
  }));
  return await safeInsertMany("job_board_tasks", rows, warnings, "Job Board tasks");
}

async function seedProjectTasks({ project, source, warnings }) {
  if (!project?.id) return [];
  const rows = PROGRAMME_STAGES.map((stage, index) => ({
    project_id: project.id,
    phase: phaseForStage(stage),
    task_name: stage,
    sort_order: index,
    status: "pending",
    notes: taskNoteForStage(stage, source),
  }));
  return await safeInsertMany("project_tasks", rows, warnings, "Project tasks");
}

async function createProductionJob({ userId, project, source, metadata, warnings }) {
  return await safeInsert("production_jobs", {
    user_id: userId,
    name: source.project.project_name || source.project.client_name || "Live Project",
    client_name: source.project.client_name || "",
    description: liveProjectNotes(source, metadata),
  }, warnings, "Production job");
}

async function seedProductionSteps({ productionJob, warnings }) {
  if (!productionJob?.id) return [];
  const steps = ["quote_appr", "ordered", "eta_conf", "delivered", "on_site", "installed", "signed_off"];
  const rows = steps.map((stepKey, index) => ({
    job_id: productionJob.id,
    step_key: stepKey,
    status: index === 0 ? "done" : "pending",
    notes: index === 0 ? "Created from accepted commercial snapshot." : "",
    completed_at: index === 0 ? new Date().toISOString() : null,
  }));
  return await safeInsertMany("production_job_steps", rows, warnings, "Production steps");
}

async function seedGanttTasks({ userId, project, source, metadata, warnings }) {
  if (!project?.id) return [];
  const start = new Date();
  const rows = PROGRAMME_STAGES.map((stage, index) => ({
    user_id: userId,
    project_id: project.id,
    phase: ganttPhaseForStage(stage),
    phase_order: index + 1,
    name: stage,
    start_date: addDays(start, index * 7).toISOString().slice(0, 10),
    end_date: addDays(start, index * 7 + defaultDurationForStage(stage)).toISOString().slice(0, 10),
    duration_days: defaultDurationForStage(stage),
    status: "pending",
    assigned_trade: tradeForStage(stage),
    is_milestone: ["Practical Completion", "Handover"].includes(stage),
    dependencies: [],
    notes: `${taskNoteForStage(stage, source)}\n${metadata.conversion_key}`,
  }));
  return await safeInsertMany("gantt_tasks", rows, warnings, "Gantt programme tasks");
}

async function safeInsert(table, payload, warnings, label) {
  const attempts = fallbackPayloads(payload);
  for (const candidate of attempts) {
    const { data, error } = await supabaseAdmin.from(table).insert(candidate).select("*").single();
    if (!error) return data;
    if (!isColumnError(error)) {
      warnings.push(`${label} could not be created: ${error.message}`);
      return null;
    }
  }
  warnings.push(`${label} could not be created because the table schema did not accept the available fields.`);
  return null;
}

async function safeInsertMany(table, rows, warnings, label) {
  if (!rows.length) return [];
  const attempts = fallbackPayloads(rows[0]).map((sample) => rows.map((row) => pick(row, Object.keys(sample))));
  for (const candidateRows of attempts) {
    const { data, error } = await supabaseAdmin.from(table).insert(candidateRows).select("*");
    if (!error) return data || [];
    if (!isColumnError(error)) {
      warnings.push(`${label} could not be created: ${error.message}`);
      return [];
    }
  }
  warnings.push(`${label} could not be created because the table schema did not accept the available fields.`);
  return [];
}

async function safeUpdate(table, id, payload, warnings, label) {
  const attempts = fallbackPayloads(payload);
  for (const candidate of attempts) {
    const { data, error } = await supabaseAdmin.from(table).update(candidate).eq("id", id).select("*").single();
    if (!error) return data;
    if (!isColumnError(error)) {
      warnings.push(`${label} could not be updated: ${error.message}`);
      return null;
    }
  }
  return null;
}

function fallbackPayloads(payload) {
  const keys = Object.keys(payload);
  const noMeta = keys.filter((key) => !["workspace_id", "commercial_project_id", "estimate_snapshot_id", "metadata", "conversion_metadata"].includes(key));
  const minimal = keys.filter((key) => !["workspace_id", "commercial_project_id", "estimate_snapshot_id", "metadata", "conversion_metadata", "notes", "description"].includes(key));
  return [payload, pick(payload, noMeta), pick(payload, minimal)];
}

function isColumnError(error) {
  const msg = String(error?.message || "");
  return msg.includes("column") || msg.includes("schema cache") || msg.includes("Could not find");
}

async function findDuplicateConversion({ userId, commercialProjectId, snapshotId, clientName, siteAddress }) {
  const marker = conversionMarker(commercialProjectId, snapshotId);
  const { data } = await supabaseAdmin
    .from("projects")
    .select("id, client_name, job_address, notes, contract_value, created_at")
    .eq("user_id", userId)
    .ilike("notes", `%${marker}%`)
    .maybeSingle();
  if (data) return data;
  const fallback = await supabaseAdmin
    .from("projects")
    .select("id, client_name, job_address, notes, contract_value, created_at")
    .eq("user_id", userId)
    .eq("client_name", clientName || "")
    .eq("job_address", siteAddress || "")
    .maybeSingle();
  return fallback.data || null;
}

function stageTasksFromSource(source) {
  const sections = new Set(source.boqItems.map((item) => normaliseStageKey(item.section_name || item.description)).filter(Boolean));
  if (!sections.size) return PROGRAMME_STAGES.map((label) => ({ key: slugKey(label), label }));
  return [...sections].slice(0, 18).map((label) => ({ key: slugKey(label), label }));
}

function normaliseStageKey(value) {
  const textValue = text(value);
  if (!textValue) return "";
  const lower = textValue.toLowerCase();
  if (lower.includes("earth")) return "Earthworks";
  if (lower.includes("slab") || lower.includes("footing")) return "Slab / Footings";
  if (lower.includes("frame")) return "Frame";
  if (lower.includes("roof")) return "Roof";
  if (lower.includes("window") || lower.includes("external door")) return "Windows & External Doors";
  if (lower.includes("brick") || lower.includes("cladding")) return "External Cladding / Brickwork";
  if (lower.includes("rough")) return "Rough-In";
  if (lower.includes("insulation")) return "Insulation";
  if (lower.includes("plaster")) return "Plasterboard";
  if (lower.includes("waterproof")) return "Waterproofing";
  if (lower.includes("paint")) return "Painting";
  if (lower.includes("floor")) return "Flooring";
  if (lower.includes("joinery") || lower.includes("cabinet")) return "Joinery";
  if (lower.includes("appliance")) return "Appliances";
  return textValue;
}

function phaseForStage(stage) {
  if (["Pre-Construction"].includes(stage)) return "prelims";
  if (["Practical Completion", "Handover"].includes(stage)) return "complete";
  return "construction";
}

function ganttPhaseForStage(stage) {
  if (stage === "Pre-Construction") return "Pre-Construction";
  if (stage === "Site Establishment") return "Site Preparation";
  if (["Earthworks", "Slab / Footings"].includes(stage)) return "Foundations";
  if (stage === "Frame") return "Frame Stage";
  if (["Roof", "Windows & External Doors", "External Cladding / Brickwork"].includes(stage)) return "Lock-Up Stage";
  if (["Rough-In", "Insulation"].includes(stage)) return "Rough-In Stage";
  if (["Plasterboard", "Waterproofing"].includes(stage)) return "Internal Lining";
  if (["Internal Fit-Off", "Painting", "Flooring", "Joinery", "Appliances"].includes(stage)) return "Fix-Out Stage";
  return "Completion";
}

function defaultDurationForStage(stage) {
  if (["Pre-Construction"].includes(stage)) return 21;
  if (["Frame", "Roof", "Internal Fit-Off", "Painting", "Flooring", "Joinery"].includes(stage)) return 10;
  if (["Practical Completion", "Handover"].includes(stage)) return 2;
  return 7;
}

function tradeForStage(stage) {
  const map = {
    Earthworks: "Excavator",
    "Slab / Footings": "Concreter",
    Frame: "Framer",
    Roof: "Roofer",
    "Windows & External Doors": "Window Supplier",
    "External Cladding / Brickwork": "Bricklayer / Renderer",
    "Rough-In": "Plumber / Electrician",
    Insulation: "Insulation",
    Plasterboard: "Plasterer",
    Waterproofing: "Waterproofer",
    Painting: "Painter",
    Flooring: "Flooring",
    Joinery: "Cabinet Maker",
    Appliances: "Appliance Supplier",
  };
  return map[stage] || "Builder";
}

function taskNoteForStage(stage, source) {
  const count = source.boqItems.filter((item) => normaliseStageKey(item.section_name || item.description) === stage).length;
  return count ? `Seeded from ${count} BOQ item${count === 1 ? "" : "s"}.` : "Seeded from accepted commercial snapshot.";
}

function liveProjectNotes(source, metadata) {
  return [
    source.project.project_name ? `Project: ${source.project.project_name}` : "",
    `Converted from Estimate Builder commercial snapshot.`,
    `Commercial project: ${metadata.commercial_project_id}`,
    `Estimate snapshot: ${metadata.estimate_snapshot_id}`,
    metadata.conversion_key,
  ].filter(Boolean).join("\n");
}

function conversionMarker(commercialProjectId, snapshotId) {
  return `builder_conversion:${commercialProjectId}:${snapshotId}`;
}

function addDays(date, count) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function slugKey(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "task";
}

function pick(source, keys) {
  return keys.reduce((result, key) => {
    if (source[key] !== undefined) result[key] = source[key];
    return result;
  }, {});
}

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value) {
  return String(value || "").trim();
}
