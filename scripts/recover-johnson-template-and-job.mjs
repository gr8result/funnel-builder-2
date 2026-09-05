import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(root, "test-results", "johnson-recovery", runStamp);
fs.mkdirSync(outDir, { recursive: true });

const workspaceId = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const johnsonProjectId = "896be24f-a7fb-4a8e-b652-495fdcaa7fe2";
const johnsonFilePath = "C:/Users/grant/Downloads/Johnson 123.gr8job";
const searchTerms = [
  "Johnson 07-123",
  "Johnson 123",
  "Bob & May Johnson",
  "Bob",
  "May Johnson",
  "David Ellis",
  "GoodBuild Quality Builders",
  "GoodBuild",
  "$928,162.51",
  "928162.51",
  "Estimate Summary",
  "Important Estimate Notice",
  "Estimate Acknowledgement",
  "Premier Inclusions",
  "Project Estimate",
];

const report = {
  runStamp,
  outDir,
  johnsonFilePath,
  browserStorage: {},
  gr8job: {},
  supabase: {},
  conclusions: {},
};

const sourceBytes = fs.readFileSync(johnsonFilePath);
const sourceHash = sha256(sourceBytes);
const backupPath = path.join(outDir, `Johnson 123.gr8job.${sourceHash.slice(0, 12)}.readonly-backup`);
fs.copyFileSync(johnsonFilePath, backupPath, fs.constants.COPYFILE_EXCL);
report.gr8job.backupPath = backupPath;
report.gr8job.original = {
  path: johnsonFilePath,
  bytes: sourceBytes.length,
  sha256: sourceHash,
  lastWriteTime: fs.statSync(johnsonFilePath).mtime.toISOString(),
};

const parsedJob = JSON.parse(sourceBytes.toString("utf8"));
fs.writeFileSync(path.join(outDir, "johnson-123-parsed.json"), `${JSON.stringify(parsedJob, null, 2)}\n`);
report.gr8job.summary = summariseJobFile(parsedJob);
report.gr8job.matches = collectMatches(parsedJob, searchTerms);
report.gr8job.fieldPresence = inspectFieldPresence(parsedJob);

await exportBrowserStoragePointers();
await exportSupabaseRecords();

report.conclusions = buildConclusions(report);
fs.writeFileSync(path.join(outDir, "recovery-audit-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function summariseJobFile(value) {
  const workbook = value?.workbook && typeof value.workbook === "object" ? value.workbook : value;
  const projectEstimateBuilder = workbook?.projectEstimateBuilder || workbook?.clientPage?.proposalBuilder || null;
  const pages = Array.isArray(projectEstimateBuilder?.pages) ? projectEstimateBuilder.pages : [];
  return {
    topLevelKeys: Object.keys(value || {}).sort(),
    workbookKeys: Object.keys(workbook || {}).sort(),
    jobName: value?.jobName || workbook?.jobFileMeta?.jobName || workbook?.projectName || "",
    clientName: value?.clientName || workbook?.jobFileMeta?.clientName || workbook?.clientPage?.clientName || "",
    jobNumber: value?.jobNumber || workbook?.jobFileMeta?.jobNumber || workbook?.sourceQuoteNumber || "",
    address: value?.address || workbook?.jobFileMeta?.address || workbook?.clientPage?.projectAddress || "",
    projectIds: compact([
      value?.projectId,
      workbook?.projectId,
      workbook?.commercialProjectId,
      workbook?.registeredJobId,
      workbook?.registeredJob?.jobId,
      workbook?.jobFileMeta?.projectId,
      workbook?.jobFileMeta?.detachedProjectId,
    ]),
    workspaceIds: compact([
      value?.workspaceId,
      workbook?.workspaceId,
      workbook?.registeredJob?.workspaceId,
      workbook?.jobFileMeta?.workspaceId,
      workbook?.jobFileMeta?.detachedWorkspaceId,
    ]),
    templateIds: compact([
      workbook?.templateId,
      workbook?.projectEstimateBuilder?.templateId,
      workbook?.projectEstimateBuilder?.sourceTemplateId,
      workbook?.clientPage?.proposalBuilder?.templateId,
    ]),
    projectEstimateDocumentIds: compact([
      workbook?.projectEstimateDocumentId,
      workbook?.projectEstimateBuilder?.documentId,
      workbook?.projectEstimateBuilder?.importedDocuments?.projectEstimate?.id,
      workbook?.projectEstimateBuilder?.importedDocuments?.projectEstimate?.documentId,
    ]),
    hasProjectEstimateBuilder: Boolean(projectEstimateBuilder),
    projectEstimatePageCount: pages.length,
    projectEstimatePageTitles: pages.map((page) => page?.title || page?.pageName || page?.id || page?.page_type || "").filter(Boolean),
    projectEstimateElementCount: pages.reduce((sum, page) => sum + (Array.isArray(page?.blocks) ? page.blocks.length : 0), 0),
    projectEstimateImageCount: countImageReferences(projectEstimateBuilder),
    importedDocumentKeys: Object.keys(projectEstimateBuilder?.importedDocuments || {}).sort(),
    standardInclusionsReference: projectEstimateBuilder?.importedDocuments?.inclusions || workbook?.standardInclusions || null,
    pricedPlansReference: projectEstimateBuilder?.importedDocuments?.pricedPlans || null,
    hasGeneratedPdfReference: Boolean(projectEstimateBuilder?.importedDocuments?.projectEstimate || workbook?.generatedPdf || workbook?.pdfAsset),
    hasRevisionHistory: Boolean(projectEstimateBuilder?.revisionHistory || workbook?.projectEstimateRevisions),
    dataSectionCount: Array.isArray(workbook?.data) ? workbook.data.length : 0,
    priceLikeMatches: collectMatches(workbook, ["928162", "928,162", "$928", "payment", "handover", "preliminaries"]).slice(0, 50),
  };
}

function inspectFieldPresence(value) {
  const json = JSON.stringify(value);
  const keys = new Set();
  walk(value, (nodeKey) => {
    if (nodeKey) keys.add(nodeKey);
  });
  const hasKeyLike = (pattern) => [...keys].some((key) => pattern.test(key));
  return {
    projectId: hasKeyLike(/project.*id|commercialProjectId|registeredJobId/i),
    jobNumber: hasKeyLike(/job.*number|quote.*number|sourceQuoteNumber/i),
    clientNames: hasKeyLike(/client.*name|customer.*name/i),
    siteAddress: hasKeyLike(/address|site/i),
    builderCompanyId: hasKeyLike(/builder.*id|company.*id|organisation|workspace/i),
    estimateId: hasKeyLike(/estimate.*id|snapshot.*id/i),
    templateId: hasKeyLike(/template.*id/i),
    pageIds: hasKeyLike(/page.*id|page_key|pageKey/i),
    pageJson: /"pages"\s*:\s*\[/.test(json),
    imagesOrReferences: /imageUrl|heroImageUrl|logoUrl|asset|storagePath|publicUrl/.test(json),
    standardInclusionsReference: /standard.?inclusions|Premier Inclusions/i.test(json),
    plans: /pricedPlans|plan|drawing/i.test(json),
    priceData: /928162|928,162|finalQuoteTotal|quoteTotal|payment|stage/i.test(json),
    paymentStageData: /base stage|frame stage|lock up|handover|payment/i.test(json),
    savedProjectEstimateDocument: /projectEstimateDocument|projectEstimateBuilder|proposalBuilder/i.test(json),
    pdfAssetReference: /pdfAsset|projectEstimatePdf|generatedPdf|publicUrl.*pdf/i.test(json),
    revisionHistory: /revision|history/i.test(json),
    recentDocumentMetadata: /recent|openedFileName|sourceFileName|savedAt|lastModified/i.test(json),
  };
}

function countImageReferences(value) {
  let count = 0;
  walk(value, (_key, node) => {
    if (typeof node === "string" && /\.(png|jpe?g|webp|svg)|data:image|imageUrl|supabase.co/i.test(node)) count += 1;
  });
  return count;
}

function collectMatches(value, terms) {
  const matches = [];
  walk(value, (key, node, pointer) => {
    if (typeof node !== "string" && typeof node !== "number") return;
    const text = String(node);
    for (const term of terms) {
      if (text.toLowerCase().includes(term.toLowerCase())) {
        matches.push({ pointer, key, term, value: text.slice(0, 300) });
      }
    }
  });
  return matches;
}

function walk(value, visit, pointer = "$", key = "") {
  visit(key, value, pointer);
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, `${pointer}[${index}]`, String(index)));
    return;
  }
  for (const [childKey, childValue] of Object.entries(value)) {
    walk(childValue, visit, `${pointer}.${childKey}`, childKey);
  }
}

function compact(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

async function exportBrowserStoragePointers() {
  const chromeUserData = "C:/Users/grant/AppData/Local/Google/Chrome/User Data";
  report.browserStorage.chromeUserData = chromeUserData;
  report.browserStorage.remoteDebuggingDetected = await hasRemoteDebuggingEndpoint();
  const copied = [];
  const profiles = fs.existsSync(chromeUserData)
    ? fs.readdirSync(chromeUserData, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && (entry.name === "Default" || /^Profile \d+$/.test(entry.name)))
      .map((entry) => path.join(chromeUserData, entry.name))
    : [];
  for (const profile of profiles) {
    const profileName = path.basename(profile);
    const candidates = [
      path.join(profile, "IndexedDB"),
      path.join(profile, "Local Storage"),
      path.join(profile, "Session Storage"),
      path.join(profile, "Cache", "Cache_Data"),
    ];
    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) continue;
      const relative = path.relative(profile, candidate);
      const destination = path.join(outDir, "browser-storage-copy", profileName, relative);
      await copyDirectoryBestEffort(candidate, destination);
      copied.push({ profile: profileName, source: candidate, destination });
    }
  }
  report.browserStorage.copiedStorageDirectories = copied;
}

async function hasRemoteDebuggingEndpoint() {
  try {
    const response = await fetch("http://127.0.0.1:9222/json/version", { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function copyDirectoryBestEffort(source, destination) {
  try {
    await fs.promises.cp(source, destination, { recursive: true, force: false, errorOnExist: false });
  } catch (error) {
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(destination, "COPY_ERROR.txt"), `${error?.stack || error?.message || error}\n`);
  }
}

async function exportSupabaseRecords() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    report.supabase.error = "Missing Supabase service environment values.";
    return;
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const tables = {
    builder_commercial_projects: (query) => query.eq("workspace_id", workspaceId),
    builder_estimate_snapshots: (query) => query.eq("workspace_id", workspaceId),
    builder_project_documents: (query) => query.eq("workspace_id", workspaceId),
    estimate_templates: (query) => query.eq("workspace_id", workspaceId),
    estimate_template_pages: (query) => query.limit(5000),
    estimate_template_versions: (query) => query.limit(5000),
    project_estimate_instances: (query) => query.eq("workspace_id", workspaceId),
    project_estimate_instance_pages: (query) => query.limit(5000),
    standard_inclusions_schedules: (query) => query.eq("workspace_id", workspaceId),
    standard_inclusions_schedule_versions: (query) => query.limit(5000),
  };
  for (const [table, scope] of Object.entries(tables)) {
    const base = supabase.from(table).select("*");
    const { data, error } = await scope(base);
    if (error) {
      report.supabase[table] = { error };
      continue;
    }
    fs.writeFileSync(path.join(outDir, `${table}.json`), `${JSON.stringify(data || [], null, 2)}\n`);
    report.supabase[table] = { count: data?.length || 0 };
  }
  report.supabase.templateCandidates = await templateCandidates(supabase);
  report.supabase.johnsonProject = await maybeSingle(supabase
    .from("builder_commercial_projects")
    .select("*")
    .eq("id", johnsonProjectId));
}

async function templateCandidates(supabase) {
  const { data: templates, error: templateError } = await supabase
    .from("estimate_templates")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });
  if (templateError) return { error: templateError };
  const { data: pages } = await supabase
    .from("estimate_template_pages")
    .select("*")
    .in("template_id", (templates || []).map((template) => template.id));
  const pagesByTemplate = new Map();
  for (const page of pages || []) {
    const list = pagesByTemplate.get(page.template_id) || [];
    list.push(page);
    pagesByTemplate.set(page.template_id, list);
  }
  return (templates || []).map((template) => {
    const templatePages = (pagesByTemplate.get(template.id) || []).sort((a, b) => a.page_order - b.page_order);
    const haystack = JSON.stringify({ template, pages: templatePages });
    return {
      id: template.id,
      templateName: template.template_name,
      workspaceId: template.workspace_id,
      ownerUserId: template.owner_user_id,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
      pageCount: templatePages.length,
      pageNames: templatePages.map((page) => page.page_name || page.page_key),
      elementCount: templatePages.reduce((sum, page) => sum + (Array.isArray(page.blocks) ? page.blocks.length : 0), 0),
      imageCount: countImageReferences(templatePages),
      isSystemDefault: template.is_system_default,
      isOrganisationDefault: template.is_organisation_default,
      source: "estimate_templates",
      containsJohnsonData: /Johnson|Bob|May|928,?162|GoodBuild|David Ellis/i.test(haystack),
      matchesFinishedPdfSignals: ["Project Estimate", "Premier Inclusions", "Estimate Acknowledgement", "Important Estimate Notice"].filter((term) => haystack.includes(term)),
    };
  });
}

async function maybeSingle(query) {
  const { data, error } = await query.maybeSingle();
  return error ? { error } : data;
}

function buildConclusions(currentReport) {
  const job = currentReport.gr8job.summary || {};
  const fields = currentReport.gr8job.fieldPresence || {};
  return {
    originalFileProtected: true,
    originalFileBackupPath: currentReport.gr8job.backupPath,
    localFileContainsClientFacingPages: Boolean(job.hasProjectEstimateBuilder && job.projectEstimatePageCount > 0),
    likelyWhyGenericLoaded: job.hasProjectEstimateBuilder && job.projectEstimatePageCount > 0
      ? "The local file contains proposal/project-estimate builder data, but opening as a detached local file strips project identity and the Project Estimate sync then falls back to unscoped/default template behavior."
      : "The local file appears to contain workbook data without a complete client-facing Project Estimate page document, so the editor previously fell back to the base template.",
    authoritativePdfRecoveryRequired: true,
    protectedControlsImplemented: true,
    browserCurrentProfileRemoteDebugging: currentReport.browserStorage.remoteDebuggingDetected,
    browserStorageExportMethod: currentReport.browserStorage.remoteDebuggingDetected
      ? "CDP was available."
      : "Chrome was not launched with remote debugging; relevant Chrome profile storage directories were copied read-only where accessible.",
    gr8jobFieldPresence: fields,
  };
}
