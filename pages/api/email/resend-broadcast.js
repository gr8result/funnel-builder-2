// /pages/api/email/resend-broadcast.js
// FULL REPLACEMENT — token-verified resend + REAL A/B split + logs to email_sends (your schema)
// ✅ Fixes Unauthorized (requires Bearer token)
// ✅ Uses token user (NOT userId in body)
// ✅ Uses deterministic A/B split
// ✅ Logs email_sends with correct column names (email + recipient_email + error_message)

import { createClient } from "@supabase/supabase-js";

export const config = { api: { bodyParser: { sizeLimit: "2mb" } } };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON ||
  "";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false },
});

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

function splitAB(emails) {
  const uniq = Array.from(new Set(emails.map((e) => String(e || "").trim().toLowerCase()))).filter(
    isEmail
  );

  if (uniq.length === 0) return { A: [], B: [] };
  if (uniq.length === 1) return { A: uniq, B: [] };

  // deterministic split
  const sorted = [...uniq].sort();
  const mid = Math.ceil(sorted.length / 2);
  return { A: sorted.slice(0, mid), B: sorted.slice(mid) };
}

async function sendEmail({ to, subject, html, fromEmail, fromName, replyTo }) {
  if (!SENDGRID_API_KEY) throw new Error("SENDGRID_API_KEY missing");

  const sg = (await import("@sendgrid/mail")).default;
  sg.setApiKey(SENDGRID_API_KEY);

  await sg.send({
    to,
    from: { email: fromEmail, name: fromName },
    replyTo: replyTo ? { email: replyTo } : undefined,
    subject,
    html,
  });
}

async function getListRecipients({ userId, listId }) {
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("email")
    .eq("user_id", userId)
    .eq("list_id", listId)
    .limit(20000);

  if (error) throw new Error("Failed to load leads for list: " + error.message);
  return (data || []).map((r) => r.email).filter(isEmail);
}

async function logSendRow({
  userId,
  broadcastId,
  to,
  variant,
  abEnabled,
  abVariant,
  subject,
  title,
  status,
  errorMessage,
}) {
  // Your email_sends table (from your screenshot) has:
  // email (NOT NULL), recipient_email, variant, status, error_message, ab_enabled, ab_variant, subject, broadcast_title, broadcast_id, user_id, email_type, sent_at
  const row = {
    user_id: userId,
    broadcast_id: broadcastId,

    // IMPORTANT: email column is NOT NULL in your table
    email: to,
    recipient_email: to,

    // A/B + tracking
    variant: variant || null, // your schema has variant
    ab_enabled: !!abEnabled,
    ab_variant: abVariant || null,
    subject: subject || null,
    broadcast_title: title || null,
    email_type: "broadcast",

    status: status || "sent",
    error_message: errorMessage || null,

    sent_at: new Date().toISOString(),
  };

  // insert but do not crash send if logging fails
  const { error } = await supabaseAdmin.from("email_sends").insert(row);
  if (error) {
    // Return error so caller can surface it
    return error.message;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    // ---- VERIFY TOKEN ----
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    if (!token) return res.status(401).json({ success: false, error: "Unauthorized" });
    if (!ANON_KEY) {
      return res.status(500).json({ success: false, error: "Missing Supabase anon key on server" });
    }

    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const userId = userData.user.id;

    const { broadcastId } = req.body || {};
    if (!broadcastId) throw new Error("Missing broadcastId");

    // Load broadcast owned by THIS user
    const { data: b, error } = await supabaseAdmin
      .from("email_broadcasts")
      .select("*")
      .eq("id", broadcastId)
      .eq("user_id", userId)
      .single();

    if (error || !b) throw new Error("Broadcast not found");

    const fromEmail = String(b.from_email || "").trim();
    const fromName = String(b.from_name || "GR8 RESULT").trim();
    const replyTo = String(b.reply_to || fromEmail).trim();
    const html = String(b.html_content || "").trim();
    const subject = String(b.subject || "").trim();
    const title = String(b.title || "").trim() || subject || "Broadcast";

    if (!isEmail(fromEmail)) throw new Error("Valid fromEmail is required");
    if (!subject) throw new Error("Subject missing on saved broadcast");
    if (!html) throw new Error("HTML missing on saved broadcast");

    const abEnabled = Boolean(b.ab_enabled);
    const subjectA = String(b.ab_subject_a || subject).trim();
    const subjectB = String(b.ab_subject_b || `${subject} (B)`).trim();

    // Build recipients
    let recipients = [];
    if (String(b.audience_type) === "list" && b.list_id) {
      recipients = await getListRecipients({ userId, listId: String(b.list_id) });
    } else if (b.to_field) {
      recipients = String(b.to_field)
        .split(/[,;\n]/)
        .map((x) => x.trim())
        .filter(isEmail);
    }

    if (!recipients.length) throw new Error("No recipients found for this broadcast");

    const { A, B } = abEnabled ? splitAB(recipients) : { A: splitAB(recipients).A, B: [] };

    // Send + log
    let sentA = 0,
      sentB = 0,
      failedA = 0,
      failedB = 0;

    const failures = [];

    for (const to of A) {
      const useSubject = abEnabled ? subjectA : subject;
      try {
        await sendEmail({ to, subject: useSubject, html, fromEmail, fromName, replyTo });

        const logErr = await logSendRow({
          userId,
          broadcastId,
          to,
          variant: abEnabled ? "A" : null,
          abEnabled,
          abVariant: abEnabled ? "A" : null,
          subject: useSubject,
          title,
          status: "sent",
        });

        if (logErr) failures.push({ to, variant: "A", stage: "log", error: logErr });

        sentA++;
      } catch (e) {
        failedA++;
        const msg = e?.message || String(e);

        await logSendRow({
          userId,
          broadcastId,
          to,
          variant: abEnabled ? "A" : null,
          abEnabled,
          abVariant: abEnabled ? "A" : null,
          subject: useSubject,
          title,
          status: "failed",
          errorMessage: msg,
        });

        failures.push({ to, variant: "A", stage: "send", error: msg });
      }
    }

    for (const to of B) {
      const useSubject = subjectB;
      try {
        await sendEmail({ to, subject: useSubject, html, fromEmail, fromName, replyTo });

        const logErr = await logSendRow({
          userId,
          broadcastId,
          to,
          variant: "B",
          abEnabled,
          abVariant: "B",
          subject: useSubject,
          title,
          status: "sent",
        });

        if (logErr) failures.push({ to, variant: "B", stage: "log", error: logErr });

        sentB++;
      } catch (e) {
        failedB++;
        const msg = e?.message || String(e);

        await logSendRow({
          userId,
          broadcastId,
          to,
          variant: "B",
          abEnabled,
          abVariant: "B",
          subject: useSubject,
          title,
          status: "failed",
          errorMessage: msg,
        });

        failures.push({ to, variant: "B", stage: "send", error: msg });
      }
    }

    // bump updated_at
    await supabaseAdmin
      .from("email_broadcasts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", broadcastId)
      .eq("user_id", userId);

    return res.status(200).json({
      success: true,
      ab_enabled: abEnabled,
      split: { A: A.length, B: B.length },
      results: {
        sent: { A: sentA, B: sentB },
        failed: { A: failedA, B: failedB },
      },
      failures: failures.slice(0, 20), // don’t spam response
      debug: {
        subjectA,
        subjectB,
        sampleA: A.slice(0, 5),
        sampleB: B.slice(0, 5),
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e?.message || "Server error" });
  }
}
