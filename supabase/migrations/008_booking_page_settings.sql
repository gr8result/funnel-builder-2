-- 008_booking_page_settings.sql
-- Adds booking page customisation columns to the profiles table
-- and creates the bookings table if it doesn't already exist.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS booking_page_title   text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS booking_page_bio     text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS booking_accent_color text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS booking_logo_url     text;

-- Bookings table (created here in case it was missed earlier)
CREATE TABLE IF NOT EXISTS bookings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id         uuid,
  client_name        text,
  client_email       text,
  client_phone       text,
  start_datetime     timestamptz NOT NULL,
  end_datetime       timestamptz NOT NULL,
  status             text        NOT NULL DEFAULT 'confirmed',
  amount_paid        numeric,
  payment_intent_id  text,
  custom_field_data  jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Allow providers to read their own bookings
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bookings' AND policyname = 'bookings_provider_read'
  ) THEN
    EXECUTE 'CREATE POLICY bookings_provider_read ON bookings FOR SELECT USING (auth.uid() = user_id)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bookings' AND policyname = 'bookings_public_insert'
  ) THEN
    EXECUTE 'CREATE POLICY bookings_public_insert ON bookings FOR INSERT WITH CHECK (true)';
  END IF;
END $$;

-- Allow public (unauthenticated) reads of profiles so the booking page can load
-- Skip this if the policy already exists — just ensure it is present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_public_read'
  ) THEN
    EXECUTE 'CREATE POLICY profiles_public_read ON profiles FOR SELECT USING (true)';
  END IF;
END $$;
