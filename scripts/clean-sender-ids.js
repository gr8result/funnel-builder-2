// scripts/clean-sender-ids.js
// One-time script to clean up sender_id values in accounts table (remove trailing whitespace/newlines)

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function cleanSenderIds() {
  console.log("🔍 Fetching accounts with sender_id...");
  
  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("id, user_id, business_name, sender_id")
    .not("sender_id", "is", null);

  if (error) {
    console.error("❌ Error fetching accounts:", error);
    return;
  }

  if (!accounts || accounts.length === 0) {
    console.log("✅ No accounts with sender_id found");
    return;
  }

  console.log(`📋 Found ${accounts.length} accounts with sender_id`);
  
  let updated = 0;
  let skipped = 0;

  for (const account of accounts) {
    const original = account.sender_id;
    const trimmed = original ? String(original).trim() : "";
    
    if (original !== trimmed) {
      console.log(`\n🔧 Cleaning sender_id for account ${account.id}:`);
      console.log(`   Business: ${account.business_name}`);
      console.log(`   Original: "${original}" (length: ${original?.length || 0})`);
      console.log(`   Trimmed:  "${trimmed}" (length: ${trimmed.length})`);
      
      const { error: updateError } = await supabase
        .from("accounts")
        .update({ sender_id: trimmed })
        .eq("id", account.id);
      
      if (updateError) {
        console.error(`   ❌ Failed to update: ${updateError.message}`);
      } else {
        console.log(`   ✅ Updated successfully`);
        updated++;
      }
    } else {
      skipped++;
    }
  }

  console.log(`\n✅ Cleaning complete!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped (already clean): ${skipped}`);
}

cleanSenderIds()
  .then(() => {
    console.log("\n🎉 Done!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Fatal error:", err);
    process.exit(1);
  });
