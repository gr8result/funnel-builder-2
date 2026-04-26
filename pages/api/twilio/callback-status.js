// /pages/api/twilio/callback-status.js
// FULL REPLACEMENT
// Twilio call status callback receiver (POST form encoded OR GET)
// ✅ Writes call outcome into leads.notes
// ✅ Adds "try again later" reminder line on no-answer/busy

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function stamp() {
  return new Date().toLocaleString("en-AU", { hour12: true });
}

async function appendNote(lead_id, note) {
  if (!lead_id || !SUPABASE_URL || !SERVICE_KEY) return;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: row } = await admin
    .from("leads")
    .select("id,notes")
    .eq("id", lead_id)
    .maybeSingle();

  if (!row) return;

  const existing = typeof row.notes === "string" ? row.notes : "";
  const next = `${existing ? existing.trimEnd() + "\n\n" : ""}[${stamp()}] ${note}`.trim();
  await admin.from("leads").update({ notes: next }).eq("id", lead_id);
}

export default async function handler(req, res) {
  try {
    const params = req.method === "POST" ? req.body : req.query;

    const lead_id = String(req.query.lead_id || params?.lead_id || "").trim();
    const user_id = String(req.query.user_id || params?.user_id || "").trim();
    const to = String(req.query.to || params?.To || params?.to || "").trim();
    const name = String(req.query.name || params?.contact_name || "").trim();

    const CallSid = String(params?.CallSid || req.query.CallSid || "").trim();
    const CallStatus = String(params?.CallStatus || req.query.CallStatus || "").trim(); // completed/busy/no-answer/failed
    const Duration = String(params?.CallDuration || req.query.CallDuration || "").trim();
    const From = String(params?.From || req.query.From || "").trim();

    // ✅ Create or update crm_calls record with user_id and duration
    if (CallSid && SUPABASE_URL && SERVICE_KEY) {
      try {
        const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
          auth: { persistSession: false },
        });

        const durationNum = Duration && !isNaN(Number(Duration)) ? Number(Duration) : null;

        // Check if this CallSid already has a record
        const { data: existing } = await admin
          .from("crm_calls")
          .select("id")
          .eq("twilio_sid", CallSid)
          .maybeSingle();

        if (!existing && lead_id) {
          // Insert initial record if recording hasn't been processed yet
          // This ensures user_id is set even for calls without recordings
          await admin
            .from("crm_calls")
            .insert({
              user_id: user_id || null,
              lead_id: lead_id || null,
              direction: "outbound",
              from_number: From || null,
              to_number: to || null,
              twilio_sid: CallSid,
              status: CallStatus || null,
              duration: durationNum,
              unread: true,
              created_at: new Date().toISOString(),
            });
        } else if (existing) {
          // Update existing record with user_id and duration
          const updateData = { status: CallStatus || null };
          
          if (user_id) {
            updateData.user_id = user_id;
          }
          
          if (durationNum !== null) {
            updateData.duration = durationNum;
          }

          await admin
            .from("crm_calls")
            .update(updateData)
            .eq("id", existing.id);
        }
      } catch (e) {
        console.error("[callback-status] Error updating crm_calls:", e?.message);
        // Non-fatal, continue
      }
    }

    if (lead_id) {
      const label = name ? `${name} (${to || "unknown"})` : (to || "unknown");
      const meta = [
        CallStatus ? `status=${CallStatus}` : null,
        Duration ? `duration=${Duration}s` : null,
        CallSid ? `sid=${CallSid}` : null,
      ].filter(Boolean).join(", ");

      await appendNote(lead_id, `Call result: ${label}${meta ? ` — ${meta}` : ""}.`);

      const s = CallStatus.toLowerCase();
      if (s === "no-answer") {
        await appendNote(lead_id, `Reminder: Call not answered — try again later.`);
      }
      if (s === "busy") {
        await appendNote(lead_id, `Reminder: Line busy — try again later.`);
      }
      if (s === "failed") {
        await appendNote(lead_id, `Reminder: Call failed — check number and try again.`);
      }
    }

    return res.status(200).send("ok");
  } catch (e) {
    return res.status(200).send("ok");
  }
}
