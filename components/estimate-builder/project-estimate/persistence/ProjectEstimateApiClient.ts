// Thin REST client for the Project Estimate multi-user page builder API
// (pages/api/project-estimate/**). This module only transports data and
// maps between the DB page row shape and a generic "page draft" shape —
// it deliberately does NOT know how to resolve a page's compiled-in
// registry defaults when `blocks` is null. That resolution happens in
// EstimateBuilderWorkbook.js (see hydrateProjectEstimatePageFromApi),
// which already owns defaultQuoteProposalPage/client/sheet context needed
// to reproduce the exact default content (including job-linked fields
// like hero image/logo) for a freshly-created page.

import { supabase } from "../../../../utils/supabase-client";

export type ProjectEstimateApiPage = {
  id?: string;
  pageKey: string;
  pageName: string;
  pageType: string;
  pageOrder: number;
  width: number;
  height: number;
  orientation: "portrait" | "landscape";
  background: Record<string, any>;
  importedDocument: Record<string, any> | null;
  blocks: any[] | null;
};

export type ProjectEstimateApiTemplate = {
  id: string;
  workspaceId: string | null;
  ownerUserId: string | null;
  templateName: string;
  description: string;
  isSystemDefault: boolean;
  isOrganisationDefault: boolean;
  pageOrder: string[];
  settings: Record<string, any>;
  version: number;
  sourceTemplateId: string | null;
  createdAt: string;
  updatedAt: string;
  pages?: ProjectEstimateApiPage[];
};

export type ProjectEstimateApiInstance = {
  id: string;
  workspaceId: string;
  projectId: string | null;
  templateId: string | null;
  ownerUserId: string | null;
  pageOrder: string[];
  settings: Record<string, any>;
  status: string;
  createdAt: string;
  updatedAt: string;
  pages?: ProjectEstimateApiPage[];
};

class ProjectEstimateApiError extends Error {
  status: number;
  conflict: boolean;
  constructor(message: string, status: number, conflict = false) {
    super(message);
    this.status = status;
    this.conflict = conflict;
  }
}

async function authHeaders(workspaceId: string): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token || "";
  if (!token) throw new ProjectEstimateApiError("You must be signed in to use the Project Estimate builder.", 401);
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "x-workspace-id": workspaceId,
  };
}

const BASE_TEMPLATE_MAX_CLIENT_BYTES = 900 * 1024;
const LARGE_STRING_WARN_BYTES = 80 * 1024;
const BINARY_FIELD_PATTERN = /(dataUrl|imageDataUrl|base64|blob|blobUrl|fileBytes|arrayBuffer|pdfBytes|renderedPages|previewImage|thumbnailDataUrl|screenshot|htmlSnapshot|canvasState|editorHistory|undoStack|redoStack|selectedElement|activeSelection|popupPosition|dragState|resizeState|temporaryDrafts|importedFileContents|fileContents)$/i;
const ALLOWED_BLOCK_KEYS = new Set([
  "id",
  "type",
  "content",
  "design",
  "binding",
  "assetId",
  "storagePath",
  "publicUrl",
  "url",
  "src",
  "alt",
  "parentGroupId",
  "groupId",
  "children",
  "locked",
  "hidden",
]);
const ALLOWED_PAGE_BACKGROUND_KEYS = new Set([
  "backgroundColor",
  "backgroundImage",
  "backgroundStyle",
  "backgroundPosition",
  "backgroundSize",
  "color",
  "hiddenFromPdf",
  "source",
  "importedDocumentSlot",
]);

function byteSize(value: string): number {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(value).length;
  return unescape(encodeURIComponent(value)).length;
}

function safeObject(value: any): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function compactObject(value: Record<string, any>, allowedKeys: Set<string>) {
  return Object.entries(safeObject(value)).reduce((next, [key, entry]) => {
    if (allowedKeys.has(key) && entry !== undefined) next[key] = entry;
    return next;
  }, {} as Record<string, any>);
}

function stripUndefinedDeep(value: any): any {
  if (Array.isArray(value)) return value.map(stripUndefinedDeep);
  if (!value || typeof value !== "object") return value;
  return Object.entries(value).reduce((next, [key, entry]) => {
    if (entry === undefined) return next;
    next[key] = stripUndefinedDeep(entry);
    return next;
  }, {} as Record<string, any>);
}

function serializeTemplateBlock(block: any): Record<string, any> {
  const clean = compactObject(block, ALLOWED_BLOCK_KEYS);
  if (Array.isArray(clean.children)) {
    clean.children = clean.children.map(serializeTemplateBlock);
  }
  if (clean.content) clean.content = { ...safeObject(clean.content) };
  if (clean.design) clean.design = { ...safeObject(clean.design) };
  if (clean.binding) clean.binding = { ...safeObject(clean.binding) };
  return stripUndefinedDeep(clean);
}

function serializeTemplatePage(page: any, index: number): ProjectEstimateApiPage {
  const pageType = page?.page_type || page?.pageType || page?.id || "";
  const pageKey = page?.id || page?.pageKey || pageType;
  const background = compactObject(page?.design || page?.background || {}, ALLOWED_PAGE_BACKGROUND_KEYS);
  const importSlot = pageType === "standardInclusions"
    ? "standardInclusions"
    : pageType === "pricedPlans"
      ? "pricedPlans"
      : "";
  return {
    pageKey,
    pageName: page?.title || page?.pageName || pageType,
    pageType,
    pageOrder: index,
    width: 794,
    height: 1123,
    orientation: "portrait",
    background: stripUndefinedDeep({
      ...background,
      hiddenFromPdf: !!page?.hiddenFromPdf,
      source: page?.source || undefined,
      importedDocumentSlot: importSlot || undefined,
    }),
    importedDocument: null,
    blocks: Array.isArray(page?.blocks) ? page.blocks.map(serializeTemplateBlock) : [],
  };
}

export function findProjectEstimatePayloadHazards(value: any, path = "$"): Array<{ path: string; reason: string; bytes?: number }> {
  const hazards: Array<{ path: string; reason: string; bytes?: number }> = [];
  const visit = (entry: any, entryPath: string) => {
    const key = entryPath.split(".").pop() || "";
    if (typeof entry === "string") {
      const size = byteSize(entry);
      if (/^data:/i.test(entry) || /;base64,/i.test(entry)) {
        hazards.push({ path: entryPath, reason: "embedded data/base64 URL", bytes: size });
      } else if (BINARY_FIELD_PATTERN.test(key)) {
        hazards.push({ path: entryPath, reason: "forbidden binary/transient field", bytes: size });
      } else if (size > LARGE_STRING_WARN_BYTES && !/(text|heading|label|title|body|intro|notice|description|content)$/i.test(key)) {
        hazards.push({ path: entryPath, reason: "unexpected large string", bytes: size });
      }
      return;
    }
    if (Array.isArray(entry)) {
      if (BINARY_FIELD_PATTERN.test(key)) hazards.push({ path: entryPath, reason: "forbidden binary/transient array" });
      entry.forEach((child, index) => visit(child, `${entryPath}[${index}]`));
      return;
    }
    if (entry && typeof entry === "object") {
      if (BINARY_FIELD_PATTERN.test(key)) hazards.push({ path: entryPath, reason: "forbidden binary/transient object" });
      Object.entries(entry).forEach(([childKey, child]) => visit(child, `${entryPath}.${childKey}`));
    }
  };
  visit(value, path);
  return hazards;
}

function topLevelPayloadSizes(payload: Record<string, any>) {
  return Object.entries(payload).map(([key, value]) => ({
    field: key,
    bytes: byteSize(JSON.stringify(value ?? null)),
  })).sort((a, b) => b.bytes - a.bytes);
}

function largestPayloadFields(value: any) {
  const fields: Array<{ path: string; bytes: number }> = [];
  const visit = (entry: any, path: string) => {
    if (entry === undefined) return;
    if (entry === null || typeof entry !== "object") {
      fields.push({ path, bytes: byteSize(JSON.stringify(entry)) });
      return;
    }
    if (Array.isArray(entry)) {
      fields.push({ path, bytes: byteSize(JSON.stringify(entry)) });
      entry.forEach((child, index) => visit(child, `${path}[${index}]`));
      return;
    }
    fields.push({ path, bytes: byteSize(JSON.stringify(entry)) });
    Object.entries(entry).forEach(([key, child]) => visit(child, `${path}.${key}`));
  };
  visit(value, "$");
  return fields.sort((a, b) => b.bytes - a.bytes).slice(0, 5);
}

export function auditProjectEstimateBaseTemplatePayload(payload: Record<string, any>) {
  const json = JSON.stringify(payload);
  const pages = Array.isArray(payload?.pages) ? payload.pages : [];
  const blocks = pages.flatMap((page: any) => Array.isArray(page?.blocks) ? page.blocks : []);
  const hazards = findProjectEstimatePayloadHazards(payload);
  return {
    totalBytes: byteSize(json),
    totalMb: Number((byteSize(json) / 1024 / 1024).toFixed(3)),
    topLevelFields: topLevelPayloadSizes(payload).slice(0, 10),
    largestFields: largestPayloadFields(payload),
    largestHazards: hazards.slice().sort((a, b) => (b.bytes || 0) - (a.bytes || 0)).slice(0, 5),
    pageCount: pages.length,
    elementCount: blocks.length,
    dataUrlCount: hazards.filter((issue) => /data|base64/i.test(issue.reason)).length,
    importedDocumentFieldCount: hazards.filter((issue) => /imported/i.test(issue.path)).length,
    historyFieldCount: hazards.filter((issue) => /(History|undo|redo)/i.test(issue.path)).length,
  };
}

export function serializeProjectEstimateBaseTemplate(input: {
  pages: any[];
  pageOrder?: string[];
  settings?: Record<string, any>;
  forbiddenProjectValues?: string[];
}) {
  const pages = (Array.isArray(input?.pages) ? input.pages : []).map(serializeTemplatePage);
  const payload = stripUndefinedDeep({
    templateType: "project_estimate",
    version: input?.settings?.sourceTemplateVersion || input?.settings?.version || undefined,
    pages,
    pageOrder: Array.isArray(input?.pageOrder) && input.pageOrder.length
      ? input.pageOrder
      : pages.map((page) => page.pageKey),
    importSlots: input?.settings?.importSlots || {
      inclusions: { pageType: "standardInclusions", mode: "placeholder" },
      plans: { pageType: "pricedPlans", mode: "placeholder" },
    },
    settings: {
      ...safeObject(input?.settings),
      templateType: "project_estimate",
      importedDocumentsPolicy: "slots-only",
    },
    forbiddenProjectValues: Array.isArray(input?.forbiddenProjectValues) ? input.forbiddenProjectValues : [],
  });
  const audit = auditProjectEstimateBaseTemplatePayload(payload);
  const hazards = findProjectEstimatePayloadHazards(payload);
  if (hazards.length) {
    const largest = hazards.slice().sort((a, b) => (b.bytes || 0) - (a.bytes || 0))[0];
    throw new ProjectEstimateApiError(
      `Base template could not be saved because the request contained embedded files or was too large. Payload size: ${audit.totalMb} MB. Largest field: ${largest?.path || "unknown"}`,
      413,
    );
  }
  if (audit.totalBytes > BASE_TEMPLATE_MAX_CLIENT_BYTES) {
    throw new ProjectEstimateApiError(
      `Base template could not be saved because the request contained embedded files or was too large. Payload size: ${audit.totalMb} MB. Largest field: ${audit.topLevelFields[0]?.field || "unknown"}`,
      413,
    );
  }
  return { payload, audit };
}

async function request(path: string, { method = "GET", workspaceId, body }: { method?: string; workspaceId: string; body?: any }) {
  const headers = await authHeaders(workspaceId);
  const response = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify({ ...body, workspace_id: workspaceId }) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    const defaultMessage = response.status === 413
      ? "Base template could not be saved because the request contained embedded files or was too large."
      : `Request failed (${response.status})`;
    throw new ProjectEstimateApiError(payload?.error || defaultMessage, response.status, !!payload?.conflict);
  }
  return payload;
}

export { ProjectEstimateApiError };

export async function listTemplates(workspaceId: string): Promise<ProjectEstimateApiTemplate[]> {
  const payload = await request(`/api/project-estimate/templates?workspace_id=${encodeURIComponent(workspaceId)}`, { workspaceId });
  return payload.templates || [];
}

export async function getTemplate(workspaceId: string, templateId: string): Promise<ProjectEstimateApiTemplate> {
  const payload = await request(`/api/project-estimate/templates/${templateId}?workspace_id=${encodeURIComponent(workspaceId)}`, { workspaceId });
  return payload.template;
}

export async function createTemplate(workspaceId: string, input: {
  templateName: string;
  description?: string;
  pageOrder?: string[];
  settings?: Record<string, any>;
  pages: ProjectEstimateApiPage[];
  setAsOrganisationDefault?: boolean;
  sourceTemplateId?: string;
}): Promise<{ template: ProjectEstimateApiTemplate; pages: ProjectEstimateApiPage[] }> {
  const payload = await request("/api/project-estimate/templates", { method: "POST", workspaceId, body: input });
  return { template: payload.template, pages: payload.pages };
}

export async function updateTemplate(workspaceId: string, templateId: string, input: {
  templateName?: string;
  description?: string;
  pageOrder?: string[];
  settings?: Record<string, any>;
  pages?: ProjectEstimateApiPage[];
  setAsOrganisationDefault?: boolean;
  createVersionSnapshot?: boolean;
  versionLabel?: string;
}): Promise<{ template: ProjectEstimateApiTemplate; pages: ProjectEstimateApiPage[] | null }> {
  const payload = await request(`/api/project-estimate/templates/${templateId}`, { method: "PATCH", workspaceId, body: input });
  return { template: payload.template, pages: payload.pages };
}

export async function updateSystemBaseTemplate(workspaceId: string, input: {
  pages: ProjectEstimateApiPage[];
  pageOrder?: string[];
  settings?: Record<string, any>;
  forbiddenProjectValues?: string[];
}): Promise<{ message: string; templateId: string; version: number | null; pageCount: number; audit: ReturnType<typeof auditProjectEstimateBaseTemplatePayload> }> {
  const { payload: compactPayload, audit } = serializeProjectEstimateBaseTemplate(input);
  if (typeof console !== "undefined") {
    console.info("[project-estimate base-template] compact payload audit", audit);
  }
  const payload = await request("/api/project-estimate/base-template", { method: "POST", workspaceId, body: compactPayload });
  return {
    message: payload.message || "Project Estimate base template updated successfully.",
    templateId: payload.templateId || "",
    version: payload.version || null,
    pageCount: payload.pageCount || input.pages.length,
    audit,
  };
}

export async function deleteTemplate(workspaceId: string, templateId: string): Promise<void> {
  await request(`/api/project-estimate/templates/${templateId}`, { method: "DELETE", workspaceId });
}

export async function listTemplateVersions(workspaceId: string, templateId: string) {
  const payload = await request(`/api/project-estimate/templates/${templateId}/versions?workspace_id=${encodeURIComponent(workspaceId)}`, { workspaceId });
  return payload.versions || [];
}

export async function restoreTemplateVersion(workspaceId: string, templateId: string, versionId: string) {
  const payload = await request(`/api/project-estimate/templates/${templateId}/versions`, { method: "POST", workspaceId, body: { versionId } });
  return { template: payload.template as ProjectEstimateApiTemplate, pages: payload.pages as ProjectEstimateApiPage[] };
}

export async function getOrCreateInstance(workspaceId: string, { projectId, templateId }: { projectId?: string; templateId?: string }) {
  const params = new URLSearchParams({ workspace_id: workspaceId });
  if (projectId) params.set("projectId", projectId);
  if (templateId) params.set("templateId", templateId);
  const payload = await request(`/api/project-estimate/instances?${params.toString()}`, { workspaceId });
  return { instance: payload.instance as ProjectEstimateApiInstance, created: !!payload.created };
}

export async function saveInstance(workspaceId: string, instanceId: string, input: {
  pages?: ProjectEstimateApiPage[];
  pageOrder?: string[];
  settings?: Record<string, any>;
  status?: string;
  templateId?: string;
  expectedUpdatedAt?: string;
}): Promise<{ instance: ProjectEstimateApiInstance; pages: ProjectEstimateApiPage[] | null }> {
  const payload = await request(`/api/project-estimate/instances/${instanceId}`, { method: "PATCH", workspaceId, body: input });
  return { instance: payload.instance, pages: payload.pages };
}

export async function resetInstanceToTemplate(workspaceId: string, instanceId: string, templateId?: string) {
  const payload = await request(`/api/project-estimate/instances/${instanceId}`, {
    method: "PATCH",
    workspaceId,
    body: { action: "resetToTemplate", templateId },
  });
  return payload.instance as ProjectEstimateApiInstance;
}

// ── Builder <-> API page shape mapping ──────────────────────────────────────
// `builderPage` is the shape already used throughout EstimateBuilderWorkbook.js:
// { id, page_type, title, design, blocks, hiddenFromPdf?, source? }

export function builderPageToApiPage(builderPage: any, index: number, importedDocuments?: Record<string, any>): ProjectEstimateApiPage {
  const pageType = builderPage.page_type || builderPage.id || "";
  const importedDocument = pageType === "standardInclusions"
    ? importedDocuments?.inclusions || null
    : pageType === "pricedPlans"
      ? importedDocuments?.pricedPlans || null
      : null;
  return {
    pageKey: builderPage.id,
    pageName: builderPage.title || pageType,
    pageType,
    pageOrder: index,
    width: 794,
    height: 1123,
    orientation: "portrait",
    background: { ...(builderPage.design || {}), hiddenFromPdf: !!builderPage.hiddenFromPdf, source: builderPage.source || undefined },
    importedDocument,
    blocks: Array.isArray(builderPage.blocks) ? builderPage.blocks : null,
  };
}

export function apiPageToBuilderPageShell(apiPage: ProjectEstimateApiPage) {
  const { hiddenFromPdf, source, ...design } = apiPage.background || ({} as any);
  return {
    id: apiPage.pageKey,
    page_type: apiPage.pageType,
    title: apiPage.pageName,
    design,
    hiddenFromPdf: !!hiddenFromPdf,
    source: source || undefined,
    blocks: Array.isArray(apiPage.blocks) ? apiPage.blocks : null,
  };
}
