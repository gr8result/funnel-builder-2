import { createClient } from "@supabase/supabase-js";

/**
 * Simple SendGrid event webhook for Next.js
 *
 * - Expects SendGrid to POST JSON (an array of event objects).
 * - Inserts rows into `email_events` with columns: event, url, ts
 *
 * IMPORTANT:
 * - Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel (Project Settings -> Environment Variables)
 * - This handler intentionally keeps mapping simple (owner/contact not set).
 */

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const config = {
  api: {
    bodyParser: true, // default; Next will parse JSON body
  },
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).send("Method Not Allowed");
    }

    // SendGrid sends an array of events. If single object is posted, normalize to array.
    let events = req.body;
    if (!Array.isArray(events)) events = [events];

    if (!events.length) {
      return res.status(400).json({ error: "No events in request body" });
    }

    // Map SendGrid events to columns in email_events
    // Your table columns (from inspection) are: id, owner, contact_id, campaign_id, event, url, ts
    const rows = events.map((ev) => {
      // ev.timestamp from SendGrid is seconds since epoch; convert to ISO
      const ts = ev.timestamp ? new Date(Number(ev.timestamp) * 1000).toISOString() : new Date().toISOString();
      return {
        // leave owner/contact/campaign blank for now (null)
        event: ev.event ?? ev.type ?? null,
        url: ev.url ?? null,
        ts,
      };
    });

    // Insert into email_events
    const { data, error } = await supabase.from("email_events").insert(rows).select("id");

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ error: "DB insert failed", detail: error.message || error });
    }

    return res.status(200).json({ ok: true, inserted: Array.isArray(data) ? data.length : 0 });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(500).json({ error: "Server error", detail: String(err?.message || err) });
  }
}