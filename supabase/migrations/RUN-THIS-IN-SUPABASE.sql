-- ============================================================
-- CALENDAR BOOKING FULL SETUP
-- Paste this entire file into Supabase > SQL Editor > Run
-- Safe to run multiple times (all IF NOT EXISTS)
-- ============================================================

-- 1. booking_page_settings (replaces storing settings in profiles)
CREATE TABLE IF NOT EXISTS booking_page_settings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  page_title   text,
  page_bio     text,
  accent_color text DEFAULT '#84cc16',
  logo_url     text,
  updated_at   timestamptz DEFAULT now()
);
ALTER TABLE booking_page_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='booking_page_settings' AND policyname='bps_owner') THEN
    EXECUTE 'CREATE POLICY bps_owner ON booking_page_settings USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='booking_page_settings' AND policyname='bps_public_read') THEN
    EXECUTE 'CREATE POLICY bps_public_read ON booking_page_settings FOR SELECT USING (true)';
  END IF;
END $$;

-- 2. service_page_settings (per-service appearance overrides)
CREATE TABLE IF NOT EXISTS service_page_settings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id   uuid NOT NULL UNIQUE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_title   text,
  page_bio     text,
  accent_color text,
  logo_url     text,
  updated_at   timestamptz DEFAULT now()
);
ALTER TABLE service_page_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_page_settings' AND policyname='sps_owner') THEN
    EXECUTE 'CREATE POLICY sps_owner ON service_page_settings USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_page_settings' AND policyname='sps_public_read') THEN
    EXECUTE 'CREATE POLICY sps_public_read ON service_page_settings FOR SELECT USING (true)';
  END IF;
END $$;

-- 3. bookings table
CREATE TABLE IF NOT EXISTS bookings (
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
);
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bookings' AND policyname='bookings_provider_read') THEN
    EXECUTE 'CREATE POLICY bookings_provider_read ON bookings FOR SELECT USING (auth.uid() = user_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bookings' AND policyname='bookings_public_insert') THEN
    EXECUTE 'CREATE POLICY bookings_public_insert ON bookings FOR INSERT WITH CHECK (true)';
  END IF;
END $$;

-- 4. provider_availability (if missing)
CREATE TABLE IF NOT EXISTS provider_availability (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week  int NOT NULL,  -- 0=Sun, 1=Mon ... 6=Sat
  start_time   text NOT NULL, -- e.g. '09:00'
  end_time     text NOT NULL, -- e.g. '17:00'
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE provider_availability ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='provider_availability' AND policyname='pa_owner') THEN
    EXECUTE 'CREATE POLICY pa_owner ON provider_availability USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='provider_availability' AND policyname='pa_public_read') THEN
    EXECUTE 'CREATE POLICY pa_public_read ON provider_availability FOR SELECT USING (true)';
  END IF;
END $$;

-- 5. services (if missing)
CREATE TABLE IF NOT EXISTS services (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             text NOT NULL,
  duration_minutes int  NOT NULL DEFAULT 60,
  price            numeric DEFAULT 0,
  buffer_minutes   int DEFAULT 0,
  active           boolean DEFAULT true,
  created_at       timestamptz DEFAULT now()
);
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='services' AND policyname='svc_owner') THEN
    EXECUTE 'CREATE POLICY svc_owner ON services USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='services' AND policyname='svc_public_read') THEN
    EXECUTE 'CREATE POLICY svc_public_read ON services FOR SELECT USING (true)';
  END IF;
END $$;
