// /pages/api/jobboard/send-work-order.js
// Sends a work-order / notification email from the Job Board automation system.
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "../../../lib/sendEmail";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const FROM_EMAIL    = process.env.DEFAULT_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || "no-reply@gr8result.com";

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function multilineToHtml(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((l) => `<p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:15px;color:#0f172a;">${l}</p>`)
    .join("");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Verify session
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

  const { to, subject, body, job_name, task_name } = req.body || {};
  if (!to || !subject || !body) return res.status(400).json({ error: "to, subject and body are required" });

  // Validate recipient emails
  const recipients = String(to).split(/[,;]+/).map((e) => e.trim()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if (!recipients.length) return res.status(400).json({ error: "No valid recipient email addresses" });

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f7fb;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:10px;padding:32px;border:1px solid #e2e8f0;">
    <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-family:Arial,sans-serif;">Work Order</p>
    <h2 style="margin:0 0 20px;font-size:20px;color:#0f172a;font-family:Arial,sans-serif;">${subject}</h2>
    ${multilineToHtml(body)}
    <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0;" />
    <p style="margin:0;font-size:12px;color:#94a3b8;font-family:Arial,sans-serif;">Sent via Job Board${job_name ? ` · ${job_name}` : ""}${task_name ? ` · ${task_name}` : ""}</p>
  </div>
</body></html>`;

  const result = await sendEmail({
    to: recipients.length === 1 ? recipients[0] : recipients,
    from: FROM_EMAIL,
    subject,
    html,
    text: body,
  });

  if (!result.ok && !result.skipped) return res.status(500).json({ error: result.error || "Failed to send" });

  return res.status(200).json({ ok: true, sent: recipients.length });
}
