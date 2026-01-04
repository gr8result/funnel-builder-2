// /pages/api/lead/import-csv.js
// ✅ Debug Version — logs full Supabase responses so we can fix the import
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const sb = createClient(supabaseUrl, serviceKey);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { list_id, leads } = req.body || {};
    console.log("📥 Incoming CSV import request:", {
      list_id,
      leadsCount: leads?.length,
      firstLead: leads?.[0],
    });

    if (!list_id) {
      console.log("❌ Missing list_id");
      return res.status(400).json({ error: "Missing list_id" });
    }

    if (!Array.isArray(leads) || leads.length === 0) {
      console.log("❌ No leads provided");
      return res.status(400).json({ error: "No leads provided" });
    }

    // Prepare clean lead rows
    const prepared = leads
      .map((l) => ({
        full_name: l.full_name || l.name || "",
        email: (l.email || "").trim().toLowerCase(),
        phone: l.phone || "",
        source: l.source || "CSV Import",
        tags: l.tags || "",
        list_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))
      .filter((x) => x.email && x.email.includes("@"));

    console.log("🧩 Prepared leads to insert:", prepared.length);

    const { data, error } = await sb.from("leads").insert(prepared).select();

    if (error) {
      console.error("❌ SUPABASE INSERT ERROR:");
      console.error(JSON.stringify(error, null, 2));
      return res.status(400).json({
        error: "Supabase insert failed",
        details: error,
      });
    }

    console.log("✅ Import success:", data?.length, "rows inserted");
    return res.status(200).json({
      ok: true,
      message: `✅ Imported ${data?.length || 0} leads.`,
      inserted: data,
    });
  } catch (err) {
    console.error("❌ UNEXPECTED ERROR:");
    console.error(err);
    return res.status(500).json({
      error: err.message || "Unexpected import error",
      stack: err.stack,
    });
  }
}
