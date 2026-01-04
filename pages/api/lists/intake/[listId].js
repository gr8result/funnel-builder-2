// /pages/api/lists/intake/[listId].js
// This is the single "door" your forms post to.

import { createClient } from "@supabase/supabase-js";
import { maybeAddToCRM } from "../../../../lib/lists/crm-sync"

// Use the SERVICE ROLE key on the SERVER ONLY (never in the browser).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { listId } = req.query;
  const apiKey = req.headers["x-api-key"]; // secret from list_api_keys

  if (!listId || !apiKey) return res.status(401).json({ error: "Missing listId or x-api-key" });

  try {
    // 1) Check the key belongs to this list and is active
    const { data: keyRow, error: keyErr } = await supabase
      .from("list_api_keys")
      .select("id, active, list_id")
      .eq("list_id", listId)
      .eq("api_key", apiKey)
      .maybeSingle();
    if (keyErr || !keyRow || !keyRow.active) return res.status(401).json({ error: "Invalid API key" });

    // 2) Tidy up the incoming data (accepts many common field names)
    const b = req.body || {};
    const payload = {
      first_name: pick(b, ["firstName","first_name","given_name"]) || "",
      last_name:  pick(b, ["lastName","last_name","family_name"]) || "",
      email:      (b.email || "").trim().toLowerCase(),
      phone:      digits(b.phone || b.mobile || ""),
      company:    b.company || "",
      position:   b.position || b.title || "",
      address:    b.address || b.physicalAddress || "",
      source:     b.source || req.headers["user-agent"] || "form",
      meta:       b, // keep the raw fields for later
    };

    // 3) Upsert subscriber into this list (dedupe by email or phone)
    const { data: found } = await supabase
      .from("subscribers")
      .select("id")
      .eq("list_id", listId)
      .or([
        payload.email ? `email.eq.${payload.email}` : "email.is.null",
        payload.phone ? `phone.eq.${payload.phone}` : "phone.is.null",
      ].join(","))
      .limit(1);

    let subId = found?.[0]?.id;
    if (subId) {
      const { error } = await supabase.from("subscribers").update({
        first_name: payload.first_name, last_name: payload.last_name,
        phone: payload.phone, company: payload.company, position: payload.position, address: payload.address,
        source: payload.source, meta: payload.meta
      }).eq("id", subId);
      if (error) throw error;
    } else {
      const { data: ins, error } = await supabase.from("subscribers").insert({
        list_id: listId,
        first_name: payload.first_name, last_name: payload.last_name,
        email: payload.email || null, phone: payload.phone || null,
        company: payload.company, position: payload.position, address: payload.address,
        source: payload.source, meta: payload.meta
      }).select("id").single();
      if (error) throw error;
      subId = ins.id;
    }

    // 4) Also add to CRM if that list’s toggle is ON
    await maybeAddToCRM(listId, {
      firstName: payload.first_name, lastName: payload.last_name,
      email: payload.email, phone: payload.phone,
      company: payload.company, position: payload.position, address: payload.address
    });

    return res.status(200).json({ ok: true, subscriber_id: subId });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Intake failed" });
  }
}

function pick(obj, keys) { for (const k of keys) if (obj?.[k]) return obj[k]; return ""; }
function digits(s) { return String(s||"").replace(/\D+/g, ""); }
