import { createClient } from "@supabase/supabase-js";
import { guardEmailSend } from "../../../../lib/emailValidation";
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

async function findSavedAutoresponderIdByUniqueFields({ name, created_at }) {
  if (!name) return null;
  if (created_at) {
    const { data: exact = [] } = await supabaseAdmin
      .from("email_automations")
      .select("id")
      .eq("name", name)
      .eq("created_at", created_at)
      .limit(1);
    if (exact && exact.length) return exact[0].id;
  }
  const { data: rows = [] } = await supabaseAdmin
    .from("email_automations")
    .select("id")
    .ilike("name", name)
    .order("created_at", { ascending: false })
    .limit(1);
  if (rows && rows.length) return rows[0].id;
  return null;
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed", data: null });

  try {
    const requestingUserId = await getUserIdFromAuthHeader(req);
    const b = req.body || {};
    const {
      autoresponder_id,
      name,
      subject,
      list_id,
      template_path,
      from_name,
      from_email,
      reply_to,
    } = b;

    // Validate required fields (frontend should send list_id)
    if (!name || !subject || typeof list_id === "undefined" || list_id === null) {
      return res.status(400).json({ ok: false, error: "Missing required: name, subject, list_id", data: null });
    }

    const now = new Date().toISOString();
    let savedId = null;

    if (autoresponder_id) {
      const { data, error } = await supabaseAdmin
        .from("email_automations")
        .update({
          name,
          subject,
          list_id,
          template_path: template_path || null,
          from_name: from_name || null,
          from_email: from_email || null,
          reply_to: reply_to || null,
          updated_at: now,
        })
        .eq("id", autoresponder_id)
        .select()
        .limit(1);

      if (error) throw error;
      if (data && Array.isArray(data) && data[0] && data[0].id) savedId = data[0].id;
      else if (data && data.id) savedId = data.id;
      if (!savedId) {
        const { data: found = [] } = await supabaseAdmin
          .from("email_automations")
          .select("id")
          .eq("id", autoresponder_id)
          .limit(1);
        if (found && found.length) savedId = found[0].id;
      }
    } else {
      const payload = {
        name,
        subject,
        list_id,
        template_path: template_path || null,
        from_name: from_name || null,
        from_email: from_email || null,
        reply_to: reply_to || null,
        is_active: true,
        created_at: now,
        updated_at: now,
      };
      if (requestingUserId) payload.user_id = requestingUserId;

      const { data, error } = await supabaseAdmin.from("email_automations").insert([payload], { returning: "representation" });
      if (error) throw error;

      if (data && Array.isArray(data) && data[0] && data[0].id) {
        savedId = data[0].id;
      } else if (data && data.id) {
        savedId = data.id;
      } else {
        savedId = await findSavedAutoresponderIdByUniqueFields({ name, created_at: now });
      }
    }

    if (!savedId) return res.status(500).json({ ok: false, error: "Save did not return id", data: null });

    const enroll = await enrollMembersToQueue(savedId, list_id, subject, template_path, requestingUserId);
    return res.status(200).json({ ok: true, data: { id: savedId }, enroll });
  } catch (err) {
    console.error("SAVE ERROR:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err), data: null });
  }
}

async function enrollMembersToQueue(autoresponderId, listId, subject, templatePath, userIdFallback = null) {
  if (!autoresponderId || !listId) return { ok: true, added: 0, skipped: 0 };

  const { data: autoRows = [] } = await supabaseAdmin.from("email_automations").select("id,user_id").eq("id", autoresponderId).limit(1);
  const automation = autoRows[0] || {};

  const { data: leads, error: leadsErr } = await supabaseAdmin.from("leads").select("id,email,name,user_id").eq("list_id", listId);
  if (leadsErr) return { ok: false, error: leadsErr.message || String(leadsErr) };

  const recipients = (leads || []).filter(l => l && l.email).map(l => ({ lead_id: l.id, to_email: l.email, to_name: l.name || null, lead_user_id: l.user_id || null }));
  if (!recipients.length) return { ok: true, added: 0, skipped: 0 };

  // ✅ Check email limit before enqueueing
  const userId = automation.user_id || userIdFallback;
  if (userId) {
    try {
      await guardEmailSend(userId, recipients.length);
    } catch (limitErr) {
      return { 
        ok: false, 
        error: limitErr.message,
        code: limitErr.code,
        details: limitErr.details 
      };
    }
  }

  const emails = recipients.map(r => r.to_email.toLowerCase());
  const CHUNK = 500;
  const existingSet = new Set();
  for (let i = 0; i < emails.length; i += CHUNK) {
    const chunk = emails.slice(i, i + CHUNK);
    const { data: existing = [] } = await supabaseAdmin.from("email_autoresponder_queue").select("to_email").eq("autoresponder_id", autoresponderId).in("to_email", chunk);
    existing.forEach(e => existingSet.add(String(e.to_email).toLowerCase()));
  }

  const inserts = [];
  const skippedRecipients = [];

  recipients.forEach(r => {
    const uid = r.lead_user_id || automation.user_id || userIdFallback || null;
    if (!uid) {
      skippedRecipients.push({ email: r.to_email, reason: "missing user_id" });
    } else if (!existingSet.has(String(r.to_email).toLowerCase())) {
      inserts.push({
        user_id: uid,
        autoresponder_id: autoresponderId,
        list_id: listId,
        lead_id: r.lead_id,
        to_email: r.to_email,
        to_name: r.to_name,
        subject: subject || null,
        template_path: templatePath || null,
        scheduled_at: new Date().toISOString(),
        status: "queued",
        attempts: 0,
        created_at: new Date().toISOString(),
      });
    }
  });

  let added = 0;
  const errors = [];
  const BATCH = 200;
  for (let i = 0; i < inserts.length; i += BATCH) {
    const chunk = inserts.slice(i, i + BATCH);
    const { error } = await supabaseAdmin.from("email_autoresponder_queue").insert(chunk);
    if (error) errors.push(error.message || String(error)); else added += chunk.length;
  }

  const skipped = (recipients.length - inserts.length) + skippedRecipients.length;
  return { ok: true, added, skipped, errors: errors.concat(skippedRecipients.length ? [{ skippedRecipients }] : []) };
}

export default withWorkspace(handler);
