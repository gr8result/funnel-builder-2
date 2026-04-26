// Minimal worker — place at ./scripts/process-autoresponder-queue.js (overwrite)
const { createClient } = require("@supabase/supabase-js");
const sgMail = require("@sendgrid/mail");
const fetch = global.fetch || require("node-fetch");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SENDGRID_API_KEY) {
  console.error("Missing required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SENDGRID_API_KEY");
  process.exit(1);
}

sgMail.setApiKey(SENDGRID_API_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function pickQueued(limit = 50) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("email_autoresponder_queue")
    .select("*")
    .eq("status", "queued")
    .lte("scheduled_at", now)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function claimRow(id) {
  const { data, error } = await supabase
    .from("email_autoresponder_queue")
    .update({ status: "processing" })
    .eq("id", id)
    .eq("status", "queued")
    .select("*")
    .limit(1)
    .single();
  if (error) return null;
  return data;
}

async function fetchTemplateHtml(path) {
  if (!path || !NEXT_PUBLIC_SITE_URL) return null;
  const base = NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const url = `${base}/api/email/get-saved-email?path=${encodeURIComponent(String(path))}`;
  try {
    const r = await fetch(url);
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      console.warn(`Template fetch failed ${r.status}:`, t && t.slice(0,200));
      return null;
    }
    return await r.text();
  } catch (e) {
    console.warn("Template fetch error:", e && e.message);
    return null;
  }
}

async function resolveFromAddress(autoresponderId) {
  const { data: autos = [] } = await supabase.from("email_automations").select("id,user_id,from_email").eq("id", autoresponderId).limit(1);
  const auto = autos[0] || {};
  if (auto.from_email) return auto.from_email;
  if (auto.user_id) {
    const { data: accts = [] } = await supabase.from("accounts").select("email").eq("user_id", auto.user_id).limit(1);
    return accts[0]?.email || null;
  }
  return null;
}

async function markSent(id, attempts) {
  await supabase.from("email_autoresponder_queue").update({ status: "sent", sent_at: new Date().toISOString(), attempts: (attempts||0)+1 }).eq("id", id);
}
async function markFailed(id, err, attempts) {
  await supabase.from("email_autoresponder_queue").update({ status: "failed", last_error: String(err).slice(0,2000), attempts: (attempts||0)+1 }).eq("id", id);
}

async function sendRow(row) {
  const claimed = await claimRow(row.id);
  if (!claimed) return;
  try {
    const from = await resolveFromAddress(row.autoresponder_id);
    if (!from) throw new Error("No from address configured for autoresponder");
    let html = row.html || null;
    if (!html && row.template_path) html = await fetchTemplateHtml(row.template_path);
    if (!html) throw new Error("Template HTML not found: " + String(row.template_path));
    const msg = { to: row.to_email, from, subject: row.subject || "(no subject)", html };
    await sgMail.send(msg);
    await markSent(row.id, row.attempts);
    console.log("Sent:", row.id, row.to_email);
  } catch (err) {
    console.error("Send failed:", row.id, row.to_email, err && (err.response?.body || err.message || err));
    await markFailed(row.id, err && (err.response?.body || err.message) || String(err), row.attempts);
  }
}

(async function main(){
  try {
    console.log("Worker started", new Date().toISOString());
    const rows = await pickQueued(50);
    console.log("Queued rows found:", rows.length);
    if (!rows.length) return process.exit(0);
    for (const r of rows) {
      // sequential
      // eslint-disable-next-line no-await-in-loop
      await sendRow(r);
    }
    console.log("Worker finished");
    process.exit(0);
  } catch (e) {
    console.error("Worker crashed", e && (e.message || e));
    process.exit(2);
  }
})();