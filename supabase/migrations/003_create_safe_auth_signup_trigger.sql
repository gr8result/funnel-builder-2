-- Creates a resilient auth signup trigger that attempts to create an account row
-- without blocking user creation if app tables are not fully ready.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF to_regclass('public.accounts') IS NOT NULL THEN
      INSERT INTO public.accounts (
        user_id,
        email,
        full_name,
        status,
        is_approved,
        subscription_status,
        created_at
      )
      VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), split_part(NEW.email, '@', 1), 'New User'),
        'pending',
        false,
        'none',
        NOW()
      )
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Never block auth signup because of profile/account provisioning failures.
      NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();
