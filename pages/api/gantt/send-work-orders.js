// pages/api/gantt/send-work-orders.js
// Send a work order email to every contact assigned to tasks in a Gantt project.
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "../../../lib/sendEmail";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const FROM_EMAIL   = process.env.SENDGRID_FROM_EMAIL || "no-reply@gr8result.com";
const FROM_NAME    = process.env.SENDGRID_FROM_NAME  || "GR8 Result";

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function addDays(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-AU", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Auth via bearer token
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

  const { projectId } = req.body || {};
  if (!projectId) return res.status(400).json({ error: "projectId required" });

  // Load project
  const { data: project, error: projErr } = await supabaseAdmin
    .from("gantt_projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();
  if (projErr || !project) return res.status(404).json({ error: "Project not found" });

  // Load tasks with their contact_id
  const { data: tasks } = await supabaseAdmin
    .from("gantt_tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("phase_order")
    .order("start_day");

  const assignedTasks = (tasks || []).filter((t) => t.contact_id);
  if (!assignedTasks.length) {
    return res.status(200).json({ ok: true, sent: 0, message: "No tasks have a contact assigned" });
  }

  // Load all relevant contacts
  const contactIds = [...new Set(assignedTasks.map((t) => t.contact_id))];
  const { data: contacts } = await supabaseAdmin
    .from("gantt_contacts")
    .select("*")
    .in("id", contactIds);
  const contactMap = Object.fromEntries((contacts || []).map((c) => [c.id, c]));

  // Group tasks by contact
  const byContact = new Map();
  for (const task of assignedTasks) {
    const contact = contactMap[task.contact_id];
    if (!contact?.email) continue;
    if (!byContact.has(contact.id)) byContact.set(contact.id, { contact, tasks: [] });
    byContact.get(contact.id).tasks.push(task);
  }

  const startDate = project.start_date ? new Date(project.start_date) : null;
  let sent = 0;
  const errors = [];

  for (const { contact, tasks: contactTasks } of byContact.values()) {
    const taskRows = contactTasks.map((t) => {
      const startStr = startDate
        ? fmtDate(addDays(startDate, t.start_day))
        : `Day ${t.start_day}`;
      const endStr = startDate
        ? fmtDate(addDays(startDate, t.start_day + t.duration_days))
        : `Day ${t.start_day + t.duration_days}`;
      return `
        <tr>
          <td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#111827">${t.name}</td>
          <td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280">${t.phase}</td>
          <td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;color:#111827">${startStr}</td>
          <td style="padding:9px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280">${t.duration_days} day${t.duration_days !== 1 ? "s" : ""} → ${endStr}</td>
        </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,Arial,sans-serif">
  <div style="max-width:660px;margin:40px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.09)">
    <div style="background:linear-gradient(135deg,#1d4ed8 0%,#2563eb 100%);padding:32px 36px;color:#fff">
      <div style="font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;opacity:.75;margin-bottom:6px">Work Order</div>
      <h1 style="margin:0;font-size:26px;font-weight:700;line-height:1.2">${project.name}</h1>
      <p style="margin:8px 0 0;opacity:.88;font-size:15px">${[project.client_name, project.job_address ? `📍 ${project.job_address}` : null, startDate ? `Starting ${fmtDate(startDate)}` : null].filter(Boolean).join(" · ")}</p>
    </div>
    <div style="padding:32px 36px">
      <p style="margin:0 0 20px;font-size:16px;color:#374151">
        Hi ${contact.name}${contact.company ? ` (${contact.company})` : ""},
      </p>
      <p style="margin:0 0 28px;font-size:15px;color:#4b5563;line-height:1.65">
        Please find your scheduled tasks below for <strong>${project.name}</strong>.
        Reply to this email to confirm receipt, or contact us immediately if any dates are not workable.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb">Task</th>
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb">Phase</th>
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb">Start Date</th>
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb">Duration</th>
          </tr>
        </thead>
        <tbody>${taskRows}</tbody>
      </table>
    </div>
    <div style="background:#f8fafc;padding:18px 36px;font-size:13px;color:#9ca3af;border-top:1px solid #e5e7eb">
      Sent via GR8 Result Gantt Chart · Please confirm receipt by replying to this email.
    </div>
  </div>
</body></html>`;

    const text = `Work Order: ${project.name}\n\n` +
      contactTasks.map((t) => {
        const startStr = startDate ? fmtDate(addDays(startDate, t.start_day)) : `Day ${t.start_day}`;
        return `• ${t.name} (${t.phase}) — Start: ${startStr}, Duration: ${t.duration_days} days`;
      }).join("\n");

    const result = await sendEmail({
      to: contact.email,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: `Work Order — ${project.name}`,
      html,
      text,
    });

    if (result.ok || result.skipped) {
      sent++;
    } else {
      errors.push({ contact: contact.email, error: result.error });
    }
  }

  return res.status(200).json({ ok: true, sent, errors: errors.length ? errors : undefined });
}
