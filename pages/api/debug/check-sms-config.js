// Debug endpoint - check SMS configuration for current user
import { createClient } from "@supabase/supabase-js";
import { withWorkspace } from "../../../lib/withWorkspace";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function s(v) {
  return String(v ?? "").trim();
}

async function handler(req, res) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "No token" });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Get user from token
    const anonClient = createClient(
      SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Get account rows (some users may have duplicates). Prefer the newest row with sender_id.
    const { data: accountRows } = await supabase
      .from("accounts")
      .select("id, user_id, business_name, sender_id, sms_api_key, sms_api_secret, email, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20);

    const rows = Array.isArray(accountRows) ? accountRows : [];
    const latestRow = rows[0] || null;
    const rowWithSender = rows.find((r) => s(r?.sender_id));
    let account = rowWithSender || latestRow;

    // Self-heal drift: if latest row is empty but an older row has sender_id, sync into latest.
    if (latestRow && rowWithSender && !s(latestRow?.sender_id) && latestRow.id !== rowWithSender.id) {
      const recovered = s(rowWithSender.sender_id);
      await supabase
        .from("accounts")
        .update({ sender_id: recovered, updated_at: new Date().toISOString() })
        .eq("id", latestRow.id);
      account = { ...latestRow, sender_id: recovered };
    }

    // Self-heal: if accounts.sender_id is missing but profiles.sender_id exists, sync it.
    if (!account?.sender_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("sender_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const recoveredSenderId = s(profile?.sender_id);
      if (recoveredSenderId) {
        if (account?.id) {
          await supabase
            .from("accounts")
            .update({ sender_id: recoveredSenderId, updated_at: new Date().toISOString() })
            .eq("id", account.id);
          account = { ...account, sender_id: recoveredSenderId };
        } else {
          const { data: insertedRows } = await supabase
            .from("accounts")
            .insert({
              user_id: user.id,
              sender_id: recoveredSenderId,
              email: user.email || null,
              updated_at: new Date().toISOString(),
            })
            .select("id, user_id, business_name, sender_id, sms_api_key, sms_api_secret, email")
            .limit(1);
          account = insertedRows?.[0] || {
            id: null,
            user_id: user.id,
            business_name: null,
            sender_id: recoveredSenderId,
            sms_api_key: null,
            sms_api_secret: null,
            email: user.email || null,
          };
        }
      }
    }

    return res.status(200).json({
      user_id: user.id,
      account: {
        business_name: account?.business_name || null,
        sender_id: account?.sender_id || null,
        has_sms_api_key: !!account?.sms_api_key,
        has_sms_api_secret: !!account?.sms_api_secret,
        email: account?.email || null,
      },
      env: {
        DEFAULT_SMS_ORIGIN: process.env.DEFAULT_SMS_ORIGIN,
      },
      priority: {
        "1_sender_id": account?.sender_id || "(empty - THIS IS THE PROBLEM)",
        "2_business_name": account?.business_name || "(empty)",
        "3_fallback": process.env.DEFAULT_SMS_ORIGIN || "gr8result",
        actual_origin_used: account?.sender_id || account?.business_name || process.env.DEFAULT_SMS_ORIGIN || "gr8result",
      }
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export default withWorkspace(handler);
