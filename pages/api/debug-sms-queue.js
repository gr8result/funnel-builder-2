// Quick debug endpoint to check queue and account data
import { createClient } from "@supabase/supabase-js";
import withAdmin from "../../lib/withAdmin";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function handler(req, res) {
  try {
    // Get queue rows
    const { data: queueRows } = await supabaseAdmin
      .from("sms_queue")
      .select("*")
      .limit(10);

    // Get accounts
    const { data: accounts } = await supabaseAdmin
      .from("accounts")
      .select("user_id, sender_id, business_name, sms_api_key, sms_api_secret")
      .limit(10);

    // Get profiles
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, sender_id, sms_applied")
      .limit(10);

    return res.status(200).json({
      ok: true,
      queue: queueRows || [],
      accounts: (accounts || []).map(a => ({
        user_id: a.user_id,
        sender_id: a.sender_id,
        business_name: a.business_name,
        has_api_key: !!a.sms_api_key,
        has_api_secret: !!a.sms_api_secret,
      })),
      profiles: profiles || [],
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}

export default withAdmin(handler);
