import { createClient } from "@supabase/supabase-js";
import {
  normalizeUnsubscribeEmail,
  verifyUnsubscribeToken,
} from "../../../lib/email/unsubscribe";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function getRequestValue(req, key) {
  if (req.query?.[key] !== undefined) return req.query[key];
  if (req.body?.[key] !== undefined) return req.body[key];
  return "";
}

function sendResponse(req, res, status, payload) {
  const accept = String(req.headers.accept || "").toLowerCase();
  const wantsJson = accept.includes("application/json") || req.headers["x-requested-with"] === "XMLHttpRequest";

  if (wantsJson || req.method === "POST") {
    return res.status(status).json(payload);
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.status(status).send(payload?.message || payload?.error || "OK");
}

async function markEmailUnsubscribed({ userId, email }) {
  const timestamp = new Date().toISOString();
  const fields = ["recipient_email", "email", "to_email"];
  let updated = 0;

  for (const field of fields) {
    const { data, error } = await supabaseAdmin
      .from("email_sends")
      .update({
        unsubscribed: true,
        unsubscribed_at: timestamp,
        status: "unsubscribed",
        last_event: "unsubscribe",
        last_event_at: timestamp,
      })
      .eq("user_id", userId)
      .eq(field, email)
      .select("id");

    if (!error && Array.isArray(data)) {
      updated += data.length;
    }
  }

  return { updated, timestamp };
}

export default async function handler(req, res) {
  try {
    if (!["GET", "POST"].includes(req.method)) {
      res.setHeader("Allow", "GET, POST");
      return sendResponse(req, res, 405, { ok: false, error: "Use GET or POST" });
    }

    const userId = String(getRequestValue(req, "user") || getRequestValue(req, "userId") || "").trim();
    const email = normalizeUnsubscribeEmail(getRequestValue(req, "email"));
    const token = String(getRequestValue(req, "token") || "").trim();

    if (!userId || !email || !token) {
      return sendResponse(req, res, 400, { ok: false, error: "Missing unsubscribe parameters." });
    }

    if (!verifyUnsubscribeToken({ userId, email, token })) {
      return sendResponse(req, res, 403, { ok: false, error: "Invalid unsubscribe token." });
    }

    const { updated } = await markEmailUnsubscribed({ userId, email });

    return sendResponse(req, res, 200, {
      ok: true,
      email,
      updated,
      message: updated
        ? `${email} has been unsubscribed.`
        : `${email} is already unsubscribed.`,
    });
  } catch (error) {
    return sendResponse(req, res, 500, {
      ok: false,
      error: error?.message || "Unsubscribe failed.",
    });
  }
}