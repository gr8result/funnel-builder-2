// ============================================
// /pages/api/email/send-broadcast.js
// NEW FILE — Broadcast send endpoint (A/B subject split + baseline rows)
// ============================================
//
// ✅ Creates/updates broadcast row (optional) then sends
// ✅ Deterministic A/B subject split (NO double sending)
// ✅ Inserts baseline rows into email_sends BEFORE SendGrid (reports never show zeros)
// ✅ Sends SendGrid customArgs: { user_id, broadcast_id, campaign_id, automation_id, variant, send_id }
// ✅ Supports dryRun to test without sending
//
// Expected request body (POST):
// {
//   user_id: "uuid",
//   broadcast_id?: "uuid",
//   name?: "Broadcast name",
//   fromName: "...",
//   fromEmail: "...",
//   replyTo?: "...",
//   subject: "...",            // used if AB disabled
//   preheader?: "...",
//   html: "<html>...</html>",
//   audienceType: "list" | "all",
//   listId?: "uuid",           // if audienceType === "list"
//   abEnabled?: true|false,
//   subjectA?: "...",
//   subjectB?: "...",
//   dryRun?: true|false,
//   limit?: 50                 // optional safety for testing
// }

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { pickVariant, sendOne } from "../../../lib/email/broadcastSender";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSb() {
  if (!SUPABASE_URL) throw Object.assign(new Error("Missing SUPABASE_URL"), { missing: "SUPABASE_URL" });
  if (!SUPABASE_SERVICE_ROLE_KEY)
    throw Object.assign(new Error("Missing SUPABASE_SERVICE_ROLE_KEY"), { missing: "SUPABASE_SERVICE_ROLE_KEY" });
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

const ok = (res, body) => res.status(200).json(body);
const bad = (res, code, body) => res.status(code).json(body);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return bad(res, 405, { error: "Use POST" });
    }

    const sb = getSb();

    const body = req.body || {};
    const user_id = String(body.user_id || "").trim();
    if (!user_id) return bad(res, 400, { error: "Missing user_id" });

    const fromName = String(body.fromName || "").trim();
    const fromEmail = String(body.fromEmail || "").trim();
    const replyTo = String(body.replyTo || "").trim();
    const preheader = String(body.preheader || "").trim();
    const html = String(body.html || "").trim();

    if (!fromEmail) return bad(res, 400, { error: "Missing fromEmail" });
    if (!html) return bad(res, 400, { error: "Missing html" });

    const audienceType = String(body.audienceType || "list").trim();
    const listId = body.listId ? String(body.listId).trim() : null;

    const abEnabled = !!body.abEnabled;
    const subject = String(body.subject || "").trim();
    const subjectA = String(body.subjectA || "").trim();
    const subjectB = String(body.subjectB || "").trim();

    if (abEnabled) {
      if (!subjectA || !subjectB) {
        return bad(res, 400, { error: "A/B enabled but missing subjectA or subjectB" });
      }
    } else {
      if (!subject) return bad(res, 400, { error: "Missing subject" });
    }

    const dryRun = !!body.dryRun;
    const limit = Number.isFinite(Number(body.limit)) ? Math.max(1, Number(body.limit)) : null;

    // 1) Ensure broadcast record exists (optional but recommended)
    let broadcast_id = body.broadcast_id ? String(body.broadcast_id).trim() : null;

    if (!broadcast_id) {
      // If you already have an email_broadcasts table, this will work.
      // If not, you can either create it, or skip by passing broadcast_id from your UI.
      const insertPayload = {
        user_id,
        name: String(body.name || "Broadcast").trim(),
        from_name: fromName || null,
        from_email: fromEmail || null,
        reply_to: replyTo || null,
        subject: abEnabled ? null : subject,
        preheader: preheader || null,
        html: html,
        ab_enabled: abEnabled,
        subject_a: abEnabled ? subjectA : null,
        subject_b: abEnabled ? subjectB : null,
        audience_type: audienceType,
        list_id: listId,
        status: dryRun ? "draft" : "sending",
      };

      const { data: bRow, error: bErr } = await sb
        .from("email_broadcasts")
        .insert(insertPayload)
        .select("id")
        .single();

      if (bErr) {
        return bad(res, 500, {
          error: "Failed to create broadcast in email_broadcasts",
          detail: bErr.message,
          hint: "Either create table email_broadcasts or pass broadcast_id from your existing table.",
        });
      }
      broadcast_id = bRow.id;
    } else {
      // Keep status updated for an existing broadcast
      await sb.from("email_broadcasts").update({ status: dryRun ? "draft" : "sending" }).eq("id", broadcast_id);
    }

    // 2) Get recipients
    const recipients = await fetchRecipients(sb, { user_id, audienceType, listId, limit });

    if (!recipients.length) {
      await sb.from("email_broadcasts").update({ status: "no_recipients" }).eq("id", broadcast_id);
      return ok(res, { ok: true, broadcast_id, sent: 0, message: "No recipients found." });
    }

    // 3) Create baseline rows in email_sends (so analytics never show 0)
    // Minimal insert to reduce schema mismatch risk.
    const nowIso = new Date().toISOString();

    const sendRows = recipients.map((r) => {
      const email = String(r.email || "").trim();
      const variant = abEnabled ? pickVariant(email) : "S"; // S = single subject
      return {
        user_id,
        broadcast_id,
        subscriber_id: r.subscriber_id || r.id || null,
        to_email: email,
        variant,
        status: dryRun ? "queued" : "queued",
        queued_at: nowIso,
      };
    });

    const { data: insertedSends, error: insErr } = await sb
      .from("email_sends")
      .insert(sendRows)
      .select("id,to_email,variant");

    if (insErr) {
      await sb.from("email_broadcasts").update({ status: "error" }).eq("id", broadcast_id);
      return bad(res, 500, {
        error: "Failed inserting baseline rows into email_sends",
        detail: insErr.message,
        hint: "Ensure email_sends has columns: user_id, broadcast_id, subscriber_id, to_email, variant, status, queued_at",
      });
    }

    if (dryRun) {
      await sb.from("email_broadcasts").update({ status: "dry_run" }).eq("id", broadcast_id);
      return ok(res, {
        ok: true,
        broadcast_id,
        dryRun: true,
        recipients: recipients.length,
        baseline_rows: insertedSends?.length || 0,
      });
    }

    // 4) Send
    const results = [];
    const errors = [];

    for (const row of insertedSends || []) {
      const toEmail = row.to_email;
      const variant = row.variant;

      const chosenSubject =
        abEnabled
          ? (variant === "A" ? subjectA : subjectB)
          : subject;

      const customArgs = {
        user_id,
        broadcast_id,
        campaign_id: null,
        automation_id: null,
        variant: abEnabled ? variant : null,
        send_id: row.id,
      };

      try {
        // Mark as "sending"
        await sb.from("email_sends").update({ status: "sending", sending_at: new Date().toISOString() }).eq("id", row.id);

        const resp = await sendOne({
          fromEmail,
          fromName,
          replyTo: replyTo || undefined,
          toEmail,
          subject: chosenSubject,
          html,
          preheader: preheader || undefined,
          customArgs,
        });

        const messageId =
          resp?.headers?.["x-message-id"] ||
          resp?.headers?.["X-Message-Id"] ||
          null;

        // Mark as "sent" (delivered will come via webhook)
        await sb
          .from("email_sends")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            sendgrid_message_id: messageId,
          })
          .eq("id", row.id);

        results.push({ id: row.id, toEmail, variant, messageId });
      } catch (e) {
        await sb
          .from("email_sends")
          .update({
            status: "error",
            error: String(e?.message || e),
            errored_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        errors.push({ id: row.id, toEmail, error: String(e?.message || e) });
      }
    }

    // 5) Final broadcast status
    await sb
      .from("email_broadcasts")
      .update({
        status: errors.length ? "sent_with_errors" : "sent",
        sent_count: results.length,
        error_count: errors.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", broadcast_id);

    return ok(res, {
      ok: true,
      broadcast_id,
      queued: insertedSends?.length || 0,
      sent: results.length,
      errors,
    });
  } catch (err) {
    console.error("send-broadcast error:", err);
    return bad(res, 500, {
      error: "send-broadcast failed",
      detail: err?.message || String(err),
      missing: err?.missing || null,
    });
  }
}

/**
 * Recipient fetcher
 * Tries list membership first, then falls back to "all leads".
 *
 * Assumptions (adjust if your schema differs):
 * - leads table: { id, user_id, email }
 * - lead_list_members table: { user_id, list_id, lead_id }
 */
async function fetchRecipients(sb, { user_id, audienceType, listId, limit }) {
  // audienceType: "list" or "all"
  if (audienceType === "all") {
    let q = sb.from("leads").select("id,email").eq("user_id", user_id).not("email", "is", null);
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw new Error(`Fetch recipients failed (leads): ${error.message}`);
    return (data || []).map((r) => ({ id: r.id, subscriber_id: r.id, email: r.email }));
  }

  // default: list
  if (!listId) return [];

  // 1) Try lead_list_members -> leads join style (two-step to avoid join issues)
  const { data: members, error: mErr } = await sb
    .from("lead_list_members")
    .select("lead_id")
    .eq("user_id", user_id)
    .eq("list_id", listId);

  if (!mErr && members?.length) {
    const leadIds = members.map((m) => m.lead_id).filter(Boolean);
    let q = sb.from("leads").select("id,email").in("id", leadIds).not("email", "is", null);
    if (limit) q = q.limit(limit);
    const { data: leads, error: lErr } = await q;
    if (lErr) throw new Error(`Fetch recipients failed (leads from members): ${lErr.message}`);
    return (leads || []).map((r) => ({ id: r.id, subscriber_id: r.id, email: r.email }));
  }

  // 2) If lead_list_members table doesn't exist, try "subscribers" style tables
  // (kept as fallback without breaking your build)
  const fallbacks = [
    { table: "email_subscribers", cols: "id,email" },
    { table: "subscribers", cols: "id,email" },
  ];

  for (const f of fallbacks) {
    const { data, error } = await sb
      .from(f.table)
      .select(f.cols)
      .eq("user_id", user_id)
      .eq("list_id", listId)
      .not("email", "is", null)
      .limit(limit || 100000);

    if (!error && data?.length) {
      return data.map((r) => ({ id: r.id, subscriber_id: r.id, email: r.email }));
    }
  }

  return [];
}
