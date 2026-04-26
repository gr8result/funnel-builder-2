// Make campaign_id nullable in email_campaigns_queue
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

export default async function handler(req, res) {
  try {
    // Try to alter the table to make campaign_id nullable
    const { error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE email_campaigns_queue ALTER COLUMN campaign_id DROP NOT NULL;'
    });

    if (error) {
      // If RPC doesn't exist, return instruction
      return res.json({
        ok: false,
        error: error.message,
        instruction: "Run this SQL in Supabase SQL Editor: ALTER TABLE email_campaigns_queue ALTER COLUMN campaign_id DROP NOT NULL;"
      });
    }

    return res.json({
      ok: true,
      message: "campaign_id is now nullable"
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: String(err),
      instruction: "Run this SQL in Supabase SQL Editor: ALTER TABLE email_campaigns_queue ALTER COLUMN campaign_id DROP NOT NULL;"
    });
  }
}
