import { withWorkspace } from "../../../lib/withWorkspace";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { resolveVerifiedSender } from "../../../lib/email/verifiedSender";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "POST only." });
  }
  if (process.env.MARKETING_CONTACTS_SCHEMA_READY !== "true") {
    return res.status(503).json({ ok: false, error: "Central contacts and consent schema is not enabled." });
  }

  const workspaceId = req.workspaceId;
  const userId = req.user.id;
  const body = req.body || {};
  const listId = String(body.list_id || "").trim();
  const listTable = String(body.list_table || "lead_lists").trim();
  const subject = String(body.subject || "").trim();
  const html = String(body.html_content || "");
  const scheduledAt = new Date(body.scheduled_at || "");

  if (!listId || !["lead_lists", "email_lists"].includes(listTable)) {
    return res.status(400).json({ ok: false, error: "Choose a valid workspace marketing list." });
  }
  if (!subject || !html) return res.status(400).json({ ok: false, error: "Subject and HTML content are required." });
  if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) {
    return res.status(400).json({ ok: false, error: "Schedule time must be now or later." });
  }

  try {
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("workspace_members")
      .select("role,status")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (membershipError || !membership || !["owner", "admin", "marketing"].includes(membership.role)) {
      return res.status(403).json({ ok: false, error: "Marketing schedule permission is required." });
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from("accounts")
      .select("sendgrid_from_email,sendgrid_from_name,sendgrid_reply_to,email,dkim_domain,dkim_verified")
      .eq("user_id", userId)
      .maybeSingle();
    if (accountError) return res.status(503).json({ ok: false, error: "Sender settings could not be verified." });
    const verifiedSender = resolveVerifiedSender(account || {}, process.env.SENDGRID_FROM_EMAIL || "");
    if (!verifiedSender.ok) return res.status(412).json({ ok: false, error: verifiedSender.error });

    const { data: eligibleRows, error: eligibilityError } = await supabaseAdmin.rpc("eligible_email_marketing_contacts", {
      p_workspace_id: workspaceId,
      p_list_table: listTable,
      p_list_id: listId,
    });
    if (eligibilityError) return res.status(503).json({ ok: false, error: "Current membership and consent cannot be verified." });
    const uniqueEligibleIds = [...new Set((eligibleRows || []).map((row) => row.contact_id).filter(Boolean))];
    if (!uniqueEligibleIds.length) return res.status(400).json({ ok: false, error: "No list contacts currently have valid email marketing permission." });

    const broadcastPayload = {
      user_id: userId,
      workspace_id: workspaceId,
      name: String(body.name || subject).trim().slice(0, 200),
      title: String(body.name || subject).trim().slice(0, 200),
      subject: subject.slice(0, 998),
      html_content: html,
      from_email: verifiedSender.email,
      from_name: String(account?.sendgrid_from_name || process.env.SENDGRID_FROM_NAME || "GR8 RESULT").trim(),
      reply_to: EMAIL_RE.test(String(body.reply_to || account?.sendgrid_reply_to || account?.email || ""))
        ? String(body.reply_to || account?.sendgrid_reply_to || account?.email).trim()
        : null,
      audience_type: "list",
      audience_list_table: listTable,
      list_id: listId,
      scheduled_at: scheduledAt.toISOString(),
      status: "draft",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data: broadcast, error: broadcastError } = await supabaseAdmin
      .from("email_broadcasts")
      .insert(broadcastPayload)
      .select("id")
      .single();
    if (broadcastError) return res.status(500).json({ ok: false, error: "Could not save the scheduled broadcast." });

    const deliveryRows = uniqueEligibleIds.map((contactId) => ({
      workspace_id: workspaceId,
      broadcast_id: broadcast.id,
      contact_id: contactId,
      scheduled_at: scheduledAt.toISOString(),
      status: "pending",
      attempt_count: 0,
      created_at: new Date().toISOString(),
    }));
    for (let offset = 0; offset < deliveryRows.length; offset += 500) {
      const { error } = await supabaseAdmin.from("email_broadcast_deliveries").insert(deliveryRows.slice(offset, offset + 500));
      if (error) return res.status(500).json({ ok: false, broadcast_id: broadcast.id, error: "Broadcast remains an unsent draft because recipient scheduling failed." });
    }

    const { error: activateError } = await supabaseAdmin
      .from("email_broadcasts")
      .update({ status: "scheduled", updated_at: new Date().toISOString() })
      .eq("id", broadcast.id)
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .eq("status", "draft");
    if (activateError) return res.status(500).json({ ok: false, broadcast_id: broadcast.id, error: "Broadcast remains unsent because scheduling could not be finalized." });

    return res.status(201).json({ ok: true, broadcast_id: broadcast.id, scheduled_at: scheduledAt.toISOString(), recipients: uniqueEligibleIds.length });
  } catch (error) {
    console.error("Schedule broadcast failed:", error?.message || error);
    return res.status(500).json({ ok: false, error: "Could not schedule this broadcast." });
  }
}

export default withWorkspace(handler, { roles: ["owner", "admin", "marketing"] });
