// /scripts/local-automation-cron.js
// Local automation flow runner (Windows-safe)
// Run: node scripts/local-automation-cron.js
// It calls the automation tick engine for all flows every 30 seconds.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = process.env.BASE_URL || process.env.APP_URL || 'http://localhost:3001';
const CRON_SECRET = process.env.AUTOMATION_CRON_SECRET || process.env.CRON_SECRET || "your-secret-here";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function getFlows() {
  try {
    const { data: flows, error } = await supabase
      .from("automation_flows")
      .select("id, name")
      .eq("is_standard", false); // Only process user flows, not templates

    if (error) {
      console.log(`Failed to get flows: ${error.message}`);
      return [];
    }

    return flows || [];
  } catch (e) {
    console.log(`Error getting flows: ${e.message}`);
    return [];
  }
}

async function tickFlow(flowId, flowName) {
  const ts = new Date().toLocaleTimeString();
  try {
    const res = await fetch(`${BASE_URL}/api/automation/engine/tick`, {
      method: "POST",
      headers: {
        "x-cron-key": CRON_SECRET,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ flow_id: flowId, max: 50 }),
    });

    const raw = await res.text();
    if (!res.ok) {
      console.log(`[${ts}] Flow ${flowId} (${flowName}) -> ${res.status} ERROR: ${raw}`);
      return;
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      console.log(`[${ts}] Flow ${flowId} (${flowName}) -> ${raw}`);
      return;
    }

    const debug = data.debug || {};
    console.log(`[${ts}] Flow ${flowId} (${flowName}) -> Processed: ${debug.processed || 0}, Sent: ${debug.sent || 0}, Advanced: ${debug.advanced || 0}`);
  } catch (e) {
    console.log(`[${ts}] Flow ${flowId} (${flowName}) -> FETCH ERROR: ${e?.message || e}`);
  }
}

async function tick() {
  const flows = await getFlows();

  if (flows.length === 0) {
    console.log("No flows found");
    return;
  }

  console.log(`Processing ${flows.length} flows...`);

  for (const flow of flows) {
    if (flow.id) {
      await tickFlow(flow.id, flow.name || 'Unnamed');
      // Small delay between flows
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

console.log("Local automation runner started (every 30s)");
console.log(`Using CRON_SECRET: ${CRON_SECRET ? 'SET' : 'NOT SET'}`);
console.log(`Using BASE_URL: ${BASE_URL}`);
console.log(`Using SUPABASE_URL: ${SUPABASE_URL ? 'SET' : 'NOT SET'}`);