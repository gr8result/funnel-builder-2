// pages/api/calendar/setup-tables.js
// One-time setup: creates the booking_page_settings and service_page_settings tables
// and adds missing columns to profiles if they don't exist yet.
// Safe to call multiple times — everything is IF NOT EXISTS.
// Call this once from the booking-page editor on mount.

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import withAdmin from "../../../lib/withAdmin";

const SQL_STATEMENTS = [
  // Booking page settings as a standalone table (avoids altering profiles)
  `CREATE TABLE IF NOT EXISTS booking_page_settings (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    page_title     text,
    page_bio       text,
    accent_color   text DEFAULT '#84cc16',
    logo_url       text,
    updated_at     timestamptz DEFAULT now()
  )`,

  `ALTER TABLE booking_page_settings ENABLE ROW LEVEL SECURITY`,

  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename='booking_page_settings' AND policyname='bps_owner'
    ) THEN
      EXECUTE 'CREATE POLICY bps_owner ON booking_page_settings USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
    END IF;
  END $$`,

  // Per-service page settings
  `CREATE TABLE IF NOT EXISTS service_page_settings (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id     uuid NOT NULL UNIQUE,
    user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    page_title     text,
    page_bio       text,
    accent_color   text,
    logo_url       text,
    updated_at     timestamptz DEFAULT now()
  )`,

  `ALTER TABLE service_page_settings ENABLE ROW LEVEL SECURITY`,

  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename='service_page_settings' AND policyname='sps_owner'
    ) THEN
      EXECUTE 'CREATE POLICY sps_owner ON service_page_settings USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename='service_page_settings' AND policyname='sps_public_read'
    ) THEN
      EXECUTE 'CREATE POLICY sps_public_read ON service_page_settings FOR SELECT USING (true)';
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename='booking_page_settings' AND policyname='bps_public_read'
    ) THEN
      EXECUTE 'CREATE POLICY bps_public_read ON booking_page_settings FOR SELECT USING (true)';
    END IF;
  END $$`,

  // Bookings table
  `CREATE TABLE IF NOT EXISTS bookings (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    service_id        uuid,
    client_name       text,
    client_email      text,
    client_phone      text,
    start_datetime    timestamptz NOT NULL,
    end_datetime      timestamptz NOT NULL,
    status            text NOT NULL DEFAULT 'confirmed',
    amount_paid       numeric,
    payment_intent_id text,
    custom_field_data jsonb,
    created_at        timestamptz NOT NULL DEFAULT now()
  )`,

  `ALTER TABLE bookings ENABLE ROW LEVEL SECURITY`,

  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename='bookings' AND policyname='bookings_provider_read'
    ) THEN
      EXECUTE 'CREATE POLICY bookings_provider_read ON bookings FOR SELECT USING (auth.uid() = user_id)';
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename='bookings' AND policyname='bookings_public_insert'
    ) THEN
      EXECUTE 'CREATE POLICY bookings_public_insert ON bookings FOR INSERT WITH CHECK (true)';
    END IF;
  END $$`,
];

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const errors = [];
  for (const sql of SQL_STATEMENTS) {
    const { error } = await supabaseAdmin.rpc("exec_sql", { sql });
    if (error) {
      // exec_sql may not exist — fall back to trying via raw fetch
      errors.push(error.message);
    }
  }

  // If exec_sql doesn't exist, try using the Supabase management REST API
  if (errors.length > 0) {
    const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
      .replace("https://", "")
      .split(".")[0];
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!projectRef || !serviceKey) {
      return res.status(500).json({ error: "Cannot run migration: missing env vars", details: errors });
    }

    const mgmtErrors = [];
    for (const sql of SQL_STATEMENTS) {
      try {
        const r = await fetch(
          `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ query: sql }),
          }
        );
        if (!r.ok) {
          const txt = await r.text();
          mgmtErrors.push(txt);
        }
      } catch (e) {
        mgmtErrors.push(e.message);
      }
    }

    if (mgmtErrors.length > 0) {
      return res.status(207).json({
        ok: false,
        message: "Some statements may have failed. Run the migration SQL manually in Supabase.",
        errors: mgmtErrors,
      });
    }
  }

  return res.status(200).json({ ok: true });
}

export default withAdmin(handler);
