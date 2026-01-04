// /supabase/functions/handle-event/index.ts
// FULL REPLACEMENT — JS-ONLY (no TS syntax)
// ✅ Safe JSON parsing
// ✅ Logs automation_events
// ✅ Advances automation_queue rows waiting for event_type
// ✅ Clean error responses (no crashes)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


serve(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // Parse body safely
    let body = {};
    const ct = (req.headers.get("content-type") || "").toLowerCase();

    if (ct.includes("application/json")) {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    } else {
      const txt = await req.text().catch(() => "");
      body = txt ? { raw: txt } : {};
    }

    const contact_id = body.contact_id ?? body.contactId ?? null;
    const event_type = body.event_type ?? body.eventType ?? null;

    if (!contact_id || !event_type) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing contact_id or event_type",
          received: { contact_id, event_type },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Log event (best effort)
    const ins = await supabase.from("automation_events").insert({
      contact_id,
      event_type,
      payload: body,
      created_at: new Date().toISOString(),
    });

    if (ins.error) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Failed to log event",
          detail: ins.error.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Find waiting queue rows
    const { data: waiting, error: waitErr } = await supabase
      .from("automation_queue")
      .select("id,next_node")
      .eq("contact_id", contact_id)
      .eq("waiting_condition", event_type);

    if (waitErr) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Queue lookup failed",
          detail: waitErr.message,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    let advanced = 0;

    if (waiting && waiting.length) {
      for (const q of waiting) {
        const up = await supabase
          .from("automation_queue")
          .update({
            current_node: q.next_node,
            waiting_condition: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", q.id);

        if (!up.error) advanced += 1;
      }
    }

    return new Response(JSON.stringify({ ok: true, advanced }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("handle-event error:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: String((err && err.message) || err || "Unknown error"),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
