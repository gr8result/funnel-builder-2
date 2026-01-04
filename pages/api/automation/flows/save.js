// /pages/api/automation/flows/save.js
// FULL REPLACEMENT
// Fixes HTTP 404 by ensuring the route exists at:
//    POST /api/automation/flows/save
//
// Body:
// {
//   mode: "save" | "save_as",
//   flow_id?: string|null,
//   is_template?: boolean,
//   name: string,
//   nodes: any[],
//   edges: any[]
// }
//
// ✅ Service role (server-side)
// ✅ User derived from Bearer token
// ✅ Uses accounts.id as automation_flows.user_id (your current schema pattern)
// ✅ Never overwrites system templates (is_standard = true)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.warn("Missing SUPABASE_URL env");
}
if (!SERVICE_KEY) {
  console.warn("Missing SUPABASE_SERVICE_ROLE_KEY env");
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function getBearer(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "Use POST" });
    }

    const token = getBearer(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: "Missing Bearer token" });
    }

    const { data: userData, error: userErr } =
      await supabaseAdmin.auth.getUser(token);

    if (userErr || !userData?.user) {
      return res.status(401).json({ ok: false, error: "Invalid session" });
    }

    const auth_user_id = userData.user.id;

    // your flows store user_id = accounts.id (not auth id)
    const { data: account, error: accErr } = await supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("user_id", auth_user_id)
      .single();

    if (accErr || !account?.id) {
      return res.status(400).json({
        ok: false,
        error:
          "Could not find accounts row for this user (accounts.user_id -> auth.users.id).",
        detail: accErr?.message || accErr,
      });
    }

    const account_id = account.id;

    const mode = String(req.body?.mode || "save").trim(); // save | save_as
    const flow_id = req.body?.flow_id ? String(req.body.flow_id).trim() : null;
    const is_template = !!req.body?.is_template;

    const name = String(req.body?.name || "").trim();
    const nodes = req.body?.nodes || [];
    const edges = req.body?.edges || [];

    if (!name) return res.status(400).json({ ok: false, error: "Missing name" });

    // Never overwrite templates
    const forceInsert = mode === "save_as" || is_template === true;

    // UPDATE path (only if owned + not standard)
    if (!forceInsert && flow_id) {
      const { data: existing, error: exErr } = await supabaseAdmin
        .from("automation_flows")
        .select("id,user_id,is_standard")
        .eq("id", flow_id)
        .maybeSingle();

      if (exErr) {
        return res
          .status(500)
          .json({ ok: false, error: exErr.message, detail: exErr });
      }

      const canUpdate =
        existing &&
        existing.user_id === account_id &&
        existing.is_standard !== true;

      if (canUpdate) {
        const { data: updatedRows, error: upErr } = await supabaseAdmin
          .from("automation_flows")
          .update({
            name,
            nodes,
            edges,
            user_id: account_id,
            is_standard: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", flow_id)
          .select("*")
          .limit(1);

        if (upErr) {
          return res
            .status(500)
            .json({ ok: false, error: upErr.message, detail: upErr });
        }

        return res.status(200).json({
          ok: true,
          action: "Flow Updated",
          flow: updatedRows?.[0] || null,
        });
      }
      // if not allowed to update, fall through to insert new
    }

    // INSERT new flow
    const { data: insertedRows, error: insErr } = await supabaseAdmin
      .from("automation_flows")
      .insert([
        {
          user_id: account_id,
          name,
          nodes,
          edges,
          is_standard: false,
        },
      ])
      .select("*")
      .limit(1);

    if (insErr) {
      return res
        .status(500)
        .json({ ok: false, error: insErr.message, detail: insErr });
    }

    return res.status(200).json({
      ok: true,
      action: mode === "save_as" ? "Flow Saved As New" : "Flow Saved",
      flow: insertedRows?.[0] || null,
    });
  } catch (err) {
    console.error("flows/save error:", err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
