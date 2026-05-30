// Fix: Add missing sms_monthly_limit column to accounts table
import { createClient } from "@supabase/supabase-js";
import { withAdmin } from "../../lib/withAdmin";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // Test if column exists by trying to select it
    const { data, error } = await supabaseAdmin
      .from("accounts")
      .select("sms_monthly_limit")
      .limit(1);

    if (error && error.code === "42703") {
      return res.status(200).json({
        ok: false,
        columnExists: false,
        message: "Column sms_monthly_limit does NOT exist in accounts table",
        fix: "Go to Supabase SQL Editor and run this:\n\nALTER TABLE accounts ADD COLUMN sms_monthly_limit INTEGER DEFAULT NULL;\n\nThen try flushing the SMS queue again."
      });
    }

    return res.status(200).json({
      ok: true,
      columnExists: true,
      message: "Column sms_monthly_limit exists! Queue should work now."
    });
  } catch (e) {
    return res.status(500).json({ 
      ok: false, 
      error: e.message
    });
  }
}

export default withAdmin(handler);
