import { createClient } from "@supabase/supabase-js";
import { withWorkspace } from "../../../../lib/withWorkspace";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getUserIdFromAuthHeader(req) {
  const auth = (req.headers.authorization || "").trim();
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.split(" ")[1];
  try {
    const { data } = await supabaseAdmin.auth.getUser(token);
    return data?.user?.id || null;
  } catch {
    return null;
  }
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const authHeader = (req.headers.authorization || "").trim();
    const srk = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
    let requestingUserId = null;
    let allowed = false;

    if (authHeader === srk) {
      allowed = true;
    } else if (authHeader.toLowerCase().startsWith("bearer ")) {
      requestingUserId = await getUserIdFromAuthHeader(req);
      if (requestingUserId) allowed = true;
    }

    if (!allowed) return res.status(403).json({ ok: false, error: "Forbidden: invalid Authorization" });

    const { autoresponder_id, list_id } = req.body || {};
    if (!autoresponder_id || !list_id) return res.status(400).json({ ok: false, error: "Missing autoresponder_id or list_id" });

    const { data: autoRows = [] } = await supabaseAdmin.from("email_automations").select("id,user_id,subject,template_path").eq("id", autoresponder_id).limit(1);
    const automation = autoRows[0] || {};

    const { data: leads, error: leadsErr } = await supabaseAdmin.from("leads").select("id,email,name,user_id").eq("list_id", list_id);
    if (leadsErr) return res.status(500).json({ ok: false, error: leadsErr.message || String(leadsErr) });

    const recipients = (leads || []).filter(l => l && l.email).map(l => ({ lead_id: l.id, to_email: l.email, to_name: l.name || null, lead_user_id: l.user_id || null }));
    if (!recipients.length) return res.status(200).json({ ok: true, added: 0, skipped: 0 });

    const emails = recipients.map(r => r.to_email.toLowerCase());
    const CHUNK = 500;
    const existingSet = new Set();
    for (let i = 0; i < emails.length; i += CHUNK) {
      const chunk = emails.slice(i, i + CHUNK);
      const { data: existing = [] } = await supabaseAdmin.from("email_autoresponder_queue").select("to_email").eq("autoresponder_id", autoresponder_id).in("to_email", chunk);
      existing.forEach(e => existingSet.add(String(e.to_email).toLowerCase()));
    }

    const inserts = [];
    const skippedRecipients = [];
    recipients.forEach(r => {
      const uid = r.lead_user_id || automation.user_id || requestingUserId || null;
      if (!uid) skippedRecipients.push({ email: r.to_email, reason: "missing user_id" });
      else if (!existingSet.has(String(r.to_email).toLowerCase())) {
        inserts.push({
          user_id: uid,
          autoresponder_id,
          list_id,
          lead_id: r.lead_id,
          to_email: r.to_email,
          to_name: r.to_name,
          subject: automation?.subject || null,
          template_path: automation?.template_path || null,
          scheduled_at: new Date().toISOString(),
          status: "queued",
          attempts: 0,
          created_at: new Date().toISOString()
        });
      }
    });

    let added = 0;
    const errors = [];
    const BATCH = 200;
    for (let i = 0; i < inserts.length; i += BATCH) {
      const chunk = inserts.slice(i, i + BATCH);
      const { error } = await supabaseAdmin.from("email_autoresponder_queue").insert(chunk);
      if (error) errors.push(error.message || String(error));
      else added += chunk.length;
    }

    const skipped = (recipients.length - inserts.length) + skippedRecipients.length;
    return res.status(200).json({ ok: true, added, skipped, errors: errors.concat(skippedRecipients.length ? [{ skippedRecipients }] : []) });
  } catch (err) {
    console.error("ENROLL_EXISTING ERROR:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
}

export default withWorkspace(handler);
