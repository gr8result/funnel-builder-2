// scripts/sync-twilio-call-times.js
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function run(limit = 500) {
  // pull calls we have in Supabase
  const { data: calls, error } = await supabase
    .from('crm_calls')
    .select('id, call_sid, created_at, from_number, to_number')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  for (const c of calls) {
    if (!c.call_sid) continue;
    try {
      const tw = await client.calls(c.call_sid).fetch();
      const ts = tw.startTime || tw.dateCreated || tw.dateUpdated;
      if (!ts) continue;

      // Write Twilio start_time back to Supabase
      await supabase
        .from('crm_calls')
        .update({ created_at: ts })
        .eq('id', c.id);

      console.log(`Synced ${c.call_sid} -> ${ts.toISOString()}`);
    } catch (err) {
      console.warn(`Skip ${c.call_sid}: ${err.message}`);
    }
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});