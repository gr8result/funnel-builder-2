// /pages/api/email/run-campaigns.js
// FULL REPLACEMENT — queues Email 1/2/3 correctly using your REAL schema
// ✅ Uses email2_delay_minutes / email3_delay_minutes (your table)
// ✅ Also supports legacy emailX_delay_days/hours/minutes if present
// ✅ Template id is read from multiple possible column names (UI drift proof)
// ✅ Writes from_email/from_name into every job
// ✅ Prevents duplicates unless ?force=1
// ✅ Cumulative delay: email3 is AFTER email2
// ✅ ENFORCES EMAIL LIMITS (NEW)

import { createClient } from "@supabase/supabase-js";
import { guardEmailSend } from "../../../lib/emailValidation";
import { withAuth } from "../../../lib/withWorkspace";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const clean = (v) => String(v ?? "").trim();

const isEmail = (v) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(v).toLowerCase());

const parseRecipientEmails = (value) =>
  Array.from(
    new Set(
      clean(value)
        .split(/[\n,;]+/g)
        .map((entry) => clean(entry).toLowerCase())
        .filter(Boolean)
    )
  );

function pickFirst(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== null && v !== undefined && clean(v)) return clean(v);
  }
  return "";
}

// ✅ your real schema uses a single "delay_minutes" integer per email
function delayMs(campaign, idx) {
  const minutesCol = Number(campaign?.[`email${idx}_delay_minutes`] ?? 0);
  if (!Number.isNaN(minutesCol) && minutesCol > 0) return minutesCol * 60_000;

  const d = Number(campaign?.[`email${idx}_delay_days`] ?? 0);
  const h = Number(campaign?.[`email${idx}_delay_hours`] ?? 0);
  const m = Number(
    campaign?.[`email${idx}_delay_minutes_legacy`] ??
      campaign?.[`email${idx}_delay_mins`] ??
      0
  );
  const totalMins = d * 1440 + h * 60 + m;
  return Math.max(0, totalMins) * 60_000;
}

async function loadHtml(userId, templateId) {
  if (!templateId) return null;

  const rawTemplateId = clean(templateId).replace(/^\/+/, "");
  if (!rawTemplateId) return null;

  const builderDocJsonPath = rawTemplateId.endsWith(".json")
    ? rawTemplateId
    : `${userId}/builder-docs/${rawTemplateId}.json`;

  try {
    const { data, error } = await supabaseAdmin.storage
      .from("email-user-assets")
      .download(builderDocJsonPath);
    if (!error && data) {
      const parsed = JSON.parse(await data.text());
      const html = clean(parsed?.html || "");
      if (html) return html;
    }
  } catch {}

  const filename = rawTemplateId.endsWith(".html")
    ? rawTemplateId
    : `${rawTemplateId}.html`;

  const storageTargets = [
    { bucket: "email-user-assets", path: rawTemplateId },
    { bucket: "email-user-assets", path: filename },
    { bucket: "email-user-assets", path: `${userId}/builder-docs/${filename}` },
    { bucket: "email-user-assets", path: `${userId}/finished-emails/${filename}` },
    { bucket: "email-user-assets", path: `finished-emails/${filename}` },
    { bucket: "email-assets", path: rawTemplateId },
    { bucket: "email-assets", path: filename },
    { bucket: "email-assets", path: `templates/${filename}` },
  ];

  const seen = new Set();

  for (const target of storageTargets) {
    const key = `${target.bucket}:${target.path}`;
    if (!target.path || seen.has(key)) continue;
    seen.add(key);

    try {
      const { data, error } = await supabaseAdmin.storage
        .from(target.bucket)
        .download(target.path);
      if (!error && data) return await data.text();
    } catch {}
  }

  return null;
}

async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Use POST." });
    }

    const force =
      String(req.query?.force || req.body?.force || "").trim() === "1" ||
      String(req.query?.force || req.body?.force || "").toLowerCase() === "true";

    const campaign_id =
      req.body?.campaign_id ||
      req.body?.campaigns_id ||
      req.body?.campaignsId ||
      req.query?.campaign_id ||
      req.query?.campaigns_id;

    if (!campaign_id) {
      return res.status(400).json({ ok: false, error: "Missing campaign_id" });
    }

    const { data: campaign, error: campErr } = await supabaseAdmin
      .from("email_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campErr) {
      return res
        .status(500)
        .json({ ok: false, error: campErr.message || String(campErr) });
    }
    if (!campaign) {
      return res.status(404).json({ ok: false, error: "Campaign not found" });
    }

    const fromEmail = pickFirst(campaign, [
      "from_email",
      "fromEmail",
      "sender_email",
      "senderEmail",
      "email_from",
      "from",
    ]);
    const fromName = pickFirst(campaign, [
      "from_name",
      "fromName",
      "sender_name",
      "senderName",
      "email_from_name",
    ]);

    if (!isEmail(fromEmail)) {
      return res.status(400).json({
        ok: false,
        error:
          "Campaign missing valid from_email. Save the campaign sender email first.",
      });
    }

    const listId =
      campaign.subscriber_list_id ||
      campaign.list_id ||
      campaign.lead_list_id;

    let recipients = [];

    if (listId) {
      const { data: leads, error: leadsErr } = await supabaseAdmin
        .from("leads")
        .select("id,email")
        .eq("list_id", listId);

      if (leadsErr) {
        return res
          .status(500)
          .json({ ok: false, error: leadsErr.message || String(leadsErr) });
      }
      if (!leads?.length) {
        return res.status(400).json({ ok: false, error: "List is empty" });
      }

      recipients = leads.map((lead) => ({
        subscriber_id: lead.id,
        lead_id: lead.id,
        email: lead.email,
      }));
    } else {
      recipients = parseRecipientEmails(campaign.extra_recipients).map((email) => ({
        subscriber_id: null,
        lead_id: null,
        email,
      }));

      if (!recipients.length) {
        return res.status(400).json({
          ok: false,
          error: "Campaign needs a subscriber list or at least one custom recipient email.",
        });
      }
    }

    const templateKeys = (idx) => [
      `email${idx}_template_id`,
      `email${idx}_template`,
      `email${idx}_saved_email`,
      `email${idx}_saved_email_id`,
      `email${idx}_email_id`,
    ];

    const buildEmail = async (idx) => {
      const subject = clean(campaign?.[`email${idx}_subject`] || "");
      const preheader = clean(campaign?.[`email${idx}_preheader`] || "");

      const templateId = pickFirst(campaign, templateKeys(idx));

      if (!subject && !templateId) return null;

      const html =
        (await loadHtml(campaign.user_id, templateId)) ||
        `<html><body>${subject || "Campaign email"}</body></html>`;

      return { subject: subject || "Campaign email", preheader, templateId, html };
    };

    const e1 = await buildEmail(1);
    const e2 = await buildEmail(2);
    const e3 = await buildEmail(3);

    if (!e1) {
      return res.status(400).json({
        ok: false,
        error: "Email 1 is required (subject or template must be set).",
      });
    }

    const now = Date.now();
    const d2 = delayMs(campaign, 2);
    const d3 = d2 + delayMs(campaign, 3);

    const jobs = [];
    let invalid = 0;

    for (const recipient of recipients) {
      const to = clean(recipient.email).toLowerCase();
      if (!isEmail(to)) {
        invalid++;
        continue;
      }

      const push = (emailIndex, e, whenMs) => {
        if (!e) return;
        jobs.push({
          user_id: campaign.user_id,
          campaign_id: campaign.id,
          subscriber_id: recipient.subscriber_id,
          lead_id: recipient.lead_id,
          subscriber_email: to,
          to_email: to,
          from_email: fromEmail,
          from_name: fromName || null,
          subject: e.subject,
          preheader: e.preheader || null,
          html: e.html,
          template_id: e.templateId || null,
          scheduled_at: new Date(whenMs).toISOString(),
          status: "queued",
          processing: false,
          email_index: emailIndex,
        });
      };

      push(1, e1, now);
      push(2, e2, now + d2);
      push(3, e3, now + d3);
    }

    let emailGuard = null;
    try {
      emailGuard = await guardEmailSend(campaign.user_id, jobs.length);
    } catch (limitErr) {
      return res.status(429).json({
        ok: false,
        error: limitErr.message,
        code: limitErr.code,
        details: limitErr.details,
      });
    }

    const { error: insErr } = await supabaseAdmin
      .from("email_campaigns_queue")
      .insert(jobs);

    if (insErr) {
      return res.status(500).json({
        ok: false,
        error: `Queue insert failed: ${insErr.message || String(insErr)}`,
      });
    }

    await supabaseAdmin
      .from("email_campaigns")
      .update({ status: "sending" })
      .eq("id", campaign.id);

    return res.status(200).json({
      ok: true,
      recipients: recipients.length,
      queued_jobs: jobs.length,
      invalid_recipients: invalid,
      usage: emailGuard || null,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}

export default withAuth(handler);
