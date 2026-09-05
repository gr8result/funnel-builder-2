import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import supabaseAdmin from "../utils/supabase-admin.js";

const WORKSPACE_ID = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const BUILDER_ID = "35ab846e-0764-498b-b1f8-7d2cf27d85a5";
const JOHNSON_PROJECT_ID = "896be24f-a7fb-4a8e-b652-495fdcaa7fe2";
const JOHNSON_INSTANCE_ID = "6931d0fc-09bd-4f4c-9037-58b744e1bd50";
const TERMS = [
  "Johnson",
  "Bob",
  "May",
  "Johnson 07-123",
  "Johnson 123",
  "928162",
  "928,162.51",
  "GoodBuild",
  "Quality Builders",
  "Estimate Summary",
  "Important Estimate Notice",
  "Premier Inclusions",
  "Acceptance",
  "2 Anotherstreet",
  "Somplace",
];

const outDir = path.resolve("test-results/johnson-template-chain", new Date().toISOString().replace(/[:.]/g, "-"));
await fs.mkdir(outDir, { recursive: true });

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function textOf(value) {
  try {
    return JSON.stringify(value ?? "");
  } catch {
    return String(value ?? "");
  }
}

function termHits(value) {
  const text = textOf(value).toLowerCase();
  return TERMS.filter((term) => text.includes(term.toLowerCase()));
}

function compact(row, fields) {
  const next = {};
  for (const field of fields) next[field] = row?.[field] ?? null;
  return next;
}

async function selectAll(table, query) {
  let req = supabaseAdmin.from(table).select(query.select || "*");
  for (const [method, args] of query.filters || []) req = req[method](...args);
  if (query.order) req = req.order(query.order.column, query.order.options || {});
  if (query.limit) req = req.limit(query.limit);
  const { data, error } = await req;
  if (error) return { table, error: error.message, data: [] };
  return { table, error: null, data: data || [] };
}

async function trySelect(table, query) {
  try {
    return await selectAll(table, query);
  } catch (error) {
    return { table, error: error.message, data: [] };
  }
}

const tableReads = [
  ["builder_commercial_projects", { select: "*", filters: [["eq", ["workspace_id", WORKSPACE_ID]], ["eq", ["id", JOHNSON_PROJECT_ID]]] }],
  ["builder_estimate_snapshots", { select: "*", filters: [["eq", ["workspace_id", WORKSPACE_ID]], ["eq", ["project_id", JOHNSON_PROJECT_ID]]], order: { column: "created_at", options: { ascending: false } } }],
  ["builder_project_documents", { select: "*", filters: [["eq", ["workspace_id", WORKSPACE_ID]], ["eq", ["project_id", JOHNSON_PROJECT_ID]]], order: { column: "updated_at", options: { ascending: false } } }],
  ["builder_quote_proposals", { select: "*", filters: [["eq", ["workspace_id", WORKSPACE_ID]], ["eq", ["project_id", JOHNSON_PROJECT_ID]]], order: { column: "updated_at", options: { ascending: false } } }],
  ["builder_selection_books", { select: "*", filters: [["eq", ["workspace_id", WORKSPACE_ID]], ["eq", ["project_id", JOHNSON_PROJECT_ID]]], order: { column: "updated_at", options: { ascending: false } } }],
  ["builder_inclusion_templates", { select: "*", filters: [["or", [`workspace_id.eq.${WORKSPACE_ID},workspace_id.is.null`]]], order: { column: "updated_at", options: { ascending: false } } }],
  ["standard_inclusions_schedules", { select: "*", filters: [["eq", ["workspace_id", WORKSPACE_ID]]], order: { column: "updated_at", options: { ascending: false } } }],
  ["standard_inclusions_schedule_versions", { select: "*", filters: [["eq", ["workspace_id", WORKSPACE_ID]]], order: { column: "created_at", options: { ascending: false } } }],
  ["estimate_templates", { select: "*", filters: [["or", [`workspace_id.eq.${WORKSPACE_ID},workspace_id.is.null`]]], order: { column: "updated_at", options: { ascending: false } } }],
  ["estimate_template_pages", { select: "*" }],
  ["estimate_template_versions", { select: "*", order: { column: "created_at", options: { ascending: false } } }],
  ["project_estimate_instances", { select: "*", filters: [["eq", ["workspace_id", WORKSPACE_ID]]], order: { column: "updated_at", options: { ascending: false } } }],
  ["project_estimate_instance_pages", { select: "*", filters: [["eq", ["instance_id", JOHNSON_INSTANCE_ID]]], order: { column: "page_order", options: { ascending: true } } }],
  ["project_documents", { select: "*", filters: [["eq", ["workspace_id", WORKSPACE_ID]]], order: { column: "updated_at", options: { ascending: false } } }],
];

const reads = {};
for (const [table, query] of tableReads) {
  reads[table] = await trySelect(table, query);
}

const templateIds = new Set((reads.estimate_templates.data || []).map((row) => row.id));
const templatePages = (reads.estimate_template_pages.data || []).filter((row) => templateIds.has(row.template_id));
const templateVersions = (reads.estimate_template_versions.data || []).filter((row) => templateIds.has(row.template_id));

const instanceRows = reads.project_estimate_instances.data || [];
const johnsonInstance = instanceRows.find((row) => row.project_id === JOHNSON_PROJECT_ID) || null;
const loadedTemplate = johnsonInstance
  ? (reads.estimate_templates.data || []).find((row) => row.id === johnsonInstance.template_id) || null
  : null;

const templateSummaries = (reads.estimate_templates.data || []).map((template) => {
  const pages = templatePages.filter((page) => page.template_id === template.id).sort((a, b) => a.page_order - b.page_order);
  const versions = templateVersions.filter((version) => version.template_id === template.id);
  const sample = { template, pages, versions };
  return {
    ...compact(template, ["id", "workspace_id", "template_name", "description", "is_system_default", "is_organisation_default", "version", "source_template_id", "created_at", "updated_at"]),
    pageCount: pages.length,
    pageNames: pages.map((page) => page.page_name),
    pagesWithBlocks: pages.filter((page) => Array.isArray(page.blocks)).length,
    elementCount: pages.reduce((sum, page) => sum + (Array.isArray(page.blocks) ? page.blocks.length : 0), 0),
    versionCount: versions.length,
    revisionIds: versions.map((version) => version.id),
    hits: termHits(sample),
    contentHash: hash(textOf(sample)),
  };
});

const proposalSummaries = (reads.builder_quote_proposals.data || []).map((proposal) => ({
  ...compact(proposal, ["id", "proposal_name", "status", "created_at", "updated_at", "estimate_snapshot_id"]),
  pageCount: Array.isArray(proposal.pages) ? proposal.pages.length : 0,
  hits: termHits(proposal),
  contentHash: hash(textOf(proposal)),
}));

const snapshotSummaries = (reads.builder_estimate_snapshots.data || []).map((snapshot) => ({
  ...compact(snapshot, ["id", "snapshot_number", "snapshot_label", "status", "source_workbook_file_name", "source_quote_number", "source_template_key", "source_template_name", "final_quote_total", "created_at", "updated_at"]),
  hits: termHits(snapshot),
  contentHash: hash(textOf(snapshot)),
}));

const documentSummaries = [
  ...(reads.builder_project_documents.data || []).map((doc) => ({ table: "builder_project_documents", ...compact(doc, ["id", "document_type", "title", "file_name", "status", "related_table", "related_record_id", "storage_bucket", "storage_path", "created_at", "updated_at"]), hits: termHits(doc) })),
  ...(reads.project_documents.data || []).map((doc) => ({ table: "project_documents", ...compact(doc, ["id", "document_type", "title", "file_name", "status", "storage_bucket", "storage_path", "created_at", "updated_at"]), hits: termHits(doc) })),
];

const storagePrefixes = [
  `${BUILDER_ID}/project-estimates/${WORKSPACE_ID}/${JOHNSON_PROJECT_ID}`,
  `${BUILDER_ID}/project-workbooks/${WORKSPACE_ID}/${JOHNSON_PROJECT_ID}`,
  `${BUILDER_ID}/standard-inclusions/${WORKSPACE_ID}`,
  `${BUILDER_ID}/proposal-documents`,
];

const storage = [];
for (const prefix of storagePrefixes) {
  const { data, error } = await supabaseAdmin.storage.from("assets").list(prefix, { limit: 100, sortBy: { column: "updated_at", order: "desc" } });
  storage.push({ bucket: "assets", prefix, error: error?.message || null, data: data || [] });
}

const browserExportPath = path.resolve("test-results/johnson-browser-storage/2026-08-28T05-36-30-389Z/browser-storage-export.json");
let browserExport = null;
try {
  browserExport = JSON.parse(await fs.readFile(browserExportPath, "utf8"));
} catch (error) {
  browserExport = { error: error.message };
}

const gr8ReportPath = path.resolve("test-results/johnson-recovery/2026-08-28T05-01-49-581Z/recovery-audit-report.json");
let gr8Report = null;
try {
  gr8Report = JSON.parse(await fs.readFile(gr8ReportPath, "utf8"));
} catch (error) {
  gr8Report = { error: error.message };
}

const report = {
  generatedAt: new Date().toISOString(),
  ids: { WORKSPACE_ID, BUILDER_ID, JOHNSON_PROJECT_ID, JOHNSON_INSTANCE_ID },
  readErrors: Object.fromEntries(Object.entries(reads).map(([table, result]) => [table, result.error]).filter(([, error]) => error)),
  johnsonProject: reads.builder_commercial_projects.data?.[0] || null,
  johnsonInstance,
  loadedTemplate: loadedTemplate ? compact(loadedTemplate, ["id", "workspace_id", "template_name", "is_system_default", "is_organisation_default", "version", "created_at", "updated_at"]) : null,
  templateSummaries,
  templatePages: templatePages.map((page) => ({
    ...compact(page, ["id", "template_id", "page_key", "page_name", "page_type", "page_order", "created_at", "updated_at"]),
    hasBlocks: Array.isArray(page.blocks),
    blockCount: Array.isArray(page.blocks) ? page.blocks.length : 0,
    hasImportedDocument: Boolean(page.imported_document),
    hits: termHits(page),
  })),
  templateVersionSummaries: templateVersions.map((version) => ({
    ...compact(version, ["id", "template_id", "version_number", "label", "created_by", "created_at"]),
    snapshotPageCount: Array.isArray(version.snapshot?.pages) ? version.snapshot.pages.length : null,
    hits: termHits(version),
    contentHash: hash(textOf(version)),
  })),
  projectEstimateInstancePages: reads.project_estimate_instance_pages.data || [],
  proposalSummaries,
  snapshotSummaries,
  selectionBooks: reads.builder_selection_books.data || [],
  inclusionTemplates: reads.builder_inclusion_templates.data || [],
  standardInclusionsSchedules: reads.standard_inclusions_schedules.data || [],
  standardInclusionsVersions: reads.standard_inclusions_schedule_versions.data || [],
  documentSummaries,
  storage,
  browserStorageRecoverySummary: browserExport?.summary || browserExport,
  gr8RecoverySummary: gr8Report?.summary || gr8Report,
};

await fs.writeFile(path.join(outDir, "template-chain-audit.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  outDir,
  readErrors: report.readErrors,
  loadedTemplate: report.loadedTemplate,
  templateSummaries: report.templateSummaries,
  templateVersionSummaries: report.templateVersionSummaries,
  proposalSummaries: report.proposalSummaries,
  snapshotSummaries: report.snapshotSummaries,
  documentSummaries: report.documentSummaries,
  browserStorageRecoverySummary: report.browserStorageRecoverySummary,
  gr8RecoverySummary: report.gr8RecoverySummary,
}, null, 2));
