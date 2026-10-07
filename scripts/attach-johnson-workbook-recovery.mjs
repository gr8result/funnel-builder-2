import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const WORKSPACE_ID = "846885cd-25b9-4eca-b9f9-3fd02f5882d8";
const USER_ID = "35ab846e-0764-498b-b1f8-7d2cf27d85a5";
const JOHNSON_PROJECT_ID = "896be24f-a7fb-4a8e-b652-495fdcaa7fe2";
const JOHNSON_JOB_FILE = "C:/Users/grant/Downloads/Johnson 123.gr8job";
const ASSETS_BUCKET = "assets";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !serviceKey) throw new Error("Missing Supabase URL/service role key.");

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const buffer = fs.readFileSync(JOHNSON_JOB_FILE);
const parsedJob = JSON.parse(buffer.toString("utf8"));
const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");
const objectPath = [
  USER_ID,
  "project-workbooks",
  WORKSPACE_ID,
  JOHNSON_PROJECT_ID,
  `${fileHash.slice(0, 16)}-johnson-123.gr8job`,
].join("/");

const uploaded = await uploadWorkbook();
const document = await upsertWorkbookDocument(uploaded);
const project = await updateJohnsonProject(uploaded, document);

console.log(JSON.stringify({
  workbookDocumentId: document.id,
  workbookStoragePath: uploaded.storagePath,
  workbookPublicUrl: uploaded.publicUrl,
  workbookSha256: fileHash,
  workbookBytes: buffer.length,
  projectId: project.id,
  projectName: project.project_name,
  clientName: project.client_name,
  siteAddress: project.site_address,
  sourceQuoteNumber: project.source_quote_number,
  originalEstimateTotal: project.original_estimate_total,
}, null, 2));

async function uploadWorkbook() {
  const { error } = await supabase.storage
    .from(ASSETS_BUCKET)
    .upload(objectPath, buffer, { contentType: "application/json", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(objectPath);
  return {
    storageBucket: ASSETS_BUCKET,
    objectPath,
    storagePath: `${ASSETS_BUCKET}:${objectPath}`,
    publicUrl: data?.publicUrl || "",
  };
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

async function upsertWorkbookDocument(uploaded) {
  const snapshotId = await latestSnapshotId();
  const metadata = {
    source: "johnson_recovery",
    sourceType: "estimate_builder_workbook",
    uiDocumentType: "estimate_builder_workbook",
    recoveryStatus: "Recovered Original Job File",
    originalSourcePath: JOHNSON_JOB_FILE,
    fileHash,
    preservedWithoutOverwrite: true,
    localFileSummary: {
      topLevelJobName: parsedJob?.jobName || "",
      topLevelClientName: parsedJob?.clientName || "",
      topLevelJobNumber: parsedJob?.jobNumber || "",
      topLevelAddress: parsedJob?.address || "",
      openedFileName: parsedJob?.workbook?.openedFileName || "",
      sourceFileName: parsedJob?.workbook?.sourceFileName || "",
      templateName: parsedJob?.workbook?.templateName || "",
      templateKey: parsedJob?.workbook?.templateKey || "",
      hasProjectEstimateBuilder: Boolean(parsedJob?.workbook?.projectEstimateBuilder),
      standardInclusionsDeletedLocalCopy: Boolean(parsedJob?.workbook?.standardInclusions?.isDeleted),
    },
  };

  const { data: existing, error: existingError } = await supabase
    .from("builder_project_documents")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("project_id", JOHNSON_PROJECT_ID)
    .eq("metadata->>fileHash", fileHash)
    .eq("metadata->>sourceType", "estimate_builder_workbook")
    .maybeSingle();
  if (existingError) throw existingError;

  const payload = {
    snapshot_id: snapshotId,
    document_type: "other",
    title: "Recovered Original Job File - Johnson 123.gr8job",
    description: "Protected original Johnson .gr8job supplied from Downloads.",
    file_name: path.basename(JOHNSON_JOB_FILE),
    mime_type: "application/json",
    file_size_bytes: buffer.length,
    storage_bucket: ASSETS_BUCKET,
    storage_path: uploaded.storagePath,
    public_url: uploaded.publicUrl,
    status: "active",
    metadata,
    uploaded_by: USER_ID,
    updated_by: USER_ID,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { data, error } = await supabase
      .from("builder_project_documents")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("builder_project_documents")
    .insert({
      workspace_id: WORKSPACE_ID,
      project_id: JOHNSON_PROJECT_ID,
      ...payload,
      created_by: USER_ID,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function updateJohnsonProject(uploaded, document) {
  const { data: current, error: currentError } = await supabase
    .from("builder_commercial_projects")
    .select("*")
    .eq("id", JOHNSON_PROJECT_ID)
    .single();
  if (currentError) throw currentError;

  const sourceMetadata = {
    ...(current.source_metadata || {}),
    recovery: {
      ...((current.source_metadata || {}).recovery || {}),
      status: "Recovered Original PDF",
      recoveredAt: new Date().toISOString(),
      projectEstimateDocumentId: "583f1281-baa0-40f1-9b8e-66dda9756313",
      workbookDocumentId: document.id,
      workbookStoragePath: uploaded.storagePath,
      workbookSha256: fileHash,
      suppliedProjectEstimateTotal: 928162.51,
      suppliedProjectEstimatePages: 21,
      suppliedPremierInclusionsPages: 10,
      editableProjectEstimateTemplateRecovered: false,
      editableProjectEstimateTemplateRecoveryNotes:
        "The supplied .gr8job contains estimating workbook data and Standard Inclusions revision data, but no projectEstimateBuilder/proposalBuilder pages for the client-facing estimate.",
    },
    project: {
      ...((current.source_metadata || {}).project || {}),
      projectName: "Johnson 07-123",
      clientName: "Bob & May Johnson",
      address: "2 Anotherstreet, Somplace, QLD 4557",
      quoteNumber: "Johnson 07-123",
      quoteDate: "2026-07-06",
      sourceWorkbookFileName: "Johnson 123.gr8job",
    },
    workbook: {
      ...((current.source_metadata || {}).workbook || {}),
      openedFileName: parsedJob?.workbook?.openedFileName || "Johnson 123.gr8job",
      sourceFileName: parsedJob?.workbook?.sourceFileName || "Johnson 123.gr8job",
      uploadedWorkbookStoragePath: uploaded.storagePath,
      uploadedWorkbookDocumentId: document.id,
      uploadedWorkbookSha256: fileHash,
    },
  };

  const { data, error } = await supabase
    .from("builder_commercial_projects")
    .update({
      source_workbook_file_name: "Johnson 123.gr8job",
      source_quote_number: "Johnson 07-123",
      source_workbook_job_id: "Johnson 07-123",
      project_name: "Johnson 07-123",
      client_name: "Bob & May Johnson",
      site_address: "2 Anotherstreet, Somplace, QLD 4557",
      original_estimate_total: 928162.51,
      contract_total: 928162.51,
      status: "active",
      source_metadata: sourceMetadata,
      updated_by: USER_ID,
      updated_at: new Date().toISOString(),
    })
    .eq("id", JOHNSON_PROJECT_ID)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
