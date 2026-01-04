// /pages/api/automation/lists.js
// FULL REPLACEMENT
// GET /api/automation/lists
// ✅ Returns available lists for the logged-in user (supports multiple schemas)
// ✅ Supports ownership by accounts.id OR auth.users.id
// ✅ Tries tables in order:
//    1) email_lists (+email_list_members)
//    2) lead_lists (+lead_list_members)
//    3) lists (+list_members)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function getBearer(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function isMissingTable(err) {
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("relation") || err?.code === "42P01";
}

async function getAccountId(auth_user_id) {
  try {
    const { data, error } = await supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("user_id", auth_user_id)
      .maybeSingle();
    if (error) return null;
    return data?.id || null;
  } catch {
    return null;
  }
}

async function tryListTable(table, ownerIds) {
  // expects columns: id, name, user_id
  const out = [];
  for (const owner of ownerIds) {
    if (!owner) continue;
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("id,name,user_id")
      .eq("user_id", owner)
      .order("name", { ascending: true });

    if (error) {
      if (isMissingTable(error)) return { ok: false, missing: true };
      return { ok: false, error };
    }

    if (Array.isArray(data) && data.length) {
      for (const r of data) {
        out.push({
          id: r.id,
          name: r.name || "(unnamed)",
          user_id: r.user_id,
          table,
        });
      }
      // if we got rows for the first matching owner, stop
      return { ok: true, rows: out };
    }
  }
  return { ok: true, rows: [] };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Use GET" });
  }

  try {
    const token = getBearer(req);
    if (!token) return res.status(401).json({ ok: false, error: "Missing Bearer token" });

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return res.status(401).json({ ok: false, error: "Invalid session" });
    }

    const auth_user_id = userData.user.id;
    const account_id = await getAccountId(auth_user_id);

    const ownerIds = [account_id, auth_user_id].filter(Boolean);

    // Try known list tables in order
    const candidates = ["email_lists", "lead_lists", "lists"];
    for (const t of candidates) {
      const attempt = await tryListTable(t, ownerIds);
      if (!attempt.ok && attempt.missing) continue;
      if (!attempt.ok) {
        return res.status(500).json({ ok: false, error: attempt.error?.message || "List query failed" });
      }

      const rows = attempt.rows || [];
      return res.status(200).json({
        ok: true,
        lists: rows,
        detected_table: t,
        owner_ids_used: ownerIds,
      });
    }

    // none exist
    return res.status(200).json({ ok: true, lists: [], detected_table: null, owner_ids_used: ownerIds });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
