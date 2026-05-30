// /pages/api/sms/set-sender-id.js
// Helper endpoint to set SMS sender_id for the logged-in user
// POST with Authorization: Bearer <token> and { sender_id: "..." }

import { createClient } from "@supabase/supabase-js";
import { withAuth } from "../../../lib/withWorkspace";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

function s(v) {
  return String(v ?? "").trim();
}

function getBearer(req) {
  const a = s(req.headers.authorization);
  if (!a.toLowerCase().startsWith("bearer ")) return "";
  return a.slice(7).trim();
}

async function getUserFromBearer(token, supabaseAnon) {
  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const token = getBearer(req);
    if (!token) {
      return res
        .status(401)
        .json({ ok: false, error: "Missing Authorization Bearer token" });
    }

    if (!SUPABASE_URL || !ANON_KEY) {
      return res
        .status(500)
        .json({
          ok: false,
          error: "Missing Supabase env (SUPABASE_URL / SUPABASE_ANON_KEY)",
        });
    }

    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return res.status(401).json({ ok: false, error: "Invalid session" });
    }

    const user_id = userData.user.id;
    const { sender_id } = req.body || {};

    if (!sender_id) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing sender_id in request body" });
    }

    const cleanSenderId = s(sender_id);
    if (!cleanSenderId)
      return res
        .status(400)
        .json({ ok: false, error: "sender_id cannot be empty" });

    // Upsert into profiles
    const { data: upserted, error: upsertErr } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id,
          sender_id: cleanSenderId,
        },
        { onConflict: "user_id" }
      )
      .select("*")
      .single();

    if (upsertErr) {
      return res.status(500).json({ ok: false, error: upsertErr.message });
    }

    return res.status(200).json({
      ok: true,
      message: "sender_id updated successfully",
      profile: upserted,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ ok: false, error: e?.message || "Server error" });
  }
}

export default withAuth(handler);
