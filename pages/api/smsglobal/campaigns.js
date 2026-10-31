import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withWorkspace } from "../../../lib/withWorkspace";

const ALLOWED_ROLES = ["owner", "admin", "marketing"];
const ALLOWED_UNITS = new Set(["minutes", "hours", "days"]);

function normalizeSteps(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) return null;
  const steps = [];
  for (const step of value) {
    const delay = Number(step?.delay ?? 0);
    const unit = String(step?.unit || "minutes").trim().toLowerCase();
    const message = String(step?.message || "").trim();
    if (!Number.isFinite(delay) || delay < 0 || delay > 525600 || !ALLOWED_UNITS.has(unit) || !message || message.length > 1600) {
      return null;
    }
    steps.push({ templateId: String(step?.templateId || ""), delay, unit, message });
  }
  return steps;
}

function parseScheduledAt(value) {
  if (value === null || value === undefined || value === "") return { value: null };
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) return { error: "Choose a future schedule time." };
  return { value: date.toISOString() };
}

async function handler(req, res) {
  if (process.env.MARKETING_CONTACTS_SCHEMA_READY !== "true") {
    return res.status(503).json({ ok: false, error: "SMS campaign storage requires the central contacts migration." });
  }

  if (req.method === "GET") {
    const campaignId = String(req.query?.id || "").trim();
    let query = supabaseAdmin
      .from("sms_marketing_campaigns")
      .select("id,workspace_id,user_id,name,audience_type,lead_id,list_id,steps,scheduled_at,status,created_at,updated_at,cancelled_at")
      .eq("workspace_id", req.workspaceId)
      .order("updated_at", { ascending: false });
    if (campaignId) query = query.eq("id", campaignId);
    const { data, error } = await query;
    if (error) return res.status(503).json({ ok: false, error: "Could not load saved SMS campaigns." });
    return res.status(200).json({ ok: true, campaigns: data || [] });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const body = req.body || {};
  if (body.action === "cancel") {
    const campaignId = String(body.id || "").trim();
    if (!campaignId) return res.status(400).json({ ok: false, error: "Campaign id is required." });
    const { data, error } = await supabaseAdmin.rpc("cancel_sms_marketing_campaign", {
      p_workspace_id: req.workspaceId,
      p_campaign_id: campaignId,
      p_user_id: req.user.id,
    });
    if (error) return res.status(503).json({ ok: false, error: "Campaign cancellation is unavailable until the migration is applied." });
    if (data === -1) return res.status(404).json({ ok: false, error: "Campaign not found in this workspace." });
    if (data === -2) return res.status(409).json({ ok: false, error: "Campaign delivery is in progress or already finished; it cannot be cancelled safely." });
    return res.status(200).json({ ok: true, campaign_id: campaignId, cancelled_messages: Number(data) || 0 });
  }

  const name = String(body.name || "").trim().slice(0, 200);
  const audienceType = String(body.audience_type || "").trim().toLowerCase();
  const leadId = audienceType === "lead" ? String(body.lead_id || "").trim() : null;
  const listId = audienceType === "list" ? String(body.list_id || "").trim() : null;
  const steps = normalizeSteps(body.steps);
  const scheduled = parseScheduledAt(body.scheduled_at);
  if (!name) return res.status(400).json({ ok: false, error: "Campaign name is required." });
  if (!steps) return res.status(400).json({ ok: false, error: "Add one to three valid SMS steps." });
  if (!scheduled.value && scheduled.error) return res.status(400).json({ ok: false, error: scheduled.error });
  if (scheduled.error) return res.status(400).json({ ok: false, error: scheduled.error });
  if (audienceType === "lead" && !leadId) return res.status(400).json({ ok: false, error: "Select a CRM contact." });
  if (audienceType === "list" && !listId) return res.status(400).json({ ok: false, error: "Select a contact list." });
  if (!["lead", "list"].includes(audienceType)) return res.status(400).json({ ok: false, error: "Select a valid audience." });

  const relation = audienceType === "lead" ? "leads" : "lead_lists";
  const audienceId = audienceType === "lead" ? leadId : listId;
  const { data: audience, error: audienceError } = await supabaseAdmin
    .from(relation)
    .select("id")
    .eq("id", audienceId)
    .eq("workspace_id", req.workspaceId)
    .maybeSingle();
  if (audienceError) return res.status(503).json({ ok: false, error: "Could not verify the selected audience." });
  if (!audience) return res.status(404).json({ ok: false, error: "Selected audience was not found in this workspace." });

  const campaignId = String(body.id || "").trim();
  const payload = {
    workspace_id: req.workspaceId,
    user_id: req.user.id,
    name,
    audience_type: audienceType,
    lead_id: leadId,
    list_id: listId,
    steps,
    scheduled_at: scheduled.value,
    updated_at: new Date().toISOString(),
  };

  let result;
  if (campaignId) {
    result = await supabaseAdmin.from("sms_marketing_campaigns")
      .update(payload)
      .eq("id", campaignId)
      .eq("workspace_id", req.workspaceId)
      .eq("user_id", req.user.id)
      .eq("status", "draft")
      .select("id,workspace_id,user_id,name,audience_type,lead_id,list_id,steps,scheduled_at,status,created_at,updated_at")
      .maybeSingle();
    if (!result.error && !result.data) return res.status(409).json({ ok: false, error: "Only your saved draft campaigns can be edited." });
  } else {
    result = await supabaseAdmin.from("sms_marketing_campaigns")
      .insert({ ...payload, status: "draft" })
      .select("id,workspace_id,user_id,name,audience_type,lead_id,list_id,steps,scheduled_at,status,created_at,updated_at")
      .single();
  }
  if (result.error) return res.status(503).json({ ok: false, error: "Could not save the SMS campaign." });
  return res.status(campaignId ? 200 : 201).json({ ok: true, campaign: result.data });
}

export default withWorkspace(handler, { roles: ALLOWED_ROLES });
