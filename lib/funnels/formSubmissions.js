import { supabaseAdmin } from "../supabaseAdmin";

let override = null;
export function setFunnelFormDb(client) { override = client; }
const db = () => override || supabaseAdmin;
const error = (message, status) => Object.assign(new Error(message), { status });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function syncFunnelSubmission(id) {
  const result = await db().rpc("funnel_sync_submission", { p_submission_id: id });
  if (result.error || !result.data) {
    console.error("[funnels/forms] CRM delivery queued", id, result.error?.code || "CRM sync failed");
    return { ok: false };
  }
  return { ok: true, leadId: result.data };
}

export async function captureFunnelSubmission(body) {
  if (![body.funnel_id, body.step_id, body.submission_key].every((value) => uuid.test(String(value || "")))) {
    throw error("Invalid funnel form. Refresh the page and try again.", 400);
  }
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw error("Enter a valid email address", 422);
  const { data: funnel, error: funnelError } = await db().from("funnels")
    .select("id,name,slug,owner_user_id,workspace_id,default_list_id,notify_email")
    .eq("id", body.funnel_id).eq("status", "published").eq("is_master_template", false).maybeSingle();
  if (funnelError) throw funnelError;
  if (!funnel?.owner_user_id || !funnel.workspace_id || !/^[a-z0-9-]{1,80}$/.test(String(funnel.slug || ""))) throw error("This funnel is no longer accepting enquiries", 404);
  const { data: step, error: stepError } = await db().from("funnel_steps").select("id")
    .eq("id", body.step_id).eq("funnel_id", funnel.id).maybeSingle();
  if (stepError) throw stepError;
  if (!step) throw error("Funnel page not found", 404);
  if (funnel.default_list_id) {
    const result = await db().from("email_lists").select("id,user_id").eq("id", funnel.default_list_id).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data || result.data.user_id !== funnel.owner_user_id) throw error("The funnel's configured email list needs administrator attention", 503);
  }
  const fields = { ...body, email, name: String(body.name || "").trim().slice(0, 500) };
  for (const key of ["funnel_id", "step_id", "submission_key", "list_id", "notify_to", "success_url", "tags", "user_id", "owner_user_id", "workspace_id"]) delete fields[key];
  const inserted = await db().from("form_submissions").insert({
    user_id: funnel.owner_user_id, workspace_id: funnel.workspace_id, funnel_id: funnel.id,
    step_id: step.id, submission_key: body.submission_key, list_id: funnel.default_list_id || null,
    name: fields.name || null, email, payload: { fields, funnel_name: funnel.name },
  }).select("id").single();
  let submission = inserted.data;
  let duplicate = false;
  if (inserted.error?.code === "23505") {
    const existing = await db().from("form_submissions").select("id").eq("funnel_id", funnel.id)
      .eq("step_id", step.id).eq("submission_key", body.submission_key).maybeSingle();
    if (existing.error) throw existing.error;
    submission = existing.data;
    duplicate = true;
  } else if (inserted.error) throw inserted.error;
  if (!submission?.id) throw error("The enquiry could not be recorded. Please retry.", 503);
  const sync = await syncFunnelSubmission(submission.id);
  return { funnel, fields, duplicate, synced: sync.ok };
}

export async function retryPendingFunnelSubmissions() {
  const result = await db().from("form_submissions").select("id").not("submission_key", "is", null)
    .is("crm_synced_at", null).order("id", { ascending: true }).limit(50);
  if (result.error) throw result.error;
  const results = [];
  for (const row of result.data || []) results.push(await syncFunnelSubmission(row.id));
  return results;
}
