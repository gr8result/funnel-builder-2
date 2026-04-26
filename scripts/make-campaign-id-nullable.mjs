import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function makeCampaignIdNullable() {
  console.log("Making campaign_id nullable in email_campaigns_queue...");
  
  try {
    // First, check if the column exists and is not null
    const { data: columns, error: checkErr } = await supabase
      .from("email_campaigns_queue")
      .select("campaign_id")
      .limit(1);

    if (checkErr) {
      console.error("Error checking table:", checkErr.message);
      console.log("\nPlease run this SQL in Supabase SQL Editor:");
      console.log("ALTER TABLE email_campaigns_queue ALTER COLUMN campaign_id DROP NOT NULL;");
      process.exit(1);
    }

    console.log("✓ Table exists");
    console.log("\n⚠️  You need to run this SQL in Supabase SQL Editor:");
    console.log("ALTER TABLE email_campaigns_queue ALTER COLUMN campaign_id DROP NOT NULL;");
    console.log("\nThis will allow automation flows to queue emails without a campaign.");
    
  } catch (err) {
    console.error("Error:", err.message);
    console.log("\nPlease run this SQL in Supabase SQL Editor:");
    console.log("ALTER TABLE email_campaigns_queue ALTER COLUMN campaign_id DROP NOT NULL;");
    process.exit(1);
  }
}

makeCampaignIdNullable();
