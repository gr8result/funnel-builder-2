import { supabase } from "../utils/supabase-client";

export async function loadClientPortalProject({ projectId, workspaceId = "", mode = "client" }) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token || "";
  if (!token) {
    const error = new Error("You must sign in to access this client portal.");
    error.status = 401;
    throw error;
  }

  const params = new URLSearchParams();
  params.set("projectId", projectId || "");
  if (workspaceId) params.set("workspace_id", workspaceId);
  if (mode) params.set("mode", mode);

  const response = await fetch(`/api/client-portal/project?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Could not load the client portal.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function authFetch(url, options = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token || "";
  if (!token) {
    const error = new Error("You must sign in to continue.");
    error.status = 401;
    throw error;
  }
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Request failed.");
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function loadPortalSettings({ projectId, workspaceId = "" }) {
  const params = new URLSearchParams({ projectId });
  if (workspaceId) params.set("workspace_id", workspaceId);
  return authFetch(`/api/client-portal/settings?${params.toString()}`);
}

export async function savePortalSettings({ projectId, workspaceId = "", payload }) {
  return authFetch("/api/client-portal/settings", {
    method: "PATCH",
    body: JSON.stringify({ projectId, workspace_id: workspaceId, ...payload }),
  });
}

export async function sendPortalInvitation({ projectId, workspaceId = "", clientId = "" }) {
  return authFetch("/api/client-portal/invitations", {
    method: "POST",
    body: JSON.stringify({ projectId, workspace_id: workspaceId, clientId }),
  });
}

export async function sendPortalMessage({ projectId, workspaceId = "", body, parentMessageId = "", attachments = [] }) {
  return authFetch("/api/client-portal/messages", {
    method: "POST",
    body: JSON.stringify({ projectId, workspace_id: workspaceId, body, parentMessageId, attachments }),
  });
}

export async function submitPortalApproval({ projectId, workspaceId = "", approvalId, action, comment, clientName, confirmed }) {
  return authFetch("/api/client-portal/approvals", {
    method: "POST",
    body: JSON.stringify({ projectId, workspace_id: workspaceId, approvalId, action, comment, clientName, confirmed }),
  });
}

export async function loadPortalAudit({ projectId, workspaceId = "" }) {
  const params = new URLSearchParams({ projectId });
  if (workspaceId) params.set("workspace_id", workspaceId);
  return authFetch(`/api/client-portal/audit?${params.toString()}`);
}

export async function activatePortalInvitation(token) {
  return authFetch("/api/client-portal/activate", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}
