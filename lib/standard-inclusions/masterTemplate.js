import masterTemplate from "../../standard-inclusions/premier-inclusions-template.full.json";

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createPremierInclusionsWorkingCopy({ builderId = "local-builder", workbookId = "" } = {}) {
  const now = new Date().toISOString();
  const document = cloneJson(masterTemplate);
  return {
    ...document,
    id: `premier-inclusions-working-copy-${builderId || "builder"}-${workbookId || "local"}`,
    name: document.name || "Premier Inclusions Schedule",
    metadata: {
      ...(document.metadata || {}),
      documentSource: "native-master-working-copy",
      masterTemplateId: masterTemplate.id,
      immutableMaster: false,
      clonedFromMasterAt: now,
      lastSavedAt: now,
      builderId,
      workbookId,
    },
  };
}

export function isPremierInclusionsWorkingCopyCurrent(document) {
  return Boolean(
    document
      && Array.isArray(document.pages)
      && document.pages.length === 10
      && document.metadata?.documentSource !== "starter-template"
      && document.metadata?.isFallback !== true
  );
}

export function premierInclusionsMasterPageCount() {
  return Array.isArray(masterTemplate.pages) ? masterTemplate.pages.length : 0;
}

function workingCopyFromActiveBaseTemplate(active, { builderId = "local-builder", workbookId = "" } = {}) {
  if (!active?.document_json?.pages?.length) return null;
  const now = new Date().toISOString();
  return {
    ...active.document_json,
    id: `standard-inclusions-base-template-copy-${builderId || "builder"}-${workbookId || "local"}`,
    metadata: {
      ...(active.document_json.metadata || {}),
      documentSource: "runtime-base-template-working-copy",
      baseTemplateId: active.id,
      baseTemplateVersion: active.version,
      immutableMaster: false,
      clonedFromMasterAt: now,
      lastSavedAt: now,
      builderId,
      workbookId,
    },
  };
}

async function loadActiveBaseTemplateServer() {
  const { supabaseAdmin } = await import("../supabaseAdmin.js");
  const { data, error } = await supabaseAdmin
    .from("standard_inclusions_base_templates")
    .select("id, version, status, document_json, source_file_name, import_report, created_at, activated_at")
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

// Runtime-promoted base template (e.g. from an accepted PDF import) takes
// precedence over the static bundled JSON, without changing that JSON or any
// existing caller of createPremierInclusionsWorkingCopy() — if no active row
// exists yet (or the request fails), this falls back to the exact same
// static-template working copy every existing flow already produces, so
// nothing regresses when the new table is empty.
export async function resolveBaseStandardInclusionsTemplate({ builderId = "local-builder", workbookId = "", workspaceId = "", authHeaders = {} } = {}) {
  try {
    if (typeof window === "undefined") {
      const active = await loadActiveBaseTemplateServer();
      const copy = workingCopyFromActiveBaseTemplate(active, { builderId, workbookId });
      if (copy) return copy;
    } else {
      const params = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : "";
      const response = await fetch(`/api/standard-inclusions/base-template${params}`, { headers: authHeaders });
      const payload = await response.json().catch(() => ({}));
      const active = response.ok ? payload?.activeTemplate : null;
      const copy = workingCopyFromActiveBaseTemplate(active, { builderId, workbookId });
      if (copy) return copy;
    }
  } catch (error) {
    console.warn("[masterTemplate] Could not load the runtime base template; falling back to the static bundled template.", error?.message || error);
  }
  return createPremierInclusionsWorkingCopy({ builderId, workbookId });
}
