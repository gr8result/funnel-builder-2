// /pages/api/email/run-campaigns.js
// FULL REPLACEMENT — queues Email 1/2/3 correctly using your REAL schema
// ✅ Uses email2_delay_minutes / email3_delay_minutes (your table)
// ✅ Also supports legacy emailX_delay_days/hours/minutes if present
// ✅ Template id is read from multiple possible column names (UI drift proof)
// ✅ Writes from_email/from_name into every job
// ✅ Prevents duplicates unless ?force=1
// ✅ Cumulative delay: email3 is AFTER email2

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const clean = (v) => String(v ?? "").trim();

const isEmail = (v) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(v).toLowerCase());

function pickFirst(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== null && v !== undefined && clean(v)) return clean(v);
  }
  return "";
}

// ✅ your real schema uses a single "delay_minutes" integer per email
function delayMs(campaign, idx) {
  // preferred: real columns
  const minutesCol = Number(campaign?.[`email${idx}_delay_minutes`] ?? 0);
  if (!Number.isNaN(minutesCol) && minutesCol > 0) return minutesCol * 60_000;

  // fallback: legacy split fields (if you ever add them)
  const d = Number(campaign?.[`email${idx}_delay_days`] ?? 0);
  const h = Number(campaign?.[`email${idx}_delay_hours`] ?? 0);
  const m = Number(campaign?.[`email${idx}_delay_minutes_legacy`] ?? campaign?.[`email${idx}_delay_mins`] ?? 0);
  const totalMins = d * 1440 + h * 60 + m;
  return Math.max(0, totalMins) * 60_000;
}

async function loadHtml(userId, templateId) {
  if (!templateId) return null;

  const filename = String(templateId).endsWith(".html")
    ? String(templateId)
    : `${templateId}.html`;

  const paths = [
    `finished-emails/${filename}`,
    `${userId}/finished-emails/${filename}`,
  ];

  for (const p of paths) {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from("email-user-assets")
        .download(p);
      if (!error && data) return await data.text();
    } catch {
      // ignore
    }
  }

  return null;
}

export default async function handler(req, res) {
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

    if (!listId) {
      return res
        .status(400)
        .json({ ok: false, error: "Campaign missing subscriber_list_id" });
    }

    // Prevent duplicate queue unless force
    const { count: existingCount, error: existingErr } = await supabaseAdmin
      .from("email_campaigns_queue")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .in("status", ["queued", "scheduled", "error"]);

    if (existingErr) {
      return res.status(500).json({
        ok: false,
        error: existingErr.message || String(existingErr),
      });
    }

    if (!force && (existingCount || 0) > 0) {
      return res.status(409).json({
        ok: false,
        error:
          "Campaign is already queued. Use POST ?force=1 to re-queue (clears unsent jobs).",
        existing_unsent_jobs: existingCount || 0,
      });
    }

    if (force) {
      const { error: delErr } = await supabaseAdmin
        .from("email_campaigns_queue")
        .delete()
        .eq("campaign_id", campaign.id)
        .in("status", ["queued", "scheduled", "error"]);
      if (delErr) {
        return res.status(500).json({
          ok: false,
          error: `Failed clearing old queue: ${delErr.message || String(delErr)}`,
        });
      }
    }

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

    // ✅ Template id column name drift protection
    const templateKeys = (idx) => [
      `email${idx}_template_id`,     // your schema
      `email${idx}_template`,        // older UI variants
      `email${idx}_saved_email`,     // older UI variants
      `email${idx}_saved_email_id`,  // older UI variants
      `email${idx}_email_id`,        // just in case
    ];

    const buildEmail = async (idx) => {
      const subject = clean(campaign?.[`email${idx}_subject`] || "");
      const preheader = clean(campaign?.[`email${idx}_preheader`] || "");

      const templateId = pickFirst(campaign, templateKeys(idx));

      // If BOTH empty -> skip (optional emails)
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
    const d3 = d2 + delayMs(campaign, 3); // cumulative

    const jobs = [];
    let invalid = 0;

    for (const l of leads) {
      const to = clean(l.email).toLowerCase();
      if (!isEmail(to)) {
        invalid++;
        continue;
      }

      const push = (emailIndex, e, whenMs) => {
        if (!e) return;
        jobs.push({
          user_id: campaign.user_id,
          campaign_id: campaign.id,
          subscriber_id: l.id,
          lead_id: l.id,
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

    if (!jobs.length) {
      return res.status(400).json({
        ok: false,
        error: "No jobs created (no valid emails).",
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
      force,
      recipients: leads.length,
      queued_jobs: jobs.length,
      invalid_recipients: invalid,
      queued_email_1: !!e1,
      queued_email_2: !!e2,
      queued_email_3: !!e3,
      delays_ms: { email2: d2, email3: d3 },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
