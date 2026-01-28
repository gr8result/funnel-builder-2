// Sync Twilio call timestamps into Supabase crm_calls
// Usage (PowerShell):
//   $env:SUPABASE_URL="https://..."; $env:SUPABASE_SERVICE_ROLE_KEY="..."; $env:TWILIO_ACCOUNT_SID="..."; $env:TWILIO_AUTH_TOKEN="..."
//   node scripts/sync-twilio-call-times.mjs

import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const twilioSid = process.env.TWILIO_ACCOUNT_SID;
const twilioToken = process.env.TWILIO_AUTH_TOKEN;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}
if (!twilioSid || !twilioToken) {
  console.error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN env vars.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
const client = twilio(twilioSid, twilioToken);

async function run(limit = 500) {
  const { data: calls, error } = await supabase
    .from("crm_calls")
    .select("id, twilio_sid, created_at, tw_start_at, from_number, to_number")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  let updated = 0;
  let skippedNoSid = 0;
  let skippedNoTs = 0;
  let wroteTwStart = 0;

  for (const c of calls || []) {
    if (!c.twilio_sid) {
      skippedNoSid++;
      continue;
    }
    try {
      const tw = await client.calls(c.twilio_sid).fetch();
      const ts = tw.startTime || tw.dateCreated || tw.endTime || tw.dateUpdated;
      if (!ts) {
        skippedNoTs++;
        console.warn(`No timestamp for ${c.twilio_sid}`);
        continue;
      }

      const updates = { tw_start_at: ts };

      // Only update created_at if it differs to avoid unnecessary writes
      if (!c.created_at || new Date(c.created_at).getTime() !== ts.getTime()) {
        updates.created_at = ts;
      }

      // Sync from/to numbers from Twilio
      if (tw.from) updates.from_number = tw.from;
      if (tw.to) updates.to_number = tw.to;

      const { error: upErr } = await supabase.from("crm_calls").update(updates).eq("id", c.id);

      if (upErr) throw upErr;
      updated++;
      wroteTwStart++;
      const phoneInfo = tw.from || tw.to ? `, from=${tw.from}, to=${tw.to}` : "";
      console.log(`Synced ${c.twilio_sid} -> tw_start_at=${ts.toISOString()}${updates.created_at ? ", created_at updated" : ""}${phoneInfo}`);
    } catch (err) {
      console.warn(`Skip ${c.twilio_sid}: ${err.message}`);
    }
  }

  console.log(
    `Done. Updated=${updated}, wroteTwStart=${wroteTwStart}, skippedNoSid=${skippedNoSid}, skippedNoTs=${skippedNoTs}`
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
