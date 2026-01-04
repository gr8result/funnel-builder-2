// /pages/api/automation/crm-flows.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ok = (res, body) => res.status(200).json(body);
const bad = (res, code, msg) => res.status(code).json({ ok: false, error: msg });

function safeJsonParse(v) {
  if (!v) return null;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") return bad(res, 405, "Method not allowed");

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) return bad(res, 401, "Missing Authorization Bearer token");

    const { data: authData, error: authErr } =
      await supabaseAuth.auth.getUser(token);

    if (authErr || !authData?.user) return bad(res, 401, "Invalid session");

    const authUserId = authData.user.id;

    // auth.users.id -> accounts.id
    const { data: account, error: accErr } = await supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("user_id", authUserId)
      .single();

    if (accErr || !account?.id) return bad(res, 400, "No account found");

    const accountId = account.id;

    // Pull templates + user flows
    const { data: flows, error } = await supabaseAdmin
      .from("automation_flows")
      .select("id,name,is_standard,user_id,nodes,updated_at")
      .or(`is_standard.eq.true,user_id.eq.${accountId}`)
      .order("updated_at", { ascending: false });

    if (error) return bad(res, 500, error.message);

    const eligible = (flows || [])
      .map((f) => {
        const nodes = safeJsonParse(f.nodes) || [];
        const hasCrm =
          Array.isArray(nodes) &&
          nodes.some(
            (n) => n?.type === "trigger" && n?.data?.triggerType === "crm_sent"
          );
        return hasCrm
          ? {
              id: f.id,
              name: f.name || (f.is_standard ? "Template Flow" : "My Flow"),
              is_standard: !!f.is_standard,
              updated_at: f.updated_at,
            }
          : null;
      })
      .filter(Boolean);

    return ok(res, { ok: true, flows: eligible });
  } catch (err) {
    console.error("crm-flows error", err);
    return bad(res, 500, err.message || "Internal error");
  }
}
