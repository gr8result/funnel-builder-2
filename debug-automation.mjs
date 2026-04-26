import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.log("Missing SUPABASE env vars");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

async function main() {
  // Get flows
  const { data: flows } = await supabase
    .from("automation_flows")
    .select("id, name, user_id");

  console.log("\n=== AUTOMATION FLOWS ===");
  console.log(JSON.stringify(flows, null, 2));

  for (const flow of flows || []) {
    console.log(`\n=== FLOW: ${flow.name} (${flow.id}) ===`);

    // Get members
    const { data: members } = await supabase
      .from("automation_flow_members")
      .select("*")
      .eq("flow_id", flow.id);

    console.log(`Members: ${members?.length || 0}`);
    members?.slice(0, 3)?.forEach((m) => {
      console.log(`  - lead=${m.lead_id}, status=${m.status}`);
    });

    // Get runs
    const { data: runs } = await supabase
      .from("automation_flow_runs")
      .select("*")
      .eq("flow_id", flow.id)
      .order("created_at", { ascending: false });

    console.log(`Runs: ${runs?.length || 0}`);
    runs?.slice(0, 5)?.forEach((r) => {
      console.log(
        `  - lead=${r.lead_id}, status=${r.status}, node=${r.current_node_id}`
      );
    });

    // Get nodes
    const { data: flowDef } = await supabase
      .from("automation_flows")
      .select("nodes")
      .eq("id", flow.id)
      .single();

    const nodes = flowDef?.nodes || [];
    console.log(`Nodes: ${nodes.length}`);
    nodes.slice(0, 5).forEach((n) => {
      console.log(`  - ${n.id}: type=${n.type}, data=${JSON.stringify(n.data).substring(0, 80)}`);
    });
  }
}

main().catch(console.error);
