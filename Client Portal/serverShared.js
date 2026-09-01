import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabaseAdmin";
export { supabaseAdmin };

export const BUILDER_ROLES = new Set(["owner", "admin", "builder_admin", "builder_staff", "interior_designer", "sales"]);

export const DEFAULT_PORTAL_SECTIONS = {
  overview: true,
  documents: true,
  selections: true,
  variations: true,
  progress: true,
  messages: true,
  approvals: true,
};

export const DEFAULT_VISIBILITY = {
  commencementDate: false,
  completionDate: false,
  progressPercentage: false,
  currentStage: true,
  upcomingMilestones: false,
  supervisorDetails: false,
  projectEstimate: false,
  formalQuote: false,
  contractValue: false,
  progressPayments: false,
};

export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export function createInvitationToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function normaliseEmail(email = "") {
  return String(email || "").trim().toLowerCase();
}

export function mergePortalSettings(settings = {}) {
  return {
    ...settings,
    enabled_sections: { ...DEFAULT_PORTAL_SECTIONS, ...(settings.enabled_sections || {}) },
    visibility: { ...DEFAULT_VISIBILITY, ...(settings.visibility || {}) },
    branding: settings.branding || {},
    content: settings.content || {},
  };
}

export async function getAuthenticatedUser(req) {
  const auth = String(req.headers.authorization || "").trim();
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  if (!token) return { error: "Unauthorized: missing token", status: 401 };
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) return { error: "Unauthorized: invalid token", status: 401 };
  return { user: data.user };
}

export async function getProject(projectId) {
  if (!projectId) return { project: null };
  const { data, error } = await supabaseAdmin
    .from("builder_commercial_projects")
    .select("id, workspace_id, project_name, client_name, client_email, client_phone, site_address, status, currency, contract_total, source_quote_number, source_metadata, notes, created_at, updated_at")
    .eq("id", projectId)
    .maybeSingle();
  return { project: data || null, error };
}

export async function getWorkspaceMember(workspaceId, userId) {
  if (!workspaceId || !userId) return null;
  const { data } = await supabaseAdmin
    .from("workspace_members")
    .select("role, status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return data || null;
}

export async function getPortalSettings(workspaceId, projectId) {
  const { data, error } = await supabaseAdmin
    .from("client_portal_settings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) return { settings: null, error };
  return { settings: mergePortalSettings(data || {}) };
}

export async function ensurePortalSettings({ workspaceId, projectId, userId }) {
  const existing = await getPortalSettings(workspaceId, projectId);
  if (existing.settings?.id || existing.error) return existing;
  const { data, error } = await supabaseAdmin
    .from("client_portal_settings")
    .insert({ workspace_id: workspaceId, project_id: projectId, created_by: userId, updated_by: userId })
    .select("*")
    .single();
  return { settings: mergePortalSettings(data || {}), error };
}

export async function getPortalClients(workspaceId, projectId) {
  const { data, error } = await supabaseAdmin
    .from("client_portal_clients")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .neq("status", "revoked")
    .order("created_at", { ascending: true });
  return { clients: data || [], error };
}

export async function authorizePortalRequest({ project, user, requestedWorkspaceId = "", requestedMode = "client", requireBuilder = false }) {
  if (!project) return { allowed: false, status: 404, error: "Project not found." };
  const workspaceId = requestedWorkspaceId || project.workspace_id;
  if (workspaceId !== project.workspace_id) return { allowed: false, status: 404, error: "Project not found." };

  const member = await getWorkspaceMember(project.workspace_id, user.id);
  if (member && BUILDER_ROLES.has(member.role)) {
    return {
      allowed: true,
      access: "builder",
      mode: requestedMode === "preview" ? "preview" : "client",
      memberRole: member.role,
    };
  }

  if (requireBuilder) return { allowed: false, status: 403, error: "Builder access is required." };

  const [{ settings }, { clients }] = await Promise.all([
    getPortalSettings(project.workspace_id, project.id),
    getPortalClients(project.workspace_id, project.id),
  ]);
  const assignedClient = (clients || []).find((client) => {
    if (client.status !== "active") return false;
    if (client.user_id && client.user_id === user.id) return true;
    return normaliseEmail(client.client_email) === normaliseEmail(user.email) && client.accepted_at;
  });
  if (settings?.portal_enabled && !settings?.access_suspended && assignedClient) {
    return { allowed: true, access: "client", mode: "client", client: assignedClient };
  }

  return { allowed: false, status: 403, error: "You do not have access to this client portal." };
}

export async function recordPortalAudit({ workspaceId, projectId, userId = null, userRole = "unknown", action, relatedTable = null, relatedRecordId = null, metadata = {} }) {
  if (!workspaceId || !projectId || !action) return;
  await supabaseAdmin.from("client_portal_audit_events").insert({
    workspace_id: workspaceId,
    project_id: projectId,
    user_id: userId,
    user_role: userRole,
    action,
    related_table: relatedTable,
    related_record_id: relatedRecordId,
    metadata,
  });
}

export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

export function toMoney(value, currency = "AUD") {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(number);
}
