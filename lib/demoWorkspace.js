import { supabaseAdmin } from "./supabaseAdmin";

export const DEMO_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_WORKSPACE_SLUG = "gr8-result-demo";
export const DEMO_WORKSPACE_NAME = "Gr8 Result Demo Company";

function clean(value) {
  return String(value ?? "").trim();
}

export function requestWorkspaceId(req) {
  return clean(
    req?.query?.workspace_id ||
      req?.query?.workspaceId ||
      req?.body?.workspace_id ||
      req?.body?.workspaceId ||
      req?.body?.metadata?.workspace_id ||
      req?.body?.metadata?.workspaceId ||
      req?.headers?.["x-workspace-id"] ||
      ""
  );
}

export async function isDemoWorkspace(workspaceId) {
  const id = clean(workspaceId);
  if (!id) return false;
  const { data, error } = await supabaseAdmin
    .from("workspaces")
    .select("id, is_demo")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.warn("[demoWorkspace] isDemoWorkspace lookup failed:", error.message || error);
    return false;
  }
  return data?.is_demo === true;
}

export async function getWorkspaceDemoState(workspaceId) {
  const id = clean(workspaceId);
  if (!id) return { isDemo: false, workspace: null };
  const { data, error } = await supabaseAdmin
    .from("workspaces")
    .select("id, name, slug, plan, is_demo")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.warn("[demoWorkspace] workspace lookup failed:", error.message || error);
    return { isDemo: false, workspace: null, error };
  }
  return { isDemo: data?.is_demo === true, workspace: data || null };
}

export async function getRequestDemoState(req) {
  return getWorkspaceDemoState(requestWorkspaceId(req));
}

export async function ensureDemoCompanyForUser(userId) {
  const uid = clean(userId);
  if (!uid) throw new Error("Missing user id");

  const { data: workspace, error: workspaceError } = await supabaseAdmin
    .from("workspaces")
    .upsert({
      id: DEMO_WORKSPACE_ID,
      name: DEMO_WORKSPACE_NAME,
      slug: DEMO_WORKSPACE_SLUG,
      plan: "growth",
      is_demo: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" })
    .select("id, name, slug, plan, is_demo")
    .single();
  if (workspaceError) throw workspaceError;

  const { error: memberError } = await supabaseAdmin
    .from("workspace_members")
    .upsert({
      workspace_id: DEMO_WORKSPACE_ID,
      user_id: uid,
      role: "owner",
      status: "active",
      updated_at: new Date().toISOString(),
    }, { onConflict: "workspace_id,user_id" });
  if (memberError) throw memberError;

  return workspace;
}

export async function recordDemoAction({
  workspaceId = DEMO_WORKSPACE_ID,
  actionType,
  provider,
  target,
  payload = {},
  simulatedResult = {},
  userId = null,
} = {}) {
  const id = clean(workspaceId);
  if (!id || !actionType) return { ok: false, skipped: true };
  try {
    const { error } = await supabaseAdmin
      .from("demo_action_log")
      .insert({
        workspace_id: id,
        action_type: clean(actionType),
        provider: clean(provider) || null,
        target: clean(target) || null,
        payload,
        simulated_result: simulatedResult,
        created_by: clean(userId) || null,
      });
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    console.warn("[demoWorkspace] demo action log failed:", error.message || error);
    return { ok: false, error: error.message || String(error) };
  }
}

export async function demoSimulationResult({
  workspaceId,
  actionType,
  provider,
  target,
  payload,
  userId,
  message,
} = {}) {
  const result = {
    ok: true,
    demo: true,
    simulated: true,
    message: message || `Demo ${actionType || "action"} simulated - no external action performed.`,
  };
  await recordDemoAction({
    workspaceId,
    actionType,
    provider,
    target,
    payload,
    simulatedResult: result,
    userId,
  });
  return result;
}
